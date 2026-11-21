import React, { useCallback, useEffect, useState } from 'react';
import { Card } from '../../../components/common/Card';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { Modal } from '../../../components/common/Modal';

interface Phase {
  key: string;
  name: string;
  start_date?: string;
  due_date?: string;
  status: string; // lưu: locked = khoá cứng, còn lại = theo ngày
  effective_status?: string; // tính theo ngày: active | upcoming | locked
  days_left?: number | null;
}

interface CompanyObjective {
  id?: string;
  title: string;
  category: 'BUSINESS' | 'PEOPLE';
  progress: number;
}

interface Cycle {
  id: string;
  name: string;
  year: number;
  scaleMin: number;
  scaleMax: number;
  checkinInterval: string;
  alignmentEnabled: boolean;
  status: string;
  phases: Phase[];
  companyObjectives: CompanyObjective[];
  seniorityCutoffDate?: string | null;
  effectiveSeniorityCutoff?: string;
  directorReviewedAt?: string | null;
  directorReviewComment?: string | null;
  directorReviewPending?: boolean;
}

const PHASE_LABELS: Record<string, string> = {
  setup: 'Thiết lập OKR',
  checkin: 'Check-in định kỳ',
  midyear: 'Review giữa năm',
  final: 'Đánh giá cuối năm',
  summary: 'Tổng hợp & báo cáo',
};

const emptyPhase = (key: string): Phase => ({
  key,
  name: PHASE_LABELS[key] || key,
  start_date: '',
  due_date: '',
  status: 'scheduled',
});

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const isoToday = (): string => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

const addDaysIso = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

const isPhaseOverdue = (phase: Phase): boolean =>
  Boolean(phase.due_date && phase.due_date < isoToday());

/** Nhãn mốc tháng chỉ để hiển thị — luôn suy ra từ start/due, không cho nhập tay. */
const monthsLabel = (start?: string, due?: string): string => {
  if (!start || !due || start.length < 10 || due.length < 10) return '';
  const sy = Number(start.slice(0, 4));
  const sm = Number(start.slice(5, 7)) - 1;
  const dy = Number(due.slice(0, 4));
  const dm = Number(due.slice(5, 7)) - 1;
  if (Number.isNaN(sy) || Number.isNaN(sm) || Number.isNaN(dy) || Number.isNaN(dm)) return '';
  if (sy !== dy) return `${MONTHS[sm]} ${sy}–${MONTHS[dm]} ${dy}`;
  if (sm === dm) return MONTHS[sm];
  return `${MONTHS[sm]}–${MONTHS[dm]}`;
};

const STATUS_LABEL: Record<string, string> = {
  active: 'Đang mở',
  upcoming: 'Sắp tới',
  locked: 'Đã khoá',
};

