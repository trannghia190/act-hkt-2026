*** Settings ***
Documentation    Rule Engine & Administration Keywords
Library          RequestsLibrary
Library          Collections
Resource         variables.robot

*** Keywords ***
Get All 19 Dynamic Rules
    Create Session    rule_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    ${resp}=    Get Request    rule_sess    /rules
    [Return]    ${resp}

Update Rule Parameter
    [Arguments]    ${key}    ${new_val}    ${reason}=Cập nhật chính sách
    Create Session    rule_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    &{body}=    Create Dictionary    newValue=${new_val}    reason=${reason}    updatedBy=${ADMIN_CODE}
    ${resp}=    Put Request    rule_sess    /rules/${key}    json=${body}
    [Return]    ${resp}

Rollback Rule To Previous Version
    [Arguments]    ${key}
    Create Session    rule_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    ${resp}=    Post Request    rule_sess    /rules/${key}/rollback
    [Return]    ${resp}

Execute Dry Run Sandbox Simulation
    [Arguments]    ${key}    ${new_val}
    Create Session    rule_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    ${resp}=    Post Request    rule_sess    /rules/dry-run?ruleKey=${key}&newValue=${new_val}
    [Return]    ${resp}

Get Auto Generated Public FAQ
    Create Session    rule_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    ${resp}=    Get Request    rule_sess    /rules/public-faq
    [Return]    ${resp}

Get Employee List Admin
    Create Session    rule_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    ${resp}=    Get Request    rule_sess    /admin/users
    [Return]    ${resp}

Create Single Employee Admin
    [Arguments]    ${name}    ${email}    ${dept}=Khối Kỹ Thuật
    Create Session    rule_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    &{body}=    Create Dictionary    fullName=${name}    email=${email}    department=${dept}    role=EMPLOYEE
    ${resp}=    Post Request    rule_sess    /admin/users    json=${body}
    [Return]    ${resp}

Admin Reset Password And Unlock
    [Arguments]    ${emp_id}
    Create Session    rule_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    ${resp}=    Post Request    rule_sess    /admin/users/${emp_id}/reset-password
    [Return]    ${resp}

Get Departments Tree Admin
    Create Session    rule_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    ${resp}=    Get Request    rule_sess    /admin/departments/tree
    [Return]    ${resp}

Get Roles Matrix Admin
    Create Session    rule_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    ${resp}=    Get Request    rule_sess    /admin/roles/matrix
    [Return]    ${resp}

Get Centralized Audit Logs Admin
    Create Session    rule_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    ${resp}=    Get Request    rule_sess    /admin/audit-logs
    [Return]    ${resp}

Get Todo My Tasks
    Create Session    rule_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    ${resp}=    Get Request    rule_sess    /todos/my-tasks
    [Return]    ${resp}
