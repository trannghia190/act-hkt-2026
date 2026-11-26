import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { useAuth } from '../../../context/AuthContext';
import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  House,
  MessageSquareWarning,
  Wallet,
  X,
} from 'lucide-react';

/** Trạng thái khiếu nại → nhãn tiếng Việt (khớp trạng thái trả về từ API). */
const DISPUTE_STATUS: Record<string, string> = {
  PENDING: 'HR đang xử lý',
  RESOLVED: 'HR đã xử lý',
  REJECTED: 'bị từ chối',
};

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
      {/* Header — mockup `.phead` */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-accent-dark">
            <CalendarDays className="h-3.5 w-3.5" />
            Lịch chấm công cá nhân
          </div>
          <h1 className="mt-1.5 font-display text-xl font-extrabold tracking-tight text-ink sm:text-[23px]">
            Lịch công tháng
          </h1>
          <p className="mt-1 text-xs text-ink-muted">
            Nhật ký ra vào, số giờ công tích lũy, lần dùng quota đi muộn và ngày phép
          </p>
        </div>

        {/* Chuyển tháng — nút ‹ › gộp trong 1 khung */}
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="md"
            onClick={() => changeMonth(-1)}
            aria-label="Tháng trước"
            title="Xem tháng trước"
            className="px-2.5"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="rounded-[10px] border border-line bg-surface px-3 py-2 font-mono text-xs font-bold text-ink shadow-2xs">
            {displayMonthTitle}
          </span>
          <Button
            variant="outline"
            size="md"
            onClick={() => changeMonth(1)}
            aria-label="Tháng sau"
            title="Xem tháng sau"
            className="px-2.5"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Stat row — mockup `.stats5` */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        <div className="rounded-[13px] border border-line bg-surface p-3.5 shadow-2xs">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-muted">
            <CalendarClock className="h-3.5 w-3.5 text-accent" />
            Công chuẩn tháng
          </div>
          <div className="mt-2 font-display text-2xl font-extrabold leading-none tracking-[-0.035em] text-ink">
            {summary.standardDays}
            <small className="ml-1 text-xs font-semibold tracking-normal text-ink-muted">ngày</small>
          </div>
          <div className="mt-1.5 text-[11px] font-semibold text-ink-muted">{summary.standardDays * 8} giờ quy định</div>
        </div>

        <div className="rounded-[13px] border border-line bg-surface p-3.5 shadow-2xs">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-muted">
            <CheckCircle2 className="h-3.5 w-3.5 text-accent" />
            Công đã tích lũy
          </div>
          <div className="mt-2 font-display text-2xl font-extrabold leading-none tracking-[-0.035em] text-status-ok">
            {summary.actualDays}
            <small className="ml-1 text-xs font-semibold tracking-normal text-ink-muted">ngày</small>
          </div>
          <div className="mt-1.5 text-[11px] font-semibold text-status-ok">
            Đạt {(summary.actualDays * 8).toFixed(1)}h hợp lệ
          </div>
        </div>

        <div className="rounded-[13px] border border-line bg-surface p-3.5 shadow-2xs">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-muted">
            <Clock className="h-3.5 w-3.5 text-accent" />
            Đi muộn / về sớm
          </div>
          <div className="mt-2 font-display text-2xl font-extrabold leading-none tracking-[-0.035em] text-status-warn">
            {summary.lateCount}
            <small className="ml-1 text-xs font-semibold tracking-normal text-ink-muted">lần</small>
          </div>
          <div className="mt-1.5 text-[11px] font-semibold text-status-warn">
            {summary.lateCount > 2 ? 'Vượt quota miễn phạt' : 'Trong hạn mức cho phép'}
          </div>
        </div>

        <div className="rounded-[13px] border border-line bg-surface p-3.5 shadow-2xs">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-muted">
            <Wallet className="h-3.5 w-3.5 text-accent" />
            Nghỉ phép năm
          </div>
          <div className="mt-2 font-display text-2xl font-extrabold leading-none tracking-[-0.035em] text-accent">
            {summary.leaveDays}
            <small className="ml-1 text-xs font-semibold tracking-normal text-ink-muted">ngày</small>
          </div>
          <div className="mt-1.5 text-[11px] font-semibold text-accent-dark">Còn {summary.remainingLeave} ngày phép</div>
        </div>

        <div className="col-span-2 rounded-[13px] border border-line bg-surface p-3.5 shadow-2xs lg:col-span-1">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-muted">
            <House className="h-3.5 w-3.5 text-accent" />
            Làm từ xa (WFH)
          </div>
          <div className="mt-2 font-display text-2xl font-extrabold leading-none tracking-[-0.035em] text-status-wfh">
            {summary.wfhDays}
            <small className="ml-1 text-xs font-semibold tracking-normal text-ink-muted">ngày</small>
          </div>
          <div className="mt-1.5 text-[11px] font-semibold text-status-wfh">Đã duyệt hợp lệ</div>
        </div>
      </div>

      {/* Lưới lịch — mockup `.panel` */}
      <div className="overflow-hidden rounded-[13px] border border-line bg-surface shadow-2xs">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          <h2 className="text-[13.5px] font-bold tracking-[-0.01em] text-ink">
            Lưới lịch tháng {monthNum}/{yearNum}
          </h2>
          <span className="ml-auto font-mono text-[10.5px] text-ink-muted">
            {days.length} ngày
          </span>
        </div>

        <div className="p-3 sm:p-4">
          {loading ? (
            <div className="py-12 text-center text-xs text-ink-muted">Đang tải dữ liệu lịch công…</div>
          ) : (
            <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
              {/* Ô tiêu đề T2 → CN */}
              {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((d) => (
                <div key={d} className="pb-1 text-center text-[10px] font-bold uppercase tracking-[0.06em] text-ink-muted">
                  {d}
                </div>
              ))}

              {/* Ô trống trước ngày 1 */}
              {Array.from({ length: startDayOfWeek }).map((_, idx) => (
                <div key={`empty-${idx}`} aria-hidden="true" className="min-h-[52px] sm:min-h-[82px]" />
              ))}

              {/* Các ngày trong tháng */}
              {days.map((d) => {
                // Vắng (ABSENT) chỉ tô chữ đỏ, không tô nền — tránh "biển đỏ" nuốt thông tin.
                const hasIssue = d.status === 'LATE' || d.status === 'INCOMPLETE';
                const cls =
                  d.status === 'LEAVE'
                    ? 'bg-status-info-soft border-status-info-line text-status-info'
                    : d.status === 'WFH'
                    ? 'bg-status-wfh-soft border-status-wfh-line text-status-wfh'
                    : d.status === 'LATE'
                    ? 'bg-status-warn-soft border-status-warn-line text-status-warn'
                    : d.status === 'INCOMPLETE'
                    ? 'bg-status-danger-soft border-status-danger-line text-status-danger'
                    : d.status === 'ABSENT'
                    ? 'bg-canvas border-line text-status-danger'
                    : d.status === 'ON_TIME'
                    ? 'bg-status-ok-soft/60 border-status-ok-line text-status-ok'
                    : d.status === 'HOLIDAY'
                    ? 'bg-status-ok-soft/40 border-status-ok-line text-status-ok'
                    : d.status === 'WEEKEND'
                    ? 'bg-canvas-subtle border-line-soft text-ink-muted'
                    : 'bg-surface border-line text-ink-muted';

                return (
                  <button
                    key={d.date}
                    type="button"
                    onClick={() => setSelectedDay(d)}
                    title={`${d.date} (${d.weekday}): ${d.statusText}`}
                    className={`flex min-h-[52px] flex-col justify-between rounded-lg border px-1 py-1 text-left transition-colors sm:min-h-[82px] sm:rounded-[10px] sm:px-1.5 sm:py-1.5 ${
                      selectedDay?.day === d.day ? 'ring-2 ring-accent' : ''
                    } ${cls}`}
                  >
                    <div className="flex w-full items-start justify-between gap-0.5">
                      <span className="font-mono text-[10.5px] font-extrabold sm:text-[11.5px]">{d.day}</span>
                      {d.dispute ? (
                        <span
                          className="rounded bg-status-warn px-1 text-[8px] font-bold leading-[1.4] text-on-warn sm:text-[9px]"
                          title={`Đã có khiếu nại — ${d.dispute.status === 'RESOLVED' ? 'HR đã xử lý' : d.dispute.status === 'REJECTED' ? 'bị từ chối' : 'HR đang xử lý'}`}
                        >
                          KN
                        </span>
                      ) : hasIssue ? (
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-status-danger" title="Ngày có vấn đề" />
                      ) : null}
                    </div>

                    {/* Giờ vào/ra chỉ hiện từ sm lên — mobile ô quá hẹp */}
                    {d.checkIn && (
                      <div className="mt-1 hidden space-y-0.5 font-mono text-[10px] text-ink-secondary sm:block">
                        <div>Vào: <strong className="text-ink">{d.checkIn}</strong></div>
                        <div>Ra: <strong className="text-ink">{d.checkOut || '--:--'}</strong></div>
                      </div>
                    )}

                    <div className="mt-1 flex w-full items-end justify-between gap-1">
                      {/* Ô mobile quá hẹp → chỉ hiện ký hiệu 1–2 ký tự, không hiện statusText dài */}
                      <span className="truncate font-mono text-[9.5px] font-bold sm:text-[10.5px]">
                        {d.status === 'WEEKEND' ? '—' : d.symbol || d.statusText}
                      </span>
                      {d.hoursWorked ? (
                        <span className="hidden font-mono text-[9px] text-ink-muted sm:inline">{d.hoursWorked}h</span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Chú giải */}
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-line pt-3 text-[10.5px] text-ink-muted">
            {[
              { label: 'Đúng giờ', dot: 'bg-status-ok' },
              { label: 'Đi muộn', dot: 'bg-status-warn' },
              { label: 'Làm từ xa (WFH)', dot: 'bg-status-wfh' },
              { label: 'Nghỉ phép', dot: 'bg-status-info' },
              { label: 'Thiếu giờ / Vắng', dot: 'bg-status-danger' },
              { label: 'Cuối tuần / Lễ', dot: 'bg-ink-muted' },
            ].map(l => (
              <span key={l.label} className="inline-flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${l.dot}`} />
                {l.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Chi tiết ngày đã chọn — mockup `.panel` */}
      {selectedDay && (
        <div className="overflow-hidden rounded-[13px] border border-line bg-surface shadow-2xs">
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
            <h2 className="text-[13.5px] font-bold tracking-[-0.01em] text-ink">
              Chi tiết ngày {selectedDay.day}/{monthNum}/{yearNum}
            </h2>
            <span className="text-[11px] text-ink-muted">({selectedDay.weekday})</span>
            <button
              type="button"
              onClick={() => setSelectedDay(null)}
              className="ml-auto inline-flex h-7 items-center gap-1 rounded-lg border border-line px-2.5 text-[11.5px] font-semibold text-ink-secondary hover:border-line-hover"
            >
              <X className="h-3 w-3" />
              Đóng
            </button>
          </div>

          <div className="p-4">
            <div className="grid grid-cols-2 gap-2.5 text-xs md:grid-cols-4">
              <div className="rounded-lg border border-line bg-canvas p-3">
                <span className="text-[11px] text-ink-muted">Trạng thái ghi nhận:</span>
                <div className="mt-1">
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

              <div className="rounded-lg border border-line bg-canvas p-3">
                <span className="text-[11px] text-ink-muted">Giờ check-in:</span>
                <div className="mt-1 font-mono text-sm font-bold text-ink">{selectedDay.checkIn || '—'}</div>
              </div>

              <div className="rounded-lg border border-line bg-canvas p-3">
                <span className="text-[11px] text-ink-muted">Giờ check-out:</span>
                <div className="mt-1 font-mono text-sm font-bold text-ink">{selectedDay.checkOut || '—'}</div>
              </div>

              <div className="rounded-lg border border-line bg-canvas p-3">
                <span className="text-[11px] text-ink-muted">Số giờ làm thực tế:</span>
                <div className="mt-1 text-sm font-bold text-status-ok">
                  {selectedDay.hoursWorked ? `${selectedDay.hoursWorked} giờ` : '0 giờ'}
                </div>
              </div>
            </div>

            {selectedDay.lateMinutes ? (
              <div className="mt-3 flex flex-col items-start justify-between gap-2 rounded-lg border border-status-warn-line bg-status-warn-soft p-3 text-xs text-status-warn sm:flex-row sm:items-center">
                <span className="inline-flex items-start gap-1.5">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    Bạn đã check-in muộn <strong>{selectedDay.lateMinutes} phút</strong> so với ca chuẩn.
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() =>
                    navigate(`/attendance/requests?create=LATE_EARLY&date=${selectedDay.date}`)
                  }
                  className="shrink-0 whitespace-nowrap rounded-lg bg-status-warn px-3 py-1.5 text-xs font-semibold text-on-warn"
                >
                  Tạo đơn giải trình đi muộn
                </button>
              </div>
            ) : null}

            {selectedDay.status === 'INCOMPLETE' && !selectedDay.checkOut && (
              <div className="mt-3 flex flex-col items-start justify-between gap-2 rounded-lg border border-status-danger-line bg-status-danger-soft p-3 text-xs text-status-danger sm:flex-row sm:items-center">
                <span className="inline-flex items-start gap-1.5">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>Ngày này chưa có giờ check-out. Hãy tạo đơn bổ sung công để không bị trừ ngày công.</span>
                </span>
                <button
                  type="button"
                  onClick={() =>
                    navigate(`/attendance/requests?create=ADJUST&date=${selectedDay.date}`)
                  }
                  className="shrink-0 whitespace-nowrap rounded-lg bg-status-danger px-3 py-1.5 text-xs font-semibold text-on-danger"
                >
                  Tạo đơn bổ sung công
                </button>
              </div>
            )}

            {/* Khiếu nại đã gửi — HR đang xử lý / đã xử lý / bị từ chối */}
            {selectedDay.dispute ? (
              <div className="mt-3 flex flex-col items-start justify-between gap-2 rounded-lg border border-status-info-line bg-status-info-soft p-3 text-xs text-status-info sm:flex-row sm:items-center">
                <span className="inline-flex items-start gap-1.5">
                  <MessageSquareWarning className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    Bạn đã gửi khiếu nại ngày này —{' '}
                    <strong>{DISPUTE_STATUS[selectedDay.dispute.status] || selectedDay.dispute.status}</strong>
                    . Lý do: {selectedDay.dispute.reason || '(không ghi lý do)'}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() =>
                    navigate(`/attendance/my-timesheet?month=${selectedDay.date.slice(0, 7)}`)
                  }
                  className="shrink-0 whitespace-nowrap rounded-lg bg-status-info px-3 py-1.5 text-xs font-semibold text-on-info"
                >
                  Xem trong bảng công của tôi
                </button>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};
