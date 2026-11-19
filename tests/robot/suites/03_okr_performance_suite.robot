*** Settings ***
Documentation    Suite 03: OKR Lifecycle, Form 4-Box Appraisal, HR 9-Fields & Bell Curve Calibration
Resource         ../resources/okr_keywords.robot

*** Test Cases ***
TC13: Verify OKR Dashboard & 4-Phase Progress
    [Documentation]    Dashboard OKR cá nhân & tiến độ chu kỳ 4 giai đoạn (S20)
    ${resp}=    Get OKR Dashboard Overview    2026
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}
    Should Be Equal As Strings    ${json['data']['currentPhase']}    CHECKIN
    Should Be True    ${json['data']['overallProgress']} > 0

TC14: Verify 20% Strategic Company Objectives & 1-Click Clone
    [Documentation]    Mục tiêu chiến lược công ty 20% & tính năng 1-chạm sao chép (S21, C12)
    ${resp}=    Get Strategic Company Objectives
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}
    ${comp_objs}=    Set Variable    ${json['data']}
    Should Not Be Empty    ${comp_objs}
    ${first_id}=    Set Variable    ${comp_objs[0]['id']}
    
    # 1-Click Clone
    ${clone_resp}=    Clone Strategic Company Objective    ${first_id}
    Should Be Equal As Integers    ${clone_resp.status_code}    200
    ${c_json}=    Set Variable    ${clone_resp.json()}
    Should Be True    ${c_json['success']}

TC15: Verify 100% Weight Validation On OKR Setup
    [Documentation]    Ràng buộc tổng trọng số của bộ mục tiêu phải đúng 100% (S21)
    # Valid 100% weight
    ${resp_valid}=    Submit Setup Total Weight Validation    100
    Should Be Equal As Integers    ${resp_valid.status_code}    200
    ${j_valid}=    Set Variable    ${resp_valid.json()}
    Should Be True    ${j_valid['success']}

    # Invalid weight (e.g. 85%) should fail
    ${resp_invalid}=    Submit Setup Total Weight Validation    85
    Should Be Equal As Integers    ${resp_invalid.status_code}    400

TC16: Verify Form 4-Box Self-Review With 1-5 Integer Constraint
    [Documentation]    Nhân viên nộp bản tự đánh giá cuối năm Form 4 Box điểm nguyên 1-5 (S23)
    # Valid integer score 4 and 5 -> avg 4.5
    ${resp}=    Submit Form 4 Box Self Review Integer Score    ${EMP_CODE}    ${4}    ${5}
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}
    Should Be Equal As Numbers    ${json['data']['selfAverageScore']}    4.5

    # Invalid score 6 (> 5) should be rejected
    ${resp_err}=    Submit Form 4 Box Self Review Integer Score    ${EMP_CODE}    ${6}    ${3}
    Should Be Equal As Integers    ${resp_err.status_code}    400

TC17: Verify Manager Assessment With 1-5 Integer Constraint
    [Documentation]    Quản lý chấm điểm độc lập 1-5 nguyên & nhận xét (S24)
    ${resp}=    Manager Assess Employee Integer Score    ${EMP_CODE}    ${4}    ${4}    Đạt yêu cầu xuất sắc
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}
    Should Be Equal As Numbers    ${json['data']['managerAverageScore']}    4.0

TC18: Verify HR 9-Fields Summary Report Structure
    [Documentation]    Bảng tổng hợp đánh giá HR chuẩn 9 trường theo doc/OKR_doc.md Bước 5 (S25)
    ${resp}=    Get HR 9 Fields Summary Report    2026
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}
    ${records}=    Set Variable    ${json['data']}
    Length Should Be    ${records}    4
    # Check 9 standard fields presence on first item
    ${item}=    Set Variable    ${records[0]}
    Dictionary Should Contain Key    ${item}    stt
    Dictionary Should Contain Key    ${item}    fullName
    Dictionary Should Contain Key    ${item}    employeeCode
    Dictionary Should Contain Key    ${item}    jobTitle
    Dictionary Should Contain Key    ${item}    seniority
    Dictionary Should Contain Key    ${item}    department
    Dictionary Should Contain Key    ${item}    directManagerName
    Dictionary Should Contain Key    ${item}    averageScore
    Dictionary Should Contain Key    ${item}    finalGrade

TC19: Verify Calibration Board Bell Curve & Move Card & Ratify
    [Documentation]    Hội đồng hiệu chuẩn phân phối chuẩn Bell Curve dạng Kanban & phê duyệt BOD (S26)
    # Get Kanban board
    ${resp_board}=    Get Calibration Board Bell Curve    2026
    Should Be Equal As Integers    ${resp_board.status_code}    200
    ${j_board}=    Set Variable    ${resp_board.json()}
    Should Be True    ${j_board['success']}
    Dictionary Should Contain Key    ${j_board['data']}    gradeA
    Dictionary Should Contain Key    ${j_board['data']}    gradeB
    Dictionary Should Contain Key    ${j_board['data']}    gradeC
    Dictionary Should Contain Key    ${j_board['data']}    gradeD

    # Move card
    ${resp_move}=    Move Card Calibration Kanban    ${EMP_CODE}    GRADE_A
    Should Be Equal As Integers    ${resp_move.status_code}    200

    # Ratify BOD
    ${resp_ratify}=    Ratify Final Calibration Ratings
    Should Be Equal As Integers    ${resp_ratify.status_code}    200
    ${j_ratify}=    Set Variable    ${resp_ratify.json()}
    Should Be True    ${j_ratify['success']}
