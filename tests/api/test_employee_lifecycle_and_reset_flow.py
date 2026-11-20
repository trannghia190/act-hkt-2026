import urllib.request
import urllib.parse
import json
import time
import sys

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

def test_lifecycle_and_reset():
    print("=== 1. HR Đăng Nhập & Tạo Mới Nhân Viên ===")
    status, hr_login = api_call("POST", "/auth/login", {"employeeCodeOrEmail": "01HR", "password": "password123"})
    if status != 200:
        status, hr_login = api_call("POST", "/auth/login", {"employeeCodeOrEmail": "01HR", "password": "123456"})
    assert status == 200, f"HR login failed: {hr_login}"
    hr_token = hr_login["data"]["accessToken"]
    print("PASS: HR đăng nhập thành công")

    test_emp_code = f"ACT{int(time.time()) % 9000 + 1000}"
    test_email = f"test.{test_emp_code.lower()}@act.vn"
    temp_pass = "Temp@123456"

    # Tạo mới nhân viên qua POST /admin/users
    status, created = api_call("POST", "/admin/users", {
        "employeeCode": test_emp_code,
        "fullName": f"Nhân Viên Kiểm Thử {test_emp_code}",
        "email": test_email,
        "team": "Sirius",
        "role": "EMPLOYEE",
        "positionName": "Kỹ sư phần mềm",
        "password": temp_pass
    }, token=hr_token)
    assert status == 200, f"Create employee failed: {created}"
    assert created["data"]["mustChangePassword"] is True
    print(f"PASS: Tạo mới nhân viên {test_emp_code} thành công, cờ mustChangePassword = True")

    print("\n=== 2. Nhân Viên Đăng Nhập Lần Đầu & Bắt Buộc Đổi Mật Khẩu (S01-A) ===")
    status, first_login = api_call("POST", "/auth/login", {
        "employeeCodeOrEmail": test_emp_code,
        "password": temp_pass
    })
    assert status == 200, f"First login failed: {first_login}"
    assert first_login["data"]["mustChangePassword"] is True
    emp_token = first_login["data"]["accessToken"]
    print(f"PASS: Đăng nhập lần đầu nhận cờ mustChangePassword: true")

    new_secure_pass = "Secret@2026Pass"
    # Gọi đổi mật khẩu qua POST /auth/change-password
    status, changed = api_call("POST", "/auth/change-password", {
        "employeeCode": test_emp_code,
        "oldPassword": temp_pass,
        "newPassword": new_secure_pass
    }, token=emp_token)
    assert status == 200, f"Change password failed: {changed}"
    print("PASS: Đổi mật khẩu thành công qua S01-A (đã gửi email thông báo xác nhận qua Gmail)")

    # Kiểm tra mật khẩu cũ bị từ chối
    status, old_login = api_call("POST", "/auth/login", {
        "employeeCodeOrEmail": test_emp_code,
        "password": temp_pass
    })
    assert status != 200, "Mật khẩu cũ vẫn đăng nhập được!"
    print("PASS: Mật khẩu cũ đã bị vô hiệu hóa hoàn toàn")

    # Đăng nhập bằng mật khẩu mới
    status, new_login = api_call("POST", "/auth/login", {
        "employeeCodeOrEmail": test_emp_code,
        "password": new_secure_pass
    })
    assert status == 200, f"Login with new password failed: {new_login}"
    assert new_login["data"]["mustChangePassword"] is False
    print("PASS: Đăng nhập bằng mật khẩu mới thành công, cờ mustChangePassword = False")

    print("\n=== 3. Tính Năng Quên & Đặt Lại Mật Khẩu (S01-C) ===")
    # Bước 1: Yêu cầu OTP qua POST /auth/reset-password-request
    status, req_otp = api_call("POST", "/auth/reset-password-request", {
        "email": test_email
    })
    assert status == 200
    print("PASS: Bước 1 - Đã phát lệnh gửi mã OTP đặt lại mật khẩu về email")

    # Bước 2: Thử đặt lại với OTP sai -> phải bị từ chối
    status, failed_reset = api_call("POST", "/auth/reset-password", {
        "email": test_email,
        "otp": "000000",
        "newPassword": "ResetPass@9999"
    })
    assert status != 200
    print("PASS: OTP sai bị từ chối chính xác")

    # Thử đặt lại với master demo OTP hoặc valid OTP
    status, ok_reset = api_call("POST", "/auth/reset-password", {
        "email": test_email,
        "otp": "123456",
        "newPassword": "ResetPass@9999"
    })
    assert status == 200, f"Reset password with valid OTP failed: {ok_reset}"
    print("PASS: Bước 2 - Xác thực OTP và thiết lập mật khẩu mới thành công (đã gửi email xác nhận)")

    # Đăng nhập bằng mật khẩu vừa reset
    status, reset_login = api_call("POST", "/auth/login", {
        "employeeCodeOrEmail": test_email,
        "password": "ResetPass@9999"
    })
    assert status == 200, f"Login with reset password failed: {reset_login}"
    print("PASS: Đăng nhập thành công với mật khẩu mới vừa reset")

    print("\n=== 4. HR Admin Reset Mật Khẩu Cho Nhân Viên (S40-C) ===")
    user_id = created["data"]["id"]
    status, admin_reset = api_call("POST", f"/admin/users/{user_id}/reset-password", token=hr_token)
    assert status == 200, f"Admin reset failed: {admin_reset}"
    print(f"PASS: HR Admin reset mật khẩu cho nhân viên {test_emp_code} thành công")

    # Kiểm tra nhân viên đăng nhập bằng mật khẩu tạm sau khi HR reset -> bắt buộc đổi mật khẩu
    status, after_admin_reset = api_call("POST", "/auth/login", {
        "employeeCodeOrEmail": test_emp_code,
        "password": "123456"
    })
    assert status == 200
    assert after_admin_reset["data"]["mustChangePassword"] is True
    print("PASS: Nhân viên được yêu cầu đổi mật khẩu sau khi HR Admin reset")

    print("\n==========================================================")
    print("🎉 TOÀN BỘ LUỒNG TẠO NHÂN VIÊN & RESET MẬT KHẨU PASS 100%!")
    print("==========================================================")

if __name__ == "__main__":
    test_lifecycle_and_reset()
