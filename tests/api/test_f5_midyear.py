#!/usr/bin/env python3
"""F5 — Review giữa năm: tiến độ, coaching, điều chỉnh có lý do + audit."""
import os
import sys

import requests

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import okr_test_data as T  # noqa: E402
from okr_test_utils import ensure_locked, phase_open

BASE = os.environ.get("API_BASE", "http://localhost:8080/api/v1")
YEAR = T.TEST_YEAR


def login(code):
    r = requests.post(f"{BASE}/auth/login", json={"employeeCodeOrEmail": code, "password": "123456"})
    r.raise_for_status()
    return r.json()["data"]["accessToken"]


def h(t):
    return {"Authorization": f"Bearer {t}", "Content-Type": "application/json"}


def main():
    # OKR khởi động TRỐNG (V64) → dựng chu kỳ + OKR đã duyệt rồi dọn sạch cuối test.
    T.cleanup()
    try:
        _run()
    finally:
        T.cleanup()


def _run():
    T.setup_okr_env()
    emp, mgr = login("136ACT"), login("05ACT")
    E, M = h(emp), h(mgr)
    ensure_locked(E, M)
    rid = requests.get(f"{BASE}/okr/my-okr?year={YEAR}", headers=E).json()["data"]["reviewId"]

    rows = requests.get(f"{BASE}/okr/midyear/reviews?year={YEAR}", headers=M).json()["data"]
    row = next(r for r in rows if r["employeeCode"] == "136ACT")
    assert "proposedScore" in row and "warnings" in row

    detail = requests.get(f"{BASE}/okr/midyear/reviews/{rid}", headers=M).json()["data"]
    assert detail["businessItems"] and detail["peopleItems"]
    assert "checkInTrend" in detail["businessItems"][0]
    assert "midYear" in detail and "auditTrail" in detail

    if detail.get("midYearWritable") is False:
        blocked = requests.post(f"{BASE}/okr/midyear/reviews/{rid}", headers=M, json={"managerCoaching": "x"})
        assert blocked.status_code == 409, blocked.text
        print("✓ Ngoài phase giữa năm → chỉ xem, ghi bị chặn (409)")

    with phase_open("midyear"):
        _write_steps(rid, detail, M, E)
    print("✓ F5: tiến độ + xu hướng check-in, coaching, điều chỉnh/bớt có lý do, audit đầy đủ, mở lại, NV tự thêm mục tiêu")


def _write_steps(rid, detail, M, E):
    r = requests.post(f"{BASE}/okr/midyear/reviews/{rid}", headers=M, json={
        "employeeFeedback": "Hoàn thành tốt H1",
        "managerCoaching": "Cần chủ động hơn trong H2",
        "h2Commitment": "Hoàn thành 100% KR Q3-Q4",
    })
    assert r.status_code == 200, r.text

    item = detail["businessItems"][0]
    r = requests.put(f"{BASE}/okr/midyear/reviews/{rid}/items/{item['id']}", headers=M,
                     json={"title": item["title"], "reason": ""})
    assert r.status_code == 400, "Điều chỉnh không lý do phải bị chặn"

    r = requests.put(f"{BASE}/okr/midyear/reviews/{rid}/items/{item['id']}", headers=M,
                     json={"detail": (item.get("detail") or "") + " [Điều chỉnh F5]",
                           "dueDate": f"{YEAR}-12-31", "reason": "Kéo hạn theo kế hoạch H2"})
    assert r.status_code == 200, r.text

    # Quản lý KHÔNG được thêm mục tiêu thay nhân viên giữa năm — chỉ điều chỉnh/bớt có lý do.
    add = requests.post(f"{BASE}/okr/midyear/reviews/{rid}/items", headers=M,
                        json={"groupType": "PEOPLE", "title": "Mục tiêu bổ sung H2", "reason": "Bổ sung mục tiêu"})
    assert add.status_code == 403, add.text

    item2 = detail["peopleItems"][0]
    assert requests.delete(f"{BASE}/okr/midyear/reviews/{rid}/items/{item2['id']}", headers=M,
                           params={"reason": "Bớt mục tiêu"}).status_code == 200

    after = requests.get(f"{BASE}/okr/midyear/reviews/{rid}", headers=M).json()["data"]
    actions = [a["action"] for a in after["auditTrail"]]
    assert "MIDYEAR_NOTE" in actions and "ADJUST_ITEM" in actions and "REMOVE_ITEM" in actions
    base_adds = sum(1 for a in detail["auditTrail"] if a["action"] == "ADD_ITEM")
    assert sum(1 for a in after["auditTrail"] if a["action"] == "ADD_ITEM") == base_adds, \
        "Quản lý không được thêm mục tiêu thay nhân viên"

    # Bộ mục tiêu đã duyệt → nhân viên chưa được tự thêm khi Quản lý chưa mở lại.
    locked_add = requests.post(f"{BASE}/okr/objectives", headers=E,
                               json={"groupType": "PEOPLE", "title": "NV tự thêm khi chưa mở"})
    assert locked_add.status_code == 403, locked_add.text

    r = requests.post(f"{BASE}/okr/midyear/reviews/{rid}/reopen", headers=M, json={"reason": "Mở cho NV bổ sung"})
    assert r.status_code == 200, r.text

    # Mở lại → CHÍNH NHÂN VIÊN tự bổ sung mục tiêu của mình (Quản lý không thêm thay).
    emp_add = requests.post(f"{BASE}/okr/objectives", headers=E,
                            json={"groupType": "PEOPLE", "title": "Mục tiêu NV tự bổ sung H2"})
    assert emp_add.status_code == 200, emp_add.text

    after = requests.get(f"{BASE}/okr/midyear/reviews/{rid}", headers=M).json()["data"]
    new_adds = [a for a in after["auditTrail"] if a["action"] == "ADD_ITEM"]
    assert len(new_adds) == base_adds + 1, "Thiếu audit nhân viên tự thêm mục tiêu giữa năm"
    assert any((a.get("newValue") or "") == "Mục tiêu NV tự bổ sung H2" for a in new_adds), \
        "Audit ADD_ITEM phải ghi mục tiêu do nhân viên tự thêm"


if __name__ == "__main__":
    main()
