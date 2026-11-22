import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '../../../components/common/Card';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';

interface LeaveLedgerEntry {
  id: string;
  date: string;
  type: 'GRANT' | 'USED' | 'EXPIRED' | 'ADJUST';
  description: string;
  amount: number;
  balanceAfter: number;
  leaveType?: string;
  createdAt?: string;
}

export const LeavesPage: React.FC = () => {
  const [balance, setBalance] = useState({
    carriedOver: 0,
    grantedCurrentYear: 0,
    seniorityBonus: 0,
    totalEntitlement: 0,
    used: 0,
    remaining: 0,
    expiringOnMarch31: 0,
    annualRemaining: 0,
    carriedRemaining: 0,
    sickUsed: 0,
    adjust: 0,
    baseAnnual: 0,
    positionBonus: 0,
    carriedGrant: 0,
    expiredCarry: 0,
    carryStatus: 'AVAILABLE',
    byType: [] as { code: string; name: string; used: number; defaultDays: number | null; unit?: string }[],
  });

  const [ledger, setLedger] = useState<LeaveLedgerEntry[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<{ code: string; name: string }[]>([]);

  useEffect(() => {
    const token = (() => { try { return JSON.parse(localStorage.getItem('pulse_auth_user') || '{}')?.accessToken; } catch { return ''; } })();
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    fetch('/api/v1/leaves/my-balance', { headers }).then(r => r.json()).then(j => {
      if (j?.data) {
        const granted = Number(j.data.granted || 0);
        const used = Number(j.data.used || 0);
        const carried = Number(j.data.carriedRemaining ?? 0);
        const annual = Number(j.data.annualRemaining ?? 0);
        const seniority = Number(j.data.seniority ?? 0);
        const adjust = Number(j.data.adjust ?? 0);
        setBalance(b => ({ ...b, grantedCurrentYear: granted, totalEntitlement: granted + adjust - Number(j.data.expiredCarry ?? 0), used,
          remaining: Number(j.data.remaining || 0),
          annualRemaining: annual,
          carriedRemaining: carried,
          carriedOver: carried,
          seniorityBonus: seniority,
          adjust,
          sickUsed: Number(j.data.sickUsed ?? 0),
          baseAnnual: Number(j.data.baseAnnual ?? 0),
          positionBonus: Number(j.data.positionBonus ?? 0),
          carriedGrant: Number(j.data.carriedGrant ?? 0),
          expiredCarry: Number(j.data.expiredCarry ?? 0),
          carryStatus: String(j.data.carryStatus || 'AVAILABLE'),
          byType: Array.isArray(j.data.byType) ? j.data.byType.map((x: any) => ({
            code: x.code, name: x.name, used: Number(x.used || 0),
            defaultDays: x.defaultDays == null ? null : Number(x.defaultDays), unit: x.unit,
          })) : [],
          expiringOnMarch31: carried }));
      }
    }).catch(() => undefined);
    fetch('/api/v1/leave-types', { headers }).then(r => r.json()).then(j => { if (Array.isArray(j?.data)) setLeaveTypes(j.data.map((x: any) => ({ code: x.code, name: x.name }))); }).catch(() => undefined);
    fetch('/api/v1/leaves/my-ledger', { headers }).then(r => r.json()).then(j => {
      if (Array.isArray(j?.data)) {
        setLedger(j.data.map((e: any) => ({
          id: e.id, date: e.createdAt ? new Date(e.createdAt).toLocaleDateString('vi-VN') : '—',
          type: e.action, description: e.reason || e.leaveType, amount: Number(e.amount || 0), leaveType: e.leaveType, createdAt: e.createdAt,
          balanceAfter: Number(e.balanceAfter || 0),
        })));
      }
    }).catch(() => undefined);
  }, []);

  const [filterType, setFilterType] = useState('Tất cả');
  const [filterYear, setFilterYear] = useState('2026');
  const leaveTypeName = (code?: string) => leaveTypes.find(t => t.code === code)?.name || code || 'Phép năm';
  const hasGrantFor = (code?: string) => ledger.some(e => e.type === 'GRANT' && (e.leaveType || 'AL') === (code || 'AL'));
  const ledgerWithBalance = useMemo(() => {
    const asc = [...ledger].sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
    const runningByType: Record<string, number> = {};
    const byId: Record<string, number> = {};
    for (const e of asc) {
      const code = (e.leaveType || 'AL').toUpperCase();
      runningByType[code] = (runningByType[code] || 0) + e.amount;
      byId[e.id] = Math.round(runningByType[code] * 100) / 100;
    }
    return ledger.map(e => ({ ...e, balanceAfter: byId[e.id] ?? e.balanceAfter }));
  }, [ledger]);

  const filteredLedger = ledgerWithBalance.filter(entry => {
    if (filterYear !== 'Tất cả' && !entry.date.endsWith(filterYear)) return false;
    if (filterType === 'Tất cả') return true;
    if (filterType === 'Phép năm') return entry.leaveType === 'AL';
    if (filterType === 'Phép ốm') return entry.leaveType === 'S';
    if (filterType === 'Nghỉ bù') return entry.description.toLowerCase().includes('bù');
    if (filterType === 'Phép tồn') return entry.description.toLowerCase().includes('bảo lưu') || entry.description.toLowerCase().includes('tồn');
    if (filterType === 'Chức vụ') return entry.description.toLowerCase().includes('chức vụ');
    if (filterType === 'Thâm niên') return entry.description.toLowerCase().includes('thâm niên');
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-ink">Số Dư Phép &amp; Sổ Phép Cá Nhân</h1>
          </div>
          <p className="text-xs text-ink-muted mt-1">
            Minh bạch từng ngày nghỉ phép năm, bảo lưu phép năm cũ và hạn chót sử dụng trước ngày 31/03
          </p>
        </div>
      </div>

      {/* Expiration Alert */}
      <div className="p-4 bg-amber-50 rounded-xl border border-amber-300 text-xs flex items-start gap-3 text-amber-900 shadow-xs">
        <span className="text-lg">⚠️</span>
        <div>
          <div className="font-bold">Luật phép tồn: 01/04 giữ tối đa 5 ngày · 01/07 về 0</div>
          <p className="mt-0.5 text-amber-800 leading-relaxed">
            {balance.carryStatus === 'EXPIRED' || balance.expiringOnMarch31 <= 0
              ? <>Phép tồn năm trước đã <strong>hết hiệu lực từ 01/07</strong> theo quy chế (01/04 giữ tối đa 5 ngày · 01/07 về 0). Số dư hiện tại không còn phép tồn.</>
              : balance.carryStatus === 'CAPPED'
              ? <>Đã qua <strong>01/04</strong>: chỉ được giữ tối đa <strong>5 ngày phép tồn</strong>. Bạn còn <strong>{balance.expiringOnMarch31} ngày</strong>; phần vượt sẽ hết hiệu lực từ <strong>01/07</strong>.</>
              : <>Bạn có <strong>{balance.expiringOnMarch31} ngày phép tồn</strong>; dùng trước <strong>01/04</strong>. Từ 01/04 chỉ giữ tối đa 5 ngày, từ <strong>01/07</strong> về 0.</>}
          </p>
        </div>
      </div>

      {/* Balance Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-surface rounded-xl border border-line">
          <div className="text-xs text-ink-muted">Phép tồn năm cũ</div>
          <div className="text-2xl font-bold text-amber-700 mt-1">{balance.carriedGrant} ngày</div>
          <div className="text-[11px] text-amber-600 mt-1">
            Đã cấp {balance.carriedGrant} · còn {balance.carriedRemaining} sau luật tồn
            {balance.expiredCarry ? ` · ${balance.expiredCarry} hết hạn` : ''}
          </div>
        </div>

        <div className="p-4 bg-surface rounded-xl border border-line">
          <div className="text-xs text-ink-muted">Phép năm</div>
          <div className="text-2xl font-bold text-ink mt-1">{balance.baseAnnual} ngày</div>
          <div className="text-[11px] text-ink-muted mt-1">Cấp theo quy chế phép năm (không gồm tồn/chức vụ/thâm niên)</div>
        </div>

        <div className="p-4 bg-surface rounded-xl border border-line">
          <div className="text-xs text-ink-muted">Phép chức vụ</div>
          <div className="text-2xl font-bold text-ink mt-1">{balance.positionBonus} ngày</div>
          <div className="text-[11px] text-ink-muted mt-1">
            {balance.positionBonus > 0 ? 'Theo cấu hình phép chức vụ (đã nằm trong tổng phép năm)' : 'Chức vụ hiện tại không được cộng thêm phép'}
          </div>
        </div>

        <div className="p-4 bg-surface rounded-xl border border-line">
          <div className="text-xs text-ink-muted">Phép thâm niên</div>
          <div className="text-2xl font-bold text-ink mt-1">{balance.seniorityBonus} ngày</div>
          <div className="text-[11px] text-ink-muted mt-1">+1 ngày mỗi 2 năm, cộng đúng ngày tròn</div>
        </div>

        <div className="p-4 bg-surface rounded-xl border border-line">
          <div className="text-xs text-ink-muted">Phép đã sử dụng</div>
          <div className="text-2xl font-bold text-rose-700 mt-1">{balance.used} ngày</div>
          <div className="text-[11px] text-rose-600 mt-1">{ledger.filter(e => e.type === 'USED' && e.amount < 0).length} đợt nghỉ đã được duyệt</div>
        </div>

        <div className="p-4 bg-surface rounded-xl border border-accent/40 bg-accent-soft/20">
          <div className="text-xs text-accent-dark font-medium">Phép còn lại</div>
          <div className="text-2xl font-extrabold text-accent mt-1">{balance.remaining} ngày</div>
          <div className="text-[11px] text-accent-dark mt-1">Phép năm {balance.annualRemaining} + Phép tồn {balance.carriedRemaining}</div>
          {(() => {
            const total = balance.baseAnnual + balance.positionBonus + balance.seniorityBonus + balance.carriedGrant;
            return (
              <>
                <div className="mt-2 h-1.5 bg-line rounded-full overflow-hidden"><div className="h-full bg-accent" style={{ width: `${total > 0 ? Math.min(100, Math.round((balance.used / total) * 100)) : 0}%` }} /></div>
                <div className="text-[10px] text-ink-muted mt-1">Đã dùng {balance.used}/{total} ngày được cấp</div>
              </>
            );
          })()}
        </div>

        <div className="p-4 bg-surface rounded-xl border border-line">
          <div className="text-xs text-ink-muted">Phép tồn còn lại (hạn 01/07)</div>
          <div className="text-2xl font-bold text-amber-700 mt-1">{balance.carriedRemaining} ngày</div>
          <div className="text-[11px] text-amber-600 mt-1">{balance.carryStatus === 'EXPIRED' ? 'Đã hết hiệu lực từ 01/07' : balance.carryStatus === 'CAPPED' ? 'Từ 01/04 chỉ giữ tối đa 5 ngày' : 'Dùng trước 01/04 · giữ tối đa 5 từ 01/04'}</div>
        </div>

        <div className="p-4 bg-surface rounded-xl border border-line">
          <div className="text-xs text-ink-muted">Phép ốm (S)</div>
          <div className="text-2xl font-bold text-ink mt-1">{balance.sickUsed} ngày</div>
          <div className="text-[11px] text-ink-muted mt-1">Theo BHXH · cần giấy tờ</div>
        </div>
      </div>

      {/* Bộ lọc lịch sử phép */}
      <div className="flex flex-wrap items-center gap-2">
        {['Tất cả', 'Phép năm', 'Phép tồn', 'Phép ốm', 'Nghỉ bù', 'Chức vụ', 'Thâm niên'].map(f => (
          <button key={f} onClick={() => setFilterType(f)}
            className={`text-xs px-3 py-1.5 rounded-full border ${filterType === f ? 'bg-accent text-white border-accent' : 'bg-surface border-line text-ink-secondary'}`}>
            {f}
          </button>
        ))}
        <select value={filterYear} onChange={e => setFilterYear(e.target.value)} className="ml-auto text-xs px-2 py-1.5 rounded-lg border border-line bg-surface text-ink">
          <option value="2026">Năm: 2026</option>
          <option value="2025">Năm: 2025</option>
          <option value="Tất cả">Tất cả năm</option>
        </select>
      </div>

      {/* Ledger Table */}
      <Card title="Sổ Phép Cá Nhân (Nhật Ký Biến Động)">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-canvas border-b border-line text-ink-secondary font-medium">
                <th className="py-2.5 px-3">Ngày Ghi Sổ</th>
                <th className="py-2.5 px-3">Loại Phép</th>
                <th className="py-2.5 px-3">Nghiệp Vụ Biến Động</th>
                <th className="py-2.5 px-3">Chi Tiết / Mã Đơn</th>
                <th className="py-2.5 px-3 text-center">Số Ngày</th>
                <th className="py-2.5 px-3 text-right">Số Dư Sau (theo loại)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filteredLedger.map(entry => (
                <tr key={entry.id} className="hover:bg-canvas/40 transition-colors">
                  <td className="py-2.5 px-3 font-mono text-ink-secondary">{entry.date}</td>
                  <td className="py-2.5 px-3">
                    <div className="font-semibold text-ink">{leaveTypeName(entry.leaveType)}</div>
                    <div className="font-mono text-[10px] text-ink-muted">{entry.leaveType || 'AL'}</div>
                  </td>
                  <td className="py-2.5 px-3">
                    <Badge variant={entry.type === 'GRANT' ? 'ok' : entry.type === 'ADJUST' ? 'warn' : 'gray'}>
                      {entry.type === 'GRANT' ? 'Cấp phép đầu kỳ' : entry.type === 'ADJUST' ? 'Điều chỉnh HR' : entry.type === 'EXPIRED' ? 'Hết hạn phép tồn' : 'Sử dụng phép'}
                    </Badge>
                  </td>
                  <td className="py-2.5 px-3 font-medium text-ink">{entry.description}</td>
                  <td className={`py-2.5 px-3 text-center font-bold ${entry.amount > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {entry.amount > 0 ? `+${entry.amount}` : entry.amount}
                  </td>
                  <td className={`py-2.5 px-3 text-right font-mono font-bold ${entry.balanceAfter < 0 ? 'text-rose-700' : 'text-ink'}`}>
                    {hasGrantFor(entry.leaveType)
                      ? `${entry.balanceAfter} ngày`
                      : `Đã dùng ${Math.abs(entry.balanceAfter)} ngày`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
