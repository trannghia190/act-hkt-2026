*** Settings ***
Documentation    Authentication & Account Lifecycle Keywords
Library          RequestsLibrary
Library          Collections
Resource         variables.robot

*** Keywords ***
Login To System
    [Arguments]    ${username}    ${password}
    Create Session    auth_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    &{body}=    Create Dictionary    employeeCodeOrEmail=${username}    password=${password}
    ${resp}=    Post Request    auth_sess    /auth/login    json=${body}
    [Return]    ${resp}

Login And Get Token
    [Arguments]    ${username}    ${password}
    ${resp}=    Login To System    ${username}    ${password}
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}
    ${token}=    Set Variable    ${json['data']['accessToken']}
    [Return]    ${token}

Verify Failed Login With Invalid Credentials
    [Arguments]    ${username}    ${wrong_pass}
    Create Session    auth_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    &{body}=    Create Dictionary    employeeCodeOrEmail=${username}    password=${wrong_pass}
    ${resp}=    Post Request    auth_sess    /auth/login    json=${body}
    Should Not Be Equal As Integers    ${resp.status_code}    200

Request Password Reset Link
    [Arguments]    ${email}
    Create Session    auth_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    &{body}=    Create Dictionary    email=${email}
    ${resp}=    Post Request    auth_sess    /auth/reset-password-request    json=${body}
    [Return]    ${resp}

Change Password For User
    [Arguments]    ${code}    ${old_pass}    ${new_pass}
    Create Session    auth_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    &{body}=    Create Dictionary    employeeCode=${code}    oldPassword=${old_pass}    newPassword=${new_pass}
    ${resp}=    Post Request    auth_sess    /auth/change-password    json=${body}
    [Return]    ${resp}

Enroll Face Biometric Wizard
    [Arguments]    ${code}    ${face_data_url}
    Create Session    auth_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    &{body}=    Create Dictionary    employeeCode=${code}    faceDataUrl=${face_data_url}    confidenceScore=${0.98}
    ${resp}=    Post Request    auth_sess    /auth/enroll-face    json=${body}
    [Return]    ${resp}
