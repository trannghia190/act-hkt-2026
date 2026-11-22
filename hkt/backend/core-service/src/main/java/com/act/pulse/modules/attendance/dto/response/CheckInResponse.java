package com.act.pulse.modules.attendance.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Kết quả chấm công.
 * <p>Business (docs/02 §2.1.1): mọi lớp kiểm tra đều là **CHẶN** — không có trạng thái
 * "gắn cờ nhưng vẫn tính công". Vì vậy {@code status} chỉ có {@code VALID} hoặc {@code REJECTED},
 * kèm {@code rejectReason} và danh sách lớp đã đạt/không đạt để UI hiển thị đúng lý do.</p>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CheckInResponse {
    private String status; // VALID | REJECTED
    /** Hành động server đã thực hiện khi chấm tự động: IN = vào ca, OUT = ra ca. */
    private String punchType;
    private LocalDateTime serverTimestamp;
    private String message;
    private String matchedEmployeeCode;
    private String matchedFullName;
    private Double similarityScore;
    private Boolean isProxyPunchDetected;

    /** Mã lý do chặn: DEVICE_NOT_APPROVED | OUTSIDE_NETWORK | OUTSIDE_GEOFENCE | GPS_INACCURATE | NO_SHIFT | FACE_NOT_ENROLLED | FACE_MISMATCH | FACE_LIVENESS_FAILED | TOO_MANY_ATTEMPTS */
    private String rejectReason;

    /** Kết quả từng lớp kiểm tra để hiển thị "từng bước hiện dần" trên UI. */
    private List<LayerResult> layers;

    /** Số lần thử khuôn mặt còn lại trong phiên (rule {@code face_max_attempts}). */
    private Integer faceAttemptsRemaining;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class LayerResult {
        private String layer;   // DEVICE | NETWORK | GPS | SHIFT | FACE
        private String label;   // nhãn tiếng Việt hiển thị trên UI
        private boolean passed;
        private String detail;  // chi tiết khi không đạt
    }
}
