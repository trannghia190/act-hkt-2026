#!/usr/bin/env python3
"""Ma trận trạng thái kỳ công theo mô hình KỲ MỞ:
  OPEN (kỳ đang chạy) → nhân viên khiếu nại được ngay
  DISPUTABLE (đã chốt, còn cửa sổ) → khiếu nại được
  EXPIRED (quá hạn sau chốt) → chặn
  LOCKED (khoá hoàn toàn) → chặn
Chạy: API_BASE=http://localhost:8080/api/v1 python3 tests/api/test_period_state_matrix.py
"""
import datetime, json, os, subprocess, sys, urllib.request
B = os.environ.get('API_BASE', 'http://localhost:8080/api/v1')
USER = subprocess.check_output(['whoami']).decode().strip()

def call(m, path, token=None, body=None):
    req = urllib.request.Request(B + path, method=m); req.add_header('Content-Type', 'application/json')
    if token: req.add_header('Authorization', 'Bearer ' + token)
    try:
        r = urllib.request.urlopen(req, data=json.dumps(body).encode() if body is not None else None, timeout=20)
        return r.status, json.loads(r.read() or b'{}')
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b'{}')

def login(c):
    _, j = call('POST', '/auth/login', body={'employeeCodeOrEmail': c, 'password': '123456'}); return j['data']['accessToken']

def psql(sql):
    subprocess.run(['psql','-h','127.0.0.1','-p','5432','-U',USER,'-d','pulse_db','-c',sql], capture_output=True)

def q(sql):
    return subprocess.check_output(['psql','-h','127.0.0.1','-p','5432','-U',USER,'-d','pulse_db','-tAc',sql]).decode().strip()

F = 0
def chk(n, c, x=''):
    global F
    print(('PASS ' if c else 'FAIL ') + n + ('' if c else ' :: ' + str(x)[:250]))
    if not c: F += 1

H, E = login('01HR'), login('136ACT')
# Dùng kỳ ĐÃ KẾT THÚC cho luồng chốt/khoá (mô hình kỳ MỞ không cho chốt kỳ đang chạy).
TARGET = '2020-10'
OLD_PERIOD = "where period_month=10 and period_year=2020"
OTHER_PERIOD = "where period_month=9 and period_year=2020"
me = lambda m=TARGET: call('GET', f'/attendance/my-timesheet?month={m}', E)[1]['data']
today = datetime.date.today()
cur_m = today.strftime('%Y-%m')
nxt_m = (today.replace(day=1) + datetime.timedelta(days=32)).strftime('%Y-%m')

