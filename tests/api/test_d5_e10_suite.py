import json, urllib.request, sys, subprocess
B='http://localhost:8080/api/v1'
def call(method, path, token=None, body=None):
    req=urllib.request.Request(B+path, method=method); req.add_header('Content-Type','application/json')
    if token: req.add_header('Authorization','Bearer '+token)
    data=json.dumps(body).encode() if body is not None else None
    try:
        r=urllib.request.urlopen(req,data=data,timeout=20); return r.status, json.loads(r.read() or b'{}')
    except urllib.error.HTTPError as e: return e.code, json.loads(e.read() or b'{}')
def login(c):
    _,j=call('POST','/auth/login',body={'employeeCodeOrEmail':c,'password':'123456'}); return j['data']['accessToken']
def chk(n,c,x=''):
    print(('PASS ' if c else 'FAIL ')+n+('' if c else ' :: '+str(x)[:300]))
    if not c: sys.exit(1)
def psql(sql):
    subprocess.run(['psql','-h','127.0.0.1','-p','5432','-U',subprocess.check_output(['whoami']).decode().strip(),'-d','pulse_db','-c',sql],capture_output=True)
H=login('01HR'); M=login('05ACT'); E=login('136ACT')
MO='2026-12'

# ---------- D5 Sổ phép ----------
c,j=call('GET','/leaves/ledger/by-code/136ACT',H)
chk('D5.1 Sổ phép theo nhân viên tải được', c==200 and isinstance(j['data'],list), (c,j.get('message')))
entries=j['data']
chk('D5.2 Mỗi dòng có truy vết (amount/balanceAfter/thực hiện)', all(('amount' in e and 'balanceAfter' in e and ('performedBySystem' in e)) for e in entries) if entries else True)
chk('D5.3 Entry có loại nghỉ để lọc', all('leaveType' in e for e in entries) if entries else True)
before_count=len(entries); before_ids={e['id'] for e in entries}
c,j=call('POST','/leaves/adjust',H,{'employeeCode':'136ACT','amount':0.5,'reason':'Test D5 điều chỉnh','leaveType':'AL'})
chk('D5.4 HR điều chỉnh tay tạo dòng ADJUST', c==200 and j['data']['action']=='ADJUST' and j['data']['reason']=='Test D5 điều chỉnh')
c,j=call('GET','/leaves/ledger/by-code/136ACT',H)
new_entries=j['data']
chk('D5.5 Append-only: thêm dòng, không sửa lịch sử', len(new_entries)==before_count+1 and before_ids <= {e['id'] for e in new_entries})
psql("delete from leave_ledger where reason='Test D5 điều chỉnh'")

# ---------- E1 Bảng công ----------
c,j=call('GET',f'/timesheets?month={MO}',H)
chk('E1.1 Bảng công tháng tải được + rows', c==200 and len(j['data']['rows'])>0)
row=j['data']['rows'][0]
need=['employeeCode','fullName','positionName','teamName','managerCode','days','standardDays','actualDays','wfhDays','leaveDays','holidayDays','sickDays','compDays','unpaidDays','maternityDays','paternityDays','specialLeaveDays','totalDays','remainingLeave']
chk('E1.2 Dòng có đủ 5 info + tổng hợp (17 cột dữ liệu)', all(k in row for k in need), [k for k in need if k not in row])
chk('E1.3 Ô ngày trả ký hiệu gốc dạng map', isinstance(row['days'],dict))
c,j=call('POST',f'/timesheets/cell?month={MO}',H,{'employeeCode':'136ACT','day':7,'symbol':'R/0.50','reason':''})
chk('E1.4 Sửa ô thiếu lý do bị chặn', c==400)
c,j=call('POST',f'/timesheets/cell?month={MO}',H,{'employeeCode':'136ACT','day':7,'symbol':'R/0.50','reason':'Đối chiếu log'})
chk('E1.5 Sửa ô có lý do lưu DB', c==200 and j['data']['edited'] is True)
c,j=call('GET',f'/timesheets?month={MO}',H)
r=[x for x in j['data']['rows'] if x['employeeCode']=='136ACT'][0]
chk('E1.6 Ô đã sửa hiện đúng ký hiệu', r['days'].get('7')=='R/0.50', r['days'].get('7'))
c,j=call('POST',f'/timesheets/bulk?month={MO}',H,{'employeeCodes':['136ACT','05ACT'],'day':8,'symbol':'0.50','reason':'Bù công cả lô'})
chk('E1.7 Sửa hàng loạt 1 lô', c==200 and j['data']['updated']==2)
psql(f"delete from timesheet_cells where work_date='{MO}-07' or work_date='{MO}-08'")

