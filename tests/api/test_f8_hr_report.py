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

    # Bước 4 — chỉ Giám đốc (ADMIN) được đánh giá chung; HR gọi phải bị chặn
    cycle_id = data.get("cycleId")
    if cycle_id and not data.get("directorReviewedAt") and data.get("pendingManagerAssessments") == 0:
        assert requests.post(f"{BASE}/okr/cycles/{cycle_id}/director-review", headers=H,
                             json={"comment": "HR không được duyệt"}).status_code == 403
        admin = requests.post(f"{BASE}/auth/login", json={"employeeCodeOrEmail": "Admin", "password": "Admin"})
        assert admin.status_code == 200, admin.text
        A = {"Authorization": f"Bearer {admin.json()['data']['accessToken']}", "Content-Type": "application/json"}
        assert requests.post(f"{BASE}/okr/cycles/{cycle_id}/director-review", headers=A,
                             json={"comment": ""}).status_code == 400
        assert requests.post(f"{BASE}/okr/cycles/{cycle_id}/director-review", headers=A,
                             json={"comment": "Đồng ý kết quả đánh giá toàn công ty"}).status_code == 200
        after = requests.get(f"{BASE}/okr/admin/hr-summary?year=2026", headers=H).json()["data"]
        assert after.get("directorReviewedAt")
        print("✓ F8: Giám đốc (ADMIN) đánh giá chung trước khi HR chốt")
    print(f"✓ F8: {len(records)} hồ sơ 9 trường, widget + tóm tắt + {len(data['risks'])} rủi ro, Excel {len(excel.content)} bytes")


if __name__ == "__main__":
    main()
