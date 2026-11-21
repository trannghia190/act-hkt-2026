"""Ca HIỆU LỰC áp vào TÍNH CÔNG (S11) và BẢNG CÔNG HR (S15).

Kịch bản:
1. Không khớp luật ca nào → ca chuẩn toàn công ty.
2. Một luật khớp (theo nhóm) → ca ngoại lệ A.
3. Nhiều luật cùng khớp → ca ưu tiên cao hơn (ở dưới danh sách) thắng.
4. Danh sách loại trừ → nhân viên rơi về ca ưu tiên thấp hơn.
5. Đổi thứ tự ưu tiên bằng API order → ca thắng đổi theo.
6. Tắt / xóa ca → rơi về ca còn lại hoặc ca chuẩn.
7. S11 tính công theo đúng số giờ yêu cầu của ca (7h ca B vs 8h ca A):
   đủ giờ = 1.00, đủ nửa = 0.50, thiếu = 0.00, thiếu giờ ra = 0.00;
   đi muộn đo theo check_in_end của ca hiệu lực.
8. S15 lưới tháng dùng cùng ký hiệu ca hiệu lực.
9. Log đã ghi ca (shift_id) giữ nguyên ca cũ khi HR đổi thứ tự ưu tiên.
10. Duyệt đơn bổ sung công gắn ca hiệu lực vào log và tính lại công.
"""
import json, urllib.request, urllib.error, sys, subprocess

B = 'http://localhost:8080/api/v1'
HR_CODE = '01HR'
MONTH = '2026-11'
A, BCODE = 'SHIFT_IT_A', 'SHIFT_IT_B'
CODES = ("'" + A + "','" + BCODE + "'")

# Ngày test đã chọn để không đụng log/đơn/ô công có sẵn của seed.
D_INCOMPLETE = '2026-11-13'   # 2026NEW: chỉ có giờ vào → 0.00
D_A = '2026-11-16'            # 136ACT: 7.5h dưới ca A (8h) → 0.50
D_B_FULL = '2026-11-17'       # 2026NEW: 7h dưới ca B (7h) → 1.00
D_ADJUST = '2026-11-18'       # 2026NEW: vào 08:30, duyệt bổ sung ra 16:30 → 1.00
D_STD = '2026-11-18'          # 138ACT: 8h dưới ca chuẩn → 1.00
D_SHORT = '2026-11-19'        # 2026NEW: 3h → 0.00
D_HALF = '2026-11-20'         # 2026NEW: 5h → 0.50
D_LATE = '2026-11-16'         # 2026NEW: vào 09:30, ra 17:30 → 1.00, muộn 30'


def call(method, path, token=None, body=None, expect=None):
    req = urllib.request.Request(B + path, method=method)
    req.add_header('Content-Type', 'application/json')
    if token:
        req.add_header('Authorization', 'Bearer ' + token)
    data = json.dumps(body).encode() if body is not None else None
    try:
        r = urllib.request.urlopen(req, data=data, timeout=25)
        code, js = r.status, json.loads(r.read() or b'{}')
    except urllib.error.HTTPError as e:
        code, js = e.code, json.loads(e.read() or b'{}')
    if expect and code != expect:
        print(f"FAIL {method} {path}: want {expect} got {code} {str(js)[:400]}")
        sys.exit(1)
    return code, js


def login(code):
    _, j = call('POST', '/auth/login', body={'employeeCodeOrEmail': code, 'password': '123456'}, expect=200)
    return j['data']['accessToken']


def psql(sql):
    r = subprocess.run(['psql', '-h', '127.0.0.1', '-p', '5432', '-U',
                        subprocess.check_output(['whoami']).decode().strip(), '-d', 'pulse_db', '-tAc', sql],
                       capture_output=True, text=True)
    if r.returncode != 0:
        print('psql error:', r.stderr)
        sys.exit(1)
    return r.stdout.strip()


def check(name, cond, extra=''):
    print(('PASS ' if cond else 'FAIL ') + name + (' ' + extra if extra and not cond else ''))
    if not cond:
        sys.exit(1)


def shift_body(code, name, ci_start, ci_end, co_start, co_end, required, **extra):
    body = {
        'code': code, 'name': name,
        'checkInStart': ci_start, 'checkInEnd': ci_end,
        'checkOutStart': co_start, 'checkOutEnd': co_end,
        'lunchBreakStart': '12:00:00', 'lunchBreakEnd': '13:00:00',
        'requiredWorkHours': required, 'isActive': True, 'isFlexible': False,
        'isException': True, 'requiresHrApproval': True,
        'geofenceRadiusM': 150, 'ipRanges': '10.0.0.0/8',
        'targetGroup': '', 'targetPosition': '', 'targetEmployees': '', 'excludeEmployees': '',
    }
    body.update(extra)
    return body


