#!/usr/bin/env python3
"""Test F1: Dashboard OKR (NV)
Kiểm tra:
1. GET /api/v1/okr/dashboard -> 200
2. GET /api/v1/okr/my-dashboard -> 200
3. Xác nhận điểm TB bằng trung bình CHỈ 2 nhóm Business / People:
   avg == (businessScore + peopleScore) / 2
4. Xác nhận mục tiêu 20% công ty KHÔNG tính vào điểm TB
5. Xác nhận có card Self proposal năm sau (trạng thái + viewUrl)
6. Xác nhận có phase hiện tại + đếm ngược hạn chót
7. Xác nhận có danh sách việc cần làm (todos) và nút Check-in
"""
import json
import os
import sys
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import okr_test_data as T  # noqa: E402

BASE = os.environ.get("API_BASE", "http://localhost:8080/api/v1")

def get_token():
    req = urllib.request.Request(
        f"{BASE}/auth/login",
        data=json.dumps({"employeeCodeOrEmail": "136ACT", "password": "123456"}).encode(),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode())
        return data["data"]["accessToken"]

def test_dashboard():
    # OKR khởi động TRỐNG (V64) → test tự dựng chu kỳ có mục tiêu công ty rồi dọn sạch.
    T.cleanup()
    try:
        _run_dashboard()
    finally:
        T.cleanup()


def _run_dashboard():
    T.create_cycle()
    year = T.TEST_YEAR

    token = get_token()
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    # 1. Test /okr/dashboard
    req1 = urllib.request.Request(f"{BASE}/okr/dashboard?year={year}", headers=headers)
    with urllib.request.urlopen(req1) as resp:
        assert resp.status == 200, f"Expected 200, got {resp.status}"
        res1 = json.loads(resp.read().decode())
        assert res1["success"] is True
        d1 = res1["data"]
        print("✓ GET /okr/dashboard returned 200 OK")

    # 2. Test /okr/my-dashboard
    req2 = urllib.request.Request(f"{BASE}/okr/my-dashboard?year={year}", headers=headers)
    with urllib.request.urlopen(req2) as resp:
        assert resp.status == 200, f"Expected 200, got {resp.status}"
        res2 = json.loads(resp.read().decode())
        assert res2["success"] is True
        d2 = res2["data"]
        print("✓ GET /okr/my-dashboard returned 200 OK")

    # 3. Điểm 2 nhóm & điểm TB tự tính
    b_score = d1["businessScore"]
    p_score = d1["peopleScore"]
    avg_score = d1["averageScore"]
    if b_score is None or p_score is None:
        # Chưa chấm → không được bịa điểm
        assert avg_score is None and d1["scoreSource"] is None
        print("✓ Chưa có điểm → không bịa điểm từ tiến độ")
    else:
        assert d1["scoreSource"] in ("MANAGER", "SELF")
        expected_avg = (b_score + p_score) / 2.0
        assert abs(avg_score - expected_avg) < 1e-6, f"Average {avg_score} != expected {expected_avg}"
        print(f"✓ Điểm 2 nhóm ({d1['scoreSource']}): Business={b_score}, People={p_score} -> Điểm TB={avg_score}")

    # 4. Phần 20% mục tiêu công ty tách riêng, không cộng vào TB
    comp_objs = d1["companyObjectives"]
    assert len(comp_objs) > 0, "Thiếu mục tiêu công ty"
    assert d1.get("companyObjectivesExcludedFromAverage") is True
    print(f"✓ 20% mục tiêu công ty ({len(comp_objs)} mục) tách riêng, KHÔNG tính vào TB cá nhân")

    # 5. Card Self proposal (Box 4) — khai báo theo KỲ HIỆN TẠI, không phải năm sau
    sp = d1["selfProposal"]
    assert sp["status"] in ["NOT_STARTED", "DRAFT", "SUBMITTED"]
    assert sp["year"] == d1["cycleYear"], f"Self proposal phải theo kỳ hiện tại, got {sp['year']}"
    assert sp["viewUrl"] == "/okr/my-okr"
    print(f"✓ Card Self proposal kỳ {sp['year']}: trạng thái={sp['statusText']} ({sp['status']}), link={sp['viewUrl']}")

    # 6. Phase hiện tại + đếm ngược hạn chót — mô hình 3 phase setup → midyear → final
    phases = {p["key"]: p["effective_status"] for p in d1["phases"]}
    assert set(phases) == {"setup", "midyear", "final"}, f"Phải đúng 3 phase, got {set(phases)}"
    assert d1["currentPhase"].lower() in phases
    assert d1["phaseStatus"] == phases[d1["currentPhase"].lower()]
    if d1["phaseStatus"] == "active":
        assert d1["daysLeft"] >= 0 and "Còn" in d1["countdownText"]
    print(f"✓ Phase={d1['currentPhase']}, Đếm ngược={d1['countdownText']}")

    # 7. Việc cần làm (todos) + Nút Check-in nổi bật
    todos = d1["todos"]
    assert isinstance(todos, list)
    assert isinstance(d1["canCheckIn"], bool)
    # Nút check-in chỉ nổi khi cửa sổ cập nhật đang mở và còn đầu việc chưa check-in kỳ này.
    # Cập nhật tiến độ mở trong cửa sổ NV của midyear hoặc final.
    if d1["canCheckIn"]:
        assert d1["pendingCheckinCount"] > 0
        assert phases["midyear"] == "active" or phases["final"] == "active"
        assert any(t["type"] == "CHECKIN" for t in todos)
    # Không có mục check-in khi chưa tới hạn cập nhật (canCheckIn=False) thì todo cũng không có.
    if not d1["canCheckIn"]:
        assert not any(t["type"] == "CHECKIN" for t in todos)
    print(f"✓ Việc cần làm với OKR: {len(todos)} việc, Nút check-in={d1['canCheckIn']}")

    print("\n🎉 TẤT CẢ TIÊU CHÍ SERVICE F1 ĐÃ ĐẠT!")

if __name__ == "__main__":
    test_dashboard()
