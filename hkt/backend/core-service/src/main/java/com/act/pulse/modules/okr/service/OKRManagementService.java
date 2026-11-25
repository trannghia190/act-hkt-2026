package com.act.pulse.modules.okr.service;

import com.act.pulse.common.security.CurrentUser;
import com.act.pulse.modules.attendance.entity.Team;
import com.act.pulse.modules.attendance.repository.TeamRepository;
import com.act.pulse.modules.auth.entity.User;
import com.act.pulse.modules.auth.repository.UserRepository;
import com.act.pulse.modules.okr.entity.*;
import com.act.pulse.modules.okr.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.*;

/** Logic dùng chung cho duyệt, mid-year, review nhóm và báo cáo HR. */
@Service
@RequiredArgsConstructor
public class OKRManagementService {

    private final OKRReviewRepository reviewRepository;
    private final OKRItemRepository itemRepository;
    private final OKRCheckInRepository checkInRepository;
    private final OKRAuditLogRepository auditLogRepository;
    private final OKRMidYearReviewRepository midYearReviewRepository;
    private final UserRepository userRepository;
    private final TeamRepository teamRepository;
    private final com.act.pulse.modules.notification.service.NotificationDispatcher notificationDispatcher;
    private final OKRCycleRepository cycleRepository;
    private final OKRPhaseService phaseService;

    public User currentUser() {
        UUID id = CurrentUser.userId();
        return id == null ? null : userRepository.findById(id).orElse(null);
    }

    public boolean isHrOrAdmin() {
        return CurrentUser.isHr();
    }

    public boolean canManage(OKRReview review, User actor) {
        if (review == null || actor == null) return false;
        if (isHrOrAdmin()) return true;
        return actor.getId().equals(review.getManagerId());
    }

    // ------------------------------------------------------------------ rules

    public User requireCurrentUser() {
        User u = currentUser();
        if (u == null) throw OKRRuleException.forbidden("Chưa đăng nhập");
        return u;
    }

    public OKRReview requireReview(UUID id) {
        if (id == null) throw OKRRuleException.notFound("Không tìm thấy hồ sơ OKR");
        return reviewRepository.findById(id).orElseThrow(() -> OKRRuleException.notFound("Không tìm thấy hồ sơ OKR"));
    }

    public void requireOwner(OKRReview review, User actor) {
        if (review == null || actor == null || !actor.getId().equals(review.getUserId())) {
            throw OKRRuleException.forbidden("Chỉ chủ sở hữu OKR mới được thực hiện thao tác này");
        }
    }

    public void requireManager(OKRReview review, User actor) {
        if (!canManage(review, actor)) {
            throw OKRRuleException.forbidden("Chỉ Quản lý trực tiếp của nhân viên hoặc HR mới được thực hiện thao tác này");
        }
    }

    /** Chu kỳ gắn với review (theo cycle_id, fallback theo năm). */
    public OKRCycle cycleOf(OKRReview review) {
        if (review == null) return null;
        if (review.getCycleId() != null) {
            OKRCycle c = cycleRepository.findById(review.getCycleId()).orElse(null);
            if (c != null) return c;
        }
        return phaseService.cycle(review.getCycleYear()).orElse(null);
    }

    /** OKR đã từng được quản lý duyệt ít nhất 1 lần (dùng cho lịch sử / nhắc việc). */
    public boolean isApproved(OKRReview review) {
        return review != null && review.getLockedAt() != null && !"draft".equalsIgnoreCase(review.getStatus());
    }

    /** Bộ OKR đã từng được gửi lên Quản lý (không phải bản nháp / hồ sơ tự tạo chưa gửi lần nào). */
    public boolean reachedManager(OKRReview review) {
        if (review == null || "draft".equalsIgnoreCase(review.getStatus())) return false;
        return review.getSubmittedAt() != null || review.getLockedAt() != null;
    }

    /** OKR đang ở trạng thái đã duyệt hiện hành (locked). Returned/reopened/submitted không tính. */
    public boolean isCurrentlyApproved(OKRReview review) {
        return review != null && "locked".equalsIgnoreCase(review.getStatus());
    }

    /** Kỳ check-in tiến độ đang thực sự cần nhân viên cập nhật (null = không có việc). */
    public record CheckInDue(String period, LocalDate deadline, int pendingItems) {}

