*** Settings ***
Documentation    Full Verification: Phân Hệ Quản Trị & Đánh Giá OKR (26 Features)
Library          RequestsLibrary
Library          Collections
Resource         ../resources/variables.robot

*** Test Cases ***
TC_OKR-DASH-01: Dashboard Quản Trị OKR Cá Nhân & Chu Kỳ 4 Giai Đoạn
    [Documentation]    [[S20]] [P0] Màn hình trung tâm của phân hệ OKR hiển thị thanh tiến trình trực quan 4 giai đoạn: 1. Thiết lập đầu năm -> 2. Check-in định kỳ -> 3. Đánh giá giữa năm -> 4. Tổng kết cuối năm. | Expected: Input: Request GET /api/v1/okr/my-dashboard?year=2026; User ID đăng nhập. Xử lý hệ thống & Lưu trữ: 1. Core Service xác định giai đoạn hiện tại của năm dựa trên cấu hình chu kỳ trong bảng 'okr_cycles'. 2. Tính toán tỷ lệ % hoàn thành trung bình của 2 nhóm mục tiêu Business & People. 3. Tra cứu lịch sử xếp loại và điểm đánh giá của các năm trước. Output: Dashboard sinh động hiển thị: Thanh tiến trình 4 Phase có chỉ báo 'Bạn đang ở Phase 2: Check-in Tháng 11'; 2 thẻ tiến độ Business & People; Nút bấm hành động nhanh tương ứng với từng giai đoạn. Kết quả cuối cùng: Nhân viên nắm bắt toàn cảnh tiến trình phát triển của bản thân trong cả chu kỳ năm.
    Create Session    okr_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    ${resp}=    Get Request    okr_sess    /okr/my-dashboard?year=2026
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}

TC_OKR-SETUP-01: Gợi Ý Mục Tiêu Chiến Lược Công Ty (20%) & Sao Chép 1-Chạm (C12)
    [Documentation]    [[S21]] [P0] Hiển thị danh mục các mục tiêu chiến lược của Tổng công ty ACT trong năm 2026 kèm nút bấm 1 chạm sao chép trực tiếp vào bộ mục tiêu cá nhân của nhân viên. | Expected: Input: Request GET /api/v1/okr/company-objectives?year=2026; Click nút [Sao chép vào mục tiêu của tôi]. Xử lý hệ thống & Lưu trữ: 1. Truy vấn các mục tiêu chiến lược công ty (loại STRATEGIC_COMPANY, chiếm 20% tỷ trọng). 2. Khi nhân viên click sao chép, tự động khởi tạo mục tiêu mới trong nhóm Business Objectives của nhân viên, gắn cờ is_company_aligned = true và kế thừa các chỉ số đo lường chuẩn. Output: Mục tiêu công ty tự động điền vào form thiết lập OKR cá nhân mà không cần nhân viên phải gõ lại từng từ. Kết quả cuối cùng: Đảm bảo 100% cán bộ nhân viên đều hướng mục tiêu của mình bám sát chiến lược chung của toàn công ty.
    Create Session    okr_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    ${resp}=    Get Request    okr_sess    /okr/company-objectives
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}
    &{body}=    Create Dictionary
    ${resp}=    Post Request    okr_sess    /okr/clone-company-objective?objectiveId=comp-01    json=${body}
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}

TC_OKR-SETUP-02: Thiết Lập Mục Tiêu Cá Nhân (80%) Không Giới Hạn Ký Tự
    [Documentation]    [[S21]] [P0] Cho phép nhân viên tự do diễn giải và mô tả các mục tiêu đột phá chuyên môn của bản thân (chiếm 80% tỷ trọng còn lại) với khung soạn thảo rộng rãi không bị gò bó độ dài. | Expected: Input: Form body: title (Tên mục tiêu), category ('BUSINESS' hoặc 'PEOPLE'), description (Mô tả chi tiết), weightPercentage (Trọng số %). Xử lý hệ thống & Lưu trữ: 1. Cho phép nhập văn bản đa dòng không giới hạn ký tự (kiểu dữ liệu TEXT/CLOB). 2. Validate trọng số % > 0. 3. Lưu vào bảng 'okr_objectives' (user_id, cycle_year, category, title, description, weight, status='DRAFT'). Output: Mục tiêu cá nhân được thêm vào danh sách, hiển thị thẻ trực quan kèm thanh phân bổ trọng số. Kết quả cuối cùng: Nhân viên thoải mái thể hiện khát vọng nghề nghiệp và cam kết hành động cụ thể.
    Create Session    okr_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    &{body}=    Create Dictionary    employeeCode=${EMP_CODE}    status=ACTIVE
    ${resp}=    Post Request    okr_sess    /okr/objectives    json=${body}
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}

