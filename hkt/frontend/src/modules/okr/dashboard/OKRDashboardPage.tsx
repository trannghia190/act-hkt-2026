import React, { useEffect, useState } from 'react';
import { Badge } from '../../../components/common/Badge';
import { NoActiveCycleNotice } from '../components/NoActiveCycleNotice';
import {
  CheckCircle2,
  ChevronRight,
  Clock,
  Info,
  Rocket,
  Target,
  Timer,
} from 'lucide-react';

/** Kỳ chốt cuối năm có hậu tố -FINAL ở backend — hiển thị thân thiện hơn. */
const displayPeriod = (period?: string | null) => {
  if (!period) return '';
  return period.endsWith('-FINAL') ? `${period.slice(0, -'-FINAL'.length)} · chốt cuối năm` : period;
};

interface OKRTodo {
  id: string;
  type: string;
  title: string;
  status: string;
  deadline: string | null;
  daysLeft: number | null;
  actionUrl: string;
  actionText: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

interface SelfProposal {
  year: number;
  status: 'NOT_STARTED' | 'DRAFT' | 'SUBMITTED';
  statusText: string;
  deadline: string | null;
  daysLeft: number | null;
  editable: boolean;
  viewUrl: string;
}

interface CompanyObjective {
  id: string;
  title: string;
  category: string;
  weight: string;
  progress: number;
  note: string;
}

interface DashboardData {
  cycleYear: number;
  currentPhase: string;
  phaseTitle: string;
  phaseStatus: string | null;
  deadline: string | null;
  daysLeft: number | null;
  countdownText: string;
  canCheckIn: boolean;
  checkinPeriod: string | null;
  checkinDeadline: string | null;
  pendingCheckinCount: number;
  checkinState?: 'OPEN' | 'DONE' | 'NOT_APPROVED' | 'NO_ITEMS' | 'CLOSED';
  checkinStateText?: string;
  businessScore: number | null;
  businessProgress: number;
  peopleScore: number | null;
  peopleProgress: number;
  averageScore: number | null;
  scoreSource: 'MANAGER' | 'SELF' | null;
  companyObjectivesWeight: number;
  companyObjectivesExcludedFromAverage: boolean;
  companyObjectives: CompanyObjective[];
  /** false = hệ thống chưa có chu kỳ OKR nào đang hoạt động. */
  hasActiveCycle?: boolean;
  selfProposal: SelfProposal;
  todos: OKRTodo[];
  todoCount: number;
}

interface CycleOption {
  year: number;
  status: string;
}

export const OKRDashboardPage: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [cycles, setCycles] = useState<CycleOption[]>([]);
  const [year, setYear] = useState<number | null>(null); // null = năm của chu kỳ đang active (server quyết định)
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/v1/okr/cycles')
      .then((r) => r.json())
      // Bỏ bản nháp (draft): chu kỳ chưa kích hoạt không phải năm làm việc.
      .then((j) => setCycles((j?.data || [])
        .filter((c: any) => String(c.status).toLowerCase() !== 'draft')
        .map((c: any) => ({ year: c.year, status: c.status }))))
      .catch(() => setCycles([]));
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/v1/okr/dashboard${year ? `?year=${year}` : ''}`)
      .then(async (res) => {
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.data) throw new Error(json?.message || 'Không tải được Dashboard OKR');
        setData(json.data);
        if (year === null) setYear(json.data.cycleYear);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [year]);

  const formatScore = (value: number | null | undefined) =>
    typeof value === 'number' ? value.toFixed(1) : '—';

  if (!data) {
    return (
      <div className="p-6 text-sm text-ink-muted">
        {loading ? 'Đang tải Dashboard OKR…' : error || 'Chưa có dữ liệu OKR'}
      </div>
    );
  }

  // Chưa có chu kỳ OKR nào đang hoạt động → báo rõ cho nhân viên thay vì bảng số trống rỗng.
  if (data.hasActiveCycle === false) {
    return <NoActiveCycleNotice role="employee" />;
  }

  const proposalBadgeVariant: 'ok' | 'warn' | 'gray' =
    data.selfProposal.status === 'SUBMITTED'
      ? 'ok'
      : data.selfProposal.status === 'DRAFT'
      ? 'warn'
      : 'gray';

  const scoreSourceText =
    data.scoreSource === 'MANAGER'
      ? 'Điểm Quản lý đã chấm'
      : data.scoreSource === 'SELF'
      ? 'Điểm tự chấm (chờ Quản lý chấm)'
      : 'Chưa chấm điểm — điểm có ở phase Đánh giá cuối năm';

  const yearOptions = Array.from(new Set([...cycles.map((c) => c.year), data.cycleYear])).sort((a, b) => b - a);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-3.5 px-3 pb-12 sm:px-4">
      {error && (
        <div className="rounded-xl border border-status-danger-line bg-status-danger-soft p-3 text-xs text-status-danger">
          {error}
        </div>
      )}

      {/* Đầu trang — mockup `.phead` */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-accent-dark">
            <Target className="h-3.5 w-3.5" />
            Mục tiêu &amp; hiệu suất
          </div>
          <h1 className="mt-1.5 font-display text-xl font-extrabold tracking-tight text-ink sm:text-[23px]">
            Tổng quan OKR
          </h1>
          <p className="mt-1 text-xs text-ink-muted">
            OKR gồm 2 nhóm Business &amp; People (tháng 1–5), điểm trung bình tự tính. Phần 20% mục tiêu
            công ty không tính vào điểm TB.
          </p>
        </div>
        <div className="shrink-0">
          <select
            value={year ?? data.cycleYear}
            onChange={(e) => setYear(Number(e.target.value))}
            aria-label="Chọn chu kỳ OKR"
            className="h-9 cursor-pointer rounded-[10px] border border-line bg-surface px-3 text-[12.5px] font-semibold text-ink focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/20"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                Chu kỳ {y}
                {cycles.find((c) => c.year === y)?.status === 'active' ? ' (Hiện tại)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* S20 · Phase hiện tại + Đếm ngược hạn chót + Nút Check-in nổi bật */}
      <div className="flex flex-col items-start justify-between gap-3 rounded-[14px] border border-accent-line bg-gradient-to-r from-accent-soft/70 via-surface to-accent-soft/20 p-4 md:flex-row md:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-accent px-2.5 text-[11px] font-bold uppercase tracking-wide text-on-accent">
              <Target className="h-3 w-3" />
              Phase hiện tại · {data.currentPhase}
            </span>
            {data.countdownText && (
              <span className="inline-flex h-6 items-center gap-1.5 rounded-full border border-status-warn-line bg-status-warn-soft px-2.5 text-[11px] font-bold text-status-warn">
                <Timer className="h-3 w-3" />
                {data.countdownText}
              </span>
            )}
          </div>
          <div className="mt-1.5 text-sm font-bold text-ink">{data.phaseTitle}</div>
          {data.checkinPeriod && data.checkinDeadline && data.canCheckIn && (
            <div className="mt-1 text-xs text-ink-muted">
              Check-in kỳ <strong className="text-ink-secondary">{displayPeriod(data.checkinPeriod)}</strong>: hạn{' '}
              <strong className="text-ink-secondary">{data.checkinDeadline}</strong> ·{' '}
              {data.pendingCheckinCount} đầu việc chưa cập nhật.
            </div>
          )}
        </div>

        {/* Nút Check-in nổi bật khi đến kỳ; ngoài ra luôn cho biết trạng thái check-in */}
        {data.checkinState === 'OPEN' ? (
          <a
            href="/okr/my-okr?checkin=1"
            className="flex shrink-0 flex-col items-center justify-center rounded-xl bg-accent px-5 py-2.5 text-center font-bold text-on-accent shadow-md transition-colors hover:bg-accent-hover"
          >
            <span className="flex items-center gap-1.5 text-sm">
              <Rocket className="h-4 w-4" />
              Check-in tiến độ ngay
            </span>
            <span className="mt-0.5 text-[11px] font-medium opacity-90">
              Kỳ {displayPeriod(data.checkinPeriod)} · còn {data.pendingCheckinCount} đầu việc
            </span>
          </a>
        ) : data.checkinState && data.checkinState !== 'CLOSED' ? (
          <div
            className={`shrink-0 rounded-xl border px-4 py-2.5 text-xs font-semibold text-center ${
              data.checkinState === 'DONE'
                ? 'border-status-ok-line bg-status-ok-soft text-status-ok'
                : 'border-status-warn-line bg-status-warn-soft text-status-warn'
            }`}
          >
            {data.checkinState === 'DONE' ? (
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {data.checkinStateText}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {data.checkinStateText}
              </span>
            )}
            {data.checkinState === 'DONE' && data.checkinDeadline && (
              <div className="mt-0.5 text-[11px] font-normal opacity-80">Kỳ tiếp theo mở sau {data.checkinDeadline}</div>
            )}
          </div>
        ) : data.checkinStateText ? (
          <span className="inline-flex h-7 shrink-0 items-center rounded-full border border-line bg-surface-2 px-3 text-[11px] font-semibold text-ink-secondary">
            {data.checkinStateText}
          </span>
        ) : null}
      </div>

      {/* Card Định hướng & đề xuất của kỳ (trạng thái + nút xem) */}
      <div className="overflow-hidden rounded-[13px] border border-line bg-surface shadow-2xs">
        <div className="flex flex-col items-start justify-between gap-3 p-3.5 sm:flex-row sm:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[13px] font-bold text-ink">
                Định hướng &amp; đề xuất kỳ {data.selfProposal.year}
              </span>
              <Badge variant={proposalBadgeVariant}>{data.selfProposal.statusText}</Badge>
            </div>
            <div className="mt-1 text-[11.5px] text-ink-secondary">
              Khai báo cùng bộ mục tiêu và gửi Quản lý duyệt
              {data.selfProposal.deadline && (
                <> · Hạn chót nộp: <strong className="text-ink">{data.selfProposal.deadline}</strong> (còn {data.selfProposal.daysLeft} ngày)</>
              )}
            </div>
          </div>
          <a
            href={data.selfProposal.viewUrl}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[9px] border border-line bg-surface px-3 text-[12.5px] font-semibold text-ink-secondary transition-colors hover:border-line-hover hover:bg-canvas-subtle hover:text-ink"
          >
            {data.selfProposal.status === 'SUBMITTED' || !data.selfProposal.editable
              ? 'Xem nội dung'
              : data.selfProposal.status === 'NOT_STARTED'
              ? 'Viết ngay'
              : 'Tiếp tục viết'}
            <ChevronRight className="h-3 w-3" />
          </a>
        </div>
      </div>

      {/* Card Việc cần làm với OKR (chấm, cập nhật, chờ duyệt) */}
      <Panel title="Việc cần làm với OKR" count={`${data.todos.length} việc`}>
        {data.todos.length === 0 ? (
          <div className="py-3 text-xs text-ink-muted">Không có việc nào cần làm với OKR lúc này.</div>
        ) : (
          <div>
            {data.todos.map((todo) => (
              <div
                key={todo.id}
                className="flex flex-col items-start justify-between gap-2 border-b border-line-soft py-2.5 last:border-b-0 last:pb-0 first:pt-0 sm:flex-row sm:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${
                        todo.priority === 'HIGH'
                          ? 'bg-status-danger'
                          : todo.priority === 'MEDIUM'
                          ? 'bg-status-warn'
                          : 'bg-status-info'
                      }`}
                    />
                    <span className="text-xs font-bold text-ink">{todo.title}</span>
                    {todo.deadline && (
                      <span className="text-[11px] text-ink-muted">
                        · Hạn: {todo.deadline} ({todo.daysLeft} ngày nữa)
                      </span>
                    )}
                  </div>
                  <div className="pl-4 text-[11px] text-ink-secondary">
                    {todo.status === 'WAITING'
                      ? 'Đã gửi duyệt — chờ cấp quản lý phê duyệt'
                      : todo.status === 'DRAFT'
                      ? 'Bản nháp đang viết — cần hoàn thiện để nộp'
                      : 'Chưa hoàn tất — cần xử lý trước hạn chót'}
                  </div>
                </div>
                <a
                  href={todo.actionUrl}
                  className="inline-flex h-8 shrink-0 items-center rounded-[9px] bg-accent-soft px-3 text-[12.5px] font-semibold text-accent-dark transition-colors hover:bg-accent hover:text-on-accent"
                >
                  {todo.actionText}
                </a>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <div className="-mt-1 text-[11px] text-ink-muted">{scoreSourceText}</div>

      {/* 2 Nhóm Điểm (Business + People) + Điểm Trung Bình Tự Tính */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {/* Nhóm Business */}
        <div className="rounded-[13px] border border-line bg-surface p-3.5 shadow-2xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.06em] text-ink-muted">
              Business (công việc)
            </span>
            <Badge variant="gray">Tiến độ {data.businessProgress}%</Badge>
          </div>
          <div className="mt-1.5 text-[11.5px] text-ink-secondary">Thành tựu công việc &amp; dự án</div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="font-display text-[28px] font-extrabold leading-none tracking-[-0.035em] text-ink">
              {formatScore(data.businessScore)}
            </span>
            <span className="text-xs font-semibold text-ink-muted">/ 5.0</span>
          </div>
          <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-accent" style={{ width: `${data.businessProgress}%` }} />
          </div>
        </div>

        {/* Nhóm People */}
        <div className="rounded-[13px] border border-line bg-surface p-3.5 shadow-2xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.06em] text-ink-muted">
              People (con người)
            </span>
            <Badge variant="gray">Tiến độ {data.peopleProgress}%</Badge>
          </div>
          <div className="mt-1.5 text-[11.5px] text-ink-secondary">Thành tựu con người &amp; đội ngũ</div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="font-display text-[28px] font-extrabold leading-none tracking-[-0.035em] text-status-ok">
              {formatScore(data.peopleScore)}
            </span>
            <span className="text-xs font-semibold text-ink-muted">/ 5.0</span>
          </div>
          <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-status-ok" style={{ width: `${data.peopleProgress}%` }} />
          </div>
        </div>

        {/* Điểm TB Tự Tính */}
        <div className="col-span-1 rounded-[13px] border border-accent-line bg-accent-soft/45 p-3.5 shadow-2xs sm:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.06em] text-accent-dark">
              Điểm trung bình OKR
            </span>
            <Badge variant="accent">Tự tính 100%</Badge>
          </div>
          <div className="mt-1.5 text-[11.5px] text-ink-secondary">
            =(Business + People) / 2 · Không điểm lẻ
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="font-display text-[28px] font-extrabold leading-none tracking-[-0.035em] text-accent">
              {formatScore(data.averageScore)}
            </span>
            <span className="text-xs font-semibold text-ink-muted">/ 5.0</span>
          </div>
          <div className="mt-2.5 text-[10.5px] font-semibold text-accent-dark">
            Chỉ tính từ 2 nhóm cá nhân. Mục tiêu công ty (20%) không tính vào điểm TB.
          </div>
        </div>
      </div>

      {/* 20% Mục Tiêu Chiến Lược Cấp Công Ty (Tách riêng khỏi điểm TB) */}
      <Panel title="Mục tiêu chiến lược cấp công ty (20%)" count="Tham khảo · không tính điểm TB">
        <div className="mb-3 flex items-start gap-2 rounded-[10px] border border-status-info-line bg-status-info-soft p-2.5 text-[11.5px] leading-relaxed text-status-info">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            <strong>Quy định HR:</strong> Nhân viên tham khảo danh mục mục tiêu công ty (20%) để định hướng.{' '}
            <strong>Phần 20% này không tính vào công thức điểm trung bình của cá nhân.</strong>
          </span>
        </div>

        {data.companyObjectives.length === 0 ? (
          <div className="py-3 text-xs text-ink-muted">HR chưa cấu hình mục tiêu công ty cho chu kỳ này.</div>
        ) : (
          data.companyObjectives.map((obj, idx) => (
            <div key={obj.id} className="rounded-[11px] border border-line bg-canvas p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="text-[12.5px] font-bold text-ink">
                  {idx + 1}. {obj.title}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant={obj.category === 'BUSINESS' ? 'accent' : 'ok'}>{obj.category}</Badge>
                  <span className="font-mono text-[13px] font-extrabold text-accent">{obj.progress}%</span>
                </div>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-line">
                <div className="h-full rounded-full bg-accent" style={{ width: `${obj.progress}%` }} />
              </div>
              <div className="mt-1.5 text-[10.5px] text-ink-muted">{obj.note}</div>
            </div>
          ))
        )}
      </Panel>
    </div>
  );
};

/**
 * Panel dùng chung — header tiêu đề + số đếm, thân padding 14–16px. Khác `Card` cũ ở
 * chỗ viền bo 13px và header tách viền, khớp mockup `.panel`.
 */
const Panel: React.FC<{
  title: string;
  count?: string;
  children: React.ReactNode;
}> = ({ title, count, children }) => (
  <div className="overflow-hidden rounded-[13px] border border-line bg-surface shadow-2xs">
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-line px-4 py-3">
      <Target className="h-[15px] w-[15px] shrink-0 text-accent" />
      <span className="text-[13.5px] font-bold tracking-[-0.01em] text-ink">{title}</span>
      {count && (
        <span className="ml-auto font-mono text-[10.5px] text-ink-muted sm:whitespace-nowrap">{count}</span>
      )}
    </div>
    <div className="p-4">{children}</div>
  </div>
);
