"""Ca làm việc theo LUẬT + ƯU TIÊN (S26).

Kịch bản:
1. Ca chuẩn không tắt được, không xóa được; ca ngoại lệ tắt/mở/xóa được.
2. Ca ngoại lệ khớp theo nhóm, chức danh hoặc mã nhân viên cụ thể.
3. Một người khớp nhiều ca → ca ở DƯỚI CÙNG danh sách (priority lớn nhất) thắng.
4. Đổi thứ tự bằng API order → người khớp lại nhận ca mới ở dưới cùng.
5. Danh sách loại trừ: nhân viên bị loại khỏi ca A sẽ rơi về ca ưu tiên thấp hơn / ca chuẩn.
6. Tắt ca → nhân sự rơi về ca còn lại hoặc ca chuẩn.
"""
import json, urllib.request, urllib.error, sys, subprocess

B = 'http://localhost:8080/api/v1'
HR_CODE = '01HR'
EMP_CODE = '137ACT'
A, BCODE, C, D = 'SHIFT_T_A', 'SHIFT_T_B', 'SHIFT_T_C', 'SHIFT_T_D'


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


def cleanup():
    codes = ','.join(f"'{c}'" for c in (A, BCODE, C, D))
    psql(f"update users set shift_id=(select id from shifts where code='SHIFT_STANDARD') "
         f"where shift_id in (select id from shifts where code in ({codes}))")
    psql(f"delete from shifts where code in ({codes})")


def shift_body(code, name, ci_start='09:00:00', **extra):
    body = {
        'code': code, 'name': name,
        'checkInStart': ci_start, 'checkInEnd': '11:00:00',
        'checkOutStart': '16:00:00', 'checkOutEnd': '18:00:00',
        'lunchBreakStart': '12:00:00', 'lunchBreakEnd': '13:00:00',
        'requiredWorkHours': 6, 'isActive': True, 'isFlexible': False,
        'isException': True, 'requiresHrApproval': True,
        'geofenceRadiusM': 150, 'ipRanges': '10.0.0.0/8',
        'targetGroup': '', 'targetPosition': '', 'targetEmployees': '', 'excludeEmployees': '',
    }
    body.update(extra)
    return body


def my_shift(emp_token):
    _, j = call('GET', '/attendance/my-shift', emp_token, expect=200)
    return j['data']


def list_shifts(hr):
    _, j = call('GET', '/admin/shifts', hr, expect=200)
    return [s['code'] for s in j['data']]


cleanup()
HR = login(HR_CODE)
E = login(EMP_CODE)
uid = psql(f"select id from users where employee_code='{EMP_CODE}'")
team = psql(f"select t.name from users u join teams t on t.id=u.team_id where u.id='{uid}'")
position = psql(f"select coalesce(position_name,'') from users where id='{uid}'")
old_shift = psql(f"select coalesce(shift_id::text,'') from users where id='{uid}'")
psql(f"update users set shift_id=null where id='{uid}'")