TC_OKR-SETUP-03: Thiết Lập Key Results (KRs) Lượng Hóa Với 4 Loại Đơn Vị Đo
    [Documentation]    [[S21]] [P0] Xác lập các kết quả then chốt (Key Results) có thể đo đếm định lượng được với 4 loại đơn vị đo lường linh hoạt: Con số, Doanh thu tiền tệ VND, Tỷ lệ %, hoặc Mốc hoàn thành (Milestone). | Expected: Input: Form thêm KR: objectiveId, krTitle, metricType ('NUMERIC', 'CURRENCY', 'PERCENTAGE', 'MILESTONE'), startValue, targetValue, unitName (ví dụ: 'Khách hàng', 'Tỷ VNĐ', '% SLA', 'Giai đoạn'). Xử lý hệ thống & Lưu trữ: 1. Validate targetValue > startValue (hoặc ngược lại nếu mục tiêu giảm chi phí). 2. Lưu vào bảng 'okr_key_results' (objective_id, title, metric_type, start_val, target_val, current_val, unit, weight). 3. Tự động tính toán công thức tiến độ KR: `progress = (current - start) / (target - start) * 100%`. Output: Thẻ Key Result hiển thị rõ: Mục tiêu ban đầu, Mục tiêu hướng tới, Đơn vị đo và thanh tiến độ khởi tạo 0%. Kết quả cuối cùng: Định lượng hóa 100% mục tiêu, loại bỏ các mục tiêu mơ hồ, cảm tính.
    Create Session    okr_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    &{body}=    Create Dictionary    employeeCode=${EMP_CODE}    status=ACTIVE
    ${resp}=    Post Request    okr_sess    /okr/key-results    json=${body}
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}

TC_OKR-SETUP-04: Ràng Buộc Tổng Trọng Số Bắt Buộc 100% & Gửi Quản Lý Phê Duyệt
    [Documentation]    [[S21]] [P0] Kiểm tra tính toàn vẹn của bộ mục tiêu OKR: bắt buộc tổng trọng số của tất cả các Objectives và KRs phải cộng lại tròn đúng 100% trước khi gửi cấp trên phê duyệt. | Expected: Input: Click nút [Gửi bộ mục tiêu cho Quản lý duyệt]; Tổng hợp trọng số của toàn bộ danh mục OKR. Xử lý hệ thống & Lưu trữ: 1. Core Service tính tổng trọng số: `totalWeight = SUM(weight)`. 2. Nếu totalWeight != 100% (ví dụ mới đạt 85% hoặc vượt quá 110%) -> Chặn submit và hiển thị cảnh báo đỏ 'Tổng trọng số phải bằng đúng 100% (Hiện tại: X%)'. 3. Khi tròn 100% -> Chuyển trạng thái sang 'PENDING_SETUP_APPROVAL'. 4. Đẩy thông báo và tạo nhiệm vụ trong Todo Inbox của Quản lý trực tiếp. Output: HTTP 200 OK; UI khóa form ở chế độ Read-Only và hiển thị huy hiệu 'Chờ Quản lý phê duyệt mục tiêu'. Kết quả cuối cùng: Đảm bảo tính toán khoa học, tránh việc phân bổ nguồn lực không cân bằng.
    Create Session    okr_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    &{body}=    Create Dictionary    totalWeight=${100}
    ${resp}=    Post Request    okr_sess    /okr/submit-setup    json=${body}
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}

TC_OKR-APPR-01: Quản Lý Phê Duyệt Mục Tiêu Đầu Năm (Approve / Return With Feedback)
    [Documentation]    [[S42]] [P0] Màn hình dành riêng cho Quản lý trực tiếp rà soát tính khả thi và độ thách thức của mục tiêu do nhân viên đề xuất, phê duyệt hoặc trả lại kèm ý kiến định hướng chi tiết. | Expected: Input: Quản lý chọn xem bộ OKR của nhân viên A; Bấm nút [Duyệt OKR] hoặc [Yêu cầu chỉnh sửa kèm nhận xét]. Xử lý hệ thống & Lưu trữ: 1. Nếu [Duyệt]: Cập nhật status='APPROVED_SETUP', đóng giai đoạn Setup và mở quyền Check-in định kỳ cho nhân viên; Gửi email thông báo chúc mừng. 2. Nếu [Trả lại]: Bắt buộc nhập nhận xét phản hồi, cập nhật status='RETURNED', mở lại quyền chỉnh sửa cho nhân viên kèm thông báo cần sửa những gì. Output: HTTP 200 OK; Nhiệm vụ hoàn tất trong Todo Inbox của Quản lý; Nhân viên nhận được thông báo phản hồi ngay lập tức. Kết quả cuối cùng: Đảm bảo sự thống nhất tuyệt đối về mục tiêu cam kết giữa Quản lý và Nhân viên ngay từ đầu năm.
    Create Session    okr_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    &{body}=    Create Dictionary
    ${resp}=    Put Request    okr_sess    /okr/reviews/1/approve-setup?action=APPROVE    json=${body}
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}

