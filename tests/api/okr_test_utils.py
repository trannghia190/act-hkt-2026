"""Tiện ích dùng chung cho test OKR F1–F9.

Rule phase giờ tính theo NGÀY THẬT, nên test cần mở tạm phase liên quan (qua API của HR)
rồi trả lại timeline gốc sau khi chạy xong — test không phụ thuộc hôm nay là ngày nào.
"""
import contextlib
import datetime as dt
import os

import requests

BASE = os.environ.get("API_BASE", "http://localhost:8080/api/v1")


def login(code: str) -> str:
    r = requests.post(f"{BASE}/auth/login", json={"employeeCodeOrEmail": code, "password": "123456"})
    r.raise_for_status()
    return r.json()["data"]["accessToken"]


def h(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def current_cycle(hr_headers: dict) -> dict:
    data = requests.get(f"{BASE}/okr/cycles/current", headers=hr_headers).json()["data"]
    assert data, "Chưa có chu kỳ OKR active"
    return data


def _put_cycle(hr_headers: dict, cycle: dict, phases: list) -> None:
    r = requests.put(f"{BASE}/okr/cycles/{cycle['id']}", headers=hr_headers, json={
        "name": cycle["name"], "year": cycle["year"], "scaleMin": cycle["scaleMin"], "scaleMax": cycle["scaleMax"],
        "checkinInterval": cycle["checkinInterval"], "alignmentEnabled": cycle["alignmentEnabled"],
        "status": "active", "phases": phases, "companyObjectives": cycle.get("companyObjectives", []),
    })
    assert r.status_code == 200, r.text


def my_okr(emp_headers: dict, year: int = 2026) -> dict:
    r = requests.get(f"{BASE}/okr/my-okr?year={year}", headers=emp_headers)
    assert r.status_code == 200, r.text
    return r.json()["data"]


def ensure_locked(emp_headers: dict, mgr_headers: dict, year: int = 2026) -> dict:
    """Đưa OKR về trạng thái locked (đã duyệt hiện hành) trước khi check-in / tự đánh giá / chấm cuối năm."""
    data = my_okr(emp_headers, year)
    status = data["status"]
    rid = data["reviewId"]
    if status == "locked":
        return data

    if status in ("draft", "returned", "reopened"):
        if status == "draft":
            with phase_open("setup"):
                r = requests.post(f"{BASE}/okr/submit-setup", headers=emp_headers, json={"year": year})
                assert r.status_code == 200, r.text
        else:
            r = requests.post(f"{BASE}/okr/submit-setup", headers=emp_headers, json={"year": year})
            assert r.status_code == 200, r.text
        status = "submitted"

    if status == "submitted":
        r = requests.post(f"{BASE}/okr/reviews/{rid}/approve?action=APPROVE", headers=mgr_headers,
                          json={"feedback": "[test] duyệt để chạy tiếp"})
        assert r.status_code == 200, r.text

    data = my_okr(emp_headers, year)
    assert data["status"] == "locked", data["status"]
    return data


@contextlib.contextmanager
def phase_open(phase_key: str, days: int = 7):
    """Mở tạm phase (HR reopen kèm hạn mới) rồi khôi phục timeline gốc."""
    hr = h(login("01HR"))
    cycle = current_cycle(hr)
    original = [
        {k: p.get(k) for k in ("key", "name", "months", "start_date", "due_date", "status")}
        for p in cycle["phases"]
    ]
    phase = next(p for p in cycle["phases"] if p["key"] == phase_key)
    if phase["effective_status"] == "active":
        yield cycle
        return
    due = (dt.date.today() + dt.timedelta(days=days)).isoformat()
    r = requests.post(f"{BASE}/okr/cycles/{cycle['id']}/reopen", headers=hr,
                      json={"phaseKey": phase_key, "dueDate": due, "reason": f"[test] mở tạm phase {phase_key}"})
    assert r.status_code == 200, r.text
    try:
        yield cycle
    finally:
        _put_cycle(hr, cycle, original)
