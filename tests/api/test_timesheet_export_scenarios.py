"""
Seed đủ tình huống vào DB rồi kiểm tra số liệu nguồn của file xuất bảng công.

Bao phủ: log đủ/thiếu giờ, log cuối tuần/lễ, đơn AL trọn/ nửa ngày, AL nhiều tháng,
WFH trọn/nửa ngày + range, nghỉ ốm/chế độ/không lương/thai sản/PL/CL, đơn trùng ngày,
ô HR sửa tay đè lên log/đơn, ô nghỉ rơi vào cuối tuần, tháng 28 ngày.

Chạy: python3 tests/api/test_timesheet_export_scenarios.py
"""
import json, subprocess, sys, urllib.request

B = 'http://localhost:8080/api/v1'
MONTH = '2025-02'          # tháng 28 ngày, bắt đầu Thứ Bảy
UID = 'ff000000-0000-4000-8000-000000000001'
SHEET = 'ff100000-0000-4000-8000-000000000001'
EMP = 'ZZEXP01'
HOLIDAY = 'Export Test Holiday'
HOLIDAY_DATE = '2025-02-14'


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
        raise AssertionError(name)


def cleanup():
    psql(f"delete from timesheet_cells where timesheet_id='{SHEET}'")
    psql(f"delete from timesheets where id='{SHEET}'")
    psql(f"delete from requests where user_id='{UID}'")
    psql(f"delete from attendance_logs where user_id='{UID}'")
    psql(f"delete from users where id='{UID}'")
    psql(f"delete from holidays where name='{HOLIDAY}'")


def req(type_, date, leave=None, end=None, created=None, payload='{}'):
    lt = 'null' if leave is None else f"'{leave}'"
    ed = 'null' if end is None else f"'{end}'"
    psql(f"""insert into requests (user_id, request_type, leave_type, payload, work_date, end_date,
              reason, status, current_step, created_at)
              values ('{UID}','{type_}',{lt},'{payload}'::jsonb,'{date}',{ed},
                      'seed export scenario','APPROVED',1,'{created}')""")


def log(date, check_in, check_out):
    cin = 'null' if check_in is None else f"'{date} {check_in}'"
    cout = 'null' if check_out is None else f"'{date} {check_out}'"
    psql(f"""insert into attendance_logs (user_id, work_date, type, status, check_in_at, check_out_at, shift_id)
              values ('{UID}','{date}','CHECK_IN','VALID',{cin},{cout},'c0000000-0000-0000-0000-000000000001')""")