    /**
     * Điều kiện để sinh việc "Check-in tiến độ OKR" cho một nhân viên — phải khớp
     * với panel việc cần làm trên OKR Dashboard: cửa sổ cập nhật đang mở, OKR đã
     * được duyệt, còn đầu việc chưa cập nhật trong kỳ hiện tại.
     */
    public CheckInDue checkInDue(UUID userId, int year) {
        if (userId == null) return null;
        OKRCycle cycle = phaseService.cycle(year).orElse(null);
        if (cycle == null) return null;
        OKRReview review = reviewRepository.findByUserIdAndCycleYear(userId, year).orElse(null);
        if (!isCurrentlyApproved(review)) return null;
        if (phaseService.updateWindow(cycle, review) == null) return null;

        List<OKRItem> items = activeItems(review.getId());
        if (items.isEmpty()) return null;

        String period = phaseService.currentPeriod(cycle, review);
        Set<UUID> checked = new HashSet<>();
        checkInRepository.findByReviewIdAndPeriodOrderByCreatedAtDesc(review.getId(), period)
                .forEach(ci -> checked.add(ci.getItemId()));
        int pending = (int) items.stream().filter(i -> !checked.contains(i.getId())).count();
        if (pending == 0) return null;

        return new CheckInDue(period, phaseService.currentPeriodDeadline(cycle, review), pending);
    }

    /** Một việc OKR cần làm — nguồn chung cho Todo Inbox và panel OKR Dashboard. */
    public record OkrTask(String id, String type, String title, String status, LocalDate deadline,
                          String actionUrl, String actionText, String priority) {}

    /**
     * Danh sách việc OKR của một nhân viên — dùng chung cho Todo Inbox và
     * {@code GET /okr/dashboard} để hai màn hình không lệch nhau.
     * <p>Chỉ trả về việc thật sự còn hành động được: tạo/gửi/sửa bộ mục tiêu,
     * check-in tiến độ, tự chấm điểm và hoàn thiện đề xuất kỳ sau.</p>
     */
    public List<OkrTask> okrTasks(User user, int year) {
        List<OkrTask> tasks = new ArrayList<>();
        if (user == null) return tasks;
        OKRCycle cycle = phaseService.cycle(year).orElse(null);
        if (cycle == null) return tasks;
        OKRReview review = reviewRepository.findByUserIdAndCycleYear(user.getId(), year).orElse(null);
        List<OKRItem> items = review != null ? activeItems(review.getId()) : List.of();
        LocalDate setupDue = phaseService.dueDate(cycle, OKRPhaseService.SETUP);
        String st = review == null ? "draft" : String.valueOf(review.getStatus()).toLowerCase();

        // 1. Bộ mục tiêu: tạo / gửi duyệt / sửa theo góp ý.
        if (goalsLockReason(user, review, cycle) == null) {
            switch (st) {
                case "returned" -> tasks.add(new OkrTask("todo-fix-okr", "FIX_OKR",
                        "Sửa OKR theo góp ý của Quản lý và gửi lại", "PENDING", setupDue,
                        "/okr/my-okr", "Sửa OKR", "HIGH"));
                case "reopened" -> tasks.add(new OkrTask("todo-reopened", "FIX_OKR",
                        "Bổ sung OKR (Quản lý đã mở lại) và nộp lại", "PENDING", null,
                        "/okr/my-okr", "Bổ sung ngay", "HIGH"));
                default -> {
                    if (items.isEmpty()) {
                        tasks.add(new OkrTask("todo-create-okr", "CREATE_OKR",
                                "Tạo bộ mục tiêu OKR 2 nhóm Business & People", "PENDING", setupDue,
                                "/okr/my-okr", "Tạo OKR ngay", "HIGH"));
                    } else {
                        tasks.add(new OkrTask("todo-submit-okr", "SUBMIT_OKR",
                                "Gửi bộ mục tiêu OKR cho Quản lý duyệt", "PENDING", setupDue,
                                "/okr/my-okr", "Gửi duyệt", "HIGH"));
                    }
                }
            }
        }

        // 1b. Đã gửi lên, đang chờ Quản lý duyệt — nhắc theo dõi (việc chờ, không phải hành động).
        if ("submitted".equals(st)) {
            tasks.add(new OkrTask("todo-approval", "APPROVAL",
                    "Chờ Quản lý phê duyệt bộ mục tiêu OKR", "WAITING", null,
                    "/okr/my-okr", "Xem chi tiết", "LOW"));
        }

        // 2. Check-in tiến độ — chỉ khi cửa sổ mở, OKR đã duyệt và còn đầu việc chưa cập nhật.
        CheckInDue due = checkInDue(user.getId(), year);
        if (due != null) {
            tasks.add(new OkrTask("todo-okr-checkin-" + due.period(), "CHECKIN",
                    "Check-in tiến độ kỳ " + phaseService.periodLabel(due.period())
                            + " (" + due.pendingItems() + " đầu việc chưa cập nhật)",
                    "PENDING", due.deadline(), "/okr/my-okr?checkin=1", "Check-in ngay", "HIGH"));
        }

        // 3. Tự chấm điểm cuối năm — chỉ trong cửa sổ NV của phase Đánh giá cuối năm.
        if (review != null && selfAssessLockReason(review, cycle) == null) {
            boolean finalStepPending = OKRPhaseService.FINAL.equals(selfAssessPhase(review, cycle))
                    && review.getCurrentStep() != null && review.getCurrentStep() < 3;
            if (!selfAssessed(review) || finalStepPending) {
                tasks.add(new OkrTask("todo-self-assessment", "SELF_ASSESSMENT",
                        "Tự chấm điểm cuối năm cho 2 nhóm Business & People",
                        "PENDING", phaseService.dueDate(cycle, OKRPhaseService.FINAL),
                        "/okr/my-okr?section=assessment", "Tự chấm điểm ngay", "HIGH"));
            }
        }

        // 4. Định hướng & đề xuất kỳ sau — chỉ khi còn sửa được mục tiêu.
        if (goalsLockReason(user, review, cycle) == null) {
            String proposal = review == null ? null : review.getBox4Proposal();
            boolean submitted = review != null && ("submitted".equalsIgnoreCase(review.getStatus())
                    || "locked".equalsIgnoreCase(review.getStatus()));
            boolean started = proposal != null && !proposal.isBlank();
            if (!submitted) {
                tasks.add(new OkrTask("todo-proposal", "PROPOSAL",
                        "Hoàn thiện định hướng & đề xuất kỳ " + year,
                        started ? "DRAFT" : "NOT_STARTED", setupDue, "/okr/my-okr",
                        started ? "Tiếp tục viết" : "Bắt đầu viết", "MEDIUM"));
            }
        }
        return tasks;
    }

