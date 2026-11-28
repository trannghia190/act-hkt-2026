package com.act.pulse.modules.attendance.service.impl;

import com.act.pulse.modules.attendance.dto.request.CheckInRequest;
import com.act.pulse.modules.attendance.dto.response.CheckInResponse;
import com.act.pulse.modules.attendance.dto.response.CheckInResponse.LayerResult;
import com.act.pulse.modules.attendance.entity.AttendanceLog;
import com.act.pulse.modules.attendance.entity.DeviceRegistration;
import com.act.pulse.modules.attendance.repository.AttendanceLogRepository;
import com.act.pulse.modules.attendance.repository.DeviceRegistrationRepository;
import com.act.pulse.modules.attendance.repository.RequestRepository;
import com.act.pulse.modules.attendance.service.AttendanceService;
import com.act.pulse.modules.attendance.service.DeviceOwnerLabels;
import com.act.pulse.modules.attendance.service.RuleService;
import com.act.pulse.modules.attendance.service.ShiftResolver;
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
import java.net.InetAddress;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
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
    private final ShiftResolver shiftResolver;
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
        // Client hiện đại gửi loại chấm tường minh (VÀO/RA). Chỉ rơi về AUTO cho client cũ
        // chưa gửi type — tránh biến một lần chấm RA muộn thành giờ VÀO.
        String requested = request.getType() == null ? "" : request.getType().trim().toUpperCase();
        if ("CHECK_OUT".equals(requested)) {
            return processAttendancePunch(userId, request, "CHECK_OUT");
        }
        if ("CHECK_IN".equals(requested)) {
            return processAttendancePunch(userId, request, "CHECK_IN");
        }
        return processAttendancePunch(userId, request, "AUTO");
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

        // ── Chấm công ngoại tuyến đã bị bỏ ─────────────────────────────────
        // Dữ liệu thời gian/GPS/thiết bị do client gửi lên không kiểm chứng được,
        // ảnh hưởng trực tiếp tới bảng công. Từ chối tường minh thay vì tin client.
        if (Boolean.TRUE.equals(request.getIsOffline()) || request.getOfflinePunchedAt() != null) {
            return reject("OFFLINE_NOT_SUPPORTED",
                    "Chấm công ngoại tuyến không còn được hỗ trợ. Vui lòng chấm công khi có kết nối mạng, hoặc tạo đơn bổ sung công nếu đã quên chấm.",
                    layers, FaceOutcome.skipped());
        }

        // ── Lớp 1 · THIẾT BỊ: phải là thiết bị đã được HR duyệt ─────────────
        // Máy chưa đăng ký bị chặn — không tự thêm thiết bị khi chấm công.
        String deviceFingerprint = request.getDeviceFingerprint();
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
                    String owner = userRepository.findById(existing.getUserId())
                            .map(DeviceOwnerLabels::of)
                            .orElse("một tài khoản khác");
                    deviceDetail = "Thiết bị này đã được đăng ký bởi " + owner
                            + " — không thể dùng để chấm công cho tài khoản của bạn";
                }
            } else {
                // Máy chưa đăng ký → CHẶN chấm công, KHÔNG tự thêm thiết bị.
                // Nhân viên phải đăng ký máy ở "Thiết bị của tôi" trước (trong hạn mức thì được kích hoạt ngay).
                deviceDetail = "Thiết bị này chưa được đăng ký — vui lòng vào \"Thiết bị của tôi\" để đăng ký máy trước khi chấm công";
            }
        } else {
            deviceDetail = "Không xác định được thiết bị — vui lòng tải lại trang và thử lại";
        }
        layers.add(layer("DEVICE", "Thiết bị đã đăng ký", deviceApproved, deviceDetail));

        // ── Lớp 2 · MẠNG NỘI BỘ ───────────────────────────────────────────
        boolean requireNetwork = ruleService.getBoolean("attendance_security", "require_internal_network", true);
        boolean inOfficeNetwork = isOfficeNetwork(request.getWifiBssid(), request.getIpAddress());
        boolean wfhToday = requestRepository.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .anyMatch(r -> "WFH".equals(r.getRequestType()) && "APPROVED".equals(r.getStatus())
                        && LocalDate.now().equals(r.getWorkDate()));
        boolean networkPassed = !requireNetwork || inOfficeNetwork || wfhToday;
        String networkIp = request.getIpAddress();
        if (!networkPassed) {
            log.info("Chấm công bị chặn lớp NETWORK: userId={} ip={} requireNetwork={} wfhToday={}",
                    userId, networkIp, requireNetwork, wfhToday);
        }
        layers.add(layer("NETWORK", "Trong mạng nội bộ công ty", networkPassed,
                networkPassed ? null : "Bạn đang ngoài mạng công ty (IP server thấy: "
                        + (networkIp == null || networkIp.isBlank() ? "không xác định" : networkIp)
                        + ") — hãy nối Wi-Fi văn phòng"));

        // ── Lớp 3 · VỊ TRÍ (GPS + độ chính xác) ───────────────────────────
        boolean requireGeofence = ruleService.getBoolean("attendance_security", "require_geofence", true);
        int geofenceRadius = ruleService.getInt("attendance_security", "geofence_radius_m", 150);
        int gpsTolerance = ruleService.getInt("attendance_security", "gps_accuracy_tolerance_m", 100);
        Double distance = null;
        boolean gpsPassed = true;
        String gpsDetail = null;

        if (requireGeofence && !wfhToday) {
            if (request.getLatitude() == null || request.getLongitude() == null) {
                gpsPassed = false;
                gpsDetail = "Không lấy được vị trí GPS. Vui lòng bật định vị trên thiết bị và cấp quyền cho trình duyệt.";
            } else if (request.getAccuracyMeters() != null && request.getAccuracyMeters().doubleValue() > gpsTolerance) {
                gpsPassed = false;
                gpsDetail = String.format("Độ chính xác GPS (%.0fm) vượt quá sai số cho phép (%dm). Vui lòng di chuyển lại gần cửa sổ hoặc khu vực thông thoáng và thử lại.",
                        request.getAccuracyMeters().doubleValue(), gpsTolerance);
            } else {
                double officeLat = ruleService.getDouble("attendance_security", "office_lat", OFFICE_LAT);
                double officeLng = ruleService.getDouble("attendance_security", "office_lng", OFFICE_LNG);
                distance = haversineMeters(request.getLatitude().doubleValue(), request.getLongitude().doubleValue(),
                        officeLat, officeLng);
                if (distance > geofenceRadius) {
                    gpsPassed = false;
                    gpsDetail = String.format("Bạn đang cách văn phòng %,.0fm (vượt quá bán kính cho phép %dm)",
                            distance, geofenceRadius);
                }
            }
        }
        layers.add(layer("GPS", "Trong bán kính văn phòng", gpsPassed, gpsDetail));

        // ── Lớp 4 · CA LÀM VIỆC: ca ngoại lệ được gán đè ca chuẩn toàn công ty ─
        // Ca chuẩn (SHIFT_STANDARD) là base áp dụng cho MỌI nhân sự; nếu người dùng được gán
        // ca ngoại lệ theo nhóm/chức danh/cá nhân thì ca đó có ưu tiên cao hơn.
        boolean shiftPassed = true;
        String shiftDetail = null;
        var shift = shiftResolver.resolveFor(requester);
        if (shift != null) {
            java.time.LocalTime nowTime = java.time.LocalTime.now();
            boolean inWindow = !nowTime.isBefore(shift.getCheckInStart()) && !nowTime.isAfter(shift.getCheckOutEnd());
            LocalTime flexibleOutFrom = shift.getFlexibleCheckoutFrom() != null
                    ? shift.getFlexibleCheckoutFrom() : shift.getCheckOutStart();
            if (Boolean.TRUE.equals(shift.getIsFlexible())) {
                inWindow = !nowTime.isBefore(shift.getFlexibleCheckinFrom() != null ? shift.getFlexibleCheckinFrom() : shift.getCheckInStart())
                        && !nowTime.isAfter(shift.getFlexibleCheckoutTo() != null ? shift.getFlexibleCheckoutTo() : shift.getCheckOutEnd());
            }
            // Quên chấm vào: cho phép ghi nhận giờ RA sau khi hết khung ra (ngày công để
            // INCOMPLETE + cần đơn bổ sung), nhưng không mở trước khung ra.
            boolean missingCheckIn = "CHECK_OUT".equals(punchType)
                    && attendanceLogRepository.findByUserIdAndWorkDate(userId, LocalDate.now())
                            .map(log -> log.getCheckInAt() == null)
                            .orElse(true);
            if (!inWindow && missingCheckIn && flexibleOutFrom != null
                    && !nowTime.isBefore(flexibleOutFrom)) {
                inWindow = true;
            }
            if (!inWindow) {
                shiftPassed = false;
                shiftDetail = String.format("Ngoài khung giờ ca %s (%s–%s)", shift.getName(), shift.getCheckInStart(), shift.getCheckOutEnd());
            } else if (missingCheckIn && nowTime.isAfter(shift.getCheckOutEnd())) {
                shiftDetail = "Ghi nhận giờ RA bù sau ca — thiếu giờ vào, cần đơn bổ sung công";
            }
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
                case "GPS" -> (first.getDetail() != null && first.getDetail().contains("sai số")) ? "GPS_ACCURACY" : "OUTSIDE_GEOFENCE";
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
        boolean missingCheckIn = false;
        if ("AUTO".equals(punchType)) {
            // Tự nhận biết như máy chấm công vân tay: lần chấm đầu tiên trong ngày
            // là VÀO; các lần sau là RA, lấy lần cuối cùng làm giờ ra.
            if (existingOpt.isEmpty() || existingOpt.get().getCheckInAt() == null) {
                if (existingOpt.isPresent() && existingOpt.get().getCheckOutAt() != null) {
                    // Đã có giờ RA nhưng thiếu giờ vào: lần chấm tiếp theo vẫn là RA (cập nhật giờ ra),
                    // không được gán giờ vào sau giờ ra.
                    entity = existingOpt.get();
                    entity.setCheckOutAt(now);
                    missingCheckIn = true;
                    punchType = "CHECK_OUT";
                } else {
                    entity = existingOpt.orElseGet(() -> AttendanceLog.builder()
                            .userId(userId)
                            .workDate(workDate)
                            .build());
                    entity.setCheckInAt(now);
                    punchType = "CHECK_IN";
                }
            } else {
                entity = existingOpt.get();
                entity.setCheckOutAt(now);
                punchType = "CHECK_OUT";
            }
            punchAt = now;
        } else if ("CHECK_IN".equals(punchType)) {
            if (existingOpt.isPresent() && existingOpt.get().getCheckInAt() == null
                    && existingOpt.get().getCheckOutAt() != null) {
                // Hôm nay đã ghi RA nhưng thiếu vào: không ghép giờ vào sau giờ ra — phải bổ sung công.
                return reject("CHECKIN_AFTER_CHECKOUT",
                        "Hôm nay đã ghi nhận giờ RA lúc "
                                + existingOpt.get().getCheckOutAt().format(hhmm)
                                + " nhưng chưa có giờ vào — hãy tạo đơn bổ sung công thay vì chấm vào lúc này",
                        layers, face);
            }
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
                // Quên chấm vào: trong/qua khung RA thì vẫn ghi nhận giờ RA thật, nhưng ngày công
                // để INCOMPLETE và yêu cầu đơn bổ sung — KHÔNG tự bịa giờ vào.
                LocalTime outFrom = shift == null ? null
                        : (Boolean.TRUE.equals(shift.getIsFlexible()) && shift.getFlexibleCheckoutFrom() != null
                                ? shift.getFlexibleCheckoutFrom() : shift.getCheckOutStart());
                if (outFrom == null || now.toLocalTime().isBefore(outFrom)) {
                    return reject("NO_CHECKIN",
                            "Chưa chấm công vào và chưa tới khung chấm ra"
                                    + (outFrom == null ? "" : " (từ " + outFrom.format(hhmm) + ")")
                                    + " — hãy chấm công vào trước, hoặc tạo đơn bổ sung công",
                            layers, face);
                }
                entity = existingOpt.orElseGet(() -> AttendanceLog.builder()
                        .userId(userId)
                        .workDate(workDate)
                        .build());
                entity.setCheckOutAt(now);
                missingCheckIn = true;
                punchAt = now;
            } else {
                entity = existingOpt.get();
                // Chấm ra nhiều lần trong ngày: giữ lần cuối cùng.
                entity.setCheckOutAt(now);
                punchAt = now;
            }
        }

        entity.setStatus(missingCheckIn ? "INCOMPLETE" : "VALID");
        // Ghi lại ca hiệu lực tại thời điểm chấm để bảng công tính đúng giờ/đi muộn theo ca
        // kể cả khi HR đổi thứ tự ưu tiên hoặc tắt ca về sau.
        entity.setShiftId(shift == null ? null : shift.getId());
        entity.setWifiBssid(request.getWifiBssid());
        entity.setLatitude(request.getLatitude());
        entity.setLongitude(request.getLongitude());
        entity.setDistanceMeters(distance == null ? null
                : BigDecimal.valueOf(distance).setScale(2, java.math.RoundingMode.HALF_UP));
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
                .status(missingCheckIn ? "INCOMPLETE" : "VALID")
                .punchType("CHECK_IN".equals(punchType) ? "IN" : "OUT")
                .serverTimestamp(punchAt)
                .message(missingCheckIn
                        ? String.format("Đã ghi nhận giờ RA lúc %s, nhưng bạn chưa chấm công vào. "
                                + "Ngày công đang thiếu giờ vào — hãy tạo đơn bổ sung công để được tính công.",
                                punchAt.format(hhmm))
                        : String.format("Chấm công %s thành công lúc %s (thời gian máy chủ)",
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

    private boolean isOfficeNetwork(String wifiBssid, String ipAddress) {
        String wifiKeywords = ruleService.getString("attendance_security", "office_wifi_keywords", "act_office,act-office,act_office_5g");
        if (wifiBssid != null && !wifiBssid.isBlank()) {
            String bssid = wifiBssid.toLowerCase();
            for (String kw : wifiKeywords.split(",")) {
                if (!kw.isBlank() && bssid.contains(kw.trim().toLowerCase())) {
                    return true;
                }
            }
        }
        return matchedIpPrefix(ipAddress) != null;
    }

    /** Tiền tố IP công ty khớp với IP này (null nếu không khớp).
     *  Hỗ trợ: tiền tố chuỗi ("10.0."), CIDR IPv4/IPv6 ("172.20.0.0/16", "::/0") và "*" = mọi IP. */
    private String matchedIpPrefix(String ipAddress) {
        if (ipAddress == null || ipAddress.isBlank()) return null;
        String ipPrefixes = ruleService.getString("attendance_security", "office_ip_prefixes", "10.0.,192.168.,172.16.,127.0.,0:0:0:0:0:0:0:1,::1");
        for (String prefix : ipPrefixes.split(",")) {
            String p = prefix.trim();
            if (!p.isEmpty() && ipMatchesPattern(ipAddress, p)) return p;
        }
        return null;
    }

    private boolean ipMatchesPattern(String ip, String pattern) {
        if ("*".equals(pattern)) return true;
        int slash = pattern.indexOf('/');
        if (slash <= 0) return ip.startsWith(pattern);
        String networkPart = pattern.substring(0, slash);
        // Bỏ zone id của IPv6 link-local (fe80::1%en0) trước khi so CIDR.
        String probeIp = ip.contains("%") ? ip.substring(0, ip.indexOf('%')) : ip;
        // Chỉ nhận IP literal — tránh InetAddress phân giải DNS từ input không tin cậy.
        if (!networkPart.matches("[0-9a-fA-F:.]+") || !probeIp.matches("[0-9a-fA-F:.]+")) return false;
        try {
            InetAddress probe = InetAddress.getByName(probeIp);
            InetAddress network = InetAddress.getByName(networkPart);
            int bits = Integer.parseInt(pattern.substring(slash + 1).trim());
            byte[] a = probe.getAddress();
            byte[] b = network.getAddress();
            if (a.length != b.length) return false;
            if (bits < 0 || bits > a.length * 8) return false;
            int full = bits / 8;
            for (int i = 0; i < full; i++) {
                if (a[i] != b[i]) return false;
            }
            int rem = bits % 8;
            if (rem > 0) {
                int mask = (0xFF << (8 - rem)) & 0xFF;
                return (a[full] & mask) == (b[full] & mask);
            }
            return true;
        } catch (Exception ex) {
            return false;
        }
    }

    @Override
    public Map<String, Object> diagnoseNetwork(UUID userId, String ipAddress) {
        boolean requireNetwork = ruleService.getBoolean("attendance_security", "require_internal_network", true);
        String ipPrefixes = ruleService.getString("attendance_security", "office_ip_prefixes", "10.0.,192.168.,172.16.,127.0.,0:0:0:0:0:0:0:1,::1");
        String wifiKeywords = ruleService.getString("attendance_security", "office_wifi_keywords", "act_office,act-office,act_office_5g");
        String matchedPrefix = matchedIpPrefix(ipAddress);
        boolean wfhToday = requestRepository.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .anyMatch(r -> "WFH".equals(r.getRequestType()) && "APPROVED".equals(r.getStatus())
                        && LocalDate.now().equals(r.getWorkDate()));
        Map<String, Object> out = new java.util.LinkedHashMap<>();
        out.put("requireInternalNetwork", requireNetwork);
        out.put("serverSeenIp", ipAddress);
        out.put("officeIpPrefixes", ipPrefixes);
        out.put("matchedPrefix", matchedPrefix);
        out.put("inOfficeNetworkByIp", matchedPrefix != null);
        out.put("officeWifiKeywords", wifiKeywords);
        out.put("wfhApprovedToday", wfhToday);
        out.put("networkLayerWouldPass", !requireNetwork || matchedPrefix != null || wfhToday);
        return out;
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
        // INCOMPLETE = đã ghi nhận một đầu (thường là RA khi quên chấm vào) — cần đơn bổ sung công.
        todayMap.put("status", todayLog.map(AttendanceLog::getStatus).orElse(null));
        todayMap.put("missingCheckIn", hasCheckedOut && !hasCheckedIn);

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
