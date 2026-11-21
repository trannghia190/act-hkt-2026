"""Khiếu nại kèm đề xuất giờ vào/ra → HR duyệt FIX áp giờ vào bảng công.

Chạy:  python3 tests/api/test_dispute_time_fix.py
Mặc định gọi http://localhost:8080/api/v1 (đổi bằng API_BASE, vd :8081).
"""
import json, os, subprocess, sys, urllib.request, urllib.error
from datetime import date

B = (os.environ.get('API_BASE') or 'http://localhost:8080/api/v1').rstrip('/')
USER = subprocess.check_output(['whoami']).decode().strip()


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
        print(f"FAIL {method} {path}: want {expect} got {code} {str(js)[:250]}")
        sys.exit(1)
    return code, js


def psql(sql):
    return subprocess.run(
        ['psql', '-h', '127.0.0.1', '-p', '5432', '-U', USER, '-d', 'pulse_db', '-tAc', sql],
        capture_output=True, text=True).stdout.strip()


def login(code):
    _, j = call('POST', '/auth/login', body={'employeeCodeOrEmail': code, 'password': '123456'}, expect=200)
    return j['data']['accessToken']


def check(name, cond, extra=''):
    print(('PASS ' if cond else 'FAIL ') + name + (' — ' + str(extra)[:250] if extra and not cond else ''))
    if not cond:
        sys.exit(1)


E = login('137ACT')
H = login('01HR')
uid = psql("select id from users where employee_code='137ACT'")

# Ngày test: các ngày làm việc trong tháng hiện tại, không phải hôm nay (tránh ảnh hưởng chấm công thật).
# Mỗi kịch bản một ngày riêng vì (a) WFH/nghỉ đè cả ngày, (b) mỗi ngày chỉ được 2 đơn khiếu nại.
today = date.today()
_workdays = [date(today.year, today.month, d) for d in range(1, today.day)
             if date(today.year, today.month, d).weekday() < 5]
if not _workdays:
    print('SKIP: đầu tháng chưa có ngày làm việc trước hôm nay'); sys.exit(0)
work_date = _workdays[0].isoformat()                                          # sửa giờ (1 duyệt + 1 từ chối = đủ 2 lượt)
work_date2 = _workdays[1].isoformat() if len(_workdays) > 1 else None         # WFH
work_date3 = _workdays[2].isoformat() if len(_workdays) > 2 else None         # nghỉ phép + giới hạn lượt
month = work_date[:7]

# Kỳ test phải đang mở để nhân viên khiếu nại được.
psql(f"update timesheets set status='draft', published_at=null, dispute_deadline=null, locked_at=null "
     f"where period_year={today.year} and period_month={today.month}")

orig_in, orig_out, orig_status = (psql(
    f"select coalesce(to_char(check_in_at,'HH24:MI'),''), coalesce(to_char(check_out_at,'HH24:MI'),''), status "
    f"from attendance_logs where user_id='{uid}' and work_date='{work_date}'").split('|') + ['', '', ''])[:3]

# Dọn dữ liệu cũ của ngày test để kết quả không phụ thuộc lần chạy trước.
psql(f"delete from timesheet_disputes where user_id='{uid}' and work_date='{work_date}'")

