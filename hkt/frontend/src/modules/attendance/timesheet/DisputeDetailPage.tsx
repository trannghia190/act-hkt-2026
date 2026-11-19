import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

export const DisputeDetailPage: React.FC = () => {
  const { id } = useParams();
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    const token = (() => { try { return JSON.parse(localStorage.getItem('pulse_auth_user') || '{}')?.accessToken; } catch { return ''; } })();
    fetch(`/api/v1/disputes/${id}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }).then(r => r.json()).then(j => { if (j?.data) setData(j.data); }).catch(() => undefined);
  }, [id]);
  const act = async (action: string) => {
    const reason = window.prompt('Lý do xử lý (bắt buộc khi từ chối):', 'Đã đối chiếu 3 nguồn dữ liệu') || '';
    if (action === 'REJECT' && !reason.trim()) return;
    const token = (() => { try { return JSON.parse(localStorage.getItem('pulse_auth_user') || '{}')?.accessToken; } catch { return ''; } })();
    await fetch(`/api/v1/disputes/${id}/resolve`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ action, reason }) });
    alert('Đã xử lý khiếu nại');
  };
  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="bg-canvas border border-line rounded-xl p-6">
        <div className="text-xs text-accent font-semibold">S33 · HR</div>
        <h1 className="text-xl font-bold text-ink mt-1">Xử lý khiếu nại {id || 'DC-01'}</h1>
        <p className="text-xs text-ink-muted mt-1">So sánh 3 cột trước khi sửa: log chấm công · khiếu nại · bảng công hiện tại.</p>
      </div>
      <div className="grid md:grid-cols-3 gap-3">
        {[
          { title: 'Log chấm công', value: data?.before || 'Check-in 08:47 · GPS hợp lệ' },
          { title: 'Khiếu nại của NV', value: data?.reason || 'Khiếu nại bảng công' },
          { title: 'Bảng công hiện tại', value: data?.after || 'Ô ngày = trống (0 công)' },
        ].map(c => (
          <div key={c.title} className="bg-surface border border-line rounded-xl p-4">
            <div className="text-xs font-semibold text-ink-muted">{c.title}</div>
            <div className="text-sm mt-2">{c.value}</div>
          </div>
        ))}
      </div>
      <div className="bg-surface border border-line rounded-xl p-4 flex gap-2">
        <button onClick={() => act('FIX')} className="text-xs px-3 py-1.5 rounded bg-emerald-600 text-white">Chấp nhận khiếu nại</button>
        <button onClick={() => act('REJECT')} className="text-xs px-3 py-1.5 rounded border border-line">Từ chối (bắt buộc lý do)</button>
        <button onClick={() => act('ADJUST')} className="text-xs px-3 py-1.5 rounded border border-line">Tạo đơn bổ sung công</button>
      </div>
    </div>
  );
};
