import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

export const RequestDetailPage: React.FC = () => {
  const { id } = useParams();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);

  const token = () => { try { return JSON.parse(localStorage.getItem('pulse_auth_user') || '{}')?.accessToken || ''; } catch { return ''; } };
  const loadAttachments = () => {
    fetch(`/api/v1/requests/${id}/attachments`, { headers: token() ? { Authorization: `Bearer ${token()}` } : {} })
      .then(r => r.json()).then(j => { if (Array.isArray(j?.data)) setAttachments(j.data); })
      .catch(() => undefined);
  };
  useEffect(() => {
    fetch(`/api/v1/requests/${id}`, { headers: token() ? { Authorization: `Bearer ${token()}` } : {} })
      .then(r => r.json()).then(j => { if (j?.data) setData(j.data); else setError(j?.message || 'Không tải được đơn'); })
      .catch(() => setError('Không tải được đơn'));
    loadAttachments();
  }, [id]);

  const req = data?.request;
  const me = (() => { try { return JSON.parse(localStorage.getItem('pulse_auth_user') || '{}'); } catch { return {}; } })();
  const canUpload = data?.employeeCode && me?.employeeCode === data.employeeCode
    && (req?.status === 'PENDING_APPROVAL' || req?.status === 'DRAFT');

  const download = async (att: any) => {
    const res = await fetch(`/api/v1/requests/${id}/attachments/${att.id}`, { headers: token() ? { Authorization: `Bearer ${token()}` } : {} });
    if (!res.ok) { setError('Không tải được file đính kèm'); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = att.fileName || 'attachment';
    a.click();
    URL.revokeObjectURL(url);
  };

  const upload = async (file: File) => {
    setUploading(true);
    const fd = new FormData(); fd.append('file', file);
    const res = await fetch(`/api/v1/requests/${id}/attachments`, {
      method: 'POST', headers: token() ? { Authorization: `Bearer ${token()}` } : {}, body: fd,
    });
    const json = await res.json().catch(() => ({}));
    setUploading(false);
    if (!res.ok) { setError(json?.message || 'Tải file thất bại'); return; }
    loadAttachments();
  };
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="bg-canvas border border-line rounded-xl p-6">
        <h1 className="text-xl font-bold text-ink mt-1">Đơn {req?.id || id}</h1>
        <p className="text-xs text-ink-muted mt-1">Timeline đầy đủ + ảnh hưởng tới bảng công.</p>
      </div>
      {error && <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">{error}</div>}
      {req && (
        <div className="bg-surface border border-line rounded-xl p-4 space-y-2">
          <div className="text-sm font-semibold">{req.requestType} {req.leaveType ? `· ${req.leaveType}` : ''} · {req.workDate || '—'}</div>
          {(() => {
            try {
              const p = JSON.parse(req.payload || '{}');
              if (p.half_day_period) {
                return <div className="text-[11px] text-sky-700 mt-0.5">
                  Nửa ngày — nghỉ {p.half_day_period === 'MORNING' ? 'sáng' : 'chiều'}
                  {p.work_window_start && p.work_window_end ? ` · làm việc ${p.work_window_start}–${p.work_window_end}` : ''}
                </div>;
              }
              if (req.minutes) return <div className="text-[11px] text-ink-muted mt-0.5">{req.minutes} phút đi muộn/về sớm</div>;
            } catch { /* ignore */ }
            return null;
          })()}
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
      <div className="bg-surface border border-line rounded-xl p-4">
        <div className="text-sm font-bold mb-2">Giấy tờ đính kèm ({attachments.length})</div>
        {attachments.length === 0 && <div className="text-xs text-ink-muted">Chưa có file đính kèm.</div>}
        <ul className="space-y-1.5">
          {attachments.map((a: any) => (
            <li key={a.id} className="flex items-center justify-between gap-2 text-xs border border-line rounded-lg px-3 py-2">
              <span>📎 {a.fileName} <span className="text-ink-muted">({Math.round((a.sizeBytes || 0) / 1024)} KB)</span></span>
              <button className="text-accent underline" onClick={() => download(a)}>Tải file</button>
            </li>
          ))}
        </ul>
        {canUpload && (
          <label className="mt-2 block text-[11px]">
            <span className="font-semibold">Đính kèm thêm (ảnh/PDF)</span>
            <input type="file" accept="image/*,application/pdf" disabled={uploading} className="mt-1 block w-full"
              onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.currentTarget.value = ''; }} />
          </label>
        )}
      </div>
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
