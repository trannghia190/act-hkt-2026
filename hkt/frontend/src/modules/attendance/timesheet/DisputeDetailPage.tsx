import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

export const DisputeDetailPage: React.FC = () => {
  const { id } = useParams();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const token = () => { try { return JSON.parse(localStorage.getItem('pulse_auth_user') || '{}')?.accessToken || ''; } catch { return ''; } };
  const load = () => {
    fetch(`/api/v1/disputes/${id}`, { headers: token() ? { Authorization: `Bearer ${token()}` } : {} })
      .then(r => r.json())
      .then(j => { if (j?.data) setData(j.data); else setError(j?.message || 'Không tải được khiếu nại'); })
      .catch(() => setError('Không tải được khiếu nại'));
  };
  useEffect(load, [id]);

  const act = async (action: 'FIX' | 'MAKEUP' | 'REJECT') => {
    const reason = window.prompt(action === 'REJECT' ? 'Lý do từ chối (bắt buộc):' : 'Lý do xử lý (bắt buộc):', action === 'REJECT' ? '' : 'Đã đối chiếu 3 nguồn dữ liệu') || '';
    if (!reason.trim()) { setError('Phải nhập lý do xử lý'); return; }
    setError(null);
    const res = await fetch(`/api/v1/disputes/${id}/resolve`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(token() ? { Authorization: `Bearer ${token()}` } : {}) },
      body: JSON.stringify({ action, reason }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setError(json?.message || 'Xử lý khiếu nại thất bại'); return; }
    // Backend tự tạo thông báo cho nhân viên (kể cả khi từ chối — kèm lý do).
    setData((d: any) => d ? { ...d, status: action === 'REJECT' ? 'REJECTED' : 'RESOLVED', action } : d);
    alert(action === 'REJECT' ? 'Đã từ chối — nhân viên đã nhận thông báo' : 'Đã xử lý khiếu nại — nhân viên đã nhận thông báo');
    load();
  };

  const pending = !data || data.status === 'PENDING';
  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="bg-canvas border border-line rounded-xl p-6">
        <div className="text-xs text-accent font-semibold">S33 · HR</div>
        <h1 className="text-xl font-bold text-ink mt-1">Xử lý khiếu nại {id || 'DC-01'}</h1>
        <p className="text-xs text-ink-muted mt-1">
          So sánh 3 cột trước khi sửa: log chấm công gốc (không sửa) · đơn/khiếu nại của NV · bảng công HR đang sửa.
        </p>
        {data?.status && <div className="text-[11px] mt-2 font-semibold text-ink-muted">Trạng thái: {data.status === 'PENDING' ? 'Chờ xử lý' : data.status === 'REJECTED' ? 'Đã từ chối' : 'Đã xử lý'}</div>}
      </div>
      {error && <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">{error}</div>}
      <div className="grid md:grid-cols-3 gap-3">
        {[
          { title: 'Log chấm công (gốc)', value: data?.before || 'Check-in 08:47 · GPS hợp lệ' },
          { title: 'Khiếu nại của NV', value: data?.reason || 'Khiếu nại bảng công' },
          { title: 'Bảng công hiện tại', value: data?.after || 'Ô ngày = trống (0 công)' },
        ].map(c => (
          <div key={c.title} className="bg-surface border border-line rounded-xl p-4">
            <div className="text-xs font-semibold text-ink-muted">{c.title}</div>
            <div className="text-sm mt-2">{c.value}</div>
          </div>
        ))}
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
          Khiếu nại đã {data.status === 'REJECTED' ? 'bị từ chối' : 'được xử lý'} — mọi thao tác đã ghi audit log và thông báo cho nhân viên.
        </div>
      )}
    </div>
  );
};
