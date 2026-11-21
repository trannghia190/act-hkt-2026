#!/usr/bin/env python3
"""F7 — Review OKR cả nhóm: 1 bảng, điểm đề xuất, cảnh báo rule, sắp xếp rủi ro."""
import os
import requests

BASE = os.environ.get("API_BASE", "http://localhost:8080/api/v1")


def login(code):
    r = requests.post(f"{BASE}/auth/login", json={"employeeCodeOrEmail": code, "password": "123456"})
    r.raise_for_status()
    return r.json()["data"]["accessToken"]


def main():
    mgr = login("05ACT")
    rows = requests.get(f"{BASE}/okr/team-review?year=2026", headers={"Authorization": f"Bearer {mgr}"}).json()["data"]
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
