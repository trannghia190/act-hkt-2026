package com.act.pulse.modules.okr.controller;

import com.act.pulse.common.response.ApiResponse;
import com.act.pulse.common.security.CurrentUser;
import com.act.pulse.modules.attendance.repository.TeamRepository;
import com.act.pulse.modules.auth.entity.User;
import com.act.pulse.modules.auth.repository.UserRepository;
import com.act.pulse.modules.okr.entity.OKRCycle;
import com.act.pulse.modules.okr.entity.OKRItem;
import com.act.pulse.modules.okr.entity.OKRReview;
import com.act.pulse.modules.okr.repository.OKRCheckInRepository;
import com.act.pulse.modules.okr.repository.OKRItemRepository;
import com.act.pulse.modules.okr.repository.OKRReviewRepository;
import com.act.pulse.modules.okr.service.OKRManagementService;
import com.act.pulse.modules.okr.service.OKRPhaseService;
import com.act.pulse.modules.okr.service.OKRRuleException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.*;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * OKR cá nhân (F1 dashboard, F2 tạo OKR, F4 duyệt, F6 đánh giá cuối năm, F7 review nhóm, F8 báo cáo HR).
 * Mọi tham số year là tuỳ chọn — mặc định lấy năm của chu kỳ đang active.
 */
@RestController
@RequestMapping("/okr")
@RequiredArgsConstructor
@Tag(name = "3. OKR & Performance Appraisal API", description = "Quản trị mục tiêu, form đánh giá 4 Box, chấm điểm 1-5 nguyên ở tầng nhóm, báo cáo HR 9 trường (không xếp loại)")
public class OKRController {

    private static final DateTimeFormatter VN_DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private final OKRReviewRepository okrReviewRepository;
    private final OKRItemRepository okrItemRepository;
    private final OKRCheckInRepository okrCheckInRepository;
    private final UserRepository userRepository;
    private final TeamRepository teamRepository;
    private final OKRManagementService management;
    private final OKRPhaseService phaseService;
    private final com.act.pulse.modules.okr.service.OKRReviewProvisioningJob provisioning;

