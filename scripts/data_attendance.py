# -*- coding: utf-8 -*-
"""
Data for Sheet 2: Chấm Công & Đơn Từ (Attendance & Time Tracking)
"""

attendance_rows = [
    # 1. Chấm Công 1 Chạm & 5 Lớp Bảo Mật Chống Gian Lận
    (
        "Chấm Công & Đơn Từ", "[S05m]", "ATT-PUNCH-01", "P0",
        "Giao Diện Chấm Công 1 Chạm Di Động (Mobile 1-Tap Punch)",
        "Thiết kế giao diện chấm công tối ưu hóa cho màn hình điện thoại với nút bấm tròn lớn Ø 112px, khung ngắm camera mượt mà và phản hồi trực quan siêu tốc dưới 1.5 giây (C11).",
        "Input: Mở màn hình S05m (/attendance/checkin); Cấp quyền truy cập Camera và Vị trí GPS trên thiết bị di động.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Khởi động WebRTC stream camera trước. 2. Thu thập tọa độ GPS ngầm qua Geolocation API. 3. Thu thập thông tin mạng WiFi IP. 4. Đồng bộ thời gian chuẩn từ máy chủ.\n"
        "Output: Khung ngắm khuôn mặt hiển thị vòng tròn neon phát sáng; Nút tròn lớn [Chấm Công] sẵn sàng ở chính giữa đáy màn hình.\n"
        "Kết quả cuối cùng: Nhân viên có thể chấm công ngay lập tức bằng 1 chạm ngón tay cái mà không phải qua nhiều thao tác phụ.",
        "POST /api/v1/attendance/check-in",
        "UI Steps:\n1. Mở app trên điện thoại, bấm nút tròn [Chấm Công] ở đáy màn hình.\n2. Verify: Camera bật sáng tức thì kèm khung tròn căn chỉnh mặt.\nAPI Steps:\n1. Kiểm tra API GET /api/v1/attendance/status trả về trạng thái chấm công hiện tại của ngày (đã check-in hay chưa).",
        "Ready for Test & Verify", "AI/Mobile Dev", "Nút bấm Ø 112px đạt chuẩn Human Interface Guidelines cho thao tác 1 tay."
    ),
    (
        "Chấm Công & Đơn Từ", "[S05m]", "ATT-PUNCH-02", "P0",
        "Lớp 1 - AI Liveness Detection Chống Giả Mạo Sinh Trắc Học",
        "Thuật toán AI phát hiện người thật thời gian thực, ngăn chặn triệt để hành vi dùng ảnh in, ảnh chụp màn hình điện thoại hoặc video phát lại để gian lận chấm công.",
        "Input: Chuỗi 3-5 frame hình ảnh liên tiếp từ camera khi nhân viên bấm chấm công.\n"
        "Xử lý hệ thống & Lưu trữ: 1. AI Face Service phân tích chuyển động vi mô (Micro-motion): chớp mắt tự nhiên, chuyển động cơ mặt và biến thiên phản xạ ánh sáng (Specular reflection). 2. Đo độ sâu quang học và kết cấu da (Skin texture analysis). 3. Tính điểm Liveness Score (ngưỡng an toàn >= 0.85).\n"
        "Output: Nếu phát hiện ảnh giả mạo -> UI báo đỏ 'Phát hiện khuôn mặt không phải người thật (Liveness check failed)'; Nếu người thật -> Chuyển sang bước so khớp vector.\n"
        "Kết quả cuối cùng: Loại bỏ hoàn toàn nguy cơ dùng ảnh gian lận, bảo vệ tính trung thực của dữ liệu chấm công.",
        "POST /api/v1/face/verify-liveness",
        "UI Steps:\n1. Dùng 1 chiếc điện thoại khác giơ ảnh chân dung nhân viên trước camera -> Bấm chấm công.\n2. Verify: App lập tức báo lỗi 'Không phát hiện chuyển động sinh học người thật'.\nAPI Steps:\n1. Gửi ảnh tĩnh lặp lại -> AI Service trả về is_real_person=false, score < 0.5.",
        "Ready for Test & Verify", "AI/Biometric Team", "Mô hình MiniFASNet / MediaPipe Face Mesh nhận diện 468 điểm mốc trên mặt."
    ),
    (
        "Chấm Công & Đơn Từ", "[S05m]", "ATT-PUNCH-03", "P0",
        "Lớp 1 - AI Face Vector Matching So Khớp Vector 512D",
        "So sánh vector khuôn mặt trích xuất từ camera với mẫu khuôn mặt chuẩn đã đăng ký của nhân viên bằng phép đo khoảng cách Cosine Similarity.",
        "Input: Frame ảnh đạt chuẩn Liveness và User ID của nhân viên đăng nhập.\n"
        "Xử lý hệ thống & Lưu trữ: 1. AI Service trích xuất vector 512 chiều từ ảnh hiện tại. 2. Truy vấn vector mẫu chuẩn trong bảng 'user_face_embeddings' qua extension PostgreSQL pgvector. 3. Tính Cosine Similarity: `similarity = 1 - (embedding <=> registered_embedding)`.\n"
        "Output: Nếu similarity >= 0.82 -> Xác thực sinh trắc học thành công (Face Matched); Nếu < 0.82 -> Báo 'Khuôn mặt không trùng khớp với hồ sơ nhân viên'.\n"
        "Kết quả cuối cùng: Xác thực chính xác danh tính nhân viên trong thời gian xử lý cực nhanh < 300ms.",
        "POST /api/v1/face/match-vector",
        "UI Steps:\n1. Nhờ người khác chấm công trên máy của mình -> Báo lỗi 'Khuôn mặt không trùng khớp'.\n2. Chính chủ đưa mặt vào -> Tick xanh xác nhận thành công.\nAPI Steps:\n1. Gửi vector test -> Trả về similarity score và match boolean.",
        "Ready for Test & Verify", "AI/Biometric Team", "Ngưỡng Cosine 0.82 đạt chuẩn bảo mật ngân hàng (sai số FAR < 0.001%)."
    ),
    (
        "Chấm Công & Đơn Từ", "[S05m]", "ATT-PUNCH-04", "P0",
        "Lớp 1 - Cơ Chế Chống Chấm Công Hộ (Anti-Proxy Punch Business Rule)",
        "Quy tắc nghiệp vụ so khớp chéo 1:N độc lập: AI nhận diện ai đang đứng trước máy và so khớp với ID tài khoản đăng nhập; nếu phát hiện chấm hộ lập tức chặn cứng và ghi log vi phạm.",
        "Input: Ảnh chụp khuôn mặt từ request chấm công và current_user_id từ JWT token.\n"
        "Xử lý hệ thống & Lưu trữ: 1. AI Face Service thực hiện tìm kiếm 1:N trên toàn bộ kho vector để tìm ra mã nhân viên thực tế đang đứng trước camera (recognized_user_id). 2. So sánh recognized_user_id với current_user_id. 3. Nếu lệch nhau -> Chặn đứng request, từ chối tính công, ghi bản ghi vi phạm vào bảng 'security_audit_logs' (loại PROXY_PUNCH_ATTEMPT kèm ảnh bằng chứng).\n"
        "Output: HTTP 403 Forbidden với mã lỗi 'PROXY_PUNCH_DETECTED', UI cảnh báo đỏ 'Cảnh báo: Phát hiện hành vi chấm công hộ. Dữ liệu đã được gửi về HR'.\n"
        "Kết quả cuối cùng: Ngăn chặn triệt để tình trạng nhân viên đăng nhập tài khoản của nhau để chấm công hộ.",
        "POST /api/v1/attendance/check-in",
        "UI Steps:\n1. Nhân viên A đăng nhập trên điện thoại, đưa cho nhân viên B bấm chấm công.\n2. Verify: Hệ thống chặn đứng, không tính công và hiển thị cảnh báo đỏ.\nAPI Steps:\n1. Request có user A nhưng ảnh mặt của user B -> HTTP 403 PROXY_PUNCH_DETECTED.",
        "Ready for Test & Verify", "Backend Lead", "Nguyên tắc cốt lõi được yêu cầu trực tiếp từ ban lãnh đạo ACT."
    ),
    (
        "Chấm Công & Đơn Từ", "[S05m]", "ATT-PUNCH-05", "P0",
        "Lớp 2 - Xác Thực Mạng WiFi Nội Bộ Trụ Sở ACT",
        "Kiểm tra thiết bị có đang kết nối vào đúng mạng WiFi nội bộ của văn phòng công ty thông qua địa chỉ IP Gateway hoặc BSSID điểm phát sóng.",
        "Input: Client IP address từ HttpServletRequest và WiFi BSSID/SSID (nếu chạy qua mobile app wrapper).\n"
        "Xử lý hệ thống & Lưu trữ: 1. Core Service đối chiếu IP của request với dải IP mạng nội bộ được cấu hình trong bảng 'office_locations' (ví dụ: 14.161.x.x hoặc subnet công ty). 2. Nếu khớp dải IP nội bộ -> Đánh dấu wifi_verified = true.\n"
        "Output: Trạng thái kiểm tra WiFi hợp lệ; nếu ở mạng ngoài -> Gắn cờ cảnh báo hoặc yêu cầu xác thực GPS bổ sung.\n"
        "Kết quả cuối cùng: Tăng cường tính xác thực địa điểm, đảm bảo nhân viên đang có mặt thực tế tại văn phòng.",
        "POST /api/v1/attendance/verify-network",
        "UI Steps:\n1. Kết nối WiFi văn phòng ACT-Office -> Màn hình chấm công hiện icon WiFi màu xanh lá 'WiFi Nội Bộ Hợp Lệ'.\n2. Tắt WiFi dùng 4G -> Icon chuyển sang màu cam 'Sử dụng mạng di động - Cần GPS'.\nAPI Steps:\n1. Request từ IP nội bộ trả về is_office_network=true.",
        "Ready for Test & Verify", "DevOps / Backend", "Cấu hình dải IP động qua Rule Engine."
    ),
    (
        "Chấm Công & Đơn Từ", "[S05m]", "ATT-PUNCH-06", "P0",
        "Lớp 3 - Định Vị GPS Geofence & Thuật Toán Khoảng Cách Haversine",
        "Tính toán khoảng cách vật lý thực tế giữa tọa độ GPS của thiết bị và vị trí văn phòng ACT bằng công thức Haversine trên mặt cầu Elipsoid Trái Đất.",
        "Input: Tọa độ thiết bị (latitude, longitude, accuracy) gửi từ client; Tọa độ văn phòng ACT cấu hình trong hệ thống (Lat: 21.0123, Long: 105.8456).\n"
        "Xử lý hệ thống & Lưu trữ: 1. Áp dụng công thức Haversine: `a = sin²(Δlat/2) + cos(lat1)*cos(lat2)*sin²(Δlon/2); c = 2*atan2(√a, √(1−a)); d = R * c` (R = 6,371,000m). 2. Tính ra khoảng cách sai lệch tính bằng mét (distance_meters).\n"
        "Output: Khoảng cách chính xác giữa nhân viên và văn phòng kèm sai số đo lường accuracy.\n"
        "Kết quả cuối cùng: Xác định chính xác vị trí không gian của nhân viên mà không phụ thuộc vào tên mạng.",
        "POST /api/v1/attendance/check-in",
        "UI Steps:\n1. Bật GPS trên máy, app hiển thị: 'Khoảng cách đến văn phòng: 35 mét'.\nAPI Steps:\n1. Gửi request kèm tọa độ -> Server trả về distance_meters và geofence_status.",
        "Ready for Test & Verify", "Backend Dev", "Thuật toán tối ưu tính toán chỉ mất < 1ms."
    ),
    (
        "Chấm Công & Đơn Từ", "[S05m]", "ATT-PUNCH-07", "P0",
        "Lớp 3 - Phân 3 Vùng Địa Lý (Vùng Xanh 150m & Vùng Vàng 300m)",
        "Áp dụng chính sách phân vùng thông minh: Vùng 1 hợp lệ tuyệt đối, Vùng 2 cảnh báo GPS yếu nhưng không chặn oan, Vùng 3 chặn cứng chống gian lận từ xa.",
        "Input: Khoảng cách distance_meters tính được từ công thức Haversine.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Vùng 1 (<= 150m): Vùng Xanh hợp lệ tuyệt đối, geofence_status = GREEN. 2. Vùng 2 (150m - 300m): Vùng Vàng, cho phép chấm công nhưng gắn cờ LOW_GPS_ACCURACY và ghi log để HR giám sát. 3. Vùng 3 (> 300m): Vùng Đỏ, chặn cứng từ chối chấm công.\n"
        "Output: Nếu > 300m -> HTTP 400 Bad Request kèm message 'Bạn đang ở ngoài phạm vi văn phòng (> 300m)'; Nếu <= 300m -> Cho phép tiếp tục.\n"
        "Kết quả cuối cùng: Loại bỏ tình trạng ở nhà cách xa hàng km vẫn chấm công, đồng thời không chặn oan nhân viên ngồi trong góc khuất sóng GPS của tòa nhà.",
        "POST /api/v1/attendance/check-in",
        "UI Steps:\n1. Đứng cách văn phòng 220m -> Chấm công thành công, hiển thị nhãn vàng 'GPS sai số nhẹ'.\n2. Đứng cách văn phòng 1.5km -> Bấm nút -> App chặn cứng báo 'Ngoài phạm vi cho phép'.\nAPI Steps:\n1. Tọa độ cách 500m -> HTTP 400 OUT_OF_GEOFENCE_BOUND.",
        "Ready for Test & Verify", "Backend Lead", "Bán kính cấu hình linh hoạt qua tham số Rule Engine S18."
    ),
    (
        "Chấm Công & Đơn Từ", "[S05m]", "ATT-PUNCH-08", "P0",
        "Lớp 4 - Đồng Bộ Thời Gian Server Timestamp Chuẩn NTP",
        "Ghi nhận thời gian chấm công theo đồng hồ máy chủ chuẩn hóa qua giao thức Network Time Protocol (NTP), chống việc nhân viên cố tình chỉnh giờ trên điện thoại.",
        "Input: Request chấm công từ client; Thời gian hệ thống tại Server `Instant.now()`.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Bỏ qua hoàn toàn timestamp gửi từ thiết bị client. 2. Lấy thời gian máy chủ đồng bộ với cụm NTP Server quốc gia (vn.pool.ntp.org). 3. Lưu trường 'punch_time' trong CSDL bằng Server Timestamp. 4. Tính toán số phút đi muộn / về sớm dựa trên timestamp này.\n"
        "Output: Thời gian chấm công ghi nhận chính xác đến từng mili-giây trên hóa đơn chấm công.\n"
        "Kết quả cuối cùng: Loại bỏ hoàn toàn gian lận chỉnh giờ thủ công trên điện thoại.",
        "POST /api/v1/attendance/check-in",
        "UI Steps:\n1. Chỉnh lùi đồng hồ điện thoại về 08:00 (thực tế lúc này là 09:15) -> Bấm chấm công.\n2. Verify: App vẫn ghi nhận giờ chấm công là 09:15 theo đúng giờ máy chủ.\nAPI Steps:\n1. Payload client gửi timestamp cũ -> Server ghi nhận đúng thời điểm Instant.now() nhận request.",
        "Ready for Test & Verify", "DevOps / Backend", "Máy chủ cấu hình đồng bộ chrony NTP định kỳ."
    ),
    (
        "Chấm Công & Đơn Từ", "[S05m]", "ATT-PUNCH-09", "P0",
        "Lớp 5 - Chấm Công Ngoại Tuyến (Offline Punching) & Đồng Bộ 24h",
        "Cho phép nhân viên chấm công bình thường ngay cả khi mất sóng điện thoại hoặc mất mạng internet trong tầng hầm / thang máy, tự động đồng bộ khi có mạng.",
        "Input: Sự kiện mất kết nối mạng (navigator.onLine = false) khi nhân viên bấm chấm công.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Frontend lưu bản ghi chấm công vào IndexedDB cục bộ của trình duyệt kèm chữ ký số HMAC-SHA256 để chống can thiệp dữ liệu. 2. Lưu ảnh nén, GPS và timestamp cục bộ. 3. Khi máy có mạng trở lại (sự kiện online), Background Service tự động gửi bản ghi lên server trong vòng 24 giờ. 4. Server xác thực chữ ký và hợp thức hóa bản ghi.\n"
        "Output: UI hiển thị thông báo xanh: 'Đã lưu chấm công offline. Dữ liệu sẽ tự động đồng bộ khi có mạng'.\n"
        "Kết quả cuối cùng: Trải nghiệm không gián đoạn, nhân viên an tâm không bị mất công khi mạng chập chờn.",
        "POST /api/v1/attendance/sync-offline",
        "UI Steps:\n1. Bật chế độ máy bay (ngắt mạng) -> Bấm nút [Chấm công].\n2. Verify: App báo 'Đã ghi nhận offline' có biểu tượng đám mây gạch chéo.\n3. Tắt chế độ máy bay -> Biểu tượng đám mây chuyển sang xanh 'Đã đồng bộ'.\nAPI Steps:\n1. Gửi mảng offline punches qua API sync -> Server xác thực và lưu vào DB.",
        "Ready for Test & Verify", "AI/Mobile Dev", "Giới hạn đồng bộ trong 24 giờ để ngăn gian lận lưu trữ quá lâu."
    ),
    (
        "Chấm Công & Đơn Từ", "[S05m]", "ATT-PUNCH-10", "P0",
        "Phản Hồi Rung Haptic Feedback Khi Thao Tác Chấm Công",
        "Tích hợp hiệu ứng rung xúc giác trên điện thoại di động giúp nhân viên nhận biết ngay kết quả chấm công mà không cần nhìn chăm chú vào màn hình (C11).",
        "Input: Kết quả trả về của request chấm công (Thành công hoặc Thất bại).\n"
        "Xử lý hệ thống & Lưu trữ: 1. Kích hoạt Web Vibration API `navigator.vibrate()`. 2. Nếu thành công: Rung nhẹ 1 nhịp ngắn êm ái [100ms]. 3. Nếu thất bại / từ chối: Rung dồn dập 2 nhịp dài cảnh báo [200ms, 100ms, 200ms].\n"
        "Output: Thiết bị rung xúc giác vật lý theo đúng mẫu nhịp điệu tương ứng.\n"
        "Kết quả cuối cùng: Trải nghiệm người dùng chân thực, tiện lợi khi thao tác nhanh vào giờ cao điểm đầu ngày.",
        "N/A (Web Vibration API)",
        "UI Steps:\n1. Chấm công thành công trên điện thoại -> Máy rung nhẹ 1 cái 'tíc'.\n2. Thử chấm công ngoài bán kính geofence -> Máy rung 2 nhịp cảnh báo.\nAPI Steps:\n1. Kiểm tra mã gọi navigator.vibrate được trigger theo đúng kết quả.",
        "Ready for Test & Verify", "Frontend Dev", "Hỗ trợ chuẩn W3C Vibration API trên Android & iOS WebKit."
    ),
    (
        "Chấm Công & Đơn Từ", "[S05]", "ATT-PUNCH-11", "P0",
        "Tự Động Tính Giờ Công Thực Tế & Thuật Toán First IN - Last OUT",
        "Thuật toán tự động tổng hợp toàn bộ các lần quét vân tay/khuôn mặt trong ngày để xác định lần đầu tiên vào ca (IN) và lần cuối cùng rời ca (OUT) để tính giờ công.",
        "Input: Tất cả các bản ghi quét trong ngày của nhân viên trong bảng 'attendance_punches'.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Tìm bản ghi sớm nhất trong khoảng giờ ca -> Gán làm first_in_time. 2. Tìm bản ghi muộn nhất -> Gán làm last_out_time. 3. Trừ thời gian nghỉ trưa cố định (12:00 - 13:00 = 1 tiếng). 4. Tính tổng số giờ làm việc thực tế (actual_work_hours). 5. Đối chiếu với ca chuẩn 8.0 giờ để tính công (1.00 công hoặc 0.50 công).\n"
        "Output: Bản ghi tổng hợp ngày công trong bảng 'daily_timesheets' (user_id, date, check_in, check_out, total_hours, work_day_value).\n"
        "Kết quả cuối cùng: Dữ liệu công nhật được tính toán tự động, chính xác, không trùng lặp khi nhân viên quét nhiều lần.",
        "GET /api/v1/attendance/my-summary?date=2026-11-18",
        "UI Steps:\n1. Quét mặt lúc 08:25 (IN) và quét lúc 17:35 (OUT).\n2. Mở màn hình Bảng công cá nhân S11 -> Thấy ngày 18/11 hiển thị: Vào: 08:25, Ra: 17:35, Giờ làm: 8.17h, Công: 1.00.\nAPI Steps:\n1. Gọi GET my-summary -> Trả về JSON tổng hợp ngày công chính xác.",
        "Ready for Test & Verify", "Backend Lead", "Bản ghi quét giữa ca (ra ngoài gặp khách) không làm mất mốc First IN - Last OUT."
    ),

    # 2. Quản Lý Đơn Từ & Quota Engine (4 Loại Đơn)
    (
        "Chấm Công & Đơn Từ", "[S06]", "ATT-REQ-01", "P0",
        "Đơn Bổ Sung Công & Ràng Buộc Hạn Chót 23:59 Ngày Làm Việc",
        "Cho phép nhân viên nộp đơn giải trình quên chấm công nhưng bắt buộc phải nộp trước 23:59 của chính ngày làm việc đó, ngăn chặn việc bổ sung công hồi tố tùy tiện.",
        "Input: Form body JSON: workDate, punchType (IN, OUT, BOTH), requestedTime, reason, evidenceUrl.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Kiểm tra ngày nộp đơn so với workDate: nếu ngày hiện tại > workDate hoặc quá 23:59 của ngày đó -> Chặn nộp theo quy định. 2. Validate bắt buộc đính kèm file bằng chứng. 3. Lưu vào bảng 'requests' với type='MISSING_PUNCH', status='PENDING'. 4. Gửi thông báo đến Quản lý trực tiếp.\n"
        "Output: HTTP 201 Created kèm mã đơn; Nếu quá hạn -> HTTP 400 'Đã quá hạn chót 23:59 để tạo đơn bổ sung công cho ngày này'.\n"
        "Kết quả cuối cùng: Duy trì kỷ luật chấm công nghiêm túc, loại bỏ tình trạng cuối tháng mới làm đơn giải trình hàng loạt.",
        "POST /api/v1/attendance/requests/missing-punch",
        "UI Steps:\n1. Quên quét lúc về ngày 18/11 -> Lúc 20:00 cùng ngày vào tạo đơn bổ sung công -> Thành công.\n2. Sang ngày 19/11 mới tạo đơn cho ngày 18/11 -> Nút submit bị chặn kèm thông báo đỏ quá hạn.\nAPI Steps:\n1. Gửi request ngày hôm qua -> HTTP 400 MISSING_PUNCH_DEADLINE_EXCEEDED.",
        "Ready for Test & Verify", "Backend Dev", "Ràng buộc thời gian cấu hình qua Rule Engine MISSING_PUNCH_DEADLINE_HOURS."
    ),
    (
        "Chấm Công & Đơn Từ", "[S07]", "ATT-REQ-02", "P0",
        "Đơn Đi Muộn / Về Sớm & Quota Engine Giới Hạn 3 Lần / Tháng",
        "Quản lý việc xin đi muộn/về sớm có lý do chính đáng với cơ chế tự động kiểm soát hạn ngạch tối đa 3 lần hoặc 60 phút mỗi tháng.",
        "Input: Form body JSON: workDate, requestType (LATE_IN / EARLY_OUT), minutesRequested (ví dụ: 25 phút), reason.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Quota Engine đếm số lần đã đi muộn/về sớm được duyệt trong tháng hiện tại của nhân viên. 2. Nếu số lần < 3 và tổng phút <= 60 -> Cho phép gửi đơn và hiển thị cảnh báo 'Bạn còn lại X lần trong tháng'. 3. Nếu vượt quá -> Cảnh báo đơn này sẽ bị trừ lương/chuyển thành nghỉ không lương.\n"
        "Output: HTTP 201 Created kèm thông tin quota còn lại; UI Toast xanh.\n"
        "Kết quả cuối cùng: Nhân viên theo dõi sát sao hạn ngạch của mình; tránh việc lạm dụng đi muộn.",
        "POST /api/v1/attendance/requests/late-early",
        "UI Steps:\n1. Mở form S07 -> Thấy huy hiệu 'Đã dùng: 1/3 lần (20/60 phút)'.\n2. Nhập xin đi muộn 15 phút -> Bấm gửi -> Thành công, số lần dùng tăng lên 2/3.\nAPI Steps:\n1. Gọi POST late-early -> Kiểm tra bảng requests có bản ghi mới và quota được tính toán đúng.",
        "Ready for Test & Verify", "Fullstack Dev", "Tự động reset bộ đếm quota vào 00:00 ngày đầu tiên của mỗi tháng."
    ),
    (
        "Chấm Công & Đơn Từ", "[S08]", "ATT-REQ-03", "P0",
        "Đơn Xin Nghỉ Phép 8 Loại & Tự Động Trừ Ngày Nghỉ Tuần / Nghỉ Lễ",
        "Cung cấp quy trình tạo đơn xin nghỉ phép toàn diện hỗ trợ 8 loại nghỉ chuẩn theo Luật Lao động và tự động trừ các ngày Thứ 7, CN, Lễ Tết ra khỏi số ngày trừ phép thực tế.",
        "Input: Form JSON: leaveTypeCode (AL, SL, ML, CL, FL, CO, UL, OL), fromDate, toDate, durationType (FULL_DAY, MORNING, AFTERNOON), reason, attachments.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Core Service duyệt từng ngày trong khoảng từ fromDate đến toDate. 2. Bỏ qua các ngày Thứ 7, Chủ Nhật và các ngày có trong bảng 'company_holidays'. 3. Tính toán ra số ngày nghỉ thực tế (net_leave_days). 4. Kiểm tra số dư phép khả dụng.\n"
        "Output: UI hiển thị thông báo trực quan: 'Tổng thời gian nghỉ: 5 ngày lịch. Số ngày phép thực tính: 3 ngày (Đã trừ 2 ngày cuối tuần)'.\n"
        "Kết quả cuối cùng: Nhân viên không bị trừ oan ngày phép vào những ngày vốn là ngày nghỉ theo quy định.",
        "POST /api/v1/attendance/requests/leave",
        "UI Steps:\n1. Chọn nghỉ từ Thứ 6 (20/11) đến Thứ 2 tuần sau (23/11).\n2. Verify: Hệ thống tự động tính số ngày trừ phép là 2 ngày (chỉ tính Thứ 6 và Thứ 2).\nAPI Steps:\n1. Gửi POST leave request với dải ngày có cuối tuần -> Response trả về netDays=2.0.",
        "Ready for Test & Verify", "Backend Lead", "8 loại phép: Phép năm AL, Ốm SL, Thai sản ML, Cưới CL, Tang FL, Bù CO, Không lương UL, Khác OL."
    ),
    (
        "Chấm Công & Đơn Từ", "[S08]", "ATT-REQ-04", "P0",
        "Cơ Chế Ứng Trước Phép (Leave Advance) & Chặn Vượt Hạn Mức",
        "Cho phép nhân viên tạm ứng trước số ngày phép sẽ được tích lũy từ nay đến cuối năm tài chính nếu số dư hiện tại không đủ, đồng thời chặn cứng nếu vượt quá hạn mức tối đa.",
        "Input: Nhân viên có số dư phép hiện tại là 1.5 ngày, muốn xin nghỉ 3.0 ngày vào tháng 6.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Core Service tính số phép dự kiến tích lũy từ tháng 7 đến tháng 12 (+1 ngày/tháng = 6 ngày). 2. Tổng phép khả dụng bao gồm ứng trước = 1.5 + 6 = 7.5 ngày. 3. Vì 3.0 <= 7.5 -> Cho phép tạo đơn, gắn cờ is_advance=true (ứng 1.5 ngày). 4. Nếu xin nghỉ 9 ngày (> 7.5) -> Chặn cứng không cho nộp.\n"
        "Output: UI hiển thị thông điệp vàng: 'Số dư hiện tại: 1.5 ngày. Đơn này sử dụng 1.5 ngày phép ứng trước đến cuối năm'.\n"
        "Kết quả cuối cùng: Nhân viên có việc đột xuất được linh hoạt ứng phép mà công ty vẫn kiểm soát chặt chẽ rủi ro âm quỹ phép.",
        "POST /api/v1/attendance/requests/leave",
        "UI Steps:\n1. Nhân viên mới làm 2 tháng có 2 ngày phép -> Xin nghỉ 4 ngày.\n2. Verify: Form cho phép nộp kèm cảnh báo ứng phép rõ ràng.\nAPI Steps:\n1. Xin vượt quá tổng phép cả năm -> HTTP 400 INSUFFICIENT_LEAVE_BALANCE.",
        "Ready for Test & Verify", "Backend Dev", "Tham số LEAVE_ALLOW_ADVANCE cấu hình bật/tắt qua Rule Engine."
    ),
    (
        "Chấm Công & Đơn Từ", "[S08]", "ATT-REQ-05", "P0",
        "Kiểm Tra Thời Gian Báo Trước Nghỉ Phép (Lead Time Policy)",
        "Ràng buộc số ngày cần phải nộp đơn trước khi nghỉ tùy theo độ dài của đợt nghỉ để phòng ban kịp sắp xếp người thay thế công việc.",
        "Input: fromDate của đơn nghỉ phép và net_leave_days.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Đợt nghỉ 1 ngày: Cho phép nộp trước 08:30 sáng cùng ngày. 2. Đợt nghỉ từ 2-3 ngày: Bắt buộc nộp trước tối thiểu 1 ngày làm việc. 3. Đợt nghỉ > 3 ngày: Bắt buộc nộp trước tối thiểu 3 ngày làm việc. 4. Nếu vi phạm thời gian báo trước -> Yêu cầu nhập lý do khẩn cấp và chuyển cảnh báo cho Quản lý.\n"
        "Output: Cảnh báo visual nếu nộp sát giờ kèm nhắc nhở chính sách công ty.\n"
        "Kết quả cuối cùng: Đảm bảo kế hoạch vận hành công việc của phòng ban không bị xáo trộn bất ngờ.",
        "POST /api/v1/attendance/requests/leave",
        "UI Steps:\n1. Xin nghỉ 5 ngày liên tiếp vào ngày mai -> Hệ thống hiển thị cảnh báo vàng 'Đơn nộp chưa đủ thời gian báo trước 3 ngày. Bạn có lý do khẩn cấp không?'.\nAPI Steps:\n1. Kiểm tra cờ is_emergency_lead_time trong response.",
        "Ready for Test & Verify", "Frontend Dev", "Quy định linh hoạt không chặn cứng để xử lý việc đột xuất của nhân viên."
    ),
    (
        "Chấm Công & Đơn Từ", "[S09]", "ATT-REQ-06", "P0",
        "Đơn Làm Việc Từ Xa WFH & Giới Hạn Quota 2 Ngày / Tháng",
        "Kiểm soát chính sách làm việc tại nhà (Work From Home) đảm bảo nhân viên có kế hoạch làm việc rõ ràng và không vượt quá hạn mức 2 ngày/tháng.",
        "Input: Form body JSON: wfhDate, tasksPlan (Kế hoạch công việc trong ngày), deliverableOutputs (Sản phẩm bàn giao dự kiến).\n"
        "Xử lý hệ thống & Lưu trữ: 1. Quota Engine đếm số ngày WFH đã được duyệt trong tháng hiện tại. 2. Nếu đã đủ 2 ngày -> Chặn nộp trừ khi chọn luồng 'Ngoại lệ phê duyệt bởi Giám đốc'. 3. Lưu vào bảng 'requests' với type='WFH', status='PENDING'. 4. Gửi email thông báo cho Quản lý.\n"
        "Output: HTTP 201 Created; UI hiển thị tiến độ quota 'Đã dùng 1/2 ngày WFH tháng này'.\n"
        "Kết quả cuối cùng: Chính sách WFH minh bạch, đảm bảo hiệu suất công việc từ xa.",
        "POST /api/v1/attendance/requests/wfh",
        "UI Steps:\n1. Tạo đơn WFH lần thứ 3 trong tháng -> Nút gửi bị vô hiệu hóa kèm thông báo 'Bạn đã dùng hết hạn mức 2 ngày WFH trong tháng'.\nAPI Steps:\n1. Nộp đơn khi quota=2 -> HTTP 400 WFH_MONTHLY_QUOTA_EXCEEDED.",
        "Ready for Test & Verify", "Fullstack Dev", "Số ngày WFH tối đa 2 ngày/tháng theo quy định chính thức của công ty."
    ),
    (
        "Chấm Công & Đơn Từ", "[S12]", "ATT-REQ-07", "P0",
        "Quản Lý Đơn Từ Của Tôi & Hủy Đơn Chờ Duyệt (My Requests)",
        "Màn hình danh sách đơn từ cá nhân với 4 tab trạng thái trực quan: Chờ duyệt, Đã duyệt, Bị từ chối và Bản nháp; hỗ trợ hủy đơn khi chưa được duyệt.",
        "Input: Request GET /api/v1/attendance/my-requests; Thao tác Hủy đơn POST /api/v1/attendance/requests/{id}/cancel.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Lấy danh sách toàn bộ đơn từ của nhân viên đăng nhập. 2. Nếu đơn đang ở trạng thái PENDING -> Cho phép bấm nút [Hủy đơn]. 3. Khi hủy, chuyển status sang 'CANCELLED', hoàn lại quota tạm giữ và ghi log sự kiện. 4. Xóa nhiệm vụ tương ứng trong Todo Inbox của Quản lý.\n"
        "Output: HTTP 200 OK; Đơn chuyển sang trạng thái Đã hủy màu xám; UI Toast 'Hủy đơn thành công'.\n"
        "Kết quả cuối cùng: Nhân viên chủ động thu hồi đơn khi có thay đổi kế hoạch cá nhân.",
        "GET /api/v1/attendance/my-requests\nPOST /api/v1/attendance/requests/{id}/cancel",
        "UI Steps:\n1. Vào Đơn từ của tôi (/attendance/requests) -> Bấm nút [Hủy đơn] trên 1 đơn đang chờ duyệt.\n2. Xác nhận tại popup -> Đơn chuyển trạng thái Đã hủy ngay lập tức.\nAPI Steps:\n1. Gọi cancel request -> Status chuyển CANCELLED, verify Quản lý không còn thấy đơn này.",
        "Ready for Test & Verify", "Frontend Dev", "Không cho phép hủy các đơn đã được duyệt hoặc đã bị từ chối."
    ),
    (
        "Chấm Công & Đơn Từ", "[S13]", "ATT-REQ-08", "P0",
        "Màn Hình Phê Duyệt Đơn Từ Nhóm Dành Cho Quản Lý (Approvals)",
        "Cung cấp dashboard phê duyệt tập trung cho Quản lý với đầy đủ thông tin: Lý do, file minh chứng, số dư phép còn lại và lịch làm việc của các thành viên khác trong cùng ngày.",
        "Input: Request GET /api/v1/attendance/approvals?status=PENDING.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Truy vấn các đơn từ của nhân viên trực thuộc phòng ban/nhóm. 2. Đính kèm thông tin trực quan: 'Trong ngày 20/11 đã có 2 người khác xin nghỉ'. 3. Hỗ trợ thao tác Duyệt đơn lẻ, Từ chối kèm lý do, hoặc Duyệt hàng loạt.\n"
        "Output: HTTP 200 OK kèm danh sách chi tiết các đơn cần phê duyệt.\n"
        "Kết quả cuối cùng: Quản lý ra quyết định phê duyệt chính xác dựa trên bức tranh nhân sự toàn diện.",
        "GET /api/v1/attendance/approvals",
        "UI Steps:\n1. Mở menu Duyệt đơn từ (/attendance/approvals).\n2. Xem đơn của nhân viên -> Thấy cảnh báo: 'Ngày này phòng bạn đã có 1 người xin WFH'.\n3. Bấm [Phê duyệt] -> Đơn chuyển trạng thái Đã duyệt và gửi email cho nhân viên.\nAPI Steps:\n1. Gọi GET /api/v1/attendance/approvals -> Trả về danh sách đơn kèm conflict_warnings.",
        "Ready for Test & Verify", "Fullstack Dev", "Tích hợp tính năng C14 cảnh báo xung đột lịch nghỉ trong team."
    ),

    # 3. Lịch Công & Sổ Cái Biến Động Phép (Leave Ledger)
    (
        "Chấm Công & Đơn Từ", "[S10]", "ATT-CAL-01", "P0",
        "Lưới Lịch Công Cá Nhân 5 Màu Trạng Thái Trực Quan (Personal Calendar)",
        "Hiển thị toàn bộ dữ liệu ngày công trong tháng dưới dạng lưới lịch 7x5 với mã màu trực quan giúp nhân viên nắm bắt nhanh hiện trạng công nhật.",
        "Input: Tháng/Năm cần xem (ví dụ: month=11, year=2026); User ID đăng nhập.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Truy vấn bảng 'daily_timesheets' trong tháng. 2. Gán mã màu tương ứng cho từng ô ngày: Xanh lá (Đủ công 1.00), Vàng (Đi muộn/về sớm), Đỏ (Vắng mặt/thiếu công), Tím (WFH), Xám (Ngày lễ/nghỉ tuần). 3. Nhấp vào ngày bất kỳ mở Drawer dòng thời gian chi tiết (Timeline in/out).\n"
        "Output: Lịch tháng trực quan, có chú thích màu sắc rõ ràng ở góc dưới.\n"
        "Kết quả cuối cùng: Nhân viên tự đối soát ngày công của mình mỗi ngày, kịp thời phát hiện ngày quên quét công.",
        "GET /api/v1/attendance/calendar?month=11&year=2026",
        "UI Steps:\n1. Mở menu Lịch công (/attendance/calendar).\n2. Thấy ngày hôm qua có màu xanh lá cây đậm (đủ 1.0 công).\n3. Bấm vào ngày 12/11 có màu vàng -> Panel bên phải mở ra hiển thị: 'Vào: 08:42 (Muộn 12 phút)'.\nAPI Steps:\n1. Gọi GET calendar trả về mảng 30 ngày có kèm statusColor và punchDetails.",
        "Ready for Test & Verify", "Frontend Dev", "Đặc tả tính năng C2 Tooltip hiển thị giờ vào/ra khi hover chuột."
    ),
    (
        "Chấm Công & Đơn Từ", "[S11]", "ATT-CAL-02", "P0",
        "Bảng Kê Công Cá Nhân Chi Tiết Lũy Kế Từng Ngày (My Timesheet)",
        "Bảng kê chi tiết dạng dòng cho nhân viên xem toàn bộ các thông số: Giờ vào, Giờ ra, Số giờ làm thực tế, Giờ OT 150%, Công hưởng và Quota đi muộn.",
        "Input: Kỳ công tháng/năm của nhân viên hiện tại.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Tổng hợp toàn bộ các dòng nhật ký công của tháng. 2. Tính toán các chỉ số lũy kế đầu bảng: Tổng ngày công thực tế, Số ngày nghỉ phép hưởng lương, Tổng giờ OT, Số lần đi muộn còn lại.\n"
        "Output: Bảng dữ liệu chi tiết có thanh tổng hợp KPI công ở trên cùng.\n"
        "Kết quả cuối cùng: Minh bạch 100% dữ liệu tính công cá nhân, giảm thiểu tối đa các thắc mắc gửi về phòng HR.",
        "GET /api/v1/attendance/my-timesheet?period=2026-11",
        "UI Steps:\n1. Vào Bảng công của tôi (/attendance/my-timesheet).\n2. Xem các thẻ KPI trên cùng: 'Tổng công: 18.5 / 22 ngày' | 'OT: 4.5 giờ' | 'Đi muộn: 1 lần'.\nAPI Steps:\n1. Gọi GET my-timesheet -> HTTP 200 OK với đầy đủ danh sách ngày và thống kê lũy kế.",
        "Ready for Test & Verify", "Frontend Dev", "Cho phép xuất file PDF bảng công cá nhân để lưu trữ."
    ),
    (
        "Chấm Công & Đơn Từ", "[S14]", "ATT-TEAM-01", "P0",
        "Ma Trận Lịch Trực Quan Cả Đội Ngũ (Team Schedule Matrix)",
        "Cho phép Quản lý và thành viên phòng ban xem ma trận lịch làm việc của toàn bộ đồng nghiệp trong nhóm để phối hợp công việc trơn tru.",
        "Input: Phòng ban của người dùng đăng nhập; Khoảng thời gian tuần/tháng.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Truy vấn toàn bộ nhân viên trong phòng ban. 2. Map trạng thái của từng người trong từng ngày: Văn phòng (Icon tòa nhà), WFH (Icon ngôi nhà), Nghỉ phép (Icon vali/giường), Công tác (Icon máy bay). 3. Đếm tỷ lệ vắng mặt trong ngày: nếu vắng > 40% phòng ban -> Hiển thị cảnh báo màu cam.\n"
        "Output: Ma trận lịch dạng bảng đẹp mắt: dòng là nhân viên, cột là các ngày trong tuần/tháng.\n"
        "Kết quả cuối cùng: Toàn đội nắm bắt rõ ai đang ở đâu để liên hệ công việc, không gọi nhầm người đang nghỉ phép.",
        "GET /api/v1/attendance/team-schedule?deptId=5&week=47",
        "UI Steps:\n1. Vào Lịch trực quan nhóm (/attendance/team-schedule).\n2. Nhìn cột Thứ 6 -> Thấy đồng nghiệp A có nhãn 'WFH', đồng nghiệp B có nhãn 'Nghỉ phép'.\nAPI Steps:\n1. Gọi GET team-schedule -> HTTP 200 OK với ma trận nhân sự phòng ban.",
        "Ready for Test & Verify", "Fullstack Dev", "Hỗ trợ lọc theo từng dự án hoặc phân nhóm chuyên môn."
    ),
    (
        "Chấm Công & Đơn Từ", "[S34]", "ATT-LEAVE-01", "P0",
        "Giao Diện Sổ Cái Biến Động Phép (Leave Ledger) Toàn Diện",
        "Sổ cái kế toán theo dõi toàn bộ các giao dịch tăng/giảm ngày phép của nhân viên theo từng dòng nhật ký có số dư đầu kỳ, biến động và số dư cuối kỳ.",
        "Input: Mã nhân viên và năm tài chính (2026).\n"
        "Xử lý hệ thống & Lưu trữ: 1. Truy vấn bảng 'leave_ledger_entries' (user_id, transaction_date, transaction_type, amount, balance_after, reference_id, note). 2. Phân loại loại giao dịch: MONTHLY_ACCRUAL (+1.0), ROLE_BONUS (+3.0), TENURE_BONUS (+1.0), LEAVE_USED (-X.0), LEAVE_REVERT (+X.0), FORFEITED (-X.0), MANUAL_ADJUST (+/-X.0).\n"
        "Output: Bảng sao kê biến động phép chi tiết giống sổ phụ ngân hàng.\n"
        "Kết quả cuối cùng: Giải quyết triệt để tranh chấp ngày phép giữa HR và nhân viên nhờ lịch sử ghi nhận chi tiết, minh bạch.",
        "GET /api/v1/attendance/leave-ledger/{userId}?year=2026",
        "UI Steps:\n1. Nhân viên vào Số dư phép (/attendance/leaves) hoặc HR vào S34 (/admin/leave-ledger).\n2. Xem bảng sao kê -> Thấy ngày 15 hàng tháng có dòng '+1.0 ngày (Tích lũy định kỳ)', ngày 05/10 có dòng '-1.0 ngày (Đơn nghỉ phép #102)'.\nAPI Steps:\n1. Gọi GET leave-ledger -> Trả về mảng các transaction sắp xếp theo thời gian.",
        "Ready for Test & Verify", "Backend Lead", "Nguyên tắc bất biến (Append-only Ledger): không sửa dòng cũ, chỉ tạo dòng điều chỉnh mới."
    ),
    (
        "Chấm Công & Đơn Từ", "[S34]", "ATT-LEAVE-02", "P0",
        "Tự Động Tích Lũy Phép +1 Ngày Vào Ngày 15 Hàng Tháng (Cronjob)",
        "Bộ lập lịch tự động cộng thêm 1.0 ngày phép năm vào tài khoản của tất cả nhân viên chính thức vào đúng 00:00 ngày 15 hàng tháng.",
        "Input: Cronjob kích hoạt lúc 00:00 ngày 15 hàng tháng `0 0 0 15 * ?`.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Quét toàn bộ nhân viên có status=ACTIVE và đã qua thử việc. 2. Mở Transaction: cập nhật bảng 'leave_balances' set current_balance = current_balance + 1.0. 3. Ghi một bản ghi mới vào 'leave_ledger_entries' loại MONTHLY_ACCRUAL. 4. Bắn thông báo chúc mừng vào hòm thư nhân viên.\n"
        "Output: Log hệ thống ghi nhận số lượng tài khoản được cộng phép thành công.\n"
        "Kết quả cuối cùng: Ngày phép được tích lũy đều đặn, chính xác, không cần HR thực hiện thủ công mỗi tháng.",
        "POST /api/v1/cron/monthly-leave-accrual",
        "UI Steps:\n1. Kiểm tra số dư phép vào ngày 14 (ví dụ: 5.0 ngày) -> Sang ngày 15 kiểm tra lại thấy số dư tự động tăng lên 6.0 ngày.\nAPI Steps:\n1. Gọi API trigger cronjob test -> Verify số dư tăng 1.0 và có log sổ cái.",
        "Ready for Test & Verify", "Backend Dev", "Không cộng phép cho nhân viên đang tạm hoãn hợp đồng lao động."
    ),
    (
        "Chấm Công & Đơn Từ", "[S34]", "ATT-LEAVE-03", "P0",
        "Cộng Phép Chức Vụ (+3 Ngày) & Phép Thâm Niên (+1 Ngày / 2 Năm)",
        "Tự động tính toán các chế độ đãi ngộ bổ sung về ngày nghỉ phép: +3 ngày phép cho cấp quản lý và +1 ngày phép cho mỗi 2 năm làm việc liên tục tại ACT.",
        "Input: Ngày vào làm (hireDate) và Cấp bậc chức danh của nhân viên.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Vào ngày 01/01 hàng năm, kiểm tra nếu role in ('MANAGER', 'HR_ADMIN') hoặc level >= L4 -> Tự động cộng 3.0 ngày phép chức vụ. 2. Tính số năm thâm niên: `years = (currentYear - hireYear)`. Mỗi 2 năm thâm niên cộng thêm 1.0 ngày phép thâm niên vào quỹ phép năm. 3. Ghi log sổ cái rõ ràng.\n"
        "Output: Tổng số ngày phép được hưởng trong năm phản ánh đúng thâm niên và đóng góp của nhân viên.\n"
        "Kết quả cuối cùng: Chính sách đãi ngộ nhân sự được thực thi chuẩn xác, tự động hóa 100%.",
        "POST /api/v1/cron/yearly-seniority-accrual",
        "UI Steps:\n1. Nhân viên có thâm niên 4 năm vào xem quỹ phép năm -> Thấy tổng phép năm là 14 ngày (12 ngày chuẩn + 2 ngày thâm niên).\nAPI Steps:\n1. Gọi API tính thâm niên -> Trả về calculatedSeniorityDays=2.0.",
        "Ready for Test & Verify", "Backend Lead", "Cấu hình số năm thâm niên qua Rule Engine SENIORITY_YEARS_PER_DAY."
    ),
    (
        "Chấm Công & Đơn Từ", "[S34]", "ATT-LEAVE-04", "P0",
        "Thực Thi Quy Tắc Dọn Phép Tồn Năm Cũ Đợt 1 (01/04) & Đợt 2 (01/07)",
        "Tự động rà soát và hủy bỏ số ngày phép tồn đọng từ năm trước chưa sử dụng hết theo 2 mốc thời gian quy định của công ty.",
        "Input: Cronjob chạy lúc 00:00 ngày 01/04 (Đợt 1) và ngày 01/07 (Đợt 2).\n"
        "Xử lý hệ thống & Lưu trữ: 1. Đợt 1 (01/04): Quét toàn bộ khối văn phòng thông thường, nếu còn carried_over_balance từ năm cũ -> Đưa về 0 và ghi log FORFEITED_EXPIRED. 2. Đợt 2 (01/07): Quét khối dự án/đặc thù (được gia hạn đến 30/06), hủy toàn bộ phép cũ còn lại. 3. Gửi email thông báo cho nhân viên trước 15 ngày để nhắc nhở sử dụng phép.\n"
        "Output: Bảng leave_balances cập nhật carried_over_balance = 0; Sổ cái ghi nhận số ngày phép hết hạn.\n"
        "Kết quả cuối cùng: Tuân thủ quy định quản trị tài chính doanh nghiệp, tránh việc dồn tích lũy phép quá nhiều năm.",
        "POST /api/v1/cron/cleanup-expired-leaves",
        "UI Steps:\n1. Trước ngày 01/04, nhân viên nhận email: 'Bạn còn 2.0 ngày phép năm cũ hết hạn vào 31/03'.\n2. Ngày 01/04 mở app -> Thấy cột phép tồn năm cũ về 0.\nAPI Steps:\n1. Gọi API trigger cleanup -> Verify carried_over_balance=0 và có bản ghi FORFEITED.",
        "Ready for Test & Verify", "Backend Lead", "Cấu hình 2 mốc dọn phép tồn linh hoạt qua Rule Engine S18."
    ),
    (
        "Chấm Công & Đơn Từ", "[S34]", "ATT-LEAVE-05", "P0",
        "HR Admin Điều Chỉnh Số Dư Phép Thủ Công Kèm Mã Phiếu Điều Chỉnh",
        "Cung cấp quyền hạn cho HR Admin điều chỉnh tăng hoặc giảm ngày phép của nhân viên trong các trường hợp đặc biệt kèm bắt buộc ghi nhận lý do và mã phiếu quyết định.",
        "Input: Request POST /api/v1/admin/leave-adjust: userId, adjustAmount (+/- ngày), reason, decisionCode (Số quyết định của Ban Giám Đốc).\n"
        "Xử lý hệ thống & Lưu trữ: 1. Validate bắt buộc nhập lý do và mã quyết định. 2. Cập nhật bảng 'leave_balances'. 3. Ghi vào bảng 'leave_ledger_entries' loại MANUAL_ADJUST kèm thông tin Admin thực hiện. 4. Bắn email thông báo biến động phép cho nhân viên.\n"
        "Output: HTTP 200 OK; UI S34 cập nhật số dư mới tức thì kèm dòng nhật ký điều chỉnh màu xanh/đỏ.\n"
        "Kết quả cuối cùng: Đáp ứng linh hoạt các quyết định nhân sự đột xuất của Ban Giám Đốc mà vẫn bảo đảm tính minh bạch kiểm toán.",
        "POST /api/v1/admin/leave-adjust",
        "UI Steps:\n1. HR Admin vào S34, chọn nhân viên C -> Bấm [Điều chỉnh số dư].\n2. Nhập: Cộng +2 ngày, Lý do: 'Thưởng chiến dịch dự án Golive', Số QĐ: 'QĐ-2026/08' -> Bấm [Lưu].\n3. Verify: Số dư tăng ngay 2 ngày và xuất hiện trong sổ cái.\nAPI Steps:\n1. Gửi POST leave-adjust -> HTTP 200 OK, audit log ghi nhận đầy đủ.",
        "Ready for Test & Verify", "Fullstack Dev", "Chỉ tài khoản HR_ADMIN hoặc ADMIN mới có quyền truy cập endpoint này."
    ),

    # 4. Lưới Bảng Công 45 Cột Chuẩn Mẫu Excel ACT & Chốt Lương
    (
        "Chấm Công & Đơn Từ", "[S30]", "ATT-GRID-01", "P0",
        "Lưới Bảng Công Tổng Hợp 45 Cột Chuẩn Mẫu Excel Kế Toán ACT",
        "Tái hiện 100% cấu trúc bảng công Excel thực tế của phòng Kế toán & HR ACT với 45 cột chuẩn hóa phục vụ chốt kỳ công tính lương toàn công ty.",
        "Input: Kỳ công tháng/năm (ví dụ: month=11, year=2026); Department ID (tất cả hoặc theo phòng ban).\n"
        "Xử lý hệ thống & Lưu trữ: 1. Core Service tổng hợp toàn bộ dữ liệu quét công và đơn từ của tất cả nhân viên trong tháng. 2. Build lưới dữ liệu 45 cột: Cột 1-6 (Định danh nhân viên), Cột 7-37 (31 ngày công từ ngày 01 đến 31), Cột 38-45 (Tổng công chuẩn, Công thực tế, Nghỉ phép AL, Nghỉ ốm SL, OT 150%, OT 200%, OT 300%, Phạt muộn). 3. Virtual Scrolling hiển thị mượt mà hàng ngàn nhân viên không bị đơ giật.\n"
        "Output: Bảng dữ liệu khổng lồ 45 cột render mượt mà, hỗ trợ cuộn ngang và cuộn dọc đồng thời.\n"
        "Kết quả cuối cùng: HR quản lý dữ liệu tập trung trên một màn hình duy nhất, xóa bỏ hoàn toàn việc ghép nối các file Excel rời rạc.",
        "GET /api/v1/attendance/timesheet-grid?period=2026-11",
        "UI Steps:\n1. Đăng nhập quyền HR, vào menu Bảng công tổng hợp (/attendance/timesheet).\n2. Verify: Lưới 45 cột hiển thị chuẩn xác từng ngày công từ 01 đến 31 và các cột tổng hợp cuối bảng.\nAPI Steps:\n1. Gọi GET timesheet-grid -> HTTP 200 OK với ma trận dữ liệu 45 cột.",
        "Ready for Test & Verify", "Frontend Lead", "Áp dụng công nghệ React Virtualized / TanStack Table tối ưu render DOM."
    ),
    (
        "Chấm Công & Đơn Từ", "[S30]", "ATT-GRID-02", "P0",
        "Cố Định Cột Định Danh (Freeze Panes STT, Mã NV, Họ Tên, Phòng Ban)",
        "Ghim cố định 4 cột định danh nhân sự bên trái khi cuộn ngang lưới 45 cột sang các ngày cuối tháng giúp HR không bị nhầm lẫn dòng dữ liệu.",
        "Input: Thao tác cuộn ngang (Horizontal scroll) trên bảng công 45 cột.\n"
        "Xử lý hệ thống & Lưu trữ: 1. CSS Sticky positioning `sticky left-0`, `sticky left-12`, `sticky left-36`... kèm z-index và shadow ngăn cách. 2. Ghim cố định dòng tiêu đề ngày ở trên cùng (Sticky Header) khi cuộn dọc.\n"
        "Output: 4 cột đầu tiên và dòng header luôn luôn hiển thị cố định trong tầm mắt người dùng.\n"
        "Kết quả cuối cùng: Thao tác đối soát dữ liệu ngày 30, 31 hoặc các cột tổng hợp OT cực kỳ thuận tiện, không cần kéo qua kéo lại.",
        "N/A (CSS Sticky Positioning)",
        "UI Steps:\n1. Kéo thanh cuộn ngang sang tận cột ngày 31 và cột Tổng OT.\n2. Verify: Cột STT, Mã NV, Họ Tên, Phòng Ban vẫn đứng yên cố định ở mép trái màn hình.\nAPI Steps:\n1. Kiểm tra cấu trúc HTML/CSS đảm bảo các class sticky hoạt động ổn định trên mọi trình duyệt.",
        "Ready for Test & Verify", "Frontend Dev", "Đạt tiêu chuẩn trải nghiệm người dùng kế toán chuyên nghiệp."
    ),
    (
        "Chấm Công & Đơn Từ", "[S30]", "ATT-GRID-03", "P0",
        "Hiển Thị Hệ Thống Ký Hiệu Công Chuẩn Quốc Tế & ACT",
        "Render chính xác các ký hiệu công đặc thù theo quy chế nội bộ ACT: 1.00 (Đủ công), 0.50 (Nửa công), AL (Phép năm), SL (Nghỉ ốm), WFH (Làm từ xa), R (Nghỉ tuần), H (Nghỉ lễ), KL (Không lương).",
        "Input: Giá trị công nhật của từng ngày công trong bảng 'daily_timesheets'.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Parser chuyển đổi số liệu và loại vắng mặt thành ký hiệu chuẩn: Công làm đủ hiển thị số '1.00', Làm nửa ngày '0.50', Nghỉ phép năm 'AL', Nghỉ ốm 'SL', Đi làm từ xa 'WFH', Nghỉ Thứ 7/CN 'R', Nghỉ lễ 'H'. 2. Tô màu visual nền nhẹ cho từng loại ký hiệu để dễ phân biệt.\n"
        "Output: Các ô công hiển thị ký hiệu to rõ, màu sắc hài hòa, chuẩn xác 100% so với mẫu Excel truyền thống.\n"
        "Kết quả cuối cùng: Nhân viên và kế toán nhìn vào hiểu ngay bản chất ngày công mà không cần tài liệu giải thích.",
        "GET /api/v1/attendance/symbols-catalog",
        "UI Steps:\n1. Nhìn vào lưới bảng công -> Thấy Thứ 7/CN hiển thị chữ 'R' màu xám, ngày thường đủ công hiện '1.00' màu xanh lá, ngày nghỉ phép hiện 'AL' màu xanh dương.\nAPI Steps:\n1. Kiểm tra API trả về trường attendanceSymbol đúng với quy định.",
        "Ready for Test & Verify", "Frontend Dev", "Catalog 12 ký hiệu công chuẩn cấu hình tại Rule Engine."
    ),
    (
        "Chấm Công & Đơn Từ", "[S32]", "ATT-GRID-04", "P0",
        "Tính Năng Sửa Ô Trực Tiếp (In-Place Editing) Kèm Bắt Buộc Nhập Lý Do",
        "Cho phép HR nhấp đúp (Double-click) vào bất kỳ ô công nào trên lưới để điều chỉnh nhanh giá trị công kèm yêu cầu bắt buộc giải trình lý do sửa (C4).",
        "Input: Thao tác Double-click vào ô ngày công; Form popup chọn ký hiệu mới (ví dụ đổi từ '0.50' thành '1.00') và nhập lý do điều chỉnh.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Validate người sửa có quyền HR_ADMIN. 2. Validate không được bỏ trống lý do sửa. 3. Cập nhật bảng 'daily_timesheets'. 4. Lưu vết vào bảng 'timesheet_cell_audit_logs' (timesheet_id, cell_date, old_value, new_value, modified_by, reason, modified_at). 5. Tự động tính toán lại các cột tổng hợp công cuối bảng.\n"
        "Output: HTTP 200 OK; Ô công hiển thị giá trị mới kèm tam giác nhỏ màu đỏ ở góc trên bên phải; UI Toast xanh.\n"
        "Kết quả cuối cùng: Sửa lỗi chấm công tức thời trong 2 giây mà không cần qua nhiều màn hình trung gian, bảo đảm truy vết 100%.",
        "PUT /api/v1/attendance/timesheet/cell",
        "UI Steps:\n1. Double click vào ô công ngày 15/11 của nhân viên A (đang là 0.50).\n2. Popup nhỏ mở ra -> Chọn thành '1.00', Nhập lý do: 'Sếp xác nhận đi công tác ngoài' -> Bấm [Lưu].\n3. Verify: Ô đổi thành 1.00 có góc tam giác đỏ. Cột tổng công tự tăng thêm 0.5.\nAPI Steps:\n1. Gửi PUT cell edit -> HTTP 200 OK, audit log ghi nhận đầy đủ.",
        "Ready for Test & Verify", "Fullstack Dev", "Tự động kích hoạt recalculate toàn bộ các công thức tính lương liên quan."
    ),
    (
        "Chấm Công & Đơn Từ", "[S32]", "ATT-GRID-05", "P0",
        "Đánh Dấu Tam Giác Đỏ & Tooltip Xem Lịch Sử Sửa Ô Công (Cell Audit History)",
        "Đánh dấu nhận diện các ô công đã từng bị can thiệp thủ công và hiển thị toàn bộ lịch sử ai đã sửa, vào lúc nào, giá trị cũ là gì khi rê chuột vào ô.",
        "Input: Thao tác rê chuột (Hover) vào ô công có dấu tam giác đỏ.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Frontend kiểm tra cờ is_manually_edited = true. 2. Gọi API hoặc lấy dữ liệu audit history từ cache. 3. Render Tooltip nổi bật hiển thị: 'Lịch sử sửa ô: 18/11/2026 14:30 bởi HR Sang: 0.50 -> 1.00 (Lý do: Đi công tác)'.\n"
        "Output: Tooltip hiển thị rõ ràng, biến mất khi đưa chuột ra ngoài.\n"
        "Kết quả cuối cùng: Ngăn chặn triệt để hành vi tự ý sửa công khuất tất, phục vụ kiểm toán nội bộ bất kỳ lúc nào.",
        "GET /api/v1/attendance/timesheet/cell/history?cellId=123",
        "UI Steps:\n1. Rê chuột vào ô có tam giác đỏ trên bảng công.\n2. Verify: Tooltip hiện lên chi tiết người sửa, thời gian và lý do thay đổi.\nAPI Steps:\n1. Gọi GET cell history -> Trả về mảng các lần chỉnh sửa của ô công.",
        "Ready for Test & Verify", "Frontend Dev", "Đảm bảo tính trung thực và minh bạch tuyệt đối của dữ liệu chấm công."
    ),
    (
        "Chấm Công & Đơn Từ", "[S33]", "ATT-DISPUTE-01", "P0",
        "Công Bố Bảng Công Nháp & Quy Trình Khiếu Nại Công 2 Ngày Làm Việc",
        "Quy trình công bố bảng công dự thảo cho toàn thể nhân viên kiểm tra và tiếp nhận khiếu nại đối soát trong vòng 2 ngày làm việc trước khi chốt bảng lương chính thức.",
        "Input: HR bấm nút [Công bố bảng công nháp]; Nhân viên tạo khiếu nại (Dispute Ticket) kèm mô tả thắc mắc ngày công.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Cập nhật trạng thái kỳ công sang 'DRAFT_PUBLISHED'. 2. Bắn email thông báo cho toàn bộ nhân sự kèm thời hạn khiếu nại (48 giờ làm việc). 3. Đếm ngược thời gian khiếu nại trên giao diện S33. 4. HR tiếp nhận khiếu nại, đối soát lại và phản hồi chấp nhận hoặc từ chối giải trình.\n"
        "Output: HTTP 200 OK; Màn hình S33 hiển thị danh sách các phiếu khiếu nại cần giải quyết; Khiếu nại được duyệt sẽ tự động cập nhật lại ô công.\n"
        "Kết quả cuối cùng: Nhân viên có tiếng nói bảo vệ quyền lợi chính đáng của mình; hạn chế tối đa sai sót trước ngày phát lương.",
        "POST /api/v1/attendance/disputes",
        "UI Steps:\n1. Nhân viên thấy ngày 10/11 bị tính thiếu công -> Bấm nút [Khiếu nại ngày này] ngay tại bảng công cá nhân S11.\n2. Nhập nội dung khiếu nại -> Gửi đi.\n3. HR vào S33 thấy phiếu khiếu nại -> Bấm [Chấp thuận khiếu nại] -> Ô công tự đổi thành 1.00.\nAPI Steps:\n1. Gửi POST dispute -> Trạng thái PENDING, HR giải quyết qua PUT dispute.",
        "Ready for Test & Verify", "Fullstack Dev", "Quy trình đối soát chuẩn hóa theo chính sách nhân sự công ty."
    ),
    (
        "Chấm Công & Đơn Từ", "[S33]", "ATT-LOCK-01", "P0",
        "Khóa Kỳ Công Chính Thức (Official Payroll Lock) Bất Khả Biến",
        "Chốt khóa toàn bộ dữ liệu bảng công sau khi đã giải quyết hết khiếu nại, vô hiệu hóa hoàn toàn mọi quyền sửa chữa nhằm bảo đảm tính toàn vẹn dữ liệu kế toán.",
        "Input: HR Admin bấm nút [Khóa kỳ công chính thức] cho tháng 11/2026; Nhập mật khẩu xác nhận của Admin.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Kiểm tra tất cả các phiếu khiếu nại trong kỳ đã được giải quyết (không còn phiếu PENDING). 2. Cập nhật bảng 'payroll_periods' set status = 'LOCKED', locked_by = currentUserId, locked_at = NOW(). 3. Vô hiệu hóa toàn bộ API chỉnh sửa ô công hoặc tạo đơn trong kỳ này. 4. Sinh mã checksum SHA-256 bảo vệ toàn vẹn dữ liệu kỳ công.\n"
        "Output: HTTP 200 OK; Biểu tượng ổ khóa màu vàng bật sáng trên bảng công; Toàn bộ các ô chuyển sang chế độ Read-Only.\n"
        "Kết quả cuối cùng: Dữ liệu công nhật được đóng băng an toàn tuyệt đối, sẵn sàng chuyển giao cho phòng Tài chính - Kế toán chi trả lương.",
        "POST /api/v1/attendance/timesheet/lock",
        "UI Steps:\n1. Tại S33, bấm [Khóa kỳ công].\n2. Nhập mật khẩu xác nhận tại modal bảo mật -> Bấm [Xác nhận khóa].\n3. Verify: Bảng công chuyển sang trạng thái Đã khóa. Thử double-click vào ô công -> Báo lỗi 'Kỳ công đã bị khóa, không thể chỉnh sửa'.\nAPI Steps:\n1. Gọi POST lock timesheet -> Status LOCKED. Thử gọi API sửa ô -> HTTP 403 PERIOD_LOCKED.",
        "Ready for Test & Verify", "Backend Lead", "Chỉ có Ban Giám Đốc mới có thẩm quyền mở khóa lại kỳ công kèm quy trình đặc biệt."
    ),
    (
        "Chấm Công & Đơn Từ", "[S33]", "ATT-EXPORT-01", "P0",
        "Xuất Báo Cáo Bảng Lương Ra File Excel (.xlsx) Chuẩn Mẫu 100% ACT",
        "Kết xuất toàn bộ dữ liệu bảng công 45 cột ra tệp Excel định dạng chuẩn xác từng dòng tiêu đề, công thức tính toán và ô định dạng phục vụ nhập liệu phần mềm kế toán.",
        "Input: Request GET /api/v1/attendance/timesheet/export-excel?period=2026-11; Tùy chọn lọc theo phòng ban.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Core Service truy vấn dữ liệu kỳ công đã khóa. 2. Dùng thư viện Apache POI sinh file Excel chuẩn: Gồm Logo thương hiệu ACT, dòng tiêu đề 'BẢNG CHẤM CÔNG THÁNG 11/2026', 45 cột dữ liệu đầy đủ. 3. Định dạng màu sắc, đường kẻ bảng, căn giữa ký hiệu công và nhúng công thức tính tổng `SUM(G5:AK5)` tự động.\n"
        "Output: Tải về file Excel 'Bang_Cham_Cong_ACT_Thang_11_2026.xlsx' mở trên Microsoft Excel chuẩn 100% không bị vỡ layout.\n"
        "Kết quả cuối cùng: Phòng Kế toán tiếp nhận file Excel sẵn sàng tính lương trong 1 cú click chuột, tiết kiệm 95% thời gian tổng hợp thủ công.",
        "GET /api/v1/attendance/timesheet/export-excel",
        "UI Steps:\n1. Bấm nút [Xuất Excel] ở góc phải bảng công.\n2. Verify: File tải về máy, mở lên thấy đúng 45 cột, các công thức SUM hoạt động chuẩn xác.\nAPI Steps:\n1. Gọi GET export-excel -> HTTP 200 OK với Content-Type application/vnd.openxmlformats.",
        "Ready for Test & Verify", "Backend Dev", "Hiệu năng xuất file < 3 giây cho 1,000 cán bộ nhân viên."
    )
]

print(f"Total Attendance features: {len(attendance_rows)}")
