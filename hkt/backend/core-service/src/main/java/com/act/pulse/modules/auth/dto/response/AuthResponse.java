package com.act.pulse.modules.auth.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuthResponse {
    private String accessToken;
    private String refreshToken;
    private String employeeCode;
    private String fullName;
    private String role;
    private String avatarUrl;
    private Boolean mustChangePassword;
    private Boolean faceEnrolled;
}
