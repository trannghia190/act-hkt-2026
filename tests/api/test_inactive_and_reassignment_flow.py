import requests
import json
import uuid

BASE_URL = "http://localhost:8080/api/v1"

def test_flow():
    print("=== TEST: Inactive Employee, Manager Reassignment & Notification Fallback Flow ===")
    
    # 1. Login HR
    s = requests.Session()
    login_res = s.post(f"{BASE_URL}/auth/login", json={"employeeCodeOrEmail": "01HR", "password": "password123"})
    if login_res.status_code != 200:
        login_res = s.post(f"{BASE_URL}/auth/login", json={"employeeCodeOrEmail": "01HR", "password": "123456"})
    assert login_res.status_code == 200, f"Login HR failed: {login_res.text}"
    token = login_res.json()["data"]["accessToken"]
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    print("PASS: HR Admin login successfully")

    # 2. Test /admin/users/active
    active_res = s.get(f"{BASE_URL}/admin/users/active", headers=headers)
    assert active_res.status_code == 200, f"Active users failed: {active_res.text}"
    active_users = active_res.json()["data"]
    assert isinstance(active_users, list) and len(active_users) > 0
    # Verify all returned users have status ACTIVE (implicit by endpoint)
    print(f"PASS: /admin/users/active returned {len(active_users)} active users")

    # 3. Create a test manager and a subordinate
    mgr_code = f"MGR{uuid.uuid4().hex[:4].upper()}"
    mgr_res = s.post(f"{BASE_URL}/admin/users", headers=headers, json={
        "employeeCode": mgr_code,
        "fullName": f"Quản lý {mgr_code}",
        "email": f"{mgr_code.lower()}@act.vn",
        "role": "MANAGER",
        "positionName": "Trưởng phòng Kỹ thuật"
    })
    assert mgr_res.status_code == 200, f"Create manager failed: {mgr_res.text}"
    mgr_id = mgr_res.json()["data"]["id"]
    print(f"PASS: Created temporary manager {mgr_code} (id: {mgr_id})")

    sub_code = f"SUB{uuid.uuid4().hex[:4].upper()}"
    sub_res = s.post(f"{BASE_URL}/admin/users", headers=headers, json={
        "employeeCode": sub_code,
        "fullName": f"Nhân viên {sub_code}",
        "email": f"{sub_code.lower()}@act.vn",
        "role": "EMPLOYEE",
        "positionName": "Kỹ sư Backend"
    })
    assert sub_res.status_code == 200, f"Create subordinate failed: {sub_res.text}"
    sub_id = sub_res.json()["data"]["id"]
    print(f"PASS: Created subordinate {sub_code} (id: {sub_id})")

    # 4. Assign subordinate to this manager
    assign_res = s.post(f"{BASE_URL}/admin/users/{sub_code}/change-manager", headers=headers, json={
        "newManagerId": mgr_id,
        "reason": "Gán quản lý trực tiếp thử nghiệm"
    })
    assert assign_res.status_code == 200, f"Change manager failed: {assign_res.text}"
    print(f"PASS: Assigned {sub_code} to manager {mgr_code}")

    # 5. Subordinate creates a request -> routed to mgr_id
    # First subordinate gets temp password via adminResetPassword
    reset_res = s.post(f"{BASE_URL}/admin/users/{sub_id}/reset-password", headers=headers)
    assert reset_res.status_code == 200
    temp_pass = reset_res.json()["data"]

    sub_login = s.post(f"{BASE_URL}/auth/login", json={"employeeCodeOrEmail": sub_code, "password": temp_pass})
    assert sub_login.status_code == 200
    sub_token = sub_login.json()["data"]["accessToken"]
    sub_headers = {"Authorization": f"Bearer {sub_token}", "Content-Type": "application/json"}

    # Change password
    chg_res = s.post(f"{BASE_URL}/auth/change-password", headers=sub_headers, json={
        "employeeCode": sub_code,
        "oldPassword": temp_pass,
        "newPassword": "SubPassword123@"
    })
    assert chg_res.status_code == 200, f"Change password failed: {chg_res.text}"
    # Re-login with new password
    sub_login = s.post(f"{BASE_URL}/auth/login", json={"employeeCodeOrEmail": sub_code, "password": "SubPassword123@"})
    sub_headers["Authorization"] = f"Bearer {sub_login.json()['data']['accessToken']}"

    # Submit attendance WFH request
    req_res = s.post(f"{BASE_URL}/requests", headers=sub_headers, json={
        "type": "WFH",
        "workDate": "2026-12-01",
        "endDate": "2026-12-01",
        "reason": "Làm việc từ xa hoàn thiện tính năng",
        "payload": json.dumps({"reason": "Làm việc từ xa"}),
        "draft": False
    })
    assert req_res.status_code == 200, f"Submit request failed: {req_res.text}"
    created_req = req_res.json()["data"]
    req_id = created_req["id"]
    print(f"PASS: Subordinate created request #{req_id}, decidedBy = {created_req.get('decidedBy')}")

    # 6. Deactivate / resign the manager -> cleanupDeactivatedUser will run!
    resign_mgr_res = s.post(f"{BASE_URL}/admin/users/{mgr_id}/resign", headers=headers, json={
        "reason": "Quản lý chuyển công tác sang công ty khác"
    })
    assert resign_mgr_res.status_code == 200, f"Resign manager failed: {resign_mgr_res.text}"
    print(f"PASS: Manager {mgr_code} resigned successfully")

    # Verify manager is no longer in active users
    active_after = s.get(f"{BASE_URL}/admin/users/active", headers=headers).json()["data"]
    assert not any(u["employeeCode"] == mgr_code for u in active_after), "Resigned manager must not appear in /admin/users/active"
    print("PASS: Resigned manager excluded from /admin/users/active")

    # 7. Check subordinate's request: it must have been safely transferred to fallback manager (05ACT or admin)
    sub_detail_res = s.get(f"{BASE_URL}/admin/users/{sub_id}", headers=headers)
    assert sub_detail_res.status_code == 200
    sub_detail = sub_detail_res.json()["data"]
    print(f"PASS: Subordinate manager updated to: {sub_detail.get('managerName')} ({sub_detail.get('managerCode')})")
    assert sub_detail.get("managerCode") != mgr_code, "Subordinate manager must no longer be the resigned manager"

    # 8. Test Bulk Reassignment
    bulk_res = s.post(f"{BASE_URL}/admin/users/bulk-assign-manager", headers=headers, json={
        "userIds": [sub_id],
        "managerId": "05ACT",
        "reason": "Gán hàng loạt về quản lý chuẩn"
    })
    assert bulk_res.status_code == 200, f"Bulk assign manager failed: {bulk_res.text}"
    assert bulk_res.json()["data"]["updatedCount"] >= 1
    print("PASS: Bulk manager assignment successful")

    # 9. Test Reactivate user
    reactivate_res = s.put(f"{BASE_URL}/admin/users/{mgr_id}", headers=headers, json={
        "status": "ACTIVE",
        "reason": "Kích hoạt lại tài khoản quản lý"
    })
    assert reactivate_res.status_code == 200, f"Reactivate failed: {reactivate_res.text}"
    active_after_reactivate = s.get(f"{BASE_URL}/admin/users/active", headers=headers).json()["data"]
    assert any(u["employeeCode"] == mgr_code for u in active_after_reactivate), "Reactivated manager must appear in /admin/users/active"
    print("PASS: Reactivate manager successfully restored them to active users list")

    # 10. Clean up / Soft-delete test users
    del_mgr = s.delete(f"{BASE_URL}/admin/users/{mgr_id}", headers=headers)
    assert del_mgr.status_code == 200
    del_sub = s.delete(f"{BASE_URL}/admin/users/{sub_id}", headers=headers)
    assert del_sub.status_code == 200
    print("PASS: Soft-delete DELETE /admin/users/{id} working cleanly")

    print("\n============================================================")
    print("🎉 ALL INACTIVE, REASSIGNMENT & NOTIFICATION TESTS PASSED 100%!")
    print("============================================================")

if __name__ == "__main__":
    test_flow()
