package com.act.pulse.modules.okr.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OKRReviewResponse {
    private UUID id;
    private Integer cycleYear;
    private Integer box2Score;
    private Integer box3Score;
    private BigDecimal finalAverageScore;
    private String finalRanking;
    private Integer currentStep;
}
