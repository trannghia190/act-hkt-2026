*** Settings ***
Documentation    OKR & Performance Appraisal Keywords
Library          RequestsLibrary
Library          Collections
Resource         variables.robot

*** Keywords ***
Get OKR Dashboard Overview
    [Arguments]    ${year}=2026
    Create Session    okr_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    ${resp}=    Get Request    okr_sess    /okr/my-dashboard?year=${year}
    [Return]    ${resp}

Get Strategic Company Objectives
    Create Session    okr_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    ${resp}=    Get Request    okr_sess    /okr/company-objectives
    [Return]    ${resp}

Clone Strategic Company Objective
    [Arguments]    ${objective_id}
    Create Session    okr_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    ${resp}=    Post Request    okr_sess    /okr/clone-company-objective?objectiveId=${objective_id}
    [Return]    ${resp}

Submit Setup Total Weight Validation
    [Arguments]    ${total_weight}=100
    Create Session    okr_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    &{body}=    Create Dictionary    totalWeight=${total_weight}
    ${resp}=    Post Request    okr_sess    /okr/submit-setup    json=${body}
    [Return]    ${resp}

Manager Approve Setup Phase
    [Arguments]    ${review_id}    ${action}=APPROVE
    Create Session    okr_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    ${resp}=    Put Request    okr_sess    /okr/reviews/${review_id}/approve-setup?action=${action}
    [Return]    ${resp}

Get Form 4 Box Review Data
    [Arguments]    ${code}=${EMP_CODE}
    Create Session    okr_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    ${resp}=    Get Request    okr_sess    /okr/reviews/form-4box?employeeCode=${code}
    [Return]    ${resp}

Submit Form 4 Box Self Review Integer Score
    [Arguments]    ${code}    ${business_score}    ${people_score}
    Create Session    okr_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    &{body}=    Create Dictionary
    ...    employeeCode=${code}
    ...    year=${2026}
    ...    box1Achievements=Hoàn thành xuất sắc nhiệm vụ phát triển dự án ACT-HKT
    ...    box2BusinessScore=${business_score}
    ...    box2BusinessComment=Hoàn thành đúng tiến độ các mục tiêu kinh doanh
    ...    box3PeopleScore=${people_score}
    ...    box3PeopleComment=Đào tạo và hỗ trợ các bạn trẻ trong nhóm
    ...    box4SelfProposal=Tham gia học chứng chỉ Cloud Solution Architect
    ${resp}=    Post Request    okr_sess    /okr/reviews/submit-self-review    json=${body}
    [Return]    ${resp}

Manager Assess Employee Integer Score
    [Arguments]    ${code}    ${b_score}    ${p_score}    ${comment}=Đạt kết quả tốt
    Create Session    okr_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    &{body}=    Create Dictionary
    ...    employeeCode=${code}
    ...    managerBusinessScore=${b_score}
    ...    managerPeopleScore=${p_score}
    ...    managerComment=${comment}
    ...    assessorCode=${MGR_CODE}
    ${resp}=    Post Request    okr_sess    /okr/reviews/mgr-review/manager-assess    json=${body}
    [Return]    ${resp}

Get HR 9 Fields Summary Report
    [Arguments]    ${year}=2026
    Create Session    okr_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    ${resp}=    Get Request    okr_sess    /okr/admin/hr-summary-report?year=${year}
    [Return]    ${resp}

Get Calibration Board Bell Curve
    [Arguments]    ${year}=2026
    Create Session    okr_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    ${resp}=    Get Request    okr_sess    /okr/calibration/board?year=${year}
    [Return]    ${resp}

Move Card Calibration Kanban
    [Arguments]    ${code}    ${target_grade}
    Create Session    okr_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    &{body}=    Create Dictionary    employeeCode=${code}    targetGrade=${target_grade}
    ${resp}=    Put Request    okr_sess    /okr/calibration/move-card    json=${body}
    [Return]    ${resp}

Ratify Final Calibration Ratings
    Create Session    okr_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    ${resp}=    Post Request    okr_sess    /okr/calibration/ratify
    [Return]    ${resp}
