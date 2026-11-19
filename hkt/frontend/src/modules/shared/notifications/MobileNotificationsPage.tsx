import React from 'react';

const items = [
  { id: 'N1', title: 'Chưa check-in hôm nay', detail: 'Ca 08:30–17:30 · bấm để chấm công', kind: 'urgent' },
  { id: 'N2', title: 'Đơn nghỉ phép đã được duyệt', detail: 'Quản lý Nguyễn Thanh Tùng · 12/11/2026', kind: 'ok' },
  { id: 'N3', title: 'Check-in OKR tháng 11', detail: 'Còn 2 ngày · cập nhật tiến độ', kind: 'warn' },
];

export const MobileNotificationsPage: React.FC = () => (
  <div className="max-w-md mx-auto space-y-4">
    <div className="bg-canvas border border-line rounded-xl p-5">
      <div className="text-xs text-accent font-semibold">S04m · Mobile</div>
      <h1 className="text-lg font-bold text-ink mt-1">Thông báo & nhắc việc</h1>
      <p className="text-xs text-ink-muted mt-1">3 kênh: trong web · email digest 08:00 · Web Push. Tối đa 3 push/ngày.</p>
    </div>
    <div className="bg-surface border border-line rounded-xl p-3 space-y-2">
      {items.map(i => (
        <div key={i.id} className="border border-line rounded-lg p-3">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${i.kind === 'urgent' ? 'bg-rose-500' : i.kind === 'warn' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
            <div className="text-sm font-semibold">{i.title}</div>
          </div>
          <div className="text-xs text-ink-muted mt-1 ml-4">{i.detail}</div>
        </div>
      ))}
      <div className="text-xs text-ink-muted text-center pt-1">Giờ yên lặng 21:00–07:00 · dedupe 12h</div>
    </div>
  </div>
);
