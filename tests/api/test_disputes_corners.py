import json, urllib.request, sys, subprocess
B='http://localhost:8080/api/v1'
def call(method, path, token=None, body=None):
    req=urllib.request.Request(B+path, method=method); req.add_header('Content-Type','application/json')
    if token: req.add_header('Authorization','Bearer '+token)
    data=json.dumps(body).encode() if body is not None else None
    try:
        r=urllib.request.urlopen(req,data=data,timeout=15); return r.status, json.loads(r.read() or b'{}')
    except urllib.error.HTTPError as e: return e.code, json.loads(e.read() or b'{}')
def login(c):
    _,j=call('POST','/auth/login',body={'employeeCodeOrEmail':c,'password':'123456'}); return j['data']['accessToken']
def chk(n,c,x=''):
    print(('PASS ' if c else 'FAIL ')+n+('' if c else ' :: '+str(x))); 
    if not c: sys.exit(1)
E=login('137ACT'); E2=login('136ACT'); M=login('05ACT'); H=login('01HR')
uid=subprocess.check_output(['psql','-h','127.0.0.1','-p','5432','-U',subprocess.check_output(['whoami']).decode().strip(),'-d','pulse_db','-tAc',"select id from users where employee_code='137ACT'"]).decode().strip()

def psql(sql):
    return subprocess.run(['psql','-h','127.0.0.1','-p','5432','-U',subprocess.check_output(['whoami']).decode().strip(),'-d','pulse_db','-tAc',sql],capture_output=True,text=True).stdout.strip()
def mk(day='2026-11-25', reason='Test corner'):
    # Mỗi ngày tối đa 2 đơn khiếu nại (chặn khi còn PENDING) — mỗi kịch bản bắt đầu với ngày sạch.
    psql(f"delete from timesheet_disputes where user_id='{uid}' and work_date='{day}'")
    c,j=call('POST','/disputes',E,{'workDate':day,'reason':reason}); return j['data']['id']

# 1. id không tồn tại
c,j=call('POST','/disputes/DC-XXXX/resolve',H,{'action':'REJECT','reason':'x'})
chk('1. Khiếu nại không tồn tại bị chặn', c==400 and 'Không tìm thấy' in (j.get('message') or ''), (c,j.get('message')))
# 2. action sai
d=mk(); c,j=call('POST',f'/disputes/{d}/resolve',H,{'action':'FOO','reason':'x'})
chk('2. Action không hợp lệ bị chặn', c==400 and 'không hợp lệ' in (j.get('message') or ''), (c,j.get('message')))
# 3. FIX thiếu ký hiệu
c,j=call('POST',f'/disputes/{d}/resolve',H,{'action':'FIX','reason':'x'})
chk('3. FIX thiếu ký hiệu bị chặn', c==400 and 'ký hiệu' in (j.get('message') or ''), (c,j.get('message')))
# 4. FIX ký hiệu toàn khoảng trắng
c,j=call('POST',f'/disputes/{d}/resolve',H,{'action':'FIX','reason':'x','symbol':'   '})
chk('4. FIX ký hiệu rỗng bị chặn', c==400, (c,j.get('message')))
# 5. REJECT lý do khoảng trắng
c,j=call('POST',f'/disputes/{d}/resolve',H,{'action':'REJECT','reason':'   '})
chk('5. Từ chối lý do rỗng bị chặn', c==400, (c,j.get('message')))
# 6. MAKEUP thiếu lý do
c,j=call('POST',f'/disputes/{d}/resolve',H,{'action':'MAKEUP'})
chk('6. MAKEUP thiếu lý do bị chặn', c==400, (c,j.get('message')))
# 7. Nhân viên xử lý
c,j=call('POST',f'/disputes/{d}/resolve',E,{'action':'REJECT','reason':'x'})
chk('7. Nhân viên không được xử lý', c==400 and 'HR' in (j.get('message') or ''), (c,j.get('message')))
# 8. Nhân viên khác xem chi tiết
c,j=call('GET',f'/disputes/{d}',E2)
chk('8. Nhân viên khác không xem chi tiết', c==400, (c,j.get('message')))
# 9. Tạo thiếu/rỗng lý do
c,j=call('POST','/disputes',E,{'workDate':'2026-11-25'})
chk('9. Tạo khiếu nại thiếu lý do bị chặn', c==400, c)
c,j=call('POST','/disputes',E,{'workDate':'2026-11-25','reason':'  '})
chk('9b. Tạo khiếu nại lý do rỗng bị chặn', c==400, c)
# 10. Ngày sai định dạng
c,j=call('POST','/disputes',E,{'workDate':'abc','reason':'x'})
chk('10. Ngày không hợp lệ bị chặn (không 500)', c in (400,422), (c,j.get('message')))
# 11. Bulk rỗng
c,j=call('POST','/disputes/bulk-resolve',H,{'ids':[],'action':'REJECT','reason':'x'})
chk('11. Bulk rỗng bị chặn', c==400, c)
# 12. Bulk mixed: 1 pending + 1 đã xử lý
d2=mk(); call('POST',f'/disputes/{d2}/resolve',H,{'action':'REJECT','reason':'đóng trước'})
d3=mk()
c,j=call('POST','/disputes/bulk-resolve',H,{'ids':[d2,d3],'action':'REJECT','reason':'Lý do chung'})
ok = c==200 and j['data']['resolved']==1 and len(j['data']['skipped'])==1
chk('12. Bulk bỏ qua đơn đã đóng, xử lý đơn còn mở', ok, (c,j))
# 13. Bulk bởi nhân viên
d4=mk(); c,j=call('POST','/disputes/bulk-resolve',E,{'ids':[d4],'action':'REJECT','reason':'x'})
chk('13. Bulk bởi nhân viên bị từ chối từng đơn', c==200 and j['data']['resolved']==0 and len(j['data']['skipped'])==1, (c,j))
# 14. FIX khi kỳ đã khoá: công bố kỳ test (để được tạo khiếu nại) → khoá force
subprocess.run(['psql','-h','127.0.0.1','-p','5432','-U',subprocess.check_output(['whoami']).decode().strip(),'-d','pulse_db','-c',
 "update timesheets set status='draft', published_at=null, dispute_deadline=null, locked_at=null where period_month=2 and period_year=2024"],capture_output=True)
