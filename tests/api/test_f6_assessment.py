#!/usr/bin/env python3
"""F6 — Đánh giá cuối năm: 4 box, điểm 1–5 nguyên, TB tự tính, lưu 2 loại điểm."""
import os
import requests

from okr_test_utils import ensure_locked, phase_open

BASE = os.environ.get("API_BASE", "http://localhost:8080/api/v1")


def login(code):
    r = requests.post(f"{BASE}/auth/login", json={"employeeCodeOrEmail": code, "password": "123456"})
    r.raise_for_status()
    return r.json()["data"]["accessToken"]


def h(t):
    return {"Authorization": f"Bearer {t}", "Content-Type": "application/json"}


def main():
    emp, mgr = login("136ACT"), login("05ACT")
    E, M = h(emp), h(mgr)
    ensure_locked(E, M)
    form = requests.get(f"{BASE}/okr/reviews/form-4box?employeeCode=136ACT&year=2026", headers=E).json()["data"]
    assert form["employeeCode"] == "136ACT"
    # Box 1 — thông tin cá nhân tự điền từ hồ sơ
    box1 = form["box1"]
    assert box1["fullName"] and box1["employeeCode"] == "136ACT"
    assert {"jobTitle", "department", "managerName", "joinedDate", "seniority"} <= set(box1)
    # Box 2 / Box 3 — mỗi box 4 mục + điểm tự chấm + điểm quản lý
    for b in ("box2", "box3"):
        assert {"results", "adjustments", "difficulties", "lessons", "selfScore", "managerScore"} <= set(form[b])

    with phase_open("final"):
        _assess(form, E, M)

    # Quản lý không ghi đè được điểm tự chấm
    rid = requests.get(f"{BASE}/okr/my-okr?year=2026", headers=E).json()["data"]["reviewId"]
    assert requests.put(f"{BASE}/okr/reviews/{rid}/box2-3", headers=M,
                        json={"box2BusinessScore": 1, "box3PeopleScore": 1}).status_code == 403

    final = requests.get(f"{BASE}/okr/reviews/form-4box?employeeCode=136ACT&year=2026", headers=E).json()["data"]
    assert final["box2"]["results"] and final["box3"]["results"], "Mục Kết quả của Box 2/3 phải được lưu"
    assert final["box2BusinessScore"] and final["box3PeopleScore"], "Điểm tự chấm phải được giữ"
    assert final["managerPeopleScore"] == 4 and final["managerAverageScore"] == 4.0
    assert final["selfAverageScore"] == (final["box2BusinessScore"] + final["box3PeopleScore"]) / 2
    print("✓ F6: đủ 4 box, điểm 1–5 nguyên, TB tự tính, lưu song song tự chấm + quản lý")


def _assess(form, E, M):
    rid = requests.get(f"{BASE}/okr/my-okr?year=2026", headers=E).json()["data"]["reviewId"]
    if form["status"] == "DA_HOAN_TAT":
        # Đã được quản lý chấm → nhân viên không sửa tự đánh giá được nữa
        r = requests.post(f"{BASE}/okr/reviews/submit-self-review", headers=E, json={
            "year": 2026, "box2BusinessScore": 3, "box3PeopleScore": 3})
        assert r.status_code == 409, r.text
        print("✓ Sau khi quản lý chấm → khoá tự đánh giá")
    else:
        r = requests.post(f"{BASE}/okr/reviews/submit-self-review", headers=E, json={
            "employeeCode": "136ACT", "year": 2026,
            "box2Results": "Hoàn thành 4 nhóm mục tiêu",
            "box2Adjustments": "Điều chỉnh phạm vi Q3",
            "box2Difficulties": "Thiếu nguồn lực AI",
            "box2Lessons": "Cần phối hợp sớm hơn",
            "box2BusinessScore": 4,
            "box3Results": "Tổ chức 3 buổi tech sharing",
            "box3Adjustments": "Gộp 2 buổi cuối",
            "box3Difficulties": "Lịch team dày",
            "box3Lessons": "Chốt lịch sớm",
            "box3PeopleScore": 5,
            "box4SelfProposal": "Học Cloud Architect",
            "box4ImprovementArea": "Kỹ năng thuyết trình",
        })
        assert r.status_code == 200, r.text
        assert r.json()["data"]["selfAverageScore"] == 4.5

        # Thiếu mục Kết quả của Box 3 → chặn (bản cuối năm)
        assert requests.post(f"{BASE}/okr/reviews/submit-self-review", headers=E, json={
            "year": 2026, "box2Results": "x", "box2BusinessScore": 4, "box3PeopleScore": 4,
        }).status_code in (400, 409)

        # Điểm lẻ / ngoài 1-5 bị chặn
        assert requests.post(f"{BASE}/okr/reviews/submit-self-review", headers=E, json={
            "employeeCode": "136ACT", "year": 2026, "box2BusinessScore": 4.5, "box3PeopleScore": 4,
        }).status_code == 400

        r = requests.post(f"{BASE}/okr/reviews/{rid}/manager-assess", headers=M, json={
            "managerBusinessScore": 4, "managerPeopleScore": 4, "managerComment": "Đạt kỳ vọng",
        })
        assert r.status_code == 200, r.text
        data = r.json()["data"]
        assert data["selfAverageScore"] == 4.5 and data["managerAverageScore"] == 4.0

        # Không nhận xét -> chặn
        assert requests.post(f"{BASE}/okr/reviews/{rid}/manager-assess", headers=M, json={
            "managerBusinessScore": 4, "managerPeopleScore": 4, "managerComment": "",
        }).status_code == 400


    # Không nhận xét -> chặn; chấm lại có nhận xét -> OK, giữ nguyên điểm tự chấm
    assert requests.post(f"{BASE}/okr/reviews/{rid}/manager-assess", headers=M, json={
        "managerBusinessScore": 4, "managerPeopleScore": 4, "managerComment": "",
    }).status_code == 400
    r = requests.post(f"{BASE}/okr/reviews/{rid}/manager-assess", headers=M, json={
        "managerBusinessScore": 4, "managerPeopleScore": 4, "managerComment": "Đạt kỳ vọng",
    })
    assert r.status_code == 200, r.text
    data = r.json()["data"]
    assert data["managerAverageScore"] == 4.0 and data["selfAverageScore"] is not None


if __name__ == "__main__":
    main()
