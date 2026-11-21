"""Duyệt & sửa ô HÀNG LOẠT (S45) — POST /disputes/bulk-resolve action=FIX.

Kịch bản: nhân viên tạo 3 khiếu nại (2 sửa giờ — 1 có giờ đề xuất, 1 không; 1 WFH),
HR chọn tất cả và bấm "Duyệt & sửa ô hàng loạt" (ids + reason + symbol),
kiểm tra: dispute RESOLVED, giờ ghi vào attendance_logs, ô công ghi ký hiệu,
đơn WFH được tạo, nhân viên nhận thông báo, và đơn đã xử lý bị bỏ qua khi chạy lại.
"""
import json, urllib.request, urllib.error, sys, subprocess
from datetime import date, timedelta

B = 'http://localhost:8080/api/v1'


def call(method, path, token=None, body=None, expect=None):
    req = urllib.request.Request(B + path, method=method)
    req.add_header('Content-Type', 'application/json')
    if token:
        req.add_header('Authorization', 'Bearer ' + token)
    data = json.dumps(body).encode() if body is not None else None
    try:
        r = urllib.request.urlopen(req, data=data, timeout=20)
        code = r.status
        js = json.loads(r.read() or b'{}')
    except urllib.error.HTTPError as e:
        code = e.code
        js = json.loads(e.read() or b'{}')
    if expect and code != expect:
        print(f"FAIL {method} {path}: want {expect} got {code} {str(js)[:300]}")
        sys.exit(1)
    return code, js


def login(code):
    c, j = call('POST', '/auth/login', body={'employeeCodeOrEmail': code, 'password': '123456'}, expect=200)
    return j['data']['accessToken']


def check(name, cond, extra=''):
    print(('PASS ' if cond else 'FAIL ') + name + (' ' + extra if extra and not cond else ''))
    if not cond:
        sys.exit(1)


def psql(sql):
    return subprocess.run(['psql', '-h', '127.0.0.1', '-p', '5432', '-U',
                           subprocess.check_output(['whoami']).decode().strip(),
                           '-d', 'pulse_db', '-tAc', sql], capture_output=True, text=True).stdout.strip()


E = login('137ACT')
H = login('01HR')
uid = psql("select id from users where employee_code='137ACT'")

# 3 ngày làm việc gần nhất trong cùng tháng hiện tại (khác ngày để không chạm hạn mức 2 đơn/ngày)
today = date.today()
days = []
d = today - timedelta(days=1)
while len(days) < 3:
    if d.weekday() < 5 and d.month == today.month:
        # Ngày đã có đơn WFH được duyệt sẽ chặn bước tạo WFH ở cuối kịch bản.
        has_wfh = psql(f"select count(*) from requests where user_id='{uid}' "
                       f"and work_date='{d.isoformat()}' and request_type='WFH' "
                       f"and status='APPROVED'") != '0'
        if not has_wfh:
            days.append(d)
    d -= timedelta(days=1)
day_a, day_b, day_c = (x.isoformat() for x in days)

for day in days:
    psql(f"delete from timesheet_disputes where user_id='{uid}' and work_date='{day.isoformat()}'")

# 1. Ba khiếu nại: sửa giờ có giờ đề xuất / sửa giờ không giờ / WFH
c, j = call('POST', '/disputes', E, {'workDate': day_a, 'reason': 'Quên check-out buổi chiều',
                                     'requestedCheckIn': '08:30', 'requestedCheckOut': '17:45'}, expect=200)
d_time = j['data']
c, j = call('POST', '/disputes', E, {'workDate': day_b, 'reason': 'Đi công tác ngoài, log không ghi nhận'}, expect=200)
d_nosymbol = j['data']
c, j = call('POST', '/disputes', E, {'workDate': day_c, 'reason': 'Làm từ xa nhưng quên đăng ký WFH',
                                     'requestedKind': 'WFH'}, expect=200)
d_wfh = j['data']
ids = [d_time['id'], d_nosymbol['id'], d_wfh['id']]
check('1. Tạo được 3 khiếu nại PENDING (2 sửa giờ + 1 WFH)',
      all(x['status'] == 'PENDING' for x in (d_time, d_nosymbol, d_wfh)))