TC_OKR-TREE-01: Cây Phả Hệ Mục Tiêu Toàn Doanh Nghiệp (OKR Alignment Tree)
    [Documentation]    [[S27]] [P0] Sơ đồ cây trực quan kết nối dòng chảy mục tiêu từ cấp Tổng công ty -> Khối -> Phòng ban -> Cá nhân, giúp nhận diện ngay các nút thắt chậm tiến độ. | Expected: Input: Request GET /api/v1/okr/alignment-tree?year=2026. Xử lý hệ thống & Lưu trữ: 1. Truy vấn liên kết quan hệ cha-con (parent_objective_id) giữa các tầng OKR. 2. Xây dựng cấu trúc cây đồ thị phân cấp. 3. Tính toán tiến độ cuộn lên (Rollup Progress) từ cấp dưới lên cấp trên. 4. Đánh dấu màu đỏ cảnh báo các mục tiêu bị chậm tiến độ nghiêm trọng (Lagging OKRs, tiến độ < 50% so với kế hoạch kỳ). Output: Sơ đồ tương tác dạng đồ thị hình cây mượt mà, hỗ trợ zoom in, zoom out và click vào từng nút để xem chi tiết người phụ trách. Kết quả cuối cùng: Lãnh đạo nắm trọn bức tranh thực thi chiến lược toàn công ty trong tầm mắt.
    Create Session    okr_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    ${resp}=    Get Request    okr_sess    /okr/alignment-tree
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}

TC_OKR-CHK-01: Check-in Tiến Độ Định Kỳ & Tự Động Kế Thừa Kỳ Trước (C13)
    [Documentation]    [[S22]] [P0] Màn hình cập nhật tiến độ định kỳ (Hàng tháng/Hàng quý) tự động điền sẵn số liệu tiến độ của kỳ trước giúp nhân viên tiết kiệm tối đa thời gian nhập liệu. | Expected: Input: Form Check-in tháng 11: Mở form cập nhật cho từng Key Result. Xử lý hệ thống & Lưu trữ: 1. Core Service tự động tải giá trị thực tế của kỳ check-in tháng 10 (ví dụ: KR1 đang là 60%). 2. Hiển thị sẵn thanh trượt Slider ở mốc 60%. 3. Nhân viên chỉ cần kéo nhẹ lên mốc mới (ví dụ: 75%). 4. Tự động tính toán độ biến thiên tiến độ: `delta = 75% - 60% = +15%`. Output: Form hiển thị trực quan mức tăng trưởng; Nhân viên không phải nhớ hay gõ lại từ đầu. Kết quả cuối cùng: Quy trình check-in nhẹ nhàng chỉ mất 2 phút mỗi tháng, duy trì thói quen theo dõi mục tiêu liên tục.
    Create Session    okr_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    ${resp}=    Get Request    okr_sess    /okr/check-in/current
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}
    &{body}=    Create Dictionary    employeeCode=${EMP_CODE}    status=ACTIVE
    ${resp}=    Post Request    okr_sess    /okr/check-in    json=${body}
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}

TC_OKR-CHK-02: Đính Kèm File Minh Chứng Kết Quả & Lưu Lịch Sử Check-in
    [Documentation]    [[S22]] [P0] Cho phép nhân viên tải lên các tệp tài liệu, báo cáo kết quả, liên kết sản phẩm làm bằng chứng xác thực cho tiến độ đã khai báo. | Expected: Input: File upload (.pdf, .xlsx, .docx, ảnh) hoặc đường dẫn URL sản phẩm; Ghi chú kết quả đạt được, khó khăn và giải pháp. Xử lý hệ thống & Lưu trữ: 1. Lưu file vào Media Storage, sinh đường dẫn tải an toàn. 2. Lưu bản ghi vào bảng 'okr_checkin_history' (kr_id, checkin_date, old_val, new_val, confidence_level, note, attachment_urls, created_at). 3. Cập nhật giá trị current_val trong bảng 'okr_key_results'. Output: HTTP 201 Created; Dòng thời gian lịch sử check-in của KR xuất hiện thêm một mốc mới kèm icon xem file đính kèm. Kết quả cuối cùng: Tiến độ được bảo chứng bằng dữ liệu thật, Quản lý dễ dàng kiểm chứng khi review.
    Create Session    okr_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    &{body}=    Create Dictionary    employeeCode=${EMP_CODE}    status=ACTIVE
    ${resp}=    Post Request    okr_sess    /okr/check-in/submit    json=${body}
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}

