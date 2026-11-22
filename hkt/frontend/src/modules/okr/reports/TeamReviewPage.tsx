import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../../components/common/Card';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { Modal } from '../../../components/common/Modal';

interface TeamReviewRow {
  reviewId: string;
  employeeCode: string;
  fullName: string;
  team?: string;
  jobTitle?: string;
  status: string;
  okrStatus?: string;
  businessProgress: number;
  peopleProgress: number;
  overallProgress: number;
  selfBusiness?: number | null;
  selfPeople?: number | null;
  selfAverage?: number | null;
  managerBusiness?: number | null;
  managerPeople?: number | null;
  managerAverage?: number | null;
  proposedScore: number;
  gap?: number | null;
  warningCount: number;
  warnings: { code: string; level: string; message: string }[];
  riskScore: number;
  checkinCount: number;
  lastCheckinAt?: string | null;
}

const statusLabel = (status: string) => {
  if (status === 'DA_HOAN_TAT') return 'Đã chấm xong';
  if (status === 'CHO_QL_CHAM') return 'Chờ QL chấm';
  return 'Chưa tự đánh giá';
};

const statusVariant = (status: string) => status === 'DA_HOAN_TAT' ? 'ok' : status === 'CHO_QL_CHAM' ? 'warn' : 'gray';

