package com.act.pulse.modules.okr.service.impl;

import com.act.pulse.modules.okr.dto.request.OKRAssessmentRequest;
import com.act.pulse.modules.okr.dto.response.OKRReviewResponse;
import com.act.pulse.modules.okr.entity.OKRReview;
import com.act.pulse.modules.okr.repository.OKRReviewRepository;
import com.act.pulse.modules.okr.service.OKRService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class OKRServiceImpl implements OKRService {

    private final OKRReviewRepository okrReviewRepository;

    @Override
    @Transactional
    public OKRReviewResponse submitAssessment(UUID userId, Integer year, OKRAssessmentRequest request) {
        BigDecimal average = BigDecimal.valueOf(request.getBox2Score() + request.getBox3Score())
                .divide(BigDecimal.valueOf(2), 2, RoundingMode.HALF_UP);

        String ranking;
        if (average.compareTo(BigDecimal.valueOf(4.5)) >= 0) ranking = "A";
        else if (average.compareTo(BigDecimal.valueOf(3.5)) >= 0) ranking = "B";
        else if (average.compareTo(BigDecimal.valueOf(2.5)) >= 0) ranking = "C";
        else ranking = "D";

        OKRReview review = okrReviewRepository.findByUserIdAndCycleYear(userId, year)
                .orElse(OKRReview.builder().userId(userId).cycleYear(year).build());

        review.setBox2SelfScore(request.getBox2Score());
        review.setBox3SelfScore(request.getBox3Score());
        review.setFinalAverageScore(average);
        review.setFinalRanking(ranking);
        review.setCurrentStep(2); // Next step: Manager assessment

        okrReviewRepository.save(review);

        return OKRReviewResponse.builder()
                .id(review.getId())
                .cycleYear(review.getCycleYear())
                .box2Score(review.getBox2SelfScore())
                .box3Score(review.getBox3SelfScore())
                .finalAverageScore(review.getFinalAverageScore())
                .finalRanking(review.getFinalRanking())
                .currentStep(review.getCurrentStep())
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public OKRReviewResponse getMyReview(UUID userId, Integer year) {
        OKRReview review = okrReviewRepository.findByUserIdAndCycleYear(userId, year)
                .orElse(OKRReview.builder().userId(userId).cycleYear(year).currentStep(1).build());

        return OKRReviewResponse.builder()
                .id(review.getId())
                .cycleYear(review.getCycleYear())
                .box2Score(review.getBox2SelfScore())
                .box3Score(review.getBox3SelfScore())
                .finalAverageScore(review.getFinalAverageScore())
                .finalRanking(review.getFinalRanking())
                .currentStep(review.getCurrentStep())
                .build();
    }
}