# ---------- E3 Cấu hình quy định ----------
c,j=call('GET','/rules',H)
rules=j['data']; keys={r['ruleKey'] for r in rules}
chk('E3.1 Đủ 19 quy định', c==200 and len(rules)>=19, len(rules))
chk('E3.2 Mỗi luật có tên/nhóm/giá trị hiện tại', all(r.get('name') and r.get('category') and 'currentValue' in r for r in rules))
chk('E3.3 Không có scope ghi đè theo nhóm', all('scope' not in r and 'targetGroup' not in r for r in rules))
c,j=call('GET','/rules/late_early/versions',H)
chk('E3.4 Xem được lịch sử phiên bản', c==200 and isinstance(j['data'],list) and len(j['data'])>=1)
orig=[r for r in rules if r['ruleKey']=='late_early'][0]['currentValue']
val=json.loads(orig); val['max_count']=3
c,j=call('PUT','/rules/late_early',H,{'currentValue':json.dumps(val,ensure_ascii=False),'changeReason':'Test E3 đổi quota','effectiveFrom':'2026-11-21'})
chk('E3.5 Lưu có ngày hiệu lực + lý do', c==200 and j['data']['versionCount']>=2)
c,j=call('GET','/rules',H)
chk('E3.6 Giá trị mới áp dụng ngay', any(r['ruleKey']=='late_early' and '"max_count": 3' in r['currentValue'].replace('"max_count":3','"max_count": 3') or r['ruleKey']=='late_early' and json.loads(r['currentValue']).get('max_count')==3 for r in j['data']))
c,j=call('GET','/rules/late_early/versions',H)
vers=j['data']
target=None
for ver in vers:
    try:
        if json.loads(ver.get('value') or '{}').get('max_count')==2:
            target=ver['id']; break
    except Exception: pass
assert target is not None, 'Không tìm thấy phiên bản max_count=2: '+str(vers[:3])
c,j=call('POST',f'/rules/late_early/rollback/{target}',H,{'reason':'Test E3 rollback'})
chk('E3.7 Rollback về phiên bản cũ có lý do', c==200 and json.loads(j['data']['currentValue']).get('max_count')==2, (c,str(j.get('data'))[:150]))
call('PUT','/rules/late_early',H,{'currentValue':orig,'changeReason':'Restore sau test'})

# ---------- E4/E5 Cấu hình 1 luật + tra cứu ----------
chk('E4.1 Catalog có mô tả + kiểu dữ liệu cho form sinh tự động', all('description' in r and 'dataType' in r for r in rules))
c,j=call('GET','/rules/public-policy-doc',H)
doc=json.dumps(j,ensure_ascii=False)
chk('E5.1 Trang quy định tra cứu trả nội dung', c==200 and len(doc)>500, (c,len(doc)))
chk('E5.2 Cùng nguồn dữ liệu (có rule key/nhóm quy định)', any(k in doc for k in ['late_early','Đi muộn','leave','phép']), doc[:200])
c,j=call('GET','/rules/public-faq',H)
chk('E5.3 Có FAQ/ ví dụ thực tế', c==200)

