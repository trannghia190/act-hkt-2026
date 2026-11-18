package com.act.pulse.modules.attendance.controller;

import com.act.pulse.common.response.ApiResponse;
import com.act.pulse.modules.attendance.dto.request.CheckInRequest;
import com.act.pulse.modules.attendance.dto.response.CheckInResponse;
import com.act.pulse.modules.attendance.service.AttendanceService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/attendance")
@RequiredArgsConstructor
@Tag(name = "2. Attendance API", description = "Chấm công di động 1 chạm, nhận diện khuôn mặt và lịch công")
public class AttendanceController {

    private final AttendanceService attendanceService;

    @PostMapping("/check-in")
    @Operation(summary = "Chấm công vào ca với xác thực khuôn mặt & WiFi/Geofence")
    public ApiResponse<CheckInResponse> checkIn(@Valid @RequestBody CheckInRequest request) {
        // Mocking user id for scaffolding template
        UUID userId = UUID.randomUUID();
        return ApiResponse.ok(attendanceService.checkIn(userId, request), "Chấm công thành công");
    }

    @PostMapping("/check-out")
    @Operation(summary = "Chấm công ra ca")
    public ApiResponse<CheckInResponse> checkOut(@Valid @RequestBody CheckInRequest request) {
        UUID userId = UUID.randomUUID();
        return ApiResponse.ok(attendanceService.checkOut(userId, request), "Chấm công ra ca thành công");
    }
}
