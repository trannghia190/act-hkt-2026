"""Nhân viên tự xóa thiết bị trong "Thiết bị của tôi" (S27).

Nhân viên xóa được MỌI thiết bị thuộc tài khoản mình:
  - máy đang chờ duyệt  → hủy yêu cầu,
  - máy đã được duyệt   → tự thu hồi, máy đó không chấm công được nữa,
  - máy đã bị HR thu hồi → dọn khỏi danh sách.
Nhưng không xóa được thiết bị của người khác, và mọi lần xóa đều để lại audit
(CANCEL_DEVICE_REQUEST cho máy chờ duyệt, DELETE_DEVICE cho máy đã duyệt/thu hồi).
Chạy: python3 tests/api/test_device_pending_cancel.py
"""
import json, urllib.request, urllib.error, sys, subprocess

B = 'http://localhost:8080/api/v1'
PREFIX = 'FP-DELETE-'


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
    c, j = call('POST', '/auth/login', body={'employeeCodeOrEmail': code, 'password': '123456'}, expect=200)
    return j['data']['accessToken']


def check(name, cond, extra=''):
    print(('PASS ' if cond else 'FAIL ') + name + ((' — ' + str(extra)[:400]) if extra and not cond else ''))
    if not cond:
        sys.exit(1)


def psql(sql):
    return subprocess.run(
        ['psql', '-h', '127.0.0.1', '-U', subprocess.check_output(['whoami']).decode().strip(),
         '-d', 'pulse_db', '-tAc', sql], capture_output=True, text=True).stdout.strip()


def cleanup():
    psql(f"delete from devices where device_fingerprint like '{PREFIX}%'")
    psql(f"delete from audit_logs where reason like '%{PREFIX}%'")


def register(token, fingerprint, name):
    c, j = call('POST', '/devices/request', token,
                {'fingerprint': fingerprint, 'deviceName': name, 'reason': 'ZZ test xóa thiết bị',
                 'wifiBssid': 'ACT_OFFICE'}, expect=200)
    return j['data']['id']


def device_rows(fingerprint):
    return psql(f"select count(*) from devices where device_fingerprint='{fingerprint}'")


cleanup()
E = login('136ACT')
O = login('138ACT')   # người khác
H = login('01HR')

# ── 1. Máy đang chờ duyệt: hủy yêu cầu ─────────────────────────
fp = PREFIX + 'PENDING'
did = register(E, fp, 'Máy test chờ duyệt')
c, j = call('GET', '/devices', E, expect=200)
mine = [d for d in j['data'] if d['id'] == did]
check('Yêu cầu mới nằm trong danh sách thiết bị của tôi', len(mine) == 1 and mine[0]['isApproved'] is False, mine)

c, j = call('DELETE', f'/devices/{did}', O)
check('Người khác không xóa được thiết bị của tôi', c == 400 and 'Không tìm thấy' in str(j.get('message')), (c, j))
check('Thiết bị vẫn còn sau khi người khác thử xóa', device_rows(fp) == '1')

c, j = call('DELETE', f'/devices/{did}', E, expect=200)
data = j.get('data', {})
check('Chủ thiết bị hủy được yêu cầu PENDING',
      data.get('deleted') is True and data.get('cancelled') is True
      and data.get('previousStatus') == 'PENDING', data)
check('Hàng thiết bị PENDING đã bị xóa khỏi DB', device_rows(fp) == '0')

c, j = call('DELETE', f'/devices/{did}', E)
check('Xóa lại lần hai bị từ chối', c == 400 and 'Không tìm thấy' in str(j.get('message')), (c, j))

check('Có audit CANCEL_DEVICE_REQUEST kèm mã thiết bị',
      psql(f"select count(*) from audit_logs where action='CANCEL_DEVICE_REQUEST' and reason like '%{fp}%'") == '1')

# ── 2. Máy đã duyệt: nhân viên tự thu hồi (xóa) ────────────────
fp2 = PREFIX + 'ACTIVE'
did2 = register(E, fp2, 'Máy test đã duyệt')
call('POST', f'/admin/devices/{did2}/approve', H, {}, expect=200)
c, j = call('GET', '/devices', E, expect=200)
row = next((d for d in j['data'] if d['id'] == did2), None)
check('Thiết bị đã được HR duyệt', row is not None and row['isApproved'] is True, row)

c, j = call('DELETE', f'/devices/{did2}', E, expect=200)
data = j.get('data', {})
check('Chủ thiết bị xóa được thiết bị ĐÃ DUYỆT',
      data.get('deleted') is True and data.get('cancelled') is False
      and data.get('previousStatus') == 'ACTIVE', data)
check('Hàng thiết bị đã duyệt bị xóa khỏi DB', device_rows(fp2) == '0')
check('Có audit DELETE_DEVICE (old_value=ACTIVE)',
      psql(f"select old_value from audit_logs where action='DELETE_DEVICE' and reason like '%{fp2}%'") == 'ACTIVE')

# Máy đã bị xóa thì không chấm công được nữa (lớp THIẾT BỊ chặn)
c, j = call('POST', '/attendance/check-in', E,
            {'type': 'CHECK_IN', 'deviceFingerprint': fp2})
layers = (j.get('data') or {}).get('layers') or []
device_layer = next((l for l in layers if l.get('layer') == 'DEVICE'), None)
check('Chấm công bằng thiết bị đã xóa bị chặn ở lớp THIẾT BỊ',
      device_layer is not None and device_layer.get('passed') is False,
      {'rejectReason': (j.get('data') or {}).get('rejectReason'), 'deviceLayer': device_layer})

# ── 3. Máy đã bị HR thu hồi: nhân viên dọn khỏi danh sách ──────
fp3 = PREFIX + 'REVOKED'
did3 = register(E, fp3, 'Máy test thu hồi')
call('POST', f'/admin/devices/{did3}/approve', H, {}, expect=200)
call('POST', f'/admin/devices/{did3}/revoke', H, {'reason': 'ZZ test thu hồi'}, expect=200)
c, j = call('GET', '/devices', E, expect=200)
row = next((d for d in j['data'] if d['id'] == did3), None)
check('Thiết bị bị thu hồi có revokedAt trong API', row is not None and row.get('revokedAt'), row)

c, j = call('DELETE', f'/devices/{did3}', E, expect=200)
data = j.get('data', {})
check('Nhân viên xóa được thiết bị đã bị thu hồi',
      data.get('deleted') is True and data.get('previousStatus') == 'REVOKED', data)
check('Hàng thiết bị thu hồi bị xóa khỏi DB', device_rows(fp3) == '0')
check('Có audit DELETE_DEVICE (old_value=REVOKED)',
      psql(f"select old_value from audit_logs where action='DELETE_DEVICE' and reason like '%{fp3}%'") == 'REVOKED')

cleanup()
print('\nALL DEVICE DELETE CHECKS PASSED')
