import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

interface Dispute {
  id: string; employee: string; date: string; reason: string; status: string; deadline?: string; daysLeft?: number;
  requestedKind?: string; requestedLeaveType?: string; requestedLeaveTypeName?: string;
  requestedCheckIn?: string; requestedCheckOut?: string;
}

// Chế độ nhân viên xin cho ngày đó — quyết định nhãn + tooltip của nút duyệt.
const kindOf = (d: Dispute) => d.requestedKind || 'TIME_FIX';
const fixLabel = (d: Dispute) => kindOf(d) === 'WFH' ? 'Duyệt WFH' : kindOf(d) === 'LEAVE' ? 'Duyệt nghỉ' : 'Duyệt & sửa ô';
const fixTitle = (d: Dispute) => kindOf(d) === 'WFH'
  ? 'Có hiệu lực NGAY: công nhận ngày này là làm việc từ xa — tạo đơn WFH đã duyệt, bảng công hiện ô R. Không cần ký hiệu công.'
  : kindOf(d) === 'LEAVE'
    ? 'Có hiệu lực NGAY: chuyển ngày này thành ngày nghỉ theo loại nhân viên xin — tạo đơn nghỉ đã duyệt và trừ 1 ngày quỹ phép.'
    : 'Có hiệu lực NGAY: ghi ký hiệu công mới (và giờ nhân viên đề xuất, nếu có) vào bảng công. Ô công lưu nhật ký thay đổi.';
const MAKEUP_TITLE = 'KHÔNG sửa bảng công ngay: tạo đơn điều chỉnh công (ADJUST) ở trạng thái chờ duyệt — chỉ khi đơn đó được duyệt thì ngày công mới thay đổi.';
const REJECT_TITLE = 'Đóng khiếu nại (không đổi bảng công). Bắt buộc nhập lý do; nhân viên nhận thông báo.';

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  PENDING: { text: 'Đang mở', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  RESOLVED: { text: 'Đã xử lý', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  REJECTED: { text: 'Đã từ chối', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  EXPIRED: { text: 'Quá hạn — tự đóng', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
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
    // Chỉ đơn "sửa giờ" mới cần ký hiệu công; đơn WFH/nghỉ thì hệ thống tự sinh đơn tương ứng.
    let symbol: string | undefined;
    if (action === 'FIX' && kind === 'TIME_FIX') {
      const s = window.prompt('Ký hiệu công mới cho ô ngày (VD: 1.00, 0.50, R, AL):', '1.00');
      if (!s || !s.trim()) { setError('Sửa ô phải nhập ký hiệu công mới'); return; }
      symbol = s.trim();
    }
    setError(null);
    const res = await fetch(`/api/v1/disputes/${d.id}/resolve`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...headers() },
      body: JSON.stringify({ action, reason, symbol }),
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
      + '\nLý do xử lý chung (bắt buộc):',
      'Đã đối chiếu log chấm công và sửa ô');
    if (reason === null) return;
    if (!reason.trim()) { setError('Duyệt hàng loạt phải nhập lý do'); return; }
    // Đơn sửa giờ không kèm giờ đề xuất thì cần ký hiệu công chung; để trống = bỏ qua các đơn đó.
    let symbol: string | undefined;
    if (timeNoTimes.length > 0) {
      const s = window.prompt(
        `${timeNoTimes.length} đơn sửa giờ không kèm giờ đề xuất — nhập ký hiệu công chung (VD: 1.00, 0.50, R, AL).`
        + '\nĐể trống = bỏ qua các đơn này (giữ nguyên bảng công).', '1.00');
      if (s === null) return;
      if (s.trim()) symbol = s.trim();
    }
    setError(null);
    const res = await fetch('/api/v1/disputes/bulk-resolve', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...headers() },
      body: JSON.stringify({ ids: selected, action: 'FIX', reason: reason.trim(), ...(symbol ? { symbol } : {}) }),
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
      {toast && <div className="fixed top-16 right-6 z-50 bg-emerald-700 text-white px-4 py-2 rounded text-xs font-semibold">{toast}</div>}
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
      {error && <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">{error}</div>}
      <div className="flex flex-wrap items-center gap-1.5">
        {([['PENDING', 'Cần xử lý'], ['RESOLVED', 'Đã xử lý'], ['REJECTED', 'Bị từ chối'], ['EXPIRED', 'Quá hạn'], ['ALL', 'Tất cả']] as const).map(([k, label]) => (
          <button key={k} onClick={() => { setFilter(k); setSelected([]); }}
            className={`text-xs px-3 py-1.5 rounded-full border ${filter === k ? 'bg-accent text-white border-accent' : 'bg-surface border-line text-ink-secondary'}`}>
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
              <button className="px-2.5 py-1 rounded bg-emerald-600 text-white font-semibold"
                title="Duyệt và áp NGAY lên bảng công cho tất cả đơn đang chọn: sửa giờ theo giờ nhân viên đề xuất (hoặc ký hiệu công chung), duyệt WFH, duyệt nghỉ (trừ quỹ phép). Đơn không xử lý được sẽ bị bỏ qua và liệt kê."
                onClick={bulkFix}>
                Duyệt &amp; sửa ô hàng loạt
              </button>
              <button className="px-2.5 py-1 rounded bg-rose-600 text-white font-semibold" onClick={bulkReject}>
                Từ chối hàng loạt
              </button>
              <button className="px-2 py-1 rounded border border-line" onClick={() => setSelected([])}>Bỏ chọn</button>
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
                {kindOf(d) === 'WFH' && <div className="text-[11px] text-emerald-700">NV xin: công nhận làm việc từ xa (WFH)</div>}
                {kindOf(d) === 'LEAVE' && (
                  <div className="text-[11px] text-emerald-700">
                    NV xin: chuyển thành nghỉ — {d.requestedLeaveTypeName || d.requestedLeaveType || '—'}
                  </div>
                )}
                {kindOf(d) === 'TIME_FIX' && (d.requestedCheckIn || d.requestedCheckOut) && (
                  <div className="text-[11px] text-emerald-700 font-mono">
                    NV xin giờ: {d.requestedCheckIn || '—'} → {d.requestedCheckOut || '—'}
                  </div>
                )}
                {d.status === 'PENDING' && d.daysLeft !== undefined && d.daysLeft >= 0 && (
                  <div className="text-[11px] text-amber-700">⏳ Còn {d.daysLeft} ngày (hạn {fmtDate(d.deadline)})</div>
                )}
                {d.status === 'EXPIRED' && <div className="text-[11px] text-slate-600">⏰ Quá hạn 2 ngày — tự đóng</div>}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              <span className={`text-[11px] px-2 py-0.5 rounded border whitespace-nowrap ${STATUS_LABEL[d.status]?.cls || ''}`}>
                {STATUS_LABEL[d.status]?.text || d.status}
              </span>
              {d.status === 'PENDING' && (
                <>
                  <button className="text-xs px-2 py-1 rounded bg-emerald-600 text-white"
                    title={fixTitle(d)} onClick={() => resolve(d, 'FIX')}>{fixLabel(d)}</button>
                  <button className="text-xs px-2 py-1 rounded border border-line"
                    title={MAKEUP_TITLE} onClick={() => resolve(d, 'MAKEUP')}>Bổ sung công</button>
                  <button className="text-xs px-2 py-1 rounded bg-rose-600 text-white"
                    title={REJECT_TITLE} onClick={() => resolve(d, 'REJECT')}>Từ chối</button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
