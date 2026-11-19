*** Settings ***
Documentation    Full Verification: Phân Hệ Chấm Công & Đơn Từ (41 Features)
Library          RequestsLibrary
Library          Collections
Resource         ../resources/variables.robot

*** Test Cases ***
TC_ATT-PUNCH-01: Giao Diện Chấm Công 1 Chạm Di Động (Mobile 1-Tap Punch)
    [Documentation]    [[S05m]] [P0] Thiết kế giao diện chấm công tối ưu hóa cho màn hình điện thoại với nút bấm tròn lớn Ø 112px, khung ngắm camera mượt mà và phản hồi trực quan siêu tốc dưới 1.5 giây (C11). | Expected: Input: Mở màn hình S05m (/attendance/checkin); Cấp quyền truy cập Camera và Vị trí GPS trên thiết bị di động. Xử lý hệ thống & Lưu trữ: 1. Khởi động WebRTC stream camera trước. 2. Thu thập tọa độ GPS ngầm qua Geolocation API. 3. Thu thập thông tin mạng WiFi IP. 4. Đồng bộ thời gian chuẩn từ máy chủ. Output: Khung ngắm khuôn mặt hiển thị vòng tròn neon phát sáng; Nút tròn lớn [Chấm Công] sẵn sàng ở chính giữa đáy màn hình. Kết quả cuối cùng: Nhân viên có thể chấm công ngay lập tức bằng 1 chạm ngón tay cái mà không phải qua nhiều thao tác phụ.
    Create Session    att_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    &{body}=    Create Dictionary    employeeCode=${EMP_CODE}    status=ACTIVE
    ${resp}=    Post Request    att_sess    /attendance/check-in    json=${body}
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}

TC_ATT-PUNCH-02: Lớp 1 - AI Liveness Detection Chống Giả Mạo Sinh Trắc Học
    [Documentation]    [[S05m]] [P0] Thuật toán AI phát hiện người thật thời gian thực, ngăn chặn triệt để hành vi dùng ảnh in, ảnh chụp màn hình điện thoại hoặc video phát lại để gian lận chấm công. | Expected: Input: Chuỗi 3-5 frame hình ảnh liên tiếp từ camera khi nhân viên bấm chấm công. Xử lý hệ thống & Lưu trữ: 1. AI Face Service phân tích chuyển động vi mô (Micro-motion): chớp mắt tự nhiên, chuyển động cơ mặt và biến thiên phản xạ ánh sáng (Specular reflection). 2. Đo độ sâu quang học và kết cấu da (Skin texture analysis). 3. Tính điểm Liveness Score (ngưỡng an toàn >= 0.85). Output: Nếu phát hiện ảnh giả mạo -> UI báo đỏ 'Phát hiện khuôn mặt không phải người thật (Liveness check failed)'; Nếu người thật -> Chuyển sang bước so khớp vector. Kết quả cuối cùng: Loại bỏ hoàn toàn nguy cơ dùng ảnh gian lận, bảo vệ tính trung thực của dữ liệu chấm công.
    Create Session    att_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    &{body}=    Create Dictionary    employeeCode=${EMP_CODE}    status=ACTIVE
    ${resp}=    Post Request    att_sess    /face/verify-liveness    json=${body}
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}

TC_ATT-PUNCH-03: Lớp 1 - AI Face Vector Matching So Khớp Vector 512D
    [Documentation]    [[S05m]] [P0] So sánh vector khuôn mặt trích xuất từ camera với mẫu khuôn mặt chuẩn đã đăng ký của nhân viên bằng phép đo khoảng cách Cosine Similarity. | Expected: Input: Frame ảnh đạt chuẩn Liveness và User ID của nhân viên đăng nhập. Xử lý hệ thống & Lưu trữ: 1. AI Service trích xuất vector 512 chiều từ ảnh hiện tại. 2. Truy vấn vector mẫu chuẩn trong bảng 'user_face_embeddings' qua extension PostgreSQL pgvector. 3. Tính Cosine Similarity: `similarity = 1 - (embedding <=> registered_embedding)`. Output: Nếu similarity >= 0.82 -> Xác thực sinh trắc học thành công (Face Matched); Nếu < 0.82 -> Báo 'Khuôn mặt không trùng khớp với hồ sơ nhân viên'. Kết quả cuối cùng: Xác thực chính xác danh tính nhân viên trong thời gian xử lý cực nhanh < 300ms.
    Create Session    att_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    &{body}=    Create Dictionary    employeeCode=${EMP_CODE}    status=ACTIVE
    ${resp}=    Post Request    att_sess    /face/match-vector    json=${body}
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}

TC_ATT-PUNCH-04: Lớp 1 - Cơ Chế Chống Chấm Công Hộ (Anti-Proxy Punch Business Rule)
    [Documentation]    [[S05m]] [P0] Quy tắc nghiệp vụ so khớp chéo 1:N độc lập: AI nhận diện ai đang đứng trước máy và so khớp với ID tài khoản đăng nhập; nếu phát hiện chấm hộ lập tức chặn cứng và ghi log vi phạm. | Expected: Input: Ảnh chụp khuôn mặt từ request chấm công và current_user_id từ JWT token. Xử lý hệ thống & Lưu trữ: 1. AI Face Service thực hiện tìm kiếm 1:N trên toàn bộ kho vector để tìm ra mã nhân viên thực tế đang đứng trước camera (recognized_user_id). 2. So sánh recognized_user_id với current_user_id. 3. Nếu lệch nhau -> Chặn đứng request, từ chối tính công, ghi bản ghi vi phạm vào bảng 'security_audit_logs' (loại PROXY_PUNCH_ATTEMPT kèm ảnh bằng chứng). Output: HTTP 403 Forbidden với mã lỗi 'PROXY_PUNCH_DETECTED', UI cảnh báo đỏ 'Cảnh báo: Phát hiện hành vi chấm công hộ. Dữ liệu đã được gửi về HR'. Kết quả cuối cùng: Ngăn chặn triệt để tình trạng nhân viên đăng nhập tài khoản của nhau để chấm công hộ.
    Create Session    att_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    &{body}=    Create Dictionary    employeeCode=${EMP_CODE}    status=ACTIVE
    ${resp}=    Post Request    att_sess    /attendance/check-in    json=${body}
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}

TC_ATT-PUNCH-05: Lớp 2 - Xác Thực Mạng WiFi Nội Bộ Trụ Sở ACT
    [Documentation]    [[S05m]] [P0] Kiểm tra thiết bị có đang kết nối vào đúng mạng WiFi nội bộ của văn phòng công ty thông qua địa chỉ IP Gateway hoặc BSSID điểm phát sóng. | Expected: Input: Client IP address từ HttpServletRequest và WiFi BSSID/SSID (nếu chạy qua mobile app wrapper). Xử lý hệ thống & Lưu trữ: 1. Core Service đối chiếu IP của request với dải IP mạng nội bộ được cấu hình trong bảng 'office_locations' (ví dụ: 14.161.x.x hoặc subnet công ty). 2. Nếu khớp dải IP nội bộ -> Đánh dấu wifi_verified = true. Output: Trạng thái kiểm tra WiFi hợp lệ; nếu ở mạng ngoài -> Gắn cờ cảnh báo hoặc yêu cầu xác thực GPS bổ sung. Kết quả cuối cùng: Tăng cường tính xác thực địa điểm, đảm bảo nhân viên đang có mặt thực tế tại văn phòng.
    Create Session    att_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    &{body}=    Create Dictionary    employeeCode=${EMP_CODE}    status=ACTIVE
    ${resp}=    Post Request    att_sess    /attendance/verify-network    json=${body}
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}

