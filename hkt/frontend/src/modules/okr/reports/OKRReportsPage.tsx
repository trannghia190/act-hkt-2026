import React, { useCallback, useEffect, useState } from 'react';
import { Panel } from '../../../components/common/Panel';
import { AlertTriangle, Download, FileBarChart, Lock } from 'lucide-react';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { Modal } from '../../../components/common/Modal';
import { OkrAssessmentDetailModal } from './OkrAssessmentDetailModal';

interface HRRecord {
  stt: number;
  fullName: string;
  employeeCode: string;
  jobTitle: string;
  seniority: string;
  newJoiner?: boolean;
  monthsWorked?: number | null;
  seniorityNote?: string | null;
  department: string;
  directManagerName: string;
  selfBusinessScore?: number | null;
  selfPeopleScore?: number | null;
  businessScore?: number | null;
  peopleScore?: number | null;
  averageScore?: number | null;
  scoreSource?: 'MANAGER' | 'SELF' | null;
  status: string;
  note?: string | null;
  reviewId?: string | null;
  joinedDate?: string | null;
  managerComment?: string | null;
}

interface RiskRow {
  reviewId: string;
  employeeCode: string;
  fullName: string;
  warnings: { code: string; level: string; message: string }[];
}

interface DepartmentStat {
  total: number;
  submitted: number;
  averageScore?: number | null;
}

interface SummaryData {
  year: number;
  cycleId?: string | null;
  cycleStatus?: string | null;
  seniorityCutoff?: string;
  pendingNoOkr?: number;
  pendingManagerAssessments?: number;
  records: HRRecord[];
  summaryText: string;
  summaryParts?: { widget: string; text: string }[];
  risks: RiskRow[];
  widgets: {
    totalEmployees: number;
    noOkr?: number;
    submitted: number;
    managerAssessed: number;
    notSubmitted: { employeeCode: string; fullName: string; department: string }[];
    byDepartment: Record<string, DepartmentStat>;
    distribution: Record<string, number>;
    companyAverage: number | null;
  };
}

const statusLabel = (status: string) => {
  if (status === 'DA_HOAN_TAT') return 'Đã chấm xong';
  if (status === 'CHO_QL_CHAM') return 'Chờ QL chấm';
  if (status === 'CHUA_CO_OKR') return 'Chưa có OKR được duyệt';
  return 'Chưa tự đánh giá';
};

const WIDGET_ANCHOR: Record<string, string> = {
  progress: '#widget-progress',
  notSubmitted: '#widget-not-submitted',
  distribution: '#widget-distribution',
  byDepartment: '#widget-avg-by-team',
  risks: '#risk-list',
};

const statusVariant = (status: string) => status === 'DA_HOAN_TAT' ? 'ok' : status === 'CHO_QL_CHAM' ? 'warn' : 'gray';

