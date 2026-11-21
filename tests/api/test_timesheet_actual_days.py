"""
Hồi quy: "Công thực tế" trên bảng công phải cộng các ô đang hiển thị trên lưới,
gồm cả ô HR sửa tay / duyệt khiếu nại (timesheet_cells) — không chỉ attendance_logs.

Lỗi cũ: lưới hiện 21 ô "1.00" nhưng actualDays = 2–3 vì API chỉ đếm log chấm công.
"""
import json, subprocess, sys, urllib.request

B = 'http://localhost:8080/api/v1'
MONTH = '2026-11'
EMP = '137ACT'
DAY = None  # chọn động: ngày làm việc đang có ô công trên lưới
orig = None


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
        print(f"FAIL {method} {path}: want {expect} got {code} {str(js)[:200]}")
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


def actual_days(hr, code=EMP):
    _, j = call('GET', f'/timesheets?month={MONTH}', hr, expect=200)
    row = next(r for r in j['data']['rows'] if r['employeeCode'] == code)
    return row


H = login('01HR')
uid = psql(f"select id from users where employee_code='{EMP}'")
sheet_id = psql(
    "select id from timesheets where user_id='{}' and period_month=11 and period_year=2026".format(uid))
check('có bảng công tháng 11/2026 cho 137ACT', bool(sheet_id), sheet_id)

try:
    base = actual_days(H)
    check('actualDays không vượt standardDays',
          base['actualDays'] <= base['standardDays'],
          f"actual={base['actualDays']} standard={base['standardDays']}")
    # Kỳ vọng tính từ chính lưới: cộng ô công của ngày làm việc (T2–T6, trừ ngày lễ).
    # Không hardcode 21 vì dữ liệu seed có thể bị các test/HR sửa ô.
    import datetime
    holidays = set(psql(
        "select to_char(holiday_date,'YYYY-MM-DD') from holidays "
        "where holiday_date between '2026-11-01' and '2026-11-30'").splitlines())

    def work_units(raw):
        s = (raw or '').replace('*', '').replace('?', '').strip()
        if not s:
            return 0.0
        if s.upper() == 'R':
            return 1.0
        if '/' in s:
            left, right = s.split('/', 1)
            return float(right) if left.upper() == 'R' and right.replace('.', '', 1).isdigit() else 0.0
        try:
            return float(s)
        except ValueError:
            return 0.0

    expected = sum(
        work_units(sym)
        for d, sym in base['days'].items()
        if datetime.date(2026, 11, int(d)).weekday() < 5
        and f'2026-11-{int(d):02d}' not in holidays)
    check('actualDays khớp tổng ô công trên lưới (ngày làm việc)',
          abs(base['actualDays'] - expected) < 1e-9,
          f"actual={base['actualDays']} expected={expected}")

    # Chọn một ô công THẬT trên lưới (timesheet_cells) để bỏ thử.
    for line in psql(
            "select to_char(work_date,'YYYY-MM-DD')||'|'||symbol from timesheet_cells "
            "where timesheet_id='{}' order by work_date".format(sheet_id)).splitlines():
        dt_s, sym = line.split('|', 1)
        dt = datetime.date.fromisoformat(dt_s)
        if dt.weekday() < 5 and dt_s not in holidays and work_units(sym) > 0:
            DAY, orig = dt_s, sym
            break
    check('tìm được ô công ngày làm việc để kiểm tra', DAY is not None, str(DAY))

    # Bỏ ô ngày DAY → công thực tế phải giảm đúng số ngày công của ô đó.
    drop = work_units(orig)
    psql("delete from timesheet_cells where timesheet_id='{}' and work_date='{}'".format(sheet_id, DAY))
    without = actual_days(H)
    check('bỏ ô công ngày làm việc → actualDays giảm đúng',
          abs(without['actualDays'] - (base['actualDays'] - drop)) < 1e-9,
          f"before={base['actualDays']} after={without['actualDays']} drop={drop}")

    psql("insert into timesheet_cells (timesheet_id, work_date, symbol) values ('{}','{}','{}')"
         .format(sheet_id, DAY, orig))
    restored = actual_days(H)
    check('khôi phục ô công → actualDays trở lại như cũ',
          abs(restored['actualDays'] - base['actualDays']) < 1e-9,
          f"want={base['actualDays']} got={restored['actualDays']}")
    print('\nALL TIMESHEET ACTUAL-DAYS TESTS PASSED')
finally:
    # Luôn trả dữ liệu về trạng thái ban đầu, kể cả khi test fail giữa chừng.
    if DAY:
        has = psql(
            "select count(*) from timesheet_cells where timesheet_id='{}' and work_date='{}'".format(sheet_id, DAY))
        if orig and has == '0':
            psql("insert into timesheet_cells (timesheet_id, work_date, symbol) values ('{}','{}','{}')"
                 .format(sheet_id, DAY, orig))


# --- Các cột tổng hợp phải khớp đúng ký hiệu trên lưới (và do đó file export cũng khớp) ---

def al_units(sym):
    s = str(sym or '').strip().upper()
    if s == 'AL':
        return 1.0
    if s.startswith('AL/'):
        try: return float(s[3:])
        except ValueError: return 0.0
    if s.endswith('/AL'):
        try: return float(s[:-3])
        except ValueError: return 0.0
    return 0.0


def code_count(sym, code):
    s = str(sym or '').strip().upper()
    return 1 if s == code else (0.5 if s in (code + '/0.50', code + '/0.5') else 0.0)


rows = call('GET', f'/timesheets?month={MONTH}', H, expect=200)[1]['data']['rows']
for r in rows:
    code = r['employeeCode']
    cells = list(r['days'].values())
    check(f'{code}: cột AL = số ô AL trên lưới',
          abs(sum(al_units(v) for v in cells) - r['leaveDays']) < 1e-9,
          f"leaveDays={r['leaveDays']} nhưng ô AL={sum(al_units(v) for v in cells)}")
    for col, sym in [('sickDays', 'S'), ('compDays', 'RO'), ('unpaidDays', 'UP'),
                     ('maternityDays', 'ML'), ('paternityDays', 'PL'), ('specialLeaveDays', 'CL')]:
        want = sum(code_count(v, sym) for v in cells)
        check(f'{code}: cột {col} = số ô {sym}', abs(want - r[col]) < 1e-9,
              f"{col}={r[col]} nhưng ô {sym}={want}")

# Hồi quy đếm trùng: nghỉ ốm không được cộng vào phép năm.
r136 = next(r for r in rows if r['employeeCode'] == '136ACT')
check('136ACT: nghỉ ốm (S) không bị đếm trùng vào phép năm (AL)',
      r136['sickDays'] >= 1 and r136['leaveDays'] == 0.0,
      f"sick={r136['sickDays']} leaveDays={r136['leaveDays']}")
base_leave = next(r for r in rows if r['employeeCode'] == '137ACT')['remainingLeave']
check('136ACT: phép còn lại không bị trừ vì ngày nghỉ ốm',
      r136['remainingLeave'] == base_leave,
      f"remainingLeave={r136['remainingLeave']} base={base_leave}")

print('\nALL TIMESHEET SUMMARY-COLUMN TESTS PASSED')
