#!/usr/bin/env python3
"""
Todo Inbox (S02) — phải gom ĐÚNG các việc còn chờ, không chỉ việc OKR.

Trước đây Inbox chỉ có 5 nguồn cố định và mục OKR luôn hiện vô điều kiện
("Còn 2 ngày" hard-code) → màn "Cần làm" không bao giờ báo:
  1. Ngày công thiếu chưa nộp đơn bổ sung (ADJUST_MAKEUP) và ngày đã quá hạn
     nộp (ADJUST_OVERDUE) — 2 hành động khác nhau nên tách 2 mục.
  2. Bảng công đã công bố mà còn hạn khiếu nại (DISPUTE_WINDOW).
  3. Việc OKR chỉ hiện khi thật sự còn hành động được, và khớp với dashboard OKR.

Test dùng nhân viên test riêng (ZZTODO01) để không lẫn với dữ liệu thật của
136ACT, seed bằng psql và dọn sạch cuối test. Chạy (backend :8080, DB pulse_db):
  python3 tests/api/test_todo_inbox_sources.py
"""
import json
import subprocess
import sys
import urllib.error
import urllib.request
from datetime import date, timedelta

API = "http://localhost:8080/api/v1"
EMP = "ZZTODO01"
EMP_UID = "f0000000-0000-0000-0000-000000000901"
MGR_UID = "d0000000-0000-0000-0000-000000000002"
TEAM_UID = "b0000000-0000-0000-0000-000000000011"
SHIFT_UID = "c0000000-0000-0000-0000-000000000001"
# Cửa sổ quét của service = deadline_working_days(3) + 3 → 6 ngày làm việc gần nhất.
LOOKBACK_DAYS = 6


def psql(sql, check=True):
    return subprocess.run(
        ["psql", "-h", "127.0.0.1", "-d", "pulse_db", "-tAc", sql],
        capture_output=True, text=True, check=check,
    ).stdout.strip()


