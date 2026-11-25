#!/usr/bin/env python3
"""
Digest 08:00 THẬT + Web Push (S36).

  1. Trang tuỳ chỉnh trả số việc chờ thật (personalTasksCount khớp Todo Inbox).
  2. Mục bị dồn vì giờ yên lặng → POST /cron/send-daily-digest cho đúng người
     nhận trả sent=true (digest đọc delivery DEFERRED, không phải list hard-code).
  3. Người không có việc chờ, không có mục dồn → sent=false.
  4. Web Push: đăng ký subscription giả → DB lưu; huỷ → DB xoá; broadcast không lỗi.

Chạy (backend :8080, DB pulse_db):
  python3 tests/api/test_notification_digest.py
"""
import base64
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


hr_token = login("01HR")
mgr_token = login(APPROVER)
approver_email = psql(f"select email from users where employee_code='{APPROVER}'")
approver_id = psql(f"select id from users where employee_code='{APPROVER}'")
created_requests = []

st, prefs = call("GET", "/notifications/preferences", mgr_token)
check("Đọc prefs", st == 200, prefs)
original = prefs["data"]

try:
    # ── 1. Số việc chờ thật trên trang tuỳ chỉnh ─────────────────────
    pending = prefs["data"].get("personalTasksCount")
    check("Prefs trả personalTasksCount từ Todo Inbox", isinstance(pending, int), pending)
    print(f"     → personalTasksCount = {pending}")

    # ── 2. Người dồn mục vì giờ yên lặng → digest gửi được ───────────
    now = datetime.now()
    body = {
        "quietHoursEnabled": True,
        "quietHoursStart": (now - timedelta(hours=1)).strftime("%H:%M"),
        "quietHoursEnd": (now + timedelta(hours=1)).strftime("%H:%M"),
        "maxPushPerDay": 3,
        "dedupeHours": 0,
        "pushEnabled": True,
        "events": {k: v for k, v in original["events"].items()},
    }
    body["events"][EVENT] = {"web": False, "email": False, "push": True}
    st, js = call("PUT", "/notifications/preferences", mgr_token, body)
    check("Đặt giờ yên lặng + chỉ push", st == 200, js)

    # Ngày trống: dữ liệu test khác có thể đã chiếm ngày +90 cố định.
    day = psql(
        "select d::date from generate_series(current_date + 90, current_date + 200, interval '1 day') d "
        "where not exists (select 1 from requests r join users u on u.id=r.user_id "
        "where u.employee_code='" + EMPLOYEE + "' and d::date between r.work_date and coalesce(r.end_date, r.work_date)) "
        "limit 1")
    st, js = call("POST", "/requests", login(EMPLOYEE), {
        "type": "LEAVE", "leaveType": "AL", "workDate": day, "endDate": day,
        "reason": "ZZ digest test", "payload": "{}",
    })
    check("Gửi đơn tạo mục bị dồn", st == 200, js)
    created_requests.append(js["data"]["id"])

    deferred = psql(
        "select count(*) from notification_deliveries where user_id='" + approver_id + "' "
        "and event_key='" + EVENT + "' and channel='DEFERRED' "
        "and delivered_at >= now() - interval '5 minutes'")
    check("Có delivery DEFERRED chờ digest", int(deferred) >= 1, deferred)

    st, js = call("POST", "/cron/send-daily-digest", hr_token, {"email": approver_email})
    check("Digest cho người có mục dồn → sent=true", st == 200 and js["data"]["sent"] is True, js)

    # ── 3. Người không có gì để gửi → sent=false ─────────────────────
    # Digest gồm cả việc thật trong Todo Inbox, nên phải chọn người có 0 việc
    # (personalTasksCount) và 0 việc duyệt, không có delivery DEFERRED nào.
    candidates = psql(
        "select employee_code from users where status='ACTIVE' and email like '%@%' "
        "and employee_code not in ('" + APPROVER + "','" + EMPLOYEE + "') limit 8").splitlines()
    fresh = None
    for code in candidates:
        try:
            tok = login(code)
        except Exception:
            continue
        st, fp = call("GET", "/notifications/preferences", tok)
        if st != 200:
            continue
        uid = psql("select id from users where employee_code='" + code + "'")
        deferred_n = int(psql(
            "select count(*) from notification_deliveries where user_id='" + uid + "' "
            "and channel='DEFERRED' and consumed_at is null"))
        if fp["data"].get("personalTasksCount") == 0 \
                and fp["data"].get("approvalTasksCount") == 0 and deferred_n == 0:
            fresh = code
            break

    if fresh:
        fresh_token = login(fresh)
        fresh_email = psql("select email from users where employee_code='" + fresh + "'")
        st, js = call("POST", "/cron/send-daily-digest", hr_token, {"email": fresh_email})
        check("Digest cho người trống → sent=false", st == 200 and js["data"]["sent"] is False, js)
    else:
        print("SKIP không tìm được tài khoản hoàn toàn trống để thử sent=false")

    # ── 4. Web Push subscription ─────────────────────────────────────
    emp_token = login(EMPLOYEE)
    st, js = call("GET", "/notifications/push/public-key", emp_token)
    check("VAPID public-key khả dụng cho trình duyệt",
          st == 200 and js.get("data", {}).get("enabled") is True
          and isinstance(js.get("data", {}).get("publicKey"), str)
          and len(js["data"]["publicKey"]) > 20, js)
    # Trình duyệt chỉ nhận applicationServerKey là điểm EC KHÔNG NÉN 65 byte
    # (0x04 || X || Y). Trả DER/X.509 sẽ làm pushManager.subscribe() ném
    # "The provided applicationServerKey is not valid".
    key = js["data"]["publicKey"]
    raw = base64.urlsafe_b64decode(key + "=" * ((4 - len(key) % 4) % 4))
    check("VAPID key đúng định dạng điểm EC không nén 65 byte",
          len(raw) == 65 and raw[0] == 0x04, f"len={len(raw)} first={raw[:1].hex()}")
    endpoint = "https://push.example.test/zz-digest-" + str(int(now.timestamp()))
    psql("delete from push_subscriptions where user_id=(select id from users where employee_code='" + EMPLOYEE + "')")
    _, emp_prefs = call("GET", "/notifications/preferences", emp_token)
    original_push_enabled = emp_prefs["data"].get("pushEnabled", True)
    st, js = call("POST", "/notifications/push/subscribe", emp_token, {
        "endpoint": endpoint,
        "keys": {"p256dh": "BP0zzTestKeyPlaceholder", "auth": "zzTestAuth"},
        "userAgent": "ZZ digest test",
    })
    check("Đăng ký Web Push subscription", st == 200 and js.get("success") is True, js)
    count = psql("select count(*) from push_subscriptions where user_id="
                 "(select id from users where employee_code='" + EMPLOYEE + "')")
    check("DB có subscription", count == "1", count)
    st, js = call("GET", "/notifications/preferences", emp_token)
    check("Đăng ký thiết bị → tự bật công tắc pushEnabled",
          st == 200 and js["data"].get("pushEnabled") is True, js.get("data", {}).get("pushEnabled"))
    st, js = call("GET", "/notifications/push/status", emp_token)
    check("Status trả subscribed=true", st == 200 and js["data"]["subscribed"] is True, js)
    st, js = call("POST", "/notifications/push/unsubscribe", emp_token,
                  {"endpoint": endpoint})
    check("Huỷ subscription", st == 200 and js.get("success") is True, js)
    count = psql("select count(*) from push_subscriptions where user_id="
                 "(select id from users where employee_code='" + EMPLOYEE + "')")
    check("DB đã xoá subscription", count == "0", count)
    st, js = call("GET", "/notifications/preferences", emp_token)
    check("Hết thiết bị push → tự tắt công tắc pushEnabled",
          st == 200 and js["data"].get("pushEnabled") is False, js.get("data", {}).get("pushEnabled"))
    if original_push_enabled:
        call("PUT", "/notifications/preferences", emp_token, {"pushEnabled": True})
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
    psql("delete from notification_deliveries where user_id='" + approver_id + "' "
         "and event_key='" + EVENT + "' and delivered_at >= now() - interval '15 minutes'")
    psql("delete from notifications where event_key='" + EVENT + "' and user_id='" + approver_id + "' "
         "and created_at >= now() - interval '15 minutes'")
    if created_requests:
        ids = ",".join("'" + r + "'" for r in created_requests)
        psql("delete from requests where id in (" + ids + ")")

print("\nALL NOTIFICATION DIGEST + PUSH CHECKS PASSED")
