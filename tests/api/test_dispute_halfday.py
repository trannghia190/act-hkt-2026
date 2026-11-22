"""Hồi quy: khiếu nại NỬA NGÀY (WFH/nghỉ) phải mang theo buổi NV chọn.

Lỗi cũ: modal khiếu nại không có thời lượng, nên HR duyệt "chuyển thành nghỉ"
luôn ra nghỉ CẢ NGÀY — NV xin nghỉ buổi sáng 0.5 công bị trừ 1 ngày phép.

Kịch bản: NV gửi khiếu nại requestedKind=LEAVE, requestedHalfDay=MORNING →
HR duyệt FIX → đơn LEAVE/APPROVED có payload buổi sáng, lưới HR và bảng cá
nhân cùng hiện AL/0.50, ngày phép chỉ tăng 0.5.
"""
import json
import subprocess
import sys
import urllib.error
import urllib.request
from datetime import date, timedelta

B = 'http://localhost:8080/api/v1'
E, H = '138ACT', '01HR'


def call(method, path, token=None, body=None, expect=None):
    req = urllib.request.Request(B + path, method=method)
    req.add_header('Content-Type', 'application/json')
    if token:
        req.add_header('Authorization', 'Bearer ' + token)
    try:
        r = urllib.request.urlopen(req, data=json.dumps(body).encode() if body is not None else None, timeout=20)
        code, js = r.status, json.loads(r.read() or b'{}')
    except urllib.error.HTTPError as e:
        code, js = e.code, json.loads(e.read() or b'{}')
    if expect and code != expect:
        print(f"FAIL {method} {path}: want {expect} got {code} {str(js)[:300]}")
        sys.exit(1)
    return code, js


def login(code):
    return call('POST', '/auth/login', body={'employeeCodeOrEmail': code, 'password': '123456'},
                expect=200)[1]['data']['accessToken']


def psql(sql):
    return subprocess.run(
        ['psql', '-h', '127.0.0.1', '-p', '5432', '-U', subprocess.check_output(['whoami']).decode().strip(),
         '-d', 'pulse_db', '-tAc', sql], capture_output=True, text=True).stdout.strip()


def check(name, cond, extra=''):
    print(('PASS ' if cond else 'FAIL ') + name + (f' — {extra}' if extra and not cond else ''))
    if not cond:
        sys.exit(1)


today = date.today()
MONTH = f"{today.year}-{today.month:02d}"
uid = psql(f"select id from users where employee_code='{E}'")

d = today - timedelta(days=1)
while True:
    iso = d.isoformat()
    free = (d.weekday() < 5 and d.month == today.month
            and psql(f"select count(*) from requests where user_id='{uid}' and work_date='{iso}'") == '0'
            and psql(f"select count(*) from attendance_logs where user_id='{uid}' and work_date='{iso}'") == '0')
    if free:
        break
    d -= timedelta(days=1)
day = d.isoformat()

emp, hr = login(E), login(H)


def cleanup():
    psql(f"delete from requests where user_id='{uid}' and work_date='{day}'")
    psql(f"delete from timesheet_cells tc using timesheets t where tc.timesheet_id=t.id "
         f"and t.user_id='{uid}' and t.period_month={today.month} and t.period_year={today.year} "
         f"and tc.work_date='{day}'")
    psql(f"delete from timesheet_disputes where user_id='{uid}' and work_date='{day}'")


try:
    _, j = call('POST', '/disputes', emp, {'workDate': day, 'reason': 'Nghỉ phép buổi sáng đi khám bệnh',
                                           'requestedKind': 'LEAVE', 'requestedLeaveType': 'AL',
                                           'requestedHalfDay': 'MORNING'}, expect=200)
    did = j['data']['id']
    check('1. Khiếu nại nửa ngày lưu buổi đã chọn', j['data'].get('requestedHalfDay') == 'MORNING',
          str(j['data'])[:200])

    call('POST', f'/disputes/{did}/resolve', hr,
         {'action': 'FIX', 'reason': 'Xác nhận phép buổi sáng theo đơn'}, expect=200)
    req = psql(f"select request_type||'|'||status||'|'||payload from requests "
               f"where user_id='{uid}' and work_date='{day}'")
    check('2. Đơn duyệt là AL/APPROVED, payload giữ buổi sáng',
          req.startswith('LEAVE|APPROVED') and 'MORNING' in req, req)

    _, j = call('GET', f'/timesheets?month={MONTH}', hr, expect=200)
    grid = next(r for r in j['data']['rows'] if r['employeeCode'] == E)
    cell = (grid.get('days') or {}).get(str(int(day[8:10])), '')
    check('3. Lưới HR hiện AL/0.50 cho buổi sáng', cell == 'AL/0.50', cell)

    _, j = call('GET', f'/attendance/my-timesheet?month={MONTH}&employeeCode={E}', emp, expect=200)
    mine = next(x for x in j['data']['days'] if x['day'] == int(day[8:10]))
    check('3b. Bảng công cá nhân cùng hiện AL/0.50', mine.get('symbol') == 'AL/0.50', mine.get('symbol'))

    check('4. Ngày phép chỉ tăng 0.5 (không trừ cả ngày)', abs(float(grid['leaveDays']) - 0.5) < 1e-9,
          grid['leaveDays'])
finally:
    cleanup()

print('OK — khiếu nại nửa ngày duyệt đúng buổi và trừ đúng 0.5 ngày phép')
