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
  /** Mã nhân viên áp dụng trực tiếp (CSV). */
  targetEmployees: string;
  /** Mã nhân viên bị loại trừ (CSV) — chỉ ca ngoại lệ mới có. */
  excludeEmployees: string;
  /** Số càng lớn càng ở dưới danh sách → ưu tiên ghi đè càng cao. */
  priority?: number;
}

interface Holiday {
  id?: string;
  name: string;
  /** Ngày bắt đầu (hoặc ngày duy nhất). */
  holidayDate: string;
  /** Ngày kết thúc (bao gồm) — trống nghĩa là lễ 1 ngày. */
  endDate?: string | null;
  isPaid: boolean;
  createdByName?: string | null;
}

interface HolidayForm { name: string; startDate: string; endDate: string; isPaid: boolean; }

interface EmployeeOption {
  employeeCode: string;
  fullName: string;
  team?: string;
  positionName?: string;
}

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
  geofenceRadiusM: 150, ipRanges: '10.0.0.0/8,192.168.0.0/16', isException: true, requiresHrApproval: false,
  targetGroup: '', targetPosition: '', targetEmployees: '', excludeEmployees: '',
};

/** Ca chuẩn là base toàn công ty — mọi ca khác là ngoại lệ đè lên ca chuẩn. */
const BASE_SHIFT_CODE = 'SHIFT_STANDARD';
const isBaseShift = (s: Shift) => s.code === BASE_SHIFT_CODE;

const t = (v: string) => (v && v.length === 5 ? `${v}:00` : v);

const csv = (v: string | undefined) => (v || '').split(',').map(s => s.trim()).filter(Boolean);

/** Chọn nhiều giá trị từ danh sách có sẵn, lưu dạng CSV cho backend. */
const CsvPicker: React.FC<{
  label: string;
  hint?: string;
  options: { value: string; label?: string; sub?: string }[];
  value: string;
  disabled?: boolean;
  onChange: (v: string) => void;
}> = ({ label, hint, options, value, disabled, onChange }) => {
  const [q, setQ] = useState('');
  const selected = csv(value);
  const toggle = (v: string) => {
    const next = selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v];
    onChange(next.join(','));
  };
  const needle = q.trim().toLowerCase();
  const shown = options.filter(o =>
    !needle || o.value.toLowerCase().includes(needle) || (o.label || '').toLowerCase().includes(needle));
  const labelOf = (v: string) => {
    const o = options.find(x => x.value === v);
    return o?.sub ? `${v} — ${o.sub}` : (o?.label || v);
  };

  return (
    <div className={disabled ? 'opacity-50' : ''}>
      <div className="font-semibold">{label}</div>
      <details className="mt-1 border border-line rounded-lg bg-surface">
        <summary className="cursor-pointer px-2 py-1.5 text-[11px] text-ink-muted">
          {selected.length ? `${selected.length} đã chọn — bấm để sửa` : 'Chưa chọn — bấm để chọn'}
        </summary>
        <div className="p-2 border-t border-line space-y-1">
          <input
            disabled={disabled}
            className="w-full border border-line rounded p-1.5 text-[11px]"
            placeholder="Tìm…"
            value={q}
            onChange={e => setQ(e.target.value)}
          />
          <div className="max-h-36 overflow-auto space-y-0.5">
            {shown.map(o => (
              <label key={o.value} className="flex items-center gap-2 text-[11px]">
                <input type="checkbox" disabled={disabled} checked={selected.includes(o.value)} onChange={() => toggle(o.value)} />
                <span>{o.label || o.value}</span>
                {o.sub && <span className="text-ink-muted">{o.sub}</span>}
              </label>
            ))}
            {!shown.length && <div className="text-[11px] text-ink-muted">Không có lựa chọn phù hợp</div>}
          </div>
        </div>
      </details>
      {selected.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {selected.map(v => (
            <span key={v} className="inline-flex items-center gap-1 rounded bg-canvas border border-line px-1.5 py-0.5 text-[10px]">
              {labelOf(v)}
              <button type="button" disabled={disabled} className="text-ink-muted hover:text-status-danger" onClick={() => toggle(v)}>×</button>
            </span>
          ))}
        </div>
      )}
      {hint && <div className="mt-0.5 text-[10px] text-ink-muted">{hint}</div>}
    </div>
  );
};