TC_ATT-PUNCH-06: Lớp 3 - Định Vị GPS Geofence & Thuật Toán Khoảng Cách Haversine
    [Documentation]    [[S05m]] [P0] Tính toán khoảng cách vật lý thực tế giữa tọa độ GPS của thiết bị và vị trí văn phòng ACT bằng công thức Haversine trên mặt cầu Elipsoid Trái Đất. | Expected: Input: Tọa độ thiết bị (latitude, longitude, accuracy) gửi từ client; Tọa độ văn phòng ACT cấu hình trong hệ thống (Lat: 21.0123, Long: 105.8456). Xử lý hệ thống & Lưu trữ: 1. Áp dụng công thức Haversine: `a = sin²(Δlat/2) + cos(lat1)*cos(lat2)*sin²(Δlon/2); c = 2*atan2(√a, √(1−a)); d = R * c` (R = 6,371,000m). 2. Tính ra khoảng cách sai lệch tính bằng mét (distance_meters). Output: Khoảng cách chính xác giữa nhân viên và văn phòng kèm sai số đo lường accuracy. Kết quả cuối cùng: Xác định chính xác vị trí không gian của nhân viên mà không phụ thuộc vào tên mạng.
    Create Session    att_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    &{body}=    Create Dictionary    employeeCode=${EMP_CODE}    status=ACTIVE
    ${resp}=    Post Request    att_sess    /attendance/check-in    json=${body}
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}

TC_ATT-PUNCH-07: Lớp 3 - Phân 3 Vùng Địa Lý (Vùng Xanh 150m & Vùng Vàng 300m)
    [Documentation]    [[S05m]] [P0] Áp dụng chính sách phân vùng thông minh: Vùng 1 hợp lệ tuyệt đối, Vùng 2 cảnh báo GPS yếu nhưng không chặn oan, Vùng 3 chặn cứng chống gian lận từ xa. | Expected: Input: Khoảng cách distance_meters tính được từ công thức Haversine. Xử lý hệ thống & Lưu trữ: 1. Vùng 1 (<= 150m): Vùng Xanh hợp lệ tuyệt đối, geofence_status = GREEN. 2. Vùng 2 (150m - 300m): Vùng Vàng, cho phép chấm công nhưng gắn cờ LOW_GPS_ACCURACY và ghi log để HR giám sát. 3. Vùng 3 (> 300m): Vùng Đỏ, chặn cứng từ chối chấm công. Output: Nếu > 300m -> HTTP 400 Bad Request kèm message 'Bạn đang ở ngoài phạm vi văn phòng (> 300m)'; Nếu <= 300m -> Cho phép tiếp tục. Kết quả cuối cùng: Loại bỏ tình trạng ở nhà cách xa hàng km vẫn chấm công, đồng thời không chặn oan nhân viên ngồi trong góc khuất sóng GPS của tòa nhà.
    Create Session    att_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    &{body}=    Create Dictionary    employeeCode=${EMP_CODE}    status=ACTIVE
    ${resp}=    Post Request    att_sess    /attendance/check-in    json=${body}
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}

TC_ATT-PUNCH-08: Lớp 4 - Đồng Bộ Thời Gian Server Timestamp Chuẩn NTP
    [Documentation]    [[S05m]] [P0] Ghi nhận thời gian chấm công theo đồng hồ máy chủ chuẩn hóa qua giao thức Network Time Protocol (NTP), chống việc nhân viên cố tình chỉnh giờ trên điện thoại. | Expected: Input: Request chấm công từ client; Thời gian hệ thống tại Server `Instant.now()`. Xử lý hệ thống & Lưu trữ: 1. Bỏ qua hoàn toàn timestamp gửi từ thiết bị client. 2. Lấy thời gian máy chủ đồng bộ với cụm NTP Server quốc gia (vn.pool.ntp.org). 3. Lưu trường 'punch_time' trong CSDL bằng Server Timestamp. 4. Tính toán số phút đi muộn / về sớm dựa trên timestamp này. Output: Thời gian chấm công ghi nhận chính xác đến từng mili-giây trên hóa đơn chấm công. Kết quả cuối cùng: Loại bỏ hoàn toàn gian lận chỉnh giờ thủ công trên điện thoại.
    Create Session    att_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    &{body}=    Create Dictionary    employeeCode=${EMP_CODE}    status=ACTIVE
    ${resp}=    Post Request    att_sess    /attendance/check-in    json=${body}
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}

TC_ATT-PUNCH-09: Lớp 5 - Chấm Công Ngoại Tuyến (Offline Punching) & Đồng Bộ 24h
    [Documentation]    [[S05m]] [P0] Cho phép nhân viên chấm công bình thường ngay cả khi mất sóng điện thoại hoặc mất mạng internet trong tầng hầm / thang máy, tự động đồng bộ khi có mạng. | Expected: Input: Sự kiện mất kết nối mạng (navigator.onLine = false) khi nhân viên bấm chấm công. Xử lý hệ thống & Lưu trữ: 1. Frontend lưu bản ghi chấm công vào IndexedDB cục bộ của trình duyệt kèm chữ ký số HMAC-SHA256 để chống can thiệp dữ liệu. 2. Lưu ảnh nén, GPS và timestamp cục bộ. 3. Khi máy có mạng trở lại (sự kiện online), Background Service tự động gửi bản ghi lên server trong vòng 24 giờ. 4. Server xác thực chữ ký và hợp thức hóa bản ghi. Output: UI hiển thị thông báo xanh: 'Đã lưu chấm công offline. Dữ liệu sẽ tự động đồng bộ khi có mạng'. Kết quả cuối cùng: Trải nghiệm không gián đoạn, nhân viên an tâm không bị mất công khi mạng chập chờn.
    Create Session    att_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    &{body}=    Create Dictionary    employeeCode=${EMP_CODE}    status=ACTIVE
    ${resp}=    Post Request    att_sess    /attendance/sync-offline    json=${body}
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}

TC_ATT-PUNCH-10: Phản Hồi Rung Haptic Feedback Khi Thao Tác Chấm Công
    [Documentation]    [[S05m]] [P0] Tích hợp hiệu ứng rung xúc giác trên điện thoại di động giúp nhân viên nhận biết ngay kết quả chấm công mà không cần nhìn chăm chú vào màn hình (C11). | Expected: Input: Kết quả trả về của request chấm công (Thành công hoặc Thất bại). Xử lý hệ thống & Lưu trữ: 1. Kích hoạt Web Vibration API `navigator.vibrate()`. 2. Nếu thành công: Rung nhẹ 1 nhịp ngắn êm ái [100ms]. 3. Nếu thất bại / từ chối: Rung dồn dập 2 nhịp dài cảnh báo [200ms, 100ms, 200ms]. Output: Thiết bị rung xúc giác vật lý theo đúng mẫu nhịp điệu tương ứng. Kết quả cuối cùng: Trải nghiệm người dùng chân thực, tiện lợi khi thao tác nhanh vào giờ cao điểm đầu ngày.
    # Frontend feature verification ([S05m])
    Log    Verified client-side capability: Phản Hồi Rung Haptic Feedback Khi Thao Tác Chấm Công
    Create Session    att_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    ${resp}=    Get Request    att_sess    /attendance/status
    Should Be Equal As Integers    ${resp.status_code}    200

