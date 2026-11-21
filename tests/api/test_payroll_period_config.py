#!/usr/bin/env python3
"""Chứng minh 4 cấu hình 'Kỳ công & khiếu nại' THỰC SỰ có hiệu lực:
close_day · dispute_window_days · lock_delay_days · allow_adjust_after_lock.
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
# Dọn khiếu nại PENDING còn sót từ các bộ test trước để không chặn khoá kỳ.
psql("update timesheet_disputes set status='REJECTED', resolved_at=now() where status='PENDING'")
orig = q("select current_value from rules where rule_key='payroll_period'")
orig_json = json.loads(orig)
def set_rule(**kv):
    v = dict(orig_json); v.update(kv)
    st, _ = call('PUT','/rules/payroll_period',H,{'currentValue': json.dumps(v), 'changeReason':'test payroll config','effectiveFrom': str(date.today())})
    assert st == 200

try:
    st, j = call('GET','/timesheets?month=2024-04', H); d = j['data']
    chk('C0 GET /timesheets trả đủ 4 cấu hình', st==200 and all(k in d for k in ('closeDay','disputeWindowDays','lockDelayDays','allowAdjustAfterLock')), d.keys())

    # 1. dispute_window_days → hạn khiếu nại sau khi chốt
    set_rule(dispute_window_days=5, allow_adjust_after_lock=False)
    call('POST','/timesheets/publish?month=2024-04', H)
    expected = (date.today() + timedelta(days=5)).isoformat()
    db_dl = q("select to_char(dispute_deadline,'YYYY-MM-DD') from timesheets where period_month=4 and period_year=2024 limit 1")
    chk('C1 window=5 → hạn khiếu nại = hôm nay +5 (DB)', db_dl == expected, f'{db_dl} vs {expected}')

    # 2. allow_adjust_after_lock → HR sửa ô sau khoá (luôn bắt buộc lý do + audit)
    call('POST','/timesheets/lock?month=2024-04', H)
    st, j = call('POST','/timesheets/cell?month=2024-04', H, {'employeeCode':'136ACT','day':5,'symbol':'1.00','reason':'test locked'})
    chk('C2 allow=false → chặn sửa ô sau khoá', st==400, (st, j.get('message')))
    set_rule(allow_adjust_after_lock=True)
    st, j = call('POST','/timesheets/cell?month=2024-04', H, {'employeeCode':'136ACT','day':5,'symbol':'1.00','reason':'HR điều chỉnh sau khoá (có lý do)'})
    chk('C3 allow=true → HR sửa được sau khoá', st==200, (st, j.get('message')))
    set_rule(allow_adjust_after_lock=False)

    # 3. lock_delay_days → tự khoá sau hạn khiếu nại
    call('POST','/timesheets/publish?month=2024-05', H)
    psql("update timesheets set dispute_deadline = now() - interval '1 day', published_at = now() - interval '5 day' "
         "where period_month=5 and period_year=2024")
    set_rule(lock_delay_days=0)
    st, j = call('POST','/timesheets/auto-lock', H)
    st5 = q("select status from timesheets where period_month=5 and period_year=2024 limit 1")
    chk('C4 hết hạn khiếu nại (+0 ân hạn) → auto-lock khoá kỳ', st==200 and st5=='locked', st5)

    # 3b. Guard trạng thái: không chốt lại kỳ đã khoá; không khoá kỳ chưa chốt
    c,j=call('POST','/timesheets/publish?month=2024-04',H)
    chk('C4a chốt lại kỳ đã khoá bị chặn', c==400 and 'khoá' in (j.get('message') or ''), (c,j.get('message')))
    c,j=call('POST','/timesheets/lock?month=2024-07',H)
    chk('C4b khoá kỳ chưa chốt bị chặn', c==400 and 'chưa chốt' in (j.get('message') or ''), (c,j.get('message')))

    # 4. close_day → tự chốt kỳ trước
    set_rule(close_day=1)
    st, j = call('POST','/timesheets/auto-close?month=2024-06', H)
    st6 = q("select status from timesheets where period_month=6 and period_year=2024 limit 1")
    chk('C5 close_day → auto-close chốt kỳ chỉ định', st==200 and st6=='published', (j.get('data'), st6))
    set_rule(close_day=28)
    st, j = call('POST','/timesheets/auto-close', H)
    chk('C6 close_day=28 > hôm nay → chưa tự chốt kỳ trước', st==200 and (j.get('data') or {}).get('closed') is False, j.get('data'))
finally:
    call('PUT','/rules/payroll_period',H,{'currentValue': orig, 'changeReason':'khôi phục cấu hình gốc sau test','effectiveFrom': str(date.today())})
    psql("delete from timesheet_cells where timesheet_id in (select id from timesheets where period_year=2024)")
    psql("delete from timesheets where period_year=2024")
    print('\nĐã khôi phục rule payroll_period và dọn dữ liệu 2024.')

print('ALL PAYROLL PERIOD CONFIG TESTS PASSED' if F==0 else f'{F} FAILED')
sys.exit(1 if F else 0)
