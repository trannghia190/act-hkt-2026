package com.act.pulse.modules.notification.repository;

import com.act.pulse.modules.notification.entity.NotificationDelivery;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public interface NotificationDeliveryRepository extends JpaRepository<NotificationDelivery, UUID> {

    /** Số lần gửi kênh PUSH của user trong khoảng thời gian (dùng cho giới hạn/ngày). */
    long countByUserIdAndChannelAndDeliveredAtAfter(UUID userId, String channel, LocalDateTime since);

    /** Số lần gửi event key trong cửa sổ dedupe. */
    long countByUserIdAndEventKeyAndDedupeKeyAndDeliveredAtAfter(
            UUID userId, String eventKey, String dedupeKey, LocalDateTime since);

    /** Các mục bị dồn (push bị chặn) để gửi trong digest 08:00. */
    List<NotificationDelivery> findByUserIdAndChannelAndDeliveredAtBetweenOrderByDeliveredAtAsc(
            UUID userId, String channel, LocalDateTime from, LocalDateTime to);

    @Query("select d from NotificationDelivery d where d.userId = :userId and d.channel = :channel "
            + "and d.consumedAt is null order by d.deliveredAt asc")
    List<NotificationDelivery> findDeferred(@Param("userId") UUID userId, @Param("channel") String channel);
}