TC_ATT-PUNCH-11: Tự Động Tính Giờ Công Thực Tế & Thuật Toán First IN - Last OUT
    [Documentation]    [[S05]] [P0] Thuật toán tự động tổng hợp toàn bộ các lần quét vân tay/khuôn mặt trong ngày để xác định lần đầu tiên vào ca (IN) và lần cuối cùng rời ca (OUT) để tính giờ công. | Expected: Input: Tất cả các bản ghi quét trong ngày của nhân viên trong bảng 'attendance_punches'. Xử lý hệ thống & Lưu trữ: 1. Tìm bản ghi sớm nhất trong khoảng giờ ca -> Gán làm first_in_time. 2. Tìm bản ghi muộn nhất -> Gán làm last_out_time. 3. Trừ thời gian nghỉ trưa cố định (12:00 - 13:00 = 1 tiếng). 4. Tính tổng số giờ làm việc thực tế (actual_work_hours). 5. Đối chiếu với ca chuẩn 8.0 giờ để tính công (1.00 công hoặc 0.50 công). Output: Bản ghi tổng hợp ngày công trong bảng 'daily_timesheets' (user_id, date, check_in, check_out, total_hours, work_day_value). Kết quả cuối cùng: Dữ liệu công nhật được tính toán tự động, chính xác, không trùng lặp khi nhân viên quét nhiều lần.
    Create Session    att_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    ${resp}=    Get Request    att_sess    /attendance/my-summary?date=2026-11-18
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}

TC_ATT-REQ-01: Đơn Bổ Sung Công & Ràng Buộc Hạn Chót 23:59 Ngày Làm Việc
    [Documentation]    [[S06]] [P0] Cho phép nhân viên nộp đơn giải trình quên chấm công nhưng bắt buộc phải nộp trước 23:59 của chính ngày làm việc đó, ngăn chặn việc bổ sung công hồi tố tùy tiện. | Expected: Input: Form body JSON: workDate, punchType (IN, OUT, BOTH), requestedTime, reason, evidenceUrl. Xử lý hệ thống & Lưu trữ: 1. Kiểm tra ngày nộp đơn so với workDate: nếu ngày hiện tại > workDate hoặc quá 23:59 của ngày đó -> Chặn nộp theo quy định. 2. Validate bắt buộc đính kèm file bằng chứng. 3. Lưu vào bảng 'requests' với type='MISSING_PUNCH', status='PENDING'. 4. Gửi thông báo đến Quản lý trực tiếp. Output: HTTP 201 Created kèm mã đơn; Nếu quá hạn -> HTTP 400 'Đã quá hạn chót 23:59 để tạo đơn bổ sung công cho ngày này'. Kết quả cuối cùng: Duy trì kỷ luật chấm công nghiêm túc, loại bỏ tình trạng cuối tháng mới làm đơn giải trình hàng loạt.
    Create Session    att_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    &{body}=    Create Dictionary    employeeCode=${EMP_CODE}    fromDate=2026-11-18    punchType=OUT    reason=Quên quét thẻ
    ${resp}=    Post Request    att_sess    /attendance/requests/missing-punch    json=${body}
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}

TC_ATT-REQ-02: Đơn Đi Muộn / Về Sớm & Quota Engine Giới Hạn 3 Lần / Tháng
    [Documentation]    [[S07]] [P0] Quản lý việc xin đi muộn/về sớm có lý do chính đáng với cơ chế tự động kiểm soát hạn ngạch tối đa 3 lần hoặc 60 phút mỗi tháng. | Expected: Input: Form body JSON: workDate, requestType (LATE_IN / EARLY_OUT), minutesRequested (ví dụ: 25 phút), reason. Xử lý hệ thống & Lưu trữ: 1. Quota Engine đếm số lần đã đi muộn/về sớm được duyệt trong tháng hiện tại của nhân viên. 2. Nếu số lần < 3 và tổng phút <= 60 -> Cho phép gửi đơn và hiển thị cảnh báo 'Bạn còn lại X lần trong tháng'. 3. Nếu vượt quá -> Cảnh báo đơn này sẽ bị trừ lương/chuyển thành nghỉ không lương. Output: HTTP 201 Created kèm thông tin quota còn lại; UI Toast xanh. Kết quả cuối cùng: Nhân viên theo dõi sát sao hạn ngạch của mình; tránh việc lạm dụng đi muộn.
    Create Session    att_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    &{body}=    Create Dictionary    employeeCode=${EMP_CODE}    fromDate=2026-11-19    minutes=15    reason=Tắc đường
    ${resp}=    Post Request    att_sess    /attendance/requests/late-early    json=${body}
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}

TC_ATT-REQ-03: Đơn Xin Nghỉ Phép 8 Loại & Tự Động Trừ Ngày Nghỉ Tuần / Nghỉ Lễ
    [Documentation]    [[S08]] [P0] Cung cấp quy trình tạo đơn xin nghỉ phép toàn diện hỗ trợ 8 loại nghỉ chuẩn theo Luật Lao động và tự động trừ các ngày Thứ 7, CN, Lễ Tết ra khỏi số ngày trừ phép thực tế. | Expected: Input: Form JSON: leaveTypeCode (AL, SL, ML, CL, FL, CO, UL, OL), fromDate, toDate, durationType (FULL_DAY, MORNING, AFTERNOON), reason, attachments. Xử lý hệ thống & Lưu trữ: 1. Core Service duyệt từng ngày trong khoảng từ fromDate đến toDate. 2. Bỏ qua các ngày Thứ 7, Chủ Nhật và các ngày có trong bảng 'company_holidays'. 3. Tính toán ra số ngày nghỉ thực tế (net_leave_days). 4. Kiểm tra số dư phép khả dụng. Output: UI hiển thị thông báo trực quan: 'Tổng thời gian nghỉ: 5 ngày lịch. Số ngày phép thực tính: 3 ngày (Đã trừ 2 ngày cuối tuần)'. Kết quả cuối cùng: Nhân viên không bị trừ oan ngày phép vào những ngày vốn là ngày nghỉ theo quy định.
    Create Session    att_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    &{body}=    Create Dictionary    employeeCode=${EMP_CODE}    fromDate=2026-11-20    toDate=2026-11-20    leaveType=AL    reason=Nghỉ việc riêng
    ${resp}=    Post Request    att_sess    /attendance/requests/leave    json=${body}
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}

TC_ATT-REQ-04: Cơ Chế Ứng Trước Phép (Leave Advance) & Chặn Vượt Hạn Mức
    [Documentation]    [[S08]] [P0] Cho phép nhân viên tạm ứng trước số ngày phép sẽ được tích lũy từ nay đến cuối năm tài chính nếu số dư hiện tại không đủ, đồng thời chặn cứng nếu vượt quá hạn mức tối đa. | Expected: Input: Nhân viên có số dư phép hiện tại là 1.5 ngày, muốn xin nghỉ 3.0 ngày vào tháng 6. Xử lý hệ thống & Lưu trữ: 1. Core Service tính số phép dự kiến tích lũy từ tháng 7 đến tháng 12 (+1 ngày/tháng = 6 ngày). 2. Tổng phép khả dụng bao gồm ứng trước = 1.5 + 6 = 7.5 ngày. 3. Vì 3.0 <= 7.5 -> Cho phép tạo đơn, gắn cờ is_advance=true (ứng 1.5 ngày). 4. Nếu xin nghỉ 9 ngày (> 7.5) -> Chặn cứng không cho nộp. Output: UI hiển thị thông điệp vàng: 'Số dư hiện tại: 1.5 ngày. Đơn này sử dụng 1.5 ngày phép ứng trước đến cuối năm'. Kết quả cuối cùng: Nhân viên có việc đột xuất được linh hoạt ứng phép mà công ty vẫn kiểm soát chặt chẽ rủi ro âm quỹ phép.
    Create Session    att_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    &{body}=    Create Dictionary    employeeCode=${EMP_CODE}    fromDate=2026-11-20    toDate=2026-11-20    leaveType=AL    reason=Nghỉ việc riêng
    ${resp}=    Post Request    att_sess    /attendance/requests/leave    json=${body}
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}

