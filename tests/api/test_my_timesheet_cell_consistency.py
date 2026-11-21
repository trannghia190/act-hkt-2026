"""
Hồi quy: bảng công cá nhân (S11 — /attendance/my-timesheet) và bảng công HR
(S15 — /timesheets) phải hiển thị CÙNG ký hiệu cho cùng một ngày, kể cả khi ô đó
được ghi trong timesheet_cells (HR sửa tay hoặc duyệt khiếu nại).

Lỗi cũ: 05/11/2026 của 137ACT — bảng HR hiện 1.00 (đọc timesheet_cells) còn bảng
cá nhân hiện "V" (vắng) vì chỉ suy từ attendance_logs. Hai màn hình đọc 2 nguồn khác nhau.
"""
import datetime
import json
import subprocess
import sys
import urllib.error
import urllib.request

B = 'http://localhost:8080/api/v1'
MONTH = '2026-11'
EMP = '137ACT'
MUTATE_DAY = '2026-11-05'


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


def psql(sql):
    user = subprocess.check_output(['whoami']).decode().strip()
    return subprocess.run(
        ['psql', '-h', '127.0.0.1', '-p', '5432', '-U', user, '-d', 'pulse_db', '-tAc', sql],
        capture_output=True, text=True, check=True
    ).stdout.strip()


def check(name, cond, extra=''):
    print(('PASS ' if cond else 'FAIL ') + name + (f' — {extra}' if extra and not cond else ''))
    if not cond:
        sys.exit(1)


def grid_row(hr):
    _, j = call('GET', f'/timesheets?month={MONTH}', hr, expect=200)
    return next(r for r in j['data']['rows'] if r['employeeCode'] == EMP)


def my_sheet(token, code=EMP):
    _, j = call('GET', f'/attendance/my-timesheet?month={MONTH}&employeeCode={code}', token, expect=200)
    return j['data']


def is_weekend(day_iso):
    return datetime.date.fromisoformat(day_iso).weekday() >= 5


def int_syms(grid):
    return {int(d): (sym or '').strip() for d, sym in (grid.get('days') or {}).items()}


def compare(grid, mine, label):
    """Ô của lưới HR và ô của bảng cá nhân phải trùng nhau trên mọi ngày hiển thị."""
    grid_syms = {int(d): (sym or '').strip() for d, sym in (grid.get('days') or {}).items()}
    mine_syms = {int(d['day']): (d.get('symbol') or '').strip() for d in mine['days']}
    diffs = []
    for day, hr_sym in grid_syms.items():
        iso = f"{MONTH}-{int(day):02d}"
        if is_weekend(iso):
            continue  # lưới HR để trống cuối tuần, bảng cá nhân hiện "—"
        my_sym = mine_syms.get(day, '')
        if hr_sym == '' and my_sym in ('', '—'):
            continue
        if hr_sym != my_sym:
            diffs.append(f"{iso}: HR='{hr_sym}' vs cá nhân='{my_sym}'")
    check(f"{label}: ký hiệu từng ngày khớp giữa bảng HR và bảng cá nhân",
          not diffs, '; '.join(diffs[:6]))
    check(f"{label}: công thực tế khớp",
          abs(float(grid['actualDays']) - float(mine['actualDays'])) < 1e-9,
          f"HR={grid['actualDays']} cá nhân={mine['actualDays']}")
    check(f"{label}: ngày phép khớp",
          abs(float(grid['leaveDays']) - float(mine['leaveDays'])) < 1e-9,
          f"HR={grid['leaveDays']} cá nhân={mine['leaveDays']}")


hr = login('01HR')
emp = login(EMP)

uid = psql(f"select id from users where employee_code='{EMP}'")
sheet_id = psql(
    f"select id from timesheets where user_id='{uid}' and period_month=11 and period_year=2026")
check('có bảng công tháng 11/2026 cho 137ACT', bool(sheet_id), sheet_id)

# --- 1. Trạng thái hiện tại: ô 05/11 nằm trong timesheet_cells nên hai màn phải cùng hiện 1.00
grid = grid_row(hr)
mine = my_sheet(emp)
cell_day5 = psql(
    f"select symbol from timesheet_cells where timesheet_id='{sheet_id}' and work_date='{MUTATE_DAY}'")
check('05/11 có ô trong timesheet_cells (dữ liệu cho kịch bản)', bool(cell_day5), cell_day5)
compare(grid, mine, 'hiện trạng')
check('05/11 hiển thị đúng ô của timesheet_cells (1.00) ở cả hai màn',
      int_syms(grid).get(5) == '1.00'
      and next(d for d in mine['days'] if d['day'] == 5)['symbol'] == '1.00',
      f"HR={int_syms(grid).get(5)} cá nhân={next(d for d in mine['days'] if d['day'] == 5)['symbol']}")

# --- 2. HR sửa ô thành AL: hai màn phải cùng đổi, và ngày phép phải tăng đúng
orig = psql(
    f"select symbol from timesheet_cells where timesheet_id='{sheet_id}' and work_date='{MUTATE_DAY}'")
leave_before = float(my_sheet(emp)['leaveDays'])
try:
    psql(f"update timesheet_cells set symbol='AL' "
         f"where timesheet_id='{sheet_id}' and work_date='{MUTATE_DAY}'")
    grid2 = grid_row(hr)
    mine2 = my_sheet(emp)
    compare(grid2, mine2, 'sau khi HR sửa ô thành AL')
    check('ô 05/11 = AL ở cả hai màn',
          int_syms(grid2).get(5) == 'AL'
          and next(d for d in mine2['days'] if d['day'] == 5)['symbol'] == 'AL')
    check('ngày phép cá nhân tăng 1 khi ô 05/11 thành AL',
          abs(float(mine2['leaveDays']) - (leave_before + 1.0)) < 1e-9,
          f"trước={leave_before} sau={mine2['leaveDays']}")
finally:
    psql(f"update timesheet_cells set symbol='{orig}' "
         f"where timesheet_id='{sheet_id}' and work_date='{MUTATE_DAY}'")

# --- 3. Trả lại dữ liệu gốc: hai màn lại khớp nhau
compare(grid_row(hr), my_sheet(emp), 'sau khi hoàn nguyên')
print('OK — bảng công cá nhân và bảng công HR dùng chung một nguồn sự thật')
