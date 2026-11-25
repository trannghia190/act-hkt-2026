import React, { useEffect, useState } from 'react';
import { Card } from '../../../components/common/Card';
import { Badge } from '../../../components/common/Badge';

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
    <div className="space-y-6">
      {error && (
        <div className="p-3 rounded-lg border border-rose-200 bg-rose-50 text-xs text-rose-700">{error}</div>
      )}
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-ink">
              Bảng Điều Khiển Mục Tiêu &amp; Hiệu Suất (OKR Dashboard)
            </h1>
          </div>
          <p className="text-xs text-ink-muted mt-1">
            Theo form HR: OKR gồm 2 nhóm Business &amp; People (thang 1–5), điểm TB tự tính. Phần 20% công ty không tính vào TB.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={year ?? data.cycleYear}
            onChange={(e) => setYear(Number(e.target.value))}
            className="text-xs p-2 border border-line rounded-lg bg-surface font-semibold text-ink"
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
      <div className="p-4 rounded-xl border border-accent/40 bg-gradient-to-r from-accent-soft/40 via-surface to-accent-soft/20 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-accent text-white">
              Phase Hiện Tại: {data.currentPhase}
            </span>
            <span className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full animate-pulse">
              ⏱ {data.countdownText}
            </span>
          </div>
          <div className="text-sm font-bold text-ink">{data.phaseTitle}</div>
          {data.checkinPeriod && data.checkinDeadline && data.canCheckIn && (
            <div className="text-xs text-ink-muted">
              Check-in kỳ <strong>{data.checkinPeriod}</strong>: hạn <strong>{data.checkinDeadline}</strong> ·{' '}
              {data.pendingCheckinCount} đầu việc chưa cập nhật.
            </div>
          )}
        </div>

        {/* Nút Check-in nổi bật khi đến kỳ; ngoài ra luôn cho biết trạng thái check-in */}
        {data.checkinState === 'OPEN' ? (
          <a
            href="/okr/my-okr?checkin=1"
            className="inline-flex flex-col items-center justify-center px-5 py-3 rounded-xl bg-accent hover:bg-accent-dark text-white font-bold text-sm shadow-md transition-all transform hover:-translate-y-0.5 text-center shrink-0 animate-pulse"
          >
            <span>🚀 Check-in Tiến Độ Ngay</span>
            <span className="text-[11px] font-medium opacity-90">
              Kỳ {data.checkinPeriod} · còn {data.pendingCheckinCount} đầu việc
            </span>
          </a>
        ) : data.checkinState && data.checkinState !== 'CLOSED' ? (
          <div
            className={`shrink-0 rounded-xl border px-4 py-2.5 text-xs font-semibold text-center ${
              data.checkinState === 'DONE'
                ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                : 'border-amber-300 bg-amber-50 text-amber-800'
            }`}
          >
            {data.checkinState === 'DONE' ? '✓ ' : '⏳ '}
            {data.checkinStateText}
            {data.checkinState === 'DONE' && data.checkinDeadline && (
              <div className="text-[11px] font-normal opacity-80">Kỳ tiếp theo mở sau {data.checkinDeadline}</div>
            )}
          </div>
        ) : null}
      </div>

      {/* Card Định hướng & đề xuất của kỳ (trạng thái + nút xem) */}
      <div className="p-4 rounded-xl border border-line bg-surface flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="text-sm font-bold text-ink">
              Định hướng &amp; đề xuất kỳ {data.selfProposal.year}
            </div>
            <Badge variant={proposalBadgeVariant}>
              {data.selfProposal.statusText}
            </Badge>
          </div>
          <div className="text-xs text-ink-secondary">
            Khai báo cùng bộ mục tiêu và gửi Quản lý duyệt
            {data.selfProposal.deadline && (
              <> · Hạn chót nộp: {data.selfProposal.deadline} (Còn {data.selfProposal.daysLeft} ngày)</>
            )}
          </div>
        </div>
        <a
          href={data.selfProposal.viewUrl}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-line hover:border-accent hover:text-accent bg-canvas text-ink self-start sm:self-center transition-colors"
        >
          {data.selfProposal.status === 'SUBMITTED' || !data.selfProposal.editable
            ? 'Xem nội dung'
            : data.selfProposal.status === 'NOT_STARTED'
            ? 'Viết ngay'
            : 'Tiếp tục viết'}{' '}
          →
        </a>
      </div>

      {/* Card Việc cần làm với OKR (chấm, cập nhật, chờ duyệt) */}
      <Card title={`Việc Cần Làm Với OKR (${data.todos.length})`}>
        <div className="divide-y divide-line/60">
          {data.todos.map((todo) => (
            <div
              key={todo.id}
              className="py-3 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      todo.priority === 'HIGH'
                        ? 'bg-rose-500'
                        : todo.priority === 'MEDIUM'
                        ? 'bg-amber-500'
                        : 'bg-blue-500'
                    }`}
                  />
                  <span className="text-xs font-bold text-ink">{todo.title}</span>
                  {todo.deadline && (
                    <span className="text-[11px] text-ink-muted">
                      · Hạn: {todo.deadline} ({todo.daysLeft} ngày nữa)
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-ink-secondary pl-4">
                  {todo.status === 'WAITING'
                    ? 'Đã gửi duyệt — chờ cấp quản lý phê duyệt'
                    : todo.status === 'DRAFT'
                    ? 'Bản nháp đang viết — cần hoàn thiện để nộp'
                    : 'Chưa hoàn tất — cần xử lý trước hạn chót'}
                </div>
              </div>
              <a
                href={todo.actionUrl}
                className="self-start sm:self-center text-xs font-semibold px-3 py-1.5 rounded-lg bg-accent/10 text-accent hover:bg-accent hover:text-white transition-colors"
              >
                {todo.actionText}
              </a>
            </div>
          ))}
          {data.todos.length === 0 && (
            <div className="text-xs text-ink-muted">Không có việc nào cần làm với OKR lúc này.</div>
          )}
        </div>
      </Card>

      <div className="text-[11px] text-ink-muted -mb-3">{scoreSourceText}</div>

      {/* 2 Nhóm Điểm (Business + People) + Điểm Trung Bình Tự Tính */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Nhóm Business */}
        <div className="p-4 bg-surface rounded-xl border border-line shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-ink-muted">BUSINESS (CÔNG VIỆC)</span>
            <Badge variant="ok">Tiến độ: {data.businessProgress}%</Badge>
          </div>
          <div className="text-xs text-ink-secondary">Thành tựu công việc &amp; dự án</div>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-3xl font-black text-ink">{formatScore(data.businessScore)}</span>
            <span className="text-xs text-ink-muted">/ 5.0</span>
          </div>
          <div className="w-full bg-line rounded-full h-2">
            <div
              className="bg-accent h-2 rounded-full"
              style={{ width: `${data.businessProgress}%` }}
            />
          </div>
        </div>

        {/* Nhóm People */}
        <div className="p-4 bg-surface rounded-xl border border-line shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-ink-muted">PEOPLE (CON NGƯỜI)</span>
            <Badge variant="ok">Tiến độ: {data.peopleProgress}%</Badge>
          </div>
          <div className="text-xs text-ink-secondary">Thành tựu con người &amp; đội ngũ</div>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-3xl font-black text-ink">{formatScore(data.peopleScore)}</span>
            <span className="text-xs text-ink-muted">/ 5.0</span>
          </div>
          <div className="w-full bg-line rounded-full h-2">
            <div
              className="bg-emerald-600 h-2 rounded-full"
              style={{ width: `${data.peopleProgress}%` }}
            />
          </div>
        </div>

        {/* Điểm TB Tự Tính */}
        <div className="p-4 bg-accent-soft/30 rounded-xl border border-accent/40 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-accent-dark">ĐIỂM TRUNG BÌNH OKR</span>
            <Badge variant="accent">Tự tính 100%</Badge>
          </div>
          <div className="text-xs text-ink-secondary">
            =(Business + People) / 2 · Không điểm lẻ
          </div>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-4xl font-black text-accent">{formatScore(data.averageScore)}</span>
            <span className="text-xs text-ink-muted">/ 5.0</span>
          </div>
          <div className="text-[11px] text-accent-dark font-medium">
            ✓ Chỉ tính từ 2 nhóm cá nhân. Mục tiêu công ty (20%) không tính vào TB.
          </div>
        </div>
      </div>

      {/* 20% Mục Tiêu Chiến Lược Cấp Công Ty (Tách riêng khỏi điểm TB) */}
      <Card
        title="Mục Tiêu Chiến Lược Cấp Công Ty (20%)"
        action={
          <span className="text-[11px] font-semibold text-ink-muted bg-canvas border border-line px-2 py-1 rounded">
            Tham khảo · KHÔNG tính vào điểm TB cá nhân
          </span>
        }
      >
        <div className="space-y-3">
          <div className="p-3 bg-canvas/60 rounded-lg border border-line text-xs text-ink-secondary">
            📌 <strong>Quy định HR:</strong> Nhân viên tham khảo danh mục mục tiêu công ty (20%) để định hướng. <strong>Phần 20% này không tính vào công thức điểm trung bình của cá nhân</strong>.
          </div>
          {data.companyObjectives.length === 0 && (
            <div className="text-xs text-ink-muted">HR chưa cấu hình mục tiêu công ty cho chu kỳ này.</div>
          )}

          {data.companyObjectives.map((obj, idx) => (
            <div
              key={obj.id}
              className="p-3 rounded-xl border border-line bg-surface space-y-2 text-xs"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div className="font-bold text-ink">
                  {idx + 1}. {obj.title}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={obj.category === 'BUSINESS' ? 'accent' : 'ok'}>
                    {obj.category}
                  </Badge>
                  <span className="font-bold text-accent">{obj.progress}%</span>
                </div>
              </div>
              <div className="w-full bg-line rounded-full h-1.5">
                <div
                  className="bg-accent h-1.5 rounded-full"
                  style={{ width: `${obj.progress}%` }}
                />
              </div>
              <div className="text-[11px] text-ink-muted italic">{obj.note}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