def call(method, path, token=None, body=None):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(API + path, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")


def login(code):
    st, js = call("POST", "/auth/login", body={"employeeCodeOrEmail": code, "password": "123456"})
    assert st == 200, (code, st, js)
    return js["data"]["accessToken"]


def check(name, cond, extra=""):
    print(("PASS " if cond else "FAIL ") + name + ("" if cond else " — " + str(extra)[:600]))
    if not cond:
        sys.exit(1)


def inbox(token):
    st, js = call("GET", "/todos/my-inbox", token)
    assert st == 200, (st, js)
    return js["data"]


def by_kind(items, kind):
    return [i for i in items if i.get("kind") == kind]


def prev_working_day(d):
    d -= timedelta(days=1)
    while d.weekday() >= 5:
        d -= timedelta(days=1)
    return d


def working_days_back(n):
    """n ngày làm việc gần nhất, mới nhất trước."""
    out = []
    d = date.today()
    for _ in range(n):
        d = prev_working_day(d)
        out.append(d)
    return out


today = date.today()
# Cửa sổ quét của service = hôm nay + 5 ngày làm việc trước (deadline_working_days + 3).
scan_days = [today] + working_days_back(LOOKBACK_DAYS - 1)   # [hôm nay ... xa nhất]
open_day = scan_days[1]        # ngày làm việc gần nhất → còn nộp được
expired_day = scan_days[-1]    # ngày xa nhất trong cửa sổ → đã quá hạn
dispute_deadline = (today + timedelta(days=1)).isoformat() + " 23:59"

try:
    # ── Nhân viên test sạch: đủ log chấm công, chưa có hồ sơ OKR ─────────────
    psql(f"delete from refresh_tokens where user_id='{EMP_UID}'", check=False)
    psql(f"delete from users where employee_code='{EMP}'")
    psql(f"""insert into users (id, employee_code, full_name, email, password_hash, role, team_id,
              manager_id, shift_id, joined_date, status, position_name)
              values ('{EMP_UID}','{EMP}','Nguyễn Test Todo','zztodo01@test.local',
              (select password_hash from users where employee_code='05ACT'),
              'EMPLOYEE','{TEAM_UID}','{MGR_UID}','{SHIFT_UID}','2024-01-01','ACTIVE','Kỹ sư Phần mềm')""")
    # Chấm công đủ mọi ngày làm việc trong cửa sổ quét → chưa thiếu ngày nào.
    for d in scan_days:
        psql("insert into attendance_logs (user_id, work_date, type, status, check_in_at, check_out_at) "
             f"values ('{EMP_UID}','{d}','CHECK_OUT','VALID','{d} 08:05','{d} 17:10')")

    emp_token = login(EMP)
    base = inbox(emp_token)
    check("0. Inbox không có mục OKR check-in giả khi chưa có hồ sơ OKR",
          not by_kind(base, "OKR_CHECKIN"), [i.get("title") for i in base])
    check("0b. Inbox ban đầu không có ADJUST_MAKEUP (chưa thiếu ngày nào)",
          not by_kind(base, "ADJUST_MAKEUP"), [i.get("title") for i in base])
    check("0c. Inbox ban đầu không có ADJUST_OVERDUE (chưa quá hạn ngày nào)",
          not by_kind(base, "ADJUST_OVERDUE"), [i.get("title") for i in base])

    # ── 1. Ngày công thiếu chưa bổ sung → phải có việc ADJUST_MAKEUP ────────
    # Thiếu giờ ra ở 1 ngày làm việc gần nhất → chưa có đơn bổ sung.
    psql("update attendance_logs set check_out_at=null, status='INCOMPLETE' "
         f"where user_id='{EMP_UID}' and work_date='{open_day}'")

    items = inbox(emp_token)
    adjust = by_kind(items, "ADJUST_MAKEUP")
    check("1. Có việc ADJUST_MAKEUP khi ngày công thiếu chưa nộp đơn bổ sung", len(adjust) == 1,
          [i.get("title") for i in items])
    if adjust:
        a = adjust[0]
        check("1a. Mục ADJUST_MAKEUP trỏ đúng màn hình tạo đơn",
              a["actionUrl"].startswith("/attendance/requests") and "bổ sung" in a["actionLabel"].lower(), a)
        check("1a2. Mục ADJUST_MAKEUP mở form bổ sung công đúng ngày thiếu",
              "create=ADJUST" in a["actionUrl"] and open_day.isoformat() in a["actionUrl"], a)
        check("1b. Mục ADJUST_MAKEUP nêu đúng ngày thiếu công",
              open_day.strftime("%d/%m") in a["title"] + a["description"], a)
        check("1c. Mục ADJUST_MAKEUP không tick tay được (tự cập nhật theo dữ liệu thật)",
              a.get("completable") is False, a)
        check("1d. Mục ADJUST_MAKEUP có mức gấp hợp lệ",
              a.get("urgency") in ("overdue", "soon", "today"), a.get("urgency"))

    # Khi đã nộp đơn bổ sung → mục phải biến mất (tự cập nhật theo dữ liệu thật).
    psql("insert into requests (user_id, request_type, payload, work_date, reason, status, current_step) "
         f"values ('{EMP_UID}','ADJUST','{{}}'::jsonb,'{open_day}','ZZ test bổ sung công','PENDING_APPROVAL',1)")
    items2 = inbox(emp_token)
    check("2. Đã nộp đơn bổ sung → mục ADJUST_MAKEUP biến mất",
          not by_kind(items2, "ADJUST_MAKEUP"), [i.get("title") for i in items2])

    # ── 2b. Ngày đã quá hạn nộp → tách thành mục riêng, chỉ liên hệ HR ────────
    psql("update attendance_logs set check_out_at=null, status='INCOMPLETE' "
         f"where user_id='{EMP_UID}' and work_date='{expired_day}'")
    items2b = inbox(emp_token)
    over = by_kind(items2b, "ADJUST_OVERDUE")
    check("2b. Ngày quá hạn nộp bổ sung → có mục ADJUST_OVERDUE riêng", len(over) == 1,
          [i.get("title") for i in items2b])
    if over:
        check("2c. Mục quá hạn không mở form nộp (đã hết hạn) → chỉ liên hệ HR",
              over[0]["actionUrl"] == "/attendance/requests"
              and "hr" in over[0]["actionLabel"].lower(), over[0])
        check("2d. Mục quá hạn có mức gấp 'overdue'", over[0]["urgency"] == "overdue", over[0])
        check("2e. Mục quá hạn nêu đúng ngày",
              expired_day.strftime("%d/%m") in over[0]["title"] + over[0]["description"], over[0])
    # Trả lại log ngày quá hạn cho đủ chấm công.
    psql("update attendance_logs set check_out_at=check_in_at + interval '9 hours', status='VALID' "
         f"where user_id='{EMP_UID}' and work_date='{expired_day}'")

    # ── 3. Bảng công còn hạn khiếu nại → phải có việc DISPUTE_WINDOW ─────────
    psql("insert into timesheets (id, user_id, period_month, period_year, status, published_at, dispute_deadline) "
         f"values (gen_random_uuid(), '{EMP_UID}', 1, 2099, 'published', now(), '{dispute_deadline}')")
    items3 = inbox(emp_token)
    dispute = by_kind(items3, "DISPUTE_WINDOW")
    check("3. Có việc DISPUTE_WINDOW khi bảng công còn hạn khiếu nại", len(dispute) == 1,
          [i.get("title") for i in items3])
    if dispute:
        d = dispute[0]
        check("3a. Mục DISPUTE_WINDOW trỏ tới bảng công của tôi, đúng kỳ",
              d["actionUrl"].startswith("/attendance/my-timesheet")
              and "month=2099-01" in d["actionUrl"], d)
        check("3b. Mục DISPUTE_WINDOW hiển thị còn bao nhiêu ngày",
              d.get("dueDate") and "ngày" in d["dueDate"], d.get("dueDate"))

    # Hết hạn khiếu nại → mục phải biến mất.
    psql(f"update timesheets set dispute_deadline='{today - timedelta(days=1)} 23:59' "
         f"where user_id='{EMP_UID}' and period_year=2099")
    items4 = inbox(emp_token)
    check("4. Hết hạn khiếu nại → mục DISPUTE_WINDOW biến mất",
          not by_kind(items4, "DISPUTE_WINDOW"), [i.get("title") for i in items4])

    # ── 5. Mọi mục OKR phải có hạn thật, không phải chuỗi hard-code ───────────
    for i in [x for x in items4 if x.get("module") == "okr"]:
        check(f"5. Mục OKR '{i.get('title')}' không dùng hạn hard-code",
              i.get("dueDate") != "Còn 2 ngày", i.get("dueDate"))

    # ── 6. Đồng bộ với dashboard OKR (cùng nguồn việc) ──────────────────────
    st, dash = call("GET", "/okr/dashboard", emp_token)
    check("6. GET /okr/dashboard trả 200", st == 200, (st, dash))
    if st == 200:
        dash_todos = {t["id"] for t in dash["data"].get("todos", [])}
        inbox_okr = {i["id"] for i in items4 if i.get("module") == "okr"}
        check("6a. Danh sách việc OKR ở Inbox khớp dashboard OKR",
              inbox_okr == dash_todos,
              ("inbox=", sorted(inbox_okr), "dashboard=", sorted(dash_todos)))

    # ── 7. Hạn của mục OKR phải suy ra từ hạn thật (dashboard), không hard-code ──
    real_token = login("136ACT")
    real = inbox(real_token)
    st2, dash2 = call("GET", "/okr/dashboard", real_token)
    check("7. GET /okr/dashboard của 136ACT trả 200", st2 == 200, (st2, dash2))
    if st2 == 200:
        d2 = dash2["data"]
        okr_real = [i for i in real if i.get("module") == "okr"]

        # 7a. Mỗi mục OKR ở Inbox phải suy ra hạn từ deadline THẬT của dashboard
        # (mỗi loại việc có hạn riêng: tạo OKR = hạn setup, check-in = hạn kỳ,
        # tự chấm = hạn final) — không được hard-code.
        dash_todos = {t["id"]: t for t in (d2.get("todos") or [])}
        mismatched = []
        for i in okr_real:
            t = dash_todos.get(i["id"])
            if t is None:
                mismatched.append((i["id"], "không có trong dashboard"))
                continue
            due = t.get("deadline")
            if due is None:
                if i.get("dueDate") != "Không hạn":
                    mismatched.append((i["id"], i.get("dueDate")))
                continue
            left = (date.fromisoformat(due) - today).days
            expected = "Hạn hôm nay" if left <= 0 else f"Còn {left} ngày"
            if i.get("dueDate") != expected:
                mismatched.append((i["id"], i.get("dueDate"), expected))
        check("7a. Hạn mục OKR ở Inbox suy ra từ deadline thật của dashboard",
              not mismatched, mismatched)

        # 7b. Danh sách việc OKR ở Inbox khớp dashboard (cùng nguồn).
        check("7b. Danh sách việc OKR ở Inbox khớp dashboard OKR",
              {i["id"] for i in okr_real} == set(dash_todos),
              (sorted(i["id"] for i in okr_real), sorted(dash_todos)))

        # 7c. Không mục OKR nào dùng hạn hard-code.
        check("7c. Không mục OKR nào dùng hạn hard-code",
              all(i.get("dueDate") != "Còn 2 ngày" for i in okr_real),
              [(i.get("title"), i.get("dueDate")) for i in okr_real])

    print("\nALL TODO INBOX SOURCE TESTS PASSED")
finally:
    psql(f"delete from attendance_logs where user_id='{EMP_UID}'", check=False)
    psql(f"delete from requests where user_id='{EMP_UID}'", check=False)
    psql(f"delete from timesheets where user_id='{EMP_UID}'", check=False)
    psql(f"delete from todo_completions where user_id='{EMP_UID}'", check=False)
    psql(f"delete from okr_checkins where user_id='{EMP_UID}'", check=False)
    psql(f"delete from okr_items where review_id in "
         f"(select id from okr_reviews where user_id='{EMP_UID}')", check=False)
    psql(f"delete from okr_reviews where user_id='{EMP_UID}'", check=False)
    psql(f"delete from notification_deliveries where user_id='{EMP_UID}'", check=False)
    psql(f"delete from notifications where user_id='{EMP_UID}'", check=False)
    psql(f"delete from refresh_tokens where user_id='{EMP_UID}'", check=False)
    psql(f"delete from users where employee_code='{EMP}'", check=False)
