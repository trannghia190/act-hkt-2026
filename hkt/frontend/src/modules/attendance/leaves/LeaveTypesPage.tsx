import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Check, Lock, Pencil, Plus, Trash2 } from 'lucide-react';
import { Badge } from '../../../components/common/Badge';
import { Modal } from '../../../components/common/Modal';

interface LeaveType {
  id?: string;
  code: string;
  name: string;
  defaultDays: number | null;
  requiresAttachment: boolean;
  isActive: boolean;
  isSystem?: boolean;
  isPaid: boolean;
  deductsAnnualLeave: boolean;
  unit: 'DAY' | 'HALF_DAY';
  submitWithinDays: number;
}

const authHeaders = (): Record<string, string> => {
  try {
    const user = JSON.parse(localStorage.getItem('pulse_auth_user') || '{}');
    return user?.accessToken ? { Authorization: `Bearer ${user.accessToken}` } : {};
  } catch {
    return {};
  }
};

const emptyForm: LeaveType = { code: '', name: '', defaultDays: null, requiresAttachment: false, isActive: true, isPaid: true, deductsAnnualLeave: false, unit: 'DAY', submitWithinDays: 3 };

export const LeaveTypesPage: React.FC = () => {
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [editing, setEditing] = useState<LeaveType | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<LeaveType>(emptyForm);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'SYSTEM' | 'CUSTOM' | 'OFF'>('ALL');

  const load = () => {
    fetch('/api/v1/admin/leave-types', { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => { if (Array.isArray(j?.data)) setTypes(j.data); else setError(j?.message || 'Không tải được loại nghỉ'); })
      .catch(() => setError('Không tải được loại nghỉ'));
  };

  useEffect(load, []);

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2500); };

  const openAdd = () => { setEditing(null); setForm(emptyForm); setIsOpen(true); };
  const openEdit = (t: LeaveType) => { setEditing(t); setForm({ ...t }); setIsOpen(true); };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim() || !form.name.trim()) return;
    const url = editing ? `/api/v1/admin/leave-types/${encodeURIComponent(editing.code)}` : '/api/v1/admin/leave-types';
    const res = await fetch(url, {
      method: editing ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ ...form, defaultDays: form.defaultDays === null ? null : Number(form.defaultDays) }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setError(json?.message || 'Lưu loại nghỉ thất bại'); return; }
    setEditing(null);
    setForm(emptyForm);
    setIsOpen(false);
    setError(null);
    showToast(editing ? 'Đã cập nhật loại nghỉ' : 'Đã thêm loại nghỉ');
    load();
  };

  const remove = async (t: LeaveType) => {
    if (!window.confirm(`Xóa loại nghỉ "${t.name}" (${t.code})? Chỉ loại HR tự thêm mới xóa được.`)) return;
    const res = await fetch(`/api/v1/admin/leave-types/${encodeURIComponent(t.code)}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setError(json?.message || 'Xóa loại nghỉ thất bại'); return; }
    setError(null);
    showToast('Đã xóa loại nghỉ');
    load();
  };

  const activeCount = types.filter((t) => t.isActive).length;
  const systemCount = types.filter((t) => t.isSystem).length;
  const attachCount = types.filter((t) => t.requiresAttachment).length;

  const shown = useMemo(() => types.filter((t) => {
    if (filter === 'SYSTEM') return t.isSystem;
    if (filter === 'CUSTOM') return !t.isSystem;
    if (filter === 'OFF') return !t.isActive;
    return true;
  }), [types, filter]);

  const FILTERS: Array<{ id: typeof filter; label: string; count: number }> = [
    { id: 'ALL', label: 'Tất cả', count: types.length },
    { id: 'SYSTEM', label: 'Hệ thống', count: systemCount },
    { id: 'CUSTOM', label: 'HR tự thêm', count: types.length - systemCount },
    { id: 'OFF', label: 'Đang tắt', count: types.length - activeCount },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-4 pb-24">
      {toast && (
        <div className="fixed right-6 top-16 z-[100] rounded-lg bg-status-ok px-4 py-2 text-xs font-semibold text-on-ok shadow-sm">
          {toast}
        </div>
      )}

      {/* Đầu trang — mockup `.phead` */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-accent-dark">
            <CalendarDays className="h-3.5 w-3.5" />
            Quản trị HR
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <h1 className="font-display text-xl font-extrabold tracking-tight text-ink sm:text-[23px]">
              Danh mục loại nghỉ phép
            </h1>
            <Badge variant="accent">S10</Badge>
          </div>
          <p className="mt-1 text-xs text-ink-muted">
            Thêm/sửa loại nghỉ không cần sửa code — rule chung → loại nghỉ → đơn.
          </p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-accent px-3.5 text-xs font-semibold text-on-accent transition-colors hover:bg-accent-hover"
        >
          <Plus className="h-3.5 w-3.5" />
          Thêm loại nghỉ
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-status-danger-line bg-status-danger-soft p-3 text-sm text-status-danger">
          {error}
        </div>
      )}

      {/* Bìa tóm tắt danh mục */}
      <div className="overflow-hidden rounded-[16px] border border-line bg-ink px-5 py-4 text-canvas">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-canvas/60">
              Danh mục dùng chung
            </div>
            <div className="mt-1 font-display text-lg font-extrabold">Loại nghỉ đang áp dụng</div>
            <p className="mt-1 max-w-xl text-xs leading-relaxed text-canvas/75">
              Loại HR tự thêm mới xoá được; loại hệ thống chỉ tắt được để bảo toàn đơn cũ.
              Hạn gửi đơn và yêu cầu giấy tờ áp dụng ngay khi nhân viên tạo đơn.
            </p>
          </div>
          <dl className="flex gap-6">
            <div>
              <dd className="font-display text-2xl font-extrabold tabular-nums">{types.length}</dd>
              <dt className="text-[11px] text-canvas/60">loại nghỉ</dt>
            </div>
            <div>
              <dd className="font-display text-2xl font-extrabold tabular-nums">{activeCount}</dd>
              <dt className="text-[11px] text-canvas/60">đang dùng</dt>
            </div>
            <div>
              <dd className="font-display text-2xl font-extrabold tabular-nums">{attachCount}</dd>
              <dt className="text-[11px] text-canvas/60">cần giấy tờ</dt>
            </div>
          </dl>
        </div>
      </div>

      {/* Chip lọc */}
      <div className="flex gap-2 overflow-x-auto pb-0.5 sm:flex-wrap">
        {FILTERS.map((f) => {
          const on = filter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              aria-pressed={on}
              onClick={() => setFilter(f.id)}
              className={`inline-flex h-[31px] flex-none items-center gap-1.5 rounded-full border px-3 text-[11.5px] font-semibold transition-colors ${
                on
                  ? 'border-ink bg-ink text-canvas'
                  : 'border-line bg-surface text-ink-secondary hover:border-line-hover hover:text-ink'
              }`}
            >
              {f.label}
              <span className={`font-mono text-[10.5px] ${on ? 'opacity-65' : 'text-ink-muted'}`}>{f.count}</span>
            </button>
          );
        })}
      </div>

      {/* Danh sách loại nghỉ */}
      <div className="flex flex-col gap-2.5">
        {shown.length === 0 && (
          <div className="rounded-[13px] border border-line bg-surface p-6 text-center text-xs text-ink-muted">
            Chưa có loại nghỉ nào trong nhóm này.
          </div>
        )}
        {shown.map((t) => (
          <section
            key={t.code}
            className="rounded-[13px] border border-line bg-surface px-4 py-3.5 transition-colors hover:border-line-hover"
          >
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-5">
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-accent-soft px-1.5 py-[2.5px] font-mono text-[10.5px] font-bold text-accent-dark">
                    {t.code}
                  </span>
                  <h3 className="text-[13.5px] font-bold tracking-[-0.01em] text-ink">{t.name}</h3>
                  {t.isSystem && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-surface-secondary px-1.5 py-[2.5px] text-[10.5px] font-semibold text-ink-muted">
                      <Lock className="h-2.5 w-2.5" />
                      hệ thống
                    </span>
                  )}
                  <Badge variant={t.isActive ? 'ok' : 'gray'}>{t.isActive ? 'đang dùng' : 'đã tắt'}</Badge>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  <span className="inline-flex items-center gap-1.5 rounded-[7px] border border-line bg-canvas px-2 py-[3px] text-[11px] text-ink-secondary">
                    <b className="font-semibold text-ink">{t.defaultDays != null ? `${t.defaultDays} ngày/năm` : 'Theo BHXH'}</b>
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-[7px] border border-line bg-canvas px-2 py-[3px] text-[11px] text-ink-secondary">
                    <b className="font-semibold text-ink">{t.unit === 'HALF_DAY' ? 'Nửa ngày' : 'Ngày'}</b>
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-[7px] border border-line bg-canvas px-2 py-[3px] text-[11px] text-ink-secondary">
                    {t.isPaid ? 'Hưởng lương' : 'Không lương'}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-[7px] border border-line bg-canvas px-2 py-[3px] text-[11px] text-ink-secondary">
                    {t.requiresAttachment ? 'Cần giấy tờ' : 'Không cần giấy tờ'}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-[7px] border border-line bg-canvas px-2 py-[3px] text-[11px] text-ink-secondary">
                    Gửi trong <b className="font-semibold text-ink">{t.submitWithinDays} ngày</b>
                  </span>
                  {t.deductsAnnualLeave && (
                    <span className="inline-flex items-center gap-1.5 rounded-[7px] border border-line bg-canvas px-2 py-[3px] text-[11px] text-ink-secondary">
                      Trừ phép năm
                    </span>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 gap-2 sm:flex-col">
                <button
                  type="button"
                  onClick={() => openEdit(t)}
                  className="inline-flex h-[30px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 text-[11.5px] font-semibold text-ink-secondary transition-colors hover:bg-canvas hover:text-ink sm:flex-none"
                >
                  <Pencil className="h-3 w-3" />
                  Sửa
                </button>
                {!t.isSystem && (
                  <button
                    type="button"
                    onClick={() => remove(t)}
                    className="inline-flex h-[30px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-status-danger-line bg-surface px-2.5 text-[11.5px] font-semibold text-status-danger transition-colors hover:bg-status-danger-soft sm:flex-none"
                  >
                    <Trash2 className="h-3 w-3" />
                    Xoá
                  </button>
                )}
              </div>
            </div>
          </section>
        ))}
      </div>

      <p className="text-[11px] text-ink-muted">
        Loại hệ thống chỉ tắt được, không xoá — đơn cũ vẫn giữ đúng loại nghỉ. Mọi thay đổi áp dụng ngay cho đơn mới.
      </p>

      {/* Modal thêm/sửa loại nghỉ */}
      <Modal
        isOpen={isOpen}
        onClose={() => { setEditing(null); setForm(emptyForm); setIsOpen(false); }}
        title={editing ? 'Sửa loại nghỉ' : 'Thêm loại nghỉ'}
        maxWidth="lg"
      >
        <form className="space-y-3" onSubmit={save}>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-xs font-semibold text-ink">
              Mã *
              <input
                className="mt-1 w-full rounded-lg border border-line bg-surface p-2 font-mono text-sm text-ink disabled:bg-canvas disabled:text-ink-muted"
                value={form.code}
                disabled={!!editing}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="VD: WFH_LEAVE"
              />
            </label>
            <label className="text-xs font-semibold text-ink">
              Tên *
              <input
                className="mt-1 w-full rounded-lg border border-line bg-surface p-2 text-sm text-ink"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="VD: Nghỉ chăm con"
              />
            </label>
          </div>
          <label className="block text-xs font-semibold text-ink">
            Số ngày/năm (trống = theo BHXH)
            <input
              type="number"
              step="0.5"
              className="mt-1 w-full rounded-lg border border-line bg-surface p-2 text-sm text-ink"
              value={form.defaultDays ?? ''}
              onChange={(e) => setForm({ ...form, defaultDays: e.target.value === '' ? null : Number(e.target.value) })}
              placeholder="VD: 12"
            />
          </label>

          <div className="grid gap-2 text-xs sm:grid-cols-2">
            <label className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-ink">
              <span>Cần giấy tờ</span>
              <input type="checkbox" className="accent-accent" checked={form.requiresAttachment} onChange={(e) => setForm({ ...form, requiresAttachment: e.target.checked })} />
            </label>
            <label className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-ink">
              <span>Hưởng lương</span>
              <input type="checkbox" className="accent-accent" checked={form.isPaid} onChange={(e) => setForm({ ...form, isPaid: e.target.checked })} />
            </label>
            <label className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-ink">
              <span>Trừ phép năm</span>
              <input type="checkbox" className="accent-accent" checked={form.deductsAnnualLeave} onChange={(e) => setForm({ ...form, deductsAnnualLeave: e.target.checked })} />
            </label>
            <label className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-ink">
              <span>Đang áp dụng</span>
              <input type="checkbox" className="accent-accent" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
            </label>
            <label className="block font-semibold text-ink">
              Đơn vị
              <select
                className="mt-1 w-full rounded-lg border border-line bg-surface p-2 text-sm text-ink"
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value as 'DAY' | 'HALF_DAY' })}
              >
                <option value="DAY">Ngày</option>
                <option value="HALF_DAY">Nửa ngày</option>
              </select>
            </label>
            <label className="block font-semibold text-ink">
              Hạn gửi (ngày)
              <input
                type="number"
                min={0}
                className="mt-1 w-full rounded-lg border border-line bg-surface p-2 text-sm text-ink"
                value={form.submitWithinDays}
                onChange={(e) => setForm({ ...form, submitWithinDays: Number(e.target.value) || 0 })}
              />
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-secondary"
              onClick={() => { setEditing(null); setForm(emptyForm); setIsOpen(false); }}
            >
              Huỷ
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-on-accent transition-colors hover:bg-accent-hover"
            >
              <Check className="h-3 w-3" />
              {editing ? 'Lưu thay đổi' : 'Thêm loại nghỉ'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
