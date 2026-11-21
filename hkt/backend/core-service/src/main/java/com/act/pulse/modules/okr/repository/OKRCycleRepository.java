package com.act.pulse.modules.okr.repository;

import com.act.pulse.modules.okr.entity.OKRCycle;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface OKRCycleRepository extends JpaRepository<OKRCycle, UUID> {
    java.util.List<OKRCycle> findAllByOrderByCycleYearDesc();
    Optional<OKRCycle> findFirstByCycleYearAndStatusOrderByCreatedAtDesc(Integer cycleYear, String status);
    Optional<OKRCycle> findFirstByStatusOrderByCreatedAtDesc(String status);

    @Modifying(clearAutomatically = true)
    @Transactional
    @Query(value = """
            UPDATE okr_cycles SET name = :name, cycle_year = :year,
                phases = CAST(:phases AS jsonb), checkin_interval = :interval,
                scale_min = :min, scale_max = :max, score_categories = 2,
                alignment_enabled = :alignment, status = :status,
                company_objectives = CAST(:companyObjectives AS jsonb),
                seniority_cutoff_date = CAST(:cutoff AS date), updated_at = NOW()
            WHERE id = :id
            """, nativeQuery = true)
    int updateCycleNative(@Param("id") UUID id, @Param("name") String name, @Param("year") Integer year,
                          @Param("phases") String phases, @Param("interval") String interval,
                          @Param("min") Integer min, @Param("max") Integer max,
                          @Param("alignment") Boolean alignment, @Param("status") String status,
                          @Param("companyObjectives") String companyObjectives,
                          @Param("cutoff") String cutoff);

    @Modifying(clearAutomatically = true)
    @Transactional
    @Query(value = """
            INSERT INTO okr_cycles
                (id, name, cycle_year, phases, checkin_interval, scale_min, scale_max,
                 score_categories, alignment_enabled, status, company_objectives, seniority_cutoff_date)
            VALUES
                (:id, :name, :year, CAST(:phases AS jsonb), :interval, :min, :max, 2, :alignment, :status,
                 CAST(:companyObjectives AS jsonb), CAST(:cutoff AS date))
            """, nativeQuery = true)
    int insertCycleNative(@Param("id") UUID id, @Param("name") String name, @Param("year") Integer year,
                          @Param("phases") String phases, @Param("interval") String interval,
                          @Param("min") Integer min, @Param("max") Integer max,
                          @Param("alignment") Boolean alignment, @Param("status") String status,
                          @Param("companyObjectives") String companyObjectives,
                          @Param("cutoff") String cutoff);

    @Modifying(clearAutomatically = true)
    @Transactional
    @Query(value = "UPDATE okr_cycles SET status = :status, updated_at = NOW() WHERE id = :id", nativeQuery = true)
    int updateStatusNative(@Param("id") UUID id, @Param("status") String status);

    @Modifying(clearAutomatically = true)
    @Transactional
    @Query(value = "UPDATE okr_cycles SET phases = CAST(:phases AS jsonb), updated_at = NOW() WHERE id = :id", nativeQuery = true)
    int updatePhasesNative(@Param("id") UUID id, @Param("phases") String phases);

    @Modifying(clearAutomatically = true)
    @Transactional
    @Query(value = """
            UPDATE okr_cycles SET director_reviewed_at = NOW(), director_reviewed_by = :reviewer,
                director_review_comment = :comment, updated_at = NOW()
            WHERE id = :id
            """, nativeQuery = true)
    int markDirectorReviewed(@Param("id") UUID id, @Param("reviewer") UUID reviewer,
                             @Param("comment") String comment);

    @Modifying(clearAutomatically = true)
    @Transactional
    @Query(value = """
            UPDATE okr_cycles SET director_reviewed_at = NULL, director_reviewed_by = NULL,
                director_review_comment = NULL, updated_at = NOW()
            WHERE id = :id
            """, nativeQuery = true)
    int clearDirectorReview(@Param("id") UUID id);
}
