package com.act.pulse.config;

import com.act.pulse.common.security.JwtAuthenticationFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

/**
 * Cấu hình bảo mật — **không dùng Keycloak / OAuth2** (quyết định 19/11/2026).
 * <p>Xác thực bằng JWT tự phát hành (HS512) qua {@link JwtAuthenticationFilter}.
 * Phiên làm mới lưu trong DB để thu hồi được.</p>
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;

    /**
     * Endpoint công khai thực sự — không yêu cầu token đăng nhập.
     * Chỉ bao gồm: Đăng nhập, Làm mới token, Quên/Đặt lại mật khẩu, Tra cứu nội quy công khai, OpenAPI docs, và Health check.
     */
    private static final String[] PUBLIC_ENDPOINTS = {
            "/auth/login",
            "/auth/refresh",
            "/auth/forgot-password",
            "/auth/reset-password",
            "/auth/reset-password-request",
            "/rules/public-faq",
            "/swagger-ui/**",
            "/swagger-ui.html",
            "/v3/api-docs/**",
            "/actuator/health",
            "/error"
    };

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(PUBLIC_ENDPOINTS).permitAll()
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()

                // Phân quyền chuyên biệt (RBAC):
                // 1. Cho phép nhân viên đã đăng nhập xem danh mục ca làm việc và lịch nghỉ lễ
                .requestMatchers(HttpMethod.GET, "/admin/shifts", "/admin/holidays").authenticated()

                // 2. Toàn bộ quản trị hệ thống, nhân sự, audit log, phân nhóm... chỉ dành cho ADMIN và HR_ADMIN
                .requestMatchers("/admin/**").hasAnyRole("ADMIN", "HR_ADMIN")

                // 2. Cấu hình bảo mật email / SMTP server chỉ dành riêng cho Quản trị viên
                .requestMatchers("/auth/config-smtp", "/auth/smtp-status", "/auth/test-email").hasAnyRole("ADMIN", "HR_ADMIN")

                // 3. Kích hoạt tác vụ cron ngầm định kỳ
                .requestMatchers("/cron/**").hasAnyRole("ADMIN", "HR_ADMIN")

                // 4. Mọi API nghiệp vụ khác bắt buộc phải đăng nhập có JWT hợp lệ
                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        // Localhost mọi cổng + các domain tunnel dùng để demo công khai.
        // Auth dùng Bearer/X-Auth-Token (không cookie) nên CORS không phải lớp bảo vệ chính.
        configuration.setAllowedOriginPatterns(List.of(
                "http://localhost:*", "http://127.0.0.1:*",
                "https://*.ngrok-free.app", "https://*.ngrok-free.dev",
                "https://*.ngrok.app", "https://*.ngrok.io",
                "https://*.trycloudflare.com", "https://*.loca.lt", "https://*.ts.net"
        ));
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(Arrays.asList("Authorization", "X-Auth-Token", "Content-Type", "X-Device-Fingerprint"));
        configuration.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}