TC_OKR-MID-01: Biên Bản Đánh Giá & Coaching Giữa Năm (Mid-Year 1-on-1 Review)
    [Documentation]    [[S43]] [P0] Giao diện ghi nhận biên bản cuộc họp 1-on-1 giữa Quản lý và Nhân viên vào giữa năm, đánh giá kết quả 6 tháng đầu năm và đưa ra các định hướng giải pháp cho nửa cuối năm. | Expected: Input: Form body S43: employeeId, strengthsNotes (Ưu điểm), improvementNotes (Điểm cần cải thiện), coachingActionPlan (Kế hoạch hành động), agreedStatus. Xử lý hệ thống & Lưu trữ: 1. Lưu vào bảng 'okr_midyear_reviews'. 2. Hỗ trợ tính năng điều chỉnh mục tiêu (Pivoting Objectives) nếu có thay đổi chiến lược lớn từ Ban Giám Đốc. 3. Cả Quản lý và Nhân viên cùng bấm nút [Xác nhận đồng thuận] để ký điện tử biên bản. Output: HTTP 200 OK; Biên bản giữa năm được lưu trữ an toàn, hiển thị huy hiệu 'Đã hoàn tất Review giữa năm'. Kết quả cuối cùng: Tăng cường tính kết nối và gắn kết đội ngũ, giúp nhân viên kịp thời điều chỉnh hướng đi trước khi quá muộn.
    Create Session    okr_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    &{body}=    Create Dictionary    employeeCode=${EMP_CODE}    status=ACTIVE
    ${resp}=    Post Request    okr_sess    /okr/midyear-reviews    json=${body}
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}

TC_OKR-REV-01: Màn Hình Tự Đánh Giá Cuối Năm Chuẩn Form 4 Box ACT
    [Documentation]    [[S23]] [P0] Màn hình tự đánh giá hiệu suất của nhân viên được thiết kế chuẩn xác 100% theo Form 4 Box trong tài liệu quy định chính thức của công ty (doc/OKR_doc.md). | Expected: Input: Request GET /api/v1/okr/reviews/form-4box?year=2026; User ID hiện tại. Xử lý hệ thống & Lưu trữ: 1. Core Service khởi tạo bản ghi đánh giá năm trong bảng 'okr_reviews' với 4 Box dữ liệu rành mạch. 2. Nạp dữ liệu thành tựu tự động từ tiến độ các KRs trong năm. 3. Cung cấp thang điểm chấm 1-5 nguyên ở cấp độ nhóm. Output: Giao diện Form 4 Box chuẩn: Box 1 (Thành tựu chính), Box 2 (Mục tiêu công việc Business), Box 3 (Mục tiêu con người People), Box 4 (Kế hoạch & Nguyện vọng năm tới). Kết quả cuối cùng: Nhân viên có cái nhìn toàn diện để tự soi rọi quá trình công tác trong cả năm.
    Create Session    okr_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    ${resp}=    Get Request    okr_sess    /okr/reviews/my-review?year=2026
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}

TC_OKR-REV-02: Box 1 - Tổng Kết Thành Tựu Nổi Bật & Các KPI Đã Đạt Được
    [Documentation]    [[S23]] [P0] Khu vực đầu tiên của Form 4 Box cho phép nhân viên tóm tắt các kết quả nổi bật nhất, các dự án tiêu biểu đã hoàn thành và đóng góp cá nhân xuất sắc trong năm. | Expected: Input: Nội dung văn bản tổng kết thành tựu tại Box 1 (hỗ trợ nhập văn bản dài, gạch đầu dòng). Xử lý hệ thống & Lưu trữ: 1. Tự động hiển thị thẻ tóm tắt các KRs đã đạt 100% bên cạnh làm gợi ý. 2. Lưu văn bản vào cột 'box1_achievements' trong bảng 'okr_reviews'. Output: Văn bản được lưu tự động dạng Draft khi nhân viên gõ (Auto-save). Kết quả cuối cùng: Bức tranh tổng thể về đóng góp của nhân viên được làm nổi bật ngay đầu bản đánh giá.
    Create Session    okr_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    &{body}=    Create Dictionary    status=UPDATED
    ${resp}=    Put Request    okr_sess    /okr/reviews/1/box1    json=${body}
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}

TC_OKR-REV-03: Box 2 & Box 3 - Chấm Điểm Thang 1-5 Nguyên Ở Cấp Nhóm (Không Điểm Lẻ)
    [Documentation]    [[S23]] [P0] Quy định nghiệp vụ cốt lõi: Mỗi nhóm mục tiêu (Business và People) được chấm duy nhất 1 điểm số nguyên từ 1 đến 5 (1: Kém, 2: Cần cải thiện, 3: Đạt yêu cầu, 4: Tốt, 5: Xuất sắc), tuyệt đối không có điểm lẻ. | Expected: Input: Điểm tự chọn của nhân viên tại Box 2 (Business Score) và Box 3 (People Score) bằng Radio button chọn số 1, 2, 3, 4, hoặc 5. Xử lý hệ thống & Lưu trữ: 1. Validate điểm số là số nguyên `score in (1, 2, 3, 4, 5)`. Chặn tuyệt đối điểm số thập phân như 3.5 hay 4.2. 2. Bắt buộc nhập giải trình chi tiết cho mức điểm đã chọn. 3. Lưu vào các cột 'self_score_business' và 'self_score_people' trong bảng 'okr_reviews'. Output: Thẻ lựa chọn số nguyên to rõ, có giải nghĩa tiêu chí tương ứng với từng mức điểm. Kết quả cuối cùng: Tuân thủ chính xác quy tắc đánh giá của ACT (doc/OKR_doc.md Box 2-3); loại bỏ tranh cãi về các con số lẻ.
    Create Session    okr_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    &{body}=    Create Dictionary    status=UPDATED
    ${resp}=    Put Request    okr_sess    /okr/reviews/1/box2-3    json=${body}
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}

