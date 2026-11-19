*** Settings ***
Documentation    Suite 01: Authentication, Password Policy, Face Biometric & Security
Resource         ../resources/auth_keywords.robot

*** Test Cases ***
TC01: Verify Successful Login With Internal Admin Account
    [Documentation]    Đăng nhập thành công với tài khoản Admin nội bộ Non-SSO (CORE-AUTH-01)
    ${resp}=    Login To System    ${ADMIN_CODE}    ${ADMIN_PASS}
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}
    Should Be Equal As Strings    ${json['data']['employeeCode']}    ${ADMIN_CODE}
    Should Be Equal As Strings    ${json['data']['role']}    ${ADMIN_ROLE}
    Should Not Be Empty           ${json['data']['accessToken']}

TC02: Verify Successful Login With Employee Persona
    [Documentation]    Đăng nhập thành công với tài khoản Nhân viên 136ACT (CORE-AUTH-01)
    ${resp}=    Login To System    ${EMP_CODE}    ${EMP_PASS}
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}
    Should Be Equal As Strings    ${json['data']['employeeCode']}    ${EMP_CODE}
    Should Be Equal As Strings    ${json['data']['role']}    ${EMP_ROLE}

TC03: Verify Failed Login Rejection With Invalid Password
    [Documentation]    Từ chối đăng nhập khi sai mật khẩu (CORE-AUTH-02)
    Verify Failed Login With Invalid Credentials    ${EMP_CODE}    WrongPassword123!

TC04: Verify Password Reset OTP Request Via Corporate Gmail
    [Documentation]    Yêu cầu gửi OTP quên mật khẩu qua Gmail thật (CORE-RESET-01)
    ${resp}=    Request Password Reset Link    admin@act.vn
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}

TC05: Verify Face Biometric Enrollment Wizard
    [Documentation]    Hoàn tất Wizard đăng ký mẫu khuôn mặt 3 góc (CORE-FACE-03)
    ${resp}=    Enroll Face Biometric Wizard    ${EMP_CODE}    data:image/jpeg;base64,mockFaceData
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}
