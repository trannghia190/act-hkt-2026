"""Hồi quy: "Bổ sung công" (MAKEUP) phải là CHUYỂN ĐÚNG điều nhân viên xin cho quản lý duyệt,
và quản lý duyệt phải THAY ĐỔI bảng công.

Lỗi cũ: MAKEUP luôn tạo đơn ADJUST với payload "{}" → quản lý duyệt xong ngày công vẫn trống;
khiếu nại WFH/nghỉ chuyển duyệt xong cùng mất luôn nội dung nhân viên đề nghị.

Kịch bản:
1) Khiếu nại "quên WFH" → HR chuyển duyệt → đơn WFH (không phải ADJUST rỗng) → quản lý duyệt
   → lưới HR và bảng cá nhân cùng hiện R, ngày WFH +1, ô đánh tay cũ bị xoá.
2) Khiếu nại sửa giờ có giờ đề xuất → HR chuyển duyệt → đơn ADJUST mang giờ đề xuất
   → quản lý duyệt → attendance_logs nhận đúng giờ, ô công tính theo ca.
"""
import atexit
import json
import subprocess
import sys
import urllib.error
import urllib.request
from datetime import date, timedelta

B = 'http://localhost:8080/api/v1'
E = '138ACT'  # tài khoản nhân viên có tháng trống — tránh đụng dữ liệu demo/QA khác
H = '01HR'
M = '05ACT'


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
        print(f"FAIL {method} {path}: want {expect} got {code} {str(js)[:400]}")
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


emp = login(E)
hr = login(H)
mgr = login(M)
uid = psql(f"select id from users where employee_code='{E}'")
today = date.today()
MONTH = f"{today.year}-{today.month:02d}"


def pick_days(n):
    """Các ngày làm việc đã qua trong tháng hiện tại, chưa có đơn/log/ô công đánh tay."""
    out, d = [], today - timedelta(days=1)
    while len(out) < n and d.month == today.month:
        if d.weekday() < 5:
            iso = d.isoformat()
            busy = psql(f"select count(*) from requests where user_id='{uid}' "
                        f"and work_date <= '{iso}' and coalesce(end_date, work_date) >= '{iso}'") != '0' \
                or psql(f"select count(*) from attendance_logs where user_id='{uid}' and work_date='{iso}'") != '0' \
                or psql(f"select count(*) from timesheet_cells tc join timesheets t on t.id=tc.timesheet_id "
                        f"where t.user_id='{uid}' and tc.work_date='{iso}' and tc.is_manual") != '0' \
                or psql(f"select count(*) from timesheet_disputes where user_id='{uid}' "
                        f"and work_date='{iso}' and status='PENDING'") != '0'
            if not busy:
                out.append(iso)
        d -= timedelta(days=1)
    return out


def sheet_id():
    sid = psql(f"select id from timesheets where user_id='{uid}' and period_month={today.month} "
               f"and period_year={today.year}")
    if not sid:
        psql(f"insert into timesheets (id,user_id,period_month,period_year,status,created_at) "
             f"values (gen_random_uuid(),'{uid}',{today.month},{today.year},'draft',now())")
        sid = psql(f"select id from timesheets where user_id='{uid}' and period_month={today.month} "
                   f"and period_year={today.year}")
    return sid


def grid_row():
    _, j = call('GET', f'/timesheets?month={MONTH}', hr, expect=200)
    return next(r for r in j['data']['rows'] if r['employeeCode'] == E)


def grid_day(day_iso):
    r = grid_row()
    return (r.get('days') or {}).get(str(int(day_iso[8:10])), '')


def my_day(day_iso):
    _, j = call('GET', f'/attendance/my-timesheet?month={MONTH}&employeeCode={E}', emp, expect=200)
    return next(d for d in j['data']['days'] if d['day'] == int(day_iso[8:10]))


def cleanup():
    for day in DAYS:
        psql(f"delete from requests where user_id='{uid}' and work_date='{day}'")
        psql(f"delete from timesheet_cells where is_manual and work_date='{day}' "
             f"and timesheet_id in (select t.id from timesheets t join users u on u.id=t.user_id "
             f"where u.employee_code='{E}')")
        psql(f"delete from attendance_logs where user_id='{uid}' and work_date='{day}'")
        psql(f"delete from timesheet_disputes where user_id='{uid}' and work_date='{day}'")


DAYS = pick_days(2)
check('tìm được 2 ngày làm việc trống trong tháng hiện tại', len(DAYS) == 2, str(DAYS))
day_wfh, day_time = DAYS
atexit.register(cleanup)
cleanup()  # dọn dấu vết lần chạy trước trước khi tạo dữ liệu mới

# ---------- 1. Khiếu nại WFH → đơn WFH → duyệt → bảng công đổi ----------
c, j = call('POST', '/disputes', emp, {'workDate': day_wfh, 'requestedKind': 'WFH',
                                      'reason': 'Làm từ xa nhưng quên gửi đơn WFH'}, expect=200)
