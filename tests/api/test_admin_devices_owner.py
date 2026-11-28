"""HR thấy thiết bị "của ai" + loại thiết bị khi duyệt (S11/S28).

Trước đây GET /admin/devices chỉ trả userId nên HR không biết thiết bị thuộc
nhân viên nào; loại thiết bị cũng chỉ đoán từ tên máy. Test này đăng ký 2 máy
với User-Agent iPhone và Windows rồi kiểm tra HR nhận được:
  - ownerName / employeeCode / teamName của chủ sở hữu,
  - deviceType + osVersion suy ra từ User-Agent,
  - requestReason do nhân viên nhập,
  - các key cũ vẫn còn (backward compatible),
  - thứ tự nhóm: chờ duyệt → đang hoạt động → đã thu hồi.

Chạy: python3 tests/api/test_admin_devices_owner.py
"""
import json, os, urllib.request, urllib.error, sys, subprocess

B = os.environ.get('API_BASE', 'http://localhost:8080/api/v1')
PREFIX = 'FP-OWNER-'
REASON = 'FP-OWNER lý do xin thêm máy'

UA_IPHONE = ('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) '
             'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 '
             'Mobile/15E148 Safari/604.1')
UA_WINDOWS = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
              'AppleWebKit/537.36 (KHTML, like Gecko) '
              'Chrome/120.0.0.0 Safari/537.36')


def call(method, path, token=None, body=None, expect=None, headers=None):
    req = urllib.request.Request(B + path, method=method)
    req.add_header('Content-Type', 'application/json')
    if token:
        req.add_header('Authorization', 'Bearer ' + token)
    for k, v in (headers or {}).items():
        req.add_header(k, v)
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
    return j['data']


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


def register(token, fingerprint, name, ua):
    c, j = call('POST', '/devices/request', token,
                {'fingerprint': fingerprint, 'deviceName': name, 'reason': REASON,
                 'wifiBssid': 'ACT_OFFICE'},
                headers={'User-Agent': ua, 'X-Office-Network': 'true'}, expect=200)
    return j['data']['id']


def rank(d):
    if d.get('revokedAt'):
        return 2
    return 1 if d.get('isApproved') else 0


cleanup()
E = login('136ACT')
H = login('01HR')

fp_mobile = PREFIX + 'MOBILE'
fp_desktop = PREFIX + 'DESKTOP'
did_mobile = register(E['accessToken'], fp_mobile, 'Web Device', UA_IPHONE)
did_desktop = register(E['accessToken'], fp_desktop, 'Windows PC Chrome', UA_WINDOWS)

c, j = call('GET', '/admin/devices', H['accessToken'], expect=200)
rows = {d['deviceFingerprint']: d for d in j['data']}
check('HR thấy cả hai thiết bị vừa đăng ký', fp_mobile in rows and fp_desktop in rows, list(rows))

mob, desk = rows[fp_mobile], rows[fp_desktop]

# ── Chủ sở hữu ─────────────────────────────────────────────────
check('Có ownerName đúng nhân viên đăng ký', mob.get('ownerName') == E.get('fullName'),
      {'ownerName': mob.get('ownerName'), 'expected': E.get('fullName'), 'row': mob})
check('Có employeeCode của chủ sở hữu', mob.get('employeeCode') == '136ACT', mob.get('employeeCode'))
check('Có trường teamName (có thể null nếu chưa xếp nhóm)', 'teamName' in mob, mob)

# ── Loại thiết bị suy ra từ User-Agent ─────────────────────────
check('iPhone → deviceType MOBILE', mob.get('deviceType') == 'MOBILE', mob.get('deviceType'))
check('iPhone → osVersion chứa iOS', 'iOS' in (mob.get('osVersion') or ''), mob.get('osVersion'))
check('Tên máy generic được thay bằng tên suy ra từ UA',
      'Safari' in (mob.get('deviceModel') or ''), mob.get('deviceModel'))
check('Windows → deviceType DESKTOP', desk.get('deviceType') == 'DESKTOP', desk.get('deviceType'))
check('Windows → osVersion chứa Windows', 'Windows' in (desk.get('osVersion') or ''), desk.get('osVersion'))

# ── Lý do nhân viên nhập được lưu trên thiết bị ────────────────
check('requestReason lưu đúng nội dung nhân viên nhập', mob.get('requestReason') == REASON,
      mob.get('requestReason'))

# ── Backward compatible: đủ key cũ để client/test cũ không vỡ ──
legacy = ('id', 'userId', 'deviceFingerprint', 'deviceModel', 'osVersion', 'isApproved',
          'grantDays', 'expiresAt', 'revokedAt', 'lastActiveAt', 'createdAt')
missing = [k for k in legacy if k not in mob]
check('Response vẫn giữ đủ key cũ', not missing, missing)
check('id trả về đúng thiết bị', str(mob.get('id')) == str(did_mobile))
check('id thiết bị desktop đúng', str(desk.get('id')) == str(did_desktop))

# ── Thứ tự: chờ duyệt → đang hoạt động → đã thu hồi ────────────
ranks = [rank(d) for d in j['data']]
check('Danh sách sắp xếp chờ duyệt trước, thu hồi sau', ranks == sorted(ranks), ranks)

# ── Nhân viên vẫn xem được thiết bị của mình ───────────────────
c, j = call('GET', '/devices', E['accessToken'], expect=200)
mine = next((d for d in j['data'] if d['id'] == did_mobile), None)
check('Nhân viên vẫn thấy thiết bị của mình', mine is not None)
check('Response nhân viên có thêm deviceType (additive)',
      mine is not None and mine.get('deviceType') == 'MOBILE', mine)

# ── Trùng fingerprint: báo rõ đang thuộc ai, không hứa "chờ HR duyệt" ──
O = login('138ACT')
c, j = call('POST', '/devices/request', O['accessToken'],
            {'fingerprint': fp_mobile, 'deviceName': 'Máy của người khác', 'reason': REASON,
             'wifiBssid': 'ACT_OFFICE'},
            headers={'X-Office-Network': 'true'})
msg = str(j.get('message'))
check('Trùng thiết bị trả 409 CONFLICT', c == 409, (c, j))
check('Thông báo nêu rõ chủ sở hữu hiện tại', E['fullName'] in msg and '136ACT' in msg, msg)
check('Thông báo không gợi ý "chờ HR duyệt"', 'HR duyệt' not in msg, msg)
check('Xung đột không tạo thêm hàng thiết bị nào',
      psql(f"select count(*) from devices where device_fingerprint='{fp_mobile}'") == '1')

cleanup()
print('OK — tất cả kiểm tra thiết bị/chủ sở hữu đều đạt')
