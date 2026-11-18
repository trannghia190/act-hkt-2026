package com.act.pulse.modules.attendance.dto.request;

import lombok.Data;
import java.math.BigDecimal;
import java.util.List;

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
}
