import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '../../../components/common/Card';
import { Button } from '../../../components/common/Button';
import { useAuth } from '../../../context/AuthContext';

interface DayRecord {
  iso: string;
  date: string;
  weekday: string;
  shift: string;
  checkIn: string;
  checkOut: string;
  hoursWorked: number;
  lateMinutes: number;
  status: 'FULL' | 'LATE' | 'INCOMPLETE' | 'WFH' | 'LEAVE';
  note: string;
}

const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const authHeaders = (): Record<string, string> => {
  try {
    const u = JSON.parse(localStorage.getItem('pulse_auth_user') || '{}');
    return u?.accessToken ? { Authorization: `Bearer ${u.accessToken}` } : {};
  } catch { return {}; }
};
const hhmm = (iso?: string | null) => iso ? String(iso).slice(11, 16) : '-';
const shiftHhmm = (t?: string | null) => t ? String(t).slice(0, 5) : '--:--';
const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return (h || 0) * 60 + (m || 0); };

export const MyTimesheetPage: React.FC = () => {
  const { user } = useAuth();
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  const [logs, setLogs] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [shift, setShift] = useState<any>(null);
  const [holidays, setHolidays] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const headers = authHeaders();
    fetch('/api/v1/attendance/my-timesheet', { headers }).then(r => r.json())
      .then(j => { if (Array.isArray(j?.data)) setLogs(j.data); else setError(j?.message || 'Không tải được log chấm công'); })
      .catch(() => setError('Không tải được log chấm công'));
    fetch('/api/v1/requests/my-requests', { headers }).then(r => r.json())
      .then(j => { if (Array.isArray(j?.data)) setRequests(j.data); })
      .catch(() => undefined);
    fetch('/api/v1/attendance/my-shift', { headers }).then(r => r.json())
      .then(j => { if (j?.data?.code) setShift(j.data); })
      .catch(() => undefined);
    fetch('/api/v1/admin/holidays', { headers }).then(r => r.json())
      .then(j => { if (Array.isArray(j?.data)) setHolidays(j.data.map((h: any) => h.holidayDate)); })
      .catch(() => undefined);
  }, []);

  const shiftStart = shiftHhmm(shift?.checkInStart);
  const shiftEnd = shiftHhmm(shift?.checkOutStart);
  const shiftLabel = shift ? `${shift.name || shift.code} (${shiftStart}–${shiftEnd})` : 'Ca chuẩn';
  const lunchHours = shift?.lunchBreakStart && shift?.lunchBreakEnd
    ? Math.max(0, (toMin(shiftHhmm(shift.lunchBreakEnd)) - toMin(shiftHhmm(shift.lunchBreakStart))) / 60)
    : 0;
  const requiredHours = Number(shift?.requiredWorkHours ?? 8);

  const monthDates = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const days = new Date(y, m, 0).getDate();
    return Array.from({ length: days }, (_, i) => {
      const day = i + 1;
      const iso = `${selectedMonth}-${String(day).padStart(2, '0')}`;
      return { day, iso, weekday: new Date(y, m - 1, day).getDay() };
    });
  }, [selectedMonth]);

  const approvedRequests = useMemo(() => requests.filter(r => r.status === 'APPROVED'), [requests]);

  const records = useMemo<DayRecord[]>(() => {
    const out: DayRecord[] = [];
    for (const d of monthDates) {
      const log = logs.find(l => l.workDate === d.iso);
      const approved = approvedRequests.filter(r => r.workDate === d.iso);
      const leave = approved.find(r => r.requestType === 'LEAVE');
      const wfh = approved.find(r => r.requestType === 'WFH');
      const lateEarly = approved.find(r => r.requestType === 'LATE_EARLY');
      const holiday = holidays.includes(d.iso);
      const weekend = d.weekday === 0 || d.weekday === 6;
      if (!log && !leave && !wfh && !lateEarly && !holiday) continue;

      let payload: any = {};
      const anyApproved = leave || wfh || lateEarly;
      try { payload = anyApproved?.payload ? JSON.parse(anyApproved.payload) : {}; } catch { payload = {}; }
      let latePayload: any = {};
      try { latePayload = lateEarly?.payload ? JSON.parse(lateEarly.payload) : {}; } catch { latePayload = {}; }

      const checkIn = log?.checkInAt ? hhmm(log.checkInAt) : '-';
      const checkOut = log?.checkOutAt ? hhmm(log.checkOutAt) : '-';
      let hoursWorked = 0;
      if (log?.checkInAt && log?.checkOutAt) {
        const worked = ((toMin(checkOut) - toMin(checkIn)) / 60) - lunchHours;
        hoursWorked = Math.max(0, Math.round(worked * 10) / 10);
      } else if (log?.checkInAt && latePayload.time && latePayload.late_early === 'EARLY') {
        const workedEarly = ((toMin(String(latePayload.time).slice(0, 5)) - toMin(checkIn)) / 60) - lunchHours;
        hoursWorked = Math.max(0, Math.round(workedEarly * 10) / 10);
      }

      let lateMinutes = 0;
      if (log?.checkInAt) lateMinutes = Math.max(0, toMin(checkIn) - toMin(shiftStart));
      if (latePayload.late_early === 'LATE' && latePayload.time) lateMinutes = Math.max(0, toMin(String(latePayload.time).slice(0, 5)) - toMin(shiftStart));
      if (latePayload.late_early === 'EARLY' && latePayload.time) {
        lateMinutes = Math.max(lateMinutes, toMin(shiftEnd) - toMin(String(latePayload.time).slice(0, 5)));
      }

      let status: DayRecord['status'] = 'FULL';
      let note = holiday ? 'Ngày lễ' : weekend ? 'Làm cuối tuần' : 'Đúng giờ';
      if (leave) {
        status = 'LEAVE';
        const half = payload.half_day_period ? ` — buổi ${payload.half_day_period === 'MORNING' ? 'sáng' : 'chiều'}` : '';
        note = `Nghỉ phép${half}${payload.work_window_start ? ` · làm ${payload.work_window_start}–${payload.work_window_end}` : ''}`;
      } else if (wfh) {
        status = 'WFH';
        note = payload.half_day_period
          ? `WFH buổi ${payload.half_day_period === 'MORNING' ? 'sáng' : 'chiều'}`
            + (payload.work_window_start && payload.work_window_end ? ` · làm việc ${payload.work_window_start}–${payload.work_window_end}` : '')
          : 'Làm việc từ xa (WFH) cả ngày';
      } else if (lateEarly) {
        status = lateMinutes > 0 ? 'LATE' : 'FULL';
        note = latePayload.late_early === 'EARLY' ? 'Về sớm đã duyệt' : 'Đi muộn đã duyệt';
      } else if (log) {
        if (!log.checkInAt || !log.checkOutAt) {
          status = 'INCOMPLETE';
          note = !log.checkInAt ? 'Thiếu giờ vào' : 'Thiếu giờ ra';
        } else if (lateMinutes > 0) {
          status = 'LATE';
          note = `Đi muộn ${lateMinutes} phút`;
        }
      } else if (holiday) {
        status = 'FULL';
      }

      out.push({
        iso: d.iso,
        date: `${String(d.day).padStart(2, '0')}/${selectedMonth.slice(5, 7)}/${selectedMonth.slice(0, 4)}`,
        weekday: WEEKDAYS[d.weekday],
        shift: shiftLabel,
        checkIn,
        checkOut,
        hoursWorked,
        lateMinutes,
        status,
        note,
      });
    }
    return out;
  }, [monthDates, logs, approvedRequests, holidays, selectedMonth, shiftLabel, shiftStart, shiftEnd, lunchHours]);

  const standardDays = monthDates.filter(d => d.weekday !== 0 && d.weekday !== 6 && !holidays.includes(d.iso)).length;
  const actualDays = records.reduce((sum, r) => sum
    + (r.status === 'FULL' || r.status === 'LATE' ? 1 : r.status === 'WFH' ? (r.note.includes('buổi') ? 0.5 : 1) : 0), 0);
  const leaveDays = records.reduce((sum, r) => sum + (r.status === 'LEAVE' ? (r.note.includes('buổi') ? 0.5 : 1) : 0), 0);
  const lateCount = approvedRequests.filter(r => r.requestType === 'LATE_EARLY').length;
  const otHours = records.reduce((sum, r) => sum + (r.hoursWorked > requiredHours ? r.hoursWorked - requiredHours : 0), 0);

  const monthOptions = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink">Bảng Công Cá Nhân Của Tôi (My Timesheet)</h1>
          <p className="text-xs text-ink-muted mt-1">
            Dữ liệu lấy từ log chấm công, đơn đã duyệt và ca làm việc thực tế của bạn.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
            className="text-xs p-2 border border-line rounded-lg bg-surface font-semibold text-ink">
            {monthOptions.map(m => <option key={m} value={m}>Kỳ công: Tháng {m.slice(5, 7)} / {m.slice(0, 4)}</option>)}
          </select>
          <Button variant="outline" size="sm" onClick={() => window.print()}>In / Tải PDF</Button>
        </div>
      </div>

      {error && <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">{error}</div>}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 bg-surface rounded-xl border border-line shadow-2xs">
          <div className="text-[11px] text-ink-muted">Công Chuẩn Kỳ Này</div>
          <div className="text-2xl font-bold text-ink mt-1">{standardDays} ngày</div>
          <div className="text-[10px] text-ink-secondary mt-0.5">Trừ cuối tuần và ngày lễ</div>
        </div>
        <div className="p-4 bg-surface rounded-xl border border-accent/40 bg-accent-soft/20 shadow-2xs">
          <div className="text-[11px] text-accent-dark font-medium">Công Thực Tế</div>
          <div className="text-2xl font-black text-accent mt-1">{actualDays} / {standardDays}</div>
          <div className="text-[10px] text-ink-secondary mt-0.5">{actualDays} ngày có log/WFH · {leaveDays} ngày nghỉ phép</div>
        </div>
        <div className="p-4 bg-surface rounded-xl border border-line shadow-2xs">
          <div className="text-[11px] text-ink-muted">Giờ Làm Thêm (OT)</div>
          <div className="text-2xl font-bold text-sky-600 mt-1">{otHours.toFixed(1)} giờ</div>
          <div className="text-[10px] text-ink-secondary mt-0.5">Tính từ giờ ra vượt ca chuẩn</div>
        </div>
        <div className="p-4 bg-surface rounded-xl border border-line shadow-2xs">
          <div className="text-[11px] text-ink-muted">Đơn đi muộn/về sớm đã duyệt</div>
          <div className="text-2xl font-bold text-amber-600 mt-1">{lateCount} đơn</div>
          <div className="text-[10px] text-ink-secondary mt-0.5">Ca: {shiftLabel}</div>
        </div>
      </div>

      <Card title={`Chi tiết từng ngày — tháng ${selectedMonth.slice(5, 7)}/${selectedMonth.slice(0, 4)}`}>
        <div className="grid grid-cols-7 gap-1.5 text-center text-[11px]">
          {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(d => (
            <div key={d} className="font-semibold text-ink-muted py-1">{d}</div>
          ))}
          {monthDates.map(d => {
            const rec = records.find(r => r.iso === d.iso);
            const weekend = d.weekday === 0 || d.weekday === 6;
            const cls = rec?.status === 'LEAVE' ? 'bg-sky-50 border-sky-200 text-sky-700'
              : rec?.status === 'WFH' ? 'bg-violet-50 border-violet-200 text-violet-700'
              : rec?.status === 'LATE' ? 'bg-amber-50 border-amber-200 text-amber-700'
              : rec?.status === 'INCOMPLETE' ? 'bg-rose-50 border-rose-200 text-rose-700'
              : rec ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : weekend ? 'bg-canvas text-ink-muted' : 'bg-canvas border-line text-ink-muted';
            const symbol = rec?.status === 'LEAVE' ? 'AL' : rec?.status === 'WFH' ? 'R'
              : rec?.status === 'LATE' ? `${rec.lateMinutes}′` : rec?.status === 'INCOMPLETE' ? '!' : rec ? '1.00' : '—';
            return (
              <div key={d.iso} title={rec?.note || (weekend ? 'Cuối tuần' : 'Chưa có dữ liệu')}
                className={`rounded-lg border p-1.5 min-h-[52px] flex flex-col items-center justify-center ${cls}`}>
                <span className="font-bold text-xs">{d.day}</span>
                <span className="text-[9px]">{weekend && !rec ? '' : symbol}</span>
              </div>
            );
          })}
        </div>
      </Card>

      <Card title={`Bảng Chi Tiết Ngày Công Của ${user?.fullName || 'Nhân Viên'} (${user?.employeeCode || ''})`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-canvas border-b border-line text-ink-secondary font-medium">
                <th className="py-2.5 px-3">Ngày</th><th className="py-2.5 px-3">Thứ</th><th className="py-2.5 px-3">Ca</th>
                <th className="py-2.5 px-3 text-center">Giờ Vào</th><th className="py-2.5 px-3 text-center">Giờ Ra</th>
                <th className="py-2.5 px-3 text-center">Giờ Làm</th><th className="py-2.5 px-3 text-center">Muộn</th>
                <th className="py-2.5 px-3">Trạng Thái</th><th className="py-2.5 px-3">Ghi Chú</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {records.length === 0 && (
                <tr><td colSpan={9} className="py-8 text-center text-ink-muted">Chưa có dữ liệu chấm công/đơn trong tháng này.</td></tr>
              )}
              {records.map(r => (
                <tr key={r.iso} className="hover:bg-canvas/40">
                  <td className="py-2.5 px-3 font-mono">{r.date}</td>
                  <td className="py-2.5 px-3">{r.weekday}</td>
                  <td className="py-2.5 px-3 text-ink-secondary">{r.shift}</td>
                  <td className="py-2.5 px-3 text-center font-mono">{r.checkIn}</td>
                  <td className="py-2.5 px-3 text-center font-mono">{r.checkOut}</td>
                  <td className="py-2.5 px-3 text-center">{r.hoursWorked ? `${r.hoursWorked}h` : '—'}</td>
                  <td className="py-2.5 px-3 text-center">{r.lateMinutes ? `${r.lateMinutes}′` : '—'}</td>
                  <td className="py-2.5 px-3">
                    <span className={`px-2 py-0.5 rounded text-[11px] border ${
                      r.status === 'LEAVE' ? 'bg-sky-50 text-sky-700 border-sky-200'
                      : r.status === 'WFH' ? 'bg-violet-50 text-violet-700 border-violet-200'
                      : r.status === 'LATE' ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : r.status === 'INCOMPLETE' ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                      {r.status === 'FULL' ? 'Đủ công' : r.status === 'LATE' ? 'Đi muộn' : r.status === 'INCOMPLETE' ? 'Thiếu log' : r.status === 'WFH' ? 'WFH' : 'Nghỉ phép'}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-ink-secondary">{r.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
