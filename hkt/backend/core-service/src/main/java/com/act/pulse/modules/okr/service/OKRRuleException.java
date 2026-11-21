package com.act.pulse.modules.okr.service;

import org.springframework.http.HttpStatus;

/** Vi phạm rule nghiệp vụ OKR — mang theo HTTP status để UI phân biệt 400/403/404/409. */
public class OKRRuleException extends RuntimeException {

    private final HttpStatus status;

    public OKRRuleException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public static OKRRuleException badRequest(String message) {
        return new OKRRuleException(HttpStatus.BAD_REQUEST, message);
    }

    public static OKRRuleException forbidden(String message) {
        return new OKRRuleException(HttpStatus.FORBIDDEN, message);
    }

    public static OKRRuleException notFound(String message) {
        return new OKRRuleException(HttpStatus.NOT_FOUND, message);
    }

    public static OKRRuleException conflict(String message) {
        return new OKRRuleException(HttpStatus.CONFLICT, message);
    }
}
