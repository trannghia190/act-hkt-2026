import requests
import json
import sys

BASE_URL = "http://localhost:8080/api/v1"

def run_tests():
    print("🚀 Bắt đầu kiểm thử Service F2 (Tạo OKR & C14 Gợi ý kế thừa)...")

    # 1. Login lấy token
    login_res = requests.post(f"{BASE_URL}/auth/login", json={"employeeCodeOrEmail": "136ACT", "password": "123456"})
    assert login_res.status_code == 200, f"Login thất bại: {login_res.text}"
    token = login_res.json()["data"]["accessToken"]
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    # Lấy reviewId của nhân viên để Quản lý trực tiếp mở lại quyền sửa
    review_id = requests.get(f"{BASE_URL}/okr/my-okr?year=2026", headers=headers).json()["data"]["reviewId"]

    mgr_login = requests.post(f"{BASE_URL}/auth/login", json={"employeeCodeOrEmail": "05ACT", "password": "123456"})
    assert mgr_login.status_code == 200, f"Login Quản lý thất bại: {mgr_login.text}"
    mgr_headers = {
        "Authorization": f"Bearer {mgr_login.json()['data']['accessToken']}",
        "Content-Type": "application/json",
    }
    reopen_res = requests.post(f"{BASE_URL}/okr/reviews/{review_id}/reopen", headers=mgr_headers)
    assert reopen_res.status_code == 200, f"Quản lý mở lại quyền sửa thất bại: {reopen_res.text}"

    # Tiêu chí 1: 2 nhóm cố định Business/People từ /okr/my-okr
    my_okr_res = requests.get(f"{BASE_URL}/okr/my-okr?year=2026", headers=headers)
    assert my_okr_res.status_code == 200, f"Lấy /okr/my-okr thất bại: {my_okr_res.text}"
    okr_data = my_okr_res.json()["data"]
    assert okr_data["status"] in ("draft", "reopened"), f"Trạng thái ban đầu phải mở sửa, nhận {okr_data['status']}"
    assert okr_data["isLocked"] == False, "isLocked ban đầu phải là False"
    print("✓ Tiêu chí 1: GET /okr/my-okr trả về trạng thái mở sửa và danh sách đầu việc từ DB")

    # Tiêu chí 2: Gợi ý kế thừa từ OKR quản lý trực tiếp (C14)
    mgr_res = requests.get(f"{BASE_URL}/okr/manager-objectives", headers=headers)
    assert mgr_res.status_code == 200, f"Lấy /okr/manager-objectives thất bại: {mgr_res.text}"
    mgr_objs = mgr_res.json()["data"]
    assert len(mgr_objs) >= 2, f"Cần có ít nhất 2 mục tiêu của Quản lý, nhận: {len(mgr_objs)}"
    has_mgr_biz = any(o.get("groupType") == "BUSINESS" for o in mgr_objs)
    has_mgr_ppl = any(o.get("groupType") == "PEOPLE" for o in mgr_objs)
    assert has_mgr_biz and has_mgr_ppl, "Danh sách quản lý phải có đủ cả 2 nhóm Business và People"
    print(f"✓ Tiêu chí 2: GET /okr/manager-objectives trả về {len(mgr_objs)} mục tiêu đã duyệt của Quản lý 05ACT (C14)")

    # Tiêu chí 3: Tạo mục tiêu tự do (Không có ô đính kèm)
    create_res = requests.post(
        f"{BASE_URL}/okr/objectives",
        headers=headers,
        json={
            "groupType": "BUSINESS",
            "title": "Tự động hóa 100% test suite OKR",
            "detail": "Viết script tự động kiểm thử 7 tiêu chí"
        }
    )
    assert create_res.status_code == 200, f"Tạo mục tiêu thất bại: {create_res.text}"
    created_item = create_res.json()["data"]
    item_id = created_item["id"]
    assert created_item["groupType"] == "BUSINESS"
    print("✓ Tiêu chí 3: POST /okr/objectives tạo mục tiêu tự do thành công trong DB (không đính kèm)")

    # Tiêu chí 6: Xoá 1 mục bắt buộc có lý do + vẫn còn trong lịch sử (không mất vết)
    # 6a. Xoá không có lý do -> 400 Bad Request
    del_fail_res = requests.delete(f"{BASE_URL}/okr/items/{item_id}", headers=headers)
    assert del_fail_res.status_code == 400, f"Xoá không lý do phải trả 400, nhận: {del_fail_res.status_code}"
    assert "bắt buộc" in del_fail_res.json().get("message", "").lower()
    print("✓ Tiêu chí 6a: Xoá không kèm lý do -> Bị chặn với mã 400 Bad Request")

    # 6b. Xoá có lý do -> 200 OK
    del_ok_res = requests.delete(f"{BASE_URL}/okr/items/{item_id}?reason=Thay_doi_ke_hoach_ky_sau", headers=headers)
    assert del_ok_res.status_code == 200, f"Xoá có lý do thất bại: {del_ok_res.text}"
    # 6c. Kiểm tra lại lịch sử -> mục vẫn còn (deletedItems)
    my_okr_after_del = requests.get(f"{BASE_URL}/okr/my-okr?year=2026", headers=headers).json()["data"]
    deleted_matches = [d for d in my_okr_after_del["deletedItems"] if d["id"] == item_id]
    assert len(deleted_matches) == 1, "Mục bị xoá phải nằm trong danh sách deletedItems để lưu vết"
    assert deleted_matches[0]["deleteReason"] == "Thay_doi_ke_hoach_ky_sau"
    print("✓ Tiêu chí 6b: Xoá có lý do thành công, mục vẫn lưu vết trong lịch sử (deletedItems)")

    # Tiêu chí 7: Box 4 — Self proposal năm sau
    prop_res = requests.post(
        f"{BASE_URL}/okr/self-proposal",
        headers=headers,
        json={
            "proposal": "Định hướng trở thành Solutions Architect và dẫn dắt 1 dự án trọng điểm 2027",
            "improvementArea": "Cần cải thiện kỹ năng thuyết trình và quản lý thời gian",
        }
    )
    assert prop_res.status_code == 200, f"Lưu proposal thất bại: {prop_res.text}"
    okr_prop = requests.get(f"{BASE_URL}/okr/my-okr?year=2026", headers=headers).json()["data"]
    assert "Solutions Architect" in okr_prop["box4ProposalNextYear"]
    assert "thuyết trình" in okr_prop["box4ImprovementArea"]
    print("✓ Tiêu chí 7: POST /okr/self-proposal cập nhật Box 4 (đề xuất + điểm cần cải thiện) thành công trong DB")

    # Tiêu chí 4 & 5: Gửi duyệt -> Khoá sửa, không sửa được nữa
    submit_res = requests.post(f"{BASE_URL}/okr/submit-setup", headers=headers)
    assert submit_res.status_code == 200, f"Submit setup thất bại: {submit_res.text}"
    okr_locked = requests.get(f"{BASE_URL}/okr/my-okr?year=2026", headers=headers).json()["data"]
    assert okr_locked["status"] == "submitted", f"Trạng thái phải là submitted, nhận {okr_locked['status']}"
    assert okr_locked["isLocked"] == True, "isLocked phải là True sau khi nộp"

    # Thử sửa/tạo mục mới khi đã gửi -> phải trả về 403 Forbidden (Khoá sửa)
    try_edit_res = requests.post(
        f"{BASE_URL}/okr/objectives",
        headers=headers,
        json={"groupType": "BUSINESS", "title": "Cố tình thêm sau khi gửi"}
    )
    assert try_edit_res.status_code == 403, f"Sửa sau khi gửi phải trả 403 Forbidden, nhận: {try_edit_res.status_code}"
    try_delete_res = requests.delete(
        f"{BASE_URL}/okr/items/{okr_data['items'][0]['id']}?reason=Thu_xoa_sau_khi_gui",
        headers=headers,
    )
    assert try_delete_res.status_code == 403, f"Xoá sau khi gửi phải trả 403, nhận: {try_delete_res.status_code}"
    print("✓ Tiêu chí 4 & 5: Gửi duyệt thành công (submitted) -> Khoá sửa (403 khi tạo thêm/xoá)")

    # Mở lại để chuẩn bị cho các bài test tiếp theo (Quản lý trực tiếp mở, không phải nhân viên tự mở)
    reopen_again = requests.post(f"{BASE_URL}/okr/reviews/{review_id}/reopen", headers=mgr_headers)
    assert reopen_again.status_code == 200, f"Quản lý mở lại sau khi gửi thất bại: {reopen_again.text}"

    print("\n🎉 TẤT CẢ 7 TIÊU CHÍ SERVICE F2 (TẠO OKR) ĐÃ PASS XUẤT SẮC!")

if __name__ == "__main__":
    run_tests()
