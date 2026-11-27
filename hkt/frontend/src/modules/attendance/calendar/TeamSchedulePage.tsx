import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Clock,
  Home,
  Plane,
  Users,
  X,
} from 'lucide-react';
import { Badge } from '../../../components/common/Badge';

interface DayRow {
  date: string;
  wfh: number;
  leave: number;
  late: number;
  present: number;
  teamSize: number;
  entries: { employeeCode: string; fullName: string; kind: 'WFH' | 'LEAVE' | 'LATE' | 'PRESENT'; halfDay?: boolean; halfDayPeriod?: 'MORNING' | 'AFTERNOON' | null; workWindowStart?: string | null; workWindowEnd?: string | null }[];
}

type Entry = DayRow['entries'][number];

const KIND_LABEL: Record<string, { text: string; cls: string }> = {
  PRESENT: { text: 'Có mặt', cls: 'bg-status-ok-soft text-status-ok border-status-ok-line' },
  WFH: { text: 'WFH', cls: 'bg-status-wfh-soft text-status-wfh border-status-wfh-line' },
  LEAVE: { text: 'Nghỉ phép', cls: 'bg-status-info-soft text-status-info border-status-info-line' },
  LATE: { text: 'Đi muộn', cls: 'bg-status-warn-soft text-status-warn border-status-warn-line' },
};

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const WEEKDAY_FULL = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

/** Ngày hôm nay theo giờ máy (không dùng UTC để tránh lệch ngày sáng sớm). */
const TODAY_STR = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
})();

const fmt = (n: number): string => (Number.isInteger(n) ? String(n) : n.toLocaleString('vi-VN'));
const hm = (t?: string | null): string => (t ? t.slice(0, 5) : '');
const dateLabel = (date: string): string => `${date.slice(8)}/${date.slice(5, 7)}/${date.slice(0, 4)}`;
const iso = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const initials = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

/** Ghi chú phụ dưới tên — giữ nguyên ý nghĩa half-day + khung giờ làm việc. */
const entryNote = (e: Entry): string => {
  const start = hm(e.workWindowStart);
  const end = hm(e.workWindowEnd);
  const win = start && end ? ` · làm việc ${start}–${end}` : '';
  if (e.halfDay) return `${e.kind === 'WFH' ? 'WFH' : 'Nghỉ'} buổi ${e.halfDayPeriod === 'MORNING' ? 'sáng' : 'chiều'}${win}`;
  if (e.kind === 'WFH') return 'WFH cả ngày';
  if (e.kind === 'LEAVE') return 'Nghỉ phép cả ngày';
  if (e.kind === 'LATE') return start ? `Có mặt từ ${start} · đi muộn` : 'Đi muộn / về sớm';
  return start && end ? `Cả ngày · ${start}–${end}` : 'Cả ngày';
};

const entryChip = (e: Entry): { text: string; cls: string } => {
  if (e.halfDay) {
    const period = e.halfDayPeriod === 'MORNING' ? 'sáng' : 'chiều';
    return e.kind === 'WFH'
      ? { text: `WFH ${period}`, cls: KIND_LABEL.WFH.cls }
      : { text: `Nghỉ ${period}`, cls: KIND_LABEL.LEAVE.cls };
  }
  return { text: KIND_LABEL[e.kind]?.text || e.kind, cls: KIND_LABEL[e.kind]?.cls || '' };
};

