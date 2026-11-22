package com.act.pulse.modules.auth.dto.request;

import lombok.Data;

/** Nhân viên tự cập nhật hồ sơ: chỉ tên hiển thị, số điện thoại và avatar. */
@Data
public class UpdateProfileRequest {
    private String fullName;
    private String phone;
    /** Data URL ảnh (data:image/...;base64,...); null/rỗng = xoá avatar. */
    private String avatarUrl;
}
