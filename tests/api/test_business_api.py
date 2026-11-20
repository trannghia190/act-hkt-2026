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

def resolve_base_url():
    if os.environ.get("API_BASE"):
        return os.environ.get("API_BASE")
    for port in (8080, 8081):
        try:
            with urllib.request.urlopen(f"http://localhost:{port}/api/v1/actuator/health", timeout=1):
                return f"http://localhost:{port}/api/v1"
        except Exception:
            pass
    return "http://localhost:8081/api/v1"

BASE = resolve_base_url()
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

# 2b. Refresh token → access token mới + phiên cũ bị xoay vòng
_, login2 = call("POST", "/auth/login", {"employeeCodeOrEmail": "136ACT", "password": "123456"}, token=False)
rt = (login2.get("data") or {}).get("refreshToken")
status, refreshed = call("POST", "/auth/refresh", {"refreshToken": rt}, token=False)
new_access = (refreshed.get("data") or {}).get("accessToken")
check("refresh trả access token", status == 200 and bool(new_access) and new_access.count(".") == 2)
status, _ = call("POST", "/auth/refresh", {"refreshToken": rt}, token=False, expect=400)
check("refresh token cũ bị thu hồi (xoay vòng)", status == 400)

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

# 8b. Lịch nhóm (S14) — phân quyền + cấu trúc ngày + cảnh báo xung đột
status, data = call("GET", "/attendance/team-schedule")
tdata = data.get("data") or {}
check("GET /attendance/team-schedule", status == 200 and isinstance(tdata.get("days"), list) and tdata.get("days"))
check("lịch nhóm có scope + teamSize", "scope" in tdata and tdata.get("teamSize") is not None)
check("mỗi ngày có present/wfh/leave/late", all(all(k in d for k in ("present", "wfh", "leave", "late")) for d in (tdata.get("days") or [])))
check("có ngưỡng cảnh báo 60%", tdata.get("conflictThresholdPercent") == 60)

# 8c. Bảng công (S15): dữ liệu thật + công bố + khoá
status, data = call("GET", "/timesheets")
sheet = data.get("data") or {}
check("GET /timesheets", status == 200 and isinstance(sheet.get("rows"), list))
check("bảng công có ngày trong tháng", sheet.get("daysInMonth") in (28, 29, 30, 31))
check("ngày công bố mặc định 11", sheet.get("publishDay") == 11)
if sheet.get("rows"):
    r0 = sheet["rows"][0]
    check("dòng công có standardDays/actualDays", "standardDays" in r0 and "actualDays" in r0)
# C2c: hạn nộp 3 ngày — quá hạn bị chặn server-side (đi muộn/nghỉ/bổ sung)
old_date = (date.today() - timedelta(days=10)).isoformat()
status, data = call("POST", "/requests", {"type": "ADJUST", "workDate": old_date, "minutes": 30, "reason": "Quên chấm công", "payload": "{}"}, expect=400)
check("bổ sung công quá hạn 3 ngày bị chặn", status == 400 and "3 ngày" in (data.get("message") or ""), str(data)[:120])
status, data = call("POST", "/requests", {"type": "LATE_EARLY", "workDate": old_date, "minutes": 10, "reason": "Kẹt xe", "payload": "{}"}, expect=400)
check("đi muộn quá hạn 3 ngày bị chặn", status == 400)
status, data = call("POST", "/requests", {"type": "LEAVE", "leaveType": "AL", "workDate": old_date, "reason": "Nghỉ phép", "payload": "{}"}, expect=400)
check("nghỉ phép quá hạn gửi bị chặn", status == 400)

status, data = call("POST", "/timesheets/publish")
check("công bố bảng công", status == 200 and (data.get("data") or {}).get("status") == "published")
# Sửa ô + sửa hàng loạt có audit
status, data = call("POST", "/timesheets/cell", {"employeeCode": "136ACT", "day": 5, "symbol": "1.00", "reason": "Đối chiếu log"}, expect=200)
check("sửa ô bảng công có lý do", status == 200 and (data.get("data") or {}).get("edited") is True)
status, data = call("POST", "/timesheets/cell", {"employeeCode": "136ACT", "day": 5, "symbol": "1.00", "reason": ""}, expect=400)
check("sửa ô thiếu lý do bị chặn", status == 400)
status, data = call("POST", "/timesheets/bulk", {"employeeCodes": ["136ACT", "05ACT"], "day": 6, "symbol": "0.50", "reason": "Bù công cả lô"})
check("sửa hàng loạt 1 audit", status == 200 and (data.get("data") or {}).get("updated") == 2)

# Còn khiếu nại chưa xử lý → khoá bị chặn (tạo 1 khiếu nại mới để test lặp lại được)
call("POST", "/disputes", {"workDate": date.today().isoformat(), "reason": "Đối chiếu log — test lock"})
status, data = call("POST", "/timesheets/lock", expect=400)
check("khoá bị chặn khi còn khiếu nại", status == 400)
_, dl = call("GET", "/disputes")
for d in (dl.get("data") or []):
    if d.get("status") == "PENDING":
        call("POST", f"/disputes/{d['id']}/resolve", {"action": "FIX", "reason": "Đã đối chiếu log"})
