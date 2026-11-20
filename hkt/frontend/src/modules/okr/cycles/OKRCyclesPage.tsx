import React from 'react';
const PHASES = [
  { name: 'Setup', months: 'Jan–Mar', task: 'NV đặt OKR → QL duyệt' },
  { name: 'Check-in', months: 'Mar–Apr', task: 'Cập nhật tiến độ hàng tháng' },
  { name: 'Mid-year', months: 'Jun–Jul', task: 'Review & coaching' },
  { name: 'Final', months: 'Nov–Dec', task: 'Đánh giá cuối năm 5 bước' },
  { name: 'Summary', months: 'Sau final', task: 'HR tổng hợp + xuất Excel' },
];
export const OKRCyclesPage: React.FC = () => (
  <div className="max-w-3xl mx-auto space-y-4">
    <div className="bg-canvas border border-line rounded-xl p-6">
      <h1 className="text-xl font-bold text-ink mt-1">Quản lý chu kỳ OKR — 5 phase</h1>
      <p className="text-xs text-ink-muted mt-1">Thang điểm 1–5 · không xếp loại A/B/C/D · hạn chót theo ngày cụ thể.</p>
    </div>
    <div className="bg-surface border border-line rounded-xl p-4 space-y-2">
      {PHASES.map((p, i) => (
        <div key={p.name} className="flex items-center gap-3 border border-line rounded-lg p-3 text-sm">
          <span className="w-6 h-6 rounded-full bg-accent text-white text-xs grid place-items-center">{i + 1}</span>
          <div className="flex-1"><div className="font-semibold">{p.name} <span className="text-xs text-ink-muted">({p.months})</span></div><div className="text-xs text-ink-muted">{p.task}</div></div>
        </div>
      ))}
    </div>
  </div>
);
