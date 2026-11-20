package com.act.pulse.modules.attendance.service.impl;

import com.act.pulse.modules.attendance.dto.request.CheckInRequest;
import com.act.pulse.modules.attendance.dto.response.CheckInResponse;
import com.act.pulse.modules.attendance.dto.response.CheckInResponse.LayerResult;
import com.act.pulse.modules.attendance.entity.AttendanceLog;
import com.act.pulse.modules.attendance.entity.DeviceRegistration;
import com.act.pulse.modules.attendance.repository.AttendanceLogRepository;
import com.act.pulse.modules.attendance.repository.DeviceRegistrationRepository;
import com.act.pulse.modules.attendance.repository.ShiftRepository;
import com.act.pulse.modules.attendance.repository.RequestRepository;
import com.act.pulse.modules.attendance.service.AttendanceService;
import com.act.pulse.modules.attendance.service.RuleService;
import com.act.pulse.modules.auth.entity.User;
import com.act.pulse.modules.auth.repository.FaceProfileRepository;
import com.act.pulse.modules.auth.repository.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Chấm công — **5 lớp xác thực chạy song song**, không đạt lớp nào là CHẶN.
 *
 * <p>Nguồn sự thật: {@code docs/02-business-attendance-time-tracking.md} §2.1.1,
 * {@code docs/06-business-rule-builder.md} (rule {@code attendance_security}).</p>
 *
 * <p>Điểm quan trọng: **KHÔNG có nhánh fallback**. Trước đây khi thiếu/không khớp khuôn mặt,
 * code vẫn ghi log {@code VALID} — nghĩa là gian lận đi thẳng vào bảng công.</p>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AttendanceServiceImpl implements AttendanceService {

    private final AttendanceLogRepository attendanceLogRepository;
    private final DeviceRegistrationRepository deviceRegistrationRepository;
    private final RuleService ruleService;
    private final FaceProfileRepository faceProfileRepository;
    private final UserRepository userRepository;
    private final ShiftRepository shiftRepository;
    private final RequestRepository requestRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final RestTemplate restTemplate = new RestTemplate();

    @Value("${app.services.ai-face-service-url:http://localhost:8000}")
    private String aiFaceServiceUrl;

    /** Danh sách IP mạng nội bộ công ty (rule `attendance_security.require_internal_network`). */
    private static final List<String> OFFICE_NETWORK_PREFIXES = List.of("10.0.", "192.168.", "172.16.");

    /** Văn phòng Hà Nội — tọa độ dùng cho kiểm tra bán kính. */
    private static final double OFFICE_LAT = 21.0285;
    private static final double OFFICE_LNG = 105.8542;

    @Override
    @Transactional
    public CheckInResponse checkIn(UUID userId, CheckInRequest request) {
        return processAttendancePunch(userId, request, "CHECK_IN");
    }

    @Override
    @Transactional
    public CheckInResponse checkOut(UUID userId, CheckInRequest request) {
        return processAttendancePunch(userId, request, "CHECK_OUT");
    }

    private CheckInResponse processAttendancePunch(UUID authenticatedUserId, CheckInRequest request, String punchType) {
        List<LayerResult> layers = new ArrayList<>();

        // Nhân viên lấy từ token đang đăng nhập — KHÔNG tin employeeCode do client gửi lên (docs/01 §2)
        if (authenticatedUserId == null) {
            return reject("UNAUTHENTICATED", "Vui lòng đăng nhập để thực hiện chấm công", layers, FaceOutcome.skipped());
        }
        User requester = userRepository.findById(authenticatedUserId).orElse(null);
        if (requester == null) {
            return reject("USER_NOT_FOUND", "Không tìm thấy hồ sơ người dùng hợp lệ", layers, FaceOutcome.skipped());
        }
        final UUID userId = requester.getId();
        final String requesterCode = requester.getEmployeeCode();

        // ── Kiểm tra quá hạn offline (mặc định 24h, Criterion B1 #11) ───────
        if (Boolean.TRUE.equals(request.getIsOffline()) || request.getOfflinePunchedAt() != null) {
            int maxOfflineHours = ruleService.getInt("attendance_security", "offline_max_hours", 24);
            LocalDateTime punchTime = request.getOfflinePunchedAt() != null ? request.getOfflinePunchedAt() : LocalDateTime.now();
            if (punchTime.isBefore(LocalDateTime.now().minusHours(maxOfflineHours))) {
                return reject("OFFLINE_EXPIRED",
                        String.format("Bản ghi chấm công offline đã quá hạn %d giờ. Vui lòng tạo đơn bổ sung công.", maxOfflineHours),
                        layers, FaceOutcome.skipped());
            }
        }

        // ── Lớp 1 · THIẾT BỊ: phải là thiết bị đã được HR duyệt ─────────────
        // Máy đầu tiên của mỗi người được tự đăng ký (docs/01 §2); máy thứ 2/3 phải chờ HR duyệt.
        String deviceFingerprint = request.getDeviceFingerprint();
        int maxDevices = ruleService.getInt("attendance_security", "max_devices", 2);
        boolean deviceApproved = false;
        String deviceDetail = "Thiết bị này chưa được HR duyệt — không chấm công được";
        if (deviceFingerprint != null && !deviceFingerprint.isBlank()) {
            Optional<DeviceRegistration> existingOpt = deviceRegistrationRepository
                    .findByDeviceFingerprint(deviceFingerprint);
            if (existingOpt.isPresent()) {
                DeviceRegistration existing = existingOpt.get();
                if (existing.getUserId().equals(userId)) {
                    if (Boolean.TRUE.equals(existing.getIsApproved())) {
                        deviceApproved = true;
                        deviceDetail = null;
                        existing.setLastActiveAt(LocalDateTime.now());
                        deviceRegistrationRepository.save(existing);
                    } else {
                        deviceDetail = "Thiết bị mới đã được gửi yêu cầu — cần HR duyệt trước khi chấm công";
                    }
                } else {
                    deviceDetail = "Thiết bị này đã được đăng ký cho nhân viên khác — cần HR duyệt chuyển đổi";
                }
            } else {
                long approvedCount = deviceRegistrationRepository.countByUserIdAndIsApprovedTrue(userId);
                if (approvedCount == 0) {
                    // Thiết bị đầu tiên — tự đăng ký
                    DeviceRegistration first = DeviceRegistration.builder()
                            .userId(userId)
                            .deviceFingerprint(deviceFingerprint)
                            .deviceModel("Web Browser")
                            .osVersion("Web")
                            .isApproved(true)
                            .lastActiveAt(LocalDateTime.now())
                            .build();
                    first.setCreatedAt(LocalDateTime.now());
                    first.setUpdatedAt(LocalDateTime.now());
                    deviceRegistrationRepository.save(first);
                    deviceApproved = true;
                    deviceDetail = null;
                } else if (approvedCount < maxDevices) {
                    // Còn hạn mức nhưng máy mới → tạo yêu cầu chờ HR duyệt, KHÔNG cho chấm ngay
                    DeviceRegistration pending = DeviceRegistration.builder()
                            .userId(userId)
                            .deviceFingerprint(deviceFingerprint)
                            .deviceModel("Web Browser")
                            .osVersion("Web")
                            .isApproved(false)
                            .lastActiveAt(LocalDateTime.now())
                            .build();
                    pending.setCreatedAt(LocalDateTime.now());
                    pending.setUpdatedAt(LocalDateTime.now());
                    deviceRegistrationRepository.save(pending);
                    deviceDetail = "Thiết bị mới đã được gửi yêu cầu — cần HR duyệt trước khi chấm công";
                } else {
                    deviceDetail = String.format("Bạn đã dùng đủ %d thiết bị — máy thứ %d phải được HR duyệt",
                            maxDevices, maxDevices + 1);
                }
            }
        }
        layers.add(layer("DEVICE", "Thiết bị đã đăng ký", deviceApproved, deviceDetail));

        // ── Lớp 2 · MẠNG NỘI BỘ ───────────────────────────────────────────
        boolean requireNetwork = ruleService.getBoolean("attendance_security", "require_internal_network", true);
        boolean inOfficeNetwork = isOfficeNetwork(request.getWifiBssid());
        boolean wfhToday = requestRepository.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .anyMatch(r -> "WFH".equals(r.getRequestType()) && "APPROVED".equals(r.getStatus())
                        && LocalDate.now().equals(r.getWorkDate()));
        boolean networkPassed = !requireNetwork || inOfficeNetwork || wfhToday;
        layers.add(layer("NETWORK", "Trong mạng nội bộ công ty", networkPassed,
                networkPassed ? null : "Bạn đang ngoài mạng công ty — hãy nối Wi-Fi văn phòng"));

        // ── Lớp 3 · VỊ TRÍ (GPS + độ chính xác) ───────────────────────────
        int geofenceRadius = ruleService.getInt("attendance_security", "geofence_radius_m", 150);
        int gpsTolerance = ruleService.getInt("attendance_security", "gps_accuracy_tolerance_m", 100);
        Double distance = null;
        boolean gpsPassed = true;
        String gpsDetail = null;
        if (request.getAccuracyMeters() != null && request.getAccuracyMeters().doubleValue() > gpsTolerance && !wfhToday) {
            gpsPassed = false;
            gpsDetail = String.format("Độ chính xác GPS (%.0fm) vượt quá sai số cho phép (%dm). Vui lòng di chuyển lại gần cửa sổ hoặc khu vực thông thoáng và thử lại.",
                    request.getAccuracyMeters().doubleValue(), gpsTolerance);
        } else if (request.getLatitude() != null && request.getLongitude() != null) {
            double officeLat = ruleService.getDouble("attendance_security", "office_lat", OFFICE_LAT);
            double officeLng = ruleService.getDouble("attendance_security", "office_lng", OFFICE_LNG);
            distance = haversineMeters(request.getLatitude().doubleValue(), request.getLongitude().doubleValue(),
                    officeLat, officeLng);
            if (distance > geofenceRadius && !wfhToday) {
                gpsPassed = false;
                gpsDetail = String.format("Bạn đang cách văn phòng %,.0fm (vượt quá bán kính cho phép %dm)",
                        distance, geofenceRadius);
            }
        }
        layers.add(layer("GPS", "Trong bán kính văn phòng", gpsPassed, gpsDetail));

        // ── Lớp 4 · CA LÀM VIỆC: áp ca được gán cho user ──────────────────
        boolean shiftPassed = true;
        String shiftDetail = null;
        if (requester.getShiftId() != null) {
            var shiftOpt = shiftRepository.findById(requester.getShiftId());
            if (shiftOpt.isEmpty()) {
                shiftPassed = false;
                shiftDetail = "Ca làm việc được gán không còn tồn tại — liên hệ HR";
            } else {
                var shift = shiftOpt.get();
                java.time.LocalTime nowTime = java.time.LocalTime.now();
                boolean inWindow = !nowTime.isBefore(shift.getCheckInStart()) && !nowTime.isAfter(shift.getCheckOutEnd());
                if (Boolean.TRUE.equals(shift.getIsFlexible())) {
                    inWindow = !nowTime.isBefore(shift.getFlexibleCheckinFrom() != null ? shift.getFlexibleCheckinFrom() : shift.getCheckInStart())
                            && !nowTime.isAfter(shift.getFlexibleCheckoutTo() != null ? shift.getFlexibleCheckoutTo() : shift.getCheckOutEnd());
                }
                if (!inWindow) {
                    shiftPassed = false;
                    shiftDetail = String.format("Ngoài khung giờ ca %s (%s–%s)", shift.getName(), shift.getCheckInStart(), shift.getCheckOutEnd());
                }
            }
        } else {
            boolean hasShift = ruleService.exists("shift") || ruleService.exists("shift_times");
            shiftPassed = hasShift;
            shiftDetail = hasShift ? null : "Hôm nay bạn không có ca làm việc";
        }
        layers.add(layer("SHIFT", "Đúng ca làm việc", shiftPassed, shiftDetail));

        // ── Lớp 5 · KHUÔN MẶT (bắt buộc) ─────────────────────────────────
        boolean requireFace = ruleService.getBoolean("attendance_security", "require_face_verification", true);
        FaceOutcome face = requireFace
                ? verifyFace(userId, requesterCode, request, layers)
                : FaceOutcome.skipped();

        // ── Quyết định: mọi lớp phải đạt ───────────────────────────────��────
        List<LayerResult> failed = layers.stream().filter(l -> !l.isPassed()).toList();
        if (!failed.isEmpty()) {
            LayerResult first = failed.get(0);
            String reason = switch (first.getLayer()) {
                case "DEVICE" -> "DEVICE_NOT_APPROVED";
                case "NETWORK" -> "OUTSIDE_NETWORK";
                case "GPS" -> "OUTSIDE_GEOFENCE";
                case "SHIFT" -> "NO_SHIFT";
                case "FACE" -> face.proxyDetected ? "PROXY_PUNCH_DETECTED" : "FACE_NOT_MATCHED";
                default -> first.getDetail();
            };
            log.warn("Chấm công bị chặn tại lớp {}: {}", first.getLayer(), first.getDetail());
            return CheckInResponse.builder()
                    .status("REJECTED")
                    .rejectReason(reason)
                    .serverTimestamp(LocalDateTime.now())
                    .message(first.getDetail() != null ? first.getDetail() : "Không đạt yêu cầu xác thực — chưa ghi vào bảng công")
                    .layers(layers)
                    .faceAttemptsRemaining(face.attemptsRemaining)
                    .isProxyPunchDetected(face.proxyDetected)
                    .matchedEmployeeCode(face.matchedCode)
                    .matchedFullName(face.matchedName)
                    .similarityScore(face.similarity)
                    .build();
        }

        // ── Ghi bản ghi chấm công: 1 dòng / người / ngày ──────────────────
        LocalDate workDate = LocalDate.now();
        LocalDateTime now = LocalDateTime.now();
        java.time.format.DateTimeFormatter hhmm = java.time.format.DateTimeFormatter.ofPattern("HH:mm");
        Optional<AttendanceLog> existingOpt = attendanceLogRepository.findByUserIdAndWorkDate(userId, workDate);

        AttendanceLog entity;
        LocalDateTime punchAt;
        if ("CHECK_IN".equals(punchType)) {
            if (existingOpt.isPresent() && existingOpt.get().getCheckInAt() != null) {
                return reject("DUPLICATE_CHECKIN",
                        "Hôm nay bạn đã chấm công vào lúc "
                                + existingOpt.get().getCheckInAt().format(hhmm)
                                + " — mỗi ngày chỉ được chấm công vào 1 lần",
                        layers, face);
            }
            entity = existingOpt.orElseGet(() -> AttendanceLog.builder()
                    .userId(userId)
                    .workDate(workDate)
                    .build());
            entity.setCheckInAt(now);
            punchAt = now;
        } else {
            if (existingOpt.isEmpty() || existingOpt.get().getCheckInAt() == null) {
                return reject("NO_CHECKIN",
                        "Chưa chấm công vào — hãy chấm công vào trước, hoặc tạo đơn bổ sung công",
                        layers, face);
            }
            entity = existingOpt.get();
            if (entity.getCheckOutAt() != null) {
                return reject("DUPLICATE_CHECKOUT",
                        "Hôm nay bạn đã chấm công ra lúc " + entity.getCheckOutAt().format(hhmm)
                                + " — mỗi ngày chỉ được chấm công ra 1 lần",
                        layers, face);
            }
            entity.setCheckOutAt(now);
            punchAt = now;
        }

        // ── Kiểm tra quá hạn offline (mặc định 24h) ────────────────────────
        if (Boolean.TRUE.equals(request.getIsOffline())) {
            int maxOfflineHours = ruleService.getInt("attendance_security", "offline_max_hours", 24);
            LocalDateTime punchTime = request.getOfflinePunchedAt() != null ? request.getOfflinePunchedAt() : now;
            if (punchTime.isBefore(now.minusHours(maxOfflineHours))) {
                return reject("OFFLINE_EXPIRED",
                        String.format("Bản ghi chấm công offline đã quá hạn %d giờ. Vui lòng tạo đơn bổ sung công.", maxOfflineHours),
                        layers, face);
            }
        }

        entity.setStatus("VALID");
        entity.setWifiBssid(request.getWifiBssid());
        entity.setLatitude(request.getLatitude());
        entity.setLongitude(request.getLongitude());
        entity.setDistanceMeters(distance == null ? null
                : BigDecimal.valueOf(distance).setScale(2, java.math.RoundingMode.HALF_UP));
        entity.setIsOfflineSync(Boolean.TRUE.equals(request.getIsOffline()));
        entity.setFaceCheckStatus(face.status);
        entity.setFaceMatchScore(face.similarity == null ? null
                : BigDecimal.valueOf(face.similarity * 100).setScale(2, java.math.RoundingMode.HALF_UP));
        entity.setFaceLivenessPassed(face.livenessPassed);
        entity.setFaceCheckedAt(face.checkedAt);
        entity.setFaceAttempts(face.attempts);
        entity.setUpdatedAt(now);
        if (entity.getCreatedAt() == null) {
            entity.setCreatedAt(now);
        }
        attendanceLogRepository.save(entity);

        return CheckInResponse.builder()
                .status("VALID")
                .serverTimestamp(punchAt)
                .message(String.format("Chấm công %s thành công lúc %s (thời gian máy chủ)",
                        "CHECK_IN".equals(punchType) ? "vào" : "ra", punchAt.format(hhmm)))
                .matchedEmployeeCode(face.matchedCode != null ? face.matchedCode : requesterCode)
                .matchedFullName(face.matchedName)
                .similarityScore(face.similarity)
                .layers(layers)
                .faceAttemptsRemaining(face.attemptsRemaining)
                .isProxyPunchDetected(false)
                .build();
    }

    /** Trả về kết quả REJECTED thống nhất — không ghi gì vào bảng công. */
    private CheckInResponse reject(String reason, String message, List<LayerResult> layers, FaceOutcome face) {
        return CheckInResponse.builder()
                .status("REJECTED")
                .rejectReason(reason)
                .serverTimestamp(LocalDateTime.now())
                .message(message)
                .layers(layers)
                .faceAttemptsRemaining(face.attemptsRemaining)
                .isProxyPunchDetected(face.proxyDetected)
                .matchedEmployeeCode(face.matchedCode)
                .matchedFullName(face.matchedName)
                .similarityScore(face.similarity)
                .build();
    }

    // ── Lớp 5: xác thực khuôn mặt ───────────────────────────────────────
    private record FaceOutcome(String status, Double similarity, boolean livenessPassed,
                               String matchedCode, String matchedName, boolean proxyDetected,
                               int attempts, int attemptsRemaining, LocalDateTime checkedAt) {
        static FaceOutcome skipped() {
            return new FaceOutcome("not_required", null, true, null, null, false, 1, 0, null);
        }
    }

    private FaceOutcome verifyFace(UUID userId, String requesterCode, CheckInRequest request,
                                  List<LayerResult> layers) {
        double threshold = ruleService.getInt("attendance_security", "face_match_threshold", 85) / 100.0;
        int maxAttempts = ruleService.getInt("attendance_security", "face_max_attempts", 3);

        // Chưa đăng ký khuôn mặt → chặn, có nút đăng ký (S27 / S01-B)
        boolean enrolled = faceProfileRepository.existsByUserIdAndStatus(userId, "active");
        if (!enrolled) {
            layers.add(layer("FACE", "Khuôn mặt khớp hồ sơ", false,
                    "Bạn chưa đăng ký khuôn mặt — hãy đăng ký trước khi chấm công"));
            return new FaceOutcome("not_required", null, false, null, null, false, 1, maxAttempts, null);
        }

        String image = request.getFaceImageBase64();
        if (image == null || image.isBlank()) {
            layers.add(layer("FACE", "Khuôn mặt khớp hồ sơ", false,
                    "Không nhận được ảnh từ camera — không thể xác thực khuôn mặt"));
            return new FaceOutcome("failed", null, false, null, null, false, 1, maxAttempts - 1, null);
        }

        JsonNode ai = callAiFaceService(image, request.getLivenessFrames(), requesterCode, threshold);
        if (ai == null) {
            layers.add(layer("FACE", "Khuôn mặt khớp hồ sơ", false,
                    "Không kết nối được dịch vụ nhận diện khuôn mặt — chưa thể xác thực"));
            return new FaceOutcome("failed", null, false, null, null, false, 1, maxAttempts - 1, null);
        }

        boolean qualityPassed = ai.path("quality_passed").asBoolean(true);
        boolean livenessPassed = ai.path("is_liveness_verified").asBoolean(false);
        boolean matched = ai.path("is_matched").asBoolean(false);
        double similarity = ai.path("similarity_score").asDouble(0.0);
        JsonNode matchedEmp = ai.path("matched_employee");
        String matchedCode = matchedEmp.path("employee_code").asText(null);
        String matchedName = matchedEmp.path("full_name").asText(null);
        boolean isAiProxyPunch = ai.path("is_proxy_punch_detected").asBoolean(false);

        if (!qualityPassed) {
            layers.add(layer("FACE", "Khuôn mặt khớp hồ sơ", false,
                    "Chất lượng ảnh không đạt — hãy điều chỉnh ánh sáng và đưa mặt vào giữa khung"));
            return new FaceOutcome("failed", similarity, livenessPassed, matchedCode, matchedName,
                    false, 1, maxAttempts - 1, LocalDateTime.now());
        }
        if (!livenessPassed) {
            layers.add(layer("FACE", "Khuôn mặt khớp hồ sơ", false,
                    "Không phát hiện được chuyển động thật (ảnh in / video) — không thể xác thực"));
            return new FaceOutcome("failed", similarity, false, matchedCode, matchedName,
                    false, 1, maxAttempts - 1, LocalDateTime.now());
        }

        // **Đối chiếu độc lập với tài khoản đang đăng nhập** — Chống chấm công hộ (High D)
        boolean proxyMismatch = (matchedCode != null && !matchedCode.equalsIgnoreCase(requesterCode));
        boolean proxyDetected = isAiProxyPunch || proxyMismatch;

        if (proxyDetected) {
            String detail = String.format("CẢNH BÁO CHẤM CÔNG HỘ: Người đứng trước camera là %s (%s), KHÔNG KHỚP với tài khoản đang đăng nhập %s. Chấm công bị từ chối.",
                    matchedName != null ? matchedName : "chưa rõ",
                    matchedCode != null ? matchedCode : "chưa rõ",
                    requesterCode);
            layers.add(layer("FACE", "Khuôn mặt khớp hồ sơ", false, detail));
            log.warn("Proxy punch blocked: camera detected {} but requester is {}", matchedCode, requesterCode);
            return new FaceOutcome("failed", similarity, true, matchedCode, matchedName,
                    true, 1, maxAttempts - 1, LocalDateTime.now());
        }

        if (!matched || matchedCode == null) {
            layers.add(layer("FACE", "Khuôn mặt khớp hồ sơ", false,
                    "Không nhận diện được khuôn mặt trong hệ thống hoặc độ tương đồng không đạt"));
            return new FaceOutcome("failed", similarity, true, matchedCode, matchedName,
                    false, 1, maxAttempts - 1, LocalDateTime.now());
        }

        if (similarity < threshold) {
            layers.add(layer("FACE", "Khuôn mặt khớp hồ sơ", false,
                    String.format("Độ tương đồng %,.0f%% thấp hơn ngưỡng quy định %d%%", similarity * 100, (int) (threshold * 100))));
            return new FaceOutcome("failed", similarity, true, matchedCode, matchedName,
                    false, 1, maxAttempts - 1, LocalDateTime.now());
        }

        layers.add(layer("FACE", "Khuôn mặt khớp hồ sơ", true,
                String.format("Khớp chính chủ %,.0f%%", similarity * 100)));
        return new FaceOutcome("passed", similarity, true, matchedCode, matchedName,
                false, 1, maxAttempts - 1, LocalDateTime.now());
    }

    private JsonNode callAiFaceService(String base64Image, List<String> livenessFrames, String requesterCode, double threshold) {
        String baseUrl = (aiFaceServiceUrl != null && !aiFaceServiceUrl.trim().isEmpty())
                ? aiFaceServiceUrl.trim().replaceAll("/+$", "")
                : "http://localhost:8000";
        String primaryUrl = baseUrl + "/api/v1/face/verify-json";

        Map<String, Object> body = new HashMap<>();
        body.put("image", base64Image);
        if (requesterCode != null && !requesterCode.isBlank()) {
            body.put("expected_employee_code", requesterCode);
        }
        if (livenessFrames != null && !livenessFrames.isEmpty()) {
            body.put("liveness_frames", livenessFrames);
        }
        body.put("similarity_threshold", threshold);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);

        try {
            org.springframework.http.client.SimpleClientHttpRequestFactory factory =
                    new org.springframework.http.client.SimpleClientHttpRequestFactory();
            factory.setConnectTimeout(java.time.Duration.ofSeconds(3));
            factory.setReadTimeout(java.time.Duration.ofSeconds(10));
            RestTemplate timeoutRestTemplate = new RestTemplate(factory);

            ResponseEntity<String> response = timeoutRestTemplate.postForEntity(primaryUrl, entity, String.class);
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                return objectMapper.readTree(response.getBody());
            }
        } catch (Exception ex) {
            log.warn("AI face service verification failed or timed out (endpoint: {}): {}", primaryUrl, ex.getMessage());
        }
        return null;
    }

    private boolean isOfficeNetwork(String wifiBssid) {
        if (wifiBssid == null || wifiBssid.isBlank()) {
            return false;
        }
        String bssid = wifiBssid.toLowerCase();
        String wifiKeywords = ruleService.getString("attendance_security", "office_wifi_keywords", "act_office,act-office,act_office_5g");
        for (String kw : wifiKeywords.split(",")) {
            if (!kw.isBlank() && bssid.contains(kw.trim().toLowerCase())) {
                return true;
            }
        }
        String ipPrefixes = ruleService.getString("attendance_security", "office_ip_prefixes", "10.0.,192.168.,172.16.,127.0.");
        for (String prefix : ipPrefixes.split(",")) {
            if (!prefix.isBlank() && bssid.startsWith(prefix.trim())) {
                return true;
            }
        }
        return false;
    }

    private double haversineMeters(double lat1, double lon1, double lat2, double lon2) {
        final int R = 6371000;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return 2 * R * Math.asin(Math.sqrt(a));
    }

    private LayerResult layer(String code, String label, boolean passed, String detail) {
        return LayerResult.builder().layer(code).label(label).passed(passed).detail(detail).build();
    }

    @Override
    public Map<String, Object> getTodayStatus(UUID userId) {
        Map<String, Object> out = new HashMap<>();
        if (userId == null) return out;

        LocalDate today = LocalDate.now();
        LocalDate yesterday = today.minusDays(1);

        Optional<AttendanceLog> todayLog = attendanceLogRepository.findByUserIdAndWorkDate(userId, today);
        Optional<AttendanceLog> yesterdayLog = attendanceLogRepository.findByUserIdAndWorkDate(userId, yesterday);

        Map<String, Object> todayMap = new HashMap<>();
        todayMap.put("workDate", today.toString());
        boolean hasCheckedIn = todayLog.isPresent() && todayLog.get().getCheckInAt() != null;
        boolean hasCheckedOut = todayLog.isPresent() && todayLog.get().getCheckOutAt() != null;
        todayMap.put("hasCheckedIn", hasCheckedIn);
        todayMap.put("hasCheckedOut", hasCheckedOut);
        todayMap.put("checkInAt", todayLog.map(AttendanceLog::getCheckInAt).orElse(null));
        todayMap.put("checkOutAt", todayLog.map(AttendanceLog::getCheckOutAt).orElse(null));

        Map<String, Object> yesterdayMap = new HashMap<>();
        yesterdayMap.put("workDate", yesterday.toString());
        boolean yCheckIn = yesterdayLog.isPresent() && yesterdayLog.get().getCheckInAt() != null;
        boolean yCheckOut = yesterdayLog.isPresent() && yesterdayLog.get().getCheckOutAt() != null;
        yesterdayMap.put("hasCheckedIn", yCheckIn);
        yesterdayMap.put("hasCheckedOut", yCheckOut);
        yesterdayMap.put("checkInAt", yesterdayLog.map(AttendanceLog::getCheckInAt).orElse(null));
        yesterdayMap.put("checkOutAt", yesterdayLog.map(AttendanceLog::getCheckOutAt).orElse(null));
        // Missing checkout yesterday if checked in but never checked out
        yesterdayMap.put("missingCheckout", yCheckIn && !yCheckOut);

        boolean faceEnrolled = faceProfileRepository.existsByUserIdAndStatus(userId, "active");

        out.put("today", todayMap);
        out.put("yesterday", yesterdayMap);
        out.put("faceEnrolled", faceEnrolled);
        return out;
    }
}
