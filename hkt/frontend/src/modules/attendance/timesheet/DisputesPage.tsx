import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

interface Dispute { id: string; employee: string; date: string; reason: string; status: string; deadline?: string; daysLeft?: number; }

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  PENDING: { text: 'Đang mở', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  RESOLVED: { text: 'Đã xử lý', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  REJECTED: { text: 'Đã từ chối', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  EXPIRED: { text: 'Quá hạn — tự đóng', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
};

export const DisputesPage: React.FC = () => {
  const [items, setItems] = useState<Dispute[]>([]);
  const [filter, setFilter] = useState<'PENDING' | 'RESOLVED' | 'REJECTED' | 'EXPIRED' | 'ALL'>('PENDING');
  const [error, setError] = useState<string | null>(null);
  const token = () => { try { return JSON.parse(localStorage.getItem('pulse_auth_user') || '{}')?.accessToken || ''; } catch { return ''; } };
  const headers = () => (token() ? { Authorization: `Bearer ${token()}` } : {});

  const load = () => {
    fetch('/api/v1/disputes', { headers: headers() })
      .then(r => r.json())
      .then(j => {
        if (Array.isArray(j?.data)) {
          setItems(j.data.map((d: any) => ({
            id: d.id, employee: d.employee, date: d.date, reason: d.reason || 'Khiếu nại bảng công',
            status: d.status, deadline: d.deadline, daysLeft: d.daysLeft,
          })));
          setError(null);
        } else setError(j?.message || 'Không tải được danh sách khiếu nại');
      })
      .catch(() => setError('Không tải được danh sách khiếu nại'));
  };
  useEffect(load, []);

  const resolve = async (id: string, action: 'FIX' | 'MAKEUP' | 'REJECT') => {
    const defaultReason = action === 'REJECT' ? '' : 'Đã đối chiếu log chấm công và sửa ô';
    const reason = window.prompt(action === 'REJECT' ? 'Lý do từ chối (bắt buộc):' : 'Lý do xử lý (bắt buộc):', defaultReason);
    if (!reason || !reason.trim()) {
      if (action === 'REJECT') setError('Từ chối khiếu nại phải nhập lý do');
      return;
    }
    let symbol: string | undefined;
    if (action === 'FIX') {
      const s = window.prompt('Ký hiệu công mới cho ô ngày (VD: 1.00, 0.50, R, AL):', '1.00');
      if (!s || !s.trim()) { setError('Sửa ô phải nhập ký hiệu công mới'); return; }
      symbol = s.trim();
    }
    setError(null);
    const res = await fetch(`/api/v1/disputes/${id}/resolve`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...headers() },
      body: JSON.stringify({ action, reason, symbol }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setError(json?.message || 'Xử lý khiếu nại thất bại'); load(); return; }
    load();
  };

  const visible = items.filter(d => filter === 'ALL' || d.status === filter);

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="bg-canvas border border-line rounded-xl p-6">
        <h1 className="text-xl font-bold text-ink mt-1">Danh sách khiếu nại bảng công</h1>
        <p className="text-xs text-ink-muted mt-1">Hạn gần nhất lên đầu. Xử lý nhanh ngay trên bảng; click vào dòng để xem chi tiết 3 cột.</p>
      </div>
      {error && <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">{error}</div>}
      <div className="flex flex-wrap items-center gap-1.5">
        {([['PENDING', 'Cần xử lý'], ['RESOLVED', 'Đã xử lý'], ['REJECTED', 'Bị từ chối'], ['EXPIRED', 'Quá hạn'], ['ALL', 'Tất cả']] as const).map(([k, label]) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`text-xs px-3 py-1.5 rounded-full border ${filter === k ? 'bg-accent text-white border-accent' : 'bg-surface border-line text-ink-secondary'}`}>
            {label} ({k === 'ALL' ? items.length : items.filter(d => d.status === k).length})
          </button>
        ))}
      </div>
      <div className="bg-surface border border-line rounded-xl p-4">
        {visible.length === 0 && <div className="text-xs text-ink-muted py-4 text-center">Không có khiếu nại nào trong nhóm này.</div>}
        {visible.map(d => (
          <div key={d.id} className="flex items-center justify-between border border-line rounded-lg px-3 py-2 mb-2 text-sm">
            <div>
              <Link to={`/attendance/disputes/${d.id}`} className="font-semibold hover:underline">{d.employee} · {d.date}</Link>
              <div className="text-xs text-ink-muted">{d.reason}</div>
              {d.status === 'PENDING' && d.daysLeft !== undefined && d.daysLeft >= 0 && (
                <div className="text-[11px] text-amber-700">⏳ Còn {d.daysLeft} ngày (hạn {d.deadline})</div>
              )}
              {d.status === 'EXPIRED' && <div className="text-[11px] text-slate-600">⏰ Quá hạn 2 ngày — tự đóng</div>}
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`text-[11px] px-2 py-0.5 rounded border ${STATUS_LABEL[d.status]?.cls || ''}`}>
                {STATUS_LABEL[d.status]?.text || d.status}
              </span>
              {d.status === 'PENDING' && (
                <>
                  <button className="text-xs px-2 py-1 rounded bg-emerald-600 text-white" onClick={() => resolve(d.id, 'FIX')}>Sửa ô</button>
                  <button className="text-xs px-2 py-1 rounded border border-line" onClick={() => resolve(d.id, 'MAKEUP')}>Bổ sung công</button>
                  <button className="text-xs px-2 py-1 rounded bg-rose-600 text-white" onClick={() => resolve(d.id, 'REJECT')}>Từ chối</button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