    /** Lý do NV không sửa được form tự đánh giá (null = sửa được) — cùng luật với controller OKR. */
    public String selfAssessLockReason(OKRReview review, OKRCycle cycle) {
        if (review == null) return "Chưa có OKR trong chu kỳ này";
        if (cycle == null) return "Chưa có chu kỳ OKR";
        if (phaseService.isCycleLocked(cycle)) return "Chu kỳ OKR đã được HR chốt & khoá";
        if (!phaseService.employeeWindowOpen(cycle, OKRPhaseService.FINAL, review)) {
            String reason = phaseService.employeeWindowBlockReason(cycle, OKRPhaseService.FINAL, review);
            return reason != null ? reason : "Chỉ tự chấm điểm trong phase Đánh giá cuối năm";
        }
        if (!isCurrentlyApproved(review)) return "OKR chưa được duyệt hoặc đang mở sửa — cần Quản lý duyệt lại trước khi tự chấm";
        if (managerAssessed(review)) return "Quản lý đã chấm điểm — không sửa tự đánh giá được nữa";
        return null;
    }

    /** Phase Đánh giá cuối năm đang mở cho nhân viên (null = chưa mở). */
    public String selfAssessPhase(OKRReview review, OKRCycle cycle) {
        if (cycle == null || phaseService.isCycleLocked(cycle)) return null;
        return phaseService.employeeWindowOpen(cycle, OKRPhaseService.FINAL, review)
                ? OKRPhaseService.FINAL : null;
    }

    /** Người đang làm việc (trừ ADMIN/HR_ADMIN, trừ tài khoản chưa kích hoạt/nghỉ) chưa có OKR trong năm. */
    public long pendingNoOkrCount(int year) {
        // Hồ sơ được tạo tự động đầu kỳ → "chưa có OKR" = chưa có bộ mục tiêu nào được Quản lý duyệt
        Set<UUID> approved = new HashSet<>();
        for (OKRReview r : reviewRepository.findByCycleYear(year)) if (r.getLockedAt() != null) approved.add(r.getUserId());
        long count = 0;
        for (User u : userRepository.findAll()) {
            if (approved.contains(u.getId())) continue;
            if (!"ACTIVE".equalsIgnoreCase(u.getStatus())) continue;
            if ("ADMIN".equalsIgnoreCase(u.getRole()) || "HR_ADMIN".equalsIgnoreCase(u.getRole())) continue;
            count++;
        }
        return count;
    }

