import React from 'react';
import { useParams } from 'react-router-dom';

export const RequestDetailPage: React.FC = () => {
  const { id } = useParams();
  const timeline = [
    { at: '12/11/2026 08:50', who: 'Vũ Văn Luận', action: 'Tạo & gửi đơn' },
    { at: '12/11/2026 09:10', who: 'Nguyễn Thanh Tùng (Quản lý)', action: 'Đã duyệt' },
  ];
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="bg-canvas border border-line rounded-xl p-6">
        <div className="text-xs text-accent font-semibold">S13 · Chi tiết đơn</div>
        <h1 className="text-xl font-bold text-ink mt-1">Đơn {id || 'REQ-2026-0031'}</h1>
        <p className="text-xs text-ink-muted mt-1">Timeline đầy đủ: ai làm gì, lúc nào; kèm ảnh hưởng tới bảng công.</p>
      </div>
      <div className="bg-surface border border-line rounded-xl p-4">
        <div className="text-sm font-semibold mb-2">Loại đơn: Đi muộn · 12 phút · 12/11/2026</div>
        <div className="text-xs text-ink-muted mb-4">Lý do: Kẹt xe trên đường đến văn phòng</div>
        {timeline.map(t => (
          <div key={t.at} className="flex gap-3 border-l-2 border-accent pl-3 pb-3 text-sm">
            <div><div className="font-semibold">{t.action}</div><div className="text-xs text-ink-muted">{t.at} · {t.who}</div></div>
          </div>
        ))}
        <div className="mt-3 text-xs text-ink-muted">Ảnh hưởng bảng công: trừ 12 phút đi muộn (nếu không có đơn).</div>
      </div>
    </div>
  );
};