c,j=call('POST','/timesheets/publish?month=2024-02',H)
chk('14a. Công bố kỳ test 2024-02', c==200, (c,j.get('message')))
d5=mk('2024-02-10','Kỳ khoá')
c,j=call('POST','/timesheets/lock?month=2024-02&force=true',H)
chk('14b. Khoá kỳ test 2024-02', c==200, (c,j.get('message')))
c,j=call('POST',f'/disputes/{d5}/resolve',H,{'action':'FIX','reason':'x','symbol':'1.00'})
chk('14. FIX bị chặn khi kỳ công đã khoá', c==400 and 'khoá' in (j.get('message') or ''), (c,j.get('message')))
c,j=call('POST',f'/disputes/{d5}/resolve',H,{'action':'REJECT','reason':'đóng đơn test kỳ khoá'})
# 15. Khiếu nại quá hạn không chặn khoá kỳ (dọn các đơn còn mở trước)
c,j=call('GET','/disputes?status=PENDING',H)
if j['data']:
    call('POST','/disputes/bulk-resolve',H,{'ids':[x['id'] for x in j['data']],'action':'REJECT','reason':'dọn trước test 15'})
d6=mk()
subprocess.run(['psql','-h','127.0.0.1','-p','5432','-U',subprocess.check_output(['whoami']).decode().strip(),'-d','pulse_db','-c',
 f"update timesheet_disputes set deadline=now()-interval '1 day' where id='{d6}'"],capture_output=True)
# Kỳ test phải được chốt trước khi khoá (mô hình kỳ MỞ) — tự cấp dữ liệu, không phụ thuộc thứ tự bộ test.
subprocess.run(['psql','-h','127.0.0.1','-p','5432','-U',subprocess.check_output(['whoami']).decode().strip(),'-d','pulse_db','-c',
 "update timesheets set status='draft', published_at=null, dispute_deadline=null, locked_at=null where period_month=6 and period_year=2024"],capture_output=True)
c,j=call('POST','/timesheets/publish?month=2024-06',H)
chk('15a. Công bố kỳ test 2024-06', c==200, (c,j.get('message')))
c,j=call('POST','/timesheets/lock?month=2024-06',H)
chk('15. Khiếu nại quá hạn không chặn khoá kỳ', c==200, (c,j.get('message')))
# 16. Lọc theo trạng thái
c,j=call('GET','/disputes?status=RESOLVED',H)
chk('16. Lọc status=RESOLVED chỉ trả đơn đã xử lý', c==200 and all(x['status']=='RESOLVED' for x in j['data']))
# 17. Đơn pending có hạn + daysLeft
c,j=call('GET','/disputes?status=PENDING',H)
chk('17. Pending luôn có hạn + daysLeft', all(x.get('deadline') and x.get('daysLeft') is not None for x in j['data']), j['data'][:2])
# 18. Bulk lần 2 không xử lý lại
c,j=call('POST','/disputes/bulk-resolve',H,{'ids':[d3],'action':'REJECT','reason':'lần 2'})
chk('18. Bulk không xử lý lại đơn đã đóng', j['data']['resolved']==0 and len(j['data']['skipped'])==1, (c,j))
# cleanup: đóng các đơn còn mở của test + xoá timesheets test
c,j=call('GET','/disputes?status=PENDING',H)
call('POST','/disputes/bulk-resolve',H,{'ids':[x['id'] for x in j['data']],'action':'REJECT','reason':'Dọn dữ liệu test'})
subprocess.run(['psql','-h','127.0.0.1','-p','5432','-U',subprocess.check_output(['whoami']).decode().strip(),'-d','pulse_db','-c',"delete from timesheets where period_year in (2024,2048)"],capture_output=True)
print('\nALL CORNER TESTS PASSED')