    public long pendingManagerAssessmentCount(int year) {
        return reviewRepository.findByCycleYear(year).stream()
                .filter(r -> !"DA_HOAN_TAT".equals(assessmentStatus(r)))
                .count();
    }

    /**
     * Nhân viên được sửa bộ mục tiêu khi:
     * - bản nháp và phase Thiết lập đang mở; hoặc
     * - quản lý đã trả lại / mở lại cho sửa (returned / reopened).
     * Đã gửi (submitted) hoặc đã duyệt (locked) → khoá. Chu kỳ đã chốt → khoá.
     */
    public String goalsLockReason(OKRReview review, OKRCycle cycle) {
        User owner = review == null ? null : userRepository.findById(review.getUserId()).orElse(null);
        return goalsLockReason(owner, review, cycle);
    }

    /** Người vào làm sau hạn chót phase Thiết lập — được tự tạo OKR, không cần chờ mở lại. */
    public boolean isLateJoiner(User owner, OKRCycle cycle) {
        if (owner == null) return false;
        java.time.LocalDate joined = owner.getJoinedDate() != null ? owner.getJoinedDate() : owner.getHireDate();
        java.time.LocalDate setupDue = phaseService.dueDate(cycle, OKRPhaseService.SETUP);
        return joined != null && setupDue != null && joined.isAfter(setupDue);
    }

    /**
     * Lý do khoá sửa bộ mục tiêu (null = sửa được). review = null nghĩa là chưa có hồ sơ (coi như bản nháp).
     * Bản nháp sửa được khi: phase Thiết lập đang mở, HOẶC người vào làm sau hạn Thiết lập (người mới giữa năm).
     * Ngoài ra Quản lý / HR có thể "mở cho nhân viên tạo OKR" (status reopened).
     */
    public String goalsLockReason(User owner, OKRReview review, OKRCycle cycle) {
        if (cycle == null) return "Chưa có chu kỳ OKR cho năm này";
        if (phaseService.isCycleLocked(cycle)) return "Chu kỳ OKR đã được HR chốt & khoá";
        String st = review == null || review.getStatus() == null ? "draft" : review.getStatus().toLowerCase();
        switch (st) {
            case "returned", "reopened":
                return null;
            case "draft": {
                if (phaseService.employeeWindowOpen(cycle, OKRPhaseService.SETUP, review) || isLateJoiner(owner, cycle)) return null;
                String setupReason = phaseService.employeeWindowBlockReason(cycle, OKRPhaseService.SETUP, review);
                return setupReason != null ? setupReason
                        : "Phase Thiết lập OKR đã đóng (hạn " + phaseService.dueDate(cycle, OKRPhaseService.SETUP)
                        + ") — liên hệ HR mở lại phase Thiết lập để tạo OKR";
            }
            case "submitted":
                return "Bộ mục tiêu đã gửi, đang chờ Quản lý duyệt";
            default:
                return "Bộ mục tiêu đã được duyệt và khoá sửa — chỉ Quản lý mở lại được";
        }
    }

    public void requireGoalsEditable(OKRReview review) {
        String reason = goalsLockReason(review, cycleOf(review));
        if (reason != null) throw OKRRuleException.forbidden(reason);
    }

    /** Trạng thái của bộ OKR ngay trước lần gửi duyệt gần nhất (để rút lại đúng chỗ). */
    public String statusBeforeLastSubmit(OKRReview review) {
        for (OKRAuditLog log : auditLogRepository.findByReviewIdOrderByCreatedAtDesc(review.getId())) {
            if (!"SUBMIT".equals(log.getAction())) continue;
            String old = log.getOldValue() == null ? "" : log.getOldValue().toLowerCase();
            if (old.equals("draft") || old.equals("returned") || old.equals("reopened")) return old;
            break;
        }
        // Không có vết: đã từng được duyệt → mở sửa; chưa từng duyệt → bản nháp
        return review.getLockedAt() != null ? "reopened" : "draft";
    }

