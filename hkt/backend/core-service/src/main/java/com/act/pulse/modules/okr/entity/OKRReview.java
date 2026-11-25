package com.act.pulse.modules.okr.entity;

import com.act.pulse.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "okr_reviews")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OKRReview extends BaseEntity {

    @Column(name = "cycle_id")
    private UUID cycleId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "manager_id")
    private UUID managerId;

    @Column(name = "cycle_year", nullable = false)
    private Integer cycleYear;

    @Column(name = "business_score")
    private Integer businessScore; // 1 to 5

    @Column(name = "people_score")
    private Integer peopleScore; // 1 to 5

    @Column(name = "average_score", precision = 3, scale = 2)
    private BigDecimal averageScore;

    @Column(name = "status", length = 20)
    @Builder.Default
    private String status = "draft"; // draft | submitted | locked | reopened | scored

    /** @deprecated Box 1 giờ là thông tin cá nhân tự điền; 4 mục chuyển vào Box 2/3 (V28). */
    @Column(name = "box1_results", columnDefinition = "TEXT")
    private String box1Results;

    @Column(name = "box1_adjustments", columnDefinition = "TEXT")
    private String box1Adjustments;

    @Column(name = "box1_difficulties", columnDefinition = "TEXT")
    private String box1Difficulties;

    @Column(name = "box1_lessons", columnDefinition = "TEXT")
    private String box1Lessons;

    @Column(name = "manager_comment", columnDefinition = "TEXT")
    private String managerComment;

    /** Quản lý bật cho nhân viên cập nhật tiến độ trong cửa sổ review giữa năm / cuối năm. */
    @Column(name = "midyear_update_override")
    private Boolean midYearUpdateOverride = false;

    @Column(name = "final_update_override")
    private Boolean finalUpdateOverride = false;

    // ---- Box 2 Business / Box 3 People: mỗi box 4 mục (kết quả · điều chỉnh · khó khăn · bài học) ----
    @Column(name = "box2_results", columnDefinition = "TEXT")
    private String box2Results;

    @Column(name = "box2_adjustments", columnDefinition = "TEXT")
    private String box2Adjustments;

    @Column(name = "box2_difficulties", columnDefinition = "TEXT")
    private String box2Difficulties;

    @Column(name = "box2_lessons", columnDefinition = "TEXT")
    private String box2Lessons;

    @Column(name = "box3_results", columnDefinition = "TEXT")
    private String box3Results;

    @Column(name = "box3_adjustments", columnDefinition = "TEXT")
    private String box3Adjustments;

    @Column(name = "box3_difficulties", columnDefinition = "TEXT")
    private String box3Difficulties;

    @Column(name = "box3_lessons", columnDefinition = "TEXT")
    private String box3Lessons;

    /** @deprecated cấu trúc cũ — giữ để đọc dữ liệu lịch sử, form mới dùng box2Results… */
    @Column(name = "box2_business_text", columnDefinition = "TEXT")
    private String box2BusinessText;

    @Column(name = "box2_attachment_url")
    private String box2AttachmentUrl;

    @Column(name = "box2_self_score")
    private Integer box2SelfScore; // 1 to 5

    @Column(name = "box2_manager_score")
    private Integer box2ManagerScore; // 1 to 5

    @Column(name = "box3_people_text", columnDefinition = "TEXT")
    private String box3PeopleText;

    @Column(name = "box3_attachment_url")
    private String box3AttachmentUrl;

    @Column(name = "box3_self_score")
    private Integer box3SelfScore; // 1 to 5

    @Column(name = "box3_manager_score")
    private Integer box3ManagerScore; // 1 to 5

    /** Định hướng phát triển nhân viên khai báo cho kỳ hiện tại. */
    @Column(name = "box4_direction", columnDefinition = "TEXT")
    private String box4Direction;

    /** Đề xuất của nhân viên cho kỳ hiện tại (gửi kèm bộ mục tiêu). */
    @Column(name = "box4_proposal", columnDefinition = "TEXT")
    private String box4Proposal;

    @Column(name = "box4_improvement_area", columnDefinition = "TEXT")
    private String box4ImprovementArea;

    /** Thời điểm nhân viên gửi kèm nội dung định hướng/đề xuất cùng bộ mục tiêu. */
    @Column(name = "box4_submitted_at")
    private LocalDateTime box4SubmittedAt;

    @Column(name = "final_average_score", precision = 3, scale = 2)
    private BigDecimal finalAverageScore;

    @Column(name = "final_ranking", length = 10)
    private String finalRanking;

    @Column(name = "current_step")
    @Builder.Default
    private Integer currentStep = 1;

    @Column(name = "locked_at")
    private LocalDateTime lockedAt;

    @Column(name = "reopened_at")
    private LocalDateTime reopenedAt;

    @Column(name = "submitted_at")
    private LocalDateTime submittedAt;

    /** Cột "Note" của bảng tổng hợp HR (Bước 3–5) — HR / Giám đốc ghi, khác nhận xét Quản lý. */
    @Column(name = "hr_note", columnDefinition = "TEXT")
    private String hrNote;

    @Column(name = "manager_feedback", columnDefinition = "TEXT")
    private String managerFeedback;
}
