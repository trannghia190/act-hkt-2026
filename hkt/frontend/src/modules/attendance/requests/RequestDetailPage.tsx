import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Badge } from '../../../components/common/Badge';
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Clock,
  FileText,
  Paperclip,
  Upload,
} from 'lucide-react';

const TYPE_NAMES: Record<string, string> = {
  LEAVE: 'Nghỉ phép',
  WFH: 'Làm việc từ xa (WFH)',
  LATE_EARLY: 'Đi muộn / về sớm',
  ADJUST: 'Bổ sung chấm công',
};

const STATUS_META: Record<string, { variant: 'gray' | 'warn' | 'ok' | 'danger'; label: string }> = {
  DRAFT: { variant: 'gray', label: 'Nháp — chưa gửi' },
  PENDING_APPROVAL: { variant: 'warn', label: 'Chờ quản lý duyệt' },
  APPROVED: { variant: 'ok', label: 'Đã duyệt' },
  REJECTED: { variant: 'danger', label: 'Bị từ chối' },
  WITHDRAWN: { variant: 'gray', label: 'Đã hủy' },
};

/** Ký hiệu trạng thái trên timeline: đã xong = xanh, đang chờ = hổ phách. */
const TIMELINE_TONE: Record<string, 'ok' | 'wait'> = {
  'Gửi đơn': 'ok',
  'Đã duyệt': 'ok',
  'Đã gửi duyệt': 'ok',
  'Bị từ chối': 'wait',
  'Đã hủy': 'wait',
};

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
  const shownDateTime = (iso?: string) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return `${d.toLocaleDateString('vi-VN')} ${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
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

  // Dữ liệu đơn đã parse sẵn để dùng cho cả desktop lẫn mobile.
  let payload: any = {};
  try { payload = JSON.parse(req?.payload || '{}'); } catch { payload = {}; }
  const typeName = req ? `${TYPE_NAMES[req.requestType] || req.requestType}${req.leaveType ? ` — ${data.leaveTypeName || req.leaveType}` : ''}` : '—';
  const statusMeta = req ? (STATUS_META[req.status] || { variant: 'gray' as const, label: req.status }) : null;
  const durationText = data?.durationText || payload.duration || (req?.minutes ? `${req.minutes} phút` : '—');
  const timeline: any[] = Array.isArray(data?.timeline) ? data.timeline : [];
  const editHistory: any[] = Array.isArray(data?.editHistory) ? data.editHistory : [];

  // Timeline: nối thêm bước "đang chờ" khi đơn còn chờ duyệt.
  const isPending = req?.status === 'PENDING_APPROVAL';
  const timelineSteps = [
    ...timeline.map(t => ({
      action: t.action,
      meta: `${shownDateTime(t.at)} · ${t.actor}`,
      tone: TIMELINE_TONE[t.action] || 'ok',
    })),
    ...(isPending ? [{
      action: 'Chờ quản lý duyệt',
      meta: 'Đang chờ người duyệt xử lý',
      tone: 'wait' as const,
    }] : []),
  ];

  const infoRows = [
    { k: 'Mã đơn', v: req?.id || id || '—', mono: true, wide: true },
    { k: 'Nhân viên', v: data?.employeeName ? `${data.employeeName}${data.employeeCode ? ` (${data.employeeCode})` : ''}` : '—' },
    {
      k: 'Ngày áp dụng',
      v: req?.workDate
        ? `${shownDate(req.workDate)}${req.endDate && req.endDate !== req.workDate ? ` → ${shownDate(req.endDate)}` : ''}`
        : '—',
    },
    { k: 'Thời lượng', v: durationText },
    { k: 'Người xử lý', v: data?.approverName || 'Chưa có', muted: !data?.approverName },
    { k: 'Xử lý lúc', v: req?.decidedAt ? shownDateTime(req.decidedAt) : '—', muted: !req?.decidedAt },
  ];

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      {/* Back link */}
      <Link to="/attendance/requests" className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-secondary hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" />
        Về danh sách đơn
      </Link>

      {/* Header — mockup `.phead` */}
      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-accent-dark">
            <FileText className="h-3.5 w-3.5" />
            Đơn #{(req?.id || id || '').slice(0, 8).toUpperCase()}
          </div>
          <h1 className="mt-1.5 font-display text-xl font-extrabold tracking-tight text-ink sm:text-[23px]">
            {typeName}
          </h1>
          <p className="mt-1 text-xs text-ink-muted">
            {req?.workDate ? shownDate(req.workDate) : '—'}
            {durationText !== '—' ? ` · ${durationText}` : ''}
            {req?.createdAt ? ` · gửi lúc ${shownDateTime(req.createdAt)}` : ''}
          </p>
        </div>
        {statusMeta && (
          <div className="shrink-0">
            <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-status-danger-line bg-status-danger-soft p-3 text-sm text-status-danger">
          {error}
        </div>
      )}

      {req && (
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* Cột trái — thông tin đơn + đính kèm */}
          <div className="flex flex-col gap-4">
            <div className="overflow-hidden rounded-[13px] border border-line bg-surface shadow-2xs">
              <div className="flex items-center gap-2 border-b border-line px-4 py-3">
                <h2 className="text-[13.5px] font-bold tracking-[-0.01em] text-ink">Thông tin đơn</h2>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-2 gap-3">
                  {infoRows.map(row => (
                    <div key={row.k} className={row.wide ? 'col-span-2' : ''}>
                      <span className="block text-[10.5px] font-semibold uppercase tracking-[0.05em] text-ink-muted">{row.k}</span>
                      <span className={`mt-0.5 block text-[13px] ${row.mono ? 'font-mono text-xs font-medium' : 'font-semibold'} ${row.muted ? 'font-medium text-ink-secondary' : 'text-ink'}`}>
                        {row.v}
                      </span>
                    </div>
                  ))}
                  {payload.half_day_period && (
                    <div className="col-span-2">
                      <span className="block text-[10.5px] font-semibold uppercase tracking-[0.05em] text-ink-muted">Buổi</span>
                      <span className="mt-0.5 block text-[13px] font-semibold text-ink">
                        {payload.half_day_period === 'MORNING' ? 'Buổi sáng' : 'Buổi chiều'}
                        {payload.work_window_start && payload.work_window_end
                          ? ` · làm việc ${payload.work_window_start}–${payload.work_window_end}`
                          : ''}
                      </span>
                    </div>
                  )}
                  <div className="col-span-2">
                    <span className="block text-[10.5px] font-semibold uppercase tracking-[0.05em] text-ink-muted">Lý do</span>
                    <span className="mt-0.5 block text-[13px] font-semibold text-ink">{req.reason || '—'}</span>
                  </div>
                </div>

                {req.decisionComment && (
                  <div className="mt-3 rounded-lg border border-accent-line bg-accent-soft/40 p-2.5 text-xs text-accent-dark">
                    <b>Ý kiến của quản lý:</b> {req.decisionComment}
                  </div>
                )}

                {/* Điều kiện đơn — chip kiểm tra */}
                <div className="mt-3.5 flex flex-wrap items-center gap-1.5 border-t border-line pt-3">
                  <span className="inline-flex h-[26px] items-center gap-1.5 rounded-lg border border-status-ok-line bg-status-ok-soft px-2.5 text-[11px] font-semibold text-status-ok">
                    <Check className="h-3 w-3" />
                    Trong quota
                  </span>
                  <span className="inline-flex h-[26px] items-center gap-1.5 rounded-lg border border-status-ok-line bg-status-ok-soft px-2.5 text-[11px] font-semibold text-status-ok">
                    <Check className="h-3 w-3" />
                    Nộp đúng hạn
                  </span>
                  <span className="inline-flex h-[26px] items-center gap-1.5 rounded-lg border border-line bg-surface-secondary px-2.5 text-[11px] font-semibold text-ink-secondary">
                    <Clock className="h-3 w-3" />
                    Ảnh hưởng: {data.impact || '—'}
                  </span>
                </div>

                {/* Link bảng công bị tác động */}
                {(() => {
                  const viewer = (() => { try { return JSON.parse(localStorage.getItem('pulse_auth_user') || '{}'); } catch { return {}; } })();
                  const own = data?.employeeCode && viewer?.employeeCode === data.employeeCode;
                  const month = req.workDate ? String(req.workDate).slice(0, 7) : '';
                  const href = own
                    ? `/attendance/my-timesheet${month ? `?month=${month}` : ''}`
                    : `/attendance/my-timesheet?month=${month}${data?.employeeCode ? `&employeeCode=${encodeURIComponent(data.employeeCode)}` : ''}`;
                  return (
                    <Link
                      to={href}
                      className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-[10px] border border-line px-2.5 text-xs font-semibold text-ink hover:border-line-hover"
                    >
                      <CalendarDays className="h-3.5 w-3.5" />
                      {own ? 'Xem bảng công bị tác động' : `Xem bảng công của ${data?.employeeName || data?.employeeCode || 'nhân viên'}`}
                    </Link>
                  );
                })()}
              </div>
            </div>

            {/* Giấy tờ đính kèm */}
            <div className="overflow-hidden rounded-[13px] border border-line bg-surface shadow-2xs">
              <div className="flex items-center gap-2 border-b border-line px-4 py-3">
                <h2 className="text-[13.5px] font-bold tracking-[-0.01em] text-ink">Giấy tờ đính kèm</h2>
                <span className="ml-auto font-mono text-[10.5px] text-ink-muted">{attachments.length} tệp</span>
              </div>
              <div className="p-4">
                {attachments.length === 0 ? (
                  <p className="py-4 text-center text-xs text-ink-muted">Chưa có file đính kèm.</p>
                ) : (
                  <ul className="space-y-2">
                    {attachments.map((a: any) => (
                      <li key={a.id} className="flex items-center gap-2.5 rounded-[10px] border border-line bg-surface px-3 py-2">
                        <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[9px] bg-canvas-subtle text-ink-2">
                          <Paperclip className="h-3.5 w-3.5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12.5px] font-semibold text-ink">{a.fileName}</span>
                          <span className="block font-mono text-[10.5px] text-ink-muted">
                            {Math.round((a.sizeBytes || 0) / 1024)} KB
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => download(a)}
                          className="inline-flex h-7 shrink-0 items-center rounded-lg border border-line px-2.5 text-[11.5px] font-semibold text-accent-dark hover:bg-accent-soft"
                        >
                          Tải file
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {canUpload && (
                  <label className="mt-3 block border-t border-line pt-3 text-[11px]">
                    <span className="flex items-center gap-1.5 font-semibold text-ink">
                      <Upload className="h-3.5 w-3.5" />
                      Đính kèm thêm (ảnh/PDF)
                    </span>
                    <input
                      type="file"
                      multiple
                      accept="image/*,application/pdf"
                      disabled={uploading}
                      className="mt-1.5 block w-full text-[11px] text-ink-muted file:mr-2 file:rounded-lg file:border file:border-line file:bg-surface file:px-2.5 file:py-1 file:text-[11px] file:font-semibold file:text-ink"
                      onChange={e => { const files = Array.from(e.target.files || []); if (files.length) uploadMany(files); e.currentTarget.value = ''; }}
                    />
                    <span className="mt-1 block text-[10.5px] text-ink-muted">
                      Có thể chọn 1 hoặc nhiều file ảnh/PDF (mỗi file tối đa 10MB).
                    </span>
                  </label>
                )}
              </div>
            </div>
          </div>

          {/* Cột phải — diễn biến + lịch sử sửa */}
          <div className="overflow-hidden rounded-[13px] border border-line bg-surface shadow-2xs">
            <div className="flex items-center gap-2 border-b border-line px-4 py-3">
              <h2 className="text-[13.5px] font-bold tracking-[-0.01em] text-ink">Diễn biến</h2>
            </div>
            <div className="p-4">
              {timelineSteps.length === 0 ? (
                <p className="py-4 text-center text-xs text-ink-muted">Chưa có diễn biến.</p>
              ) : (
                <div className="flex flex-col">
                  {timelineSteps.map((step, i) => {
                    const last = i === timelineSteps.length - 1;
                    const tone = step.tone === 'ok' ? 'bg-status-ok-soft border-status-ok-line text-status-ok' : 'bg-status-warn-soft border-status-warn-line text-status-warn';
                    return (
                      <div key={i} className="grid grid-cols-[22px_minmax(0,1fr)] gap-3">
                        <div className="flex flex-col items-center">
                          <span className={`grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border ${tone}`}>
                            {step.tone === 'ok'
                              ? <Check className="h-3 w-3" />
                              : <Clock className="h-3 w-3" />}
                          </span>
                          {!last && <span className="w-0.5 flex-1 bg-line" style={{ margin: '3px 0' }} />}
                        </div>
                        <div className={last ? '' : 'pb-4'}>
                          <div className={`text-[13px] font-semibold ${step.tone === 'ok' ? 'text-ink' : 'text-status-warn'}`}>
                            {step.action}
                          </div>
                          <div className="mt-0.5 text-[11px] text-ink-muted">{step.meta}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="mt-3.5 border-t border-line pt-3 text-[11px] text-ink-muted">
                Lịch sử chỉnh sửa: <b className="text-ink">{editHistory.length}</b> lần · mọi thay đổi ghi vào audit log.
              </div>
              {editHistory.map((h: any, i: number) => (
                <div key={i} className="mt-2 rounded-lg border border-line bg-canvas p-2.5 text-xs">
                  <div className="font-semibold text-ink">Lần sửa {i + 1} · {h.actor} · {shownDateTime(h.at)}</div>
                  <div className="mt-1 text-ink-muted">Trước: {h.oldValue}</div>
                  <div className="mt-0.5 text-ink">Sau: {h.newValue}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
