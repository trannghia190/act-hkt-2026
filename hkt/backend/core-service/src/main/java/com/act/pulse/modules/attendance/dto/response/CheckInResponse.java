package com.act.pulse.modules.attendance.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CheckInResponse {
    private String status; // VALID, PROXY_PUNCH_BLOCKED, QUALITY_FAILED, NOT_FOUND, FLAGGED_LOW_GPS
    private LocalDateTime serverTimestamp;
    private String message;
    private String matchedEmployeeCode;
    private String matchedFullName;
    private Double similarityScore;
    private Boolean isProxyPunchDetected;
}
