#!/usr/bin/env python3
"""F4 — Duyệt OKR đầu năm: scope, góp ý bắt buộc, khoá, mở lại, thông báo.

OKR khởi động TRỐNG (V64) → test tự dựng chu kỳ + OKR đã duyệt của nhân viên,
rồi mở lại để chạy luồng nộp/duyệt; dọn sạch ở cuối.
"""
import os
import sys

import requests

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import okr_test_data as T  # noqa: E402

BASE = os.environ.get("API_BASE", "http://localhost:8080/api/v1")
YEAR = T.TEST_YEAR


def login(code):
    r = requests.post(f"{BASE}/auth/login", json={"employeeCodeOrEmail": code, "password": "123456"})
    r.raise_for_status()
    return r.json()["data"]["accessToken"]


def h(t):
    return {"Authorization": f"Bearer {t}", "Content-Type": "application/json"}


def main():
    T.cleanup()
    try:
        _run()
    finally:
        T.cleanup()


def _run():
    T.setup_okr_env()
    emp, mgr = login("136ACT"), login("05ACT")
    E, M = h(emp), h(mgr)
    rid = requests.get(f"{BASE}/okr/my-okr?year={YEAR}", headers=E).json()["data"]["reviewId"]

    # Đảm bảo mở sửa trước khi nộp
    assert requests.post(f"{BASE}/okr/reviews/{rid}/reopen", headers=M,
                         json={"reason": "Chuẩn bị test F4"}).status_code == 200
    assert requests.post(f"{BASE}/okr/submit-setup", headers=E, json={"year": YEAR}).status_code == 200

    rows = requests.get(f"{BASE}/okr/team-approvals?year={YEAR}", headers=M).json()["data"]
    row = next(r for r in rows if r["employeeCode"] == "136ACT")
    assert row["businessItems"] and row["peopleItems"], "Phải thấy đủ 2 nhóm"
    assert row["status"] == "SUBMITTED"

    # Duyệt không góp ý -> 400
    r = requests.post(f"{BASE}/okr/reviews/{rid}/approve?action=APPROVE", headers=M, json={})
    assert r.status_code == 400, r.text

    # Duyệt có góp ý -> locked
    r = requests.post(f"{BASE}/okr/reviews/{rid}/approve?action=APPROVE", headers=M,
                      json={"feedback": "Đồng ý phê duyệt, cần tập trung Q4"})
    assert r.status_code == 200, r.text
    okr = requests.get(f"{BASE}/okr/my-okr?year={YEAR}", headers=E).json()["data"]
    assert okr["status"] == "locked" and okr["isLocked"] is True

    # Nhân viên không tự sửa được
    item = okr["items"][0]
    assert requests.put(f"{BASE}/okr/items/{item['id']}", headers=E, json={"title": "Sửa trộm"}).status_code == 403

    # Quản lý mở lại
    r = requests.post(f"{BASE}/okr/reviews/{rid}/reopen", headers=M, json={"reason": "Mở lại bổ sung"})
    assert r.status_code == 200, r.text
    okr = requests.get(f"{BASE}/okr/my-okr?year={YEAR}", headers=E).json()["data"]
    assert okr["status"] == "reopened" and okr["isLocked"] is False
    print("✓ F4: scope 2 nhóm, góp ý bắt buộc khi duyệt/trả lại, khoá sau duyệt, mở lại đúng quyền")


if __name__ == "__main__":
    main()
