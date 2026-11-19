*** Settings ***
Documentation    Attendance, Biometric Punch, Requests & Timesheet Keywords
Library          RequestsLibrary
Library          Collections
Resource         variables.robot

*** Keywords ***
Get Attendance Status
    [Arguments]    ${code}=${EMP_CODE}
    Create Session    att_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    ${resp}=    Get Request    att_sess    /attendance/status?employeeCode=${code}
    [Return]    ${resp}

Get Attendance Monthly Summary
    [Arguments]    ${month}=11    ${year}=2026    ${code}=${EMP_CODE}
    Create Session    att_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    ${resp}=    Get Request    att_sess    /attendance/my-summary?month=${month}&year=${year}&employeeCode=${code}
    [Return]    ${resp}

Get Personal Calendar
    [Arguments]    ${month}=11    ${year}=2026    ${code}=${EMP_CODE}
    Create Session    att_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    ${resp}=    Get Request    att_sess    /attendance/calendar?month=${month}&year=${year}&employeeCode=${code}
    [Return]    ${resp}

Get 45 Columns Timesheet Grid
    [Arguments]    ${period}=2026-11
    Create Session    att_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    ${resp}=    Get Request    att_sess    /attendance/timesheet-grid?period=${period}
    [Return]    ${resp}

Edit Timesheet Cell In Place
    [Arguments]    ${code}    ${date}    ${symbol}    ${hours}    ${reason}
    Create Session    att_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    &{body}=    Create Dictionary    employeeCode=${code}    date=${date}    newSymbol=${symbol}    actualHours=${hours}    reason=${reason}
    ${resp}=    Put Request    att_sess    /attendance/timesheet/cell    json=${body}
    [Return]    ${resp}

Lock Official Timesheet Period
    [Arguments]    ${period}=2026-11
    Create Session    att_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    ${resp}=    Post Request    att_sess    /attendance/timesheet/lock?period=${period}
    [Return]    ${resp}

Submit Missing Punch Request
    [Arguments]    ${code}    ${date}    ${punch_type}    ${reason}
    Create Session    att_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    &{body}=    Create Dictionary    employeeCode=${code}    fromDate=${date}    punchType=${punch_type}    reason=${reason}
    ${resp}=    Post Request    att_sess    /attendance/requests/missing-punch    json=${body}
    [Return]    ${resp}

Submit Late Early Request
    [Arguments]    ${code}    ${date}    ${minutes}    ${reason}
    Create Session    att_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    &{body}=    Create Dictionary    employeeCode=${code}    fromDate=${date}    minutes=${minutes}    reason=${reason}
    ${resp}=    Post Request    att_sess    /attendance/requests/late-early    json=${body}
    [Return]    ${resp}

Submit Leave Request
    [Arguments]    ${code}    ${from_date}    ${to_date}    ${leave_type}    ${reason}
    Create Session    att_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    &{body}=    Create Dictionary    employeeCode=${code}    fromDate=${from_date}    toDate=${to_date}    leaveType=${leave_type}    reason=${reason}
    ${resp}=    Post Request    att_sess    /attendance/requests/leave    json=${body}
    [Return]    ${resp}

Submit WFH Request
    [Arguments]    ${code}    ${date}    ${reason}
    Create Session    att_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    &{body}=    Create Dictionary    employeeCode=${code}    fromDate=${date}    reason=${reason}
    ${resp}=    Post Request    att_sess    /attendance/requests/wfh    json=${body}
    [Return]    ${resp}

Get My Requests List
    [Arguments]    ${code}=${EMP_CODE}
    Create Session    att_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    ${resp}=    Get Request    att_sess    /attendance/my-requests?employeeCode=${code}
    [Return]    ${resp}

Cancel Pending Request
    [Arguments]    ${request_id}
    Create Session    att_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    ${resp}=    Post Request    att_sess    /attendance/requests/${request_id}/cancel
    [Return]    ${resp}

Get Manager Approvals List
    Create Session    att_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    ${resp}=    Get Request    att_sess    /attendance/approvals
    [Return]    ${resp}

Process Manager Approval Action
    [Arguments]    ${request_id}    ${action}    ${comment}=Đồng ý
    Create Session    att_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    &{body}=    Create Dictionary    action=${action}    comment=${comment}    approverCode=${MGR_CODE}
    ${resp}=    Post Request    att_sess    /attendance/approvals/${request_id}/action    json=${body}
    [Return]    ${resp}

Batch Approve Multiple Requests
    [Arguments]    ${request_ids}
    Create Session    att_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    &{body}=    Create Dictionary    requestIds=${request_ids}    approverCode=${MGR_CODE}
    ${resp}=    Post Request    att_sess    /attendance/batch-approve    json=${body}
    [Return]    ${resp}

Get Leave Ledger History
    [Arguments]    ${user_id}=136ACT
    Create Session    att_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    ${resp}=    Get Request    att_sess    /attendance/leave-ledger/${user_id}
    [Return]    ${resp}
