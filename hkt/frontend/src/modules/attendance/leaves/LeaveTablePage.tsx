import React, { useEffect, useState } from 'react';
const rows = [
  { code: '136ACT', name: 'Vũ Văn Luận', team: 'Optimus', annual: 8.5, carried: 5, used: 3.5 },
  { code: '05ACT', name: 'Nguyễn Thanh Tùng', team: 'Sirius', annual: 12, carried: 2, used: 6 },
  { code: '01HR', name: 'Nguyễn Thị Thu Hà', team: 'HR', annual: 15, carried: 0, used: 4 },
];
export const LeaveTablePage: React.FC = () => {
  const [data, setData] = useState(rows);
  useEffect(() => {
    fetch('/api/v1/leaves/table')
      .then(r => r.json())
      .then(j => { if (Array.isArray(j?.data) && j.data.length) setData(j.data.map((u: any) => ({ code: u.employeeCode, name: u.fullName, team: u.team || '—', annual: Number(u.granted || 0), carried: 0, used: Number(u.used || 0) }))); })
      .catch(() => undefined);
  }, []);
  return (
  <div className="max-w-4xl mx-auto space-y-4">
    <div className="bg-canvas border border-line rounded-xl p-6">
      <div className="text-xs text-accent font-semibold">S46 · HR</div>
      <h1 className="text-xl font-bold text-ink mt-1">Bảng phép tất cả mọi người</h1>
      <p className="text-xs text-ink-muted mt-1">Nhìn 1 lần biết ai còn bao nhiêu; click vào tên để mở sổ phép.</p>
    </div>
    <div className="bg-surface border border-line rounded-xl overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-canvas text-ink-secondary">
          <tr><th className="text-left p-3">Nhân viên</th><th className="p-3">Nhóm</th><th className="p-3">Phép năm</th><th className="p-3">Phép tồn</th><th className="p-3">Đã dùng</th><th className="p-3">Còn lại</th></tr>
        </thead>
        <tbody>
          {data.map(r => (
            <tr key={r.code} className="border-t border-line">
              <td className="p-3"><div className="font-semibold">{r.name}</div><div className="text-xs text-ink-muted">{r.code}</div></td>
              <td className="p-3 text-center">{r.team}</td>
              <td className="p-3 text-center">{r.annual}</td>
              <td className="p-3 text-center">{r.carried}</td>
              <td className="p-3 text-center">{r.used}</td>
              <td className="p-3 text-center font-bold text-accent">{r.annual + r.carried - r.used}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
  );
};
