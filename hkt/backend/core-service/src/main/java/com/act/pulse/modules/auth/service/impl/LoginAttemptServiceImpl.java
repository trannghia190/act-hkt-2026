package com.act.pulse.modules.auth.service.impl;

import com.act.pulse.modules.auth.entity.LoginAttempt;
import com.act.pulse.modules.auth.repository.LoginAttemptRepository;
import com.act.pulse.modules.auth.service.LoginAttemptService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Slf4j
@Service
@RequiredArgsConstructor
public class LoginAttemptServiceImpl implements LoginAttemptService {

    private static final int MAX_FAILED_ATTEMPTS = 5;
    private static final int MAX_FAILED_ATTEMPTS_PERMANENT = 10;
    private static final int LOCK_MINUTES = 10;

    private final LoginAttemptRepository loginAttemptRepository;

    @Override
    @Transactional(readOnly = true)
    public LoginAttempt getOrCreate(String identifier) {
        return loginAttemptRepository.findByIdentifier(identifier.toLowerCase())
                .orElseGet(() -> LoginAttempt.builder()
                        .identifier(identifier.toLowerCase())
                        .failedCount(0)
                        .permanentlyLocked(false)
                        .build());
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void registerFailure(String identifier, LocalDateTime now) {
        LoginAttempt attempt = loginAttemptRepository.findByIdentifier(identifier.toLowerCase())
                .orElseGet(() -> LoginAttempt.builder()
                        .identifier(identifier.toLowerCase())
                        .failedCount(0)
                        .permanentlyLocked(false)
                        .build());

        int failed = (attempt.getFailedCount() == null ? 0 : attempt.getFailedCount()) + 1;
        attempt.setFailedCount(failed);
        attempt.setLastFailedAt(now);
        if (failed >= MAX_FAILED_ATTEMPTS_PERMANENT) {
            attempt.setPermanentlyLocked(true);
            attempt.setLockedUntil(null);
            log.warn("Tài khoản {} đã bị khoá vĩnh viễn (sai {} lần)", identifier, failed);
        } else if (failed >= MAX_FAILED_ATTEMPTS) {
            attempt.setLockedUntil(now.plusMinutes(LOCK_MINUTES));
            log.warn("Tài khoản {} đã bị khoá tạm 10 phút (sai {} lần)", identifier, failed);
        }
        loginAttemptRepository.saveAndFlush(attempt);
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void reset(String identifier) {
        loginAttemptRepository.findByIdentifier(identifier.toLowerCase()).ifPresent(attempt -> {
            attempt.setFailedCount(0);
            attempt.setLockedUntil(null);
            attempt.setLastFailedAt(null);
            loginAttemptRepository.saveAndFlush(attempt);
        });
    }
}
