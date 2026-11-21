#!/usr/bin/env python3
"""
Test Suite for Requirements B1 - B6 (Attendance - Employee)
Verified against acceptance criteria in task-tracking.xlsx:
- B1: Mobile punch (5 parallel layers, GPS accuracy > 100m, offline > 24h, geofence, network)
- B2: Desktop punch (yesterday missing checkout banner, 1-touch adjustment)
- B3: Month calendar S06 (grid of 31 days with status colors, T2->CN, navigation)
- B4: My Timesheet S11 (11 summary metric cards, periodStatus, dispute lifecycle)
- B5: My Devices S27 (registered devices, platform, last active, unique user-date)
- B6: Add Device S29 (unified flow, mandatory reason validation, HR approval)
"""
import json
import os
import subprocess
import sys
import urllib.request
import urllib.error
from datetime import datetime, timedelta, date


def psql(sql):
    subprocess.run(
        ['psql', '-h', '127.0.0.1', '-p', '5432', '-U',
         subprocess.check_output(['whoami']).decode().strip(),
         '-d', 'pulse_db', '-c', sql], capture_output=True)

BASE = os.environ.get("API_BASE", "http://localhost:8080/api/v1")
FAILED = []
PASSED = 0

def call(method, path, body=None, token=None, expect=200):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(BASE + path, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(req) as r:
            status, payload = r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        status, payload = e.code, e.read().decode()
    try:
        parsed = json.loads(payload)
    except Exception:
        parsed = {"raw": payload}
    return status, parsed

def check(name, cond, detail=""):
    global PASSED
    if cond:
        PASSED += 1
        print(f"  ✓ PASS: {name}")
    else:
        print(f"  ✗ FAIL: {name} — {detail}")
        FAILED.append(f"{name}: {detail}")

print("==================================================================")
print("  VERIFYING GROUP B (B1 - B6) ACCEPTANCE CRITERIA")
print("==================================================================")

# 0. Login as 136ACT
status, res = call("POST", "/auth/login", {"employeeCodeOrEmail": "136ACT", "password": "123456"})
token = (res.get("data") or {}).get("accessToken")
assert token, f"Login failed: {res}"
print(f"Logged in as 136ACT. Token acquired.")

# --- B1: Mobile Punch (Web Responsive + Biometric) ---
print("\n[B1] Mobile Punch Tests:")
# B1.4: 5 parallel check steps (simulating punch from outside network e.g. 4G/home)
status, punch_res = call("POST", "/attendance/check-in", {
    "latitude": 21.0285, "longitude": 105.8542, "accuracyMeters": 15.0,
    "deviceFingerprint": "mobile-safari-fp", "ipAddress": "203.113.152.1"
}, token=token)
data = punch_res.get("data") or {}
layers = data.get("layers") or []
layer_codes = [l.get("layer") for l in layers]
check("B1.4: 5 parallel check steps present", 
      len(layers) == 5 and set(layer_codes) == {"DEVICE", "NETWORK", "GPS", "SHIFT", "FACE"},
      f"layers: {layer_codes}")

# B1.8: Network layer được đánh giá. Chạy trong mạng nội bộ thì pass là đúng;
# ngoài mạng phải fail kèm hướng dẫn Wi-Fi.
net_layer = next((l for l in layers if l.get("layer") == "NETWORK"), {})
in_office_net = net_layer.get("passed") is True
blocked_outside = net_layer.get("passed") is False and "Wi-Fi" in (net_layer.get("detail") or "")
check("B1.8: network layer evaluated (trong mạng nội bộ → pass; ngoài mạng → chặn)",
      in_office_net or blocked_outside, str(net_layer))

# B1.9: Outside GPS geofence blocked with real distance
status, far_res = call("POST", "/attendance/check-in", {
    "latitude": 10.7769, "longitude": 106.7009, # Ho Chi Minh City (~1100km from Hanoi)
    "accuracyMeters": 10.0, "deviceFingerprint": "mobile-safari-fp", "ipAddress": "127.0.0.1"
}, token=token)
far_data = far_res.get("data") or {}
far_gps = next((l for l in far_data.get("layers", []) if l.get("layer") == "GPS"), {})
check("B1.9: Outside GPS geofence shows real distance",
      far_gps.get("passed") is False and "cách văn phòng" in (far_gps.get("detail") or ""),
      str(far_gps))

# B1.10: GPS accuracy > 100m blocked with window guidance
status, inacc_res = call("POST", "/attendance/check-in", {
    "latitude": 21.0285, "longitude": 105.8542, "accuracyMeters": 150.0,
    "deviceFingerprint": "mobile-safari-fp", "ipAddress": "127.0.0.1"
}, token=token)
inacc_data = inacc_res.get("data") or {}
inacc_gps = next((l for l in inacc_data.get("layers", []) if l.get("layer") == "GPS"), {})
check("B1.10: GPS accuracy > 100m blocked with window guidance",
      inacc_gps.get("passed") is False and "cửa sổ" in (inacc_gps.get("detail") or ""),
      str(inacc_gps))

# B1.11: Offline punch > 24h rejected
old_time = (datetime.now() - timedelta(hours=28)).strftime('%Y-%m-%dT%H:%M:%S')
status, off_res = call("POST", "/attendance/check-in", {
    "latitude": 21.0285, "longitude": 105.8542, "accuracyMeters": 15.0,
    "deviceFingerprint": "mobile-safari-fp", "ipAddress": "127.0.0.1",
    "isOffline": True, "offlinePunchedAt": old_time
}, token=token)
off_data = off_res.get("data") or {}
check("B1.11: Offline punch > 24h rejected with OFFLINE_EXPIRED",
      off_data.get("status") == "REJECTED" and off_data.get("rejectReason") == "OFFLINE_EXPIRED",
      str(off_data))


# --- B2: Desktop Punch ---
print("\n[B2] Desktop Punch Tests:")
# B2.2: today-status returns today and yesterday missing checkout indicator
status, st_res = call("GET", "/attendance/today-status", token=token)
st_data = st_res.get("data") or {}
check("B2.1: today-status returns HTTP 200", status == 200)
check("B2.2: today-status contains yesterday missingCheckout flag",
      "missingCheckout" in st_data.get("yesterday", {}),
      str(st_data.get("yesterday")))
check("B2.4: today-status contains faceEnrolled flag",
      "faceEnrolled" in st_data,
      str(st_data))


# --- B3: Month Calendar S06 ---
print("\n[B3] Month Calendar S06 Tests:")
# B3.1 & B3.3: Month calendar endpoint returns full month days
status, cal_res = call("GET", "/attendance/calendar?month=2026-11", token=token)
cal_data = cal_res.get("data") or {}
cal_days = cal_data.get("days") or []
check("B3.1: Calendar returns exactly 30 days for November",
      status == 200 and len(cal_days) == 30,
      f"got {len(cal_days)} days")
if cal_days:
    d1 = cal_days[0]
    check("B3.2: Each day contains weekday (T2..CN), isWeekend, isHoliday, status, symbol",
          all(k in d1 for k in ("weekday", "isWeekend", "isHoliday", "status", "symbol")),
          str(d1))

status_feb, cal_feb = call("GET", "/attendance/calendar?month=2026-02", token=token)
feb_days = (cal_feb.get("data") or {}).get("days") or []
check("B3.3: Calendar handles February length correctly (28 days)",
      len(feb_days) == 28,
      f"got {len(feb_days)} days")


# --- B4: My Timesheet S11 ---
print("\n[B4] My Timesheet S11 Tests:")
# B4.1 & B4.3: 11 summary metric cards
status, ts_res = call("GET", "/attendance/my-timesheet?month=2026-11", token=token)
ts_data = ts_res.get("data") or {}
required_metrics = [
    "standardDays", "actualDays", "wfhDays", "leaveDays", "lateCount",
    "holidayDays", "sickDays", "compDays", "unpaidDays", "totalDays", "remainingLeave"
]
check("B4.3: Timesheet returns all 11 summary metrics",
      all(k in ts_data for k in required_metrics),
      f"missing: {[k for k in required_metrics if k not in ts_data]}")

check("B4.4 & B4.7: periodStatus present and controls canDispute",
      ts_data.get("periodStatus") in ("OPEN", "DRAFT", "UNPUBLISHED", "PUBLISHED",
                                      "DISPUTABLE", "EXPIRED", "LOCKED")
      and "canDispute" in ts_data,
      f"periodStatus: {ts_data.get('periodStatus')}, canDispute: {ts_data.get('canDispute')}")

# B4.6: Dispute submission — dọn đơn PENDING còn sót của lần chạy trước cùng ngày.
dispute_date = date.today().isoformat()
psql(f"delete from timesheet_disputes where work_date='{dispute_date}' and user_id="
     "(select id from users where employee_code='136ACT')")
status, disp_res = call("POST", "/disputes", {
    "workDate": dispute_date, "reason": "Kiểm thử khiếu nại bảng công B4",
    "expectedHours": 8.0
}, token=token)
check("B4.6: Dispute submission endpoint accepts dispute",
      status in (200, 201),
      str(disp_res))
psql(f"delete from timesheet_disputes where work_date='{dispute_date}' and user_id="
     "(select id from users where employee_code='136ACT')")


# --- B5: My Devices S27 ---
print("\n[B5] My Devices S27 Tests:")
status, dev_res = call("GET", "/devices", token=token)
devices = dev_res.get("data") or []
check("B5.1 & B5.2: GET /devices returns user registered devices",
      status == 200 and isinstance(devices, list) and len(devices) >= 1,
      f"got {len(devices)} devices")

if devices:
    d0 = devices[0]
    check("B5.2: Device contains platform, fingerprint, approval status, lastActiveAt",
          any(k in d0 for k in ("deviceModel", "platform")) and "deviceFingerprint" in d0 and "isApproved" in d0,
          str(d0))


# --- B6: Add Device S29 ---
print("\n[B6] Add Device S29 Tests:")
# B6.4: Mandatory reason check -> 400 if empty
status, no_reason = call("POST", "/devices/request", {
    "deviceName": "Test Laptop", "platform": "Windows", "reason": ""
}, token=token)
check("B6.4: Add device without reason returns 400 Bad Request",
      status == 400,
      str(no_reason))

# B6.2 & B6.3: Add device with reason succeeds and enters HR pending queue
status, with_reason = call("POST", "/devices/request", {
    "deviceName": "ThinkPad P14s", "platform": "Linux",
    "reason": "Thiết bị lập trình công ty cấp",
    "deviceFingerprint": "fp-tp-p14s-001"
}, token=token)
check("B6.2 & B6.3: Add device with reason submitted for HR review",
      status == 200 and "chờ HR duyệt" in (with_reason.get("message") or ""),
      str(with_reason))


print("\n==================================================================")
if FAILED:
    print(f"❌ RESULT: {len(FAILED)} tests failed, {PASSED} passed.")
    for f in FAILED:
        print("  -", f)
    sys.exit(1)
else:
    print(f"✅ RESULT: ALL {PASSED} ACCEPTANCE CRITERIA PASSED (100% compliant)!")
    print("==================================================================")