    public boolean selfAssessed(OKRReview review) {
        return review != null && review.getBox2SelfScore() != null && review.getBox3SelfScore() != null;
    }

    public boolean managerAssessed(OKRReview review) {
        return review != null && review.getBox2ManagerScore() != null && review.getBox3ManagerScore() != null;
    }

    /** Thang điểm của chu kỳ do HR cấu hình (mặc định 1–5). Trả về [min, max]. */
    public int[] scale(OKRCycle cycle) {
        int min = cycle != null && cycle.getScaleMin() != null ? cycle.getScaleMin() : 1;
        int max = cycle != null && cycle.getScaleMax() != null ? cycle.getScaleMax() : 5;
        return min < max ? new int[]{min, max} : new int[]{1, 5};
    }

    public static int requireScore(Object raw, String label) {
        return requireScore(raw, label, 1, 5);
    }

    /** Điểm phải là số nguyên trong thang [min, max] của chu kỳ — không điểm lẻ. */
    public static int requireScore(Object raw, String label, int min, int max) {
        String range = "số nguyên từ " + min + " đến " + max;
        if (raw == null || raw.toString().isBlank()) throw OKRRuleException.badRequest(label + " là bắt buộc (" + range + ")");
        double d;
        try {
            d = Double.parseDouble(raw.toString());
        } catch (NumberFormatException e) {
            throw OKRRuleException.badRequest(label + " phải là " + range);
        }
        if (d < min || d > max || d % 1 != 0) throw OKRRuleException.badRequest(label + " phải là " + range);
        return (int) d;
    }

    public int requireScore(Object raw, String label, OKRReview review) {
        int[] sc = scale(cycleOf(review));
        return requireScore(raw, label, sc[0], sc[1]);
    }

    // ------------------------------------------------------------------ data

    public List<OKRItem> activeItems(UUID reviewId) {
        return itemRepository.findByReviewIdAndDeletedAtIsNullOrderById(reviewId);
    }

    public double groupProgress(UUID reviewId, String group) {
        return activeItems(reviewId).stream()
                .filter(i -> group.equalsIgnoreCase(i.getGroupType()))
                .mapToInt(OKRItem::getProgress)
                .average()
                .orElse(0.0);
    }

    public double overallProgress(UUID reviewId) {
        return activeItems(reviewId).stream().mapToInt(OKRItem::getProgress).average().orElse(0.0);
    }

    /** Công thức đề xuất minh bạch: tiến độ 0–100% → thang 1–5 (0% = 1, 100% = 5), làm tròn nguyên theo nhóm. */
    public int suggestedScore(double progressPercent) {
        return suggestedScore(progressPercent, 1, 5);
    }

    /** Quy đổi tiến độ 0–100% sang thang điểm của chu kỳ (0% = min, 100% = max), làm tròn nguyên. */
    public int suggestedScore(double progressPercent, int min, int max) {
        double p = Math.max(0, Math.min(100, progressPercent)) / 100.0;
        return Math.max(min, Math.min(max, (int) Math.round(min + p * (max - min))));
    }

    public int suggestedScore(OKRReview review, String group) {
        int[] sc = scale(cycleOf(review));
        return suggestedScore(groupProgress(review.getId(), group), sc[0], sc[1]);
    }

    /** Điểm đề xuất của review = TB điểm đề xuất 2 nhóm (cùng cách tính với điểm TB thật). */
    public double proposedAverage(OKRReview review) {
        return (suggestedScore(review, "BUSINESS") + suggestedScore(review, "PEOPLE")) / 2.0;
    }

    public Double selfBusiness(OKRReview review) {
        return review == null || review.getBox2SelfScore() == null ? null : review.getBox2SelfScore().doubleValue();
    }

    public Double selfPeople(OKRReview review) {
        return review == null || review.getBox3SelfScore() == null ? null : review.getBox3SelfScore().doubleValue();
    }

    public Double selfAverage(OKRReview review) {
        Double b = selfBusiness(review);
        Double p = selfPeople(review);
        return b == null || p == null ? null : (b + p) / 2.0;
    }

    public Double managerAverage(OKRReview review) {
        if (!managerAssessed(review)) return null;
        return (review.getBox2ManagerScore() + review.getBox3ManagerScore()) / 2.0;
    }

