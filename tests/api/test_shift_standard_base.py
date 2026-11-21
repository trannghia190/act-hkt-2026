"""Ca chuẩn SHIFT_STANDARD là BASE toàn công ty; ca khác là ngoại lệ đè lên (S26).

Kịch bản:
1. Luôn tồn tại ca SHIFT_STANDARD "Ca Chuẩn Văn Phòng", active, không phải ca ngoại lệ.
2. Sửa ca chuẩn KHÔNG thể tắt / biến thành ngoại lệ (backend ép lại) — nhưng vẫn sửa được giờ.
3. Nhân sự chưa gán ca (shift_id null) → my-shift trả ca chuẩn, isBase=true.
4. Không cần "áp ca" cho ca chuẩn — gọi assign trả lỗi 400.
5. Ca ngoại lệ áp cho nhóm → người trong nhóm nhận ca ngoại lệ (đè ca chuẩn),
   "Bỏ áp ca" đưa họ về ca chuẩn.
"""
import json, urllib.request, urllib.error, sys, subprocess

B = 'http://localhost:8080/api/v1'


def call(method, path, token=None, body=None, expect=None):
    req = urllib.request.Request(B + path, method=method)
    req.add_header('Content-Type', 'application/json')
    if token:
        req.add_header('Authorization', 'Bearer ' + token)
    data = json.dumps(body).encode() if body is not None else None
    try:
        r = urllib.request.urlopen(req, data=data, timeout=20)
        code, js = r.status, json.loads(r.read() or b'{}')
    except urllib.error.HTTPError as e:
        code, js = e.code, json.loads(e.read() or b'{}')
    if expect and code != expect:
        print(f"FAIL {method} {path}: want {expect} got {code} {str(js)[:300]}")
        sys.exit(1)
    return code, js


def login(code):
    _, j = call('POST', '/auth/login', body={'employeeCodeOrEmail': code, 'password': '123456'}, expect=200)
    return j['data']['accessToken']


def check(name, cond, extra=''):
    print(('PASS ' if cond else 'FAIL ') + name + (' ' + extra if extra and not cond else ''))
    if not cond:
        sys.exit(1)


def psql(sql):
    return subprocess.run(['psql', '-h', '127.0.0.1', '-p', '5432', '-U',
                           subprocess.check_output(['whoami']).decode().strip(),
                           '-d', 'pulse_db', '-tAc', sql], capture_output=True, text=True).stdout.strip()


HR = login('01HR')
EMP_CODE = '137ACT'
E = login(EMP_CODE)

# ── 1. Ca chuẩn luôn tồn tại & là base ──────────────────────────────────────
_, j = call('GET', '/admin/shifts', HR, expect=200)
std = next((s for s in j['data'] if s['code'] == 'SHIFT_STANDARD'), None)
check('1. Có ca SHIFT_STANDARD "Ca Chuẩn Văn Phòng"', std is not None
      and std['name'] == 'Ca Chuẩn Văn Phòng', str(std))
check('1b. Ca chuẩn đang active và không phải ngoại lệ',
      std['isActive'] is True and std['isException'] is False, str(std))

# ── 2. Sửa ca chuẩn: ép active, không cho thành ngoại lệ ────────────────────
payload = dict(std)
payload.update({'isActive': False, 'isException': True})
_, j = call('PUT', '/admin/shifts/SHIFT_STANDARD', HR, payload, expect=200)
check('2. Sửa ca chuẩn không tắt được và không thành ca ngoại lệ',
      j['data']['isActive'] is True and j['data']['isException'] is False, str(j['data'])[:200])

# ── 3. Chưa gán ca → rơi về ca chuẩn ────────────────────────────────────────
uid = psql(f"select id from users where employee_code='{EMP_CODE}'")
old_shift = psql(f"select coalesce(shift_id::text,'') from users where id='{uid}'")
psql(f"update users set shift_id=null where id='{uid}'")
try:
    _, j = call('GET', '/attendance/my-shift', E, expect=200)
    check('3. Nhân sự chưa gán ca nhận ca chuẩn toàn công ty',
          j['data'].get('code') == 'SHIFT_STANDARD' and j['data'].get('isBase') is True
          and j['data'].get('assigned') is False, str(j['data'])[:200])
finally:
    psql(f"update users set shift_id={'null' if not old_shift else repr(old_shift)} where id='{uid}'")

# ── 4. Ca chuẩn không cần "áp ca" ───────────────────────────────────────────
code, j = call('POST', '/admin/shifts/SHIFT_STANDARD/assign', HR)
check('4. Áp ca cho ca chuẩn bị chặn (mặc định toàn công ty)',
      code == 400 and 'mặc định' in (j.get('message') or ''), f'{code} {j}')

# ── 5. Ca ngoại lệ đè ca chuẩn, bỏ áp → về ca chuẩn ────────────────────────
team = psql(f"select t.name from users u join teams t on t.id=u.team_id where u.id='{uid}'")
test_code = 'SHIFT_TEST_EXC'
psql(f"delete from shifts where code='{test_code}'")
exc_body = {
    'code': test_code, 'name': 'Ca Test Ngoại Lệ',
    'checkInStart': '09:00:00', 'checkInEnd': '10:00:00',
    'checkOutStart': '16:00:00', 'checkOutEnd': '17:00:00',
    'lunchBreakStart': '12:00:00', 'lunchBreakEnd': '13:00:00',
    'requiredWorkHours': 6, 'isActive': True, 'isFlexible': False,
    'isException': True, 'requiresHrApproval': True,
    'geofenceRadiusM': 150, 'ipRanges': '10.0.0.0/8', 'targetGroup': team, 'targetPosition': '',
}
call('POST', '/admin/shifts', HR, exc_body, expect=200)
try:
    _, j = call('POST', f'/admin/shifts/{test_code}/assign', HR, expect=200)
    check('5. Áp ca ngoại lệ cho nhóm', j['data']['assigned'] >= 1, str(j['data']))

    _, j = call('GET', '/attendance/my-shift', E, expect=200)
    check('5b. Nhân sự trong nhóm nhận ca ngoại lệ (đè ca chuẩn)',
          j['data'].get('code') == test_code and j['data'].get('assigned') is True
          and j['data'].get('isBase') is False, str(j['data'])[:200])

    _, j = call('POST', f'/admin/shifts/{test_code}/unassign', HR, expect=200)
    check('5c. Bỏ áp ca ngoại lệ', j['data']['reverted'] >= 1, str(j['data']))

    _, j = call('GET', '/attendance/my-shift', E, expect=200)
    check('5d. Bỏ áp ca → nhân sự về ca chuẩn',
          j['data'].get('code') == 'SHIFT_STANDARD' and j['data'].get('isBase') is True
          and j['data'].get('assigned') is False, str(j['data'])[:200])
finally:
    psql(f"update users set shift_id=(select id from shifts where code='SHIFT_STANDARD') "
         f"where shift_id=(select id from shifts where code='{test_code}')")
    psql(f"delete from shifts where code='{test_code}'")

print('\nALL SHIFT-STANDARD-BASE TESTS PASSED')
