# -*- coding: utf-8 -*-
"""
Master script to generate ACT_HR_2026_Project_Tracking.xlsx
Aggregates all modules with hundreds of granular, testable checklist items.
"""

import os
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

from data_shared_core import shared_core_rows
from data_attendance import attendance_rows
from data_okr import okr_rows

# Additional granular features for Shared Core (Rule Engine 19 rules & Security)
additional_core_rows = [
    # Granular 19 Rules from Rule Engine Catalog
    (
        "Nền Tảng Dùng Chung", "[S18]", "RULE-CONFIG-01", "P0",
        "Quy Tắc 1: Bán Kính Định Vị Geofence Chấm Công (ATTENDANCE_GEOFENCE_RADIUS)",
        "Quy định bán kính địa lý cho phép chấm công xung quanh trụ sở công ty (mặc định 150m cho Vùng Xanh, 300m cho Vùng Vàng).",
        "Input: Tham số radius_meters = 150 (số nguyên > 0); Người sửa có quyền ADMIN.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Validate radius_meters từ 50m đến 1000m. 2. Lưu vào bảng 'system_rule_versions' với key='ATTENDANCE_GEOFENCE_RADIUS'. 3. Cập nhật cache Redis. 4. Áp dụng ngay cho các lượt chấm công tiếp theo.\n"
        "Output: HTTP 200 OK; Rule Engine cập nhật phiên bản mới.\n"
        "Kết quả cuối cùng: Thuật toán Haversine tại Core Service tự động sử dụng bán kính mới để phân vùng geofence.",
        "PUT /api/v1/admin/rules/ATTENDANCE_GEOFENCE_RADIUS",
        "QA Verify: Đổi giá trị thành 200m -> Đứng cách 180m chấm công -> Kết quả chuyển từ Vùng Vàng sang Vùng Xanh hợp lệ.",
        "Ready for Test & Verify", "Backend Lead", "Bảo mật chống chấm công ngoài vùng."
    ),
    (
        "Nền Tảng Dùng Chung", "[S18]", "RULE-CONFIG-02", "P0",
        "Quy Tắc 2: Dung Sai Đi Muộn Ca Linh Hoạt (FLEX_TIME_GRACE_PERIOD)",
        "Cấu hình số phút cho phép nhân viên đến muộn so với giờ chuẩn mà không bị tính đi muộn nếu làm đủ 8 tiếng (mặc định 15 phút, từ 08:30 đến 08:45).",
        "Input: Tham số grace_minutes = 15.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Core Service lưu cấu hình. 2. Khi quét công đầu ngày: nếu 08:30 < punch_time <= 08:45 và tổng giờ làm >= 8h30 -> is_late = false, tính đủ 1.0 công.\n"
        "Output: Bản ghi chấm công ghi nhận hợp lệ, không bị tính phạt muộn.\n"
        "Kết quả cuối cùng: Nhân viên đến trong khung giờ linh hoạt không bị trừ quota đi muộn.",
        "PUT /api/v1/admin/rules/FLEX_TIME_GRACE_PERIOD",
        "QA Verify: Check-in lúc 08:40, Check-out 17:40 -> Verify bảng công ghi nhận đủ 1.00 công, không đi muộn.",
        "Ready for Test & Verify", "Backend Dev", "Chính sách linh hoạt cho khối công nghệ và văn phòng."
    ),
    (
        "Nền Tảng Dùng Chung", "[S18]", "RULE-CONFIG-03", "P0",
        "Quy Tắc 3: Ràng Buộc Hạn Chót Nộp Đơn Bổ Sung Công (MISSING_PUNCH_DEADLINE)",
        "Quy định thời hạn tối đa nhân viên được phép tạo đơn giải trình quên chấm công (mặc định 23:59 của chính ngày làm việc).",
        "Input: Tham số deadline_rule = 'SAME_DAY_2359'.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Core Service chặn tạo đơn bổ sung công nếu thời điểm submit > 23:59:59 của ngày cần bổ sung. 2. Trả về mã lỗi DEADLINE_EXCEEDED.\n"
        "Output: Form báo lỗi và vô hiệu hóa nút gửi đơn nếu quá hạn.\n"
        "Kết quả cuối cùng: Duy trì kỷ luật chấm công hàng ngày, ngăn ngừa bổ sung công hồi tố cuối tháng.",
        "PUT /api/v1/admin/rules/MISSING_PUNCH_DEADLINE",
        "QA Verify: Thử tạo đơn bổ sung công cho ngày hôm trước -> Hệ thống từ chối.",
        "Ready for Test & Verify", "Backend Dev", "Quy định chốt từ doc/Rule chấm công.xlsx."
    ),
    (
        "Nền Tảng Dùng Chung", "[S18]", "RULE-CONFIG-04", "P0",
        "Quy Tắc 4: Hạn Ngạch Đi Muộn / Về Sớm Hàng Tháng (LATE_EARLY_MONTHLY_QUOTA)",
        "Số lần tối đa nhân viên được phép đi muộn/về sớm có lý do chính đáng trong 1 tháng dương lịch (mặc định 3 lần hoặc 60 phút).",
        "Input: Tham số max_times = 3, max_total_minutes = 60.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Quota Engine đếm số lần và số phút đã dùng trong tháng. 2. Nếu vượt ngưỡng -> Chuyển sang trừ lương hoặc cảnh báo.\n"
        "Output: Cảnh báo tự động hiển thị trên form nộp đơn khi sắp hết hạn ngạch.\n"
        "Kết quả cuối cùng: Kiểm soát chặt chẽ tỷ lệ chấp hành giờ giấc làm việc.",
        "PUT /api/v1/admin/rules/LATE_EARLY_MONTHLY_QUOTA",
        "QA Verify: Nộp đơn lần 4 trong tháng -> Hệ thống cảnh báo đơn này sẽ bị tính trừ lương.",
        "Ready for Test & Verify", "Fullstack Dev", "Tự động reset đầu mỗi tháng."
    ),
    (
        "Nền Tảng Dùng Chung", "[S18]", "RULE-CONFIG-05", "P0",
        "Quy Tắc 5: Ngày Tích Lũy Phép Định Kỳ Hàng Tháng (MONTHLY_LEAVE_ACCRUAL_DAY)",
        "Ngày trong tháng hệ thống tự động cộng +1.0 ngày phép năm cho nhân viên chính thức (mặc định ngày 15 hàng tháng).",
        "Input: Tham số accrual_day = 15, accrual_amount = 1.0.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Cronjob quét ngày 15 -> Thực thi cộng 1.0 ngày vào bảng leave_balances. 2. Ghi nhận nhật ký sổ cái LEAVE_LEDGER.\n"
        "Output: Số dư phép tăng tự động mà không cần HR can thiệp.\n"
        "Kết quả cuối cùng: Tích lũy phép chính xác, đều đặn theo quy chế lao động.",
        "PUT /api/v1/admin/rules/MONTHLY_LEAVE_ACCRUAL_DAY",
        "QA Verify: Chạy cronjob ngày 15 -> Kiểm tra số dư phép tăng từ 4.0 lên 5.0.",
        "Ready for Test & Verify", "Backend Lead", "Tuân thủ Điều 113 Bộ luật Lao động."
    ),
    (
        "Nền Tảng Dùng Chung", "[S18]", "RULE-CONFIG-06", "P0",
        "Quy Tắc 6: Hạn Mức Nghỉ Làm Việc Từ Xa WFH Hàng Tháng (WFH_MONTHLY_QUOTA)",
        "Số ngày tối đa nhân viên được phép đăng ký làm việc tại nhà trong 1 tháng (mặc định 2 ngày/tháng).",
        "Input: Tham số max_wfh_days = 2.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Quota Engine đếm số ngày WFH đã được duyệt trong tháng. 2. Chặn nộp đơn thứ 3 trừ khi có ngoại lệ từ Giám đốc.\n"
        "Output: Form WFH báo lỗi vượt quota khi nộp ngày thứ 3.\n"
        "Kết quả cuối cùng: Cân bằng giữa làm việc từ xa và văn hóa cộng tác trực tiếp tại văn phòng.",
        "PUT /api/v1/admin/rules/WFH_MONTHLY_QUOTA",
        "QA Verify: Nộp đơn WFH ngày thứ 3 -> Báo lỗi 'Vượt quá hạn mức 2 ngày/tháng'.",
        "Ready for Test & Verify", "Fullstack Dev", "Tham số quy định chính thức của công ty."
    ),
    (
        "Nền Tảng Dùng Chung", "[S18]", "RULE-CONFIG-07", "P0",
        "Quy Tắc 7: Mốc Hạn Dọn Phép Tồn Năm Cũ Đợt 1 (LEAVE_EXPIRY_DATE_PHASE1)",
        "Ngày hết hạn sử dụng số ngày phép còn tồn đọng từ năm trước đối với khối văn phòng (mặc định ngày 01/04 hàng năm).",
        "Input: Tham số expiry_date_phase1 = '04-01'.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Cronjob rà soát lúc 00:00 ngày 01/04. 2. Đưa carried_over_balance về 0 đối với các nhân sự áp dụng. 3. Ghi log sổ cái FORFEITED.\n"
        "Output: Bảng phép cập nhật số dư; Gửi email nhắc nhở trước 15 ngày.\n"
        "Kết quả cuối cùng: Dọn dẹp quỹ phép cũ theo đúng quy định tài chính công ty.",
        "PUT /api/v1/admin/rules/LEAVE_EXPIRY_DATE_PHASE1",
        "QA Verify: Kích hoạt ngày 01/04 -> Kiểm tra phép năm cũ bị hủy về 0.",
        "Ready for Test & Verify", "Backend Lead", "Tránh việc dồn tích lũy phép qua nhiều năm."
    ),
    (
        "Nền Tảng Dùng Chung", "[S18]", "RULE-CONFIG-08", "P0",
        "Quy Tắc 8: Mốc Hạn Dọn Phép Tồn Năm Cũ Đợt 2 (LEAVE_EXPIRY_DATE_PHASE2)",
        "Ngày hết hạn sử dụng số ngày phép tồn đọng từ năm trước đối với khối dự án và trường hợp đặc biệt (mặc định ngày 01/07 hàng năm).",
        "Input: Tham số expiry_date_phase2 = '07-01'.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Cronjob quét ngày 01/07 cho nhóm nhân sự dự án. 2. Hủy toàn bộ phép năm cũ còn lại.\n"
        "Output: Sổ cái ghi nhận dòng nhật ký hết hạn phép đợt 2.\n"
        "Kết quả cuối cùng: Hoàn tất dọn dẹp quỹ phép năm cũ cho 100% nhân sự toàn công ty.",
        "PUT /api/v1/admin/rules/LEAVE_EXPIRY_DATE_PHASE2",
        "QA Verify: Kích hoạt ngày 01/07 -> Phép năm cũ của nhân viên dự án về 0.",
        "Ready for Test & Verify", "Backend Lead", "Gia hạn thêm 3 tháng cho nhân sự tham gia dự án cao điểm."
    ),
    (
        "Nền Tảng Dùng Chung", "[S18]", "RULE-CONFIG-09", "P0",
        "Quy Tắc 9: Thang Điểm Đánh Giá OKR 1-5 Nguyên (OKR_RATING_SCALE_INTEGER)",
        "Quy định thang điểm đánh giá hiệu suất cuối năm bắt buộc là số nguyên từ 1 đến 5, mỗi nhóm (Business, People) 1 điểm, không có điểm lẻ.",
        "Input: scale_min = 1, scale_max = 5, allow_decimal = false.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Core Service validate điểm số nhập vào phải là số nguyên 1, 2, 3, 4, hoặc 5. 2. Chặn các điểm lẻ như 3.5, 4.2.\n"
        "Output: Giao diện form chỉ cho phép chọn 5 mức số nguyên bằng nút Radio to rõ.\n"
        "Kết quả cuối cùng: Thực thi nghiêm túc quy định tại doc/OKR_doc.md Box 2-3.",
        "PUT /api/v1/admin/rules/OKR_RATING_SCALE",
        "QA Verify: Gửi API chấm điểm 3.5 -> Báo lỗi 'Điểm số phải là số nguyên từ 1 đến 5'.",
        "Ready for Test & Verify", "Backend Lead", "Quy tắc cốt lõi của bài toán OKR."
    ),
    (
        "Nền Tảng Dùng Chung", "[S18]", "RULE-CONFIG-10", "P0",
        "Quy Tắc 10: Tỷ Lệ Mục Tiêu Chiến Lược Công Ty 20% (OKR_COMPANY_ALIGNMENT_RATIO)",
        "Quy định tỷ trọng các mục tiêu kế thừa chiến lược công ty (20%) và mục tiêu cá nhân (80%) trong cấu trúc OKR đầu năm.",
        "Input: company_ratio = 20, individual_ratio = 80.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Form S21 tự động phân bổ tỷ trọng mặc định khi nhân viên sao chép mục tiêu công ty. 2. Cảnh báo nếu tỷ lệ bị lệch quá lớn.\n"
        "Output: Hiển thị thanh tỷ lệ 20% / 80% trực quan trên giao diện thiết lập OKR.\n"
        "Kết quả cuối cùng: Đảm bảo tính liên kết chiến lược từ trên xuống dưới trong tổ chức.",
        "PUT /api/v1/admin/rules/OKR_COMPANY_RATIO",
        "QA Verify: Tạo mục tiêu công ty -> Trọng số mặc định được gán 20%.",
        "Ready for Test & Verify", "Fullstack Dev", "Quy định chốt từ doc/OKR_doc.md."
    ),
    (
        "Nền Tảng Dùng Chung", "[S18]", "RULE-CONFIG-11", "P0",
        "Quy Tắc 11: Hạn Ngạch Phân Phối Chuẩn Bell Curve Hội Đồng Hiệu Chuẩn (CALIBRATION_BELL_CURVE)",
        "Tỷ lệ % tối đa cho phép xếp loại hiệu suất cuối năm: Xuất sắc Grade A (10-15%), Tốt Grade B (60-70%), Đạt Grade C (15-20%), Cần cải thiện Grade D (< 5%).",
        "Input: grade_a_max = 15, grade_b_range = [60, 70], grade_c_range = [15, 20], grade_d_max = 5.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Calibration Board S26 tự động tính toán tỷ lệ trên từng cột. 2. Cảnh báo cam nếu Grade A > 15%.\n"
        "Output: Hộp cảnh báo visual hiển thị khi tỷ lệ vượt hạn ngạch.\n"
        "Kết quả cuối cùng: Kiểm soát lạm phát xếp loại xuất sắc, đảm bảo công bằng giữa các phòng ban.",
        "PUT /api/v1/admin/rules/CALIBRATION_BELL_CURVE",
        "QA Verify: Kéo thẻ nhân viên vào cột A đạt 16% -> Hiển thị cảnh báo lệch chuẩn Bell Curve.",
        "Ready for Test & Verify", "Frontend Dev", "Quy định kiểm soát ngân sách thi đua khen thưởng."
    ),
    (
        "Nền Tảng Dùng Chung", "[S18]", "RULE-CONFIG-12", "P0",
        "Quy Tắc 12: Thời Hạn SLA Tự Động Chuyển Cấp Duyệt Đơn (APPROVAL_SLA_HOURS)",
        "Thời gian tối đa người quản lý được giữ đơn chờ duyệt trước khi hệ thống tự động leo thang chuyển cấp trên kế tiếp (mặc định 48 giờ).",
        "Input: sla_hours = 48.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Cronjob quét đơn PENDING > 48 giờ. 2. Tự động chuyển assignee lên cấp quản lý kế tiếp.\n"
        "Output: Đơn chuyển người duyệt kèm nhãn ESCALATED màu đỏ.\n"
        "Kết quả cuối cùng: Đơn từ của nhân viên không bao giờ bị nghẽn tắc khi sếp đi vắng.",
        "PUT /api/v1/admin/rules/APPROVAL_SLA_HOURS",
        "QA Verify: Đơn nộp quá 48h -> Tự động chuyển vào hòm thư Todo của Giám đốc khối.",
        "Ready for Test & Verify", "Backend Lead", "Cơ chế bảo vệ quyền lợi người lao động."
    )
]