try:
    # 1. Validate giờ sai định dạng
    c, j = call('POST', '/disputes', E, {'workDate': work_date, 'reason': 'x', 'requestedCheckIn': '25:99'})
    check('1. Giờ sai định dạng bị chặn 400', c == 400 and 'không hợp lệ' in (j.get('message') or ''), j.get('message'))

    # 2. Validate giờ ra trước giờ vào
    c, j = call('POST', '/disputes', E, {'workDate': work_date, 'reason': 'x',
                                        'requestedCheckIn': '17:00', 'requestedCheckOut': '08:00'})
    check('2. Giờ ra trước giờ vào bị chặn 400', c == 400 and 'sau giờ vào' in (j.get('message') or ''), j.get('message'))

    # 3. Tạo khiếu nại kèm giờ đề xuất
    c, j = call('POST', '/disputes', E, {'workDate': work_date,
                                        'reason': 'Em quên check-out, đề xuất giờ vào/ra đúng',
                                        'requestedCheckIn': '08:15', 'requestedCheckOut': '17:45'}, expect=200)
    did = j['data']['id']
    check('3. Khiếu nại lưu giờ đề xuất', j['data'].get('requestedCheckIn') == '08:15'
          and j['data'].get('requestedCheckOut') == '17:45', j['data'])

    # 4. HR xem chi tiết thấy giờ đề xuất
    c, j = call('GET', f'/disputes/{did}', H, expect=200)
    check('4. HR thấy giờ nhân viên đề xuất', j['data'].get('requestedCheckIn') == '08:15'
          and j['data'].get('requestedCheckOut') == '17:45', j['data'])

    # 5. HR duyệt FIX, không nhập ký hiệu → hệ thống tự tính
    c, j = call('POST', f'/disputes/{did}/resolve', H,
                {'action': 'FIX', 'reason': 'Đối chiếu camera, đúng giờ'}, expect=200)
    check('5. Duyệt FIX thành công', j['data'].get('status') == 'RESOLVED', j['data'])

    # 6. Bảng công ngày đó đã cập nhật giờ + tự tính công
    c, j = call('GET', f'/attendance/my-timesheet?month={month}&employeeCode=137ACT', H, expect=200)
    d = next(x for x in j['data']['days'] if x['date'] == work_date)
    check('6. Bảng công nhận giờ vào mới', d.get('checkIn') == '08:15', d)
    check('6b. Bảng công nhận giờ ra mới', d.get('checkOut') == '17:45', d)
    check('6c. Giờ làm tính lại (8.5h sau trừ 1h nghỉ)', d.get('hoursWorked') == 8.5, d.get('hoursWorked'))
    check('6d. Ô công tự thành 1.00, không đi muộn', d.get('symbol') == '1.00' and d.get('lateMinutes') == 0, d)

    # 7. Dữ liệu gốc trong attendance_logs đã đổi
    row = psql(f"select to_char(check_in_at,'HH24:MI'), to_char(check_out_at,'HH24:MI'), status "
               f"from attendance_logs where user_id='{uid}' and work_date='{work_date}'")
    check('7. attendance_logs được ghi giờ mới', row == '08:15|17:45|VALID', row)

    # 8. Audit ghi kèm giờ đã duyệt
    audit = psql(f"select new_value from audit_logs where entity_id='{did}' order by created_at desc limit 1")
    check('8. Audit có giờ duyệt', '08:15' in audit and '17:45' in audit, audit)

    # 9. Không xử lý lại được
    c, j = call('POST', f'/disputes/{did}/resolve', H, {'action': 'FIX', 'reason': 'lần 2'})
    check('9. Không xử lý lại khiếu nại đã đóng', c == 400, j.get('message'))

    # 10. Giờ ra trước giờ vào ở bước duyệt bị chặn (HR nhập đè)
    c, j = call('POST', '/disputes', E, {'workDate': work_date, 'reason': 'test HR nhập đè',
                                        'requestedCheckIn': '08:00', 'requestedCheckOut': '17:00'}, expect=200)
    did2 = j['data']['id']
    c, j = call('POST', f'/disputes/{did2}/resolve', H,
                {'action': 'FIX', 'reason': 'sai giờ', 'requestedCheckIn': '17:00', 'requestedCheckOut': '08:00'})
    check('10. HR nhập giờ ra trước giờ vào bị chặn', c == 400 and 'sau giờ vào' in (j.get('message') or ''), j.get('message'))
    call('POST', f'/disputes/{did2}/resolve', H, {'action': 'REJECT', 'reason': 'đóng đơn test'})

    # 11–12. Chế độ nghỉ phải chọn đúng loại trong danh mục
    c, j = call('POST', '/disputes', E, {'workDate': work_date, 'reason': 'x', 'requestedKind': 'LEAVE'})
    check('11. Chuyển thành nghỉ thiếu loại nghỉ bị chặn', c == 400 and 'loại nghỉ' in (j.get('message') or '').lower(), j.get('message'))

    c, j = call('POST', '/disputes', E, {'workDate': work_date, 'reason': 'x',
                                        'requestedKind': 'LEAVE', 'requestedLeaveType': 'ZZZ'})
    check('12. Loại nghỉ không có trong danh mục bị chặn', c == 400, j.get('message'))

    # 13. WFH: nhân viên xin công nhận làm việc từ xa, HR duyệt → ngày đó thành WFH
    if work_date2:
        c, j = call('POST', '/disputes', E, {'workDate': work_date2, 'reason': 'Em đi công tác khách hàng, xin ghi nhận WFH',
                                            'requestedKind': 'WFH'}, expect=200)
        wfh_id = j['data']['id']
        check('13. Khiếu nại lưu chế độ WFH', j['data'].get('requestedKind') == 'WFH', j['data'])
        call('POST', f'/disputes/{wfh_id}/resolve', H, {'action': 'FIX', 'reason': 'Xác nhận có mặt tại khách hàng'}, expect=200)
        c, j = call('GET', f'/attendance/my-timesheet?month={month}&employeeCode=137ACT', H, expect=200)
        d = next(x for x in j['data']['days'] if x['date'] == work_date2)
        check('13b. Bảng công nhận ngày WFH', d.get('status') == 'WFH' and d.get('symbol') == 'R', d)
        row = psql(f"select status from requests where user_id='{uid}' and work_date='{work_date2}' and request_type='WFH'")
        check('13c. Sinh đơn WFH đã duyệt', row == 'APPROVED', row)

        # 13d. Ngày đã có đơn WFH được duyệt → không tạo trùng
        c, j = call('POST', '/disputes', E, {'workDate': work_date2, 'reason': 'xin thêm lần nữa', 'requestedKind': 'WFH'}, expect=200)
        dup_id = j['data']['id']
        c, j = call('POST', f'/disputes/{dup_id}/resolve', H, {'action': 'FIX', 'reason': 'thử trùng'})
        check('13d. Không tạo trùng đơn WFH đã duyệt', c == 400 and 'đã có đơn' in (j.get('message') or ''), j.get('message'))

    # 14–16. Nghỉ phép: chuyển ngày công thành nghỉ AL, trừ 1 ngày quỹ phép
    if work_date3:
        before = psql(f"select coalesce(sum(amount),0) from leave_ledger where user_id='{uid}' and leave_type='AL'")
        c, j = call('POST', '/disputes', E, {'workDate': work_date3, 'reason': 'Hôm đó em nghỉ phép năm',
                                            'requestedKind': 'LEAVE', 'requestedLeaveType': 'AL'}, expect=200)
        leave_id = j['data']['id']
        check('14. Khiếu nại lưu loại nghỉ trong danh mục', j['data'].get('requestedKind') == 'LEAVE'
              and j['data'].get('requestedLeaveType') == 'AL'
              and j['data'].get('requestedLeaveTypeName') == 'Phép năm', j['data'])
        call('POST', f'/disputes/{leave_id}/resolve', H, {'action': 'FIX', 'reason': 'Có đơn nghỉ trước đó'}, expect=200)
        c, j = call('GET', f'/attendance/my-timesheet?month={month}&employeeCode=137ACT', H, expect=200)
        d = next(x for x in j['data']['days'] if x['date'] == work_date3)
        check('15. Bảng công nhận ngày nghỉ phép', d.get('status') == 'LEAVE' and d.get('symbol') == 'AL', d)
        check('15b. API trả số lượt khiếu nại của ngày', d.get('dispute', {}).get('count') == 1, d.get('dispute'))
        after = psql(f"select coalesce(sum(amount),0) from leave_ledger where user_id='{uid}' and leave_type='AL'")
        check('16. Trừ 1 ngày quỹ phép', float(after) == float(before) - 1, f'{before} → {after}')

        # 17–19. Giới hạn lượt khiếu nại mỗi ngày: chặn khi còn đơn chờ, tối đa 2 đơn/ngày
        c, j = call('POST', '/disputes', E, {'workDate': work_date3, 'reason': 'Khiếu nại lần 2'}, expect=200)
        second_id = j['data']['id']
        c, j = call('POST', '/disputes', E, {'workDate': work_date3, 'reason': 'Khiếu nại lần 3'})
        check('17. Chặn tạo đơn mới khi còn đơn đang chờ HR xử lý', c == 400 and 'chờ HR xử lý' in (j.get('message') or ''), j.get('message'))
        call('POST', f'/disputes/{second_id}/resolve', H, {'action': 'REJECT', 'reason': 'đóng để test giới hạn lượt'}, expect=200)
        c, j = call('POST', '/disputes', E, {'workDate': work_date3, 'reason': 'Khiếu nại lần 3'})
        check('18. Đã dùng đủ 2 lượt trong ngày → chặn', c == 400 and '2 lần' in (j.get('message') or ''), j.get('message'))

    print('\nALL DISPUTE TIME-FIX TESTS PASSED')
