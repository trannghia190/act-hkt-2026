#!/usr/bin/env python3
"""
Ma trận sự kiện thông báo (S36) — sự kiện THẬT xảy ra → thông báo đúng theo cấu hình.

Với mỗi sự kiện có producer thật, chạy 3 cấu hình:
  1. Tắt hết kênh → sự kiện xảy ra → KHÔNG tạo notification/delivery.
  2. Chỉ bật WEB   → tạo đúng 1 notification mang event_key + 1 delivery WEB.
  3. Chỉ bật EMAIL → KHÔNG tạo notification (web tắt), tạo 1 delivery EMAIL.

Sự kiện được kích hoạt qua API thật (không gọi thẳng dispatcher):
  REQUEST_SUBMITTED  — nhân viên 136ACT nộp đơn      → 05ACT (quản lý)
  REQUEST_APPROVED   — 05ACT duyệt đơn               → 136ACT
  REQUEST_REJECTED   — 05ACT từ chối đơn             → 136ACT
  DISPUTE_RAISED     — 137ACT tạo khiếu nại          → 01HR
  DISPUTE_RESOLVED   — 01HR xử lý (FIX)              → 137ACT
  DISPUTE_REJECTED   — 01HR từ chối                  → 137ACT
  ONBOARDING         — HR tạo tài khoản mới          → chính tài khoản mới

Riêng ONBOARDING: thông báo phát ngay khi tạo user nên chưa thể có prefs
riêng — kiểm tra theo mặc định danh mục (web + email).

Chạy (backend :8080, DB pulse_db):
  python3 tests/api/test_notification_event_matrix.py
"""
import json
import subprocess
import sys
import urllib.request
from datetime import date, datetime

API = "http://localhost:8080/api/v1"
EMPLOYEE = "136ACT"       # người nộp đơn
APPROVER = "05ACT"        # quản lý trực tiếp
DISPUTER = "137ACT"       # người khiếu nại
HR = "01HR"


def psql(sql, check=True):
    r = subprocess.run(
        ["psql", "-h", "127.0.0.1", "-d", "pulse_db", "-tAc", sql],
        capture_output=True, text=True,
    )
    if check and r.returncode != 0:
        raise RuntimeError(r.stderr.strip())
    return r.stdout.strip()


def user_id(code):
    return psql(f"select id from users where employee_code='{code}'")


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
    print(("PASS " if cond else "FAIL ") + name + ("" if cond else " — " + str(extra)[:400]))
    if not cond:
        sys.exit(1)


def reset_prefs(token, event_key, web, email, push=False):
    """Chỉnh 1 sự kiện, tắt quiet hours + dedupe để phép đo tất định."""
    st, js = call("PUT", "/notifications/preferences", token, {
        "quietHoursEnabled": False,
        "dedupeHours": 0,
        "maxPushPerDay": 3,
        "pushEnabled": True,
        "events": {event_key: {"web": web, "email": email, "push": push}},
    })
    assert st == 200, js


def notif_count(uid, event_key, since):
    return int(psql(
        f"select count(*) from notifications where user_id='{uid}' "
        f"and event_key='{event_key}' and created_at >= '{since}'"))


DIE_LINK = {"/attendance", "/requests", "/leaves", "/disputes", "/timesheet",
            "/admin/okr", "/profile"}


def notif_action_url(uid, event_key, since):
    return psql(
        f"select coalesce(action_url,'') from notifications where user_id='{uid}' "
        f"and event_key='{event_key}' and created_at >= '{since}' limit 1")


def delivery_count(uid, event_key, channel, since):
    return int(psql(
        f"select count(*) from notification_deliveries where user_id='{uid}' "
        f"and event_key='{event_key}' and channel='{channel}' and delivered_at >= '{since}'"))


def stamp():
    return psql("select now()")


created_requests = []
created_disputes = []
created_users = []
touched_uids = set()


counters = {"req": 0, "dispute": 0}


def next_request_day():
    counters["req"] += 1
    # Xa dữ liệu mẫu (đơn gần nhất 2030-01) để tránh trùng ngày với đơn cũ.
    return f"2033-03-{(counters['req'] % 25) + 1:02d}"


def next_dispute_day():
    counters["dispute"] += 1
    # Khiếu nại chỉ mở trong kỳ công hiện tại (kỳ trước đã khoá hoàn toàn sau
    # cửa sổ khiếu nại), nên luôn lấy ngày trong tháng hiện tại.
    today = date.today()
    return f"{today.year}-{today.month:02d}-{(counters['dispute'] % 25) + 1:02d}"


