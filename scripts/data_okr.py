# -*- coding: utf-8 -*-
"""
Data for Sheet 3: Quản Trị & Đánh Giá OKR (OKR & Performance Appraisal)
"""

okr_rows = [
    # 1. OKR Setup & Alignment (Thiết Lập Mục Tiêu & Căn Chỉnh)
    (
        "Quản Trị & Đánh Giá OKR", "[S20]", "OKR-DASH-01", "P0",
        "Dashboard Quản Trị OKR Cá Nhân & Chu Kỳ 4 Giai Đoạn",
        "Màn hình trung tâm của phân hệ OKR hiển thị thanh tiến trình trực quan 4 giai đoạn: 1. Thiết lập đầu năm -> 2. Check-in định kỳ -> 3. Đánh giá giữa năm -> 4. Tổng kết cuối năm.",
        "Input: Request GET /api/v1/okr/my-dashboard?year=2026; User ID đăng nhập.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Core Service xác định giai đoạn hiện tại của năm dựa trên cấu hình chu kỳ trong bảng 'okr_cycles'. 2. Tính toán tỷ lệ % hoàn thành trung bình của 2 nhóm mục tiêu Business & People. 3. Tra cứu lịch sử xếp loại và điểm đánh giá của các năm trước.\n"
        "Output: Dashboard sinh động hiển thị: Thanh tiến trình 4 Phase có chỉ báo 'Bạn đang ở Phase 2: Check-in Tháng 11'; 2 thẻ tiến độ Business & People; Nút bấm hành động nhanh tương ứng với từng giai đoạn.\n"
        "Kết quả cuối cùng: Nhân viên nắm bắt toàn cảnh tiến trình phát triển của bản thân trong cả chu kỳ năm.",
        "GET /api/v1/okr/my-dashboard?year=2026",
        "UI Steps:\n1. Mở menu OKR Cá nhân (/okr/my-okr).\n2. Verify: Thanh tiến trình 4 giai đoạn hiển thị rõ ràng, giai đoạn hiện tại được tô màu xanh đậm nổi bật.\nAPI Steps:\n1. Gọi GET my-dashboard -> HTTP 200 OK với đầy đủ cycleInfo và progressSummary.",
        "Ready for Test & Verify", "Frontend Dev", "Thiết kế truyền cảm hứng làm việc, theo sát tôn chỉ ACT Hackathon 2026."
    ),
    (
        "Quản Trị & Đánh Giá OKR", "[S21]", "OKR-SETUP-01", "P0",
        "Gợi Ý Mục Tiêu Chiến Lược Công Ty (20%) & Sao Chép 1-Chạm (C12)",
        "Hiển thị danh mục các mục tiêu chiến lược của Tổng công ty ACT trong năm 2026 kèm nút bấm 1 chạm sao chép trực tiếp vào bộ mục tiêu cá nhân của nhân viên.",
        "Input: Request GET /api/v1/okr/company-objectives?year=2026; Click nút [Sao chép vào mục tiêu của tôi].\n"
        "Xử lý hệ thống & Lưu trữ: 1. Truy vấn các mục tiêu chiến lược công ty (loại STRATEGIC_COMPANY, chiếm 20% tỷ trọng). 2. Khi nhân viên click sao chép, tự động khởi tạo mục tiêu mới trong nhóm Business Objectives của nhân viên, gắn cờ is_company_aligned = true và kế thừa các chỉ số đo lường chuẩn.\n"
        "Output: Mục tiêu công ty tự động điền vào form thiết lập OKR cá nhân mà không cần nhân viên phải gõ lại từng từ.\n"
        "Kết quả cuối cùng: Đảm bảo 100% cán bộ nhân viên đều hướng mục tiêu của mình bám sát chiến lược chung của toàn công ty.",
        "GET /api/v1/okr/company-objectives\nPOST /api/v1/okr/clone-company-objective",
        "UI Steps:\n1. Mở màn hình S21 Thiết lập OKR (/okr/setup).\n2. Nhìn hộp gợi ý 'Mục tiêu Công ty (20%)' bên phải -> Bấm nút [Sao chép vào OKR của tôi].\n3. Verify: Mục tiêu xuất hiện ngay trong nhóm Business kèm nhãn 'Kế thừa mục tiêu ACT'.\nAPI Steps:\n1. Gọi API clone -> Trả về objective object mới đã được gắn cờ liên kết.",
        "Ready for Test & Verify", "Fullstack Dev", "Đặc tả tính năng C12 giúp tiết kiệm thời gian thiết lập đầu năm."
    ),
    (
        "Quản Trị & Đánh Giá OKR", "[S21]", "OKR-SETUP-02", "P0",
        "Thiết Lập Mục Tiêu Cá Nhân (80%) Không Giới Hạn Ký Tự",
        "Cho phép nhân viên tự do diễn giải và mô tả các mục tiêu đột phá chuyên môn của bản thân (chiếm 80% tỷ trọng còn lại) với khung soạn thảo rộng rãi không bị gò bó độ dài.",
        "Input: Form body: title (Tên mục tiêu), category ('BUSINESS' hoặc 'PEOPLE'), description (Mô tả chi tiết), weightPercentage (Trọng số %).\n"
        "Xử lý hệ thống & Lưu trữ: 1. Cho phép nhập văn bản đa dòng không giới hạn ký tự (kiểu dữ liệu TEXT/CLOB). 2. Validate trọng số % > 0. 3. Lưu vào bảng 'okr_objectives' (user_id, cycle_year, category, title, description, weight, status='DRAFT').\n"
        "Output: Mục tiêu cá nhân được thêm vào danh sách, hiển thị thẻ trực quan kèm thanh phân bổ trọng số.\n"
        "Kết quả cuối cùng: Nhân viên thoải mái thể hiện khát vọng nghề nghiệp và cam kết hành động cụ thể.",
        "POST /api/v1/okr/objectives",
        "UI Steps:\n1. Bấm [+ Thêm mục tiêu cá nhân].\n2. Chọn nhóm: 'Phát triển con người' (People), Nhập tiêu đề và đoạn văn mô tả chi tiết -> Bấm [Thêm].\n3. Verify: Mục tiêu hiển thị đầy đủ không bị cắt ngắn chữ.\nAPI Steps:\n1. Gửi POST với description dài 2000 từ -> HTTP 201 Created thành công.",
        "Ready for Test & Verify", "Frontend Dev", "Hỗ trợ định dạng văn bản giàu (Rich-text bullet points)."
    ),
    (
        "Quản Trị & Đánh Giá OKR", "[S21]", "OKR-SETUP-03", "P0",
        "Thiết Lập Key Results (KRs) Lượng Hóa Với 4 Loại Đơn Vị Đo",
        "Xác lập các kết quả then chốt (Key Results) có thể đo đếm định lượng được với 4 loại đơn vị đo lường linh hoạt: Con số, Doanh thu tiền tệ VND, Tỷ lệ %, hoặc Mốc hoàn thành (Milestone).",
        "Input: Form thêm KR: objectiveId, krTitle, metricType ('NUMERIC', 'CURRENCY', 'PERCENTAGE', 'MILESTONE'), startValue, targetValue, unitName (ví dụ: 'Khách hàng', 'Tỷ VNĐ', '% SLA', 'Giai đoạn').\n"
        "Xử lý hệ thống & Lưu trữ: 1. Validate targetValue > startValue (hoặc ngược lại nếu mục tiêu giảm chi phí). 2. Lưu vào bảng 'okr_key_results' (objective_id, title, metric_type, start_val, target_val, current_val, unit, weight). 3. Tự động tính toán công thức tiến độ KR: `progress = (current - start) / (target - start) * 100%`.\n"
        "Output: Thẻ Key Result hiển thị rõ: Mục tiêu ban đầu, Mục tiêu hướng tới, Đơn vị đo và thanh tiến độ khởi tạo 0%.\n"
        "Kết quả cuối cùng: Định lượng hóa 100% mục tiêu, loại bỏ các mục tiêu mơ hồ, cảm tính.",
        "POST /api/v1/okr/key-results",
        "UI Steps:\n1. Tại mục tiêu 'Tăng trưởng doanh số', bấm [+ Thêm KR].\n2. Chọn Đơn vị: 'Tiền tệ (VNĐ)', Giá trị ban đầu: 0, Mục tiêu: 10,000,000,000 VNĐ -> Bấm [Lưu].\n3. Verify: KR hiển thị rõ định dạng tiền tệ Việt Nam đồng.\nAPI Steps:\n1. Gọi POST key-results -> HTTP 201 Created.",
        "Ready for Test & Verify", "Backend Dev", "Hỗ trợ cả chỉ số nghịch đảo (ví dụ: giảm thời gian phản hồi từ 5s xuống 1s)."
    ),
    (
        "Quản Trị & Đánh Giá OKR", "[S21]", "OKR-SETUP-04", "P0",
        "Ràng Buộc Tổng Trọng Số Bắt Buộc 100% & Gửi Quản Lý Phê Duyệt",
        "Kiểm tra tính toàn vẹn của bộ mục tiêu OKR: bắt buộc tổng trọng số của tất cả các Objectives và KRs phải cộng lại tròn đúng 100% trước khi gửi cấp trên phê duyệt.",
        "Input: Click nút [Gửi bộ mục tiêu cho Quản lý duyệt]; Tổng hợp trọng số của toàn bộ danh mục OKR.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Core Service tính tổng trọng số: `totalWeight = SUM(weight)`. 2. Nếu totalWeight != 100% (ví dụ mới đạt 85% hoặc vượt quá 110%) -> Chặn submit và hiển thị cảnh báo đỏ 'Tổng trọng số phải bằng đúng 100% (Hiện tại: X%)'. 3. Khi tròn 100% -> Chuyển trạng thái sang 'PENDING_SETUP_APPROVAL'. 4. Đẩy thông báo và tạo nhiệm vụ trong Todo Inbox của Quản lý trực tiếp.\n"
        "Output: HTTP 200 OK; UI khóa form ở chế độ Read-Only và hiển thị huy hiệu 'Chờ Quản lý phê duyệt mục tiêu'.\n"
        "Kết quả cuối cùng: Đảm bảo tính toán khoa học, tránh việc phân bổ nguồn lực không cân bằng.",
        "POST /api/v1/okr/submit-setup",
        "UI Steps:\n1. Thiết lập 3 mục tiêu có tổng trọng số 90% -> Bấm gửi -> App báo lỗi đỏ: 'Tổng trọng số mới đạt 90%, còn thiếu 10%'.\n2. Điều chỉnh lại cho đủ 100% -> Bấm gửi -> Thành công, chuyển sang trạng thái chờ duyệt.\nAPI Steps:\n1. Gửi request submit với total != 100 -> HTTP 400 TOTAL_WEIGHT_MUST_BE_100.",
        "Ready for Test & Verify", "Fullstack Dev", "Thanh trượt phân bổ trọng số visual tự động cảnh báo theo thời gian thực."
    ),
    (
        "Quản Trị & Đánh Giá OKR", "[S42]", "OKR-APPR-01", "P0",
        "Quản Lý Phê Duyệt Mục Tiêu Đầu Năm (Approve / Return With Feedback)",
        "Màn hình dành riêng cho Quản lý trực tiếp rà soát tính khả thi và độ thách thức của mục tiêu do nhân viên đề xuất, phê duyệt hoặc trả lại kèm ý kiến định hướng chi tiết.",
        "Input: Quản lý chọn xem bộ OKR của nhân viên A; Bấm nút [Duyệt OKR] hoặc [Yêu cầu chỉnh sửa kèm nhận xét].\n"
        "Xử lý hệ thống & Lưu trữ: 1. Nếu [Duyệt]: Cập nhật status='APPROVED_SETUP', đóng giai đoạn Setup và mở quyền Check-in định kỳ cho nhân viên; Gửi email thông báo chúc mừng. 2. Nếu [Trả lại]: Bắt buộc nhập nhận xét phản hồi, cập nhật status='RETURNED', mở lại quyền chỉnh sửa cho nhân viên kèm thông báo cần sửa những gì.\n"
        "Output: HTTP 200 OK; Nhiệm vụ hoàn tất trong Todo Inbox của Quản lý; Nhân viên nhận được thông báo phản hồi ngay lập tức.\n"
        "Kết quả cuối cùng: Đảm bảo sự thống nhất tuyệt đối về mục tiêu cam kết giữa Quản lý và Nhân viên ngay từ đầu năm.",
        "PUT /api/v1/okr/reviews/{id}/approve-setup",
        "UI Steps:\n1. Quản lý vào menu Duyệt OKR nhóm (/okr/approvals) -> Mở xem mục tiêu của nhân viên.\n2. Đọc các mục tiêu -> Bấm [Yêu cầu chỉnh sửa] -> Nhập nhận xét: 'Cần nâng mục tiêu KR2 lên 15%' -> Bấm gửi.\n3. Nhân viên đăng nhập thấy mục tiêu mở lại kèm nhận xét đỏ của sếp.\nAPI Steps:\n1. Gọi API approve-setup với status APPROVED hoặc RETURNED -> HTTP 200 OK.",
        "Ready for Test & Verify", "Fullstack Dev", "Lưu vết toàn bộ các lần trao đổi phản hồi (Feedback History) giữa sếp và nhân viên."
    ),
    (
        "Quản Trị & Đánh Giá OKR", "[S27]", "OKR-TREE-01", "P0",
        "Cây Phả Hệ Mục Tiêu Toàn Doanh Nghiệp (OKR Alignment Tree)",
        "Sơ đồ cây trực quan kết nối dòng chảy mục tiêu từ cấp Tổng công ty -> Khối -> Phòng ban -> Cá nhân, giúp nhận diện ngay các nút thắt chậm tiến độ.",
        "Input: Request GET /api/v1/okr/alignment-tree?year=2026.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Truy vấn liên kết quan hệ cha-con (parent_objective_id) giữa các tầng OKR. 2. Xây dựng cấu trúc cây đồ thị phân cấp. 3. Tính toán tiến độ cuộn lên (Rollup Progress) từ cấp dưới lên cấp trên. 4. Đánh dấu màu đỏ cảnh báo các mục tiêu bị chậm tiến độ nghiêm trọng (Lagging OKRs, tiến độ < 50% so với kế hoạch kỳ).\n"
        "Output: Sơ đồ tương tác dạng đồ thị hình cây mượt mà, hỗ trợ zoom in, zoom out và click vào từng nút để xem chi tiết người phụ trách.\n"
        "Kết quả cuối cùng: Lãnh đạo nắm trọn bức tranh thực thi chiến lược toàn công ty trong tầm mắt.",
        "GET /api/v1/okr/alignment-tree",
        "UI Steps:\n1. Mở menu Team OKR Board (/okr/team-board).\n2. Chuyển sang chế độ xem dạng 'Cây liên kết' (Tree View).\n3. Thấy mục tiêu Tổng Giám Đốc chia nhánh sang 3 Giám đốc khối và tiếp tục tỏa nhánh xuống các nhân viên.\nAPI Steps:\n1. Gọi GET alignment-tree -> HTTP 200 OK với cấu trúc lồng nhau phân cấp.",
        "Ready for Test & Verify", "Frontend Dev", "Sử dụng thư viện vẽ đồ thị SVG/Canvas mượt mà."
    ),

    # 2. Tracking & Coaching (Check-in Định Kỳ & Đánh Giá Giữa Năm)
    (
        "Quản Trị & Đánh Giá OKR", "[S22]", "OKR-CHK-01", "P0",
        "Check-in Tiến Độ Định Kỳ & Tự Động Kế Thừa Kỳ Trước (C13)",
        "Màn hình cập nhật tiến độ định kỳ (Hàng tháng/Hàng quý) tự động điền sẵn số liệu tiến độ của kỳ trước giúp nhân viên tiết kiệm tối đa thời gian nhập liệu.",
        "Input: Form Check-in tháng 11: Mở form cập nhật cho từng Key Result.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Core Service tự động tải giá trị thực tế của kỳ check-in tháng 10 (ví dụ: KR1 đang là 60%). 2. Hiển thị sẵn thanh trượt Slider ở mốc 60%. 3. Nhân viên chỉ cần kéo nhẹ lên mốc mới (ví dụ: 75%). 4. Tự động tính toán độ biến thiên tiến độ: `delta = 75% - 60% = +15%`.\n"
        "Output: Form hiển thị trực quan mức tăng trưởng; Nhân viên không phải nhớ hay gõ lại từ đầu.\n"
        "Kết quả cuối cùng: Quy trình check-in nhẹ nhàng chỉ mất 2 phút mỗi tháng, duy trì thói quen theo dõi mục tiêu liên tục.",
        "GET /api/v1/okr/check-in/current\nPOST /api/v1/okr/check-in",
        "UI Steps:\n1. Vào menu Check-in định kỳ (/okr/my-okr tab Check-in).\n2. Thấy KR1 đã có sẵn số liệu kỳ trước (60%) kèm nhãn xanh '+15% so với tháng trước' khi kéo slider lên 75%.\nAPI Steps:\n1. Gọi GET check-in/current -> Trả về latest_progress_value kế thừa tự động.",
        "Ready for Test & Verify", "Frontend Dev", "Đặc tả tiện ích C13 loại bỏ hoàn toàn việc nhập liệu trùng lặp."
    ),
    (
        "Quản Trị & Đánh Giá OKR", "[S22]", "OKR-CHK-02", "P0",
        "Đính Kèm File Minh Chứng Kết Quả & Lưu Lịch Sử Check-in",
        "Cho phép nhân viên tải lên các tệp tài liệu, báo cáo kết quả, liên kết sản phẩm làm bằng chứng xác thực cho tiến độ đã khai báo.",
        "Input: File upload (.pdf, .xlsx, .docx, ảnh) hoặc đường dẫn URL sản phẩm; Ghi chú kết quả đạt được, khó khăn và giải pháp.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Lưu file vào Media Storage, sinh đường dẫn tải an toàn. 2. Lưu bản ghi vào bảng 'okr_checkin_history' (kr_id, checkin_date, old_val, new_val, confidence_level, note, attachment_urls, created_at). 3. Cập nhật giá trị current_val trong bảng 'okr_key_results'.\n"
        "Output: HTTP 201 Created; Dòng thời gian lịch sử check-in của KR xuất hiện thêm một mốc mới kèm icon xem file đính kèm.\n"
        "Kết quả cuối cùng: Tiến độ được bảo chứng bằng dữ liệu thật, Quản lý dễ dàng kiểm chứng khi review.",
        "POST /api/v1/okr/check-in/submit",
        "UI Steps:\n1. Cập nhật KR lên 100% -> Bấm nút [Đính kèm minh chứng] -> Chọn file 'Bao_cao_nghiem_thu_du_an.pdf'.\n2. Nhập ghi chú: 'Đã hoàn tất Golive sản phẩm thành công' -> Bấm [Lưu Check-in].\n3. Verify: Lịch sử bên dưới hiển thị bản ghi kèm link tải file.\nAPI Steps:\n1. Gửi multipart/form-data POST check-in -> HTTP 201 Created.",
        "Ready for Test & Verify", "Fullstack Dev", "Chỉ cho phép đính kèm file ở các bước Check-in và Đánh giá (theo quy định doc/OKR_doc.md)."
    ),
    (
        "Quản Trị & Đánh Giá OKR", "[S43]", "OKR-MID-01", "P0",
        "Biên Bản Đánh Giá & Coaching Giữa Năm (Mid-Year 1-on-1 Review)",
        "Giao diện ghi nhận biên bản cuộc họp 1-on-1 giữa Quản lý và Nhân viên vào giữa năm, đánh giá kết quả 6 tháng đầu năm và đưa ra các định hướng giải pháp cho nửa cuối năm.",
        "Input: Form body S43: employeeId, strengthsNotes (Ưu điểm), improvementNotes (Điểm cần cải thiện), coachingActionPlan (Kế hoạch hành động), agreedStatus.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Lưu vào bảng 'okr_midyear_reviews'. 2. Hỗ trợ tính năng điều chỉnh mục tiêu (Pivoting Objectives) nếu có thay đổi chiến lược lớn từ Ban Giám Đốc. 3. Cả Quản lý và Nhân viên cùng bấm nút [Xác nhận đồng thuận] để ký điện tử biên bản.\n"
        "Output: HTTP 200 OK; Biên bản giữa năm được lưu trữ an toàn, hiển thị huy hiệu 'Đã hoàn tất Review giữa năm'.\n"
        "Kết quả cuối cùng: Tăng cường tính kết nối và gắn kết đội ngũ, giúp nhân viên kịp thời điều chỉnh hướng đi trước khi quá muộn.",
        "POST /api/v1/okr/midyear-reviews",
        "UI Steps:\n1. Quản lý vào menu Review giữa năm (/okr/mid-year-review) -> Chọn nhân viên A.\n2. Nhập nhận xét ưu nhược điểm và kế hoạch đào tạo -> Bấm [Ký biên bản].\n3. Nhân viên đăng nhập thấy thông báo -> Đọc và bấm [Đồng thuận].\nAPI Steps:\n1. Gọi POST midyear-reviews -> HTTP 200 OK với trạng thái MUTUALLY_AGREED.",
        "Ready for Test & Verify", "Fullstack Dev", "Quy trình chuẩn hóa theo tài liệu hướng dẫn 2026 OKR Guidance PDF."
    ),

    # 3. Year-End Assessment & Form 4 Box (Đánh Giá Cuối Năm Chuẩn ACT)
    (
        "Quản Trị & Đánh Giá OKR", "[S23]", "OKR-REV-01", "P0",
        "Màn Hình Tự Đánh Giá Cuối Năm Chuẩn Form 4 Box ACT",
        "Màn hình tự đánh giá hiệu suất của nhân viên được thiết kế chuẩn xác 100% theo Form 4 Box trong tài liệu quy định chính thức của công ty (doc/OKR_doc.md).",
        "Input: Request GET /api/v1/okr/reviews/form-4box?year=2026; User ID hiện tại.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Core Service khởi tạo bản ghi đánh giá năm trong bảng 'okr_reviews' với 4 Box dữ liệu rành mạch. 2. Nạp dữ liệu thành tựu tự động từ tiến độ các KRs trong năm. 3. Cung cấp thang điểm chấm 1-5 nguyên ở cấp độ nhóm.\n"
        "Output: Giao diện Form 4 Box chuẩn: Box 1 (Thành tựu chính), Box 2 (Mục tiêu công việc Business), Box 3 (Mục tiêu con người People), Box 4 (Kế hoạch & Nguyện vọng năm tới).\n"
        "Kết quả cuối cùng: Nhân viên có cái nhìn toàn diện để tự soi rọi quá trình công tác trong cả năm.",
        "GET /api/v1/okr/reviews/my-review?year=2026",
        "UI Steps:\n1. Mở menu Đánh giá cuối năm (/okr/assessment).\n2. Verify: Giao diện Form 4 Box hiển thị rõ ràng 4 khu vực độc lập, đẹp mắt.\nAPI Steps:\n1. Gọi GET my-review -> HTTP 200 OK với cấu trúc Form 4 Box chuẩn.",
        "Ready for Test & Verify", "Frontend Lead", "Thiết kế chuẩn hóa bám sát 100% mẫu quy định tại doc/OKR_doc.md."
    ),
    (
        "Quản Trị & Đánh Giá OKR", "[S23]", "OKR-REV-02", "P0",
        "Box 1 - Tổng Kết Thành Tựu Nổi Bật & Các KPI Đã Đạt Được",
        "Khu vực đầu tiên của Form 4 Box cho phép nhân viên tóm tắt các kết quả nổi bật nhất, các dự án tiêu biểu đã hoàn thành và đóng góp cá nhân xuất sắc trong năm.",
        "Input: Nội dung văn bản tổng kết thành tựu tại Box 1 (hỗ trợ nhập văn bản dài, gạch đầu dòng).\n"
        "Xử lý hệ thống & Lưu trữ: 1. Tự động hiển thị thẻ tóm tắt các KRs đã đạt 100% bên cạnh làm gợi ý. 2. Lưu văn bản vào cột 'box1_achievements' trong bảng 'okr_reviews'.\n"
        "Output: Văn bản được lưu tự động dạng Draft khi nhân viên gõ (Auto-save).\n"
        "Kết quả cuối cùng: Bức tranh tổng thể về đóng góp của nhân viên được làm nổi bật ngay đầu bản đánh giá.",
        "PUT /api/v1/okr/reviews/{id}/box1",
        "UI Steps:\n1. Tại Box 1, nhập: 'Hoàn thành Golive dự án ACT-HKT 2026 đúng tiến độ, tối ưu hiệu năng đạt 99%'.\n2. Bấm [Lưu nháp] -> Hiển thị thông báo 'Đã lưu lúc 15:30'.\nAPI Steps:\n1. Gửi PUT box1 -> HTTP 200 OK.",
        "Ready for Test & Verify", "Frontend Dev", "Tính năng tự động lưu nháp sau mỗi 30 giây tránh mất dữ liệu."
    ),
    (
        "Quản Trị & Đánh Giá OKR", "[S23]", "OKR-REV-03", "P0",
        "Box 2 & Box 3 - Chấm Điểm Thang 1-5 Nguyên Ở Cấp Nhóm (Không Điểm Lẻ)",
        "Quy định nghiệp vụ cốt lõi: Mỗi nhóm mục tiêu (Business và People) được chấm duy nhất 1 điểm số nguyên từ 1 đến 5 (1: Kém, 2: Cần cải thiện, 3: Đạt yêu cầu, 4: Tốt, 5: Xuất sắc), tuyệt đối không có điểm lẻ.",
        "Input: Điểm tự chọn của nhân viên tại Box 2 (Business Score) và Box 3 (People Score) bằng Radio button chọn số 1, 2, 3, 4, hoặc 5.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Validate điểm số là số nguyên `score in (1, 2, 3, 4, 5)`. Chặn tuyệt đối điểm số thập phân như 3.5 hay 4.2. 2. Bắt buộc nhập giải trình chi tiết cho mức điểm đã chọn. 3. Lưu vào các cột 'self_score_business' và 'self_score_people' trong bảng 'okr_reviews'.\n"
        "Output: Thẻ lựa chọn số nguyên to rõ, có giải nghĩa tiêu chí tương ứng với từng mức điểm.\n"
        "Kết quả cuối cùng: Tuân thủ chính xác quy tắc đánh giá của ACT (doc/OKR_doc.md Box 2-3); loại bỏ tranh cãi về các con số lẻ.",
        "PUT /api/v1/okr/reviews/{id}/box2-3",
        "UI Steps:\n1. Tại Box 2, click chọn mức '4 - Tốt' (Radio tròn).\n2. Tại Box 3, click chọn mức '5 - Xuất sắc'.\n3. Thử sửa request thành 4.5 -> Hệ thống báo lỗi 'Điểm số phải là số nguyên từ 1 đến 5'.\nAPI Steps:\n1. Gửi request có điểm lẻ 4.5 -> HTTP 400 SCORE_MUST_BE_INTEGER_1_TO_5.",
        "Ready for Test & Verify", "Backend Lead", "Quy định chốt từ doc/OKR_doc.md: Thang 1-5 nguyên, mỗi nhóm 1 điểm duy nhất."
    ),
    (
        "Quản Trị & Đánh Giá OKR", "[S23]", "OKR-REV-04", "P0",
        "Box 4 - Kế Hoạch & Nguyện Vọng Phát Triển Bản Thân Năm Tới (Self-Proposal)",
        "Khu vực Box 4 trong form chuẩn dành cho nhân viên đề xuất nguyện vọng nghề nghiệp, kế hoạch học tập nâng cao chuyên môn và đề xuất vị trí/chế độ trong năm tiếp theo.",
        "Input: Nội dung đề xuất bản thân năm tới: Định hướng phát triển kỹ năng, Khóa học mong muốn tham gia, Nguyện vọng thăng tiến.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Lưu vào cột 'box4_self_proposal' trong bảng 'okr_reviews'. 2. Dữ liệu này chỉ được chia sẻ cho Quản lý trực tiếp và Giám đốc Nhân sự để làm căn cứ quy hoạch cán bộ.\n"
        "Output: Văn bản lưu trữ an toàn, bảo mật thông tin nguyện vọng cá nhân.\n"
        "Kết quả cuối cùng: Lãnh đạo thấu hiểu tâm tư nguyện vọng của nhân viên, xây dựng lộ trình thăng tiến phù hợp.",
        "PUT /api/v1/okr/reviews/{id}/box4",
        "UI Steps:\n1. Tại Box 4, nhập nguyện vọng: 'Mong muốn được đào tạo chứng chỉ AWS Solutions Architect và thử sức vai trò Tech Lead'.\n2. Bấm [Lưu].\nAPI Steps:\n1. Gửi PUT box4 -> HTTP 200 OK.",
        "Ready for Test & Verify", "Frontend Dev", "Trường thông tin bắt buộc theo quy định mới của ACT."
    ),
    (
        "Quản Trị & Đánh Giá OKR", "[S23]", "OKR-REV-05", "P0",
        "Phần Mềm Tự Động Tính Điểm Trung Bình & Nộp Bản Tự Đánh Giá",
        "Hệ thống tự động tính toán điểm trung bình đề xuất của nhân viên theo công thức chuẩn: `(Điểm Business + Điểm People) / 2` và nộp lên Quản lý trực tiếp.",
        "Input: self_score_business và self_score_people; Bấm nút [Nộp bản tự đánh giá].\n"
        "Xử lý hệ thống & Lưu trữ: 1. Core Service tính: `self_average_score = (self_score_business + self_score_people) / 2.0`. 2. Validate tất cả 4 Box đã được điền đầy đủ. 3. Cập nhật status = 'PENDING_MANAGER_ASSESSMENT'. 4. Gửi email thông báo và tạo nhiệm vụ trong Todo Inbox của Quản lý.\n"
        "Output: HTTP 200 OK; Điểm trung bình hiển thị to rõ kèm huy hiệu xếp loại dự kiến (ví dụ: Điểm 4.5 -> Xếp loại A-Tốt); Form khóa quyền sửa.\n"
        "Kết quả cuối cùng: Hoàn tất Bước 1 trong Quy trình đánh giá 5 bước của ACT, chuyển giao cho Quản lý đánh giá.",
        "POST /api/v1/okr/reviews/submit-self-review",
        "UI Steps:\n1. Nhập Business=4, People=5 -> Ô 'Điểm Trung Bình' tự động hiển thị số '4.5' màu xanh.\n2. Bấm [Nộp bản đánh giá] -> Báo thành công, chuyển trạng thái 'Chờ Quản lý chấm'.\nAPI Steps:\n1. Gọi submit self-review -> HTTP 200 OK, verify self_average_score = 4.5.",
        "Ready for Test & Verify", "Fullstack Dev", "Phần mềm tự tính điểm trung bình theo quy định tại doc/OKR_doc.md."
    ),
    (
        "Quản Trị & Đánh Giá OKR", "[S24]", "OKR-MGR-01", "P0",
        "Quản Lý Chấm Điểm Độc Lập 1-5 Nguyên & Nhận Xét Nhân Viên",
        "Màn hình dành riêng cho Quản lý trực tiếp: xem toàn bộ minh chứng của nhân viên, chấm điểm độc lập 1-5 nguyên cho 2 nhóm Business & People và ghi nhận xét chính thức.",
        "Input: Quản lý chọn chấm điểm cho nhân viên A; Nhập manager_score_business (1-5), manager_score_people (1-5), manager_comments (Nhận xét toàn diện).\n"
        "Xử lý hệ thống & Lưu trữ: 1. Validate điểm Quản lý chấm là số nguyên từ 1 đến 5. 2. Tự động tính điểm trung bình chính thức của Quản lý: `manager_average_score = (business + people) / 2.0`. 3. Lưu vào bảng 'okr_reviews'. 4. Cập nhật status = 'MANAGER_ASSESSED'. 5. Nộp kết quả lên Hội đồng HR tổng hợp.\n"
        "Output: HTTP 200 OK; Điểm số và nhận xét của Quản lý được ghi nhận chính thức; Hoàn tất Bước 2 của quy trình.\n"
        "Kết quả cuối cùng: Đánh giá 2 chiều minh bạch, sẵn sàng cho công tác tổng hợp toàn công ty.",
        "POST /api/v1/okr/reviews/{id}/manager-assess",
        "UI Steps:\n1. Quản lý vào menu Đánh giá nhân viên (/okr/assessment) -> Chọn nhân viên A.\n2. Xem các minh chứng nhân viên đã gửi -> Chấm Business: 4, People: 4 -> Điểm TB tự tính là 4.0.\n3. Nhập nhận xét -> Bấm [Xác nhận nộp đánh giá].\nAPI Steps:\n1. Gửi POST manager-assess -> HTTP 200 OK.",
        "Ready for Test & Verify", "Fullstack Dev", "Quản lý có thể xem lại điểm tự chấm của nhân viên để đối chiếu."
    ),

    # 4. HR 9-Fields Report & Calibration Board (Báo Cáo HR 9 Trường & Hội Đồng Hiệu Chuẩn)
    (
        "Quản Trị & Đánh Giá OKR", "[S25]", "OKR-RPT-01", "P0",
        "Bảng Tổng Hợp Đánh Giá HR Chuẩn 9 Trường Quy Định (doc/OKR_doc.md Bước 5)",
        "Bảng tổng hợp kết quả đánh giá toàn công ty phục vụ phòng HR và Ban Giám Đốc chuẩn xác đúng 9 trường dữ liệu theo quy định chính thức của công ty kèm cột trạng thái theo dõi tiến độ.",
        "Input: Request GET /api/v1/okr/admin/hr-summary-report?year=2026; Bộ lọc phòng ban, trạng thái.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Core Service tổng hợp kết quả của toàn bộ nhân viên. 2. Trích xuất đúng 9 trường bắt buộc: 1. Họ và tên, 2. Mã nhân viên, 3. Chức danh công việc, 4. Thời gian công tác (Thâm niên), 5. Phòng ban/Đơn vị, 6. Họ tên Quản lý trực tiếp, 7. Điểm công việc (Business 1-5), 8. Điểm con người (People 1-5), 9. Điểm TB tổng hợp. 3. Bổ sung cột Trạng thái (Chưa tự đánh giá / Chờ QL chấm / Đã chấm xong).\n"
        "Output: Bảng tổng hợp HR chuẩn mực, hỗ trợ lọc, tìm kiếm và phân trang mượt mà.\n"
        "Kết quả cuối cùng: HR có công cụ quản trị tiến độ và kết quả đánh giá toàn diện, thay thế cho các bảng kanban rời rạc.",
        "GET /api/v1/okr/admin/hr-summary-report",
        "UI Steps:\n1. HR vào Bảng tổng hợp OKR (/okr/reports).\n2. Verify: Bảng hiển thị chuẩn đúng 9 trường theo tài liệu quy định.\n3. Xem cột Trạng thái -> Thấy ngay tỷ lệ hoàn thành đánh giá của từng phòng ban.\nAPI Steps:\n1. Gọi GET hr-summary-report -> HTTP 200 OK với đúng 9 trường dữ liệu chuẩn.",
        "Ready for Test & Verify", "Backend Lead", "Quy định chốt từ doc/OKR_doc.md Bước 5: Bảng tổng hợp HR 9 trường."
    ),
    (
        "Quản Trị & Đánh Giá OKR", "[S25]", "OKR-RPT-02", "P0",
        "Xuất Báo Cáo Tổng Hợp OKR Ra File Excel (.xlsx) Xét Thưởng",
        "Kết xuất toàn bộ dữ liệu bảng tổng hợp 9 trường của toàn công ty ra tệp Excel định dạng chuẩn phục vụ Hội đồng Thi đua - Khen thưởng và tính thưởng cuối năm.",
        "Input: Request GET /api/v1/okr/admin/export-excel?year=2026.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Truy vấn dữ liệu đánh giá đầy đủ. 2. Dùng Apache POI sinh file Excel: Có tiêu đề công ty, dòng tiêu đề in đậm, định dạng căn lề chuẩn và công thức tính điểm trung bình tự động. 3. Mã hóa file an toàn.\n"
        "Output: File 'ACT_Bao_Cao_Tong_Hop_Danh_Gia_OKR_2026.xlsx' tải về máy.\n"
        "Kết quả cuối cùng: Phòng HR có báo cáo tức thì nộp lên Tổng Giám Đốc và Hội đồng Quản trị.",
        "GET /api/v1/okr/admin/export-excel",
        "UI Steps:\n1. Tại S25, bấm nút [Xuất báo cáo Excel].\n2. Verify: Tải về file Excel mở ra có đầy đủ 9 cột chuẩn, số liệu khớp 100% với trên web.\nAPI Steps:\n1. Gọi GET export-excel -> HTTP 200 OK với binary Excel file.",
        "Ready for Test & Verify", "Backend Dev", "Hỗ trợ xuất báo cáo theo từng phòng ban riêng biệt."
    ),
    (
        "Quản Trị & Đánh Giá OKR", "[S26]", "OKR-CALIB-01", "P0",
        "Calibration Board - Hội Đồng Hiệu Chuẩn Phân Phối Chuẩn Dạng Kanban",
        "Màn hình hiệu chuẩn xếp loại hiệu suất toàn công ty dạng Kanban trực quan: 4 cột phân hạng (Xuất sắc A, Tốt B, Đạt C, Cần cải thiện D) với cơ chế kéo thả thẻ nhân viên mượt mà.",
        "Input: Request GET /api/v1/okr/calibration/board?year=2026; Thao tác Drag & Drop thẻ nhân viên giữa các cột xếp loại.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Core Service hiển thị các thẻ nhân viên được phân loại vào 4 cột dựa trên điểm trung bình ban đầu. 2. Hội đồng hiệu chuẩn kéo thả nhân viên qua lại giữa các cột để cân đối. 3. Tự động tính toán lại tỷ lệ phân bổ thực tế (% thực tế) trên từng cột theo thời gian thực.\n"
        "Output: Giao diện kéo thả tương tác cao; các chỉ số % trên đầu cột tự động cập nhật nhảy số tức thì.\n"
        "Kết quả cuối cùng: Hội đồng hiệu chuẩn dễ dàng cân đối thành tích giữa các phòng ban, xóa bỏ thiên kiến chấm điểm dễ/khó của từng sếp.",
        "GET /api/v1/okr/calibration/board\nPUT /api/v1/okr/calibration/move-card",
        "UI Steps:\n1. Mở menu Hiệu chuẩn xếp loại (/okr/calibration).\n2. Kéo thẻ của nhân viên B từ cột 'B - Tốt' thả sang cột 'A - Xuất sắc'.\n3. Verify: Thẻ di chuyển mượt mà, tỷ lệ cột A tăng từ 12% lên 13%.\nAPI Steps:\n1. Gửi PUT move-card kèm employeeId và targetGrade -> HTTP 200 OK.",
        "Ready for Test & Verify", "Frontend Lead", "Tích hợp thư viện Drag and Drop HTML5 / dnd-kit mượt mà."
    ),
    (
        "Quản Trị & Đánh Giá OKR", "[S26]", "OKR-CALIB-02", "P0",
        "Cảnh Báo Lệch Chuẩn Bell Curve & Phê Duyệt Chốt Xếp Loại (BOD Ratify)",
        "Tự động đối chiếu tỷ lệ xếp loại thực tế với đường cong phân phối chuẩn (Bell Curve: Hạng A tối đa 10-15%, Hạng B 60-70%, Hạng C 15-20%, Hạng D < 5%), cảnh báo khi vượt hạn ngạch và phê duyệt chốt xếp loại cuối cùng.",
        "Input: Bấm nút [Phê duyệt chốt xếp loại]; Tỷ lệ % phân bổ thực tế của 4 cột.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Kiểm tra tỷ lệ cột A: nếu > 15% -> Hiển thị hộp cảnh báo màu cam 'Tỷ lệ Xuất sắc đang vượt hạn ngạch (Hiện tại: 18% > 15%)'. 2. Ban Giám Đốc xác nhận phê duyệt cuối cùng (Ratify). 3. Cập nhật bảng 'okr_reviews' set final_grade = ratified_grade, status = 'COMPLETED'. 4. Ghi nhận nhật ký quyết định của BOD.\n"
        "Output: HTTP 200 OK; Toàn bộ chu kỳ đánh giá OKR năm được khóa hoàn tất; Bắn thông báo kết quả chính thức cho từng nhân viên.\n"
        "Kết quả cuối cùng: Hoàn tất trọn vẹn Quy trình 5 bước đánh giá OKR theo quy chế ACT; sẵn sàng chi trả thưởng thành tích.",
        "POST /api/v1/okr/calibration/ratify",
        "UI Steps:\n1. Cột A đang đạt 12% (hợp lệ) -> Nút [Phê duyệt chốt xếp loại] sáng màu xanh.\n2. Tổng Giám Đốc bấm nút -> Nhập mật khẩu xác nhận -> Hệ thống chốt xếp loại toàn công ty.\nAPI Steps:\n1. Gọi POST ratify -> Status chuyển COMPLETED, chu kỳ OKR được đóng băng an toàn.",
        "Ready for Test & Verify", "Backend Lead", "Hoàn thành 100% quy trình đánh giá hiệu suất nhân sự ACT 2026."
    ),
    (
        "Quản Trị & Đánh Giá OKR", "[S44]", "OKR-ANALYT-01", "P0",
        "Dashboard Báo Cáo Hiệu Suất Tổng Thể Doanh Nghiệp (Executive Analytics)",
        "Cung cấp các biểu đồ phân tích trực quan cho Ban Lãnh đạo: Tỷ lệ phân bổ điểm số theo phòng ban, Ma trận kỹ năng, Danh sách nhân sự xuất sắc tiêu biểu (Top Performers Leaderboard).",
        "Input: Request GET /api/v1/okr/analytics/executive-summary?year=2026.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Core Service tổng hợp các chỉ số KPI: Điểm trung bình toàn công ty, Phòng ban có thành tích cao nhất, Tỷ lệ mục tiêu hoàn thành xuất sắc. 2. Vẽ biểu đồ cột phân bổ điểm số và bảng vinh danh Top 10 nhân sự có điểm đánh giá cao nhất.\n"
        "Output: Dashboard điều hành cao cấp với giao diện sang trọng, hiện đại, màu sắc trực quan.\n"
        "Kết quả cuối cùng: Ban Lãnh đạo có cơ sở dữ liệu vững chắc để hoạch định chiến lược nhân sự và ngân sách cho năm tài chính mới.",
        "GET /api/v1/okr/analytics/executive-summary",
        "UI Steps:\n1. Đăng nhập quyền ADMIN, vào menu Báo cáo hiệu suất (/okr/analytics).\n2. Verify: Biểu đồ phân bổ điểm hiển thị rõ ràng, bảng Top Performers hiển thị ảnh đại diện và thành tựu của nhân viên xuất sắc.\nAPI Steps:\n1. Gọi GET executive-summary -> HTTP 200 OK với payload thống kê đầy đủ.",
        "Ready for Test & Verify", "Frontend Dev", "Sử dụng thư viện biểu đồ nhẹ nhàng, tải trang nhanh dưới 1 giây."
    )
]

print(f"Total OKR features: {len(okr_rows)}")
