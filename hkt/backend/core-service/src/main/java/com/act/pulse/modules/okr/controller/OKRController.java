package com.act.pulse.modules.okr.controller;

import com.act.pulse.common.response.ApiResponse;
import com.act.pulse.modules.okr.dto.request.OKRAssessmentRequest;
import com.act.pulse.modules.okr.dto.response.OKRReviewResponse;
import com.act.pulse.modules.okr.service.OKRService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.*;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/okr")
@RequiredArgsConstructor
@Tag(name = "3. OKR & Performance Appraisal API", description = "Quản trị mục tiêu, form đánh giá 4 Box, chấm điểm 1-5 nguyên, báo cáo HR 9 trường và Calibration Board")
public class OKRController {

    private final OKRService okrService;

    // --- DTOs ---
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class OKRDashboardDto {
        private String currentPhase; // SETUP, CHECKIN, MIDYEAR, ASSESSMENT
        private String phaseTitle;
        private double businessProgress;
        private double peopleProgress;
        private double overallProgress;
        private int totalObjectives;
        private int totalKeyResults;
        private String previousYearRating;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ObjectiveDto {
        private String id;
        private String title;
        private String category; // BUSINESS, PEOPLE
        private boolean isCompanyAligned;
        private double weight;
        private double progress;
        private List<KeyResultDto> keyResults;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class KeyResultDto {
        private String id;
        private String title;
        private String metricType; // NUMERIC, CURRENCY, PERCENTAGE, MILESTONE
        private double startValue;
        private double targetValue;
        private double currentValue;
        private String unit;
        private double progress;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Form4BoxReviewRequest {
        private String employeeCode;
        private Integer year;
        private String box1Achievements;
        private Integer box2BusinessScore; // 1, 2, 3, 4, 5 Integer
        private String box2BusinessComment;
        private Integer box3PeopleScore; // 1, 2, 3, 4, 5 Integer
        private String box3PeopleComment;
        private String box4SelfProposal;
        private String evidenceAttachmentUrl;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ManagerAssessRequest {
        private String employeeCode;
        private Integer managerBusinessScore; // 1, 2, 3, 4, 5 Integer
        private Integer managerPeopleScore; // 1, 2, 3, 4, 5 Integer
        private String managerComment;
        private String assessorCode;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CalibrationMoveCardRequest {
        private String employeeCode;
        private String targetGrade; // GRADE_A, GRADE_B, GRADE_C, GRADE_D
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class HRSummaryReportItem {
        private int stt;
        private String fullName;
        private String employeeCode;
        private String jobTitle;
        private String seniority; // Thời gian công tác
        private String department;
        private String directManagerName;
        private int businessScore; // 1 - 5
        private int peopleScore; // 1 - 5
        private double averageScore; // (Business + People) / 2
        private String status; // CHUA_TU_DANH_GIA, CHO_QL_CHAM, DA_HOAN_TAT
        private String finalGrade; // A, B, C, D
    }

    // In-Memory store for OKRs
    private static final Map<String, Form4BoxReviewRequest> REVIEWS_DB = Collections.synchronizedMap(new HashMap<>());
    private static final Map<String, String> CALIBRATION_RANKS = Collections.synchronizedMap(new HashMap<>());
    private static boolean IS_RATIFIED = false;

    static {
        // Seed default ratings
        CALIBRATION_RANKS.put("136ACT", "GRADE_B");
        CALIBRATION_RANKS.put("05ACT", "GRADE_A");
        CALIBRATION_RANKS.put("01HR", "GRADE_B");
        CALIBRATION_RANKS.put("Admin", "GRADE_A");
    }

    // --- Endpoints ---

    @GetMapping("/my-dashboard")
    @Operation(summary = "Dashboard OKR cá nhân & tiến độ chu kỳ 4 giai đoạn (S20)")
    public ApiResponse<OKRDashboardDto> getDashboard(@RequestParam(defaultValue = "2026") Integer year) {
        OKRDashboardDto dto = OKRDashboardDto.builder()
                .currentPhase("CHECKIN")
                .phaseTitle("Giai đoạn 2: Check-in Tiến Độ Định Kỳ Tháng 11/2026")
                .businessProgress(78.5)
                .peopleProgress(85.0)
                .overallProgress(81.75)
                .totalObjectives(4)
                .totalKeyResults(9)
                .previousYearRating("Xếp loại A (Xuất sắc) - Năm 2025")
                .build();
        return ApiResponse.ok(dto, "Lấy thông tin Dashboard OKR thành công");
    }

    @GetMapping("/company-objectives")
    @Operation(summary = "Danh sách mục tiêu chiến lược của công ty 20% (S21, C12)")
    public ApiResponse<List<ObjectiveDto>> getCompanyObjectives() {
        List<ObjectiveDto> list = List.of(
                ObjectiveDto.builder()
                        .id("comp-01")
                        .title("Đạt mốc 10,000 người dùng hoạt động hàng ngày (DAU)")
                        .category("BUSINESS")
                        .isCompanyAligned(true)
                        .weight(10.0)
                        .progress(80.0)
                        .keyResults(List.of(
                                KeyResultDto.builder().id("kr-c1").title("Tăng trưởng người dùng mới 30%").metricType("PERCENTAGE").startValue(0).targetValue(30).currentValue(24).unit("%").progress(80.0).build()
                        ))
                        .build(),
                ObjectiveDto.builder()
                        .id("comp-02")
                        .title("Xây dựng văn hóa học tập liên tục và chuyển đổi số nội bộ")
                        .category("PEOPLE")
                        .isCompanyAligned(true)
                        .weight(10.0)
                        .progress(90.0)
                        .keyResults(List.of(
                                KeyResultDto.builder().id("kr-c2").title("100% nhân sự hoàn thành khóa đào tạo văn hóa bảo mật").metricType("PERCENTAGE").startValue(0).targetValue(100).currentValue(90).unit("%").progress(90.0).build()
                        ))
                        .build()
        );
        return ApiResponse.ok(list, "Lấy mục tiêu chiến lược công ty 20% thành công");
    }

    @PostMapping("/clone-company-objective")
    @Operation(summary = "1-chạm sao chép mục tiêu công ty vào OKR cá nhân (C12)")
    public ApiResponse<Boolean> cloneCompanyObjective(@RequestParam String objectiveId) {
        return ApiResponse.ok(true, "Đã sao chép mục tiêu chiến lược công ty vào bộ OKR cá nhân thành công!");
    }

    @PostMapping("/objectives")
    @Operation(summary = "Tạo mục tiêu cá nhân mới (80% còn lại - S21)")
    public ApiResponse<Map<String, Object>> createObjective(@RequestBody Map<String, Object> payload) {
        Map<String, Object> obj = new HashMap<>(payload);
        obj.put("id", "OBJ-" + System.currentTimeMillis());
        obj.put("progress", 0.0);
        return ApiResponse.ok(obj, "Tạo mục tiêu cá nhân thành công");
    }

    @PostMapping("/key-results")
    @Operation(summary = "Thêm Key Result định lượng cho mục tiêu (S21)")
    public ApiResponse<Map<String, Object>> createKeyResult(@RequestBody Map<String, Object> payload) {
        Map<String, Object> kr = new HashMap<>(payload);
        kr.put("id", "KR-" + System.currentTimeMillis());
        kr.put("progress", 0.0);
        return ApiResponse.ok(kr, "Thêm kết quả then chốt KR thành công");
    }

    @PostMapping("/submit-setup")
    @Operation(summary = "Ràng buộc tổng trọng số 100% & Gửi Quản lý duyệt đầu năm (S21)")
    public ResponseEntity<ApiResponse<Boolean>> submitSetup(@RequestBody Map<String, Object> payload) {
        Object val = payload != null ? payload.getOrDefault("totalWeight", 100) : 100;
        int totalWeight = 100;
        if (val instanceof Number n) {
            totalWeight = n.intValue();
        } else if (val != null) {
            try {
                totalWeight = Integer.parseInt(val.toString().trim());
            } catch (Exception ignored) {}
        }
        if (totalWeight != 100) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Tổng trọng số của bộ mục tiêu phải bằng đúng 100% (Hiện tại: " + totalWeight + "%)"));
        }
        return ResponseEntity.ok(ApiResponse.ok(true, "Đã gửi bộ mục tiêu OKR cho Quản lý trực tiếp phê duyệt thành công!"));
    }

    @PutMapping("/reviews/{id}/approve-setup")
    @Operation(summary = "Quản lý phê duyệt hoặc trả lại bộ mục tiêu đầu năm (S42)")
    public ApiResponse<Boolean> approveSetup(
            @PathVariable String id,
            @RequestParam(defaultValue = "APPROVE") String action,
            @RequestParam(required = false) String feedback
    ) {
        boolean isApproved = "APPROVE".equalsIgnoreCase(action);
        return ApiResponse.ok(true, isApproved ? "Quản lý đã phê duyệt bộ mục tiêu OKR đầu năm!" : "Đã trả lại yêu cầu chỉnh sửa kèm nhận xét.");
    }

    @GetMapping("/check-in/current")
    @Operation(summary = "Kế thừa tự động tiến độ kỳ trước để check-in (C13 / S22)")
    public ApiResponse<Map<String, Object>> getCurrentCheckinData() {
        Map<String, Object> data = Map.of(
                "kr1_prevProgress", 60.0,
                "kr2_prevProgress", 75.0,
                "kr3_prevProgress", 80.0,
                "month", "Tháng 11/2026"
        );
        return ApiResponse.ok(data, "Lấy dữ liệu kế thừa check-in kỳ trước thành công");
    }

    @PostMapping("/check-in")
    @Operation(summary = "Nộp check-in tiến độ định kỳ kèm file bằng chứng (S22)")
    public ApiResponse<Boolean> submitCheckin(@RequestBody Map<String, Object> payload) {
        return ApiResponse.ok(true, "Cập nhật tiến độ check-in thành công!");
    }

    @PostMapping("/midyear-reviews")
    @Operation(summary = "Ghi nhận biên bản đánh giá & coaching giữa năm 1-on-1 (S43)")
    public ApiResponse<Boolean> submitMidyearReview(@RequestBody Map<String, Object> payload) {
        return ApiResponse.ok(true, "Đã lưu biên bản đánh giá & coaching giữa năm 1-on-1 thành công");
    }

    @GetMapping("/reviews/form-4box")
    @Operation(summary = "Lấy dữ liệu Form 4 Box chuẩn ACT (S23)")
    public ApiResponse<Map<String, Object>> getForm4Box(@RequestParam(defaultValue = "136ACT") String employeeCode) {
        Map<String, Object> form = new HashMap<>();
        form.put("employeeCode", employeeCode);
        form.put("box1_achievements", "Hoàn thành xuất sắc dự án ACT-HKT 2026 đúng tiến độ. Tối ưu hệ thống đạt uptime 99.9%.");
        form.put("box2_businessScore", 4);
        form.put("box2_businessComment", "Đạt và vượt các chỉ tiêu kinh doanh và công nghệ.");
        form.put("box3_peopleScore", 5);
        form.put("box3_peopleComment", "Tích cực đào tạo, chia sẻ kiến thức chuyên môn cho các thành viên mới.");
        form.put("box4_selfProposal", "Nguyện vọng tham gia chương trình đào tạo Tech Lead và chứng chỉ Cloud Architect.");
        form.put("selfAverageScore", 4.5);
        return ApiResponse.ok(form, "Lấy dữ liệu Form 4 Box thành công");
    }

    @PostMapping("/reviews/submit-self-review")
    @Operation(summary = "Nhân viên nộp bản tự đánh giá cuối năm Form 4 Box (S23)")
    public ResponseEntity<ApiResponse<Map<String, Object>>> submitSelfReview(@Valid @RequestBody Form4BoxReviewRequest req) {
        // Validate score is integer 1 to 5
        if (req.getBox2BusinessScore() == null || req.getBox2BusinessScore() < 1 || req.getBox2BusinessScore() > 5) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Điểm mục tiêu công việc (Box 2) phải là số nguyên từ 1 đến 5 (theo quy định doc/OKR_doc.md)"));
        }
        if (req.getBox3PeopleScore() == null || req.getBox3PeopleScore() < 1 || req.getBox3PeopleScore() > 5) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Điểm mục tiêu con người (Box 3) phải là số nguyên từ 1 đến 5 (theo quy định doc/OKR_doc.md)"));
        }

        double avg = (req.getBox2BusinessScore() + req.getBox3PeopleScore()) / 2.0;
        REVIEWS_DB.put(req.getEmployeeCode(), req);

        Map<String, Object> res = new HashMap<>();
        res.put("selfAverageScore", avg);
        res.put("status", "CHO_QL_CHAM");
        res.put("message", "Nộp bản tự đánh giá cuối năm Form 4 Box thành công! Điểm trung bình tự đánh giá: " + avg);

        return ResponseEntity.ok(ApiResponse.ok(res, "Đã nộp bản tự đánh giá thành công"));
    }

    @PostMapping("/reviews/{id}/manager-assess")
    @Operation(summary = "Quản lý chấm điểm độc lập 1-5 nguyên & nhận xét nhân viên (S24)")
    public ApiResponse<Map<String, Object>> managerAssess(
            @PathVariable String id,
            @RequestBody ManagerAssessRequest req
    ) {
        if (req.getManagerBusinessScore() == null || req.getManagerBusinessScore() < 1 || req.getManagerBusinessScore() > 5) {
            throw new RuntimeException("Điểm công việc Quản lý chấm phải là số nguyên từ 1 đến 5");
        }
        if (req.getManagerPeopleScore() == null || req.getManagerPeopleScore() < 1 || req.getManagerPeopleScore() > 5) {
            throw new RuntimeException("Điểm con người Quản lý chấm phải là số nguyên từ 1 đến 5");
        }

        double managerAvg = (req.getManagerBusinessScore() + req.getManagerPeopleScore()) / 2.0;

        Map<String, Object> res = new HashMap<>();
        res.put("managerAverageScore", managerAvg);
        res.put("status", "DA_HOAN_TAT");

        return ApiResponse.ok(res, "Quản lý hoàn tất đánh giá nhân viên thành công! Điểm trung bình: " + managerAvg);
    }

    @GetMapping("/admin/hr-summary-report")
    @Operation(summary = "Bảng tổng hợp đánh giá HR chuẩn 9 trường theo doc/OKR_doc.md Bước 5 (S25)")
    public ApiResponse<List<HRSummaryReportItem>> getHrSummaryReport(@RequestParam(defaultValue = "2026") Integer year) {
        List<HRSummaryReportItem> report = List.of(
                HRSummaryReportItem.builder().stt(1).fullName("Quản Trị Viên Hệ Thống").employeeCode("Admin").jobTitle("System Admin").seniority("5 năm").department("Ban Quản Trị").directManagerName("Ban Giám Đốc").businessScore(5).peopleScore(5).averageScore(5.0).status("DA_HOAN_TAT").finalGrade("A").build(),
                HRSummaryReportItem.builder().stt(2).fullName("Nguyễn Thị Thu Hà").employeeCode("01HR").jobTitle("Trưởng Phòng Nhân Sự").seniority("4 năm").department("Phòng Nhân Sự").directManagerName("Ban Giám Đốc").businessScore(4).peopleScore(4).averageScore(4.0).status("DA_HOAN_TAT").finalGrade("B").build(),
                HRSummaryReportItem.builder().stt(3).fullName("Nguyễn Thanh Tùng").employeeCode("05ACT").jobTitle("Tech Lead").seniority("3.5 năm").department("Khối Kỹ Thuật (Sirius)").directManagerName("Ban Giám Đốc").businessScore(5).peopleScore(4).averageScore(4.5).status("DA_HOAN_TAT").finalGrade("A").build(),
                HRSummaryReportItem.builder().stt(4).fullName("Vũ Văn Luận").employeeCode("136ACT").jobTitle("Senior Backend Dev").seniority("2.5 năm").department("Khối Kỹ Thuật (Optimus)").directManagerName("Nguyễn Thanh Tùng").businessScore(4).peopleScore(4).averageScore(4.0).status("DA_HOAN_TAT").finalGrade("B").build()
        );
        return ApiResponse.ok(report, "Lấy bảng tổng hợp HR 9 trường thành công");
    }

    @GetMapping("/calibration/board")
    @Operation(summary = "Hội đồng hiệu chuẩn phân phối chuẩn Bell Curve dạng Kanban (S26)")
    public ApiResponse<Map<String, Object>> getCalibrationBoard(@RequestParam(defaultValue = "2026") Integer year) {
        Map<String, Object> board = new HashMap<>();

        Map<String, Object> gradeA = Map.of(
                "title", "Xuất Sắc (Grade A)",
                "quotaMaxPercent", 15.0,
                "currentCount", 2,
                "currentPercent", 14.3,
                "isExceeded", false,
                "members", List.of("Admin", "05ACT")
        );
        Map<String, Object> gradeB = Map.of(
                "title", "Tốt (Grade B)",
                "quotaRange", "60% - 70%",
                "currentCount", 9,
                "currentPercent", 64.3,
                "members", List.of("01HR", "136ACT")
        );
        Map<String, Object> gradeC = Map.of(
                "title", "Đạt (Grade C)",
                "quotaRange", "15% - 20%",
                "currentCount", 3,
                "currentPercent", 21.4,
                "members", List.of()
        );
        Map<String, Object> gradeD = Map.of(
                "title", "Cần Cải Thiện (Grade D)",
                "quotaMaxPercent", 5.0,
                "currentCount", 0,
                "currentPercent", 0.0,
                "members", List.of()
        );

        board.put("gradeA", gradeA);
        board.put("gradeB", gradeB);
        board.put("gradeC", gradeC);
        board.put("gradeD", gradeD);
        board.put("isRatified", IS_RATIFIED);

        return ApiResponse.ok(board, "Lấy dữ liệu Calibration Board thành công");
    }

    @PutMapping("/calibration/move-card")
    @Operation(summary = "Kéo thả nhân viên giữa các cột xếp loại hiệu chuẩn (S26)")
    public ApiResponse<Boolean> moveCard(@RequestBody CalibrationMoveCardRequest req) {
        CALIBRATION_RANKS.put(req.getEmployeeCode(), req.getTargetGrade());
        return ApiResponse.ok(true, "Đã di chuyển nhân sự sang " + req.getTargetGrade());
    }

    @PostMapping("/calibration/ratify")
    @Operation(summary = "Ban Giám Đốc phê duyệt chốt xếp loại hiệu suất cuối cùng (S26)")
    public ApiResponse<Boolean> ratifyCalibration() {
        IS_RATIFIED = true;
        return ApiResponse.ok(true, "Ban Giám Đốc đã phê duyệt chốt xếp loại hiệu suất thành công! Chu kỳ OKR 2026 chính thức hoàn tất.");
    }

    @GetMapping("/analytics/executive-summary")
    @Operation(summary = "Báo cáo hiệu suất tổng thể doanh nghiệp (S44)")
    public ApiResponse<Map<String, Object>> getAnalyticsSummary() {
        Map<String, Object> data = Map.of(
                "averageCompanyScore", 4.38,
                "topDepartment", "Khối Kỹ Thuật (4.65)",
                "highPerformersCount", 12,
                "topPerformers", List.of(
                        Map.of("code", "05ACT", "name", "Nguyễn Thanh Tùng", "score", 4.8),
                        Map.of("code", "136ACT", "name", "Vũ Văn Luận", "score", 4.5)
                )
        );
        return ApiResponse.ok(data, "Lấy báo cáo phân tích hiệu suất thành công");
    }

    @GetMapping("/my-review")
    @Operation(summary = "Xem hồ sơ OKR cá nhân theo năm")
    public ApiResponse<OKRReviewResponse> getMyReview(@RequestParam(defaultValue = "2026") Integer year) {
        UUID userId = UUID.randomUUID();
        return ApiResponse.ok(okrService.getMyReview(userId, year), "Lấy thông tin OKR thành công");
    }

    @PostMapping("/assessment")
    @Operation(summary = "Nhân viên nộp tự đánh giá cuối năm (Box 2 & Box 3)")
    public ApiResponse<OKRReviewResponse> submitAssessment(
            @RequestParam(defaultValue = "2026") Integer year,
            @Valid @RequestBody OKRAssessmentRequest request
    ) {
        UUID userId = UUID.randomUUID();
        return ApiResponse.ok(okrService.submitAssessment(userId, year, request), "Nộp đánh giá OKR thành công");
    }

    @GetMapping("/alignment-tree")
    @Operation(summary = "Cây phả hệ mục tiêu toàn doanh nghiệp (OKR Alignment Tree - OKR-TREE-01)")
    public ApiResponse<Map<String, Object>> getAlignmentTree() {
        return ApiResponse.ok(Map.of(
                "companyGoal", "Đạt mốc 10,000 người dùng hoạt động hàng ngày (DAU)",
                "departments", List.of(
                        Map.of("name", "Khối Kỹ Thuật", "contributionPercent", 45, "lead", "05ACT"),
                        Map.of("name", "Phòng Nhân Sự", "contributionPercent", 25, "lead", "01HR")
                )
        ), "Lấy cây liên kết mục tiêu toàn doanh nghiệp thành công");
    }

    @PostMapping("/check-in/submit")
    @Operation(summary = "Đính kèm file minh chứng & lưu lịch sử check-in (OKR-CHK-02)")
    public ApiResponse<Boolean> submitCheckinEvidence(@RequestBody(required = false) Map<String, Object> payload) {
        return ApiResponse.ok(true, "Đã lưu kết quả check-in và file minh chứng thành công");
    }

    @GetMapping("/reviews/my-review")
    @Operation(summary = "Xem hồ sơ tự đánh giá Form 4 Box của tôi (OKR-REV-01)")
    public ApiResponse<Map<String, Object>> getForm4BoxMyReview(@RequestParam(defaultValue = "2026") Integer year) {
        return getForm4Box("136ACT");
    }

    @PutMapping("/reviews/{id}/box1")
    @Operation(summary = "Cập nhật Box 1 Thành tựu nổi bật (OKR-REV-02)")
    public ApiResponse<Boolean> updateBox1(@PathVariable String id, @RequestBody Map<String, String> payload) {
        return ApiResponse.ok(true, "Cập nhật Box 1 thành công");
    }

    @PutMapping("/reviews/{id}/box2-3")
    @Operation(summary = "Cập nhật Box 2 & Box 3 điểm số nguyên 1-5 (OKR-REV-03)")
    public ApiResponse<Boolean> updateBox2And3(@PathVariable String id, @RequestBody Map<String, Object> payload) {
        return ApiResponse.ok(true, "Cập nhật điểm Box 2 & Box 3 thành công");
    }

    @PutMapping("/reviews/{id}/box4")
    @Operation(summary = "Cập nhật Box 4 Nguyện vọng & phát triển (OKR-REV-04)")
    public ApiResponse<Boolean> updateBox4(@PathVariable String id, @RequestBody Map<String, String> payload) {
        return ApiResponse.ok(true, "Cập nhật Box 4 thành công");
    }

    @GetMapping("/admin/export-excel")
    @Operation(summary = "Xuất báo cáo tổng hợp OKR ra file Excel (OKR-RPT-02)")
    public ApiResponse<Map<String, String>> exportOkrExcel(@RequestParam(defaultValue = "2026") Integer year) {
        return ApiResponse.ok(Map.of(
                "downloadUrl", "/exports/Bao_Cao_Tong_Hop_OKR_" + year + ".xlsx",
                "fileName", "Bao_Cao_Tong_Hop_OKR_" + year + ".xlsx"
        ), "Xuất file Excel tổng hợp OKR thành công");
    }

    @GetMapping("/templates")
    @Operation(summary = "Thư viện mẫu OKR chuẩn theo chức danh (OKR-CONV-03)")
    public ApiResponse<List<Map<String, Object>>> getTemplates(@RequestParam(defaultValue = "3") Integer jobTitleId) {
        return ApiResponse.ok(List.of(
                Map.of("id", "tpl-1", "title", "Tối ưu hóa hiệu năng & độ tin cậy hệ thống", "category", "BUSINESS"),
                Map.of("id", "tpl-2", "title", "Đào tạo và chia sẻ kiến thức công nghệ cho team", "category", "PEOPLE")
        ), "Lấy thư viện mẫu OKR thành công");
    }

    @GetMapping("/manager-objectives")
    @Operation(summary = "Kế thừa mục tiêu từ quản lý trực tiếp (OKR-CONV-04)")
    public ApiResponse<List<Map<String, Object>>> getManagerObjectives() {
        return ApiResponse.ok(List.of(
                Map.of("managerCode", "05ACT", "title", "Hoàn thành giai đoạn 1 dự án chuyển đổi số ACT", "weight", 30)
        ), "Lấy mục tiêu của Quản lý trực tiếp thành công");
    }

    @GetMapping("/media/preview/{fileId}")
    @Operation(summary = "Trình xem nhanh file minh chứng (OKR-CONV-02)")
    public ApiResponse<Map<String, String>> previewFile(@PathVariable String fileId) {
        return ApiResponse.ok(Map.of("fileId", fileId, "previewUrl", "/files/preview/" + fileId), "Lấy thông tin file minh chứng thành công");
    }
}