# Additional granular features for Attendance (Convenience features & Edge cases)
additional_attendance_rows = [
    (
        "Chấm Công & Đơn Từ", "[S05m]", "ATT-CONV-01", "P0",
        "Tiện Ích C1: Widget Chấm Công 1-Chạm Nhanh Trên Màn Hình Chính",
        "Widget chấm công tích hợp trực tiếp trên Header và trang Todo cho phép nhân viên quét mặt chấm công tức thì mà không cần mở menu con.",
        "Input: Click icon camera nhỏ trên Header hoặc widget [Chấm công ngay] tại S02.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Mở Modal chấm công 1 chạm siêu tốc. 2. Khởi chạy camera và định vị ngầm song song.\n"
        "Output: Giao diện chụp mặt mở ra trong 0.2 giây, sẵn sàng chấm công.\n"
        "Kết quả cuối cùng: Giảm thiểu thao tác, chấm công chỉ mất 2 giây ngay khi mở ứng dụng.",
        "GET /api/v1/attendance/status",
        "QA Verify: Click widget chấm công trên Header -> Camera mở ra ngay lập tức.",
        "Ready for Test & Verify", "Frontend Dev", "Đặc tả tính năng tiện ích C1."
    ),
    (
        "Chấm Công & Đơn Từ", "[S10]", "ATT-CONV-02", "P0",
        "Tiện Ích C2: Tooltip Xem Nhanh Giờ Vào / Ra Trên Lịch Công",
        "Rê chuột vào bất kỳ ngày nào trên lịch công cá nhân để xem ngay giờ Check-in, Check-out, số giờ làm và số phút đi muộn trong Tooltip gọn gàng.",
        "Input: Thao tác hover chuột vào ô ngày trên màn hình S10.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Frontend lấy dữ liệu ngày công từ state có sẵn. 2. Render Floating Tooltip hiển thị: 'Vào: 08:24 | Ra: 17:35 | Công: 1.00'.\n"
        "Output: Tooltip trôi nổi hiển thị thông tin chi tiết tức thì.\n"
        "Kết quả cuối cùng: Xem nhanh thông tin mà không cần click mở Drawer làm gián đoạn màn hình.",
        "N/A (Frontend Tooltip)",
        "QA Verify: Rê chuột vào ngày bất kỳ -> Tooltip hiện lên đầy đủ thông tin vào/ra.",
        "Ready for Test & Verify", "Frontend Dev", "Đặc tả tính năng tiện ích C2."
    ),
    (
        "Chấm Công & Đơn Từ", "[S12]", "ATT-CONV-03", "P0",
        "Tiện Ích C3: Tự Động Nhận Diện Quên Chấm Công & Gợi Ý 1-Chạm Tạo Đơn Bổ Sung",
        "Hệ thống tự động phát hiện các ngày làm việc có bản ghi quét vào (IN) nhưng thiếu quét ra (OUT) và hiển thị nút gợi ý [Tạo đơn bổ sung công] ngay trên dòng đó.",
        "Input: Phân tích dữ liệu ngày công của ngày hôm nay có check_in nhưng chưa có check_out sau 19:00.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Đánh dấu cờ anomaly_detected = 'MISSING_OUT_PUNCH'. 2. Hiển thị banner vàng cảnh báo: 'Bạn chưa chấm công ra hôm nay'. 3. Click nút gợi ý sẽ tự động điền sẵn ngày và loại OUT vào form S06.\n"
        "Output: Form bổ sung công mở ra với đầy đủ thông tin điền sẵn, nhân viên chỉ cần chọn lý do và nộp.\n"
        "Kết quả cuối cùng: Nhân viên không bao giờ bị quên nộp đơn bổ sung công trước hạn 23:59.",
        "GET /api/v1/attendance/anomalies",
        "QA Verify: Quét vào buổi sáng nhưng không quét ra -> Mở app lúc 20h thấy banner cảnh báo nhắc nhở.",
        "Ready for Test & Verify", "Frontend Dev", "Đặc tả tính năng tiện ích C3 - Cứu nguy cho nhân viên."
    ),
    (
        "Chấm Công & Đơn Từ", "[S30]", "ATT-CONV-04", "P0",
        "Tiện Ích C5: Bộ Lọc Nhanh Bảng Công (Quick Filters: Bất Thường, Thiếu Công, OT)",
        "Cung cấp các nút lọc 1-chạm trên bảng công 45 cột giúp HR lọc ngay danh sách các nhân viên có dữ liệu bất thường cần xử lý.",
        "Input: Click các nút lọc nhanh: [Chỉ xem người có lỗi công], [Chỉ xem người có làm thêm OT], [Chỉ xem người đi muộn > 3 lần].\n"
        "Xử lý hệ thống & Lưu trữ: 1. Frontend lọc mảng dữ liệu tức thời theo điều kiện logic mà không cần reload trang. 2. Cập nhật số đếm kết quả (ví dụ: 'Tìm thấy 12 nhân viên có bất thường').\n"
        "Output: Bảng công thu gọn hiển thị đúng các dòng cần kiểm tra đối soát.\n"
        "Kết quả cuối cùng: Tiết kiệm 80% thời gian rà soát bảng công cho phòng HR trước ngày chốt lương.",
        "N/A (Client-side Data Filter)",
        "QA Verify: Bấm nút [Bất thường] -> Bảng chỉ hiển thị các nhân viên có ô màu đỏ/vàng.",
        "Ready for Test & Verify", "Frontend Dev", "Đặc tả tính năng tiện ích C5."
    ),
    (
        "Chấm Công & Đơn Từ", "[S08]", "ATT-CONV-05", "P0",
        "Tiện Ích C8: Huy Hiệu Số Dư Phép Khả Dụng Luôn Hiển Thị Trên Header",
        "Hiển thị số ngày phép năm còn lại của nhân viên trực tiếp bên cạnh avatar trên Header giúp nhân viên luôn biết rõ quỹ phép của mình.",
        "Input: User ID đăng nhập hiện tại.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Trả về remaining_leave_days trong payload thông tin người dùng. 2. Render huy hiệu dạng viên thuốc nhỏ: '🌴 6.5 ngày phép' trên Header.\n"
        "Output: Huy hiệu số dư phép hiển thị thường trực, nhấp vào dẫn thẳng đến màn hình S34.\n"
        "Kết quả cuối cùng: Nhân viên chủ động kế hoạch nghỉ ngơi mà không phải vào sâu trong menu tìm kiếm.",
        "GET /api/v1/attendance/leave-balance/summary",
        "QA Verify: Mở bất kỳ trang nào -> Nhìn góc trên bên phải thấy số dư phép 6.5 ngày.",
        "Ready for Test & Verify", "Frontend Dev", "Đặc tả tính năng tiện ích C8."
    ),
    (
        "Chấm Công & Đơn Từ", "[S08]", "ATT-CONV-06", "P0",
        "Tiện Ích C9: Gợi Ý Thông Minh Ngày Nghỉ Phép Liền Kề Dịp Lễ (Bridge Days)",
        "Thuật toán AI tự động gợi ý nhân viên xin nghỉ phép vào các ngày xen kẽ giữa ngày Lễ và ngày cuối tuần để có kỳ nghỉ dài trọn vẹn.",
        "Input: Lịch nghỉ lễ năm 2026 (ví dụ: Thứ 5 là ngày nghỉ lễ, Thứ 7 là cuối tuần -> Thứ 6 là ngày xen kẽ).\n"
        "Xử lý hệ thống & Lưu trữ: 1. Phát hiện khoảng cách giữa ngày lễ và ngày nghỉ tuần = 1 ngày làm việc. 2. Hiển thị thẻ gợi ý: 'Nghỉ thêm Thứ 6 (02/05) để có kỳ nghỉ liên tục 4 ngày!'. 3. Click nút [Đăng ký ngay] -> Tự điền ngày vào form nghỉ phép.\n"
        "Output: Thẻ gợi ý thân thiện truyền cảm hứng nghỉ ngơi tái tạo sức lao động.\n"
        "Kết quả cuối cùng: Nhân viên thích thú với sự chu đáo của hệ thống nhân sự hiện đại.",
        "GET /api/v1/attendance/leave-suggestions",
        "QA Verify: Xem gợi ý dịp 30/4 - 1/5 -> Thấy gợi ý ngày nghỉ cầu nối (Bridge day) chuẩn xác.",
        "Ready for Test & Verify", "Fullstack Dev", "Đặc tả tính năng tiện ích C9."
    )
]