_, dl2 = call("GET", "/disputes")
check("khiếu nại có hạn xử lý (daysLeft)", all(("daysLeft" in d) or d.get("status") != "PENDING" for d in (dl2.get("data") or [])))
status, data = call("POST", "/timesheets/lock")
check("khoá kỳ công", status == 200 and (data.get("data") or {}).get("status") == "locked")
status, data = call("GET", "/timesheets")
check("trạng thái sau khoá = locked", (data.get("data") or {}).get("status") == "locked")

# 9. Khiếu nại
status, data = call("GET", "/disputes")
check("GET /disputes", status == 200 and len(data.get("data") or []) >= 1)

# 10. Loại nghỉ: chống trùng mã với thông điệp thân thiện (không lộ lỗi SQL)
def login_as(code):
    _, d = call("POST", "/auth/login", {"employeeCodeOrEmail": code, "password": "123456"}, token=False)
    return (d.get("data") or {}).get("accessToken")

emp_token = TOKEN
HR_TOKEN = login_as("01HR")
check("login HR 01HR", bool(HR_TOKEN))
TOKEN = HR_TOKEN
status, data = call("POST", "/admin/leave-types", {"code": "AL", "name": "Trùng mã", "defaultDays": 1, "unit": "DAY", "submitWithinDays": 3}, expect=400)
check("trùng mã loại nghỉ bị chặn với thông điệp rõ", status == 400 and "đã tồn tại" in (data.get("message") or ""), str(data.get("message"))[:80])

# 11. Bảng công trả đủ dữ liệu cho 17 cột tổng hợp kiểu Pine
status, data = call("GET", "/timesheets")
rows = (data.get("data") or {}).get("rows") or []
required = {"teamName", "managerCode", "totalDays", "sickDays", "sickBhDays", "compDays",
            "unpaidDays", "maternityDays", "paternityDays", "specialLeaveDays", "remainingLeave"}
check("bảng công có đủ trường cho 17 cột tổng hợp", bool(rows) and required.issubset(rows[0].keys()),
      f"missing {required - set(rows[0].keys()) if rows else required}")

# 12. Bảng phép có tên nhóm để lọc/hiển thị
status, data = call("GET", "/leaves/table")
lt_rows = data.get("data") or []
check("bảng phép có teamName", bool(lt_rows) and all("teamName" in r for r in lt_rows))

# 13. Từ chối khiếu nại: bắt buộc lý do + nhân viên nhận thông báo
status, data = call("POST", "/disputes/DC-02/resolve", {"action": "REJECT"}, expect=400)
check("từ chối khiếu nại thiếu lý do bị chặn", status == 400)
status, data = call("POST", "/disputes/DC-02/resolve", {"action": "REJECT", "reason": "Bảng công đã khớp log"}, expect=200)
check("từ chối khiếu nại có lý do", status == 200 and (data.get("data") or {}).get("status") == "REJECTED")
status, data = call("GET", "/notifications")
notifs = data.get("data") or []
check("thông báo từ chối khiếu nại được lưu DB", any("từ chối" in (n.get("title") or "").lower() for n in notifs),
      f"got {len(notifs)} notifications")

# 14. Hộp thư duyệt trả kèm tên/mã nhân viên
MGR_TOKEN = login_as("05ACT")
check("login manager 05ACT", bool(MGR_TOKEN))
TOKEN = MGR_TOKEN
status, data = call("GET", "/requests/inbox")
inbox = data.get("data") or []
check("hộp thư duyệt có tên + mã nhân viên", all(r.get("employeeCode") and r.get("employeeName") for r in inbox) if inbox else True)

# 15. Vòng đời đơn nháp: lưu nháp → gửi duyệt → hủy
TOKEN = emp_token
status, data = call("POST", "/requests", {"type": "LEAVE", "leaveType": "AL", "workDate": "2030-01-07",
                                          "reason": "Kiểm thử vòng đời đơn nháp", "payload": "{}", "draft": True})
draft = data.get("data") or {}
check("lưu nháp tạo DRAFT", status == 200 and draft.get("status") == "DRAFT")
draft_id = draft.get("id")
if draft_id:
    status, data = call("POST", f"/requests/{draft_id}/submit")
    check("gửi duyệt đơn nháp", status == 200 and (data.get("data") or {}).get("status") == "PENDING_APPROVAL")
    status, data = call("POST", f"/requests/{draft_id}/withdraw")
    check("hủy đơn nháp/chờ duyệt", status == 200 and (data.get("data") or {}).get("status") == "WITHDRAWN")
TOKEN = emp_token

print()
if FAILED:
    print(f"❌ {len(FAILED)} test failed")
    for f in FAILED:
        print(" -", f)
    sys.exit(1)
print("✅ All API smoke tests passed")
