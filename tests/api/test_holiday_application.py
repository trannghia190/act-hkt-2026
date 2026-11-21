"""Kiểm tra cấu hình ngày lễ (1 ngày + nhiều ngày) được áp dụng thật vào:
   lịch công cá nhân, đơn nghỉ phép (trừ quỹ), WFH quota, bảng công HR S15, và khi xóa lễ thì trả lại ngày làm việc.
   Chạy: python3 tests/api/test_holiday_application.py
"""
import json, urllib.request, urllib.error, sys, subprocess

B = 'http://localhost:8080/api/v1'
HOLIDAY_NAME = 'ZZ Holiday Apply 2027'
LEAVE_START, LEAVE_END = '2027-01-04', '2027-01-08'   # Mon–Fri
HOL_START, HOL_END = '2027-01-05', '2027-01-07'       # Tue–Thu (3 ngày)
MONTH = '2027-01'


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
    c, j = call('POST', '/auth/login', body={'employeeCodeOrEmail': code, 'password': '123456'}, expect=200)
    return j['data']['accessToken']


def check(name, cond, extra=''):
    print(('PASS ' if cond else 'FAIL ') + name + ((' — ' + str(extra)[:400]) if extra and not cond else ''))
    if not cond:
        sys.exit(1)


def psql(sql):
    return subprocess.run(
        ['psql', '-h', '127.0.0.1', '-U', subprocess.check_output(['whoami']).decode().strip(),
         '-d', 'pulse_db', '-tAc', sql], capture_output=True, text=True).stdout.strip()


def cleanup():
    psql(f"delete from holidays where name='{HOLIDAY_NAME}'")
    psql("delete from requests where reason like 'ZZ holiday apply%'")
    psql("delete from leave_ledger where reason like 'Duyệt đơn nghỉ AL ngày 2027-01-04%'")


cleanup()
H = login('01HR')
E = login('137ACT')   # nhân viên nghỉ phép
W = login('138ACT')   # nhân viên WFH
E2 = login('ACT0042')  # nhân viên nghỉ trọn ngày lễ

# ── Thêm kỳ lễ 3 ngày 05–07/01/2027 ─────────────────────────────
c, j = call('POST', '/admin/holidays', H,
            {'name': HOLIDAY_NAME, 'holidayDate': HOL_START, 'endDate': HOL_END, 'isPaid': True}, expect=200)
check('Tạo kỳ lễ 3 ngày', j['data']['endDate'] == HOL_END)

# ── 1. Lịch công cá nhân ───────────────────────────────────────
c, j = call('GET', f'/attendance/my-timesheet?month={MONTH}', E, expect=200)
d = j['data']
hol_days = [x for x in d['days'] if x.get('isHoliday')]
check('Lịch cá nhân: holidayDays = 3', d.get('holidayDays') == 3, d.get('holidayDays'))
check('Lịch cá nhân: đủ 3 ngày 05–07/01 là NL', sorted(x['date'] for x in hol_days) ==
      ['2027-01-05', '2027-01-06', '2027-01-07'], [x['date'] for x in hol_days])
check('Lịch cá nhân: ngày lễ gắn ký hiệu NL', all(x['symbol'] == 'NL' for x in hol_days))
check('Lịch cá nhân: standardDays loại ngày lễ (21−3=18)', d.get('standardDays') == 18, d.get('standardDays'))

# ── 2. Đơn nghỉ phép 04–08/01 chỉ tính 2 ngày làm việc ─────────
c, j = call('POST', '/requests', E, {'type': 'LEAVE', 'leaveType': 'AL',
                                     'workDate': LEAVE_START, 'endDate': LEAVE_END,
                                     'reason': 'ZZ holiday apply leave', 'payload': '{}'})
check('Tạo đơn nghỉ 5 ngày lịch', c in (200, 201), str(j)[:200])
leave_id = j['data']['id']
c, j = call('GET', f'/requests/{leave_id}', E, expect=200)
check('Đơn nghỉ trừ đúng 2 ngày làm việc (bỏ 3 ngày lễ)', j['data']['durationText'] == '2.0 ngày làm việc',
      j['data']['durationText'])
call('POST', f'/requests/{leave_id}/approve', H, {'comment': 'ZZ holiday apply'}, expect=200)
ledger = psql("select coalesce(sum(amount),0) from leave_ledger where user_id="
              "(select id from users where employee_code='137ACT') "
              "and reason like 'Duyệt đơn nghỉ AL ngày 2027-01-04%'")
check('Duyệt đơn: quỹ phép chỉ trừ 2 ngày', float(ledger) == -2.0, ledger)

c, j = call('GET', f'/attendance/my-timesheet?month={MONTH}', E, expect=200)
days = {x['date']: x for x in j['data']['days']}
check('Bảng công: 04 & 08/01 là AL', days['2027-01-04']['symbol'].startswith('AL')
      and days['2027-01-08']['symbol'].startswith('AL'), [days['2027-01-04'], days['2027-01-08']])
check('Bảng công: ngày lễ không bị đè bởi đơn nghỉ',
      all(days[d0]['symbol'] == 'NL' for d0 in ('2027-01-05', '2027-01-06', '2027-01-07')),
      [days[d0] for d0 in ('2027-01-05', '2027-01-06', '2027-01-07')])