try:
    # ── 1. Ca chuẩn không tắt/xóa được ──────────────────────────────────────
    _, j = call('GET', '/admin/shifts', HR, expect=200)
    std = next(s for s in j['data'] if s['code'] == 'SHIFT_STANDARD')
    code, j = call('DELETE', '/admin/shifts/SHIFT_STANDARD', HR)
    check('1. Không xóa được ca chuẩn', code == 400 and 'không thể xóa' in (j.get('message') or ''), f'{code} {j}')
    body = dict(std); body['isActive'] = False
    _, j = call('PUT', '/admin/shifts/SHIFT_STANDARD', HR, body, expect=200)
    check('1b. Không tắt được ca chuẩn', j['data']['isActive'] is True, str(j['data'])[:200])

    # ── 2. Tạo 2 ca cùng nhắm một nhóm ──────────────────────────────────────
    call('POST', '/admin/shifts', HR, shift_body(A, 'Ca Test A', targetGroup=team), expect=200)
    call('POST', '/admin/shifts', HR, shift_body(BCODE, 'Ca Test B', '10:00:00', targetGroup=team), expect=200)
    order = list_shifts(HR)
    check('2. Ca mới nằm cuối danh sách, ca chuẩn đứng đầu',
          order[0] == 'SHIFT_STANDARD' and order.index(A) < order.index(BCODE), str(order))
    check('2b. Khớp nhóm — ca dưới cùng (B) thắng', my_shift(E)['code'] == BCODE, str(my_shift(E))[:200])

    # ── 3. Đổi thứ tự: A xuống dưới → A thắng ───────────────────────────────
    _, j = call('PUT', '/admin/shifts/order', HR, {'codes': [BCODE, A]}, expect=200)
    order = [s['code'] for s in j['data']]
    check('3. API order xếp lại danh sách', order.index(BCODE) < order.index(A), str(order))
    check('3b. Đổi thứ tự → ca dưới cùng (A) thắng', my_shift(E)['code'] == A, str(my_shift(E))[:200])

    # ── 4. Loại trừ nhân viên khỏi ca A → rơi về B ──────────────────────────
    a = call('GET', '/admin/shifts', HR, expect=200)[1]['data']
    a = next(s for s in a if s['code'] == A)
    a['excludeEmployees'] = EMP_CODE
    call('PUT', f'/admin/shifts/{A}', HR, a, expect=200)
    check('4. Nhân viên bị loại trừ khỏi ca A rơi về ca B', my_shift(E)['code'] == BCODE, str(my_shift(E))[:200])

    # ── 5. Xóa ca ───────────────────────────────────────────────────────────
    call('DELETE', f'/admin/shifts/{A}', HR, expect=200)
    check('5. Xóa ca A → còn ca B', my_shift(E)['code'] == BCODE, str(my_shift(E))[:200])
    call('DELETE', f'/admin/shifts/{BCODE}', HR, expect=200)
    check('5b. Xóa hết ca ngoại lệ → về ca chuẩn', my_shift(E)['code'] == 'SHIFT_STANDARD'
          and my_shift(E)['assigned'] is False, str(my_shift(E))[:200])

    # ── 6. Khớp theo mã nhân viên và theo chức danh ─────────────────────────
    call('POST', '/admin/shifts', HR, shift_body(C, 'Ca Test C', '09:00:00', targetEmployees=EMP_CODE), expect=200)
    check('6. Khớp chính xác mã nhân viên', my_shift(E)['code'] == C, str(my_shift(E))[:200])
    call('POST', '/admin/shifts', HR, shift_body(D, 'Ca Test D', '10:00:00', targetPosition=position), expect=200)
    check('6b. Khớp chức danh — ca D ở dưới cùng thắng', my_shift(E)['code'] == D, str(my_shift(E))[:200])

    # ── 7. Tắt ca D → rơi về C ──────────────────────────────────────────────
    d = next(s for s in call('GET', '/admin/shifts', HR, expect=200)[1]['data'] if s['code'] == D)
    d['isActive'] = False
    call('PUT', f'/admin/shifts/{D}', HR, d, expect=200)
    check('7. Tắt ca D → nhân sự rơi về ca C', my_shift(E)['code'] == C, str(my_shift(E))[:200])
    d['isActive'] = True
    call('PUT', f'/admin/shifts/{D}', HR, d, expect=200)
    check('7b. Bật lại ca D → D lại thắng', my_shift(E)['code'] == D, str(my_shift(E))[:200])

    # ── 8. Người không khớp luật nào → ca chuẩn ─────────────────────────────
    other = psql("select employee_code from users where employee_code<>'%s' and role='EMPLOYEE' "
                 "and status='ACTIVE' limit 1" % EMP_CODE)
    if other:
        call('DELETE', f'/admin/shifts/{C}', HR, expect=200)
        call('DELETE', f'/admin/shifts/{D}', HR, expect=200)
        OE = login(other)
        check('8. Nhân sự không khớp luật ca nào → ca chuẩn', my_shift(OE)['code'] == 'SHIFT_STANDARD',
              str(my_shift(OE))[:200])
    print('\nALL SHIFT-RULES-PRIORITY TESTS PASSED')
finally:
    cleanup()
    psql(f"update users set shift_id={'null' if not old_shift else repr(old_shift)} where id='{uid}'")
