package com.act.pulse.modules.okr.controller;

import com.act.pulse.common.response.ApiResponse;
import com.act.pulse.common.security.CurrentUser;
import com.act.pulse.modules.auth.entity.User;
import com.act.pulse.modules.auth.repository.UserRepository;
import com.act.pulse.modules.okr.entity.OKRCycle;
import com.act.pulse.modules.okr.repository.OKRCycleRepository;
import com.act.pulse.modules.okr.entity.OKRReview;
import com.act.pulse.modules.okr.repository.OKRReviewRepository;
import com.act.pulse.modules.okr.service.OKRManagementService;
import com.act.pulse.modules.okr.service.OKRPhaseService;
import com.act.pulse.modules.okr.service.OKRRuleException;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.*;

/** F9 — HR cấu hình chu kỳ OKR 5 phase, thang điểm, tần suất check-in, khoá/mở lại. */
@RestController
@RequestMapping("/okr/cycles")
@RequiredArgsConstructor
@Tag(name = "3.4 OKR Cycle Configuration", description = "Cấu hình 5 phase, thang điểm 1-5, check-in interval, khoá theo hạn chót")
public class OKRCycleController {

    private final OKRCycleRepository cycleRepository;
    private final OKRManagementService management;
    private final ObjectMapper objectMapper;
    private final OKRPhaseService phaseService;
    private final OKRReviewRepository reviewRepository;
    private final com.act.pulse.modules.okr.service.OKRReviewProvisioningJob provisioning;
    private final UserRepository userRepository;
    private final com.act.pulse.modules.okr.service.OKRPhaseDeadlineReminderJob deadlineReminderJob;

    @jakarta.persistence.PersistenceContext
    private jakarta.persistence.EntityManager entityManager;

    @GetMapping
    @Operation(summary = "Danh sách chu kỳ OKR")
    public ApiResponse<List<Map<String, Object>>> list() {
        List<Map<String, Object>> rows = new ArrayList<>();
        for (OKRCycle cycle : cycleRepository.findAllByOrderByCycleYearDesc()) {
            rows.add(toMap(cycle));
        }
        return ApiResponse.ok(rows, "Danh sách chu kỳ OKR");
    }

    @GetMapping("/current")
    @Operation(summary = "Chu kỳ OKR đang active (năm làm việc mặc định của mọi màn OKR)")
    public ApiResponse<Map<String, Object>> current() {
        return phaseService.cycle(null).map(c -> ApiResponse.ok(toMap(c), "Chu kỳ hiện tại"))
                .orElseGet(() -> ApiResponse.ok(null, "Chưa có chu kỳ OKR"));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Chi tiết chu kỳ OKR")
    public ApiResponse<Map<String, Object>> detail(@PathVariable UUID id) {
        OKRCycle cycle = cycleRepository.findById(id).orElse(null);
        return cycle == null ? ApiResponse.error("Không tìm thấy chu kỳ") : ApiResponse.ok(toMap(cycle), "Chi tiết chu kỳ");
    }

    @PostMapping
    @org.springframework.transaction.annotation.Transactional
    @Operation(summary = "Tạo chu kỳ OKR cho một năm (mỗi năm chỉ 1 chu kỳ)")
    public ResponseEntity<ApiResponse<Map<String, Object>>> save(@RequestBody Map<String, Object> body) {
        if (!CurrentUser.isHr()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ApiResponse.error("Chỉ HR/Admin mới được cấu hình chu kỳ OKR"));
        }
        Integer year = intValue(body.get("year"));
        if (year == null) return ResponseEntity.badRequest().body(ApiResponse.error("Năm chu kỳ là bắt buộc"));

        // Mỗi năm chỉ có đúng 1 chu kỳ OKR — tạo trùng năm phải sửa trên chu kỳ đã có (PUT).
        OKRCycle existing = cycleRepository.findAllByOrderByCycleYearDesc().stream()
                .filter(c -> year.equals(c.getCycleYear())).findFirst().orElse(null);
        if (existing != null) {
            return ResponseEntity.badRequest().body(ApiResponse.error(
                    "Năm " + year + " đã có chu kỳ \"" + existing.getName()
                            + "\" — mỗi năm chỉ có 1 chu kỳ OKR. Mở chu kỳ đó để cập nhật"));
        }
        OKRCycle cycle = new OKRCycle();

        entityManager.clear(); // detach để tránh Hibernate flush varchar vào cột jsonb
        String error = apply(cycle, body, year);
        if (error != null) return ResponseEntity.badRequest().body(ApiResponse.error(error));

        if (cycle.getId() == null) cycle.setId(UUID.randomUUID());
        if ("active".equalsIgnoreCase(cycle.getStatus())) {
            assertNoOtherActiveCycle(cycle.getId());
        }
        persistCycle(cycle, true);
        OKRCycle saved = cycleRepository.findById(cycle.getId()).orElse(cycle);
        management.audit(null, saved.getId(), null, "SAVE_CYCLE", "cycle", null,
                saved.getName() + " / " + saved.getStatus(), "HR cấu hình chu kỳ OKR");
        provisioning.provision(saved); // đầu kỳ: tự tạo hồ sơ OKR cho nhân viên
        return ResponseEntity.ok(ApiResponse.ok(toMap(saved), "Đã lưu chu kỳ OKR"));
    }

