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

    private static final String AI_SERVICE_DOCKER_SERVICE_URL = "http://ai-face-service:8000/api/v1/face/verify-json";
    private static final String AI_SERVICE_DOCKER_URL = "http://pulse-ai-face-service:8000/api/v1/face/verify-json";
    private static final String AI_SERVICE_LOCAL_URL = "http://localhost:8000/api/v1/face/verify-json";

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

        // Resolve user from authenticated token principal, or fallback to request employeeCode for terminals/demo
        User requester = null;
        if (authenticatedUserId != null) {
            requester = userRepository.findById(authenticatedUserId).orElse(null);
        }
        if (requester == null && request.getEmployeeCode() != null && !request.getEmployeeCode().isBlank()) {
            String code = request.getEmployeeCode().trim();
            requester = userRepository.findByEmployeeCodeIgnoreCaseOrEmailIgnoreCase(code, code).orElse(null);
        }
        if (requester == null) {
            // Default demo employee fallback if unspecified
            requester = userRepository.findByEmployeeCodeIgnoreCaseOrEmailIgnoreCase("136ACT", "136ACT").orElse(null);
        }
        if (requester == null) {
            String targetCode = request.getEmployeeCode() != null ? request.getEmployeeCode() : "chưa xác định";
            return reject("USER_NOT_FOUND", "Không tìm thấy hồ sơ nhân viên: " + targetCode + ". Vui lòng kiểm tra mã nhân viên.", layers, FaceOutcome.skipped());
        }
        final UUID userId = requester.getId();
        final String requesterCode = requester.getEmployeeCode();

        // ── Lớp 1 · THIẾT BỊ: phải là thiết bị đã được HR duyệt ─────────────
        // Máy đầu tiên của mỗi người được tự đăng ký (docs/01 §2); máy thứ 2/3 phải chờ HR duyệt.
        String deviceFingerprint = request.getDeviceFingerprint();
        int maxDevices = ruleService.getInt("attendance_security", "max_devices", 2);
        boolean deviceApproved = false;
        String deviceDetail = "Thiết bị này chưa được HR duyệt — không chấm công được";
        if (deviceFingerprint != null && !deviceFingerprint.isBlank()) {
            Optional<DeviceRegistration> existing = deviceRegistrationRepository
                    .findByUserIdAndDeviceFingerprintAndIsApprovedTrue(userId, deviceFingerprint);
            if (existing.isPresent()) {
                deviceApproved = true;
                deviceDetail = null;
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
        if (request.getLatitude() != null && request.getLongitude() != null) {
            distance = haversineMeters(request.getLatitude().doubleValue(), request.getLongitude().doubleValue(),
                    OFFICE_LAT, OFFICE_LNG);
            if (distance > geofenceRadius && !wfhToday) {
                gpsPassed = false;
                gpsDetail = String.format("Bạn đang %,.0f km so với văn phòng (bán kính cho phép %dm)",
                        distance / 1000.0, geofenceRadius);
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

        JsonNode ai = callAiFaceService(image, request.getLivenessFrames(), requesterCode);
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

    private JsonNode callAiFaceService(String base64Image, List<String> livenessFrames, String requesterCode) {
        String baseUrl = (aiFaceServiceUrl != null && !aiFaceServiceUrl.trim().isEmpty())
                ? aiFaceServiceUrl.trim().replaceAll("/+$", "")
                : "http://localhost:8000";
        String primaryUrl = baseUrl + "/api/v1/face/verify-json";

        java.util.LinkedHashSet<String> targets = new java.util.LinkedHashSet<>();
        targets.add(primaryUrl);
        targets.add(AI_SERVICE_DOCKER_SERVICE_URL);
        targets.add(AI_SERVICE_DOCKER_URL);
        targets.add(AI_SERVICE_LOCAL_URL);

        Map<String, Object> body = new HashMap<>();
        body.put("image", base64Image);
        if (requesterCode != null && !requesterCode.isBlank()) {
            body.put("expected_employee_code", requesterCode);
        }
        if (livenessFrames != null && !livenessFrames.isEmpty()) {
            body.put("liveness_frames", livenessFrames);
        }
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);

        for (String url : targets) {
            try {
                log.info("Calling AI Face Service at endpoint: {}", url);
                ResponseEntity<String> response = restTemplate.postForEntity(url, entity, String.class);
                if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                    log.info("Successfully connected to AI Face Service at {}", url);
                    return objectMapper.readTree(response.getBody());
                }
            } catch (Exception e) {
                log.warn("Không kết nối được AI Face Service tại {}: {}", url, e.getMessage());
            }
        }
        return null;
    }

    private boolean isOfficeNetwork(String wifiBssid) {
        if (wifiBssid == null || wifiBssid.isBlank()) {
            return false;
        }
        String bssid = wifiBssid.toLowerCase();
        return bssid.contains("act_office") || bssid.contains("act-office")
                || OFFICE_NETWORK_PREFIXES.stream().anyMatch(bssid::startsWith);
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
}
