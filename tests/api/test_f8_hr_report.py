#!/usr/bin/env python3
"""F8 — Báo cáo HR 9 trường, widget, tóm tắt C15, rủi ro, export Excel."""
import os
import requests

BASE = os.environ.get("API_BASE", "http://localhost:8080/api/v1")


def login(code):
    r = requests.post(f"{BASE}/auth/login", json={"employeeCodeOrEmail": code, "password": "123456"})
    r.raise_for_status()
    return r.json()["data"]["accessToken"]


def main():
    hr = login("01HR")
    H = {"Authorization": f"Bearer {hr}"}
    records = requests.get(f"{BASE}/okr/admin/hr-summary-report?year=2026", headers=H).json()["data"]
    assert len(records) >= 2
    r = next(x for x in records if x["employeeCode"] == "136ACT")
    for field in ("fullName", "employeeCode", "jobTitle", "seniority", "department",
                  "directManagerName", "businessScore", "peopleScore", "averageScore", "status"):
        assert field in r, field
    assert r["seniority"] and r["department"]

    data = requests.get(f"{BASE}/okr/admin/hr-summary?year=2026", headers=H).json()["data"]
    assert "widgets" in data and "summaryText" in data and "risks" in data
    w = data["widgets"]
    assert w["totalEmployees"] == len(data["records"])
    assert "byDepartment" in w and "distribution" in w and "notSubmitted" in w
    assert "nhân viên" in data["summaryText"]

    excel = requests.get(f"{BASE}/okr/admin/export-excel-file?year=2026", headers=H)
    assert excel.status_code == 200
    assert "spreadsheetml" in excel.headers.get("content-type", "")
    assert len(excel.content) > 1000

    # Bước 4 (Giám đốc đánh giá chung) xử lý ngoài hệ thống — API/HR summary không còn bước này.
    assert "directorReviewedAt" not in data
    print(f"✓ F8: {len(records)} hồ sơ 9 trường, widget + tóm tắt + {len(data['risks'])} rủi ro, Excel {len(excel.content)} bytes")


if __name__ == "__main__":
    main()
