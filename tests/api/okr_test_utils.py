"""Tiện ích dùng chung cho test OKR F1–F9.

Mô hình phase OKR hiện tại (commit 673bdd4): **3 phase cố định**
`setup → midyear → final`, mỗi phase có 2 cửa sổ (NV cập nhật + QL duyệt) và
**mỗi thời điểm chỉ 1 giai đoạn được mở** → các cửa sổ phải nối tiếp, không
chồng lấn.

Rule phase tính theo NGÀY THẬT, nên test cần mở tạm phase liên quan (qua API
của HR) rồi trả cấu hình gốc sau khi chạy xong — test không phụ thuộc hôm nay
là ngày nào.

Hai điểm kỹ thuật:
1. API PUT chỉ nhận cấu hình HỢP LỆ (3 phase, cửa sổ nối tiếp, không chồng
   lấn) → để mở phase giữa, các phase trước phải đã kết thúc (due < hôm nay).
2. Cấu hình gốc trong DB (do migration seed) có các cửa sổ chồng lấn nên API
   PUT không nhận lại được → khôi phục bằng SQL trực tiếp để giữ nguyên cấu
   hình gốc.
"""
import contextlib
import datetime as dt
import json
import os
import subprocess

import requests

BASE = os.environ.get("API_BASE", "http://localhost:8080/api/v1")

# Năm test — lấy cùng nguồn với okr_test_data để tách khỏi năm vận hành.
from okr_test_data import TEST_YEAR  # noqa: E402

# 3 phase cố định của mô hình hiện tại (đúng thứ tự nghiệp vụ).
REQUIRED_KEYS = ["setup", "midyear", "final"]


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


def _psql(sql: str) -> str:
    """Chạy SQL trực tiếp — dùng để khôi phục cấu hình phase gốc (API PUT không nhận
    cấu hình chồng lấn mà migration seed đã tạo)."""
    out = subprocess.run(
        ["psql", "-h", "127.0.0.1", "-d", "pulse_db", "-tAc", sql],
        capture_output=True, text=True, check=True,
    )
    return out.stdout.strip()


def _backup_phases(cycle_id: str) -> str:
    return _psql(f"select phases::text from okr_cycles where id = '{cycle_id}'")


def _restore_phases(cycle_id: str, phases_json: str) -> None:
    escaped = phases_json.replace("'", "''")
    _psql(f"update okr_cycles set phases = '{escaped}'::jsonb where id = '{cycle_id}'")


def _write_phases(cycle_id: str, phases: list) -> None:
    """Ghi cấu hình phase trực tiếp vào DB.

    API PUT chỉ nhận cấu hình HỢP LỆ (3 phase, cửa sổ nối tiếp, không chồng lấn)
    → không dùng được cho việc mở tạm 1 phase giữa chu kỳ, cũng không dùng được
    để trả lại cấu hình seed gốc (5 phase cửa sổ chồng lấn). Test ghi thẳng DB
    để không phụ thuộc vào luật validate của API.
    """
    payload = json.dumps(phases, ensure_ascii=False).replace("'", "''")
    _psql(f"update okr_cycles set phases = '{payload}'::jsonb where id = '{cycle_id}'")


def _timeline_for(target_key: str, today: dt.date, days: int) -> list:
    """Dựng timeline 3 phase hợp lệ để phase `target_key` đang mở cho nhân viên.

    - Các phase TRƯỚC target: đã kết thúc (due < hôm nay) → không chặn.
    - Phase target: mở từ hôm nay, hạn hôm nay + `days`.
    - Các phase SAU target: bắt đầu sau khi phase trước kết thúc (không chồng lấn).

    API chỉ nhận cấu hình hợp lệ: mọi cặp phase liền kề phải có
    `prev.due_date < next.start_date` — nên các phase được xâu chuỗi theo cursor.
    """
    idx = REQUIRED_KEYS.index(target_key)
    out = []
    for i, key in enumerate(REQUIRED_KEYS):
        if i < idx:
            # Phase đã kết thúc: 1 ngày mỗi phase, xếp ngược từ hôm qua, nối tiếp tuyệt đối.
            day = today - dt.timedelta(days=idx - i)
            start = due = day
        elif i == idx:
            start, due = today, today + dt.timedelta(days=days)
        else:
            # Bắt đầu SAU ngày kết thúc của phase ngay trước (API chặn trùng ngày).
            prev_due = dt.date.fromisoformat(out[-1]["due_date"])
            start = due = prev_due + dt.timedelta(days=1)
        out.append({
            "key": key,
            "name": key,
            "start_date": start.isoformat(),
            "due_date": due.isoformat(),
            "status": "scheduled",
        })
    return out


def my_okr(emp_headers: dict, year: int = TEST_YEAR) -> dict:
    r = requests.get(f"{BASE}/okr/my-okr?year={year}", headers=emp_headers)
    assert r.status_code == 200, r.text
    return r.json()["data"]


def ensure_locked(emp_headers: dict, mgr_headers: dict, year: int = TEST_YEAR) -> dict:
    """Đưa OKR về trạng thái locked (đã duyệt hiện hành) trước khi check-in / tự đánh giá / chấm cuối năm."""
    data = my_okr(emp_headers, year)
    status = data["status"]
    rid = data["reviewId"]
    if status == "locked":
        return data

    if status in ("draft", "returned", "reopened"):
        # Gửi bộ mục tiêu cần cửa sổ NV của phase Thiết lập đang mở.
        with phase_open("setup"):
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
    """Mở tạm phase cho nhân viên rồi trả cấu hình gốc.

    Phase hợp lệ theo mô hình hiện tại chỉ có setup / midyear / final —
    `checkin` và `summary` đã được gộp vào midyear/final nên không mở được.
    """
    assert phase_key in REQUIRED_KEYS, f"Phase không hợp lệ: {phase_key} (chỉ có {REQUIRED_KEYS})"
    hr = h(login("01HR"))
    cycle = current_cycle(hr)
    today = dt.date.today()
    backup = _backup_phases(cycle["id"])

    _write_phases(cycle["id"], _timeline_for(phase_key, today, days))
    try:
        yield cycle
    finally:
        # Khôi phục đúng cấu hình gốc (bằng SQL vì API PUT không nhận cửa sổ chồng lấn).
        _restore_phases(cycle["id"], backup)
