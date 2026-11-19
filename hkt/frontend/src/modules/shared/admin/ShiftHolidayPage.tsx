import React, { useEffect, useState } from 'react';

interface Shift {
  id?: string;
  code: string;
  name: string;
  checkInStart: string;
  checkInEnd: string;
  checkOutStart: string;
  checkOutEnd: string;
  lunchBreakStart: string;
  lunchBreakEnd: string;
  requiredWorkHours: number;
  isActive: boolean;
  isFlexible: boolean;
  flexibleCheckinFrom: string;
  flexibleCheckinTo: string;
  flexibleCheckoutFrom: string;
  flexibleCheckoutTo: string;
  geofenceRadiusM: number;
  ipRanges: string;
  isException: boolean;
  requiresHrApproval: boolean;
  targetGroup: string;
  targetPosition: string;
}

interface Holiday { id?: string; name: string; holidayDate: string; isPaid: boolean; }

const authHeaders = (): Record<string, string> => {
  try {
    const u = JSON.parse(localStorage.getItem('pulse_auth_user') || '{}');
    return u?.accessToken ? { Authorization: `Bearer ${u.accessToken}` } : {};
  } catch { return {}; }
};

const emptyShift: Shift = {
  code: '', name: '', checkInStart: '08:00', checkInEnd: '09:30', checkOutStart: '17:00', checkOutEnd: '18:30',
  lunchBreakStart: '12:00', lunchBreakEnd: '13:00', requiredWorkHours: 8, isActive: true, isFlexible: false,
  flexibleCheckinFrom: '08:00', flexibleCheckinTo: '10:00', flexibleCheckoutFrom: '17:00', flexibleCheckoutTo: '19:00',
  geofenceRadiusM: 150, ipRanges: '10.0.0.0/8,192.168.0.0/16', isException: false, requiresHrApproval: false,
  targetGroup: '', targetPosition: '',
};

const t = (v: string) => (v && v.length === 5 ? `${v}:00` : v);

