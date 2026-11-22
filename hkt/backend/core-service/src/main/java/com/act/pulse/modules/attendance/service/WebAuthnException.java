package com.act.pulse.modules.attendance.service;

/** Lỗi xác thực WebAuthn — message an toàn để hiển thị cho nhân viên. */
public class WebAuthnException extends RuntimeException {
    public WebAuthnException(String message) {
        super(message);
    }

    public WebAuthnException(String message, Throwable cause) {
        super(message, cause);
    }
}
