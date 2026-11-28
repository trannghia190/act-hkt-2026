import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, CalendarClock, Fingerprint, Lightbulb, MessageSquareText, Paperclip, Table2,
} from 'lucide-react';
import { Badge } from '../../../components/common/Badge';
import { Modal } from '../../../components/common/Modal';
import { Panel } from '../../../components/common/Panel';

const fmt = (iso?: string) => {
  if (!iso) return '—';
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return d ? `${d}/${m}/${y}` : iso;
};

const fmtKB = (b?: number) => `${Math.max(1, Math.round((b || 0) / 1024))} KB`;

const statusText: Record<string, string> = {
  PENDING: 'Chờ xử lý', RESOLVED: 'Đã xử lý', REJECTED: 'Đã từ chối', EXPIRED: 'Quá hạn — tự đóng',
};
const statusVariant = (s?: string): 'warn' | 'ok' | 'danger' | 'gray' =>
  s === 'RESOLVED' ? 'ok' : s === 'REJECTED' ? 'danger' : s === 'EXPIRED' ? 'gray' : 'warn';

const reqLabel: Record<string, string> = {
  LEAVE: 'Nghỉ phép', WFH: 'WFH', LATE_EARLY: 'Đi muộn/về sớm', ADJUST: 'Bổ sung chấm công',
};
const reqStatus: Record<string, string> = {
  APPROVED: 'đã duyệt', PENDING_APPROVAL: 'chờ duyệt', REJECTED: 'bị từ chối', WITHDRAWN: 'đã hủy', DRAFT: 'nháp',
};

const labelCls = 'block text-[11px] font-semibold text-ink mb-1.5';
const fieldCls = 'w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink';

