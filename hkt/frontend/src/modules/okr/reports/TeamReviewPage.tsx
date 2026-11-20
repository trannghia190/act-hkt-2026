import React, { useEffect, useState } from 'react';
const rows = [
  { code: '136ACT', name: 'Vũ Văn Luận', business: 4, people: 4 },
  { code: '05ACT', name: 'Nguyễn Thanh Tùng', business: 5, people: 4 },
];
export const TeamReviewPage: React.FC = () => {
  const [data, setData] = useState(rows);
  useEffect(() => {
    fetch('/api/v1/okr/team-review')
      .then(r => r.json())
      .then(j => { if (Array.isArray(j?.data)) setData(j.data.map((r: any) => ({ code: r.employeeCode, name: r.fullName, business: r.businessScore ?? 0, people: r.peopleScore ?? 0 }))); })
      .catch(() => undefined);
  }, []);
  return (
  <div className="max-w-3xl mx-auto space-y-4">
    <div className="bg-canvas border border-line rounded-xl p-6">
      <h1 className="text-xl font-bold text-ink mt-1">Review OKR cả nhóm</h1>
      <p className="text-xs text-ink-muted mt-1">1 bảng thay vì mở từng objective; điểm 1–5 từng nhóm, điểm TB tự tính.</p>
    </div>
    <div className="bg-surface border border-line rounded-xl overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-canvas text-ink-secondary"><tr><th className="text-left p-3">Nhân viên</th><th className="p-3">Business</th><th className="p-3">People</th><th className="p-3">Điểm TB</th><th className="p-3">Trạng thái</th></tr></thead>
        <tbody>
          {data.map(r => (
            <tr key={r.code} className="border-t border-line">
              <td className="p-3"><div className="font-semibold">{r.name}</div><div className="text-xs text-ink-muted">{r.code}</div></td>
              <td className="p-3 text-center">{r.business}</td><td className="p-3 text-center">{r.people}</td>
              <td className="p-3 text-center font-bold">{(r.business + r.people) / 2}</td>
              <td className="p-3 text-center text-xs text-ink-muted">Chờ chấm</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
  );
};
