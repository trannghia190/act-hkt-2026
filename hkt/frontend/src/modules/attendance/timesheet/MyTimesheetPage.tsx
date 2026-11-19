import React, { useState } from 'react';
import { Card } from '../../../components/common/Card';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { useAuth } from '../../../context/AuthContext';

interface TimesheetDay {
  date: string;
  weekday: string;
  shift: string;
  checkIn: string;
  checkOut: string;
  hoursWorked: number;
  otHours: number;
  lateMinutes: number;
  status: 'FULL' | 'LATE_GRACE' | 'LATE_QUOTA' | 'WFH' | 'LEAVE' | 'WEEKEND';
  note: string;
}

export const MyTimesheetPage: React.FC = () => {
  const { user } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState('11/2026');

  const records: TimesheetDay[] = [
    { date: '18/11/2026', weekday: 'T4', shift: 'HC (08:30-17:30)', checkIn: '08:22', checkOut: '17:30', hoursWorked: 8.0, otHours: 0, lateMinutes: 0, status: 'FULL', note: 'Hôm nay - Chuẩn công' },
    { date: '17/11/2026', weekday: 'T3', shift: 'HC (08:30-17:30)', checkIn: '08:30', checkOut: '17:35', hoursWorked: 8.0, otHours: 0, lateMinutes: 0, status: 'FULL', note: 'Đúng giờ' },
    { date: '16/11/2026', weekday: 'T2', shift: 'HC (08:30-17:30)', checkIn: '08:25', checkOut: '17:30', hoursWorked: 8.0, otHours: 0, lateMinutes: 0, status: 'FULL', note: 'Đúng giờ' },
    { date: '13/11/2026', weekday: 'T6', shift: 'HC (08:30-17:30)', checkIn: '-', checkOut: '-', hoursWorked: 0, otHours: 0, lateMinutes: 0, status: 'LEAVE', note: 'Nghỉ phép năm (REQ-2026-0030)' },
    { date: '12/11/2026', weekday: 'T5', shift: 'HC (08:30-17:30)', checkIn: '08:18', checkOut: '19:30', hoursWorked: 8.0, otHours: 2.0, lateMinutes: 0, status: 'FULL', note: 'Tăng ca OT 2h release Sprint' },
    { date: '11/11/2026', weekday: 'T4', shift: 'HC (08:30-17:30)', checkIn: '08:30', checkOut: '17:30', hoursWorked: 8.0, otHours: 0, lateMinutes: 0, status: 'WFH', note: 'Làm việc từ xa WFH đã duyệt' },
    { date: '10/11/2026', weekday: 'T3', shift: 'HC (08:30-17:30)', checkIn: '08:29', checkOut: '17:45', hoursWorked: 8.0, otHours: 0, lateMinutes: 0, status: 'FULL', note: 'Đúng giờ' },
    { date: '09/11/2026', weekday: 'T2', shift: 'HC (08:30-17:30)', checkIn: '08:20', checkOut: '17:35', hoursWorked: 8.0, otHours: 0, lateMinutes: 0, status: 'FULL', note: 'Đúng giờ' },
    { date: '06/11/2026', weekday: 'T6', shift: 'HC (08:30-17:30)', checkIn: '08:15', checkOut: '17:30', hoursWorked: 8.0, otHours: 0, lateMinutes: 0, status: 'FULL', note: 'Đúng giờ' },
    { date: '05/11/2026', weekday: 'T5', shift: 'HC (08:30-17:30)', checkIn: '08:52', checkOut: '18:00', hoursWorked: 8.0, otHours: 0, lateMinutes: 22, status: 'LATE_QUOTA', note: 'Muộn 22p (Đã trừ quota 1/3)' },
    { date: '04/11/2026', weekday: 'T4', shift: 'HC (08:30-17:30)', checkIn: '08:42', checkOut: '17:30', hoursWorked: 8.0, otHours: 0, lateMinutes: 12, status: 'LATE_GRACE', note: 'Dung sai Grace 15 phút hợp lệ' },
    { date: '03/11/2026', weekday: 'T3', shift: 'HC (08:30-17:30)', checkIn: '08:28', checkOut: '17:40', hoursWorked: 8.0, otHours: 0, lateMinutes: 0, status: 'FULL', note: 'Đúng giờ' },
    { date: '02/11/2026', weekday: 'T2', shift: 'HC (08:30-17:30)', checkIn: '08:24', checkOut: '17:35', hoursWorked: 8.0, otHours: 0, lateMinutes: 0, status: 'FULL', note: 'Đúng giờ' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-ink">Bảng Công Cá Nhân Của Tôi (My Timesheet)</h1>
            <Badge variant="accent">S11</Badge>
          </div>
          <p className="text-xs text-ink-muted mt-1">
            Minh bạch từng ngày công thực tế, tính toán số giờ làm việc, dung sai đi muộn và giờ làm thêm OT chốt lương
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="text-xs p-2 border border-line rounded-lg bg-surface font-semibold text-ink"
          >
            <option value="11/2026">Kỳ công: Tháng 11 / 2026</option>
            <option value="10/2026">Kỳ công: Tháng 10 / 2026</option>
          </select>
          <Button variant="outline" size="sm">
            Tải PDF Bảng Công
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 bg-surface rounded-xl border border-line shadow-2xs">
          <div className="text-[11px] text-ink-muted">Công Chuẩn Kỳ Này</div>
          <div className="text-2xl font-bold text-ink mt-1">22.0 ngày</div>
          <div className="text-[10px] text-ink-secondary mt-0.5">Tiêu chuẩn 176.0 giờ</div>
        </div>

        <div className="p-4 bg-surface rounded-xl border border-accent/40 bg-accent-soft/20 shadow-2xs">
          <div className="text-[11px] text-accent-dark font-medium">Công Thực Tế Tích Lũy</div>
          <div className="text-2xl font-black text-accent mt-1">13.0 / 22.0</div>
          <div className="text-[10px] text-emerald-400 mt-0.5 font-medium">12 ngày làm + 1 ngày phép AL</div>
        </div>

        <div className="p-4 bg-surface rounded-xl border border-line shadow-2xs">
          <div className="text-[11px] text-ink-muted">Giờ Làm Thêm (OT 150%)</div>
          <div className="text-2xl font-bold text-sky-400 mt-1">2.0 giờ</div>
          <div className="text-[10px] text-sky-500 mt-0.5 font-mono">+0.375 công quy đổi</div>
        </div>

        <div className="p-4 bg-surface rounded-xl border border-line shadow-2xs">
          <div className="text-[11px] text-ink-muted">Quota Đi Muộn Còn Lại</div>
          <div className="text-2xl font-bold text-amber-400 mt-1">2 / 3 lần</div>
          <div className="text-[10px] text-amber-500 mt-0.5">Đã dùng 1 lần (05/11)</div>
        </div>
      </div>

      {/* S11 · Chi tiết từng ngày dạng lịch (ô vuông) */}
      <Card title="Chi tiết từng ngày — dạng lịch tháng 11/2026">
        <div className="grid grid-cols-7 gap-1.5 text-center text-[11px]">
          {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(d => (
            <div key={d} className="font-semibold text-ink-muted py-1">{d}</div>
          ))}
          {Array.from({ length: 30 }, (_, i) => i + 1).map(day => {
            const iso = `2026-11-${String(day).padStart(2, '0')}`;
            const rec = records.find(r => r.date === `${String(day).padStart(2, '0')}/11/2026`);
            const weekday = new Date(2026, 10, day).getDay();
            const weekend = weekday === 0 || weekday === 6;
            const cls = weekend
              ? 'bg-canvas text-ink-muted'
              : rec?.status === 'LEAVE' ? 'bg-sky-50 border-sky-200 text-sky-700'
              : rec?.status === 'WFH' ? 'bg-violet-50 border-violet-200 text-violet-700'
              : rec && rec.lateMinutes > 0 ? 'bg-amber-50 border-amber-200 text-amber-700'
              : rec ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-canvas border-line text-ink-muted';
            return (
              <div key={iso} title={rec?.note || (weekend ? 'Cuối tuần' : 'Chưa có dữ liệu')}
                className={`rounded-lg border p-1.5 min-h-[52px] flex flex-col items-center justify-center ${cls}`}>
                <span className="font-bold text-xs">{day}</span>
                <span className="text-[9px]">
                  {weekend ? '' : rec?.status === 'LEAVE' ? 'AL' : rec?.status === 'WFH' ? 'R' : rec ? (rec.lateMinutes > 0 ? `Trễ ${rec.lateMinutes}′` : '1.00') : '—'}
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Timesheet Details Table */}
      <Card title={`Bảng Chi Tiết Ngày Công Của ${user?.fullName || 'Nhân Viên'} (${user?.employeeCode || 'ACT0142'})`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-canvas border-b border-line text-ink-secondary font-medium">
                <th className="py-2.5 px-3">Ngày</th>
                <th className="py-2.5 px-3">Thứ</th>
                <th className="py-2.5 px-3">Ca Đăng Ký</th>
                <th className="py-2.5 px-3 text-center">Giờ Vào (In)</th>
                <th className="py-2.5 px-3 text-center">Giờ Ra (Out)</th>
                <th className="py-2.5 px-3 text-center">Giờ Làm</th>
                <th className="py-2.5 px-3 text-center">OT (Giờ)</th>
                <th className="py-2.5 px-3">Trạng Thái</th>
                <th className="py-2.5 px-3">Ghi Chú</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {records.map((r, idx) => (
                <tr key={idx} className="hover:bg-canvas/40 transition-colors">
                  <td className="py-2.5 px-3 font-mono font-semibold text-ink">{r.date}</td>
                  <td className="py-2.5 px-3 font-medium text-ink-secondary">{r.weekday}</td>
                  <td className="py-2.5 px-3 text-ink-secondary">{r.shift}</td>
                  <td className="py-2.5 px-3 text-center font-mono font-medium text-ink">{r.checkIn}</td>
                  <td className="py-2.5 px-3 text-center font-mono font-medium text-ink">{r.checkOut}</td>
                  <td className="py-2.5 px-3 text-center font-bold text-ink">{r.hoursWorked}h</td>
                  <td className="py-2.5 px-3 text-center font-mono text-sky-400 font-bold">
                    {r.otHours > 0 ? `+${r.otHours}h` : '-'}
                  </td>
                  <td className="py-2.5 px-3">
                    {r.status === 'FULL' && <Badge variant="ok">Đủ công (1.0)</Badge>}
                    {r.status === 'LATE_GRACE' && <Badge variant="ok">Grace (1.0)</Badge>}
                    {r.status === 'LATE_QUOTA' && <Badge variant="warn">Dùng Quota</Badge>}
                    {r.status === 'WFH' && <Badge variant="accent">WFH (1.0)</Badge>}
                    {r.status === 'LEAVE' && <Badge variant="gray">Phép AL (1.0)</Badge>}
                  </td>
                  <td className="py-2.5 px-3 text-ink-muted text-[11px]">{r.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
