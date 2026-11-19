#!/usr/bin/env python3
"""Smoke test API nghiệp vụ — chạy sau mỗi tính năng.

Dùng:  API_BASE=http://localhost:8081/api/v1 python3 tests/api/test_business_api.py
Yêu cầu: service đang chạy với DB test; tài khoản 136ACT/123456.
"""
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import date, timedelta

BASE = os.environ.get("API_BASE", "http://localhost:8081/api/v1")
TOKEN = None
FAILED = []


def call(method, path, body=None, expect=200, token=True):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(BASE + path, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token and TOKEN:
        req.add_header("Authorization", "Bearer " + TOKEN)
    try:
        with urllib.request.urlopen(req) as r:
            status, payload = r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        status, payload = e.code, e.read().decode()
    try:
        parsed = json.loads(payload)
    except Exception:
        parsed = {"raw": payload}
    if status != expect:
        FAILED.append(f"{method} {path}: HTTP {status} (expected {expect}) {payload[:160]}")
    return status, parsed


def check(name, cond, detail=""):
    print(("PASS " if cond else "FAIL ") + name + ("" if cond else f" — {detail}"))
    if not cond:
        FAILED.append(name + " " + detail)


# 1. Login & JWT
status, data = call("POST", "/auth/login", {"employeeCodeOrEmail": "136ACT", "password": "123456"}, token=False)
check("login 200", status == 200, str(data.get("message")))
TOKEN = (data.get("data") or {}).get("accessToken")
check("login trả JWT", bool(TOKEN) and TOKEN.count(".") == 2)

# 2. Rule Engine: 19 rule + version
status, data = call("GET", "/rules")
rules = data.get("data") or []
check("GET /rules trả 19 rule", status == 200 and len(rules) == 19, f"got {len(rules)}")
check("rule có ruleKey/currentValue", all(r.get("ruleKey") and r.get("currentValue") for r in rules))

# 3. Loại nghỉ >= 8 + có tham số
status, data = call("GET", "/leave-types")
types = data.get("data") or []
check("GET /leave-types >= 8", len(types) >= 8, f"got {len(types)}")
check("loại nghỉ có isPaid/unit", all("isPaid" in t and "unit" in t for t in types))

# 4. Số dư phép
status, data = call("GET", "/leaves/my-balance")
check("GET /leaves/my-balance", status == 200 and "remaining" in (data.get("data") or {}))

# 5. WFH quota 2/tuần: tạo 3 đơn cùng tuần → đơn 3 bị chặn
# Chọn một tuần còn trống để test lặp lại được nhiều lần.
_, existing = call("GET", "/requests/my-requests")
used_weeks = set()
for r in existing.get("data") or []:
    if r.get("requestType") == "WFH" and r.get("workDate"):
        d = date.fromisoformat(r["workDate"])
        used_weeks.add(d.isocalendar()[:2])
target = None
for k in range(1, 53):
    cand = date.today() + timedelta(days=3 + 7 * k)
    if cand.isocalendar()[:2] not in used_weeks:
        target = cand
        break
assert target is not None, "Không còn tuần trống để test WFH"
for i in range(2):
    call("POST", "/requests", {"type": "WFH", "workDate": str(target), "reason": f"WFH test {i}", "payload": "{}"})
status, data = call("POST", "/requests", {"type": "WFH", "workDate": str(target), "reason": "WFH thứ 3", "payload": "{}"}, expect=400)
check("WFH thứ 3 trong tuần bị chặn", status == 400 and "2 ngày WFH" in json.dumps(data, ensure_ascii=False), str(data)[:120])

# 5b. Đi muộn: quota 2/tháng → lần thứ 3 bị chặn
late_target = None
_, existing2 = call("GET", "/requests/my-requests")
used_months = {(r.get("workDate") or "")[:7] for r in (existing2.get("data") or []) if r.get("requestType") == "LATE_EARLY"}
for k in range(1, 24):
    cand = date.today() + timedelta(days=30 * k)
    if cand.isoformat()[:7] not in used_months:
        late_target = cand
        break
if late_target:
    for i in range(2):
        call("POST", "/requests", {"type": "LATE_EARLY", "workDate": str(late_target), "minutes": 10, "reason": f"Kẹt xe {i}", "payload": "{}"})
    status, data = call("POST", "/requests", {"type": "LATE_EARLY", "workDate": str(late_target), "minutes": 10, "reason": "Kẹt xe 3", "payload": "{}"}, expect=400)
    check("Đi muộn lần 3 trong tháng bị chặn", status == 400 and "2 lần" in json.dumps(data, ensure_ascii=False), str(data)[:120])

# 5c. Từ chối thiếu lý do → backend chặn
status, data = call("GET", "/requests/my-requests")
pending = [r for r in (data.get("data") or []) if r.get("status") == "PENDING_APPROVAL"]
if pending:
    pid = pending[0]["id"]
    status, data = call("POST", f"/requests/{pid}/reject", {"comment": ""}, expect=400)
    check("Từ chối thiếu lý do bị chặn", status == 400 and "lý do" in json.dumps(data, ensure_ascii=False).lower(), str(data)[:120])

# 5d. Inbox của quản lý trả danh sách
status, data = call("GET", "/requests/inbox")
check("GET /requests/inbox", status == 200 and isinstance(data.get("data"), list))

# 6. Danh sách đơn của tôi
status, data = call("GET", "/requests/my-requests")
check("GET /requests/my-requests", status == 200 and isinstance(data.get("data"), list))

# 7. Ca & lịch lễ
status, data = call("GET", "/admin/shifts")
check("GET /admin/shifts", status == 200 and isinstance(data.get("data"), list))
status, data = call("GET", "/admin/holidays")
check("GET /admin/holidays", status == 200 and isinstance(data.get("data"), list))

# 8. Bảng phép
status, data = call("GET", "/leaves/table")
check("GET /leaves/table", status == 200 and isinstance(data.get("data"), list))

# 9. Khiếu nại
status, data = call("GET", "/disputes")
check("GET /disputes", status == 200 and len(data.get("data") or []) >= 1)

print()
if FAILED:
    print(f"❌ {len(FAILED)} test failed")
    for f in FAILED:
        print(" -", f)
    sys.exit(1)
print("✅ All API smoke tests passed")
