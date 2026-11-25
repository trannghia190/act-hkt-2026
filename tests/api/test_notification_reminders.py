#!/usr/bin/env python3
"""
Nhắc thông báo theo lịch (S36) — mọi sự kiện từng "có ô bật/tắt nhưng không
có producer" nay đều được phát thật và TÔN TRỌNG cấu hình kênh.

Với mỗi sự kiện: tắt hết kênh → không có thông báo; bật WEB → có
notification + delivery WEB; bật EMAIL → không có notification, có delivery EMAIL.

Quét qua endpoint HR: POST /cron/notification-reminders {date, time} để mô phỏng
thời điểm. Dữ liệu nguồn được seed bằng psql với nhãn "ZZ" và dọn sạch cuối test.

Chạy (backend :8080, DB pulse_db):
  python3 tests/api/test_notification_reminders.py
"""
import json
import subprocess
import sys
import urllib.request
from datetime import datetime

API = "http://localhost:8080/api/v1"
EMP = "136ACT"
MGR = "05ACT"
HR = "01HR"


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
    print(("PASS " if cond else "FAIL ") + name + ("" if cond else " — " + str(extra)[:500]))
    if not cond:
        sys.exit(1)


hr_token = login(HR)
uid = lambda code: psql(f"select id from users where employee_code='{code}'")
EMP_ID, MGR_ID = uid(EMP), uid(MGR)
START = psql("select now()")


def set_pref(target_id, key, web, email, push):
    st, js = call("PUT", "/notifications/preferences", hr_token, {
        "targetUserId": target_id,
        "quietHoursEnabled": False,
        "dedupeHours": 0,
        "maxPushPerDay": 100,
        "events": {key: {"web": web, "email": email, "push": push}},
    })
    check(f"Lưu prefs {key} web={web} email={email}", st == 200, js)


def run(date, time):
    st, js = call("POST", "/cron/notification-reminders", hr_token, {"date": date, "time": time})
    check(f"Chạy quét ngày {date} {time}", st == 200, js)
    return js["data"]["counts"]


def notif(key, target_id, since):
    return int(psql(f"select count(*) from notifications where event_key='{key}' "
                    f"and user_id='{target_id}' and created_at >= '{since}'"))


def delivery(key, target_id, channel, since):
    ch = "" if not channel else f"and channel='{channel}'"
    return int(psql(f"select count(*) from notification_deliveries where event_key='{key}' "
                    f"and user_id='{target_id}' {ch} and delivered_at >= '{since}'"))


def marker():
    return psql("select now()")


def fresh_day(key, target_id):
    """Xoá delivery của sự kiện để mỗi cấu hình kênh được coi là một ngày mới.

    Job chặn trùng theo (user, event, dedupeKey) trong ngày THẬT để cron chạy
    lặp không sinh trùng — nếu giữ delivery của lượt trước thì lượt sau bị chặn
    dù đã đổi cấu hình kênh.
    """
    psql("delete from notification_deliveries where "
         f"user_id='{target_id}' and event_key='{key}'")


def verify_cycle(key, target_id, date, time, label):
    """3 cấu hình kênh cho cùng một sự kiện."""
    fresh_day(key, target_id)
    set_pref(target_id, key, False, False, False)
    since = marker()
    counts = run(date, time)
    check(f"{label}: producer chạy (xuất hiện trong counts)", key in counts, counts)
    check(f"{label}: tắt hết kênh → không thông báo",
          notif(key, target_id, since) == 0 and delivery(key, target_id, None, since) == 0,
          (notif(key, target_id, since), delivery(key, target_id, None, since)))

    fresh_day(key, target_id)
    set_pref(target_id, key, True, False, False)
    since = marker()
    run(date, time)
    check(f"{label}: chỉ WEB → 1 notification + delivery WEB",
          notif(key, target_id, since) >= 1 and delivery(key, target_id, "WEB", since) >= 1,
          (notif(key, target_id, since), delivery(key, target_id, "WEB", since)))

    fresh_day(key, target_id)
    set_pref(target_id, key, False, True, False)
    since = marker()
    run(date, time)
    check(f"{label}: chỉ EMAIL → 0 notification + delivery EMAIL",
          notif(key, target_id, since) == 0 and delivery(key, target_id, "EMAIL", since) >= 1,
          (notif(key, target_id, since), delivery(key, target_id, "EMAIL", since)))


def map_user(code):
    return uid(code)


