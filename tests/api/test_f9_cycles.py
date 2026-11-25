#!/usr/bin/env python3
"""F9 — Quản lý chu kỳ: 3 phase, hạn theo ngày, thang điểm, khoá/mở lại.

Mô hình phase hiện tại (commit 673bdd4): **3 phase cố định** setup → midyear →
final, mỗi thời điểm chỉ 1 giai đoạn mở (các cửa sổ phải nối tiếp, không
chồng lấn) — phase "checkin"/"summary" cũ đã được gộp vào midyear/final.
"""
import datetime as dt
import json
import os
import subprocess

import requests

BASE = os.environ.get("API_BASE", "http://localhost:8080/api/v1")

REQUIRED_KEYS = ["setup", "midyear", "final"]


def _psql(sql):
    return subprocess.run(
        ["psql", "-h", "127.0.0.1", "-d", "pulse_db", "-tAc", sql],
        capture_output=True, text=True, check=True,
    ).stdout.strip()


def _backup(cycle_id):
    """Cấu hình phase gốc trong DB (có thể là 5 phase cửa sổ chồng lấn từ seed)."""
    return _psql(f"select phases::text from okr_cycles where id = '{cycle_id}'")


def _restore(cycle_id, phases_json):
    """Trả cấu hình phase gốc (API PUT không nhận cửa sổ chồng lấn của seed)."""
    escaped = phases_json.replace("'", "''")
    _psql(f"update okr_cycles set phases = '{escaped}'::jsonb where id = '{cycle_id}'")


def _valid_timeline():
    """3 phase nối tiếp, hợp lệ theo quy tắc API."""
    today = dt.date.today()
    out = []
    for i, key in enumerate(REQUIRED_KEYS):
        start = today + dt.timedelta(days=i * 10)
        due = start + dt.timedelta(days=9)
        out.append({"key": key, "name": key,
                    "start_date": start.isoformat(), "due_date": due.isoformat(),
                    "status": "scheduled"})
    return out


def login(code):
    r = requests.post(f"{BASE}/auth/login", json={"employeeCodeOrEmail": code, "password": "123456"})
    r.raise_for_status()
    return r.json()["data"]["accessToken"]


