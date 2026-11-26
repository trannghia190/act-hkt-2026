package com.act.pulse.modules.auth.dto.request;

import lombok.Data;

/**
 * Nhân viên tự cập nhật hồ sơ: tên hiển thị, số điện thoại, avatar và template giao diện.
 * <p>Mỗi field độc lập — null nghĩa là "không đổi" (xem
 * {@code AuthServiceImpl.updateMyProfile}), nên gửi riêng {@code theme} không
 * làm mất tên/điện thoại/avatar.</p>
 */
@Data
public class UpdateProfileRequest {
    private String fullName;
    private String phone;
    /** Data URL ảnh (data:image/...;base64,...); null/rỗng = xoá avatar. */
    private String avatarUrl;
    /** Template giao diện: ascend-clean | midnight-rail | bento-studio. */
    private String theme;
}