# Additional granular features for OKR (Convenience features & Calibration details)
additional_okr_rows = [
    (
        "Quản Trị & Đánh Giá OKR", "[S21]", "OKR-CONV-01", "P0",
        "Tiện Ích C14: Minh Bạch Công Thức Tự Động Tính Điểm Trung Bình",
        "Hiển thị bảng giải thích công thức tính điểm trực quan ngay bên dưới kết quả đánh giá: `(Điểm Business + Điểm People) / 2` giúp nhân viên và sếp hoàn toàn tin tưởng vào số liệu phần mềm.",
        "Input: Điểm Business và Điểm People được chọn.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Render hộp giải trình công thức: 'Điểm TB = (4 + 5) / 2 = 4.5'. 2. Hiển thị nhãn quy đổi xếp loại tương ứng theo quy chế ACT: 'Xếp loại A: Xuất sắc'.\n"
        "Output: Hộp công thức trực quan, dễ hiểu, minh bạch 100%.\n"
        "Kết quả cuối cùng: Không còn bất kỳ thắc mắc hay nghi ngờ nào về cách tính điểm của hệ thống.",
        "N/A (Frontend Formula Card)",
        "QA Verify: Chọn điểm 4 và 5 -> Thấy hộp công thức tính toán hiển thị rõ ràng số 4.5.",
        "Ready for Test & Verify", "Frontend Dev", "Đặc tả tính năng tiện ích C14."
    ),
    (
        "Quản Trị & Đánh Giá OKR", "[S23]", "OKR-CONV-02", "P0",
        "Tiện Ích C15: Trình Xem Nhanh File Minh Chứng Ngay Trên Web (In-App File Previewer)",
        "Cho phép Quản lý và HR nhấp vào xem trực tiếp các file đính kèm báo cáo (.pdf, ảnh) ngay trong cửa sổ popup mà không cần tải file về máy tính.",
        "Input: Click vào tên file đính kèm trong bản tự đánh giá của nhân viên.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Mở Modal Previewer tích hợp PDF.js / Image Viewer. 2. Tải luồng file an toàn có xác thực token. 3. Hỗ trợ phóng to, thu nhỏ, xoay trang.\n"
        "Output: Cửa sổ xem trước file sắc nét, tải nhanh dưới 1 giây.\n"
        "Kết quả cuối cùng: Tăng tốc độ thẩm định hồ sơ của Quản lý lên gấp đôi, không làm rác bộ nhớ máy tính.",
        "GET /api/v1/media/preview/{fileId}",
        "QA Verify: Bấm vào file 'Bao_cao_du_an.pdf' -> File hiển thị trực tiếp trên modal xem trước.",
        "Ready for Test & Verify", "Frontend Dev", "Đặc tả tính năng tiện ích C15."
    ),
    (
        "Quản Trị & Đánh Giá OKR", "[S21]", "OKR-CONV-03", "P0",
        "Tiện Ích C16: Thư Viện Mẫu OKR Chuẩn Theo Từng Chức Danh (Role-based OKR Templates)",
        "Cung cấp kho thư viện các mục tiêu mẫu chuẩn cho từng vị trí công việc (Developer, Tester, BA, Sale, Marketing, Kế toán) giúp nhân viên mới dễ dàng tham khảo và thiết lập mục tiêu đầu năm.",
        "Input: Chức danh công việc của người dùng đăng nhập.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Truy vấn các template mẫu tương ứng với job_title_id. 2. Hiển thị thẻ 'Gợi ý OKR cho vị trí Lập trình viên Backend': Các mục tiêu về chất lượng code, tối ưu hiệu năng, học chứng chỉ. 3. Nút [Áp dụng mẫu này] tự điền vào form.\n"
        "Output: Thư viện mẫu phong phú, thực tế, đúng chuyên môn.\n"
        "Kết quả cuối cùng: Nhân viên mới không còn bỡ ngỡ khi viết OKR, chất lượng mục tiêu toàn công ty đồng đều.",
        "GET /api/v1/okr/templates?jobTitleId=3",
        "QA Verify: Nhân viên Tester vào xem gợi ý -> Thấy các KR mẫu về tỷ lệ phát hiện bug và tự động hóa test.",
        "Ready for Test & Verify", "Fullstack Dev", "Đặc tả tính năng tiện ích C16."
    ),
    (
        "Quản Trị & Đánh Giá OKR", "[S21]", "OKR-CONV-04", "P0",
        "Tiện Ích C17: Kế Thừa Mục Tiêu Từ Quản Lý Trực Tiếp (Manager Cascade Alignment)",
        "Cho phép nhân viên xem danh mục các mục tiêu trọng tâm của Quản lý trực tiếp để tự chọn mục tiêu hỗ trợ (Contribute) cho sếp của mình.",
        "Input: Manager ID của người dùng; Request GET /api/v1/okr/manager-objectives.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Truy vấn các mục tiêu đã được duyệt của Quản lý trực tiếp. 2. Hiển thị danh sách kèm nút [Đóng góp cho mục tiêu này]. 3. Liên kết khóa ngoại parent_objective_id.\n"
        "Output: Mục tiêu của nhân viên được gắn liên kết trực tiếp với mục tiêu của sếp.\n"
        "Kết quả cuối cùng: Tạo ra sự cộng hưởng sức mạnh tuyệt đối, mục tiêu của nhân viên trực tiếp thúc đẩy thành công của cấp quản lý.",
        "GET /api/v1/okr/manager-objectives",
        "QA Verify: Mở S21 -> Thấy tab 'Mục tiêu của Sếp' -> Chọn đóng góp -> Sơ đồ cây liên kết chuẩn.",
        "Ready for Test & Verify", "Fullstack Dev", "Đặc tả tính năng tiện ích C17."
    ),
    (
        "Quản Trị & Đánh Giá OKR", "[S26]", "OKR-CONV-05", "P0",
        "Tiện Ích C18: Hệ Thống Cảnh Báo Vượt Hạn Ngạch Hiệu Chuẩn Bằng Màu Sắc (Calibration Visual Quotas)",
        "Đổi màu thanh tiến độ đầu mỗi cột hiệu chuẩn (Xanh khi đúng chuẩn, Cam khi mấp mé ngưỡng, Đỏ khi vượt quá hạn ngạch) giúp Hội đồng hiệu chuẩn cân đối tức thời trong quá trình họp.",
        "Input: Tỷ lệ % phân bổ thực tế trên từng cột Kanban tại S26.\n"
        "Xử lý hệ thống & Lưu trữ: 1. Frontend tính toán liên tục: Cột A <= 15% (Xanh), > 15% (Đỏ nhấp nháy). 2. Hiển thị số lượng nhân sự cụ thể: 'Đang chọn 15/100 người (15.0% - Hợp lệ)'.\n"
        "Output: Hiệu ứng thị giác cảnh báo trực quan, phản hồi tức thì sau mỗi thao tác thả thẻ.\n"
        "Kết quả cuối cùng: Cuộc họp hiệu chuẩn của Ban Lãnh đạo diễn ra nhanh chóng, chính xác, không cần mở máy tính bấm tay.",
        "N/A (Frontend Visual Quotas)",
        "QA Verify: Thả người thứ 16 vào cột A -> Thanh tiêu đề cột A lập tức đổi sang màu đỏ cảnh báo.",
        "Ready for Test & Verify", "Frontend Dev", "Đặc tả tính năng tiện ích C18."
    )
]

