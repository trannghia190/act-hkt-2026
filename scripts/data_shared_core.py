# -*- coding: utf-8 -*-
"""
Data for Sheet 1: Nền Tảng Dùng Chung (Shared Core & System Admin)
"""

shared_core_rows = [
    # 1. Auth & Account Security
    (
        "Nền Tảng Dùng Chung", "[S01]", "CORE-AUTH-01", "P0",
        "Đăng Nhập Tài Khoản Nội Bộ (Internal Non-SSO)",
        "Xác thực nhân viên bằng Mã NV/Email và mật khẩu nội bộ, không phụ thuộc Single Sign-On của bên thứ ba, đảm bảo tính sẵn sàng cao ngay cả khi mạng ngoài gặp sự cố.",
        "Input: Request JSON gồm username (Mã NV hoặc Email) và password dạng raw text; Client IP và User-Agent header.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Core Service tra cứu user trong bảng 'users'. 2. Dùng PasswordEncoder (Bcrypt) so sánh mật khẩu. 3. Ghi log truy cập vào bảng 'user_login_logs' (user_id, ip_address, user_agent, login_time, status=SUCCESS). 4. Kiểm tra cờ must_change_password và face_enrolled.\n"
        "Output: HTTP 200 OK kèm payload: access_token (JWT, TTL 15m), refresh_token (TTL 7d), user_info (id, code, name, email, role, department, must_change_password, face_enrolled).\n"
        "Kết quả cuối cùng: Người dùng được cấp phiên làm việc hợp lệ; client lưu token vào Secure Storage và điều hướng sang màn hình tương ứng.",
        "POST /api/v1/auth/login",
        "UI Steps:\n1. Mở màn hình S01 (/login).\n2. Nhập Email: sang@act.vn, Pass: Act@2026.\n3. Click [Đăng nhập] -> Điều hướng thành công vào hệ thống.\nAPI Steps:\n1. Gửi POST /api/v1/auth/login với body JSON hợp lệ -> HTTP 200 OK, trả về accessToken.",
        "Ready for Test & Verify", "Backend Lead", "Bảo mật Bcrypt 10 rounds. Hỗ trợ nhớ tài khoản qua secure cookie."
    ),
    (
        "Nền Tảng Dùng Chung", "[S01]", "CORE-AUTH-02", "P0",
        "Khóa Brute-Force Tạm Thời 15 Phút Qua Redis",
        "Tự động phát hiện và chặn các cuộc tấn công dò mật khẩu tự động bằng cách giới hạn số lần nhập sai liên tiếp tối đa 5 lần trong 10 phút.",
        "Input: Request POST /api/v1/auth/login có password không chính xác; IP hoặc username bị tấn công.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Core Service tăng bộ đếm trong Redis: 'login_fail:{username}' (TTL 600s). 2. Nếu bộ đếm >= 5, ghi nhận trạng thái khóa vào Redis key 'account_locked:{username}' với TTL = 900 giây (15 phút). 3. Ghi nhật ký cảnh báo an ninh vào bảng 'security_audit_logs'.\n"
        "Output: HTTP 429 Too Many Requests kèm JSON error code 'ACCOUNT_TEMPORARILY_LOCKED', message thông báo còn lại bao nhiêu giây.\n"
        "Kết quả cuối cùng: Tài khoản bị khóa tạm thời 15 phút, từ chối mọi yêu cầu đăng nhập tiếp theo kể cả khi nhập đúng pass cho đến khi hết hạn khóa.",
        "POST /api/v1/auth/login",
        "UI Steps:\n1. Nhập sai pass 5 lần liên tiếp.\n2. Verify: Hiển thị thông báo đỏ 'Tài khoản bị tạm khóa 15 phút do nhập sai quá 5 lần'. Nút đăng nhập bị disabled.\nAPI Steps:\n1. Gửi request sai 5 lần -> Lần thứ 5 trả về HTTP 429 với message khóa 15 phút.",
        "Ready for Test & Verify", "Backend Dev", "Redis key TTL 900s tự động hết hạn, không cần cronjob giải phóng."
    ),
    (
        "Nền Tảng Dùng Chung", "[S01]", "CORE-AUTH-03", "P0",
        "Làm Mới Token Phiên Làm Việc (Refresh JWT Token)",
        "Cho phép ứng dụng client tự động gia hạn Access Token ngầm khi token cũ hết hạn (15 phút) mà không làm gián đoạn trải nghiệm của người dùng.",
        "Input: Request POST /api/v1/auth/refresh kèm refreshToken hợp lệ trong HTTP-only Cookie hoặc Request Body.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Core Service xác thực chữ ký của refreshToken bằng secret key. 2. Kiểm tra token có nằm trong blacklist Redis không. 3. Tra cứu người dùng và sinh cặp Access Token mới (TTL 15m) + Rolling Refresh Token mới.\n"
        "Output: HTTP 200 OK với accessToken mới và thời gian hết hạn mới.\n"
        "Kết quả cuối cùng: Phiên làm việc được duy trì liên tục mà người dùng không bị văng ra màn hình đăng nhập.",
        "POST /api/v1/auth/refresh",
        "UI Steps:\n1. Để client chạy quá 15 phút, thực hiện 1 thao tác bất kỳ (như click Todo).\n2. Verify: Axios interceptor tự gọi refresh token ngầm và API thành công không bị gián đoạn.\nAPI Steps:\n1. Gửi POST /api/v1/auth/refresh với refreshToken -> HTTP 200 OK.",
        "Ready for Test & Verify", "Backend Dev", "Token Rotation áp dụng để vô hiệu hóa refresh token cũ ngay sau khi dùng."
    ),
    (
        "Nền Tảng Dùng Chung", "[S01]", "CORE-AUTH-04", "P0",
        "Đăng Xuất An Toàn & Đưa Token Vào Blacklist",
        "Xóa bỏ hoàn toàn phiên làm việc của người dùng trên cả Client và Server, ngăn chặn việc sử dụng lại token đã đăng xuất.",
        "Input: Request POST /api/v1/auth/logout kèm Bearer Access Token trong Authorization header.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Trích xuất jti (JWT ID) và thời gian sống còn lại của token. 2. Lưu jti vào Redis Blacklist với TTL bằng thời gian sống còn lại của token. 3. Ghi log sự kiện LOGOUT vào bảng 'user_login_logs'.\n"
        "Output: HTTP 200 OK với message 'Logged out successfully'.\n"
        "Kết quả cuối cùng: Token bị vô hiệu hóa hoàn toàn; trình duyệt xóa sạch token trong localStorage/Cookie và chuyển hướng về /login.",
        "POST /api/v1/auth/logout",
        "UI Steps:\n1. Click avatar người dùng trên Header -> Bấm [Đăng xuất].\n2. Verify: Trở về màn hình đăng nhập. Bấm nút Back trên trình duyệt không thể quay lại trang cũ.\nAPI Steps:\n1. Gửi POST /api/v1/auth/logout -> Dùng token cũ gọi lại API khác -> HTTP 401 Unauthorized.",
        "Ready for Test & Verify", "Backend Dev", "Redis Blacklist dọn dẹp theo TTL tự nhiên của token."
    ),
    (
        "Nền Tảng Dùng Chung", "[S01-A]", "CORE-PWD-01", "P0",
        "Nhận Diện Cờ must_change_password & Route Guard Cưỡng Chế",
        "Nhận diện các tài khoản mới tạo hoặc vừa được cấp lại mật khẩu để bắt buộc người dùng phải đổi mật khẩu riêng tư trước khi truy cập bất kỳ tính năng nào khác.",
        "Input: Đăng nhập thành công với tài khoản có trường must_change_password = true.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Token sinh ra chỉ có scope 'FORCE_CHANGE_PASSWORD_ONLY'. 2. Frontend Router Guard kiểm tra cờ và chuyển hướng tức thời tới màn hình /auth/force-change-password (S01-A). 3. Mọi request gọi tới API nghiệp vụ khác bằng token này đều bị Spring Security chặn.\n"
        "Output: Trình duyệt chuyển hướng cưỡng chế sang S01-A; API khác trả về HTTP 403 Forbidden nếu cố tình truy cập.\n"
        "Kết quả cuối cùng: Người dùng không thể xem dữ liệu hay thao tác trên hệ thống cho đến khi hoàn tất đổi mật khẩu.",
        "GET /api/v1/auth/me",
        "UI Steps:\n1. Đăng nhập bằng tài khoản mới cấp.\n2. Verify: Tự động nhảy vào S01-A; URL khác gõ tay đều bị ép quay lại S01-A.\nAPI Steps:\n1. Dùng token tạm gọi GET /api/v1/attendance/my-summary -> HTTP 403 Forbidden.",
        "Ready for Test & Verify", "Frontend Dev", "Frontend Guard kết hợp Backend Scope Guard bảo mật 2 lớp."
    ),
    (
        "Nền Tảng Dùng Chung", "[S01-A]", "CORE-PWD-02", "P0",
        "Kiểm Tra Chính Sách Mật Khẩu (Password Complexity Policy)",
        "Ràng buộc độ phức tạp mật khẩu theo tiêu chuẩn bảo mật doanh nghiệp nhằm loại bỏ mật khẩu yếu, dễ đoán.",
        "Input: Dữ liệu form gồm currentPassword, newPassword, confirmNewPassword.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Kiểm tra newPassword theo regex chuẩn: tối thiểu 8 ký tự, có ít nhất 1 chữ hoa, 1 chữ thường, 1 chữ số và 1 ký tự đặc biệt (!@#$%^&*). 2. Kiểm tra newPassword không trùng currentPassword. 3. Kiểm tra confirmNewPassword khớp 100% với newPassword.\n"
        "Output: Hiển thị thanh đo độ mạnh (Password Strength Meter: Yếu/Trung bình/Mạnh) và checklist visual từng điều kiện xanh/đỏ theo thời gian thực.\n"
        "Kết quả cuối cùng: Form chỉ cho phép bấm nút [Cập nhật mật khẩu] khi tất cả các tiêu chí bảo mật đều thỏa mãn.",
        "POST /api/v1/auth/change-password",
        "UI Steps:\n1. Nhập mật khẩu '123456' -> Báo đỏ: 'Mật khẩu phải từ 8 ký tự, có hoa, thường, số, ký tự đặc biệt'.\n2. Nhập 'Act@2026' -> Tất cả tick xanh bật sáng -> Nút bấm kích hoạt.\nAPI Steps:\n1. Gửi POST với pass yếu -> HTTP 400 Bad Request kèm message lỗi chi tiết.",
        "Ready for Test & Verify", "Frontend Dev", "Validation thời gian thực trên giao diện trước khi submit API."
    ),
    (
        "Nền Tảng Dùng Chung", "[S01-A]", "CORE-PWD-03", "P0",
        "Cập Nhật Mật Khẩu Mới & Giải Phóng Scope Giới Hạn",
        "Lưu mật khẩu mới vào cơ sở dữ liệu, hủy cờ bắt buộc đổi mật khẩu và cấp Token đầy đủ quyền hạn.",
        "Input: Request POST /api/v1/auth/change-password với currentPassword và newPassword hợp lệ.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Core Service verify currentPassword. 2. Mã hóa newPassword bằng Bcrypt. 3. Cập nhật bảng 'users' set password_hash = newHash, must_change_password = false, updated_at = NOW(). 4. Ghi audit log sự kiện đổi mật khẩu thành công.\n"
        "Output: HTTP 200 OK kèm cặp JWT Token mới có đầy đủ quyền hạn; UI hiển thị Toast xanh 'Đổi mật khẩu thành công!'.\n"
        "Kết quả cuối cùng: Cờ must_change_password được xóa; người dùng tự động chuyển hướng tiếp sang S01-B (Đăng ký mặt) hoặc S02.",
        "POST /api/v1/auth/change-password",
        "UI Steps:\n1. Nhập đúng mật khẩu cũ và mới -> Bấm [Cập nhật].\n2. Verify: Thông báo thành công và chuyển ngay sang S01-B Face Enrollment.\nAPI Steps:\n1. Gửi POST /api/v1/auth/change-password -> HTTP 200, kiểm tra DB cờ must_change_password=false.",
        "Ready for Test & Verify", "Backend Lead", "Bảo mật không lưu trữ mật khẩu dạng rõ ở bất kỳ tầng nào."
    ),
    (
        "Nền Tảng Dùng Chung", "[S01-B]", "CORE-FACE-01", "P0",
        "Khởi Động Wizard Đăng Ký Mẫu Khuôn Mặt (Face Enrollment)",
        "Hướng dẫn trực quan cho nhân viên mới đăng ký dữ liệu sinh trắc học khuôn mặt phục vụ chấm công chống gian lận.",
        "Input: Người dùng có face_enrolled = false truy cập hệ thống; Yêu cầu cấp quyền truy cập Camera thiết bị.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Frontend yêu cầu quyền Camera qua WebRTC getUserMedia. 2. Render khung tròn định vị khuôn mặt trên giao diện. 3. Hiển thị tiến trình 3 bước: Chính diện 0°, Nghiêng trái -30°, Nghiêng phải +30°.\n"
        "Output: Luồng video trực tiếp hiển thị mượt mà trên UI kèm lời nhắc chỉ dẫn giọng nói/chữ 'Vui lòng nhìn thẳng vào camera'.\n"
        "Kết quả cuối cùng: Camera sẵn sàng bắt hình khuôn mặt với đầy đủ khung căn chỉnh chuẩn.",
        "GET /api/v1/auth/me",
        "UI Steps:\n1. Sau khi đổi mật khẩu, app tự chuyển vào S01-B.\n2. Trình duyệt hỏi cấp quyền Camera -> Bấm [Cho phép].\n3. Verify: Camera hiển thị khung tròn có thước đo góc chụp.\nAPI Steps:\n1. Kiểm tra API GET /api/v1/auth/me trả về face_enrolled = false.",
        "Ready for Test & Verify", "AI/Mobile Dev", "Tương thích WebRTC trên cả trình duyệt Desktop và Safari/Chrome Mobile."
    ),
    (
        "Nền Tảng Dùng Chung", "[S01-B]", "CORE-FACE-02", "P0",
        "Kiểm Tra Chất Lượng Ảnh & Độ Sáng Sinh Trắc Học",
        "Đảm bảo ảnh chụp khuôn mặt đủ sắc nét và đủ độ sáng, loại bỏ các mẫu ảnh mờ, rung lắc hoặc ngược sáng làm sai lệch mô hình AI.",
        "Input: Khung hình chụp từ camera dạng Base64 / Blob gửi sang AI Face Service.\n"
        "Xử lý hệ thống & Lưu trữ: 1. AI Face Service tính toán Laplacian Variance để đo độ nét (ngưỡng nét >= 15.0). 2. Tính toán giá trị Mean Luminance đo độ sáng (ngưỡng sáng >= 20/255). 3. Kiểm tra kích thước khuôn mặt chiếm tối thiểu 20% khung hình.\n"
        "Output: Nếu ảnh mờ -> UI báo vàng 'Ảnh quá mờ, vui lòng giữ yên máy'; Nếu quá tối -> Báo 'Ánh sáng yếu, vui lòng di chuyển đến nơi sáng hơn'. Nếu đạt chuẩn -> UI tick xanh và tự động chụp góc tiếp theo.\n"
        "Kết quả cuối cùng: Chỉ những khung hình đạt tiêu chuẩn quang học cao mới được đưa vào phân tích trích xuất vector.",
        "POST /api/v1/face/check-quality",
        "UI Steps:\n1. Dùng tay che bớt camera tạo cảnh tối -> App báo 'Ánh sáng yếu'.\n2. Rung lắc camera liên tục -> App báo 'Ảnh bị rung mờ'.\n3. Giữ yên mặt trong điều kiện sáng -> App tick xanh hoàn tất.\nAPI Steps:\n1. Gửi ảnh mờ qua POST /api/v1/face/check-quality -> HTTP 400 kèm reason='IMAGE_BLURRY'.",
        "Ready for Test & Verify", "AI/Biometric Team", "Sử dụng thuật toán OpenCV Laplacian & Histogram analysis."
    ),
    (
        "Nền Tảng Dùng Chung", "[S01-B]", "CORE-FACE-03", "P0",
        "Trích Xuất 512D Vector Embedding & Lưu Trữ pgvector",
        "Trích xuất đặc trưng sinh trắc học duy nhất của khuôn mặt thành vector 512 chiều và lưu trữ an toàn trong CSDL PostgreSQL với extension pgvector.",
        "Input: Bộ 3 ảnh chất lượng cao tương ứng 3 góc (Chính diện, Trái, Phải); User ID của nhân viên.\n"
        "Xử lý hệ thống & Lưu trữ: 1. AI Service dùng mô hình MediaPipe/OpenCV sinh vector đặc trưng 512 chiều (embedding float array). 2. Lưu vào bảng 'user_face_embeddings' (user_id, embedding vector(512), angle, created_at). 3. Lưu ảnh chân dung gốc vào Media Storage. 4. Cập nhật bảng 'users' set face_enrolled = true.\n"
        "Output: HTTP 200 OK với thông điệp 'Face enrollment completed successfully'.\n"
        "Kết quả cuối cùng: Mẫu sinh trắc học được đăng ký thành công, nhân viên sẵn sàng sử dụng tính năng Chấm công 1 chạm.",
        "POST /api/v1/auth/face-enroll",
        "UI Steps:\n1. Hoàn tất thu thập 3 góc -> Nút [Hoàn tất đăng ký] sáng lên.\n2. Click nút -> Loading spinner 1-2s -> Báo thành công và chuyển vào S02 Todo Inbox.\nAPI Steps:\n1. Gửi POST /api/v1/auth/face-enroll kèm 3 ảnh base64 -> Kiểm tra DB bảng user_face_embeddings có bản ghi vector.",
        "Ready for Test & Verify", "AI/Biometric Team", "PostgreSQL pgvector lập chỉ mục HNSW/IVFFlat tăng tốc tìm kiếm."
    ),
    (
        "Nền Tảng Dùng Chung", "[S01-C]", "CORE-RESET-01", "P0",
        "Yêu Cầu Quên Mật Khẩu & Gửi Link Reset Qua Gmail SMTP",
        "Cung cấp quy trình tự phục hồi mật khẩu cho nhân viên qua hộp thư Gmail doanh nghiệp chính chủ với liên kết một lần an toàn.",
        "Input: Địa chỉ Email nhân viên tại form quên mật khẩu S01-C.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Kiểm tra Email tồn tại trong hệ thống. 2. Kiểm tra Rate-limit (chặn nếu gửi > 1 lần / 60 giây). 3. Sinh token ngẫu nhiên UUID mã hóa SHA-256 có hạn 15 phút, lưu vào bảng 'password_reset_tokens'. 4. Gọi MailerService gửi email qua smtp.gmail.com:587 có chứa link reset.\n"
        "Output: HTTP 200 OK với thông điệp 'Đã gửi hướng dẫn đặt lại mật khẩu về email của bạn'.\n"
        "Kết quả cuối cùng: Nhân viên nhận được email thật trong hộp thư đến chứa link dẫn tới trang đặt lại mật khẩu.",
        "POST /api/v1/auth/forgot-password",
        "UI Steps:\n1. Tại S01, bấm 'Quên mật khẩu?'.\n2. Nhập email: sang@act.vn -> Bấm [Gửi link xác nhận].\n3. Verify: Mở hộp thư Gmail thấy email từ 'ACT-HKT 2026' có link reset.\nAPI Steps:\n1. Gọi POST /api/v1/auth/forgot-password với email hợp lệ -> HTTP 200 OK.",
        "Ready for Test & Verify", "Backend Dev", "Tích hợp Spring Boot JavaMailSender kết nối máy chủ Gmail SMTP thật."
    ),
    (
        "Nền Tảng Dùng Chung", "[S01-C]", "CORE-RESET-02", "P0",
        "Xác Thực Token Reset & Thiết Lập Mật Khẩu Mới",
        "Xác thực tính hợp lệ của liên kết đặt lại mật khẩu và cho phép người dùng đặt mật khẩu mới, vô hiệu hóa link cũ ngay sau khi dùng.",
        "Input: Reset token từ URL và mật khẩu mới từ form người dùng.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Tra cứu token trong bảng 'password_reset_tokens'. 2. Kiểm tra token chưa bị sử dụng (used=false) và chưa hết hạn (created_at + 15m > NOW()). 3. Mã hóa mật khẩu mới bằng Bcrypt và cập nhật bảng 'users'. 4. Đánh dấu token used = true. 5. Hủy toàn bộ phiên đăng nhập cũ.\n"
        "Output: HTTP 200 OK với thông báo 'Mật khẩu đã được đặt lại thành công. Vui lòng đăng nhập lại'.\n"
        "Kết quả cuối cùng: Mật khẩu mới có hiệu lực ngay lập tức, token reset bị hủy hoàn toàn.",
        "POST /api/v1/auth/reset-password",
        "UI Steps:\n1. Click link trong email -> Mở màn hình đặt lại pass.\n2. Nhập pass mới -> Bấm [Xác nhận] -> Báo thành công và chuyển về màn hình đăng nhập S01.\nAPI Steps:\n1. Gửi POST /api/v1/auth/reset-password kèm token hợp lệ -> HTTP 200 OK.",
        "Ready for Test & Verify", "Backend Dev", "Bảo vệ chống Replay Attack (token chỉ dùng được đúng 1 lần)."
    ),

    # 2. Quản Trị Nhân Sự & Cơ Cấu Tổ Chức
    (
        "Nền Tảng Dùng Chung", "[S40]", "CORE-USER-01", "P0",
        "Danh Sách Nhân Viên & Tìm Kiếm Đa Tiêu Chí",
        "Màn hình quản trị nhân sự trung tâm cho phép HR tra cứu, lọc và phân trang danh sách toàn bộ cán bộ nhân viên trong công ty.",
        "Input: Query params: page, size, keyword (tên, mã NV, email), departmentId, status (ACTIVE/INACTIVE), role.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Core Service thực thi truy vấn JPA Specification có phân trang và sắp xếp. 2. Join các bảng 'users', 'departments', 'roles' để lấy thông tin tổng hợp. 3. Đếm tổng số bản ghi phục vụ phân trang.\n"
        "Output: HTTP 200 OK kèm payload: danh sách nhân viên (id, code, fullName, email, phone, departmentName, roleName, status, avatarUrl) và metadata phân trang (totalElements, totalPages, currentPage).\n"
        "Kết quả cuối cùng: Lưới danh sách nhân viên hiển thị đầy đủ, tìm kiếm tức thì theo từ khóa không bị giật lag.",
        "GET /api/v1/admin/users",
        "UI Steps:\n1. Đăng nhập quyền HR_ADMIN, vào menu Quản lý nhân viên (/admin/employees).\n2. Gõ từ khóa 'Sang' vào ô tìm kiếm -> Verify bảng lọc ra đúng nhân viên.\n3. Chọn bộ lọc phòng ban 'Khối Công nghệ' -> Verify bảng hiển thị đúng.\nAPI Steps:\n1. Gọi GET /api/v1/admin/users?keyword=Sang&page=0&size=10 -> HTTP 200 OK.",
        "Ready for Test & Verify", "Frontend Dev", "Tối ưu truy vấn SQL Index trên cột code, full_name, email và department_id."
    ),
    (
        "Nền Tảng Dùng Chung", "[S40]", "CORE-USER-02", "P0",
        "Thêm Mới Nhân Viên & Tự Động Gửi Email Kích Hoạt Gmail",
        "Khởi tạo hồ sơ nhân viên mới, tự sinh mật khẩu ngẫu nhiên đạt chuẩn bảo mật và gửi thông tin đăng nhập tự động về hòm thư Gmail của nhân viên.",
        "Input: Form body JSON: employeeCode, fullName, email, phone, departmentId, managerId, roleId, jobTitleId, hireDate, generateRandomPassword=true.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Validate không trùng mã NV hoặc email. 2. Tự sinh mật khẩu ngẫu nhiên (10 ký tự gồm hoa, thường, số, ký tự đặc biệt). 3. Lưu vào bảng 'users' với status=ACTIVE, must_change_password=true, face_enrolled=false. 4. Kích hoạt MailerService gửi email chứa tài khoản và mật khẩu tạm qua smtp.gmail.com.\n"
        "Output: HTTP 201 Created kèm thông tin nhân viên vừa tạo; UI hiển thị Toast 'Đã tạo nhân viên và gửi email kích hoạt thành công'.\n"
        "Kết quả cuối cùng: Tài khoản mới sẵn sàng hoạt động; nhân viên nhận được email kích hoạt chứa tài khoản và mật khẩu tạm.",
        "POST /api/v1/admin/users",
        "UI Steps:\n1. Tại S40, click nút [+ Thêm nhân viên].\n2. Nhập đầy đủ thông tin, tick chọn 'Hệ thống tự sinh mật khẩu' -> Bấm [Lưu].\n3. Verify: Nhân viên xuất hiện trên bảng và nhận được email thông báo thật.\nAPI Steps:\n1. Gửi POST /api/v1/admin/users -> HTTP 201 Created, check DB cờ must_change_password=true.",
        "Ready for Test & Verify", "Fullstack Dev", "Kết nối trực tiếp Gmail SMTP gửi email thật."
    ),
    (
        "Nền Tảng Dùng Chung", "[S40-B]", "CORE-IMPORT-01", "P0",
        "Tải File Mẫu Excel Import Nhân Sự Chuẩn ACT",
        "Cung cấp tệp mẫu Excel có định dạng chuẩn kèm các hướng dẫn chi tiết về kiểu dữ liệu giúp HR chuẩn bị danh sách import không bị lỗi.",
        "Input: Request GET /api/v1/admin/users/import-template.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Core Service sinh file Excel sử dụng Apache POI. 2. Đặt sẵn tiêu đề các cột chuẩn: Mã NV, Họ và Tên, Email, Số điện thoại, Mã phòng ban, Mã chức danh, Cấp bậc, Ngày vào làm. 3. Thêm các dòng dữ liệu mẫu và ghi chú điều kiện hợp lệ.\n"
        "Output: HTTP 200 OK với Content-Type application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, tải về file 'ACT_Employee_Import_Template.xlsx'.\n"
        "Kết quả cuối cùng: HR tải về file mẫu chuẩn sẵn sàng để điền thông tin nhân sự.",
        "GET /api/v1/admin/users/import-template",
        "UI Steps:\n1. Tại S40, click [Import Excel] -> Bấm nút [Tải file mẫu Excel].\n2. Verify: File Excel được tải về mở ra có đầy đủ các cột và hướng dẫn.\nAPI Steps:\n1. Gọi GET /api/v1/admin/users/import-template -> HTTP 200 OK với file nhị phân.",
        "Ready for Test & Verify", "Backend Dev", "File mẫu có validation danh sách phòng ban bằng Excel Dropdown list."
    ),
    (
        "Nền Tảng Dùng Chung", "[S40-B]", "CORE-IMPORT-02", "P0",
        "Upload & Preview Dữ Liệu Import Nhân Viên Hàng Loạt",
        "Phân tích cú pháp tệp Excel tải lên, kiểm tra tính hợp lệ của từng dòng dữ liệu và hiển thị bản xem trước trực quan cảnh báo các dòng lỗi trước khi thực thi lưu.",
        "Input: File Excel (.xlsx) upload qua multipart/form-data.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Đọc từng dòng dữ liệu bằng Apache POI. 2. Kiểm tra trùng lặp email/mã NV với DB và giữa các dòng trong file. 3. Kiểm tra mã phòng ban, mã chức danh có tồn tại không. 4. Đánh dấu danh sách dòng hợp lệ và danh sách dòng có lỗi kèm chi tiết nguyên nhân.\n"
        "Output: HTTP 200 OK kèm JSON: totalRows, validCount, errorCount, errorsList [{row, column, errorMessage}], previewData [].\n"
        "Kết quả cuối cùng: UI hiển thị bảng xem trước: các dòng hợp lệ có tick xanh, dòng lỗi bị tô đỏ kèm tooltip giải thích lỗi rõ ràng.",
        "POST /api/v1/admin/users/preview-import",
        "UI Steps:\n1. Chọn file Excel có 1 dòng email sai định dạng -> Bấm [Tải lên xem trước].\n2. Verify: Bảng preview tô đỏ dòng sai, ghi rõ 'Email không đúng định dạng'.\n3. Nút [Xác nhận lưu] chỉ kích hoạt khi khắc phục hết lỗi hoặc chọn bỏ qua dòng lỗi.\nAPI Steps:\n1. Gửi POST multipart với file test -> Trả về danh sách chi tiết lỗi từng ô.",
        "Ready for Test & Verify", "Fullstack Dev", "Phân tích cú pháp không ghi vào DB, an toàn tuyệt đối."
    ),
    (
        "Nền Tảng Dùng Chung", "[S40-B]", "CORE-IMPORT-03", "P0",
        "Thực Thi Batch Import Nhân Viên & Gửi Email Kích Hoạt Ngầm",
        "Lưu toàn bộ danh sách nhân sự hợp lệ vào cơ sở dữ liệu trong một Transaction duy nhất và kích hoạt gửi email thông báo hàng loạt qua Async Task.",
        "Input: Request POST /api/v1/admin/users/confirm-import kèm danh sách ID các dòng hợp lệ cần nhập.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Mở Spring Database Transaction (@Transactional). 2. Thực thi Batch Insert vào bảng 'users', sinh mật khẩu tạm thời cho từng người. 3. Khởi tạo số dư phép năm mặc định trong bảng 'leave_balances'. 4. Đẩy danh sách cần gửi email vào hàng đợi ngầm @Async để gửi lần lượt qua Gmail SMTP không làm nghẽn request.\n"
        "Output: HTTP 200 OK với JSON: successCount, failedCount, message 'Nhập thành công X nhân viên'.\n"
        "Kết quả cuối cùng: Toàn bộ nhân viên được tạo thành công trong hệ thống, hệ thống chạy nền gửi email tài khoản đến từng người.",
        "POST /api/v1/admin/users/confirm-import",
        "UI Steps:\n1. Tại màn hình preview, bấm [Tiến hành Import].\n2. Verify: Thanh tiến trình chạy từ 0% đến 100% -> Báo thành công -> Danh sách nhân viên được cập nhật ngay lập tức.\nAPI Steps:\n1. Gửi POST confirm-import -> Kiểm tra DB bảng users có đầy đủ bản ghi mới.",
        "Ready for Test & Verify", "Backend Dev", "Batch Insert tối ưu Hibernate batch_size=50 để đạt hiệu năng cao."
    ),
    (
        "Nền Tảng Dùng Chung", "[S40-C]", "CORE-USER-03", "P0",
        "Admin Reset Mật Khẩu & Mở Khóa Tài Khoản Cho Nhân Viên",
        "Cho phép HR/Admin hỗ trợ nhân viên cấp lại mật khẩu mới hoặc mở khóa tài khoản bị khóa do nhập sai mật khẩu nhiều lần.",
        "Input: Request POST /api/v1/admin/users/{id}/reset-password; Admin ID thực hiện.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Sinh mật khẩu ngẫu nhiên mới. 2. Cập nhật bảng 'users' set password_hash = newHash, must_change_password = true. 3. Xóa key Redis 'account_locked:{username}' và 'login_fail:{username}' để giải phóng khóa brute-force. 4. Bắn email thông báo mật khẩu mới cho nhân viên. 5. Ghi audit log hành động của Admin.\n"
        "Output: HTTP 200 OK với message 'Mật khẩu đã được cấp lại và gửi về email nhân viên'; UI Toast xanh.\n"
        "Kết quả cuối cùng: Nhân viên nhận được mật khẩu mới, trạng thái khóa được giải phóng ngay lập tức.",
        "POST /api/v1/admin/users/{id}/reset-password",
        "UI Steps:\n1. HR vào xem chi tiết nhân viên bị khóa -> Bấm nút [Cấp lại mật khẩu & Mở khóa].\n2. Xác nhận tại modal cảnh báo -> Báo thành công.\n3. Nhân viên đăng nhập lại bằng mật khẩu mới -> Thành công.\nAPI Steps:\n1. Gọi POST /api/v1/admin/users/5/reset-password -> HTTP 200 OK, Redis key bị xóa.",
        "Ready for Test & Verify", "Backend Dev", "Ghi vết kiểm toán Admin rõ ràng phục vụ an ninh thông tin."
    ),
    (
        "Nền Tảng Dùng Chung", "[S16]", "CORE-ORG-01", "P0",
        "Hiển Thị Sơ Đồ Cây Phòng Ban & Cấu Trúc Tổ Chức Phân Cấp",
        "Hiển thị cấu trúc cây tổ chức phân cấp trực quan từ Ban Giám Đốc xuống các Khối, Phòng ban, Bộ phận và Đội nhóm chuyên trách.",
        "Input: Request GET /api/v1/admin/departments/tree.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Core Service truy vấn bảng 'departments' sắp xếp theo parent_id và order_index. 2. Thuật toán đệ quy xây dựng cấu trúc lồng nhau dạng Tree JSON. 3. Join đếm số lượng nhân sự trực thuộc từng phòng ban.\n"
        "Output: HTTP 200 OK với danh sách cây: [{id, name, code, managerName, memberCount, children: [...] }].\n"
        "Kết quả cuối cùng: UI render sơ đồ cây tổ chức trực quan, hỗ trợ mở rộng/thu gọn từng nhánh phòng ban mượt mà.",
        "GET /api/v1/admin/departments/tree",
        "UI Steps:\n1. Mở menu Sơ đồ tổ chức (/admin/departments).\n2. Verify: Sơ đồ dạng cây hiển thị rõ Ban Giám Đốc -> Khối Công Nghệ -> Phòng Phát Triển Phần Mềm.\n3. Click thu gọn Khối -> Các phòng ban con ẩn đi.\nAPI Steps:\n1. Gọi GET /api/v1/admin/departments/tree -> HTTP 200 OK.",
        "Ready for Test & Verify", "Frontend Dev", "Hỗ trợ hiển thị số lượng nhân sự tức thời trên từng node cây."
    ),
    (
        "Nền Tảng Dùng Chung", "[S16]", "CORE-ORG-02", "P0",
        "Thêm Mới & Cập Nhật Thông Tin Phòng Ban / Trưởng Phòng",
        "Cho phép Admin thiết lập phòng ban mới, thay đổi tên, mã phòng ban, chỉ định hoặc thay thế Trưởng phòng trực tiếp quản lý.",
        "Input: Form body JSON: name, code, parentId, managerId (Trưởng phòng), description.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Validate không trùng mã code phòng ban. 2. Kiểm tra managerId hợp lệ. 3. Lưu vào bảng 'departments'. 4. Nếu thay đổi Trưởng phòng, tự động cập nhật quan hệ manager_id cho các nhân viên trực thuộc phòng ban đó. 5. Ghi nhật ký audit.\n"
        "Output: HTTP 200 OK / 201 Created kèm thông tin phòng ban; UI cập nhật sơ đồ ngay lập tức.\n"
        "Kết quả cuối cùng: Thông tin phòng ban và người quản lý trực tiếp được cập nhật nhất quán trên toàn hệ thống.",
        "POST /api/v1/admin/departments",
        "UI Steps:\n1. Tại S16, click [+ Thêm phòng ban].\n2. Nhập Tên: 'Phòng AI & Big Data', Mã: 'DEP-AI', Trưởng phòng: 'Nguyễn Văn A' -> Bấm [Lưu].\n3. Verify: Phòng ban mới xuất hiện ngay trên cây tổ chức.\nAPI Steps:\n1. Gọi POST /api/v1/admin/departments -> HTTP 201 Created.",
        "Ready for Test & Verify", "Fullstack Dev", "Đồng bộ tự động quản lý trực tiếp cho các luồng duyệt đơn."
    ),
    (
        "Nền Tảng Dùng Chung", "[S15]", "CORE-RBAC-01", "P0",
        "Ma Trận Phân Quyền Vai Trò RBAC (4 Vai Trò Chuẩn)",
        "Quản lý và thực thi ma trận phân quyền chi tiết cho 4 vai trò chuẩn của hệ thống: EMPLOYEE, MANAGER, HR_ADMIN, ADMIN.",
        "Input: Role ID và danh sách Permissions tương ứng cần gán.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Bảng 'roles' định nghĩa 4 vai trò. 2. Bảng 'role_permissions' lưu trữ các quyền hạn chi tiết (READ, WRITE, APPROVE, DELETE, EXPORT, AUDIT) theo từng tài nguyên (ATTENDANCE, LEAVE, OKR, USER, SYSTEM). 3. Spring Security kiểm tra quyền động tại từng API controller qua @PreAuthorize.\n"
        "Output: HTTP 200 OK với ma trận phân quyền; UI tự động ẩn/hiện các menu và nút chức năng dựa trên quyền của user.\n"
        "Kết quả cuối cùng: Đảm bảo nguyên tắc bảo mật tối thiểu (Principle of Least Privilege); nhân viên không thể thao tác các chức năng quản trị.",
        "GET /api/v1/admin/roles/matrix",
        "UI Steps:\n1. Đăng nhập quyền EMPLOYEE -> Verify không nhìn thấy menu Quản lý nhân viên, Bảng công 45 cột, Rule Engine.\n2. Chuyển sang role HR_ADMIN -> Toàn bộ menu quản trị xuất hiện đầy đủ.\nAPI Steps:\n1. Dùng token EMPLOYEE gọi DELETE /api/v1/admin/users/1 -> HTTP 403 Forbidden.",
        "Ready for Test & Verify", "Backend Lead", "Kiểm soát an ninh chặt chẽ tại cả tầng Frontend Route và Backend API."
    ),

    # 3. Todo Inbox Hub & Điều Phối Công Việc
    (
        "Nền Tảng Dùng Chung", "[S02]", "CORE-TODO-01", "P0",
        "Tab Việc Của Tôi (Personal Actions) Với 1-Click Action",
        "Tập trung toàn bộ các nhiệm vụ cá nhân cấp bách của nhân viên vào một nơi với nút bấm xử lý 1 chạm tiện lợi (C1).",
        "Input: User ID đăng nhập hiện tại.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Truy vấn các nhiệm vụ cá nhân chưa hoàn tất: Đổi pass lần đầu, Đăng ký mẫu mặt, Check-in tiến độ OKR, Bản tự đánh giá cuối năm. 2. Tính toán hạn chót và mức độ ưu tiên của từng việc. 3. Sắp xếp việc khẩn cấp lên đầu danh sách.\n"
        "Output: HTTP 200 OK kèm danh sách task: [{id, title, description, deadline, priority, actionType, actionUrl}].\n"
        "Kết quả cuối cùng: Nhân viên thấy rõ ngay các việc cần làm kèm nút bấm mở trực tiếp màn hình xử lý trong 1 click.",
        "GET /api/v1/todo/my-tasks",
        "UI Steps:\n1. Truy cập /todo (màn hình mặc định sau khi đăng nhập).\n2. Tại tab 'Việc của tôi', thấy thẻ 'Check-in OKR Tháng 11'.\n3. Bấm nút [Cập nhật tiến độ ngay] -> Chuyển thẳng đến form check-in S22.\nAPI Steps:\n1. Gọi GET /api/v1/todo/my-tasks -> HTTP 200 OK kèm mảng tasks.",
        "Ready for Test & Verify", "Frontend Dev", "Triệt tiêu thao tác tìm kiếm menu rườm rà cho nhân viên."
    ),
    (
        "Nền Tảng Dùng Chung", "[S02]", "CORE-TODO-02", "P0",
        "Tab Chờ Duyệt (Team Approvals) Cho Quản Lý",
        "Tập trung toàn bộ các yêu cầu từ cấp dưới gửi lên cho Quản lý phê duyệt (Đơn nghỉ phép, Đơn đi muộn, Đơn WFH, Đơn bổ sung công, Duyệt mục tiêu OKR).",
        "Input: Manager ID đăng nhập; Bộ lọc loại yêu cầu (Tất cả, Đơn từ, OKR).\n"
        "Xử lý hệ thống & Lưu trữ: 1. Truy vấn bảng 'requests' và 'okr_reviews' có manager_id = currentUserId và status = PENDING. 2. Join thông tin nhân viên (họ tên, mã NV, avatar, phòng ban). 3. Tính toán thời gian chờ duyệt và hạn SLA 48h.\n"
        "Output: HTTP 200 OK kèm danh sách: [{requestId, requesterName, type, details, submittedAt, slaRemainingHours}].\n"
        "Kết quả cuối cùng: Quản lý nắm bắt đầy đủ các yêu cầu cần xử lý của cả đội ngũ mà không bị sót việc.",
        "GET /api/v1/todo/approvals",
        "UI Steps:\n1. Quản lý mở /todo, chuyển sang tab 'Chờ duyệt'.\n2. Verify: Danh sách các đơn xin nghỉ của nhân viên hiển thị rõ ràng thông tin ngày nghỉ, lý do và file đính kèm.\nAPI Steps:\n1. Gọi GET /api/v1/todo/approvals -> HTTP 200 OK.",
        "Ready for Test & Verify", "Fullstack Dev", "Phân loại rõ ràng giữa công việc cá nhân và công việc quản trị nhóm."
    ),
    (
        "Nền Tảng Dùng Chung", "[S02]", "CORE-TODO-03", "P0",
        "Nút Phê Duyệt Nhanh (Quick Approve) & Từ Chối Kèm Lý Do",
        "Cho phép Quản lý duyệt nhanh trực tiếp từng đơn ngay trên thẻ công việc mà không cần click mở modal chi tiết rườm rà.",
        "Input: Request POST /api/v1/todo/approvals/{id}/action kèm action=APPROVE hoặc REJECT và comment.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Cập nhật trạng thái đơn tương ứng sang APPROVED hoặc REJECTED. 2. Nếu đơn nghỉ phép APPROVED, trừ số dư phép trong bảng 'leave_balances'. 3. Đổi trạng thái todo item sang COMPLETED. 4. Bắn email thông báo kết quả duyệt về cho nhân viên tạo đơn.\n"
        "Output: HTTP 200 OK; Thẻ công việc tự động biến mất với hiệu ứng trượt mượt mà; UI Toast 'Đã phê duyệt đơn thành công'.\n"
        "Kết quả cuối cùng: Tốc độ duyệt đơn tăng gấp 3 lần, loại bỏ các bước click chuột thừa.",
        "POST /api/v1/todo/approvals/{id}/action",
        "UI Steps:\n1. Tại tab 'Chờ duyệt', bấm trực tiếp nút xanh [Duyệt nhanh] trên thẻ đơn.\n2. Verify: Thẻ biến mất ngay lập tức, số đếm trên badge giảm 1.\n3. Bấm nút đỏ [Từ chối] -> Hiện popup nhỏ yêu cầu nhập lý do -> Nhập lý do -> Bấm xác nhận -> Đơn chuyển sang Rejected.\nAPI Steps:\n1. Gửi POST action=APPROVE -> HTTP 200 OK.",
        "Ready for Test & Verify", "Frontend Dev", "Hỗ trợ Optimistic UI update giúp giao diện phản hồi tức thì."
    ),
    (
        "Nền Tảng Dùng Chung", "[S02]", "CORE-TODO-04", "P0",
        "Duyệt Hàng Loạt Nhiều Đơn Cùng Lúc (Batch Approvals)",
        "Cho phép Quản lý chọn nhiều đơn cùng lúc và bấm phê duyệt toàn bộ trong 1 cú click chuột (C16).",
        "Input: Request POST /api/v1/todo/batch-approve kèm danh sách mảng requestIds [101, 102, 105].\n"
        "Xử lý hệ thống & Lưu trữ: 1. Core Service chạy batch transaction cập nhật toàn bộ các đơn hợp lệ. 2. Cập nhật số dư phép và giờ công tương ứng. 3. Đẩy thông báo hàng loạt đến từng nhân viên liên quan.\n"
        "Output: HTTP 200 OK với JSON: {approvedCount: 3, failedCount: 0}; UI hiển thị thông báo thành công.\n"
        "Kết quả cuối cùng: Xử lý hàng chục đơn tồn đọng chỉ trong vài giây, tiết kiệm thời gian tối đa cho Quản lý.",
        "POST /api/v1/todo/batch-approve",
        "UI Steps:\n1. Tick chọn 3 đơn nghỉ phép tại ô checkbox bên trái.\n2. Nút nổi [Duyệt 3 mục đã chọn] xuất hiện ở góc dưới -> Bấm nút.\n3. Verify: Cả 3 thẻ biến mất đồng thời.\nAPI Steps:\n1. Gửi POST /api/v1/todo/batch-approve với mảng IDs -> HTTP 200 OK.",
        "Ready for Test & Verify", "Fullstack Dev", "Database transaction đảm bảo tính toàn vẹn dữ liệu."
    ),
    (
        "Nền Tảng Dùng Chung", "[S02]", "CORE-TODO-05", "P0",
        "Huy Hiệu SLA 48h & Cơ Chế Tự Động Chuyển Cấp Duyệt (Auto-Escalation)",
        "Hiển thị cảnh báo trực quan thời hạn xử lý đơn và tự động leo thang chuyển cấp trên kế tiếp duyệt nếu Quản lý trực tiếp bỏ quên quá 48 giờ.",
        "Input: Thời điểm nộp đơn submitted_at và tham số SLA_APPROVAL_HOURS = 48 từ Rule Engine.\n"
        "Xử lý hệ thống & Lưu trữ: 1. UI tính toán thời gian còn lại: Xanh (< 24h), Vàng (24h - 48h), Đỏ (> 48h quá hạn). 2. Cronjob chạy mỗi giờ kiểm tra các đơn PENDING > 48h. 3. Nếu quá hạn, tự động cập nhật current_approver_id lên cấp trên kế tiếp (Manager của Manager). 4. Bắn email cảnh báo khẩn cấp cho cả 2 quản lý.\n"
        "Output: Đơn được tự động chuyển vào hòm thư Todo của cấp trên; trạng thái ghi nhận 'ESCALATED'.\n"
        "Kết quả cuối cùng: Đơn từ của nhân viên không bao giờ bị nghẽn vô thời hạn do quản lý bận công tác.",
        "POST /api/v1/cron/check-sla-escalation",
        "UI Steps:\n1. Đơn nộp sau 25h hiển thị huy hiệu vàng 'Còn 23h'.\n2. Đơn quá 48h hiển thị nhãn đỏ 'Quá hạn SLA - Tự động chuyển cấp trên'.\nAPI Steps:\n1. Trigger cronjob test qua API -> Verify đơn được chuyển assignee lên Giám đốc khối.",
        "Ready for Test & Verify", "Backend Lead", "Cấu hình SLA linh hoạt qua Rule Engine S18."
    ),

    # 4. Thông Báo & Phím Tắt Lệnh Nhanh
    (
        "Nền Tảng Dùng Chung", "[S03]", "CORE-CMD-01", "P0",
        "Command Palette Toàn Cục Phím Tắt Ctrl+K / Cmd+K",
        "Thanh tìm kiếm và điều hướng nhanh toàn cục cho phép người dùng mở tức thì từ mọi màn hình bằng tổ hợp phím tắt (C2).",
        "Input: Người dùng nhấn phím tắt Ctrl+K (Windows/Linux) hoặc Cmd+K (macOS); Từ khóa tìm kiếm gõ vào ô input.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Frontend hook 'useKeyPress' chặn sự kiện mặc định của trình duyệt và mở Modal Command Palette. 2. Thuật toán Fuzzy Search tìm kiếm trên danh mục 48 màn hình, chức năng và danh bạ nhân sự. 3. Nhấn Enter hoặc click chuột để điều hướng ngay lập tức.\n"
        "Output: Modal tìm kiếm mượt mà nổi bật ở giữa màn hình; kết quả tìm kiếm cập nhật tức thì theo từng ký tự gõ.\n"
        "Kết quả cuối cùng: Người dùng chuyển đổi qua lại giữa các tính năng trong 0.5 giây mà không cần rà chuột tìm menu.",
        "GET /api/v1/search/quick",
        "UI Steps:\n1. Bấm Ctrl+K -> Modal tìm kiếm bật lên.\n2. Gõ 'Bảng công' -> Kết quả đầu tiên là 'Bảng công 45 cột [S30]'.\n3. Bấm Enter -> Chuyển ngay đến /attendance/timesheet.\nAPI Steps:\n1. Test sự kiện phím tắt toàn cục hoạt động ở tất cả các trang.",
        "Ready for Test & Verify", "Frontend Dev", "Hỗ trợ phím mũi tên Lên/Xuống để duyệt danh sách kết quả."
    ),
    (
        "Nền Tảng Dùng Chung", "[S03]", "CORE-CMD-02", "P0",
        "Kích Hoạt Hành Động Nhanh Từ Command Palette (Quick Actions)",
        "Cho phép mở trực tiếp form tạo đơn hoặc thao tác nghiệp vụ ngay từ thanh tìm kiếm Ctrl+K.",
        "Input: Chọn một action trong danh mục Quick Actions ('Tạo đơn nghỉ phép', 'Tạo đơn WFH', 'Đổi mật khẩu').\n"
        "Xử lý hệ thống & Lưu trữ: 1. Nhận diện loại action được chọn. 2. Đóng Command Palette và kích hoạt mở đúng modal form tương ứng kèm trạng thái khởi tạo sẵn.\n"
        "Output: Modal form nghiệp vụ mở ra ngay lập tức với con trỏ chuột focus vào ô nhập liệu đầu tiên.\n"
        "Kết quả cuối cùng: Tạo đơn từ nhanh chóng chỉ với 2 thao tác phím gõ.",
        "GET /api/v1/search/actions",
        "UI Steps:\n1. Bấm Ctrl+K -> Gõ 'Tạo đơn nghỉ' -> Bấm Enter.\n2. Verify: Modal 'Tạo đơn xin nghỉ phép' mở ra ngay lập tức.\nAPI Steps:\n1. Kiểm tra danh mục actions trả về đầy đủ các hành động phổ biến.",
        "Ready for Test & Verify", "Frontend Dev", "Tối ưu trải nghiệm Power User."
    ),
    (
        "Nền Tảng Dùng Chung", "[S04]", "CORE-NOTIF-01", "P0",
        "Chuông Thông Báo & Dropdown Thời Gian Thực Trên Header",
        "Hiển thị các thông báo nghiệp vụ quan trọng với số đếm badge chưa đọc và kết nối WebSocket cập nhật thời gian thực.",
        "Input: Sự kiện nghiệp vụ phát sinh (Đơn được duyệt/từ chối, Có đơn mới cần duyệt, Nhắc nhở chấm công, Kết quả OKR).\n"
        "Xử lý hệ thống & Lưu trữ: 1. Lưu bản ghi vào bảng 'notifications' (user_id, title, content, type, link, is_read=false, created_at). 2. Bắn tin nhắn qua Spring WebSocket STOMP tới topic riêng của user '/topic/user.{userId}'. 3. Tăng số đếm unread_count.\n"
        "Output: Chuông thông báo trên Header rung nhẹ kèm badge đỏ hiển thị số lượng chưa đọc; Dropdown hiển thị 10 thông báo mới nhất.\n"
        "Kết quả cuối cùng: Người dùng nhận thông báo tức thì mà không cần tải lại trang.",
        "GET /api/v1/notifications\nPUT /api/v1/notifications/{id}/read",
        "UI Steps:\n1. Mở app, nhìn icon chuông trên Header -> Thấy badge đỏ số '3'.\n2. Click chuông -> Dropdown mở ra hiển thị 3 thông báo mới nhất.\n3. Click vào 1 thông báo -> Thông báo đổi sang trạng thái đã đọc, số badge giảm còn '2'.\nAPI Steps:\n1. Gọi GET /api/v1/notifications -> HTTP 200 OK kèm danh sách và unreadCount.",
        "Ready for Test & Verify", "Frontend Dev", "WebSocket STOMP với fallback sang Long-Polling nếu mạng chặn WS."
    ),
    (
        "Nền Tảng Dùng Chung", "[S04]", "CORE-NOTIF-02", "P0",
        "Đánh Dấu Tất Cả Đã Đọc & Lọc Thông Báo Theo Phân Hệ",
        "Cung cấp nút bấm dọn sạch thông báo chưa đọc trong 1 chạm và hỗ trợ lọc theo loại thông báo (Đơn từ, Chấm công, OKR).",
        "Input: Click nút [Đánh dấu tất cả là đã đọc]; Chọn tab filter ('Tất cả', 'Chưa đọc', 'Đơn từ', 'OKR').\n"
        "Xử lý hệ thống & Lưu trữ: 1. Gọi API PUT /api/v1/notifications/mark-all-read. 2. Cập nhật bảng 'notifications' set is_read = true where user_id = currentUserId. 3. Reset unread_count về 0.\n"
        "Output: HTTP 200 OK; Badge đỏ biến mất; UI chuyển toàn bộ nền thẻ thông báo sang màu đã đọc.\n"
        "Kết quả cuối cùng: Hộp thư thông báo gọn gàng, người dùng dễ dàng quản lý thông tin.",
        "PUT /api/v1/notifications/mark-all-read",
        "UI Steps:\n1. Mở dropdown chuông -> Bấm chữ [Đánh dấu đã đọc tất cả].\n2. Verify: Badge đỏ biến mất, tất cả thông báo chuyển sang xám nhạt.\nAPI Steps:\n1. Gọi PUT /api/v1/notifications/mark-all-read -> unreadCount về 0.",
        "Ready for Test & Verify", "Frontend Dev", "Cải thiện trải nghiệm quản trị thông báo cá nhân."
    ),
    (
        "Nền Tảng Dùng Chung", "[S04]", "CORE-DIGEST-01", "P0",
        "Email Digest Tổng Hợp Lúc 8h00 Sáng Mỗi Ngày Qua Gmail",
        "Tự động tổng hợp toàn bộ các nhiệm vụ, đơn từ chờ duyệt và sự kiện quan trọng trong ngày gửi vào email nhân viên vào 8h00 sáng mỗi ngày làm việc.",
        "Input: Cronjob chạy vào 08:00 AM từ Thứ 2 đến Thứ 6 hàng tuần.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Quét toàn bộ người dùng có todo items chưa hoàn tất hoặc đơn từ đang chờ duyệt. 2. Sinh template HTML email đẹp mắt mang thương hiệu ACT-HKT 2026. 3. Gọi MailerService gửi email qua smtp.gmail.com.\n"
        "Output: Log MailerService ghi nhận số lượng email gửi thành công.\n"
        "Kết quả cuối cùng: Cán bộ nhân viên bắt đầu ngày làm việc mới với bức tranh công việc rõ ràng trong hòm thư cá nhân.",
        "POST /api/v1/cron/send-daily-digest",
        "UI Steps:\n1. Kiểm tra hộp thư Gmail lúc 8h sáng -> Thấy email 'Bản tin công việc đầu ngày ACT-HKT'.\n2. Bấm link trong email -> Đưa thẳng vào màn hình S02 Todo Inbox.\nAPI Steps:\n1. Gọi API trigger cronjob giả lập -> Verify email được gửi đi thành công.",
        "Ready for Test & Verify", "Backend Dev", "Không gửi email rác nếu nhân viên không có nhiệm vụ tồn đọng."
    ),

    # 5. Trình Cấu Hình Quy Định Động (Rule Engine)
    (
        "Nền Tảng Dùng Chung", "[S18]", "CORE-RULE-01", "P0",
        "Danh Mục Catalog 19 Quy Định Động Toàn Hệ Thống",
        "Hiển thị danh mục tập trung 19 quy tắc nghiệp vụ điều khiển toàn bộ hoạt động của hệ thống Chấm công, Nghỉ phép và OKR mà không cần sửa code.",
        "Input: Request GET /api/v1/admin/rules.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Truy vấn bảng 'system_rules'. 2. Hiển thị 19 quy định phân nhóm: Nhóm chấm công (Vùng geofence, dung sai đi muộn, làm tròn công, ca linh hoạt), Nhóm nghỉ phép (Tích lũy phép, phép chức vụ, hạn ngạch WFH, hạn dọn phép tồn), Nhóm OKR (Tỷ lệ 20/80, thang điểm 1-5, hạn chót đánh giá).\n"
        "Output: HTTP 200 OK kèm danh sách 19 rules: [{key, name, category, currentVersion, status=ACTIVE, updatedAt, updatedBy}].\n"
        "Kết quả cuối cùng: HR Admin có cái nhìn tổng quan minh bạch về toàn bộ các chính sách đang vận hành trong doanh nghiệp.",
        "GET /api/v1/admin/rules",
        "UI Steps:\n1. Mở menu Cấu hình quy định (/admin/rules).\n2. Verify: Danh mục 19 quy định hiển thị đầy đủ, phân loại theo 3 tab chuyên biệt.\nAPI Steps:\n1. Gọi GET /api/v1/admin/rules -> HTTP 200 OK với đúng 19 bản ghi rules.",
        "Ready for Test & Verify", "Frontend Dev", "Mọi thay đổi chính sách đều thực hiện tại đây, zero code deployment."
    ),
    (
        "Nền Tảng Dùng Chung", "[S18-E]", "CORE-RULE-02", "P0",
        "Trình Soạn Thảo Quy Tắc Tham Số Trực Quan & JSON AST",
        "Cung cấp giao diện chỉnh sửa tham số trực quan cho người dùng nghiệp vụ và trình soạn thảo cấu trúc JSON AST cho chuyên gia kỹ thuật.",
        "Input: Tham số quy tắc được chỉnh sửa (ví dụ: đổi ATTENDANCE_GEOFENCE_RADIUS từ 150 sang 200 mét).\n"
        "Xử lý hệ thống & Lưu trữ: 1. Validate cú pháp JSON Schema của quy định. 2. Tính toán mã băm SHA-256 cho phiên bản mới. 3. Lưu bản ghi mới vào bảng 'system_rule_versions' (rule_key, version_hash, parameters_json, created_by, created_at). 4. Cập nhật con trỏ current_version_id trong bảng 'system_rules'. 5. Xóa cache Redis 'rule:{key}'.\n"
        "Output: HTTP 200 OK với thông điệp 'Đã lưu và áp dụng quy định phiên bản mới thành công'; UI Toast xanh.\n"
        "Kết quả cuối cùng: Quy tắc mới có hiệu lực ngay lập tức trên toàn hệ thống mà không cần restart server.",
        "PUT /api/v1/admin/rules/{key}",
        "UI Steps:\n1. Chọn quy định 'Bán kính Geofence chấm công' -> Sửa giá trị từ 150m thành 200m.\n2. Bấm [Lưu cấu hình] -> Nhập lý do thay đổi -> Xác nhận.\n3. Verify: Phiên bản tăng lên v1.2, áp dụng thành công.\nAPI Steps:\n1. Gửi PUT /api/v1/admin/rules/ATTENDANCE_GEOFENCE_RADIUS -> HTTP 200 OK.",
        "Ready for Test & Verify", "Fullstack Dev", "Cache Redis giúp thời gian đọc quy định chỉ mất < 2ms."
    ),
    (
        "Nền Tảng Dùng Chung", "[S18]", "CORE-RULE-03", "P0",
        "Lịch Sử Phiên Bản & Hoàn Tác (Rollback 1-Click)",
        "Lưu trữ toàn bộ lịch sử các phiên bản thay đổi của quy định kèm cơ chế hoàn tác về bất kỳ phiên bản nào trong quá khứ chỉ với 1 cú click chuột.",
        "Input: Phiên bản mục tiêu version_hash cần rollback; Lý do hoàn tác.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Tra cứu parameters_json của phiên bản cũ trong bảng 'system_rule_versions'. 2. Tạo một bản ghi phiên bản mới kế thừa chính xác cấu hình cũ kèm ghi chú rollback. 3. Xóa cache Redis để cập nhật tức thì. 4. Ghi audit log chi tiết người thực hiện hoàn tác.\n"
        "Output: HTTP 200 OK; UI cập nhật lại giá trị tham số trên màn hình ngay lập tức.\n"
        "Kết quả cuối cùng: Đảm bảo an toàn tuyệt đối, loại bỏ rủi ro khi Admin cấu hình nhầm tham số chính sách.",
        "POST /api/v1/admin/rules/{key}/rollback",
        "UI Steps:\n1. Tại màn hình quy tắc, xem bảng 'Lịch sử thay đổi'.\n2. Thấy phiên bản v1.1 hoạt động tốt -> Bấm nút [Rollback về bản này].\n3. Xác nhận tại popup -> Quy định được hoàn tác ngay lập tức.\nAPI Steps:\n1. Gọi POST /api/v1/admin/rules/{key}/rollback?targetVersion=v1.1 -> HTTP 200 OK.",
        "Ready for Test & Verify", "Backend Lead", "Cơ chế Rollback hoạt động độc lập không làm gián đoạn hệ thống."
    ),
    (
        "Nền Tảng Dùng Chung", "[S18]", "CORE-RULE-04", "P0",
        "Môi Trường Giả Lập Chạy Thử Quy Định (Dry-Run Sandbox)",
        "Cho phép HR Admin nhập dữ liệu giả lập để kiểm tra và xem trước kết quả tính toán của quy định mới trước khi chính thức áp dụng.",
        "Input: Cấu hình quy tắc dự kiến áp dụng và bộ dữ liệu test mẫu (ví dụ: tọa độ GPS cách văn phòng 180m, thời gian check-in 08:35).\n"
        "Xử lý hệ thống & Lưu trữ: 1. Core Service nạp cấu hình test vào bộ máy đánh giá quy tắc (Rule Evaluator) trong bộ nhớ RAM tạm thời. 2. Thực thi tính toán với dữ liệu test mà không ghi bất kỳ dữ liệu nào vào cơ sở dữ liệu thật. 3. Thu thập kết quả đánh giá và các bước giải thích logic.\n"
        "Output: HTTP 200 OK kèm kết quả giả lập: {isValid: true, calculatedWorkDay: 1.0, isLate: false, explanation: 'Trong khung giờ dung sai 15 phút'}.\n"
        "Kết quả cuối cùng: Admin tự tin tuyệt đối khi ban hành chính sách mới vì đã được kiểm chứng an toàn qua Sandbox.",
        "POST /api/v1/admin/rules/{key}/dry-run",
        "UI Steps:\n1. Bấm nút [Chạy thử trong Sandbox].\n2. Nhập giờ đến: 08:35 -> Bấm [Kiểm tra kết quả].\n3. Verify: Hệ thống hiển thị hộp kết quả màu xanh 'Hợp lệ - Tính đủ 1.0 công theo luật Flex-time'.\nAPI Steps:\n1. Gửi POST /api/v1/admin/rules/FLEX_TIME/dry-run -> HTTP 200 OK.",
        "Ready for Test & Verify", "Fullstack Dev", "Môi trường cô lập 100% không ảnh hưởng đến dữ liệu thực tế."
    ),
    (
        "Nền Tảng Dùng Chung", "[S19]", "CORE-RULE-05", "P0",
        "Trang Tra Cứu Nội Quy Công Ty Tự Động Sinh (Auto-Generated FAQ)",
        "Tự động trích xuất các tham số từ Rule Engine để sinh ra trang tra cứu nội quy và cẩm nang nhân viên S19, đảm bảo nội dung luôn đồng nhất với phần mềm.",
        "Input: Yêu cầu xem trang Nội quy công ty (/rules/faq).\n"
        "Xử lý hệ thống & Lưu trữ: 1. Trình chuyển đổi (Rule-to-Prose Parser) đọc các tham số hiện hành của 19 rules. 2. Tự động điền các con số thực tế vào các mẫu câu hỏi đáp tiếng Việt chuẩn (Ví dụ: 'Mỗi tháng tôi được đi muộn mấy lần?' -> Điền tham số 3 lần / 60 phút). 3. Render giao diện cẩm nang dạng Accordion đẹp mắt.\n"
        "Output: Trang FAQ hiển thị trực quan, có ô tìm kiếm nhanh, nút in ấn và chia sẻ.\n"
        "Kết quả cuối cùng: Triệt tiêu 100% hiện tượng lệch pha tài liệu (Documentation Drift); khi Admin đổi luật, trang nội quy tự động đổi theo tức thì.",
        "GET /api/v1/rules/public-faq",
        "UI Steps:\n1. Mở menu Tra cứu nội quy (/rules/faq).\n2. Gõ 'Đi muộn' -> Xem câu trả lời: 'Được đi muộn tối đa 3 lần/tháng'.\n3. Admin vào S18 đổi luật thành 4 lần -> Quay lại S19 thấy số tự đổi thành 4 lần.\nAPI Steps:\n1. Gọi GET /api/v1/rules/public-faq -> HTTP 200 OK.",
        "Ready for Test & Verify", "Frontend Dev", "Đặc tả tính năng C10 loại bỏ hoàn toàn việc soạn tài liệu tay."
    ),

    # 6. Lịch Công Ty, Ca Trực & Nhật Ký Kiểm Toán
    (
        "Nền Tảng Dùng Chung", "[S35]", "CORE-CAL-01", "P0",
        "Quản Lý Lịch Nghỉ Lễ Tết & Lịch Làm Việc Công Ty 2026",
        "Cấu hình danh mục ngày nghỉ Lễ, Tết theo quy định nhà nước Việt Nam năm 2026 và các ngày nghỉ đặc thù của doanh nghiệp.",
        "Input: Năm tài chính (2026); Danh sách các ngày lễ (Tết Dương lịch, Tết Nguyên Đán, Giỗ Tổ Hùng Vương, 30/4 - 1/5, Quốc Khánh 2/9).\n"
        "Xử lý hệ thống & Lưu trữ: 1. Lưu vào bảng 'company_holidays' (holiday_date, holiday_name, is_paid=true, year=2026). 2. Khi nhân viên tạo đơn nghỉ hoặc hệ thống tính bảng công, tự động loại trừ các ngày lễ này ra khỏi số ngày trừ phép.\n"
        "Output: HTTP 200 OK với danh mục ngày lễ; Calendar hiển thị các ngày lễ màu xám có icon cờ đỏ.\n"
        "Kết quả cuối cùng: Hệ thống tự động nhận diện ngày nghỉ lễ để tính công nguyên lương mà không cần HR can thiệp thủ công.",
        "GET /api/v1/admin/holidays\nPOST /api/v1/admin/holidays",
        "UI Steps:\n1. Vào Quản lý ca trực & ngày lễ (/admin/schedules).\n2. Xem danh sách ngày lễ 2026 -> Thấy Tết Âm Lịch từ 16/02 đến 20/02/2026 được đánh dấu chuẩn.\nAPI Steps:\n1. Gọi GET /api/v1/admin/holidays?year=2026 -> HTTP 200 OK.",
        "Ready for Test & Verify", "Fullstack Dev", "Hỗ trợ cấu hình ngày làm bù nếu có quy định hoán đổi ngày làm việc."
    ),
    (
        "Nền Tảng Dùng Chung", "[S35]", "CORE-CAL-02", "P0",
        "Cấu Hình Ca Làm Việc Chuẩn & Ca Linh Hoạt (Flex-Time)",
        "Thiết lập khung giờ làm việc tiêu chuẩn và chính sách linh hoạt thời gian cho từng khối phòng ban.",
        "Input: Thông số ca làm việc: Giờ bắt đầu (08:30), Giờ kết thúc (17:30), Nghỉ trưa (12:00 - 13:00), Dung sai linh hoạt (Flex range: 08:00 - 09:00, đủ 8h làm việc).\n"
        "Xử lý hệ thống & Lưu trữ: 1. Lưu vào bảng 'work_shifts'. 2. Gán ca làm việc cho từng phòng ban hoặc cá nhân nhân viên trong bảng 'user_shifts'. 3. Rule Engine sử dụng thông số này để đối soát giờ check-in/out thực tế.\n"
        "Output: HTTP 200 OK; UI hiển thị danh mục ca làm việc trực quan.\n"
        "Kết quả cuối cùng: Nhân viên đến lúc 08:45 và về lúc 17:45 vẫn được tính đủ 1.0 công hợp lệ mà không bị ghi nhận đi muộn.",
        "GET /api/v1/admin/shifts",
        "UI Steps:\n1. Xem chi tiết 'Ca Hành Chính Linh Hoạt'.\n2. Verify các khung giờ hiển thị chuẩn xác.\nAPI Steps:\n1. Gọi GET /api/v1/admin/shifts -> HTTP 200 OK.",
        "Ready for Test & Verify", "Backend Dev", "Hỗ trợ linh hoạt nhiều loại ca cho khối văn phòng và khối dự án."
    ),
    (
        "Nền Tảng Dùng Chung", "[S36]", "CORE-DEL-01", "P0",
        "Thiết Lập Ủy Quyền Phê Duyệt Khi Đi Vắng (Delegation)",
        "Cho phép Quản lý thiết lập ủy quyền quyền hạn phê duyệt đơn từ cho cấp phó hoặc nhân sự tương đương khi đi công tác hoặc nghỉ phép dài ngày.",
        "Input: Assignee ID (người được ủy quyền), startDate, endDate, scope (Tất cả đơn, Chỉ đơn nghỉ phép, Chỉ duyệt OKR).\n"
        "Xử lý hệ thống & Lưu trữ: 1. Validate người được ủy quyền không phải là chính mình và có cấp bậc phù hợp. 2. Lưu vào bảng 'approval_delegations'. 3. Khi có đơn mới gửi lên trong khoảng thời gian hiệu lực, đơn sẽ xuất hiện đồng thời trong Todo Inbox của cả người ủy quyền và người được ủy quyền.\n"
        "Output: HTTP 201 Created; UI hiển thị thẻ ủy quyền đang hoạt động kèm nút [Hủy ủy quyền].\n"
        "Kết quả cuối cùng: Quy trình phê duyệt của phòng ban diễn ra thông suốt, không bị đình trệ khi sếp vắng mặt.",
        "POST /api/v1/admin/delegations",
        "UI Steps:\n1. Quản lý vào menu Ủy quyền (/admin/delegations) -> Bấm [+ Tạo ủy quyền].\n2. Chọn người được ủy quyền: 'Phó phòng B', Từ ngày 20/11 đến 25/11 -> Bấm [Lưu].\n3. Verify: Danh sách hiển thị bản ghi ủy quyền đang hiệu lực.\nAPI Steps:\n1. Gửi POST /api/v1/admin/delegations -> HTTP 201 Created.",
        "Ready for Test & Verify", "Fullstack Dev", "Audit log ghi rõ 'Duyệt thay bởi [Người được ủy quyền]' khi thao tác."
    ),
    (
        "Nền Tảng Dùng Chung", "[S45]", "CORE-AUDIT-01", "P0",
        "Nhật Ký Kiểm Toán Tập Trung & So Sánh Khác Biệt (Centralized Audit Trail)",
        "Ghi vết toàn bộ các thao tác trọng yếu trên toàn hệ thống kèm công cụ xem lại lịch sử trước/sau thay đổi (Before/After Diff) phục vụ thanh tra an ninh.",
        "Input: Bất kỳ thao tác Create, Update, Delete, Approve, Export nào diễn ra trong hệ thống.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Spring AOP Aspect (@Audited) tự động bắt request. 2. Trích xuất Actor ID, Tên, IP, User Agent, Entity Name, Action Type, Before Data JSON, After Data JSON. 3. Lưu bất đồng bộ vào bảng 'audit_logs'.\n"
        "Output: Màn hình S45 (/admin/audit-logs) hiển thị lưới nhật ký chi tiết; Click xem chi tiết hiển thị trình so sánh trực quan tô màu xanh dòng mới, đỏ dòng cũ.\n"
        "Kết quả cuối cùng: Mọi hành động đều minh bạch, truy vết được trách nhiệm của từng cá nhân khi có khiếu nại hoặc sự cố dữ liệu.",
        "GET /api/v1/admin/audit-logs",
        "UI Steps:\n1. Vào menu Nhật ký kiểm toán (/admin/audit-logs).\n2. Lọc theo hành động 'UPDATE_TIMESHEET' -> Click xem 1 bản ghi.\n3. Verify: Modal so sánh hiện rõ giá trị cũ '0.50' -> giá trị mới '1.00', người sửa 'HR Admin'.\nAPI Steps:\n1. Gọi GET /api/v1/admin/audit-logs?page=0&size=20 -> HTTP 200 OK.",
        "Ready for Test & Verify", "Backend Lead", "Bảng audit_logs được đánh chỉ mục và phân vùng theo tháng (Table Partitioning)."
    ),
    (
        "Nền Tảng Dùng Chung", "[S00]", "CORE-UI-01", "P0",
        "Sidebar Thu Gọn & Mở Rộng Linh Hoạt Theo Chuẩn Quốc Tế",
        "Cung cấp thanh Sidebar chuyên nghiệp với 2 chế độ: mở rộng đầy đủ (w-64) và thu gọn icon-only rail (w-[70px]) không làm lệch giao diện hay tràn nội dung.",
        "Input: Click nút thu gọn/mở rộng ở chân Sidebar; Tùy chọn lưu trong localStorage ('act_sidebar_collapsed').\n"
        "Xử lý hệ thống & Lưu trữ: 1. State 'isCollapsed' chuyển đổi giữa true và false. 2. Lưu trạng thái vào localStorage để ghi nhớ khi refresh trang. 3. Thêm CSS transition mượt mà 'transition-all duration-300'. 4. Khi thu gọn, hiển thị Tooltip trôi nổi khi hover vào từng icon.\n"
        "Output: Sidebar co giãn êm ái; phần nội dung trang co giãn linh hoạt theo tỷ lệ màn hình mà không bị tràn hay nhảy layout.\n"
        "Kết quả cuối cùng: Tối ưu không gian hiển thị tối đa cho các màn hình bảng biểu lớn như Bảng công 45 cột.",
        "N/A (Frontend Component)",
        "UI Steps:\n1. Nhìn nút mũi tên ở chân Sidebar -> Click để thu gọn.\n2. Verify: Sidebar thu nhỏ về thanh icon gọn gàng 70px, nội dung bảng công bên phải dãn rộng ra.\n3. Rê chuột vào icon -> Tooltip tên chức năng hiện lên rõ ràng.\n4. Click lại để mở rộng -> Sidebar trở về 256px mượt mà.",
        "Ready for Test & Verify", "Frontend Dev", "Đã fix cứng layout chống hiện tượng tràn trang khi chuyển tabs."
    ),
    (
        "Nền Tảng Dùng Chung", "[S00]", "CORE-UI-02", "P0",
        "Giao Diện Đáp Ứng Mobile Tối Ưu (Bottom Navigation & Drawer)",
        "Thiết kế giao diện Mobile-First chuyên nghiệp cho nhân viên sử dụng điện thoại thông minh: Bottom Navigation 4 nút và Sidebar trượt dạng Drawer.",
        "Input: Người dùng truy cập hệ thống từ thiết bị di động có màn hình < 768px.\n"
        "Xử lý hệ thống & Lưu trữ: 1. CSS Media Queries tự động ẩn Sidebar cố định của desktop. 2. Hiển thị nút Hamburger trên Header mở Drawer trượt từ bên trái. 3. Hiển thị thanh Bottom Navigation gắn cố định ở đáy màn hình gồm 4 nút: Cần Làm, Chấm Công, Bảng Công, Tài Khoản. 4. Hỗ trợ Safe Area Padding cho iPhone (tai thỏ / dynamic island).\n"
        "Output: Giao diện trên điện thoại hiển thị như một ứng dụng Native App thực thụ, thao tác bằng 1 ngón tay cái dễ dàng.\n"
        "Kết quả cuối cùng: Nhân viên thao tác chấm công và duyệt đơn trên điện thoại mượt mà, tiện lợi.",
        "N/A (Frontend Responsive)",
        "UI Steps:\n1. Mở DevTools chuyển sang kích thước iPhone 14 Pro (393px).\n2. Verify: Thanh Bottom Nav xuất hiện ở đáy màn hình.\n3. Bấm nút giữa 'Chấm công' -> Mở ngay màn hình chấm công 1 chạm S05m.\n4. Bấm Hamburger -> Drawer mở ra từ trái mượt mà.",
        "Ready for Test & Verify", "Frontend Dev", "Tương thích 100% PWA và màn hình cảm ứng di động."
    )
]
