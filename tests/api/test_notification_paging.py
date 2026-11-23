#!/usr/bin/env python3
"""
Hộp thư thông báo phân trang + lọc phía server (S04 / CORE-NOTIF-01).

  1. Tạo 5 thông báo đánh dấu riêng → lọc theo từ khoá trả đúng 5.
  2. `size=2`: trang 0/1/2 trả 2/2/1, header X-Total-Count = 5, không trùng id,
     X-Has-More đúng.
  3. Quá trang cuối → rỗng, hasMore=false.
  4. `unread=true` lọc đúng; đánh dấu 1 đã đọc → còn 4.
  5. `eventKey` lọc đúng; `/notifications/unread-count` trả số nguyên.
  6. Dọn dữ liệu test.

Chạy (backend :8080, DB pulse_db):
  python3 tests/api/test_notification_paging.py
"""
import json
import subprocess
import sys
import time
import urllib.parse
import urllib.request

API = "http://localhost:8080/api/v1"
EMPLOYEE = "136ACT"
MARK = "ZZPAGING" + str(int(time.time()))
EVENT = "ZZ_PAGING_TEST"


def psql(sql):
    return subprocess.run(
        ["psql", "-h", "127.0.0.1", "-d", "pulse_db", "-tAc", sql],
        capture_output=True, text=True, check=True,
    ).stdout.strip()


def call(method, path, token=None, body=None):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(API + path, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, dict(r.headers), json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), json.loads(e.read() or b"{}")


def login(code):
    st, _, js = call("POST", "/auth/login", body={"employeeCodeOrEmail": code, "password": "123456"})
    assert st == 200, (code, st, js)
    return js["data"]["accessToken"]


def header(headers, name):
    for k, v in headers.items():
        if k.lower() == name.lower():
            return v
    return None


def check(name, cond, extra=""):
    print(("PASS " if cond else "FAIL ") + name + ("" if cond else " — " + str(extra)[:400]))
    if not cond:
        sys.exit(1)


token = login(EMPLOYEE)
created = []
title_prefix = "ZZ paging " + MARK

try:
    # ── 1. Tạo 5 thông báo đánh dấu ────────────────────────────────
    for i in range(5):
        st, _, js = call("POST", "/notifications", token, {
            "title": f"{title_prefix} #{i}",
            "content": f"Nội dung kiểm thử phân trang {MARK} #{i}",
            "type": "SYSTEM",
            "eventKey": EVENT,
            "priority": "LOW",
        })
        check(f"Tạo thông báo test #{i}", st == 200, js)
        created.append(js["data"]["id"])

    q = f"q={urllib.parse.quote(title_prefix)}&size=2"

    # ── 2. Phân trang ───────────────────────────────────────────────
    st, hs, js = call("GET", f"/notifications?{q}&page=0", token)
    check("Trang 0 trả 200", st == 200, js)
    check("Trang 0 có 2 mục", len(js["data"]) == 2, len(js["data"]))
    check("X-Total-Count = 5", header(hs, "X-Total-Count") == "5", header(hs, "X-Total-Count"))
    check("Trang 0 X-Has-More = true", header(hs, "X-Has-More") == "true", header(hs, "X-Has-More"))
    ids0 = [n["id"] for n in js["data"]]

    st, hs, js = call("GET", f"/notifications?{q}&page=1", token)
    check("Trang 1 có 2 mục", len(js["data"]) == 2, len(js["data"]))
    ids1 = [n["id"] for n in js["data"]]
    check("Hai trang không trùng id", not (set(ids0) & set(ids1)), (ids0, ids1))

    st, hs, js = call("GET", f"/notifications?{q}&page=2", token)
    check("Trang 2 có 1 mục", len(js["data"]) == 1, len(js["data"]))
    check("Trang 2 X-Has-More = false", header(hs, "X-Has-More") == "false", header(hs, "X-Has-More"))

    st, hs, js = call("GET", f"/notifications?{q}&page=3", token)
    check("Quá trang cuối → rỗng", len(js["data"]) == 0, len(js["data"]))
    check("Quá trang cuối hasMore=false", header(hs, "X-Has-More") == "false", header(hs, "X-Has-More"))

    # ── 3. Tìm kiếm + lọc eventKey ─────────────────────────────────
    st, _, js = call("GET", f"/notifications?eventKey={EVENT}&q={urllib.parse.quote(MARK)}&size=100", token)
    check("Lọc eventKey + q trả đủ 5", len(js["data"]) == 5, len(js["data"]))
    check("Tất cả đúng eventKey", all(n["eventKey"] == EVENT for n in js["data"]), js["data"][:1])

    # ── 4. Lọc chưa đọc + đánh dấu 1 đã đọc ────────────────────────
    st, _, js = call("GET", f"/notifications?unread=true&eventKey={EVENT}&q={urllib.parse.quote(MARK)}&size=100", token)
    check("Lọc unread=true trả 5", len(js["data"]) == 5, len(js["data"]))
    st, _, js = call("PUT", f"/notifications/{created[0]}/read", token)
    check("Đánh dấu 1 thông báo đã đọc", st == 200, js)
    st, _, js = call("GET", f"/notifications?unread=true&eventKey={EVENT}&q={urllib.parse.quote(MARK)}&size=100", token)
    check("Sau khi đọc, unread còn 4", len(js["data"]) == 4, len(js["data"]))
    st, _, js = call("GET", f"/notifications?eventKey={EVENT}&q={urllib.parse.quote(MARK)}&size=100", token)
    check("Lọc tất cả vẫn 5", len(js["data"]) == 5, len(js["data"]))

    # ── 5. Endpoint đếm chưa đọc ───────────────────────────────────
    st, _, js = call("GET", "/notifications/unread-count", token)
    check("unread-count trả số nguyên", st == 200 and isinstance(js["data"].get("count"), int), js)

    # ── 6. Page size bị chặn trên ──────────────────────────────────
    st, hs, js = call("GET", f"/notifications?q={urllib.parse.quote(title_prefix)}&size=9999", token)
    check("size=9999 bị chặn còn 100", header(hs, "X-Page-Size") == "100", header(hs, "X-Page-Size"))
finally:
    if created:
        ids = ",".join("'" + r + "'" for r in created)
        psql("delete from notifications where id in (" + ids + ")")
    psql("delete from notifications where event_key='" + EVENT + "' and title like 'ZZ paging %'")

print("\nALL NOTIFICATION PAGING CHECKS PASSED")