export const ShiftHolidayPage: React.FC = () => {
  const [tab, setTab] = useState<'shifts' | 'holidays'>('shifts');
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [editing, setEditing] = useState<Shift | null>(null);
  const [isShiftOpen, setIsShiftOpen] = useState(false);
  const [form, setForm] = useState<Shift>(emptyShift);
  const [holidayForm, setHolidayForm] = useState<HolidayForm>({ name: '', startDate: '', endDate: '', isPaid: true });
  const [isHolidayOpen, setIsHolidayOpen] = useState(false);
  const [editingHolidayId, setEditingHolidayId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Danh bạ để chọn nhóm / chức danh / nhân viên áp dụng thay vì gõ tay (tránh nhập sai).
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [pickersLoaded, setPickersLoaded] = useState(false);

  const load = () => {
    fetch('/api/v1/admin/shifts', { headers: authHeaders() }).then(r => r.json()).then(j => { if (Array.isArray(j?.data)) setShifts(j.data); }).catch(() => undefined);
    fetch('/api/v1/admin/holidays', { headers: authHeaders() }).then(r => r.json()).then(j => { if (Array.isArray(j?.data)) setHolidays(j.data); }).catch(() => undefined);
  };
  useEffect(load, []);
  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2500); };

  // Ca chuẩn luôn đứng đầu; ca ngoại lệ xếp theo priority tăng dần (dưới cùng ưu tiên cao nhất).
  const orderedShifts: Shift[] = [
    ...shifts.filter(isBaseShift),
    ...shifts.filter(s => !isBaseShift(s)).sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999) || a.code.localeCompare(b.code)),
  ];

  const loadPickerOptions = () => {
    if (pickersLoaded) return;
    fetch('/api/v1/admin/users?size=1000', { headers: authHeaders() })
      .then(r => r.json())
      .then(j => {
        const rows = Array.isArray(j?.data?.content) ? j.data.content : [];
        setEmployees(rows
          .filter((e: any) => e?.employeeCode)
          .map((e: any) => ({ employeeCode: e.employeeCode, fullName: e.fullName, team: e.team, positionName: e.positionName })));
        setPickersLoaded(true);
      })
      .catch(() => undefined);
  };

  const openAdd = () => { setEditing(null); setForm(emptyShift); loadPickerOptions(); setIsShiftOpen(true); };
  const openEdit = (s: Shift) => { setEditing(s); setForm({ ...s }); loadPickerOptions(); setIsShiftOpen(true); };

  const teamOptions = Array.from(new Set(employees.map(e => e.team || '').filter(Boolean)))
    .filter(name => name !== 'Chưa có nhóm') // nhãn hiển thị, không phải tên nhóm thật để khớp luật ca
    .sort().map(name => ({ value: name, label: name }));
  const positionOptions = Array.from(new Set(employees.map(e => e.positionName || '').filter(Boolean)))
    .sort().map(name => ({ value: name, label: name }));
  const employeeOptions = employees
    .slice()
    .sort((a, b) => a.employeeCode.localeCompare(b.employeeCode))
    .map(e => ({ value: e.employeeCode, label: e.employeeCode, sub: e.fullName }));

  const saveShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim() || !form.name.trim()) return;
    // Ca ngoại lệ phải có ít nhất một phạm vi áp dụng, nếu không sẽ không bao giờ khớp ai.
    if (!isBaseShift(form)
      && !csv(form.targetGroup).length && !csv(form.targetPosition).length && !csv(form.targetEmployees).length) {
      setError('Chọn ít nhất một nhóm, chức danh hoặc nhân viên áp dụng cho ca ngoại lệ');
      return;
    }
    const body = {
      ...form,
      // "Ca ngoại lệ" suy ra từ việc ca khác ca chuẩn — không cần người dùng tick.
      isException: !isBaseShift(form),
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
    setEditing(null); setForm(emptyShift); setIsShiftOpen(false); setError(null); showToast('Đã lưu ca làm việc'); load();
  };

  /** Bật/tắt ca ngoại lệ — tắt thì nhân sự rơi về ca ưu tiên thấp hơn hoặc ca chuẩn. */
  const toggleShift = async (s: Shift) => {
    const res = await fetch(`/api/v1/admin/shifts/${encodeURIComponent(s.code)}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ ...s, isActive: !s.isActive }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setError(json?.message || 'Cập nhật ca thất bại'); return; }
    setError(null); showToast(s.isActive ? 'Đã tắt ca' : 'Đã bật ca'); load();
  };

  /** Xóa ca ngoại lệ — nhân sự đang dùng sẽ về ca chuẩn (server xử lý). */
  const deleteShift = async (s: Shift) => {
    if (!window.confirm(`Xóa ca "${s.name}"? Nhân sự đang dùng ca này sẽ trở về ca chuẩn.`)) return;
    const res = await fetch(`/api/v1/admin/shifts/${encodeURIComponent(s.code)}`, { method: 'DELETE', headers: authHeaders() });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setError(json?.message || 'Xóa ca thất bại'); return; }
    setError(null); showToast(json?.message || 'Đã xóa ca'); load();
  };

  /** Đổi thứ tự ưu tiên — ca ở dưới cùng có ưu tiên ghi đè cao nhất. */
  const moveShift = async (s: Shift, dir: -1 | 1) => {
    const rules = orderedShifts.filter(x => !isBaseShift(x));
    const idx = rules.findIndex(x => x.code === s.code);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= rules.length) return;
    const codes = rules.map(x => x.code);
    [codes[idx], codes[target]] = [codes[target], codes[idx]];
    const res = await fetch('/api/v1/admin/shifts/order', {
      method: 'PUT', headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ codes }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setError(json?.message || 'Sắp xếp ca thất bại'); return; }
    setError(null); load();
  };

  const openHolidayModal = (h?: Holiday) => {
    setEditingHolidayId(h?.id || null);
    setHolidayForm({
      name: h?.name || '',
      startDate: h?.holidayDate || '',
      endDate: h?.endDate || '',
      isPaid: h?.isPaid ?? true,
    });
    setError(null);
    setIsHolidayOpen(true);
  };

  const saveHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    const isEdit = !!editingHolidayId;
    // Báo lỗi rõ thay vì im lặng khi thiếu dữ liệu.
    if (!holidayForm.name.trim()) { setError('Nhập tên ngày nghỉ lễ'); return; }
    if (!holidayForm.startDate) { setError('Chọn ngày bắt đầu nghỉ lễ'); return; }
    const endDate = holidayForm.endDate || holidayForm.startDate;
    if (endDate < holidayForm.startDate) { setError('Ngày kết thúc phải sau hoặc bằng ngày bắt đầu'); return; }
    const res = await fetch(isEdit ? `/api/v1/admin/holidays/${editingHolidayId}` : '/api/v1/admin/holidays', {
      method: isEdit ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ name: holidayForm.name.trim(), holidayDate: holidayForm.startDate, endDate, isPaid: holidayForm.isPaid }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setError(json?.message || (isEdit ? 'Cập nhật ngày lễ thất bại' : 'Thêm ngày lễ thất bại')); return; }
    setIsHolidayOpen(false);
    setEditingHolidayId(null);
    setHolidayForm({ name: '', startDate: '', endDate: '', isPaid: true });
    setError(null); showToast(json?.message || (isEdit ? 'Đã cập nhật ngày lễ' : 'Đã thêm ngày lễ')); load();
  };

  const deleteHoliday = async (h: Holiday) => {
    if (!h.id) return;
    if (!window.confirm(`Xóa ngày lễ “${h.name}”? Các ngày đã cấu hình sẽ trở lại là ngày làm việc.`)) return;
    const res = await fetch(`/api/v1/admin/holidays/${h.id}`, { method: 'DELETE', headers: authHeaders() });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setError(json?.message || 'Xóa ngày lễ thất bại'); return; }
    setError(null); showToast(json?.message || 'Đã xóa ngày lễ'); load();
  };



  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {toast && <div className="fixed top-16 right-6 z-[100] bg-status-ok text-on-ok px-4 py-2 rounded text-xs font-semibold">{toast}</div>}
      <div className="bg-canvas border border-line rounded-xl p-6">
        <h1 className="text-xl font-bold text-ink mt-1">Ca làm việc & lịch nghỉ lễ</h1>
        <p className="text-xs text-ink-muted mt-1">Ca chuẩn (SHIFT_STANDARD) là <b className="text-ink">base mặc định cho toàn công ty</b> — sửa được, không tắt/xóa được, không cần áp ca. Ca khác là <b className="text-ink">ca ngoại lệ</b>: áp theo <b className="text-ink">nhóm / chức danh / mã nhân viên</b>, có thể <b className="text-ink">loại trừ</b> thành viên và xếp thứ tự ưu tiên (ca dưới cùng thắng). Ca linh hoạt (8–10h · 17–19h, đủ 8h = 1 công) · geofence + dải IP · ngày lễ theo năm.</p>
        <div className="flex gap-2 mt-3">
          {(['shifts', 'holidays'] as const).map(x => (
            <button key={x} onClick={() => setTab(x)} className={`text-xs px-3 py-1.5 rounded-full border ${tab === x ? 'bg-accent text-on-accent border-accent' : 'bg-surface border-line text-ink-secondary'}`}>
              {x === 'shifts' ? 'Ca làm việc' : 'Lịch nghỉ lễ'}
            </button>
          ))}
        </div>
      </div>
      {error && <div className="text-sm text-status-danger bg-status-danger-soft border border-status-danger-line rounded-lg p-3">{error}</div>}

      {tab === 'shifts' ? (
        <div className="bg-surface border border-line rounded-xl p-4">
          <div className="flex items-start justify-between gap-3 mb-2">
            <p className="text-xs text-ink-muted">
              <b className="text-ink">Ca chuẩn</b> luôn áp dụng toàn công ty — không tắt/xóa được, chỉ sửa khung giờ.
              Ca ngoại lệ xếp từ trên xuống: <b className="text-ink">ca càng ở dưới càng ưu tiên cao</b> — một người khớp
              nhiều ca sẽ nhận ca ở dưới cùng. Dùng <b className="text-ink">↑/↓</b> để đổi thứ tự ghi đè.
            </p>
            <button className="text-xs px-3 py-1.5 rounded bg-accent text-on-accent shrink-0" onClick={openAdd}>+ Thêm ca</button>
          </div>
          {orderedShifts.map(s => {
            const ruleShifts = orderedShifts.filter(x => !isBaseShift(x));
            const ruleIndex = ruleShifts.findIndex(x => x.code === s.code);
            const ruleCount = ruleShifts.length;
            return (
              <div key={s.code} className={`border rounded-lg p-3 mb-2 text-sm ${isBaseShift(s) ? 'border-accent/40 bg-accent/5' : 'border-line'} ${!isBaseShift(s) && !s.isActive ? 'opacity-60' : ''}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center flex-wrap gap-y-1">
                    <span className="font-mono text-xs text-accent mr-2">{s.code}</span><span className="font-semibold">{s.name}</span>
                    {isBaseShift(s)
                      ? <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-accent text-on-accent">Mặc định toàn công ty</span>
                      : <>
                          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-status-warn-soft text-status-warn">ca ngoại lệ</span>
                          <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded ${s.isActive ? 'bg-status-ok-soft text-status-ok' : 'bg-line text-ink'}`}>
                            {s.isActive ? `ưu tiên #${ruleIndex + 1}/${ruleCount}` : 'đang tắt'}
                          </span>
                          {s.isActive && ruleIndex === ruleCount - 1 && (
                            <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-status-danger-soft text-status-danger">ưu tiên cao nhất</span>
                          )}
                        </>}
                    {s.isFlexible && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-status-ok-soft text-status-ok">linh hoạt</span>}
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    {!isBaseShift(s) && (
                      <>
                        <button className="text-xs px-2 py-1 rounded border border-line disabled:opacity-40" disabled={ruleIndex <= 0}
                          title="Đưa ca lên — ưu tiên thấp hơn" onClick={() => moveShift(s, -1)}>↑</button>
                        <button className="text-xs px-2 py-1 rounded border border-line disabled:opacity-40" disabled={ruleIndex >= ruleCount - 1}
                          title="Đưa ca xuống — ưu tiên cao hơn" onClick={() => moveShift(s, 1)}>↓</button>
                        <button className="text-xs px-2 py-1 rounded border border-line" title={s.isActive ? 'Tắt ca — nhân sự rơi về ca thấp hơn/ca chuẩn' : 'Bật ca'}
                          onClick={() => toggleShift(s)}>{s.isActive ? 'Tắt' : 'Bật'}</button>
                      </>
                    )}
                    <button className="text-xs px-2 py-1 rounded border border-line" title={isBaseShift(s) ? 'Sửa khung giờ ca chuẩn — áp dụng ngay cho toàn công ty' : undefined} onClick={() => openEdit(s)}>Sửa</button>
                    {!isBaseShift(s) && (
                      <button className="text-xs px-2 py-1 rounded border border-status-danger-line text-status-danger" title="Xóa ca — nhân sự đang dùng về ca chuẩn" onClick={() => deleteShift(s)}>Xóa</button>
                    )}
                  </div>
                </div>
                <div className="text-xs text-ink-muted mt-1">
                  {s.checkInStart?.slice(0,5)}–{s.checkInEnd?.slice(0,5)} / {s.checkOutStart?.slice(0,5)}–{s.checkOutEnd?.slice(0,5)} · nghỉ trưa {s.lunchBreakStart?.slice(0,5)}–{s.lunchBreakEnd?.slice(0,5)} · {s.requiredWorkHours}h
                </div>
                {s.isFlexible && <div className="text-xs text-status-ok mt-1">Khung linh hoạt: vào {s.flexibleCheckinFrom?.slice(0,5)}–{s.flexibleCheckinTo?.slice(0,5)} · ra {s.flexibleCheckoutFrom?.slice(0,5)}–{s.flexibleCheckoutTo?.slice(0,5)} — đủ {s.requiredWorkHours}h trong khung = 1 công</div>}
                <div className="text-xs text-ink-muted mt-1">
                  {isBaseShift(s)
                    ? 'Áp dụng mặc định cho mọi nhân sự không khớp ca ngoại lệ nào · geofence ' + s.geofenceRadiusM + 'm · IP ' + (s.ipRanges || '—')
                    : `Gán: nhóm ${s.targetGroup || '—'} · chức danh ${s.targetPosition || '—'} · nhân viên ${s.targetEmployees || '—'} · loại trừ ${s.excludeEmployees || '—'} · geofence ${s.geofenceRadiusM}m`}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-surface border border-line rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs text-ink-muted">
              <span className="font-semibold text-ink">Ngày lễ đã cấu hình</span> · {holidays.length} kỳ nghỉ
            </div>
            <button onClick={() => openHolidayModal()} className="text-xs px-3 py-1.5 rounded bg-accent text-on-accent font-semibold">+ Thêm ngày lễ</button>
          </div>
          {!holidays.length && (
            <div className="text-sm text-ink-muted border border-dashed border-line rounded-lg p-4 text-center">
              Chưa có ngày nghỉ lễ nào. Bấm “+ Thêm ngày lễ” để tạo.
            </div>
          )}
          {holidays.map(h => {
            const until = h.endDate && h.endDate !== h.holidayDate ? ` → ${h.endDate}` : '';
            return (
              <div key={h.id || h.holidayDate} className="flex items-center justify-between gap-3 border-b border-line py-2 text-sm last:border-0">
                <div className="min-w-0">
                  <div className="font-medium truncate">{h.name}</div>
                  <div className="text-xs text-ink-muted">
                    {h.holidayDate}{until} · {h.isPaid ? 'hưởng lương' : 'không lương'} · thêm bởi {h.createdByName || 'hệ thống'}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => openHolidayModal(h)} className="text-xs px-2 py-1 rounded border border-line">Sửa</button>
                  <button onClick={() => deleteHoliday(h)} className="text-xs px-2 py-1 rounded border border-status-danger-line text-status-danger">Xóa</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isHolidayOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 grid place-items-center p-4" onClick={() => setIsHolidayOpen(false)}>
          <form className="bg-surface rounded-xl p-5 w-full max-w-md space-y-3" onClick={e => e.stopPropagation()} onSubmit={saveHoliday}>
            <h3 className="text-base font-bold">{editingHolidayId ? 'Sửa ngày nghỉ lễ' : 'Thêm ngày nghỉ lễ'}</h3>
            <label className="block text-xs font-semibold">Tên ngày lễ *
              <input className="mt-1 w-full border border-line rounded-lg p-2" placeholder="Ví dụ: Tết Nguyên Đán, Giáng Sinh…" value={holidayForm.name} onChange={e => setHolidayForm({ ...holidayForm, name: e.target.value })} />
            </label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <label className="font-semibold">Từ ngày *
                <input type="date" className="mt-1 w-full border border-line rounded-lg p-2" value={holidayForm.startDate} onChange={e => setHolidayForm({ ...holidayForm, startDate: e.target.value, endDate: holidayForm.endDate || e.target.value })} />
              </label>
              <label className="font-semibold">Đến ngày
                <input type="date" className="mt-1 w-full border border-line rounded-lg p-2" min={holidayForm.startDate || undefined} value={holidayForm.endDate} onChange={e => setHolidayForm({ ...holidayForm, endDate: e.target.value })} />
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={holidayForm.isPaid} onChange={e => setHolidayForm({ ...holidayForm, isPaid: e.target.checked })} /> Hưởng lương</label>
            <div className="text-[11px] text-ink-muted">Để trống “Đến ngày” nếu lễ chỉ diễn ra 1 ngày.</div>
            {error && <div className="text-xs text-status-danger bg-status-danger-soft border border-status-danger-line rounded-lg p-2">{error}</div>}
            <div className="flex justify-end gap-2">
              <button type="button" className="text-xs px-3 py-1.5 rounded border border-line" onClick={() => setIsHolidayOpen(false)}>Huỷ</button>
              <button type="submit" className="text-xs px-3 py-1.5 rounded bg-accent text-on-accent">Lưu ngày lễ</button>
            </div>
          </form>
        </div>
      )}

      {isShiftOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 grid place-items-center p-4" onClick={() => { setEditing(null); setForm(emptyShift); setIsShiftOpen(false); }}>
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
              <CsvPicker
                label="Nhóm áp dụng"
                hint="Chọn một hoặc nhiều nhóm — ca khớp nếu nhân sự thuộc bất kỳ nhóm nào."
                options={teamOptions}
                value={form.targetGroup}
                disabled={isBaseShift(form)}
                onChange={v => setForm({ ...form, targetGroup: v })}
              />
              <CsvPicker
                label="Chức danh áp dụng"
                hint="Chọn một hoặc nhiều chức danh."
                options={positionOptions}
                value={form.targetPosition}
                disabled={isBaseShift(form)}
                onChange={v => setForm({ ...form, targetPosition: v })}
              />
              <CsvPicker
                label="Nhân viên áp dụng"
                hint="Chọn trực tiếp nhân sự cụ thể (ngoài phạm vi nhóm/chức danh)."
                options={employeeOptions}
                value={form.targetEmployees}
                disabled={isBaseShift(form)}
                onChange={v => setForm({ ...form, targetEmployees: v })}
              />
              <CsvPicker
                label="Loại trừ nhân viên"
                hint="Nhân sự bị loại trừ không nhận ca này dù khớp nhóm/chức danh."
                options={employeeOptions}
                value={form.excludeEmployees}
                disabled={isBaseShift(form)}
                onChange={v => setForm({ ...form, excludeEmployees: v })}
              />
              <label className="font-semibold col-span-2">Dải IP mạng nội bộ<input className="mt-1 w-full border border-line rounded-lg p-2" value={form.ipRanges} onChange={e => setForm({ ...form, ipRanges: e.target.value })} /></label>
            </div>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.requiresHrApproval} onChange={e => setForm({ ...form, requiresHrApproval: e.target.checked })} /> Cần HR duyệt</label>
            </div>
            {isBaseShift(form) && (
              <div className="text-xs text-accent">Ca chuẩn luôn áp dụng cho toàn công ty — không cần chọn nhóm/chức danh/nhân viên và không có loại trừ. Mọi ca khác đều là ca ngoại lệ đè lên ca chuẩn theo thứ tự ưu tiên.</div>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" className="text-xs px-3 py-1.5 rounded border border-line" onClick={() => { setEditing(null); setForm(emptyShift); setIsShiftOpen(false); }}>Huỷ</button>
              <button type="submit" className="text-xs px-3 py-1.5 rounded bg-accent text-on-accent">Lưu ca</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