export const TeamReviewPage: React.FC = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState<TeamReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [teamFilter, setTeamFilter] = useState('ALL');
  const [warningOnly, setWarningOnly] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulk, setBulk] = useState({ business: 4, people: 4, comment: '' });
  const [saving, setSaving] = useState(false);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/okr/team-review');
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || 'Không tải được bảng review');
      setRows(json.data || []);
    } catch (err: any) {
      showToast(err.message || 'Không tải được bảng review');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const teams = Array.from(new Set(rows.map((r) => r.team).filter(Boolean))) as string[];
  const displayed = rows.filter((r) => {
    if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
    if (teamFilter !== 'ALL' && (r.team || '') !== teamFilter) return false;
    if (warningOnly && r.warningCount === 0) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!`${r.fullName} ${r.employeeCode} ${r.team || ''}`.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const toggleAll = () => {
    if (displayed.every((r) => selected.has(r.reviewId))) {
      setSelected(new Set());
    } else {
      setSelected(new Set(displayed.map((r) => r.reviewId)));
    }
  };

  const submitBulk = async () => {
    if (selected.size === 0) { showToast('Chọn ít nhất 1 nhân viên'); return; }
    if (!bulk.comment.trim()) { showToast('Nhận xét là bắt buộc khi chấm hàng loạt'); return; }
    setSaving(true);
    let ok = 0;
    const failures: string[] = [];
    try {
      for (const reviewId of Array.from(selected)) {
        const res = await fetch(`/api/v1/okr/reviews/${reviewId}/manager-assess`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            managerBusinessScore: bulk.business,
            managerPeopleScore: bulk.people,
            managerComment: bulk.comment,
          }),
        });
        if (res.ok) ok++;
        else {
          const json = await res.json().catch(() => null);
          failures.push(json?.message || `Lỗi ${res.status}`);
        }
      }
      showToast(
        failures.length
          ? `Đã chấm ${ok}/${selected.size} nhân viên — ${failures.length} lỗi: ${Array.from(new Set(failures)).join('; ')}`
          : `Đã chấm ${ok}/${selected.size} nhân viên`
      );
      setBulkOpen(false);
      setSelected(new Set());
      load();
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi chấm hàng loạt');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 max-w-6xl mx-auto pb-12">
      {toast && <div className="fixed top-16 right-6 z-50 bg-ink text-canvas px-4 py-2.5 rounded-lg text-xs font-semibold shadow-lg">{toast}</div>}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink">Review OKR Cả Nhóm</h1>
          <p className="text-xs text-ink-muted mt-1">1 bảng thay vì mở từng objective · điểm đề xuất theo rule · cảnh báo rủi ro · chấm hàng loạt.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={load}>↻ Tải lại</Button>
          <Button size="sm" variant="primary" onClick={() => setBulkOpen(true)} disabled={selected.size === 0}>
            Chấm hàng loạt ({selected.size})
          </Button>
        </div>
      </div>

      <Card className="space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm tên, mã NV, nhóm..."
              className="text-xs px-3 py-1.5 rounded-lg border border-line bg-canvas text-ink focus:outline-none focus:border-accent w-full sm:w-64"
            />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="text-xs px-2.5 py-1.5 rounded-lg border border-line bg-canvas text-ink">
              <option value="ALL">Tất cả trạng thái</option>
              <option value="CHUA_TU_DANH_GIA">Chưa tự đánh giá</option>
              <option value="CHO_QL_CHAM">Chờ QL chấm</option>
              <option value="DA_HOAN_TAT">Đã chấm xong</option>
            </select>
            <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)} className="text-xs px-2.5 py-1.5 rounded-lg border border-line bg-canvas text-ink">
              <option value="ALL">Tất cả nhóm</option>
              {teams.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <label className="inline-flex items-center gap-1.5 text-xs text-ink-secondary">
              <input type="checkbox" checked={warningOnly} onChange={(e) => setWarningOnly(e.target.checked)} />
              Chỉ có cảnh báo
            </label>
          </div>
          <div className="text-xs text-ink-muted">Sắp xếp theo rủi ro giảm dần · {displayed.length} nhân viên</div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-ink-muted">Đang tải bảng review...</div>
        ) : displayed.length === 0 ? (
          <div className="p-8 text-center text-xs text-ink-muted">Không có nhân viên phù hợp.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-canvas text-ink-secondary">
                  <th className="p-2.5 text-left">
                    <input
                      type="checkbox"
                      checked={displayed.length > 0 && displayed.every((r) => selected.has(r.reviewId))}
                      onChange={toggleAll}
                    />
                  </th>
                  <th className="p-2.5 text-left">Nhân viên</th>
                  <th className="p-2.5 text-center">Business</th>
                  <th className="p-2.5 text-center">People</th>
                  <th className="p-2.5 text-center">Tự chấm TB</th>
                  <th className="p-2.5 text-center">Đề xuất</th>
                  <th className="p-2.5 text-center">Lệch</th>
                  <th className="p-2.5 text-left">Cảnh báo</th>
                  <th className="p-2.5 text-center">Trạng thái</th>
                  <th className="p-2.5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {displayed.map((r) => (
                  <tr
                    key={r.reviewId}
                    onClick={() => navigate(`/okr/assessment?employeeCode=${encodeURIComponent(r.employeeCode)}`)}
                    className={`cursor-pointer hover:bg-canvas/60 transition-colors ${selected.has(r.reviewId) ? 'bg-accent-soft/20' : ''}`}
                  >
                    <td className="p-2.5">
                      <input type="checkbox" checked={selected.has(r.reviewId)} onClick={(e) => e.stopPropagation()} onChange={() => toggle(r.reviewId)} />
                    </td>
                    <td className="p-2.5">
                      <div className="font-semibold text-ink">{r.fullName}</div>
                      <div className="text-[11px] text-ink-muted">{r.employeeCode} · {r.team || '—'}</div>
                    </td>
                    <td className="p-2.5 text-center">
                      <div className="font-bold text-ink">{r.selfBusiness ?? '—'}</div>
                      <div className="text-[10px] text-ink-muted">{r.businessProgress}%</div>
                    </td>
                    <td className="p-2.5 text-center">
                      <div className="font-bold text-ink">{r.selfPeople ?? '—'}</div>
                      <div className="text-[10px] text-ink-muted">{r.peopleProgress}%</div>
                    </td>
                    <td className="p-2.5 text-center font-bold">{r.selfAverage ?? '—'}</td>
                    <td className="p-2.5 text-center"><Badge variant="accent">{Number(r.proposedScore).toFixed(1)}</Badge></td>
                    <td className="p-2.5 text-center">
                      {r.gap == null ? '—' : <span className={Math.abs(r.gap) > 0.2 ? 'font-bold text-danger' : 'text-ink-secondary'}>{r.gap > 0 ? '+' : ''}{r.gap}</span>}
                    </td>
                    <td className="p-2.5">
                      {r.warningCount === 0 ? <span className="text-ink-muted">—</span> : (
                        <div className="space-y-0.5">
                          {r.warnings.slice(0, 2).map((w, idx) => (
                            <div key={idx} className="text-[10px] text-amber-700" title={w.message}>⚠️ {w.message}</div>
                          ))}
                          {r.warningCount > 2 && <div className="text-[10px] text-ink-muted">+{r.warningCount - 2} cảnh báo khác</div>}
                        </div>
                      )}
                    </td>
                    <td className="p-2.5 text-center"><Badge variant={statusVariant(r.status) as any}>{statusLabel(r.status)}</Badge></td>
                    <td className="p-2.5 text-right">
                      <button
                        className="text-[11px] font-semibold text-accent hover:underline"
                        onClick={(e) => { e.stopPropagation(); navigate(`/okr/assessment?employeeCode=${encodeURIComponent(r.employeeCode)}`); }}
                      >
                        Mở form đánh giá →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal isOpen={bulkOpen} onClose={() => setBulkOpen(false)} title={`Chấm hàng loạt ${selected.size} nhân viên`} maxWidth="md">
        <div className="space-y-3">
          <div className="rounded-lg border border-line bg-canvas p-2.5 text-[11px] text-ink-muted">
            Điểm dưới đây áp dụng cho tất cả nhân viên đã chọn. Nhận xét là bắt buộc.
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-ink mb-1">Business (1–5)</label>
              <select value={bulk.business} onChange={(e) => setBulk({ ...bulk, business: Number(e.target.value) })} className="w-full border border-line rounded-lg p-2 text-xs bg-canvas">
                {[1, 2, 3, 4, 5].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink mb-1">People (1–5)</label>
              <select value={bulk.people} onChange={(e) => setBulk({ ...bulk, people: Number(e.target.value) })} className="w-full border border-line rounded-lg p-2 text-xs bg-canvas">
                {[1, 2, 3, 4, 5].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink mb-1">Nhận xét <span className="text-danger">*</span></label>
            <textarea rows={3} value={bulk.comment} onChange={(e) => setBulk({ ...bulk, comment: e.target.value })} className="w-full border border-line rounded-lg p-2.5 text-xs bg-canvas" />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-line">
            <Button size="sm" variant="ghost" onClick={() => setBulkOpen(false)}>Huỷ</Button>
            <Button size="sm" variant="primary" onClick={submitBulk} disabled={saving}>{saving ? 'Đang chấm...' : 'Chấm hàng loạt'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
