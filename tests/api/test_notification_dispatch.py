#!/usr/bin/env python3
"""
NotificationDispatcher áp dụng cấu hình THẬT (S36).

Kiểm tra bằng sự kiện thật "nhân viên gửi đơn → báo quản lý" (REQUEST_SUBMITTED):
  1. Tắt cả 3 kênh của sự kiện  → không có dòng thông báo nào cho quản lý.
  2. Bật riêng kênh WEB         → có thông báo + delivery WEB.
  3. Bật PUSH + đặt giờ yên lặng phủ hiện tại → không có thông báo web,
     nhưng có delivery DEFERRED để job digest 08:00 gửi bù.

Chạy (backend :8080, DB pulse_db):
  python3 tests/api/test_notification_dispatch.py
"""
import json
import subprocess
import sys
import urllib.request
from datetime import date, datetime, timedelta

API = "http://localhost:8080/api/v1"
EMPLOYEE = "136ACT"
APPROVER = "05ACT"
EVENT = "REQUEST_SUBMITTED"


def psql(sql):
    return subprocess.run(
        ["psql", "-h", "127.0.0.1", "-d", "pulse_db", "-tAc", sql],
        capture_output=True, text=True, check=True,
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
    print(("PASS " if cond else "FAIL ") + name + ("" if cond else " — " + str(extra)[:400]))
    if not cond:
        sys.exit(1)


emp_token = login(EMPLOYEE)
mgr_token = login(APPROVER)
approver_id = psql(f"select id from users where employee_code='{APPROVER}'")

st, prefs = call("GET", "/notifications/preferences", mgr_token)
check("Đọc prefs quản lý", st == 200, prefs)
original = prefs["data"]

created_requests = []


def submit_request(offset_days, reason):
    # DB có sẵn nhiều đơn test của 136ACT → tìm ngày trống để không bị chặn "trùng ngày".
    d = date.today() + timedelta(days=offset_days)
    for _ in range(60):
        taken = psql("select count(*) from requests r join users u on u.id=r.user_id "
                     "where u.employee_code='" + EMPLOYEE + "' and r.work_date='" + d.isoformat() + "'")
        if taken == "0":
            break
        d += timedelta(days=1)
    day = d.isoformat()
    st, js = call("POST", "/requests", emp_token, {
        "type": "LEAVE", "leaveType": "AL", "workDate": day, "endDate": day,
        "reason": reason, "payload": "{}",
    })
    check(f"Gửi đơn ngày {day}", st == 200, js)
    rid = js["data"]["id"]
    created_requests.append(rid)
    return rid, day


def notifications_for(day):
    return psql(
        "select count(*) from notifications where user_id='" + approver_id + "' "
        "and event_key='" + EVENT + "' and content like '%" + day + "%'")


def deliveries_for(day, channel):
    return psql(
        "select count(*) from notification_deliveries d join notifications n on n.id=d.notification_id "
        "where d.user_id='" + approver_id + "' and d.event_key='" + EVENT + "' "
        "and d.channel='" + channel + "' and n.content like '%" + day + "%'")


def set_prefs(events_override, quiet=None, push=True, max_push=3):
    body = {
        "quietHoursEnabled": quiet is not None,
        "maxPushPerDay": max_push,
        "dedupeHours": 0,
        "pushEnabled": push,
        "events": {k: v for k, v in original["events"].items()},
    }
    if quiet is not None:
        body["quietHoursStart"], body["quietHoursEnd"] = quiet
    body["events"][EVENT] = events_override
    st, js = call("PUT", "/notifications/preferences", mgr_token, body)
    check("Lưu prefs", st == 200, js)


try:
    # 1. Tắt cả 3 kênh → không có thông báo nào
    set_prefs({"web": False, "email": False, "push": False})
    _, day1 = submit_request(60, "ZZ dispatch off")
    check("Tắt cả 3 kênh: không tạo thông báo", notifications_for(day1) == "0",
          notifications_for(day1))

    # 2. Chỉ bật WEB → có thông báo + delivery WEB
    set_prefs({"web": True, "email": False, "push": False})
    _, day2 = submit_request(61, "ZZ dispatch web")
    check("Chỉ WEB: có đúng 1 thông báo", notifications_for(day2) == "1",
          notifications_for(day2))
    check("Chỉ WEB: có delivery WEB", deliveries_for(day2, "WEB") == "1",
          deliveries_for(day2, "WEB"))

    # 3. PUSH + giờ yên lặng phủ hiện tại → dồn digest
    now = datetime.now()
    start = (now - timedelta(hours=1)).strftime("%H:%M")
    end = (now + timedelta(hours=1)).strftime("%H:%M")
    set_prefs({"web": False, "email": False, "push": True}, quiet=(start, end))
    rid3, day3 = submit_request(62, "ZZ dispatch quiet")
    check("Giờ yên lặng: không tạo thông báo web", notifications_for(day3) == "0",
          notifications_for(day3))
    deferred = psql(
        "select count(*) from notification_deliveries where user_id='" + approver_id + "' "
        "and event_key='" + EVENT + "' and channel='DEFERRED' and dedupe_key='request-submitted:" + rid3 + "'")
    check("Giờ yên lặng: có delivery DEFERRED chờ digest", deferred == "1", deferred)

    # 4. Vượt hạn mức push/ngày (maxPushPerDay=0) → push bị dồn digest
    set_prefs({"web": False, "email": False, "push": True}, max_push=0)
    rid4, day4 = submit_request(63, "ZZ dispatch quota")
    check("Vượt hạn mức push: không tạo thông báo web", notifications_for(day4) == "0",
          notifications_for(day4))
    deferred4 = psql(
        "select count(*) from notification_deliveries where user_id='" + approver_id + "' "
        "and event_key='" + EVENT + "' and channel='DEFERRED' and dedupe_key='request-submitted:" + rid4 + "'")
    check("Vượt hạn mức push: có delivery DEFERRED chờ digest", deferred4 == "1", deferred4)
finally:
    call("PUT", "/notifications/preferences", mgr_token, {
        "quietHoursEnabled": original["quietHoursEnabled"],
        "quietHoursStart": original["quietHoursStart"],
        "quietHoursEnd": original["quietHoursEnd"],
        "maxPushPerDay": original["maxPushPerDay"],
        "dedupeHours": original["dedupeHours"],
        "pushEnabled": original["pushEnabled"],
        "events": original["events"],
    })
    if created_requests:
        ids = ",".join("'" + r + "'" for r in created_requests)
        psql("delete from notification_deliveries where user_id='" + approver_id + "' "
             "and event_key='" + EVENT + "' and notification_id in "
             "(select id from notifications where event_key='" + EVENT + "' "
             "and user_id='" + approver_id + "' and created_at >= now() - interval '10 minutes')")
        psql("delete from notifications where event_key='" + EVENT + "' "
             "and user_id='" + approver_id + "' and created_at >= now() - interval '10 minutes'")
        psql("delete from requests where id in (" + ids + ")")

print("\nALL NOTIFICATION DISPATCH CHECKS PASSED")