export const DisputeDetailPage: React.FC = () => {
  const { id } = useParams();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [leaveTypes, setLeaveTypes] = useState<Record<string, string>>({});
  const [leaveNeedsDoc, setLeaveNeedsDoc] = useState<Record<string, boolean>>({});
  // Form duyệt sửa giờ — prefill từ giờ nhân viên đề xuất (hoặc log gốc nếu NV không đề xuất).
  const [fixIn, setFixIn] = useState('');
  const [fixOut, setFixOut] = useState('');
  // Chế độ HR chốt cho ngày đó — mặc định theo đúng nhân viên đã xin, HR đổi được trước khi duyệt.
  const [fixKind, setFixKind] = useState<'TIME_FIX' | 'WFH' | 'LEAVE'>('TIME_FIX');
  const [fixLeaveType, setFixLeaveType] = useState('');
  // Nghỉ/WFH nửa ngày: buổi HR chốt — FULL = cả ngày. Ô công tương ứng AL/0.50, R/0.50, AL/R.
  const [fixHalf, setFixHalf] = useState<'FULL' | 'MORNING' | 'AFTERNOON'>('FULL');
  const [fixReason, setFixReason] = useState('Đã đối chiếu 3 nguồn dữ liệu');
  const [busy, setBusy] = useState(false);
  /** Modal cho 2 hành động không sửa ô ngay (bổ sung công / từ chối) — thay window.prompt. */
  const [actModal, setActModal] = useState<'MAKEUP' | 'REJECT' | null>(null);
  const [actReason, setActReason] = useState('');
  const [actError, setActError] = useState<string | null>(null);

  const token = () => { try { return JSON.parse(localStorage.getItem('pulse_auth_user') || '{}')?.accessToken || ''; } catch { return ''; } };
  const headers = () => (token() ? { Authorization: `Bearer ${token()}` } : {});

  const load = () => {
    fetch(`/api/v1/disputes/${id}`, { headers: headers() })
      .then(r => r.json())
      .then(j => { if (j?.data) { setData(j.data); setError(null); } else setError(j?.message || 'Không tải được khiếu nại'); })
      .catch(() => setError('Không tải được khiếu nại'));
  };
  useEffect(load, [id]);
  useEffect(() => {
    if (!data) return;
    setFixIn(data.requestedCheckIn || data.log?.checkIn || '');
    setFixOut(data.requestedCheckOut || data.log?.checkOut || '');
    setFixKind((data.requestedKind as 'TIME_FIX' | 'WFH' | 'LEAVE') || 'TIME_FIX');
    setFixLeaveType(data.requestedLeaveType || '');
    setFixHalf(data.requestedHalfDay === 'MORNING' || data.requestedHalfDay === 'AFTERNOON'
      ? data.requestedHalfDay : 'FULL');
  }, [data]);
  useEffect(() => {
    fetch('/api/v1/leave-types', { headers: headers() }).then(r => r.json())
      .then(j => {
        if (Array.isArray(j?.data)) {
          setLeaveTypes(Object.fromEntries(j.data.map((x: any) => [x.code, x.name])));
          setLeaveNeedsDoc(Object.fromEntries(j.data.map((x: any) => [x.code, x.requiresAttachment === true])));
        }
      })
      .catch(() => undefined);
  }, []);

  const post = async (payload: Record<string, unknown>, okMsg: string) => {
    setError(null);
    setBusy(true);
    const res = await fetch(`/api/v1/disputes/${id}/resolve`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...headers() },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(json?.message || 'Xử lý khiếu nại thất bại'); load(); return false; }
    setMsg(okMsg);
    setError(null);
    load();
    return true;
  };

  const applyFix = async () => {
    if (!fixReason.trim()) { setError('Phải nhập lý do xử lý'); return; }
    if (fixKind === 'LEAVE' && !fixLeaveType) { setError('Chọn loại nghỉ cụ thể'); return; }
    // Sửa giờ: bắt buộc đủ cả giờ vào và giờ ra — đây là căn cứ duy nhất để tính công ngày đó.
    if (fixKind === 'TIME_FIX' && (!fixIn || !fixOut)) {
      setError('Nhập đủ cả giờ vào và giờ ra — công ngày đó tính theo cặp giờ này');
      return;
    }
    // "HH:mm" so sánh chuỗi là đủ; backend vẫn kiểm tra lại.
    if (fixKind === 'TIME_FIX' && fixIn && fixOut && fixOut <= fixIn) { setError('Giờ ra phải sau giờ vào'); return; }
    // Loại nghỉ yêu cầu giấy tờ: khiếu nại chưa có giấy tờ thì không duyệt thành nghỉ được.
    if (fixKind === 'LEAVE' && leaveNeedsDoc[fixLeaveType] && !(data?.attachments || []).length) {
      setError(`Loại nghỉ ${leaveTypes[fixLeaveType] || fixLeaveType} bắt buộc có giấy tờ đính kèm — khiếu nại này chưa có giấy tờ nên chưa duyệt được`);
      return;
    }
    const halfLabel = fixHalf === 'MORNING' ? ' buổi sáng' : fixHalf === 'AFTERNOON' ? ' buổi chiều' : '';
    await post({
      action: 'FIX',
      reason: fixReason.trim(),
      requestedKind: fixKind,
      ...(fixKind === 'LEAVE' ? { requestedLeaveType: fixLeaveType } : {}),
      ...(fixKind === 'TIME_FIX' ? { requestedCheckIn: fixIn, requestedCheckOut: fixOut }
        : fixHalf === 'FULL' ? {} : { requestedHalfDay: fixHalf }),
    }, fixKind === 'TIME_FIX'
      ? 'Đã duyệt — giờ được ghi vào bảng công, ngày hôm đó đã tính lại công'
      : fixKind === 'WFH'
        ? `Đã duyệt — ${halfLabel ? 'WFH' + halfLabel + ', ô công còn lại vẫn là công đi làm' : 'ngày này được công nhận làm việc từ xa'}`
        : `Đã duyệt — ${halfLabel ? 'nghỉ' + halfLabel + ', quỹ phép trừ 0.5 ngày' : 'ngày này thành ngày nghỉ, quỹ phép đã trừ'}`);
  };

  const openAct = (kind: 'MAKEUP' | 'REJECT') => {
    setActModal(kind);
    setActReason(kind === 'REJECT' ? '' : 'Đã đối chiếu 3 nguồn dữ liệu');
    setActError(null);
  };

  const confirmAct = async () => {
    if (!actModal) return;
    if (!actReason.trim()) { setActError('Phải nhập lý do xử lý'); return; }
    const ok = await post({ action: actModal, reason: actReason.trim() },
      actModal === 'REJECT'
        ? 'Đã từ chối — nhân viên đã nhận thông báo'
        : 'Đã xử lý khiếu nại — nhân viên đã nhận thông báo');
    if (ok) { setActModal(null); setActReason(''); setActError(null); }
  };

  const pending = data?.status === 'PENDING';
  const employee = data?.employee || '—';
  const employeeCode = data?.employeeCode || '';
  const related: any[] = data?.relatedRequests || [];
  const attachments: any[] = data?.attachments || [];
  const daysLeft = typeof data?.daysLeft === 'number' ? data.daysLeft : null;
  const overdue = daysLeft !== null && daysLeft < 0;
  const hasDoc = attachments.length > 0;

  const kindLabel = data?.requestedKind === 'WFH'
    ? 'Công nhận WFH'
    : data?.requestedKind === 'LEAVE'
      ? `Chuyển nghỉ · ${data?.requestedLeaveTypeName || data?.requestedLeaveType || '—'}`
      : 'Sửa giờ vào/ra';

  const openAttachment = async (a: any) => {
    // Tải kèm token qua fetch rồi mở blob — thẻ <a> thuần không gửi header Authorization.
    const res = await fetch(a.downloadUrl, { headers: headers() });
    if (!res.ok) { setError('Không tải được giấy tờ đính kèm'); return; }
    const blob = await res.blob();
    window.open(URL.createObjectURL(blob), '_blank');
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-24">
      {/* Đầu trang */}
      <div className="min-w-0">
        <Link
          to="/attendance/disputes"
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-ink-muted hover:text-accent-dark"
        >
          <ArrowLeft className="h-3 w-3" />
          Khiếu nại bảng công
        </Link>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <h1 className="font-display text-xl font-extrabold tracking-tight text-ink sm:text-[23px]">
            {pending ? 'Xử lý khiếu nại' : 'Chi tiết khiếu nại'}
          </h1>
          <span className="rounded-md bg-surface-secondary px-1.5 py-[2px] font-mono text-[10.5px] font-semibold text-ink-muted">
            {id}
          </span>
          {data?.status && <Badge variant={statusVariant(data.status)}>{statusText[data.status] || data.status}</Badge>}
        </div>
        <p className="mt-1 text-xs text-ink-muted">
          {employee}{employeeCode ? ` · ${employeeCode}` : ''} · ngày công {fmt(data?.workDate || data?.log?.date)}
          {data?.deadline ? ` · hạn xử lý ${fmt(data.deadline)}` : ''}
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-status-danger-line bg-status-danger-soft p-3 text-sm text-status-danger">
          {error}
        </div>
      )}
      {msg && (
        <div className="rounded-xl border border-status-ok-line bg-status-ok-soft p-3 text-sm text-status-ok">
          {msg}
        </div>
      )}

      {/* Bìa đối chiếu */}
      <div className="overflow-hidden rounded-[16px] border border-line bg-ink px-5 py-4 text-canvas">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-canvas/60">
              {pending ? 'Hàng chờ xử lý' : 'Đã đóng'}
            </div>
            <div className="mt-1 font-display text-lg font-extrabold">Đối chiếu 3 nguồn trước khi sửa</div>
            <p className="mt-1 max-w-lg text-xs leading-relaxed text-canvas/75">
              Log chấm công gốc (không sửa) · điều nhân viên xin trong khiếu nại · ô bảng công HR đang giữ.
              {data?.ruleHint ? ` ${data.ruleHint}.` : ''}
            </p>
          </div>
          <dl className="ml-auto flex gap-7">
            <div>
              <dd className={`font-display text-2xl font-extrabold tabular-nums ${overdue ? 'text-status-danger' : pending ? 'text-status-warn' : ''}`}>
                {daysLeft === null ? '—' : overdue ? 'Quá hạn' : `${daysLeft}n`}
              </dd>
              <dt className="text-[11px] text-canvas/60">{overdue ? 'hạn đã qua' : 'ngày còn lại'}</dt>
            </div>
            <div>
              <dd className="font-display text-2xl font-extrabold tabular-nums">{related.length}</dd>
              <dt className="text-[11px] text-canvas/60">đơn liên quan</dt>
            </div>
            <div>
              <dd className="font-display text-2xl font-extrabold tabular-nums">{attachments.length}</dd>
              <dt className="text-[11px] text-canvas/60">giấy tờ</dt>
            </div>
          </dl>
        </div>
      </div>

      {/* 3 nguồn đối chiếu */}
      <div className="grid gap-2.5 md:grid-cols-3">
        <section className="rounded-[13px] border border-line bg-surface p-3.5">
          <div className="flex items-center gap-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-ink-muted">
            <Fingerprint className="h-3.5 w-3.5" />
            1 · Log gốc
          </div>
          <div className="mt-0.5 text-[10px] text-ink-muted">Không sửa được</div>
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-canvas px-2 py-1.5">
              <div className="font-mono text-[14px] font-bold text-ink">{data?.log?.checkIn || '—'}</div>
              <div className="text-[9px] text-ink-muted">vào</div>
            </div>
            <div className="rounded-lg bg-canvas px-2 py-1.5">
              <div className="font-mono text-[14px] font-bold text-ink">{data?.log?.checkOut || '—'}</div>
              <div className="text-[9px] text-ink-muted">ra</div>
            </div>
          </div>
          <div className="mt-2 text-[11px] text-ink-muted">
            Ngày {fmt(data?.log?.date || data?.workDate)} · trạng thái{' '}
            <span className="font-semibold text-ink-secondary">{data?.log?.status || 'không có bản ghi'}</span>
          </div>
        </section>

        <section className="rounded-[13px] border border-line bg-surface p-3.5">
          <div className="flex items-center gap-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-ink-muted">
            <MessageSquareText className="h-3.5 w-3.5" />
            2 · NV khiếu nại
          </div>
          <div className="mt-0.5 text-[10px] text-ink-muted">{kindLabel}</div>
          <p className="mt-2 text-[12px] leading-relaxed text-ink">{data?.reason || '—'}</p>
          {data?.requestedKind === 'WFH' && (
            <div className="mt-2 rounded-lg border border-status-ok-line bg-status-ok-soft px-2 py-1 text-[10.5px] font-semibold text-status-ok">
              Xin công nhận WFH
              {data?.requestedHalfDay ? (data.requestedHalfDay === 'MORNING' ? ' · nửa ngày sáng' : ' · nửa ngày chiều') : ''}
            </div>
          )}
          {data?.requestedKind === 'LEAVE' && (
            <div className="mt-2 rounded-lg border border-status-ok-line bg-status-ok-soft px-2 py-1 text-[10.5px] font-semibold text-status-ok">
              Xin chuyển nghỉ · {data?.requestedLeaveTypeName || data?.requestedLeaveType || '—'}
              {data?.requestedHalfDay ? (data.requestedHalfDay === 'MORNING' ? ' (nửa ngày sáng)' : ' (nửa ngày chiều)') : ''}
            </div>
          )}
          {(!data?.requestedKind || data?.requestedKind === 'TIME_FIX') && (data?.requestedCheckIn || data?.requestedCheckOut) && (
            <div className="mt-2 rounded-lg border border-status-ok-line bg-status-ok-soft px-2 py-1 font-mono text-[10.5px] font-semibold text-status-ok">
              Xin giờ {data?.requestedCheckIn || '—'} → {data?.requestedCheckOut || '—'}
            </div>
          )}
          {related.length > 0 ? (
            <div className="mt-2 space-y-1">
              {related.map((r: any) => (
                <div key={r.id} className="rounded-md border border-line bg-canvas px-2 py-1 text-[10.5px] text-ink-secondary">
                  <b className="text-ink">{reqLabel[r.type] || r.type}</b>
                  {r.leaveType ? ` (${leaveTypes[r.leaveType] || r.leaveType})` : ''} — {reqStatus[r.status] || r.status}
                  {r.reason ? <span className="text-ink-muted"> · {r.reason}</span> : ''}
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-2 text-[10.5px] text-ink-muted">Chưa có đơn từ nào cho ngày này.</div>
          )}
          {hasDoc ? (
            <div className="mt-2 space-y-1">
              {attachments.map((a: any) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => openAttachment(a)}
                  className="flex w-full items-center gap-1.5 rounded-md border border-line bg-canvas px-2 py-1 text-left text-[10.5px] font-semibold text-accent-dark hover:border-line-hover"
                >
                  <Paperclip className="h-3 w-3 shrink-0" />
                  <span className="truncate">{a.fileName}</span>
                  <span className="ml-auto shrink-0 font-mono text-[9.5px] font-normal text-ink-muted">{fmtKB(a.sizeBytes)}</span>
                </button>
              ))}
            </div>
          ) : (
            data?.requestedKind === 'LEAVE' && leaveNeedsDoc[data?.requestedLeaveType] && (
              <div className="mt-2 rounded-lg border border-status-danger-line bg-status-danger-soft px-2 py-1 text-[10.5px] text-status-danger">
                Loại nghỉ này bắt buộc có giấy tờ — khiếu nại chưa có, chưa duyệt thành nghỉ được.
              </div>
            )
          )}
        </section>

        <section className="rounded-[13px] border border-line bg-surface p-3.5">
          <div className="flex items-center gap-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-ink-muted">
            <Table2 className="h-3.5 w-3.5" />
            3 · Ô bảng công
          </div>
          <div className="mt-0.5 text-[10px] text-ink-muted">HR đang giữ · ngày {fmt(data?.workDate)}</div>
          <div className="mt-2.5 grid h-[47px] place-items-center rounded-lg bg-canvas">
            <span className={`font-display text-lg font-extrabold ${data?.currentCell ? 'text-ink' : 'text-ink-muted'}`}>
              {data?.currentCell || '(trống)'}
            </span>
          </div>
          <div className="mt-2 text-[11px] leading-relaxed text-ink-muted">
            Duyệt xong ô này, số công và (nếu là nghỉ) quỹ phép được cập nhật ngay.
          </div>
          {pending && overdue && (
            <div className="mt-2 inline-flex items-center gap-1 rounded-md bg-status-warn-soft px-2 py-1 text-[10.5px] font-semibold text-status-warn">
              <CalendarClock className="h-3 w-3" />
              Quá hạn — hệ thống tự đóng
            </div>
          )}
        </section>
      </div>

      {data?.ruleHint && (
        <div className="flex items-start gap-2 rounded-[13px] border border-status-warn-line bg-status-warn-soft p-3 text-[11.5px] leading-relaxed text-status-warn">
          <Lightbulb className="mt-px h-3.5 w-3.5 shrink-0" />
          <span><b>Gợi ý theo rule:</b> {data.ruleHint}</span>
        </div>
      )}

      {pending ? (
        <Panel
          title="Xử lý khiếu nại"
          subtitle="Chế độ nhân viên xin đã chọn sẵn — HR đổi được trước khi duyệt"
          action={<Badge variant="warn">chờ xử lý</Badge>}
          bodyClassName="space-y-3"
        >
          <label className="block">
            <span className={labelCls}>Ghi nhận ngày này là</span>
            <select
              value={fixKind === 'LEAVE' && fixLeaveType ? `LEAVE:${fixLeaveType}` : fixKind}
              onChange={(e) => {
                const v = e.target.value;
                if (v.startsWith('LEAVE:')) { setFixKind('LEAVE'); setFixLeaveType(v.slice('LEAVE:'.length)); }
                else { setFixKind(v as 'TIME_FIX' | 'WFH'); setFixLeaveType(''); }
              }}
              className={fieldCls}
            >
              <option value="TIME_FIX">Sửa giờ vào/ra</option>
              <option value="WFH">Công nhận làm việc từ xa (WFH)</option>
              {Object.keys(leaveTypes).length > 0 && (
                <optgroup label="Chuyển thành nghỉ">
                  {Object.entries(leaveTypes).map(([code, name]) => (
                    <option key={code} value={`LEAVE:${code}`}>{name}</option>
                  ))}
                </optgroup>
              )}
            </select>
          </label>

          {fixKind === 'TIME_FIX' ? (
            <>
              <div className="grid gap-2.5 sm:grid-cols-2">
                <label className="block">
                  <span className={labelCls}>Giờ vào <span className="text-status-danger">*</span></span>
                  <input type="time" required value={fixIn} onChange={(e) => setFixIn(e.target.value)}
                    className={`${fieldCls} font-mono`} />
                </label>
                <label className="block">
                  <span className={labelCls}>Giờ ra <span className="text-status-danger">*</span></span>
                  <input type="time" required value={fixOut} onChange={(e) => setFixOut(e.target.value)}
                    className={`${fieldCls} font-mono`} />
                </label>
              </div>
              <p className="text-[11px] leading-relaxed text-ink-muted">
                Bắt buộc đủ cả hai. Số công ngày đó tự tính theo số giờ ca yêu cầu (đủ ca = 1.00, đủ nửa ca = 0.50),
                không nhập tay ký hiệu — muốn thành nghỉ/WFH thì chọn đúng chế độ ở trên.
              </p>
            </>
          ) : (
            <>
              <label className="block">
                <span className={labelCls}>Thời lượng</span>
                <select value={fixHalf} onChange={(e) => setFixHalf(e.target.value as typeof fixHalf)}
                  className={fieldCls}>
                  <option value="FULL">Cả ngày</option>
                  <option value="MORNING">Nửa ngày — buổi sáng</option>
                  <option value="AFTERNOON">Nửa ngày — buổi chiều</option>
                </select>
              </label>
              <p className="text-[11px] leading-relaxed text-ink-muted">
                {fixKind === 'WFH'
                  ? (fixHalf === 'FULL'
                    ? 'Duyệt sẽ tạo đơn WFH đã duyệt cho ngày này — không cần giờ vào/ra.'
                    : `Duyệt sẽ tạo đơn WFH ${fixHalf === 'MORNING' ? 'buổi sáng' : 'buổi chiều'} — ô công hiện R/0.50, buổi còn lại vẫn tính công đi làm.`)
                  : (fixHalf === 'FULL'
                    ? `Duyệt sẽ tạo đơn nghỉ "${leaveTypes[fixLeaveType] || fixLeaveType}" đã duyệt và trừ 1 ngày quỹ phép.`
                    : `Duyệt sẽ tạo đơn nghỉ "${leaveTypes[fixLeaveType] || fixLeaveType}" ${fixHalf === 'MORNING' ? 'buổi sáng' : 'buổi chiều'} — ô công hiện ${(fixLeaveType || 'AL')}/0.50, quỹ phép trừ 0.5 ngày.`)}
                {fixKind === 'LEAVE' && leaveNeedsDoc[fixLeaveType] && (
                  <span className="mt-1 block text-status-danger">
                    Loại nghỉ này bắt buộc có giấy tờ đính kèm
                    {hasDoc ? ' — đã có giấy tờ nhân viên gửi kèm.' : ' — khiếu nại này chưa có giấy tờ, chưa duyệt được.'}
                  </span>
                )}
              </p>
            </>
          )}

          <label className="block">
            <span className={labelCls}>Lý do xử lý <span className="text-status-danger">*</span></span>
            <input value={fixReason} onChange={(e) => setFixReason(e.target.value)}
              placeholder="Ghi rõ căn cứ — lưu vào nhật ký kiểm toán"
              className={fieldCls} />
          </label>

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={applyFix}
              disabled={busy}
              className="inline-flex h-[31px] items-center gap-1.5 rounded-lg bg-accent px-3 text-[12px] font-semibold text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-50"
            >
              Duyệt &amp; cập nhật bảng công
            </button>
            <button
              type="button"
              onClick={() => openAct('MAKEUP')}
              title="KHÔNG sửa bảng công ngay: tạo đơn điều chỉnh công (ADJUST) ở trạng thái chờ duyệt — chỉ khi đơn đó được duyệt thì ngày công mới thay đổi."
              className="inline-flex h-[31px] items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-[12px] font-semibold text-ink-secondary transition-colors hover:border-line-hover hover:text-ink"
            >
              Tạo đơn bổ sung công
            </button>
            <button
              type="button"
              onClick={() => openAct('REJECT')}
              title="Đóng khiếu nại, không đổi bảng công. Bắt buộc nhập lý do; nhân viên nhận thông báo."
              className="inline-flex h-[31px] items-center gap-1.5 rounded-lg border border-status-danger-line bg-surface px-3 text-[12px] font-semibold text-status-danger transition-colors hover:bg-status-danger-soft"
            >
              Từ chối
            </button>
          </div>
        </Panel>
      ) : (
        <Panel title="Kết quả xử lý" bodyClassName="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={statusVariant(data?.status)}>{statusText[data?.status] || data?.status}</Badge>
            {data?.deadline && <span className="text-[11px] text-ink-muted">Hạn xử lý {fmt(data.deadline)}</span>}
          </div>
          <p className="text-[11.5px] leading-relaxed text-ink-muted">
            Khiếu nại đã {data?.status === 'REJECTED' ? 'bị từ chối' : data?.status === 'EXPIRED' ? 'quá hạn (tự đóng)' : 'được xử lý'} —
            mọi thao tác đã ghi audit log và thông báo cho nhân viên.
          </p>
        </Panel>
      )}

      <Link to="/attendance/disputes" className="inline-flex items-center gap-1 text-[11px] font-semibold text-ink-muted hover:text-accent-dark">
        <ArrowLeft className="h-3 w-3" />
        Quay lại danh sách khiếu nại
      </Link>

      {/* Modal bổ sung công / từ chối — lý do bắt buộc để lưu vết */}
      <Modal
        isOpen={!!actModal}
        onClose={() => { setActModal(null); setActReason(''); setActError(null); }}
        title={actModal === 'REJECT' ? 'Từ chối khiếu nại' : 'Tạo đơn bổ sung công (chờ duyệt)'}
        maxWidth="lg"
      >
        <div className="space-y-3">
          <div className="rounded-lg border border-line bg-canvas px-3 py-2.5 text-xs text-ink-secondary">
            <div className="font-semibold text-ink">{employee}{employeeCode ? ` · ${employeeCode}` : ''}</div>
            <div className="mt-0.5 text-[11px] text-ink-muted">
              Ngày công {fmt(data?.workDate)} · {kindLabel}
            </div>
          </div>
          {actModal === 'REJECT' ? (
            <p className="text-[11.5px] leading-relaxed text-ink-secondary">
              Đóng khiếu nại, <b>không</b> đổi bảng công. Nhân viên nhận thông báo kèm lý do này.
            </p>
          ) : (
            <p className="text-[11.5px] leading-relaxed text-ink-secondary">
              Tạo đơn <b>chờ duyệt</b> đúng điều nhân viên xin — chỉ khi đơn được duyệt thì ngày công mới thay đổi.
            </p>
          )}
          <div className="flex flex-wrap gap-1.5">
            {(actModal === 'REJECT'
              ? ['Không có căn cứ', 'Không có đơn nghỉ trước ngày công', 'Giờ đề xuất không khớp log']
              : ['Đã đối chiếu 3 nguồn dữ liệu', 'Đối chiếu camera tại cửa']
            ).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => { setActReason(r); setActError(null); }}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  actReason === r
                    ? 'border-accent bg-accent-soft text-accent-dark'
                    : 'border-line bg-surface text-ink-secondary hover:border-line-hover'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <div>
            <div className="mb-1.5 text-[11px] font-semibold text-ink">Lý do *</div>
            <textarea
              rows={3}
              className="w-full rounded-lg border border-line bg-surface p-2.5 text-sm text-ink"
              placeholder="Ghi rõ lý do — lưu vào nhật ký kiểm toán"
              value={actReason}
              onChange={(e) => { setActReason(e.target.value); setActError(null); }}
            />
            {actError && <div className="mt-1 text-[11px] text-status-danger">{actError}</div>}
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => { setActModal(null); setActReason(''); setActError(null); }}
              className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-secondary"
            >
              Huỷ
            </button>
            <button
              type="button"
              disabled={!actReason.trim() || busy}
              onClick={confirmAct}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 ${
                actModal === 'REJECT' ? 'bg-status-danger' : 'bg-accent'
              }`}
            >
              {actModal === 'REJECT' ? 'Từ chối khiếu nại' : 'Tạo đơn chờ duyệt'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
