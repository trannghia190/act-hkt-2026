import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

interface Row {
  code: string;
  name: string;
  team: string;
  grantedThisYear: number; // tổng phép năm được cấp trong năm (gồm điều chỉnh HR)
  carriedGrant: number;    // tổng phép tồn được bảo lưu từ năm cũ
  seniority: number;       // tổng phép thâm niên
  annualUsed: number;      // nghỉ phép đã dùng (không gồm nghỉ ốm)
  annualRemaining: number; // phép năm còn lại
  carriedRemaining: number;// phép tồn còn lại
  sickUsed: number;        // phép ốm đã dùng
}

// Luôn lấy từ API — không dùng dữ liệu mẫu.
const initial: Row[] = [];

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export const LeaveTablePage: React.FC = () => {
  const [data, setData] = useState<Row[]>(initial);
  const [team, setTeam] = useState('ALL');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');

  useEffect(() => {
    const token = (() => { try { return JSON.parse(localStorage.getItem('pulse_auth_user') || '{}')?.accessToken; } catch { return ''; } })();
    fetch('/api/v1/leaves/table', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => r.json())
      .then(j => {
        if (Array.isArray(j?.data) && j.data.length) {
          setData(j.data.map((u: any) => ({
            code: u.employeeCode, name: u.fullName, team: u.teamName || '—',
            grantedThisYear: Number(u.grantedThisYear ?? (Number(u.baseAnnual ?? 0) + Number(u.adjust ?? 0))),
            carriedGrant: Number(u.carriedGrant ?? 0),
            seniority: Number(u.seniority ?? 0),
            annualUsed: Number(u.annualUsed ?? u.used ?? 0),
            annualRemaining: Number(u.annualRemaining ?? 0),
            carriedRemaining: Number(u.carriedRemaining ?? u.carriedOver ?? 0),
            sickUsed: Number(u.sickUsed ?? 0),
          })));
        }
      })
      .catch(() => undefined);
  }, []);

  const teams = Array.from(new Set(data.map(r => r.team)));
  const filtered = data.filter(r => {
    if (team !== 'ALL' && r.team !== team) return false;
    const rem = r.annualRemaining + r.carriedRemaining;
    if (status === 'NEAR' && rem >= 2) return false;
    if (status === 'OUT' && rem > 0) return false;
    const q = search.trim().toLowerCase();
    return !q || r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q);
  });
  const total = (fn: (r: Row) => number) => filtered.reduce((a, r) => a + fn(r), 0);

  // Cột số của sổ phép: nhãn + tooltip giải thích nghiệp vụ + khoá lấy số.
  const numericCols: { key: keyof Row; label: string; hint: string; cls?: string }[] = [
    { key: 'grantedThisYear', label: 'Phép năm đã cấp', hint: 'Tổng phép năm được cấp trong năm đến hiện tại (gồm điều chỉnh của HR, không gồm phép tồn & thâm niên)' },
    { key: 'carriedGrant', label: 'Phép tồn năm cũ', hint: 'Tổng phép tồn được bảo lưu từ năm trước' },
    { key: 'seniority', label: 'Phép thâm niên', hint: 'Tổng phép thâm niên được cấp theo thâm niên làm việc' },
    { key: 'annualUsed', label: 'Đã dùng', hint: 'Số ngày nghỉ phép năm đã dùng (không gồm nghỉ ốm)' },
    { key: 'annualRemaining', label: 'Phép năm còn lại', hint: 'Phép năm của năm nay còn lại', cls: 'font-semibold text-ink' },
    { key: 'carriedRemaining', label: 'Phép tồn còn lại', hint: 'Phép tồn còn lại sau hạn 01/04 (tối đa 5 ngày) và 01/07 (về 0)', cls: 'font-semibold text-ink' },
    { key: 'sickUsed', label: 'Ốm đã dùng', hint: 'Số ngày nghỉ ốm đã dùng' },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-canvas border border-line rounded-xl p-6">
        <h1 className="text-xl font-bold text-ink mt-1">Bảng phép tất cả mọi người</h1>
        <p className="text-xs text-ink-muted mt-1">1 dòng = 1 người; click tên để mở sổ phép chi tiết. Người còn &lt; 2 ngày được đánh dấu.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <input className="text-xs px-3 py-2 rounded-lg border border-line bg-surface" placeholder="Tìm tên / mã NV" value={search} onChange={e => setSearch(e.target.value)} />
        <select className="text-xs px-2 py-2 rounded-lg border border-line bg-surface" value={team} onChange={e => setTeam(e.target.value)}>
          <option value="ALL">Tất cả nhóm</option>
          {teams.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className="text-xs px-2 py-2 rounded-lg border border-line bg-surface" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="ALL">Mọi người</option>
          <option value="NEAR">Sắp hết phép (&lt; 2 ngày)</option>
          <option value="OUT">Đã hết phép</option>
        </select>
        <span className="text-xs text-ink-muted self-center">Người sắp hết phép được tô vàng</span>
      </div>

      {/* Màn hình hẹp hơn min-width sẽ cuộn ngang; cột nhân viên dính trái để không mất ngữ cảnh. */}
      <div className="bg-surface border border-line rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[1080px]">
          <thead className="bg-canvas text-ink-secondary">
            <tr>
              <th className="text-left p-3 sticky left-0 bg-canvas z-10 border-r border-line">Nhân viên</th>
              <th className="p-3">Nhóm</th>
              {numericCols.map(c => (
                <th key={c.key} className="p-3 whitespace-nowrap" title={c.hint}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => {
              const rem = r.annualRemaining + r.carriedRemaining;
              return (
                <tr key={r.code} className={`border-t border-line ${rem < 2 ? 'bg-amber-50' : ''}`}>
                  <td className={`p-3 sticky left-0 border-r border-line ${rem < 2 ? 'bg-amber-50' : 'bg-surface'}`}>
                    <Link className="font-semibold hover:underline" to={`/attendance/leave-ledger?user=${r.code}`}>{r.name}</Link>
                    <div className="text-xs text-ink-muted">{r.code}</div>
                  </td>
                  <td className="p-3 text-center whitespace-nowrap">{r.team}</td>
                  {numericCols.map(c => (
                    <td key={c.key} className={`p-3 text-center whitespace-nowrap ${c.cls || ''}`} title={c.hint}>
                      {fmt(r[c.key] as number)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-line font-bold bg-canvas">
              <td className="p-3 sticky left-0 bg-canvas border-r border-line" colSpan={2}>Tổng ({filtered.length} người)</td>
              {numericCols.map(c => (
                <td key={c.key} className="p-3 text-center whitespace-nowrap">{fmt(total(r => r[c.key] as number))}</td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="text-[11px] text-ink-muted">
        Ghi chú: “Phép năm đã cấp” = phép chuẩn của năm + điều chỉnh của HR. Phép tồn chỉ dùng được đến 01/04 (giữ tối đa 5 ngày) và hết hiệu lực từ 01/07 theo quy chế.
      </p>
    </div>
  );
};
