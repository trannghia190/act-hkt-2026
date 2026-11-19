import React, { useState } from 'react';

export const AddDevicePage: React.FC = () => {
  const [reason, setReason] = useState('');
  const [sent, setSent] = useState(false);
  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div className="bg-canvas border border-line rounded-xl p-6">
        <div className="text-xs text-accent font-semibold">S29 · Thiết bị</div>
        <h1 className="text-xl font-bold text-ink mt-1">Đăng ký thiết bị mới</h1>
        <p className="text-xs text-ink-muted mt-1">Một flow duy nhất: máy đầu tự đăng ký, máy thứ 2/3 cần HR duyệt kèm lý do.</p>
      </div>
      <div className="bg-surface border border-line rounded-xl p-4 space-y-3">
        <label className="block text-xs font-semibold">Lý do cần thêm thiết bị *</label>
        <textarea className="w-full border border-line rounded-lg p-2 text-sm" rows={3} value={reason} onChange={e => setReason(e.target.value)} placeholder="VD: Đổi điện thoại mới do máy cũ hỏng" />
        <button className="px-4 py-2 rounded bg-accent text-white text-sm disabled:opacity-50" disabled={!reason.trim() || sent} onClick={() => setSent(true)}>
          {sent ? 'Đã gửi yêu cầu — chờ HR duyệt' : 'Gửi yêu cầu'}
        </button>
      </div>
    </div>
  );
};