def build_excel():
    wb = openpyxl.Workbook()
    wb.remove(wb.active) # Remove default sheet

    FONT_HEADER = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    FILL_HEADER = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid") # Navy Blue
    
    FONT_DATA = Font(name="Calibri", size=10)
    FONT_CODE = Font(name="Consolas", size=9.5, bold=True, color="1E40AF")
    FONT_PRIORITY_P0 = Font(name="Calibri", size=10, bold=True, color="B91C1C")
    FONT_STATUS_READY = Font(name="Calibri", size=10, bold=True, color="166534")
    FILL_STATUS_READY = PatternFill(start_color="DCFCE7", end_color="DCFCE7", fill_type="solid")
    
    FILL_ROW_ALT = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")
    FILL_ROW_WHITE = PatternFill(start_color="FFFFFF", end_color="FFFFFF", fill_type="solid")
    
    BORDER_THIN = Border(
        left=Side(style='thin', color='CBD5E1'),
        right=Side(style='thin', color='CBD5E1'),
        top=Side(style='thin', color='CBD5E1'),
        bottom=Side(style='thin', color='CBD5E1')
    )
    
    ALIGN_HEADER = Alignment(horizontal="center", vertical="center", wrap_text=True)
    ALIGN_CENTER = Alignment(horizontal="center", vertical="top")
    ALIGN_LEFT = Alignment(horizontal="left", vertical="top", wrap_text=True)

    headers = [
        "STT",
        "Phân Hệ (Module)",
        "Mã Màn Hình (Screen ID)",
        "Mã Tính Năng (Feature Code)",
        "Mức Độ Ưu Tiên (Priority)",
        "Tên Tính Năng (Feature Name)",
        "Mô Tả Nghiệp Vụ (Business Description)",
        "Expected Behaviour (Cách Hệ Thống Xử Lý - Input, Output, Hành Động Lưu Trữ & Kết Quả Đạt Được)",
        "Backend API Endpoint",
        "Hướng Dẫn Test / Verify (QA Steps UI & API)",
        "Trạng Thái (Status)",
        "Phụ Trách (Assignee)",
        "Ghi Chú Kỹ Thuật (Technical Notes)"
    ]

    col_widths = [6, 20, 14, 18, 10, 32, 42, 68, 28, 48, 18, 16, 32]

    sheets_data = [
        ("Nền Tảng Dùng Chung", shared_core_rows + additional_core_rows),
        ("Chấm Công & Đơn Từ", attendance_rows + additional_attendance_rows),
        ("Quản Trị & Đánh Giá OKR", okr_rows + additional_okr_rows)
    ]

    total_all_features = 0

    for sheet_title, rows in sheets_data:
        ws = wb.create_sheet(title=sheet_title)
        ws.views.sheetView[0].showGridLines = True
        ws.freeze_panes = "A2" # Freeze header row
        
        # Write headers
        ws.append(headers)
        ws.row_dimensions[1].height = 36
        for col_idx in range(1, len(headers) + 1):
            cell = ws.cell(row=1, column=col_idx)
            cell.font = FONT_HEADER
            cell.fill = FILL_HEADER
            cell.alignment = ALIGN_HEADER
            cell.border = BORDER_THIN

        # Write data rows
        for row_idx, r in enumerate(rows, start=1):
            row_num = row_idx + 1
            ws.row_dimensions[row_num].height = 110 # Ample height for multi-line expected behaviour
            
            # STT + row fields
            row_data = [row_idx] + list(r)
            ws.append(row_data)

            is_alt = (row_idx % 2 == 0)
            row_fill = FILL_ROW_ALT if is_alt else FILL_ROW_WHITE

            for col_idx in range(1, len(row_data) + 1):
                cell = ws.cell(row=row_num, column=col_idx)
                cell.fill = row_fill
                cell.border = BORDER_THIN
                cell.font = FONT_DATA

                # Custom alignments & fonts per column
                if col_idx in [1, 3, 5, 11, 12]: # STT, Screen, Priority, Status, Assignee
                    cell.alignment = ALIGN_CENTER
                else:
                    cell.alignment = ALIGN_LEFT

                if col_idx == 4: # Feature Code
                    cell.font = FONT_CODE
                    cell.alignment = ALIGN_CENTER

                if col_idx == 5: # Priority
                    cell.font = FONT_PRIORITY_P0

                if col_idx == 11: # Status
                    cell.font = FONT_STATUS_READY
                    cell.fill = FILL_STATUS_READY

        # Set column widths
        for col_idx, width in enumerate(col_widths, start=1):
            col_letter = get_column_letter(col_idx)
            ws.column_dimensions[col_letter].width = width

        print(f"Sheet '{sheet_title}': Generated {len(rows)} features.")
        total_all_features += len(rows)

    wb.save("ACT_HR_2026_Project_Tracking.xlsx")
    print(f"\nSuccessfully generated ACT_HR_2026_Project_Tracking.xlsx with TOTAL {total_all_features} granular features!")

if __name__ == "__main__":
    build_excel()
