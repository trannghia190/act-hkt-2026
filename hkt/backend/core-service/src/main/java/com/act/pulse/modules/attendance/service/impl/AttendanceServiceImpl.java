package com.act.pulse.modules.attendance.service.impl;

import com.act.pulse.modules.attendance.dto.request.CheckInRequest;
import com.act.pulse.modules.attendance.dto.response.CheckInResponse;
import com.act.pulse.modules.attendance.entity.AttendanceLog;
import com.act.pulse.modules.attendance.repository.AttendanceLogRepository;
import com.act.pulse.modules.attendance.service.AttendanceService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class AttendanceServiceImpl implements AttendanceService {

    private final AttendanceLogRepository attendanceLogRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final RestTemplate restTemplate = new RestTemplate();

    private static final String AI_SERVICE_DOCKER_URL = "http://pulse-ai-face-service:8000/api/v1/face/verify-json";
    private static final String AI_SERVICE_LOCAL_URL = "http://localhost:8000/api/v1/face/verify-json";

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

    private CheckInResponse processAttendancePunch(UUID userId, CheckInRequest request, String punchType) {
        String requesterCode = request.getEmployeeCode() != null ? request.getEmployeeCode().trim() : "136ACT";
        String faceImage = request.getFaceImageBase64();

        log.info("Processing {} punch request for requesterCode: {}", punchType, requesterCode);

        // 1. If Face Image is present, call AI Face Recognition Service (OpenCV + 512D Vector)
        if (faceImage != null && !faceImage.trim().isEmpty()) {
            JsonNode aiResult = callAiFaceService(faceImage, requesterCode);

            if (aiResult != null) {
                boolean isMatched = aiResult.path("is_matched").asBoolean(false);
                boolean qualityPassed = aiResult.path("quality_passed").asBoolean(true);
                String message = aiResult.path("message").asText("Không xác định");
                double similarity = aiResult.path("similarity_score").asDouble(0.0);

                // Case A: Image Quality Issue
                if (!qualityPassed) {
                    log.warn("Face punch quality check failed: {}", message);
                    return CheckInResponse.builder()
                            .status("QUALITY_FAILED")
                            .serverTimestamp(LocalDateTime.now())
                            .message("Lỗi chất lượng ảnh chụp: " + message)
                            .isProxyPunchDetected(false)
                            .build();
                }

                // Case B: No face found or below threshold
                if (!isMatched) {
                    log.warn("Face punch verification failed: {}", message);
                    return CheckInResponse.builder()
                            .status("NOT_FOUND")
                            .serverTimestamp(LocalDateTime.now())
                            .message("Xác thực khuôn mặt thất bại: " + message)
                            .similarityScore(similarity)
                            .isProxyPunchDetected(false)
                            .build();
                }

                // Case C: Face recognized by AI -> Compare with login requester (Proxy Punch Prevention)
                JsonNode matchedEmp = aiResult.path("matched_employee");
                String matchedCode = matchedEmp.path("employee_code").asText("");
                String matchedName = matchedEmp.path("full_name").asText("");

                log.info("AI recognized person in front of camera: {} ({}), requester is: {}", matchedName, matchedCode, requesterCode);

                if (!matchedCode.isEmpty() && !matchedCode.equalsIgnoreCase(requesterCode)) {
                    // FRAUD / PROXY PUNCH DETECTED!
                    String alertMsg = String.format(
                            "CẢNH BÁO CHẤM CÔNG HỘ: Người đứng trước camera là %s (Mã: %s), KHÔNG KHỚP với tài khoản đăng nhập là %s! Hệ thống đã từ chối chấm công.",
                            matchedName, matchedCode, requesterCode
                    );
                    log.error(alertMsg);

                    return CheckInResponse.builder()
                            .status("PROXY_PUNCH_BLOCKED")
                            .serverTimestamp(LocalDateTime.now())
                            .message(alertMsg)
                            .matchedEmployeeCode(matchedCode)
                            .matchedFullName(matchedName)
                            .similarityScore(similarity)
                            .isProxyPunchDetected(true)
                            .build();
                }

                // Matched successfully! Same person!
                AttendanceLog logEntity = AttendanceLog.builder()
                        .userId(userId)
                        .type(punchType)
                        .serverTimestamp(LocalDateTime.now())
                        .wifiBssid(request.getWifiBssid())
                        .latitude(request.getLatitude())
                        .longitude(request.getLongitude())
                        .status("VALID")
                        .build();
                logEntity.setCreatedAt(LocalDateTime.now());
                logEntity.setUpdatedAt(LocalDateTime.now());

                attendanceLogRepository.save(logEntity);

                return CheckInResponse.builder()
                        .status("VALID")
                        .serverTimestamp(logEntity.getServerTimestamp())
                        .message(String.format("Xác thực khuôn mặt chính chủ thành công! Nhân viên: %s (%s). Độ tương đồng: %.1f%%",
                                matchedName, matchedCode, similarity * 100))
                        .matchedEmployeeCode(matchedCode)
                        .matchedFullName(matchedName)
                        .similarityScore(similarity)
                        .isProxyPunchDetected(false)
                        .build();
            }
        }

        // Fallback standard punch
        AttendanceLog logEntity = AttendanceLog.builder()
                .userId(userId)
                .type(punchType)
                .serverTimestamp(LocalDateTime.now())
                .wifiBssid(request.getWifiBssid())
                .latitude(request.getLatitude())
                .longitude(request.getLongitude())
                .status("VALID")
                .build();
        logEntity.setCreatedAt(LocalDateTime.now());
        logEntity.setUpdatedAt(LocalDateTime.now());

        attendanceLogRepository.save(logEntity);

        return CheckInResponse.builder()
                .status(logEntity.getStatus())
                .serverTimestamp(logEntity.getServerTimestamp())
                .message("Chấm công thành công (Thời gian máy chủ: " + logEntity.getServerTimestamp() + ")")
                .matchedEmployeeCode(requesterCode)
                .isProxyPunchDetected(false)
                .build();
    }

    private JsonNode callAiFaceService(String base64Image, String expectedEmployeeCode) {
        String[] targets = {AI_SERVICE_DOCKER_URL, AI_SERVICE_LOCAL_URL};
        Map<String, String> body = new HashMap<>();
        body.put("image", base64Image);
        // Do not force expected_code so AI performs true unbiased 1:N search across all enrolled employees
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<Map<String, String>> entity = new HttpEntity<>(body, headers);

        for (String url : targets) {
            try {
                ResponseEntity<String> response = restTemplate.postForEntity(url, entity, String.class);
                if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                    return objectMapper.readTree(response.getBody());
                }
            } catch (Exception e) {
                log.warn("Could not connect to AI Face Service at {}: {}", url, e.getMessage());
            }
        }
        return null;
    }
}