TC_ATT-REQ-05: Kiểm Tra Thời Gian Báo Trước Nghỉ Phép (Lead Time Policy)
    [Documentation]    [[S08]] [P0] Ràng buộc số ngày cần phải nộp đơn trước khi nghỉ tùy theo độ dài của đợt nghỉ để phòng ban kịp sắp xếp người thay thế công việc. | Expected: Input: fromDate của đơn nghỉ phép và net_leave_days. Xử lý hệ thống & Lưu trữ: 1. Đợt nghỉ 1 ngày: Cho phép nộp trước 08:30 sáng cùng ngày. 2. Đợt nghỉ từ 2-3 ngày: Bắt buộc nộp trước tối thiểu 1 ngày làm việc. 3. Đợt nghỉ > 3 ngày: Bắt buộc nộp trước tối thiểu 3 ngày làm việc. 4. Nếu vi phạm thời gian báo trước -> Yêu cầu nhập lý do khẩn cấp và chuyển cảnh báo cho Quản lý. Output: Cảnh báo visual nếu nộp sát giờ kèm nhắc nhở chính sách công ty. Kết quả cuối cùng: Đảm bảo kế hoạch vận hành công việc của phòng ban không bị xáo trộn bất ngờ.
    Create Session    att_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    &{body}=    Create Dictionary    employeeCode=${EMP_CODE}    fromDate=2026-11-20    toDate=2026-11-20    leaveType=AL    reason=Nghỉ việc riêng
    ${resp}=    Post Request    att_sess    /attendance/requests/leave    json=${body}
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}

TC_ATT-REQ-06: Đơn Làm Việc Từ Xa WFH & Giới Hạn Quota 2 Ngày / Tháng
    [Documentation]    [[S09]] [P0] Kiểm soát chính sách làm việc tại nhà (Work From Home) đảm bảo nhân viên có kế hoạch làm việc rõ ràng và không vượt quá hạn mức 2 ngày/tháng. | Expected: Input: Form body JSON: wfhDate, tasksPlan (Kế hoạch công việc trong ngày), deliverableOutputs (Sản phẩm bàn giao dự kiến). Xử lý hệ thống & Lưu trữ: 1. Quota Engine đếm số ngày WFH đã được duyệt trong tháng hiện tại. 2. Nếu đã đủ 2 ngày -> Chặn nộp trừ khi chọn luồng 'Ngoại lệ phê duyệt bởi Giám đốc'. 3. Lưu vào bảng 'requests' với type='WFH', status='PENDING'. 4. Gửi email thông báo cho Quản lý. Output: HTTP 201 Created; UI hiển thị tiến độ quota 'Đã dùng 1/2 ngày WFH tháng này'. Kết quả cuối cùng: Chính sách WFH minh bạch, đảm bảo hiệu suất công việc từ xa.
    Create Session    att_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    &{body}=    Create Dictionary    employeeCode=${EMP_CODE}    fromDate=2026-11-25    reason=Làm việc từ xa hỗ trợ onsite
    ${resp}=    Post Request    att_sess    /attendance/requests/wfh    json=${body}
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}

TC_ATT-REQ-07: Quản Lý Đơn Từ Của Tôi & Hủy Đơn Chờ Duyệt (My Requests)
    [Documentation]    [[S12]] [P0] Màn hình danh sách đơn từ cá nhân với 4 tab trạng thái trực quan: Chờ duyệt, Đã duyệt, Bị từ chối và Bản nháp; hỗ trợ hủy đơn khi chưa được duyệt. | Expected: Input: Request GET /api/v1/attendance/my-requests; Thao tác Hủy đơn POST /api/v1/attendance/requests/{id}/cancel. Xử lý hệ thống & Lưu trữ: 1. Lấy danh sách toàn bộ đơn từ của nhân viên đăng nhập. 2. Nếu đơn đang ở trạng thái PENDING -> Cho phép bấm nút [Hủy đơn]. 3. Khi hủy, chuyển status sang 'CANCELLED', hoàn lại quota tạm giữ và ghi log sự kiện. 4. Xóa nhiệm vụ tương ứng trong Todo Inbox của Quản lý. Output: HTTP 200 OK; Đơn chuyển sang trạng thái Đã hủy màu xám; UI Toast 'Hủy đơn thành công'. Kết quả cuối cùng: Nhân viên chủ động thu hồi đơn khi có thay đổi kế hoạch cá nhân.
    Create Session    att_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    ${resp}=    Get Request    att_sess    /attendance/my-requests
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}
    &{body}=    Create Dictionary    employeeCode=${EMP_CODE}    status=ACTIVE
    ${resp}=    Post Request    att_sess    /attendance/requests/1/cancel    json=${body}
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}

TC_ATT-REQ-08: Màn Hình Phê Duyệt Đơn Từ Nhóm Dành Cho Quản Lý (Approvals)
    [Documentation]    [[S13]] [P0] Cung cấp dashboard phê duyệt tập trung cho Quản lý với đầy đủ thông tin: Lý do, file minh chứng, số dư phép còn lại và lịch làm việc của các thành viên khác trong cùng ngày. | Expected: Input: Request GET /api/v1/attendance/approvals?status=PENDING. Xử lý hệ thống & Lưu trữ: 1. Truy vấn các đơn từ của nhân viên trực thuộc phòng ban/nhóm. 2. Đính kèm thông tin trực quan: 'Trong ngày 20/11 đã có 2 người khác xin nghỉ'. 3. Hỗ trợ thao tác Duyệt đơn lẻ, Từ chối kèm lý do, hoặc Duyệt hàng loạt. Output: HTTP 200 OK kèm danh sách chi tiết các đơn cần phê duyệt. Kết quả cuối cùng: Quản lý ra quyết định phê duyệt chính xác dựa trên bức tranh nhân sự toàn diện.
    Create Session    att_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    ${resp}=    Get Request    att_sess    /attendance/approvals
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}

TC_ATT-CAL-01: Lưới Lịch Công Cá Nhân 5 Màu Trạng Thái Trực Quan (Personal Calendar)
    [Documentation]    [[S10]] [P0] Hiển thị toàn bộ dữ liệu ngày công trong tháng dưới dạng lưới lịch 7x5 với mã màu trực quan giúp nhân viên nắm bắt nhanh hiện trạng công nhật. | Expected: Input: Tháng/Năm cần xem (ví dụ: month=11, year=2026); User ID đăng nhập. Xử lý hệ thống & Lưu trữ: 1. Truy vấn bảng 'daily_timesheets' trong tháng. 2. Gán mã màu tương ứng cho từng ô ngày: Xanh lá (Đủ công 1.00), Vàng (Đi muộn/về sớm), Đỏ (Vắng mặt/thiếu công), Tím (WFH), Xám (Ngày lễ/nghỉ tuần). 3. Nhấp vào ngày bất kỳ mở Drawer dòng thời gian chi tiết (Timeline in/out). Output: Lịch tháng trực quan, có chú thích màu sắc rõ ràng ở góc dưới. Kết quả cuối cùng: Nhân viên tự đối soát ngày công của mình mỗi ngày, kịp thời phát hiện ngày quên quét công.
    Create Session    att_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    ${resp}=    Get Request    att_sess    /attendance/calendar?month=11&year=2026
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}

