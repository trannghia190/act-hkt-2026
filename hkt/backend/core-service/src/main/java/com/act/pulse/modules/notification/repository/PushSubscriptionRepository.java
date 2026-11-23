package com.act.pulse.modules.notification.repository;

import com.act.pulse.modules.notification.entity.PushSubscription;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PushSubscriptionRepository extends JpaRepository<PushSubscription, UUID> {

    List<PushSubscription> findByUserId(UUID userId);

    Optional<PushSubscription> findByEndpoint(String endpoint);

    /** Gọi từ controller không có transaction → tự mở transaction cho câu delete phái sinh. */
    @Transactional
    long deleteByUserIdAndEndpoint(UUID userId, String endpoint);
}
