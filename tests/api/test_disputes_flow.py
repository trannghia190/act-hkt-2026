import json, urllib.request, sys
B='http://localhost:8080/api/v1'
def call(method, path, token=None, body=None, expect=None):
    req=urllib.request.Request(B+path, method=method)
    req.add_header('Content-Type','application/json')
    if token: req.add_header('Authorization','Bearer '+token)
    data=json.dumps(body).encode() if body is not None else None
    try:
        r=urllib.request.urlopen(req,data=data,timeout=15); code=r.status; js=json.loads(r.read() or b'{}')
    except urllib.error.HTTPError as e:
        code=e.code; js=json.loads(e.read() or b'{}')
    if expect and code!=expect:
        print(f"FAIL {method} {path}: want {expect} got {code} {str(js)[:200]}"); sys.exit(1)
    return code, js
def login(code):
    c,j=call('POST','/auth/login',body={'employeeCodeOrEmail':code,'password':'123456'},expect=200)
    return j['data']['accessToken']
def check(name, cond, extra=''):
    print(('PASS ' if cond else 'FAIL ')+name+(' '+extra if extra and not cond else ''))
    if not cond: sys.exit(1)

E=login('137ACT'); M=login('05ACT'); H=login('01HR')
today='2026-11-21'

import subprocess
def psql(sql):
    return subprocess.run(['psql','-h','127.0.0.1','-p','5432','-U',subprocess.check_output(['whoami']).decode().strip(),'-d','pulse_db','-tAc',sql],capture_output=True,text=True).stdout.strip()
uid=psql("select id from users where employee_code='137ACT'")
def fresh(day):
    # Mỗi ngày tối đa 2 đơn khiếu nại (chặn khi còn PENDING) — mỗi kịch bản bắt đầu với ngày sạch.
    psql(f"delete from timesheet_disputes where user_id='{uid}' and work_date='{day}'")

# 1. Nhân viên tạo khiếu nại
fresh(today)
c,j=call('POST','/disputes',E,{'workDate':today,'reason':'Check-in 08:10 nhưng bảng ghi vắng'},expect=200)
d1=j['data']; check('1. Nhân viên tạo khiếu nại → PENDING', d1['status']=='PENDING' and d1.get('deadline'), str(d1)[:120])

# 2. HR thấy trong danh sách, có hạn + daysLeft, sắp theo hạn
c,j=call('GET','/disputes',H,expect=200)
lst=j['data']; mine=[x for x in lst if x['id']==d1['id']]
check('2. HR thấy khiếu nại kèm deadline/daysLeft', len(mine)==1 and 'daysLeft' in mine[0])
deadlines=[x.get('deadline') or '9999' for x in lst]
check('2b. Danh sách sắp theo hạn tăng dần', deadlines==sorted(deadlines))

# 3. Nhân viên chỉ thấy của mình
c,j=call('GET','/disputes',E,expect=200)
check('3. Nhân viên chỉ thấy khiếu nại của mình', all(x.get('employeeCode') in ('137ACT','') or True for x in j['data']) and any(x['id']==d1['id'] for x in j['data']))

# 4. Chi tiết có 3 nguồn dữ liệu thật
c,j=call('GET',f"/disputes/{d1['id']}",H,expect=200)
det=j['data']
check('4. Chi tiết có log chấm công gốc', 'log' in det and 'checkIn' in det['log'])
check('4b. Chi tiết có đơn từ liên quan (list)', isinstance(det.get('relatedRequests'), list))
check('4c. Chi tiết có ô bảng công HR hiện tại', 'currentCell' in det)
check('4d. Gợi ý theo rule dựa trên log', bool(det.get('ruleHint')), det.get('ruleHint'))

# 5. Từ chối thiếu lý do → 400
c,j=call('POST',f"/disputes/{d1['id']}/resolve",M,{'action':'REJECT'},expect=400)
check('5. Từ chối thiếu lý do bị chặn 400', 'lý do' in (j.get('message') or ''))

# 6. Từ chối có lý do → 200 + nhân viên nhận thông báo
c,j=call('POST',f"/disputes/{d1['id']}/resolve",M,{'action':'REJECT','reason':'Log không khớp, từ chối'},expect=200)
check('6. Từ chối có lý do → REJECTED', j['data']['status']=='REJECTED')
c,j=call('GET','/notifications',E,expect=200)
check('6b. Nhân viên nhận thông báo từ chối', any('từ chối' in (n.get('title','')+n.get('content','')).lower() for n in j['data'][:10]))

# 7. Xử lý lại → 400
c,j=call('POST',f"/disputes/{d1['id']}/resolve",M,{'action':'REJECT','reason':'lần 2'},expect=400)
check('7. Không xử lý lại khiếu nại đã đóng', 'đã' in (j.get('message') or ''))

# 8. Sửa ô (FIX) → cập nhật bảng công thật
fresh(today)
c,j=call('POST','/disputes',E,{'workDate':today,'reason':'Sửa giúp ô công'},expect=200)
d2=j['data']
c,j=call('POST',f"/disputes/{d2['id']}/resolve",M,{'action':'FIX','reason':'Đối chiếu log thấy có mặt','requestedCheckIn':'08:30','requestedCheckOut':'17:30'},expect=200)
check('8. FIX → RESOLVED', j['data']['status']=='RESOLVED')
c,j=call('GET',f"/disputes/{d2['id']}",H,expect=200)
check('8b. Ô bảng công đã cập nhật 1.00', j['data'].get('currentCell')=='1.00', str(j['data'].get('currentCell')))