# ── Trigger thật, trả về id để dọn dẹp ─────────────────────────────────────
def submit_request(employee_token, reason):
    st, js = call("POST", "/requests", employee_token, {
        "type": "LEAVE", "leaveType": "AL",
        "workDate": next_request_day(), "endDate": None,
        "reason": reason, "payload": "{}",
    })
    assert st == 200, js
    created_requests.append(js["data"]["id"])
    return js["data"]["id"]


def decide_request(manager_token, rid, approve, comment):
    path = f"/requests/{rid}/approve" if approve else f"/requests/{rid}/reject"
    st, js = call("POST", path, manager_token, {"comment": comment})
    assert st == 200, (path, st, js)
    return js


def create_dispute(token, reason):
    st, js = call("POST", "/disputes", token, {"workDate": next_dispute_day(), "reason": reason})
    assert st == 200, (st, js)
    created_disputes.append(js["data"]["id"])
    return js["data"]["id"]


def resolve_dispute(hr_token, did, action, reason):
    st, js = call("POST", f"/disputes/{did}/resolve", hr_token, {
        "action": action, "reason": reason,
        "requestedCheckIn": "08:30", "requestedCheckOut": "17:30",
    })
    assert st == 200, (did, st, js)
    return js


def create_user():
    code = "ZZN" + str(int(datetime.now().timestamp() * 1000))[-9:]
    st, js = call("POST", "/admin/users", hr_token, {
        "employeeCode": code, "fullName": "ZZ Matrix Onboarding",
    })
    assert st == 200, (st, js)
    uid = user_id(code)
    created_users.append((uid, code))
    touched_uids.add(uid)
    return code, uid


# ── Người dùng & token ──────────────────────────────────────────────────────
hr_token = login(HR)
mgr_token = login(APPROVER)
emp_token = login(EMPLOYEE)
disputer_token = login(DISPUTER)

uid_of = {EMPLOYEE: user_id(EMPLOYEE), APPROVER: user_id(APPROVER),
          DISPUTER: user_id(DISPUTER), HR: user_id(HR)}
touched_uids.update(uid_of.values())

original_prefs = {}
for code, token in ((EMPLOYEE, emp_token), (APPROVER, mgr_token),
                    (DISPUTER, disputer_token), (HR, hr_token)):
    original_prefs[code] = call("GET", "/notifications/preferences", token)[1]["data"]


def run_matrix(event_key, target_code, target_token, trigger):
    """3 cấu hình × 1 sự kiện; trigger() thực thi sự kiện thật."""
    uid = uid_of[target_code]

    # 1) Tắt hết kênh → không có gì được ghi.
    reset_prefs(target_token, event_key, web=False, email=False)
    ts = stamp()
    trigger()
    n = notif_count(uid, event_key, ts)
    d = sum(delivery_count(uid, event_key, ch, ts) for ch in ("WEB", "EMAIL", "PUSH", "DEFERRED"))
    check(f"{event_key}: tắt hết kênh → không thông báo", n == 0 and d == 0, f"notif={n} delivery={d}")

    # 2) Chỉ WEB → đúng 1 notification mang event_key + delivery WEB.
    reset_prefs(target_token, event_key, web=True, email=False)
    ts = stamp()
    trigger()
    n, w, e = (notif_count(uid, event_key, ts),
               delivery_count(uid, event_key, "WEB", ts),
               delivery_count(uid, event_key, "EMAIL", ts))
    check(f"{event_key}: chỉ WEB → 1 notification + delivery WEB",
          n == 1 and w == 1 and e == 0, f"notif={n} web={w} email={e}")

    # Bấm vào thông báo phải tới route có thật, không rơi vào link chết.
    url = notif_action_url(uid, event_key, ts)
    check(f"{event_key}: actionUrl trỏ route hợp lệ ({url or 'trống'})",
          url.startswith("/") and url not in DIE_LINK, url)

    # 3) Chỉ EMAIL → không notification (web tắt) + delivery EMAIL.
    reset_prefs(target_token, event_key, web=False, email=True)
    ts = stamp()
    trigger()
    n, w, e = (notif_count(uid, event_key, ts),
               delivery_count(uid, event_key, "WEB", ts),
               delivery_count(uid, event_key, "EMAIL", ts))
    check(f"{event_key}: chỉ EMAIL → 0 notification + delivery EMAIL",
          n == 0 and w == 0 and e == 1, f"notif={n} web={w} email={e}")


