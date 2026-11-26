import React, { useEffect, useState } from 'react';

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
    setEditing(undefined as any);
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

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {toast && <div className="fixed top-16 right-6 z-[100] bg-status-ok text-on-ok px-4 py-2 rounded text-xs font-semibold">{toast}</div>}
      <div className="bg-canvas border border-line rounded-xl p-6">
        <h1 className="text-xl font-bold text-ink mt-1">Quản lý loại nghỉ</h1>
        <p className="text-xs text-ink-muted mt-1">Thêm/sửa loại nghỉ không cần sửa code — rule chung → loại nghỉ → đơn.</p>
      </div>

      {error && <div className="text-sm text-status-danger bg-status-danger-soft border border-status-danger-line rounded-lg p-3">{error}</div>}

      <div className="bg-surface border border-line rounded-xl p-4">
        <div className="flex justify-end mb-2">
          <button className="text-xs px-3 py-1.5 rounded bg-accent text-on-accent" onClick={openAdd}>+ Thêm loại nghỉ</button>
        </div>
        {types.map((t) => (
          <div key={t.code} className="flex items-center justify-between border border-line rounded-lg px-3 py-2 mb-2 text-sm">
            <div>
              <span className="font-mono text-xs text-accent mr-2">{t.code}</span>
              <span className="font-semibold">{t.name}</span>
              <span className="ml-2 text-xs text-ink-muted">{t.isActive ? 'đang dùng' : 'đã tắt'}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-ink-muted">
              <span>{t.defaultDays != null ? `${t.defaultDays} ngày/năm` : 'Theo BHXH'} · {t.unit === 'HALF_DAY' ? 'nửa ngày' : 'ngày'} · {t.isPaid ? 'hưởng lương' : 'không lương'} · {t.requiresAttachment ? 'cần giấy tờ' : 'không cần giấy tờ'}</span>
              <button className="px-2 py-1 rounded border border-line text-ink" onClick={() => openEdit(t)}>Sửa</button>
              {t.isSystem ? (
                <span className="px-2 py-1 rounded bg-surface-secondary text-ink-muted" title="Danh mục khởi tạo sẵn — chỉ được tắt, không xóa">hệ thống</span>
              ) : (
                <button className="px-2 py-1 rounded border border-status-danger-line text-status-danger" onClick={() => remove(t)}>Xóa</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {isOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 grid place-items-center p-4" onClick={() => { setEditing(undefined as any); setForm(emptyForm); setIsOpen(false); }}>
          <form className="bg-surface rounded-xl p-5 w-full max-w-md space-y-3" onClick={(e) => e.stopPropagation()} onSubmit={save}>
            <h3 className="text-base font-bold">{editing ? 'Sửa loại nghỉ' : 'Thêm loại nghỉ'}</h3>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs font-semibold">Mã *<input className="mt-1 w-full border border-line rounded-lg p-2 text-sm" value={form.code} disabled={!!editing} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} /></label>
              <label className="text-xs font-semibold">Tên *<input className="mt-1 w-full border border-line rounded-lg p-2 text-sm" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            </div>
            <label className="text-xs font-semibold">Số ngày/năm (trống = theo BHXH)
              <input type="number" step="0.5" className="mt-1 w-full border border-line rounded-lg p-2 text-sm" value={form.defaultDays ?? ''} onChange={(e) => setForm({ ...form, defaultDays: e.target.value === '' ? null : Number(e.target.value) })} />
            </label>
            <label className="flex items-center justify-between text-sm border border-line rounded-lg px-3 py-2">
              <span>Cần giấy tờ</span>
              <input type="checkbox" checked={form.requiresAttachment} onChange={(e) => setForm({ ...form, requiresAttachment: e.target.checked })} />
            </label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <label className="flex items-center justify-between border border-line rounded-lg px-3 py-2">
                <span>Hưởng lương</span>
                <input type="checkbox" checked={form.isPaid} onChange={(e) => setForm({ ...form, isPaid: e.target.checked })} />
              </label>
              <label className="flex items-center justify-between border border-line rounded-lg px-3 py-2">
                <span>Trừ phép năm</span>
                <input type="checkbox" checked={form.deductsAnnualLeave} onChange={(e) => setForm({ ...form, deductsAnnualLeave: e.target.checked })} />
              </label>
              <label className="block font-semibold">Đơn vị
                <select className="mt-1 w-full border border-line rounded-lg p-2 text-sm" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value as 'DAY' | 'HALF_DAY' })}>
                  <option value="DAY">Ngày</option>
                  <option value="HALF_DAY">Nửa ngày</option>
                </select>
              </label>
              <label className="block font-semibold">Hạn gửi (ngày)
                <input type="number" min={0} className="mt-1 w-full border border-line rounded-lg p-2 text-sm" value={form.submitWithinDays} onChange={(e) => setForm({ ...form, submitWithinDays: Number(e.target.value) || 0 })} />
              </label>
            </div>
            <label className="flex items-center justify-between text-sm border border-line rounded-lg px-3 py-2">
              <span>Đang áp dụng</span>
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" className="text-xs px-3 py-1.5 rounded border border-line" onClick={() => { setEditing(undefined as any); setForm(emptyForm); setIsOpen(false); }}>Huỷ</button>
              <button type="submit" className="text-xs px-3 py-1.5 rounded bg-accent text-on-accent">Lưu</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