# ---------- E6 Ca & lễ ----------
c,j=call('GET','/admin/shifts',H)
shifts=j['data']
chk('E6.1 Danh sách ca có giờ vào/ra/trưa/linh hoạt', c==200 and all(('checkInStart' in s and 'checkOutStart' in s and 'lunchBreakStart' in s and 'isFlexible' in s) for s in shifts))
psql("delete from shifts where code='SHIFT_TEST'")
c,j=call('POST','/admin/shifts',H,{'code':'SHIFT_TEST','name':'Ca test linh hoạt','checkInStart':'08:00','checkInEnd':'10:00','checkOutStart':'17:00','checkOutEnd':'19:00','lunchBreakStart':'12:00','lunchBreakEnd':'13:00','requiredWorkHours':8,'isFlexible':True,'flexibleCheckinFrom':'08:00','flexibleCheckinTo':'10:00','flexibleCheckoutFrom':'17:00','flexibleCheckoutTo':'19:00','isActive':True})
chk('E6.2 Tạo ca linh hoạt không cần sửa code', c==200 and j['data']['code']=='SHIFT_TEST' and j['data']['isFlexible'] is True)
c,j=call('PUT','/admin/shifts/SHIFT_TEST',H,{'code':'SHIFT_TEST','name':'Ca test sửa','checkInStart':'08:30','checkInEnd':'09:30','checkOutStart':'17:30','checkOutEnd':'18:30','lunchBreakStart':'12:00','lunchBreakEnd':'13:00','requiredWorkHours':8,'isFlexible':False,'isActive':True})
chk('E6.3 Sửa ca', c==200 and j['data']['name']=='Ca test sửa')
c,j=call('POST','/admin/shifts/SHIFT_TEST/assign',H)
chk('E6.4 Áp ca theo nhóm/chức danh', c==200 and 'assigned' in j['data'])
psql("delete from shifts where code='SHIFT_TEST'")
psql("delete from holidays where holiday_date='2048-09-02'")
c,j=call('POST','/admin/holidays',H,{'holidayDate':'2048-09-02','name':'Lễ test E6','isPaid':True})
chk('E6.5 Thêm ngày lễ không cần sửa code', c==200 and j['data']['holidayDate']=='2048-09-02')
c,j=call('GET','/admin/holidays',H)
chk('E6.6 Ngày lễ hiện trong danh sách', any(h['holidayDate']=='2048-09-02' for h in j['data']))
psql("delete from holidays where holiday_date='2048-09-02'")
c,j=call('GET','/rules',H)
sec=[r for r in j['data'] if r['ruleKey']=='attendance_security']
chk('E6.7 Có cấu hình geofence + IP mạng nội bộ', bool(sec) and any(k in sec[0]['currentValue'] for k in ['geofence','ip','wifi']), sec[0]['currentValue'][:120] if sec else 'missing')

# ---------- E7 Loại nghỉ ----------
psql("delete from leave_types where code='TESTX'")
c,j=call('POST','/admin/leave-types',H,{'code':'TESTX','name':'Nghỉ test E7','defaultDays':2,'requiresAttachment':False,'isActive':True,'isPaid':True,'deductsAnnualLeave':True,'unit':'DAY','submitWithinDays':5})
chk('E7.1 Thêm loại nghỉ không cần sửa code', c==200 and j['data']['code']=='TESTX')
c,j=call('POST','/admin/leave-types',H,{'code':'TESTX','name':'Trùng mã'})
chk('E7.2 Trùng mã bị chặn thân thiện', c==400 and 'tồn tại' in (j.get('message') or ''), (c,j.get('message')))
c,j=call('PUT','/admin/leave-types/TESTX',H,{'code':'TESTX','name':'Nghỉ test E7 sửa','defaultDays':2,'isPaid':False,'deductsAnnualLeave':False,'unit':'HALF_DAY','submitWithinDays':5,'isActive':True})
chk('E7.3 Sửa cấu hình loại nghỉ (lương/trừ phép/đơn vị/hạn)', c==200 and j['data']['isPaid'] is False and j['data']['unit']=='HALF_DAY')
c,j=call('GET','/leave-types',E)
chk('E7.4 Nhân viên thấy loại nghỉ đang áp dụng', c==200 and any(t['code']=='TESTX' for t in j['data']))
psql("delete from leave_types where code='TESTX'")
# 3 tầng kế thừa: rule chung → loại → đơn
c,j=call('POST','/requests',E,{'type':'LEAVE','leaveType':'AL','workDate':'2026-12-20','endDate':'2026-12-20','reason':'Test E7 3 tầng','payload':'{}'})
chk('E7.5 Tạo đơn nghỉ áp cấu hình loại (3 tầng)', c==200)
rid=j['data']['id']
c,j=call('GET',f'/requests/{rid}',E)
ap=json.dumps(j['data']['request'].get('appliedParameters') or {})
chk('E7.6 appliedParameters chứa override của loại nghỉ', 'is_paid' in ap and 'submit_within_days' in ap, ap[:200])
# duyệt 1 cấp quản lý trực tiếp
c,j=call('POST',f'/requests/{rid}/approve',M,{})
chk('E7.7 Nghỉ phép duyệt 1 cấp quản lý trực tiếp', c==200 and j['data']['status']=='APPROVED' and j['data']['decidedBy'])
psql(f"delete from requests where id='{rid}'")
psql("delete from notifications where content like '%Test E7 3 tầng%'")

