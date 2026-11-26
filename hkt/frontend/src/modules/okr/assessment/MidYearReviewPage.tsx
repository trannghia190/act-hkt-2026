import React, { useCallback, useEffect, useState } from 'react';
import { Card } from '../../../components/common/Card';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { Modal } from '../../../components/common/Modal';
import { NoActiveCycleNotice } from '../components/NoActiveCycleNotice';
import { useActiveCycle } from '../../../hooks/useActiveCycle';

interface MidYearRow {
  reviewId: string;
  employeeCode: string;
  fullName: string;
  team?: string;
  jobTitle?: string;
  businessProgress: number;
  peopleProgress: number;
  overallProgress: number;
  selfBusiness?: number | null;
  selfPeople?: number | null;
  selfAverage?: number | null;
  proposedScore: number;
  gap?: number | null;
  warningCount: number;
  warnings: { code: string; level: string; message: string }[];
  status: string;
  riskScore: number;
}

interface TrendRow {
  id: string;
  period: string;
  previousValue?: number | null;
  newValue: number;
  progressSnapshot: number;
  note?: string | null;
  createdAt?: string | null;
}

interface ItemRow {
  id: string;
  groupType: 'BUSINESS' | 'PEOPLE';
  title: string;
  detail?: string | null;
  progress: number;
  dueDate?: string | null;
  checkInTrend: TrendRow[];
}

interface AuditRow {
  id: string;
  actorName?: string;
  action: string;
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
  reason?: string;
  createdAt?: string;
}

interface DetailData extends MidYearRow {
  email?: string;
  joinedDate?: string | null;
  businessItems: ItemRow[];
  peopleItems: ItemRow[];
  midYear: {
    id?: string | null;
    employeeFeedback: string;
    managerCoaching: string;
    h2Commitment: string;
    status: string;
    updatedAt?: string | null;
  };
  auditTrail: AuditRow[];
  midYearWritable?: boolean;
  midYearLockReason?: string | null;
  midYearUpdateOverride?: boolean;
  midYearManagerWindowOpen?: boolean;
}

const statusLabel = (status: string) => {
  if (status === 'DA_HOAN_TAT') return 'Đã chấm xong';
  if (status === 'CHO_QL_CHAM') return 'Chờ QL chấm';
  if (status === 'CHUA_CO_OKR') return 'Chưa có OKR được duyệt';
  return 'Chưa tự đánh giá';
};

