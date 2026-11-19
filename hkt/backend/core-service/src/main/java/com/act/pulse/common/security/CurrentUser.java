package com.act.pulse.common.security;

import com.act.pulse.common.security.JwtAuthenticationFilter.AuthPrincipal;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Optional;
import java.util.UUID;

/** Tiện ích đọc người dùng hiện tại từ SecurityContext. */
public final class CurrentUser {

    private CurrentUser() {
    }

    public static Optional<AuthPrincipal> get() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof AuthPrincipal principal)) {
            return Optional.empty();
        }
        return Optional.of(principal);
    }

    public static UUID userId() {
        return get().map(AuthPrincipal::userId).orElse(null);
    }

    public static String employeeCode() {
        return get().map(AuthPrincipal::employeeCode).orElse(null);
    }

    public static String role() {
        return get().map(AuthPrincipal::role).orElse(null);
    }

    public static boolean isHr() {
        String role = role();
        return "HR_ADMIN".equalsIgnoreCase(role) || "ADMIN".equalsIgnoreCase(role);
    }
}
