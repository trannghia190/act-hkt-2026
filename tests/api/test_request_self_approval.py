"""Quản lý tự duyệt đơn của chính mình — cấu hình trong rule approval_flow.

Kịch bản:
1. scope NO_MANAGER: manager 05ACT (có quản lý trực tiếp là Admin) KHÔNG tự duyệt được,
   đơn của chính họ cũng không nằm trong hộp thư duyệt của họ.
2. scope ALWAYS: manager 05ACT thấy đơn của mình trong hộp thư (selfRequest=true) và tự duyệt được.
3. Tắt allow_self_approval → tự duyệt bị chặn.
4. Nhân viên thường (role EMPLOYEE) không được tự duyệt dù cấu hình bật.
5. HR luôn thấy đơn chờ của toàn công ty trong hộp thư duyệt.
"""
import json, urllib.request, urllib.error, sys, subprocess, datetime

B = 'http://localhost:8080/api/v1'
TODAY = datetime.date.today()
MGR = '05ACT'
EMP = '2026NEW'


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
    _, j = call('POST', '/auth/login', body={'employeeCodeOrEmail': code, 'password': '123456'}, expect=200)
    return j['data']['accessToken']


def check(name, cond, extra=''):
    print(('PASS ' if cond else 'FAIL ') + name + (' ' + extra if extra and not cond else ''))
    if not cond:
        sys.exit(1)


def psql(sql):
    r = subprocess.run(['psql', '-h', '127.0.0.1', '-p', '5432', '-U',
                        subprocess.check_output(['whoami']).decode().strip(), '-d', 'pulse_db', '-tAc', sql],
                       capture_output=True, text=True)
    if r.returncode != 0:
        print('psql error:', r.stderr)
        sys.exit(1)
    return r.stdout.strip()


def rule_value(hr_token):
    _, j = call('GET', '/rules', token=hr_token, expect=200)
    rule = next((r for r in j['data'] if r['ruleKey'] == 'approval_flow'), None)
    check('có rule approval_flow', rule is not None)
    return json.loads(rule['currentValue'])


def save_rule(hr_token, value, reason):
    call('PUT', '/rules/approval_flow', token=hr_token,
         body={'currentValue': json.dumps(value), 'changeReason': reason, 'effectiveFrom': TODAY.isoformat()},
         expect=200)


def create_adjust(token, reason):
    _, j = call('POST', '/requests', token=token, body={
        'type': 'ADJUST', 'workDate': TODAY.isoformat(), 'reason': reason,
        'payload': json.dumps({'adjust_kind': 'OUT', 'time': '17:45'}),
    }, expect=200)
    return j['data']['id']


MGR_TOKEN = login(MGR)
EMP_TOKEN = login(EMP)
HR_TOKEN = login('01HR')

original = rule_value(HR_TOKEN)
check('rule có field allow_self_approval', 'allow_self_approval' in original, str(original))

mgr_id = psql(f"select id from users where employee_code='{MGR}'")
had_today_log = psql(f"select count(*) from attendance_logs where user_id='{mgr_id}' and work_date='{TODAY}'") != '0'
created = []

try:
    # ── 1. scope NO_MANAGER: 05ACT có quản lý trực tiếp → không tự duyệt được ──
    cfg = dict(original, allow_self_approval=True, self_approval_min_role='MANAGER', self_approval_scope='NO_MANAGER')
    save_rule(HR_TOKEN, cfg, 'Test: tự duyệt chỉ khi không có quản lý trực tiếp')
    req_id = create_adjust(MGR_TOKEN, 'Test tự duyệt đơn quản lý (NO_MANAGER)')
    created.append(req_id)

    status, j = call('POST', f'/requests/{req_id}/approve', token=MGR_TOKEN, body={'comment': 'tự duyệt'})
    check('NO_MANAGER: manager có quản lý trực tiếp bị chặn tự duyệt',
          status == 400 and 'tự duyệt' in json.dumps(j, ensure_ascii=False), str(j)[:200])
    _, j = call('GET', '/requests/inbox', token=MGR_TOKEN, expect=200)
    check('NO_MANAGER: đơn của mình không nằm trong hộp thư tự duyệt', all(r['id'] != req_id for r in j['data']))

    # ── 2. scope ALWAYS: manager thấy đơn của mình trong hộp thư và tự duyệt được ──
    cfg = dict(cfg, self_approval_scope='ALWAYS')
    save_rule(HR_TOKEN, cfg, 'Test: cho phép cấp quản lý tự duyệt mọi lúc')

    _, j = call('GET', '/requests/inbox', token=MGR_TOKEN, expect=200)
    mine = [r for r in j['data'] if r['id'] == req_id]
    check('manager thấy đơn của mình trong hộp thư', len(mine) == 1)
    check('đơn của mình được đánh dấu selfRequest', mine[0].get('selfRequest') is True, str(mine[0])[:200])

    _, j = call('POST', f'/requests/{req_id}/approve', token=MGR_TOKEN, body={'comment': 'Tự duyệt theo cấu hình'}, expect=200)
    check('manager tự duyệt được đơn của mình', j['data']['status'] == 'APPROVED', str(j)[:200])
    check('người duyệt là chính manager', j['data'].get('decidedBy') == mgr_id, str(j['data'])[:200])

    # HR luôn thấy đơn chờ toàn công ty (kể cả của manager cấp cao nhất)
    req2 = create_adjust(MGR_TOKEN, 'Test HR thấy đơn chờ của manager')
    created.append(req2)
    _, j = call('GET', '/requests/inbox', token=HR_TOKEN, expect=200)
    check('HR thấy đơn chờ của manager trong hộp thư', any(r['id'] == req2 for r in j['data']))

    # ── 3. Tắt allow_self_approval → tự duyệt bị chặn ──
    save_rule(HR_TOKEN, dict(cfg, allow_self_approval=False), 'Test: tắt tự duyệt')
    status, j = call('POST', f'/requests/{req2}/approve', token=MGR_TOKEN, body={'comment': 'tự duyệt'})
    check('tắt cấu hình → tự duyệt bị chặn',
          status == 400 and 'tự duyệt' in json.dumps(j, ensure_ascii=False), str(j)[:200])

    # ── 4. Nhân viên thường không được tự duyệt dù cấu hình bật ──
    save_rule(HR_TOKEN, cfg, 'Test: bật lại tự duyệt cho quản lý')
    emp_req = create_adjust(EMP_TOKEN, 'Test nhân viên tự duyệt')
    created.append(emp_req)
    status, j = call('POST', f'/requests/{emp_req}/approve', token=EMP_TOKEN, body={'comment': 'tự duyệt'})
    check('nhân viên thường tự duyệt bị chặn',
          status == 400 and 'quản lý' in json.dumps(j, ensure_ascii=False), str(j)[:200])
finally:
    save_rule(HR_TOKEN, original, 'Test: khôi phục cấu hình luồng duyệt')
    for rid in created:
        psql(f"delete from request_attachments where request_id='{rid}'")
        psql(f"delete from requests where id='{rid}'")
    # Chỉ dọn log chấm công do đơn ADJUST tự duyệt sinh ra — không đụng log có sẵn
    if not had_today_log:
        psql(f"delete from attendance_logs where user_id='{mgr_id}' and work_date='{TODAY}'")

print('OK — luồng tự duyệt đơn của quản lý đúng theo cấu hình')
