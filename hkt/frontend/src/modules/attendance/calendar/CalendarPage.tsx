import React, { useState } from 'react';
import { Card } from '../../../components/common/Card';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';

interface DayAttendance {
  day: number;
  weekday: string;
  isWeekend: boolean;
  checkIn?: string;
  checkOut?: string;
  status: 'ON_TIME' | 'LATE' | 'LEAVE' | 'WFH' | 'ABSENT' | 'WEEKEND' | 'FUTURE';
  statusText: string;
  hoursWorked?: number;
}

export const CalendarPage: React.FC = () => {
  const [selectedMonth] = useState('Tháng 11 / 2026');
  const [selectedDay, setSelectedDay] = useState<DayAttendance | null>(null);

  // Mock days for November 2026 (30 days)
  const days: DayAttendance[] = [
    { day: 1, weekday: 'CN', isWeekend: true, status: 'WEEKEND', statusText: 'Nghỉ cuối tuần' },
    { day: 2, weekday: 'T2', isWeekend: false, checkIn: '08:24', checkOut: '17:35', status: 'ON_TIME', statusText: 'Đúng giờ', hoursWorked: 8.0 },
    { day: 3, weekday: 'T3', isWeekend: false, checkIn: '08:28', checkOut: '17:40', status: 'ON_TIME', statusText: 'Đúng giờ', hoursWorked: 8.0 },
    { day: 4, weekday: 'T4', isWeekend: false, checkIn: '08:42', checkOut: '17:30', status: 'ON_TIME', statusText: 'Dung sai Grace (12p)', hoursWorked: 8.0 },
    { day: 5, weekday: 'T5', isWeekend: false, checkIn: '08:52', checkOut: '18:00', status: 'LATE', statusText: 'Đi muộn 22p (Dùng Quota 1/3)', hoursWorked: 8.0 },
    { day: 6, weekday: 'T6', isWeekend: false, checkIn: '08:15', checkOut: '17:30', status: 'ON_TIME', statusText: 'Đúng giờ', hoursWorked: 8.0 },
    { day: 7, weekday: 'T7', isWeekend: true, status: 'WEEKEND', statusText: 'Nghỉ cuối tuần' },
    { day: 8, weekday: 'CN', isWeekend: true, status: 'WEEKEND', statusText: 'Nghỉ cuối tuần' },
    { day: 9, weekday: 'T2', isWeekend: false, checkIn: '08:20', checkOut: '17:35', status: 'ON_TIME', statusText: 'Đúng giờ', hoursWorked: 8.0 },
    { day: 10, weekday: 'T3', isWeekend: false, checkIn: '08:29', checkOut: '17:45', status: 'ON_TIME', statusText: 'Đúng giờ', hoursWorked: 8.0 },
    { day: 11, weekday: 'T4', isWeekend: false, status: 'WFH', statusText: 'Làm việc từ xa (WFH)', hoursWorked: 8.0 },
    { day: 12, weekday: 'T5', isWeekend: false, checkIn: '08:18', checkOut: '17:32', status: 'ON_TIME', statusText: 'Đúng giờ', hoursWorked: 8.0 },
    { day: 13, weekday: 'T6', isWeekend: false, status: 'LEAVE', statusText: 'Nghỉ phép năm (1.0 ngày)', hoursWorked: 0 },
    { day: 14, weekday: 'T7', isWeekend: true, status: 'WEEKEND', statusText: 'Nghỉ cuối tuần' },
    { day: 15, weekday: 'CN', isWeekend: true, status: 'WEEKEND', statusText: 'Nghỉ cuối tuần' },
    { day: 16, weekday: 'T2', isWeekend: false, checkIn: '08:25', checkOut: '17:30', status: 'ON_TIME', statusText: 'Đúng giờ', hoursWorked: 8.0 },
    { day: 17, weekday: 'T3', isWeekend: false, checkIn: '08:30', checkOut: '17:35', status: 'ON_TIME', statusText: 'Đúng giờ', hoursWorked: 8.0 },
    { day: 18, weekday: 'T4', isWeekend: false, checkIn: '08:22', checkOut: '17:30', status: 'ON_TIME', statusText: 'Hôm nay (Đúng giờ)', hoursWorked: 8.0 },
    { day: 19, weekday: 'T5', isWeekend: false, status: 'FUTURE', statusText: 'Kế hoạch' },
    { day: 20, weekday: 'T6', isWeekend: false, status: 'FUTURE', statusText: 'Kế hoạch' },
    { day: 21, weekday: 'T7', isWeekend: true, status: 'WEEKEND', statusText: 'Nghỉ cuối tuần' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-ink">Lịch Chấm Công Tháng Cá Nhân</h1>
          </div>
          <p className="text-xs text-ink-muted mt-1">
            Theo dõi chi tiết nhật ký ra vào, số giờ công tích lũy, các lần dùng quota đi muộn và ngày phép
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">◀ Tháng trước</Button>
          <span className="text-xs font-bold px-3 py-1 bg-surface border border-line rounded-lg text-ink">
            {selectedMonth}
          </span>
          <Button variant="outline" size="sm">Tháng sau ▶</Button>
        </div>
      </div>

      {/* Monthly Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="p-3 bg-surface rounded-xl border border-line">
          <div className="text-[11px] text-ink-muted">Công Chuẩn Tháng</div>
          <div className="text-xl font-bold text-ink mt-0.5">22 ngày</div>
          <div className="text-[10px] text-ink-secondary">176 giờ làm việc</div>
        </div>
        <div className="p-3 bg-surface rounded-xl border border-line">
          <div className="text-[11px] text-ink-muted">Công Đã Tích Lũy</div>
          <div className="text-xl font-bold text-emerald-700 mt-0.5">12.0 ngày</div>
          <div className="text-[10px] text-emerald-600">96.0 giờ hợp lệ</div>
        </div>
        <div className="p-3 bg-surface rounded-xl border border-line">
          <div className="text-[11px] text-ink-muted">Đi Muộn Có Phép</div>
          <div className="text-xl font-bold text-amber-700 mt-0.5">1 lần</div>
          <div className="text-[10px] text-amber-600">Còn 2/3 lần quota miễn phạt</div>
        </div>
        <div className="p-3 bg-surface rounded-xl border border-line">
          <div className="text-[11px] text-ink-muted">Nghỉ Phép Năm</div>
          <div className="text-xl font-bold text-accent mt-0.5">1.0 ngày</div>
          <div className="text-[10px] text-accent-dark">Đã duyệt hợp lệ</div>
        </div>
        <div className="p-3 bg-surface rounded-xl border border-line col-span-2 md:col-span-1">
          <div className="text-[11px] text-ink-muted">Làm Từ Xa (WFH)</div>
          <div className="text-xl font-bold text-blue-700 mt-0.5">1 ngày</div>
          <div className="text-[10px] text-blue-600">Còn 2/3 ngày WFH</div>
        </div>
      </div>

      {/* Calendar Grid */}
      <Card title="Bảng Lịch Chấm Công">
        <div className="grid grid-cols-7 gap-2 text-center text-xs">
          {/* Day Headers */}
          {['CN', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'].map(d => (
            <div key={d} className="py-1 font-semibold text-ink-secondary text-[11px] border-b border-line pb-2">
              {d}
            </div>
          ))}

          {/* Days */}
          {days.map(d => (
            <div
              key={d.day}
              onClick={() => setSelectedDay(d)}
              className={`min-h-[75px] p-2 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between ${
                d.status === 'WEEKEND'
                  ? 'bg-canvas/30 border-line/50 text-ink-muted'
                  : d.status === 'ON_TIME'
                  ? 'bg-emerald-50/30 border-emerald-200 hover:border-emerald-400'
                  : d.status === 'LATE'
                  ? 'bg-amber-50/40 border-amber-300 hover:border-amber-500'
                  : d.status === 'LEAVE'
                  ? 'bg-blue-50/40 border-blue-200 hover:border-blue-400'
                  : d.status === 'WFH'
                  ? 'bg-purple-50/40 border-purple-200 hover:border-purple-400'
                  : 'bg-surface border-line hover:border-accent'
              }`}
            >
              <div className="flex justify-between items-start">
                <span className="font-bold text-xs text-ink">{d.day}</span>
                {d.status === 'ON_TIME' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                {d.status === 'LATE' && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
                {d.status === 'LEAVE' && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                {d.status === 'WFH' && <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />}
              </div>

              {d.checkIn && (
                <div className="font-mono text-[10px] text-ink-secondary mt-1">
                  <div>Vào: {d.checkIn}</div>
                  <div>Ra: {d.checkOut || '--:--'}</div>
                </div>
              )}

              <div className="text-[10px] font-medium truncate text-ink-muted mt-1">
                {d.statusText}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Selected Day Modal Details */}
      {selectedDay && (
        <Card
          title={`Chi tiết ngày ${selectedDay.day}/11/2026 (${selectedDay.weekday})`}
          action={
            <Button variant="ghost" size="sm" onClick={() => setSelectedDay(null)}>
              Đóng
            </Button>
          }
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-ink-muted">Trạng thái:</span>
              <div className="font-semibold text-ink mt-0.5">{selectedDay.statusText}</div>
            </div>
            <div>
              <span className="text-ink-muted">Giờ Check-In:</span>
              <div className="font-mono font-semibold text-ink mt-0.5">{selectedDay.checkIn || 'Không có'}</div>
            </div>
            <div>
              <span className="text-ink-muted">Giờ Check-Out:</span>
              <div className="font-mono font-semibold text-ink mt-0.5">{selectedDay.checkOut || 'Không có'}</div>
            </div>
            <div>
              <span className="text-ink-muted">Số giờ tính công:</span>
              <div className="font-semibold text-emerald-700 mt-0.5">{selectedDay.hoursWorked ? `${selectedDay.hoursWorked} giờ` : '0 giờ'}</div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