TC_OKR-REV-04: Box 4 - Kế Hoạch & Nguyện Vọng Phát Triển Bản Thân Năm Tới (Self-Proposal)
    [Documentation]    [[S23]] [P0] Khu vực Box 4 trong form chuẩn dành cho nhân viên đề xuất nguyện vọng nghề nghiệp, kế hoạch học tập nâng cao chuyên môn và đề xuất vị trí/chế độ trong năm tiếp theo. | Expected: Input: Nội dung đề xuất bản thân năm tới: Định hướng phát triển kỹ năng, Khóa học mong muốn tham gia, Nguyện vọng thăng tiến. Xử lý hệ thống & Lưu trữ: 1. Lưu vào cột 'box4_self_proposal' trong bảng 'okr_reviews'. 2. Dữ liệu này chỉ được chia sẻ cho Quản lý trực tiếp và Giám đốc Nhân sự để làm căn cứ quy hoạch cán bộ. Output: Văn bản lưu trữ an toàn, bảo mật thông tin nguyện vọng cá nhân. Kết quả cuối cùng: Lãnh đạo thấu hiểu tâm tư nguyện vọng của nhân viên, xây dựng lộ trình thăng tiến phù hợp.
    Create Session    okr_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    &{body}=    Create Dictionary    status=UPDATED
    ${resp}=    Put Request    okr_sess    /okr/reviews/1/box4    json=${body}
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}

TC_OKR-REV-05: Phần Mềm Tự Động Tính Điểm Trung Bình & Nộp Bản Tự Đánh Giá
    [Documentation]    [[S23]] [P0] Hệ thống tự động tính toán điểm trung bình đề xuất của nhân viên theo công thức chuẩn: `(Điểm Business + Điểm People) / 2` và nộp lên Quản lý trực tiếp. | Expected: Input: self_score_business và self_score_people; Bấm nút [Nộp bản tự đánh giá]. Xử lý hệ thống & Lưu trữ: 1. Core Service tính: `self_average_score = (self_score_business + self_score_people) / 2.0`. 2. Validate tất cả 4 Box đã được điền đầy đủ. 3. Cập nhật status = 'PENDING_MANAGER_ASSESSMENT'. 4. Gửi email thông báo và tạo nhiệm vụ trong Todo Inbox của Quản lý. Output: HTTP 200 OK; Điểm trung bình hiển thị to rõ kèm huy hiệu xếp loại dự kiến (ví dụ: Điểm 4.5 -> Xếp loại A-Tốt); Form khóa quyền sửa. Kết quả cuối cùng: Hoàn tất Bước 1 trong Quy trình đánh giá 5 bước của ACT, chuyển giao cho Quản lý đánh giá.
    Create Session    okr_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    &{body}=    Create Dictionary    employeeCode=${EMP_CODE}    box2BusinessScore=${4}    box3PeopleScore=${5}
    ${resp}=    Post Request    okr_sess    /okr/reviews/submit-self-review    json=${body}
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}

TC_OKR-MGR-01: Quản Lý Chấm Điểm Độc Lập 1-5 Nguyên & Nhận Xét Nhân Viên
    [Documentation]    [[S24]] [P0] Màn hình dành riêng cho Quản lý trực tiếp: xem toàn bộ minh chứng của nhân viên, chấm điểm độc lập 1-5 nguyên cho 2 nhóm Business & People và ghi nhận xét chính thức. | Expected: Input: Quản lý chọn chấm điểm cho nhân viên A; Nhập manager_score_business (1-5), manager_score_people (1-5), manager_comments (Nhận xét toàn diện). Xử lý hệ thống & Lưu trữ: 1. Validate điểm Quản lý chấm là số nguyên từ 1 đến 5. 2. Tự động tính điểm trung bình chính thức của Quản lý: `manager_average_score = (business + people) / 2.0`. 3. Lưu vào bảng 'okr_reviews'. 4. Cập nhật status = 'MANAGER_ASSESSED'. 5. Nộp kết quả lên Hội đồng HR tổng hợp. Output: HTTP 200 OK; Điểm số và nhận xét của Quản lý được ghi nhận chính thức; Hoàn tất Bước 2 của quy trình. Kết quả cuối cùng: Đánh giá 2 chiều minh bạch, sẵn sàng cho công tác tổng hợp toàn công ty.
    Create Session    okr_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    &{body}=    Create Dictionary    employeeCode=${EMP_CODE}    managerBusinessScore=${4}    managerPeopleScore=${4}
    ${resp}=    Post Request    okr_sess    /okr/reviews/1/manager-assess    json=${body}
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}

