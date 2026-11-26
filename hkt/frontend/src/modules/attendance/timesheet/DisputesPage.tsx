import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../../components/common/Button';

interface Dispute {
  id: string; employee: string; date: string; reason: string; status: string; deadline?: string; daysLeft?: number;
  requestedKind?: string; requestedLeaveType?: string; requestedLeaveTypeName?: string;
  requestedHalfDay?: string;
  requestedCheckIn?: string; requestedCheckOut?: string; attachmentCount?: number;
}

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

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  PENDING: { text: 'Đang mở', cls: 'bg-status-warn-soft text-status-warn border-status-warn-line' },
  RESOLVED: { text: 'Đã xử lý', cls: 'bg-status-ok-soft text-status-ok border-status-ok-line' },
  REJECTED: { text: 'Đã từ chối', cls: 'bg-status-danger-soft text-status-danger border-status-danger-line' },
  EXPIRED: { text: 'Quá hạn — tự đóng', cls: 'bg-surface-secondary text-ink-secondary border-line' },
};
const fmtDate = (iso?: string) => { if (!iso) return '—'; const [y, m, d] = iso.slice(0, 10).split('-'); return d ? `${d}/${m}/${y}` : iso; };

export const DisputesPage: React.FC = () => {
  const [items, setItems] = useState<Dispute[]>([]);
  const [filter, setFilter] = useState<'PENDING' | 'RESOLVED' | 'REJECTED' | 'EXPIRED' | 'ALL'>('PENDING');
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
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

  const resolve = async (d: Dispute, action: 'FIX' | 'MAKEUP' | 'REJECT') => {
    const kind = kindOf(d);
    const defaultReason = action === 'REJECT' ? ''
      : kind === 'LEAVE' ? 'Có đơn nghỉ trước đó — xác nhận cho nhân viên'
        : kind === 'WFH' ? 'Đã xác nhận nhân viên làm việc từ xa ngày này'
          : 'Đã đối chiếu log chấm công và sửa ô';
    const reason = window.prompt(action === 'REJECT' ? 'Lý do từ chối (bắt buộc):' : 'Lý do xử lý (bắt buộc):', defaultReason);
    if (!reason || !reason.trim()) {
      if (action === 'REJECT') setError('Từ chối khiếu nại phải nhập lý do');
      return;
    }
    // Đơn "sửa giờ" phải chốt đủ cả giờ vào và giờ ra — công ngày đó tính từ cặp giờ này.
    // WFH/nghỉ thì hệ thống tự sinh đơn tương ứng, không cần giờ.
    let times: { requestedCheckIn?: string; requestedCheckOut?: string } = {};
    if (action === 'FIX' && kind === 'TIME_FIX') {
      const ci = window.prompt('Giờ vào duyệt (HH:mm):', d.requestedCheckIn || '');
      if (ci === null) return;
      const co = window.prompt('Giờ ra duyệt (HH:mm):', d.requestedCheckOut || '');
      if (co === null) return;
      if (!ci.trim() || !co.trim()) { setError('Duyệt sửa giờ phải nhập đủ cả giờ vào và giờ ra'); return; }
      if (co.trim() <= ci.trim()) { setError('Giờ ra phải sau giờ vào'); return; }
      times = { requestedCheckIn: ci.trim(), requestedCheckOut: co.trim() };
    }
    setError(null);
    const res = await fetch(`/api/v1/disputes/${d.id}/resolve`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...headers() },
      body: JSON.stringify({ action, reason, ...times }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setError(json?.message || 'Xử lý khiếu nại thất bại'); load(); return; }
    showToast(action === 'REJECT' ? 'Đã từ chối — nhân viên đã nhận thông báo'
      : action === 'MAKEUP' ? 'Đã tạo đơn bổ sung công — chỉ có hiệu lực sau khi đơn được duyệt'
        : kind === 'WFH' ? 'Đã duyệt WFH — bảng công đã cập nhật'
          : kind === 'LEAVE' ? 'Đã duyệt nghỉ — bảng công và quỹ phép đã cập nhật'
            : 'Đã duyệt — bảng công đã cập nhật');
    load();
  };

  const bulkReject = async () => {
    if (selected.length === 0) return;
    const reason = window.prompt(`Lý do từ chối chung cho ${selected.length} khiếu nại (bắt buộc):`, '');
    if (!reason || !reason.trim()) { setError('Từ chối hàng loạt phải nhập lý do'); return; }
    setError(null);
    const res = await fetch('/api/v1/disputes/bulk-resolve', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...headers() },
      body: JSON.stringify({ ids: selected, action: 'REJECT', reason: reason.trim() }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setError(json?.message || 'Xử lý hàng loạt thất bại'); return; }
    const skipped = (json?.data?.skipped || []).length;
    showToast(`Đã từ chối ${json?.data?.resolved ?? 0} khiếu nại` + (skipped ? ` · bỏ qua ${skipped} đơn không hợp lệ` : ''));
    setSelected([]);
    load();
  };

  const bulkFix = async () => {
    if (selected.length === 0) return;
    const chosen = items.filter(d => selected.includes(d.id));
    const timeFix = chosen.filter(d => kindOf(d) === 'TIME_FIX');
    const timeNoTimes = timeFix.filter(d => !d.requestedCheckIn && !d.requestedCheckOut);
    const wfh = chosen.filter(d => kindOf(d) === 'WFH').length;
    const leave = chosen.filter(d => kindOf(d) === 'LEAVE').length;
    const summary = [
      timeFix.length ? `${timeFix.length} sửa giờ` : '',
      wfh ? `${wfh} WFH` : '',
      leave ? `${leave} nghỉ` : '',
    ].filter(Boolean).join(' · ');
    const reason = window.prompt(
      `Duyệt & sửa ô cho ${chosen.length} khiếu nại đang chọn (${summary})?`
      + '\nCó hiệu lực NGAY lên bảng công; đơn nghỉ thì trừ 1 ngày quỹ phép.'
      + (timeNoTimes.length > 0 ? `\n${timeNoTimes.length} đơn sửa giờ không kèm giờ đề xuất sẽ bị bỏ qua — mở từng đơn để nhập giờ.` : '')
      + '\nLý do xử lý chung (bắt buộc):',
      'Đã đối chiếu log chấm công và sửa ô');
    if (reason === null) return;
    if (!reason.trim()) { setError('Duyệt hàng loạt phải nhập lý do'); return; }
    // Không có giờ vào/ra đề xuất thì không có cơ sở tính công → bỏ qua các đơn đó.
    const fixableIds = selected.filter((id) => !timeNoTimes.some((d) => d.id === id));
    if (fixableIds.length === 0) {
      setError('Các đơn đang chọn đều thiếu giờ vào/ra đề xuất — mở từng đơn để nhập giờ trước khi duyệt');
      return;
    }
    setError(null);
    const res = await fetch('/api/v1/disputes/bulk-resolve', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...headers() },
      body: JSON.stringify({ ids: fixableIds, action: 'FIX', reason: reason.trim() }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setError(json?.message || 'Duyệt hàng loạt thất bại'); return; }
    const skippedList: { id: string; message?: string }[] = json?.data?.skipped || [];
    const byId = new Map(items.map(d => [d.id, d]));
    if (skippedList.length > 0) {
      const detail = skippedList.slice(0, 3)
        .map(s => `${byId.get(s.id)?.employee || s.id} · ${byId.get(s.id)?.date || ''} — ${s.message || 'không hợp lệ'}`)
        .join('; ');
      setError(`Bỏ qua ${skippedList.length}/${chosen.length} đơn: ${detail}${skippedList.length > 3 ? '…' : ''}`);
    }
    showToast(`Đã duyệt & sửa ô ${json?.data?.resolved ?? 0} khiếu nại`
      + (skippedList.length ? ` · bỏ qua ${skippedList.length} đơn không hợp lệ` : ''));
    setSelected([]);
    load();
  };

  const visible = items.filter(d => filter === 'ALL' || d.status === filter);
  const pendingVisible = visible.filter(d => d.status === 'PENDING');
  const allSelected = pendingVisible.length > 0 && pendingVisible.every(d => selected.includes(d.id));

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {toast && <div className="fixed top-16 right-6 z-[100] bg-status-ok text-on-ok px-4 py-2 rounded text-xs font-semibold">{toast}</div>}
      <div className="bg-canvas border border-line rounded-xl p-6">
        <h1 className="text-xl font-bold text-ink mt-1">Danh sách khiếu nại bảng công</h1>
        <p className="text-xs text-ink-muted mt-1">Hạn gần nhất lên đầu. Xử lý nhanh ngay trên bảng; click vào dòng để xem chi tiết 3 cột.</p>
        <p className="text-[11px] text-ink-muted mt-2">
          <b className="text-ink">Duyệt &amp; sửa ô / Duyệt WFH / Duyệt nghỉ</b>: có hiệu lực <b>ngay</b> lên bảng công
          (nghỉ thì trừ quỹ phép). <b className="text-ink">Bổ sung công</b>: chỉ tạo đơn điều chỉnh công <b>chờ duyệt</b> —
          bảng công chỉ đổi sau khi đơn đó được duyệt. Rê chuột lên nút để xem giải thích.
          Tick nhiều đơn đang chờ để <b className="text-ink">Duyệt &amp; sửa ô hàng loạt</b> hoặc từ chối hàng loạt.
        </p>
      </div>
      {error && <div className="text-sm text-status-danger bg-status-danger-soft border border-status-danger-line rounded-lg p-3">{error}</div>}
      <div className="flex flex-wrap items-center gap-1.5">
        {([['PENDING', 'Cần xử lý'], ['RESOLVED', 'Đã xử lý'], ['REJECTED', 'Bị từ chối'], ['EXPIRED', 'Quá hạn'], ['ALL', 'Tất cả']] as const).map(([k, label]) => (
          <button key={k} onClick={() => { setFilter(k); setSelected([]); }}
            className={`text-xs px-3 py-1.5 rounded-full border ${filter === k ? 'bg-accent text-on-accent border-accent' : 'bg-surface border-line text-ink-secondary'}`}>
            {label} ({k === 'ALL' ? items.length : items.filter(d => d.status === k).length})
          </button>
        ))}
      </div>

      {pendingVisible.length > 0 && (
        <div className="flex items-center justify-between bg-surface border border-line rounded-xl px-3 py-2 text-xs">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={allSelected}
              onChange={() => setSelected(allSelected ? [] : pendingVisible.map(d => d.id))} />
            Chọn tất cả đang chờ ({pendingVisible.length})
          </label>
          {selected.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-ink-muted">Đã chọn {selected.length}</span>
              <Button variant="success" size="sm" className="font-semibold"
                title="Duyệt và áp NGAY lên bảng công cho tất cả đơn đang chọn: sửa giờ theo giờ nhân viên đề xuất (hoặc ký hiệu công chung), duyệt WFH, duyệt nghỉ (trừ quỹ phép). Đơn không xử lý được sẽ bị bỏ qua và liệt kê."
                onClick={bulkFix}>
                Duyệt &amp; sửa ô hàng loạt
              </Button>
              <Button variant="danger" size="sm" className="font-semibold" onClick={bulkReject}>
                Từ chối hàng loạt
              </Button>
              <Button variant="outline" size="sm" onClick={() => setSelected([])}>Bỏ chọn</Button>
            </div>
          )}
        </div>
      )}

      <div className="bg-surface border border-line rounded-xl p-4">
        {visible.length === 0 && <div className="text-xs text-ink-muted py-4 text-center">Không có khiếu nại nào trong nhóm này.</div>}
        {visible.map(d => (
          <div key={d.id} className="flex items-center justify-between gap-2 border border-line rounded-lg px-3 py-2 mb-2 text-sm">
            <div className="flex items-start gap-2">
              {d.status === 'PENDING' && (
                <input type="checkbox" className="mt-1" checked={selected.includes(d.id)}
                  onChange={() => setSelected(p => p.includes(d.id) ? p.filter(i => i !== d.id) : [...p, d.id])} />
              )}
              <div>
                <Link to={`/attendance/disputes/${d.id}`} className="font-semibold hover:underline">{d.employee} · {d.date}</Link>
                <div className="text-xs text-ink-muted">{d.reason}</div>
                {kindOf(d) === 'WFH' && (
                  <div className="text-[11px] text-status-ok">
                    NV xin: công nhận làm việc từ xa (WFH)
                    {d.requestedHalfDay ? (d.requestedHalfDay === 'MORNING' ? ' — nửa ngày sáng' : ' — nửa ngày chiều') : ''}
                  </div>
                )}
                {kindOf(d) === 'LEAVE' && (
                  <div className="text-[11px] text-status-ok">
                    NV xin: chuyển thành nghỉ — {d.requestedLeaveTypeName || d.requestedLeaveType || '—'}
                    {d.requestedHalfDay ? (d.requestedHalfDay === 'MORNING' ? ' (nửa ngày sáng)' : ' (nửa ngày chiều)') : ''}
                  </div>
                )}
                {kindOf(d) === 'TIME_FIX' && (d.requestedCheckIn || d.requestedCheckOut) && (
                  <div className="text-[11px] text-status-ok font-mono">
                    NV xin giờ: {d.requestedCheckIn || '—'} → {d.requestedCheckOut || '—'}
                  </div>
                )}
                {kindOf(d) === 'TIME_FIX' && !d.requestedCheckIn && !d.requestedCheckOut && (
                  <div className="text-[11px] text-status-danger">
                    NV chưa đề xuất giờ vào/ra — khi duyệt phải nhập đủ cả hai mới tính được công
                  </div>
                )}
                {(d.attachmentCount ?? 0) > 0 && (
                  <div className="text-[11px] text-ink-muted">📎 {d.attachmentCount} giấy tờ đính kèm</div>
                )}
                {d.status === 'PENDING' && d.daysLeft !== undefined && d.daysLeft >= 0 && (
                  <div className="text-[11px] text-status-warn">⏳ Còn {d.daysLeft} ngày (hạn {fmtDate(d.deadline)})</div>
                )}
                {d.status === 'EXPIRED' && <div className="text-[11px] text-ink-secondary">⏰ Quá hạn 2 ngày — tự đóng</div>}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              <span className={`text-[11px] px-2 py-0.5 rounded border whitespace-nowrap ${STATUS_LABEL[d.status]?.cls || ''}`}>
                {STATUS_LABEL[d.status]?.text || d.status}
              </span>
              {d.status === 'PENDING' && (
                <>
                  <Button variant="success" size="sm" className="text-xs px-2 py-1"
                    title={fixTitle(d)} onClick={() => resolve(d, 'FIX')}>{fixLabel(d)}</Button>
                  <Button variant="outline" size="sm" className="text-xs px-2 py-1"
                    title={MAKEUP_TITLE} onClick={() => resolve(d, 'MAKEUP')}>Bổ sung công</Button>
                  <Button variant="danger" size="sm" className="text-xs px-2 py-1"
                    title={REJECT_TITLE} onClick={() => resolve(d, 'REJECT')}>Từ chối</Button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