dispute_wfh = j['data']['id']

c, j = call('POST', f'/disputes/{dispute_wfh}/resolve', hr, {
    'action': 'MAKEUP', 'reason': 'Xác nhận có làm việc từ xa — chuyển quản lý duyệt'}, expect=200)
check('1. Khiếu nại được đánh dấu RESOLVED theo hướng chuyển duyệt',
      j['data']['status'] == 'RESOLVED', str(j['data'])[:200])

row = psql(f"select request_type||'|'||status||'|'||end_date from requests "
           f"where user_id='{uid}' and work_date='{day_wfh}'")
check('1b. Đơn chuyển sang quản lý là WFH (không phải ADJUST rỗng), chờ duyệt, có end_date',
      row == f'WFH|PENDING_APPROVAL|{day_wfh}', row)
req_wfh = psql(f"select id from requests where user_id='{uid}' and work_date='{day_wfh}' and request_type='WFH'")
payload_wfh = psql(f"select payload from requests where id='{req_wfh}'")
check('1c. Payload giữ dấu vết khiếu nại nguồn', dispute_wfh in payload_wfh, payload_wfh)

# Ô đánh tay cũ (HR từng sửa 0.00) không được đè lên đơn vừa duyệt.
psql(f"update timesheets set status='draft' where id='{sheet_id()}'")
psql(f"delete from timesheet_cells where timesheet_id='{sheet_id()}' and work_date='{day_wfh}'")
psql(f"insert into timesheet_cells (id,timesheet_id,work_date,symbol,is_manual,created_at) "
     f"values (gen_random_uuid(),'{sheet_id()}','{day_wfh}','0.00',true,now())")
check('1d. Có ô đánh tay 0.00 trước khi duyệt', grid_day(day_wfh) == '0.00', grid_day(day_wfh))

wfh_before = float(grid_row()['wfhDays'])
call('POST', f'/requests/{req_wfh}/approve', mgr, {'comment': 'Duyệt WFH theo khiếu nại'}, expect=200)
check('1e. Quản lý duyệt xong ngày đó hiện R trên lưới HR', grid_day(day_wfh) == 'R', grid_day(day_wfh))
check('1f. Bảng công cá nhân cũng hiện R', my_day(day_wfh)['symbol'] == 'R', my_day(day_wfh)['symbol'])
check('1g. Ngày WFH tăng 1', abs(float(grid_row()['wfhDays']) - (wfh_before + 1)) < 1e-9,
      f"trước={wfh_before} sau={grid_row()['wfhDays']}")
left = psql(f"select count(*) from timesheet_cells where timesheet_id='{sheet_id()}' "
            f"and work_date='{day_wfh}' and is_manual")
check('1h. Ô đánh tay cũ bị xoá để đơn duyệt là nguồn sự thật', left == '0', left)

# ---------- 2. Khiếu nại sửa giờ → đơn ADJUST mang giờ đề xuất → duyệt → có log + công ----------
c, j = call('POST', '/disputes', emp, {'workDate': day_time, 'requestedCheckIn': '08:30',
                                      'requestedCheckOut': '17:30',
                                      'reason': 'Quên check-in buổi sáng'}, expect=200)
dispute_time = j['data']['id']
call('POST', f'/disputes/{dispute_time}/resolve', hr, {
    'action': 'MAKEUP', 'reason': 'Xác nhận giờ làm việc — chuyển quản lý duyệt'}, expect=200)
req_time = psql(f"select id from requests where user_id='{uid}' and work_date='{day_time}' and request_type='ADJUST'")
payload_time = psql(f"select payload from requests where id='{req_time}'")
check('2. Đơn chuyển duyệt là ADJUST mang giờ NV đề xuất',
      req_time != '' and '08:30' in payload_time and '17:30' in payload_time, payload_time)
call('POST', f'/requests/{req_time}/approve', mgr, {'comment': 'Duyệt theo giờ nhân viên xác nhận'}, expect=200)
log = psql(f"select to_char(check_in_at,'HH24:MI')||'|'||to_char(check_out_at,'HH24:MI') "
           f"from attendance_logs where user_id='{uid}' and work_date='{day_time}'")
check('2b. Duyệt xong attendance_logs nhận giờ 08:30→17:30', log == '08:30|17:30', repr(log))
check('2c. Ô công ngày đó tính theo ca = 1.00', grid_day(day_time) == '1.00', grid_day(day_time))
check('2d. Duyệt sửa giờ không ghi ô đánh tay — ô công tính từ log như ngày thường',
      psql(f"select count(*) from timesheet_cells where timesheet_id='{sheet_id()}' "
           f"and work_date='{day_time}'") == '0')
check('2e. Bảng cá nhân cùng hiện 1.00', my_day(day_time)['symbol'] == '1.00', my_day(day_time)['symbol'])

print('OK — bổ sung công chuyển đúng nội dung khiếu nại và duyệt xong bảng công thay đổi')