export const OKRCyclesPage: React.FC = () => {
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<Cycle | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Mở lại: 'CYCLE' = mở cả chu kỳ, Phase = mở đúng phase đang bấm
  const [reopenTarget, setReopenTarget] = useState<Phase | 'CYCLE' | null>(null);
  const [reopenReason, setReopenReason] = useState('');
  const [reopenDueDate, setReopenDueDate] = useState('');
  const [reopening, setReopening] = useState(false);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/okr/cycles');
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || 'Không tải được chu kỳ');
      const list: Cycle[] = json.data || [];
      setCycles(list);
      const first = list.find((c) => c.status === 'active') || list[0];
      if (first) {
        setSelectedId(first.id);
        setForm(normalize(first));
      }
    } catch (err: any) {
      showToast(err.message || 'Không tải được chu kỳ OKR');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const normalize = (c: Cycle): Cycle => {
    const keys = ['setup', 'checkin', 'midyear', 'final', 'summary'];
    const byKey = new Map((c.phases || []).map((p) => [p.key, p]));
    return {
      ...c,
      companyObjectives: c.companyObjectives || [],
      phases: keys.map((k) => {
        const p = byKey.get(k) || emptyPhase(k);
        return {
          ...p,
          start_date: p.start_date ? p.start_date.substring(0, 10) : '',
          due_date: p.due_date ? p.due_date.substring(0, 10) : '',
        };
      }),
    };
  };

  const selectCycle = (c: Cycle) => {
    setSelectedId(c.id);
    setForm(normalize(c));
  };

  const updatePhase = (key: string, patch: Partial<Phase>) => {
    if (!form) return;
    setForm({ ...form, phases: form.phases.map((p) => p.key === key ? { ...p, ...patch } : p) });
  };

  const save = async () => {
    if (!form) return;
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
        status: form.status === 'closed' ? 'closed' : 'active',
        companyObjectives: form.companyObjectives,
        phases: form.phases.map((p) => ({
          key: p.key,
          name: p.name,
          startDate: p.start_date,
          dueDate: p.due_date,
          status: p.status === 'locked' ? 'locked' : 'scheduled',
        })),
      };
      const res = await fetch(selectedId ? `/api/v1/okr/cycles/${selectedId}` : '/api/v1/okr/cycles', {
        method: selectedId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || 'Không lưu được chu kỳ');
      showToast('Đã lưu cấu hình chu kỳ OKR');
      load();
    } catch (err: any) {
      showToast(err.message || 'Không lưu được chu kỳ');
    } finally {
      setSaving(false);
    }
  };

  const lock = async () => {
    if (!selectedId) return;
    if (!confirm('Chốt & khoá chu kỳ này? Sau khi khoá, chỉ HR mới mở lại được (kèm lý do).')) return;
    try {
      const post = (body: object) => fetch(`/api/v1/okr/cycles/${selectedId}/lock`, {
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
    }
  };

  const sendReminders = async () => {
    if (!selectedId) return;
    try {
      const res = await fetch(`/api/v1/okr/cycles/${selectedId}/send-reminders`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || 'Không gửi được nhắc');
      showToast(json.message);
    } catch (err: any) {
      showToast(err.message || 'Không gửi được nhắc');
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
    if (!selectedId || !reopenTarget) return;
    if (!reopenReason.trim()) { showToast('Lý do mở lại là bắt buộc'); return; }

    const isCycle = reopenTarget === 'CYCLE';
    const phase = isCycle ? null : reopenTarget;
    if (phase && isPhaseOverdue(phase) && !reopenDueDate) {
      showToast('Phase đã quá hạn — cần nhập hạn chót mới');
      return;
    }

    setReopening(true);
    try {
      const res = await fetch(`/api/v1/okr/cycles/${selectedId}/reopen`, {
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

  const newCycle = () => {
    const year = Math.max(new Date().getFullYear(), ...cycles.map((c) => c.year + 1));
    setSelectedId(null);
    setForm(normalize({
      id: '',
      name: `Chu kỳ OKR ${year}`,
      year,
      scaleMin: 1,
      scaleMax: 5,
      checkinInterval: 'MONTHLY',
      alignmentEnabled: false,
      status: 'active',
      phases: [],
      companyObjectives: [],
    }));
  };

  const updateObjective = (idx: number, patch: Partial<CompanyObjective>) => {
    if (!form) return;
    setForm({ ...form, companyObjectives: form.companyObjectives.map((o, i) => (i === idx ? { ...o, ...patch } : o)) });
  };

  const reopenPhaseTarget = reopenTarget && reopenTarget !== 'CYCLE' ? reopenTarget : null;

  if (loading) {
    return <Card><div className="p-8 text-center text-xs text-ink-muted">Đang tải chu kỳ OKR...</div></Card>;
  }

  return (
    <div className="space-y-5 max-w-5xl mx-auto pb-12">
      {toast && <div className="fixed top-16 right-6 z-50 bg-ink text-canvas px-4 py-2.5 rounded-lg text-xs font-semibold shadow-lg">{toast}</div>}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink">Quản Lý Chu Kỳ OKR (S44)</h1>
          <p className="text-xs text-ink-muted mt-1">5 phase theo mốc thật · hạn chót theo ngày · thang điểm 1–5 · tần suất check-in · bật/tắt phân tầng.</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedId || ''}
            onChange={(e) => { const c = cycles.find((x) => x.id === e.target.value); if (c) selectCycle(c); }}
            className="text-xs p-2 border border-line rounded-lg bg-surface font-semibold text-ink"
          >
            {cycles.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.status})</option>)}
            {!selectedId && form && <option value="">{form.name} (mới)</option>}
          </select>
          <Button size="sm" variant="outline" onClick={newCycle}>+ Chu kỳ mới</Button>
          <Button size="sm" variant="outline" onClick={load}>↻</Button>
        </div>
      </div>

      {!form ? (
        <Card><div className="p-8 text-center text-xs text-ink-muted">Chưa có chu kỳ OKR.</div></Card>
      ) : (
        <>
          <Card className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-line pb-3">
              <div>
                <h2 className="text-sm font-bold text-ink">{form.name}</h2>
                <div className="text-[11px] text-ink-muted">Năm {form.year} · Thang điểm {form.scaleMin}–{form.scaleMax} · Check-in {form.checkinInterval}</div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={form.status === 'active' ? 'ok' : form.status === 'closed' ? 'gray' : 'warn'}>{form.status.toUpperCase()}</Badge>
                <Badge variant={form.directorReviewPending ? 'warn' : 'ok'}>
                  {form.directorReviewPending ? 'Chờ Giám đốc duyệt' : 'Giám đốc đã duyệt'}
                </Badge>
                {selectedId && form.status !== 'closed' && <Button size="sm" variant="outline" onClick={sendReminders} title="Nhắc những người còn việc chưa xong ở các phase sắp hết hạn (≤ 3 ngày)">🔔 Gửi nhắc hạn</Button>}
                {selectedId && form.status === 'closed' && <Button size="sm" variant="outline" onClick={() => openReopen('CYCLE')}>🔓 Mở lại chu kỳ</Button>}
                {selectedId && form.status !== 'closed' && <Button size="sm" variant="outline" onClick={lock}>🔒 Chốt &amp; khoá</Button>}
                <Button size="sm" variant="primary" onClick={save} disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu cấu hình'}</Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-semibold text-ink mb-1">Tên chu kỳ</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border border-line rounded-lg p-2 text-xs bg-canvas" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink mb-1">Năm</label>
                <input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: Number(e.target.value) })} className="w-full border border-line rounded-lg p-2 text-xs bg-canvas" />
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
                  {form.status === 'closed' ? 'Đã chốt & khoá' : 'Đang hoạt động'} · dùng nút Chốt &amp; khoá / Mở lại
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
            <div className="text-sm font-bold text-ink border-b border-line pb-2">Timeline 5 phase — hạn chót theo ngày</div>
            <div className="space-y-2">
              {form.phases.map((p, idx) => (
                <div key={p.key} className="rounded-xl border border-line p-3 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-accent text-white text-xs grid place-items-center">{idx + 1}</span>
                      <div>
                        <div className="text-xs font-bold text-ink">{p.name}</div>
                        <div className="text-[11px] text-ink-muted">
                          {p.key} · {monthsLabel(p.start_date, p.due_date) || 'Chưa đặt mốc'}
                        </div>
                      </div>
                    </div>
                    {(() => {
                      const eff = p.effective_status || 'upcoming';
                      return (
                        <div className="flex items-center gap-2">
                          <Badge variant={eff === 'active' ? 'ok' : eff === 'locked' ? 'gray' : 'warn'}>
                            {STATUS_LABEL[eff] || eff}
                            {eff === 'active' && typeof p.days_left === 'number' ? ` · còn ${p.days_left} ngày` : ''}
                          </Badge>
                          {selectedId && eff === 'locked' && (
                            <Button size="sm" variant="outline" className="h-auto py-1 px-2.5 text-[11px]" onClick={() => openReopen(p)}>
                              🔓 Mở lại phase
                            </Button>
                          )}
                        </div>
                      );
                    })()}
                  </div>
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
                  {p.status === 'locked' && (
                    <div className="text-[11px] text-ink-muted">🔒 Phase đã khoá cứng — bấm “Mở lại phase” ngay trên phase này để mở kèm lý do.</div>
                  )}
                </div>
              ))}
            </div>
            <div className="rounded-lg border border-line bg-canvas p-2.5 text-[11px] text-ink-muted">
              Trạng thái phase tính theo ngày: trước ngày bắt đầu là “Sắp tới”, trong khoảng là “Đang mở”, qua hạn chót tự khoá.
              Các phase được phép chồng nhau (ví dụ check-in kéo dài tới cuối tháng 11 trong khi đánh giá cuối năm bắt đầu từ giữa tháng 11).
              Phase đã khoá chỉ HR mở lại được, kèm lý do ghi audit.
              Hệ thống tự nhắc trước hạn chót 3 ngày (8:00 hằng ngày): check-in theo kỳ, gửi OKR, review giữa năm, tự đánh giá / chấm điểm cuối năm, chốt chu kỳ.
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
        </>
      )}
    </div>
  );
};