# 2. Hàng loạt thiếu lý do → bị chặn từng đơn, không đơn nào bị đổi trạng thái
c, j = call('POST', '/disputes/bulk-resolve', H, {'ids': ids, 'action': 'FIX'}, expect=200)
check('2. Thiếu lý do → resolved=0, cả 3 bị bỏ qua',
      j['data']['resolved'] == 0 and len(j['data']['skipped']) == 3, str(j['data'])[:200])

# 3. Duyệt & sửa ô hàng loạt: 2 đơn sửa giờ + 1 đơn WFH, ký hiệu chung cho đơn không có giờ
c, j = call('POST', '/disputes/bulk-resolve', H, {
    'ids': ids, 'action': 'FIX',
    'reason': 'Đã đối chiếu log chấm công và sửa ô (test hàng loạt)',
    'symbol': '0.50',
}, expect=200)
check('3. Duyệt hàng loạt → resolved=3, không bỏ qua',
      j['data']['resolved'] == 3 and j['data']['skipped'] == [], str(j['data'])[:200])

# 4. Cả 3 khiếu nại chuyển RESOLVED
c, j = call('GET', '/disputes?status=ALL', H, expect=200)
by_id = {x['id']: x for x in j['data']}
check('4. Cả 3 khiếu nại đều RESOLVED',
      all(by_id.get(i, {}).get('status') == 'RESOLVED' for i in ids))

# 5. Đơn có giờ đề xuất → giờ ghi vào attendance_logs (theo giờ NV đề xuất), đơn không giờ → không tạo log mới
log_in = psql(f"select to_char(check_in_at,'HH24:MI')||'|'||to_char(check_out_at,'HH24:MI') "
              f"from attendance_logs where user_id='{uid}' and work_date='{day_a}'")
check('5. attendance_logs nhận giờ NV đề xuất 08:30→17:45', log_in == '08:30|17:45', f'got {log_in!r}')

# 6. Ô công của cả 2 ngày sửa giờ ghi ký hiệu (0.50 vì HR chọn chung) + đánh dấu sửa tay
cell_a = psql(f"select tc.symbol||'|'||tc.is_manual from timesheet_cells tc "
              f"join timesheets t on t.id=tc.timesheet_id join users u on u.id=t.user_id "
              f"where u.employee_code='137ACT' and tc.work_date='{day_a}'")
cell_b = psql(f"select tc.symbol||'|'||tc.is_manual from timesheet_cells tc "
              f"join timesheets t on t.id=tc.timesheet_id join users u on u.id=t.user_id "
              f"where u.employee_code='137ACT' and tc.work_date='{day_b}'")
check('6. Ô công ngày có giờ + ngày chỉ ký hiệu đều = 0.50 và is_manual',
      cell_a == '0.50|true' and cell_b == '0.50|true', f'got {cell_a!r} / {cell_b!r}')

# 7. Đơn WFH → tạo đơn WFH đã duyệt cho đúng ngày
wfh_row = psql(f"select request_type||'|'||status from requests "
               f"where user_id='{uid}' and work_date='{day_c}' and request_type='WFH'")
check('7. Đơn WFH đã duyệt được tạo từ khiếu nại', wfh_row == 'WFH|APPROVED', f'got {wfh_row!r}')

# 8. Nhân viên nhận thông báo xử lý cho từng khiếu nại
c, j = call('GET', '/notifications', E, expect=200)
n = sum(1 for x in j['data'] if 'đã được xử lý' in (x.get('title') or ''))
check('8. Có thông báo "đã được xử lý" cho nhân viên', n >= 3, f'got {n}')

# 9. Chạy lại hàng loạt trên đơn đã xử lý → bỏ qua hết, không ghi đè
c, j = call('POST', '/disputes/bulk-resolve', H, {
    'ids': ids, 'action': 'FIX', 'reason': 'Chạy lại (phải bị bỏ qua)', 'symbol': '1.00'}, expect=200)
check('9. Đơn đã xử lý bị bỏ qua khi chạy lại (resolved=0, skipped=3)',
      j['data']['resolved'] == 0 and len(j['data']['skipped']) == 3, str(j['data'])[:200])
cell_a2 = psql(f"select tc.symbol from timesheet_cells tc "
               f"join timesheets t on t.id=tc.timesheet_id join users u on u.id=t.user_id "
               f"where u.employee_code='137ACT' and tc.work_date='{day_a}'")
check('9b. Ô công không bị ghi đè bởi lần chạy lại', cell_a2 == '0.50', f'got {cell_a2!r}')

print('\nALL BULK-FIX TESTS PASSED')
