import React, { useEffect, useState } from 'react';

interface DayRow {
  date: string;
  wfh: number;
  leave: number;
  late: number;
  present: number;
  teamSize: number;
  entries: { employeeCode: string; fullName: string; kind: 'WFH' | 'LEAVE' | 'LATE' | 'PRESENT'; halfDay?: boolean; halfDayPeriod?: 'MORNING' | 'AFTERNOON' | null; workWindowStart?: string | null; workWindowEnd?: string | null }[];
}

const KIND_LABEL: Record<string, { text: string; cls: string }> = {
  PRESENT: { text: 'Có mặt', cls: 'bg-status-ok-soft text-status-ok border-status-ok-line' },
  WFH: { text: 'WFH', cls: 'bg-status-info-soft text-status-info border-status-info-line' },
  LEAVE: { text: 'Nghỉ phép', cls: 'bg-status-info-soft text-status-info border-status-info-line' },
  LATE: { text: 'Đi muộn', cls: 'bg-status-warn-soft text-status-warn border-status-warn-line' },
};

export const TeamSchedulePage: React.FC = () => {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [view, setView] = useState<'week' | 'month'>('month');
  const [weekOffset, setWeekOffset] = useState(0);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  useEffect(() => {
    const token = (() => { try { return JSON.parse(localStorage.getItem('pulse_auth_user') || '{}')?.accessToken; } catch { return ''; } })();
    fetch(`/api/v1/attendance/team-schedule?month=${month}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => r.json())
      .then(j => { if (j?.data) { setData(j.data); setError(null); } else setError(j?.message || 'Không tải được lịch nhóm'); })
      .catch(() => setError('Không tải được lịch nhóm'));
  }, [month]);

  const allDays: DayRow[] = data?.days || [];
  const days = view === 'month' ? allDays : (() => {
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) + weekOffset * 7);
    const from = monday.toISOString().slice(0, 10);
    const to = new Date(monday.getTime() + 6 * 86400000).toISOString().slice(0, 10);
    return allDays.filter(d => d.date >= from && d.date <= to);
  })();

  const dayEntries = selectedDay ? allDays.find(d => d.date === selectedDay) : null;

  return (
    <div className="space-y-4">
      <div className="bg-canvas border border-line rounded-xl p-6">
        <h1 className="text-xl font-bold text-ink mt-1">Lịch nhóm — ai vắng, ai có mặt</h1>
        <p className="text-xs text-ink-muted mt-1">
          {data?.scope || 'Đang tải…'} · {data?.teamSize ?? 0} người · cảnh báo khi ≥{data?.conflictThresholdPercent ?? 60}% nhóm vắng
        </p>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <button onClick={() => setView('week')} className={`inline-flex items-center h-[31px] px-3 rounded-full border text-[12.5px] font-semibold whitespace-nowrap transition-colors ${view === 'week' ? 'bg-ink text-canvas border-ink' : 'bg-surface border-line text-ink-secondary'}`}>Tuần</button>
          <button onClick={() => setView('month')} className={`inline-flex items-center h-[31px] px-3 rounded-full border text-[12.5px] font-semibold whitespace-nowrap transition-colors ${view === 'month' ? 'bg-ink text-canvas border-ink' : 'bg-surface border-line text-ink-secondary'}`}>Tháng</button>
          {view === 'week' && (
            <>
              <button onClick={() => setWeekOffset(o => o - 1)} className="text-xs px-2 py-1.5 rounded border border-line">← Tuần trước</button>
              <button onClick={() => setWeekOffset(o => o + 1)} className="text-xs px-2 py-1.5 rounded border border-line">Tuần sau →</button>
            </>
          )}
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="text-xs px-2 py-1.5 rounded-lg border border-line bg-surface text-ink" />
        </div>
      </div>

      {error && <div className="text-sm text-status-danger bg-status-danger-soft border border-status-danger-line rounded-lg p-3">{error}</div>}

      {(data?.conflicts || []).length > 0 && (
        <div className="bg-status-warn-soft border border-status-warn-line rounded-xl p-3 text-xs text-status-warn space-y-1">
          <div className="font-bold">⚠️ Cảnh báo xung đột lịch</div>
          {data.conflicts.map((c: any) => <div key={c.date}>• {c.message}</div>)}
        </div>
      )}

      <div className="bg-surface border border-line rounded-xl p-3 overflow-x-auto">
        <div className="flex gap-1.5 flex-wrap">
          {days.map(d => {
            const absent = d.wfh + d.leave;
            const conflict = d.teamSize >= 3 && absent * 100 >= d.teamSize * (data?.conflictThresholdPercent ?? 60);
            return (
              <button key={d.date} onClick={() => setSelectedDay(d.date)}
                className={`w-[86px] rounded-lg border p-2 text-left text-[11px] ${conflict ? 'border-status-warn bg-status-warn-soft' : 'border-line bg-canvas hover:border-accent'} ${selectedDay === d.date ? 'ring-1 ring-accent' : ''}`}>
                <div className="font-bold text-ink">{d.date.slice(8)}/{d.date.slice(5, 7)}</div>
                <div className="text-status-ok">Có mặt: {d.present}</div>
                {d.wfh > 0 && <div className="text-status-info">WFH: {d.wfh}</div>}
                {d.leave > 0 && <div className="text-status-info">Nghỉ: {d.leave}</div>}
                {d.late > 0 && <div className="text-status-warn">Muộn: {d.late}</div>}
              </button>
            );
          })}
        </div>
      </div>

      {dayEntries && (
        <div className="bg-surface border border-line rounded-xl p-4">
          <div className="text-sm font-bold mb-2">Chi tiết ngày {dayEntries.date}</div>
          <div className="grid sm:grid-cols-2 gap-2">
            {dayEntries.entries.map((e: any) => (
              <div key={e.employeeCode} className="flex items-center justify-between border border-line rounded-lg px-3 py-2 text-sm">
                <span>
                  {e.fullName} <span className="text-xs text-ink-muted">({e.employeeCode})</span>
                  {e.halfDay && (
                    <span className="block text-[11px] text-status-info mt-0.5">
                      {e.kind === 'WFH' ? 'WFH buổi' : 'Nghỉ buổi'} {e.halfDayPeriod === 'MORNING' ? 'sáng' : 'chiều'}
                      {e.workWindowStart && e.workWindowEnd ? ` · làm việc ${e.workWindowStart}–${e.workWindowEnd}` : ''}
                    </span>
                  )}
                </span>
                <span className={`text-[11px] px-2 py-0.5 rounded border ${KIND_LABEL[e.kind]?.cls || ''}`}>
                  {e.halfDay ? (e.kind === 'WFH' ? 'WFH ' : 'Nghỉ ') + (e.halfDayPeriod === 'MORNING' ? 'sáng' : 'chiều') : (KIND_LABEL[e.kind]?.text || e.kind)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
