package com.act.pulse.modules.auth.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class LoginRequest {
    @NotBlank(message = "Mã nhân viên hoặc Email không được để trống")
    private String employeeCodeOrEmail;

    @NotBlank(message = "Mật khẩu không được để trống")
    private String password;
}