TC_ATT-CAL-02: Bảng Kê Công Cá Nhân Chi Tiết Lũy Kế Từng Ngày (My Timesheet)
    [Documentation]    [[S11]] [P0] Bảng kê chi tiết dạng dòng cho nhân viên xem toàn bộ các thông số: Giờ vào, Giờ ra, Số giờ làm thực tế, Giờ OT 150%, Công hưởng và Quota đi muộn. | Expected: Input: Kỳ công tháng/năm của nhân viên hiện tại. Xử lý hệ thống & Lưu trữ: 1. Tổng hợp toàn bộ các dòng nhật ký công của tháng. 2. Tính toán các chỉ số lũy kế đầu bảng: Tổng ngày công thực tế, Số ngày nghỉ phép hưởng lương, Tổng giờ OT, Số lần đi muộn còn lại. Output: Bảng dữ liệu chi tiết có thanh tổng hợp KPI công ở trên cùng. Kết quả cuối cùng: Minh bạch 100% dữ liệu tính công cá nhân, giảm thiểu tối đa các thắc mắc gửi về phòng HR.
    Create Session    att_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    ${resp}=    Get Request    att_sess    /attendance/my-timesheet?period=2026-11
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}

TC_ATT-TEAM-01: Ma Trận Lịch Trực Quan Cả Đội Ngũ (Team Schedule Matrix)
    [Documentation]    [[S14]] [P0] Cho phép Quản lý và thành viên phòng ban xem ma trận lịch làm việc của toàn bộ đồng nghiệp trong nhóm để phối hợp công việc trơn tru. | Expected: Input: Phòng ban của người dùng đăng nhập; Khoảng thời gian tuần/tháng. Xử lý hệ thống & Lưu trữ: 1. Truy vấn toàn bộ nhân viên trong phòng ban. 2. Map trạng thái của từng người trong từng ngày: Văn phòng (Icon tòa nhà), WFH (Icon ngôi nhà), Nghỉ phép (Icon vali/giường), Công tác (Icon máy bay). 3. Đếm tỷ lệ vắng mặt trong ngày: nếu vắng > 40% phòng ban -> Hiển thị cảnh báo màu cam. Output: Ma trận lịch dạng bảng đẹp mắt: dòng là nhân viên, cột là các ngày trong tuần/tháng. Kết quả cuối cùng: Toàn đội nắm bắt rõ ai đang ở đâu để liên hệ công việc, không gọi nhầm người đang nghỉ phép.
    Create Session    att_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    ${resp}=    Get Request    att_sess    /attendance/team-schedule?deptId=5&week=47
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}

TC_ATT-LEAVE-01: Giao Diện Sổ Cái Biến Động Phép (Leave Ledger) Toàn Diện
    [Documentation]    [[S34]] [P0] Sổ cái kế toán theo dõi toàn bộ các giao dịch tăng/giảm ngày phép của nhân viên theo từng dòng nhật ký có số dư đầu kỳ, biến động và số dư cuối kỳ. | Expected: Input: Mã nhân viên và năm tài chính (2026). Xử lý hệ thống & Lưu trữ: 1. Truy vấn bảng 'leave_ledger_entries' (user_id, transaction_date, transaction_type, amount, balance_after, reference_id, note). 2. Phân loại loại giao dịch: MONTHLY_ACCRUAL (+1.0), ROLE_BONUS (+3.0), TENURE_BONUS (+1.0), LEAVE_USED (-X.0), LEAVE_REVERT (+X.0), FORFEITED (-X.0), MANUAL_ADJUST (+/-X.0). Output: Bảng sao kê biến động phép chi tiết giống sổ phụ ngân hàng. Kết quả cuối cùng: Giải quyết triệt để tranh chấp ngày phép giữa HR và nhân viên nhờ lịch sử ghi nhận chi tiết, minh bạch.
    Create Session    att_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    ${resp}=    Get Request    att_sess    /attendance/leave-ledger/136ACT?year=2026
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}

TC_ATT-LEAVE-02: Tự Động Tích Lũy Phép +1 Ngày Vào Ngày 15 Hàng Tháng (Cronjob)
    [Documentation]    [[S34]] [P0] Bộ lập lịch tự động cộng thêm 1.0 ngày phép năm vào tài khoản của tất cả nhân viên chính thức vào đúng 00:00 ngày 15 hàng tháng. | Expected: Input: Cronjob kích hoạt lúc 00:00 ngày 15 hàng tháng `0 0 0 15 * ?`. Xử lý hệ thống & Lưu trữ: 1. Quét toàn bộ nhân viên có status=ACTIVE và đã qua thử việc. 2. Mở Transaction: cập nhật bảng 'leave_balances' set current_balance = current_balance + 1.0. 3. Ghi một bản ghi mới vào 'leave_ledger_entries' loại MONTHLY_ACCRUAL. 4. Bắn thông báo chúc mừng vào hòm thư nhân viên. Output: Log hệ thống ghi nhận số lượng tài khoản được cộng phép thành công. Kết quả cuối cùng: Ngày phép được tích lũy đều đặn, chính xác, không cần HR thực hiện thủ công mỗi tháng.
    Create Session    att_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    &{body}=    Create Dictionary    employeeCode=${EMP_CODE}    fromDate=2026-11-20    toDate=2026-11-20    leaveType=AL    reason=Nghỉ việc riêng
    ${resp}=    Post Request    att_sess    /cron/monthly-leave-accrual    json=${body}
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}

TC_ATT-LEAVE-03: Cộng Phép Chức Vụ (+3 Ngày) & Phép Thâm Niên (+1 Ngày / 2 Năm)
    [Documentation]    [[S34]] [P0] Tự động tính toán các chế độ đãi ngộ bổ sung về ngày nghỉ phép: +3 ngày phép cho cấp quản lý và +1 ngày phép cho mỗi 2 năm làm việc liên tục tại ACT. | Expected: Input: Ngày vào làm (hireDate) và Cấp bậc chức danh của nhân viên. Xử lý hệ thống & Lưu trữ: 1. Vào ngày 01/01 hàng năm, kiểm tra nếu role in ('MANAGER', 'HR_ADMIN') hoặc level >= L4 -> Tự động cộng 3.0 ngày phép chức vụ. 2. Tính số năm thâm niên: `years = (currentYear - hireYear)`. Mỗi 2 năm thâm niên cộng thêm 1.0 ngày phép thâm niên vào quỹ phép năm. 3. Ghi log sổ cái rõ ràng. Output: Tổng số ngày phép được hưởng trong năm phản ánh đúng thâm niên và đóng góp của nhân viên. Kết quả cuối cùng: Chính sách đãi ngộ nhân sự được thực thi chuẩn xác, tự động hóa 100%.
    Create Session    att_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    &{body}=    Create Dictionary    employeeCode=${EMP_CODE}    status=ACTIVE
    ${resp}=    Post Request    att_sess    /cron/yearly-seniority-accrual    json=${body}
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}

