package com.act.pulse.config;

import com.act.pulse.common.response.ApiResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * Unified JSON exception handler to return clean ApiResponse structure,
 * log detailed internal errors on the server, and prevent database schema / SQL details
 * from leaking to clients.
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(org.springframework.web.bind.MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Object>> handleValidationExceptions(
            org.springframework.web.bind.MethodArgumentNotValidException ex) {
        String errorMsg = ex.getBindingResult().getFieldErrors().stream()
                .map(org.springframework.validation.FieldError::getDefaultMessage)
                .filter(java.util.Objects::nonNull)
                .findFirst()
                .orElse("Dữ liệu gửi lên không hợp lệ");
        log.warn("Validation error: {}", errorMsg);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ApiResponse.error(errorMsg));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiResponse<Object>> handleIllegalArgument(IllegalArgumentException ex) {
        log.warn("Invalid client request argument: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.error(ex.getMessage() == null ? "Yêu cầu không hợp lệ" : ex.getMessage()));
    }

    @ExceptionHandler(org.springframework.dao.DataAccessException.class)
    public ResponseEntity<ApiResponse<Object>> handleDatabaseException(org.springframework.dao.DataAccessException ex) {
        log.error("Internal database exception caught: {}", ex.getMessage(), ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("Lỗi cơ sở dữ liệu nội bộ. Vui lòng thử lại sau."));
    }

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<ApiResponse<Object>> handleRuntime(RuntimeException ex) {
        log.error("Unhandled runtime exception caught: {}", ex.getMessage(), ex);
        String msg = ex.getMessage();
        if (msg == null || msg.contains("SQL") || msg.contains("database") || msg.contains("org.hibernate") || msg.contains("psql") || msg.contains("Exception")) {
            msg = "Yêu cầu không thể xử lý. Vui lòng thử lại.";
        }
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.error(msg));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Object>> handleGenericException(Exception ex) {
        log.error("Internal server error caught: {}", ex.getMessage(), ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("Lỗi máy chủ nội bộ. Vui lòng liên hệ quản trị viên hệ thống."));
    }
}
