*** Settings ***
Documentation    Suite 04: Dynamic Rule Engine (19 Rules), Rollback, Dry-Run Simulation & Administration
Resource         ../resources/rule_keywords.robot
Suite Setup      Authenticate Rule Suite

*** Keywords ***
Authenticate Rule Suite
    Create Session    auth_init_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    &{body}=    Create Dictionary    employeeCodeOrEmail=${ADMIN_CODE}    password=${ADMIN_PASS}
    ${resp}=    Post Request    auth_init_sess    /auth/login    json=${body}
    ${token}=    Set Variable    ${resp.json()['data']['accessToken']}
    &{new_headers}=    Create Dictionary    Content-Type=application/json    Authorization=Bearer ${token}    X-Auth-Token=${token}
    Set Global Variable    ${COMMON_HEADERS}    ${new_headers}

*** Test Cases ***
TC20: Verify Catalog Of 19 Dynamic System Rules
    [Documentation]    Lấy đầy đủ danh mục 19 quy định động toàn hệ thống (S16 / S18)
    ${resp}=    Get All 19 Dynamic Rules
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}
    ${rules}=    Set Variable    ${json['data']}
    Length Should Be    ${rules}    19

TC21: Verify Rule Parameter Update And Versioning
    [Documentation]    Cập nhật tham số quy định động & tăng version (S18-E)
    ${resp}=    Update Rule Parameter    ATTENDANCE_GEOFENCE_RADIUS    250    Tăng bán kính chấm công cho tòa nhà mới
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}
    Should Be Equal As Strings    ${json['data']['currentValue']}    250
    Should Contain    ${json['data']['version']}    v

TC22: Verify 1-Click Rollback To Previous Version
    [Documentation]    Hoàn tác quy định về phiên bản trước đó trong 1 click (S18)
    ${resp}=    Rollback Rule To Previous Version    ATTENDANCE_GEOFENCE_RADIUS
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}
    Should Contain    ${json['data']['version']}    Rollback

TC23: Verify Dry-Run Sandbox Simulation
    [Documentation]    Giả lập chạy thử nghiệm quy định trong Sandbox phân tích tác động (S18)
    ${resp}=    Execute Dry Run Sandbox Simulation    TIMESHEET_LOCK_DAY    5
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}
    Dictionary Should Contain Key    ${json['data']}    affectedEmployeesCount
    Dictionary Should Contain Key    ${json['data']}    summaryText

TC24: Verify Auto-Generated Public FAQ From Active Rules
    [Documentation]    Trang tra cứu nội quy công ty tự động sinh từ Rule Engine (C10 / S19)
    ${resp}=    Get Auto Generated Public FAQ
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}
    ${faqs}=    Set Variable    ${json['data']}
    Should Not Be Empty    ${faqs}

TC25: Verify Admin Employee Lifecycle Operations
    [Documentation]    Quản lý nhân sự: Danh sách & thêm nhân viên mới (S06 / CORE-USER-01)
    # Get user list
    ${resp_list}=    Get Employee List Admin
    Should Be Equal As Integers    ${resp_list.status_code}    200
    ${j_list}=    Set Variable    ${resp_list.json()}
    Should Be True    ${j_list['success']}
    ${users}=    Set Variable    ${j_list['data']['content']}
    Should Not Be Empty    ${users}

    # Create new employee
    ${resp_create}=    Create Single Employee Admin    Lê Hoàng Nam    nam.lh@act.vn    Khối Kỹ Thuật (Sirius)
    Should Be Equal As Integers    ${resp_create.status_code}    200
    ${j_create}=    Set Variable    ${resp_create.json()}
    Should Be True    ${j_create['success']}
    Should Be Equal As Strings    ${j_create['data']['email']}    nam.lh@act.vn

    # Admin reset password & unlock
    ${first_id}=    Set Variable    ${users[0]['id']}
    ${resp_reset}=    Admin Reset Password And Unlock    ${first_id}
    Should Be Equal As Integers    ${resp_reset.status_code}    200

TC26: Verify RBAC Roles Matrix And Org Tree
    [Documentation]    Cơ cấu tổ chức hình cây và Ma trận phân quyền RBAC (S04, S05)
    # Departments Tree
    ${resp_dept}=    Get Departments Tree Admin
    Should Be Equal As Integers    ${resp_dept.status_code}    200
    ${j_dept}=    Set Variable    ${resp_dept.json()}
    Should Be True    ${j_dept['success']}
    ${depts}=    Set Variable    ${j_dept['data']}
    Should Not Be Empty    ${depts}

    # Roles Matrix
    ${resp_roles}=    Get Roles Matrix Admin
    Should Be Equal As Integers    ${resp_roles.status_code}    200
    ${j_roles}=    Set Variable    ${resp_roles.json()}
    Should Be True    ${j_roles['success']}

TC27: Verify Centralized Audit Trail Logs
    [Documentation]    Nhật ký kiểm toán tập trung ghi vết mọi thao tác hệ thống (S08 / CORE-AUDIT-01)
    ${resp}=    Get Centralized Audit Logs Admin
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}
    ${logs}=    Set Variable    ${json['data']}
    Should Not Be Empty    ${logs}

TC28: Verify Todo Inbox And Personal Tasks
    [Documentation]    Hộp thư việc cần xử lý Todo Inbox của nhân viên và quản lý (S38)
    ${resp}=    Get Todo My Tasks
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}
    ${tasks}=    Set Variable    ${json['data']}
    Should Not Be Empty    ${tasks}
