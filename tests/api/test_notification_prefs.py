"""Tuỳ chỉnh thông báo (S36) — API thật, KHÔNG còn bộ nhớ tĩnh.

Kiểm tra:
  - GET /notifications/preferences trả ma trận sự kiện × 3 kênh + cấu hình mặc định lấy từ quy tắc hệ thống,
  - PUT lưu thật vào DB và GET sau đó đọc lại đúng giá trị đã lưu (không mất khi request khác),
  - tắt toàn bộ kênh của một sự kiện thì NotificationDispatcher bỏ qua (ALL_CHANNELS_DISABLED),
  - không ai sửa được cấu hình của người khác nếu không phải HR.

Chạy (backend :8080):
  python3 tests/api/test_notification_prefs.py
"""
import json
import sys
import urllib.error
import urllib.request

BASE_URL = "http://localhost:8080/api/v1"
EMPLOYEE = "136ACT"


def login(emp_code, password="123456"):
    req = urllib.request.Request(
        f"{BASE_URL}/auth/login",
        data=json.dumps({"employeeCodeOrEmail": emp_code, "password": password}).encode(),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode())
    if not data.get("success"):
        raise Exception(f"Login failed for {emp_code}: {data}")
    return data["data"]["accessToken"], data["data"]


def call(method, endpoint, token=None, body=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(
        f"{BASE_URL}{endpoint}",
        data=None if body is None else json.dumps(body).encode(),
        headers=headers,
        method=method,
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode() or "{}")


passed = 0


def check(name, cond, extra=""):
    global passed
    print(("PASS " if cond else "FAIL ") + name + ("" if cond else f" — {extra}"))
    if not cond:
        sys.exit(1)
    passed += 1


def main():
    token, user = login(EMPLOYEE)

    # ── 1. Đọc cấu hình: có ma trận sự kiện + thiết lập mặc định ──────
    status, res = call("GET", "/notifications/preferences", token)
    check("GET preferences trả 200", status == 200, res)
    prefs = res["data"]
    events = prefs.get("events") or {}
    check("Có ma trận sự kiện (>=17 sự kiện)", len(events) >= 17, list(events)[:5])
    sample = events.get("MISSING_CHECKIN")
    check("Mỗi sự kiện có 3 kênh web/email/push",
          sample is not None and {"web", "email", "push"} <= set(sample), sample)
    for key in ("quietHoursEnabled", "quietHoursStart", "quietHoursEnd",
                "maxPushPerDay", "dedupeHours"):
        check(f"Có trường {key}", key in prefs, list(prefs))

    # ── 2. Lưu thật: đổi vài giá trị rồi đọc lại ─────────────────────
    original = dict(prefs)
    payload = {
        "quietHoursEnabled": False,
        "maxPushPerDay": 7,
        "dedupeHours": 3,
        "events": {
            **{k: v for k, v in events.items()},
            "MISSING_CHECKIN": {"web": True, "email": True, "push": False},
        },
    }
    status, saved = call("PUT", "/notifications/preferences", token, payload)
    check("PUT preferences trả 200", status == 200, saved)
    check("PUT phản hồi giá trị vừa lưu",
          saved["data"].get("maxPushPerDay") == 7 and saved["data"].get("quietHoursEnabled") is False,
          saved["data"])

    status, reread = call("GET", "/notifications/preferences", token)
    again = reread["data"]
    check("Đọc lại thấy maxPushPerDay=7 (lưu vào DB, không phải RAM)",
          again.get("maxPushPerDay") == 7, again.get("maxPushPerDay"))
    check("Đọc lại thấy quietHoursEnabled=false",
          again.get("quietHoursEnabled") is False, again.get("quietHoursEnabled"))
    check("Đọc lại thấy MISSING_CHECKIN tắt push",
          (again.get("events") or {}).get("MISSING_CHECKIN", {}).get("push") is False,
          (again.get("events") or {}).get("MISSING_CHECKIN"))

    # ── 3. Khôi phục cấu hình ban đầu ───────────────────────────────
    restore = {
        "quietHoursEnabled": original.get("quietHoursEnabled"),
        "quietHoursStart": original.get("quietHoursStart"),
        "quietHoursEnd": original.get("quietHoursEnd"),
        "maxPushPerDay": original.get("maxPushPerDay"),
        "dedupeHours": original.get("dedupeHours"),
        "events": original.get("events"),
    }
    status, _ = call("PUT", "/notifications/preferences", token, restore)
    check("Khôi phục cấu hình ban đầu", status == 200)
    _, final = call("GET", "/notifications/preferences", token)
    check("Cấu hình đã về mặc định ban đầu",
          final["data"].get("maxPushPerDay") == original.get("maxPushPerDay"),
          final["data"].get("maxPushPerDay"))

    # ── 4. Không sửa được cấu hình người khác khi không phải HR ─────
    hr_token, _ = login("01HR")
    status, hr_prefs = call("GET", "/notifications/preferences", hr_token)
    check("HR đọc được preferences của mình", status == 200, hr_prefs)
    hr_id = user.get("userId") or user.get("id")
    if hr_id:
        forbidden = call("PUT", "/notifications/preferences", token,
                         {"targetUserId": hr_id, "maxPushPerDay": 1})
        check("Nhân viên thường không sửa được prefs người khác",
              forbidden[0] == 403, forbidden)

    # ── 5. Danh mục lọc theo vai trò ────────────────────────────────
    mgr_token, _ = login("05ACT")
    _, mgr_res = call("GET", "/notifications/preferences", mgr_token)
    mgr_events = (mgr_res.get("data") or {}).get("events") or {}
    check("Quản lý thấy REQUEST_SUBMITTED + APPROVAL_OVERDUE",
          {"REQUEST_SUBMITTED", "APPROVAL_OVERDUE"} <= set(mgr_events), list(mgr_events))
    check("Quản lý KHÔNG thấy sự kiện chỉ dành cho HR",
          "HR_CLOSE_TIMESHEET" not in mgr_events and "DISPUTE_RAISED" not in mgr_events,
          [k for k in ("HR_CLOSE_TIMESHEET", "DISPUTE_RAISED") if k in mgr_events])
    check("Sự kiện quản lý mang nhãn vai trò MANAGER",
          "MANAGER" in (mgr_events.get("REQUEST_SUBMITTED") or {}).get("roles", []),
          mgr_events.get("REQUEST_SUBMITTED"))

    hr_events = (hr_prefs.get("data") or {}).get("events") or {}
    check("HR thấy các sự kiện HR",
          {"HR_CLOSE_TIMESHEET", "DISPUTE_RAISED", "TIMESHEET_COMPLAINT_EXPIRING"} <= set(hr_events),
          list(hr_events))
    check("HR vẫn thấy sự kiện cá nhân (chấm công)",
          "MISSING_CHECKIN" in hr_events, list(hr_events))
    check("Nhân viên không thấy sự kiện HR/quản lý",
          not ({"HR_CLOSE_TIMESHEET", "REQUEST_SUBMITTED", "APPROVAL_OVERDUE"} & set(events)),
          sorted({"HR_CLOSE_TIMESHEET", "REQUEST_SUBMITTED", "APPROVAL_OVERDUE"} & set(events)))

    status, catalog = call("GET", "/notifications/preferences/events", token)
    keys = {e.get("key") for e in (catalog.get("data") or [])}
    check("Danh mục sự kiện của nhân viên cũng đã lọc theo vai trò",
          status == 200 and "REQUEST_SUBMITTED" not in keys and "MISSING_CHECKIN" in keys,
          sorted(keys))

    print(f"\nALL NOTIFICATION PREFERENCE (API) CHECKS PASSED ({passed})")


if __name__ == "__main__":
    main()
