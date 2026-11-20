import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

export const DisputeDetailPage: React.FC = () => {
  const { id } = useParams();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [leaveTypes, setLeaveTypes] = useState<Record<string, string>>({});
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
    fetch('/api/v1/leave-types', { headers: headers() }).then(r => r.json())
      .then(j => { if (Array.isArray(j?.data)) setLeaveTypes(Object.fromEntries(j.data.map((x: any) => [x.code, x.name]))); })
      .catch(() => undefined);
  }, []);

  const act = async (action: 'FIX' | 'MAKEUP' | 'REJECT') => {
    const reason = window.prompt(action === 'REJECT' ? 'Lý do từ chối (bắt buộc):' : 'Lý do xử lý (bắt buộc):', action === 'REJECT' ? '' : 'Đã đối chiếu 3 nguồn dữ liệu') || '';
    if (!reason.trim()) { setError('Phải nhập lý do xử lý'); return; }
    let symbol: string | undefined;
    if (action === 'FIX') {
      const s = window.prompt('Ký hiệu công mới cho ô ngày (VD: 1.00, 0.50, R, AL):', data?.currentCell || '1.00');
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
    setMsg(action === 'REJECT' ? 'Đã từ chối — nhân viên đã nhận thông báo' : 'Đã xử lý khiếu nại — nhân viên đã nhận thông báo');
    setError(null);
    load();
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
        <div className="bg-surface border border-line rounded-xl p-4 flex flex-wrap gap-2">
          <button onClick={() => act('FIX')} className="text-xs px-3 py-1.5 rounded bg-emerald-600 text-white">Sửa ô công</button>
          <button onClick={() => act('MAKEUP')} className="text-xs px-3 py-1.5 rounded border border-line">Tạo đơn bổ sung công</button>
          <button onClick={() => act('REJECT')} className="text-xs px-3 py-1.5 rounded bg-rose-600 text-white">Từ chối (bắt buộc lý do)</button>
        </div>
      ) : (
        <div className="bg-surface border border-line rounded-xl p-4 text-xs text-ink-muted">
          Khiếu nại đã {data?.status === 'REJECTED' ? 'bị từ chối' : data?.status === 'EXPIRED' ? 'quá hạn (tự đóng)' : 'được xử lý'} — mọi thao tác đã ghi audit log và thông báo cho nhân viên.
        </div>
      )}
    </div>
  );
};
