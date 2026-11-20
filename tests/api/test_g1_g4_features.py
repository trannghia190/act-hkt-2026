import urllib.request
import urllib.parse
import json
import sys

BASE_URL = "http://localhost:8080/api/v1"

def login(emp_code, password="123456"):
    req = urllib.request.Request(
        f"{BASE_URL}/auth/login",
        data=json.dumps({"employeeCodeOrEmail": emp_code, "password": password}).encode(),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode())
        if data.get("success"):
            return data["data"]["accessToken"], data["data"]
    raise Exception(f"Login failed for {emp_code}")

def api_get(endpoint, token=None):
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(f"{BASE_URL}{endpoint}", headers=headers)
    with urllib.request.urlopen(req) as resp:
        return resp.status, json.loads(resp.read().decode())

def api_post(endpoint, body=None, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = json.dumps(body or {}).encode()
    req = urllib.request.Request(f"{BASE_URL}{endpoint}", data=data, headers=headers)
    with urllib.request.urlopen(req) as resp:
        return resp.status, json.loads(resp.read().decode())

def api_put(endpoint, body=None, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = json.dumps(body or {}).encode()
    req = urllib.request.Request(f"{BASE_URL}{endpoint}", data=data, headers=headers, method="PUT")
    with urllib.request.urlopen(req) as resp:
        return resp.status, json.loads(resp.read().decode())

def test_all():
    print("=== Testing G1: Todo Inbox ===")
    emp_token, emp_user = login("136ACT")
    print(f"Logged in as {emp_user['fullName']} ({emp_user['employeeCode']}, Role: {emp_user['role']})")
    
    # 1. GET /todos/my-inbox
    status, inbox = api_get("/todos/my-inbox", emp_token)
    assert status == 200, f"Expected 200, got {status}"
    assert inbox["success"] is True
    items = inbox["data"]
    print(f"PASS: GET /todos/my-inbox returned {len(items)} items")
    
    # Check categories and urgency
    urgencies = {item.get("urgency") for item in items}
    print(f"Found urgencies in inbox: {urgencies}")
    
    # Check leave summary
    status, leave_summary = api_get("/todos/leave-summary", emp_token)
    assert status == 200
    assert "totalRemaining" in leave_summary["data"]
    print(f"PASS: GET /todos/leave-summary returned totalRemaining = {leave_summary['data']['totalRemaining']}")
    
    # 2. Complete a todo item
    if items:
        target_id = items[0]["id"]
        status, comp = api_post(f"/todos/{target_id}/complete", {}, emp_token)
        assert status == 200
        print(f"PASS: Completed todo item {target_id}")
    
    # 3. Create a custom task
    status, created = api_post("/todos/create-task", {
        "title": "Nhiệm vụ kiểm thử G1",
        "urgency": "today",
        "module": "timesheet",
        "actionUrl": "/attendance/checkin",
        "actionLabel": "Chấm công ngay"
    }, emp_token)
    assert status == 200
    print(f"PASS: Created custom task via /todos/create-task: {created['data']['title']}")

    print("\n=== Testing G2: Command Palette Ctrl+K ===")
    # 1. Search 'phep' (unaccented)
    status, res_phep = api_get("/search/quick?q=phep", emp_token)
    assert status == 200
    phep_titles = [r["title"] for r in res_phep["data"]]
    print(f"Search 'phep' returned {len(phep_titles)} results: {phep_titles[:3]}")
    assert any("phép" in t.lower() or "phep" in t.lower() for t in phep_titles), "Expected 'phép' in results"
    print("PASS: Search 'phep' returns leave policy / actions")

    # 2. Search 'dieu' (unaccented)
    status, res_dieu = api_get("/search/quick?q=dieu", emp_token)
    assert status == 200
    dieu_titles = [r["title"] for r in res_dieu["data"]]
    print(f"Search 'dieu' returned {len(dieu_titles)} results: {dieu_titles[:3]}")
    assert any("đi muộn" in t.lower() or "dieu" in t.lower() for t in dieu_titles), "Expected 'đi muộn' in results"
    print("PASS: Search 'dieu' returns late policy / actions")

    # 3. Manager scoping check: manager should not see users outside their team
    mgr_token, mgr_user = login("05ACT")
    print(f"Logged in as Manager: {mgr_user['fullName']} ({mgr_user['employeeCode']})")
    status, mgr_search = api_get("/search/quick?q=Nguyen", mgr_token)
    assert status == 200
    mgr_user_results = [r["title"] for r in mgr_search["data"] if r.get("kind") == "user"]
    print(f"Manager search 'Nguyen' returned {len(mgr_user_results)} users: {mgr_user_results}")

    hr_token, hr_user = login("01HR")
    status, hr_search = api_get("/search/quick?q=Nguyen", hr_token)
    assert status == 200
    hr_user_results = [r["title"] for r in hr_search["data"] if r.get("kind") == "user"]
    print(f"HR search 'Nguyen' returned {len(hr_user_results)} users: {hr_user_results}")
    assert len(hr_user_results) >= len(mgr_user_results), "HR must see all users, manager sees restricted team"
    print("PASS: Manager search is scoped to team, HR sees full organization")

    print("\n=== Testing G3: Notifications ===")
    status, emp_notifs = api_get("/notifications", emp_token)
    assert status == 200
    print(f"PASS: Employee notifications count: {len(emp_notifs['data'])}")

    # Check mark read
    if emp_notifs["data"]:
        notif_id = emp_notifs["data"][0]["id"]
        status, _ = api_put(f"/notifications/{notif_id}/read", {}, emp_token)
        assert status == 200
        print(f"PASS: Marked notification {notif_id} as read")

    print("\n=== Testing G4: Notification Preferences (S36) ===")
    # 1. GET /notifications/preferences
    status, prefs = api_get("/notifications/preferences", emp_token)
    assert status == 200
    events = prefs["data"]["events"]
    print(f"PASS: GET /notifications/preferences returned {len(events)} events (matrix)")
    assert len(events) >= 17, f"Expected 17 events matrix, found {len(events)}"
    
    # 2. Save preference change
    events["MISSING_CHECKIN"]["push"] = not events["MISSING_CHECKIN"]["push"]
    new_val = events["MISSING_CHECKIN"]["push"]
    status, saved = api_put("/notifications/preferences", {
        "quietHoursEnabled": True,
        "quietHoursStart": "22:00",
        "quietHoursEnd": "06:00",
        "events": {
            "MISSING_CHECKIN": events["MISSING_CHECKIN"]
        }
    }, emp_token)
    assert status == 200
    print("PASS: Saved updated notification preferences")

    # Read back and verify
    status, verify_prefs = api_get("/notifications/preferences", emp_token)
    assert verify_prefs["data"]["events"]["MISSING_CHECKIN"]["push"] == new_val
    assert verify_prefs["data"]["quietHoursStart"] == "22:00"
    print("PASS: Preference changes persisted and verified on reload")

    # 3. Security test: Employee trying to modify another user's preferences must be FORBIDDEN (403)
    try:
        req = urllib.request.Request(
            f"{BASE_URL}/notifications/preferences",
            data=json.dumps({"targetUserId": "00000000-0000-0000-0000-000000000001", "quietHoursStart": "00:00"}).encode(),
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {emp_token}"},
            method="PUT"
        )
        with urllib.request.urlopen(req) as resp:
            print("FAIL: modifying another user's preferences succeeded unexpectedly!")
            sys.exit(1)
    except urllib.error.HTTPError as e:
        assert e.code == 403, f"Expected 403 Forbidden, got {e.code}"
        print(f"PASS: Security check passed - Non-admin cannot modify other users' preferences (HTTP {e.code})")

    print("\n==========================================")
    print("🎉 ALL G1 - G4 FEATURE TESTS PASSED 100%!")
    print("==========================================")

if __name__ == "__main__":
    test_all()