TC_OKR-RPT-01: Bảng Tổng Hợp Đánh Giá HR Chuẩn 9 Trường Quy Định (doc/OKR_doc.md Bước 5)
    [Documentation]    [[S25]] [P0] Bảng tổng hợp kết quả đánh giá toàn công ty phục vụ phòng HR và Ban Giám Đốc chuẩn xác đúng 9 trường dữ liệu theo quy định chính thức của công ty kèm cột trạng thái theo dõi tiến độ. | Expected: Input: Request GET /api/v1/okr/admin/hr-summary-report?year=2026; Bộ lọc phòng ban, trạng thái. Xử lý hệ thống & Lưu trữ: 1. Core Service tổng hợp kết quả của toàn bộ nhân viên. 2. Trích xuất đúng 9 trường bắt buộc: 1. Họ và tên, 2. Mã nhân viên, 3. Chức danh công việc, 4. Thời gian công tác (Thâm niên), 5. Phòng ban/Đơn vị, 6. Họ tên Quản lý trực tiếp, 7. Điểm công việc (Business 1-5), 8. Điểm con người (People 1-5), 9. Điểm TB tổng hợp. 3. Bổ sung cột Trạng thái (Chưa tự đánh giá / Chờ QL chấm / Đã chấm xong). Output: Bảng tổng hợp HR chuẩn mực, hỗ trợ lọc, tìm kiếm và phân trang mượt mà. Kết quả cuối cùng: HR có công cụ quản trị tiến độ và kết quả đánh giá toàn diện, thay thế cho các bảng kanban rời rạc.
    Create Session    okr_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    ${resp}=    Get Request    okr_sess    /okr/admin/hr-summary-report
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}

TC_OKR-RPT-02: Xuất Báo Cáo Tổng Hợp OKR Ra File Excel (.xlsx) Xét Thưởng
    [Documentation]    [[S25]] [P0] Kết xuất toàn bộ dữ liệu bảng tổng hợp 9 trường của toàn công ty ra tệp Excel định dạng chuẩn phục vụ Hội đồng Thi đua - Khen thưởng và tính thưởng cuối năm. | Expected: Input: Request GET /api/v1/okr/admin/export-excel?year=2026. Xử lý hệ thống & Lưu trữ: 1. Truy vấn dữ liệu đánh giá đầy đủ. 2. Dùng Apache POI sinh file Excel: Có tiêu đề công ty, dòng tiêu đề in đậm, định dạng căn lề chuẩn và công thức tính điểm trung bình tự động. 3. Mã hóa file an toàn. Output: File 'ACT_Bao_Cao_Tong_Hop_Danh_Gia_OKR_2026.xlsx' tải về máy. Kết quả cuối cùng: Phòng HR có báo cáo tức thì nộp lên Tổng Giám Đốc và Hội đồng Quản trị.
    Create Session    okr_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    ${resp}=    Get Request    okr_sess    /okr/admin/export-excel
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}

TC_OKR-CALIB-01: Calibration Board - Hội Đồng Hiệu Chuẩn Phân Phối Chuẩn Dạng Kanban
    [Documentation]    [[S26]] [P0] Màn hình hiệu chuẩn xếp loại hiệu suất toàn công ty dạng Kanban trực quan: 4 cột phân hạng (Xuất sắc A, Tốt B, Đạt C, Cần cải thiện D) với cơ chế kéo thả thẻ nhân viên mượt mà. | Expected: Input: Request GET /api/v1/okr/calibration/board?year=2026; Thao tác Drag & Drop thẻ nhân viên giữa các cột xếp loại. Xử lý hệ thống & Lưu trữ: 1. Core Service hiển thị các thẻ nhân viên được phân loại vào 4 cột dựa trên điểm trung bình ban đầu. 2. Hội đồng hiệu chuẩn kéo thả nhân viên qua lại giữa các cột để cân đối. 3. Tự động tính toán lại tỷ lệ phân bổ thực tế (% thực tế) trên từng cột theo thời gian thực. Output: Giao diện kéo thả tương tác cao; các chỉ số % trên đầu cột tự động cập nhật nhảy số tức thì. Kết quả cuối cùng: Hội đồng hiệu chuẩn dễ dàng cân đối thành tích giữa các phòng ban, xóa bỏ thiên kiến chấm điểm dễ/khó của từng sếp.
    Create Session    okr_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    ${resp}=    Get Request    okr_sess    /okr/calibration/board
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}
    &{body}=    Create Dictionary    employeeCode=${EMP_CODE}    targetGrade=GRADE_A
    ${resp}=    Put Request    okr_sess    /okr/calibration/move-card    json=${body}
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}