try:
    # A. Kỳ đang MỞ (draft) → khiếu nại được ngay, KHÔNG cần công bố
    psql(f"update timesheets set status='draft', published_at=null, dispute_deadline=null, locked_at=null {OLD_PERIOD}")
    d = me()
    chk('A1 kỳ đang mở → periodStatus=OPEN', d['periodStatus'] == 'OPEN', d['periodStatus'])
    chk('A2 kỳ đang mở → canDispute=true', d['canDispute'] is True)
    c, j = call('POST', '/disputes', E, {'workDate': '2020-10-21', 'reason': 'matrix open'})
    chk('A3 kỳ đang mở → tạo khiếu nại được ngay', c == 200, (c, j.get('message')))
    if c == 200: psql(f"delete from timesheet_disputes where id='{j['data']['id']}'")

    # B. Chốt kỳ ĐÃ KẾT THÚC → mở cửa sổ, hạn đúng DB
    c, j = call('POST', f'/timesheets/publish?month={TARGET}', H)
    chk('B1 chốt kỳ đã kết thúc thành công', c == 200, (c, j.get('message')))
    db_deadline = q("select to_char(dispute_deadline,'YYYY-MM-DD') from timesheets where period_month=10 and period_year=2020 limit 1")
    d = me()
    chk('B2 sau chốt → DISPUTABLE', d['periodStatus'] == 'DISPUTABLE', d['periodStatus'])
    chk('B3 canDispute=true trong cửa sổ', d['canDispute'] is True)
    chk('B4 hạn hiển thị = hạn trong DB', str(d.get('disputeDeadline')) == db_deadline, f"{d.get('disputeDeadline')} vs {db_deadline}")
    c, j = call('POST', '/disputes', E, {'workDate': '2020-10-21', 'reason': 'matrix disputable'})
    chk('B5 trong cửa sổ → tạo được', c == 200, (c, j.get('message')))
    if c == 200: psql(f"delete from timesheet_disputes where id='{j['data']['id']}'")

    # C. Quá hạn cửa sổ
    psql(f"update timesheets set dispute_deadline = now() - interval '1 day' {OLD_PERIOD}")
    d = me()
    chk('C1 quá hạn → EXPIRED', d['periodStatus'] == 'EXPIRED', d['periodStatus'])
    chk('C2 quá hạn → canDispute=false', d['canDispute'] is False)
    c, j = call('POST', '/disputes', E, {'workDate': '2020-10-21', 'reason': 'matrix expired'})
    chk('C3 quá hạn → chặn khiếu nại', c == 400 and 'quá hạn' in (j.get('message') or ''), (c, j.get('message')))

    # D. Khoá hoàn toàn
    call('POST', f'/timesheets/lock?month={TARGET}&force=true', H)
    d = me()
    chk('D1 khoá → LOCKED', d['periodStatus'] == 'LOCKED', d['periodStatus'])
    c, j = call('POST', '/disputes', E, {'workDate': '2020-10-21', 'reason': 'matrix locked'})
    chk('D2 khoá → chặn khiếu nại hoàn toàn', c == 400 and 'khoá' in (j.get('message') or ''), (c, j.get('message')))

    # E. Khiếu nại PENDING của kỳ KHÁC không được chặn khoá kỳ này (regression).
    psql(f"update timesheets set status='draft', published_at=null, dispute_deadline=null, locked_at=null {OTHER_PERIOD}")
    c, j = call('POST', '/timesheets/publish?month=2020-09', H)
    chk('E1 chốt kỳ 09/2020', c == 200, (c, j.get('message')))
    # Mỗi ngày tối đa 2 đơn khiếu nại — dọn đơn còn sót của chính nhân viên test cho ngày hôm nay.
    psql("delete from timesheet_disputes where work_date='{}' and user_id="
         "(select id from users where employee_code='136ACT')".format(today.isoformat()))
    c, j = call('POST', '/disputes', E, {'workDate': today.isoformat(), 'reason': 'matrix cross-period'})
    chk('E2 tạo khiếu nại ở kỳ hiện tại', c == 200, (c, j.get('message')))
    other_id = j['data']['id'] if c == 200 else None
    c, j = call('POST', '/timesheets/lock?month=2020-09', H)
    chk('E3 khiếu nại kỳ khác KHÔNG chặn khoá', c == 200 and (j.get('data') or {}).get('status') == 'locked', (c, j.get('message')))
    if other_id: psql(f"delete from timesheet_disputes where id='{other_id}'")

    # F. Không được chốt kỳ đang chạy / tương lai
    c, j = call('POST', f'/timesheets/publish?month={cur_m}', H)
    chk('F1 chặn chốt kỳ đang chạy', c == 400 and 'kết thúc' in (j.get('message') or ''), (c, j.get('message')))
    c, j = call('POST', f'/timesheets/publish?month={nxt_m}', H)
    chk('F2 chặn chốt kỳ tương lai', c == 400 and 'kết thúc' in (j.get('message') or ''), (c, j.get('message')))
finally:
    # Khôi phục các kỳ test về MỞ để chạy lại được.
    psql(f"update timesheets set status='draft', published_at=null, dispute_deadline=null, locked_at=null {OLD_PERIOD}")
    psql(f"update timesheets set status='draft', published_at=null, dispute_deadline=null, locked_at=null {OTHER_PERIOD}")
    psql("delete from timesheet_disputes where work_date between '2020-09-01' and '2020-10-31'")
    print('\nKhôi phục kỳ test 09-10/2020 → draft (đang mở).')

print('ALL PERIOD STATE TESTS PASSED' if F == 0 else f'{F} FAILED')
sys.exit(1 if F else 0)
