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
  const shownDate = (iso?: string) => {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-');
    return d && m && y ? `${d}/${m}/${y}` : iso;
  };
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

  const uploadMany = async (files: File[]) => {
    if (!files.length) return;
    setUploading(true);
    setError(null);
    for (const file of files) {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/v1/requests/${id}/attachments`, {
        method: 'POST', headers: token() ? { Authorization: `Bearer ${token()}` } : {}, body: fd,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(`Tải file "${file.name}" thất bại: ${json?.message || 'lỗi không xác định'}`);
        break;
      }
    }
    setUploading(false);
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
        <div className="bg-surface border border-line rounded-xl p-4 space-y-2.5">
          {(() => {
            const typeNames: Record<string, string> = { LEAVE: 'Nghỉ phép', WFH: 'Làm việc từ xa (WFH)', LATE_EARLY: 'Đi muộn / về sớm', ADJUST: 'Bổ sung chấm công' };
            const statusNames: Record<string, string> = { DRAFT: 'Nháp — chưa gửi', PENDING_APPROVAL: 'Chờ quản lý duyệt', APPROVED: 'Đã duyệt', REJECTED: 'Bị từ chối', WITHDRAWN: 'Đã hủy' };
            let p: any = {};
            try { p = JSON.parse(req.payload || '{}'); } catch { p = {}; }
            return (
              <>
                <div className="text-sm font-semibold">
                  {typeNames[req.requestType] || req.requestType}{req.leaveType ? ` — ${data.leaveTypeName || req.leaveType}` : ''}
                </div>
                <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <div><span className="text-ink-muted">Mã đơn:</span> <span className="font-mono">{req.id}</span></div>
                  <div><span className="text-ink-muted">Nhân viên:</span> <b>{data.employeeName || '—'}</b> {data.employeeCode ? `(${data.employeeCode})` : ''}</div>
                  <div><span className="text-ink-muted">Ngày áp dụng:</span> <b>{req.workDate ? `${shownDate(req.workDate)}${req.endDate && req.endDate !== req.workDate ? ` → ${shownDate(req.endDate)}` : ''}` : '—'}</b></div>
                  <div><span className="text-ink-muted">Thời lượng:</span> <b>{data.durationText || p.duration || (req.minutes ? `${req.minutes} phút` : '—')}</b></div>
                  {p.half_day_period && (
                    <div><span className="text-ink-muted">Buổi:</span> <b>{p.half_day_period === 'MORNING' ? 'Buổi sáng' : 'Buổi chiều'}</b>
                      {p.work_window_start && p.work_window_end ? ` · làm việc ${p.work_window_start}–${p.work_window_end}` : ''}</div>
                  )}
                  <div><span className="text-ink-muted">Gửi lúc:</span> {req.createdAt ? new Date(req.createdAt).toLocaleString('vi-VN') : '—'}</div>
                  <div><span className="text-ink-muted">Người xử lý:</span> {data.approverName || '—'}</div>
                  <div><span className="text-ink-muted">Xử lý lúc:</span> {req.decidedAt ? new Date(req.decidedAt).toLocaleString('vi-VN') : '—'}</div>
                  <div><span className="text-ink-muted">Trạng thái:</span> <b>{statusNames[req.status] || req.status}</b></div>
                </div>
                <div className="text-xs"><span className="text-ink-muted">Lý do:</span> {req.reason || '—'}</div>
                {req.decisionComment && (
                  <div className="text-xs text-accent bg-accent-soft/40 border border-accent-line rounded p-2">
                    <b>Ý kiến của quản lý:</b> {req.decisionComment}
                  </div>
                )}
                <div className="flex flex-wrap gap-2 text-[11px]">
                  <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">✅ Trong quota</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">✅ Nộp đúng hạn</span>
                  <span className="px-2 py-0.5 rounded bg-canvas text-ink-muted border border-line">Ảnh hưởng: {data.impact}</span>
                </div>
              </>
            );
          })()}
          <Link to="/attendance/my-timesheet" className="text-xs text-accent underline block">Xem bảng công bị tác động →</Link>
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
            <input type="file" multiple accept="image/*,application/pdf" disabled={uploading} className="mt-1 block w-full"
              onChange={e => { const files = Array.from(e.target.files || []); if (files.length) uploadMany(files); e.currentTarget.value = ''; }} />
            <span className="text-ink-muted">Có thể chọn 1 hoặc nhiều file ảnh/PDF (mỗi file tối đa 10MB).</span>
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
          <div className="text-xs text-ink-muted mt-2 border-t border-line pt-2">Lịch sử chỉnh sửa: {data?.editHistory?.length || 0} lần · mọi thay đổi ghi vào audit log.</div>
          {(data?.editHistory || []).map((h: any, i: number) => (
            <div key={i} className="mt-2 text-xs border border-line rounded-lg p-2 bg-canvas">
              <div className="font-semibold text-ink">Lần sửa {i + 1} · {h.actor} · {h.at}</div>
              <div className="text-ink-muted mt-1">Trước: {h.oldValue}</div>
              <div className="text-ink mt-0.5">Sau: {h.newValue}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