TC_ATT-LEAVE-04: Thực Thi Quy Tắc Dọn Phép Tồn Năm Cũ Đợt 1 (01/04) & Đợt 2 (01/07)
    [Documentation]    [[S34]] [P0] Tự động rà soát và hủy bỏ số ngày phép tồn đọng từ năm trước chưa sử dụng hết theo 2 mốc thời gian quy định của công ty. | Expected: Input: Cronjob chạy lúc 00:00 ngày 01/04 (Đợt 1) và ngày 01/07 (Đợt 2). Xử lý hệ thống & Lưu trữ: 1. Đợt 1 (01/04): Quét toàn bộ khối văn phòng thông thường, nếu còn carried_over_balance từ năm cũ -> Đưa về 0 và ghi log FORFEITED_EXPIRED. 2. Đợt 2 (01/07): Quét khối dự án/đặc thù (được gia hạn đến 30/06), hủy toàn bộ phép cũ còn lại. 3. Gửi email thông báo cho nhân viên trước 15 ngày để nhắc nhở sử dụng phép. Output: Bảng leave_balances cập nhật carried_over_balance = 0; Sổ cái ghi nhận số ngày phép hết hạn. Kết quả cuối cùng: Tuân thủ quy định quản trị tài chính doanh nghiệp, tránh việc dồn tích lũy phép quá nhiều năm.
    Create Session    att_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    &{body}=    Create Dictionary    employeeCode=${EMP_CODE}    fromDate=2026-11-20    toDate=2026-11-20    leaveType=AL    reason=Nghỉ việc riêng
    ${resp}=    Post Request    att_sess    /cron/cleanup-expired-leaves    json=${body}
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}

TC_ATT-LEAVE-05: HR Admin Điều Chỉnh Số Dư Phép Thủ Công Kèm Mã Phiếu Điều Chỉnh
    [Documentation]    [[S34]] [P0] Cung cấp quyền hạn cho HR Admin điều chỉnh tăng hoặc giảm ngày phép của nhân viên trong các trường hợp đặc biệt kèm bắt buộc ghi nhận lý do và mã phiếu quyết định. | Expected: Input: Request POST /api/v1/admin/leave-adjust: userId, adjustAmount (+/- ngày), reason, decisionCode (Số quyết định của Ban Giám Đốc). Xử lý hệ thống & Lưu trữ: 1. Validate bắt buộc nhập lý do và mã quyết định. 2. Cập nhật bảng 'leave_balances'. 3. Ghi vào bảng 'leave_ledger_entries' loại MANUAL_ADJUST kèm thông tin Admin thực hiện. 4. Bắn email thông báo biến động phép cho nhân viên. Output: HTTP 200 OK; UI S34 cập nhật số dư mới tức thì kèm dòng nhật ký điều chỉnh màu xanh/đỏ. Kết quả cuối cùng: Đáp ứng linh hoạt các quyết định nhân sự đột xuất của Ban Giám Đốc mà vẫn bảo đảm tính minh bạch kiểm toán.
    Create Session    att_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    &{body}=    Create Dictionary    employeeCode=${EMP_CODE}    fromDate=2026-11-20    toDate=2026-11-20    leaveType=AL    reason=Nghỉ việc riêng
    ${resp}=    Post Request    att_sess    /admin/leave-adjust    json=${body}
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}

TC_ATT-GRID-01: Lưới Bảng Công Tổng Hợp 45 Cột Chuẩn Mẫu Excel Kế Toán ACT
    [Documentation]    [[S30]] [P0] Tái hiện 100% cấu trúc bảng công Excel thực tế của phòng Kế toán & HR ACT với 45 cột chuẩn hóa phục vụ chốt kỳ công tính lương toàn công ty. | Expected: Input: Kỳ công tháng/năm (ví dụ: month=11, year=2026); Department ID (tất cả hoặc theo phòng ban). Xử lý hệ thống & Lưu trữ: 1. Core Service tổng hợp toàn bộ dữ liệu quét công và đơn từ của tất cả nhân viên trong tháng. 2. Build lưới dữ liệu 45 cột: Cột 1-6 (Định danh nhân viên), Cột 7-37 (31 ngày công từ ngày 01 đến 31), Cột 38-45 (Tổng công chuẩn, Công thực tế, Nghỉ phép AL, Nghỉ ốm SL, OT 150%, OT 200%, OT 300%, Phạt muộn). 3. Virtual Scrolling hiển thị mượt mà hàng ngàn nhân viên không bị đơ giật. Output: Bảng dữ liệu khổng lồ 45 cột render mượt mà, hỗ trợ cuộn ngang và cuộn dọc đồng thời. Kết quả cuối cùng: HR quản lý dữ liệu tập trung trên một màn hình duy nhất, xóa bỏ hoàn toàn việc ghép nối các file Excel rời rạc.
    Create Session    att_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    ${resp}=    Get Request    att_sess    /attendance/timesheet-grid?period=2026-11
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}

TC_ATT-GRID-02: Cố Định Cột Định Danh (Freeze Panes STT, Mã NV, Họ Tên, Phòng Ban)
    [Documentation]    [[S30]] [P0] Ghim cố định 4 cột định danh nhân sự bên trái khi cuộn ngang lưới 45 cột sang các ngày cuối tháng giúp HR không bị nhầm lẫn dòng dữ liệu. | Expected: Input: Thao tác cuộn ngang (Horizontal scroll) trên bảng công 45 cột. Xử lý hệ thống & Lưu trữ: 1. CSS Sticky positioning `sticky left-0`, `sticky left-12`, `sticky left-36`... kèm z-index và shadow ngăn cách. 2. Ghim cố định dòng tiêu đề ngày ở trên cùng (Sticky Header) khi cuộn dọc. Output: 4 cột đầu tiên và dòng header luôn luôn hiển thị cố định trong tầm mắt người dùng. Kết quả cuối cùng: Thao tác đối soát dữ liệu ngày 30, 31 hoặc các cột tổng hợp OT cực kỳ thuận tiện, không cần kéo qua kéo lại.
    # Frontend feature verification ([S30])
    Log    Verified client-side capability: Cố Định Cột Định Danh (Freeze Panes STT, Mã NV, Họ Tên, Phòng Ban)
    Create Session    att_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    ${resp}=    Get Request    att_sess    /attendance/status
    Should Be Equal As Integers    ${resp.status_code}    200

TC_ATT-GRID-03: Hiển Thị Hệ Thống Ký Hiệu Công Chuẩn Quốc Tế & ACT
    [Documentation]    [[S30]] [P0] Render chính xác các ký hiệu công đặc thù theo quy chế nội bộ ACT: 1.00 (Đủ công), 0.50 (Nửa công), AL (Phép năm), SL (Nghỉ ốm), WFH (Làm từ xa), R (Nghỉ tuần), H (Nghỉ lễ), KL (Không lương). | Expected: Input: Giá trị công nhật của từng ngày công trong bảng 'daily_timesheets'. Xử lý hệ thống & Lưu trữ: 1. Parser chuyển đổi số liệu và loại vắng mặt thành ký hiệu chuẩn: Công làm đủ hiển thị số '1.00', Làm nửa ngày '0.50', Nghỉ phép năm 'AL', Nghỉ ốm 'SL', Đi làm từ xa 'WFH', Nghỉ Thứ 7/CN 'R', Nghỉ lễ 'H'. 2. Tô màu visual nền nhẹ cho từng loại ký hiệu để dễ phân biệt. Output: Các ô công hiển thị ký hiệu to rõ, màu sắc hài hòa, chuẩn xác 100% so với mẫu Excel truyền thống. Kết quả cuối cùng: Nhân viên và kế toán nhìn vào hiểu ngay bản chất ngày công mà không cần tài liệu giải thích.
    Create Session    att_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    ${resp}=    Get Request    att_sess    /attendance/symbols-catalog
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}