try:
    # ── Dữ liệu nền cho các phép quét ───────────────────────────────────
    psql("delete from attendance_logs where user_id='" + EMP_ID + "' "
         "and work_date in ('2026-12-02','2027-06-14','2027-06-15','2027-06-16')")
    # WFH đã duyệt hôm nay, chưa có báo cáo.
    psql("insert into requests (user_id, request_type, payload, work_date, reason, status, current_step) "
         f"values ('{EMP_ID}','WFH','{{}}'::jsonb,'2027-06-16','ZZ wfh no report','APPROVED',1)")
    # Đơn chờ duyệt quá SLA 48h → nhắc quản lý.
    psql("insert into requests (user_id, request_type, payload, work_date, reason, status, current_step, created_at) "
         f"values ('{EMP_ID}','LEAVE','{{}}'::jsonb,'2027-07-01','ZZ pending overdue','PENDING_APPROVAL',1,now()-interval '72 hours')")
    # Phép tồn sắp hết hạn (01/07).
    psql("insert into leave_ledger (user_id, leave_type, action, amount, balance_after, reason, performed_by_system) "
         f"values ('{EMP_ID}','AL','GRANT',50,50,'ZZ phép tồn 2026',true)")
    # Khiếu nại sắp quá hạn xử lý.
    psql("insert into timesheet_disputes (id, user_id, work_date, reason, status, deadline) "
         f"values ('ZZDSP0001','{EMP_ID}','2027-06-15','ZZ dispute','PENDING','2027-06-17 23:59')")

    # ── 1. Chấm công ─────────────────────────────────────────────────────
    verify_cycle("MISSING_CHECKIN", EMP_ID, "2026-12-02", "10:30",
                 "MISSING_CHECKIN (12-02 10:30, không có log)")
    # MISSING_CHECKOUT: có check-in, thiếu check-out (seed sau test check-in).
    psql("insert into attendance_logs (user_id, work_date, type, status, check_in_at) "
         f"values ('{EMP_ID}','2026-12-02','CHECK_IN','INCOMPLETE','2026-12-02 08:05')")
    verify_cycle("MISSING_CHECKOUT", EMP_ID, "2026-12-02", "19:30",
                 "MISSING_CHECKOUT (12-02 19:30, có in thiếu out)")
    verify_cycle("FORGOT_ATTENDANCE", EMP_ID, "2027-06-16", "10:30",
                 "FORGOT_ATTENDANCE (2 ngày làm việc trước trống)")
    verify_cycle("ADJUST_DEADLINE_SOON", EMP_ID, "2027-06-16", "10:30",
                 "ADJUST_DEADLINE_SOON (ngày 06-14 hạn 06-17)")
    verify_cycle("ADJUST_OVERDUE", EMP_ID, "2027-06-16", "10:30",
                 "ADJUST_OVERDUE (ngày 06-10 quá hạn)")
    verify_cycle("WFH_MISSING_REPORT", EMP_ID, "2027-06-16", "23:59",
                 "WFH_MISSING_REPORT")

    # ── 2. Đơn từ & phép ─────────────────────────────────────────────────
    verify_cycle("APPROVAL_OVERDUE", MGR_ID, "2027-06-16", "10:30",
                 "APPROVAL_OVERDUE → quản lý")
    verify_cycle("LEAVE_EXPIRY_SOON", EMP_ID, "2027-06-25", "10:30",
                 "LEAVE_EXPIRY_SOON (còn 6 ngày tới 01/07)")

    # ── 3. Bảng công & HR ────────────────────────────────────────────────
    verify_cycle("TIMESHEET_COMPLAINT_EXPIRING", uid(HR), "2027-06-16", "10:30",
                 "TIMESHEET_COMPLAINT_EXPIRING")
    verify_cycle("HR_CLOSE_TIMESHEET", uid(HR), "2026-12-01", "10:30",
                 "HR_CLOSE_TIMESHEET (close_day=1)")

    # TIMESHEET_CLOSED: chốt kỳ 2020-09 (đang draft) rồi khôi phục.
    psql("drop table if exists zz_ts_snapshot; "
         "create table zz_ts_snapshot as select id, status, published_at, dispute_deadline "
         "from timesheets where period_year=2020 and period_month=9")
    set_pref(EMP_ID, "TIMESHEET_CLOSED", True, False, False)
    since = marker()
    st, js = call("POST", "/timesheets/publish?month=2020-09", hr_token)
    check("Chốt kỳ 2020-09", st == 200, js)
    check("TIMESHEET_CLOSED → notification + delivery WEB",
          notif("TIMESHEET_CLOSED", EMP_ID, since) >= 1
          and delivery("TIMESHEET_CLOSED", EMP_ID, "WEB", since) >= 1,
          (notif("TIMESHEET_CLOSED", EMP_ID, since), delivery("TIMESHEET_CLOSED", EMP_ID, "WEB", since)))
    psql("update timesheets t set status=s.status, published_at=s.published_at, "
         "dispute_deadline=s.dispute_deadline from zz_ts_snapshot s where t.id=s.id; "
         "delete from timesheets where period_year=2020 and period_month=9 "
         "and id not in (select id from zz_ts_snapshot); drop table zz_ts_snapshot")

    # ── 4. OKR ───────────────────────────────────────────────────────────
    cycle_id = psql("select id from okr_cycles where status='active' order by created_at desc limit 1")
    orig_phases = psql(f"select phases::text from okr_cycles where id='{cycle_id}'")
    phases = json.loads(orig_phases)

    def patch_phase(key, start, due):
        changed = json.loads(json.dumps(phases))
        for p in changed:
            if p["key"] == key:
                p["status"] = "scheduled"
                p["start_date"] = start
                p["due_date"] = due
        raw = json.dumps(changed, ensure_ascii=False).replace("'", "''")
        psql(f"update okr_cycles set phases='{raw}'::jsonb where id='{cycle_id}'")

    try:
        # OKR_SELF_ASSESSMENT: mở kỳ FINAL; người có hồ sơ đã duyệt (locked) nhưng chưa tự chấm.
        assessed_owner = psql(
            "select user_id from okr_reviews r where r.status='locked' "
            "and box2_self_score is null and box3_self_score is null "
            "and exists (select 1 from users u where u.id=r.user_id and u.status='ACTIVE') limit 1")
        check("Có hồ sơ OKR đã duyệt chưa tự đánh giá", bool(assessed_owner), assessed_owner)
        patch_phase("final", "2026-11-15", "2026-12-15")
        verify_cycle("OKR_SELF_ASSESSMENT", assessed_owner, "2026-11-23", "10:30",
                     "OKR_SELF_ASSESSMENT (FINAL mở, đã duyệt chưa tự chấm)")

        # OKR_NOT_CREATED: mở kỳ SETUP; chọn người chưa có mục tiêu nào.
        no_goal = psql(
            "select u.id from users u left join okr_reviews r on r.user_id=u.id and r.cycle_year=2026 "
            "left join okr_items i on i.review_id=r.id and i.deleted_at is null "
            "where u.role='EMPLOYEE' and u.status='ACTIVE' and u.employee_code not like 'ZZ%' "
            "group by u.id having count(i.id)=0 limit 1")
        check("Có người chưa có mục tiêu OKR để kiểm tra", bool(no_goal), no_goal)
        patch_phase("setup", "2027-06-10", "2027-07-15")
        verify_cycle("OKR_NOT_CREATED", no_goal, "2027-06-16", "10:30",
                     "OKR_NOT_CREATED (SETUP mở, chưa có mục tiêu)")

        # HR_UNLOCK_OKR: kỳ midyear mở, hạn còn 2 ngày.
        patch_phase("midyear", "2027-06-01", "2027-06-18")
        verify_cycle("HR_UNLOCK_OKR", uid(HR), "2027-06-16", "10:30",
                     "HR_UNLOCK_OKR (midyear còn 2 ngày)")
    finally:
        raw = orig_phases.replace("'", "''")
        psql(f"update okr_cycles set phases='{raw}'::jsonb where id='{cycle_id}'")

finally:
    # ── Dọn dẹp ──────────────────────────────────────────────────────────
    psql(f"delete from notification_deliveries where delivered_at >= '{START}'", check=False)
    psql(f"delete from notifications where created_at >= '{START}'", check=False)
    psql(f"delete from requests where user_id='{EMP_ID}' and reason like 'ZZ %'", check=False)
    psql(f"delete from leave_ledger where user_id='{EMP_ID}' and reason like 'ZZ %'", check=False)
    psql("delete from timesheet_disputes where id like 'ZZ%'", check=False)
    psql(f"delete from attendance_logs where user_id='{EMP_ID}' "
         "and work_date in ('2026-12-02','2027-06-14','2027-06-15','2027-06-16')", check=False)
    psql("drop table if exists zz_ts_snapshot", check=False)

print("\nALL NOTIFICATION REMINDER PRODUCERS PASSED")