finally:
    # Trả lại log gốc + dọn dữ liệu test.
    if orig_in or orig_out:
        in_sql = "'{} {}'".format(work_date, orig_in) if orig_in else 'NULL'
        out_sql = "'{} {}'".format(work_date, orig_out) if orig_out else 'NULL'
        psql("update attendance_logs set check_in_at={}, check_out_at={}, status='{}' "
             "where user_id='{}' and work_date='{}'".format(
                 in_sql, out_sql, orig_status or 'VALID', uid, work_date))
    else:
        psql("delete from attendance_logs where user_id='{}' and work_date='{}'".format(uid, work_date))
    for wd in [work_date, work_date2, work_date3]:
        if not wd:
            continue
        psql(f"delete from timesheet_disputes where user_id='{uid}' and work_date='{wd}'")
        psql("delete from timesheet_cells where work_date='{}' and timesheet_id in "
             "(select id from timesheets where period_year={} and period_month={})".format(wd, today.year, today.month))
        # Đơn WFH/nghỉ + bút toán quỹ phép do khiếu nại sinh ra.
        psql("delete from requests where user_id='{}' and work_date='{}' "
             "and decision_comment='Duyệt qua khiếu nại bảng công'".format(uid, wd))
        psql("delete from leave_ledger where user_id='{}' and reason like 'Duyệt khiếu nại ngày {}%'".format(uid, wd))
