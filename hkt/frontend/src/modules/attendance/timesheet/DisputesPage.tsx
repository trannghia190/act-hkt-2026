import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
interface Dispute { id: string; employee: string; date: string; reason: string; status: 'PENDING' | 'RESOLVED'; }
const initial: Dispute[] = [
  { id: 'DC-01', employee: 'Vũ Văn Luận', date: '05/11/2026', reason: 'Check-in 08:47 nhưng bảng ghi vắng', status: 'PENDING' },
  { id: 'DC-02', employee: 'Nguyễn Thị Thu Hà', date: '07/11/2026', reason: 'Nghỉ phép đã duyệt nhưng ghi UP', status: 'PENDING' },
];
export const DisputesPage: React.FC = () => {
  const [items, setItems] = useState(initial);
  useEffect(() => {
    fetch('/api/v1/disputes')
      .then(r => r.json())
      .then(j => { if (Array.isArray(j?.data)) setItems(j.data.map((d: any) => ({ id: d.id, employee: d.employee, date: d.date, reason: d.reason || 'Khiếu nại bảng công', status: d.status }))); })
      .catch(() => undefined);
  }, []);
  const resolve = async (id: string) => {
    const reason = window.prompt('Lý do xử lý (bắt buộc):', 'Đã đối chiếu log chấm công và sửa ô');
    if (!reason || !reason.trim()) return;
    const token = (() => { try { return JSON.parse(localStorage.getItem('pulse_auth_user') || '{}')?.accessToken; } catch { return ''; } })();
    const res = await fetch(`/api/v1/disputes/${id}/resolve`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ action: 'FIX', reason }) });
    if (res.ok) setItems(p => p.map(d => d.id === id ? { ...d, status: 'RESOLVED' as const } : d));
  };
  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="bg-canvas border border-line rounded-xl p-6">
        <div className="text-xs text-accent font-semibold">S45 · HR</div>
        <h1 className="text-xl font-bold text-ink mt-1">Danh sách khiếu nại bảng công</h1>
        <p className="text-xs text-ink-muted mt-1">Xử lý nhanh ngay trên bảng; click vào dòng để xem chi tiết 3 cột.</p>
      </div>
      <div className="bg-surface border border-line rounded-xl p-4">
        {items.map(d => (
          <div key={d.id} className="flex items-center justify-between border border-line rounded-lg px-3 py-2 mb-2 text-sm">
            <div>
              <Link to={`/attendance/disputes/${d.id}`} className="font-semibold hover:underline">{d.employee} · {d.date}</Link>
              <div className="text-xs text-ink-muted">{d.reason}</div>
            </div>
            {d.status === 'PENDING' ? (
              <button className="text-xs px-2 py-1 rounded bg-emerald-600 text-white" onClick={() => resolve(d.id)}>Xử lý</button>
            ) : <span className="text-xs text-emerald-700">Đã xử lý</span>}
          </div>
        ))}
      </div>
    </div>
  );
};