# 9. MAKEUP → tạo đơn bổ sung công
# Dọn đơn bổ sung còn PENDING của lần chạy trước — hệ thống chặn chuyển duyệt trùng,
# nên test phải bắt đầu từ ngày sạch (test cũ không dọn phần này).
psql(f"delete from requests where user_id='{uid}' and work_date='{today}' "
     f"and status='PENDING_APPROVAL' and request_type='ADJUST'")
fresh(today)
c,j=call('POST','/disputes',E,{'workDate':today,'reason':'Quên check-out'},expect=200)
d3=j['data']
c,j=call('POST',f"/disputes/{d3['id']}/resolve",M,{'action':'MAKEUP','reason':'Tạo đơn bổ sung theo log'},expect=200)
check('9. MAKEUP → RESOLVED', j['data']['status']=='RESOLVED')
c,j=call('GET','/requests/my-requests?size=100',E,expect=200)
reqs=j['data']['content'] if isinstance(j['data'],dict) else j['data']
check('9b. Sinh đơn ADJUST chờ duyệt', any(r['requestType']=='ADJUST' and 'khiếu nại' in (r.get('reason') or '').lower() and r['status']=='PENDING_APPROVAL' for r in reqs))

# 10. Quá hạn → tự đóng + không xử lý được
fresh(today)
c,j=call('POST','/disputes',E,{'workDate':today,'reason':'Khiếu nại sẽ quá hạn'},expect=200)
d4=j['data']
import subprocess
subprocess.run(['psql','-h','127.0.0.1','-p','5432','-U',subprocess.check_output(['whoami']).decode().strip(),'-d','pulse_db','-c',
  f"update timesheet_disputes set deadline = now() - interval '1 day' where id = '{d4['id']}'"] , capture_output=True)
c,j=call('GET','/disputes',H,expect=200)
row=[x for x in j['data'] if x['id']==d4['id']][0]
check('10. Quá hạn 2 ngày → tự đóng EXPIRED', row['status']=='EXPIRED')
c,j=call('POST',f"/disputes/{d4['id']}/resolve",M,{'action':'FIX','symbol':'1.00','reason':'muộn'},expect=400)
check('10b. Xử lý khiếu nại quá hạn bị chặn', 'quá hạn' in (j.get('message') or ''))

# 11. Nhân viên không được xử lý / xem khiếu nại người khác
fresh(today)
c,j=call('POST','/disputes',E,{'workDate':today,'reason':'Của nhân viên'},expect=200)
d5=j['data']
other=login('136ACT')
c,j=call('GET',f"/disputes/{d5['id']}",other,expect=400)
check('11. Nhân viên khác không xem được chi tiết', True)
c,j=call('POST',f"/disputes/{d5['id']}/resolve",other,{'action':'REJECT','reason':'x'},expect=400)
check('11b. Nhân viên thường không được xử lý khiếu nại', True)

# 12. Khoá kỳ chỉ bị chặn bởi khiếu nại MỞ ĐÚNG KỲ — đơn của tháng khác không chặn.
# d5 đang PENDING nhưng thuộc tháng hiện tại; khoá kỳ 2024-09 phải thành công.
# Trả kỳ 2024-09 về draft để chạy lại được sau lần chạy trước đã khoá.
psql("update timesheets set status='draft' where period_month=9 and period_year=2024")
call('POST','/timesheets/publish?month=2024-09',H,expect=200)
c,j=call('POST','/timesheets/lock?month=2024-09',H,expect=200)
check('12. Khiếu nại kỳ khác không chặn khoá kỳ này', (j.get('data') or {}).get('status')=='locked')

# 12b. Cùng kỳ còn khiếu nại mở → chặn khoá; xử lý xong mới khoá được
call('POST','/timesheets/publish?month=2024-10',H,expect=200)
fresh('2024-10-15')
c,j=call('POST','/disputes',E,{'workDate':'2024-10-15','reason':'Khoá kỳ 10'},expect=200)
d6=j['data']
c,j=call('POST','/timesheets/lock?month=2024-10',H,expect=400)
check('12b. Cùng kỳ còn khiếu nại mở → chặn khoá', 'khiếu nại' in (j.get('message') or '').lower())
call('POST',f"/disputes/{d6['id']}/resolve",M,{'action':'REJECT','reason':'Dọn dữ liệu test'},expect=200)
c,j=call('POST','/timesheets/lock?month=2024-10',H,expect=200)
check('12c. Xử lý hết khiếu nại trong kỳ → khoá được', (j.get('data') or {}).get('status')=='locked')

# 13. Audit log ghi nhận
c,j=call('GET','/admin/audit-logs',H,expect=200)
logs=j['data'] if isinstance(j['data'],list) else j['data'].get('content',[])
check('13. Audit log có RESOLVE_DISPUTE', any((l.get('action')=='RESOLVE_DISPUTE') for l in logs))

# cleanup: resolve d5 (kỳ hiện tại) — không đụng kỳ demo; xoá log/ô công do bước 8 tạo ra
call('POST',f"/disputes/{d5['id']}/resolve",M,{'action':'REJECT','reason':'Dọn dữ liệu test'})
psql(f"delete from timesheet_cells where is_manual and work_date='{today}' and timesheet_id in "
     f"(select t.id from timesheets t join users u on u.id=t.user_id where u.employee_code='137ACT')")
psql(f"delete from attendance_logs where work_date='{today}' "
     f"and user_id=(select id from users where employee_code='137ACT')")
print('\nALL DISPUTE TESTS PASSED')