def body_a(**extra):
    # Ca A: 07:00–16:00, vào muộn sau 08:00, đủ 8h → khớp cả nhóm Sirius.
    return shift_body(A, 'Ca IT A (8h)', '07:00:00', '08:00:00', '15:30:00', '16:30:00', 8,
                      targetGroup='Sirius Backend Architecture', **extra)


def body_b(**extra):
    # Ca B: 08:30–16:30, đủ 7h → khớp 137ACT + 2026NEW, loại trừ 136ACT.
    kw = dict(targetEmployees='137ACT,2026NEW', excludeEmployees='136ACT')
    kw.update(extra)
    return shift_body(BCODE, 'Ca IT B (7h)', '08:00:00', '09:00:00', '15:30:00', '16:30:00', 7, **kw)


def my_shift(emp_token):
    _, j = call('GET', '/attendance/my-shift', emp_token, expect=200)
    return j['data']


def my_timesheet(emp_token):
    _, j = call('GET', f'/attendance/my-timesheet?month={MONTH}', emp_token, expect=200)
    return j['data']


def day_of(days, d):
    return next(x for x in days if int(x['day']) == d)


def uid(emp):
    return psql(f"select id from users where employee_code='{emp}'")


def insert_log(emp, date, ci, co=None, shift_code=None):
    """Chèn thẳng log để kiểm tra công thức tính công độc lập với luồng chấm công."""
    status = 'VALID' if co else 'INCOMPLETE'
    shift = f"(select id from shifts where code='{shift_code}')" if shift_code else 'null'
    co_sql = f"'{date} {co}:00+07'" if co else 'null'
    psql(f"insert into attendance_logs (user_id, work_date, type, check_in_at, check_out_at, "
         f"status, shift_id, created_at, updated_at) values "
         f"('{uid(emp)}','{date}','CHECK_IN','{date} {ci}:00+07',{co_sql},'{status}',{shift},now(),now())")


def cleanup(original_priorities):
    # Chỉ xóa đúng các log do test chèn — không đụng log sẵn có của seed.
    delete_pairs = {
        '2026NEW': (D_INCOMPLETE, D_LATE, D_B_FULL, D_ADJUST, D_SHORT, D_HALF),
        '136ACT': (D_A,),
        '138ACT': (D_STD,),
    }
    for emp, dates in delete_pairs.items():
        ds = ','.join(f"'{d}'" for d in set(dates))
        psql(f"delete from attendance_logs where user_id='{uid(emp)}' and work_date in ({ds})")
    psql(f"delete from requests where user_id='{uid('2026NEW')}' and work_date='{D_ADJUST}' and request_type='ADJUST'")
    psql(f"update users set shift_id=(select id from shifts where code='SHIFT_STANDARD') "
         f"where shift_id in (select id from shifts where code in ({CODES}))")
    psql(f"delete from shifts where code in ({CODES})")
    # Trả lại priority gốc cho các ca còn lại (API order đã đánh số lại toàn bộ).
    for code, prio in original_priorities:
        psql(f"update shifts set priority={int(prio)} where code='{code}'")


# ── Dọn dẹp trước khi chạy (nếu lần trước fail giữa chừng) ──────────────────
orig = []
for line in psql("select code||'|'||coalesce(priority::text,'0') from shifts "
                 f"where code not in ({CODES})").splitlines():
    c, p = line.split('|')
    orig.append((c, p))
psql(f"delete from shifts where code in ({CODES})")

HR = login(HR_CODE)
E136, E137, E138, ENEW = login('136ACT'), login('137ACT'), login('138ACT'), login('2026NEW')

