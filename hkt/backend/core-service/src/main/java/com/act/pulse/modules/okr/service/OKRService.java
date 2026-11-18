package com.act.pulse.modules.okr.service;

import com.act.pulse.modules.okr.dto.request.OKRAssessmentRequest;
import com.act.pulse.modules.okr.dto.response.OKRReviewResponse;
import java.util.UUID;

public interface OKRService {
    OKRReviewResponse submitAssessment(UUID userId, Integer year, OKRAssessmentRequest request);
    OKRReviewResponse getMyReview(UUID userId, Integer year);
}
