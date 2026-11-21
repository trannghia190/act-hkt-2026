#!/usr/bin/env python3
"""F9 — Quản lý chu kỳ: 5 phase, hạn theo ngày, thang điểm, khoá/mở lại."""
import os
import requests

BASE = os.environ.get("API_BASE", "http://localhost:8080/api/v1")


def login(code):
    r = requests.post(f"{BASE}/auth/login", json={"employeeCodeOrEmail": code, "password": "123456"})
    r.raise_for_status()
    return r.json()["data"]["accessToken"]


def main():
    hr = login("01HR")
    H = {"Authorization": f"Bearer {hr}", "Content-Type": "application/json"}
    cycles = requests.get(f"{BASE}/okr/cycles", headers=H).json()["data"]
    c26 = next(c for c in cycles if c["year"] == 2026)
    assert len(c26["phases"]) == 5
    assert [p["key"] for p in c26["phases"]] == ["setup", "checkin", "midyear", "final", "summary"]
    assert all(p.get("due_date") for p in c26["phases"])
    assert c26["scaleMin"] == 1 and c26["scaleMax"] == 5

    # Cập nhật cấu hình (giữ nguyên trạng thái active)
    r = requests.put(f"{BASE}/okr/cycles/{c26['id']}", headers=H, json={
        "name": c26["name"], "year": 2026, "scaleMin": 1, "scaleMax": 5,
        "checkinInterval": c26["checkinInterval"], "alignmentEnabled": c26["alignmentEnabled"],
        "status": c26["status"], "phases": c26["phases"],
    })
    assert r.status_code == 200, r.text

    # Phase phải đủ trạng thái hiệu lực tính theo ngày
    assert all(p["effective_status"] in ("active", "upcoming", "locked") for p in c26["phases"])

    # Phase sai key / ngày ngược bị chặn
    bad = [dict(p) for p in c26["phases"]]
    bad[0] = {**bad[0], "start_date": "2026-05-01", "due_date": "2026-04-01"}
    r = requests.put(f"{BASE}/okr/cycles/{c26['id']}", headers=H, json={
        "name": c26["name"], "year": 2026, "status": "active", "phases": bad})
    assert r.status_code == 400, r.text

    # Khoá: còn hồ sơ chưa chấm xong → 409, phải xác nhận chốt sớm kèm lý do
    r = requests.post(f"{BASE}/okr/cycles/{c26['id']}/lock", headers=H, json={})
    if r.status_code == 409:
        assert requests.post(f"{BASE}/okr/cycles/{c26['id']}/lock", headers=H,
                             json={"force": True}).status_code == 400
        r = requests.post(f"{BASE}/okr/cycles/{c26['id']}/lock", headers=H,
                          json={"force": True, "reason": "Test chốt sớm"})
    assert r.status_code == 200, r.text
    emp = requests.post(f"{BASE}/auth/login", json={"employeeCodeOrEmail": "136ACT", "password": "123456"}).json()["data"]["accessToken"]
    blocked = requests.post(f"{BASE}/okr/self-proposal", headers={"Authorization": f"Bearer {emp}"},
                            json={"proposal": "x"})
    assert blocked.status_code == 409, "Chu kỳ đã khoá thì mọi thao tác ghi phải bị chặn"
    closed = next(c for c in requests.get(f"{BASE}/okr/cycles", headers=H).json()["data"] if c["id"] == c26["id"])
    assert closed["status"] == "closed"
    assert requests.post(f"{BASE}/okr/cycles/{c26['id']}/reopen", headers=H,
                         json={"reason": ""}).status_code == 400
    assert requests.post(f"{BASE}/okr/cycles/{c26['id']}/reopen", headers=H,
                         json={"reason": "Mở lại để test"}).status_code == 200
    reopened = next(c for c in requests.get(f"{BASE}/okr/cycles", headers=H).json()["data"] if c["id"] == c26["id"])
    assert reopened["status"] == "active"
    # Mở lại chu kỳ → timeline phase giữ nguyên như trước khi khoá
    assert [(p["key"], p["effective_status"]) for p in reopened["phases"]] == \
           [(p["key"], p["effective_status"]) for p in c26["phases"]]
    print("✓ F9: 5 phase đủ ngày, thang 1–5, khoá/mở lại có lý do")


if __name__ == "__main__":
    main()
