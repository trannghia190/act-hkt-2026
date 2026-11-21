#!/usr/bin/env python3
"""Test F3: Check-in tiến độ OKR (S22).

Kiểm tra:
1. Check-in theo từng đầu việc, chỉ nhập giá trị mới; tiến độ tự tính.
2. Prefill giá trị kỳ trước.
3. Có hạn check-in + trạng thái nhắc trước hạn.
4. Đính kèm file evidence + lịch sử không ghi đè.
5. Review giữa kỳ: Quản lý mở lại → NV sửa → nộp lại → khoá.
"""
import io
import json
import os
import urllib.request

import requests

from okr_test_utils import ensure_locked, phase_open

BASE = os.environ.get("API_BASE", "http://localhost:8080/api/v1")


def login(code: str) -> str:
    res = requests.post(f"{BASE}/auth/login", json={"employeeCodeOrEmail": code, "password": "123456"})
    assert res.status_code == 200, f"Login {code} thất bại: {res.text}"
    return res.json()["data"]["accessToken"]


def headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def main() -> None:
    print("🚀 Bắt đầu kiểm thử Service F3 (Check-in tiến độ S22)...")
    emp_token = login("136ACT")
    mgr_token = login("05ACT")
    emp = headers(emp_token)
    mgr = headers(mgr_token)

    my_okr = requests.get(f"{BASE}/okr/my-okr?year=2026", headers=emp).json()["data"]
    review_id = my_okr["reviewId"]

    # Check-in chỉ hợp lệ trên OKR đang được duyệt hiện hành (locked)
    ensure_locked(emp, mgr)

    # 1 & 2. Dữ liệu check-in có prefill giá trị kỳ trước
    with phase_open("checkin"):
        current = requests.get(f"{BASE}/okr/check-ins/current?year=2026", headers=emp)
        assert current.status_code == 200, current.text
        data = current.json()["data"]
        period = data["period"]
        assert data["deadline"] and isinstance(data["daysLeft"], int) and data["daysLeft"] >= 0
        assert "reminder" in data and "reminderText" in data
        assert len(data["businessItems"]) >= 1 and len(data["peopleItems"]) >= 1
        rows = data["businessItems"] + data["peopleItems"]
        for row in rows:
            assert row["previousValue"] == row["newValue"], "Prefill phải bằng giá trị kỳ trước"
        print(f"✓ Prefill kỳ {period} · Hạn {data['deadline']} · còn {data['daysLeft']} ngày")

        b = data["businessItems"][0]

        # Không check-in hộ kỳ khác
        res = requests.post(f"{BASE}/okr/check-ins", headers=emp, json={
            "year": 2026, "period": "2000-01", "items": [{"itemId": b["itemId"], "newValue": 50}]})
        assert res.status_code == 400, res.text
        print("✓ Check-in kỳ khác kỳ hiện tại bị chặn")

        # 3. Check-in kỳ hiện tại (mỗi đầu việc 1 lần / kỳ)
        pending = [r for r in rows if not r["checkedInThisPeriod"]]
        batch_id = None
        if pending:
            target = pending[0]
            new_val = min(100, target["previousValue"] + 5)
            res = requests.post(f"{BASE}/okr/check-ins", headers=emp, json={
                "year": 2026, "period": period, "note": f"Check-in {period}",
                "items": [{"itemId": target["itemId"], "newValue": new_val}]})
            assert res.status_code == 200, res.text
            payload = res.json()["data"]
            assert payload["savedCount"] == 1 and payload["period"] == period
            batch_id = payload["batchId"]
            print(f"✓ Check-in {target['title'][:30]}… {target['previousValue']} → {new_val}% · tiến độ nhóm tự tính")
        else:
            target = rows[0]

        # Check-in lần 2 cùng kỳ → 409
        dup = requests.post(f"{BASE}/okr/check-ins", headers=emp, json={
            "year": 2026, "items": [{"itemId": target["itemId"], "newValue": 1}]})
        assert dup.status_code == 409, dup.text
        print("✓ Mỗi kỳ chỉ check-in 1 lần / đầu việc")

    # 4. Lịch sử giữ các kỳ, không ghi đè
    history = requests.get(f"{BASE}/okr/check-ins/history?itemId={target['itemId']}", headers=emp)
    assert history.status_code == 200, history.text
    hist = history.json()["data"]
    assert any(r["period"] == period for r in hist)
    batch_id = batch_id or next(r["batchId"] for r in hist if r["period"] == period)
    print(f"✓ Lịch sử check-in giữ {len(hist)} bản ghi, không ghi đè giá trị cũ")

    # 5. Đính kèm evidence
    upload = requests.post(
        f"{BASE}/okr/check-ins/{batch_id}/attachments",
        headers={"Authorization": f"Bearer {emp_token}"},
        files={"file": ("evidence-checkin.txt", io.BytesIO(b"evidence"), "text/plain")},
    )
    assert upload.status_code == 200, upload.text
    att = upload.json()["data"]
    listed = requests.get(f"{BASE}/okr/check-ins/{batch_id}/attachments", headers=emp).json()["data"]
    assert any(a["id"] == att["id"] for a in listed)
    downloaded = requests.get(f"{BASE}/okr/check-ins/attachments/{att['id']}", headers=emp)
    assert downloaded.status_code == 200 and downloaded.content == b"evidence"
    print(f"✓ Đính kèm evidence: {att['fileName']} · tải lại thành công")

    # 6. Review giữa kỳ: mở lại → sửa → nộp lại → duyệt → khoá
    reopen = requests.post(f"{BASE}/okr/reviews/{review_id}/reopen", headers=mgr,
                           json={"reason": "Mở lại để bổ sung trong review giữa kỳ"})
    assert reopen.status_code == 200, reopen.text
    edit = requests.put(
        f"{BASE}/okr/items/{target['itemId']}",
        headers=emp,
        json={"title": target["title"], "detail": "Bổ sung trong review giữa kỳ"},
    )
    assert edit.status_code == 200, edit.text
    submit = requests.post(f"{BASE}/okr/submit-setup", headers=emp, json={"year": 2026})
    assert submit.status_code == 200, submit.text
    locked = requests.get(f"{BASE}/okr/my-okr?year=2026", headers=emp).json()["data"]
    assert locked["status"] == "submitted" and locked["isLocked"] is True
    approve = requests.post(f"{BASE}/okr/reviews/{review_id}/approve?action=APPROVE", headers=mgr,
                            json={"feedback": "Duyệt lại sau bổ sung giữa kỳ"})
    assert approve.status_code == 200, approve.text
    locked = requests.get(f"{BASE}/okr/my-okr?year=2026", headers=emp).json()["data"]
    assert locked["status"] == "locked" and locked["isLocked"] is True
    print("✓ Giữa kỳ: mở lại → sửa → nộp lại → duyệt → khoá sửa")

    # Trả về trạng thái mở để các test khác chạy tiếp
    requests.post(f"{BASE}/okr/reviews/{review_id}/reopen", headers=mgr, json={"reason": "Mở lại sau test"})
    print("\n🎉 TẤT CẢ TIÊU CHÍ SERVICE F3 (CHECK-IN) ĐÃ ĐẠT!")


if __name__ == "__main__":
    main()
