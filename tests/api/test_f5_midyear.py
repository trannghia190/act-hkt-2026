#!/usr/bin/env python3
"""F5 — Review giữa năm: tiến độ, coaching, điều chỉnh có lý do + audit."""
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
    rid = requests.get(f"{BASE}/okr/my-okr?year=2026", headers=E).json()["data"]["reviewId"]

    rows = requests.get(f"{BASE}/okr/midyear/reviews?year=2026", headers=M).json()["data"]
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
        _write_steps(rid, detail, M)
    print("✓ F5: tiến độ + xu hướng check-in, coaching, điều chỉnh/thêm/bớt có lý do, audit đầy đủ, mở lại")


def _write_steps(rid, detail, M):
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
                           "dueDate": "2026-12-31", "reason": "Kéo hạn theo kế hoạch H2"})
    assert r.status_code == 200, r.text

    add = requests.post(f"{BASE}/okr/midyear/reviews/{rid}/items", headers=M,
                        json={"groupType": "PEOPLE", "title": "Mục tiêu bổ sung H2", "reason": "Bổ sung mục tiêu"})
    assert add.status_code == 200, add.text
    new_id = add.json()["data"]["id"]
    assert requests.delete(f"{BASE}/okr/midyear/reviews/{rid}/items/{new_id}", headers=M,
                           params={"reason": "Bớt mục tiêu"}).status_code == 200

    after = requests.get(f"{BASE}/okr/midyear/reviews/{rid}", headers=M).json()["data"]
    actions = [a["action"] for a in after["auditTrail"]]
    assert "MIDYEAR_NOTE" in actions and "ADJUST_ITEM" in actions and "ADD_ITEM" in actions and "REMOVE_ITEM" in actions

    r = requests.post(f"{BASE}/okr/midyear/reviews/{rid}/reopen", headers=M, json={"reason": "Mở cho NV bổ sung"})
    assert r.status_code == 200, r.text


if __name__ == "__main__":
    main()
