package com.act.pulse.common.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Phát hành & xác thực JWT (HS512).
 * <p>Business yêu cầu (docs/01 §3.2): access token 15 phút, refresh token 7 ngày,
 * phiên làm mới phải THU HỒI ĐƯỢC (khi đổi mật khẩu / đăng xuất).</p>
 */
@Component
public class JwtService {

    private final SecretKey signingKey;
    private final Duration accessTtl;
    private final Duration refreshTtl;

    public JwtService(
            @Value("${app.jwt.secret}") String secret,
            @Value("${app.jwt.expiration-ms:900000}") long accessExpirationMs,
            @Value("${app.jwt.refresh-expiration-ms:604800000}") long refreshExpirationMs) {
        byte[] keyBytes = secret.getBytes(StandardCharsets.UTF_8);
        if (keyBytes.length < 64) {
            throw new IllegalStateException(
                    "app.jwt.secret phải dài tối thiểu 64 byte cho thuật toán HS512");
        }
        this.signingKey = Keys.hmacShaKeyFor(keyBytes);
        this.accessTtl = Duration.ofMillis(accessExpirationMs);
        this.refreshTtl = Duration.ofMillis(refreshExpirationMs);
    }

    public Duration getAccessTtl() {
        return accessTtl;
    }

    public Duration getRefreshTtl() {
        return refreshTtl;
    }

    /** Access token: chứa userId, employeeCode, role + scope hạn chế (nếu đang bắt buộc đổi mật khẩu). */
    public String issueAccessToken(UUID userId, String employeeCode, String role, boolean forceChangePassword) {
        Instant now = Instant.now();
        Map<String, Object> claims = new HashMap<>();
        claims.put("uid", userId.toString());
        claims.put("ec", employeeCode);
        claims.put("role", role);
        if (forceChangePassword) {
            claims.put("scope", "FORCE_CHANGE_PASSWORD");
        }
        return Jwts.builder()
                .claims(claims)
                .subject(userId.toString())
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(accessTtl)))
                .signWith(signingKey, Jwts.SIG.HS512)
                .compact();
    }

    /** Refresh token: chỉ chứa jti để thu hồi được từng phiên. */
    public String issueRefreshToken(UUID userId) {
        return Jwts.builder()
                .subject(userId.toString())
                .id(UUID.randomUUID().toString())
                .issuedAt(new Date())
                .expiration(Date.from(Instant.now().plus(refreshTtl)))
                .signWith(signingKey, Jwts.SIG.HS512)
                .compact();
    }

    /** @return claims nếu token hợp lệ, null nếu sai/hết hạn. */
    public Claims parse(String token) {
        try {
            return Jwts.parser()
                    .verifyWith(signingKey)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
        } catch (JwtException | IllegalArgumentException ex) {
            return null;
        }
    }

    public UUID getUserId(Claims claims) {
        String uid = claims.get("uid", String.class);
        if (uid == null) {
            uid = claims.getSubject();
        }
        return uid == null ? null : UUID.fromString(uid);
    }

    public String getEmployeeCode(Claims claims) {
        return claims.get("ec", String.class);
    }

    public String getRole(Claims claims) {
        return claims.get("role", String.class);
    }

    public boolean isForceChangePassword(Claims claims) {
        return "FORCE_CHANGE_PASSWORD".equals(claims.get("scope", String.class));
    }

    /** Mã băm của refresh token — chỉ lưu mã băm trong DB, không lưu bản thô. */
    public String hashToken(String token) {
        return Hashing.sha256(token);
    }
}