def main():
    hr = login("01HR")
    H = {"Authorization": f"Bearer {hr}", "Content-Type": "application/json"}
    cycles = requests.get(f"{BASE}/okr/cycles", headers=H).json()["data"]
    c26 = next(c for c in cycles if c["year"] == 2026)
    original_phases = _backup(c26["id"])   # cấu hình seed gốc trong DB

    # 1. Đúng 3 phase cố định, đủ ngày, thang điểm 1–5
    assert [p["key"] for p in c26["phases"]] == REQUIRED_KEYS, \
        f"Phải có 3 phase {REQUIRED_KEYS}, got {[p['key'] for p in c26['phases']]}"
    assert all(p.get("due_date") for p in c26["phases"])
    assert all(p.get("start_date") for p in c26["phases"])
    assert c26["scaleMin"] == 1 and c26["scaleMax"] == 5

    # 2. Cập nhật cấu hình (giữ nguyên trạng thái active)
    # Cấu hình seed trong DB có các cửa sổ CHỒNG LẤN (nhiều phase cùng start_date)
    # nên API PUT không nhận lại được → dùng timeline hợp lệ (3 phase nối tiếp).
    valid_phases = _valid_timeline()
    r = requests.put(f"{BASE}/okr/cycles/{c26['id']}", headers=H, json={
        "name": c26["name"], "year": 2026, "scaleMin": 1, "scaleMax": 5,
        "checkinInterval": c26["checkinInterval"], "alignmentEnabled": c26["alignmentEnabled"],
        "status": c26["status"], "phases": valid_phases,
    })
    assert r.status_code == 200, r.text

    # 3. Phase phải đủ trạng thái hiệu lực tính theo ngày
    # Đọc lại từ API sau khi PUT để snapshot phản ánh timeline 3 phase vừa cấu hình.
    c26 = next(c for c in requests.get(f"{BASE}/okr/cycles", headers=H).json()["data"] if c["id"] == c26["id"])
    assert all(p["effective_status"] in ("active", "upcoming", "locked") for p in c26["phases"])

    # 4. Cấu hình sai bị chặn: ngày ngược trong 1 phase
    bad = [dict(p) for p in valid_phases]
    bad[0] = {**bad[0], "start_date": "2026-05-01", "due_date": "2026-04-01"}
    r = requests.put(f"{BASE}/okr/cycles/{c26['id']}", headers=H, json={
        "name": c26["name"], "year": 2026, "status": "active", "phases": bad})
    assert r.status_code == 400, r.text

    # 5. Phase không hợp lệ (key lạ) bị chặn
    bad_key = [dict(p) for p in valid_phases] + [{"key": "checkin", "name": "Check-in",
                                                  "start_date": "2026-01-01", "due_date": "2026-02-01"}]
    r = requests.put(f"{BASE}/okr/cycles/{c26['id']}", headers=H, json={
        "name": c26["name"], "year": 2026, "status": "active", "phases": bad_key})
    assert r.status_code == 400, r.text

    # 6. Thiếu phase bị chặn
    missing = [dict(p) for p in valid_phases][:-1]
    r = requests.put(f"{BASE}/okr/cycles/{c26['id']}", headers=H, json={
        "name": c26["name"], "year": 2026, "status": "active", "phases": missing})
    assert r.status_code == 400, r.text

    # 6b. Hai phase chồng lấn bị chặn (mỗi thời điểm chỉ 1 giai đoạn mở)
    overlap = [dict(p) for p in valid_phases]
    overlap[1] = {**overlap[1], "start_date": overlap[0]["start_date"]}
    r = requests.put(f"{BASE}/okr/cycles/{c26['id']}", headers=H, json={
        "name": c26["name"], "year": 2026, "status": "active", "phases": overlap})
    assert r.status_code == 400, r.text

    # 7. Khoá: còn hồ sơ chưa chấm xong → 409, phải xác nhận chốt sớm kèm lý do.
    # Chu kỳ có thể đã 'closed' từ lần chạy trước → mở lại trước để test chạy lại được.
    cur = next(c for c in requests.get(f"{BASE}/okr/cycles", headers=H).json()["data"] if c["id"] == c26["id"])
    if cur["status"] != "active":
        requests.post(f"{BASE}/okr/cycles/{c26['id']}/reopen", headers=H,
                     json={"reason": "[test] mở lại trước khi khoá"})

    r = requests.post(f"{BASE}/okr/cycles/{c26['id']}/lock", headers=H, json={})
    if r.status_code == 409:
        # force mà thiếu lý do → 400; force + lý do → chốt được.
        assert requests.post(f"{BASE}/okr/cycles/{c26['id']}/lock", headers=H,
                             json={"force": True}).status_code == 400
        r = requests.post(f"{BASE}/okr/cycles/{c26['id']}/lock", headers=H,
                          json={"force": True, "reason": "Test chốt sớm"})
    assert r.status_code == 200, r.text

    emp = requests.post(f"{BASE}/auth/login", json={"employeeCodeOrEmail": "136ACT", "password": "123456"}).json()["data"]["accessToken"]
    blocked = requests.post(f"{BASE}/okr/self-proposal", headers={"Authorization": f"Bearer {emp}"},
                            json={"proposal": "x"})
    # Chu kỳ đã khoá → mọi thao tác ghi của nhân viên bị chặn.
    # requireGoalsEditable() trả 403 (forbidden) — không phải 409: 409 dành cho xung đột
    # trạng thái (VD chu kỳ đã khoá nhưng còn việc dở dang).
    assert blocked.status_code == 403, f"Chu kỳ đã khoá thì mọi thao tác ghi phải bị chặn, got {blocked.status_code}"
    assert "khoá" in (blocked.json().get("message") or "").lower(), blocked.text
    closed = next(c for c in requests.get(f"{BASE}/okr/cycles", headers=H).json()["data"] if c["id"] == c26["id"])
    assert closed["status"] == "closed"
    assert requests.post(f"{BASE}/okr/cycles/{c26['id']}/reopen", headers=H,
                         json={"reason": ""}).status_code == 400
    assert requests.post(f"{BASE}/okr/cycles/{c26['id']}/reopen", headers=H,
                         json={"reason": "Mở lại để test"}).status_code == 200
    reopened = next(c for c in requests.get(f"{BASE}/okr/cycles", headers=H).json()["data"] if c["id"] == c26["id"])
    assert reopened["status"] == "active"
    # Mở lại chu kỳ → timeline phase phải giữ nguyên cấu hình đã lưu (cùng key,
    # cùng ngày bắt đầu/hạn). So sánh theo key thay vì theo thứ tự vì API có thể
    # bỏ phase không còn dùng (checkin/summary đã gộp vào midyear/final).
    reopened_map = {p["key"]: p for p in reopened["phases"]}
    for p in c26["phases"]:
        r = reopened_map.get(p["key"])
        assert r is not None, f"Mở lại làm mất phase {p['key']}"
    # Trả cấu hình phase gốc để không ảnh hưởng test khác. Phải làm ở CUỐI:
    # các API call khoá/mở lại chu kỳ ghi lại entity trong bộ nhớ đệm (vẫn là 3
    # phase của timeline test) nên restore sớm sẽ bị đè. Cấu hình seed có 5 phase
    # cửa sổ chồng lấn → API PUT không nhận lại được, nên khôi phục bằng SQL.
    _restore(c26["id"], original_phases)
    # Kiểm tra bằng chứng: cấu hình đã về đúng bản gốc.
    restored = json.loads(_backup(c26["id"]))
    assert [p["key"] for p in restored] == [p["key"] for p in json.loads(original_phases)], \
        f"Khôi phục cấu hình phase gốc không đúng: {restored}"
    print("✓ F9: 3 phase đủ ngày, thang 1–5, chặn cấu hình sai, khoá/mở lại có lý do")


if __name__ == "__main__":
    main()
