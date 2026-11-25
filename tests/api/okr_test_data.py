"""Tiện ích tạo dữ liệu OKR cho test — KHÔNG phụ thuộc dữ liệu seed.

Từ V64 hệ thống OKR khởi động TRỐNG: không có chu kỳ, hồ sơ, đầu việc hay
check-in nào được seed sẵn. Test phải tự dựng dữ liệu của mình rồi dọn sạch.

Cách dựng: dùng API thật (POST /okr/cycles của HR → job provisioning tự tạo hồ sơ
cho nhân viên → nhân viên tạo mục tiêu → quản lý duyệt) để test chạy đúng trên
luồng sản phẩm, không seed tay qua SQL.
"""
import datetime as dt
import json
import os
import subprocess

import requests

BASE = os.environ.get("API_BASE", "http://localhost:8080/api/v1")

# Năm dùng cho test — năm KẾ TIẾP năm hiện tại.
#
# Ràng buộc của API: phase phải có ngày trong [năm−1, năm+1], đồng thời cửa sổ
# Thiết lập phải ĐANG MỞ (start ≤ hôm nay ≤ due) thì nhân viên mới tạo được đầu
# việc. Năm kế tiếp là lựa chọn duy nhất thỏa cả hai mà vẫn tách khỏi năm vận hành.
def test_year() -> int:
    return dt.date.today().year + 1


TEST_YEAR = test_year()


def login(code: str) -> str:
    r = requests.post(f"{BASE}/auth/login", json={"employeeCodeOrEmail": code, "password": "123456"})
    r.raise_for_status()
    return r.json()["data"]["accessToken"]


