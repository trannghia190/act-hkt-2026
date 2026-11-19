import React from 'react';
import { useParams } from 'react-router-dom';

export const DisputeDetailPage: React.FC = () => {
  const { id } = useParams();
  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="bg-canvas border border-line rounded-xl p-6">
        <div className="text-xs text-accent font-semibold">S33 · HR</div>
        <h1 className="text-xl font-bold text-ink mt-1">Xử lý khiếu nại {id || 'DC-01'}</h1>
        <p className="text-xs text-ink-muted mt-1">So sánh 3 cột trước khi sửa: log chấm công · khiếu nại · bảng công hiện tại.</p>
      </div>
      <div className="grid md:grid-cols-3 gap-3">
        {[
          { title: 'Log chấm công', value: 'Check-in 08:47 · GPS hợp lệ' },
          { title: 'Khiếu nại của NV', value: '"Tôi có chấm công nhưng bảng ghi vắng"' },
          { title: 'Bảng công hiện tại', value: 'Ô ngày 05/11 = trống (0 công)' },
        ].map(c => (
          <div key={c.title} className="bg-surface border border-line rounded-xl p-4">
            <div className="text-xs font-semibold text-ink-muted">{c.title}</div>
            <div className="text-sm mt-2">{c.value}</div>
          </div>
        ))}
      </div>
      <div className="bg-surface border border-line rounded-xl p-4 flex gap-2">
        <button className="text-xs px-3 py-1.5 rounded bg-emerald-600 text-white">Chấp nhận khiếu nại</button>
        <button className="text-xs px-3 py-1.5 rounded border border-line">Từ chối (bắt buộc lý do)</button>
        <button className="text-xs px-3 py-1.5 rounded border border-line">Sửa ô bảng công</button>
      </div>
    </div>
  );
};
