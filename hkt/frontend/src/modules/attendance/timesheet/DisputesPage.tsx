import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
interface Dispute { id: string; employee: string; date: string; reason: string; status: string; deadline?: string; daysLeft?: number; }
const initial: Dispute[] = [
  { id: 'DC-01', employee: 'Vũ Văn Luận', date: '05/11/2026', reason: 'Check-in 08:47 nhưng bảng ghi vắng', status: 'PENDING' },
  { id: 'DC-02', employee: 'Nguyễn Thị Thu Hà', date: '07/11/2026', reason: 'Nghỉ phép đã duyệt nhưng ghi UP', status: 'PENDING' },
];
export const DisputesPage: React.FC = () => {
  const [items, setItems] = useState(initial);
  useEffect(() => {
    fetch('/api/v1/disputes')
      .then(r => r.json())
      .then(j => { if (Array.isArray(j?.data)) setItems(j.data.map((d: any) => ({ id: d.id, employee: d.employee, date: d.date, reason: d.reason || 'Khiếu nại bảng công', status: d.status, deadline: d.deadline, daysLeft: d.daysLeft }))); })
      .catch(() => undefined);
  }, []);
  const [error, setError] = useState<string | null>(null);
  const resolve = async (id: string, action: 'FIX' | 'MAKEUP' | 'REJECT') => {
    const defaultReason = action === 'REJECT' ? '' : 'Đã đối chiếu log chấm công và sửa ô';
    const reason = window.prompt(action === 'REJECT' ? 'Lý do từ chối (bắt buộc):' : 'Lý do xử lý (bắt buộc):', defaultReason);
    if (!reason || !reason.trim()) {
      if (action === 'REJECT') setError('Từ chối khiếu nại phải nhập lý do');
      return;
    }
    setError(null);
    const token = (() => { try { return JSON.parse(localStorage.getItem('pulse_auth_user') || '{}')?.accessToken; } catch { return ''; } })();
    const res = await fetch(`/api/v1/disputes/${id}/resolve`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ action, reason }) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setError(json?.message || 'Xử lý khiếu nại thất bại'); return; }
    setItems(p => p.map(d => d.id === id ? { ...d, status: action === 'REJECT' ? 'REJECTED' as const : 'RESOLVED' as const } : d));
  };
  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="bg-canvas border border-line rounded-xl p-6">
        <div className="text-xs text-accent font-semibold">S45 · HR</div>
        <h1 className="text-xl font-bold text-ink mt-1">Danh sách khiếu nại bảng công</h1>
        <p className="text-xs text-ink-muted mt-1">Xử lý nhanh ngay trên bảng; click vào dòng để xem chi tiết 3 cột.</p>
      </div>
      {error && <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">{error}</div>}
      <div className="bg-surface border border-line rounded-xl p-4">
        {items.map(d => (
          <div key={d.id} className="flex items-center justify-between border border-line rounded-lg px-3 py-2 mb-2 text-sm">
            <div>
              <Link to={`/attendance/disputes/${d.id}`} className="font-semibold hover:underline">{d.employee} · {d.date}</Link>
              <div className="text-xs text-ink-muted">{d.reason}</div>
              {d.status === 'PENDING' && d.daysLeft !== undefined && d.daysLeft >= 0 && <div className="text-[11px] text-amber-700">⏳ Còn {d.daysLeft} ngày</div>}
              {d.status === 'PENDING' && d.daysLeft !== undefined && d.daysLeft < 0 && <div className="text-[11px] text-rose-700 font-semibold">⏰ Đã quá hạn — tự đóng</div>}
            </div>
            {(d.status === 'PENDING') ? (
              <div className="flex items-center gap-1.5">
                <button className="text-xs px-2 py-1 rounded bg-emerald-600 text-white" onClick={() => resolve(d.id, 'FIX')}>Sửa ô</button>
                <button className="text-xs px-2 py-1 rounded border border-line" onClick={() => resolve(d.id, 'MAKEUP')}>Bổ sung công</button>
                <button className="text-xs px-2 py-1 rounded bg-rose-600 text-white" onClick={() => resolve(d.id, 'REJECT')}>Từ chối</button>
              </div>
            ) : <span className={`text-xs ${d.status === 'EXPIRED' || d.status === 'REJECTED' ? 'text-rose-700' : 'text-emerald-700'}`}>{d.status === 'EXPIRED' ? 'Quá hạn' : d.status === 'REJECTED' ? 'Đã từ chối' : 'Đã xử lý'}</span>}
          </div>
        ))}
      </div>
    </div>
  );
};
