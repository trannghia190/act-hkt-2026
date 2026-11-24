"""
Hồi quy S40: thêm nhân viên mới phải CHẶN trùng mã/email (không ghi đè hồ sơ cũ),
và có thể đánh dấu nhân viên đã nghỉ việc.

Quy tắc nghiệp vụ:
- Trùng MÃ NHÂN VIÊN → luôn chặn (kể cả người đã nghỉ: mã không được cấp lại).
- Trùng EMAIL → chặn nếu chủ email còn ĐANG HOẠT ĐỘNG; email của nhân viên ĐÃ NGHỈ
  được giải phóng để cấp cho nhân viên mới.
"""
import json
import subprocess
import sys
import time
import urllib.error
import urllib.request

B = 'http://localhost:8080/api/v1'


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


def psql(sql):
    return subprocess.run(
        ['psql', '-h', '127.0.0.1', '-p', '5432', '-U', subprocess.check_output(['whoami']).decode().strip(),
         '-d', 'pulse_db', '-tAc', sql], capture_output=True, text=True).stdout.strip()


def check(name, cond, extra=''):
    print(('PASS ' if cond else 'FAIL ') + name + (f' — {extra}' if extra and not cond else ''))
    if not cond:
        sys.exit(1)


hr = call('POST', '/auth/login', body={'employeeCodeOrEmail': '01HR', 'password': '123456'})[1]['data']['accessToken']

stamp = int(time.time()) % 900000
code_a = f'ZZ{stamp}'
code_b = f'ZY{stamp}'
email_a = f'zz.{stamp}.a@act.vn'
email_b = f'zz.{stamp}.b@act.vn'
created_ids = []


def cleanup():
    for code in (code_a, code_b):
        psql(f"delete from users where employee_code = '{code}'")


try:
    cleanup()
    # ── 1. Tạo nhân viên mới ────────────────────────────────────────────────
    st, j = call('POST', '/admin/users', hr, {
        'employeeCode': code_a, 'fullName': 'NV Trùng Kiểm Thử A', 'email': email_a,
        'role': 'EMPLOYEE', 'password': '123456',
    })
    check('1. Tạo nhân viên mới thành công', st == 200, str(j)[:200])
    id_a = j['data']['id']
    created_ids.append(id_a)

    # ── 2. Trùng MÃ → chặn, hồ sơ cũ KHÔNG bị ghi đè ───────────────────────
    st, j = call('POST', '/admin/users', hr, {
        'employeeCode': code_a, 'fullName': 'Tên Mới', 'email': email_b,
        'role': 'MANAGER', 'password': '123456',
    })
    check('2. Trùng mã nhân viên → bị chặn (400)', st == 400, f'{st} {str(j)[:200]}')
    check('2b. Thông báo lỗi nêu rõ mã bị trùng', 'Mã nhân viên' in (j.get('message') or ''), j.get('message'))
    still = psql(f"select full_name||'|'||role from users where id='{id_a}'")
    check('2c. Hồ sơ nhân viên cũ KHÔNG bị ghi đè', still == 'NV Trùng Kiểm Thử A|EMPLOYEE', still)

    # ── 3. Trùng EMAIL (người đang hoạt động) → chặn ─────────────────────────
    st, j = call('POST', '/admin/users', hr, {
        'employeeCode': code_b, 'fullName': 'NV Trùng Email', 'email': email_a,
        'role': 'EMPLOYEE', 'password': '123456',
    })
    check('3. Trùng email người đang hoạt động → bị chặn (400)', st == 400, f'{st} {str(j)[:200]}')
    check('3b. Không tạo nhầm nhân viên mới', psql(f"select count(*) from users where employee_code='{code_b}'") == '0')

    # ── 4. Đánh dấu nghỉ việc ──────────────────────────────────────────────
    st, j = call('POST', f'/admin/users/{id_a}/resign', hr, {'reason': 'Nghỉ việc — kiểm thử'})
    check('4. Đánh dấu nghỉ việc thành công', st == 200, f'{st} {str(j)[:200]}')
    check('4b. Trạng thái chuyển sang INACTIVE', (j.get('data') or {}).get('status') == 'INACTIVE',
          str(j.get('data'))[:200])
    check('4c. Rời khỏi nhóm (rỗng) nhưng GIỮ ca để tra cứu lịch sử',
          psql(f"select coalesce(team_id::text,'null')||'|'||coalesce(shift_id::text,'null') from users where id='{id_a}'")
          .split('|')[1] != 'null',
          psql(f"select coalesce(team_id::text,'null')||'|'||coalesce(shift_id::text,'null') from users where id='{id_a}'"))

    # ── 5. Email của người đã nghỉ → được cấp lại; MÃ vẫn phải chặn ──────
    st, j = call('POST', '/admin/users', hr, {
        'employeeCode': code_b, 'fullName': 'NV Mới Dùng Lại Email Cũ', 'email': email_a,
        'role': 'EMPLOYEE', 'password': '123456',
    })
    check('5. Tái sử dụng email của nhân viên đã nghỉ → được phép', st == 200, f'{st} {str(j)[:250]}')
    id_b = j['data']['id']
    created_ids.append(id_b)

    st, j = call('POST', '/admin/users', hr, {
        'employeeCode': code_a, 'fullName': 'Cố lấy lại mã của người đã nghỉ', 'email': email_b,
        'role': 'EMPLOYEE', 'password': '123456',
    })
    check('6. Mã của nhân viên đã nghỉ vẫn KHÔNG được dùng lại → chặn (400)', st == 400, f'{st} {str(j)[:200]}')

    # ── 7. Đánh dấu nghỉ 2 lần → báo lỗi rõ ràng ───────────────────────────
    st, j = call('POST', f'/admin/users/{id_a}/resign', hr, {'reason': 'lần 2'})
    check('7. Nghỉ việc 2 lần → báo lỗi (400)', st == 400, f'{st} {str(j)[:200]}')
finally:
    cleanup()

print('OK — chặn trùng mã/email, cho phép tái dùng email người đã nghỉ, mã thì không')
