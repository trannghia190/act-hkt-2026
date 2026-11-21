"""Kiểm tra cấu hình "Quản lý loại nghỉ" (S32) có hiệu lực thật:
   thêm/sửa loại nghỉ → đơn nghỉ dùng ngay (hạn gửi, giấy tờ, đơn vị, tắt loại),
   trừ/không trừ quỹ phép theo deductsAnnualLeave, defaultDays hiển thị ở sổ phép,
   và chỉ xóa được loại HR tự thêm (master data chỉ được tắt).
   Chạy: python3 tests/api/test_leave_types_config.py
"""
import json, urllib.request, urllib.error, sys, subprocess

B = 'http://localhost:8080/api/v1'
PFX = 'ZZ'


def call(method, path, token=None, body=None):
    req = urllib.request.Request(B + path, method=method)
    req.add_header('Content-Type', 'application/json')
    if token:
        req.add_header('Authorization', 'Bearer ' + token)
    data = json.dumps(body).encode() if body is not None else None
    try:
        r = urllib.request.urlopen(req, data=data, timeout=20)
        return r.status, json.loads(r.read() or b'{}')
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b'{}')


def ok(method, path, token=None, body=None):
    c, j = call(method, path, token, body)
    if c not in (200, 201):
        print(f"FAIL {method} {path}: HTTP {c} {str(j)[:300]}")
        sys.exit(1)
    return j


def must_fail(method, path, token=None, body=None, needle=''):
    c, j = call(method, path, token, body)
    if c in (200, 201):
        print(f"FAIL {method} {path}: expected error but got {c} {str(j)[:300]}")
        sys.exit(1)
    msg = str(j.get('message') or j.get('error') or j)
    if needle and needle.lower() not in msg.lower():
        print(f"FAIL {method} {path}: error message lacks '{needle}' — {msg[:300]}")
        sys.exit(1)
    return msg


def login(code):
    return ok('POST', '/auth/login', body={'employeeCodeOrEmail': code, 'password': '123456'})['data']['accessToken']


def check(name, cond, extra=''):
    print(('PASS ' if cond else 'FAIL ') + name + ((' — ' + str(extra)[:400]) if extra and not cond else ''))
    if not cond:
        sys.exit(1)


def psql(sql):
    return subprocess.run(
        ['psql', '-h', '127.0.0.1', '-U', subprocess.check_output(['whoami']).decode().strip(),
         '-d', 'pulse_db', '-tAc', sql], capture_output=True, text=True).stdout.strip()


def cleanup():
    psql("delete from leave_ledger where leave_type like 'ZZ%'")
    psql("delete from requests where reason like 'ZZ leave cfg%'")
    psql("delete from leave_types where code like 'ZZ%'")


def type_of(code, types):
    return next((t for t in types if t.get('code') == code), None)


def bal(token):
    b = ok('GET', '/leaves/my-balance', token)['data']
    # Tổng còn lại (kể cả phép tồn) — dùng để đo tác động trừ quỹ của loại nghỉ.
    return float(b.get('remaining') or 0), b


def make_type(code, **kw):
    body = {'code': code, 'name': 'ZZ ' + code, 'defaultDays': None, 'requiresAttachment': False,
            'isActive': True, 'isPaid': True, 'deductsAnnualLeave': False, 'unit': 'DAY',
            'submitWithinDays': 30}
    body.update(kw)
    return ok('POST', '/admin/leave-types', H, body)['data']


def update_type(code, **kw):
    return ok('PUT', f'/admin/leave-types/{code}', H, kw)['data']


def leave(token, code, day, reason, payload='{}'):
    return ok('POST', '/requests', token, {'type': 'LEAVE', 'leaveType': code, 'workDate': day,
                                           'endDate': day, 'reason': reason, 'payload': payload})['data']


cleanup()
H = login('01HR')
E = login('ACT0042')

# ── 0. Thiết lập mặc định của master data đúng quy định §2.3 ─────────
master = ok('GET', '/admin/leave-types', H)['data']
al = type_of('AL', master)
check('Phép năm (AL) mặc định TRỪ quỹ phép năm', al.get('deductsAnnualLeave') is True, al.get('deductsAnnualLeave'))
check('Phép năm (AL): 12 ngày/năm, ngày/nửa ngày, hạn nộp 3 ngày, không cần giấy tờ',
      float(al.get('defaultDays') or 0) == 12 and al.get('unit') == 'HALF_DAY'
      and int(al.get('submitWithinDays') or 0) == 3 and al.get('requiresAttachment') is False, al)