export const OKRReportsPage: React.FC = () => {
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [toast, setToast] = useState<string | null>(null);
  const [locking, setLocking] = useState(false);
  const [lockOpen, setLockOpen] = useState(false);
  const [lockReason, setLockReason] = useState('');
  // HR xem lại nội dung form đánh giá của 1 nhân viên (chỉ đọc).
  const [detailRecord, setDetailRecord] = useState<HRRecord | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  // Mốc tính thời gian công tác (doc: "tới 31/12/2026 hoặc 2027 tùy chỉnh"); rỗng = theo cấu hình chu kỳ
  const [cutoff, setCutoff] = useState('');
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});
  const query = (extra = '') => {
    const params = new URLSearchParams();
    if (data?.year) params.set('year', String(data.year));
    if (cutoff) params.set('cutoff', cutoff);
    const q = params.toString();
    return q ? `?${q}${extra}` : extra ? `?${extra.slice(1)}` : '';
  };

  const saveNote = async (r: HRRecord) => {
    if (!r.reviewId) return;
    const note = noteDraft[r.employeeCode] ?? r.note ?? '';
    if (note === (r.note ?? '')) return;
    try {
      const res = await fetch(`/api/v1/okr/admin/reviews/${r.reviewId}/note`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || 'Không lưu được Note');
      setData((prev) => prev && { ...prev, records: prev.records.map((x) => (x.employeeCode === r.employeeCode ? { ...x, note } : x)) });
      showToast(`Đã lưu Note cho ${r.fullName}`);
    } catch (err: any) {
      showToast(err.message || 'Không lưu được Note');
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/okr/admin/hr-summary${cutoff ? `?cutoff=${cutoff}` : ''}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || 'Không tải được báo cáo');
      setData(json.data);
    } catch (err: any) {
      showToast(err.message || 'Không tải được báo cáo OKR');
    } finally {
      setLoading(false);
    }
  }, [cutoff]);

  useEffect(() => { load(); }, [load]);

  const exportExcel = async () => {
    try {
      const res = await fetch(`/api/v1/okr/admin/export-excel-file${query()}`);
      if (!res.ok) throw new Error('Không xuất được file Excel');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Bao_Cao_Tong_Hop_OKR_${data?.year ?? ''}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Đã xuất file Excel báo cáo OKR');
    } catch (err: any) {
      showToast(err.message || 'Không xuất được file Excel');
    }
  };

  const lockBlockers = (() => {
    const list: string[] = [];
    if (data?.pendingManagerAssessments) list.push(`${data.pendingManagerAssessments} hồ sơ chưa được Quản lý chấm xong`);
    if (data?.pendingNoOkr) list.push(`${data.pendingNoOkr} nhân sự active chưa có OKR`);
    return list;
  })();

  const openLock = () => {
    if (!data?.cycleId) { showToast('Không tìm thấy chu kỳ của báo cáo'); return; }
    setLockReason('');
    setLockOpen(true);
  };

  const submitLock = async () => {
    if (!data?.cycleId) return;
    if (lockBlockers.length > 0 && !lockReason.trim()) {
      showToast('Còn điều kiện chưa đạt — bắt buộc nhập lý do chốt sớm');
      return;
    }
    setLocking(true);
    try {
      const res = await fetch(`/api/v1/okr/cycles/${data.cycleId}/lock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: lockBlockers.length > 0, reason: lockReason.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || 'Không khoá được chu kỳ');
      showToast(`Đã chốt & khoá chu kỳ OKR ${data.year}`);
      setLockOpen(false);
      load();
    } catch (err: any) {
      showToast(err.message || 'Không khoá được chu kỳ');
    } finally {
      setLocking(false);
    }
  };

  const records = data?.records || [];
  const filtered = records.filter((r) => {
    if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!`${r.fullName} ${r.employeeCode} ${r.department} ${r.jobTitle}`.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-5 pb-12">
      {toast && <div className="fixed top-16 right-6 z-[100] bg-ink text-canvas px-4 py-2.5 rounded-lg text-xs font-semibold shadow-lg">{toast}</div>}

      {/* Đầu trang — mockup `.phead` */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-accent-dark">
            <FileBarChart className="h-3.5 w-3.5" />
            Báo cáo OKR
          </div>
          <h1 className="mt-1.5 font-display text-xl font-extrabold tracking-tight text-ink sm:text-[23px]">
            Báo cáo tổng hợp OKR — 9 trường
          </h1>
          <p className="mt-1 text-xs text-ink-muted">
            Bảng tổng hợp HR · thời gian công tác tự tính · 4 widget · tóm tắt C15 · rủi ro · export Excel.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-[11px] text-ink-muted" title="Thời gian công tác tính từ ngày vào làm tới mốc này. Để trống = theo cấu hình chu kỳ (mặc định 31/12).">
            Tính công tác tới
            <input
              type="date"
              aria-label="Mốc tính thời gian công tác"
              value={cutoff || data?.seniorityCutoff || ''}
              onChange={(e) => setCutoff(e.target.value)}
              className="h-8 rounded-[10px] border border-line bg-surface px-2.5 text-xs text-ink focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/20"
            />
          </label>
          <Button size="md" variant="outline" onClick={exportExcel}>
            <Download className="h-3.5 w-3.5" /> Xuất Excel
          </Button>
          {data?.cycleStatus !== 'closed' && (
            <Button size="md" variant="outline" onClick={openLock} disabled={locking}>
              <Lock className="h-3.5 w-3.5" />
              {locking ? 'Đang khoá...' : 'Chốt & khoá chu kỳ'}
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <Panel hideHeader bodyClassName="p-8"><div className="text-center text-xs text-ink-muted">Đang tải báo cáo...</div></Panel>
      ) : !data ? (
        <Panel hideHeader bodyClassName="p-8"><div className="text-center text-xs text-ink-muted">Không có dữ liệu báo cáo.</div></Panel>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <div className="rounded-[13px] border border-line bg-surface p-3.5 shadow-2xs">
              <div className="text-[10px] font-extrabold uppercase tracking-[0.06em] text-ink-muted">
                Tổng nhân sự{data.widgets.noOkr ? ` (${data.widgets.noOkr} chưa có OKR)` : ''}
              </div>
              <div className="mt-2 font-display text-[24px] font-extrabold leading-none tracking-[-0.035em] text-ink">
                {data.widgets.totalEmployees}
              </div>
            </div>
            <div className="rounded-[13px] border border-line bg-surface p-3.5 shadow-2xs">
              <div className="text-[10px] font-extrabold uppercase tracking-[0.06em] text-ink-muted">Đã nộp / tự đánh giá</div>
              <div className="mt-2 font-display text-[24px] font-extrabold leading-none tracking-[-0.035em] text-accent">
                {data.widgets.submitted}/{data.widgets.totalEmployees}
              </div>
            </div>
            <div className="rounded-[13px] border border-line bg-surface p-3.5 shadow-2xs">
              <div className="text-[10px] font-extrabold uppercase tracking-[0.06em] text-ink-muted">Quản lý đã chấm</div>
              <div className="mt-2 font-display text-[24px] font-extrabold leading-none tracking-[-0.035em] text-ink">
                {data.widgets.managerAssessed}
              </div>
            </div>
            <div className="rounded-[13px] border border-line bg-surface p-3.5 shadow-2xs">
              <div className="text-[10px] font-extrabold uppercase tracking-[0.06em] text-ink-muted">Điểm TB toàn công ty</div>
              <div className="mt-2 font-display text-[24px] font-extrabold leading-none tracking-[-0.035em] text-accent">
                {data.widgets.companyAverage ?? '—'}
              </div>
            </div>
          </div>

          <Panel
            title="Tóm tắt báo cáo (C15)"
            className="border-accent-line bg-accent-soft/25"
          >
            <div className="text-xs text-ink-secondary leading-relaxed space-y-0.5">
              {(data.summaryParts && data.summaryParts.length > 0)
                ? data.summaryParts.map((p, i) => (
                    <div key={i}>
                      {p.text}{' '}
                      {WIDGET_ANCHOR[p.widget] && (
                        <a href={WIDGET_ANCHOR[p.widget]} className="text-accent hover:underline text-[11px]">(xem nguồn)</a>
                      )}
                    </div>
                  ))
                : data.summaryText}
            </div>
            <div className="flex flex-wrap gap-3 text-[11px] font-semibold">
              <a href="#widget-progress" className="text-accent hover:underline">→ Tiến độ nộp theo nhóm</a>
              <a href="#widget-distribution" className="text-accent hover:underline">→ Phân bố điểm</a>
              <a href="#widget-avg-by-team" className="text-accent hover:underline">→ Điểm TB theo nhóm</a>
              <a href="#widget-not-submitted" className="text-accent hover:underline">→ Danh sách chưa nộp</a>
              <a href="#report-table" className="text-accent hover:underline">→ Bảng 9 trường</a>
              <a href="#risk-list" className="text-accent hover:underline">→ Danh sách rủi ro ({data.risks.length})</a>
            </div>
          </Panel>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div id="widget-progress">
            <Panel title="Tiến độ nộp theo nhóm">
              {Object.entries(data.widgets.byDepartment).length === 0 ? <div className="text-xs text-ink-muted py-3">Chưa có dữ liệu.</div> : Object.entries(data.widgets.byDepartment).map(([dept, stat]) => (
                <div key={dept} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-ink-secondary">{dept}</span>
                    <span className="text-ink-muted">{stat.submitted}/{stat.total} đã nộp</span>
                  </div>
                  <div className="h-1.5 bg-line rounded-full overflow-hidden"><div className="h-full bg-accent" style={{ width: `${stat.total ? (stat.submitted * 100 / stat.total) : 0}%` }} /></div>
                </div>
              ))}
            </Panel>
            </div>

            <div id="widget-distribution">
            <Panel title="Phân bố điểm TB (bản đã chốt)">
              {[1, 2, 3, 4, 5].map((score) => {
                const count = data.widgets.distribution[String(score)] || 0;
                const max = Math.max(1, ...Object.values(data.widgets.distribution));
                return (
                  <div key={score} className="flex items-center gap-2">
                    <span className="w-5 text-xs font-bold text-ink">{score}</span>
                    <div className="flex-1 h-2 bg-line rounded-full overflow-hidden"><div className="h-full bg-accent" style={{ width: `${(count * 100) / max}%` }} /></div>
                    <span className="w-6 text-right text-[11px] text-ink-muted">{count}</span>
                  </div>
                );
              })}
            </Panel>
            </div>
          </div>

          {/* Widget 4 — Điểm TB theo nhóm (chỉ tính bản đã chốt) */}
          <div id="widget-avg-by-team">
          <Panel title="Điểm TB theo nhóm (bản đã chốt)">
            {Object.entries(data.widgets.byDepartment).length === 0 ? <div className="text-xs text-ink-muted py-3">Chưa có dữ liệu.</div> : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {Object.entries(data.widgets.byDepartment)
                  .sort(([, a], [, b]) => (b.averageScore ?? -1) - (a.averageScore ?? -1))
                  .map(([dept, stat]) => (
                    <div key={dept} className="rounded-lg border border-line bg-canvas p-2.5 flex items-center justify-between">
                      <span className="text-xs text-ink-secondary">{dept}</span>
                      <span className={`text-lg font-black ${stat.averageScore == null ? 'text-ink-muted' : 'text-accent'}`}>
                        {stat.averageScore ?? '—'}
                      </span>
                    </div>
                  ))}
              </div>
            )}
            {data.widgets.companyAverage != null && (
              <div className="text-[11px] text-ink-muted">TB toàn công ty: <b className="text-ink">{data.widgets.companyAverage}</b></div>
            )}
          </Panel>
          </div>

          {data.widgets.notSubmitted.length > 0 && (
            <div id="widget-not-submitted">
            <Panel title={`Chưa tự đánh giá (${data.widgets.notSubmitted.length})`}>
              <div className="flex flex-wrap gap-1.5">
                {data.widgets.notSubmitted.map((e) => (
                  <span key={e.employeeCode} className="rounded-full border border-status-warn-line bg-status-warn-soft px-2 py-0.5 text-[11px] text-status-warn">{e.fullName} ({e.employeeCode})</span>
                ))}
              </div>
            </Panel>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm tên, mã NV, phòng ban..." aria-label="Tìm nhân viên" className="w-full rounded-[10px] border border-line bg-canvas px-3 py-2 text-xs text-ink focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/20 sm:w-64" />
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Lọc theo trạng thái" className="cursor-pointer rounded-[10px] border border-line bg-canvas px-2.5 py-2 text-xs text-ink focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/20">
                <option value="ALL">Tất cả trạng thái</option>
                <option value="CHUA_CO_OKR">Chưa có OKR được duyệt</option>
                <option value="CHUA_TU_DANH_GIA">Chưa tự đánh giá</option>
                <option value="CHO_QL_CHAM">Chờ QL chấm</option>
                <option value="DA_HOAN_TAT">Đã chấm xong</option>
              </select>
            </div>
            <span className="font-mono text-[10.5px] text-ink-muted">{filtered.length} nhân sự</span>
          </div>

          <div id="report-table" className="bg-surface rounded-xl border border-line overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
                <thead>
                  <tr className="border-b border-line bg-canvas">
                    <th className="py-3 px-3">STT</th>
                    <th className="py-3 px-3">Họ và tên</th>
                    <th className="py-3 px-3">Mã NV</th>
                    <th className="py-3 px-3">Vị trí</th>
                    <th className="py-3 px-3">Thời gian công tác</th>
                    <th className="py-3 px-3">Phòng ban</th>
                    <th className="py-3 px-3">Quản lý</th>
                    <th className="py-3 px-3 text-center" title="Điểm chính thức do Quản lý chấm">Điểm công việc</th>
                    <th className="py-3 px-3 text-center" title="Điểm chính thức do Quản lý chấm">Điểm con người</th>
                    <th className="py-3 px-3 text-center">Điểm TB</th>
                    <th className="py-3 px-3 min-w-[180px]">Note</th>
                    <th className="py-3 px-3 text-center">Trạng thái</th>
                    <th className="py-3 px-3 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filtered.length === 0 ? (
                    <tr><td colSpan={13} className="py-8 text-center text-ink-muted">Không có dữ liệu phù hợp.</td></tr>
                  ) : filtered.map((r) => (
                    <tr key={r.employeeCode} className="hover:bg-canvas/40">
                      <td className="py-2.5 px-3 text-ink-muted">{r.stt}</td>
                      <td className="py-2.5 px-3 font-semibold text-ink">{r.fullName}</td>
                      <td className="py-2.5 px-3 font-mono text-ink-secondary">{r.employeeCode}</td>
                      <td className="py-2.5 px-3 text-ink-secondary">{r.jobTitle || '—'}</td>
                      <td className="py-2.5 px-3 text-ink-secondary" title={r.seniorityNote || (r.joinedDate ? `Vào làm ${r.joinedDate}` : undefined)}>
                        <div className="flex items-center gap-1.5">
                          <span>{r.seniority}</span>
                          {r.newJoiner && <Badge variant="warn">Mới</Badge>}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-ink-secondary">{r.department || '—'}</td>
                      <td className="py-2.5 px-3 text-ink-secondary">{r.directManagerName || '—'}</td>
                      {(['businessScore', 'peopleScore'] as const).map((k) => (
                        <td key={k} className="py-2.5 px-3 text-center">
                          <div className="font-bold">{r[k] ?? '—'}</div>
                        </td>
                      ))}
                      <td className="py-2.5 px-3 text-center font-black text-accent">{r.averageScore != null ? r.averageScore.toFixed(1) : '—'}</td>
                      <td className="py-2.5 px-3">
                        {r.reviewId && data?.cycleStatus !== 'closed' ? (
                          <input
                            value={noteDraft[r.employeeCode] ?? r.note ?? ''}
                            onChange={(e) => setNoteDraft({ ...noteDraft, [r.employeeCode]: e.target.value })}
                            onBlur={() => saveNote(r)}
                            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                            placeholder="Ghi chú HR…"
                            title={r.managerComment ? `Nhận xét QL: ${r.managerComment}` : undefined}
                            className="w-full border border-line rounded-md px-2 py-1 text-xs bg-canvas focus:outline-none focus:border-accent"
                          />
                        ) : (
                          <span className="text-ink-secondary">{r.note || '—'}</span>
                        )}
                        {r.managerComment && <div className="text-[10px] text-ink-muted mt-0.5 truncate max-w-[220px]">QL: {r.managerComment}</div>}
                      </td>
                      <td className="py-2.5 px-3 text-center"><Badge variant={statusVariant(r.status) as any}>{statusLabel(r.status)}</Badge></td>
                      <td className="py-2.5 px-3 text-center">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!r.reviewId}
                          title={r.reviewId ? 'Xem nội dung form đánh giá (chỉ đọc)' : 'Nhân viên chưa có hồ sơ đánh giá'}
                          onClick={() => setDetailRecord(r)}
                        >
                          Xem chi tiết
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div id="risk-list">
          <Panel title={`Danh sách OKR rủi ro theo rule (${data.risks.length})`}>
            {data.risks.length === 0 ? <div className="py-2 text-xs text-ink-muted">Không có cảnh báo.</div> : data.risks.map((r) => (
              <div key={r.reviewId} className="space-y-0.5 rounded-lg border border-status-warn-line bg-status-warn-soft p-2.5 text-[11px] text-status-warn">
                <div className="font-semibold">{r.fullName} ({r.employeeCode})</div>
                {r.warnings.map((w, idx) => (
                  <div key={idx} className="flex items-start gap-1.5">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                    <span>{w.message}</span>
                  </div>
                ))}
              </div>
            ))}
          </Panel>
          </div>
        </>
      )}

      <Modal isOpen={lockOpen} onClose={() => setLockOpen(false)} title="Chốt & khoá chu kỳ OKR" maxWidth="md">
        <div className="space-y-3">
          {lockBlockers.length === 0 ? (
            <div className="rounded-lg border border-status-ok-line bg-status-ok-soft p-2.5 text-[11px] text-status-ok">
              Đã đủ điều kiện: Quản lý chấm xong, không còn nhân sự chưa có OKR.
            </div>
          ) : (
            <>
              <div className="rounded-lg border border-status-warn-line bg-status-warn-soft p-2.5 text-[11px] text-status-warn space-y-0.5">
                <div className="font-semibold">Còn điều kiện chưa đạt:</div>
                {lockBlockers.map((b, i) => <div key={i}>• {b}</div>)}
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink mb-1">Lý do chốt sớm <span className="text-danger">*</span></label>
                <textarea
                  rows={3}
                  value={lockReason}
                  onChange={(e) => setLockReason(e.target.value)}
                  placeholder="Ví dụ: Chốt theo chỉ đạo Ban Giám đốc, các hồ sơ còn lại đã xử lý ngoài hệ thống..."
                  className="w-full border border-line rounded-lg p-2.5 text-xs bg-canvas"
                />
              </div>
            </>
          )}
          <div className="flex justify-end gap-2 pt-2 border-t border-line">
            <Button size="sm" variant="ghost" onClick={() => setLockOpen(false)}>Huỷ</Button>
            <Button
              size="sm"
              variant="primary"
              onClick={submitLock}
              disabled={locking || (lockBlockers.length > 0 && !lockReason.trim())}
            >
              {locking ? 'Đang khoá...' : 'Xác nhận chốt & khoá'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* HR xem lại form đánh giá của nhân viên — chỉ đọc */}
      <OkrAssessmentDetailModal
        employeeCode={detailRecord?.employeeCode ?? null}
        employeeName={detailRecord?.fullName}
        onClose={() => setDetailRecord(null)}
        onToast={showToast}
      />
    </div>
  );
};