    // ======================================================================== DTOs

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class OKRDashboardDto {
        private Integer cycleYear;
        private String currentPhase; // SETUP | MIDYEAR | FINAL | NONE
        private String phaseTitle;
        private String phaseStatus; // active | upcoming | locked
        /** false = hiện tại chưa có chu kỳ OKR nào được thiết lập (HR chưa kích hoạt chu kỳ). */
        private Boolean hasActiveCycle;
        private List<Map<String, Object>> phases;
        private String reviewStatus;
        private double businessProgress;
        private double peopleProgress;
        private double overallProgress;
        private int totalObjectives;
        private Double businessScore;
        private Double peopleScore;
        private Double averageScore;
        private String scoreSource; // MANAGER | SELF | null
        private Integer daysLeft;
        private String deadline;
        private String countdownText;
        private Boolean canCheckIn;
        private String checkinPeriod;
        private String checkinDeadline;
        private Integer pendingCheckinCount;
        /** OPEN (còn đầu việc chưa check-in) | DONE (đã đủ kỳ này) | NOT_APPROVED | NO_ITEMS | CLOSED */
        private String checkinState;
        private String checkinStateText;
        private Map<String, Object> selfProposal;
        private List<Map<String, Object>> todos;
        private Integer todoCount;
        private List<Map<String, Object>> companyObjectives;
        private Boolean companyObjectivesExcludedFromAverage;
        private Integer companyObjectivesWeight;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Form4BoxReviewRequest {
        private String employeeCode;
        private Integer year;
        // Box 2 — Business: 4 mục + điểm
        private String box2Results;
        private String box2Adjustments;
        private String box2Difficulties;
        private String box2Lessons;
        private Double box2BusinessScore; // 1..5 nguyên
        // Box 3 — People: 4 mục + điểm
        private String box3Results;
        private String box3Adjustments;
        private String box3Difficulties;
        private String box3Lessons;
        private Double box3PeopleScore; // 1..5 nguyên
        // Tương thích client cũ (4 mục chung ở Box 1 + 1 ô giải trình mỗi nhóm) → map vào Box 2/3
        private String box1Results;
        private String box1Adjustments;
        private String box1Difficulties;
        private String box1Lessons;
        private String box1Achievements;
        private String box2BusinessComment;
        private String box3PeopleComment;
        private String box4Direction;
        private String box4SelfProposal;
        private String box4ImprovementArea;
        private String evidenceAttachmentUrl;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ManagerAssessRequest {
        private String employeeCode;
        private Integer year;
        private Double managerBusinessScore; // 1..5 nguyên
        private Double managerPeopleScore; // 1..5 nguyên
        private String managerComment;
        private String assessorCode;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class HRSummaryReportItem {
        // ---- 9 trường + Note theo doc/OKR_doc.md Bước 5 ----
        private int stt;
        private String fullName;           // 1. Họ và tên
        private String employeeCode;       // 2. Code nhân viên
        private String jobTitle;           // 3. Vị trí
        private String seniority;          // 4. Thời gian công tác: từ ngày vào làm tới mốc HR cấu hình (mặc định 31/12)
        private Boolean newJoiner;         // Vào giữa năm → cần đánh giá theo thời gian thực tế
        private Long monthsWorked;
        private String seniorityNote;
        private String department;         // 5. Phòng ban
        private String directManagerName;  // 6. Tên quản lý
        private Integer businessScore;     // 7. Điểm OKR công việc — CHÍNH THỨC (quản lý chấm), chưa chấm = null
        private Integer peopleScore;       // 8. Điểm OKR con người — CHÍNH THỨC
        private Double averageScore;       // 9. Điểm trung bình OKR = (7 + 8) / 2
        private String note;               // Note — HR ghi trên bảng tổng hợp
        // ---- Thông tin theo dõi thêm ----
        private String reviewId;
        private java.time.LocalDate joinedDate;
        private String status;             // CHUA_CO_OKR | CHUA_TU_DANH_GIA | CHO_QL_CHAM | DA_HOAN_TAT
        private Integer selfBusinessScore; // điểm tự chấm — để đối chiếu, không phải điểm chính thức
        private Integer selfPeopleScore;
        private String managerComment;     // nhận xét của Quản lý khi chấm
        private String scoreSource;        // MANAGER khi đã có điểm chính thức
    }

    // ======================================================================== helpers

    private OKRCycle requireCycle(int year) {
        return phaseService.cycle(year)
                .orElseThrow(() -> OKRRuleException.conflict("Chưa có chu kỳ OKR năm " + year + " — liên hệ HR cấu hình"));
    }

    /**
     * Dự phòng cho job tự tạo đầu kỳ ({@link com.act.pulse.modules.okr.service.OKRReviewProvisioningJob}):
     * nhân viên mở Dashboard / My OKR mà chưa có hồ sơ → tạo ngay. Lỗi ở bước này KHÔNG được chặn màn hình —
     * nhân viên vẫn tự tạo được khi bấm "+ Thêm đầu việc" (API tạo đầu việc tự tạo hồ sơ nếu chưa có).
     */
    private OKRReview safeEnsureReview(User user, OKRCycle cycle) {
        if (cycle == null) return null;
        try {
            return provisioning.ensureFor(user, cycle);
        } catch (Exception e) {
            org.slf4j.LoggerFactory.getLogger(OKRController.class)
                    .warn("Không tự tạo được hồ sơ OKR cho {} — nhân viên vẫn tự tạo khi thêm đầu việc", user.getEmployeeCode(), e);
            return null;
        }
    }

    /** Lấy hoặc tạo hồ sơ OKR của chính mình — chỉ dùng cho thao tác ghi, luôn gắn đúng chu kỳ. */
    private OKRReview getOrCreateMyReview(User user, int year) {
        return okrReviewRepository.findByUserIdAndCycleYear(user.getId(), year).orElseGet(() -> {
            OKRCycle cycle = requireCycle(year);
            phaseService.requireCycleOpen(cycle);
            return okrReviewRepository.save(OKRReview.builder()
                    .userId(user.getId())
                    .managerId(user.getManagerId())
                    .cycleId(cycle.getId())
                    .cycleYear(year)
                    .status("draft")
                    .currentStep(1)
                    .build());
        });
    }

    private static Integer yearOf(Map<String, Object> payload) {
        if (payload == null || payload.get("year") == null || payload.get("year").toString().isBlank()) return null;
        try {
            return Integer.valueOf(payload.get("year").toString());
        } catch (NumberFormatException e) {
            throw OKRRuleException.badRequest("Năm không hợp lệ");
        }
    }

    private static String str(Object v) {
        return v == null ? "" : v.toString().trim();
    }

    private static Map<String, Object> todo(String id, String type, String title, String status, LocalDate deadline,
                                            String actionUrl, String actionText, String priority) {
        Map<String, Object> m = new HashMap<>();
        m.put("id", id);
        m.put("type", type);
        m.put("title", title);
        m.put("status", status);
        m.put("deadline", deadline == null ? null : deadline.toString());
        m.put("daysLeft", deadline == null ? null : (int) Math.max(0, ChronoUnit.DAYS.between(LocalDate.now(), deadline)));
        m.put("actionUrl", actionUrl);
        m.put("actionText", actionText);
        m.put("priority", priority);
        return m;
    }

    /** NV chỉ tự chấm điểm trong phase Đánh giá cuối năm (Review giữa năm chỉ cập nhật tiến độ). */
    private String selfAssessPhase(OKRReview review, OKRCycle cycle) {
        if (cycle == null || phaseService.isCycleLocked(cycle)) return null;
        return phaseService.employeeWindowOpen(cycle, OKRPhaseService.FINAL, review) ? OKRPhaseService.FINAL : null;
    }

    /**
     * Lý do nhân viên không sửa được form tự đánh giá (null = sửa được).
     * Tự chấm chỉ mở trong cửa sổ NV của phase Đánh giá cuối năm.
     */
    private String selfAssessLockReason(OKRReview review, OKRCycle cycle) {
        if (review == null) return "Chưa có OKR trong chu kỳ này";
        if (cycle == null) return "Chưa có chu kỳ OKR";
        if (phaseService.isCycleLocked(cycle)) return "Chu kỳ OKR đã được HR chốt & khoá";
        if (selfAssessPhase(review, cycle) == null) {
            return phaseService.employeeWindowBlockReason(cycle, OKRPhaseService.FINAL, review) != null
                    ? phaseService.employeeWindowBlockReason(cycle, OKRPhaseService.FINAL, review)
                    : "Chỉ tự chấm điểm trong phase Đánh giá cuối năm";
        }
        if (!management.isCurrentlyApproved(review)) return "OKR chưa được duyệt hoặc đang mở sửa — cần Quản lý duyệt lại trước khi tự chấm";
        if (management.managerAssessed(review)) return "Quản lý đã chấm điểm — không sửa tự đánh giá được nữa";
        return null;
    }

    // ======================================================================== F1 Dashboard

    @GetMapping({"/dashboard", "/my-dashboard"})
    @Operation(summary = "Dashboard OKR cá nhân: phase hiện tại, đếm ngược, việc cần làm, điểm 2 nhóm (S20)")
    public ApiResponse<OKRDashboardDto> getDashboard(@RequestParam(required = false) Integer year) {
        User user = management.requireCurrentUser();
        int y = phaseService.resolveYear(year);
        OKRCycle cycle = phaseService.cycle(y).orElse(null);
        OKRReview review = okrReviewRepository.findByUserIdAndCycleYear(user.getId(), y).orElse(null);
        if (review == null) review = safeEnsureReview(user, cycle); // dự phòng khi job đầu kỳ chưa chạy / lỗi
        List<OKRItem> items = review != null ? management.activeItems(review.getId()) : List.of();

        double businessProgress = review == null ? 0 : management.groupProgress(review.getId(), "BUSINESS");
        double peopleProgress = review == null ? 0 : management.groupProgress(review.getId(), "PEOPLE");
        double overallProgress = review == null ? 0 : management.overallProgress(review.getId());

        // Phase chính + đếm ngược
        Map<String, Object> primary = cycle == null ? null : phaseService.primaryPhase(cycle);
        String currentPhase = "NONE";
        String phaseTitle = "Chưa có chu kỳ OKR năm " + y;
        String phaseStatus = null;
        String deadline = null;
        Integer daysLeft = null;
        String countdownText = "Liên hệ HR để cấu hình chu kỳ";
        // Không có chu kỳ nào đang hoạt động → UI hiện empty state thống nhất cho NV và QL.
        boolean hasActiveCycle = cycle != null && "active".equalsIgnoreCase(cycle.getStatus());
        if (primary != null) {
            currentPhase = str(primary.get("key")).toUpperCase();
            String employeeStatus = str(primary.get("effective_status"));
            String managerStatus = str(primary.get("manager_status"));
            boolean managerReviewing = !OKRPhaseService.ACTIVE.equals(employeeStatus)
                    && OKRPhaseService.ACTIVE.equals(managerStatus);
            phaseStatus = managerReviewing ? OKRPhaseService.ACTIVE : employeeStatus;
            String months = str(primary.get("months"));
            phaseTitle = str(primary.get("name")) + (months.isEmpty() ? "" : " (" + months + ")")
                    + (managerReviewing ? " · Quản lý đang review" : "");
            if (managerReviewing) {
                deadline = str(primary.get("review_due"));
                LocalDate reviewDue = OKRPhaseService.parseDate(primary.get("review_due"));
                daysLeft = reviewDue == null ? null : (int) Math.max(0, ChronoUnit.DAYS.between(LocalDate.now(), reviewDue));
            } else {
                deadline = str(primary.get("due_date"));
                daysLeft = primary.get("days_left") == null ? null : ((Number) primary.get("days_left")).intValue();
            }
            if (OKRPhaseService.ACTIVE.equals(phaseStatus)) {
                countdownText = managerReviewing
                        ? "Quản lý đang review — còn " + daysLeft + " ngày (" + deadline + ")"
                        : "Còn " + daysLeft + " ngày đến hạn (" + deadline + ")";
            } else if (OKRPhaseService.UPCOMING.equals(phaseStatus)) {
                countdownText = "Bắt đầu từ " + primary.get("start_date");
            } else {
                countdownText = "Đã khoá sau hạn chót " + deadline;
            }
        }

        // Cập nhật tiến độ chỉ mở trong cửa sổ NV của Review giữa năm / Đánh giá cuối năm.
        String updateWindow = cycle == null ? null : phaseService.updateWindow(cycle, review);
        boolean checkinOpen = updateWindow != null;
        String period = phaseService.currentPeriod(cycle, review);
        String periodLabel = phaseService.periodLabel(period);
        LocalDate checkinDeadline = cycle == null ? null : phaseService.currentPeriodDeadline(cycle, review);
        int pendingCheckin = 0;
        // Cùng điều kiện với API check-in: chỉ check-in khi OKR đang ở trạng thái đã duyệt (locked)
        if (review != null && checkinOpen && management.isCurrentlyApproved(review)) {
            Set<UUID> done = new HashSet<>();
            okrCheckInRepository.findByReviewIdAndPeriodOrderByCreatedAtDesc(review.getId(), period)
                    .forEach(ci -> done.add(ci.getItemId()));
            pendingCheckin = (int) items.stream().filter(i -> !done.contains(i.getId())).count();
        }
        boolean canCheckIn = pendingCheckin > 0;
        String checkinState;
        String checkinStateText;
        if (!checkinOpen) {
            checkinState = "CLOSED";
            String reason;
            if (cycle == null) {
                reason = "Chưa có chu kỳ OKR";
            } else if (review != null && review.getBox2ManagerScore() != null && review.getBox3ManagerScore() != null) {
                reason = "Quản lý đã hoàn tất chấm điểm cuối năm — không cập nhật được nữa";
            } else {
                String mid = phaseService.employeeWindowBlockReason(cycle, OKRPhaseService.MIDYEAR, review);
                String fin = phaseService.employeeWindowBlockReason(cycle, OKRPhaseService.FINAL, review);
                reason = mid != null && mid.contains("Quản lý đang review") ? mid
                        : fin != null && fin.contains("Quản lý đang review") ? fin
                        : "Ngoài kỳ cập nhật tiến độ (Review giữa năm / Đánh giá cuối năm)";
            }
            checkinStateText = reason;
        } else if (review == null || items.isEmpty()) {
            checkinState = "NO_ITEMS";
            checkinStateText = "Chưa có đầu việc OKR để check-in";
        } else if (!management.isCurrentlyApproved(review)) {
            checkinState = "NOT_APPROVED";
            checkinStateText = "submitted".equalsIgnoreCase(review.getStatus())
                    ? "OKR đang chờ Quản lý duyệt — check-in mở lại sau khi được duyệt"
                    : "OKR chưa được duyệt hoặc đang mở sửa — chưa check-in được";
        } else if (canCheckIn) {
            checkinState = "OPEN";
            checkinStateText = "Đến kỳ check-in " + periodLabel + " — còn " + pendingCheckin + "/" + items.size() + " đầu việc chưa cập nhật";
        } else {
            checkinState = "DONE";
            checkinStateText = "Đã check-in đủ " + items.size() + " đầu việc kỳ " + periodLabel;
        }

        // Điểm hiện hành theo cặp — không bịa điểm từ tiến độ
        Object[] scores = management.currentScores(review);
        Double businessScore = scores[0] == null ? null : ((Integer) scores[0]).doubleValue();
        Double peopleScore = scores[1] == null ? null : ((Integer) scores[1]).doubleValue();
        Double averageScore = businessScore != null && peopleScore != null ? (businessScore + peopleScore) / 2.0 : null;

        // Định hướng & đề xuất của kỳ hiện tại — khai báo và gửi kèm bộ mục tiêu
        LocalDate proposalDue = phaseService.dueDate(cycle, OKRPhaseService.SETUP);
        String directionText = review != null && review.getBox4Direction() != null ? review.getBox4Direction() : "";
        String proposalText = review != null && review.getBox4Proposal() != null ? review.getBox4Proposal() : "";
        String improvementArea = review != null && review.getBox4ImprovementArea() != null ? review.getBox4ImprovementArea() : "";
        String proposalReviewStatus = review == null ? "draft" : str(review.getStatus()).toLowerCase();
        boolean proposalSubmitted = "submitted".equals(proposalReviewStatus) || "locked".equals(proposalReviewStatus);
        boolean hasProposalContent = !directionText.isBlank() || !proposalText.isBlank() || !improvementArea.isBlank();
        String proposalStatus = proposalSubmitted ? "SUBMITTED" : hasProposalContent ? "DRAFT" : "NOT_STARTED";
        String proposalStatusText = "SUBMITTED".equals(proposalStatus) ? "Đã gửi kèm OKR"
                : "DRAFT".equals(proposalStatus) ? "Đang viết" : "Chưa viết";
        Map<String, Object> selfProposal = new HashMap<>();
        selfProposal.put("year", y);
        selfProposal.put("status", proposalStatus);
        selfProposal.put("statusText", proposalStatusText);
        selfProposal.put("direction", directionText);
        selfProposal.put("content", proposalText);
        selfProposal.put("improvementArea", improvementArea);
        selfProposal.put("submittedAt", review != null ? review.getSubmittedAt() : null);
        selfProposal.put("deadline", proposalDue == null ? null : proposalDue.toString());
        selfProposal.put("daysLeft", proposalDue == null ? null : (int) Math.max(0, ChronoUnit.DAYS.between(LocalDate.now(), proposalDue)));
        selfProposal.put("editable", management.goalsLockReason(user, review, cycle) == null);
        selfProposal.put("viewUrl", "/okr/my-okr");

        // Việc cần làm — cùng nguồn với Todo Inbox (OKRManagementService.okrTasks)
        // để màn "Cần làm" và dashboard OKR không lệch nhau.
        List<Map<String, Object>> todos = new ArrayList<>();
        for (OKRManagementService.OkrTask task : management.okrTasks(user, y)) {
            todos.add(todo(task.id(), task.type(), task.title(), task.status(), task.deadline(),
                    task.actionUrl(), task.actionText(), task.priority()));
        }

        // Mục tiêu công ty (20%) — HR cấu hình theo chu kỳ, không tính vào điểm TB
        List<Map<String, Object>> companyObjectives = new ArrayList<>();
        for (Map<String, Object> o : phaseService.companyObjectives(cycle)) {
            Map<String, Object> m = new HashMap<>(o);
            m.put("weight", "20%");
            m.putIfAbsent("note", "Mục tiêu chiến lược cấp công ty — không tính vào điểm TB cá nhân");
            companyObjectives.add(m);
        }

        OKRDashboardDto dto = OKRDashboardDto.builder()
                .cycleYear(y)
                .currentPhase(currentPhase)
                .phaseTitle(phaseTitle)
                .phaseStatus(phaseStatus)
                .hasActiveCycle(hasActiveCycle)
                .phases(cycle == null ? List.of() : phaseService.phases(cycle))
                .reviewStatus(review != null ? review.getStatus() : null)
                .businessProgress(Math.round(businessProgress * 10.0) / 10.0)
                .peopleProgress(Math.round(peopleProgress * 10.0) / 10.0)
                .overallProgress(Math.round(overallProgress * 10.0) / 10.0)
                .totalObjectives(items.size())
                .businessScore(businessScore)
                .peopleScore(peopleScore)
                .averageScore(averageScore)
                .scoreSource((String) scores[2])
                .daysLeft(daysLeft)
                .deadline(deadline)
                .countdownText(countdownText)
                .canCheckIn(canCheckIn)
                .checkinPeriod(period)
                .checkinDeadline(checkinDeadline == null ? null : checkinDeadline.toString())
                .pendingCheckinCount(pendingCheckin)
                .checkinState(checkinState)
                .checkinStateText(checkinStateText)
                .selfProposal(selfProposal)
                .todos(todos)
                .todoCount(todos.size())
                .companyObjectives(companyObjectives)
                .companyObjectivesExcludedFromAverage(true)
                .companyObjectivesWeight(20)
                .build();
        return ApiResponse.ok(dto, "Lấy thông tin Dashboard OKR thành công");
    }

    @GetMapping("/company-objectives")
    @Operation(summary = "Mục tiêu chiến lược công ty 20% của chu kỳ (HR cấu hình) — không tính vào điểm TB")
    public ApiResponse<List<Map<String, Object>>> getCompanyObjectives(@RequestParam(required = false) Integer year) {
        OKRCycle cycle = phaseService.cycle(phaseService.resolveYear(year)).orElse(null);
        return ApiResponse.ok(phaseService.companyObjectives(cycle), "Mục tiêu chiến lược công ty");
    }

    // ======================================================================== F2 My OKR

    @GetMapping("/my-okr")
    @Operation(summary = "Chi tiết OKR cá nhân 2 nhóm Business/People, Box 4 và trạng thái (S21)")
    public ApiResponse<Map<String, Object>> getMyOkr(@RequestParam(required = false) Integer year) {
        User user = management.requireCurrentUser();
        int y = phaseService.resolveYear(year);
        OKRCycle cycle = phaseService.cycle(y).orElse(null);
        OKRReview review = okrReviewRepository.findByUserIdAndCycleYear(user.getId(), y).orElse(null);
        if (review == null) review = safeEnsureReview(user, cycle); // dự phòng khi job đầu kỳ chưa chạy / lỗi

        List<OKRItem> allItems = review == null ? List.of() : okrItemRepository.findByReviewIdOrderById(review.getId());
        String lockReason = management.goalsLockReason(user, review, cycle);

        Map<String, Object> data = new HashMap<>();
        // Phase metadata: một workspace duy nhất cho nhân viên, giao diện đổi theo phase hiện tại.
        Map<String, Object> primary = cycle == null ? null : phaseService.primaryPhase(cycle);
        String employeePhaseStatus = primary == null ? null : str(primary.get("effective_status"));
        String managerPhaseStatus = primary == null ? null : str(primary.get("manager_status"));
        boolean managerReviewing = OKRPhaseService.ACTIVE.equals(managerPhaseStatus)
                && !OKRPhaseService.ACTIVE.equals(employeePhaseStatus);
        data.put("phases", cycle == null ? List.of() : phaseService.phases(cycle));
        data.put("currentPhase", primary == null ? "NONE" : str(primary.get("key")).toUpperCase());
        data.put("phaseName", primary == null ? null : primary.get("name"));
        data.put("phaseStatus", managerReviewing ? OKRPhaseService.ACTIVE : employeePhaseStatus);
        data.put("managerReviewing", managerReviewing);
        data.put("hasActiveCycle", cycle != null && "active".equalsIgnoreCase(cycle.getStatus()));
        data.put("updateWindow", cycle == null || review == null ? null : phaseService.updateWindow(cycle, review));
        data.put("reviewId", review != null ? review.getId().toString() : null);
        data.put("cycleYear", y);
        data.put("status", review != null ? review.getStatus() : "draft");
        data.put("isLocked", lockReason != null);
        data.put("lockReason", lockReason);
        data.put("submittedAt", review != null ? review.getSubmittedAt() : null);
        data.put("managerFeedback", review != null ? review.getManagerFeedback() : null);
        data.put("box4Direction", review != null && review.getBox4Direction() != null ? review.getBox4Direction() : "");
        data.put("box4Proposal", review != null && review.getBox4Proposal() != null ? review.getBox4Proposal() : "");
        data.put("box4ImprovementArea", review != null && review.getBox4ImprovementArea() != null ? review.getBox4ImprovementArea() : "");
        data.put("box4SubmittedAt", review != null ? review.getBox4SubmittedAt() : null);
        Object[] scores = management.currentScores(review);
        data.put("businessScore", scores[0]);
        data.put("peopleScore", scores[1]);
        data.put("averageScore", scores[0] == null ? null : ((Integer) scores[0] + (Integer) scores[1]) / 2.0);
        data.put("scoreSource", scores[2]);
        data.put("items", allItems.stream().filter(i -> i.getDeletedAt() == null).toList());
        data.put("deletedItems", allItems.stream().filter(i -> i.getDeletedAt() != null).toList());
        return ApiResponse.ok(data, "Lấy danh sách OKR cá nhân thành công");
    }

    @PostMapping("/objectives")
    @Transactional
    @Operation(summary = "Thêm 1 đầu việc vào nhóm Business/People (S21) — không trọng số, không đính kèm")
    public ResponseEntity<ApiResponse<Map<String, Object>>> createObjective(@RequestBody Map<String, Object> payload) {
        User user = management.requireCurrentUser();
        int year = phaseService.resolveYear(yearOf(payload));
        String title = str(payload.get("title"));
        if (title.isEmpty()) throw OKRRuleException.badRequest("Tên đầu việc không được để trống");

        OKRReview review = getOrCreateMyReview(user, year);
        management.requireGoalsEditable(review);

        String groupType = str(payload.getOrDefault("groupType", payload.get("category")));
        if (!"PEOPLE".equalsIgnoreCase(groupType) && !"BUSINESS".equalsIgnoreCase(groupType)) {
            throw OKRRuleException.badRequest("Nhóm phải là BUSINESS hoặc PEOPLE");
        }
        String detail = str(payload.getOrDefault("detail", payload.get("description")));

        OKRItem item = okrItemRepository.save(OKRItem.builder()
                .reviewId(review.getId())
                .groupType(groupType.toUpperCase())
                .title(title)
                .detail(detail)
                .progress(0)
                .build());
        management.audit(review.getId(), review.getCycleId(), item.getId(), "ADD_ITEM", "title", null, title,
                "Nhân viên thêm đầu việc");

        Map<String, Object> res = new HashMap<>();
        res.put("id", item.getId().toString());
        res.put("groupType", item.getGroupType());
        res.put("title", item.getTitle());
        res.put("detail", item.getDetail());
        res.put("progress", item.getProgress());
        return ResponseEntity.ok(ApiResponse.ok(res, "Tạo mục tiêu cá nhân thành công"));
    }

    @PostMapping("/submit-setup")
    @Transactional
    @Operation(summary = "Gửi bộ mục tiêu OKR cho Quản lý duyệt (S21) — gửi xong khoá sửa")
    public ResponseEntity<ApiResponse<Boolean>> submitSetup(@RequestBody(required = false) Map<String, Object> payload) {
        User user = management.requireCurrentUser();
        int year = phaseService.resolveYear(yearOf(payload));
        OKRReview review = okrReviewRepository.findByUserIdAndCycleYear(user.getId(), year)
                .orElseThrow(() -> OKRRuleException.badRequest("Chưa có đầu việc nào để gửi"));
        management.requireGoalsEditable(review);

        List<OKRItem> activeItems = management.activeItems(review.getId());
        boolean hasBusiness = activeItems.stream().anyMatch(i -> "BUSINESS".equalsIgnoreCase(i.getGroupType()));
        boolean hasPeople = activeItems.stream().anyMatch(i -> "PEOPLE".equalsIgnoreCase(i.getGroupType()));
        if (!hasBusiness || !hasPeople) {
            String missing = !hasBusiness && !hasPeople ? "cả 2 nhóm Business và People"
                    : (!hasBusiness ? "nhóm Business" : "nhóm People");
            throw OKRRuleException.badRequest("Chưa thể gửi OKR: " + missing + " phải có ít nhất 1 đầu việc.");
        }
        // Định hướng & đề xuất của kỳ: gửi kèm bộ mục tiêu, không bắt buộc.
        if (payload != null) {
            if (payload.containsKey("direction")) review.setBox4Direction(str(payload.get("direction")));
            if (payload.containsKey("proposal")) review.setBox4Proposal(str(payload.get("proposal")));
            if (payload.containsKey("improvementArea")) review.setBox4ImprovementArea(str(payload.get("improvementArea")));
        }
        review.setBox4SubmittedAt(LocalDateTime.now());

        if (review.getManagerId() == null) review.setManagerId(user.getManagerId());
        if (review.getManagerId() == null) {
            throw OKRRuleException.conflict("Chưa xác định Quản lý trực tiếp để duyệt — liên hệ HR");
        }

        String old = review.getStatus();
        review.setStatus("submitted");
        review.setSubmittedAt(LocalDateTime.now());
        okrReviewRepository.save(review);
        management.notify(review.getManagerId(), "Có OKR mới chờ duyệt",
                user.getFullName() + " đã gửi bộ mục tiêu OKR để duyệt.", "OKR_SUBMITTED", "/okr/team-approvals");
        management.audit(review.getId(), review.getCycleId(), null, "SUBMIT", "status", old, "submitted",
                "Nhân viên gửi OKR cho Quản lý duyệt");
        return ResponseEntity.ok(ApiResponse.ok(true, "Đã gửi bộ mục tiêu OKR cho Quản lý trực tiếp phê duyệt!"));
    }

    @PostMapping("/withdraw-setup")
    @Transactional
    @Operation(summary = "Rút lại bộ OKR đang chờ duyệt (Quản lý chưa xử lý) — quay về trạng thái trước khi gửi")
    public ResponseEntity<ApiResponse<Map<String, Object>>> withdrawSetup(@RequestBody(required = false) Map<String, Object> payload) {
        User user = management.requireCurrentUser();
        int year = phaseService.resolveYear(yearOf(payload));
        OKRReview review = okrReviewRepository.findByUserIdAndCycleYear(user.getId(), year)
                .orElseThrow(() -> OKRRuleException.notFound("Không tìm thấy hồ sơ OKR"));
        management.requireOwner(review, user);
        phaseService.requireCycleOpen(management.cycleOf(review));
        if (!"submitted".equalsIgnoreCase(review.getStatus())) {
            throw OKRRuleException.conflict("Chỉ rút lại được bộ OKR đang chờ Quản lý duyệt");
        }
        // Trạng thái trước khi gửi (draft / returned / reopened) lấy từ lần SUBMIT gần nhất trong audit
        String restored = management.statusBeforeLastSubmit(review);
        if ("draft".equals(restored) && !phaseService.employeeWindowOpen(management.cycleOf(review), OKRPhaseService.SETUP, review)) {
            throw OKRRuleException.conflict("Phase Thiết lập OKR đã đóng — rút về bản nháp sẽ không sửa được nữa. "
                    + "Nhờ Quản lý trả lại kèm góp ý để chỉnh sửa.");
        }
        review.setStatus(restored);
        review.setSubmittedAt(null);
        okrReviewRepository.save(review);
        String reason = payload == null ? "" : str(payload.get("reason"));
        management.audit(review.getId(), review.getCycleId(), null, "WITHDRAW", "status", "submitted", restored,
                reason.isEmpty() ? "Nhân viên rút lại OKR đang chờ duyệt" : reason);
        management.notify(review.getManagerId(), "Nhân viên đã rút lại OKR",
                user.getFullName() + " đã rút lại bộ mục tiêu OKR đang chờ duyệt để chỉnh sửa.",
                "OKR_WITHDRAWN", "/okr/team-approvals");

        Map<String, Object> res = new HashMap<>();
        res.put("status", restored);
        return ResponseEntity.ok(ApiResponse.ok(res, "Đã rút lại bộ OKR — bạn có thể chỉnh sửa và gửi lại"));
    }

    @DeleteMapping({"/items/{id}", "/objectives/{id}"})
    @Transactional
    @Operation(summary = "Xoá 1 đầu việc — bắt buộc lý do, xoá mềm + audit (S21)")
    public ResponseEntity<ApiResponse<Boolean>> deleteItem(@PathVariable UUID id,
                                                           @RequestParam(required = false) String reason,
                                                           @RequestBody(required = false) Map<String, Object> body) {
        String finalReason = reason != null && !reason.isBlank() ? reason.trim()
                : body != null ? str(body.get("reason")) : "";
        if (finalReason.isEmpty()) throw OKRRuleException.badRequest("Lý do xoá là bắt buộc!");

        User user = management.requireCurrentUser();
        OKRItem item = okrItemRepository.findById(id).orElseThrow(() -> OKRRuleException.notFound("Không tìm thấy đầu việc"));
        if (item.getDeletedAt() != null) throw OKRRuleException.conflict("Đầu việc đã bị xoá trước đó");
        OKRReview review = management.requireReview(item.getReviewId());
        management.requireOwner(review, user);
        management.requireGoalsEditable(review);

        item.setDeletedAt(LocalDateTime.now());
        item.setDeleteReason(finalReason);
        okrItemRepository.save(item);
        management.audit(review.getId(), review.getCycleId(), item.getId(), "REMOVE_ITEM", "title",
                item.getTitle(), null, finalReason);
        return ResponseEntity.ok(ApiResponse.ok(true, "Đã xoá mục tiêu (vẫn lưu vết trong lịch sử)"));
    }

    @PutMapping("/items/{id}")
    @Transactional
    @Operation(summary = "Sửa tên/mô tả đầu việc khi chưa khoá — tiến độ chỉ cập nhật qua check-in")
    public ResponseEntity<ApiResponse<Boolean>> updateItem(@PathVariable UUID id, @RequestBody Map<String, Object> body) {
        User user = management.requireCurrentUser();
        OKRItem item = okrItemRepository.findById(id).orElseThrow(() -> OKRRuleException.notFound("Không tìm thấy đầu việc"));
        if (item.getDeletedAt() != null) throw OKRRuleException.conflict("Đầu việc đã bị xoá");
        OKRReview review = management.requireReview(item.getReviewId());
        management.requireOwner(review, user);
        management.requireGoalsEditable(review);

        if (body.containsKey("title")) {
            String title = str(body.get("title"));
            if (title.isEmpty()) throw OKRRuleException.badRequest("Tên đầu việc không được để trống");
            if (!title.equals(item.getTitle())) {
                management.audit(review.getId(), review.getCycleId(), id, "EDIT_ITEM", "title", item.getTitle(), title,
                        "Nhân viên sửa đầu việc");
                item.setTitle(title);
            }
        }
        if (body.containsKey("detail")) {
            String detail = str(body.get("detail"));
            if (!Objects.equals(detail, item.getDetail() == null ? "" : item.getDetail())) {
                management.audit(review.getId(), review.getCycleId(), id, "EDIT_ITEM", "detail", item.getDetail(), detail,
                        "Nhân viên sửa đầu việc");
                item.setDetail(detail);
            }
        }
        okrItemRepository.save(item);
        return ResponseEntity.ok(ApiResponse.ok(true, "Đã cập nhật mục tiêu thành công!"));
    }

    @PostMapping("/self-proposal")
    @Transactional
    @Operation(summary = "Lưu nháp Định hướng & Đề xuất của kỳ — nội dung chính thức gửi kèm bộ mục tiêu khi nộp OKR")
    public ResponseEntity<ApiResponse<Map<String, Object>>> saveSelfProposal(@RequestBody Map<String, Object> payload) {
        User user = management.requireCurrentUser();
        int year = phaseService.resolveYear(yearOf(payload));
        OKRReview review = getOrCreateMyReview(user, year);
        management.requireGoalsEditable(review);

        review.setBox4Direction(str(payload.get("direction")));
        review.setBox4Proposal(str(payload.get("proposal")));
        review.setBox4ImprovementArea(str(payload.get("improvementArea")));
        okrReviewRepository.save(review);
        management.audit(review.getId(), review.getCycleId(), null, "SAVE_SELF_PROPOSAL",
                "box4", null, "draft", "Nhân viên lưu nháp định hướng & đề xuất của kỳ");

        Map<String, Object> res = new HashMap<>();
        res.put("direction", review.getBox4Direction());
        res.put("proposal", review.getBox4Proposal());
        res.put("improvementArea", review.getBox4ImprovementArea());
        return ResponseEntity.ok(ApiResponse.ok(res, "Đã lưu nháp định hướng & đề xuất"));
    }

    @GetMapping("/manager-objectives")
    @Operation(summary = "Gợi ý kế thừa mục tiêu ĐÃ DUYỆT của quản lý trực tiếp (C14 / S21)")
    public ApiResponse<List<Map<String, Object>>> getManagerObjectives(@RequestParam(required = false) Integer year) {
        User user = management.requireCurrentUser();
        int y = phaseService.resolveYear(year);
        if (user.getManagerId() == null) return ApiResponse.ok(List.of(), "Chưa xác định được Quản lý trực tiếp");
        User manager = userRepository.findById(user.getManagerId()).orElse(null);
        if (manager == null) return ApiResponse.ok(List.of(), "Chưa xác định được Quản lý trực tiếp");

        OKRReview mgrReview = okrReviewRepository.findByUserIdAndCycleYear(manager.getId(), y).orElse(null);
        if (mgrReview == null || !management.isApproved(mgrReview)) {
            return ApiResponse.ok(List.of(), "Quản lý chưa có OKR đã duyệt trong chu kỳ " + y);
        }
        List<Map<String, Object>> result = new ArrayList<>();
        for (OKRItem mi : management.activeItems(mgrReview.getId())) {
            Map<String, Object> map = new HashMap<>();
            map.put("id", mi.getId().toString());
            map.put("managerCode", manager.getEmployeeCode());
            map.put("managerName", manager.getFullName());
            map.put("groupType", mi.getGroupType());
            map.put("category", mi.getGroupType());
            map.put("title", mi.getTitle());
            map.put("detail", mi.getDetail() != null ? mi.getDetail() : "");
            result.add(map);
        }
        return ApiResponse.ok(result, "Lấy mục tiêu đã duyệt của Quản lý trực tiếp thành công");
    }

    // ======================================================================== F4 Duyệt OKR

    @GetMapping({"/team-approvals", "/approvals"})
    @Operation(summary = "Danh sách OKR cấp dưới gửi phê duyệt (S42)")
    public ApiResponse<List<Map<String, Object>>> getTeamApprovals(@RequestParam(required = false) Integer year) {
        User manager = management.requireCurrentUser();
        int y = phaseService.resolveYear(year);
        boolean hr = management.isHrOrAdmin();
        List<OKRReview> reviews = hr ? okrReviewRepository.findByCycleYear(y)
                : okrReviewRepository.findByManagerIdAndCycleYear(manager.getId(), y);

        List<Map<String, Object>> result = new ArrayList<>();
        for (OKRReview r : reviews) {
            String st = r.getStatus() == null ? "draft" : r.getStatus().toLowerCase();
            // Quản lý chỉ thấy bộ OKR đã từng được gửi lên mình: bỏ bản nháp (kể cả hồ sơ tự tạo đầu kỳ)
            // và hồ sơ chưa gửi lần nào (chưa có submitted_at / chưa từng duyệt — vd. vừa rút lại lần đầu)
            if (!management.reachedManager(r)) continue;
            User sub = userRepository.findById(r.getUserId()).orElse(null);
            List<OKRItem> items = management.activeItems(r.getId());

            Map<String, Object> map = new HashMap<>(management.teamRow(r));
            map.put("reviewId", r.getId().toString());
            map.put("id", r.getId().toString());
            map.put("employeeName", sub != null ? sub.getFullName() : "");
            map.put("employeeCode", sub != null ? sub.getEmployeeCode() : "");
            map.put("department", map.getOrDefault("team", ""));
            map.put("position", sub != null && sub.getPositionName() != null ? sub.getPositionName() : "");
            map.put("quarter", "Năm " + y);
            map.put("status", st.toUpperCase());
            map.put("submittedDate", r.getSubmittedAt() != null ? r.getSubmittedAt().format(VN_DATE) : null);
            map.put("submittedAt", r.getSubmittedAt());
            map.put("managerFeedback", r.getManagerFeedback());
            map.put("selfDirection", r.getBox4Direction() != null ? r.getBox4Direction() : "");
            map.put("selfProposal", r.getBox4Proposal() != null ? r.getBox4Proposal() : "");
            map.put("selfImprovementArea", r.getBox4ImprovementArea() != null ? r.getBox4ImprovementArea() : "");
            map.put("businessItems", items.stream().filter(i -> "BUSINESS".equalsIgnoreCase(i.getGroupType())).toList());
            map.put("peopleItems", items.stream().filter(i -> "PEOPLE".equalsIgnoreCase(i.getGroupType())).toList());
            map.put("totalItems", items.size());
            result.add(map);
        }
        return ApiResponse.ok(result, "Lấy danh sách duyệt OKR nhóm thành công");
    }

    @RequestMapping(
            value = {"/reviews/{id}/approve", "/reviews/{id}/approve-setup", "/objectives/{id}/approve"},
            method = {RequestMethod.POST, RequestMethod.PUT})
    @Transactional
    @Operation(summary = "Quản lý duyệt / trả lại / mở lại OKR cho cấp dưới (S42) — bắt buộc góp ý")
    public ResponseEntity<ApiResponse<Boolean>> handleApproval(@PathVariable UUID id,
                                                               @RequestParam(defaultValue = "APPROVE") String action,
                                                               @RequestParam(required = false) String feedback,
                                                               @RequestBody(required = false) Map<String, Object> payload) {
        String finalAction = action;
        String finalFeedback = feedback;
        if (payload != null) {
            if (payload.containsKey("action")) finalAction = str(payload.get("action"));
            if (payload.containsKey("feedback")) finalFeedback = str(payload.get("feedback"));
            if (payload.containsKey("comment")) finalFeedback = str(payload.get("comment"));
        }
        finalFeedback = finalFeedback == null ? "" : finalFeedback.trim();
        finalAction = finalAction == null ? "APPROVE" : finalAction.toUpperCase();

        OKRReview review = management.requireReview(id);
        management.requireManager(review, management.requireCurrentUser());
        phaseService.requireManagerWindow(management.cycleOf(review), OKRPhaseService.SETUP);
        String oldStatus = review.getStatus() == null ? "draft" : review.getStatus().toLowerCase();

        switch (finalAction) {
            case "RETURN", "REJECT" -> {
                if (!"submitted".equals(oldStatus)) {
                    throw OKRRuleException.conflict("Chỉ trả lại được OKR đang chờ duyệt (hiện tại: " + oldStatus + ")");
                }
                if (finalFeedback.isEmpty()) throw OKRRuleException.badRequest("Góp ý / lý do là bắt buộc khi trả lại!");
                review.setStatus("returned");
                review.setManagerFeedback(finalFeedback);
                okrReviewRepository.save(review);
                management.audit(review.getId(), review.getCycleId(), null, "RETURN", "status", oldStatus, "returned", finalFeedback);
                management.notify(review.getUserId(), "OKR bị trả lại để chỉnh sửa",
                        "Quản lý đã trả lại OKR của bạn kèm góp ý: " + finalFeedback,
                        "OKR_RETURNED", "MEDIUM", "/okr/my-okr", "OKR_OBJECTIVE_RETURNED");
                return ResponseEntity.ok(ApiResponse.ok(true, "Đã trả lại bộ OKR cho nhân viên kèm góp ý"));
            }
            case "REOPEN" -> {
                reopen(review, finalFeedback);
                return ResponseEntity.ok(ApiResponse.ok(true, "Đã mở lại quyền chỉnh sửa OKR cho nhân viên!"));
            }
            case "APPROVE" -> {
                if (!"submitted".equals(oldStatus)) {
                    throw OKRRuleException.conflict("Chỉ duyệt được OKR đang chờ duyệt (hiện tại: " + oldStatus + ")");
                }
                if (finalFeedback.isEmpty()) throw OKRRuleException.badRequest("Góp ý / nhận xét là bắt buộc khi duyệt OKR!");
                review.setStatus("locked");
                review.setLockedAt(LocalDateTime.now());
                review.setManagerFeedback(finalFeedback);
                if (review.getCurrentStep() == null || review.getCurrentStep() < 2) review.setCurrentStep(2);
                okrReviewRepository.save(review);
                management.audit(review.getId(), review.getCycleId(), null, "APPROVE", "status", oldStatus, "locked", finalFeedback);
                management.notify(review.getUserId(), "OKR đã được duyệt",
                        "Quản lý đã duyệt bộ mục tiêu OKR của bạn. Góp ý: " + finalFeedback, "OKR_APPROVED", "/okr/my-okr");
                return ResponseEntity.ok(ApiResponse.ok(true, "Quản lý đã phê duyệt bộ mục tiêu OKR thành công!"));
            }
            default -> throw OKRRuleException.badRequest("Hành động không hợp lệ: " + finalAction);
        }
    }

    @PostMapping("/reviews/{id}/reopen")
    @Transactional
    @Operation(summary = "Mở cho nhân viên sửa bổ sung (F4.3) — nộp lại sẽ khoá")
    public ResponseEntity<ApiResponse<Boolean>> reopenReview(@PathVariable UUID id,
                                                             @RequestBody(required = false) Map<String, Object> body) {
        OKRReview review = management.requireReview(id);
        management.requireManager(review, management.requireCurrentUser());
        phaseService.requireCycleOpen(management.cycleOf(review));
        reopen(review, body == null ? "" : str(body.get("reason")));
        return ResponseEntity.ok(ApiResponse.ok(true, "Đã mở lại quyền chỉnh sửa OKR cho nhân viên"));
    }

    /** Mở lại cho nhân viên sửa. Idempotent: đang mở sẵn (reopened/returned) thì không làm gì. */
    private void reopen(OKRReview review, String reason) {
        String old = review.getStatus() == null ? "draft" : review.getStatus().toLowerCase();
        if ("reopened".equals(old) || "returned".equals(old)) return;
        String msg = reason == null || reason.isBlank() ? "Quản lý đã mở lại quyền chỉnh sửa" : reason.trim();
        review.setStatus("reopened");
        review.setReopenedAt(LocalDateTime.now());
        review.setManagerFeedback(msg);
        okrReviewRepository.save(review);
        management.audit(review.getId(), review.getCycleId(), null, "REOPEN", "status", old, "reopened", msg);
        management.notify(review.getUserId(), "OKR được mở lại để bổ sung", msg, "OKR_REOPENED", "/okr/my-okr");
    }

    // ======================================================================== F7 Review nhóm

    @GetMapping("/team-review")
    @Operation(summary = "Review OKR cả nhóm (S24) — điểm đề xuất + cảnh báo rule + sắp xếp rủi ro")
    public ApiResponse<List<Map<String, Object>>> teamReview(@RequestParam(required = false) Integer year) {
        User actor = management.requireCurrentUser();
        int y = phaseService.resolveYear(year);
        List<OKRReview> reviews = management.isHrOrAdmin() ? okrReviewRepository.findByCycleYear(y)
                : okrReviewRepository.findByManagerIdAndCycleYear(actor.getId(), y);
        List<Map<String, Object>> rows = new ArrayList<>();
        for (OKRReview review : reviews) {
            if (!management.reachedManager(review)) continue; // chưa gửi lần nào thì chưa tới tay Quản lý
            rows.add(management.teamRow(review));
        }
        rows.sort((a, b) -> Integer.compare(((Number) b.getOrDefault("riskScore", 0)).intValue(),
                ((Number) a.getOrDefault("riskScore", 0)).intValue()));
        return ApiResponse.ok(rows, "Review OKR nhóm");
    }

    // ======================================================================== F6 Đánh giá cuối năm

    private static String firstText(String... values) {
        for (String v : values) if (v != null && !v.isBlank()) return v.trim();
        return null;
    }

    /** Ghi 4 mục của Box 2 / Box 3 từ request (nhận cả field cũ để tương thích). */
    private void applyGroupItems(OKRReview review, Form4BoxReviewRequest req) {
        review.setBox2Results(firstText(req.getBox2Results(), req.getBox2BusinessComment(), req.getBox1Results(), req.getBox1Achievements()));
        review.setBox2Adjustments(firstText(req.getBox2Adjustments(), req.getBox1Adjustments()));
        review.setBox2Difficulties(firstText(req.getBox2Difficulties(), req.getBox1Difficulties()));
        review.setBox2Lessons(firstText(req.getBox2Lessons(), req.getBox1Lessons()));
        review.setBox3Results(firstText(req.getBox3Results(), req.getBox3PeopleComment()));
        review.setBox3Adjustments(firstText(req.getBox3Adjustments()));
        review.setBox3Difficulties(firstText(req.getBox3Difficulties()));
        review.setBox3Lessons(firstText(req.getBox3Lessons()));
    }

    /** Một box nhóm (2 = Business, 3 = People): 4 mục + điểm tự chấm + điểm quản lý. */
    private Map<String, Object> groupBox(OKRReview r, int box) {
        Map<String, Object> m = new LinkedHashMap<>();
        boolean b = box == 2;
        m.put("group", b ? "BUSINESS" : "PEOPLE");
        m.put("results", r == null ? null : b ? r.getBox2Results() : r.getBox3Results());
        m.put("adjustments", r == null ? null : b ? r.getBox2Adjustments() : r.getBox3Adjustments());
        m.put("difficulties", r == null ? null : b ? r.getBox2Difficulties() : r.getBox3Difficulties());
        m.put("lessons", r == null ? null : b ? r.getBox2Lessons() : r.getBox3Lessons());
        m.put("selfScore", r == null ? null : b ? r.getBox2SelfScore() : r.getBox3SelfScore());
        m.put("managerScore", r == null ? null : b ? r.getBox2ManagerScore() : r.getBox3ManagerScore());
        m.put("progress", r == null ? null : Math.round(management.groupProgress(r.getId(), b ? "BUSINESS" : "PEOPLE") * 10.0) / 10.0);
        // Danh sách mục tiêu + tiến độ check-in của nhóm — màn đánh giá hiển thị giống màn check-in.
        m.put("items", r == null ? List.of()
                : okrItemRepository.findByReviewIdOrderById(r.getId()).stream()
                        .filter(i -> i.getDeletedAt() == null
                                && (b ? "BUSINESS" : "PEOPLE").equalsIgnoreCase(i.getGroupType()))
                        .map(i -> {
                            Map<String, Object> im = new LinkedHashMap<>();
                            im.put("id", i.getId().toString());
                            im.put("title", i.getTitle());
                            im.put("detail", i.getDetail());
                            im.put("progress", i.getProgress());
                            return im;
                        })
                        .toList());
        return m;
    }

    @GetMapping("/reviews/form-4box")
    @Operation(summary = "Form 4 Box chuẩn ACT (S23) — không truyền employeeCode = của tôi")
    public ApiResponse<Map<String, Object>> getForm4Box(@RequestParam(required = false) String employeeCode,
                                                       @RequestParam(required = false) Integer year) {
        User actor = management.requireCurrentUser();
        int y = phaseService.resolveYear(year);
        User employee = employeeCode == null || employeeCode.isBlank() ? actor
                : userRepository.findByEmployeeCode(employeeCode).orElseThrow(() -> OKRRuleException.notFound("Không tìm thấy nhân viên"));
        boolean self = actor.getId().equals(employee.getId());
        OKRReview review = okrReviewRepository.findByUserIdAndCycleYear(employee.getId(), y).orElse(null);
        if (!self && (review == null || !management.canManage(review, actor))) {
            throw OKRRuleException.forbidden("Bạn không có quyền xem form đánh giá của nhân viên này");
        }
        OKRCycle cycle = review != null ? management.cycleOf(review) : phaseService.cycle(y).orElse(null);
        String selfLock = selfAssessLockReason(review, cycle);
        String managerLock = null;
        if (review == null) managerLock = "Nhân viên chưa có OKR";
        else {
            try {
                phaseService.requireManagerWindow(cycle, OKRPhaseService.FINAL);
                if (!management.selfAssessed(review)) managerLock = "Nhân viên chưa nộp tự đánh giá";
            } catch (OKRRuleException e) {
                managerLock = e.getMessage();
            }
        }

        // Box 1 — Thông tin cá nhân: hệ thống tự điền từ hồ sơ nhân sự (không nhập tay)
        UUID managerId = review != null && review.getManagerId() != null ? review.getManagerId() : employee.getManagerId();
        User manager = managerId == null ? null : userRepository.findById(managerId).orElse(null);
        Map<String, Object> box1 = new LinkedHashMap<>();
        box1.put("fullName", employee.getFullName());
        box1.put("employeeCode", employee.getEmployeeCode());
        box1.put("jobTitle", employee.getPositionName());
        box1.put("department", employee.getTeamId() == null ? null
                : teamRepository.findById(employee.getTeamId()).map(t -> t.getName()).orElse(null));
        box1.put("managerName", manager != null ? manager.getFullName() : null);
        LocalDate box1Cutoff = phaseService.seniorityCutoff(cycle, y);
        LocalDate box1Joined = employee.getJoinedDate() != null ? employee.getJoinedDate() : employee.getHireDate();
        boolean box1NewJoiner = box1Joined != null && box1Joined.isAfter(LocalDate.of(y, 1, 1)) && !box1Joined.isAfter(box1Cutoff);
        Long box1Months = box1Joined == null ? null : Math.max(0, ChronoUnit.MONTHS.between(box1Joined, box1Cutoff.plusDays(1)));
        box1.put("joinedDate", box1Joined);
        box1.put("seniority", seniority(employee, box1Cutoff));
        box1.put("newJoiner", box1NewJoiner);
        box1.put("monthsWorked", box1Months);
        box1.put("seniorityNote", box1NewJoiner
                ? "Vào giữa năm — đánh giá theo " + box1Months + " tháng thực tế (không đánh giá oan phần chưa làm)"
                : null);
        box1.put("cycleYear", y);

        Map<String, Object> form = new HashMap<>();
        form.put("employeeCode", employee.getEmployeeCode());
        form.put("employeeName", employee.getFullName());
        form.put("jobTitle", employee.getPositionName());
        form.put("year", y);
        form.put("box1", box1);
        form.put("box2", groupBox(review, 2));
        form.put("box3", groupBox(review, 3));
        form.put("box2Items", ((Map<?, ?>) form.get("box2")).get("items"));
        form.put("box3Items", ((Map<?, ?>) form.get("box3")).get("items"));
        for (String k : List.of("Results", "Adjustments", "Difficulties", "Lessons")) {
            form.put("box2" + k, ((Map<?, ?>) form.get("box2")).get(k.toLowerCase()));
            form.put("box3" + k, ((Map<?, ?>) form.get("box3")).get(k.toLowerCase()));
        }
        form.put("box2BusinessScore", review != null ? review.getBox2SelfScore() : null);
        form.put("box3PeopleScore", review != null ? review.getBox3SelfScore() : null);
        form.put("box4Direction", review != null ? review.getBox4Direction() : null);
        form.put("box4SelfProposal", review != null ? review.getBox4Proposal() : null);
        form.put("box4ImprovementArea", review != null ? review.getBox4ImprovementArea() : null);
        form.put("managerBusinessScore", review != null ? review.getBox2ManagerScore() : null);
        form.put("managerPeopleScore", review != null ? review.getBox3ManagerScore() : null);
        form.put("managerComment", review != null ? review.getManagerComment() : null);
        form.put("selfAverageScore", management.selfAverage(review));
        form.put("managerAverageScore", management.managerAverage(review));
        form.put("reviewId", review != null ? review.getId().toString() : null);
        form.put("reviewStatus", review != null ? review.getStatus() : null);
        form.put("status", management.assessmentStatus(review));
        form.put("isSelf", self);
        form.put("canSelfEdit", self && selfLock == null);
        int[] sc = management.scale(cycle);
        form.put("scaleMin", sc[0]);
        form.put("scaleMax", sc[1]);
        String assessPhase = selfAssessPhase(review, cycle);
        form.put("selfAssessPhase", assessPhase == null ? null : assessPhase.toUpperCase());
        form.put("selfLockReason", selfLock);
        form.put("canManage", review != null && management.canManage(review, actor));
        form.put("canManagerAssess", review != null && management.canManage(review, actor) && !self && managerLock == null);
        form.put("managerLockReason", managerLock);
        form.put("finalUpdateOverride", review != null && Boolean.TRUE.equals(review.getFinalUpdateOverride()));
        form.put("finalManagerWindowOpen", cycle != null && phaseService.managerWindowOpen(cycle, OKRPhaseService.FINAL));
        return ApiResponse.ok(form, "Lấy dữ liệu đánh giá OKR thành công");
    }

    @GetMapping("/reviews/my-review")
    @Operation(summary = "Form 4 Box tự đánh giá của tôi (OKR-REV-01)")
    public ApiResponse<Map<String, Object>> getForm4BoxMyReview(@RequestParam(required = false) Integer year) {
        return getForm4Box(null, year);
    }

    @PostMapping("/reviews/submit-self-review")
    @Transactional
    @Operation(summary = "Nhân viên nộp bản tự đánh giá cuối năm Form 4 Box (S23)")
    public ResponseEntity<ApiResponse<Map<String, Object>>> submitSelfReview(@RequestBody Form4BoxReviewRequest req) {
        User actor = management.requireCurrentUser();
        if (req.getEmployeeCode() != null && !req.getEmployeeCode().isBlank()
                && !req.getEmployeeCode().equalsIgnoreCase(actor.getEmployeeCode())) {
            throw OKRRuleException.forbidden("Chỉ được nộp bản tự đánh giá của chính mình");
        }
        int year = phaseService.resolveYear(req.getYear());
        OKRReview review = okrReviewRepository.findByUserIdAndCycleYear(actor.getId(), year)
                .orElseThrow(() -> OKRRuleException.conflict("Chưa có OKR trong chu kỳ " + year));
        int scoreB = management.requireScore(req.getBox2BusinessScore(), "Điểm Thành tựu công việc", review);
        int scoreP = management.requireScore(req.getBox3PeopleScore(), "Điểm Thành tựu con người", review);
        OKRCycle reviewCycle = management.cycleOf(review);
        String lock = selfAssessLockReason(review, reviewCycle);
        if (lock != null) throw OKRRuleException.conflict(lock);

        String oldScores = management.selfAssessed(review)
                ? "Business=" + review.getBox2SelfScore() + ", People=" + review.getBox3SelfScore() : null;
        applyGroupItems(review, req);
        // Bản chính thức cuối năm bắt buộc có "Kết quả" cho cả 2 nhóm.
        if (review.getBox2Results() == null) throw OKRRuleException.badRequest("Thành tựu công việc: mục Kết quả là bắt buộc");
        if (review.getBox3Results() == null) throw OKRRuleException.badRequest("Thành tựu con người: mục Kết quả là bắt buộc");
        review.setBox2SelfScore(scoreB);
        review.setBox3SelfScore(scoreP);
        review.setBox2AttachmentUrl(req.getEvidenceAttachmentUrl());
        // Box 4 dùng chung dữ liệu khai báo đầu kỳ — nhân viên được cập nhật trong cửa sổ tự đánh giá.
        if (req.getBox4Direction() != null) review.setBox4Direction(req.getBox4Direction());
        if (req.getBox4SelfProposal() != null) review.setBox4Proposal(req.getBox4SelfProposal());
        if (req.getBox4ImprovementArea() != null) review.setBox4ImprovementArea(req.getBox4ImprovementArea());
        // current_step: 2 = đã duyệt, 3 = đã nộp tự đánh giá cuối năm
        review.setCurrentStep(3);
        okrReviewRepository.save(review);

        double avg = (scoreB + scoreP) / 2.0;
        String label = "bản tự đánh giá cuối năm";
        management.audit(review.getId(), review.getCycleId(), null, "SELF_ASSESS",
                "selfScores", oldScores, "Business=" + scoreB + ", People=" + scoreP, "Nhân viên nộp " + label);
        management.notify(review.getManagerId(), "Có " + label + " mới",
                actor.getFullName() + " đã nộp " + label + " (TB " + avg + ").",
                "OKR_SELF_ASSESSED", "/okr/assessment?employeeCode=" + actor.getEmployeeCode());

        Map<String, Object> res = new HashMap<>();
        res.put("reviewId", review.getId().toString());
        res.put("selfAverageScore", avg);
        res.put("status", management.assessmentStatus(review));
        res.put("phase", "FINAL");
        return ResponseEntity.ok(ApiResponse.ok(res, "Đã nộp " + label + ". Điểm TB: " + avg));
    }

    @PostMapping("/reviews/{id}/manager-assess")
    @Transactional
    @Operation(summary = "Quản lý chấm điểm độc lập 1-5 nguyên & nhận xét (S24) — sau khi nhân viên tự đánh giá")
    public ResponseEntity<ApiResponse<Map<String, Object>>> managerAssess(@PathVariable String id,
                                                                          @RequestBody ManagerAssessRequest req) {
        String comment = req.getManagerComment() == null ? "" : req.getManagerComment().trim();
        if (comment.isEmpty()) throw OKRRuleException.badRequest("Nhận xét của Quản lý là bắt buộc khi chấm điểm");

        OKRReview review;
        try {
            review = management.requireReview(UUID.fromString(id));
        } catch (IllegalArgumentException e) {
            throw OKRRuleException.notFound("Không tìm thấy hồ sơ đánh giá");
        }
        User actor = management.requireCurrentUser();
        management.requireManager(review, actor);
        if (actor.getId().equals(review.getUserId())) throw OKRRuleException.forbidden("Không tự chấm điểm quản lý cho chính mình");
        int managerB = management.requireScore(req.getManagerBusinessScore(), "Điểm Business của Quản lý", review);
        int managerP = management.requireScore(req.getManagerPeopleScore(), "Điểm People của Quản lý", review);
        phaseService.requireManagerWindow(management.cycleOf(review), OKRPhaseService.FINAL);
        if (!management.isCurrentlyApproved(review)) {
            throw OKRRuleException.conflict("OKR đang mở sửa/chưa được duyệt lại — chưa thể chấm điểm Quản lý");
        }
        if (!management.selfAssessed(review)) {
            throw OKRRuleException.conflict("Nhân viên chưa nộp tự đánh giá — chưa thể chấm điểm quản lý");
        }

        String oldScores = management.managerAssessed(review)
                ? "Business=" + review.getBox2ManagerScore() + ", People=" + review.getBox3ManagerScore() : null;
        double managerAvg = (managerB + managerP) / 2.0;
        review.setBox2ManagerScore(managerB);
        review.setBox3ManagerScore(managerP);
        review.setManagerComment(comment);
        review.setFinalAverageScore(java.math.BigDecimal.valueOf(managerAvg));
        review.setCurrentStep(5);
        okrReviewRepository.save(review);

        management.audit(review.getId(), review.getCycleId(), null, "MANAGER_ASSESS", "managerScores", oldScores,
                "Business=" + managerB + ", People=" + managerP, comment);
        management.notify(review.getUserId(), "Quản lý đã chấm điểm OKR cuối năm",
                "Điểm quản lý: Business " + managerB + ", People " + managerP + " · TB " + managerAvg + ".",
                "OKR_ASSESSED", "/okr/my-okr?section=assessment");

        Map<String, Object> res = new HashMap<>();
        res.put("reviewId", review.getId().toString());
        res.put("selfBusinessScore", management.selfBusiness(review));
        res.put("selfPeopleScore", management.selfPeople(review));
        res.put("selfAverageScore", management.selfAverage(review));
        res.put("managerBusinessScore", managerB);
        res.put("managerPeopleScore", managerP);
        res.put("managerAverageScore", managerAvg);
        res.put("status", management.assessmentStatus(review));
        return ResponseEntity.ok(ApiResponse.ok(res, "Quản lý hoàn tất đánh giá. Điểm trung bình: " + managerAvg));
    }

    @PostMapping("/reviews/{id}/allow-update")
    @Transactional
    @Operation(summary = "Quản lý bật/tắt cho nhân viên cập nhật tiến độ trong cửa sổ review")
    public ResponseEntity<ApiResponse<Map<String, Object>>> allowEmployeeUpdate(@PathVariable String id,
                                                                                @RequestBody Map<String, Object> body) {
        OKRReview review;
        try {
            review = management.requireReview(UUID.fromString(id));
        } catch (IllegalArgumentException e) {
            throw OKRRuleException.notFound("Không tìm thấy hồ sơ đánh giá");
        }
        User actor = management.requireCurrentUser();
        if (!management.canManage(review, actor)) {
            throw OKRRuleException.forbidden("Bạn không có quyền mở cập nhật cho nhân viên này");
        }
        OKRCycle cycle = management.cycleOf(review);
        phaseService.requireCycleOpen(cycle);
        String phase = str(body.get("phase")).toUpperCase();
        if (!OKRPhaseService.MIDYEAR.equals(phase) && !OKRPhaseService.FINAL.equals(phase)) {
            throw OKRRuleException.badRequest("Phase chỉ nhận MIDYEAR hoặc FINAL");
        }
        boolean enabled = Boolean.parseBoolean(str(body.get("enabled")));
        String oldValue = String.valueOf(OKRPhaseService.MIDYEAR.equals(phase)
                ? review.getMidYearUpdateOverride() : review.getFinalUpdateOverride());
        if (OKRPhaseService.MIDYEAR.equals(phase)) review.setMidYearUpdateOverride(enabled);
        else review.setFinalUpdateOverride(enabled);
        okrReviewRepository.save(review);

        management.audit(review.getId(), review.getCycleId(), null, "ALLOW_UPDATE",
                phase.toLowerCase() + "UpdateOverride", oldValue, String.valueOf(enabled),
                enabled ? "Mở cho nhân viên cập nhật trong lúc review" : "Khoá cập nhật trong lúc review");
        management.notify(review.getUserId(),
                enabled ? "Quản lý mở cập nhật tiến độ trong lúc review" : "Quản lý tạm khoá cập nhật tiến độ",
                enabled ? "Bạn có thể cập nhật tiến độ OKR trong cửa sổ Quản lý đang review."
                        : "Cập nhật tiến độ tạm khoá cho tới khi Quản lý hoàn tất review.",
                "OKR_UPDATE_OVERRIDE", "/okr/my-okr");

        Map<String, Object> res = new HashMap<>();
        res.put("phase", phase);
        res.put("enabled", enabled);
        return ResponseEntity.ok(ApiResponse.ok(res, enabled
                ? "Đã mở cho nhân viên cập nhật tiến độ" : "Đã khoá cập nhật tiến độ của nhân viên"));
    }

    /** Hồ sơ của chính mình + đang trong phase đánh giá cuối năm + quản lý chưa chấm. */
    private OKRReview requireSelfEditable(String id) {
        OKRReview review;
        try {
            review = management.requireReview(UUID.fromString(id));
        } catch (IllegalArgumentException e) {
            throw OKRRuleException.notFound("Không tìm thấy hồ sơ đánh giá");
        }
        management.requireOwner(review, management.requireCurrentUser());
        String lock = selfAssessLockReason(review, management.cycleOf(review));
        if (lock != null) throw OKRRuleException.conflict(lock);
        return review;
    }

    @PutMapping("/reviews/{id}/box2-3")
    @Transactional
    @Operation(summary = "Lưu nháp Box 2 & Box 3 — 4 mục mỗi nhóm + điểm tự chấm 1-5 nguyên (OKR-REV-03)")
    public ApiResponse<Boolean> updateBox2And3(@PathVariable String id, @RequestBody Form4BoxReviewRequest req) {
        OKRReview review = requireSelfEditable(id);
        int b = management.requireScore(req.getBox2BusinessScore(), "Điểm Thành tựu công việc", review);
        int p = management.requireScore(req.getBox3PeopleScore(), "Điểm Thành tựu con người", review);
        String old = management.selfAssessed(review)
                ? "Business=" + review.getBox2SelfScore() + ", People=" + review.getBox3SelfScore() : null;
        applyGroupItems(review, req);
        review.setBox2SelfScore(b);
        review.setBox3SelfScore(p);
        okrReviewRepository.save(review);
        management.audit(review.getId(), review.getCycleId(), null, "UPDATE_BOX2_3", "selfScores", old,
                "Business=" + b + ", People=" + p, "Nhân viên cập nhật điểm tự đánh giá");
        return ApiResponse.ok(true, "Đã lưu điểm tự chấm");
    }

    @PutMapping("/reviews/{id}/box4")
    @Transactional
    @Operation(summary = "Cập nhật Box 4 — Định hướng & đề xuất của kỳ (OKR-REV-04)")
    public ApiResponse<Boolean> updateBox4(@PathVariable String id, @RequestBody Map<String, String> payload) {
        OKRReview review;
        try {
            review = management.requireReview(UUID.fromString(id));
        } catch (IllegalArgumentException e) {
            throw OKRRuleException.notFound("Không tìm thấy hồ sơ đánh giá");
        }
        management.requireOwner(review, management.requireCurrentUser());
        String lock = selfAssessLockReason(review, management.cycleOf(review));
        if (lock != null) throw OKRRuleException.conflict(lock);
        review.setBox4Direction(payload.get("box4Direction"));
        review.setBox4Proposal(payload.get("box4SelfProposal"));
        review.setBox4ImprovementArea(payload.get("box4ImprovementArea"));
        okrReviewRepository.save(review);
        management.audit(review.getId(), review.getCycleId(), null, "UPDATE_BOX4", "box4", null, "Đã cập nhật Box 4", "Nhân viên cập nhật Box 4");
        return ApiResponse.ok(true, "Đã lưu định hướng & đề xuất");
    }

    // ======================================================================== F8 Báo cáo HR

    private void requireHr() {
        if (!management.isHrOrAdmin()) throw OKRRuleException.forbidden("Chỉ HR/Admin mới xem được báo cáo tổng hợp OKR");
    }

    @GetMapping("/admin/hr-summary-report")
    @Operation(summary = "Bảng tổng hợp đánh giá HR 9 trường (S25)")
    public ApiResponse<List<HRSummaryReportItem>> getHrSummaryReport(@RequestParam(required = false) Integer year,
                                                                     @RequestParam(required = false) String cutoff) {
        requireHr();
        int y = phaseService.resolveYear(year);
        return ApiResponse.ok(buildHrRecords(y, reportCutoff(y, cutoff)), "Lấy bảng tổng hợp HR 9 trường thành công");
    }

    /** Mốc tính thời gian công tác: tham số `cutoff` (xem thử) → cấu hình chu kỳ → 31/12 năm chu kỳ. */
    private LocalDate reportCutoff(int year, String cutoff) {
        if (cutoff != null && !cutoff.isBlank()) {
            LocalDate d = OKRPhaseService.parseDate(cutoff);
            if (d == null) throw OKRRuleException.badRequest("Mốc tính thời gian công tác không hợp lệ (yyyy-mm-dd)");
            return d;
        }
        return phaseService.seniorityCutoff(phaseService.cycle(year).orElse(null), year);
    }

    @PutMapping("/admin/reviews/{id}/note")
    @Transactional
    @Operation(summary = "HR ghi Note trên bảng tổng hợp OKR (doc/OKR_doc.md Bước 3)")
    public ApiResponse<Boolean> updateHrNote(@PathVariable UUID id, @RequestBody Map<String, Object> body) {
        requireHr();
        OKRReview review = management.requireReview(id);
        phaseService.requireCycleOpen(management.cycleOf(review));
        String note = str(body.get("note"));
        String old = review.getHrNote();
        review.setHrNote(note.isEmpty() ? null : note);
        okrReviewRepository.save(review);
        management.audit(review.getId(), review.getCycleId(), null, "HR_NOTE", "hrNote", old, note, "HR cập nhật Note bảng tổng hợp");
        return ApiResponse.ok(true, "Đã lưu Note");
    }

    @GetMapping("/admin/hr-summary")
    @Operation(summary = "Bảng tổng hợp + 4 widget + tóm tắt C15 + danh sách rủi ro (S25)")
    public ApiResponse<Map<String, Object>> getHrSummary(@RequestParam(required = false) Integer year,
                                                       @RequestParam(required = false) String cutoff) {
        requireHr();
        int y = phaseService.resolveYear(year);
        OKRCycle cycle = phaseService.cycle(y).orElse(null);
        LocalDate seniorityCutoff = reportCutoff(y, cutoff);
        List<HRSummaryReportItem> records = buildHrRecords(y, seniorityCutoff);

        int total = records.size();
        long noOkr = records.stream().filter(r -> "CHUA_CO_OKR".equals(r.getStatus())).count();
        long selfAssessed = records.stream().filter(r -> "CHO_QL_CHAM".equals(r.getStatus()) || "DA_HOAN_TAT".equals(r.getStatus())).count();
        long managerDone = records.stream().filter(r -> "DA_HOAN_TAT".equals(r.getStatus())).count();

        Map<String, Map<String, Object>> byDepartment = new LinkedHashMap<>();
        Map<Integer, Integer> distribution = new LinkedHashMap<>();
        for (int i = 1; i <= 5; i++) distribution.put(i, 0);
        List<Map<String, Object>> notSubmitted = new ArrayList<>();
        double totalAvg = 0;
        int avgCount = 0;

        for (HRSummaryReportItem r : records) {
            String dept = r.getDepartment() == null || r.getDepartment().isBlank() ? "Chưa xếp nhóm" : r.getDepartment();
            Map<String, Object> d = byDepartment.computeIfAbsent(dept, k -> new HashMap<>(Map.of(
                    "total", 0, "submitted", 0, "averageSum", 0.0, "averageCount", 0)));
            d.put("total", ((Number) d.get("total")).intValue() + 1);
            boolean submitted = "CHO_QL_CHAM".equals(r.getStatus()) || "DA_HOAN_TAT".equals(r.getStatus());
            if (submitted) d.put("submitted", ((Number) d.get("submitted")).intValue() + 1);
            // Phân bố & điểm TB chỉ tính bản ĐÃ CHỐT (quản lý đã chấm) để không lẫn điểm tự chấm
            if ("DA_HOAN_TAT".equals(r.getStatus()) && r.getAverageScore() != null) {
                d.put("averageSum", ((Number) d.get("averageSum")).doubleValue() + r.getAverageScore());
                d.put("averageCount", ((Number) d.get("averageCount")).intValue() + 1);
                totalAvg += r.getAverageScore();
                avgCount++;
                int bucket = (int) Math.floor(r.getAverageScore());
                distribution.merge(bucket, 1, Integer::sum);
            }
            if (!submitted) {
                Map<String, Object> m = new HashMap<>();
                m.put("employeeCode", r.getEmployeeCode());
                m.put("fullName", r.getFullName());
                m.put("department", dept);
                m.put("status", r.getStatus());
                notSubmitted.add(m);
            }
        }
        for (Map<String, Object> d : byDepartment.values()) {
            int c = ((Number) d.get("averageCount")).intValue();
            d.put("averageScore", c == 0 ? null : Math.round(((Number) d.get("averageSum")).doubleValue() / c * 10.0) / 10.0);
            d.remove("averageSum");
            d.remove("averageCount");
        }

        List<Map<String, Object>> risks = new ArrayList<>();
        for (OKRReview review : okrReviewRepository.findByCycleYear(y)) {
            List<Map<String, Object>> warnings = management.warnings(review);
            if (warnings.isEmpty()) continue;
            User u = userRepository.findById(review.getUserId()).orElse(null);
            Map<String, Object> m = new HashMap<>();
            m.put("reviewId", review.getId().toString());
            m.put("employeeCode", u != null ? u.getEmployeeCode() : "");
            m.put("fullName", u != null ? u.getFullName() : "");
            m.put("warnings", warnings);
            risks.add(m);
        }

        String lowestDept = null;
        double lowestAvg = Double.MAX_VALUE;
        for (Map.Entry<String, Map<String, Object>> e : byDepartment.entrySet()) {
            Object avg = e.getValue().get("averageScore");
            if (avg != null && ((Number) avg).doubleValue() < lowestAvg) {
                lowestAvg = ((Number) avg).doubleValue();
                lowestDept = e.getKey();
            }
        }
        Double companyAvg = avgCount == 0 ? null : Math.round(totalAvg / avgCount * 10.0) / 10.0;

        // Tóm tắt C15 — mỗi câu gắn widget nguồn để UI dẫn link
        List<Map<String, Object>> summaryParts = new ArrayList<>();
        summaryParts.add(Map.of("widget", "progress", "text", String.format(
                "%d/%d nhân viên đã nộp tự đánh giá (%.0f%%), %d đã được quản lý chấm.",
                selfAssessed, total, total == 0 ? 0.0 : selfAssessed * 100.0 / total, managerDone)));
        if (total - selfAssessed > 0) {
            summaryParts.add(Map.of("widget", "notSubmitted", "text",
                    "Còn " + (total - selfAssessed) + " người chưa nộp tự đánh giá"
                            + (noOkr > 0 ? " (trong đó " + noOkr + " người chưa có OKR)." : ".")));
        }
        summaryParts.add(Map.of("widget", "distribution", "text", companyAvg == null
                ? "Chưa có điểm đã chốt để tính điểm TB toàn công ty."
                : "Điểm TB toàn công ty (đã chốt): " + companyAvg + "."));
        if (lowestDept != null) {
            summaryParts.add(Map.of("widget", "byDepartment", "text",
                    "Nhóm có điểm TB thấp nhất: " + lowestDept + " (" + lowestAvg + ")."));
        }
        if (!risks.isEmpty()) {
            summaryParts.add(Map.of("widget", "risks", "text", risks.size() + " OKR có cảnh báo rủi ro cần xem."));
        }
        StringBuilder summary = new StringBuilder();
        summaryParts.forEach(p -> summary.append(p.get("text")).append(' '));

        Map<String, Object> widgets = new HashMap<>();
        widgets.put("totalEmployees", total);
        widgets.put("noOkr", noOkr);
        widgets.put("submitted", selfAssessed);
        widgets.put("managerAssessed", managerDone);
        widgets.put("notSubmitted", notSubmitted);
        widgets.put("byDepartment", byDepartment);
        widgets.put("distribution", distribution);
        widgets.put("companyAverage", companyAvg);

        Map<String, Object> data = new HashMap<>();
        data.put("year", y);
        data.put("cycleId", cycle != null ? cycle.getId().toString() : null);
        data.put("cycleStatus", cycle != null ? cycle.getStatus() : null);
        data.put("seniorityCutoff", seniorityCutoff.toString());
        data.put("pendingNoOkr", management.pendingNoOkrCount(y));
        data.put("pendingManagerAssessments", management.pendingManagerAssessmentCount(y));
        data.put("records", records);
        data.put("widgets", widgets);
        data.put("summaryText", summary.toString().trim());
        data.put("summaryParts", summaryParts);
        data.put("risks", risks);
        return ApiResponse.ok(data, "Lấy báo cáo tổng hợp OKR thành công");
    }

    /** Toàn bộ nhân sự đang làm việc (không chỉ người đã có OKR) — người chưa tạo OKR vẫn hiện để HR theo dõi. */
    private List<HRSummaryReportItem> buildHrRecords(int year, LocalDate cutoff) {
        Map<UUID, OKRReview> reviewByUser = new HashMap<>();
        for (OKRReview r : okrReviewRepository.findByCycleYear(year)) reviewByUser.put(r.getUserId(), r);

        List<User> users = new ArrayList<>();
        for (User u : userRepository.findAll()) {
            boolean hasReview = reviewByUser.containsKey(u.getId());
            boolean working = !"RESIGNED".equalsIgnoreCase(u.getStatus()) && !"SUSPENDED".equalsIgnoreCase(u.getStatus())
                    && !"ADMIN".equalsIgnoreCase(u.getRole());
            if (hasReview || working) users.add(u);
        }
        users.sort(Comparator.comparing(u -> u.getEmployeeCode() == null ? "" : u.getEmployeeCode()));

        List<HRSummaryReportItem> records = new ArrayList<>();
        int stt = 1;
        for (User user : users) {
            OKRReview review = reviewByUser.get(user.getId());
            UUID managerId = review != null && review.getManagerId() != null ? review.getManagerId() : user.getManagerId();
            User manager = managerId == null ? null : userRepository.findById(managerId).orElse(null);
            String department = user.getTeamId() == null ? ""
                    : teamRepository.findById(user.getTeamId()).map(t -> t.getName()).orElse("");
            // Cột điểm của bảng tổng hợp là điểm CHÍNH THỨC (quản lý chấm). Điểm tự chấm để cột riêng đối chiếu.
            boolean official = management.managerAssessed(review);
            Integer b = official ? review.getBox2ManagerScore() : null;
            Integer p = official ? review.getBox3ManagerScore() : null;
            LocalDate joined = user.getJoinedDate() != null ? user.getJoinedDate() : user.getHireDate();
            boolean newJoiner = joined != null && joined.isAfter(LocalDate.of(year, 1, 1)) && !joined.isAfter(cutoff);
            Long monthsWorked = joined == null ? null : Math.max(0, ChronoUnit.MONTHS.between(joined, cutoff.plusDays(1)));
            String seniorityNote = newJoiner
                    ? "Vào giữa năm — đánh giá theo " + monthsWorked + " tháng thực tế"
                    : null;

            records.add(HRSummaryReportItem.builder()
                    .stt(stt++)
                    .fullName(user.getFullName())
                    .employeeCode(user.getEmployeeCode())
                    .jobTitle(user.getPositionName() != null ? user.getPositionName() : "")
                    .seniority(seniority(user, cutoff))
                    .newJoiner(newJoiner)
                    .monthsWorked(monthsWorked)
                    .seniorityNote(seniorityNote)
                    .joinedDate(joined)
                    .reviewId(review != null ? review.getId().toString() : null)
                    .department(department)
                    .directManagerName(manager != null ? manager.getFullName() : "")
                    .selfBusinessScore(review != null ? review.getBox2SelfScore() : null)
                    .selfPeopleScore(review != null ? review.getBox3SelfScore() : null)
                    .businessScore(b)
                    .peopleScore(p)
                    .averageScore(b == null || p == null ? null : (b + p) / 2.0)
                    .scoreSource(official ? "MANAGER" : null)
                    .status(management.assessmentStatus(review))
                    .note(review != null ? review.getHrNote() : null)
                    .managerComment(review != null ? review.getManagerComment() : null)
                    .build());
        }
        return records;
    }

    /**
     * Thời gian công tác: từ ngày vào làm tới mốc HR cấu hình (doc/OKR_doc.md: "tới 31/12/2026 hoặc 2027 tùy chỉnh").
     * Vào sau mốc → "Chưa vào làm"; dưới 1 tháng → "Dưới 1 tháng" (người mới không bị đánh giá oan).
     */
    private String seniority(User user, LocalDate cutoff) {
        LocalDate start = user.getJoinedDate() != null ? user.getJoinedDate() : user.getHireDate();
        if (start == null) return "—";
        if (start.isAfter(cutoff)) return "Chưa vào làm";
        long months = ChronoUnit.MONTHS.between(start, cutoff.plusDays(1));
        if (months == 0) return "Dưới 1 tháng";
        long years = months / 12;
        long rem = months % 12;
        if (years == 0) return rem + " tháng";
        return rem == 0 ? years + " năm" : years + " năm " + rem + " tháng";
    }

    @GetMapping("/admin/export-excel-file")
    @Operation(summary = "Tải file Excel bảng tổng hợp OKR — 9 trường + Note theo doc/OKR_doc.md Bước 5 (S25)")
    public ResponseEntity<byte[]> exportOkrExcelFile(@RequestParam(required = false) Integer year,
                                                     @RequestParam(required = false) String cutoff) {
        requireHr();
        int y = phaseService.resolveYear(year);
        LocalDate seniorityCutoff = reportCutoff(y, cutoff);
        List<HRSummaryReportItem> records = buildHrRecords(y, seniorityCutoff);
        try (org.apache.poi.xssf.usermodel.XSSFWorkbook wb = new org.apache.poi.xssf.usermodel.XSSFWorkbook()) {
            var sheet = wb.createSheet("OKR " + y);
            var bold = wb.createFont();
            bold.setBold(true);
            var titleFont = wb.createFont();
            titleFont.setBold(true);
            titleFont.setFontHeightInPoints((short) 14);

            var titleStyle = wb.createCellStyle();
            titleStyle.setFont(titleFont);
            var headerStyle = wb.createCellStyle();
            headerStyle.setFont(bold);
            headerStyle.setWrapText(true);
            headerStyle.setVerticalAlignment(org.apache.poi.ss.usermodel.VerticalAlignment.CENTER);
            headerStyle.setFillForegroundColor(org.apache.poi.ss.usermodel.IndexedColors.GREY_25_PERCENT.getIndex());
            headerStyle.setFillPattern(org.apache.poi.ss.usermodel.FillPatternType.SOLID_FOREGROUND);
            for (var st : List.of(headerStyle)) {
                st.setBorderBottom(org.apache.poi.ss.usermodel.BorderStyle.THIN);
                st.setBorderTop(org.apache.poi.ss.usermodel.BorderStyle.THIN);
                st.setBorderLeft(org.apache.poi.ss.usermodel.BorderStyle.THIN);
                st.setBorderRight(org.apache.poi.ss.usermodel.BorderStyle.THIN);
            }
            var intStyle = wb.createCellStyle();
            intStyle.setDataFormat(wb.createDataFormat().getFormat("0"));
            java.util.function.BiConsumer<org.apache.poi.ss.usermodel.Row, int[]> putInt = (row, cv) -> {
                var c = row.createCell(cv[0]);
                c.setCellValue(cv[1]);
                c.setCellStyle(intStyle);
            };
            var avgStyle = wb.createCellStyle();
            avgStyle.setDataFormat(wb.createDataFormat().getFormat("0.0"));
            var wrapStyle = wb.createCellStyle();
            wrapStyle.setWrapText(true);

            DateTimeFormatter vn = VN_DATE;
            var r0 = sheet.createRow(0);
            r0.createCell(0).setCellValue("BẢNG TỔNG HỢP OKR CÔNG TY — NĂM " + y);
            r0.getCell(0).setCellStyle(titleStyle);
            sheet.createRow(1).createCell(0).setCellValue("Thời gian công tác tính từ ngày vào làm tới "
                    + seniorityCutoff.format(vn) + " · Xuất ngày " + LocalDate.now().format(vn)
                    + " · Điểm OKR là điểm chính thức do Quản lý chấm (thang 1–5, điểm TB tự tính).");

            String[] headers = {
                    "STT", "Họ và tên", "Code nhân viên", "Vị trí", "Thời gian công tác",
                    "Phòng ban", "Tên quản lý", "Điểm OKR công việc", "Điểm OKR con người",
                    "Điểm trung bình OKR", "Note",
                    // Cột theo dõi thêm (ngoài 9 trường chuẩn)
                    "Ngày vào làm", "Trạng thái", "Tự chấm công việc", "Tự chấm con người", "Nhận xét của Quản lý"
            };
            var head = sheet.createRow(3);
            for (int i = 0; i < headers.length; i++) {
                var cell = head.createCell(i);
                cell.setCellValue(headers[i]);
                cell.setCellStyle(headerStyle);
            }
            int rowIndex = 4;
            for (HRSummaryReportItem r : records) {
                var row = sheet.createRow(rowIndex++);
                putInt.accept(row, new int[]{0, r.getStt()});
                row.createCell(1).setCellValue(r.getFullName());
                row.createCell(2).setCellValue(r.getEmployeeCode());
                row.createCell(3).setCellValue(r.getJobTitle());
                row.createCell(4).setCellValue(r.getSeniority());
                row.createCell(5).setCellValue(r.getDepartment());
                row.createCell(6).setCellValue(r.getDirectManagerName());
                if (r.getBusinessScore() != null) putInt.accept(row, new int[]{7, r.getBusinessScore()});
                if (r.getPeopleScore() != null) putInt.accept(row, new int[]{8, r.getPeopleScore()});
                if (r.getAverageScore() != null) {
                    var c = row.createCell(9);
                    c.setCellValue(r.getAverageScore());
                    c.setCellStyle(avgStyle);
                }
                var noteCell = row.createCell(10);
                noteCell.setCellValue(r.getNote() == null ? "" : r.getNote());
                noteCell.setCellStyle(wrapStyle);
                row.createCell(11).setCellValue(r.getJoinedDate() == null ? "" : r.getJoinedDate().format(vn));
                row.createCell(12).setCellValue(statusLabel(r.getStatus()));
                if (r.getSelfBusinessScore() != null) putInt.accept(row, new int[]{13, r.getSelfBusinessScore()});
                if (r.getSelfPeopleScore() != null) putInt.accept(row, new int[]{14, r.getSelfPeopleScore()});
                var mc = row.createCell(15);
                mc.setCellValue(r.getManagerComment() == null ? "" : r.getManagerComment());
                mc.setCellStyle(wrapStyle);
            }
            for (int i = 0; i < headers.length; i++) {
                sheet.autoSizeColumn(i);
                if (sheet.getColumnWidth(i) > 50 * 256) sheet.setColumnWidth(i, 50 * 256);
            }
            sheet.createFreezePane(3, 4);
            sheet.setAutoFilter(new org.apache.poi.ss.util.CellRangeAddress(3, Math.max(3, rowIndex - 1), 0, headers.length - 1));

            java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
            wb.write(out);
            String fileName = "Bao_Cao_Tong_Hop_OKR_" + y + ".xlsx";
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + fileName + "\"")
                    .contentType(org.springframework.http.MediaType.parseMediaType(
                            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                    .body(out.toByteArray());
        } catch (java.io.IOException e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    private String statusLabel(String status) {
        return switch (status == null ? "" : status) {
            case "DA_HOAN_TAT" -> "Đã chấm xong";
            case "CHO_QL_CHAM" -> "Chờ QL chấm";
            case "CHUA_CO_OKR" -> "Chưa có OKR được duyệt";
            default -> "Chưa tự đánh giá";
        };
    }
}
