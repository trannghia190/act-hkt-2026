package com.act.pulse.modules.attendance.repository;

import com.act.pulse.modules.attendance.entity.Notification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public interface NotificationRepository extends JpaRepository<Notification, UUID> {
    List<Notification> findByUserIdOrderByCreatedAtDesc(UUID userId);
    List<Notification> findByUserIdAndIsReadFalseOrderByCreatedAtDesc(UUID userId);
    List<Notification> findByOrderByCreatedAtDesc();
    long countByUserIdAndIsReadFalse(UUID userId);

    /**
     * Hộp thư phân trang + lọc phía server. {@code eventKey}/{@code q} null nghĩa là
     * không lọc; {@code unreadOnly} chỉ giữ thông báo chưa đọc; {@code filterByCategory}
     * giới hạn theo {@code categoryKeys} (event key) hoặc {@code legacyTypes} (type cũ
     * của thông báo chưa có event key).
     */
    @Query(value = """
            select n from Notification n
            where n.userId = :userId
              and (:unreadOnly = false or n.isRead = false)
              and (cast(:eventKey as string) is null or n.eventKey = :eventKey)
              and (:filterByCategory = false or n.eventKey in :categoryKeys
                   or n.type in :legacyTypes)
              and (cast(:q as string) is null
                   or lower(n.title) like lower(concat('%', cast(:q as string), '%'))
                   or lower(n.content) like lower(concat('%', cast(:q as string), '%')))
            """,
            countQuery = """
            select count(n) from Notification n
            where n.userId = :userId
              and (:unreadOnly = false or n.isRead = false)
              and (cast(:eventKey as string) is null or n.eventKey = :eventKey)
              and (:filterByCategory = false or n.eventKey in :categoryKeys
                   or n.type in :legacyTypes)
              and (cast(:q as string) is null
                   or lower(n.title) like lower(concat('%', cast(:q as string), '%'))
                   or lower(n.content) like lower(concat('%', cast(:q as string), '%')))
            """)
    Page<Notification> search(@Param("userId") UUID userId,
                              @Param("unreadOnly") boolean unreadOnly,
                              @Param("eventKey") String eventKey,
                              @Param("filterByCategory") boolean filterByCategory,
                              @Param("categoryKeys") List<String> categoryKeys,
                              @Param("legacyTypes") List<String> legacyTypes,
                              @Param("q") String q,
                              Pageable pageable);

    /** Đếm chưa đọc toàn bộ hộp thư (không phụ thuộc bộ lọc đang chọn). */
    @Query("select count(n) from Notification n where n.userId = :userId and n.isRead = false")
    long countUnread(@Param("userId") UUID userId);

    /** Đánh dấu đã đọc bằng 1 câu UPDATE — không nạp cả hộp thư vào bộ nhớ. */
    @Modifying
    @Query("update Notification n set n.isRead = true where n.userId = :userId and n.isRead = false")
    int markAllRead(@Param("userId") UUID userId);

    /** Dọn thông báo đã đọc quá hạn lưu trữ. */
    @Modifying
    @Query("delete from Notification n where n.isRead = true and n.createdAt < :cutoff")
    int deleteReadOlderThan(@Param("cutoff") LocalDateTime cutoff);

    /** Số thông báo có event key trong cửa sổ dedupe — hỗ trợ kiểm tra trùng theo sự kiện. */
    long countByUserIdAndEventKeyAndCreatedAtAfter(UUID userId, String eventKey, LocalDateTime since);
}