s = type_of('S', master)
check('Nghỉ ốm (S): bắt buộc giấy khám, không trừ phép năm',
      s.get('requiresAttachment') is True and s.get('deductsAnnualLeave') is False, s)
check('Các loại nghỉ chế độ không trừ phép năm',
      all(type_of(c, master).get('deductsAnnualLeave') is False
          for c in ('NL', 'RO', 'CL', 'ML', 'PL', 'UP', 'HIEU', 'TANG')), None)
check('Nghỉ không lương / thai sản nam: không hưởng lương',
      type_of('UP', master).get('isPaid') is False
      and type_of('ML_NAM', master).get('isPaid') is False
      and type_of('PL', master).get('isPaid') is False, None)
check('Tang gia được báo gấp trong ngày (0 ngày)', int(type_of('TANG', master).get('submitWithinDays')) == 0,
      type_of('TANG', master).get('submitWithinDays'))
check('Hiếu hỉ: 3 ngày, không giấy tờ, không trừ phép năm',
      float(type_of('HIEU', master).get('defaultDays') or 0) == 3
      and type_of('HIEU', master).get('requiresAttachment') is False, type_of('HIEU', master))

# ── 1. HR tự thêm loại nghỉ → không phải master data ─────────────────
t = make_type('ZZDED', defaultDays=7, deductsAnnualLeave=True)
check('Loại HR tự thêm được đánh dấu không phải master data', t.get('isSystem') is False, t.get('isSystem'))
check('Mã/tên trả về đúng dữ liệu vừa tạo', t.get('code') == 'ZZDED' and t.get('defaultDays') == 7, t)

# ── 2. deductsAnnualLeave: duyệt đơn trừ quỹ phép ngay ───────────────
b0, _ = bal(E)
r = leave(E, 'ZZDED', '2026-12-03', 'ZZ leave cfg deduct')
ok('POST', f"/requests/{r['id']}/approve", H, {'comment': 'ZZ leave cfg'})
b1, full = bal(E)
check('Duyệt đơn loại trừ quỹ phép → quỹ giảm 1 ngày', abs((b0 - b1) - 1.0) < 1e-6, (b0, b1))
bt = type_of('ZZDED', full.get('byType') or [])
check('Sổ phép theo loại: defaultDays lấy từ cấu hình (7)', bt and float(bt.get('defaultDays') or 0) == 7, bt)
check('Sổ phép theo loại: đã dùng 1 ngày', bt and float(bt.get('used') or 0) == 1, bt)

# Đổi cờ trừ quỹ phép → quỹ được tính lại ngay theo cấu hình mới
update_type('ZZDED', deductsAnnualLeave=False)
b2, _ = bal(E)
check('Tắt "trừ quỹ phép" → quỹ hoàn lại 1 ngày', abs((b2 - b0)) < 1e-6, (b0, b2))
update_type('ZZDED', deductsAnnualLeave=True)
b3, _ = bal(E)
check('Bật lại "trừ quỹ phép" → quỹ trừ lại 1 ngày', abs((b3 - b1)) < 1e-6, (b1, b3))

# ── 3. Sửa defaultDays / tên → hiển thị mới ──────────────────────────
update_type('ZZDED', defaultDays=9, name='ZZ Phép cấu hình mới')
_, full = bal(E)
bt = type_of('ZZDED', full.get('byType') or [])
check('Sửa defaultDays → sổ phép hiển thị 9', bt and float(bt.get('defaultDays') or 0) == 9, bt)
pub = ok('GET', '/leave-types', E)['data']
check('Sửa tên → danh sách loại nghỉ hiển thị tên mới',
      type_of('ZZDED', pub).get('name') == 'ZZ Phép cấu hình mới', type_of('ZZDED', pub))

# ── 4. deductsAnnualLeave=false → không trừ quỹ phép ─────────────────
make_type('ZZNODED', deductsAnnualLeave=False)
b4, _ = bal(E)
r2 = leave(E, 'ZZNODED', '2026-12-04', 'ZZ leave cfg no deduct')
ok('POST', f"/requests/{r2['id']}/approve", H, {'comment': 'ZZ leave cfg'})
b5, _ = bal(E)
check('Loại không trừ quỹ → quỹ phép không đổi', abs(b4 - b5) < 1e-6, (b4, b5))

# ── 5. unit: loại chỉ tính theo ngày không nhận đơn nửa ngày ─────────
leave(E, 'AL', '2026-12-02', 'ZZ leave cfg AL half day',
      '{"half_day_period":"MORNING","unit":"HALF_DAY"}')