    /**
     * Điểm hiện hành theo CẶP (không trộn nhóm): có đủ điểm quản lý → dùng điểm quản lý;
     * chưa có → dùng điểm tự chấm; chưa có gì → null. Trả về [business, people, source].
     */
    public Object[] currentScores(OKRReview review) {
        if (managerAssessed(review)) {
            return new Object[]{review.getBox2ManagerScore(), review.getBox3ManagerScore(), "MANAGER"};
        }
        if (selfAssessed(review)) {
            return new Object[]{review.getBox2SelfScore(), review.getBox3SelfScore(), "SELF"};
        }
        return new Object[]{null, null, null};
    }

    public String assessmentStatus(OKRReview review) {
        // Chưa có bộ OKR được duyệt (hồ sơ nháp tự tạo đầu kỳ, đang soạn, đang chờ duyệt lần đầu)
        if (review == null || review.getLockedAt() == null) return "CHUA_CO_OKR";
        if (!selfAssessed(review)) return "CHUA_TU_DANH_GIA";
        if (!managerAssessed(review)) return "CHO_QL_CHAM";
        return "DA_HOAN_TAT";
    }

    /** Check-in mới nhất của mỗi kỳ (bỏ các bản trùng trong cùng kỳ), sắp xếp kỳ mới → cũ. */
    public List<OKRCheckIn> latestPerPeriod(UUID itemId) {
        Map<String, OKRCheckIn> byPeriod = new LinkedHashMap<>();
        for (OKRCheckIn ci : checkInRepository.findByItemIdOrderByCreatedAtDesc(itemId)) {
            byPeriod.putIfAbsent(ci.getPeriod(), ci);
        }
        List<OKRCheckIn> list = new ArrayList<>(byPeriod.values());
        // Sắp theo thời điểm ghi nhận: kỳ chốt cuối năm (yyyy-FINAL) có tên kỳ đứng trước "yyyy-11"
        // theo thứ tự chuỗi nhưng luôn được ghi sau các kỳ tháng/quý.
        list.sort(Comparator.comparing(
                (OKRCheckIn ci) -> ci.getCreatedAt() == null ? LocalDateTime.MIN : ci.getCreatedAt()
        ).reversed());
        return list;
    }

    public List<Map<String, Object>> checkInTrend(UUID itemId, int limit) {
        List<Map<String, Object>> trend = new ArrayList<>();
        List<OKRCheckIn> rows = latestPerPeriod(itemId);
        for (int i = 0; i < Math.min(limit, rows.size()); i++) {
            OKRCheckIn ci = rows.get(i);
            Map<String, Object> m = new HashMap<>();
            m.put("id", ci.getId().toString());
            m.put("period", ci.getPeriod());
            m.put("previousValue", ci.getPreviousValue());
            m.put("newValue", ci.getNewValue());
            m.put("progressSnapshot", ci.getProgressSnapshot());
            m.put("note", ci.getNote());
            m.put("createdAt", ci.getCreatedAt());
            trend.add(m);
        }
        return trend;
    }

    public static final int STAGNANT_PERIODS = 3;
    public static final double SCORE_GAP_THRESHOLD = 0.2;

    /** Cảnh báo rule C8/F5/F7. */
    public List<Map<String, Object>> warnings(OKRReview review) {
        List<Map<String, Object>> warnings = new ArrayList<>();
        if (review == null) return warnings;
        List<OKRItem> items = activeItems(review.getId());

        // Đứng yên ≥ 3 kỳ: 3 kỳ check-in gần nhất liên tiếp đều không đổi giá trị so với kỳ trước.
        for (OKRItem item : items) {
            if (item.getProgress() != null && item.getProgress() >= 100) continue;
            List<OKRCheckIn> periods = latestPerPeriod(item.getId());
            if (periods.size() < STAGNANT_PERIODS) continue;
            boolean stagnant = periods.subList(0, STAGNANT_PERIODS).stream()
                    .allMatch(ci -> ci.getPreviousValue() != null
                            && Math.abs(ci.getNewValue() - ci.getPreviousValue()) < 0.0001);
            if (stagnant) {
                warnings.add(Map.of(
                        "code", "STAGNANT",
                        "level", "HIGH",
                        "message", "Tiến độ đứng yên ≥ " + STAGNANT_PERIODS + " kỳ: " + item.getTitle()
                ));
            }
        }

        // Lệch điểm tự chấm vs điểm đề xuất theo tiến độ (cùng thang TB 2 nhóm).
        Double selfAvg = selfAverage(review);
        if (selfAvg != null && !items.isEmpty()) {
            double proposed = proposedAverage(review);
            if (Math.abs(selfAvg - proposed) > SCORE_GAP_THRESHOLD) {
                warnings.add(Map.of(
                        "code", "SCORE_GAP",
                        "level", "MEDIUM",
                        "message", String.format("Lệch điểm tự chấm (%.1f) vs đề xuất theo tiến độ (%.1f) > %.1f",
                                selfAvg, proposed, SCORE_GAP_THRESHOLD)
                ));
            }
        }

        // Chưa check-in kỳ hiện tại — chỉ khi cửa sổ cập nhật tiến độ đang mở và OKR đã duyệt.
        OKRCycle cycle = cycleOf(review);
        if (!items.isEmpty() && isCurrentlyApproved(review) && phaseService.updateWindow(cycle, review) != null) {
            String period = phaseService.currentPeriod(cycle, review);
            boolean checked = !checkInRepository.findByReviewIdAndPeriodOrderByCreatedAtDesc(review.getId(), period).isEmpty();
            if (!checked) {
                warnings.add(Map.of(
                        "code", "NO_CHECKIN",
                        "level", "MEDIUM",
                        "message", "Chưa check-in trong kỳ " + phaseService.periodLabel(period)
                ));
            }
        }
        return warnings;
    }

