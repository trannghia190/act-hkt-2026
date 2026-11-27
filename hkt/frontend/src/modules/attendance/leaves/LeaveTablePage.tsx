import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, CalendarRange, Search, Users } from 'lucide-react';
import { Badge } from '../../../components/common/Badge';
import { Panel } from '../../../components/common/Panel';

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

const initials = (name: string) => {
  const parts = name.trim().split(/\s+/);
  return (parts.length >= 2 ? parts[parts.length - 2][0] + parts[parts.length - 1][0] : name.slice(0, 2)).toUpperCase();
};

const remaining = (r: Row) => r.annualRemaining + r.carriedRemaining;

// Cột số của sổ phép: nhãn + tooltip giải thích nghiệp vụ + khoá lấy số.
const numericCols: { key: keyof Row; label: string; hint: string; cls?: string }[] = [
  { key: 'grantedThisYear', label: 'Đã cấp', hint: 'Tổng phép năm được cấp trong năm đến hiện tại (gồm điều chỉnh của HR, không gồm phép tồn & thâm niên)' },
  { key: 'carriedGrant', label: 'Tồn cũ', hint: 'Tổng phép tồn được bảo lưu từ năm trước' },
  { key: 'seniority', label: 'Thâm niên', hint: 'Tổng phép thâm niên được cấp theo thâm niên làm việc' },
  { key: 'annualUsed', label: 'Đã dùng', hint: 'Số ngày nghỉ phép năm đã dùng (không gồm nghỉ ốm)' },
  { key: 'annualRemaining', label: 'Năm còn', hint: 'Phép năm của năm nay còn lại', cls: 'font-semibold text-ink' },
  { key: 'carriedRemaining', label: 'Tồn còn', hint: 'Phép tồn còn lại sau hạn 01/04 (tối đa 5 ngày) và 01/07 (về 0)', cls: 'font-semibold text-ink' },
  { key: 'sickUsed', label: 'Ốm', hint: 'Số ngày nghỉ ốm đã dùng' },
];

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

  const teams = useMemo(() => Array.from(new Set(data.map(r => r.team))), [data]);

  /** Lọc theo nhóm + tìm kiếm — chip đếm dựa trên tập này để số luôn khớp. */
  const base = useMemo(() => data.filter(r => {
    if (team !== 'ALL' && r.team !== team) return false;
    const q = search.trim().toLowerCase();
    return !q || r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q);
  }), [data, team, search]);

  const counts = useMemo(() => ({
    ALL: base.length,
    NEAR: base.filter(r => { const rem = remaining(r); return rem > 0 && rem < 2; }).length,
    OUT: base.filter(r => remaining(r) <= 0).length,
  }), [base]);

  const filtered = useMemo(() => base.filter(r => {
    const rem = remaining(r);
    if (status === 'NEAR') return rem > 0 && rem < 2;
    if (status === 'OUT') return rem <= 0;
    return true;
  }), [base, status]);

  const total = (fn: (r: Row) => number) => filtered.reduce((a, r) => a + fn(r), 0);
  const totalRemaining = total(remaining);
  const nearCount = filtered.filter(r => { const rem = remaining(r); return rem > 0 && rem < 2; }).length;
  const outCount = filtered.filter(r => remaining(r) <= 0).length;

  const chip = (id: string, label: string, cnt: number) => (
    <button
      key={id}
      type="button"
      onClick={() => setStatus(id)}
      aria-pressed={status === id}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
        status === id ? 'border-accent bg-accent-soft text-accent-dark' : 'border-line bg-surface text-ink-secondary hover:border-line-hover'
      }`}
    >
      {label}
      <span className="font-mono text-[10px] opacity-70">{cnt}</span>
    </button>
  );

  const numClass = (v: number) => (v <= 0 ? 'text-status-danger' : v < 2 ? 'text-status-warn' : 'text-ink-secondary');

  return (
    <div className="mx-auto max-w-5xl space-y-4 pb-24">
      {/* Đầu trang */}
      <div className="min-w-0">
        <div className="inline-flex items-center gap-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-accent-dark">
          <CalendarRange className="h-3.5 w-3.5" />
          Chấm công
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <h1 className="font-display text-xl font-extrabold tracking-tight text-ink sm:text-[23px]">
            Bảng phép toàn công ty
          </h1>
          <Badge variant="accent">T9</Badge>
        </div>
        <p className="mt-1 text-xs text-ink-muted">
          1 dòng = 1 người · bấm tên để mở sổ phép chi tiết. Người còn dưới 2 ngày được tô vàng.
        </p>
      </div>

      {/* Tổng quan — số đếm khớp bộ lọc hiện tại */}
      <div className="overflow-hidden rounded-[16px] border border-line bg-ink px-5 py-4 text-canvas">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-canvas/60">Tổng quan phép</div>
            <div className="mt-1 font-display text-lg font-extrabold">Năm nay · toàn công ty</div>
            <p className="mt-1 max-w-md text-xs leading-relaxed text-canvas/75">
              Số dư phép từng nhân viên tính đến hôm nay — cộng phép năm, phép thâm niên và tồn năm cũ; trừ ngày đã nghỉ.
            </p>
          </div>
          <dl className="ml-auto flex gap-7">
            <div>
              <dd className="font-display text-2xl font-extrabold tabular-nums">{filtered.length}</dd>
              <dt className="text-[11px] text-canvas/60">nhân viên</dt>
            </div>
            <div>
              <dd className="font-display text-2xl font-extrabold tabular-nums">{fmt(totalRemaining)}</dd>
              <dt className="text-[11px] text-canvas/60">ngày còn lại</dt>
            </div>
            <div>
              <dd className="font-display text-2xl font-extrabold tabular-nums text-status-warn">{nearCount}</dd>
              <dt className="text-[11px] text-canvas/60">sắp hết (&lt; 2)</dt>
            </div>
            <div>
              <dd className="font-display text-2xl font-extrabold tabular-nums text-status-danger">{outCount}</dd>
              <dt className="text-[11px] text-canvas/60">đã hết</dt>
            </div>
          </dl>
        </div>
      </div>

      {/* Bộ lọc */}
      <Panel bodyClassName="space-y-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1 sm:max-w-[300px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Tìm tên / mã nhân viên…"
              className="w-full rounded-lg border border-line bg-surface py-1.5 pl-8 pr-2.5 text-xs text-ink placeholder:text-ink-muted"
            />
          </div>
          <select
            value={team}
            onChange={e => setTeam(e.target.value)}
            className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink-secondary"
          >
            <option value="ALL">Tất cả nhóm</option>
            {teams.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-ink-muted">
            <Users className="h-3.5 w-3.5" />
            {filtered.length} nhân viên
          </span>
        </div>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5">
          {chip('ALL', 'Tất cả', counts.ALL)}
          {chip('NEAR', 'Sắp hết (< 2)', counts.NEAR)}
          {chip('OUT', 'Đã hết', counts.OUT)}
        </div>
      </Panel>

      {/* Bảng — desktop */}
      <Panel
        title="Số dư phép từng nhân viên"
        subtitle="Cột nhân viên dính trái khi cuộn ngang"
        className="hidden sm:block"
        bodyClassName="p-0"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[840px] text-xs">
            <thead className="bg-canvas text-[9.5px] font-extrabold uppercase tracking-[0.07em] text-ink-muted">
              <tr>
                <th className="sticky left-0 z-10 border-r border-line-soft bg-canvas px-2.5 py-2.5 text-left">Nhân viên</th>
                {numericCols.map(c => (
                  <th key={c.key} className="whitespace-nowrap px-2.5 py-2.5 text-right" title={c.hint}>{c.label}</th>
                ))}
                <th className="w-8 px-2 py-2.5" aria-label="Mở sổ phép" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const rem = remaining(r);
                return (
                  <tr key={r.code} className="border-b border-line-soft last:border-0 hover:bg-canvas/60">
                    <td className="sticky left-0 z-10 border-r border-line-soft bg-surface px-2.5 py-2.5">
                      <Link to={`/attendance/leave-ledger?user=${encodeURIComponent(r.code)}`} className="flex items-center gap-2.5">
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent-soft text-[10px] font-extrabold text-accent-dark">
                          {initials(r.name)}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[12.5px] font-semibold text-ink hover:text-accent-dark">{r.name}</span>
                          <span className="mt-px block font-mono text-[10.5px] text-ink-muted">{r.code} · {r.team}</span>
                        </span>
                      </Link>
                    </td>
                    {numericCols.map(c => (
                      <td key={c.key} className={`whitespace-nowrap px-2.5 py-2.5 text-right font-mono text-[12px] ${c.cls || ''}`}>
                        {fmt(Number(r[c.key]))}
                      </td>
                    ))}
                    <td className="px-2 py-2.5 text-right">
                      <Link
                        to={`/attendance/leave-ledger?user=${encodeURIComponent(r.code)}`}
                        aria-label={`Mở sổ phép ${r.name}`}
                        title="Mở sổ phép"
                        className="inline-flex text-ink-muted hover:text-accent-dark"
                      >
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={numericCols.length + 2} className="px-4 py-8 text-center text-xs text-ink-muted">
                    Không có nhân viên nào khớp bộ lọc.
                  </td>
                </tr>
              )}
            </tbody>
            {filtered.length > 0 && (
              <tfoot className="border-t border-line bg-canvas font-semibold text-ink">
                <tr>
                  <td className="sticky left-0 z-10 bg-canvas px-2.5 py-2.5 text-left">Tổng · {filtered.length} nhân viên</td>
                  {numericCols.map(c => (
                    <td key={c.key} className="whitespace-nowrap px-2.5 py-2.5 text-right font-mono text-[12px]">
                      {fmt(total(r => Number(r[c.key])))}
                    </td>
                  ))}
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Panel>

      {/* Card — mobile */}
      <div className="space-y-2 sm:hidden">
        {filtered.map(r => {
          const rem = remaining(r);
          return (
            <Link
              key={r.code}
              to={`/attendance/leave-ledger?user=${encodeURIComponent(r.code)}`}
              className="block rounded-[13px] border border-line bg-surface p-3 hover:border-line-hover"
            >
              <div className="flex items-start gap-2.5">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent-soft text-[10px] font-extrabold text-accent-dark">
                  {initials(r.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12.5px] font-semibold text-ink">{r.name}</span>
                  <span className="mt-px block font-mono text-[10.5px] text-ink-muted">{r.code} · {r.team}</span>
                </span>
                <Badge variant={rem <= 0 ? 'danger' : rem < 2 ? 'warn' : 'gray'}>
                  {rem <= 0 ? 'Hết phép' : `Còn ${fmt(rem)} ngày`}
                </Badge>
              </div>
              <div className="mt-2.5 grid grid-cols-3 gap-2">
                {[
                  ['phép năm còn', r.annualRemaining],
                  ['tồn còn', r.carriedRemaining],
                  ['đã dùng', r.annualUsed],
                ].map(([label, v]) => (
                  <div key={label as string} className="rounded-lg bg-canvas px-2 py-1.5">
                    <div className={`font-mono text-[13px] font-bold ${numClass(Number(v))}`}>{fmt(Number(v))}</div>
                    <div className="mt-px text-[9px] text-ink-muted">{label}</div>
                  </div>
                ))}
              </div>
            </Link>
          );
        })}
        {filtered.length === 0 && (
          <div className="rounded-[13px] border border-line bg-surface px-4 py-8 text-center text-xs text-ink-muted">
            Không có nhân viên nào khớp bộ lọc.
          </div>
        )}
      </div>

      <div className="rounded-[13px] border border-line bg-canvas p-3.5 text-[11px] leading-relaxed text-ink-muted">
        <b className="text-ink-secondary">Đọc số:</b> “Năm còn” = phép năm được cấp − đã dùng; “Tồn còn” là phép năm cũ
        còn hiệu lực sau hạn 01/04 (tối đa 5 ngày) và 01/07 (về 0). Sắp hết = tổng còn dưới 2 ngày; đã hết = 0 ngày.
      </div>
    </div>
  );
};
