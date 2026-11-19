import React, { useEffect, useState } from 'react';
interface LeaveType { code: string; name: string; days: string; attachment: boolean; }
const initial: LeaveType[] = [
  { code: 'AL', name: 'Phép năm', days: '12/năm', attachment: false },
  { code: 'S', name: 'Nghỉ ốm', days: 'Theo BHXH', attachment: true },
  { code: 'ML', name: 'Thai sản', days: '6–7 tháng', attachment: true },
  { code: 'HI', name: 'Hiếu hỉ', days: '3 ngày', attachment: false },
  { code: 'TG', name: 'Tang gia', days: '3 ngày', attachment: false },
];
export const LeaveTypesPage: React.FC = () => {
  const [types, setTypes] = useState(initial);
  useEffect(() => {
    fetch('/api/v1/leave-types')
      .then(r => r.json())
      .then(j => { if (Array.isArray(j?.data)) setTypes(j.data.map((t: any) => ({ code: t.code, name: t.name, days: t.defaultDays ? `${t.defaultDays}/năm` : 'Theo BHXH', attachment: !!t.requiresAttachment }))); })
      .catch(() => undefined);
  }, []);
  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="bg-canvas border border-line rounded-xl p-6">
        <div className="text-xs text-accent font-semibold">S32 · HR</div>
        <h1 className="text-xl font-bold text-ink mt-1">Quản lý loại nghỉ</h1>
        <p className="text-xs text-ink-muted mt-1">Thêm/sửa loại nghỉ không cần sửa code — mô hình 3 tầng: rule chung → loại nghỉ → đơn.</p>
      </div>
      <div className="bg-surface border border-line rounded-xl p-4">
        {types.map(t => (
          <div key={t.code} className="flex items-center justify-between border border-line rounded-lg px-3 py-2 mb-2 text-sm">
            <div><span className="font-mono text-xs text-accent mr-2">{t.code}</span><span className="font-semibold">{t.name}</span></div>
            <div className="text-xs text-ink-muted">{t.days} · {t.attachment ? 'cần giấy tờ' : 'không cần giấy tờ'}</div>
          </div>
        ))}
        <button className="text-xs px-3 py-1.5 rounded border border-line">+ Thêm loại nghỉ</button>
      </div>
    </div>
  );
};
