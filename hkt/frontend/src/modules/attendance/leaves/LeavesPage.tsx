import React, { useEffect, useMemo, useState } from 'react';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import {
  AlertTriangle,
  CalendarPlus,
  Clock,
  Download,
  ShieldCheck,
  Sun,
  Wallet,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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

interface BalanceState {
  carriedOver: number;
  grantedCurrentYear: number;
  seniorityBonus: number;
  totalEntitlement: number;
  used: number;
  remaining: number;
  expiringOnMarch31: number;
  annualRemaining: number;
  carriedRemaining: number;
  sickUsed: number;
  adjust: number;
  baseAnnual: number;
  positionBonus: number;
  carriedGrant: number;
  expiredCarry: number;
  carryStatus: string;
  annualYear: number;
  carriedYear: number;
  annualEntitlement: number;
  annualUsed: number;
  pendingLeaveDays: number;
  availableForLeave: number;
  policyNotice: string;
  byType: { code: string; name: string; used: number; defaultDays: number | null; unit?: string }[];
}

export const LeavesPage: React.FC = () => {
  const navigate = useNavigate();
  const [balance, setBalance] = useState<BalanceState>({
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
    annualYear: new Date().getFullYear(),
    carriedYear: new Date().getFullYear() - 1,
    annualEntitlement: 0,
    annualUsed: 0,
    pendingLeaveDays: 0,
    availableForLeave: 0,
    policyNotice: '',
    byType: [],
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
          annualYear: Number(j.data.annualYear ?? b.annualYear),
          carriedYear: Number(j.data.carriedYear ?? b.carriedYear),
          annualEntitlement: Number(j.data.annualEntitlement ?? 0),
          annualUsed: Number(j.data.annualUsed ?? 0),
          pendingLeaveDays: Number(j.data.pendingLeaveDays ?? 0),
          availableForLeave: Number(j.data.availableForLeave ?? 0),
          policyNotice: String(j.data.policyNotice || ''),
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

  const exportLedger = () => {
    const headers = ['Ngày ghi sổ', 'Loại phép', 'Mã', 'Nghiệp vụ', 'Chi tiết', 'Số ngày', 'Số dư sau'];
    const label: Record<string, string> = {
      GRANT: 'Cấp phép đầu kỳ', USED: 'Sử dụng phép',
      ADJUST: 'Điều chỉnh HR', EXPIRED: 'Hết hạn phép tồn',
    };
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = filteredLedger.map(e => [
      e.date, esc(leaveTypeName(e.leaveType)), esc(e.leaveType || 'AL'),
      esc(label[e.type] || e.type), esc(e.description), e.amount, e.balanceAfter,
    ].join(','));
    const csv = '﻿' + [headers.join(','), ...lines].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `So_phep_ca_nhan_${filterYear === 'Tất cả' ? 'all' : filterYear}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // Tổng phép năm được cấp — dùng cho thanh tiến trình & dải phân bổ.
  const totalGranted = balance.annualEntitlement > 0
    ? balance.annualEntitlement
    : balance.baseAnnual + balance.positionBonus + balance.seniorityBonus + balance.adjust;
  const usedPct = totalGranted > 0 ? Math.min(100, Math.round((balance.annualUsed / totalGranted) * 100)) : 0;
  const remainingNegative = balance.remaining < 0;
  const usedApprovedCount = ledger.filter(e => e.type === 'USED' && e.amount < 0).length;

  const FILTER_CHIPS = ['Tất cả', 'Phép năm', 'Phép tồn', 'Phép ốm', 'Nghỉ bù', 'Chức vụ', 'Thâm niên'];

  const carryNotice = balance.carryStatus === 'EXPIRED' || balance.expiringOnMarch31 <= 0
    ? <>Phép tồn năm {balance.carriedYear} đã <strong>hết hiệu lực từ 01/07</strong> theo quy chế (01/04 giữ tối đa 5 ngày · 01/07 về 0). Số dư hiện tại không còn phép tồn.</>
    : balance.carryStatus === 'CAPPED'
      ? <>Đã qua <strong>01/04</strong>: chỉ được giữ tối đa <strong>5 ngày phép tồn</strong>. Bạn còn <strong>{balance.expiringOnMarch31} ngày</strong>; phần vượt sẽ hết hiệu lực từ <strong>01/07</strong>.</>
      : <>Bạn có <strong>{balance.expiringOnMarch31} ngày phép tồn</strong>; dùng trước <strong>01/04</strong>. Từ 01/04 chỉ giữ tối đa 5 ngày, từ <strong>01/07</strong> về 0.</>;

  const statCards = [
    {
      key: 'remaining',
      label: 'Phép còn lại',
      value: balance.remaining,
      unit: 'ngày',
      icon: Wallet,
      accent: true,
      delta: <>Phép năm {balance.annualRemaining} + Phép tồn {balance.carriedRemaining}</>,
      bar: { pct: usedPct, tone: remainingNegative ? 'danger' : 'accent' },
    },
    {
      key: 'annual',
      label: `Phép năm ${balance.annualYear}`,
      value: balance.baseAnnual,
      unit: 'ngày',
      icon: Sun,
      accent: false,
      delta: <>Cấp theo quy chế (chưa gồm chức vụ &amp; thâm niên)</>,
    },
    {
      key: 'carry',
      label: `Phép tồn ${balance.carriedYear}`,
      value: balance.carriedRemaining,
      unit: 'ngày',
      icon: Clock,
      accent: false,
      tone: 'warn',
      delta: balance.carryStatus === 'EXPIRED' ? 'Đã hết hiệu lực từ 01/07/2026'
        : balance.carryStatus === 'CAPPED' ? 'Từ 01/04 chỉ giữ tối đa 5 ngày'
        : 'Dùng trước 01/04 · giữ tối đa 5 từ 01/04',
    },
    {
      key: 'sick',
      label: 'Phép ốm (BHXH)',
      value: balance.sickUsed,
      unit: 'ngày',
      icon: ShieldCheck,
      accent: false,
      delta: <>Theo BHXH · cần giấy tờ</>,
    },
  ];

  // Dải phân bổ phép năm — tách rõ từng khoản cộng để người dùng đối chiếu với quy chế.
  const allocationTiles = [
    { label: 'Công chuẩn', value: balance.baseAnnual, hint: 'Theo quy chế phép năm', tone: '' },
    { label: 'Phép chức vụ', value: balance.positionBonus, hint: balance.positionBonus > 0 ? 'Theo cấu hình phép chức vụ' : 'Chức vụ hiện tại không cộng thêm', tone: '' },
    { label: 'Phép thâm niên', value: balance.seniorityBonus, hint: '+1 ngày mỗi 2 năm, cộng đúng ngày tròn', tone: '' },
    { label: 'Đã sử dụng', value: balance.annualUsed, hint: `${usedApprovedCount} đợt nghỉ đã được duyệt`, tone: 'danger' },
  ];

  const ledgerBadge = (type: LeaveLedgerEntry['type']) => (
    <Badge variant={type === 'GRANT' ? 'ok' : type === 'ADJUST' ? 'warn' : type === 'EXPIRED' ? 'danger' : 'gray'}>
      {type === 'GRANT' ? 'Cấp phép đầu kỳ' : type === 'ADJUST' ? 'Điều chỉnh HR' : type === 'EXPIRED' ? 'Hết hạn phép tồn' : 'Sử dụng phép'}
    </Badge>
  );

  return (
    <div className="space-y-6">
      {/* Header — mockup `.phead` */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-accent-dark">
            <Sun className="h-3.5 w-3.5" />
            Quỹ phép năm &amp; sổ phép cá nhân
          </div>
          <h1 className="mt-1.5 font-display text-xl font-extrabold tracking-tight text-ink sm:text-[23px]">
            Số dư phép
          </h1>
          <p className="mt-1 text-xs text-ink-muted">
            Năm phép {balance.annualYear} · minh bạch từng ngày nghỉ, phép tồn và hạn dùng
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="md" onClick={exportLedger} disabled={filteredLedger.length === 0}
            title="Tải CSV sổ phép cá nhân đúng các dòng đang lọc (loại phép + năm)">
            <Download className="h-4 w-4" />
            Xuất sổ phép
          </Button>
          <Button variant="primary" size="md" onClick={() => navigate('/attendance/requests', { state: { openCreate: 'LEAVE' } })}
            title="Mở form xin nghỉ phép — số dư còn lại hiện ngay trong form">
            <CalendarPlus className="h-4 w-4" />
            Xin nghỉ phép
          </Button>
        </div>
      </div>

      {/* Luật phép tồn — mockup `.notice` */}
      <div className="flex items-start gap-2.5 rounded-[13px] border border-status-warn-line bg-status-warn-soft p-3 text-xs leading-relaxed text-status-warn shadow-2xs">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <div className="font-bold">Luật phép tồn: 01/04 giữ tối đa 5 ngày · 01/07 về 0</div>
          <p className="mt-0.5">{carryNotice}</p>
        </div>
      </div>

      {/* Stat row — mockup `.stats` */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {statCards.map((s) => {
          const Icon = s.icon;
          const bar = (s as { bar?: { pct: number; tone: string } }).bar;
          return (
            <div
              key={s.key}
              className={`rounded-[13px] border p-3.5 shadow-2xs sm:p-[15px] ${
                s.accent ? 'border-accent-line bg-accent-soft/45' : 'border-line bg-surface'
              }`}
            >
              <div className={`flex items-center gap-1.5 text-[11px] font-semibold ${s.accent ? 'text-accent-dark' : 'text-ink-muted'}`}>
                <Icon className="h-3.5 w-3.5 text-accent" />
                {s.label}
              </div>
              <div className={`mt-2 font-display text-2xl font-extrabold leading-none tracking-[-0.035em] ${s.accent ? 'text-accent' : 'text-ink'}`}>
                {s.value}
                <small className="ml-1 text-xs font-semibold tracking-normal text-ink-muted">{s.unit}</small>
              </div>
              <div className={`mt-1.5 text-[11px] font-semibold ${s.tone === 'warn' ? 'text-status-warn' : s.accent ? 'text-accent-dark' : 'text-ink-muted'}`}>
                {s.delta}
              </div>
              {bar && (
                <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-line">
                  <div
                    className={`h-full rounded-full ${bar.tone === 'danger' ? 'bg-status-danger' : 'bg-accent'}`}
                    style={{ width: `${bar.pct}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Dải phân bổ quỹ phép — tách từng khoản cộng (chức vụ / thâm niên) để đối chiếu quy chế */}
      <div className="overflow-hidden rounded-[13px] border border-line bg-surface shadow-2xs">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          <h2 className="text-[13.5px] font-bold tracking-[-0.01em] text-ink">Phân bổ quỹ phép năm {balance.annualYear}</h2>
          <span className="ml-auto text-[10.5px] text-ink-muted">
            Tổng được cấp <strong className="text-ink">{totalGranted}</strong> ngày · đã dùng <strong className="text-ink">{balance.annualUsed}</strong>
          </span>
        </div>
        <div className="grid grid-cols-2 gap-px bg-line sm:grid-cols-4">
          {allocationTiles.map(t => (
            <div key={t.label} className="bg-surface px-4 py-3">
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ink-muted">{t.label}</div>
              <div className={`mt-1 font-display text-lg font-extrabold leading-none tracking-[-0.03em] ${t.tone === 'danger' ? 'text-status-danger' : 'text-ink'}`}>
                {t.value}<small className="ml-1 text-[11px] font-semibold tracking-normal text-ink-muted">ngày</small>
              </div>
              <div className="mt-1 text-[10.5px] leading-snug text-ink-muted">{t.hint}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Bộ lọc lịch sử — mockup `.filters` */}
      <div className="flex flex-wrap items-center gap-1.5">
        {FILTER_CHIPS.map(f => (
          <button
            key={f}
            type="button"
            onClick={() => setFilterType(f)}
            aria-pressed={filterType === f}
            className={`inline-flex h-[30px] items-center rounded-full border px-3 text-xs font-semibold transition-colors ${
              filterType === f
                ? 'border-ink bg-ink text-canvas'
                : 'border-line bg-surface text-ink-secondary hover:border-line-hover'
            }`}
          >
            {f}
          </button>
        ))}
        <span className="flex-1" />
        <select
          value={filterYear}
          onChange={e => setFilterYear(e.target.value)}
          aria-label="Lọc theo năm"
          className="h-[30px] rounded-full border border-line bg-surface px-2.5 text-[11px] font-semibold text-ink-secondary"
        >
          <option value="2026">Năm: 2026</option>
          <option value="2025">Năm: 2025</option>
          <option value="Tất cả">Tất cả năm</option>
        </select>
      </div>

      {/* Sổ phép — mockup `.panel` (desktop bảng · mobile danh sách 2 dòng) */}
      <div className="overflow-hidden rounded-[13px] border border-line bg-surface shadow-2xs">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          <h2 className="text-[13.5px] font-bold tracking-[-0.01em] text-ink">Sổ phép cá nhân</h2>
          <span className="ml-auto font-mono text-[10.5px] text-ink-muted">
            {filteredLedger.length} dòng
          </span>
        </div>

        {/* Desktop: bảng */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full border-collapse text-left text-[11.5px]">
            <thead>
              <tr className="bg-canvas text-ink-secondary">
                <th className="border-b border-line px-3 py-2.5 text-[9.5px] font-extrabold uppercase tracking-[0.07em] text-ink-muted">Ngày ghi sổ</th>
                <th className="border-b border-line px-3 py-2.5 text-[9.5px] font-extrabold uppercase tracking-[0.07em] text-ink-muted">Loại phép</th>
                <th className="border-b border-line px-3 py-2.5 text-[9.5px] font-extrabold uppercase tracking-[0.07em] text-ink-muted">Nghiệp vụ biến động</th>
                <th className="border-b border-line px-3 py-2.5 text-[9.5px] font-extrabold uppercase tracking-[0.07em] text-ink-muted">Chi tiết</th>
                <th className="border-b border-line px-3 py-2.5 text-center text-[9.5px] font-extrabold uppercase tracking-[0.07em] text-ink-muted">Số ngày</th>
                <th className="border-b border-line px-3 py-2.5 text-right text-[9.5px] font-extrabold uppercase tracking-[0.07em] text-ink-muted">Số dư sau</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filteredLedger.map(entry => (
                <tr key={entry.id} className="transition-colors hover:bg-canvas/40">
                  <td className="px-3 py-2.5 font-mono text-ink-secondary">{entry.date}</td>
                  <td className="px-3 py-2.5">
                    <div className="font-semibold text-ink">{leaveTypeName(entry.leaveType)}</div>
                    <div className="font-mono text-[10px] text-ink-muted">{entry.leaveType || 'AL'}</div>
                  </td>
                  <td className="px-3 py-2.5">{ledgerBadge(entry.type)}</td>
                  <td className="px-3 py-2.5 font-medium text-ink">{entry.description}</td>
                  <td className={`px-3 py-2.5 text-center font-bold ${entry.amount > 0 ? 'text-status-ok' : 'text-status-danger'}`}>
                    {entry.amount > 0 ? `+${entry.amount}` : entry.amount}
                  </td>
                  <td className={`px-3 py-2.5 text-right font-mono font-bold ${entry.balanceAfter < 0 ? 'text-status-danger' : 'text-ink'}`}>
                    {hasGrantFor(entry.leaveType)
                      ? `${entry.balanceAfter} ngày`
                      : `Đã dùng ${Math.abs(entry.balanceAfter)} ngày`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile: danh sách 2 dòng (tên + badge · mô tả · số ngày + số dư) */}
        <div className="flex flex-col gap-2 p-3 md:hidden">
          {filteredLedger.map(entry => (
            <div key={entry.id} className="rounded-xl border border-line bg-surface p-3">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="text-[12.5px] font-bold text-ink">{leaveTypeName(entry.leaveType)}</span>
                {ledgerBadge(entry.type)}
                <span className="ml-auto font-mono text-[10px] text-ink-muted">{entry.date}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-ink-secondary">{entry.description}</p>
              <div className="mt-2 flex items-center gap-2">
                <span className={`font-mono text-[12px] font-bold ${entry.amount > 0 ? 'text-status-ok' : 'text-status-danger'}`}>
                  {entry.amount > 0 ? `+${entry.amount}` : entry.amount} ngày
                </span>
                <span className="ml-auto text-[10.5px] text-ink-muted">
                  {hasGrantFor(entry.leaveType)
                    ? `Còn ${entry.balanceAfter} ngày`
                    : `Đã dùng ${Math.abs(entry.balanceAfter)} ngày`}
                </span>
              </div>
            </div>
          ))}
          {filteredLedger.length === 0 && (
            <p className="px-1 py-6 text-center text-[11.5px] text-ink-muted">
              Không có dòng nào khớp bộ lọc hiện tại.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
