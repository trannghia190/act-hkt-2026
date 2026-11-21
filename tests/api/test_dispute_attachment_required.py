"""
Hồi quy luồng khiếu nại ↔ giấy tờ ↔ tính công:

1. Loại nghỉ bắt buộc giấy tờ (S, ML, PL…) — khiếu nại chuyển thành nghỉ mà KHÔNG
   có giấy tờ phải bị chặn ngay từ lúc gửi; có giấy tờ thì duyệt được và giấy tờ
   được chuyển sang đơn đã duyệt để HR tải lại.
2. Ngày nghỉ ốm (S) KHÔNG trừ quỹ phép năm — chỉ tăng ngày ốm.
3. Sửa giờ khiếu nại BẮT BUỘC đủ cả giờ vào và giờ ra: thiếu một đầu → 400,
   đủ cả hai → công ngày đó tự tính lại theo giờ (không nhập tay ký hiệu).

Chạy khi backend local đã lên (./run-local.sh).
"""
import base64
import json
import subprocess
import sys
import urllib.error
import urllib.request

B = 'http://localhost:8080/api/v1'
EMP = '136ACT'
HR = '01HR'
LEAVE_DAY = '2026-11-11'
FIX_DAY = '2026-11-12'
NOTE = b'SICK-NOTE-EVIDENCE-11-11'


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


def my_sheet(token):
    _, j = call('GET', f'/attendance/my-timesheet?month=2026-11&employeeCode={EMP}', token, expect=200)
    return j['data']


def day_of(sheet, day):
    return next(d for d in sheet['days'] if d['day'] == day)


def annual_balance(token):
    _, j = call('GET', '/leaves/my-balance', token, expect=200)
    return float(j['data']['annualRemaining'])


def cleanup():
    uid = psql(f"select id from users where employee_code='{EMP}'")
    psql(f"delete from request_attachments where request_id in "
         f"(select id from requests where user_id='{uid}' and work_date in ('{LEAVE_DAY}','{FIX_DAY}'))")
    psql(f"delete from requests where user_id='{uid}' and work_date in ('{LEAVE_DAY}','{FIX_DAY}')")
    psql(f"delete from leave_ledger where user_id='{uid}' and reason like 'Duyệt khiếu nại ngày {LEAVE_DAY}%'")
    psql(f"delete from dispute_attachments where dispute_id in "
         f"(select id from timesheet_disputes where user_id='{uid}' and work_date in ('{LEAVE_DAY}','{FIX_DAY}'))")
    psql(f"delete from timesheet_disputes where user_id='{uid}' and work_date in ('{LEAVE_DAY}','{FIX_DAY}')")
    psql(f"delete from attendance_logs where user_id='{uid}' and work_date='{FIX_DAY}'")