export const MidYearReviewPage: React.FC = () => {
  const [rows, setRows] = useState<MidYearRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [notes, setNotes] = useState({ employeeFeedback: '', managerCoaching: '', h2Commitment: '' });
  const [savingNotes, setSavingNotes] = useState(false);

  const [editItem, setEditItem] = useState<ItemRow | null>(null);
  const [editForm, setEditForm] = useState({ title: '', detail: '', dueDate: '', reason: '' });
  const [savingItem, setSavingItem] = useState(false);

  const [deleteItem, setDeleteItem] = useState<ItemRow | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState('Mở lại để bổ sung trong review giữa năm');
  const [reopening, setReopening] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // Chưa có chu kỳ OKR đang hoạt động → không có hồ sơ giữa năm để coaching.
  const { hasActiveCycle } = useActiveCycle();

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/okr/midyear/reviews');
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || 'Không tải được danh sách');
      setRows(json.data || []);
      if (!selectedId && json.data?.length) setSelectedId(json.data[0].reviewId);
    } catch (err: any) {
      showToast(err.message || 'Không tải được danh sách review giữa năm');
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/v1/okr/midyear/reviews/${id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || 'Không tải được chi tiết');
      setDetail(json.data);
      setNotes({
        employeeFeedback: json.data.midYear?.employeeFeedback || '',
        managerCoaching: json.data.midYear?.managerCoaching || '',
        h2Commitment: json.data.midYear?.h2Commitment || '',
      });
    } catch (err: any) {
      showToast(err.message || 'Không tải được chi tiết review');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => { loadList(); }, [loadList]);
  useEffect(() => { if (selectedId) loadDetail(selectedId); }, [selectedId, loadDetail]);

  const refresh = async () => {
    if (selectedId) await loadDetail(selectedId);
    await loadList();
  };

  const saveNotes = async () => {
    if (!selectedId) return;
    setSavingNotes(true);
    try {
      const res = await fetch(`/api/v1/okr/midyear/reviews/${selectedId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notes),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || 'Không lưu được biên bản');
      showToast('Đã lưu biên bản coaching giữa năm');
      refresh();
    } catch (err: any) {
      showToast(err.message || 'Không lưu được biên bản');
    } finally {
      setSavingNotes(false);
    }
  };

  const toggleAllowUpdate = async (enabled: boolean) => {
    if (!selectedId) return;
    try {
      const res = await fetch(`/api/v1/okr/reviews/${selectedId}/allow-update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phase: 'MIDYEAR', enabled }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || 'Không đổi được quyền cập nhật');
      showToast(json?.message || 'Đã cập nhật quyền cập nhật cho nhân viên');
      refresh();
    } catch (err: any) {
      showToast(err.message || 'Không đổi được quyền cập nhật');
    }
  };

  const openEdit = (item: ItemRow) => {
    setEditItem(item);
    setEditForm({
      title: item.title,
      detail: item.detail || '',
      dueDate: item.dueDate ? item.dueDate.substring(0, 10) : '',
      reason: '',
    });
  };

  const saveEdit = async () => {
    if (!selectedId || !editItem) return;
    if (!editForm.reason.trim()) { showToast('Lý do điều chỉnh là bắt buộc'); return; }
    setSavingItem(true);
    try {
      const res = await fetch(`/api/v1/okr/midyear/reviews/${selectedId}/items/${editItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editForm.title,
          detail: editForm.detail,
          dueDate: editForm.dueDate || null,
          reason: editForm.reason,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || 'Không lưu được điều chỉnh');
      showToast('Đã điều chỉnh mục tiêu + ghi audit');
      setEditItem(null);
      refresh();
    } catch (err: any) {
      showToast(err.message || 'Không lưu được điều chỉnh');
    } finally {
      setSavingItem(false);
    }
  };

  const removeItem = async () => {
    if (!selectedId || !deleteItem) return;
    if (!deleteReason.trim()) { showToast('Lý do bớt mục tiêu là bắt buộc'); return; }
    setDeleting(true);
    try {
      const res = await fetch(`/api/v1/okr/midyear/reviews/${selectedId}/items/${deleteItem.id}?reason=${encodeURIComponent(deleteReason.trim())}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || 'Không bớt được mục tiêu');
      showToast('Đã bớt mục tiêu (lưu vết lịch sử)');
      setDeleteItem(null);
      setDeleteReason('');
      refresh();
    } catch (err: any) {
      showToast(err.message || 'Không bớt được mục tiêu');
    } finally {
      setDeleting(false);
    }
  };

  const openReopen = () => {
    setReopenReason('Mở lại để bổ sung trong review giữa năm');
    setReopenOpen(true);
  };

  const reopen = async () => {
    if (!selectedId) return;
    if (!reopenReason.trim()) { showToast('Lý do mở lại là bắt buộc'); return; }
    setReopening(true);
    try {
      const res = await fetch(`/api/v1/okr/midyear/reviews/${selectedId}/reopen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reopenReason.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || 'Không mở lại được');
      showToast('Đã mở lại quyền sửa cho nhân viên');
      setReopenOpen(false);
      refresh();
    } catch (err: any) {
      showToast(err.message || 'Không mở lại được');
    } finally {
      setReopening(false);
    }
  };

  const canWrite = detail?.midYearWritable !== false;

  const renderItems = (title: string, items: ItemRow[], group: 'BUSINESS' | 'PEOPLE') => (
    <Card className="space-y-3">
      <div className="flex items-center justify-between border-b border-line pb-2">
        <h3 className="text-sm font-bold text-ink flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${group === 'BUSINESS' ? 'bg-accent' : 'bg-status-ok'}`} />
          {title}
        </h3>
      </div>
      {items.length === 0 ? (
        <div className="text-xs text-ink-muted py-4 text-center bg-canvas rounded-lg border border-dashed border-line">Chưa có mục tiêu.</div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="rounded-lg border border-line p-3 bg-surface space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="text-xs font-semibold text-ink">{item.title}</div>
                  {item.detail && <div className="text-[11px] text-ink-muted mt-0.5">{item.detail}</div>}
                  <div className="text-[11px] text-ink-muted mt-1">
                    Tiến độ: <b className="text-ink">{item.progress}%</b>
                    {item.dueDate ? ` · Hạn: ${item.dueDate.substring(0, 10)}` : ''}
                  </div>
                </div>
                {canWrite && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button className="text-[11px] font-semibold text-accent hover:underline" onClick={() => openEdit(item)}>Điều chỉnh</button>
                    <button className="text-[11px] font-semibold text-danger hover:underline" onClick={() => { setDeleteItem(item); setDeleteReason(''); }}>Bớt</button>
                  </div>
                )}
              </div>
              <div className="h-1.5 bg-line rounded-full overflow-hidden">
                <div className={`h-full ${group === 'BUSINESS' ? 'bg-accent' : 'bg-status-ok'}`} style={{ width: `${Math.min(100, item.progress)}%` }} />
              </div>
              {item.checkInTrend.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {item.checkInTrend.map((t) => (
                    <span key={t.id} className="rounded-full border border-line bg-canvas px-2 py-0.5 text-[10px] text-ink-muted">
                      {t.period}: {t.previousValue ?? '—'}% → {t.newValue}%
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );

  return (
    <div className="space-y-5 pb-12">
      {toast && <div className="fixed top-16 right-6 z-[100] bg-ink text-canvas px-4 py-2.5 rounded-lg text-xs font-semibold shadow-lg">{toast}</div>}

      {hasActiveCycle === false && <NoActiveCycleNotice role="manager" />}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink">Review &amp; Coaching Giữa Năm</h1>
          <p className="text-xs text-ink-muted mt-1">Xem tiến độ check-in, nhận xét riêng từng người, điều chỉnh mục tiêu có lý do + audit trail.</p>
        </div>
        {detail && canWrite && (
          <Button size="sm" variant="outline" onClick={openReopen}>🔓 Mở cho nhân viên sửa</Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4 items-start">
        <Card className="space-y-2 lg:sticky lg:top-4">
          <div className="text-xs font-bold text-ink-muted uppercase tracking-wider pb-2 border-b border-line">Nhân viên ({rows.length})</div>
          {loading ? <div className="text-xs text-ink-muted p-3">Đang tải...</div> : rows.length === 0 ? <div className="text-xs text-ink-muted p-3">Không có nhân viên trong phạm vi quản lý.</div> : rows.map((r) => (
            <button
              key={r.reviewId}
              onClick={() => setSelectedId(r.reviewId)}
              className={`w-full text-left rounded-lg border p-2.5 transition-colors ${selectedId === r.reviewId ? 'border-accent bg-accent-soft/30' : 'border-line bg-surface hover:border-accent/40'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-ink">{r.fullName}</span>
                {r.warningCount > 0 && <Badge variant="warn">{r.warningCount} cảnh báo</Badge>}
              </div>
              <div className="text-[11px] text-ink-muted mt-0.5">{r.employeeCode} · Tiến độ {r.overallProgress}%</div>
              <div className="text-[11px] text-ink-muted">Tự chấm: {r.selfAverage ?? '—'} · Đề xuất: {r.proposedScore}</div>
            </button>
          ))}
        </Card>

        <div className="space-y-4">
          {detailLoading ? (
            <Card><div className="text-xs text-ink-muted p-6 text-center">Đang tải chi tiết...</div></Card>
          ) : !detail ? (
            <Card><div className="text-xs text-ink-muted p-6 text-center">Chọn một nhân viên để review.</div></Card>
          ) : (
            <>
              {detail.midYearWritable === false && (
                <div className="rounded-lg border border-status-warn-line bg-status-warn-soft p-3 text-xs text-status-warn">
                  🔒 Chỉ xem: {detail.midYearLockReason}
                </div>
              )}
              <Card className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold text-ink">{detail.fullName} <span className="text-xs font-normal text-ink-muted">({detail.employeeCode})</span></h2>
                    <div className="text-xs text-ink-muted mt-0.5">{detail.team || '—'} · {detail.jobTitle || '—'} · {statusLabel(detail.status)}</div>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="accent">Tự chấm (dự kiến) TB: {detail.selfAverage ?? '—'}</Badge>
                    <Badge variant="warn">Đề xuất theo tiến độ: {Number(detail.proposedScore).toFixed(1)}</Badge>
                    {detail.gap != null && <Badge variant={Math.abs(detail.gap) > 0.2 ? 'danger' : 'ok'}>Lệch: {detail.gap > 0 ? '+' : ''}{detail.gap}</Badge>}
                  </div>
                </div>
                {detail.midYearManagerWindowOpen && (
                  <label className="flex items-start gap-2 rounded-lg border border-line bg-canvas p-2.5 text-xs text-ink cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={!!detail.midYearUpdateOverride}
                      onChange={(e) => toggleAllowUpdate(e.target.checked)}
                    />
                    <span>
                      Cho phép nhân viên cập nhật tiến độ trong lúc Quản lý review
                      <span className="block text-[11px] text-ink-muted">Mặc định khoá khi đã sang cửa sổ Quản lý; bật để nhân viên bổ sung số liệu trong lúc chờ nhận xét.</span>
                    </span>
                  </label>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-line bg-canvas p-2.5 text-xs">
                    <div className="text-ink-muted">Business</div>
                    <div className="font-bold text-ink">{detail.businessProgress}%</div>
                  </div>
                  <div className="rounded-lg border border-line bg-canvas p-2.5 text-xs">
                    <div className="text-ink-muted">People</div>
                    <div className="font-bold text-ink">{detail.peopleProgress}%</div>
                  </div>
                </div>
                {detail.warnings.length > 0 && (
                  <div className="space-y-1">
                    {detail.warnings.map((w, idx) => (
                      <div key={idx} className="rounded-lg border border-status-warn-line bg-status-warn-soft px-2.5 py-1.5 text-[11px] text-status-warn">
                        ⚠️ {w.message}
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {renderItems('Business', detail.businessItems, 'BUSINESS')}
              {renderItems('People', detail.peopleItems, 'PEOPLE')}

              <Card className="space-y-3">
                <div className="text-sm font-bold text-ink border-b border-line pb-2">Biên bản coaching 1-on-1</div>
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Nhân viên chia sẻ thuận lợi / khó khăn</label>
                  <textarea rows={3} disabled={!canWrite} value={notes.employeeFeedback} onChange={(e) => setNotes({ ...notes, employeeFeedback: e.target.value })} className="w-full border border-line rounded-lg p-2.5 text-xs bg-canvas disabled:bg-surface disabled:text-ink-muted focus:outline-none focus:border-accent" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Định hướng &amp; coaching của Quản lý</label>
                  <textarea rows={3} disabled={!canWrite} value={notes.managerCoaching} onChange={(e) => setNotes({ ...notes, managerCoaching: e.target.value })} className="w-full border border-line rounded-lg p-2.5 text-xs bg-canvas disabled:bg-surface disabled:text-ink-muted focus:outline-none focus:border-accent" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Cam kết / kế hoạch H2</label>
                  <textarea rows={3} disabled={!canWrite} value={notes.h2Commitment} onChange={(e) => setNotes({ ...notes, h2Commitment: e.target.value })} className="w-full border border-line rounded-lg p-2.5 text-xs bg-canvas disabled:bg-surface disabled:text-ink-muted focus:outline-none focus:border-accent" />
                </div>
                <div className="flex justify-end">
                  <Button size="sm" variant="primary" onClick={saveNotes} disabled={savingNotes || !canWrite}>{savingNotes ? 'Đang lưu...' : 'Lưu biên bản coaching'}</Button>
                </div>
              </Card>

              <Card className="space-y-2">
                <div className="text-sm font-bold text-ink border-b border-line pb-2">Audit trail ({detail.auditTrail.length})</div>
                {detail.auditTrail.length === 0 ? <div className="text-xs text-ink-muted py-3">Chưa có thay đổi nào.</div> : detail.auditTrail.map((a) => (
                  <div key={a.id} className="rounded-lg border border-line bg-surface p-2.5 text-[11px] space-y-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-ink">{a.actorName || 'Hệ thống'} · {a.action}</span>
                      <span className="text-ink-muted">{a.createdAt ? new Date(a.createdAt).toLocaleString('vi-VN') : ''}</span>
                    </div>
                    {a.fieldName && <div className="text-ink-secondary">Trường: <b>{a.fieldName}</b>{a.oldValue || a.newValue ? ` · ${a.oldValue ?? '—'} → ${a.newValue ?? '—'}` : ''}</div>}
                    {a.reason && <div className="text-ink-muted">Lý do: {a.reason}</div>}
                  </div>
                ))}
              </Card>
            </>
          )}
        </div>
      </div>

      <Modal isOpen={Boolean(editItem)} onClose={() => setEditItem(null)} title="Điều chỉnh mục tiêu giữa năm" maxWidth="lg">
        <div className="space-y-3">
          <div className="rounded-lg bg-status-warn-soft border border-status-warn-line p-2.5 text-[11px] text-status-warn">Mọi thay đổi bắt buộc nhập lý do và sẽ ghi vào audit trail.</div>
          <div>
            <label className="block text-xs font-semibold text-ink mb-1">Tên mục tiêu</label>
            <textarea rows={2} value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} className="w-full border border-line rounded-lg p-2.5 text-xs bg-canvas" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink mb-1">Chi tiết</label>
            <textarea rows={3} value={editForm.detail} onChange={(e) => setEditForm({ ...editForm, detail: e.target.value })} className="w-full border border-line rounded-lg p-2.5 text-xs bg-canvas" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink mb-1">Hạn chót mục tiêu (kéo hạn)</label>
            <input type="date" value={editForm.dueDate} onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })} className="w-full border border-line rounded-lg p-2.5 text-xs bg-canvas" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink mb-1">Lý do điều chỉnh <span className="text-danger">*</span></label>
            <textarea rows={2} value={editForm.reason} onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })} className="w-full border border-line rounded-lg p-2.5 text-xs bg-canvas" />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-line">
            <Button size="sm" variant="ghost" onClick={() => setEditItem(null)}>Huỷ</Button>
            <Button size="sm" variant="primary" onClick={saveEdit} disabled={savingItem}>{savingItem ? 'Đang lưu...' : 'Lưu điều chỉnh'}</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={Boolean(deleteItem)} onClose={() => setDeleteItem(null)} title="Bớt mục tiêu giữa năm" maxWidth="md">
        <div className="space-y-3">
          <div className="rounded-lg border border-line bg-canvas p-2.5 text-xs text-ink-secondary">
            Mục tiêu: <b>{deleteItem?.title}</b>
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink mb-1">Lý do bớt <span className="text-danger">*</span></label>
            <textarea rows={3} value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)} className="w-full border border-line rounded-lg p-2.5 text-xs bg-canvas" />
          </div>
          <div className="text-[11px] text-ink-muted">Mục tiêu sẽ được xoá mềm, vẫn còn trong lịch sử và audit trail.</div>
          <div className="flex justify-end gap-2 pt-2 border-t border-line">
            <Button size="sm" variant="ghost" onClick={() => setDeleteItem(null)}>Huỷ</Button>
            <Button size="sm" variant="danger" onClick={removeItem} disabled={deleting || !deleteReason.trim()}>{deleting ? 'Đang xử lý...' : 'Xác nhận bớt'}</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={reopenOpen} onClose={() => setReopenOpen(false)} title="Mở cho nhân viên sửa bổ sung" maxWidth="md">
        <div className="space-y-3">
          <div className="rounded-lg border border-line bg-canvas p-2.5 text-[11px] text-ink-muted">
            Nhân viên sẽ tự sửa/bổ sung mục tiêu của mình trên trang “OKR của tôi” rồi nộp lại — Quản lý không thêm mục tiêu thay nhân viên. Khi nộp lại, bộ mục tiêu sẽ khoá cho tới lần mở tiếp theo.
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink mb-1">Lý do mở lại <span className="text-danger">*</span></label>
            <textarea rows={3} value={reopenReason} onChange={(e) => setReopenReason(e.target.value)} className="w-full border border-line rounded-lg p-2.5 text-xs bg-canvas" />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-line">
            <Button size="sm" variant="ghost" onClick={() => setReopenOpen(false)}>Huỷ</Button>
            <Button size="sm" variant="primary" onClick={reopen} disabled={reopening || !reopenReason.trim()}>{reopening ? 'Đang mở...' : 'Xác nhận mở'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