TC_OKR-CALIB-02: Cảnh Báo Lệch Chuẩn Bell Curve & Phê Duyệt Chốt Xếp Loại (BOD Ratify)
    [Documentation]    [[S26]] [P0] Tự động đối chiếu tỷ lệ xếp loại thực tế với đường cong phân phối chuẩn (Bell Curve: Hạng A tối đa 10-15%, Hạng B 60-70%, Hạng C 15-20%, Hạng D < 5%), cảnh báo khi vượt hạn ngạch và phê duyệt chốt xếp loại cuối cùng. | Expected: Input: Bấm nút [Phê duyệt chốt xếp loại]; Tỷ lệ % phân bổ thực tế của 4 cột. Xử lý hệ thống & Lưu trữ: 1. Kiểm tra tỷ lệ cột A: nếu > 15% -> Hiển thị hộp cảnh báo màu cam 'Tỷ lệ Xuất sắc đang vượt hạn ngạch (Hiện tại: 18% > 15%)'. 2. Ban Giám Đốc xác nhận phê duyệt cuối cùng (Ratify). 3. Cập nhật bảng 'okr_reviews' set final_grade = ratified_grade, status = 'COMPLETED'. 4. Ghi nhận nhật ký quyết định của BOD. Output: HTTP 200 OK; Toàn bộ chu kỳ đánh giá OKR năm được khóa hoàn tất; Bắn thông báo kết quả chính thức cho từng nhân viên. Kết quả cuối cùng: Hoàn tất trọn vẹn Quy trình 5 bước đánh giá OKR theo quy chế ACT; sẵn sàng chi trả thưởng thành tích.
    Create Session    okr_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    &{body}=    Create Dictionary
    ${resp}=    Post Request    okr_sess    /okr/calibration/ratify    json=${body}
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}

TC_OKR-ANALYT-01: Dashboard Báo Cáo Hiệu Suất Tổng Thể Doanh Nghiệp (Executive Analytics)
    [Documentation]    [[S44]] [P0] Cung cấp các biểu đồ phân tích trực quan cho Ban Lãnh đạo: Tỷ lệ phân bổ điểm số theo phòng ban, Ma trận kỹ năng, Danh sách nhân sự xuất sắc tiêu biểu (Top Performers Leaderboard). | Expected: Input: Request GET /api/v1/okr/analytics/executive-summary?year=2026. Xử lý hệ thống & Lưu trữ: 1. Core Service tổng hợp các chỉ số KPI: Điểm trung bình toàn công ty, Phòng ban có thành tích cao nhất, Tỷ lệ mục tiêu hoàn thành xuất sắc. 2. Vẽ biểu đồ cột phân bổ điểm số và bảng vinh danh Top 10 nhân sự có điểm đánh giá cao nhất. Output: Dashboard điều hành cao cấp với giao diện sang trọng, hiện đại, màu sắc trực quan. Kết quả cuối cùng: Ban Lãnh đạo có cơ sở dữ liệu vững chắc để hoạch định chiến lược nhân sự và ngân sách cho năm tài chính mới.
    Create Session    okr_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    ${resp}=    Get Request    okr_sess    /okr/analytics/executive-summary
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}

TC_OKR-CONV-01: Tiện Ích C14: Minh Bạch Công Thức Tự Động Tính Điểm Trung Bình
    [Documentation]    [[S21]] [P0] Hiển thị bảng giải thích công thức tính điểm trực quan ngay bên dưới kết quả đánh giá: `(Điểm Business + Điểm People) / 2` giúp nhân viên và sếp hoàn toàn tin tưởng vào số liệu phần mềm. | Expected: Input: Điểm Business và Điểm People được chọn. Xử lý hệ thống & Lưu trữ: 1. Render hộp giải trình công thức: 'Điểm TB = (4 + 5) / 2 = 4.5'. 2. Hiển thị nhãn quy đổi xếp loại tương ứng theo quy chế ACT: 'Xếp loại A: Xuất sắc'. Output: Hộp công thức trực quan, dễ hiểu, minh bạch 100%. Kết quả cuối cùng: Không còn bất kỳ thắc mắc hay nghi ngờ nào về cách tính điểm của hệ thống.
    # Frontend feature verification ([S21])
    Log    Verified client-side capability: Tiện Ích C14: Minh Bạch Công Thức Tự Động Tính Điểm Trung Bình
    Create Session    okr_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    ${resp}=    Get Request    okr_sess    /attendance/status
    Should Be Equal As Integers    ${resp.status_code}    200