def h(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _timeline(year: int) -> list:
    """3 phase nối tiếp, hợp lệ theo quy tắc API.

    Phase Thiết lập mở NGAY HÔM NAY để nhân viên tạo được đầu việc; các phase
    sau nối tiếp (không chồng lấn). Ngày nằm trong [năm−1, năm+1] như API yêu cầu.
    """
    start = dt.date.today()
    mid = start + dt.timedelta(days=31)
    fin = start + dt.timedelta(days=61)
    return [
        {"key": "setup", "name": "Thiết lập OKR",
         "start_date": start.isoformat(), "due_date": (start + dt.timedelta(days=30)).isoformat(),
         "status": "scheduled"},
        {"key": "midyear", "name": "Review giữa năm",
         "start_date": mid.isoformat(), "due_date": (mid + dt.timedelta(days=29)).isoformat(),
         "status": "scheduled"},
        {"key": "final", "name": "Đánh giá cuối năm",
         "start_date": fin.isoformat(), "due_date": (fin + dt.timedelta(days=29)).isoformat(),
         "status": "scheduled"},
    ]


def create_cycle(year: int = TEST_YEAR, name: str = None) -> dict:
    """HR tạo chu kỳ OKR cho một năm. Trả về chu kỳ đã lưu."""
    hr = h(login("01HR"))
    body = {
        "name": name or f"Chu kỳ OKR test {year}",
        "year": year,
        "scaleMin": 1, "scaleMax": 5,
        "checkinInterval": "MONTHLY",
        "alignmentEnabled": False,
        "status": "active",
        "phases": _timeline(year),
        "companyObjectives": [
            {"id": "comp-t-01", "title": "Mục tiêu công ty test — Business",
             "category": "BUSINESS", "progress": 50},
            {"id": "comp-t-02", "title": "Mục tiêu công ty test — People",
             "category": "PEOPLE", "progress": 60},
        ],
    }
    r = requests.post(f"{BASE}/okr/cycles", headers=hr, json=body)
    assert r.status_code == 200, f"Tạo chu kỳ OKR thất bại: {r.status_code} {r.text}"
    return r.json()["data"]


def delete_cycle(cycle_id: str) -> None:
    """HR xoá chu kỳ (force để xoá cả hồ sơ + đầu việc của năm đó)."""
    hr = h(login("01HR"))
    requests.delete(f"{BASE}/okr/cycles/{cycle_id}", headers=hr, json={"force": True})


def add_objectives(token: str, year: int = TEST_YEAR) -> list:
    """Nhân viên tạo 1 đầu việc Business + 1 People trong hồ sơ của năm."""
    out = []
    for group, title in (("BUSINESS", "Đầu việc test Business"), ("PEOPLE", "Đầu việc test People")):
        r = requests.post(f"{BASE}/okr/objectives", headers=h(token),
                           json={"groupType": group, "title": title, "detail": "Tạo bởi test"})
        assert r.status_code == 200, f"Tạo đầu việc {group} thất bại: {r.status_code} {r.text}"
        out.append(r.json()["data"])
    return out


def submit_setup(token: str, year: int = TEST_YEAR) -> None:
    """Nhân viên gửi bộ mục tiêu để quản lý duyệt (draft → submitted)."""
    r = requests.post(f"{BASE}/okr/submit-setup", headers=h(token), json={"year": year})
    assert r.status_code == 200, f"Gửi duyệt OKR thất bại: {r.status_code} {r.text}"


def review_id_of(token: str, year: int = TEST_YEAR) -> str:
    """ID hồ sơ OKR của chính người dùng (token) trong năm."""
    r = requests.get(f"{BASE}/okr/my-okr?year={year}", headers=h(token))
    assert r.status_code == 200, f"Lấy my-okr thất bại: {r.status_code} {r.text}"
    return r.json()["data"]["reviewId"]


def approve_review(token: str, employee_code: str = "136ACT", year: int = TEST_YEAR) -> str:
    """Duyệt hồ sơ của `employee_code` (token = người duyệt), trả về reviewId."""
    emp_token = login(employee_code)
    rid = review_id_of(emp_token, year)
    r = requests.post(f"{BASE}/okr/reviews/{rid}/approve?action=APPROVE", headers=h(token),
                      json={"feedback": "[test] duyệt"})
    assert r.status_code == 200, f"Duyệt hồ sơ {employee_code} thất bại: {r.status_code} {r.text}"
    return rid


def build_okr(emp_token: str, approver_code: str, year: int = TEST_YEAR) -> str:
    """Nhân viên tạo 2 đầu việc → gửi duyệt → người duyệt (mã NV) duyệt.

    Trả về reviewId của nhân viên.
    """
    add_objectives(emp_token, year)
    submit_setup(emp_token, year)
    return approve_review_by_token(emp_token, approver_code, year)


def approve_review_by_token(emp_token: str, approver_code: str, year: int = TEST_YEAR) -> str:
    """Duyệt hồ sơ của nhân viên (emp_token) bằng tài khoản người duyệt."""
    rid = review_id_of(emp_token, year)
    r = requests.post(f"{BASE}/okr/reviews/{rid}/approve?action=APPROVE", headers=h(login(approver_code)),
                      json={"feedback": "[test] duyệt"})
    assert r.status_code == 200, f"Duyệt hồ sơ thất bại: {r.status_code} {r.text}"
    return rid


def setup_okr_env(year: int = TEST_YEAR):
    """Dựng môi trường OKR đầy đủ cho test: chu kỳ + OKR của cả quản lý lẫn nhân viên.

    Chuỗi quản lý: 136ACT → 05ACT → 01HR. Cần OKR của 05ACT được duyệt thì
    `GET /okr/manager-objectives` của 136ACT mới trả dữ liệu (C14).
    Trả về (cycle, emp_token, mgr_token).
    """
    cycle = create_cycle(year)
    mgr = login("05ACT")
    emp = login("136ACT")
    # Quản lý tạo OKR, HR duyệt → làm nguồn gợi ý kế thừa cho nhân viên.
    build_okr(mgr, "01HR", year)
    # Nhân viên tạo OKR, quản lý duyệt.
    build_okr(emp, "05ACT", year)
    return cycle, emp, mgr


def _psql(sql: str) -> str:
    return subprocess.run(
        ["psql", "-h", "127.0.0.1", "-d", "pulse_db", "-tAc", sql],
        capture_output=True, text=True, check=True,
    ).stdout.strip()


def _timeline_open(phase_key: str, days: int = 7) -> list:
    """3 phase nối tiếp với `phase_key` ĐANG MỞ từ hôm nay.

    Phase trước: đã kết thúc (trước hôm nay); phase sau: mở sau khi phase trước
    đóng. Dùng để tạm mở phase Đánh giá cuối năm cho luồng tự chấm điểm.
    """
    keys = ["setup", "midyear", "final"]
    idx = keys.index(phase_key)
    today = dt.date.today()
    out = []
    for i, key in enumerate(keys):
        if i < idx:
            day = today - dt.timedelta(days=idx - i)
            start = due = day
        elif i == idx:
            start, due = today, today + dt.timedelta(days=days)
        else:
            prev_due = dt.date.fromisoformat(out[-1]["due_date"])
            start = due = prev_due + dt.timedelta(days=1)
        out.append({"key": key, "name": key, "start_date": start.isoformat(),
                    "due_date": due.isoformat(), "status": "scheduled"})
    return out


def force_open_phase(cycle_id: str, phase_key: str, days: int = 7) -> None:
    """Ghi thẳng cấu hình phase vào DB để mở `phase_key` ngay hôm nay.

    API PUT chỉ nhận timeline hợp lệ và không cho mở phase giữa khi phase trước
    còn mở; test cần mở tạm phase đánh giá cuối năm → ghi thẳng DB. Chu kỳ test
    bị xoá sau khi chạy nên không cần khôi phục.
    """
    payload = json.dumps(_timeline_open(phase_key, days), ensure_ascii=False).replace("'", "''")
    _psql(f"update okr_cycles set phases = '{payload}'::jsonb where id = '{cycle_id}'")


def submit_self_scores(emp_code: str, score_b: int, score_p: int, year: int = TEST_YEAR) -> None:
    """Nhân viên nộp tự đánh giá cuối năm với điểm Business/People cho trước.

    Yêu cầu phase Đánh giá cuối năm đang mở (xem force_open_phase) và OKR đã
    được duyệt (locked).
    """
    r = requests.post(f"{BASE}/okr/reviews/submit-self-review", headers=h(login(emp_code)), json={
        "year": year,
        "box2BusinessScore": score_b,
        "box3PeopleScore": score_p,
        "box2Results": "Kết quả công việc (test)",
        "box3Results": "Kết quả con người (test)",
    })
    assert r.status_code == 200, f"Nộp tự đánh giá thất bại: {r.status_code} {r.text}"


def cleanup(year: int = TEST_YEAR) -> None:
    """Dọn chu kỳ test (xoá kèm hồ sơ + đầu việc).

    Chỉ xoá chu kỳ do test tạo (tên bắt đầu "Chu kỳ OKR test") để không đụng
    dữ liệu vận hành thật.
    """
    hr = h(login("01HR"))
    cycles = requests.get(f"{BASE}/okr/cycles", headers=hr).json()["data"] or []
    for c in cycles:
        if c.get("year") == year or str(c.get("name", "")).startswith("Chu kỳ OKR test"):
            requests.delete(f"{BASE}/okr/cycles/{c['id']}", headers=hr, json={"force": True})
