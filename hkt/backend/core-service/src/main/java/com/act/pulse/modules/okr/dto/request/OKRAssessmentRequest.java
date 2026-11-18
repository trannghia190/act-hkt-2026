package com.act.pulse.modules.okr.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class OKRAssessmentRequest {
    @NotNull(message = "Điểm Business không được để trống")
    @Min(value = 1, message = "Điểm tối thiểu là 1")
    @Max(value = 5, message = "Điểm tối đa là 5")
    private Integer box2Score;

    @NotNull(message = "Điểm People không được để trống")
    @Min(value = 1, message = "Điểm tối thiểu là 1")
    @Max(value = 5, message = "Điểm tối đa là 5")
    private Integer box3Score;

    private String note;
}
