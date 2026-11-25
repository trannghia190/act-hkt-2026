#!/usr/bin/env python3
"""F7 — Review OKR cả nhóm: 1 bảng, điểm đề xuất, cảnh báo rule, sắp xếp rủi ro.

OKR khởi động TRỐNG (V64) → test tự dựng chu kỳ + OKR của cả quản lý lẫn nhân
viên, mở tạm phase đánh giá cuối năm để nhân viên tự chấm điểm, rồi dọn sạch.
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


def main():
    T.cleanup()
    try:
        _run()
    finally:
        T.cleanup()


def _run():
    cycle, _emp, mgr = T.setup_okr_env()
    # Mở tạm phase Đánh giá cuối năm để nhân viên tự chấm điểm Business=4, People=5.
    T.force_open_phase(cycle["id"], "final")
    T.submit_self_scores("136ACT", 4, 5)

    rows = requests.get(f"{BASE}/okr/team-review?year={YEAR}",
                        headers={"Authorization": f"Bearer {mgr}"}).json()["data"]
    assert len(rows) >= 1
    assert all("proposedScore" in r and "warnings" in r and "riskScore" in r for r in rows)
    risks = [r["riskScore"] for r in rows]
    assert risks == sorted(risks, reverse=True), "Phải sắp xếp theo rủi ro giảm dần"
    row = next(r for r in rows if r["employeeCode"] == "136ACT")
    assert row["selfBusiness"] == 4 and row["selfPeople"] == 5
    assert row["proposedScore"] >= 1
    print(f"✓ F7: {len(rows)} nhân viên, điểm đề xuất + {row['warningCount']} cảnh báo, sắp xếp rủi ro")


if __name__ == "__main__":
    main()
