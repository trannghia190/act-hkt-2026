import React, { useState } from 'react';
const ROWS = ['Nhắc chấm công', 'Đơn chờ duyệt', 'Hạn nộp đơn', 'Check-in OKR', 'Phép tồn sắp hết hạn'];
export const NotificationPrefsPage: React.FC = () => {
  const [on, setOn] = useState<Record<string, boolean>>(Object.fromEntries(ROWS.map(r => [r, true])));
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="bg-canvas border border-line rounded-xl p-6">
        <div className="text-xs text-accent font-semibold">S36 · Tất cả vai trò</div>
        <h1 className="text-xl font-bold text-ink mt-1">Tuỳ chỉnh thông báo</h1>
        <p className="text-xs text-ink-muted mt-1">Tắt thông báo không làm mất việc — việc vẫn nằm trong "Cần làm".</p>
      </div>
      <div className="bg-surface border border-line rounded-xl p-4">
        {ROWS.map(r => (
          <label key={r} className="flex items-center justify-between py-2 border-b border-line last:border-0 text-sm">
            <span>{r}</span>
            <input type="checkbox" checked={on[r]} onChange={e => setOn(p => ({ ...p, [r]: e.target.checked }))} />
          </label>
        ))}
        <div className="text-xs text-ink-muted mt-3">Giờ yên lặng 21:00–07:00 · tối đa 3 push/ngày · dedupe 12 giờ.</div>
      </div>
    </div>
  );
};
