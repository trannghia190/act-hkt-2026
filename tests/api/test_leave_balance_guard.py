"""Kiểm tra chặn gửi đơn nghỉ phép năm khi không đủ quỹ phép.

Quy tắc: chỉ loại nghỉ có deducts_annual_leave=TRUE (mặc định là AL) mới bị chặn;
đơn nháp vẫn lưu được nhưng GỬI DUYỆT thì chặn; đơn đang chờ duyệt được "giữ chỗ"
(availableForLeave = remaining − pendingLeaveDays). Loại nghỉ chế độ (ốm, thai sản…)
không trừ phép năm nên gửi được bình thường.

Chạy: python3 tests/api/test_leave_balance_guard.py  (cần backend ở localhost:8080)
"""
import datetime
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request

B = os.environ.get('PULSE_API_BASE', 'http://localhost:8080/api/v1')
PREFIX = 'ZZ balance guard'


def call(method, path, token=None, body=None):
    req = urllib.request.Request(B + path, method=method)
    req.add_header('Content-Type', 'application/json')
    if token:
        req.add_header('Authorization', 'Bearer ' + token)
    data = json.dumps(body).encode() if body is not None else None
    try:
        r = urllib.request.urlopen(req, data=data, timeout=20)
        return r.status, json.loads(r.read() or b'{}')
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b'{}')


def ok(method, path, token=None, body=None):
    c, j = call(method, path, token, body)
    if c not in (200, 201):
        print(f"FAIL {method} {path}: HTTP {c} {str(j)[:300]}")
        sys.exit(1)
    return j


def must_fail(method, path, token=None, body=None, needle=''):
    c, j = call(method, path, token, body)
    if c in (200, 201):
        print(f"FAIL {method} {path}: expected error but got {c} {str(j)[:300]}")
        sys.exit(1)
    msg = str(j.get('message') or j.get('error') or j)
    if needle and needle.lower() not in msg.lower():
        print(f"FAIL {method} {path}: error message lacks '{needle}' — {msg[:300]}")
        sys.exit(1)
    return msg


def login(code):
    return ok('POST', '/auth/login', body={'employeeCodeOrEmail': code, 'password': '123456'})['data']['accessToken']


def check(name, cond, extra=''):
    print(('PASS ' if cond else 'FAIL ') + name + ((' — ' + str(extra)[:400]) if extra and not cond else ''))
    if not cond:
        sys.exit(1)


def psql(sql):
    return subprocess.run(
        ['psql', '-h', '127.0.0.1', '-U', subprocess.check_output(['whoami']).decode().strip(),
         '-d', 'pulse_db', '-tAc', sql], capture_output=True, text=True).stdout.strip()


def cleanup():
    psql("delete from requests where reason like 'ZZ balance guard%'")


def balance(token):
    return ok('GET', '/leaves/my-balance', token)['data']


def future_workday(holidays, offset=30):
    d = datetime.date.today() + datetime.timedelta(days=offset)
    while d.weekday() >= 5 or d.isoformat() in holidays:
        d += datetime.timedelta(days=1)
    return d


def leave_body(leave_type, start, end, reason, draft=False):
    return {'type': 'LEAVE', 'leaveType': leave_type, 'workDate': start.isoformat(),
            'endDate': end.isoformat(), 'reason': reason, 'payload': '{}', 'draft': draft}


cleanup()
H = login('01HR')
E = login('ACT0042')

holidays = {h.get('holidayDate') for h in ok('GET', '/admin/holidays', H)['data']}
day1 = future_workday(holidays, 30)
day2 = future_workday(holidays, 33)
huge_end = day1 + datetime.timedelta(days=400)

# ── 1. my-balance công bố số phép khả dụng để gửi đơn ─────────────────
b = balance(E)
check('my-balance có pendingLeaveDays + availableForLeave',
      'pendingLeaveDays' in b and 'availableForLeave' in b, list(b.keys()))
remaining = float(b.get('remaining') or 0)
pending = float(b.get('pendingLeaveDays') or 0)
available = float(b.get('availableForLeave') or 0)
check('availableForLeave = remaining − pending, không âm',
      abs(available - max(0.0, remaining - pending)) < 1e-9 and available >= 0,
      {'remaining': remaining, 'pending': pending, 'available': available})

# ── 2. Đơn vượt quỹ phép năm bị chặn khi GỬI ──────────────────────────
msg = must_fail('POST', '/requests', E, leave_body('AL', day1, huge_end, PREFIX + ' vượt quỹ'), 'Không đủ ngày phép')
check('Đơn AL vượt quỹ bị chặn với thông báo rõ ràng', 'Không đủ ngày phép' in msg, msg)

# ── 3. Đơn nháp vẫn lưu được, nhưng GỬI DUYỆT đơn nháp đó thì chặn ─────
draft = ok('POST', '/requests', E, leave_body('AL', day1, huge_end, PREFIX + ' nháp', draft=True))['data']
check('Đơn nháp vượt quỹ vẫn lưu được (không gửi quản lý)', draft.get('status') == 'DRAFT', draft.get('status'))
must_fail('POST', '/requests/' + draft['id'] + '/submit', E, None, 'Không đủ ngày phép')
check('Đơn nháp vượt quỹ không gửi duyệt được', True)
ok('POST', '/requests/' + draft['id'] + '/withdraw', E)
check('Đã dọn đơn nháp', True)

# ── 4. Loại nghỉ không trừ phép năm (ốm) gửi được dù quỹ phép thấp ────
sick = ok('POST', '/requests', E, leave_body('S', day2, day2 + datetime.timedelta(days=2), PREFIX + ' ốm'))['data']
check('Nghỉ ốm (không trừ phép năm) vẫn gửi được', sick.get('status') == 'PENDING_APPROVAL', sick.get('status'))
ok('POST', '/requests/' + sick['id'] + '/withdraw', E)

# ── 5. Đơn đang chờ duyệt được giữ chỗ + đơn kế tiếp bị chặn ──────────
if available >= 1:
    one_day = ok('POST', '/requests', E, leave_body('AL', day1, day1, PREFIX + ' chờ duyệt'))['data']
    b2 = balance(E)
    check('Đơn đang chờ duyệt làm giảm số phép khả dụng',
          float(b2.get('pendingLeaveDays') or 0) >= 1
          and float(b2.get('availableForLeave') or 0) <= available - 1 + 1e-9,
          {'before': available, 'after': b2.get('availableForLeave'), 'pending': b2.get('pendingLeaveDays')})
    msg2 = must_fail('POST', '/requests', E, leave_body('AL', day2, huge_end, PREFIX + ' sau đơn chờ'), 'Không đủ ngày phép')
    check('Đơn vượt quỹ sau khi trừ đơn chờ bị chặn, nêu rõ đơn chờ duyệt',
          'chờ duyệt' in msg2, msg2)
    ok('POST', '/requests/' + one_day['id'] + '/withdraw', E)
    b3 = balance(E)
    check('Rút đơn chờ duyệt trả lại số phép khả dụng',
          abs(float(b3.get('availableForLeave') or 0) - available) < 1e-9,
          {'expected': available, 'actual': b3.get('availableForLeave')})
else:
    must_fail('POST', '/requests', E, leave_body('AL', day1, day1, PREFIX + ' hết phép'), 'Đã hết ngày phép')
    check('Đã hết ngày phép → chặn với thông báo "Đã hết ngày phép"', True)

cleanup()
print('ALL PASS — leave balance guard')
