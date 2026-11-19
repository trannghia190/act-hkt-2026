*** Settings ***
Documentation    Suite 02: Attendance Mobile Punch, 4 Request Types, 45-Cols Timesheet & Leaves
Resource         ../resources/attendance_keywords.robot

*** Test Cases ***
TC06: Verify Today Attendance Status
    [Documentation]    Lấy trạng thái chấm công hôm nay của nhân viên (ATT-PUNCH-01)
    ${resp}=    Get Attendance Status    ${EMP_CODE}
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}
    Should Be True    ${json['data']['hasCheckedIn']}

TC07: Verify Personal Calendar 5 Colors Grid
    [Documentation]    Lưới lịch công cá nhân dạng tháng 5 màu trực quan (ATT-CAL-01)
    ${resp}=    Get Personal Calendar    11    2026    ${EMP_CODE}
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}
    ${days}=    Set Variable    ${json['data']}
    Length Should Be    ${days}    30

TC08: Verify 45 Columns Timesheet Grid Structure
    [Documentation]    Lưới bảng công tổng hợp 45 cột chuẩn mẫu Kế toán ACT (ATT-GRID-01)
    ${resp}=    Get 45 Columns Timesheet Grid    2026-11
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}
    Should Be Equal As Integers    ${json['data']['totalColumns']}    45
    ${rows}=    Set Variable    ${json['data']['rows']}
    Length Should Be    ${rows}    4

TC09: Verify In-Place Timesheet Cell Editing With Mandatory Reason
    [Documentation]    Sửa ô công trực tiếp có audit trail và lý do (ATT-GRID-04)
    ${resp}=    Edit Timesheet Cell In Place    136ACT    2026-11-12    1.00    8.0    Đi công tác ngoài
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}

TC10: Verify 4 Request Types Creation
    [Documentation]    Tạo 4 loại đơn: Bổ sung công, Đi muộn, Nghỉ phép, WFH (ATT-REQ-01 -> 06)
    # 1. Missing punch
    ${r1}=    Submit Missing Punch Request    ${EMP_CODE}    2026-11-18    OUT    Quên quét ra
    Should Be Equal As Integers    ${r1.status_code}    200

    # 2. Late early
    ${r2}=    Submit Late Early Request    ${EMP_CODE}    2026-11-19    15    Tắc đường ngã tư
    Should Be Equal As Integers    ${r2.status_code}    200

    # 3. Leave
    ${r3}=    Submit Leave Request    ${EMP_CODE}    2026-11-20    2026-11-20    AL    Nghỉ giải quyết việc gia đình
    Should Be Equal As Integers    ${r3.status_code}    200

    # 4. WFH
    ${r4}=    Submit WFH Request    ${EMP_CODE}    2026-11-25    Làm việc từ xa hỗ trợ onsite
    Should Be Equal As Integers    ${r4.status_code}    200

TC11: Verify Manager Approvals And 1-Click Action
    [Documentation]    Quản lý xem danh sách đơn và duyệt 1-chạm (ATT-REQ-08)
    ${resp}=    Get Manager Approvals List
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}
    ${pending}=    Set Variable    ${json['data']}
    Should Not Be Empty    ${pending}
    ${first_id}=    Set Variable    ${pending[0]['id']}
    ${act_resp}=    Process Manager Approval Action    ${first_id}    APPROVE    Đồng ý phê duyệt
    Should Be Equal As Integers    ${act_resp.status_code}    200

TC12: Verify Leave Ledger History
    [Documentation]    Sổ cái biến động ngày phép Leave Ledger chi tiết (ATT-LEAVE-01)
    ${resp}=    Get Leave Ledger History    136ACT
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}
    ${entries}=    Set Variable    ${json['data']}
    Should Not Be Empty    ${entries}
