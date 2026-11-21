#!/usr/bin/env python3
"""Ma trận trạng thái kỳ công theo mô hình KỲ MỞ:
  OPEN (kỳ đang chạy) → nhân viên khiếu nại được ngay
  DISPUTABLE (đã chốt, còn cửa sổ) → khiếu nại được
  EXPIRED (quá hạn sau chốt) → chặn
  LOCKED (khoá hoàn toàn) → chặn
Chạy: API_BASE=http://localhost:8080/api/v1 python3 tests/api/test_period_state_matrix.py
"""
import json, os, subprocess, sys, urllib.request
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
me = lambda: call('GET', '/attendance/my-timesheet?month=2026-11', E)[1]['data']
NOV = "where period_month=11 and period_year=2026"

try:
    # A. Kỳ đang MỞ (draft) → khiếu nại được ngay, KHÔNG cần công bố
    psql(f"update timesheets set status='draft', published_at=null, dispute_deadline=null, locked_at=null {NOV}")
    d = me()
    chk('A1 kỳ đang mở → periodStatus=OPEN', d['periodStatus'] == 'OPEN', d['periodStatus'])
    chk('A2 kỳ đang mở → canDispute=true', d['canDispute'] is True)
    c, j = call('POST', '/disputes', E, {'workDate': '2026-11-21', 'reason': 'matrix open'})
    chk('A3 kỳ đang mở → tạo khiếu nại được ngay', c == 200, (c, j.get('message')))
    if c == 200: psql(f"delete from timesheet_disputes where id='{j['data']['id']}'")

    # B. Chốt kỳ → mở cửa sổ, hạn đúng DB
    c, j = call('POST', '/timesheets/publish?month=2026-11', H)
    chk('B1 chốt kỳ (publish) thành công', c == 200, (c, j.get('message')))
    db_deadline = q("select to_char(dispute_deadline,'YYYY-MM-DD') from timesheets where period_month=11 and period_year=2026 limit 1")
    d = me()
    chk('B2 sau chốt → DISPUTABLE', d['periodStatus'] == 'DISPUTABLE', d['periodStatus'])
    chk('B3 canDispute=true trong cửa sổ', d['canDispute'] is True)
    chk('B4 hạn hiển thị = hạn trong DB', str(d.get('disputeDeadline')) == db_deadline, f"{d.get('disputeDeadline')} vs {db_deadline}")
    c, j = call('POST', '/disputes', E, {'workDate': '2026-11-21', 'reason': 'matrix disputable'})
    chk('B5 trong cửa sổ → tạo được', c == 200, (c, j.get('message')))
    if c == 200: psql(f"delete from timesheet_disputes where id='{j['data']['id']}'")

    # C. Quá hạn cửa sổ
    psql(f"update timesheets set dispute_deadline = now() - interval '1 day' {NOV}")
    d = me()
    chk('C1 quá hạn → EXPIRED', d['periodStatus'] == 'EXPIRED', d['periodStatus'])
    chk('C2 quá hạn → canDispute=false', d['canDispute'] is False)
    c, j = call('POST', '/disputes', E, {'workDate': '2026-11-21', 'reason': 'matrix expired'})
    chk('C3 quá hạn → chặn khiếu nại', c == 400 and 'quá hạn' in (j.get('message') or ''), (c, j.get('message')))

    # D. Khoá hoàn toàn
    call('POST', '/timesheets/lock?month=2026-11&force=true', H)
    d = me()
    chk('D1 khoá → LOCKED', d['periodStatus'] == 'LOCKED', d['periodStatus'])
    c, j = call('POST', '/disputes', E, {'workDate': '2026-11-21', 'reason': 'matrix locked'})
    chk('D2 khoá → chặn khiếu nại hoàn toàn', c == 400 and 'khoá' in (j.get('message') or ''), (c, j.get('message')))
finally:
    # Khôi phục: tháng hiện tại trở về trạng thái MỞ như vận hành bình thường.
    psql(f"update timesheets set status='draft', published_at=null, dispute_deadline=null, locked_at=null {NOV}")
    print('\nKhôi phục kỳ 11/2026 → draft (đang mở).')

print('ALL PERIOD STATE TESTS PASSED' if F == 0 else f'{F} FAILED')
sys.exit(1 if F else 0)
