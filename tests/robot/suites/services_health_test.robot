*** Settings ***
Documentation    Backend Services Health Check Suite
Library          RequestsLibrary
Library          Collections

*** Variables ***
${CORE_BASE_URL}    http://localhost:8080/api/v1
${AI_BASE_URL}      http://localhost:8000

*** Test Cases ***
Verify AI Face Service Health
    Create Session    ai_face    ${AI_BASE_URL}
    ${resp}=    Get Request    ai_face    /health
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be Equal As Strings    ${json['status']}    UP
    Should Be Equal As Strings    ${json['service']}    ai-face-service

Verify Core Service SMTP Status
    Create Session    core    ${CORE_BASE_URL}
    ${resp}=    Get Request    core    /auth/smtp-status
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}
