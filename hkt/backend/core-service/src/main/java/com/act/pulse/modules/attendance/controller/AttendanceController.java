package com.act.pulse.modules.attendance.controller;

import com.act.pulse.common.response.ApiResponse;
import com.act.pulse.common.security.CurrentUser;
import com.act.pulse.modules.attendance.dto.request.CheckInRequest;
import com.act.pulse.modules.attendance.dto.response.CheckInResponse;
import com.act.pulse.modules.attendance.service.AttendanceService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/attendance")
@RequiredArgsConstructor
@Tag(name = "2. Attendance API", description = "Chấm công 1 chạm — 5 lớp xác thực song song (thiết bị · mạng · GPS · ca · khuôn mặt)")
public class AttendanceController {

    private final AttendanceService attendanceService;

    /**
     * Chấm công VÀO — 5 lớp xác thực chạy song song, không đạt lớp nào là CHẶN.
     * Người dùng lấy từ token đang đăng nhập (không nhận userId từ client).
     */
    @PostMapping("/check-in")
    @Operation(summary = "Chấm công vào ca — xác thực khuôn mặt + WiFi/Geofence/thiết bị/ca")
    public ApiResponse<CheckInResponse> checkIn(@Valid @RequestBody CheckInRequest request,
                                                jakarta.servlet.http.HttpServletRequest httpRequest) {
        resolveClientIp(request, httpRequest);
        return ApiResponse.ok(attendanceService.checkIn(CurrentUser.userId(), request), "Chấm công thành công");
    }

    /** Chấm công RA — cùng bộ kiểm tra với chấm công vào. */
    @PostMapping("/check-out")
    @Operation(summary = "Chấm công ra ca — cùng bộ 5 lớp xác thực")
    public ApiResponse<CheckInResponse> checkOut(@Valid @RequestBody CheckInRequest request,
                                                 jakarta.servlet.http.HttpServletRequest httpRequest) {
        resolveClientIp(request, httpRequest);
        return ApiResponse.ok(attendanceService.checkOut(CurrentUser.userId(), request), "Chấm công ra ca thành công");
    }

    /**
     * IP dùng cho lớp "mạng nội bộ" LUÔN lấy từ kết nối thực tế, KHÔNG tin
     * ipAddress do client gửi trong body (client có thể tự đặt 10.0.x để lọt lớp mạng).
     * Chỉ đọc X-Forwarded-For khi request đến từ proxy nội bộ; còn lại dùng remoteAddr.
     */
    private void resolveClientIp(CheckInRequest request, jakarta.servlet.http.HttpServletRequest httpRequest) {
        if (httpRequest == null) {
            request.setIpAddress(null);
            return;
        }
        String remote = httpRequest.getRemoteAddr();
        String ip = remote;
        if (isTrustedProxy(remote)) {
            String xff = httpRequest.getHeader("X-Forwarded-For");
            if (xff != null && !xff.isBlank()) {
                ip = xff.split(",")[0].trim();
            }
        }
        request.setIpAddress(ip);
    }

    private boolean isTrustedProxy(String ip) {
        if (ip == null) return false;
        return ip.equals("127.0.0.1") || ip.equals("::1") || ip.equals("0:0:0:0:0:0:0:1")
                || ip.startsWith("10.") || ip.startsWith("192.168.")
                || ip.matches("172\\.(1[6-9]|2[0-9]|3[01])\\..*");
    }

    /** Trạng thái chấm công hôm nay và hôm qua — phục vụ S05m và cảnh báo thiếu check-out hôm qua (B2). */
    @GetMapping("/today-status")
    @Operation(summary = "Trạng thái chấm công hôm nay và hôm qua")
    public ApiResponse<java.util.Map<String, Object>> todayStatus() {
        return ApiResponse.ok(attendanceService.getTodayStatus(CurrentUser.userId()), "Trạng thái chấm công");
    }
}
