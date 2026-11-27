import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowUpRight, Clock, Paperclip, Search } from 'lucide-react';
import { Badge } from '../../../components/common/Badge';
import { Modal } from '../../../components/common/Modal';
import { Panel } from '../../../components/common/Panel';

interface Dispute {
  id: string; employee: string; date: string; reason: string; status: string; deadline?: string; daysLeft?: number;
  employeeCode?: string; workDate?: string;
  requestedKind?: string; requestedLeaveType?: string; requestedLeaveTypeName?: string;
  requestedHalfDay?: string;
  requestedCheckIn?: string; requestedCheckOut?: string; attachmentCount?: number;
}

type Action = 'FIX' | 'MAKEUP' | 'REJECT';
type Filter = 'PENDING' | 'RESOLVED' | 'REJECTED' | 'EXPIRED' | 'ALL';

// Chế độ nhân viên xin cho ngày đó — quyết định nhãn + tooltip của nút duyệt.
const kindOf = (d: Dispute) => d.requestedKind || 'TIME_FIX';
const fixLabel = (d: Dispute) => kindOf(d) === 'WFH' ? 'Duyệt WFH' : kindOf(d) === 'LEAVE' ? 'Duyệt nghỉ' : 'Duyệt & sửa ô';
const fixTitle = (d: Dispute) => kindOf(d) === 'WFH'
  ? 'Có hiệu lực NGAY: công nhận ngày này là làm việc từ xa — tạo đơn WFH đã duyệt, bảng công hiện ô R. Không cần ký hiệu công.'
  : kindOf(d) === 'LEAVE'
    ? 'Có hiệu lực NGAY: chuyển ngày này thành ngày nghỉ theo loại nhân viên xin — tạo đơn nghỉ đã duyệt và trừ 1 ngày quỹ phép.'
    : 'Có hiệu lực NGAY: ghi giờ vào/ra đã chốt vào log chấm công — công ngày đó tự tính lại theo số giờ của ca. Bắt buộc đủ cả giờ vào và giờ ra.';
const MAKEUP_TITLE = 'KHÔNG sửa bảng công ngay: tạo đơn điều chỉnh công (ADJUST) ở trạng thái chờ duyệt — chỉ khi đơn đó được duyệt thì ngày công mới thay đổi.';
const REJECT_TITLE = 'Đóng khiếu nại (không đổi bảng công). Bắt buộc nhập lý do; nhân viên nhận thông báo.';

const STATUS_META: Record<string, { text: string; variant: 'ok' | 'warn' | 'danger' | 'gray' }> = {
  PENDING: { text: 'Đang mở', variant: 'warn' },
  RESOLVED: { text: 'Đã xử lý', variant: 'ok' },
  REJECTED: { text: 'Đã từ chối', variant: 'danger' },
  EXPIRED: { text: 'Quá hạn', variant: 'gray' },
};

const KIND_META: Record<string, { text: string; variant: 'ok' | 'warn' | 'accent' }> = {
  TIME_FIX: { text: 'Sửa giờ', variant: 'accent' },
  WFH: { text: 'WFH', variant: 'ok' },
  LEAVE: { text: 'Nghỉ phép', variant: 'warn' },
};

const fmtDate = (iso?: string) => { if (!iso) return '—'; const [y, m, d] = iso.slice(0, 10).split('-'); return d ? `${d}/${m}/${y}` : iso; };

const initials = (name: string) => {
  const parts = name.trim().split(/\s+/);
  return (parts.length >= 2 ? parts[parts.length - 2][0] + parts[parts.length - 1][0] : name.slice(0, 2)).toUpperCase();
};

const defaultReason = (d: Dispute) => kindOf(d) === 'LEAVE'
  ? 'Có đơn nghỉ trước đó — xác nhận cho nhân viên'
  : kindOf(d) === 'WFH'
    ? 'Đã xác nhận nhân viên làm việc từ xa ngày này'
    : 'Đã đối chiếu log chấm công và sửa ô';

/** Dòng mô tả đúng thứ nhân viên đã xin — để HR duyệt đúng ý, không đoán. */
const requestedLine = (d: Dispute) => {
  const k = kindOf(d);
  if (k === 'WFH') return { text: 'NV xin: công nhận làm việc từ xa (WFH)', tone: 'ok' as const };
  if (k === 'LEAVE') return { text: `NV xin nghỉ${d.requestedLeaveTypeName ? `: ${d.requestedLeaveTypeName}` : ''}`, tone: 'warn' as const };
  if (d.requestedCheckIn && d.requestedCheckOut) return { text: `NV xin giờ: ${d.requestedCheckIn} → ${d.requestedCheckOut}`, tone: 'accent' as const };
  if (d.requestedCheckIn || d.requestedCheckOut) return { text: `NV xin giờ: ${d.requestedCheckIn || '…'} → ${d.requestedCheckOut || '…'}`, tone: 'accent' as const };
  return { text: 'NV chưa đề xuất giờ vào/ra', tone: 'warn' as const };
};

