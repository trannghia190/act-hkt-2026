import React, { useState } from 'react';
import { Card } from '../../../components/common/Card';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';

interface TeamMemberSchedule {
  id: string;
  name: string;
  code: string;
  role: string;
  department: string;
  schedule: Record<number, 'OFFICE' | 'WFH' | 'LEAVE' | 'WEEKEND' | 'OFF'>;
}

export const TeamSchedulePage: React.FC = () => {
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [selectedWeek, setSelectedWeek] = useState('Tuần 47 (16/11 - 22/11/2026)');

  const members: TeamMemberSchedule[] = [
    {
      id: '1',
      name: 'Phạm Minh Tuấn',
      code: 'ACT0045',
      role: 'Tech Lead',
      department: 'Phòng Phát Triển Phần Mềm (Sirius)',
      schedule: { 16: 'OFFICE', 17: 'OFFICE', 18: 'OFFICE', 19: 'WFH', 20: 'OFFICE', 21: 'WEEKEND', 22: 'WEEKEND' },
    },
    {
      id: '2',
      name: 'Nguyễn Văn Minh',
      code: 'ACT0142',
      role: 'Senior Developer',
      department: 'Phòng Phát Triển Phần Mềm (Sirius)',
      schedule: { 16: 'OFFICE', 17: 'OFFICE', 18: 'OFFICE', 19: 'OFFICE', 20: 'WFH', 21: 'WEEKEND', 22: 'WEEKEND' },
    },
    {
      id: '3',
      name: 'Lê Hải Đăng',
      code: 'ACT0156',
      role: 'Fullstack Dev',
      department: 'Phòng Phát Triển Phần Mềm (Sirius)',
      schedule: { 16: 'OFFICE', 17: 'LEAVE', 18: 'OFFICE', 19: 'OFFICE', 20: 'OFFICE', 21: 'WEEKEND', 22: 'WEEKEND' },
    },
    {
      id: '4',
      name: 'Trần Thị Thu Hà',
      code: 'ACT0088',
      role: 'AI Engineer Lead',
      department: 'Trung Tâm AI & Khoa Học Dữ Liệu (Optimus)',
      schedule: { 16: 'OFFICE', 17: 'OFFICE', 18: 'WFH', 19: 'OFFICE', 20: 'OFFICE', 21: 'WEEKEND', 22: 'WEEKEND' },
    },
    {
      id: '5',
      name: 'Hoàng Quốc Bảo',
      code: 'ACT0092',
      role: 'DevOps Engineer',
      department: 'Phòng Hạ Tầng & An Ninh (Zeus)',
      schedule: { 16: 'OFFICE', 17: 'OFFICE', 18: 'OFFICE', 19: 'OFFICE', 20: 'OFFICE', 21: 'WEEKEND', 22: 'WEEKEND' },
    },
    {
      id: '6',
      name: 'Vũ Thùy Linh',
      code: 'ACT0112',
      role: 'QA Specialist',
      department: 'Phòng Phát Triển Phần Mềm (Sirius)',
      schedule: { 16: 'WFH', 17: 'OFFICE', 18: 'OFFICE', 19: 'OFFICE', 20: 'LEAVE', 21: 'WEEKEND', 22: 'WEEKEND' },
    },
  ];

  const days = [
    { day: 16, label: 'Thứ 2 (16/11)', isWeekend: false },
    { day: 17, label: 'Thứ 3 (17/11)', isWeekend: false },
    { day: 18, label: 'Thứ 4 (18/11)', isWeekend: false, isToday: true },
    { day: 19, label: 'Thứ 5 (19/11)', isWeekend: false },
    { day: 20, label: 'Thứ 6 (20/11)', isWeekend: false },
    { day: 21, label: 'Thứ 7 (21/11)', isWeekend: true },
    { day: 22, label: 'CN (22/11)', isWeekend: true },
  ];

  const filteredMembers = selectedDept === 'ALL'
    ? members
    : members.filter((m) => m.department.includes(selectedDept));

  const getStatusBadge = (status: 'OFFICE' | 'WFH' | 'LEAVE' | 'WEEKEND' | 'OFF') => {
    switch (status) {
      case 'OFFICE':
        return <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">🏢 VP</span>;
      case 'WFH':
        return <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-sky-500/15 text-sky-400 border border-sky-500/30">🏠 WFH</span>;
      case 'LEAVE':
        return <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">🌴 Phép</span>;
      case 'WEEKEND':
        return <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium text-ink-muted">Nghỉ</span>;
      default:
        return <span className="inline-block px-2 py-0.5 rounded text-[11px] text-ink-muted">-</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-ink">Lịch Trực Quan Nhóm (Team Schedule)</h1>
            <Badge variant="accent">S14</Badge>
          </div>
          <p className="text-xs text-ink-muted mt-1">
            Theo dõi phân bổ quân số làm việc tại văn phòng (Office), làm từ xa (WFH) và lịch nghỉ phép của toàn đội ngũ
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="text-xs p-2 border border-line rounded-lg bg-surface font-semibold text-ink"
          >
            <option value="ALL">🏢 Tất cả phòng ban</option>
            <option value="Sirius">Sirius (Software Dev)</option>
            <option value="Optimus">Optimus (AI & Data)</option>
            <option value="Zeus">Zeus (DevOps)</option>
          </select>
          <Button variant="outline" size="sm" onClick={() => setSelectedWeek('Tuần 47 (16/11 - 22/11/2026)')}>
            {selectedWeek}
          </Button>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 bg-surface rounded-xl border border-line shadow-2xs">
          <div className="text-[11px] text-ink-muted">Quân số hôm nay (18/11)</div>
          <div className="text-xl font-bold text-ink mt-0.5">6 / 6 nhân sự</div>
          <div className="text-[10px] text-emerald-400 mt-0.5 font-medium">100% sẵn sàng ca làm việc</div>
        </div>
        <div className="p-3.5 bg-surface rounded-xl border border-line shadow-2xs">
          <div className="text-[11px] text-ink-muted">Tại văn phòng (Office)</div>
          <div className="text-xl font-bold text-emerald-400 mt-0.5">5 nhân sự</div>
          <div className="text-[10px] text-ink-muted mt-0.5">Trực tiếp tại trụ sở ACT</div>
        </div>
        <div className="p-3.5 bg-surface rounded-xl border border-line shadow-2xs">
          <div className="text-[11px] text-ink-muted">Làm việc từ xa (WFH)</div>
          <div className="text-xl font-bold text-sky-400 mt-0.5">1 nhân sự</div>
          <div className="text-[10px] text-sky-400 mt-0.5">Trần Thị Thu Hà (Đã duyệt)</div>
        </div>
        <div className="p-3.5 bg-surface rounded-xl border border-line shadow-2xs">
          <div className="text-[11px] text-ink-muted">Nghỉ phép (AL / Ốm)</div>
          <div className="text-xl font-bold text-amber-400 mt-0.5">0 nhân sự</div>
          <div className="text-[10px] text-ink-muted mt-0.5">Không có ca vắng đột xuất</div>
        </div>
      </div>

      {/* Team Schedule Matrix Table */}
      <Card title="Ma Trận Lịch Trực Quan Tuần Này">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-canvas border-b border-line text-ink-secondary font-medium">
                <th className="py-3 px-3 min-w-[200px]">Nhân viên &amp; Vị trí</th>
                {days.map((d) => (
                  <th
                    key={d.day}
                    className={`py-3 px-2 text-center min-w-[110px] ${
                      d.isToday ? 'bg-accent-soft/30 text-emerald-400 font-bold border-b-2 border-emerald-400' : ''
                    } ${d.isWeekend ? 'text-ink-muted' : ''}`}
                  >
                    <div>{d.label}</div>
                    {d.isToday && <span className="text-[9px] uppercase font-bold tracking-wider">(Hôm nay)</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filteredMembers.map((m) => (
                <tr key={m.id} className="hover:bg-canvas/40 transition-colors">
                  <td className="py-3 px-3">
                    <div className="font-semibold text-ink">{m.name}</div>
                    <div className="text-[11px] text-ink-muted flex items-center gap-1.5 mt-0.5">
                      <span className="font-mono text-emerald-400 font-medium">{m.code}</span>
                      <span>·</span>
                      <span>{m.role}</span>
                    </div>
                  </td>
                  {days.map((d) => (
                    <td
                      key={d.day}
                      className={`py-3 px-2 text-center ${
                        d.isToday ? 'bg-accent-soft/10' : ''
                      } ${d.isWeekend ? 'bg-canvas/30' : ''}`}
                    >
                      {getStatusBadge(m.schedule[d.day] || 'OFF')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