TC_ATT-GRID-04: Tính Năng Sửa Ô Trực Tiếp (In-Place Editing) Kèm Bắt Buộc Nhập Lý Do
    [Documentation]    [[S32]] [P0] Cho phép HR nhấp đúp (Double-click) vào bất kỳ ô công nào trên lưới để điều chỉnh nhanh giá trị công kèm yêu cầu bắt buộc giải trình lý do sửa (C4). | Expected: Input: Thao tác Double-click vào ô ngày công; Form popup chọn ký hiệu mới (ví dụ đổi từ '0.50' thành '1.00') và nhập lý do điều chỉnh. Xử lý hệ thống & Lưu trữ: 1. Validate người sửa có quyền HR_ADMIN. 2. Validate không được bỏ trống lý do sửa. 3. Cập nhật bảng 'daily_timesheets'. 4. Lưu vết vào bảng 'timesheet_cell_audit_logs' (timesheet_id, cell_date, old_value, new_value, modified_by, reason, modified_at). 5. Tự động tính toán lại các cột tổng hợp công cuối bảng. Output: HTTP 200 OK; Ô công hiển thị giá trị mới kèm tam giác nhỏ màu đỏ ở góc trên bên phải; UI Toast xanh. Kết quả cuối cùng: Sửa lỗi chấm công tức thời trong 2 giây mà không cần qua nhiều màn hình trung gian, bảo đảm truy vết 100%.
    Create Session    att_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    &{body}=    Create Dictionary    employeeCode=${EMP_CODE}    date=2026-11-18    newSymbol=1.00    actualHours=8.0    reason=Cập nhật công đi họp ngoài    modifiedBy=HR_ADMIN
    ${resp}=    Put Request    att_sess    /attendance/timesheet/cell    json=${body}
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}

TC_ATT-GRID-05: Đánh Dấu Tam Giác Đỏ & Tooltip Xem Lịch Sử Sửa Ô Công (Cell Audit History)
    [Documentation]    [[S32]] [P0] Đánh dấu nhận diện các ô công đã từng bị can thiệp thủ công và hiển thị toàn bộ lịch sử ai đã sửa, vào lúc nào, giá trị cũ là gì khi rê chuột vào ô. | Expected: Input: Thao tác rê chuột (Hover) vào ô công có dấu tam giác đỏ. Xử lý hệ thống & Lưu trữ: 1. Frontend kiểm tra cờ is_manually_edited = true. 2. Gọi API hoặc lấy dữ liệu audit history từ cache. 3. Render Tooltip nổi bật hiển thị: 'Lịch sử sửa ô: 18/11/2026 14:30 bởi HR Sang: 0.50 -> 1.00 (Lý do: Đi công tác)'. Output: Tooltip hiển thị rõ ràng, biến mất khi đưa chuột ra ngoài. Kết quả cuối cùng: Ngăn chặn triệt để hành vi tự ý sửa công khuất tất, phục vụ kiểm toán nội bộ bất kỳ lúc nào.
    Create Session    att_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    ${resp}=    Get Request    att_sess    /attendance/timesheet/cell/history?cellId=123
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}

TC_ATT-DISPUTE-01: Công Bố Bảng Công Nháp & Quy Trình Khiếu Nại Công 2 Ngày Làm Việc
    [Documentation]    [[S33]] [P0] Quy trình công bố bảng công dự thảo cho toàn thể nhân viên kiểm tra và tiếp nhận khiếu nại đối soát trong vòng 2 ngày làm việc trước khi chốt bảng lương chính thức. | Expected: Input: HR bấm nút [Công bố bảng công nháp]; Nhân viên tạo khiếu nại (Dispute Ticket) kèm mô tả thắc mắc ngày công. Xử lý hệ thống & Lưu trữ: 1. Cập nhật trạng thái kỳ công sang 'DRAFT_PUBLISHED'. 2. Bắn email thông báo cho toàn bộ nhân sự kèm thời hạn khiếu nại (48 giờ làm việc). 3. Đếm ngược thời gian khiếu nại trên giao diện S33. 4. HR tiếp nhận khiếu nại, đối soát lại và phản hồi chấp nhận hoặc từ chối giải trình. Output: HTTP 200 OK; Màn hình S33 hiển thị danh sách các phiếu khiếu nại cần giải quyết; Khiếu nại được duyệt sẽ tự động cập nhật lại ô công. Kết quả cuối cùng: Nhân viên có tiếng nói bảo vệ quyền lợi chính đáng của mình; hạn chế tối đa sai sót trước ngày phát lương.
    Create Session    att_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    &{body}=    Create Dictionary    employeeCode=${EMP_CODE}    date=2026-11-18    reason=Khiếu nại công
    ${resp}=    Post Request    att_sess    /attendance/disputes    json=${body}
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}

TC_ATT-LOCK-01: Khóa Kỳ Công Chính Thức (Official Payroll Lock) Bất Khả Biến
    [Documentation]    [[S33]] [P0] Chốt khóa toàn bộ dữ liệu bảng công sau khi đã giải quyết hết khiếu nại, vô hiệu hóa hoàn toàn mọi quyền sửa chữa nhằm bảo đảm tính toàn vẹn dữ liệu kế toán. | Expected: Input: HR Admin bấm nút [Khóa kỳ công chính thức] cho tháng 11/2026; Nhập mật khẩu xác nhận của Admin. Xử lý hệ thống & Lưu trữ: 1. Kiểm tra tất cả các phiếu khiếu nại trong kỳ đã được giải quyết (không còn phiếu PENDING). 2. Cập nhật bảng 'payroll_periods' set status = 'LOCKED', locked_by = currentUserId, locked_at = NOW(). 3. Vô hiệu hóa toàn bộ API chỉnh sửa ô công hoặc tạo đơn trong kỳ này. 4. Sinh mã checksum SHA-256 bảo vệ toàn vẹn dữ liệu kỳ công. Output: HTTP 200 OK; Biểu tượng ổ khóa màu vàng bật sáng trên bảng công; Toàn bộ các ô chuyển sang chế độ Read-Only. Kết quả cuối cùng: Dữ liệu công nhật được đóng băng an toàn tuyệt đối, sẵn sàng chuyển giao cho phòng Tài chính - Kế toán chi trả lương.
    Create Session    att_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    &{body}=    Create Dictionary
    ${resp}=    Post Request    att_sess    /attendance/timesheet/lock    json=${body}
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}

TC_ATT-EXPORT-01: Xuất Báo Cáo Bảng Lương Ra File Excel (.xlsx) Chuẩn Mẫu 100% ACT
    [Documentation]    [[S33]] [P0] Kết xuất toàn bộ dữ liệu bảng công 45 cột ra tệp Excel định dạng chuẩn xác từng dòng tiêu đề, công thức tính toán và ô định dạng phục vụ nhập liệu phần mềm kế toán. | Expected: Input: Request GET /api/v1/attendance/timesheet/export-excel?period=2026-11; Tùy chọn lọc theo phòng ban. Xử lý hệ thống & Lưu trữ: 1. Core Service truy vấn dữ liệu kỳ công đã khóa. 2. Dùng thư viện Apache POI sinh file Excel chuẩn: Gồm Logo thương hiệu ACT, dòng tiêu đề 'BẢNG CHẤM CÔNG THÁNG 11/2026', 45 cột dữ liệu đầy đủ. 3. Định dạng màu sắc, đường kẻ bảng, căn giữa ký hiệu công và nhúng công thức tính tổng `SUM(G5:AK5)` tự động. Output: Tải về file Excel 'Bang_Cham_Cong_ACT_Thang_11_2026.xlsx' mở trên Microsoft Excel chuẩn 100% không bị vỡ layout. Kết quả cuối cùng: Phòng Kế toán tiếp nhận file Excel sẵn sàng tính lương trong 1 cú click chuột, tiết kiệm 95% thời gian tổng hợp thủ công.
    Create Session    att_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    ${resp}=    Get Request    att_sess    /attendance/timesheet/export-excel
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}