start_ts = stamp()
try:
    # REQUEST_SUBMITTED: người nộp đơn thật, người nhận = quản lý.
    run_matrix("REQUEST_SUBMITTED", APPROVER, mgr_token,
               lambda: submit_request(emp_token, f"ZZ matrix submit {datetime.now().timestamp()}"))

    # REQUEST_APPROVED / REQUEST_REJECTED: quản lý quyết định, người nhận = nhân viên.
    def trigger_approved():
        rid = submit_request(emp_token, f"ZZ matrix approve {datetime.now().timestamp()}")
        decide_request(mgr_token, rid, True, "Đồng ý")

    def trigger_rejected():
        rid = submit_request(emp_token, f"ZZ matrix reject {datetime.now().timestamp()}")
        decide_request(mgr_token, rid, False, "Không đủ phép")

    run_matrix("REQUEST_APPROVED", EMPLOYEE, emp_token, trigger_approved)
    run_matrix("REQUEST_REJECTED", EMPLOYEE, emp_token, trigger_rejected)

    # DISPUTE_RAISED: nhân viên tạo khiếu nại, người nhận = HR.
    run_matrix("DISPUTE_RAISED", HR, hr_token,
               lambda: create_dispute(disputer_token, f"ZZ matrix dispute {datetime.now().timestamp()}"))

    # DISPUTE_RESOLVED / REJECTED: HR xử lý, người nhận = nhân viên khiếu nại.
    def trigger_resolved():
        did = create_dispute(disputer_token, f"ZZ matrix fix {datetime.now().timestamp()}")
        resolve_dispute(hr_token, did, "FIX", "Đối chiếu log thấy có mặt")

    def trigger_dispute_rejected():
        did = create_dispute(disputer_token, f"ZZ matrix reject dispute {datetime.now().timestamp()}")
        resolve_dispute(hr_token, did, "REJECT", "Log không khớp")

    run_matrix("DISPUTE_RESOLVED", DISPUTER, disputer_token, trigger_resolved)
    run_matrix("DISPUTE_REJECTED", DISPUTER, disputer_token, trigger_dispute_rejected)

    # ONBOARDING: phát ngay lúc tạo tài khoản, chưa có prefs riêng → theo mặc định
    # danh mục (WEB + EMAIL). Kiểm tra notification + delivery thật.
    ts = stamp()
    code, uid = create_user()
    n = notif_count(uid, "ONBOARDING", ts)
    w = delivery_count(uid, "ONBOARDING", "WEB", ts)
    e = delivery_count(uid, "ONBOARDING", "EMAIL", ts)
    check("ONBOARDING: tạo tài khoản → notification + delivery theo mặc định",
          n == 1 and w == 1 and e == 1, f"notif={n} web={w} email={e}")
    url = notif_action_url(uid, "ONBOARDING", ts)
    check(f"ONBOARDING: actionUrl trỏ route hợp lệ ({url or 'trống'})",
          url.startswith("/") and url not in DIE_LINK, url)

finally:
    for code, token in ((EMPLOYEE, emp_token), (APPROVER, mgr_token),
                        (DISPUTER, disputer_token), (HR, hr_token)):
        orig = original_prefs.get(code)
        if not orig:
            continue
        call("PUT", "/notifications/preferences", token, {
            "quietHoursEnabled": orig["quietHoursEnabled"],
            "quietHoursStart": orig["quietHoursStart"],
            "quietHoursEnd": orig["quietHoursEnd"],
            "maxPushPerDay": orig["maxPushPerDay"],
            "dedupeHours": orig["dedupeHours"],
            "pushEnabled": orig["pushEnabled"],
            "events": orig["events"],
        })

    keys = "'REQUEST_SUBMITTED','REQUEST_APPROVED','REQUEST_REJECTED'," \
           "'DISPUTE_RAISED','DISPUTE_RESOLVED','DISPUTE_REJECTED','ONBOARDING'"
    # DISPUTE_RAISED phát cho MỌI HR/ADMIN, không chỉ 01HR → xoá theo cửa sổ thời gian.
    psql(f"delete from notification_deliveries where event_key in ({keys}) "
         f"and delivered_at >= '{start_ts}'", check=False)
    psql(f"delete from notifications where event_key in ({keys}) "
         f"and created_at >= '{start_ts}'", check=False)
    if created_requests:
        ids = ",".join("'" + r + "'" for r in created_requests)
        psql(f"delete from requests where id in ({ids})", check=False)
    if created_disputes:
        ids = ",".join("'" + d + "'" for d in created_disputes)
        psql(f"delete from timesheet_disputes where id in ({ids})", check=False)
    for uid, code in created_users:
        psql(f"delete from notification_deliveries where user_id='{uid}'", check=False)
        psql(f"delete from notifications where user_id='{uid}'", check=False)
        psql(f"delete from leave_ledger where user_id='{uid}'", check=False)
        psql(f"delete from refresh_tokens where user_id='{uid}'", check=False)
        psql(f"delete from face_profiles where user_id='{uid}'", check=False)
        psql(f"delete from users where id='{uid}'", check=False)

print("\nALL NOTIFICATION EVENT MATRIX CHECKS PASSED")