hr = login(HR)
emp = login(EMP)
cleanup()
try:
    # ── 1. Nghỉ ốm: thiếu giấy tờ phải bị chặn ─────────────────────────────────
    code, j = call('POST', '/disputes', emp, {
        'workDate': LEAVE_DAY, 'reason': 'Ốm đột xuất',
        'requestedKind': 'LEAVE', 'requestedLeaveType': 'S',
    })
    check('gửi khiếu nại nghỉ ốm KHÔNG có giấy tờ → 400', code == 400, f'got {code}')
    check('thông báo nêu rõ bắt buộc giấy tờ', 'giấy tờ' in (j.get('message') or ''), j.get('message'))

    # ── 2. Có giấy tờ → tạo được, giấy tờ tải lại được ─────────────────────────
    balance_before = annual_balance(emp)
    before = my_sheet(emp)
    code, j = call('POST', '/disputes', emp, {
        'workDate': LEAVE_DAY, 'reason': 'Ốm đột xuất, giấy khám gửi kèm',
        'requestedKind': 'LEAVE', 'requestedLeaveType': 'S',
        'attachments': [{'fileName': 'giay-kham.pdf', 'contentType': 'application/pdf',
                         'data': base64.b64encode(NOTE).decode()}],
    }, expect=200)
    did = j['data']['id']
    check('gửi khiếu nại nghỉ ốm CÓ giấy tờ → 200', j['data']['status'] == 'PENDING')

    _, j = call('GET', '/disputes', hr, expect=200)
    row = next(x for x in j['data'] if x['id'] == did)
    check('HR thấy khiếu nại kèm số giấy tờ', row.get('attachmentCount') == 1, str(row.get('attachmentCount')))

    _, j = call('GET', f'/disputes/{did}', hr, expect=200)
    atts = j['data'].get('attachments') or []
    check('chi tiết khiếu nại liệt kê giấy tờ', len(atts) == 1 and atts[0]['fileName'] == 'giay-kham.pdf', str(atts))
    req = urllib.request.Request('http://localhost:8080' + atts[0]['downloadUrl'])
    req.add_header('Authorization', 'Bearer ' + hr)
    check('tải giấy tờ khiếu nại trả đúng nội dung', urllib.request.urlopen(req).read() == NOTE)

    # ── 3. Duyệt thành nghỉ ốm: công nhận ngày nghỉ, giấy tờ sang đơn đã duyệt ──
    call('POST', f'/disputes/{did}/resolve', hr, {
        'action': 'FIX', 'requestedKind': 'LEAVE', 'requestedLeaveType': 'S',
        'reason': 'Đã đối chiếu giấy khám',
    }, expect=200)
    after = my_sheet(emp)
    d = day_of(after, 11)
    check('ngày 11/11 hiển thị ký hiệu S', d['symbol'] == 'S', d['symbol'])
    check('ngày ốm tăng 1', (after.get('sickDays') or 0) - (before.get('sickDays') or 0) == 1,
          f"trước={before.get('sickDays')} sau={after.get('sickDays')}")
    check('quỹ phép năm KHÔNG bị trừ khi nghỉ ốm', abs(annual_balance(emp) - balance_before) < 1e-9,
          f'trước={balance_before} sau={annual_balance(emp)}')
    uid = psql(f"select id from users where employee_code='{EMP}'")
    copied = psql(f"select count(*) from request_attachments a join requests r on r.id=a.request_id "
                  f"where r.user_id='{uid}' and r.work_date='{LEAVE_DAY}'")
    check('giấy tờ được chuyển sang đơn nghỉ đã duyệt', copied == '1', copied)

    # ── 4. Sửa giờ: bắt buộc đủ giờ vào + giờ ra ───────────────────────────────
    code, j = call('POST', '/disputes', emp, {
        'workDate': FIX_DAY, 'reason': 'Quên check-out',
        'requestedKind': 'TIME_FIX', 'requestedCheckIn': '08:30',
    })
    check('khiếu nại sửa giờ thiếu giờ ra → 400', code == 400, f'got {code}')
    code, j = call('POST', '/disputes', emp, {
        'workDate': FIX_DAY, 'reason': 'Quên check-out',
        'requestedKind': 'TIME_FIX', 'requestedCheckIn': '08:30', 'requestedCheckOut': '17:30',
    }, expect=200)
    did2 = j['data']['id']
    code, j = call('POST', f'/disputes/{did2}/resolve', hr, {
        'action': 'FIX', 'requestedKind': 'TIME_FIX', 'reason': 'Đã đối chiếu máy chấm công',
    }, expect=200)
    d = day_of(my_sheet(emp), 12)
    check('duyệt sửa giờ → công ngày đó tính theo ca (1.00)', d['symbol'] == '1.00', d['symbol'])
    log = psql(f"select to_char(check_in_at,'HH24:MI')||'→'||to_char(check_out_at,'HH24:MI') "
               f"from attendance_logs l join users u on u.id=l.user_id "
               f"where u.employee_code='{EMP}' and l.work_date='{FIX_DAY}'")
    check('log chấm công được ghi đúng cặp giờ', log == '08:30→17:30', log)
finally:
    cleanup()
print('OK — khiếu nại bắt buộc giấy tờ + sửa giờ đủ cặp giờ, nghỉ ốm không trừ phép năm')
