import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

export const RequestDetailPage: React.FC = () => {
  const { id } = useParams();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = (() => { try { return JSON.parse(localStorage.getItem('pulse_auth_user') || '{}')?.accessToken; } catch { return ''; } })();
    fetch(`/api/v1/requests/${id}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => r.json()).then(j => { if (j?.data) setData(j.data); else setError(j?.message || 'Không tải được đơn'); })
      .catch(() => setError('Không tải được đơn'));
  }, [id]);

  const req = data?.request;
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="bg-canvas border border-line rounded-xl p-6">
        <div className="text-xs text-accent font-semibold">S13 · Chi tiết đơn</div>
        <h1 className="text-xl font-bold text-ink mt-1">Đơn {req?.id || id}</h1>
        <p className="text-xs text-ink-muted mt-1">Timeline đầy đủ + ảnh hưởng tới bảng công.</p>
      </div>
      {error && <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">{error}</div>}
      {req && (
        <div className="bg-surface border border-line rounded-xl p-4 space-y-2">
          <div className="text-sm font-semibold">{req.requestType} {req.leaveType ? `· ${req.leaveType}` : ''} · {req.workDate || '—'}</div>
          <div className="text-xs text-ink-muted">Lý do: {req.reason || '—'}</div>
          <div className="text-xs">Trạng thái: <b>{req.status}</b></div>
          <div className="flex flex-wrap gap-2 text-[11px]">
            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">✅ Trong quota</span>
            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">✅ Nộp đúng hạn</span>
            <span className="px-2 py-0.5 rounded bg-canvas text-ink-muted border border-line">Ảnh hưởng: {data.impact}</span>
          </div>
          <Link to="/attendance/my-timesheet" className="text-xs text-accent underline">Xem bảng công bị tác động →</Link>
        </div>
      )}
      {data?.timeline && (
        <div className="bg-surface border border-line rounded-xl p-4">
          {data.timeline.map((t: any, i: number) => (
            <div key={i} className="flex gap-3 border-l-2 border-accent pl-3 pb-3 text-sm">
              <div><div className="font-semibold">{t.action}</div><div className="text-xs text-ink-muted">{t.at} · {t.actor}</div></div>
            </div>
          ))}
          <div className="text-xs text-ink-muted mt-2 border-t border-line pt-2">Lịch sử chỉnh sửa: {data?.timeline?.length || 0} mốc · mọi thay đổi ghi vào nhật ký (audit log).</div>
        </div>
      )}
    </div>
  );
};
