#!/usr/bin/env python3
"""Chứng minh màn Cấu hình 'Kỳ công & khiếu nại' (rule payroll_period) THỰC SỰ được dùng:
publish_day · dispute_window_days · lock_delay_days · allow_adjust_after_lock.
Chạy: API_BASE=http://localhost:8080/api/v1 python3 tests/api/test_payroll_period_config.py
"""
import json, os, subprocess, sys, urllib.request
from datetime import date, timedelta
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

H = login('01HR')
orig = q("select current_value from rules where rule_key='payroll_period'")
orig_json = json.loads(orig)
def set_rule(**kv):
    v = dict(orig_json); v.update(kv)
    st, _ = call('PUT','/rules/payroll_period',H,{'currentValue': json.dumps(v), 'changeReason':'test payroll config','effectiveFrom': str(date.today())})
    assert st == 200

try:
    # 0. cấu hình được trả ra API/UI
    st, j = call('GET','/timesheets?month=2049-04', H)
    d = j['data']
    chk('C0 GET /timesheets trả đủ 4 cấu hình', st==200 and all(k in d for k in ('publishDay','disputeWindowDays','lockDelayDays','allowAdjustAfterLock')), d.keys())

    # 1. dispute_window_days điều khiển hạn khiếu nại khi công bố
    set_rule(dispute_window_days=5, allow_adjust_after_lock=False)
    st, j = call('POST','/timesheets/publish?month=2049-04', H)
    expected = (date.today() + timedelta(days=5)).isoformat()
    db_dl = q("select to_char(dispute_deadline,'YYYY-MM-DD') from timesheets where period_month=4 and period_year=2049 limit 1")
    chk('C1 window=5 → publish đặt hạn +5 ngày (DB)', db_dl == expected, f'{db_dl} vs {expected}')
    chk('C1b API trả disputeWindowDays=5', call('GET','/timesheets?month=2049-04',H)[1]['data']['disputeWindowDays']==5)

    # 2. allow_adjust_after_lock điều khiển sửa ô sau khoá
    call('POST','/timesheets/lock?month=2049-04', H)
    st, j = call('POST','/timesheets/cell?month=2049-04', H, {'employeeCode':'136ACT','day':5,'symbol':'1.00','reason':'test locked'})
    chk('C2 locked + allow=false → chặn sửa ô', st==400 and 'khoá' in (j.get('message') or ''), (st, j.get('message')))
    set_rule(allow_adjust_after_lock=True)
    st, j = call('POST','/timesheets/cell?month=2049-04', H, {'employeeCode':'136ACT','day':5,'symbol':'1.00','reason':'test allowed after lock'})
    chk('C3 locked + allow=true → cho sửa ô', st==200, (st, j.get('message')))
    set_rule(allow_adjust_after_lock=False)

    # 3. lock_delay_days điều khiển tự khoá
    call('POST','/timesheets/publish?month=2049-05', H)
    psql("update timesheets set published_at = now() - interval '10 day' where period_month=5 and period_year=2049")
    set_rule(lock_delay_days=3)
    st, j = call('POST','/timesheets/auto-lock', H)
    st5 = q("select status from timesheets where period_month=5 and period_year=2049 limit 1")
    chk('C4 quá lock_delay_days → auto-lock khoá kỳ', st==200 and st5=='locked', st5)

    # 4. publish_day điều khiển tự công bố
    set_rule(publish_day=1)
    st, j = call('POST','/timesheets/auto-publish?month=2049-06', H)
    chk('C5 publish_day=1 (hôm nay≥1) → auto-publish công bố', st==200 and (j.get('data') or {}).get('published') is True, j.get('data'))
    # Tháng hiện tại: publish_day=28 > hôm nay → không tự công bố (tạm draft rồi khôi phục)
    set_rule(publish_day=28)
    psql("update timesheets set status='draft', published_at=null, dispute_deadline=null, locked_at=null "
         "where period_month=11 and period_year=2026")
    st, j = call('POST','/timesheets/auto-publish?month=2026-11', H)
    chk('C6 publish_day=28 > hôm nay → chưa công bố', st==200 and (j.get('data') or {}).get('published') is False, j.get('data'))
    psql("update timesheets set status='published', published_at=now(), "
         "dispute_deadline=(now()+interval '2 day')::date + time '23:59', locked_at=null "
         "where period_month=11 and period_year=2026")
finally:
    call('PUT','/rules/payroll_period',H,{'currentValue': orig, 'changeReason':'khôi phục cấu hình gốc sau test','effectiveFrom': str(date.today())})
    psql("delete from timesheet_cells where timesheet_id in (select id from timesheets where period_year=2049)")
    psql("delete from timesheets where period_year=2049")
    print('\nĐã khôi phục rule payroll_period và dọn dữ liệu 2049.')

print('ALL PAYROLL PERIOD CONFIG TESTS PASSED' if F==0 else f'{F} FAILED')
sys.exit(1 if F else 0)
