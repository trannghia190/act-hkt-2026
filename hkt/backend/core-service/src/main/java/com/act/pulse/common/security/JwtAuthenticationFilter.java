package com.act.pulse.common.security;

import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.UUID;

/**
 * Lọc xác thực Bearer token cho mọi endpoint (trừ endpoint public).
 * <p>Business (docs/01 §3.2): token phải là JWT thật, verify được, và URL ngoài phạm vi
 * quyền phải trả 403 — không phải 404.</p>
 */
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain filterChain) throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")
                && SecurityContextHolder.getContext().getAuthentication() == null) {
            Claims claims = jwtService.parse(header.substring(7));
            if (claims != null) {
                UUID userId = jwtService.getUserId(claims);
                String employeeCode = jwtService.getEmployeeCode(claims);
                String role = jwtService.getRole(claims);
                if (userId != null) {
                    var principal = new AuthPrincipal(userId, employeeCode, role);
                    var authorities = List.of(new SimpleGrantedAuthority("ROLE_" + (role == null ? "EMPLOYEE" : role)));
                    var authentication = new UsernamePasswordAuthenticationToken(principal, null, authorities);
                    authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(authentication);
                }
            }
        }
        filterChain.doFilter(request, response);
    }

    /** Thông tin người dùng đang đăng nhập, lấy từ token. */
    public record AuthPrincipal(UUID userId, String employeeCode, String role) {
    }
}