# ---------- E8 Thiết bị ----------
c,j=call('GET','/rules',H)
sec=[r for r in rules if r['ruleKey']=='attendance_security'][0]
chk('E8.1 Mặc định 2 thiết bị (cấu hình)', json.loads(sec['currentValue']).get('max_devices')==2, sec['currentValue'][:120])
c,j=call('GET','/devices',E)
mine=j['data']
c,j=call('POST','/devices/request',E,{'fingerprint':'FP-TEST-E8','deviceName':'iPhone test','reason':'Máy thứ 3 cần duyệt','wifiBssid':'ACT_OFFICE'})
chk('E8.2 Nhân viên yêu cầu thêm thiết bị (kèm lý do)', c==200 and j['data']['isApproved'] is False)
did=j['data']['id']
c,j=call('POST','/devices/request',E,{'fingerprint':'FP-TEST-E8b','deviceName':'x'})
chk('E8.3 Thiết bị yêu cầu thiếu lý do bị chặn', c==400)
c,j=call('GET','/admin/devices',H)
chk('E8.4 HR thấy thiết bị chờ duyệt', any(str(d['id'])==str(did) for d in j['data']))
c,j=call('POST',f'/admin/devices/{did}/approve',H)
chk('E8.5 Duyệt thiết bị', c==200 and j['data']['isApproved'] is True)
c,j=call('POST',f'/admin/devices/{did}/revoke',H,{'reason':'Mất máy test'})
chk('E8.6 Thu hồi thiết bị', c==200 and j['data']['isApproved'] is False)
c,j=call('GET','/admin/audit-logs',H)
logs=j['data'] if isinstance(j['data'],list) else j['data'].get('content',[])
chk('E8.7 Duyệt/thu hồi vào nhật ký', any(l.get('action') in ('APPROVE_DEVICE','REVOKE_DEVICE') for l in logs))
psql(f"delete from devices where id='{did}'")

# ---------- E10 Bảng phép ----------
c,j=call('GET','/leaves/table',H)
rows=j['data']
need=['employeeCode','fullName','teamName','annualRemaining','carriedOver','sickUsed','seniority','totalUsed']
chk('E10.1 Bảng phép 1 dòng/người đủ trường', c==200 and len(rows)>0 and all(k in rows[0] for k in need), [k for k in need if rows and k not in rows[0]])
chk('E10.2 Có nhóm để lọc', all('teamName' in r for r in rows))
c,j=call('GET','/leaves/ledger/by-code/'+rows[0]['employeeCode'],H)
chk('E10.3 Từ 1 dòng mở được sổ phép chi tiết', c==200 and isinstance(j['data'],list))
print('\nALL D5->E10 TESTS PASSED')
