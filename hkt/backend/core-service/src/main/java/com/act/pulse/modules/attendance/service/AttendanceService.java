package com.act.pulse.modules.attendance.service;

import com.act.pulse.modules.attendance.dto.request.CheckInRequest;
import com.act.pulse.modules.attendance.dto.response.CheckInResponse;
import java.util.Map;
import java.util.UUID;

public interface AttendanceService {
    CheckInResponse checkIn(UUID userId, CheckInRequest request);
    CheckInResponse checkOut(UUID userId, CheckInRequest request);
    Map<String, Object> getTodayStatus(UUID userId);
}