H = login('01HR')
cleanup()
try:
    # --- Nhân sự test (tên/chức vụ có dấu phẩy + ngoặc kép để thử CSV) ---
    psql(f"""insert into users (id, employee_code, full_name, email, password_hash, role, team_id,
              manager_id, shift_id, joined_date, status, position_name)
              select '{UID}','{EMP}','Nguyễn "Test", CSV & Export','zzexp01@test.local', password_hash,
                     'EMPLOYEE','b0000000-0000-0000-0000-000000000011',
                     'd0000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000001',
                     '2024-01-01','ACTIVE','QA "Lead", Export'
              from users where employee_code='05ACT'""")
    psql(f"""insert into timesheets (id, user_id, period_month, period_year, status)
              values ('{SHEET}','{UID}',2,2025,'draft')""")
    psql(f"delete from holidays where name='{HOLIDAY}' and holiday_date='{HOLIDAY_DATE}'")
    psql(f"insert into holidays (name, holiday_date, is_paid) values ('{HOLIDAY}','{HOLIDAY_DATE}',true)")

    # --- Log: đủ giờ, nửa giờ, cuối tuần, ngày lễ ---
    log('2025-02-03', '08:00', '17:00')   # bị đơn AL range đè
    log('2025-02-04', '09:00', '14:00')   # 4h net → 0.50
    log('2025-02-08', '08:00', '17:00')   # Thứ Bảy — không tính công
    log('2025-02-14', '08:00', '17:00')   # ngày lễ — không tính công

    # --- Đơn duyệt: AL range qua tháng, AL trùng ngày, AL nửa ngày, WFH, các loại nghỉ ---
    req('LEAVE', '2025-01-30', 'AL', '2025-02-03', '2025-01-01 08:00')   # chỉ phần tháng 2 được tính
    req('LEAVE', '2025-02-05', 'AL', None, '2025-01-02 08:00')           # trùng ngày với đơn dưới
    req('LEAVE', '2025-02-05', 'AL', None, '2025-01-03 08:00')
    req('LEAVE', '2025-02-06', 'AL', None, '2025-01-04 08:00', '{"half_day_period":"AM"}')
    req('WFH', '2025-02-07', end='2025-02-07', created='2025-01-05 08:00')
    req('WFH', '2025-02-10', end='2025-02-10', created='2025-01-06 08:00', payload='{"half_day_period":"AM"}')
    req('WFH', '2025-02-17', end='2025-02-21', created='2025-01-07 08:00')
    req('LEAVE', '2025-02-11', 'S', None, '2025-01-08 08:00')
    req('LEAVE', '2025-02-12', 'AL', None, '2025-01-09 08:00')
    req('LEAVE', '2025-02-12', 'S', None, '2025-01-10 08:00')            # mới hơn, nhưng AL cũ xử lý sau → AL thắng
    req('LEAVE', '2025-02-13', 'UP', None, '2025-01-11 08:00')
    req('LEAVE', '2025-02-24', 'RO', None, '2025-01-12 08:00')
    req('LEAVE', '2025-02-25', 'ML', None, '2025-01-13 08:00')
    req('LEAVE', '2025-02-26', 'PL', None, '2025-01-14 08:00')
    req('LEAVE', '2025-02-27', 'CL', None, '2025-01-15 08:00')

    # --- Ô HR sửa tay đè lên log/đơn ---
    cells = {
        '2025-02-19': '1.00',      # đè WFH → công
        '2025-02-20': 'AL/0.50',   # đè WFH → nửa phép
        '2025-02-21': 'S-BH',      # đè WFH → nghỉ ốm BH
        '2025-02-22': 'AL',        # Thứ Bảy → không trừ phép
        '2025-02-28': 'S',         # nghỉ ốm
    }
    for d, s in cells.items():
        psql(f"insert into timesheet_cells (timesheet_id, work_date, symbol, is_manual)"
             f" values ('{SHEET}','{d}','{s}',true)")

    _, j = call('GET', f'/timesheets?month={MONTH}', H, expect=200)
    row = next(r for r in j['data']['rows'] if r['employeeCode'] == EMP)

    expected_symbols = {
        '3': 'AL', '4': '0.50', '5': 'AL', '6': 'AL/0.50', '7': 'R', '8': '1.00',
        '10': 'R/0.50', '11': 'S', '12': 'AL', '13': 'UP', '14': '1.00',
        '17': 'R', '18': 'R', '19': '1.00', '20': 'AL/0.50', '21': 'S-BH',
        '22': 'AL', '24': 'RO', '25': 'ML', '26': 'PL', '27': 'CL', '28': 'S',
    }
    got = {str(k): v for k, v in row['days'].items()}
    for day, symbol in expected_symbols.items():
        check(f'ô ngày {day}/2 đúng ký hiệu', got.get(day) == symbol, f"{got.get(day)!r} != {symbol!r}")
    check('ngày 29-31 không tồn tại trong tháng 2', all(str(d) not in got for d in (29, 30, 31)))

    # --- Cột tổng hợp ---
    check('công chuẩn = 20 ngày làm việc − 1 ngày lễ', row['standardDays'] == 19, row['standardDays'])
    check('công thực tế chỉ cộng ngày làm việc (kể cả WFH)', row['actualDays'] == 5.0, row['actualDays'])
    check('tổng ngày công = công thực tế', row['totalDays'] == 5.0, row['totalDays'])
    check('WFH lấy từ ô lưới (R + R/0.50)', row['wfhDays'] == 3.5, row['wfhDays'])
    check('AL chỉ gồm phép năm, đúng nửa ngày', row['leaveDays'] == 4.0, row['leaveDays'])
    check('S đếm đủ 2 ngày (đơn + ô HR)', row['sickDays'] == 2, row['sickDays'])
    check('S-BH = 1', row['sickBhDays'] == 1, row['sickBhDays'])
    check('RO = 1', row['compDays'] == 1, row['compDays'])
    check('UP = 1', row['unpaidDays'] == 1, row['unpaidDays'])
    check('ML = 1', row['maternityDays'] == 1, row['maternityDays'])
    check('PL = 1', row['paternityDays'] == 1, row['paternityDays'])
    check('CL = 1', row['specialLeaveDays'] == 1, row['specialLeaveDays'])
    check('ngày lễ = 1', row['holidayDays'] == 1, row['holidayDays'])

    # Ô AL trên Thứ Bảy không được trừ vào phép năm.
    _, j2 = call('GET', f'/timesheets?month={MONTH}', H, expect=200)
    base = next(r for r in j2['data']['rows'] if r['employeeCode'] == '137ACT')['remainingLeave']
    check('phép còn lại = quỹ năm − AL (bỏ ô AL cuối tuần)',
          abs(row['remainingLeave'] - (base - 4.0)) < 1e-9,
          f"{row['remainingLeave']} != {base} - 4")

    # Công thức file xuất suy ra từ chính các cột này.
    aw = row['totalDays'] + row['holidayDays'] + row['leaveDays'] + row['specialLeaveDays'] \
        + row['sickDays'] + row['sickBhDays'] + row['compDays'] + row['unpaidDays'] \
        + row['maternityDays'] + row['paternityDays']
    az = row['holidayDays'] + row['leaveDays'] + row['specialLeaveDays'] + row['sickDays'] + row['compDays']
    ba = row['sickBhDays'] + row['unpaidDays'] + row['maternityDays'] + row['paternityDays']
    check('Tổng/Total = công + toàn bộ nghỉ', aw == 5.0 + 1 + 4 + 1 + 2 + 1 + 1 + 1 + 1 + 1,
          aw)  # 18.0
    check('Phép đã dùng = NL+AL+CL+S+RO', az == 1 + 4 + 1 + 2 + 1, az)  # 9.0
    check('Không hưởng lương = S-BH+UP+ML+PL', ba == 1 + 1 + 1 + 1, ba)  # 4.0

    # --- Chạy module xuất THẬT trên payload API vừa seed, kiểm tra file CSV ---
    import csv, os
    api_json, csv_path = '/tmp/pulse_export_api.json', '/tmp/pulse_export_scenario.csv'
    with open(api_json, 'w', encoding='utf-8') as f:
        json.dump(j['data'], f)
    root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    subprocess.run(
        ['node', 'tests/frontend/render_export_from_api.mjs', api_json, csv_path, '2/2025'],
        cwd=root, check=True, capture_output=True, text=True)
    with open(csv_path, encoding='utf-8-sig', newline='') as f:
        parsed = list(csv.reader(f))
    header, data_rows = parsed[0], parsed[1:]
    idx = {h: i for i, h in enumerate(header)}
    out = next(r for r in data_rows if r[1] == EMP)
    check('CSV: đủ 53 cột, mọi dòng cùng độ rộng',
          len(header) == 53 and all(len(r) == 53 for r in data_rows), f"{len(header)}")
    check('CSV: tháng 2 vẫn đủ cột ngày 29-31 nhưng chỉ ghi số',
          header[5 + 28] == '29' and header[5 + 30] == '31', f"{header[33]}|{header[35]}")
    check('CSV: ô ngày 29-31 trống', out[33] == '' and out[34] == '' and out[35] == '')
    check('CSV: tên có dấu phẩy/ngoặc kép không vỡ cột',
          out[idx['Họ và Tên/Full Name']] == 'Nguyễn "Test", CSV & Export',
          out[idx['Họ và Tên/Full Name']])
    check('CSV: ô ngày khớp lưới (20 = AL/0.50, 21 = S-BH, 22 = AL)',
          out[5 + 19] == 'AL/0.50' and out[5 + 20] == 'S-BH' and out[5 + 21] == 'AL')
    check('CSV: WFH = 3.5', out[idx['Làm việc tại nhà/R']] == '3.5', out[idx['Làm việc tại nhà/R']])
    check('CSV: AL = 4', out[idx['Ngày phép/AL']] == '4', out[idx['Ngày phép/AL']])
    check('CSV: S = 2', out[idx['Nghỉ ốm/S']] == '2', out[idx['Nghỉ ốm/S']])
    check('CSV: Tổng/Total = 18', out[idx['Tổng/Total']] == '18', out[idx['Tổng/Total']])
    check('CSV: Phép đã dùng = 9', out[idx['Số ngày phép sử dụng, nghỉ bù, nghỉ đặc biệt']] == '9',
          out[idx['Số ngày phép sử dụng, nghỉ bù, nghỉ đặc biệt']])
    check('CSV: Không hưởng lương = 4', out[idx['Số ngày nghỉ không hưởng lương']] == '4',
          out[idx['Số ngày nghỉ không hưởng lương']])
    check('CSV: phép còn lại = quỹ − 4',
          float(out[idx['Tổng số ngày phép còn lại']]) == base - 4,
          out[idx['Tổng số ngày phép còn lại']])

    # --- File .xlsx thật: mở lại bằng ZIP/XML để kiểm tra ---
    sys.path.insert(0, os.path.join(root, 'tests/frontend'))
    from xlsx_read import read_xlsx, values as xl_values
    xlsx_path = '/tmp/pulse_export_scenario.xlsx'
    subprocess.run(
        ['node', 'tests/frontend/render_export_from_api.mjs', api_json, xlsx_path, '2/2025'],
        cwd=root, check=True, capture_output=True, text=True)
    sheet_name, dim, xrows = read_xlsx(xlsx_path)
    xvals = xl_values(xrows)
    xh = xvals[0]
    xindex = next(i for i, r in enumerate(xvals) if r[1] == EMP)
    xo = xvals[xindex]
    xi = {h: i for i, h in enumerate(xh)}
    check('XLSX: tên sheet đúng', sheet_name == 'Timekeeping Report', sheet_name)
    check('XLSX: đủ 53 cột mọi dòng', all(len(r) == 53 for r in xrows), str({len(r) for r in xrows}))
    check('XLSX: tháng 2 vẫn đủ cột ngày 29-31', xh[33:36] == ['29', '30', '31'], str(xh[33:36]))
    check('XLSX: tên có &, dấu phẩy, ngoặc kép đọc lại đúng',
          xo[xi['Họ và Tên/Full Name']] == 'Nguyễn "Test", CSV & Export',
          xo[xi['Họ và Tên/Full Name']])
    check('XLSX: ô ngày khớp lưới (20 = AL/0.50, 21 = S-BH, 22 = AL)',
          xo[5 + 19] == 'AL/0.50' and xo[5 + 20] == 'S-BH' and xo[5 + 21] == 'AL')
    check('XLSX: WFH = 3.5', xo[xi['Làm việc tại nhà/R']] == '3.5', xo[xi['Làm việc tại nhà/R']])
    check('XLSX: AL = 4', xo[xi['Ngày phép/AL']] == '4', xo[xi['Ngày phép/AL']])
    check('XLSX: S = 2', xo[xi['Nghỉ ốm/S']] == '2', xo[xi['Nghỉ ốm/S']])
    check('XLSX: Tổng/Total = 18', xo[xi['Tổng/Total']] == '18', xo[xi['Tổng/Total']])
    check('XLSX: Phép đã dùng = 9', xo[xi['Số ngày phép sử dụng, nghỉ bù, nghỉ đặc biệt']] == '9')
    check('XLSX: Không hưởng lương = 4', xo[xi['Số ngày nghỉ không hưởng lương']] == '4')
    check('XLSX: phép còn lại = quỹ − 4',
          float(xo[xi['Tổng số ngày phép còn lại']]) == base - 4)
    check('XLSX: cột tổng lưu kiểu số',
          xrows[xindex][xi['Tổng/Total']][1] is True and xrows[xindex][xi['Ngày phép/AL']][1] is True)

    print('\nALL TIMESHEET EXPORT SCENARIO TESTS PASSED')
finally:
    cleanup()