    public Map<String, Object> teamRow(OKRReview review) {
        User user = userRepository.findById(review.getUserId()).orElse(null);
        User manager = review.getManagerId() == null ? null : userRepository.findById(review.getManagerId()).orElse(null);
        String teamName = user != null && user.getTeamId() != null
                ? teamRepository.findById(user.getTeamId()).map(Team::getName).orElse("")
                : "";

        double businessProgress = groupProgress(review.getId(), "BUSINESS");
        double peopleProgress = groupProgress(review.getId(), "PEOPLE");
        double overall = overallProgress(review.getId());
        double proposed = proposedAverage(review);
        Double selfB = selfBusiness(review);
        Double selfP = selfPeople(review);
        Double selfAvg = selfAverage(review);
        Double mgrAvg = managerAverage(review);
        List<Map<String, Object>> warnings = warnings(review);

        Map<String, Object> row = new HashMap<>();
        row.put("reviewId", review.getId().toString());
        row.put("employeeCode", user != null ? user.getEmployeeCode() : "");
        row.put("fullName", user != null ? user.getFullName() : "");
        row.put("jobTitle", user != null && user.getPositionName() != null ? user.getPositionName() : "");
        row.put("team", teamName);
        row.put("managerName", manager != null ? manager.getFullName() : "");
        row.put("status", assessmentStatus(review));
        row.put("okrStatus", review.getStatus());
        row.put("businessProgress", Math.round(businessProgress * 10.0) / 10.0);
        row.put("peopleProgress", Math.round(peopleProgress * 10.0) / 10.0);
        row.put("overallProgress", Math.round(overall * 10.0) / 10.0);
        row.put("selfBusiness", selfB);
        row.put("selfPeople", selfP);
        row.put("selfAverage", selfAvg);
        row.put("managerBusiness", review.getBox2ManagerScore());
        row.put("managerPeople", review.getBox3ManagerScore());
        row.put("managerAverage", mgrAvg);
        row.put("proposedScore", proposed);
        row.put("proposedBusiness", suggestedScore(review, "BUSINESS"));
        row.put("proposedPeople", suggestedScore(review, "PEOPLE"));
        row.put("gap", selfAvg == null ? null : Math.round((selfAvg - proposed) * 10.0) / 10.0);
        row.put("warnings", warnings);
        row.put("warningCount", warnings.size());
        // Việc cần xem trước lên trên: cảnh báo HIGH = 2 điểm, MEDIUM = 1; chưa được quản lý chấm +1.
        int risk = 0;
        for (Map<String, Object> w : warnings) risk += "HIGH".equals(w.get("level")) ? 2 : 1;
        if (!managerAssessed(review)) risk += 1;
        row.put("riskScore", risk);
        int checkinCount = 0;
        LocalDateTime lastCheckin = null;
        for (OKRItem item : activeItems(review.getId())) {
            List<OKRCheckIn> rows = checkInRepository.findByItemIdOrderByCreatedAtDesc(item.getId());
            checkinCount += rows.size();
            for (OKRCheckIn ci : rows) {
                if (lastCheckin == null || (ci.getCreatedAt() != null && ci.getCreatedAt().isAfter(lastCheckin))) {
                    lastCheckin = ci.getCreatedAt();
                }
            }
        }
        row.put("checkinCount", checkinCount);
        row.put("lastCheckinAt", lastCheckin);
        return row;
    }

