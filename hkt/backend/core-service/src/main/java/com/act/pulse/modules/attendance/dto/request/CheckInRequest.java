package com.act.pulse.modules.attendance.dto.request;

import lombok.Data;
import java.math.BigDecimal;
import java.util.List;

/**
 * Dữ liệu một lần chấm công.
 * <p>Ảnh khuôn mặt gửi lên dạng **Base64 đầy đủ** (KHÔNG cắt bớt) —
 * AI Face Service cần ảnh để trích vector & kiểm tra liveness.</p>
 */
@Data
public class CheckInRequest {
    private String employeeCode;
    private String faceImageBase64;
    private List<Float> faceEmbedding;
    private String type; // CHECK_IN or CHECK_OUT

    private String wifiBssid;
    private BigDecimal latitude;
    private BigDecimal longitude;
    private Boolean isOffline = false;

    /** Fingerprint thiết bị (canvas + screen + user-agent hash) để đối chiếu thiết bị đã đăng ký. */
    private String deviceFingerprint;

    /** Danh sách frame liên tiếp để kiểm tra liveness (chuyển động thật). */
    private List<String> livenessFrames;
}
