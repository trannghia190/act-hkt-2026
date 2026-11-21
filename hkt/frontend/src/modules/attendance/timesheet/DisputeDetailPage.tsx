import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

export const DisputeDetailPage: React.FC = () => {
  const { id } = useParams();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [leaveTypes, setLeaveTypes] = useState<Record<string, string>>({});
  // Form duyệt sửa giờ — prefill từ giờ nhân viên đề xuất (hoặc log gốc nếu NV không đề xuất).
  const [fixIn, setFixIn] = useState('');
  const [fixOut, setFixOut] = useState('');
  const [fixSymbol, setFixSymbol] = useState('');
  // Chế độ HR chốt cho ngày đó — mặc định theo đúng nhân viên đã xin, HR đổi được trước khi duyệt.
  const [fixKind, setFixKind] = useState<'TIME_FIX' | 'WFH' | 'LEAVE'>('TIME_FIX');
  const [fixLeaveType, setFixLeaveType] = useState('');
  const [fixReason, setFixReason] = useState('Đã đối chiếu 3 nguồn dữ liệu');
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
  }, [data]);
  useEffect(() => {
    fetch('/api/v1/leave-types', { headers: headers() }).then(r => r.json())
      .then(j => { if (Array.isArray(j?.data)) setLeaveTypes(Object.fromEntries(j.data.map((x: any) => [x.code, x.name]))); })
      .catch(() => undefined);
  }, []);

  const post = async (payload: Record<string, unknown>, okMsg: string) => {
    setError(null);
    const res = await fetch(`/api/v1/disputes/${id}/resolve`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...headers() },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setError(json?.message || 'Xử lý khiếu nại thất bại'); load(); return; }
    setMsg(okMsg);
    setError(null);
    load();
  };

  const applyFix = async () => {
    if (!fixReason.trim()) { setError('Phải nhập lý do xử lý'); return; }
    if (fixKind === 'LEAVE' && !fixLeaveType) { setError('Chọn loại nghỉ cụ thể'); return; }
    if (fixKind === 'TIME_FIX' && !fixIn && !fixOut && !fixSymbol.trim()) {
      setError('Nhập giờ vào/ra cần duyệt, hoặc chọn ký hiệu công');
      return;
    }
    // "HH:mm" so sánh chuỗi là đủ; backend vẫn kiểm tra lại.
    if (fixKind === 'TIME_FIX' && fixIn && fixOut && fixOut <= fixIn) { setError('Giờ ra phải sau giờ vào'); return; }
    await post({
      action: 'FIX',
      reason: fixReason.trim(),
      requestedKind: fixKind,
      ...(fixKind === 'LEAVE' ? { requestedLeaveType: fixLeaveType } : {}),
      ...(fixKind === 'TIME_FIX' && fixSymbol.trim() ? { symbol: fixSymbol.trim() } : {}),
      ...(fixKind === 'TIME_FIX' && fixIn ? { requestedCheckIn: fixIn } : {}),
      ...(fixKind === 'TIME_FIX' && fixOut ? { requestedCheckOut: fixOut } : {}),
    }, fixKind === 'TIME_FIX'
      ? 'Đã duyệt — giờ được ghi vào bảng công, ngày hôm đó đã tính lại công'
      : fixKind === 'WFH'
        ? 'Đã duyệt — ngày này được công nhận làm việc từ xa'
        : 'Đã duyệt — ngày này thành ngày nghỉ, quỹ phép đã trừ');
  };

  const act = async (action: 'MAKEUP' | 'REJECT') => {
    const reason = window.prompt(action === 'REJECT' ? 'Lý do từ chối (bắt buộc):' : 'Lý do xử lý (bắt buộc):', action === 'REJECT' ? '' : 'Đã đối chiếu 3 nguồn dữ liệu') || '';
    if (!reason.trim()) { setError('Phải nhập lý do xử lý'); return; }
    await post({ action, reason },
      action === 'REJECT' ? 'Đã từ chối — nhân viên đã nhận thông báo' : 'Đã xử lý khiếu nại — nhân viên đã nhận thông báo');
  };

  const fmt = (iso?: string) => { if (!iso) return '—'; const [y, m, d] = String(iso).slice(0, 10).split('-'); return d ? `${d}/${m}/${y}` : iso; };
  const pending = data?.status === 'PENDING';
  const statusText: Record<string, string> = { PENDING: 'Chờ xử lý', RESOLVED: 'Đã xử lý', REJECTED: 'Đã từ chối', EXPIRED: 'Quá hạn — tự đóng' };
  const reqLabel: Record<string, string> = { LEAVE: 'Nghỉ phép', WFH: 'WFH', LATE_EARLY: 'Đi muộn/về sớm', ADJUST: 'Bổ sung chấm công' };
  const reqStatus: Record<string, string> = { APPROVED: 'đã duyệt', PENDING_APPROVAL: 'chờ duyệt', REJECTED: 'bị từ chối', WITHDRAWN: 'đã hủy', DRAFT: 'nháp' };

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="bg-canvas border border-line rounded-xl p-6">
        <h1 className="text-xl font-bold text-ink mt-1">{pending ? 'Xử lý khiếu nại' : 'Chi tiết khiếu nại'} {id}</h1>
        <p className="text-xs text-ink-muted mt-1">
          So sánh 3 cột trước khi sửa: log chấm công gốc (không sửa) · đơn/khiếu nại của NV · bảng công HR đang sửa.
        </p>
        {data?.status && <div className="text-[11px] mt-2 font-semibold text-ink-muted">
          Trạng thái: {statusText[data.status] || data.status}{data?.deadline ? ` · hạn xử lý ${fmt(data.deadline)}` : ''}
        </div>}
      </div>
      {error && <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">{error}</div>}
      {msg && <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3">{msg}</div>}

      <div className="grid md:grid-cols-3 gap-3">
        <div className="bg-surface border border-line rounded-xl p-4">
          <div className="text-xs font-semibold text-ink-muted">1 · Log chấm công (gốc — không sửa)</div>
          <div className="text-sm mt-2 space-y-1">
            <div>Ngày: <b>{fmt(data?.log?.date || data?.workDate)}</b></div>
            <div>Check-in: <b>{data?.log?.checkIn || '—'}</b></div>
            <div>Check-out: <b>{data?.log?.checkOut || '—'}</b></div>
            <div className="text-[11px] text-ink-muted">Trạng thái log: {data?.log?.status || 'không có bản ghi'}</div>
          </div>
        </div>
        <div className="bg-surface border border-line rounded-xl p-4">
          <div className="text-xs font-semibold text-ink-muted">2 · Khiếu nại / đơn từ liên quan</div>
          <div className="text-sm mt-2">
            <div className="text-ink">{data?.reason || '—'}</div>
            {data?.requestedKind === 'WFH' && (
              <div className="text-[11px] mt-1 text-emerald-700">NV đề xuất: công nhận làm việc từ xa (WFH)</div>
            )}
            {data?.requestedKind === 'LEAVE' && (
              <div className="text-[11px] mt-1 text-emerald-700">
                NV đề xuất: chuyển thành nghỉ — {data?.requestedLeaveTypeName || data?.requestedLeaveType || '—'}
              </div>
            )}
            {(!data?.requestedKind || data?.requestedKind === 'TIME_FIX') && (data?.requestedCheckIn || data?.requestedCheckOut) && (
              <div className="text-[11px] mt-1 text-emerald-700 font-mono">
                NV đề xuất giờ: {data?.requestedCheckIn || '—'} → {data?.requestedCheckOut || '—'}
              </div>
            )}
            {(data?.relatedRequests || []).length === 0 && <div className="text-[11px] text-ink-muted mt-1">Chưa có đơn từ nào cho ngày này.</div>}
            {(data?.relatedRequests || []).map((r: any) => (
              <div key={r.id} className="text-[11px] mt-1 px-1.5 py-0.5 rounded bg-canvas border border-line">
                {reqLabel[r.type] || r.type}{r.leaveType ? ` (${leaveTypes[r.leaveType] || r.leaveType})` : ''} — {reqStatus[r.status] || r.status}
                {r.reason ? `: ${r.reason}` : ''}
              </div>
            ))}
          </div>
        </div>
        <div className="bg-surface border border-line rounded-xl p-4">
          <div className="text-xs font-semibold text-ink-muted">3 · Bảng công HR đang sửa</div>
          <div className="text-sm mt-2">
            <div>Ô ngày {fmt(data?.workDate)}: <b>{data?.currentCell ? data.currentCell : '(trống)'}</b></div>
          </div>
        </div>
      </div>

      {data?.ruleHint && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
          💡 Gợi ý theo rule: {data.ruleHint}
        </div>
      )}
      <div className="text-xs"><Link to="/attendance/disputes" className="text-accent underline">← Quay lại danh sách khiếu nại</Link></div>
      {pending ? (
        <div className="bg-surface border border-line rounded-xl p-4 space-y-3">
          <div className="text-xs font-semibold text-ink">Duyệt chế độ cho ngày công</div>
          <p className="text-[11px] text-ink-muted">
            Chế độ nhân viên xin đã chọn sẵn — HR đổi được trước khi duyệt. Duyệt xong bảng công, số công và (nếu là nghỉ)
            quỹ phép của ngày đó được cập nhật ngay.
          </p>
          <label className="block text-xs">
            <span className="block text-ink-muted mb-1">Ghi nhận ngày này là</span>
            <select
              value={fixKind === 'LEAVE' && fixLeaveType ? `LEAVE:${fixLeaveType}` : fixKind}
              onChange={(e) => {
                const v = e.target.value;
                if (v.startsWith('LEAVE:')) { setFixKind('LEAVE'); setFixLeaveType(v.slice('LEAVE:'.length)); }
                else { setFixKind(v as 'TIME_FIX' | 'WFH'); setFixLeaveType(''); }
              }}
              className="w-full border border-line rounded-lg p-2 text-xs text-ink"
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
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block text-xs">
              <span className="block text-ink-muted mb-1">Giờ vào</span>
              <input type="time" value={fixIn} onChange={(e) => setFixIn(e.target.value)}
                className="w-full border border-line rounded-lg p-2 font-mono text-xs text-ink" />
            </label>
            <label className="block text-xs">
              <span className="block text-ink-muted mb-1">Giờ ra</span>
              <input type="time" value={fixOut} onChange={(e) => setFixOut(e.target.value)}
                className="w-full border border-line rounded-lg p-2 font-mono text-xs text-ink" />
            </label>
          </div>
            </>
          ) : (
            <p className="text-[11px] text-ink-muted">
              {fixKind === 'WFH'
                ? 'Duyệt sẽ tạo đơn WFH đã duyệt cho ngày này — không cần giờ vào/ra.'
                : `Duyệt sẽ tạo đơn nghỉ "${leaveTypes[fixLeaveType] || fixLeaveType}" đã duyệt và trừ 1 ngày quỹ phép.`}
            </p>
          )}
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block text-xs">
              <span className="block text-ink-muted mb-1">Lý do xử lý <span className="text-rose-500">*</span></span>
              <input value={fixReason} onChange={(e) => setFixReason(e.target.value)}
                className="w-full border border-line rounded-lg p-2 text-xs text-ink" />
            </label>
            <label className="block text-xs">
              <span className="block text-ink-muted mb-1">Ký hiệu công (bỏ trống = tự tính theo giờ)</span>
              <input value={fixSymbol} onChange={(e) => setFixSymbol(e.target.value)} placeholder="1.00 / 0.50 / R / AL"
                disabled={fixKind !== 'TIME_FIX'}
                className="w-full border border-line rounded-lg p-2 font-mono text-xs text-ink" />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={applyFix} className="text-xs px-3 py-1.5 rounded bg-emerald-600 text-white">Duyệt &amp; cập nhật bảng công</button>
            <button onClick={() => act('MAKEUP')} className="text-xs px-3 py-1.5 rounded border border-line"
              title="KHÔNG sửa bảng công ngay: tạo đơn điều chỉnh công (ADJUST) ở trạng thái chờ duyệt — chỉ khi đơn đó được duyệt thì ngày công mới thay đổi.">
              Tạo đơn bổ sung công (chờ duyệt)
            </button>
            <button onClick={() => act('REJECT')} className="text-xs px-3 py-1.5 rounded bg-rose-600 text-white"
              title="Đóng khiếu nại, không đổi bảng công. Bắt buộc nhập lý do; nhân viên nhận thông báo.">
              Từ chối (bắt buộc lý do)
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-surface border border-line rounded-xl p-4 text-xs text-ink-muted">
          Khiếu nại đã {data?.status === 'REJECTED' ? 'bị từ chối' : data?.status === 'EXPIRED' ? 'quá hạn (tự đóng)' : 'được xử lý'} — mọi thao tác đã ghi audit log và thông báo cho nhân viên.
        </div>
      )}
    </div>
  );
};
