package com.act.pulse.modules.attendance.service;

import com.act.pulse.modules.auth.entity.User;

/** Nhãn ngắn gọn để nói rõ một thiết bị đang thuộc tài khoản nào. */
public final class DeviceOwnerLabels {

    private DeviceOwnerLabels() {}

    /** "Nguyễn Văn A (136ACT)" — chịu được user đã bị xoá hoặc thiếu tên/mã. */
    public static String of(User user) {
        if (user == null) return "một tài khoản khác";
        String name = user.getFullName();
        if (name == null || name.isBlank()) name = user.getEmployeeCode();
        if (name == null || name.isBlank()) return "một tài khoản khác";
        String code = user.getEmployeeCode();
        return (code == null || code.isBlank()) ? name : name + " (" + code + ")";
    }
}
