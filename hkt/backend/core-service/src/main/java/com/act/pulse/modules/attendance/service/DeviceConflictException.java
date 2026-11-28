package com.act.pulse.modules.attendance.service;

/**
 * Thiết bị đã thuộc tài khoản khác. Tách riêng khỏi ResponseStatusException vì
 * handler chung đang bọc mọi ResponseStatusException thành 400 kèm tiền tố
 * "409 CONFLICT" trong message — client chỉ cần câu thông báo sạch.
 */
public class DeviceConflictException extends RuntimeException {
    public DeviceConflictException(String message) {
        super(message);
    }
}