    @PutMapping("/{id}")
    @org.springframework.transaction.annotation.Transactional
    @Operation(summary = "Cập nhật chu kỳ OKR")
    public ResponseEntity<ApiResponse<Map<String, Object>>> update(@PathVariable UUID id, @RequestBody Map<String, Object> body) {
        if (!CurrentUser.isHr()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ApiResponse.error("Chỉ HR/Admin mới được cấu hình chu kỳ OKR"));
        }
        OKRCycle cycle = cycleRepository.findById(id).orElse(null);
        if (cycle == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ApiResponse.error("Không tìm thấy chu kỳ"));
        Integer year = intValue(body.get("year"));
        if (year == null) year = cycle.getCycleYear();
        // Đổi năm sang năm đã có chu kỳ khác sẽ phá quy tắc "mỗi năm 1 chu kỳ".
        final Integer targetYear = year;
        OKRCycle sameYear = cycleRepository.findAllByOrderByCycleYearDesc().stream()
                .filter(c -> !c.getId().equals(cycle.getId()) && targetYear.equals(c.getCycleYear()))
                .findFirst().orElse(null);
        if (sameYear != null) {
            return ResponseEntity.badRequest().body(ApiResponse.error(
                    "Năm " + targetYear + " đã có chu kỳ \"" + sameYear.getName() + "\" — mỗi năm chỉ có 1 chu kỳ OKR"));
        }
        entityManager.clear();
        String error = apply(cycle, body, year);
        if (error != null) return ResponseEntity.badRequest().body(ApiResponse.error(error));
        persistCycle(cycle, false);
        OKRCycle saved = cycleRepository.findById(cycle.getId()).orElse(cycle);
        management.audit(null, saved.getId(), null, "UPDATE_CYCLE", "cycle", null,
                saved.getName() + " / " + saved.getStatus(), "HR cập nhật chu kỳ OKR");
        provisioning.provision(saved); // đầu kỳ: tự tạo hồ sơ OKR cho nhân viên
        return ResponseEntity.ok(ApiResponse.ok(toMap(saved), "Đã cập nhật chu kỳ OKR"));
    }

    @PostMapping("/{id}/lock")
    @org.springframework.transaction.annotation.Transactional
    @Operation(summary = "HR chốt & khoá chu kỳ")
    public ResponseEntity<ApiResponse<Boolean>> lock(@PathVariable UUID id, @RequestBody(required = false) Map<String, Object> body) {
        if (!CurrentUser.isHr()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ApiResponse.error("Chỉ HR/Admin mới được khoá chu kỳ"));
        }
        OKRCycle cycle = cycleRepository.findById(id).orElse(null);
        if (cycle == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ApiResponse.error("Không tìm thấy chu kỳ"));
        if ("closed".equalsIgnoreCase(cycle.getStatus())) throw OKRRuleException.conflict("Chu kỳ đã khoá rồi");
        Map<String, Object> payload = body == null ? Map.of() : body;
        boolean force = Boolean.TRUE.equals(payload.get("force"));
        String reason = str(payload.get("reason")).trim();

        // Chốt khi: (1) mọi hồ sơ đã được Quản lý chấm, (2) không còn nhân sự active chưa có OKR,
        // (3) Giám đốc đã đánh giá chung (Bước 4). Muốn chốt sớm phải force + lý do.
        long pendingReviews = management.pendingManagerAssessmentCount(cycle.getCycleYear());
        long pendingNoOkr = management.pendingNoOkrCount(cycle.getCycleYear());
        boolean directorDone = cycle.getDirectorReviewedAt() != null;
        List<String> blockers = new ArrayList<>();
        if (pendingReviews > 0) blockers.add(pendingReviews + " hồ sơ chưa được Quản lý chấm xong");
        if (pendingNoOkr > 0) blockers.add(pendingNoOkr + " nhân sự active chưa có OKR");
        if (!directorDone) blockers.add("chưa có đánh giá chung của Giám đốc");

        if (!blockers.isEmpty() && !force) {
            throw OKRRuleException.conflict("Chưa thể chốt chu kỳ: " + String.join("; ", blockers)
                    + ". Xác nhận chốt sớm (force) kèm lý do nếu vẫn muốn khoá");
        }
        if (!blockers.isEmpty() && reason.isEmpty()) throw OKRRuleException.badRequest("Lý do chốt sớm là bắt buộc");

        entityManager.clear();
        // Chỉ đổi trạng thái chu kỳ — mọi phase tự "locked" theo chu kỳ, timeline giữ nguyên để mở lại được.
        cycle.setStatus("closed");
        persistCycle(cycle, false);
        String auditReason = reason.isEmpty()
                ? "HR chốt & khoá chu kỳ"
                : reason + " (bỏ qua: " + String.join("; ", blockers) + ")";
        management.audit(null, cycle.getId(), null, "LOCK_CYCLE", "status", "active", "closed", auditReason);
        return ResponseEntity.ok(ApiResponse.ok(true, "Đã khoá chu kỳ OKR"));
    }

    @PostMapping("/{id}/activate")
    @org.springframework.transaction.annotation.Transactional
    @Operation(summary = "Kích hoạt chu kỳ nháp (draft → active)")
    public ResponseEntity<ApiResponse<Boolean>> activate(@PathVariable UUID id) {
        if (!CurrentUser.isHr()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ApiResponse.error("Chỉ HR/Admin mới được kích hoạt chu kỳ"));
        }
        OKRCycle cycle = cycleRepository.findById(id).orElse(null);
        if (cycle == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ApiResponse.error("Không tìm thấy chu kỳ"));
        if ("active".equalsIgnoreCase(cycle.getStatus())) {
            throw OKRRuleException.conflict("Chu kỳ đang hoạt động rồi");
        }
        if ("closed".equalsIgnoreCase(cycle.getStatus())) {
            throw OKRRuleException.conflict("Chu kỳ đã chốt & khoá — dùng Mở lại kèm lý do nếu muốn tiếp tục");
        }
        assertNoOtherActiveCycle(cycle.getId());
        entityManager.clear();
        cycleRepository.updateStatusNative(cycle.getId(), "active");
        management.audit(null, cycle.getId(), null, "ACTIVATE_CYCLE", "status", "draft", "active",
                "HR kích hoạt chu kỳ OKR " + cycle.getCycleYear());
        cycleRepository.findById(cycle.getId()).ifPresent(provisioning::provision);
        return ResponseEntity.ok(ApiResponse.ok(true, "Đã kích hoạt chu kỳ OKR"));
    }

    @PostMapping("/{id}/deactivate")
    @org.springframework.transaction.annotation.Transactional
    @Operation(summary = "Tạm ẩn chu kỳ (active → draft), giữ nguyên dữ liệu")
    public ResponseEntity<ApiResponse<Boolean>> deactivate(@PathVariable UUID id) {
        if (!CurrentUser.isHr()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ApiResponse.error("Chỉ HR/Admin mới được tạm ẩn chu kỳ"));
        }
        OKRCycle cycle = cycleRepository.findById(id).orElse(null);
        if (cycle == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ApiResponse.error("Không tìm thấy chu kỳ"));
        if (!"active".equalsIgnoreCase(cycle.getStatus())) {
            throw OKRRuleException.conflict("Chỉ tạm ẩn được chu kỳ đang hoạt động");
        }
        // Tạm ẩn để trống trạng thái active là hợp lệ: Kích hoạt lại hoặc Chốt & khoá bất cứ lúc nào.
        entityManager.clear();
        cycleRepository.updateStatusNative(cycle.getId(), "draft");
        management.audit(null, cycle.getId(), null, "DEACTIVATE_CYCLE", "status", "active", "draft",
                "HR tạm ẩn chu kỳ OKR " + cycle.getCycleYear());
        return ResponseEntity.ok(ApiResponse.ok(true, "Đã tạm ẩn chu kỳ OKR"));
    }

    @DeleteMapping("/{id}")
    @org.springframework.transaction.annotation.Transactional
    @Operation(summary = "Xoá chu kỳ OKR — giải phóng năm để tạo lại")
    public ResponseEntity<ApiResponse<Boolean>> delete(@PathVariable UUID id) {
        if (!CurrentUser.isHr()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ApiResponse.error("Chỉ HR/Admin mới được xoá chu kỳ"));
        }
        OKRCycle cycle = cycleRepository.findById(id).orElse(null);
        if (cycle == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ApiResponse.error("Không tìm thấy chu kỳ"));
        Integer year = cycle.getCycleYear();
        String name = cycle.getName();
        long reviews = reviewRepository.countByCycleYear(year);
        entityManager.clear();
        // Xoá mọi hồ sơ OKR của năm trước (items/checkin/midyear/audit con tự cascade),
        // để tạo lại chu kỳ cùng năm không bị lẫn dữ liệu cũ.
        cycleRepository.deleteReviewsByYear(year);
        cycleRepository.deleteCycleNative(id);
        management.audit(null, null, null, "DELETE_CYCLE", "cycle", name + " / " + year,
                "đã xoá", "HR xoá chu kỳ OKR (kèm " + reviews + " hồ sơ) để giải phóng năm " + year);
        return ResponseEntity.ok(ApiResponse.ok(true,
                "Đã xoá chu kỳ OKR " + year + (reviews > 0 ? " cùng " + reviews + " hồ sơ OKR" : "")
                        + " — năm " + year + " giờ có thể tạo chu kỳ mới"));
    }

    @PostMapping("/{id}/director-review")
    @org.springframework.transaction.annotation.Transactional
    @Operation(summary = "Bước 4 — Giám đốc đánh giá chung trước khi HR chốt chu kỳ")
    public ResponseEntity<ApiResponse<Boolean>> directorReview(@PathVariable UUID id,
                                                               @RequestBody(required = false) Map<String, Object> body) {
        if (!"ADMIN".equalsIgnoreCase(CurrentUser.role())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(ApiResponse.error("Chỉ Giám đốc (ADMIN) mới được đánh giá chung chu kỳ OKR"));
        }
        OKRCycle cycle = cycleRepository.findById(id).orElse(null);
        if (cycle == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ApiResponse.error("Không tìm thấy chu kỳ"));
        if ("closed".equalsIgnoreCase(cycle.getStatus())) {
            throw OKRRuleException.conflict("Chu kỳ đã chốt & khoá — không thể đánh giá lại");
        }
        long pending = management.pendingManagerAssessmentCount(cycle.getCycleYear());
        if (pending > 0) {
            throw OKRRuleException.conflict("Còn " + pending + " hồ sơ chưa được Quản lý chấm xong — chưa thể đánh giá chung");
        }
        Map<String, Object> payload = body == null ? Map.of() : body;
        String comment = str(payload.get("comment")).trim();
        if (comment.isEmpty()) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Nhận xét đánh giá chung của Giám đốc là bắt buộc"));
        }
        User actor = CurrentUser.get().flatMap(p -> userRepository.findById(p.userId())).orElse(null);
        if (actor == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ApiResponse.error("Chưa đăng nhập"));
        cycleRepository.markDirectorReviewed(cycle.getId(), actor.getId(), comment);
        management.audit(null, cycle.getId(), null, "DIRECTOR_REVIEW", "directorReview", null,
                comment, "Giám đốc đánh giá chung chu kỳ OKR");
        return ResponseEntity.ok(ApiResponse.ok(true, "Đã ghi nhận đánh giá chung của Giám đốc"));
    }

    @PostMapping("/{id}/send-reminders")
    @Operation(summary = "HR gửi ngay nhắc hạn chót các phase đang mở (job tự chạy 8:05 hằng ngày)")
    public ResponseEntity<ApiResponse<Map<String, Object>>> sendReminders(@PathVariable UUID id) {
        if (!CurrentUser.isHr()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ApiResponse.error("Chỉ HR/Admin mới được gửi nhắc"));
        }
        OKRCycle cycle = cycleRepository.findById(id).orElseThrow(() -> OKRRuleException.notFound("Không tìm thấy chu kỳ"));
        phaseService.requireCycleOpen(cycle);
        int sent = deadlineReminderJob.remind(cycle);
        return ResponseEntity.ok(ApiResponse.ok(Map.of("sent", sent),
                sent == 0 ? "Không có ai cần nhắc (chưa tới ngưỡng 3 ngày trước hạn hoặc đã nhắc hôm nay)"
                        : "Đã gửi " + sent + " nhắc hạn chót"));
    }

    @PostMapping("/{id}/reopen")
    @org.springframework.transaction.annotation.Transactional
    @Operation(summary = "HR mở lại chu kỳ/phase kèm lý do")
    public ResponseEntity<ApiResponse<Boolean>> reopen(@PathVariable UUID id, @RequestBody(required = false) Map<String, Object> body) {
        if (!CurrentUser.isHr()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ApiResponse.error("Chỉ HR/Admin mới được mở lại chu kỳ"));
        }
        OKRCycle cycle = cycleRepository.findById(id).orElse(null);
        if (cycle == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ApiResponse.error("Không tìm thấy chu kỳ"));
        entityManager.clear();
        Map<String, Object> payload = body == null ? Map.of() : body;
        String reason = str(payload.get("reason")).trim();
        if (reason.isEmpty()) return ResponseEntity.badRequest().body(ApiResponse.error("Lý do mở lại là bắt buộc"));
        String phaseKey = str(payload.get("phaseKey")).trim().toLowerCase();
        boolean cycleClosed = "closed".equalsIgnoreCase(cycle.getStatus());
        if (phaseKey.isEmpty()) {
            if (!cycleClosed) throw OKRRuleException.badRequest("Chọn phase cần mở lại");
            // Mở lại = đưa chu kỳ cũ về active, nên phải đảm bảo không còn chu kỳ nào đang active.
            assertNoOtherActiveCycle(cycle.getId());
            cycle.setStatus("active");
            persistCycle(cycle, false);
            cycleRepository.clearDirectorReview(cycle.getId());
            management.audit(null, cycle.getId(), null, "REOPEN_CYCLE", "status", "closed", "active", reason);
            cycleRepository.findById(cycle.getId()).ifPresent(provisioning::provision);
            return ResponseEntity.ok(ApiResponse.ok(true, "Đã mở lại chu kỳ OKR"));
        }
        if (!OKRPhaseService.REQUIRED_KEYS.contains(phaseKey)) {
            throw OKRRuleException.badRequest("Phase không hợp lệ: " + phaseKey);
        }
        LocalDate newDue = OKRPhaseService.parseDate(payload.get("dueDate"));
        LocalDate currentDue = phaseService.dueDate(cycle, phaseKey);
        if (newDue != null && newDue.isBefore(LocalDate.now())) {
            throw OKRRuleException.badRequest("Hạn chót mới phải từ hôm nay trở đi");
        }
        if (newDue == null && (currentDue == null || currentDue.isBefore(LocalDate.now()))) {
            throw OKRRuleException.badRequest("Phase đã quá hạn — cần nhập hạn chót mới khi mở lại");
        }
        // Mở lại phase trên chu kỳ đã chốt cũng làm chu kỳ active lại → vẫn phải giữ quy tắc 1 chu kỳ active.
        if (cycleClosed) assertNoOtherActiveCycle(cycle.getId());
        cycle.setStatus("active");
        cycle.setPhases(reopenPhase(cycle.getPhases(), phaseKey, payload.get("dueDate")));
        persistCycle(cycle, false);
        // Mở lại phase làm thay đổi dữ liệu sau thời điểm Giám đốc duyệt → cần duyệt lại.
        cycleRepository.clearDirectorReview(cycle.getId());
        management.audit(null, cycle.getId(), null, "REOPEN_CYCLE", "phase", phaseKey, "active", reason);
        cycleRepository.findById(cycle.getId()).ifPresent(provisioning::provision);
            return ResponseEntity.ok(ApiResponse.ok(true, "Đã mở lại chu kỳ OKR"));
    }

    private String apply(OKRCycle cycle, Map<String, Object> body, int year) {
        String name = str(body.get("name")).trim();
        if (name.isEmpty()) name = "Chu kỳ OKR " + year;
        Integer min = intValue(body.get("scaleMin"));
        Integer max = intValue(body.get("scaleMax"));
        if (min == null) min = 1;
        if (max == null) max = 5;
        if (min < 1 || max > 5 || min >= max) return "Thang điểm phải trong 1–5 và min < max";

        String phasesJson;
        Object phases = body.get("phases");
        if (phases instanceof List<?> list && !list.isEmpty()) {
            List<Map<String, Object>> normalized = new ArrayList<>();
            for (Object item : list) {
                if (!(item instanceof Map<?, ?> p)) continue;
                String key = str(p.get("key")).trim();
                if (key.isEmpty()) continue;
                Map<String, Object> phase = new LinkedHashMap<>();
                phase.put("key", key);
                phase.put("name", str(p.get("name")));
                phase.put("start_date", normalizeDate(p.get("startDate") != null ? p.get("startDate") : p.get("start_date")));
                phase.put("due_date", normalizeDate(p.get("dueDate") != null ? p.get("dueDate") : p.get("due_date")));
                // Cửa sổ Quản lý duyệt/nhận xét/chấm điểm (sau cửa sổ nhân viên).
                phase.put("review_start", normalizeDate(p.get("reviewStart") != null ? p.get("reviewStart") : p.get("review_start")));
                phase.put("review_due", normalizeDate(p.get("reviewDue") != null ? p.get("reviewDue") : p.get("review_due")));
                // Trạng thái phase tính theo ngày; chỉ lưu "locked" khi phase bị khoá cứng.
                String stored = str(p.get("status")).toLowerCase();
                phase.put("status", "locked".equals(stored) || "closed".equals(stored) ? "locked" : "scheduled");
                normalized.add(phase);
            }
            Set<String> keys = new HashSet<>();
            Map<String, LocalDate> startByKey = new HashMap<>();
            Map<String, LocalDate> endByKey = new HashMap<>();
            for (Map<String, Object> ph : normalized) {
                String key = String.valueOf(ph.get("key")).toLowerCase();
                if (!OKRPhaseService.REQUIRED_KEYS.contains(key)) return "Phase không hợp lệ: " + key + " (chỉ nhận " + OKRPhaseService.REQUIRED_KEYS + ")";
                if (!keys.add(key)) return "Phase bị trùng: " + key;
                ph.put("key", key);
                LocalDate start = OKRPhaseService.parseDate(ph.get("start_date"));
                LocalDate due = OKRPhaseService.parseDate(ph.get("due_date"));
                if (start == null || due == null) return "Phase " + key + " phải có ngày bắt đầu và hạn chót";
                if (start.isAfter(due)) return "Phase " + key + ": ngày bắt đầu phải trước hạn chót";
                if (start.getYear() < year - 1 || due.getYear() > year + 1) return "Phase " + key + " nằm ngoài năm chu kỳ " + year;
                LocalDate reviewStart = OKRPhaseService.parseDate(ph.get("review_start"));
                LocalDate reviewDue = OKRPhaseService.parseDate(ph.get("review_due"));
                if ((reviewStart == null) != (reviewDue == null)) {
                    return "Phase " + key + ": cửa sổ Quản lý phải có đủ ngày bắt đầu và hạn chót";
                }
                if (reviewStart != null) {
                    // Mỗi thời điểm chỉ 1 giai đoạn mở → cửa sổ QL phải bắt đầu SAU khi cửa sổ NV đóng.
                    if (!reviewStart.isAfter(due)) {
                        return "Phase " + key + ": cửa sổ Quản lý phải bắt đầu sau hạn chót nhân viên (" + due
                                + ") — mỗi thời điểm chỉ được mở 1 giai đoạn OKR";
                    }
                    if (reviewStart.isAfter(reviewDue)) return "Phase " + key + ": cửa sổ Quản lý phải có ngày bắt đầu trước hạn chót";
                    if (reviewStart.getYear() < year - 1 || reviewDue.getYear() > year + 1) {
                        return "Phase " + key + ": cửa sổ Quản lý nằm ngoài năm chu kỳ " + year;
                    }
                }
                startByKey.put(key, start);
                endByKey.put(key, reviewDue != null ? reviewDue : due);
                // Không lưu "months" — API tự sinh label từ start_date/due_date khi đọc.
            }
            if (!keys.containsAll(OKRPhaseService.REQUIRED_KEYS)) {
                List<String> missing = new ArrayList<>(OKRPhaseService.REQUIRED_KEYS);
                missing.removeAll(keys);
                return "Thiếu phase: " + missing;
            }
            // Các phase phải nối tiếp nhau, không chồng lấn: setup → midyear → final.
            // Một thời điểm chỉ được mở 1 phase (NV hoặc QL) nên phase trước phải kết thúc trước khi phase sau bắt đầu.
            for (int i = 1; i < OKRPhaseService.REQUIRED_KEYS.size(); i++) {
                String prev = OKRPhaseService.REQUIRED_KEYS.get(i - 1);
                String cur = OKRPhaseService.REQUIRED_KEYS.get(i);
                LocalDate prevEnd = endByKey.get(prev);
                LocalDate curStart = startByKey.get(cur);
                if (prevEnd != null && curStart != null && !prevEnd.isBefore(curStart)) {
                    return "Cửa sổ " + prev + " kết thúc " + prevEnd + " phải trước khi " + cur
                            + " bắt đầu " + curStart + " — mỗi thời điểm chỉ được mở 1 giai đoạn OKR";
                }
            }
            try {
                phasesJson = objectMapper.writeValueAsString(normalized);
            } catch (Exception e) {
                return "Không đọc được cấu hình phase";
            }
        } else {
            phasesJson = cycle.getPhases();
            if (phasesJson == null || phasesJson.isBlank()) return "Cần cấu hình các phase";
        }

        if (body.containsKey("companyObjectives")) {
            if (!(body.get("companyObjectives") instanceof List<?> objs)) return "Mục tiêu công ty phải là danh sách";
            List<Map<String, Object>> cleaned = new ArrayList<>();
            int i = 1;
            for (Object o : objs) {
                if (!(o instanceof Map<?, ?> m)) continue;
                String title = str(m.get("title")).trim();
                if (title.isEmpty()) continue;
                String category = "PEOPLE".equalsIgnoreCase(str(m.get("category"))) ? "PEOPLE" : "BUSINESS";
                Integer progress = intValue(m.get("progress"));
                if (progress != null && (progress < 0 || progress > 100)) return "Tiến độ mục tiêu công ty phải trong 0–100";
                Map<String, Object> c = new LinkedHashMap<>();
                c.put("id", str(m.get("id")).isEmpty() ? "comp-" + (i) : str(m.get("id")));
                c.put("title", title);
                c.put("category", category);
                c.put("progress", progress == null ? 0 : progress);
                cleaned.add(c);
                i++;
            }
            try {
                cycle.setCompanyObjectives(objectMapper.writeValueAsString(cleaned));
            } catch (Exception e) {
                return "Không đọc được mục tiêu công ty";
            }
        }
        if (body.containsKey("seniorityCutoffDate")) {
            String raw = str(body.get("seniorityCutoffDate")).trim();
            if (raw.isEmpty()) {
                cycle.setSeniorityCutoffDate(null); // mặc định 31/12 năm chu kỳ
            } else {
                LocalDate cutoff = OKRPhaseService.parseDate(raw);
                if (cutoff == null) return "Mốc tính thời gian công tác không hợp lệ (yyyy-mm-dd)";
                if (cutoff.getYear() < year || cutoff.getYear() > year + 1) {
                    return "Mốc tính thời gian công tác phải trong năm " + year + " hoặc " + (year + 1);
                }
                cycle.setSeniorityCutoffDate(cutoff);
            }
        }
        cycle.setName(name);
        cycle.setCycleYear(year);
        cycle.setPhases(phasesJson);
        cycle.setScaleMin(min);
        cycle.setScaleMax(max);
        cycle.setScoreCategories(2);
        cycle.setAlignmentEnabled(Boolean.TRUE.equals(body.get("alignmentEnabled")));
        // Giữ nguyên trạng thái hiện tại nếu client không gửi — sửa cấu hình không được tự kích hoạt chu kỳ nháp.
        String requested = str(body.get("status")).toLowerCase();
        String status = requested.isEmpty()
                ? (cycle.getStatus() == null ? "draft" : cycle.getStatus().toLowerCase())
                : requested;
        if (!"active".equals(status) && !"draft".equals(status) && !"closed".equals(status)) {
            return "Trạng thái chu kỳ chỉ nhận active/draft/closed";
        }
        if ("closed".equals(status) && !"closed".equalsIgnoreCase(cycle.getStatus())) {
            return "Khoá chu kỳ phải dùng nút Chốt & khoá";
        }
        if (cycle.getId() != null && !status.equalsIgnoreCase(cycle.getStatus())) {
            return "Đổi trạng thái chu kỳ phải dùng nút Kích hoạt / Tạm ẩn / Chốt & khoá";
        }
        String interval = str(body.get("checkinInterval")).isEmpty() ? "MONTHLY" : str(body.get("checkinInterval")).toUpperCase();
        if (!"MONTHLY".equals(interval) && !"QUARTERLY".equals(interval)) return "Tần suất check-in chỉ nhận MONTHLY/QUARTERLY";
        cycle.setCheckinInterval(interval);
        cycle.setStatus(status);
        return null;
    }

    /** Quy tắc hệ thống: tối đa 1 chu kỳ OKR ở trạng thái active tại một thời điểm (không giới hạn theo năm). */
    private void assertNoOtherActiveCycle(UUID excludeId) {
        OKRCycle active = cycleRepository.findFirstByStatusOrderByCreatedAtDesc("active").orElse(null);
        if (active != null && !active.getId().equals(excludeId)) {
            throw OKRRuleException.conflict("Đang có chu kỳ hoạt động: \"" + active.getName()
                    + "\" (năm " + active.getCycleYear()
                    + ") — chỉ 1 chu kỳ OKR được kích hoạt tại một thời điểm. Tạm ẩn chu kỳ đó trước");
        }
    }

    private void persistCycle(OKRCycle cycle, boolean isNew) {
        Boolean alignment = Boolean.TRUE.equals(cycle.getAlignmentEnabled());
        String companyObjectives = cycle.getCompanyObjectives() == null || cycle.getCompanyObjectives().isBlank()
                ? "[]" : cycle.getCompanyObjectives();
        if (isNew) {
            cycleRepository.insertCycleNative(cycle.getId(), cycle.getName(), cycle.getCycleYear(),
                    cycle.getPhases(), cycle.getCheckinInterval(), cycle.getScaleMin(), cycle.getScaleMax(),
                    alignment, cycle.getStatus(), companyObjectives,
                    cycle.getSeniorityCutoffDate() == null ? null : cycle.getSeniorityCutoffDate().toString());
        } else {
            cycleRepository.updateCycleNative(cycle.getId(), cycle.getName(), cycle.getCycleYear(),
                    cycle.getPhases(), cycle.getCheckinInterval(), cycle.getScaleMin(), cycle.getScaleMax(),
                    alignment, cycle.getStatus(), companyObjectives,
                    cycle.getSeniorityCutoffDate() == null ? null : cycle.getSeniorityCutoffDate().toString());
        }
    }

    private Map<String, Object> toMap(OKRCycle cycle) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", cycle.getId().toString());
        map.put("name", cycle.getName());
        map.put("year", cycle.getCycleYear());
        map.put("scaleMin", cycle.getScaleMin());
        map.put("scaleMax", cycle.getScaleMax());
        map.put("checkinInterval", cycle.getCheckinInterval());
        map.put("alignmentEnabled", Boolean.TRUE.equals(cycle.getAlignmentEnabled()));
        map.put("status", cycle.getStatus());
        map.put("phases", phaseService.phases(cycle));
        map.put("companyObjectives", phaseService.companyObjectives(cycle));
        map.put("seniorityCutoffDate", cycle.getSeniorityCutoffDate());
        map.put("effectiveSeniorityCutoff", phaseService.seniorityCutoff(cycle, cycle.getCycleYear()).toString());
        map.put("directorReviewedAt", cycle.getDirectorReviewedAt());
        map.put("directorReviewedBy", cycle.getDirectorReviewedBy());
        map.put("directorReviewComment", cycle.getDirectorReviewComment());
        map.put("directorReviewPending", cycle.getDirectorReviewedAt() == null);
        map.put("canDirectorReview", "ADMIN".equalsIgnoreCase(CurrentUser.role()));
        return map;
    }

    private String reopenPhase(String phasesJson, String phaseKey, Object dueDate) {
        try {
            List<Map<String, Object>> phases = objectMapper.readValue(phasesJson, List.class);
            for (Map<String, Object> phase : phases) {
                if (phaseKey.equalsIgnoreCase(String.valueOf(phase.get("key")))) {
                    phase.put("status", "scheduled");
                    String normalized = normalizeDate(dueDate);
                    if (!normalized.isEmpty()) phase.put("due_date", normalized);
                    LocalDate start = OKRPhaseService.parseDate(phase.get("start_date"));
                    if (start != null && start.isAfter(LocalDate.now())) phase.put("start_date", LocalDate.now().toString());
                }
            }
            return objectMapper.writeValueAsString(phases);
        } catch (Exception e) {
            return phasesJson;
        }
    }

    private String normalizeDate(Object value) {
        if (value == null) return "";
        String s = value.toString();
        if (s.length() >= 10) return s.substring(0, 10);
        return s;
    }

    private String str(Object value) {
        return value == null ? "" : value.toString();
    }

    private Integer intValue(Object value) {
        if (value == null || value.toString().isBlank()) return null;
        try {
            return Integer.valueOf(value.toString());
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