/** Một ô lịch. Không truyền row = cuối tuần / ngoài phạm vi dữ liệu. */
const DayCell: React.FC<{
  date: string;
  row?: DayRow;
  weekend?: boolean;
  selected: boolean;
  threshold: number;
  onSelect: (date: string) => void;
}> = ({ date, row, weekend, selected, threshold, onSelect }) => {
  const dayNum = Number(date.slice(8));

  if (weekend || !row) {
    return (
      <div className="relative flex min-h-[52px] flex-col rounded-[9px] border border-line-soft bg-canvas-subtle p-1 text-ink-muted sm:min-h-[82px] sm:p-2">
        <span className="text-[10.5px] font-bold sm:text-xs">{dayNum}</span>
        <span className="mt-auto self-end font-mono text-[8.5px] font-bold sm:text-[10px]">—</span>
      </div>
    );
  }

  const absent = row.wfh + row.leave;
  const conflict = row.teamSize >= 3 && absent * 100 >= row.teamSize * threshold;
  const manyWfh = !conflict && row.wfh >= 3;
  const tone = conflict
    ? 'border-status-warn-line bg-status-warn-soft'
    : manyWfh
      ? 'border-status-wfh-line bg-status-wfh-soft/60'
      : 'border-line bg-surface hover:border-line-hover';
  const sel = selected ? 'border-accent ring-1 ring-accent' : '';

  return (
    <button
      type="button"
      onClick={() => onSelect(date)}
      aria-pressed={selected}
      aria-label={`${dateLabel(date)} — ${fmt(row.present)}/${row.teamSize} có mặt${conflict ? ', nguy cơ thiếu người' : ''}`}
      className={`relative flex min-h-[52px] flex-col rounded-[9px] border p-1 text-left transition-colors sm:min-h-[82px] sm:p-2 ${tone} ${sel}`}
    >
      <span className={`text-[10.5px] font-bold sm:text-xs ${conflict ? 'text-status-warn' : selected ? 'text-accent' : 'text-ink'}`}>
        {dayNum}
      </span>
      {conflict && (
        <span className="absolute right-1 top-1 grid h-3.5 w-3.5 place-items-center rounded bg-status-warn text-[8px] font-extrabold text-on-warn sm:right-1.5 sm:top-1.5">
          !
        </span>
      )}
      <span className="mt-1 hidden flex-wrap gap-x-2 font-mono text-[9.5px] leading-tight text-ink-muted sm:flex">
        <span>Có mặt <b className="font-extrabold text-status-ok">{fmt(row.present)}</b></span>
        {row.wfh > 0 && <span>WFH <b className="font-extrabold text-status-wfh">{fmt(row.wfh)}</b></span>}
        {row.leave > 0 && <span>Nghỉ <b className="font-extrabold text-status-info">{fmt(row.leave)}</b></span>}
        {row.late > 0 && <span>Muộn <b className="font-extrabold text-status-warn">{fmt(row.late)}</b></span>}
      </span>
      <span className={`mt-auto self-end font-mono text-[8.5px] font-bold sm:text-[10px] ${conflict ? 'text-status-warn' : 'text-ink-muted'}`}>
        {fmt(row.present)}/{row.teamSize}
      </span>
    </button>
  );
};