# ── 3. WFH: quota tuần tính ngày làm việc, bỏ ngày lễ ─────────
c, j = call('POST', '/requests', W, {'type': 'WFH', 'workDate': LEAVE_START, 'endDate': LEAVE_END,
                                     'reason': 'ZZ holiday apply wfh', 'payload': '{}'})
check('WFH 5 ngày lịch nhưng chỉ 2 ngày làm việc → không vượt quota 2/tuần', c in (200, 201), str(j)[:300])
wfh_id = j['data']['id']
c, j = call('GET', f'/requests/{wfh_id}', W, expect=200)
check('WFH hiển thị 2.0 ngày làm việc', j['data']['durationText'] == '2.0 ngày làm việc', j['data']['durationText'])
call('POST', f'/requests/{wfh_id}/approve', H, {'comment': 'ZZ holiday apply'}, expect=200)
c, j = call('GET', f'/attendance/my-timesheet?month={MONTH}', W, expect=200)
days = {x['date']: x for x in j['data']['days']}
check('Bảng công WFH: 04 & 08/01 là R', days['2027-01-04']['symbol'].startswith('R')
      and days['2027-01-08']['symbol'].startswith('R'), [days['2027-01-04'], days['2027-01-08']])
check('Bảng công WFH: 05–07/01 vẫn là NL', all(days[d0]['symbol'] == 'NL'
      for d0 in ('2027-01-05', '2027-01-06', '2027-01-07')))

# ── 3b. Đơn nghỉ rơi hoàn toàn vào ngày lễ → 0 ngày, không trừ quỹ ──
c, j = call('POST', '/requests', E2, {'type': 'LEAVE', 'leaveType': 'AL',
                                     'workDate': HOL_START, 'endDate': HOL_END,
                                     'reason': 'ZZ holiday apply leave2', 'payload': '{}'})
check('Tạo đơn nghỉ trọn ngày lễ 05–07/01', c in (200, 201), str(j)[:200])
leave2_id = j['data']['id']
c, j = call('GET', f'/requests/{leave2_id}', E2, expect=200)
check('Đơn nghỉ trọn ngày lễ = 0.0 ngày làm việc', j['data']['durationText'] == '0.0 ngày làm việc',
      j['data']['durationText'])
call('POST', f'/requests/{leave2_id}/approve', H, {'comment': 'ZZ holiday apply'}, expect=200)
ledger = psql("select coalesce(sum(amount),0) from leave_ledger where user_id="
              "(select id from users where employee_code='ACT0042') "
              "and reason like 'Duyệt đơn nghỉ AL ngày 2027-01-05%'")
check('Duyệt đơn trọn ngày lễ: không trừ quỹ phép', ledger in ('', '0'), ledger)
c, j = call('GET', f'/attendance/my-timesheet?month={MONTH}', E2, expect=200)
days = {x['date']: x for x in j['data']['days']}
check('Đơn trọn ngày lễ không đè ký hiệu NL', all(days[d0]['symbol'] == 'NL'
      for d0 in ('2027-01-05', '2027-01-06', '2027-01-07')))

# ── 4. Bảng công HR S15 ───────────────────────────────────────
c, j = call('GET', f'/timesheets?month={MONTH}', H, expect=200)
row = next((r for r in j['data']['rows'] if r.get('employeeCode') == '137ACT'), None)
check('S15 có dòng nhân viên', row is not None)
check('S15: standardDays trừ 3 ngày lễ (18)', row.get('standardDays') == 18, row.get('standardDays'))
check('S15: holidayDates trả đủ 3 ngày lễ để UI tô màu cột',
      sorted(j['data'].get('holidayDates') or []) == ['2027-01-05', '2027-01-06', '2027-01-07'],
      j['data'].get('holidayDates'))
grid = row.get('days') or row.get('daySymbols') or {}
cells = grid if isinstance(grid, dict) else {str(x.get('day')): x.get('symbol') for x in grid}
check('S15: ngày 05–07/01 ký hiệu NL',
      all(str(cells.get(str(d0))) == 'NL' or (isinstance(cells.get(str(d0)), dict) and cells[str(d0)].get('symbol') == 'NL')
          for d0 in (5, 6, 7)), {k: cells.get(k) for k in ('4', '5', '6', '7', '8')})
check('S15: ngày 04 & 08/01 là AL',
      all('AL' in str(cells.get(str(d0))) for d0 in (4, 8)), {k: cells.get(k) for k in ('4', '5', '6', '7', '8')})

# ── 5. Xóa ngày lễ → trả lại ngày làm việc ─────────────────────
hol_id = psql(f"select id from holidays where name='{HOLIDAY_NAME}'")
call('DELETE', f'/admin/holidays/{hol_id}', H, expect=200)
c, j = call('GET', f'/attendance/my-timesheet?month={MONTH}', E, expect=200)
d = j['data']
check('Sau khi xóa lễ: holidayDays = 0', d.get('holidayDays') == 0, d.get('holidayDays'))
check('Sau khi xóa lễ: standardDays trở lại 21', d.get('standardDays') == 21, d.get('standardDays'))

cleanup()
print('\nALL HOLIDAY APPLICATION CHECKS PASSED')
