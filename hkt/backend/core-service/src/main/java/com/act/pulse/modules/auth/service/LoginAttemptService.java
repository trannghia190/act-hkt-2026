package com.act.pulse.modules.auth.service;

import com.act.pulse.modules.auth.entity.LoginAttempt;
import java.time.LocalDateTime;

public interface LoginAttemptService {
    LoginAttempt getOrCreate(String identifier);
    void registerFailure(String identifier, LocalDateTime now);
    void reset(String identifier);
}
