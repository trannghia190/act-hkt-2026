"""Kiểm thử: ngày onboard → thâm niên, phép thâm niên, tổng phép năm.

Chạy khi backend đang ở localhost:8080:
    python3 tests/api/test_employee_onboard_leave.py
"""

import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, timedelta

BASE_URL = "http://localhost:8080/api/v1"


def api_call(method, endpoint, body=None, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(f"{BASE_URL}{endpoint}", data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode())
        except Exception:
            return e.code, {"message": str(e)}


def hr_login():
    for pwd in ("password123", "123456"):
        status, body = api_call("POST", "/auth/login",
                                {"employeeCodeOrEmail": "01HR", "password": pwd})
        if status == 200:
            return body["data"]["accessToken"]
    raise AssertionError(f"HR login failed: {body}")


def test_onboard_preview(token):
    print("=== 1. Xem trước quỹ phép theo ngày onboard ===")
    onboard = date.today() - timedelta(days=365 * 3 + 40)  # ~3 năm 1 tháng trước
    qs = urllib.parse.urlencode({"joinedDate": onboard.isoformat(), "role": "EMPLOYEE"})
    status, body = api_call("GET", f"/admin/users/onboard-preview?{qs}", token=token)
    assert status == 200, f"Preview failed: {status} {body}"
    data = body["data"]
    assert data["seniorityYears"] >= 2, data
    assert data["seniorityDays"] >= 1, data
    assert data["baseAccruedDays"] > 0, data
    assert round(data["baseAccruedDays"] + data["seniorityDays"], 2) == round(data["totalAnnualDays"], 2), data
    print(f"PASS: onboard {onboard} → thâm niên {data['seniorityYears']} năm "
          f"{data['seniorityMonths']} tháng, thâm niên +{data['seniorityDays']} ngày, "
          f"phép năm tích lũy {data['baseAccruedDays']} ngày, tổng {data['totalAnnualDays']} ngày")

    # Vào làm hôm nay → chưa có phép năm cơ bản, chỉ có thể có phép thâm niên = 0.
    qs_today = urllib.parse.urlencode({"joinedDate": date.today().isoformat(), "role": "EMPLOYEE"})
    status, body = api_call("GET", f"/admin/users/onboard-preview?{qs_today}", token=token)
    assert status == 200, body
    today_data = body["data"]
    assert today_data["baseAccruedDays"] == 0, today_data
    assert today_data["totalAnnualDays"] == 0, today_data
    print("PASS: vào làm hôm nay → 0 ngày phép (bắt đầu tích lũy từ tháng sau)")


def test_invalid_onboard_date(token):
    print("=== 2. Từ chối ngày onboard vô lý ===")
    status, body = api_call("GET", "/admin/users/onboard-preview?joinedDate=1900-01-01", token=token)
    assert status != 200 or not body.get("data"), f"Ngày 1900 phải bị từ chối: {body}"
    print("PASS: ngày 1900-01-01 không trả về kết quả hợp lệ")


def test_create_with_backdated_onboard(token):
    print("=== 3. Tạo nhân viên với ngày onboard quá khứ → cấp bù phép ===")
    code = f"ONB{int(time.time()) % 9000 + 1000}"
    onboard = date.today() - timedelta(days=365 * 3 + 40)
    status, body = api_call("POST", "/admin/users", {
        "employeeCode": code,
        "fullName": f"Nhân Viên Onboard {code}",
        "email": f"{code.lower()}@act.vn",
        "team": "Sirius",
        "role": "EMPLOYEE",
        "positionName": "Kỹ sư phần mềm",
        "password": "Temp@123456",
        "joinedDate": onboard.isoformat(),
    }, token=token)
    assert status == 200, f"Create failed: {status} {body}"

    status, body = api_call("GET", "/admin/users", token=token)
    assert status == 200, body
    users = body["data"]["content"] if isinstance(body["data"], dict) else body["data"]
    emp = next((e for e in users if e.get("employeeCode") == code), None)
    assert emp is not None, f"Không thấy nhân viên {code} trong danh sách"
    assert emp.get("hireDate", "").startswith(onboard.isoformat()), emp
    assert int(emp.get("seniorityYears") or 0) >= 2, emp
    assert float(emp.get("seniorityDays") or 0) >= 1, emp
    assert float(emp.get("totalAnnualDays") or 0) > 0, emp
    print(f"PASS: {code} onboard {onboard} → thâm niên {emp['seniorityYears']} năm, "
          f"thâm niên +{emp['seniorityDays']} ngày, tổng phép năm {emp['totalAnnualDays']} ngày")


def main():
    token = hr_login()
    print("PASS: HR đăng nhập")
    test_onboard_preview(token)
    test_invalid_onboard_date(token)
    test_create_with_backdated_onboard(token)
    print("\nTẤT CẢ TEST PASS")


if __name__ == "__main__":
    try:
        main()
    except AssertionError as e:
        print(f"\nFAIL: {e}")
        sys.exit(1)
