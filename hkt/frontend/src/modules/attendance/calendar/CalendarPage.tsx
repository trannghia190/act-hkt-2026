import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card } from '../../../components/common/Card';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { useAuth } from '../../../context/AuthContext';

interface DayAttendance {
  day: number;
  date: string;
  weekday: string;
  isWeekend: boolean;
  isHoliday?: boolean;
  checkIn?: string | null;
  checkOut?: string | null;
  status: 'ON_TIME' | 'LATE' | 'LEAVE' | 'WFH' | 'ABSENT' | 'INCOMPLETE' | 'WEEKEND' | 'HOLIDAY' | 'FUTURE';
  statusText: string;
  hoursWorked?: number;
  lateMinutes?: number;
  symbol?: string;
  dispute?: { id: string; status: string; reason: string } | null;
}

interface MonthlySummary {
  standardDays: number;
  actualDays: number;
  wfhDays: number;
  leaveDays: number;
  lateCount: number;
  holidayDays: number;
  sickDays: number;
  compDays: number;
  unpaidDays: number;
  totalDays: number;
  remainingLeave: number;
}

export const CalendarPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthParam = searchParams.get('month') || currentMonthStr;

  const [selectedDay, setSelectedDay] = useState<DayAttendance | null>(null);
  const [days, setDays] = useState<DayAttendance[]>([]);
  const [summary, setSummary] = useState<MonthlySummary>({
    standardDays: 22,
    actualDays: 0,
    wfhDays: 0,
    leaveDays: 0,
    lateCount: 0,
    holidayDays: 0,
    sickDays: 0,
    compDays: 0,
    unpaidDays: 0,
    totalDays: 0,
    remainingLeave: 12,
  });
  const [loading, setLoading] = useState(true);

  // Parse Year and Month
  const [yearNum, monthNum] = monthParam.split('-').map(Number);
  const displayMonthTitle = `Tháng ${monthNum} / ${yearNum}`;

  const loadMonthData = () => {
    setLoading(true);
    const token = (() => {
      try {
        const u = JSON.parse(localStorage.getItem('pulse_auth_user') || '{}');
        return u?.accessToken || user?.accessToken || '';
      } catch {
        return user?.accessToken || '';
      }
    })();

    fetch(`/api/v1/attendance/my-timesheet?month=${monthParam}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json())
      .then((j) => {
        const d = j?.data;
        if (d && Array.isArray(d.days)) {
          setDays(d.days);
          setSummary({
            standardDays: d.standardDays ?? 22,
            actualDays: d.actualDays ?? 0,
            wfhDays: d.wfhDays ?? 0,
            leaveDays: d.leaveDays ?? 0,
            lateCount: d.lateCount ?? 0,
            holidayDays: d.holidayDays ?? 0,
            sickDays: d.sickDays ?? 0,
            compDays: d.compDays ?? 0,
            unpaidDays: d.unpaidDays ?? 0,
            totalDays: d.totalDays ?? 0,
            remainingLeave: d.remainingLeave ?? 12,
          });
        }
      })
      .catch((err) => console.error('Fetch calendar error:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadMonthData();
  }, [monthParam, user]);

  const changeMonth = (offset: number) => {
    const d = new Date(yearNum, monthNum - 1 + offset, 1);
    const nextMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    setSearchParams({ month: nextMonth });
    setSelectedDay(null);
  };

  // Compute offset for day 1 (Monday is index 0)
  const firstDayOfMonth = new Date(yearNum, monthNum - 1, 1);
  // getDay(): 0 is Sunday, 1 is Monday ...
  const startDayOfWeek = (firstDayOfMonth.getDay() + 6) % 7; // 0 for Mon, 6 for Sun

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-accent-soft text-accent rounded-full text-xs font-semibold border border-accent-line mb-1">
            <span>📅</span> Lịch Chấm Công Cá Nhân (S06)
          </div>
          <h1 className="text-xl font-bold tracking-tight text-ink">Lịch Công Tháng Cá Nhân</h1>
          <p className="text-xs text-ink-muted mt-1">
            Theo dõi chi tiết nhật ký ra vào, số giờ công tích lũy, các lần dùng quota đi muộn và ngày phép
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => changeMonth(-1)}>
            ◀ Tháng trước
          </Button>
          <span className="text-xs font-bold px-3 py-1.5 bg-surface border border-line rounded-lg text-ink shadow-2xs font-mono">
            {displayMonthTitle}
          </span>
          <Button variant="outline" size="sm" onClick={() => changeMonth(1)}>
            Tháng sau ▶
          </Button>
        </div>
      </div>

      {/* Monthly Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="p-3 bg-surface rounded-xl border border-line shadow-2xs">
          <div className="text-[11px] text-ink-muted">Công Chuẩn Tháng</div>
          <div className="text-xl font-bold text-ink mt-0.5">{summary.standardDays} ngày</div>
          <div className="text-[10px] text-ink-secondary">{summary.standardDays * 8} giờ quy định</div>
        </div>
        <div className="p-3 bg-surface rounded-xl border border-line shadow-2xs">
          <div className="text-[11px] text-ink-muted">Công Đã Tích Lũy</div>
          <div className="text-xl font-bold text-emerald-700 mt-0.5">{summary.actualDays} ngày</div>
          <div className="text-[10px] text-emerald-600">Đạt {(summary.actualDays * 8).toFixed(1)}h hợp lệ</div>
        </div>
        <div className="p-3 bg-surface rounded-xl border border-line shadow-2xs">
          <div className="text-[11px] text-ink-muted">Đi Muộn / Về Sớm</div>
          <div className="text-xl font-bold text-amber-700 mt-0.5">{summary.lateCount} lần</div>
          <div className="text-[10px] text-amber-600">
            {summary.lateCount > 2 ? '⚠️ Vượt quota miễn phạt' : 'Trong hạn mức cho phép'}
          </div>
        </div>
        <div className="p-3 bg-surface rounded-xl border border-line shadow-2xs">
          <div className="text-[11px] text-ink-muted">Nghỉ Phép Năm</div>
          <div className="text-xl font-bold text-accent mt-0.5">{summary.leaveDays} ngày</div>
          <div className="text-[10px] text-accent-dark">Còn {summary.remainingLeave} ngày phép</div>
        </div>
        <div className="p-3 bg-surface rounded-xl border border-line col-span-2 md:col-span-1 shadow-2xs">
          <div className="text-[11px] text-ink-muted">Làm Từ Xa (WFH)</div>
          <div className="text-xl font-bold text-blue-700 mt-0.5">{summary.wfhDays} ngày</div>
          <div className="text-[10px] text-blue-600">Đã duyệt hợp lệ</div>
        </div>
      </div>

      {/* Calendar Grid */}
      <Card title={`Lưới Lịch Tháng ${monthNum}/${yearNum}`}>
        {loading ? (
          <div className="py-12 text-center text-xs text-ink-muted">Đang tải dữ liệu lịch công...</div>
        ) : (
          <div className="grid grid-cols-7 gap-2 text-center text-xs">
            {/* Day Headers (T2 to CN) */}
            {['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật'].map((d) => (
              <div key={d} className="py-1.5 font-semibold text-ink-secondary text-[11px] border-b border-line pb-2">
                {d}
              </div>
            ))}

            {/* Empty slots before first day */}
            {Array.from({ length: startDayOfWeek }).map((_, idx) => (
              <div key={`empty-${idx}`} className="min-h-[75px] rounded-xl bg-canvas-subtle/30 border border-transparent" />
            ))}

            {/* Month Days */}
            {days.map((d) => (
              <div
                key={d.day}
                onClick={() => setSelectedDay(d)}
                className={`min-h-[82px] p-2 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between ${
                  selectedDay?.day === d.day ? 'ring-2 ring-accent shadow-xs' : ''
                } ${
                  d.status === 'WEEKEND'
                    ? 'bg-canvas/30 border-line/50 text-ink-muted'
                    : d.status === 'ON_TIME'
                    ? 'bg-emerald-50/40 border-emerald-200 hover:border-emerald-400'
                    : d.status === 'LATE'
                    ? 'bg-amber-50/50 border-amber-300 hover:border-amber-500'
                    : d.status === 'LEAVE'
                    ? 'bg-blue-50/50 border-blue-200 hover:border-blue-400'
                    : d.status === 'WFH'
                    ? 'bg-purple-50/50 border-purple-200 hover:border-purple-400'
                    : d.status === 'INCOMPLETE'
                    ? 'bg-rose-50/60 border-rose-300 hover:border-rose-500'
                    : d.status === 'ABSENT'
                    ? 'bg-rose-50/30 border-rose-200 hover:border-rose-400'
                    : d.status === 'HOLIDAY'
                    ? 'bg-teal-50/50 border-teal-200 hover:border-teal-400'
                    : 'bg-surface border-line hover:border-accent'
                }`}
              >
                <div className="flex justify-between items-start">
                  <span className="font-bold text-xs text-ink">{d.day}</span>
                  {d.status === 'ON_TIME' && <span className="w-2 h-2 rounded-full bg-emerald-500" title="Đúng giờ" />}
                  {d.status === 'LATE' && <span className="w-2 h-2 rounded-full bg-amber-500" title="Đi muộn" />}
                  {d.status === 'LEAVE' && <span className="w-2 h-2 rounded-full bg-blue-500" title="Nghỉ phép" />}
                  {d.status === 'WFH' && <span className="w-2 h-2 rounded-full bg-purple-500" title="WFH" />}
                  {d.status === 'INCOMPLETE' && <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" title="Thiếu giờ" />}
                </div>

                {d.checkIn && (
                  <div className="font-mono text-[10px] text-ink-secondary mt-1 space-y-0.5">
                    <div>Vào: <strong className="text-ink">{d.checkIn}</strong></div>
                    <div>Ra: <strong className="text-ink">{d.checkOut || '--:--'}</strong></div>
                  </div>
                )}

                <div className="text-[10px] font-medium truncate text-ink-muted mt-1 flex items-center justify-between">
                  <span>{d.symbol || d.statusText}</span>
                  {d.hoursWorked ? <span className="text-emerald-700 font-mono">{d.hoursWorked}h</span> : null}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Legend */}
        <div className="mt-4 pt-3 border-t border-line flex flex-wrap items-center gap-4 text-[11px] text-ink-muted">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Đúng giờ
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Đi muộn
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500" /> Làm từ xa (WFH)
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Nghỉ phép
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Thiếu giờ / Vắng
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-zinc-400" /> Cuối tuần / Lễ
          </div>
        </div>
      </Card>

      {/* Selected Day Modal Details */}
      {selectedDay && (
        <Card
          title={`Chi tiết ngày ${selectedDay.day}/${monthNum}/${yearNum} (${selectedDay.weekday})`}
          action={
            <Button variant="ghost" size="sm" onClick={() => setSelectedDay(null)}>
              Đóng
            </Button>
          }
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div className="p-3 bg-canvas rounded-lg border border-line">
              <span className="text-ink-muted text-[11px]">Trạng thái ghi nhận:</span>
              <div className="font-semibold text-ink mt-1 flex items-center gap-1.5">
                <Badge
                  variant={
                    selectedDay.status === 'ON_TIME'
                      ? 'accent'
                      : selectedDay.status === 'LATE'
                      ? 'warn'
                      : selectedDay.status === 'INCOMPLETE' || selectedDay.status === 'ABSENT'
                      ? 'danger'
                      : 'gray'
                  }
                >
                  {selectedDay.statusText}
                </Badge>
              </div>
            </div>

            <div className="p-3 bg-canvas rounded-lg border border-line">
              <span className="text-ink-muted text-[11px]">Giờ Check-In:</span>
              <div className="font-mono font-bold text-sm text-ink mt-1">
                {selectedDay.checkIn || '—'}
              </div>
            </div>

            <div className="p-3 bg-canvas rounded-lg border border-line">
              <span className="text-ink-muted text-[11px]">Giờ Check-Out:</span>
              <div className="font-mono font-bold text-sm text-ink mt-1">
                {selectedDay.checkOut || '—'}
              </div>
            </div>

            <div className="p-3 bg-canvas rounded-lg border border-line">
              <span className="text-ink-muted text-[11px]">Số giờ làm thực tế:</span>
              <div className="font-bold text-sm text-emerald-700 mt-1">
                {selectedDay.hoursWorked ? `${selectedDay.hoursWorked} giờ` : '0 giờ'}
              </div>
            </div>
          </div>

          {selectedDay.lateMinutes ? (
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-center justify-between">
              <span>⚠️ Bạn đã check-in muộn <strong>{selectedDay.lateMinutes} phút</strong> so với ca chuẩn.</span>
              <button
                onClick={() => navigate('/attendance/requests')}
                className="px-3 py-1 rounded bg-amber-600 text-white font-semibold text-xs hover:bg-amber-700"
              >
                Tạo đơn giải trình đi muộn
              </button>
            </div>
          ) : null}

          {selectedDay.status === 'INCOMPLETE' && !selectedDay.checkOut && (
            <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-900 flex items-center justify-between">
              <span>⚠️ Ngày này chưa có giờ check-out. Hãy tạo đơn bổ sung công để không bị trừ ngày công.</span>
              <button
                onClick={() => navigate('/attendance/requests')}
                className="px-3 py-1 rounded bg-rose-600 text-white font-semibold text-xs hover:bg-rose-700"
              >
                Tạo đơn bổ sung công
              </button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};