try:
    # ── Tạo 2 luật ca ngoại lệ ─────────────────────────────────────────────────
    call('POST', '/admin/shifts', HR, body_a(), expect=200)
    call('POST', '/admin/shifts', HR, body_b(), expect=200)
    a_id = psql(f"select id from shifts where code='{A}'")
    b_id = psql(f"select id from shifts where code='{BCODE}'")
    check('1. Hai ca ngoại lệ được tạo (Aưu tiên thấp hơn B)',
          int(psql(f"select priority from shifts where code='{A}'")) <
          int(psql(f"select priority from shifts where code='{BCODE}'")))

    # ── Phân giải ca hiệu lực: chuẩn / 1 luật / nhiều luật ─────────────────────
    s138 = my_shift(E138)
    check('2. Không khớp luật → ca chuẩn', s138.get('isBase') is True and s138.get('code') == 'SHIFT_STANDARD', str(s138)[:200])

    s136 = my_shift(E136)
    check('3. Khớp 1 luật (theo nhóm) → ca A',
          s136.get('code') == A and s136.get('assigned') is True and s136.get('requiredWorkHours') == 8, str(s136)[:200])

    s137 = my_shift(E137)
    check('4. Khớp 2 luật → ca ưu tiên cao hơn (B)', s137.get('code') == BCODE and s137.get('requiredWorkHours') == 7, str(s137)[:200])
    check('5. Ca B khớp theo mã nhân viên', my_shift(ENEW).get('code') == BCODE)

    # ── Loại trừ → rơi về ca thấp hơn ─────────────────────────────────────────
    call('PUT', f'/admin/shifts/{BCODE}', HR, body_b(excludeEmployees='136ACT,137ACT'), expect=200)
    check('6. Bị loại trừ khỏi B → 137ACT rơi về A', my_shift(E137).get('code') == A, str(my_shift(E137))[:200])
    check('7. 2026NEW vẫn ở B', my_shift(ENEW).get('code') == BCODE)
    call('PUT', f'/admin/shifts/{BCODE}', HR, body_b(), expect=200)

    # ── Đổi thứ tự ưu tiên ────────────────────────────────────────────────────
    call('PUT', '/admin/shifts/order', HR, {'codes': [BCODE, A]}, expect=200)
    check('8. Đưa A xuống dưới → A thắng 137ACT', my_shift(E137).get('code') == A, str(my_shift(E137))[:200])
    call('PUT', '/admin/shifts/order', HR, {'codes': [A, BCODE]}, expect=200)
    check('9. Đưa B xuống dưới → B thắng lại', my_shift(E137).get('code') == BCODE)

    # ── Tắt / mở lại ca ───────────────────────────────────────────────────────
    call('PUT', f'/admin/shifts/{BCODE}', HR, body_b(isActive=False), expect=200)
    check('10. Tắt B → 137ACT về A', my_shift(E137).get('code') == A)
    check('11. Tắt B → 2026NEW về ca chuẩn', my_shift(ENEW).get('isBase') is True)
    call('PUT', f'/admin/shifts/{BCODE}', HR, body_b(isActive=True), expect=200)
    check('12. Bật B lại → 137ACT về B', my_shift(E137).get('code') == BCODE)

    # ── Dữ liệu chấm công để kiểm tra công thức tính công ────────────────────
    insert_log('2026NEW', D_INCOMPLETE, '08:30')                                    # thiếu giờ ra
    insert_log('2026NEW', D_LATE, '09:30', '17:30', shift_code=BCODE)               # muộn 30' so với 09:00
    insert_log('2026NEW', D_B_FULL, '08:30', '16:30')                               # fallback ca hiện hành B
    insert_log('2026NEW', D_SHORT, '08:30', '11:30')                                # 3h < 3.5h
    insert_log('2026NEW', D_HALF, '08:30', '14:30')                                 # 6h−1h = 5h ≥ 3.5h
    insert_log('2026NEW', D_ADJUST, '08:30')                                        # chờ duyệt bổ sung công
    insert_log('136ACT', D_A, '08:00', '16:30')                                     # 7.5h < 8h
    insert_log('138ACT', D_STD, '08:00', '17:00')                                   # 8h chuẩn

    s11 = my_timesheet(ENEW)
    check('13. S11 nêu ca hiệu lực (B, 7h, ca ngoại lệ)',
          s11.get('shiftCode') == BCODE and s11.get('shiftRequiredWorkHours') == 7
          and s11.get('shiftIsException') is True, str({k: s11.get(k) for k in ('shiftCode', 'shiftRequiredWorkHours', 'shiftIsException')}))

    d = day_of(s11['days'], 13)
    check('14. Thiếu giờ ra → 0.00', d['symbol'] == '0.00', str(d))
    d = day_of(s11['days'], 16)
    check('15. Đủ 7h ca B → 1.00; muộn 30′ tính theo giờ vào của ca',
          d['symbol'] == '1.00' and d['lateMinutes'] == 30 and d['hoursWorked'] == 7.0, str(d))
    d = day_of(s11['days'], 17)
    check('16. Log không ghi ca → fallback ca hiệu lực hiện hành B, 7h → 1.00',
          d['symbol'] == '1.00' and d['lateMinutes'] == 0 and d['hoursWorked'] == 7.0, str(d))
    d = day_of(s11['days'], 19)
    check('17. 3h < nửa 3.5h → 0.00', d['symbol'] == '0.00' and d['hoursWorked'] == 3.0, str(d))
    d = day_of(s11['days'], 20)
    check('18. 5h ≥ nửa 3.5h → 0.50', d['symbol'] == '0.50' and d['hoursWorked'] == 5.0, str(d))

    s11_136 = my_timesheet(E136)
    d = day_of(s11_136['days'], 16)
    check('19. 136ACT 7.5h dưới ca A (8h) → 0.50', d['symbol'] == '0.50' and d['hoursWorked'] == 7.5, str(d))
    check('20. S11 136ACT nêu ca A', s11_136.get('shiftCode') == A and s11_136.get('shiftRequiredWorkHours') == 8)

    s11_138 = my_timesheet(E138)
    d = day_of(s11_138['days'], 18)
    check('21. Ca chuẩn 8h → 1.00', d['symbol'] == '1.00' and s11_138.get('shiftIsException') is False, str(d))
    d = day_of(s11_138['days'], 19)
    check('22. Log có sẵn của 138ACT: thiếu giờ ra → 0.00', d['symbol'] == '0.00', str(d))

    # ── Duyệt đơn bổ sung công gắn ca + tính lại công ─────────────────────────
    _, j = call('POST', '/requests', ENEW, {
        'type': 'ADJUST', 'workDate': D_ADJUST, 'reason': 'Test ca hiệu lực — bổ sung giờ ra',
        'payload': json.dumps({'adjust_kind': 'OUT', 'time': '16:30'}),
    }, expect=200)
    req_id = j['data']['id']
    call('POST', f'/requests/{req_id}/approve', HR, {'comment': 'Duyệt test ca hiệu lực'}, expect=200)
    logged_shift = psql(f"select coalesce(shift_id::text,'') from attendance_logs "
                        f"where user_id='{uid('2026NEW')}' and work_date='{D_ADJUST}'")
    check('23. Duyệt bổ sung công gắn ca hiệu lực B vào log', logged_shift == b_id, logged_shift)
    d = day_of(my_timesheet(ENEW)['days'], 18)
    check('24. Sau duyệt: 7h dưới ca B → 1.00', d['symbol'] == '1.00' and d['hoursWorked'] == 7.0, str(d))

    # ── S15 lưới tháng dùng đúng ký hiệu ca hiệu lực ─────────────────────────
    _, j = call('GET', f'/timesheets?month={MONTH}', HR, expect=200)
    rows = {r['employeeCode']: r for r in j['data']['rows']}
    check('25. S15 2026NEW 7h ca B → 1.00', rows['2026NEW']['days'].get('17') == '1.00', str(rows['2026NEW']['days'])[:300])
    check('26. S15 136ACT 7.5h ca A → 0.50', rows['136ACT']['days'].get('16') == '0.50', str(rows['136ACT']['days'])[:300])
    check('27. S15 138ACT 8h ca chuẩn → 1.00', rows['138ACT']['days'].get('18') == '1.00', str(rows['138ACT']['days'])[:300])

    # ── Log đã ghi ca giữ nguyên ca cũ khi đổi thứ tự ưu tiên ────────────────
    call('PUT', '/admin/shifts/order', HR, {'codes': [BCODE, A]}, expect=200)   # A thắng hiện hành
    check('28. my-shift hiện hành của 137ACT đổi sang A', my_shift(E137).get('code') == A)
    _, j = call('GET', f'/timesheets?month={MONTH}', HR, expect=200)
    rows = {r['employeeCode']: r for r in j['data']['rows']}
    check('29. Log ghi ca B vẫn tính theo B (7h → 1.00), không theo ca hiện hành A',
          rows['2026NEW']['days'].get('16') == '1.00', str(rows['2026NEW']['days'])[:300])
    call('PUT', '/admin/shifts/order', HR, {'codes': [A, BCODE]}, expect=200)

    # ── Xóa ca → rơi về ca còn lại / ca chuẩn ────────────────────────────────
    call('DELETE', f'/admin/shifts/{BCODE}', HR, expect=200)
    check('30. Xóa B → 137ACT về A', my_shift(E137).get('code') == A)
    check('31. Xóa B → 2026NEW về ca chuẩn', my_shift(ENEW).get('isBase') is True)
    call('DELETE', f'/admin/shifts/{A}', HR, expect=200)
    check('32. Xóa A → 137ACT về ca chuẩn', my_shift(E137).get('isBase') is True)

    print('ALL PASS — ca hiệu lực áp đúng vào S11/S15 và giữ nguyên ca đã ghi trên log.')
finally:
    cleanup(orig)
