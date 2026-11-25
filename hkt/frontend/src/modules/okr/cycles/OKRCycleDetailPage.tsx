import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Card } from '../../../components/common/Card';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { Modal } from '../../../components/common/Modal';
import {
  addDaysIso,
  cycleStatusMeta,
  Cycle,
  CompanyObjective,
  emptyPhase,
  isPhaseOverdue,
  isoToday,
  monthsLabel,
  normalizeCycle,
  Phase,
  PHASE_STATUS_LABEL,
  phaseWindowConflicts,
} from './cycleTypes';
import { OKRPhaseTimeline } from './OKRPhaseTimeline';

export const OKRCycleDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const isNew = !id || id === 'new';
  const viewOnly = searchParams.get('mode') === 'view';

  const [form, setForm] = useState<Cycle | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Mở lại: 'CYCLE' = mở cả chu kỳ, Phase = mở đúng phase đang bấm
  const [reopenTarget, setReopenTarget] = useState<Phase | 'CYCLE' | null>(null);
  const [reopenReason, setReopenReason] = useState('');
  const [reopenDueDate, setReopenDueDate] = useState('');
  const [reopening, setReopening] = useState(false);
  const [existingYears, setExistingYears] = useState<number[]>([]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const load = useCallback(async () => {
    if (isNew) {
      setLoading(true);
      try {
        // Năm mới gợi ý = năm lớn nhất hiện có + 1 (không đè lên chu kỳ đang có).
        const res = await fetch('/api/v1/okr/cycles');
        const json = await res.json();
        const list: Cycle[] = json?.data || [];
        setExistingYears(list.map((c) => c.year));
        const year = Math.max(new Date().getFullYear(), ...list.map((c) => c.year + 1));
        setForm(normalizeCycle({
          id: '',
          name: `Chu kỳ OKR ${year}`,
          year,
          scaleMin: 1,
          scaleMax: 5,
          checkinInterval: 'MONTHLY',
          alignmentEnabled: false,
          status: 'draft',
          phases: [],
          companyObjectives: [],
        }));
      } catch {
        setForm(normalizeCycle({
          id: '',
          name: `Chu kỳ OKR ${new Date().getFullYear() + 1}`,
          year: new Date().getFullYear() + 1,
          scaleMin: 1,
          scaleMax: 5,
          checkinInterval: 'MONTHLY',
          alignmentEnabled: false,
          status: 'draft',
          phases: [],
          companyObjectives: [],
        }));
      } finally {
        setLoading(false);
      }
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/okr/cycles/${id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || 'Không tải được chu kỳ');
      setForm(normalizeCycle(json.data));
    } catch (err: any) {
      showToast(err.message || 'Không tải được chu kỳ OKR');
    } finally {
      setLoading(false);
    }
  }, [id, isNew]);

  useEffect(() => { load(); }, [load]);

  const updatePhase = (key: string, patch: Partial<Phase>) => {
    if (!form) return;
    setForm({ ...form, phases: form.phases.map((p) => p.key === key ? { ...p, ...patch } : p) });
  };

  const updateObjective = (idx: number, patch: Partial<CompanyObjective>) => {
    if (!form) return;
    setForm({ ...form, companyObjectives: form.companyObjectives.map((o, i) => (i === idx ? { ...o, ...patch } : o)) });
  };

  const save = async () => {
    if (!form) return;
    if (isNew && existingYears.includes(form.year)) {
      showToast(`Năm ${form.year} đã có chu kỳ OKR — mỗi năm chỉ có 1 chu kỳ, hãy mở chu kỳ đó để cập nhật`);
      return;
    }
    const conflicts = phaseWindowConflicts(form.phases);
    if (conflicts.length > 0) {
      showToast(conflicts[0]);
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        year: form.year,
        scaleMin: form.scaleMin,
        scaleMax: form.scaleMax,
        checkinInterval: form.checkinInterval,
        alignmentEnabled: form.alignmentEnabled,
        seniorityCutoffDate: form.seniorityCutoffDate || '',
        status: form.status,
        companyObjectives: form.companyObjectives,
        phases: form.phases.map((p) => ({
          key: p.key,
          name: p.name,
          startDate: p.start_date,
          dueDate: p.due_date,
          reviewStart: p.review_start || '',
          reviewDue: p.review_due || '',
          status: p.status === 'locked' ? 'locked' : 'scheduled',
        })),
      };
      const res = await fetch(isNew ? '/api/v1/okr/cycles' : `/api/v1/okr/cycles/${id}`, {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || 'Không lưu được chu kỳ');
      showToast(form.status === 'draft' ? 'Đã lưu bản nháp chu kỳ OKR' : 'Đã lưu cấu hình chu kỳ OKR');
      if (isNew && json?.data?.id) {
        navigate(`/okr/cycles/${json.data.id}`, { replace: true });
      } else {
        load();
      }
    } catch (err: any) {
      showToast(err.message || 'Không lưu được chu kỳ');
    } finally {
      setSaving(false);
    }
  };

  const callAction = async (path: string, body?: object): Promise<void> => {
    if (isNew) return;
    const res = await fetch(`/api/v1/okr/cycles/${id}/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.message || 'Thao tác thất bại');
    showToast(json.message || 'Thành công');
    load();
  };

  const activate = async () => {
    if (!form) return;
    if (!confirm(`Kích hoạt chu kỳ ${form.name}? Chu kỳ sẽ trở thành chu kỳ đang hoạt động của năm ${form.year}.`)) return;
    setBusy(true);
    try { await callAction('activate'); } catch (err: any) { showToast(err.message); } finally { setBusy(false); }
  };

  const deactivate = async () => {
    if (!form) return;
    if (!confirm('Tạm ẩn chu kỳ này? Dữ liệu giữ nguyên, mọi người sẽ không còn làm việc trên chu kỳ này cho tới khi kích hoạt lại.')) return;
    setBusy(true);
    try { await callAction('deactivate'); } catch (err: any) { showToast(err.message); } finally { setBusy(false); }
  };

  const sendReminders = async () => {
    if (!form) return;
    setBusy(true);
    try { await callAction('send-reminders'); } catch (err: any) { showToast(err.message); } finally { setBusy(false); }
  };

  const lock = async () => {
    if (!form) return;
    if (!confirm('Chốt & khoá chu kỳ này? Sau khi khoá, chỉ HR mới mở lại được (kèm lý do).')) return;
    setBusy(true);
    try {
      const post = (body: object) => fetch(`/api/v1/okr/cycles/${id}/lock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      let res = await post({});
      let json = await res.json();
      if (res.status === 409 && /chưa được quản lý chấm/.test(json?.message || '')) {
        const reason = window.prompt(`${json.message}\n\nNhập lý do chốt sớm để tiếp tục:`);
        if (!reason || !reason.trim()) return;
        res = await post({ force: true, reason: reason.trim() });
        json = await res.json();
      }
      if (!res.ok) throw new Error(json?.message || 'Không khoá được chu kỳ');
      showToast('Đã chốt & khoá chu kỳ');
      load();
    } catch (err: any) {
      showToast(err.message || 'Không khoá được chu kỳ');
    } finally {
      setBusy(false);
    }
  };

  const openReopen = (target: Phase | 'CYCLE') => {
    setReopenTarget(target);
    setReopenReason('');
    if (target === 'CYCLE') {
      setReopenDueDate('');
    } else {
      // Phase quá hạn bắt buộc hạn mới; gợi ý +7 ngày để HR không phải gõ từ đầu.
      setReopenDueDate(isPhaseOverdue(target) ? addDaysIso(7) : (target.due_date || ''));
    }
  };

  const submitReopen = async () => {
    if (!form || !reopenTarget) return;
    if (!reopenReason.trim()) { showToast('Lý do mở lại là bắt buộc'); return; }

    const isCycle = reopenTarget === 'CYCLE';
    const phase = isCycle ? null : reopenTarget;
    if (phase && isPhaseOverdue(phase) && !reopenDueDate) {
      showToast('Phase đã quá hạn — cần nhập hạn chót mới');
      return;
    }

    setReopening(true);
    try {
      const res = await fetch(`/api/v1/okr/cycles/${id}/reopen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isCycle
          ? { reason: reopenReason.trim() }
          : {
              phaseKey: phase!.key,
              dueDate: reopenDueDate || undefined,
              reason: reopenReason.trim(),
            }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || 'Không mở lại được chu kỳ');
      showToast(isCycle ? 'Đã mở lại chu kỳ OKR' : `Đã mở lại phase ${phase!.name}`);
      setReopenTarget(null);
      load();
    } catch (err: any) {
      showToast(err.message || 'Không mở lại được chu kỳ');
    } finally {
      setReopening(false);
    }
  };

  const reopenPhaseTarget = reopenTarget && reopenTarget !== 'CYCLE' ? reopenTarget : null;

  if (loading) {
    return <Card><div className="p-8 text-center text-xs text-ink-muted">Đang tải chu kỳ OKR...</div></Card>;
  }

  if (!form) {
    return (
      <div className="max-w-5xl mx-auto space-y-3">
        <Button size="sm" variant="ghost" onClick={() => navigate('/okr/cycles')}>← Danh sách chu kỳ</Button>
        <Card><div className="p-8 text-center text-xs text-ink-muted">Không tìm thấy chu kỳ OKR.</div></Card>
      </div>
    );
  }

  const statusMeta = cycleStatusMeta(form.status);
  const editable = !viewOnly && form.status !== 'closed';
  const isDraft = form.status === 'draft';
  const isActive = form.status === 'active';
  const isClosed = form.status === 'closed';

  return (
    <div className="space-y-5 max-w-5xl mx-auto pb-12">
      {toast && <div className="fixed top-16 right-6 z-50 bg-ink text-canvas px-4 py-2.5 rounded-lg text-xs font-semibold shadow-lg">{toast}</div>}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <button className="text-xs font-semibold text-accent hover:underline" onClick={() => navigate('/okr/cycles')}>← Danh sách chu kỳ</button>
          <h1 className="text-xl font-bold tracking-tight text-ink mt-1 flex items-center gap-2">
            {isNew ? 'Thêm chu kỳ OKR' : form.name}
            {!isNew && <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>}
          </h1>
          <p className="text-xs text-ink-muted mt-1">
            3 phase theo mốc thật · mỗi phase 2 cửa sổ (nhân viên cập nhật → quản lý duyệt) · thang điểm 1–5 · tần suất check-in.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {viewOnly && !isClosed && !isNew && (
            <Button size="sm" variant="outline" onClick={() => navigate(`/okr/cycles/${id}`)}>✎ Chỉnh sửa</Button>
          )}
          {isDraft && editable && (
            <Button size="sm" variant="outline" onClick={activate} disabled={busy}>▶ Kích hoạt</Button>
          )}
          {isActive && (
            <Button size="sm" variant="outline" onClick={sendReminders} disabled={busy} title="Nhắc những người còn việc chưa xong ở các phase sắp hết hạn (≤ 3 ngày)">🔔 Gửi nhắc hạn</Button>
          )}
          {isActive && (
            <Button size="sm" variant="outline" onClick={deactivate} disabled={busy}>⏸ Tạm ẩn</Button>
          )}
          {isActive && (
            <Button size="sm" variant="outline" onClick={lock} disabled={busy}>🔒 Chốt &amp; khoá</Button>
          )}
          {isClosed && (
            <Button size="sm" variant="outline" onClick={() => openReopen('CYCLE')}>🔓 Mở lại chu kỳ</Button>
          )}
          {editable && (
            <Button size="sm" variant="primary" onClick={save} disabled={saving}>{saving ? 'Đang lưu...' : isNew ? 'Tạo chu kỳ' : 'Lưu cấu hình'}</Button>
          )}
        </div>
      </div>

      {isClosed && (
        <div className="rounded-lg border border-line bg-canvas p-3 text-[11px] text-ink-secondary">
          Chu kỳ đã chốt &amp; khoá nên chỉ xem. Dùng “Mở lại chu kỳ” kèm lý do nếu cần chỉnh sửa.
        </div>
      )}

      <fieldset disabled={!editable} className="space-y-5 min-w-0">
        <Card className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-line pb-3">
            <div>
              <h2 className="text-sm font-bold text-ink">{form.name}</h2>
              <div className="text-[11px] text-ink-muted">Năm {form.year} · Thang điểm {form.scaleMin}–{form.scaleMax} · Check-in {form.checkinInterval}</div>
            </div>
            {form.directorReviewPending && <Badge variant="warn">Chờ Giám đốc đánh giá chung</Badge>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-ink mb-1">Tên chu kỳ</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border border-line rounded-lg p-2 text-xs bg-canvas" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink mb-1">Năm</label>
              <input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: Number(e.target.value) })} className="w-full border border-line rounded-lg p-2 text-xs bg-canvas" />
              {isNew && existingYears.length > 0 && (
                <div className={`text-[10px] mt-0.5 ${existingYears.includes(form.year) ? 'text-danger font-semibold' : 'text-ink-muted'}`}>
                  {existingYears.includes(form.year)
                    ? `Năm ${form.year} đã có chu kỳ — mỗi năm chỉ có 1 chu kỳ OKR.`
                    : `Các năm đã có chu kỳ: ${existingYears.slice().sort((a, b) => a - b).join(', ')}`}
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink mb-1">Tần suất check-in</label>
              <select value={form.checkinInterval} onChange={(e) => setForm({ ...form, checkinInterval: e.target.value })} className="w-full border border-line rounded-lg p-2 text-xs bg-canvas">
                <option value="MONTHLY">Hàng tháng</option>
                <option value="QUARTERLY">Hàng quý</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink mb-1">Trạng thái</label>
              <div className="p-2 text-xs text-ink-secondary">
                {statusMeta.label} · đổi bằng nút Kích hoạt / Tạm ẩn / Chốt &amp; khoá
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-ink mb-1">Điểm thấp nhất</label>
              <select value={form.scaleMin} onChange={(e) => setForm({ ...form, scaleMin: Number(e.target.value) })} className="w-full border border-line rounded-lg p-2 text-xs bg-canvas">
                {[1, 2, 3, 4, 5].map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink mb-1">Điểm cao nhất</label>
              <select value={form.scaleMax} onChange={(e) => setForm({ ...form, scaleMax: Number(e.target.value) })} className="w-full border border-line rounded-lg p-2 text-xs bg-canvas">
                {[1, 2, 3, 4, 5].map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div className="pt-6 text-[11px] text-ink-muted">
              Phân tầng mục tiêu: chưa hỗ trợ trong phiên bản này.
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink mb-1">Tính thời gian công tác tới</label>
              <input
                type="date"
                value={form.seniorityCutoffDate ? String(form.seniorityCutoffDate).substring(0, 10) : ''}
                onChange={(e) => setForm({ ...form, seniorityCutoffDate: e.target.value || null })}
                className="w-full border border-line rounded-lg p-2 text-xs bg-canvas"
              />
              <div className="text-[10px] text-ink-muted mt-0.5">
                Để trống = 31/12/{form.year}. Dùng cho cột "Thời gian công tác" của báo cáo tổng hợp.
              </div>
            </div>
          </div>
        </Card>

        <Card className="space-y-3">
          <div className="text-sm font-bold text-ink border-b border-line pb-2">Timeline 3 phase — 2 cửa sổ mỗi phase</div>
          <OKRPhaseTimeline year={form.year} phases={form.phases} />
          <div className="space-y-2">
            {form.phases.map((p, idx) => (
              <div key={p.key} className="rounded-xl border border-line p-3 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-accent text-white text-xs grid place-items-center">{idx + 1}</span>
                    <div>
                      <div className="text-xs font-bold text-ink">{p.name}</div>
                      <div className="text-[11px] text-ink-muted">
                        {p.key} · NV: {monthsLabel(p.start_date, p.due_date) || 'Chưa đặt mốc'}
                        {p.review_start && p.review_due ? ` · QL: ${monthsLabel(p.review_start, p.review_due)}` : ''}
                      </div>
                    </div>
                  </div>
                  {(() => {
                    const eff = p.effective_status || 'upcoming';
                    return (
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={eff === 'active' ? 'ok' : eff === 'locked' ? 'gray' : 'warn'}>
                          NV: {PHASE_STATUS_LABEL[eff] || eff}
                          {eff === 'active' && typeof p.days_left === 'number' ? ` · còn ${p.days_left} ngày` : ''}
                        </Badge>
                        {p.review_start && p.review_due && (
                          <Badge variant={(p.manager_status || 'upcoming') === 'active' ? 'ok' : p.manager_status === 'locked' ? 'gray' : 'warn'}>
                            QL: {PHASE_STATUS_LABEL[p.manager_status || 'upcoming']}
                          </Badge>
                        )}
                        {!isNew && eff === 'locked' && p.manager_status !== 'active' && editable && (
                          <Button size="sm" variant="outline" className="h-auto py-1 px-2.5 text-[11px]" onClick={() => openReopen(p)}>
                            🔓 Mở lại phase
                          </Button>
                        )}
                      </div>
                    );
                  })()}
                </div>
                <div className="text-[11px] font-semibold text-ink-muted uppercase tracking-wide">Nhân viên cập nhật</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-ink-muted mb-1">Bắt đầu</label>
                    <input type="date" value={p.start_date || ''} onChange={(e) => updatePhase(p.key, { start_date: e.target.value })} className="w-full border border-line rounded-lg p-2 text-xs bg-canvas" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-ink-muted mb-1">Hạn chót</label>
                    <input type="date" value={p.due_date || ''} onChange={(e) => updatePhase(p.key, { due_date: e.target.value })} className="w-full border border-line rounded-lg p-2 text-xs bg-canvas" />
                  </div>
                </div>
                <div className="text-[11px] font-semibold text-ink-muted uppercase tracking-wide">Quản lý duyệt / nhận xét / chấm điểm</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-ink-muted mb-1">Bắt đầu review</label>
                    <input type="date" value={p.review_start || ''} onChange={(e) => updatePhase(p.key, { review_start: e.target.value })} className="w-full border border-line rounded-lg p-2 text-xs bg-canvas" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-ink-muted mb-1">Hạn review</label>
                    <input type="date" value={p.review_due || ''} onChange={(e) => updatePhase(p.key, { review_due: e.target.value })} className="w-full border border-line rounded-lg p-2 text-xs bg-canvas" />
                  </div>
                </div>
                {p.status === 'locked' && (
                  <div className="text-[11px] text-ink-muted">🔒 Phase đã khoá cứng — bấm “Mở lại phase” ngay trên phase này để mở kèm lý do.</div>
                )}
              </div>
            ))}
          </div>
          <div className="rounded-lg border border-line bg-canvas p-2.5 text-[11px] text-ink-muted">
            Mỗi phase có 2 cửa sổ nối tiếp: nhân viên cập nhật (bắt đầu → hạn chót), rồi quản lý duyệt/nhận xét/chấm điểm (bắt đầu → hạn review).
            Trong cửa sổ quản lý, nhân viên bị khoá; quản lý có thể bật riêng cho từng nhân viên cập nhật tại trang review.
            Hết cửa sổ quản lý thì phase tự khoá tới phase kế; phase đã khoá chỉ HR mở lại được, kèm lý do ghi audit.
            Hệ thống tự nhắc trước hạn 3 ngày (8:00 hằng ngày): gửi OKR, review giữa năm, tự đánh giá / chấm điểm cuối năm.
          </div>
        </Card>

        <Card className="space-y-3">
          <div className="flex items-center justify-between border-b border-line pb-2">
            <div>
              <div className="text-sm font-bold text-ink">Mục tiêu công ty (20%)</div>
              <div className="text-[11px] text-ink-muted">Hiển thị trên Dashboard nhân viên để tham khảo — không tính vào điểm TB cá nhân.</div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setForm({ ...form, companyObjectives: [...form.companyObjectives, { title: '', category: 'BUSINESS', progress: 0 }] })}
            >
              + Thêm mục tiêu
            </Button>
          </div>
          {form.companyObjectives.length === 0 && (
            <div className="text-xs text-ink-muted">Chưa có mục tiêu công ty.</div>
          )}
          {form.companyObjectives.map((o, idx) => (
            <div key={o.id || idx} className="grid grid-cols-1 sm:grid-cols-[1fr_130px_110px_auto] gap-2 items-center">
              <input value={o.title} onChange={(e) => updateObjective(idx, { title: e.target.value })} placeholder="Tên mục tiêu công ty" className="border border-line rounded-lg p-2 text-xs bg-canvas" />
              <select value={o.category} onChange={(e) => updateObjective(idx, { category: e.target.value as CompanyObjective['category'] })} className="border border-line rounded-lg p-2 text-xs bg-canvas">
                <option value="BUSINESS">Business</option>
                <option value="PEOPLE">People</option>
              </select>
              <input type="number" min={0} max={100} value={o.progress} onChange={(e) => updateObjective(idx, { progress: Number(e.target.value) })} className="border border-line rounded-lg p-2 text-xs bg-canvas" title="Tiến độ %" />
              <button type="button" className="text-[11px] font-semibold text-danger hover:underline" onClick={() => setForm({ ...form, companyObjectives: form.companyObjectives.filter((_, i) => i !== idx) })}>Xoá</button>
            </div>
          ))}
        </Card>
      </fieldset>

      <Modal
        isOpen={Boolean(reopenTarget)}
        onClose={() => { if (!reopening) setReopenTarget(null); }}
        title={reopenTarget === 'CYCLE' ? 'Mở lại chu kỳ OKR' : `Mở lại phase ${reopenPhaseTarget?.name || ''}`}
        maxWidth="md"
      >
        <div className="space-y-3">
          {reopenTarget === 'CYCLE' ? (
            <div className="rounded-lg border border-line bg-canvas p-2.5 text-[11px] text-ink-secondary">
              Mở lại toàn bộ chu kỳ. Các phase vẫn tự tính theo ngày; phase nào đã quá hạn sẽ tiếp tục bị khoá cho tới khi mở riêng phase đó.
            </div>
          ) : reopenPhaseTarget ? (
            <>
              <div className="rounded-lg border border-line bg-canvas p-2.5 text-[11px] text-ink-secondary space-y-1">
                <div><b>{reopenPhaseTarget.name}</b> · {reopenPhaseTarget.key}</div>
                <div>Thời gian hiện tại: {reopenPhaseTarget.start_date || '—'} → {reopenPhaseTarget.due_date || '—'}</div>
                {isPhaseOverdue(reopenPhaseTarget) && (
                  <div className="text-amber-700">Phase đã quá hạn — bắt buộc nhập hạn chót mới từ hôm nay trở đi.</div>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink mb-1">
                  Hạn chót mới {isPhaseOverdue(reopenPhaseTarget) ? <span className="text-danger">*</span> : <span className="text-ink-muted font-normal">(để trống = giữ nguyên)</span>}
                </label>
                <input
                  type="date"
                  value={reopenDueDate}
                  min={isoToday()}
                  onChange={(e) => setReopenDueDate(e.target.value)}
                  className="w-full border border-line rounded-lg p-2 text-xs bg-canvas"
                />
              </div>
            </>
          ) : null}

          <div>
            <label className="block text-xs font-semibold text-ink mb-1">Lý do mở lại <span className="text-danger">*</span></label>
            <textarea
              rows={2}
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
              placeholder="Ví dụ: HR mở lại để nhân viên bổ sung theo kế hoạch điều chỉnh..."
              className="w-full border border-line rounded-lg p-2.5 text-xs bg-canvas"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-line">
            <Button size="sm" variant="ghost" onClick={() => setReopenTarget(null)} disabled={reopening}>Huỷ</Button>
            <Button size="sm" variant="primary" onClick={submitReopen} disabled={reopening || !reopenReason.trim()}>
              {reopening ? 'Đang mở...' : 'Xác nhận mở lại'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