export const ShiftHolidayPage: React.FC = () => {
  const [tab, setTab] = useState<'shifts' | 'holidays'>('shifts');
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [editing, setEditing] = useState<Shift | null>(null);
  const [form, setForm] = useState<Shift>(emptyShift);
  const [holidayForm, setHolidayForm] = useState<Holiday>({ name: '', holidayDate: '', isPaid: true });
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    fetch('/api/v1/admin/shifts', { headers: authHeaders() }).then(r => r.json()).then(j => { if (Array.isArray(j?.data)) setShifts(j.data); }).catch(() => undefined);
    fetch('/api/v1/admin/holidays', { headers: authHeaders() }).then(r => r.json()).then(j => { if (Array.isArray(j?.data)) setHolidays(j.data); }).catch(() => undefined);
  };
  useEffect(load, []);
  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2500); };

  const openAdd = () => { setEditing(null); setForm(emptyShift); };
  const openEdit = (s: Shift) => { setEditing(s); setForm({ ...s }); };

  const saveShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim() || !form.name.trim()) return;
    const body = {
      ...form,
      checkInStart: t(form.checkInStart), checkInEnd: t(form.checkInEnd),
      checkOutStart: t(form.checkOutStart), checkOutEnd: t(form.checkOutEnd),
      lunchBreakStart: t(form.lunchBreakStart), lunchBreakEnd: t(form.lunchBreakEnd),
      flexibleCheckinFrom: t(form.flexibleCheckinFrom), flexibleCheckinTo: t(form.flexibleCheckinTo),
      flexibleCheckoutFrom: t(form.flexibleCheckoutFrom), flexibleCheckoutTo: t(form.flexibleCheckoutTo),
      requiredWorkHours: Number(form.requiredWorkHours), geofenceRadiusM: Number(form.geofenceRadiusM),
    };
    const url = editing ? `/api/v1/admin/shifts/${encodeURIComponent(editing.code)}` : '/api/v1/admin/shifts';
    const res = await fetch(url, { method: editing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setError(json?.message || 'Lưu ca thất bại'); return; }
    setEditing(null); setForm(emptyShift); setError(null); showToast('Đã lưu ca làm việc'); load();
  };

  const addHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!holidayForm.name.trim() || !holidayForm.holidayDate) return;
    const res = await fetch('/api/v1/admin/holidays', { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(holidayForm) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setError(json?.message || 'Thêm ngày lễ thất bại'); return; }
    setHolidayForm({ name: '', holidayDate: '', isPaid: true }); setError(null); showToast('Đã thêm ngày lễ'); load();
  };

  const modalOpen = editing !== null || form !== emptyShift;

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {toast && <div className="fixed top-16 right-6 z-50 bg-emerald-700 text-white px-4 py-2 rounded text-xs font-semibold">{toast}</div>}
      <div className="bg-canvas border border-line rounded-xl p-6">
        <div className="text-xs text-accent font-semibold">S26 · HR</div>
        <h1 className="text-xl font-bold text-ink mt-1">Ca làm việc & lịch nghỉ lễ</h1>
        <p className="text-xs text-ink-muted mt-1">Ca thường / ca linh hoạt (8–10h · 17–19h, đủ 8h = 1 công) · bộ gán ca theo nhóm + chức danh · geofence + dải IP · ngày lễ theo năm.</p>
        <div className="flex gap-2 mt-3">
          {(['shifts', 'holidays'] as const).map(x => (
            <button key={x} onClick={() => setTab(x)} className={`text-xs px-3 py-1.5 rounded-full border ${tab === x ? 'bg-accent text-white border-accent' : 'bg-surface border-line text-ink-secondary'}`}>
              {x === 'shifts' ? 'Ca làm việc' : 'Lịch nghỉ lễ'}
            </button>
          ))}
        </div>
      </div>
      {error && <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">{error}</div>}

      {tab === 'shifts' ? (
        <div className="bg-surface border border-line rounded-xl p-4">
          <div className="flex justify-end mb-2"><button className="text-xs px-3 py-1.5 rounded bg-accent text-white" onClick={openAdd}>+ Thêm ca</button></div>
          {shifts.map(s => (
            <div key={s.code} className="border border-line rounded-lg p-3 mb-2 text-sm">
              <div className="flex items-center justify-between">
                <div><span className="font-mono text-xs text-accent mr-2">{s.code}</span><span className="font-semibold">{s.name}</span>
                  {s.isException && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">ca ngoại lệ</span>}
                  {s.isFlexible && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">linh hoạt</span>}
                </div>
                <div className="flex gap-2">
                  <button className="text-xs px-2 py-1 rounded border border-line" onClick={async () => {
                    const res = await fetch(`/api/v1/admin/shifts/${encodeURIComponent(s.code)}/assign`, { method: 'POST', headers: authHeaders() });
                    const json = await res.json().catch(() => ({}));
                    if (res.ok) showToast(`Đã áp ca cho ${json?.data?.assigned ?? 0} nhân sự`);
                    else setError(json?.message || 'Áp ca thất bại');
                  }}>Áp ca</button>
                  <button className="text-xs px-2 py-1 rounded border border-line" onClick={() => openEdit(s)}>Sửa</button>
                </div>
              </div>
              <div className="text-xs text-ink-muted mt-1">
                {s.checkInStart}–{s.checkInEnd} / {s.checkOutStart}–{s.checkOutEnd} · nghỉ trưa {s.lunchBreakStart?.slice(0,5)}–{s.lunchBreakEnd?.slice(0,5)} · {s.requiredWorkHours}h
              </div>
              {s.isFlexible && <div className="text-xs text-emerald-700 mt-1">Khung linh hoạt: vào {s.flexibleCheckinFrom?.slice(0,5)}–{s.flexibleCheckinTo?.slice(0,5)} · ra {s.flexibleCheckoutFrom?.slice(0,5)}–{s.flexibleCheckoutTo?.slice(0,5)} — đủ 8h trong khung = 1 công</div>}
              <div className="text-xs text-ink-muted mt-1">Gán: nhóm {s.targetGroup || 'tất cả'} · chức danh {s.targetPosition || 'tất cả'} · geofence {s.geofenceRadiusM}m · IP {s.ipRanges || '—'}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-surface border border-line rounded-xl p-4">
          <form onSubmit={addHoliday} className="grid grid-cols-1 sm:grid-cols-4 gap-2 mb-3 text-xs">
            <input className="border border-line rounded-lg p-2" placeholder="Tên ngày lễ" value={holidayForm.name} onChange={e => setHolidayForm({ ...holidayForm, name: e.target.value })} />
            <input type="date" className="border border-line rounded-lg p-2" value={holidayForm.holidayDate} onChange={e => setHolidayForm({ ...holidayForm, holidayDate: e.target.value })} />
            <label className="flex items-center gap-2"><input type="checkbox" checked={holidayForm.isPaid} onChange={e => setHolidayForm({ ...holidayForm, isPaid: e.target.checked })} /> Hưởng lương</label>
            <button className="rounded bg-accent text-white px-3 py-2">Thêm ngày lễ</button>
          </form>
          {holidays.map(h => (
            <div key={h.id || h.holidayDate} className="flex items-center justify-between border-b border-line py-2 text-sm last:border-0">
              <span>{h.name}</span><span className="text-xs text-ink-muted">{h.holidayDate} · {h.isPaid ? 'hưởng lương' : 'không lương'}</span>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 grid place-items-center p-4" onClick={() => { setEditing(null); setForm(emptyShift); }}>
          <form className="bg-surface rounded-xl p-5 w-full max-w-2xl space-y-3 max-h-[85vh] overflow-auto" onClick={e => e.stopPropagation()} onSubmit={saveShift}>
            <h3 className="text-base font-bold">{editing ? 'Sửa ca' : 'Thêm ca'}</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <label className="font-semibold">Mã *<input className="mt-1 w-full border border-line rounded-lg p-2" value={form.code} disabled={!!editing} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} /></label>
              <label className="font-semibold">Tên *<input className="mt-1 w-full border border-line rounded-lg p-2" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
              <label className="font-semibold">Vào từ<input type="time" className="mt-1 w-full border border-line rounded-lg p-2" value={form.checkInStart} onChange={e => setForm({ ...form, checkInStart: e.target.value })} /></label>
              <label className="font-semibold">Vào đến<input type="time" className="mt-1 w-full border border-line rounded-lg p-2" value={form.checkInEnd} onChange={e => setForm({ ...form, checkInEnd: e.target.value })} /></label>
              <label className="font-semibold">Ra từ<input type="time" className="mt-1 w-full border border-line rounded-lg p-2" value={form.checkOutStart} onChange={e => setForm({ ...form, checkOutStart: e.target.value })} /></label>
              <label className="font-semibold">Ra đến<input type="time" className="mt-1 w-full border border-line rounded-lg p-2" value={form.checkOutEnd} onChange={e => setForm({ ...form, checkOutEnd: e.target.value })} /></label>
              <label className="font-semibold">Nghỉ trưa từ<input type="time" className="mt-1 w-full border border-line rounded-lg p-2" value={form.lunchBreakStart} onChange={e => setForm({ ...form, lunchBreakStart: e.target.value })} /></label>
              <label className="font-semibold">Nghỉ trưa đến<input type="time" className="mt-1 w-full border border-line rounded-lg p-2" value={form.lunchBreakEnd} onChange={e => setForm({ ...form, lunchBreakEnd: e.target.value })} /></label>
              <label className="font-semibold">Số giờ/ngày<input type="number" step="0.5" className="mt-1 w-full border border-line rounded-lg p-2" value={form.requiredWorkHours} onChange={e => setForm({ ...form, requiredWorkHours: Number(e.target.value) })} /></label>
              <label className="font-semibold">Geofence (m)<input type="number" className="mt-1 w-full border border-line rounded-lg p-2" value={form.geofenceRadiusM} onChange={e => setForm({ ...form, geofenceRadiusM: Number(e.target.value) })} /></label>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isFlexible} onChange={e => setForm({ ...form, isFlexible: e.target.checked })} /> Ca linh hoạt</label>
            {form.isFlexible && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <label>Check-in từ<input type="time" className="mt-1 w-full border border-line rounded-lg p-2" value={form.flexibleCheckinFrom} onChange={e => setForm({ ...form, flexibleCheckinFrom: e.target.value })} /></label>
                <label>đến<input type="time" className="mt-1 w-full border border-line rounded-lg p-2" value={form.flexibleCheckinTo} onChange={e => setForm({ ...form, flexibleCheckinTo: e.target.value })} /></label>
                <label>Check-out từ<input type="time" className="mt-1 w-full border border-line rounded-lg p-2" value={form.flexibleCheckoutFrom} onChange={e => setForm({ ...form, flexibleCheckoutFrom: e.target.value })} /></label>
                <label>đến<input type="time" className="mt-1 w-full border border-line rounded-lg p-2" value={form.flexibleCheckoutTo} onChange={e => setForm({ ...form, flexibleCheckoutTo: e.target.value })} /></label>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <label className="font-semibold">Nhóm áp dụng<input className="mt-1 w-full border border-line rounded-lg p-2" placeholder="Sirius, Optimus…" value={form.targetGroup} onChange={e => setForm({ ...form, targetGroup: e.target.value })} /></label>
              <label className="font-semibold">Chức danh áp dụng<input className="mt-1 w-full border border-line rounded-lg p-2" placeholder="Developer, QA…" value={form.targetPosition} onChange={e => setForm({ ...form, targetPosition: e.target.value })} /></label>
              <label className="font-semibold col-span-2">Dải IP mạng nội bộ<input className="mt-1 w-full border border-line rounded-lg p-2" value={form.ipRanges} onChange={e => setForm({ ...form, ipRanges: e.target.value })} /></label>
            </div>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.isException} onChange={e => setForm({ ...form, isException: e.target.checked })} /> Ca ngoại lệ</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.requiresHrApproval} onChange={e => setForm({ ...form, requiresHrApproval: e.target.checked })} /> Cần HR duyệt</label>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="text-xs px-3 py-1.5 rounded border border-line" onClick={() => { setEditing(null); setForm(emptyShift); }}>Huỷ</button>
              <button type="submit" className="text-xs px-3 py-1.5 rounded bg-accent text-white">Lưu ca</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