    public Map<String, Object> midYearDetail(OKRReview review) {
        Map<String, Object> detail = new HashMap<>(teamRow(review));
        User user = userRepository.findById(review.getUserId()).orElse(null);
        detail.put("userId", review.getUserId().toString());
        detail.put("email", user != null ? user.getEmail() : "");
        detail.put("joinedDate", user != null ? user.getJoinedDate() : null);

        List<Map<String, Object>> business = new ArrayList<>();
        List<Map<String, Object>> people = new ArrayList<>();
        for (OKRItem item : activeItems(review.getId())) {
            Map<String, Object> m = new HashMap<>();
            m.put("id", item.getId().toString());
            m.put("groupType", item.getGroupType());
            m.put("title", item.getTitle());
            m.put("detail", item.getDetail());
            m.put("progress", item.getProgress());
            m.put("dueDate", item.getDueDate());
            m.put("checkInTrend", checkInTrend(item.getId(), 6));
            if ("PEOPLE".equalsIgnoreCase(item.getGroupType())) people.add(m);
            else business.add(m);
        }
        detail.put("businessItems", business);
        detail.put("peopleItems", people);

        OKRMidYearReview mid = midYearReviewRepository.findByReviewId(review.getId()).orElse(null);
        Map<String, Object> midMap = new HashMap<>();
        midMap.put("id", mid != null ? mid.getId().toString() : null);
        midMap.put("employeeFeedback", mid != null ? nullToEmpty(mid.getEmployeeFeedback()) : "");
        midMap.put("managerCoaching", mid != null ? nullToEmpty(mid.getManagerCoaching()) : "");
        midMap.put("h2Commitment", mid != null ? nullToEmpty(mid.getH2Commitment()) : "");
        midMap.put("status", mid != null ? mid.getStatus() : "draft");
        midMap.put("updatedAt", mid != null ? mid.getUpdatedAt() : null);
        detail.put("midYear", midMap);

        List<Map<String, Object>> audit = new ArrayList<>();
        for (OKRAuditLog log : auditLogRepository.findByReviewIdOrderByCreatedAtDesc(review.getId())) {
            Map<String, Object> m = new HashMap<>();
            m.put("id", log.getId().toString());
            m.put("actorName", log.getActorName());
            m.put("action", log.getAction());
            m.put("fieldName", log.getFieldName());
            m.put("oldValue", log.getOldValue());
            m.put("newValue", log.getNewValue());
            m.put("reason", log.getReason());
            m.put("createdAt", log.getCreatedAt());
            audit.add(m);
        }
        detail.put("auditTrail", audit);
        return detail;
    }

    @Transactional
    public void audit(UUID reviewId, UUID cycleId, UUID itemId, String action,
                      String fieldName, String oldValue, String newValue, String reason) {
        User actor = currentUser();
        auditLogRepository.save(OKRAuditLog.builder()
                .reviewId(reviewId)
                .cycleId(cycleId)
                .itemId(itemId)
                .actorId(actor != null ? actor.getId() : null)
                .actorName(actor != null ? actor.getFullName() : "Hệ thống")
                .action(action)
                .fieldName(fieldName)
                .oldValue(oldValue)
                .newValue(newValue)
                .reason(reason)
                .build());
    }

    /** Gửi thông báo cho user — đi qua dispatcher để tôn trọng cấu hình tuỳ chỉnh. */
    public void notify(UUID userId, String title, String content, String type, String actionUrl) {
        notify(userId, title, content, type, "MEDIUM", actionUrl, null);
    }

    /** @param eventKey khóa sự kiện chuẩn hóa (bật/tắt theo người dùng); null = dùng {@code type}. */
    public void notify(UUID userId, String title, String content, String type, String priority,
                       String actionUrl, String eventKey) {
        if (userId == null) return;
        notificationDispatcher.dispatch(
                eventKey != null && !eventKey.isBlank() ? eventKey : type,
                userId, title, content, type, priority, actionUrl, null);
    }

    private String nullToEmpty(String value) {
        return value == null ? "" : value;
    }
}
