import React, { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Calendar,
  CheckCircle2,
  Clock,
  Coffee,
  Info,
  Landmark,
  Moon,
  Pencil,
  Plus,
  Power,
  Shield,
  Sun,
  Trash2,
  X,
} from 'lucide-react';
import { Button } from '../../../components/common/Button';
import { Badge } from '../../../components/common/Badge';
import { Modal } from '../../../components/common/Modal';
import { Panel } from '../../../components/common/Panel';

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
      <div className="font-semibold text-ink">{label}</div>
      <details className="mt-1 rounded-[10px] border border-line bg-surface">
        <summary className="cursor-pointer px-2.5 py-2 text-[11px] text-ink-muted">
          {selected.length ? `${selected.length} đã chọn — bấm để sửa` : 'Chưa chọn — bấm để chọn'}
        </summary>
        <div className="space-y-1 border-t border-line p-2">
          <input
            disabled={disabled}
            aria-label={`Tìm trong ${label}`}
            className="w-full rounded-[10px] border border-line bg-canvas px-2.5 py-1.5 text-[11px] text-ink focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/20"
            placeholder="Tìm…"
            value={q}
            onChange={e => setQ(e.target.value)}
          />
          <div className="max-h-36 space-y-0.5 overflow-auto">
            {shown.map(o => (
              <label key={o.value} className="flex items-center gap-2 text-[11px] text-ink">
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
            <span
              key={v}
              className="inline-flex items-center gap-1 rounded-md border border-line bg-canvas px-1.5 py-0.5 text-[10px] text-ink-secondary"
            >
              {labelOf(v)}
              <button
                type="button"
                disabled={disabled}
                aria-label={`Bỏ chọn ${labelOf(v)}`}
                className="cursor-pointer text-ink-muted transition-colors hover:text-status-danger"
                onClick={() => toggle(v)}
              >
                <X className="h-3 w-3" />
              </button>
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
    <div className="mx-auto max-w-5xl space-y-4 pb-24">
      {toast && (
        <div className="fixed right-6 top-16 z-[100] flex items-center gap-2 rounded-xl bg-status-ok px-4 py-2 text-xs font-semibold text-on-ok shadow-lg">
          <CheckCircle2 className="h-4 w-4" />
          {toast}
        </div>
      )}

      {/* Đầu trang — mockup `.phead` */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-accent-dark">
            <Clock className="h-3.5 w-3.5" />
            Cấu hình chấm công
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <h1 className="font-display text-xl font-extrabold tracking-tight text-ink sm:text-[23px]">
              Ca làm việc &amp; lịch nghỉ lễ
            </h1>
            <Badge variant="accent">P0</Badge>
          </div>
          <p className="mt-1 text-xs text-ink-muted">
            Ca chuẩn <strong className="text-ink">SHIFT_STANDARD</strong> là base mặc định cho toàn công ty — sửa được,
            không tắt/xóa được. Ca khác là <strong className="text-ink">ca ngoại lệ</strong>: áp theo{' '}
            <strong className="text-ink">nhóm / chức danh / mã nhân viên</strong>, có thể{' '}
            <strong className="text-ink">loại trừ</strong> thành viên và xếp thứ tự ưu tiên (ca dưới cùng thắng). Ca linh
            hoạt (8–10h · 17–19h, đủ 8h = 1 công) · geofence + dải IP · ngày lễ theo năm.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button variant="primary" size="md" onClick={openAdd}>
            <Plus className="h-3.5 w-3.5" />
            Thêm ca
          </Button>
        </div>
      </div>

      {/* Segmented control — đúng spec: ô 34px trong khung p-4px, đang chọn = ink + canvas */}
      <div role="group" aria-label="Loại cấu hình" className="grid w-full max-w-[340px] grid-cols-2 gap-1 rounded-xl border border-line bg-canvas p-1">
        {([
          { key: 'shifts', label: 'Ca làm việc', Icon: Clock },
          { key: 'holidays', label: 'Lịch nghỉ lễ', Icon: Calendar },
        ] as const).map((v) => {
          const on = tab === v.key;
          return (
            <button
              key={v.key}
              type="button"
              aria-pressed={on}
              onClick={() => setTab(v.key)}
              className={`flex h-[34px] cursor-pointer items-center justify-center gap-1.5 rounded-[9px] px-2 text-xs font-bold transition-colors ${
                on ? 'bg-ink text-canvas' : 'text-ink-muted hover:bg-surface/70 hover:text-ink'
              }`}
            >
              <v.Icon className="h-3.5 w-3.5" />
              <span className="truncate">{v.label}</span>
            </button>
          );
        })}
      </div>

      {error && (
        <div className="rounded-xl border border-status-danger-line bg-status-danger-soft p-3 text-sm text-status-danger">
          {error}
        </div>
      )}

      {tab === 'shifts' ? (
        <div className="space-y-3">
          <div className="flex items-start gap-2.5 rounded-[13px] border border-line bg-surface p-3.5 text-xs text-ink-muted shadow-2xs">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
            <p>
              <strong className="text-ink">Ca chuẩn</strong> luôn áp dụng toàn công ty — không tắt/xóa được, chỉ sửa
              khung giờ. Ca ngoại lệ xếp từ trên xuống:{' '}
              <strong className="text-ink">ca càng ở dưới càng ưu tiên cao</strong> — một người khớp nhiều ca sẽ nhận ca ở
              dưới cùng. Dùng nút <strong className="text-ink">Lên / Xuống</strong> để đổi thứ tự ghi đè.
            </p>
          </div>

          {orderedShifts.map(s => {
            const ruleShifts = orderedShifts.filter(x => !isBaseShift(x));
            const ruleIndex = ruleShifts.findIndex(x => x.code === s.code);
            const ruleCount = ruleShifts.length;
            const hh = (v?: string | null) => (v || '').slice(0, 5);
            return (
              <div
                key={s.code}
                className={`overflow-hidden rounded-[13px] border bg-surface shadow-2xs ${
                  isBaseShift(s) ? 'border-accent-line' : 'border-line'
                } ${!isBaseShift(s) && !s.isActive ? 'opacity-60' : ''}`}
              >
                <div className="flex flex-col gap-3 border-b border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="rounded-md border border-accent-line bg-accent-soft px-[7px] py-[2px] font-mono text-[10.5px] font-bold text-accent-dark">
                      {s.code}
                    </span>
                    <span className="text-sm font-bold text-ink">{s.name}</span>
                    {isBaseShift(s) ? (
                      <Badge variant="accent">Mặc định toàn công ty</Badge>
                    ) : (
                      <>
                        <Badge variant="warn">ca ngoại lệ</Badge>
                        {s.isActive ? (
                          <Badge variant="ok">
                            ưu tiên #{ruleIndex + 1}/{ruleCount}
                          </Badge>
                        ) : (
                          <Badge variant="gray">đang tắt</Badge>
                        )}
                        {s.isActive && ruleIndex === ruleCount - 1 && (
                          <Badge variant="danger">ưu tiên cao nhất</Badge>
                        )}
                      </>
                    )}
                    {s.isFlexible && <Badge variant="ok">linh hoạt</Badge>}
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                    {!isBaseShift(s) && (
                      <>
                        <button
                          type="button"
                          disabled={ruleIndex <= 0}
                          onClick={() => moveShift(s, -1)}
                          title="Đưa ca lên — ưu tiên thấp hơn"
                          aria-label={`Đưa ca ${s.name} lên — ưu tiên thấp hơn`}
                          className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-[9px] border border-line bg-surface text-ink-secondary transition-colors hover:bg-canvas hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={ruleIndex >= ruleCount - 1}
                          onClick={() => moveShift(s, 1)}
                          title="Đưa ca xuống — ưu tiên cao hơn"
                          aria-label={`Đưa ca ${s.name} xuống — ưu tiên cao hơn`}
                          className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-[9px] border border-line bg-surface text-ink-secondary transition-colors hover:bg-canvas hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => toggleShift(s)}
                          title={s.isActive ? 'Tắt ca — nhân sự rơi về ca thấp hơn hoặc ca chuẩn' : 'Bật ca'}
                        >
                          <Power className="h-3.5 w-3.5" />
                          {s.isActive ? 'Tắt' : 'Bật'}
                        </Button>
                      </>
                    )}
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => openEdit(s)}
                      title={isBaseShift(s) ? 'Sửa khung giờ ca chuẩn — áp dụng ngay cho toàn công ty' : 'Sửa cấu hình ca'}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      {isBaseShift(s) ? 'Sửa khung giờ' : 'Sửa'}
                    </Button>
                    {!isBaseShift(s) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteShift(s)}
                        title="Xóa ca — nhân sự đang dùng về ca chuẩn"
                        className="border-status-danger-line text-status-danger hover:bg-status-danger-soft"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Xóa
                      </Button>
                    )}
                  </div>
                </div>

                <div className="space-y-3 px-4 py-3.5">
                  <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                    <div className="rounded-[10px] border border-line bg-canvas px-3 py-2">
                      <div className="flex items-center gap-1.5 text-[9.5px] font-extrabold uppercase tracking-[0.07em] text-ink-muted">
                        <Sun className="h-3 w-3" />
                        Vào ca
                      </div>
                      <div className="mt-1 font-mono text-[13px] font-bold tracking-[-0.02em] text-ink">
                        {hh(s.checkInStart)}
                        <span className="text-ink-muted"> – {hh(s.checkInEnd)}</span>
                      </div>
                    </div>
                    <div className="rounded-[10px] border border-line bg-canvas px-3 py-2">
                      <div className="flex items-center gap-1.5 text-[9.5px] font-extrabold uppercase tracking-[0.07em] text-ink-muted">
                        <Moon className="h-3 w-3" />
                        Ra ca
                      </div>
                      <div className="mt-1 font-mono text-[13px] font-bold tracking-[-0.02em] text-ink">
                        {hh(s.checkOutStart)}
                        <span className="text-ink-muted"> – {hh(s.checkOutEnd)}</span>
                      </div>
                    </div>
                    <div className="rounded-[10px] border border-line bg-canvas px-3 py-2">
                      <div className="flex items-center gap-1.5 text-[9.5px] font-extrabold uppercase tracking-[0.07em] text-ink-muted">
                        <Coffee className="h-3 w-3" />
                        Nghỉ trưa
                      </div>
                      <div className="mt-1 font-mono text-[13px] font-bold tracking-[-0.02em] text-ink">
                        {hh(s.lunchBreakStart)}
                        <span className="text-ink-muted"> – {hh(s.lunchBreakEnd)}</span>
                      </div>
                    </div>
                    <div className="rounded-[10px] border border-line bg-canvas px-3 py-2">
                      <div className="flex items-center gap-1.5 text-[9.5px] font-extrabold uppercase tracking-[0.07em] text-ink-muted">
                        <Landmark className="h-3 w-3" />
                        Giờ/ngày
                      </div>
                      <div className="mt-1 font-mono text-[13px] font-bold tracking-[-0.02em] text-ink">
                        {s.requiredWorkHours}
                        <span className="font-sans text-[10.5px] font-semibold text-ink-muted"> giờ</span>
                      </div>
                    </div>
                  </div>

                  {s.isFlexible && (
                    <div className="flex items-start gap-2.5 rounded-[11px] border border-status-ok-line bg-status-ok-soft px-3 py-2.5 text-[11.5px] text-status-ok">
                      <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <div>
                        <strong className="font-bold">Khung linh hoạt:</strong> vào {hh(s.flexibleCheckinFrom)}–
                        {hh(s.flexibleCheckinTo)} · ra {hh(s.flexibleCheckoutFrom)}–{hh(s.flexibleCheckoutTo)} — đủ{' '}
                        {s.requiredWorkHours}h trong khung = 1 công
                      </div>
                    </div>
                  )}

                  <div className="flex items-start gap-2.5 border-t border-line-soft pt-3 text-[11.5px] text-ink-muted">
                    <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                    <div>
                      {isBaseShift(s) ? (
                        <>
                          Áp dụng mặc định cho mọi nhân sự không khớp ca ngoại lệ nào · geofence{' '}
                          <strong className="font-semibold text-ink-secondary">{s.geofenceRadiusM}m</strong> · IP{' '}
                          <strong className="font-semibold text-ink-secondary">{s.ipRanges || '—'}</strong>
                        </>
                      ) : (
                        <>
                          Gán: nhóm <strong className="font-semibold text-ink-secondary">{s.targetGroup || '—'}</strong> ·
                          chức danh <strong className="font-semibold text-ink-secondary">{s.targetPosition || '—'}</strong> ·
                          nhân viên{' '}
                          <strong className="font-semibold text-ink-secondary">{s.targetEmployees || '—'}</strong> · loại trừ{' '}
                          <strong className="font-semibold text-ink-secondary">{s.excludeEmployees || '—'}</strong> ·
                          geofence <strong className="font-semibold text-ink-secondary">{s.geofenceRadiusM}m</strong>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Panel
          title="Ngày lễ đã cấu hình"
          subtitle={`${holidays.length} kỳ nghỉ`}
          action={
            <Button variant="primary" size="sm" onClick={() => openHolidayModal()}>
              <Plus className="h-3.5 w-3.5" />
              Thêm ngày lễ
            </Button>
          }
          bodyClassName="p-0"
        >
          {!holidays.length && (
            <div className="border-b border-dashed border-line p-6 text-center text-sm text-ink-muted">
              Chưa có ngày nghỉ lễ nào. Bấm “Thêm ngày lễ” để tạo.
            </div>
          )}
          {holidays.map(h => {
            const until = h.endDate && h.endDate !== h.holidayDate ? ` → ${h.endDate}` : '';
            return (
              <div
                key={h.id || h.holidayDate}
                className="flex items-center justify-between gap-3 border-b border-line-soft px-4 py-3 last:border-0"
              >
                <div className="min-w-0">
                  <div className="truncate text-[12.5px] font-semibold text-ink">{h.name}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-ink-muted">
                    <span className="font-mono">{h.holidayDate}{until}</span>
                    <Badge variant={h.isPaid ? 'ok' : 'gray'}>{h.isPaid ? 'hưởng lương' : 'không lương'}</Badge>
                    <span>thêm bởi {h.createdByName || 'hệ thống'}</span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Button variant="secondary" size="sm" onClick={() => openHolidayModal(h)}>
                    <Pencil className="h-3.5 w-3.5" />
                    Sửa
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => deleteHoliday(h)}
                    className="border-status-danger-line text-status-danger hover:bg-status-danger-soft"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Xóa
                  </Button>
                </div>
              </div>
            );
          })}
        </Panel>
      )}

      <Modal
        isOpen={isHolidayOpen}
        onClose={() => setIsHolidayOpen(false)}
        title={editingHolidayId ? 'Sửa ngày nghỉ lễ' : 'Thêm ngày nghỉ lễ'}
      >
        <form onSubmit={saveHoliday} className="space-y-3">
          <label className="block text-xs font-semibold text-ink">
            Tên ngày lễ <span className="text-status-danger">*</span>
            <input
              className="mt-1 w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-xs text-ink focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/20"
              placeholder="Ví dụ: Tết Nguyên Đán, Giáng Sinh…"
              value={holidayForm.name}
              onChange={e => setHolidayForm({ ...holidayForm, name: e.target.value })}
            />
          </label>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <label className="font-semibold text-ink">
              Từ ngày <span className="text-status-danger">*</span>
              <input
                type="date"
                className="mt-1 w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-xs text-ink focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/20"
                value={holidayForm.startDate}
                onChange={e => setHolidayForm({ ...holidayForm, startDate: e.target.value, endDate: holidayForm.endDate || e.target.value })}
              />
            </label>
            <label className="font-semibold text-ink">
              Đến ngày
              <input
                type="date"
                className="mt-1 w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-xs text-ink focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/20"
                min={holidayForm.startDate || undefined}
                value={holidayForm.endDate}
                onChange={e => setHolidayForm({ ...holidayForm, endDate: e.target.value })}
              />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={holidayForm.isPaid} onChange={e => setHolidayForm({ ...holidayForm, isPaid: e.target.checked })} />
            Hưởng lương
          </label>
          <div className="text-[11px] text-ink-muted">Để trống “Đến ngày” nếu lễ chỉ diễn ra 1 ngày.</div>
          {error && <div className="rounded-lg border border-status-danger-line bg-status-danger-soft p-2 text-xs text-status-danger">{error}</div>}
          <div className="flex justify-end gap-2 border-t border-line pt-3">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsHolidayOpen(false)}>
              Hủy
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Lưu ngày lễ
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isShiftOpen}
        onClose={() => { setEditing(null); setForm(emptyShift); setIsShiftOpen(false); }}
        title={editing ? `Sửa ca — ${editing.name}` : 'Thêm ca làm việc'}
        maxWidth="2xl"
      >
        <form onSubmit={saveShift} className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <label className="font-semibold text-ink">
              Mã <span className="text-status-danger">*</span>
              <input
                className="mt-1 w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-xs text-ink focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/20 disabled:opacity-60"
                value={form.code}
                disabled={!!editing}
                onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
              />
            </label>
            <label className="font-semibold text-ink">
              Tên <span className="text-status-danger">*</span>
              <input
                className="mt-1 w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-xs text-ink focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/20"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label className="font-semibold text-ink">
              Vào từ
              <input type="time" className="mt-1 w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-xs text-ink focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/20" value={form.checkInStart} onChange={e => setForm({ ...form, checkInStart: e.target.value })} />
            </label>
            <label className="font-semibold text-ink">
              Vào đến
              <input type="time" className="mt-1 w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-xs text-ink focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/20" value={form.checkInEnd} onChange={e => setForm({ ...form, checkInEnd: e.target.value })} />
            </label>
            <label className="font-semibold text-ink">
              Ra từ
              <input type="time" className="mt-1 w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-xs text-ink focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/20" value={form.checkOutStart} onChange={e => setForm({ ...form, checkOutStart: e.target.value })} />
            </label>
            <label className="font-semibold text-ink">
              Ra đến
              <input type="time" className="mt-1 w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-xs text-ink focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/20" value={form.checkOutEnd} onChange={e => setForm({ ...form, checkOutEnd: e.target.value })} />
            </label>
            <label className="font-semibold text-ink">
              Nghỉ trưa từ
              <input type="time" className="mt-1 w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-xs text-ink focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/20" value={form.lunchBreakStart} onChange={e => setForm({ ...form, lunchBreakStart: e.target.value })} />
            </label>
            <label className="font-semibold text-ink">
              Nghỉ trưa đến
              <input type="time" className="mt-1 w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-xs text-ink focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/20" value={form.lunchBreakEnd} onChange={e => setForm({ ...form, lunchBreakEnd: e.target.value })} />
            </label>
            <label className="font-semibold text-ink">
              Số giờ/ngày
              <input type="number" step="0.5" className="mt-1 w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-xs text-ink focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/20" value={form.requiredWorkHours} onChange={e => setForm({ ...form, requiredWorkHours: Number(e.target.value) })} />
            </label>
            <label className="font-semibold text-ink">
              Geofence (m)
              <input type="number" className="mt-1 w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-xs text-ink focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/20" value={form.geofenceRadiusM} onChange={e => setForm({ ...form, geofenceRadiusM: Number(e.target.value) })} />
            </label>
          </div>

          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={form.isFlexible} onChange={e => setForm({ ...form, isFlexible: e.target.checked })} />
            Ca linh hoạt
          </label>
          {form.isFlexible && (
            <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              <label className="text-ink">
                Check-in từ
                <input type="time" className="mt-1 w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-xs text-ink focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/20" value={form.flexibleCheckinFrom} onChange={e => setForm({ ...form, flexibleCheckinFrom: e.target.value })} />
              </label>
              <label className="text-ink">
                đến
                <input type="time" className="mt-1 w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-xs text-ink focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/20" value={form.flexibleCheckinTo} onChange={e => setForm({ ...form, flexibleCheckinTo: e.target.value })} />
              </label>
              <label className="text-ink">
                Check-out từ
                <input type="time" className="mt-1 w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-xs text-ink focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/20" value={form.flexibleCheckoutFrom} onChange={e => setForm({ ...form, flexibleCheckoutFrom: e.target.value })} />
              </label>
              <label className="text-ink">
                đến
                <input type="time" className="mt-1 w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-xs text-ink focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/20" value={form.flexibleCheckoutTo} onChange={e => setForm({ ...form, flexibleCheckoutTo: e.target.value })} />
              </label>
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
            <label className="col-span-2 font-semibold text-ink">
              Dải IP mạng nội bộ
              <input className="mt-1 w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-xs text-ink focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/20" value={form.ipRanges} onChange={e => setForm({ ...form, ipRanges: e.target.value })} />
            </label>
          </div>

          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={form.requiresHrApproval} onChange={e => setForm({ ...form, requiresHrApproval: e.target.checked })} />
            Cần HR duyệt
          </label>

          {isBaseShift(form) && (
            <div className="rounded-lg border border-accent-line bg-accent-soft p-2.5 text-xs text-accent-dark">
              Ca chuẩn luôn áp dụng cho toàn công ty — không cần chọn nhóm/chức danh/nhân viên và không có loại trừ. Mọi ca
              khác đều là ca ngoại lệ đè lên ca chuẩn theo thứ tự ưu tiên.
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-line pt-3">
            <Button variant="outline" size="sm" type="button" onClick={() => { setEditing(null); setForm(emptyShift); setIsShiftOpen(false); }}>
              Hủy
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Lưu ca
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
