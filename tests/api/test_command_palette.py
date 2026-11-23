#!/usr/bin/env python3
"""
Command Palette Ctrl+K (CORE-CMD-01/02) — API.

  • Tìm không dấu / dính liền vẫn ra màn hình đúng (dieu, chamcong, taodon).
  • Kết quả USER trả URL mà vai trò hiện tại mở được:
      Employee  → /account/profile
      Manager   → /admin/org-tree?search=<code>
      HR/Admin  → /admin/employees?search=<code>
  • Không rò rỉ màn hình HR-only (Rule Engine, Employees, Audit) cho Employee/Manager.
  • Hành động nhanh có SUBMIT_WFH + CHANGE_PASSWORD; HR có CONFIG_RULES.

Chạy (backend :8080, DB pulse_db):
  python3 tests/api/test_command_palette.py
"""
import json
import sys
import urllib.parse
import urllib.request

API = "http://localhost:8080/api/v1"


def call(method, path, token=None, body=None):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(API + path, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", "Bearer " + token)
    with urllib.request.urlopen(req) as r:
        return r.status, json.loads(r.read() or b"{}")


def login(code):
    st, js = call("POST", "/auth/login", body={"employeeCodeOrEmail": code, "password": "123456"})
    assert st == 200, (code, st, js)
    return js["data"]["accessToken"]


def search(token, q):
    st, js = call("GET", "/search/quick?q=" + urllib.parse.quote(q), token)
    assert st == 200, (q, st, js)
    return js.get("data", [])


def actions(token):
    st, js = call("GET", "/search/actions", token)
    assert st == 200, (st, js)
    return js.get("data", [])


def check(name, cond, extra=""):
    print(("PASS " if cond else "FAIL ") + name + ("" if cond else " — " + str(extra)[:500]))
    if not cond:
        sys.exit(1)


def urls(items):
    return [i.get("url", "") for i in items]


def user_items(items):
    return [i for i in items if i.get("kind") == "user"]


emp = login("136ACT")
mgr = login("05ACT")
hr = login("01HR")

# ── 1. Tìm mờ không dấu / dính liền ─────────────────────────────────────
for q, expected in [("dieu", "/admin/policy-doc"),
                    ("chamcong", "/attendance/checkin"),
                    ("taodon", "/attendance/requests"),
                    ("đi muộn", "/admin/policy-doc"),
                    ("wfh", "/attendance/requests")]:
    found = urls(search(emp, q))
    check(f"Employee tìm '{q}' ra {expected}", expected in found, found)

# ── 2. URL nhân sự đúng vai trò ──────────────────────────────────────────
e_users = user_items(search(emp, "136ACT"))
check("Employee tự tìm thấy mình", len(e_users) >= 1, e_users)
check("Employee user URL → /account/profile",
      e_users and e_users[0]["url"] == "/account/profile", e_users)

m_users = user_items(search(mgr, "136ACT"))
check("Manager user URL → /admin/org-tree?search=<code>",
      m_users and m_users[0]["url"].startswith("/admin/org-tree?search=136ACT"), m_users)

h_users = user_items(search(hr, "136ACT"))
check("HR user URL → /admin/employees?search=<code>",
      h_users and h_users[0]["url"].startswith("/admin/employees?search=136ACT"), h_users)

# ── 3. Không rò rỉ màn hình HR-only ─────────────────────────────────────
emp_users_other = user_items(search(emp, "05ACT"))
check("Employee không tìm thấy nhân sự khác", len(emp_users_other) == 0, emp_users_other)

# /admin/policy-doc, /admin/org-tree, /admin/teams là màn hình dùng chung (ALL_ROLES).
SHARED_ADMIN = ("/admin/policy-doc", "/admin/org-tree", "/admin/teams")
for q in ["cau hinh", "rule engine", "nhan vien", "audit", "phong ban"]:
    found = urls(search(emp, q))
    leaked = [u for u in found if u.startswith("/admin/")
              and not u.startswith(SHARED_ADMIN)]
    check(f"Employee tìm '{q}' không lộ màn hình HR-only", not leaked, leaked)

for q in ["cau hinh", "rule engine", "nhan vien"]:
    found = urls(search(mgr, q))
    leaked = [u for u in found if u.startswith("/admin/")
              and not u.startswith(SHARED_ADMIN)]
    check(f"Manager tìm '{q}' không lộ màn hình HR-only", not leaked, leaked)

hr_rules = urls(search(hr, "cau hinh"))
check("HR tìm 'cau hinh' thấy Rule Engine", "/admin/rules" in hr_rules, hr_rules)

# ── 4. Hành động nhanh ──────────────────────────────────────────────────
emp_actions = {a.get("action"): a for a in actions(emp)}
check("Có SUBMIT_WFH", "SUBMIT_WFH" in emp_actions, list(emp_actions))
check("Có CHANGE_PASSWORD", "CHANGE_PASSWORD" in emp_actions, list(emp_actions))
check("SUBMIT_WFH trỏ /attendance/requests",
      emp_actions.get("SUBMIT_WFH", {}).get("url") == "/attendance/requests", emp_actions.get("SUBMIT_WFH"))
check("CHANGE_PASSWORD trỏ /account/profile",
      emp_actions.get("CHANGE_PASSWORD", {}).get("url") == "/account/profile", emp_actions.get("CHANGE_PASSWORD"))
check("Employee không có CONFIG_RULES", "CONFIG_RULES" not in emp_actions, list(emp_actions))

hr_actions = {a.get("action"): a for a in actions(hr)}
check("HR có CONFIG_RULES", "CONFIG_RULES" in hr_actions, list(hr_actions))
check("HR CONFIG_RULES trỏ /admin/rules",
      hr_actions.get("CONFIG_RULES", {}).get("url") == "/admin/rules", hr_actions.get("CONFIG_RULES"))

print("\nALL COMMAND PALETTE API CHECKS PASSED")