check('Loại master data (AL) vẫn nhận đơn nửa ngày', True)
make_type('ZZUNIT', unit='DAY')
must_fail('POST', '/requests', E, {'type': 'LEAVE', 'leaveType': 'ZZUNIT', 'workDate': '2026-12-01',
                                   'endDate': '2026-12-01', 'reason': 'ZZ leave cfg half day',
                                   'payload': '{"half_day_period":"MORNING","unit":"HALF_DAY"}'}, 'chỉ tính theo ngày')
update_type('ZZUNIT', unit='HALF_DAY')
leave(E, 'ZZUNIT', '2026-12-01', 'ZZ leave cfg half day ok',
      '{"half_day_period":"MORNING","unit":"HALF_DAY"}')
check('Đổi đơn vị sang nửa ngày → nhận đơn nửa ngày', True)

# ── 6. submitWithinDays: hạn gửi tính từ cấu hình loại nghỉ ──────────
make_type('ZZTIME', submitWithinDays=1)
must_fail('POST', '/requests', E, {'type': 'LEAVE', 'leaveType': 'ZZTIME', 'workDate': '2026-11-10',
                                   'endDate': '2026-11-10', 'reason': 'ZZ leave cfg late', 'payload': '{}'},
          'trong vòng 1 ngày')
update_type('ZZTIME', submitWithinDays=30)
leave(E, 'ZZTIME', '2026-11-10', 'ZZ leave cfg late ok')
check('Nới hạn gửi lên 30 ngày → tạo được đơn lùi ngày', True)

# Nháp cho sự kiện cũ vẫn lưu được, nhưng gửi duyệt phải bị chặn lại
d = ok('POST', '/requests', E, {'type': 'LEAVE', 'leaveType': 'ZZDED', 'workDate': '2026-10-01',
                                'endDate': '2026-10-01', 'reason': 'ZZ leave cfg draft', 'payload': '{}',
                                'draft': True})['data']
must_fail('POST', f"/requests/{d['id']}/submit", E, None, 'gửi trong vòng 30 ngày')
check('Nháp cũ không lách được hạn gửi khi bấm gửi duyệt', True)

# ── 7. requiresAttachment: chặn duyệt khi thiếu giấy tờ ──────────────
make_type('ZZTATT', requiresAttachment=True)
r3 = leave(E, 'ZZTATT', '2026-12-09', 'ZZ leave cfg attach')
must_fail('POST', f"/requests/{r3['id']}/approve", H, {'comment': 'ZZ leave cfg'}, 'giấy tờ đính kèm')
update_type('ZZTATT', requiresAttachment=False)
ok('POST', f"/requests/{r3['id']}/approve", H, {'comment': 'ZZ leave cfg'})
check('Tắt bắt buộc giấy tờ → duyệt được đơn thiếu file', True)

# ── 8. isActive: tắt loại nghỉ → không còn trong danh sách & không nhận đơn ──
update_type('ZZNODED', isActive=False)
pub = ok('GET', '/leave-types', E)['data']
check('Tắt loại nghỉ → biến khỏi danh sách đang áp dụng', type_of('ZZNODED', pub) is None)
must_fail('POST', '/requests', E, {'type': 'LEAVE', 'leaveType': 'ZZNODED', 'workDate': '2026-12-10',
                                   'endDate': '2026-12-10', 'reason': 'ZZ leave cfg inactive', 'payload': '{}'},
          'đã tắt')
admin = ok('GET', '/admin/leave-types', H)['data']
check('Loại đã tắt vẫn còn trong màn hình HR để bật lại', type_of('ZZNODED', admin) is not None)
update_type('ZZNODED', isActive=True)

# ── 9. Xóa loại nghỉ ─────────────────────────────────────────────────
must_fail('DELETE', '/admin/leave-types/AL', H, None, 'khởi tạo sẵn')
must_fail('DELETE', '/admin/leave-types/ZZTIME', H, None, 'đã phát sinh đơn')
make_type('ZZDEL')
ok('DELETE', '/admin/leave-types/ZZDEL', H)
admin = ok('GET', '/admin/leave-types', H)['data']
check('Xóa loại HR tự thêm (chưa dùng) → biến khỏi danh mục', type_of('ZZDEL', admin) is None)
must_fail('DELETE', '/admin/leave-types/ZZDEL', H, None, 'Không tìm thấy')

cleanup()
print('\nALL LEAVE TYPE CONFIG CHECKS PASSED')
