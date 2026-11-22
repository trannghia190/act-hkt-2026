package com.act.pulse.modules.auth.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProfileResponse {
    private String employeeCode;
    private String fullName;
    private String email;
    private String phone;
    private String avatarUrl;
    private String role;
    private String teamName;
    private String departmentName;
    private String positionName;
    private String managerCode;
    private String managerName;
    private String hireDate;
    private String status;
    private Boolean faceEnrolled;
    private Boolean mustChangePassword;
    private Boolean hasPasskey;
}