type ModalState =
  | { kind: 'one'; d: Dispute; action: Action }
  | { kind: 'bulk-reject' }
  | { kind: 'bulk-fix' };

export const DisputesPage: React.FC = () => {
  const [items, setItems] = useState<Dispute[]>([]);
  const [filter, setFilter] = useState<Filter>('PENDING');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  // Hộp thoại xử lý — thay cho window.prompt để thấy đủ ngữ cảnh & validate ngay tại chỗ.
  const [modal, setModal] = useState<ModalState | null>(null);
  const [mAction, setMAction] = useState<Action>('FIX');
  const [mReason, setMReason] = useState('');
  const [mIn, setMIn] = useState('');
  const [mOut, setMOut] = useState('');
  const [mError, setMError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const token = () => { try { return JSON.parse(localStorage.getItem('pulse_auth_user') || '{}')?.accessToken || ''; } catch { return ''; } };
  const headers = () => (token() ? { Authorization: `Bearer ${token()}` } : {});
  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3000); };

  const load = () => {
    fetch('/api/v1/disputes', { headers: headers() })
      .then(r => r.json())
      .then(j => {
        if (Array.isArray(j?.data)) {
          setItems(j.data.map((d: any) => ({
            id: d.id, employee: d.employee, date: d.date, reason: d.reason || 'Khiếu nại bảng công',
            status: d.status, deadline: d.deadline, daysLeft: d.daysLeft,
            employeeCode: d.employeeCode || '', workDate: d.workDate,
            requestedKind: d.requestedKind || 'TIME_FIX', requestedLeaveType: d.requestedLeaveType,
            requestedLeaveTypeName: d.requestedLeaveTypeName,
            requestedCheckIn: d.requestedCheckIn, requestedCheckOut: d.requestedCheckOut,
            attachmentCount: d.attachmentCount ?? 0,
          })));
          setSelected(prev => prev.filter(id => j.data.some((d: any) => d.id === id && d.status === 'PENDING')));
          setError(null);
        } else setError(j?.message || 'Không tải được danh sách khiếu nại');
      })
      .catch(() => setError('Không tải được danh sách khiếu nại'));
  };
  useEffect(load, []);

  const closeModal = () => { setModal(null); setMError(null); };

  const openOne = (d: Dispute, action: Action) => {
    setModal({ kind: 'one', d, action });
    setMAction(action);
    setMReason(action === 'REJECT' ? '' : defaultReason(d));
    setMIn(d.requestedCheckIn || '');
    setMOut(d.requestedCheckOut || '');
    setMError(null);
  };

  const openBulkReject = () => { setModal({ kind: 'bulk-reject' }); setMReason(''); setMError(null); };
  const openBulkFix = () => { setModal({ kind: 'bulk-fix' }); setMReason('Đã đối chiếu log chấm công và sửa ô'); setMError(null); };

  const submitOne = async () => {
    if (!modal || modal.kind !== 'one') return;
    const d = modal.d;
    const action = mAction;
    if (!mReason.trim()) { setMError('Phải nhập lý do xử lý'); return; }
    // Đơn "sửa giờ" phải chốt đủ cả giờ vào và giờ ra — công ngày đó tính từ cặp giờ này.
    // WFH/nghỉ thì hệ thống tự sinh đơn tương ứng, không cần giờ.
    let times: { requestedCheckIn?: string; requestedCheckOut?: string } = {};
    if (action === 'FIX' && kindOf(d) === 'TIME_FIX') {
      if (!mIn.trim() || !mOut.trim()) { setMError('Duyệt sửa giờ phải nhập đủ cả giờ vào và giờ ra'); return; }
      if (mOut.trim() <= mIn.trim()) { setMError('Giờ ra phải sau giờ vào'); return; }
      times = { requestedCheckIn: mIn.trim(), requestedCheckOut: mOut.trim() };
    }
    setBusy(true);
    const res = await fetch(`/api/v1/disputes/${d.id}/resolve`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...headers() },
      body: JSON.stringify({ action, reason: mReason.trim(), ...times }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setMError(json?.message || 'Xử lý khiếu nại thất bại'); return; }
    setError(null);
    closeModal();
    showToast(action === 'REJECT' ? 'Đã từ chối — nhân viên đã nhận thông báo'
      : action === 'MAKEUP' ? 'Đã tạo đơn bổ sung công — chỉ có hiệu lực sau khi đơn được duyệt'
        : kindOf(d) === 'WFH' ? 'Đã duyệt WFH — bảng công đã cập nhật'
          : kindOf(d) === 'LEAVE' ? 'Đã duyệt nghỉ — bảng công và quỹ phép đã cập nhật'
            : 'Đã duyệt — bảng công đã cập nhật');
    load();
  };

  const submitBulkReject = async () => {
    if (selected.length === 0) return;
    if (!mReason.trim()) { setMError('Từ chối hàng loạt phải nhập lý do'); return; }
    setBusy(true);
    const res = await fetch('/api/v1/disputes/bulk-resolve', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...headers() },
      body: JSON.stringify({ ids: selected, action: 'REJECT', reason: mReason.trim() }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setMError(json?.message || 'Xử lý hàng loạt thất bại'); return; }
    const skipped = (json?.data?.skipped || []).length;
    setError(null);
    closeModal();
    showToast(`Đã từ chối ${json?.data?.resolved ?? 0} khiếu nại` + (skipped ? ` · bỏ qua ${skipped} đơn không hợp lệ` : ''));
    setSelected([]);
    load();
  };

  const submitBulkFix = async () => {
    if (selected.length === 0) return;
    const chosen = items.filter(d => selected.includes(d.id));
    const timeFix = chosen.filter(d => kindOf(d) === 'TIME_FIX');
    const timeNoTimes = timeFix.filter(d => !d.requestedCheckIn && !d.requestedCheckOut);
    // Không có giờ vào/ra đề xuất thì không có cơ sở tính công → bỏ qua các đơn đó.
    const fixableIds = selected.filter((id) => !timeNoTimes.some(d => d.id === id));
    if (!mReason.trim()) { setMError('Duyệt hàng loạt phải nhập lý do'); return; }
    if (fixableIds.length === 0) {
      setMError('Các đơn đang chọn đều thiếu giờ vào/ra đề xuất — mở từng đơn để nhập giờ trước khi duyệt');
      return;
    }
    setBusy(true);
    const res = await fetch('/api/v1/disputes/bulk-resolve', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...headers() },
      body: JSON.stringify({ ids: fixableIds, action: 'FIX', reason: mReason.trim() }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setMError(json?.message || 'Duyệt hàng loạt thất bại'); return; }
    const skippedList: { id: string; message?: string }[] = json?.data?.skipped || [];
    const byId = new Map(items.map(d => [d.id, d]));
    closeModal();
    if (skippedList.length > 0) {
      const detail = skippedList.slice(0, 3)
        .map(s => `${byId.get(s.id)?.employee || s.id} · ${byId.get(s.id)?.date || ''} — ${s.message || 'không hợp lệ'}`)
        .join('; ');
      setError(`Bỏ qua ${skippedList.length}/${chosen.length} đơn: ${detail}${skippedList.length > 3 ? '…' : ''}`);
    } else {
      setError(null);
    }
    showToast(`Đã duyệt & sửa ô ${json?.data?.resolved ?? 0} khiếu nại`
      + (skippedList.length ? ` · bỏ qua ${skippedList.length} đơn không hợp lệ` : ''));
    setSelected([]);
    load();
  };

  const counts = useMemo(() => ({
    PENDING: items.filter(d => d.status === 'PENDING').length,
    RESOLVED: items.filter(d => d.status === 'RESOLVED').length,
    REJECTED: items.filter(d => d.status === 'REJECTED').length,
    EXPIRED: items.filter(d => d.status === 'EXPIRED').length,
    ALL: items.length,
  }), [items]);

  /** Tìm kiếm trước — chip đếm trên tập đã tìm để số khớp danh sách bên dưới. */
  const base = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(d => d.employee.toLowerCase().includes(q)
      || (d.employeeCode || '').toLowerCase().includes(q)
      || d.reason.toLowerCase().includes(q));
  }, [items, search]);

  const visible = useMemo(() => (filter === 'ALL' ? base : base.filter(d => d.status === filter)), [base, filter]);
  const pendingVisible = visible.filter(d => d.status === 'PENDING');
  const allSelected = pendingVisible.length > 0 && pendingVisible.every(d => selected.includes(d.id));
  const toggle = (id: string) => setSelected(p => (p.includes(id) ? p.filter(i => i !== id) : [...p, id]));

  const chip = (id: Filter, label: string) => (
    <button
      key={id}
      type="button"
      onClick={() => { setFilter(id); setSelected([]); }}
      aria-pressed={filter === id}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
        filter === id ? 'border-accent bg-accent-soft text-accent-dark' : 'border-line bg-surface text-ink-secondary hover:border-line-hover'
      }`}
    >
      {label}
      <span className="font-mono text-[10px] opacity-70">{counts[id]}</span>
    </button>
  );

  const deadlineText = (d: Dispute) => {
    if (!d.deadline) return '';
    if (d.status !== 'PENDING') return `Hạn xử lý ${fmtDate(d.deadline)}`;
    return d.daysLeft != null && d.daysLeft >= 0
      ? `Còn ${d.daysLeft} ngày · hạn ${fmtDate(d.deadline)}`
      : `Quá hạn · hạn ${fmtDate(d.deadline)}`;
  };

  const rowActions = (d: Dispute) => d.status !== 'PENDING' ? (
    <Link
      to={`/attendance/disputes/${d.id}`}
      className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-accent-dark hover:underline"
    >
      Xem chi tiết
      <ArrowUpRight className="h-3 w-3" />
    </Link>
  ) : (
    <>
      <button
        type="button"
        onClick={() => openOne(d, 'FIX')}
        title={fixTitle(d)}
        className="inline-flex h-[29px] items-center justify-center rounded-lg bg-accent px-2.5 text-[11.5px] font-semibold text-on-accent transition-opacity hover:bg-accent-hover"
      >
        {fixLabel(d)}
      </button>
      <div className="flex justify-between gap-2 text-[11.5px] font-semibold">
        <button type="button" onClick={() => openOne(d, 'MAKEUP')} title={MAKEUP_TITLE} className="text-ink-muted hover:text-ink">
          Bổ sung công
        </button>
        <button type="button" onClick={() => openOne(d, 'REJECT')} title={REJECT_TITLE} className="text-status-danger hover:opacity-80">
          Từ chối
        </button>
      </div>
    </>
  );

  const modalTitle = !modal ? '' : modal.kind === 'bulk-reject' ? `Từ chối ${selected.length} khiếu nại`
    : modal.kind === 'bulk-fix' ? `Duyệt & sửa ô ${selected.length} khiếu nại`
      : modal.action === 'REJECT' ? 'Từ chối khiếu nại'
        : modal.action === 'MAKEUP' ? 'Bổ sung công (chờ duyệt)'
          : fixLabel(modal.d);

  const canSubmit = !busy && mReason.trim().length > 0
    && !(modal?.kind === 'one' && mAction === 'FIX' && kindOf(modal.d) === 'TIME_FIX' && (!mIn.trim() || !mOut.trim()));

  return (
    <div className="mx-auto max-w-4xl space-y-4 pb-24">
      {toast && (
        <div className="fixed right-6 top-16 z-[100] rounded-lg bg-status-ok px-4 py-2 text-xs font-semibold text-on-ok shadow-sm">
          {toast}
        </div>
      )}

      {/* Đầu trang */}
      <div className="min-w-0">
        <div className="inline-flex items-center gap-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-accent-dark">
          <AlertTriangle className="h-3.5 w-3.5" />
          Chấm công
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <h1 className="font-display text-xl font-extrabold tracking-tight text-ink sm:text-[23px]">
            Khiếu nại bảng công
          </h1>
          <Badge variant="accent">T12</Badge>
        </div>
        <p className="mt-1 text-xs text-ink-muted">
          Khiếu nại chỉ nhận trong 2 ngày sau khi công bố bảng công; quá hạn tự đóng. Hạn gần nhất lên đầu.
        </p>
      </div>

      {/* Bìa tổng quan */}
      <div className="overflow-hidden rounded-[16px] border border-line bg-ink px-5 py-4 text-canvas">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-canvas/60">Hàng chờ xử lý</div>
            <div className="mt-1 font-display text-lg font-extrabold">Duyệt đúng — bảng công, quỹ phép đổi ngay</div>
            <p className="mt-1 max-w-md text-xs leading-relaxed text-canvas/75">
              Duyệt &amp; sửa ô / WFH / nghỉ có hiệu lực ngay; “Bổ sung công” chỉ tạo đơn chờ duyệt.
              Mọi thao tác ghi audit log và gửi thông báo cho nhân viên.
            </p>
          </div>
          <dl className="ml-auto flex gap-7">
            <div>
              <dd className={`font-display text-2xl font-extrabold tabular-nums ${counts.PENDING > 0 ? 'text-status-warn' : ''}`}>{counts.PENDING}</dd>
              <dt className="text-[11px] text-canvas/60">cần xử lý</dt>
            </div>
            <div>
              <dd className="font-display text-2xl font-extrabold tabular-nums">{counts.RESOLVED}</dd>
              <dt className="text-[11px] text-canvas/60">đã xử lý</dt>
            </div>
            <div>
              <dd className="font-display text-2xl font-extrabold tabular-nums">{counts.REJECTED}</dd>
              <dt className="text-[11px] text-canvas/60">bị từ chối</dt>
            </div>
            <div>
              <dd className="font-display text-2xl font-extrabold tabular-nums">{counts.EXPIRED}</dd>
              <dt className="text-[11px] text-canvas/60">quá hạn</dt>
            </div>
          </dl>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-status-danger-line bg-status-danger-soft p-3 text-sm text-status-danger">
          {error}
        </div>
      )}

      {/* Bộ lọc */}
      <Panel bodyClassName="space-y-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1 sm:max-w-[300px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Tìm tên / mã / lý do…"
              className="w-full rounded-lg border border-line bg-surface py-1.5 pl-8 pr-2.5 text-xs text-ink placeholder:text-ink-muted"
            />
          </div>
          <span className="ml-auto text-[11px] text-ink-muted">
            {visible.length} khiếu nại · hạn gần nhất trước
          </span>
        </div>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5">
          {chip('PENDING', 'Cần xử lý')}
          {chip('RESOLVED', 'Đã xử lý')}
          {chip('REJECTED', 'Bị từ chối')}
          {chip('EXPIRED', 'Quá hạn')}
          {chip('ALL', 'Tất cả')}
        </div>
      </Panel>

      {/* Thanh chọn hàng loạt */}
      {pendingVisible.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-xs text-ink-secondary">
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={allSelected} onChange={() => setSelected(allSelected ? [] : pendingVisible.map(d => d.id))} />
            Chọn tất cả đang chờ ({pendingVisible.length})
          </label>
          {selected.length > 0 && (
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <span className="text-[11.5px] text-ink-muted">Đã chọn {selected.length}</span>
              <button
                type="button"
                onClick={openBulkFix}
                title="Duyệt và áp NGAY lên bảng công cho tất cả đơn đang chọn: sửa giờ theo giờ nhân viên đề xuất, duyệt WFH, duyệt nghỉ (trừ quỹ phép). Đơn không xử lý được sẽ bị bỏ qua và liệt kê."
                className="inline-flex h-[29px] items-center rounded-lg bg-accent px-2.5 text-[11.5px] font-semibold text-on-accent transition-opacity hover:bg-accent-hover"
              >
                Duyệt &amp; sửa ô hàng loạt
              </button>
              <button
                type="button"
                onClick={openBulkReject}
                className="inline-flex h-[29px] items-center rounded-lg border border-status-danger-line bg-surface px-2.5 text-[11.5px] font-semibold text-status-danger hover:bg-status-danger-soft"
              >
                Từ chối hàng loạt
              </button>
              <button type="button" onClick={() => setSelected([])} className="text-[11.5px] font-semibold text-ink-muted hover:text-ink">
                Bỏ chọn
              </button>
            </div>
          )}
        </div>
      )}

      {/* Danh sách — desktop */}
      <div className="hidden space-y-2 sm:block">
        {visible.length === 0 && (
          <div className="rounded-xl border border-dashed border-line bg-surface px-4 py-8 text-center text-xs text-ink-muted">
            Không có khiếu nại nào trong nhóm này.
          </div>
        )}
        {visible.map(d => {
          const st = STATUS_META[d.status] || STATUS_META.EXPIRED;
          const kind = KIND_META[kindOf(d)] || KIND_META.TIME_FIX;
          const req = requestedLine(d);
          return (
            <article
              key={d.id}
              className={`flex items-start gap-3 rounded-xl border px-3.5 py-3 transition-colors ${
                d.status === 'PENDING' ? 'border-line bg-surface hover:border-line-hover' : 'border-line bg-canvas'
              }`}
            >
              {d.status === 'PENDING'
                ? <input type="checkbox" className="mt-1.5 shrink-0" checked={selected.includes(d.id)} onChange={() => toggle(d.id)} aria-label={`Chọn khiếu nại ${d.employee}`} />
                : <span className="w-[13px] shrink-0" />}
              <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full bg-accent-soft text-[10.5px] font-extrabold text-accent-dark">
                {initials(d.employee)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Link to={`/attendance/disputes/${d.id}`} className="text-[13px] font-bold text-ink hover:text-accent-dark">
                    {d.employee}
                  </Link>
                  {d.employeeCode && <span className="font-mono text-[10.5px] text-ink-muted">{d.employeeCode}</span>}
                  <span className="font-mono text-[11.5px] font-semibold text-ink-secondary">{d.date}</span>
                  <Badge variant={kind.variant}>{kind.text}</Badge>
                  <Badge variant={st.variant}>{st.text}</Badge>
                </div>
                <div className="mt-1 text-xs leading-relaxed text-ink-secondary">{d.reason}</div>
                <div className={`mt-1 text-[11px] ${req.tone === 'ok' ? 'text-status-ok' : req.tone === 'warn' ? 'text-status-warn' : 'text-ink-secondary'}`}>
                  {req.text}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-muted">
                  <span className={`inline-flex items-center gap-1 ${d.status === 'PENDING' ? 'font-semibold text-status-warn' : ''}`}>
                    <Clock className="h-2.5 w-2.5" />
                    {deadlineText(d)}
                  </span>
                  {!!d.attachmentCount && (
                    <span className="inline-flex items-center gap-1">
                      <Paperclip className="h-2.5 w-2.5" />
                      {d.attachmentCount} giấy tờ
                    </span>
                  )}
                </div>
              </div>
              <div className="flex w-[132px] shrink-0 flex-col items-stretch gap-1.5">
                {rowActions(d)}
              </div>
            </article>
          );
        })}
      </div>

      {/* Danh sách — mobile */}
      <div className="space-y-2 sm:hidden">
        {visible.length === 0 && (
          <div className="rounded-[13px] border border-dashed border-line bg-surface px-4 py-8 text-center text-xs text-ink-muted">
            Không có khiếu nại nào trong nhóm này.
          </div>
        )}
        {visible.map(d => {
          const st = STATUS_META[d.status] || STATUS_META.EXPIRED;
          const kind = KIND_META[kindOf(d)] || KIND_META.TIME_FIX;
          const req = requestedLine(d);
          return (
            <article key={d.id} className="rounded-[13px] border border-line bg-surface p-3">
              <div className="flex items-start gap-2.5">
                {d.status === 'PENDING' && (
                  <input type="checkbox" className="mt-1.5 shrink-0" checked={selected.includes(d.id)} onChange={() => toggle(d.id)} aria-label={`Chọn khiếu nại ${d.employee}`} />
                )}
                <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full bg-accent-soft text-[10.5px] font-extrabold text-accent-dark">
                  {initials(d.employee)}
                </span>
                <span className="min-w-0 flex-1">
                  <Link to={`/attendance/disputes/${d.id}`} className="block truncate text-[12.5px] font-bold text-ink">
                    {d.employee}
                  </Link>
                  <span className="mt-px block font-mono text-[10.5px] text-ink-muted">
                    {d.employeeCode ? `${d.employeeCode} · ` : ''}{d.date}
                  </span>
                </span>
                <Badge variant={st.variant}>{st.text}</Badge>
              </div>
              <div className="mt-2 text-[11.5px] leading-relaxed text-ink-secondary">{d.reason}</div>
              <div className={`mt-1 text-[11px] ${req.tone === 'ok' ? 'text-status-ok' : req.tone === 'warn' ? 'text-status-warn' : 'text-ink-secondary'}`}>
                {req.text}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-muted">
                <Badge variant={kind.variant}>{kind.text}</Badge>
                <span className={`inline-flex items-center gap-1 ${d.status === 'PENDING' ? 'font-semibold text-status-warn' : ''}`}>
                  <Clock className="h-2.5 w-2.5" />
                  {deadlineText(d)}
                </span>
                {!!d.attachmentCount && (
                  <span className="inline-flex items-center gap-1">
                    <Paperclip className="h-2.5 w-2.5" />
                    {d.attachmentCount} giấy tờ
                  </span>
                )}
              </div>
              <div className="mt-2.5">
                {d.status === 'PENDING' ? (
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => openOne(d, 'FIX')}
                      title={fixTitle(d)}
                      className="inline-flex h-8 items-center justify-center rounded-lg bg-accent px-2 text-[11.5px] font-semibold text-on-accent"
                    >
                      {fixLabel(d)}
                    </button>
                    <button
                      type="button"
                      onClick={() => openOne(d, 'MAKEUP')}
                      title={MAKEUP_TITLE}
                      className="inline-flex h-8 items-center justify-center rounded-lg border border-line bg-surface px-2 text-[11.5px] font-semibold text-ink-secondary"
                    >
                      Bổ sung
                    </button>
                    <button
                      type="button"
                      onClick={() => openOne(d, 'REJECT')}
                      title={REJECT_TITLE}
                      className="inline-flex h-8 items-center justify-center rounded-lg border border-status-danger-line bg-surface px-2 text-[11.5px] font-semibold text-status-danger"
                    >
                      Từ chối
                    </button>
                  </div>
                ) : (
                  rowActions(d)
                )}
              </div>
            </article>
          );
        })}
      </div>

      <div className="rounded-[13px] border border-line bg-canvas p-3.5 text-[11px] leading-relaxed text-ink-muted">
        <b className="text-ink-secondary">Đọc trạng thái:</b> “Đang mở” = còn trong hạn và chưa xử lý; hết 2 ngày hệ thống
        tự đóng thành “Quá hạn” và không sửa bảng công được nữa. Duyệt nghỉ phải có giấy tờ nếu loại nghỉ bắt buộc giấy tờ.
      </div>

      {/* Hộp thoại xử lý */}
      <Modal isOpen={!!modal} onClose={closeModal} title={modalTitle} maxWidth="lg">
        {modal?.kind === 'one' && (
          <div className="space-y-3">
            <div className="rounded-lg border border-line bg-canvas px-3 py-2.5 text-xs text-ink-secondary">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-ink">{modal.d.employee}</span>
                <span className="font-mono text-[10.5px] text-ink-muted">{modal.d.employeeCode}</span>
                <span className="font-mono text-[11px]">{modal.d.date}</span>
                <Badge variant={(KIND_META[kindOf(modal.d)] || KIND_META.TIME_FIX).variant}>
                  {(KIND_META[kindOf(modal.d)] || KIND_META.TIME_FIX).text}
                </Badge>
              </div>
              <div className="mt-1.5 text-[11.5px]">{modal.d.reason}</div>
              <div className="mt-1 text-[11px] text-ink-muted">{requestedLine(modal.d).text}</div>
            </div>

            {mAction !== 'REJECT' && (
              <div>
                <div className="mb-1.5 text-[11px] font-semibold text-ink">Cách xử lý</div>
                <div className="grid gap-1.5">
                  {([
                    ['FIX', `${fixLabel(modal.d)} — hiệu lực ngay`],
                    ['MAKEUP', 'Bổ sung công — tạo đơn chờ duyệt'],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setMAction(value)}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                        mAction === value ? 'border-accent bg-accent-soft text-accent-dark' : 'border-line bg-surface text-ink-secondary hover:border-line-hover'
                      }`}
                    >
                      <span className={`grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full border ${mAction === value ? 'border-accent' : 'border-line-hover'}`}>
                        {mAction === value && <span className="h-2 w-2 rounded-full bg-accent" />}
                      </span>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {mAction === 'FIX' && kindOf(modal.d) === 'TIME_FIX' && (
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="mb-1 block text-[11px] font-semibold text-ink">Giờ vào *</span>
                  <input
                    type="time"
                    value={mIn}
                    onChange={e => setMIn(e.target.value)}
                    className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-semibold text-ink">Giờ ra *</span>
                  <input
                    type="time"
                    value={mOut}
                    onChange={e => setMOut(e.target.value)}
                    className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink"
                  />
                </label>
              </div>
            )}

            {mAction === 'FIX' && kindOf(modal.d) === 'WFH' && (
              <div className="rounded-lg border border-status-ok-line bg-status-ok-soft px-3 py-2 text-[11.5px] text-status-ok">
                Duyệt WFH: tạo đơn làm việc từ xa đã duyệt, bảng công hiện ô R ngay.
              </div>
            )}
            {mAction === 'FIX' && kindOf(modal.d) === 'LEAVE' && (
              <div className="rounded-lg border border-status-warn-line bg-status-warn-soft px-3 py-2 text-[11.5px] text-status-warn">
                Duyệt nghỉ: chuyển ngày này thành ngày nghỉ theo loại nhân viên xin và trừ 1 ngày quỹ phép.
              </div>
            )}
            {mAction === 'MAKEUP' && (
              <div className="rounded-lg border border-status-info-line bg-status-info-soft px-3 py-2 text-[11.5px] text-status-info">
                Bổ sung công KHÔNG sửa bảng công ngay — chỉ tạo đơn điều chỉnh công chờ duyệt.
              </div>
            )}

            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold text-ink">Lý do {mAction === 'REJECT' ? 'từ chối' : 'xử lý'} *</span>
              <textarea
                rows={3}
                value={mReason}
                onChange={e => setMReason(e.target.value)}
                placeholder={mAction === 'REJECT' ? 'Ghi rõ lý do — nhân viên sẽ nhận thông báo' : 'Ghi rõ căn cứ xử lý — lưu vào nhật ký kiểm toán'}
                className="w-full rounded-lg border border-line bg-surface p-2.5 text-sm text-ink"
              />
            </label>

            {mError && <div className="rounded-lg border border-status-danger-line bg-status-danger-soft px-3 py-2 text-xs text-status-danger">{mError}</div>}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={closeModal} className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-secondary">
                Huỷ
              </button>
              <button
                type="button"
                disabled={!canSubmit}
                onClick={submitOne}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-opacity disabled:cursor-not-allowed disabled:opacity-50 ${
                  mAction === 'REJECT' ? 'bg-status-danger text-white hover:opacity-90' : 'bg-accent text-on-accent hover:bg-accent-hover'
                }`}
              >
                {mAction === 'REJECT' ? 'Từ chối khiếu nại' : mAction === 'MAKEUP' ? 'Tạo đơn bổ sung công' : `${fixLabel(modal.d)} ngay`}
              </button>
            </div>
          </div>
        )}

        {modal?.kind === 'bulk-reject' && (
          <div className="space-y-3">
            <div className="rounded-lg border border-line bg-canvas px-3 py-2.5 text-xs text-ink-secondary">
              Từ chối <b className="text-ink">{selected.length} khiếu nại</b> đang chọn. Bảng công không đổi; mỗi nhân viên nhận thông báo kèm lý do.
            </div>
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold text-ink">Lý do từ chối chung *</span>
              <textarea
                rows={3}
                value={mReason}
                onChange={e => setMReason(e.target.value)}
                placeholder="Ghi rõ lý do — áp cho tất cả đơn đang chọn"
                className="w-full rounded-lg border border-line bg-surface p-2.5 text-sm text-ink"
              />
            </label>
            {mError && <div className="rounded-lg border border-status-danger-line bg-status-danger-soft px-3 py-2 text-xs text-status-danger">{mError}</div>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={closeModal} className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-secondary">Huỷ</button>
              <button
                type="button"
                disabled={!canSubmit}
                onClick={submitBulkReject}
                className="rounded-lg bg-status-danger px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Từ chối {selected.length} khiếu nại
              </button>
            </div>
          </div>
        )}

        {modal?.kind === 'bulk-fix' && (() => {
          const chosen = items.filter(d => selected.includes(d.id));
          const timeFix = chosen.filter(d => kindOf(d) === 'TIME_FIX');
          const noTimes = timeFix.filter(d => !d.requestedCheckIn && !d.requestedCheckOut).length;
          const wfh = chosen.filter(d => kindOf(d) === 'WFH').length;
          const leave = chosen.filter(d => kindOf(d) === 'LEAVE').length;
          const summary = [
            timeFix.length ? `${timeFix.length} sửa giờ` : '',
            wfh ? `${wfh} WFH` : '',
            leave ? `${leave} nghỉ` : '',
          ].filter(Boolean).join(' · ');
          return (
            <div className="space-y-3">
              <div className="rounded-lg border border-line bg-canvas px-3 py-2.5 text-xs text-ink-secondary">
                Duyệt &amp; sửa ô <b className="text-ink">{chosen.length} khiếu nại</b> đang chọn ({summary}).
                Có hiệu lực <b className="text-ink">ngay</b> lên bảng công; đơn nghỉ thì trừ 1 ngày quỹ phép.
                {noTimes > 0 && (
                  <div className="mt-1.5 font-semibold text-status-warn">
                    {noTimes} đơn sửa giờ không kèm giờ đề xuất sẽ bị bỏ qua — mở từng đơn để nhập giờ.
                  </div>
                )}
              </div>
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold text-ink">Lý do xử lý chung *</span>
                <textarea
                  rows={3}
                  value={mReason}
                  onChange={e => setMReason(e.target.value)}
                  placeholder="Ghi rõ căn cứ xử lý — lưu vào nhật ký kiểm toán"
                  className="w-full rounded-lg border border-line bg-surface p-2.5 text-sm text-ink"
                />
              </label>
              {mError && <div className="rounded-lg border border-status-danger-line bg-status-danger-soft px-3 py-2 text-xs text-status-danger">{mError}</div>}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={closeModal} className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-secondary">Huỷ</button>
                <button
                  type="button"
                  disabled={!canSubmit}
                  onClick={submitBulkFix}
                  className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-on-accent transition-opacity hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Duyệt &amp; sửa ô ngay
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
};