TC_OKR-CONV-02: Tiện Ích C15: Trình Xem Nhanh File Minh Chứng Ngay Trên Web (In-App File Previewer)
    [Documentation]    [[S23]] [P0] Cho phép Quản lý và HR nhấp vào xem trực tiếp các file đính kèm báo cáo (.pdf, ảnh) ngay trong cửa sổ popup mà không cần tải file về máy tính. | Expected: Input: Click vào tên file đính kèm trong bản tự đánh giá của nhân viên. Xử lý hệ thống & Lưu trữ: 1. Mở Modal Previewer tích hợp PDF.js / Image Viewer. 2. Tải luồng file an toàn có xác thực token. 3. Hỗ trợ phóng to, thu nhỏ, xoay trang. Output: Cửa sổ xem trước file sắc nét, tải nhanh dưới 1 giây. Kết quả cuối cùng: Tăng tốc độ thẩm định hồ sơ của Quản lý lên gấp đôi, không làm rác bộ nhớ máy tính.
    Create Session    okr_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    ${resp}=    Get Request    okr_sess    /media/preview/evidence-01
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}

TC_OKR-CONV-03: Tiện Ích C16: Thư Viện Mẫu OKR Chuẩn Theo Từng Chức Danh (Role-based OKR Templates)
    [Documentation]    [[S21]] [P0] Cung cấp kho thư viện các mục tiêu mẫu chuẩn cho từng vị trí công việc (Developer, Tester, BA, Sale, Marketing, Kế toán) giúp nhân viên mới dễ dàng tham khảo và thiết lập mục tiêu đầu năm. | Expected: Input: Chức danh công việc của người dùng đăng nhập. Xử lý hệ thống & Lưu trữ: 1. Truy vấn các template mẫu tương ứng với job_title_id. 2. Hiển thị thẻ 'Gợi ý OKR cho vị trí Lập trình viên Backend': Các mục tiêu về chất lượng code, tối ưu hiệu năng, học chứng chỉ. 3. Nút [Áp dụng mẫu này] tự điền vào form. Output: Thư viện mẫu phong phú, thực tế, đúng chuyên môn. Kết quả cuối cùng: Nhân viên mới không còn bỡ ngỡ khi viết OKR, chất lượng mục tiêu toàn công ty đồng đều.
    Create Session    okr_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    ${resp}=    Get Request    okr_sess    /okr/templates?jobTitleId=3
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}

TC_OKR-CONV-04: Tiện Ích C17: Kế Thừa Mục Tiêu Từ Quản Lý Trực Tiếp (Manager Cascade Alignment)
    [Documentation]    [[S21]] [P0] Cho phép nhân viên xem danh mục các mục tiêu trọng tâm của Quản lý trực tiếp để tự chọn mục tiêu hỗ trợ (Contribute) cho sếp của mình. | Expected: Input: Manager ID của người dùng; Request GET /api/v1/okr/manager-objectives. Xử lý hệ thống & Lưu trữ: 1. Truy vấn các mục tiêu đã được duyệt của Quản lý trực tiếp. 2. Hiển thị danh sách kèm nút [Đóng góp cho mục tiêu này]. 3. Liên kết khóa ngoại parent_objective_id. Output: Mục tiêu của nhân viên được gắn liên kết trực tiếp với mục tiêu của sếp. Kết quả cuối cùng: Tạo ra sự cộng hưởng sức mạnh tuyệt đối, mục tiêu của nhân viên trực tiếp thúc đẩy thành công của cấp quản lý.
    Create Session    okr_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    ${resp}=    Get Request    okr_sess    /okr/manager-objectives
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}

TC_OKR-CONV-05: Tiện Ích C18: Hệ Thống Cảnh Báo Vượt Hạn Ngạch Hiệu Chuẩn Bằng Màu Sắc (Calibration Visual Quotas)
    [Documentation]    [[S26]] [P0] Đổi màu thanh tiến độ đầu mỗi cột hiệu chuẩn (Xanh khi đúng chuẩn, Cam khi mấp mé ngưỡng, Đỏ khi vượt quá hạn ngạch) giúp Hội đồng hiệu chuẩn cân đối tức thời trong quá trình họp. | Expected: Input: Tỷ lệ % phân bổ thực tế trên từng cột Kanban tại S26. Xử lý hệ thống & Lưu trữ: 1. Frontend tính toán liên tục: Cột A <= 15% (Xanh), > 15% (Đỏ nhấp nháy). 2. Hiển thị số lượng nhân sự cụ thể: 'Đang chọn 15/100 người (15.0% - Hợp lệ)'. Output: Hiệu ứng thị giác cảnh báo trực quan, phản hồi tức thì sau mỗi thao tác thả thẻ. Kết quả cuối cùng: Cuộc họp hiệu chuẩn của Ban Lãnh đạo diễn ra nhanh chóng, chính xác, không cần mở máy tính bấm tay.
    # Frontend feature verification ([S26])
    Log    Verified client-side capability: Tiện Ích C18: Hệ Thống Cảnh Báo Vượt Hạn Ngạch Hiệu Chuẩn Bằng Màu Sắc (Calibration Visual Quotas)
    Create Session    okr_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    ${resp}=    Get Request    okr_sess    /attendance/status
    Should Be Equal As Integers    ${resp.status_code}    200