export const TeamSchedulePage: React.FC = () => {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [view, setView] = useState<'week' | 'month'>('month');
  const [weekOffset, setWeekOffset] = useState(0);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string>(TODAY_STR);
  // Mobile chỉ hiện vài người có mặt trước, phần còn lại gộp sau nút "+N người khác".
  const [showAllPresent, setShowAllPresent] = useState(false);

  useEffect(() => {
    const token = (() => { try { return JSON.parse(localStorage.getItem('pulse_auth_user') || '{}')?.accessToken; } catch { return ''; } })();
    fetch(`/api/v1/attendance/team-schedule?month=${month}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => r.json())
      .then(j => {
        if (j?.data) {
          setData(j.data);
          setError(null);
          // Giữ ngày đang chọn nếu còn trong tháng, ngược lại chọn hôm nay / ngày đầu tiên có dữ liệu.
          const rows: DayRow[] = j.data.days || [];
          setSelectedDay(prev => (rows.some(d => d.date === prev) ? prev : (rows.find(d => d.date === TODAY_STR)?.date ?? rows[0]?.date ?? prev)));
          setShowAllPresent(false);
        } else setError(j?.message || 'Không tải được lịch nhóm');
      })
      .catch(() => setError('Không tải được lịch nhóm'));
  }, [month]);

  const allDays: DayRow[] = data?.days || [];
  const threshold: number = data?.conflictThresholdPercent ?? 60;
  const teamSize: number = data?.teamSize ?? 0;
  const conflicts: { date: string; message: string }[] = data?.conflicts || [];

  // Tuần đang xem (Thứ Hai → Chủ Nhật), dùng cho cả danh sách ngày và nhãn tuần.
  const weekStart = (() => {
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) + weekOffset * 7);
    monday.setHours(0, 0, 0, 0);
    return monday;
  })();
  const weekEnd = new Date(weekStart.getTime() + 6 * 86400000);
  const fromStr = iso(weekStart);
  const toStr = iso(weekEnd);

  const days = view === 'month' ? allDays : allDays.filter(d => d.date >= fromStr && d.date <= toStr);
  const rowByDate = new Map<string, DayRow>(allDays.map(d => [d.date, d]));

  const dayEntries = allDays.find(d => d.date === selectedDay) || null;
  /** Đổi ngày đang chọn — luôn thu gọn lại danh sách người có mặt. */
  const selectDay = (date: string) => {
    setSelectedDay(date);
    setShowAllPresent(false);
  };
  const PRESENT_PREVIEW = 5;
  const presentCount = dayEntries ? dayEntries.entries.filter(e => e.kind === 'PRESENT').length : 0;
  const hiddenPresent = showAllPresent ? 0 : Math.max(0, presentCount - PRESENT_PREVIEW);
  // Đánh dấu người có mặt vượt quá phần xem trước để ẩn trên mobile (desktop vẫn hiện đủ).
  let presentSeen = 0;
  const entryRows = (dayEntries?.entries ?? []).map(e => {
    const collapsed = e.kind === 'PRESENT' && !showAllPresent && presentSeen++ >= PRESENT_PREVIEW;
    return { e, collapsed };
  });
  const focus = dayEntries ?? allDays.find(d => d.date === TODAY_STR) ?? allDays[0] ?? null;
  const focusLabel = focus ? (focus.date === TODAY_STR ? 'Hôm nay' : dateLabel(focus.date)) : 'Chưa có dữ liệu';

  const [yearStr, monthStr] = month.split('-');
  const year = Number(yearStr);
  const monthIdx = Number(monthStr);
  const blanks = (new Date(year, monthIdx - 1, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, monthIdx, 0).getDate();
  const monthLabel = `Tháng ${monthIdx} / ${year}`;
  const weekLabel = `${dateLabel(fromStr).slice(0, 5)} – ${dateLabel(toStr).slice(0, 5)}`;

  const shiftMonth = (delta: number) => {
    if (view === 'week') {
      setWeekOffset(o => o + delta);
      return;
    }
    const d = new Date(year, monthIdx - 1 + delta, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    setWeekOffset(0);
  };

  const switchView = (v: 'week' | 'month') => {
    setView(v);
    if (v === 'week') setWeekOffset(0);
  };

  const weekdayOf = (date: string) => {
    const d = new Date(`${date}T00:00:00`);
    return Number.isNaN(d.getTime()) ? '' : WEEKDAY_FULL[d.getDay()];
  };

  const navLabel = view === 'month' ? monthLabel : weekLabel;
  const gridTitle = view === 'month' ? `Lưới lịch tháng ${monthIdx}/${year}` : `Lưới lịch tuần ${weekLabel}`;
  const workingDays = view === 'month'
    ? Array.from({ length: daysInMonth }, (_, i) => ((blanks + i) % 7)).filter(w => w < 5).length
    : 5;

  const gridNodes: React.ReactNode[] = [];
  if (view === 'month') {
    for (let i = 0; i < blanks; i++) gridNodes.push(<div key={`blank-${i}`} />);
    for (let d = 1; d <= daysInMonth; d++) {
      const date = `${month}-${String(d).padStart(2, '0')}`;
      const weekdayIdx = (blanks + d - 1) % 7;
      gridNodes.push(
        <DayCell
          key={date}
          date={date}
          row={rowByDate.get(date)}
          weekend={weekdayIdx >= 5}
          selected={selectedDay === date}
          threshold={threshold}
          onSelect={selectDay}
        />,
      );
    }
  } else {
    for (let i = 0; i < 7; i++) {
      const date = iso(new Date(weekStart.getTime() + i * 86400000));
      gridNodes.push(
        <DayCell
          key={date}
          date={date}
          row={rowByDate.get(date)}
          weekend={i >= 5}
          selected={selectedDay === date}
          threshold={threshold}
          onSelect={selectDay}
        />,
      );
    }
  }

  return (
    <div className="space-y-4 pb-24 sm:pb-0">
      {/* Đầu trang */}
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-accent-dark">
            <Users className="h-3.5 w-3.5" />
            Chấm công · Lịch nhóm
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <h1 className="font-display text-xl font-extrabold tracking-tight text-ink sm:text-[23px]">Lịch nhóm</h1>
            <Badge variant="accent">T3</Badge>
          </div>
          <p className="mt-1 text-xs text-ink-muted">
            {data?.scope || 'Đang tải…'} · {teamSize} người · cảnh báo khi ≥{threshold}% nhóm vắng cùng ngày
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
          <div className="order-2 inline-flex w-full gap-0.5 rounded-[11px] border border-line bg-surface p-[3px] sm:order-1 sm:w-auto">
            <button
              type="button"
              onClick={() => switchView('week')}
              aria-pressed={view === 'week'}
              className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors sm:flex-none ${
                view === 'week' ? 'bg-ink text-canvas' : 'text-ink-muted hover:text-ink'
              }`}
            >
              <CalendarRange className="h-3.5 w-3.5" />
              Tuần
            </button>
            <button
              type="button"
              onClick={() => switchView('month')}
              aria-pressed={view === 'month'}
              className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors sm:flex-none ${
                view === 'month' ? 'bg-ink text-canvas' : 'text-ink-muted hover:text-ink'
              }`}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              Tháng
            </button>
          </div>

          <div className="order-1 flex items-center gap-1.5 sm:order-2">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              title={view === 'month' ? 'Xem tháng trước' : 'Xem tuần trước'}
              aria-label={view === 'month' ? 'Xem tháng trước' : 'Xem tuần trước'}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] border border-line bg-surface text-ink transition-colors hover:bg-canvas"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <label className="relative flex h-9 flex-1 cursor-pointer items-center justify-center rounded-[10px] border border-line bg-surface px-3 focus-within:ring-2 focus-within:ring-accent sm:flex-none">
              <span className="font-mono text-xs font-semibold text-ink">{navLabel}</span>
              {view === 'month' && (
                <input
                  type="month"
                  value={month}
                  onChange={e => e.target.value && setMonth(e.target.value)}
                  aria-label="Chọn tháng"
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
              )}
            </label>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              title={view === 'month' ? 'Xem tháng sau' : 'Xem tuần sau'}
              aria-label={view === 'month' ? 'Xem tháng sau' : 'Xem tuần sau'}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] border border-line bg-surface text-ink transition-colors hover:bg-canvas"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-status-danger-line bg-status-danger-soft p-3 text-sm text-status-danger">{error}</div>
      )}

      {/* Bìa tóm tắt (desktop) */}
      <div className="hidden overflow-hidden rounded-[16px] border border-line bg-ink px-5 py-4 text-canvas sm:block">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div className="min-w-0">
            <div className="text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-canvas/60">
              {data?.scope || 'Lịch nhóm'} · {teamSize} thành viên
            </div>
            <div className="mt-1 font-display text-lg font-extrabold">Ai vắng, ai có mặt — nhìn một lượt</div>
            <p className="mt-1.5 max-w-[540px] text-xs leading-relaxed text-canvas/75">
              Số liệu lấy từ đơn đã duyệt và chấm công thực tế. Ngày có ≥{threshold}% nhóm vắng sẽ được đánh dấu để quản lý kịp điều chỉnh lịch.
            </p>
          </div>
          <dl className="ml-auto flex flex-wrap gap-y-3">
            <div className="border-l border-canvas/15 px-4 text-center first:border-l-0 first:pl-0">
              <dd className="font-display text-[26px] font-extrabold leading-none tracking-tight text-status-ok">
                {focus ? fmt(focus.present) : '—'}
                <span className="ml-0.5 text-xs font-semibold tracking-normal text-canvas/60">/{teamSize || '—'}</span>
              </dd>
              <dt className="mt-1.5 text-[10.5px] font-semibold text-canvas/60">Có mặt · {focusLabel}</dt>
            </div>
            <div className="border-l border-canvas/15 px-4 text-center">
              <dd className="font-display text-[26px] font-extrabold leading-none tracking-tight text-status-wfh">{focus ? fmt(focus.wfh) : '—'}</dd>
              <dt className="mt-1.5 text-[10.5px] font-semibold text-canvas/60">Làm từ xa</dt>
            </div>
            <div className="border-l border-canvas/15 px-4 text-center">
              <dd className="font-display text-[26px] font-extrabold leading-none tracking-tight text-status-info">{focus ? fmt(focus.leave) : '—'}</dd>
              <dt className="mt-1.5 text-[10.5px] font-semibold text-canvas/60">Nghỉ phép</dt>
            </div>
            <div className="border-l border-canvas/15 px-4 text-center">
              <dd className="font-display text-[26px] font-extrabold leading-none tracking-tight text-status-warn">{focus ? fmt(focus.late) : '—'}</dd>
              <dt className="mt-1.5 text-[10.5px] font-semibold text-canvas/60">Đi muộn</dt>
            </div>
            <div className="border-l border-canvas/15 px-4 text-center">
              <dd className="font-display text-[26px] font-extrabold leading-none tracking-tight text-status-danger">{conflicts.length}</dd>
              <dt className="mt-1.5 text-[10.5px] font-semibold text-canvas/60">Ngày xung đột</dt>
            </div>
          </dl>
        </div>
      </div>

      {/* Thống kê gọn (mobile) */}
      <div className="grid grid-cols-2 gap-2 sm:hidden">
        <div className="rounded-xl border border-line bg-surface p-3">
          <div className="flex items-center gap-1.5 text-[10.5px] font-semibold text-ink-muted"><Users className="h-3 w-3 text-accent" />Có mặt</div>
          <div className="mt-1.5 font-display text-[21px] font-extrabold leading-none tracking-tight text-status-ok">
            {focus ? fmt(focus.present) : '—'}<span className="ml-1 text-[10.5px] font-semibold text-ink-muted">/{teamSize || '—'}</span>
          </div>
          <div className="mt-1 text-[10.5px] font-semibold text-ink-muted">{focusLabel}</div>
        </div>
        <div className="rounded-xl border border-line bg-surface p-3">
          <div className="flex items-center gap-1.5 text-[10.5px] font-semibold text-ink-muted"><Home className="h-3 w-3 text-accent" />Làm từ xa</div>
          <div className="mt-1.5 font-display text-[21px] font-extrabold leading-none tracking-tight text-status-wfh">
            {focus ? fmt(focus.wfh) : '—'}<span className="ml-1 text-[10.5px] font-semibold text-ink-muted">người</span>
          </div>
          <div className="mt-1 text-[10.5px] font-semibold text-ink-muted">Đơn WFH đã duyệt</div>
        </div>
        <div className="rounded-xl border border-line bg-surface p-3">
          <div className="flex items-center gap-1.5 text-[10.5px] font-semibold text-ink-muted"><Plane className="h-3 w-3 text-accent" />Nghỉ phép</div>
          <div className="mt-1.5 font-display text-[21px] font-extrabold leading-none tracking-tight text-status-info">
            {focus ? fmt(focus.leave) : '—'}<span className="ml-1 text-[10.5px] font-semibold text-ink-muted">người</span>
          </div>
          <div className="mt-1 text-[10.5px] font-semibold text-ink-muted">Nghỉ cả ngày</div>
        </div>
        <div className="rounded-xl border border-line bg-surface p-3">
          <div className="flex items-center gap-1.5 text-[10.5px] font-semibold text-ink-muted"><Clock className="h-3 w-3 text-accent" />Đi muộn</div>
          <div className="mt-1.5 font-display text-[21px] font-extrabold leading-none tracking-tight text-status-warn">
            {focus ? fmt(focus.late) : '—'}<span className="ml-1 text-[10.5px] font-semibold text-ink-muted">người</span>
          </div>
          <div className="mt-1 text-[10.5px] font-semibold text-ink-muted">Vào muộn / về sớm</div>
        </div>
        <div className="col-span-2 rounded-xl border border-line bg-surface p-3">
          <div className="flex items-center gap-1.5 text-[10.5px] font-semibold text-ink-muted"><AlertTriangle className="h-3 w-3 text-accent" />Ngày nguy cơ thiếu người</div>
          <div className="mt-1.5 font-display text-[21px] font-extrabold leading-none tracking-tight text-status-warn">
            {conflicts.length}<span className="ml-1 text-[10.5px] font-semibold text-ink-muted">ngày</span>
          </div>
          <div className="mt-1 text-[10.5px] font-semibold text-ink-muted">
            {conflicts.length > 0 ? `Cảnh báo khi ≥${threshold}% nhóm vắng cùng ngày` : 'Chưa có ngày nào vượt ngưỡng cảnh báo'}
          </div>
        </div>
      </div>

      {conflicts.length > 0 && (
        <div className="flex items-start gap-2.5 rounded-xl border border-status-warn-line bg-status-warn-soft p-3 text-xs leading-relaxed text-status-warn">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0">
            <div className="font-bold">{conflicts.length} ngày nguy cơ thiếu người</div>
            {conflicts.map(c => (
              <div key={c.date} className="mt-0.5 text-[11.5px] opacity-90">{c.message}</div>
            ))}
          </div>
        </div>
      )}

      {/* Lưới lịch */}
      <section className="rounded-[13px] border border-line bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3.5 py-3">
          <span className="text-[13.5px] font-bold text-ink">{gridTitle}</span>
          <span className="text-[11px] text-ink-muted">{teamSize} người · {workingDays} ngày làm việc</span>
        </div>
        <div className="p-2.5 sm:p-3.5">
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
            {WEEKDAYS.map(w => (
              <div key={w} className="pb-1 text-center text-[9px] font-bold uppercase tracking-wide text-ink-muted sm:text-[10px]">
                {w}
              </div>
            ))}
            {gridNodes}
          </div>

          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 border-t border-line-soft pt-2.5 text-[10.5px] text-ink-muted">
            <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-status-ok" />Đủ người</span>
            <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-status-wfh" />Nhiều người WFH</span>
            <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-status-warn" />Nguy cơ thiếu người (≥{threshold}% vắng)</span>
            <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-ink-muted" />Cuối tuần</span>
          </div>

          {!error && (allDays.length === 0 || !allDays.some(d => d.present + d.wfh + d.leave + d.late > 0)) && (
            <div className="mt-3 rounded-lg border border-line-soft bg-canvas px-3 py-4 text-center text-xs text-ink-muted">
              Chưa có dữ liệu lịch nhóm trong {view === 'month' ? monthLabel.toLowerCase() : 'tuần này'}.
            </div>
          )}
        </div>
      </section>

      {/* Chi tiết ngày đã chọn */}
      {dayEntries && (
        <section className="rounded-[13px] border border-line bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3.5 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[13.5px] font-bold text-ink">Chi tiết ngày {dateLabel(dayEntries.date)}</span>
              <span className="text-[11px] text-ink-muted">{weekdayOf(dayEntries.date)}</span>
            </div>
            <button
              type="button"
              onClick={() => selectDay('')}
              className="inline-flex h-[29px] items-center gap-1 rounded-lg border border-line bg-surface px-2.5 text-[11.5px] font-semibold text-ink-secondary transition-colors hover:bg-canvas hover:text-ink"
            >
              <X className="h-3 w-3" />
              Đóng
            </button>
          </div>
          <div className="p-3.5">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-[11px] border border-line bg-canvas p-2.5">
                <div className="text-[10.5px] font-semibold text-ink-muted">Có mặt</div>
                <div className="mt-1 font-mono text-sm font-extrabold text-status-ok">{fmt(dayEntries.present)} / {dayEntries.teamSize} người</div>
              </div>
              <div className="rounded-[11px] border border-line bg-canvas p-2.5">
                <div className="text-[10.5px] font-semibold text-ink-muted">Làm từ xa (WFH)</div>
                <div className="mt-1 font-mono text-sm font-extrabold text-status-wfh">{fmt(dayEntries.wfh)} người</div>
              </div>
              <div className="rounded-[11px] border border-line bg-canvas p-2.5">
                <div className="text-[10.5px] font-semibold text-ink-muted">Nghỉ phép</div>
                <div className="mt-1 font-mono text-sm font-extrabold text-status-info">{fmt(dayEntries.leave)} người</div>
              </div>
              <div className="rounded-[11px] border border-line bg-canvas p-2.5">
                <div className="text-[10.5px] font-semibold text-ink-muted">Đi muộn / về sớm</div>
                <div className="mt-1 font-mono text-sm font-extrabold text-status-warn">{fmt(dayEntries.late)} người</div>
              </div>
            </div>

            {dayEntries.entries.length === 0 ? (
              <div className="mt-3 rounded-lg border border-line-soft bg-canvas px-3 py-4 text-center text-xs text-ink-muted">
                Chưa ghi nhận trạng thái của thành viên nào trong ngày này.
              </div>
            ) : (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {entryRows.map(({ e, collapsed }) => {
                  const chip = entryChip(e);
                  return (
                    <div
                      key={`${e.employeeCode}-${e.kind}-${e.halfDayPeriod ?? ''}`}
                      className={`min-w-0 items-center gap-2.5 rounded-[10px] border border-line bg-canvas px-3 py-2 sm:flex ${collapsed ? 'hidden' : 'flex'}`}
                    >
                      <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full bg-accent-soft text-[10.5px] font-extrabold text-accent-dark">
                        {initials(e.fullName)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold text-ink">
                          {e.fullName}
                          <span className="ml-1 font-mono text-[10px] font-normal text-ink-muted">{e.employeeCode}</span>
                        </span>
                        <span className="block truncate text-[10px] text-ink-muted">{entryNote(e)}</span>
                      </span>
                      <span className={`inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-[10.5px] font-semibold ${chip.cls}`}>
                        {chip.text}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            {hiddenPresent > 0 && (
              <button
                type="button"
                onClick={() => setShowAllPresent(true)}
                className="mt-2 w-full rounded-lg border border-line-soft bg-canvas px-3 py-2 text-center text-[11.5px] font-semibold text-ink-muted transition-colors hover:text-ink sm:hidden"
              >
                + {hiddenPresent} người khác đang có mặt đủ ngày
              </button>
            )}
          </div>
        </section>
      )}
    </div>
  );
};
