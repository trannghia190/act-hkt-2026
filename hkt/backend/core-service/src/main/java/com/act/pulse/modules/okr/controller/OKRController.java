package com.act.pulse.modules.okr.controller;

import com.act.pulse.common.response.ApiResponse;
import com.act.pulse.modules.okr.dto.request.OKRAssessmentRequest;
import com.act.pulse.modules.okr.dto.response.OKRReviewResponse;
import com.act.pulse.modules.okr.service.OKRService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/okr")
@RequiredArgsConstructor
@Tag(name = "3. OKR API", description = "Quản trị mục tiêu, form đánh giá 4 Box, chấm điểm 1-5 và báo cáo HR")
public class OKRController {

    private final OKRService okrService;

    @GetMapping("/my-review")
    @Operation(summary = "Xem hồ sơ OKR cá nhân theo năm")
    public ApiResponse<OKRReviewResponse> getMyReview(@RequestParam(defaultValue = "2026") Integer year) {
        UUID userId = UUID.randomUUID();
        return ApiResponse.ok(okrService.getMyReview(userId, year), "Lấy thông tin OKR thành công");
    }

    @PostMapping("/assessment")
    @Operation(summary = "Nhân viên nộp tự đánh giá cuối năm (Box 2 & Box 3)")
    public ApiResponse<OKRReviewResponse> submitAssessment(
            @RequestParam(defaultValue = "2026") Integer year,
            @Valid @RequestBody OKRAssessmentRequest request
    ) {
        UUID userId = UUID.randomUUID();
        return ApiResponse.ok(okrService.submitAssessment(userId, year, request), "Nộp đánh giá OKR thành công");
    }
}