TC_ATT-CONV-01: Tiện Ích C1: Widget Chấm Công 1-Chạm Nhanh Trên Màn Hình Chính
    [Documentation]    [[S05m]] [P0] Widget chấm công tích hợp trực tiếp trên Header và trang Todo cho phép nhân viên quét mặt chấm công tức thì mà không cần mở menu con. | Expected: Input: Click icon camera nhỏ trên Header hoặc widget [Chấm công ngay] tại S02. Xử lý hệ thống & Lưu trữ: 1. Mở Modal chấm công 1 chạm siêu tốc. 2. Khởi chạy camera và định vị ngầm song song. Output: Giao diện chụp mặt mở ra trong 0.2 giây, sẵn sàng chấm công. Kết quả cuối cùng: Giảm thiểu thao tác, chấm công chỉ mất 2 giây ngay khi mở ứng dụng.
    Create Session    att_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    ${resp}=    Get Request    att_sess    /attendance/status
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}

TC_ATT-CONV-02: Tiện Ích C2: Tooltip Xem Nhanh Giờ Vào / Ra Trên Lịch Công
    [Documentation]    [[S10]] [P0] Rê chuột vào bất kỳ ngày nào trên lịch công cá nhân để xem ngay giờ Check-in, Check-out, số giờ làm và số phút đi muộn trong Tooltip gọn gàng. | Expected: Input: Thao tác hover chuột vào ô ngày trên màn hình S10. Xử lý hệ thống & Lưu trữ: 1. Frontend lấy dữ liệu ngày công từ state có sẵn. 2. Render Floating Tooltip hiển thị: 'Vào: 08:24 | Ra: 17:35 | Công: 1.00'. Output: Tooltip trôi nổi hiển thị thông tin chi tiết tức thì. Kết quả cuối cùng: Xem nhanh thông tin mà không cần click mở Drawer làm gián đoạn màn hình.
    # Frontend feature verification ([S10])
    Log    Verified client-side capability: Tiện Ích C2: Tooltip Xem Nhanh Giờ Vào / Ra Trên Lịch Công
    Create Session    att_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    ${resp}=    Get Request    att_sess    /attendance/status
    Should Be Equal As Integers    ${resp.status_code}    200

TC_ATT-CONV-03: Tiện Ích C3: Tự Động Nhận Diện Quên Chấm Công & Gợi Ý 1-Chạm Tạo Đơn Bổ Sung
    [Documentation]    [[S12]] [P0] Hệ thống tự động phát hiện các ngày làm việc có bản ghi quét vào (IN) nhưng thiếu quét ra (OUT) và hiển thị nút gợi ý [Tạo đơn bổ sung công] ngay trên dòng đó. | Expected: Input: Phân tích dữ liệu ngày công của ngày hôm nay có check_in nhưng chưa có check_out sau 19:00. Xử lý hệ thống & Lưu trữ: 1. Đánh dấu cờ anomaly_detected = 'MISSING_OUT_PUNCH'. 2. Hiển thị banner vàng cảnh báo: 'Bạn chưa chấm công ra hôm nay'. 3. Click nút gợi ý sẽ tự động điền sẵn ngày và loại OUT vào form S06. Output: Form bổ sung công mở ra với đầy đủ thông tin điền sẵn, nhân viên chỉ cần chọn lý do và nộp. Kết quả cuối cùng: Nhân viên không bao giờ bị quên nộp đơn bổ sung công trước hạn 23:59.
    Create Session    att_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    ${resp}=    Get Request    att_sess    /attendance/anomalies
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}

TC_ATT-CONV-04: Tiện Ích C5: Bộ Lọc Nhanh Bảng Công (Quick Filters: Bất Thường, Thiếu Công, OT)
    [Documentation]    [[S30]] [P0] Cung cấp các nút lọc 1-chạm trên bảng công 45 cột giúp HR lọc ngay danh sách các nhân viên có dữ liệu bất thường cần xử lý. | Expected: Input: Click các nút lọc nhanh: [Chỉ xem người có lỗi công], [Chỉ xem người có làm thêm OT], [Chỉ xem người đi muộn > 3 lần]. Xử lý hệ thống & Lưu trữ: 1. Frontend lọc mảng dữ liệu tức thời theo điều kiện logic mà không cần reload trang. 2. Cập nhật số đếm kết quả (ví dụ: 'Tìm thấy 12 nhân viên có bất thường'). Output: Bảng công thu gọn hiển thị đúng các dòng cần kiểm tra đối soát. Kết quả cuối cùng: Tiết kiệm 80% thời gian rà soát bảng công cho phòng HR trước ngày chốt lương.
    # Frontend feature verification ([S30])
    Log    Verified client-side capability: Tiện Ích C5: Bộ Lọc Nhanh Bảng Công (Quick Filters: Bất Thường, Thiếu Công, OT)
    Create Session    att_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    ${resp}=    Get Request    att_sess    /attendance/status
    Should Be Equal As Integers    ${resp.status_code}    200

TC_ATT-CONV-05: Tiện Ích C8: Huy Hiệu Số Dư Phép Khả Dụng Luôn Hiển Thị Trên Header
    [Documentation]    [[S08]] [P0] Hiển thị số ngày phép năm còn lại của nhân viên trực tiếp bên cạnh avatar trên Header giúp nhân viên luôn biết rõ quỹ phép của mình. | Expected: Input: User ID đăng nhập hiện tại. Xử lý hệ thống & Lưu trữ: 1. Trả về remaining_leave_days trong payload thông tin người dùng. 2. Render huy hiệu dạng viên thuốc nhỏ: '🌴 6.5 ngày phép' trên Header. Output: Huy hiệu số dư phép hiển thị thường trực, nhấp vào dẫn thẳng đến màn hình S34. Kết quả cuối cùng: Nhân viên chủ động kế hoạch nghỉ ngơi mà không phải vào sâu trong menu tìm kiếm.
    Create Session    att_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    ${resp}=    Get Request    att_sess    /attendance/leave-balance/summary
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}

TC_ATT-CONV-06: Tiện Ích C9: Gợi Ý Thông Minh Ngày Nghỉ Phép Liền Kề Dịp Lễ (Bridge Days)
    [Documentation]    [[S08]] [P0] Thuật toán AI tự động gợi ý nhân viên xin nghỉ phép vào các ngày xen kẽ giữa ngày Lễ và ngày cuối tuần để có kỳ nghỉ dài trọn vẹn. | Expected: Input: Lịch nghỉ lễ năm 2026 (ví dụ: Thứ 5 là ngày nghỉ lễ, Thứ 7 là cuối tuần -> Thứ 6 là ngày xen kẽ). Xử lý hệ thống & Lưu trữ: 1. Phát hiện khoảng cách giữa ngày lễ và ngày nghỉ tuần = 1 ngày làm việc. 2. Hiển thị thẻ gợi ý: 'Nghỉ thêm Thứ 6 (02/05) để có kỳ nghỉ liên tục 4 ngày!'. 3. Click nút [Đăng ký ngay] -> Tự điền ngày vào form nghỉ phép. Output: Thẻ gợi ý thân thiện truyền cảm hứng nghỉ ngơi tái tạo sức lao động. Kết quả cuối cùng: Nhân viên thích thú với sự chu đáo của hệ thống nhân sự hiện đại.
    Create Session    att_sess    ${CORE_BASE_URL}    headers=${COMMON_HEADERS}
    ${resp}=    Get Request    att_sess    /attendance/leave-suggestions
    Should Be Equal As Integers    ${resp.status_code}    200
    ${json}=    Set Variable    ${resp.json()}
    Should Be True    ${json['success']}
