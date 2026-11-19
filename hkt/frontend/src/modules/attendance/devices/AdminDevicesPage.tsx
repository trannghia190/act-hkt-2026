import React, { useState } from 'react';

interface PendingDevice { id: string; employee: string; device: string; reason: string; requestedAt: string; }
const initial: PendingDevice[] = [
  { id: 'P1', employee: 'Vũ Văn Luận (136ACT)', device: 'MacBook Pro · web-7c1a', reason: 'Dùng laptop khi WFH', requestedAt: '12/11/2026' },
];

export const AdminDevicesPage: React.FC = () => {
  const [pending, setPending] = useState(initial);
  const decide = (id: string, approve: boolean) => setPending(p => p.filter(d => d.id !== id));
  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="bg-canvas border border-line rounded-xl p-6">
        <div className="text-xs text-accent font-semibold">S28 · HR</div>
        <h1 className="text-xl font-bold text-ink mt-1">Quản lý thiết bị — duyệt & thu hồi</h1>
        <p className="text-xs text-ink-muted mt-1">Máy thứ 3 trở đi cần lý do; mọi thao tác ghi nhật ký thay đổi.</p>
      </div>
      <div className="bg-surface border border-line rounded-xl p-4">
        <h2 className="text-sm font-bold mb-3">Chờ duyệt ({pending.length})</h2>
        {pending.length === 0 && <div className="text-xs text-ink-muted">Không có yêu cầu chờ duyệt.</div>}
        {pending.map(d => (
          <div key={d.id} className="border border-line rounded-lg p-3 mb-2 text-sm">
            <div className="font-semibold">{d.employee}</div>
            <div className="text-xs text-ink-muted mt-1">{d.device} · {d.requestedAt} · Lý do: {d.reason}</div>
            <div className="flex gap-2 mt-2">
              <button className="text-xs px-3 py-1 rounded bg-emerald-600 text-white" onClick={() => decide(d.id, true)}>Duyệt</button>
              <button className="text-xs px-3 py-1 rounded border border-line" onClick={() => decide(d.id, false)}>Từ chối</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
