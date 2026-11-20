import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

interface Row { code: string; name: string; team: string; annual: number; carried: number; sick: number; seniority: number; used: number; }

// Luôn lấy từ API — không dùng dữ liệu mẫu.
const initial: Row[] = [];

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
            annual: Number(u.annualRemaining ?? u.granted ?? 0), carried: Number(u.carriedOver ?? 0),
            sick: Number(u.sickUsed ?? 0), seniority: Number(u.seniority ?? 0), used: Number(u.totalUsed ?? u.used ?? 0),
          })));
        }
      })
      .catch(() => undefined);
  }, []);

  const teams = Array.from(new Set(data.map(r => r.team)));
  const filtered = data.filter(r => {
    if (team !== 'ALL' && r.team !== team) return false;
    const rem = r.annual + r.carried;
    if (status === 'NEAR' && rem >= 2) return false;
    if (status === 'OUT' && rem > 0) return false;
    const q = search.trim().toLowerCase();
    return !q || r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q);
  });
  const total = (fn: (r: Row) => number) => filtered.reduce((a, r) => a + fn(r), 0);

  return (
    <div className="max-w-5xl mx-auto space-y-4">
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

      <div className="bg-surface border border-line rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-canvas text-ink-secondary">
            <tr><th className="text-left p-3">Nhân viên</th><th className="p-3">Nhóm</th><th className="p-3">Phép năm còn</th><th className="p-3">Phép tồn</th><th className="p-3">Ốm đã dùng</th><th className="p-3">Thâm niên</th><th className="p-3">Tổng đã dùng</th></tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.code} className={`border-t border-line ${r.annual + r.carried < 2 ? 'bg-amber-50' : ''}`}>
                <td className="p-3"><Link className="font-semibold hover:underline" to={`/attendance/leave-ledger?user=${r.code}`}>{r.name}</Link><div className="text-xs text-ink-muted">{r.code}</div></td>
                <td className="p-3 text-center">{r.team}</td>
                <td className="p-3 text-center">{r.annual}</td>
                <td className="p-3 text-center">{r.carried}</td>
                <td className="p-3 text-center">{r.sick}</td>
                <td className="p-3 text-center">{r.seniority}</td>
                <td className="p-3 text-center">{r.used}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-line font-bold bg-canvas">
              <td className="p-3" colSpan={2}>Tổng ({filtered.length} người)</td>
              <td className="p-3 text-center">{total(r => r.annual)}</td>
              <td className="p-3 text-center">{total(r => r.carried)}</td>
              <td className="p-3 text-center">{total(r => r.sick)}</td>
              <td className="p-3 text-center">{total(r => r.seniority)}</td>
              <td className="p-3 text-center">{total(r => r.used)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};
