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
    public ApiResponse<CheckInResponse> checkIn(@Valid @RequestBody CheckInRequest request) {
        return ApiResponse.ok(attendanceService.checkIn(CurrentUser.userId(), request), "Chấm công thành công");
    }

    /** Chấm công RA — cùng bộ kiểm tra với chấm công vào. */
    @PostMapping("/check-out")
    @Operation(summary = "Chấm công ra ca — cùng bộ 5 lớp xác thực")
    public ApiResponse<CheckInResponse> checkOut(@Valid @RequestBody CheckInRequest request) {
        return ApiResponse.ok(attendanceService.checkOut(CurrentUser.userId(), request), "Chấm công ra ca thành công");
    }
}
