#!/usr/bin/env python3
"""Ma trận trạng thái kỳ công (S11) — chặn tái phát 2 lỗi từng xảy ra:
  1) Kỳ `draft` bị hiển thị như `LOCKED` ("đã chốt và khoá").
  2) Hạn khiếu nại bị tự suy từ ngày 11+2 thay vì `timesheets.dispute_deadline`
     (vừa công bố đã báo "hết hạn").

Chạy: API_BASE=http://localhost:8080/api/v1 python3 tests/api/test_period_state_matrix.py
"""
import json, os, subprocess, sys, urllib.request
B = os.environ.get('API_BASE', 'http://localhost:8080/api/v1')
USER = subprocess.check_output(['whoami']).decode().strip()

def call(method, path, token=None, body=None):
    req = urllib.request.Request(B + path, method=method)
    req.add_header('Content-Type', 'application/json')
    if token: req.add_header('Authorization', 'Bearer ' + token)
    data = json.dumps(body).encode() if body is not None else None
    try:
        r = urllib.request.urlopen(req, data=data, timeout=20)
        return r.status, json.loads(r.read() or b'{}')
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b'{}')

def login(c):
    _, j = call('POST', '/auth/login', body={'employeeCodeOrEmail': c, 'password': '123456'})
    return j['data']['accessToken']

def psql(sql):
    subprocess.run(['psql', '-h', '127.0.0.1', '-p', '5432', '-U', USER, '-d', 'pulse_db', '-c', sql], capture_output=True)

def db_sheet():
    out = subprocess.check_output(['psql', '-h', '127.0.0.1', '-p', '5432', '-U', USER, '-d', 'pulse_db', '-tAc',
        "select status||'|'||coalesce(to_char(dispute_deadline,'YYYY-MM-DD'),'-') from timesheets "
        "where period_month=11 and period_year=2026 and user_id=(select id from users where employee_code='136ACT') limit 1"]).decode().strip()
    st, dl = out.split('|')
    return st, dl

FAILED = 0
def chk(name, cond, extra=''):
    global FAILED
    print(('PASS ' if cond else 'FAIL ') + name + ('' if cond else ' :: ' + str(extra)[:300]))
    if not cond: FAILED += 1

H, E = login('01HR'), login('136ACT')
me = lambda: call('GET', '/attendance/my-timesheet?month=2026-11', E)[1]['data']
F = ("where period_month=11 and period_year=2026 and user_id="
     "(select id from users where employee_code='136ACT')")

try:
    psql(f"update timesheets set status='draft', published_at=null, dispute_deadline=null, locked_at=null {F}")
    d = me()
    chk('A1 draft → periodStatus=DRAFT (không phải LOCKED)', d['periodStatus'] == 'DRAFT', d['periodStatus'])
    chk('A2 draft → canDispute=false', d['canDispute'] is False)
    c, j = call('POST', '/disputes', E, {'workDate': '2026-11-21', 'reason': 'matrix draft'})
    chk('A3 draft → chặn tạo khiếu nại (chưa công bố)', c == 400 and 'công bố' in (j.get('message') or ''), (c, j.get('message')))

    psql(f"update timesheets set status='draft', published_at=null, dispute_deadline=null {F}")
    c, j = call('POST', '/timesheets/publish?month=2026-11', H)
    chk('B1 publish API thành công', c == 200, (c, j.get('message')))
    _, db_deadline = db_sheet()
    d = me()
    chk('B2 vừa công bố → DISPUTABLE (không EXPIRED)', d['periodStatus'] == 'DISPUTABLE', d['periodStatus'])
    chk('B3 canDispute=true', d['canDispute'] is True)
    chk('B4 hạn hiển thị = hạn trong DB (không tự suy ngày 11+2)',
        str(d.get('disputeDeadline')) == db_deadline, f"{d.get('disputeDeadline')} vs {db_deadline}")
    c, j = call('POST', '/disputes', E, {'workDate': '2026-11-21', 'reason': 'matrix published'})
    chk('B5 đang trong cửa sổ → tạo khiếu nại OK', c == 200, (c, j.get('message')))
    if c == 200:
        psql(f"delete from timesheet_disputes where id='{j['data']['id']}'")

    psql(f"update timesheets set dispute_deadline = now() - interval '1 day' {F}")
    d = me()
    chk('C1 quá hạn → EXPIRED', d['periodStatus'] == 'EXPIRED', d['periodStatus'])
    chk('C2 quá hạn → canDispute=false', d['canDispute'] is False)
    c, j = call('POST', '/disputes', E, {'workDate': '2026-11-21', 'reason': 'matrix expired'})
    chk('C3 quá hạn → chặn tạo khiếu nại', c == 400 and 'quá hạn' in (j.get('message') or ''), (c, j.get('message')))

    call('POST', '/timesheets/lock?month=2026-11&force=true', H)
    d = me()
    chk('D1 locked → LOCKED', d['periodStatus'] == 'LOCKED', d['periodStatus'])
    chk('D2 locked → canDispute=false', d['canDispute'] is False)
finally:
    # Bước D khoá CẢ kỳ nên phải khôi phục toàn bộ dòng của tháng, không chỉ của 136ACT.
    psql("update timesheets set status='published', published_at=now(), "
         "dispute_deadline=(now() + interval '2 day')::date + time '23:59', locked_at=null "
         "where period_month=11 and period_year=2026")
    print('\nKhôi phục kỳ 11/2026 → published, hạn +2 ngày.')

print('ALL PERIOD STATE TESTS PASSED' if FAILED == 0 else f'{FAILED} FAILED')
sys.exit(1 if FAILED else 0)
