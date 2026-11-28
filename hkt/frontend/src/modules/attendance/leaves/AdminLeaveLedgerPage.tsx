import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BookOpen, CalendarDays, Download, Search, SlidersHorizontal } from 'lucide-react';
import { Badge } from '../../../components/common/Badge';
import { Modal } from '../../../components/common/Modal';
import { Panel } from '../../../components/common/Panel';

interface EnterpriseLeaveLedgerItem {
  id: string;
  employeeCode: string;
  employeeName: string;
  department: string;
  date: string;
  type: 'GRANT' | 'USED' | 'EXPIRED' | 'ADJUST';
  amount: number;
  balanceAfter: number;
  reason: string;
  approvedBy: string;
  leaveType?: string;
  createdAt?: string;
}

interface LeaveTableRow {
  employeeCode: string;
  fullName: string;
  annualRemaining?: number;
  annualEntitlement?: number;
  annualUsed?: number;
  department?: string;
}

const TYPE_META: Record<string, { label: string; variant: 'ok' | 'danger' | 'info' | 'gray'; sign: string }> = {
  GRANT: { label: 'Cấp phép', variant: 'ok', sign: '+' },
  USED: { label: 'Sử dụng', variant: 'danger', sign: '' },
  ADJUST: { label: 'HR điều chỉnh', variant: 'info', sign: '' },
  EXPIRED: { label: 'Hết hạn tồn', variant: 'gray', sign: '' },
};

const fmtDays = (n: number) => (n > 0 ? `+${n}` : `${n}`);

export const AdminLeaveLedgerPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const userFromUrl = searchParams.get('user') || '';
  const [searchTerm, setSearchTerm] = useState('');
  const [employees, setEmployees] = useState<LeaveTableRow[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<{ code: string; name: string }[]>([]);
  const [selectedCode, setSelectedCode] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [filterMonth, setFilterMonth] = useState('ALL');

  // Điều chỉnh số dư phép
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustEmpCode, setAdjustEmpCode] = useState('');
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('1.0');
  const [adjustReason, setAdjustReason] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  // Sổ cái luôn lấy từ API — không dùng dữ liệu mẫu.
  const [ledgerEntries, setLedgerEntries] = useState<EnterpriseLeaveLedgerItem[]>([]);

  const authOnly = (): Record<string, string> => { try { const u = JSON.parse(localStorage.getItem('pulse_auth_user') || '{}'); return u?.accessToken ? { Authorization: `Bearer ${u.accessToken}` } : {}; } catch { return {}; } };
  const authJson = (): Record<string, string> => ({ 'Content-Type': 'application/json', ...authOnly() });

  const loadLedger = (code: string) => {
    if (!code) return;
    fetch(`/api/v1/leaves/ledger/by-code/${encodeURIComponent(code)}`, { headers: authOnly() })
      .then(r => r.json()).then(j => {
        if (Array.isArray(j?.data)) {
          const mapped = j.data.map((e: any) => ({
            id: e.id, employeeCode: code, employeeName: employees.find(x => x.employeeCode === code)?.fullName || code,
            department: '', date: e.createdAt ? new Date(e.createdAt).toLocaleDateString('vi-VN') : '—',
            type: e.action, amount: Number(e.amount || 0), balanceAfter: Number(e.balanceAfter || 0),
            reason: e.reason || e.leaveType, approvedBy: e.performedBySystem ? 'Hệ thống' : 'HR',
            leaveType: e.leaveType, createdAt: e.createdAt,
          }));
          const runningByType: Record<string, number> = {};
          const byId: Record<string, number> = {};
          [...mapped].sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || ''))).forEach(e => {
            const code = String(e.leaveType || 'AL').toUpperCase();
            runningByType[code] = (runningByType[code] || 0) + e.amount;
            byId[e.id] = Math.round(runningByType[code] * 100) / 100;
          });
          setLedgerEntries(mapped.map(e => ({ ...e, balanceAfter: byId[e.id] ?? e.balanceAfter })));
        }
      }).catch(() => undefined);
  };

  useEffect(() => {
    fetch('/api/v1/leave-types', { headers: authOnly() }).then(r => r.json())
      .then(j => { if (Array.isArray(j?.data)) setLeaveTypes(j.data.map((x: any) => ({ code: x.code, name: x.name }))); })
      .catch(() => undefined);
    fetch('/api/v1/leaves/table', { headers: authOnly() }).then(r => r.json()).then(j => {
      if (Array.isArray(j?.data)) {
        setEmployees(j.data);
        const fromUrl = j.data.find((x: any) => x.employeeCode === userFromUrl);
        const initial = fromUrl || j.data[0];
        if (initial) { setSelectedCode(initial.employeeCode); setAdjustEmpCode(prev => prev || initial.employeeCode); }
      }
    }).catch(() => undefined);
  }, []);

  useEffect(() => { if (selectedCode) loadLedger(selectedCode); }, [selectedCode, employees.length]);

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2600); };

  const filteredEntries = useMemo(() => ledgerEntries.filter((item) => {
    const q = searchTerm.trim().toLowerCase();
    const matchSearch = !q || item.reason.toLowerCase().includes(q) || item.id.toLowerCase().includes(q);
    const matchType = filterType === 'ALL' || item.type === filterType;
    const matchMonth = filterMonth === 'ALL' || item.date.includes(`/${filterMonth}/`);
    return matchSearch && matchType && matchMonth;
  }), [ledgerEntries, searchTerm, filterType, filterMonth]);

  /** Gộp theo tháng, giữ thứ tự API trả về (mới nhất trước). */
  const groups = useMemo(() => {
    const map = new Map<string, EnterpriseLeaveLedgerItem[]>();
    filteredEntries.forEach((e) => {
      const key = e.date.split('/').slice(1).join('/');
      const list = map.get(key) ?? [];
      list.push(e);
      map.set(key, list);
    });
    return Array.from(map, ([month, items]) => ({ month, items }));
  }, [filteredEntries]);

  const typeCounts = useMemo(() => {
    const m: Record<string, number> = { ALL: ledgerEntries.length };
    ledgerEntries.forEach((e) => { m[e.type] = (m[e.type] || 0) + 1; });
    return m;
  }, [ledgerEntries]);

  const selectedEmp = employees.find((e) => e.employeeCode === selectedCode);

  const exportLedger = () => {
    const headers = ['Ngày', 'Loại phép', 'Nghiệp vụ', 'Chi tiết / mã đơn', 'Số ngày', 'Số dư sau', 'Người duyệt'];
    const label: Record<string, string> = { GRANT: 'Cấp phép đầu kỳ', USED: 'Sử dụng phép', ADJUST: 'HR điều chỉnh', EXPIRED: 'Hết hạn phép tồn' };
    const lines = filteredEntries.map(e => [
      e.date, `${leaveTypes.find(x => x.code === e.leaveType)?.name || e.leaveType || 'Phép năm'} (${e.leaveType || 'AL'})`,
      label[e.type] || e.type, `"${(e.reason || '').replace(/"/g, '""')}"`,
      e.amount, e.balanceAfter, e.approvedBy,
    ].join(','));
    const csv = '﻿' + [headers.join(','), ...lines].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `So_phep_${selectedCode || 'all'}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handleAdjustLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(adjustAmount);
    if (isNaN(amountNum) || !adjustEmpCode.trim()) { setAdjustError('Nhập mã nhân viên và số ngày hợp lệ'); return; }
    if (!adjustReason.trim()) { setAdjustError('Phải nhập căn cứ / lý do điều chỉnh'); return; }
    setAdjustError(null);
    const res = await fetch('/api/v1/leaves/adjust', {
      method: 'POST', headers: authJson(),
      body: JSON.stringify({ employeeCode: adjustEmpCode.trim(), amount: amountNum, reason: adjustReason.trim(), leaveType: 'AL' }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setAdjustError(json?.message || 'Điều chỉnh số dư phép thất bại'); return; }
    setIsAdjustModalOpen(false);
    setAdjustAmount('1.0');
    setAdjustReason('');
    loadLedger(adjustEmpCode.trim());
    showToast('Đã ghi sổ cái điều chỉnh phép — có lưu vết người thực hiện');
  };

  const chip = (id: string, label: string) => (
    <button
      key={id}
      type="button"
      onClick={() => setFilterType(id)}
      aria-pressed={filterType === id}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
        filterType === id ? 'border-accent bg-accent-soft text-accent-dark' : 'border-line bg-surface text-ink-secondary hover:border-line-hover'
      }`}
    >
      {label}
      <span className="font-mono text-[10px] opacity-70">{typeCounts[id] ?? 0}</span>
    </button>
  );

  return (
    <div className="mx-auto max-w-4xl space-y-4 pb-24">
      {toast && (
        <div className="fixed right-6 top-16 z-[100] rounded-lg bg-status-ok px-4 py-2 text-xs font-semibold text-on-ok shadow-sm">
          {toast}
        </div>
      )}

      {/* Đầu trang */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-accent-dark">
            <BookOpen className="h-3.5 w-3.5" />
            Chấm công
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <h1 className="font-display text-xl font-extrabold tracking-tight text-ink sm:text-[23px]">
              Sổ cái biến động phép
            </h1>
            <Badge variant="accent">T8</Badge>
          </div>
          <p className="mt-1 text-xs text-ink-muted">
            Mỗi dòng là một bút toán không sửa được — cộng/trừ phép đều có người thực hiện và căn cứ.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setIsAdjustModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-on-accent transition-colors hover:bg-accent-hover"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Điều chỉnh số dư
          </button>
          <button
            type="button"
            onClick={exportLedger}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink-secondary hover:bg-canvas"
          >
            <Download className="h-3.5 w-3.5" />
            Xuất CSV
          </button>
        </div>
      </div>

      {/* Bìa: chọn nhân viên + số dư */}
      <div className="overflow-hidden rounded-[16px] border border-line bg-ink px-5 py-4 text-canvas">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-canvas/60">
              Sổ phép của nhân viên
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <select
                value={selectedCode}
                onChange={e => { setSelectedCode(e.target.value); setSearchParams({ user: e.target.value }); }}
                className="max-w-full rounded-lg border border-canvas/25 bg-canvas/10 px-2.5 py-1 text-sm font-semibold text-canvas [&>option]:bg-surface [&>option]:text-ink"
              >
                {employees.map((e) => <option key={e.employeeCode} value={e.employeeCode}>{e.fullName} ({e.employeeCode})</option>)}
              </select>
            </div>
            <p className="mt-2 max-w-xl text-xs leading-relaxed text-canvas/75">
              Sổ cái cấp phát, trừ phép và điều chỉnh thủ công của toàn doanh nghiệp — lọc theo nhân viên, tháng và loại biến động.
            </p>
          </div>
          <dl className="flex gap-6">
            <div>
              <dd className="font-display text-2xl font-extrabold tabular-nums">{selectedEmp?.annualEntitlement ?? '—'}</dd>
              <dt className="text-[11px] text-canvas/60">phép được hưởng</dt>
            </div>
            <div>
              <dd className="font-display text-2xl font-extrabold tabular-nums">{selectedEmp?.annualUsed ?? '—'}</dd>
              <dt className="text-[11px] text-canvas/60">đã dùng</dt>
            </div>
            <div>
              <dd className="font-display text-2xl font-extrabold tabular-nums">{selectedEmp?.annualRemaining ?? '—'}</dd>
              <dt className="text-[11px] text-canvas/60">còn lại</dt>
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
              type="text"
              placeholder="Tìm lý do, mã bút toán…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-line bg-surface py-1.5 pl-8 pr-2.5 text-xs text-ink placeholder:text-ink-muted"
            />
          </div>
          <select
            value={filterMonth}
            onChange={e => setFilterMonth(e.target.value)}
            className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-semibold text-ink"
          >
            <option value="ALL">Tất cả tháng</option>
            {['01','02','03','04','05','06','07','08','09','10','11','12'].map(m => <option key={m} value={m}>Tháng {m}</option>)}
          </select>
          <span className="ml-auto text-[11px] text-ink-muted">{filteredEntries.length} bút toán</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {chip('ALL', 'Tất cả')}
          {chip('GRANT', 'Cấp phép')}
          {chip('USED', 'Sử dụng')}
          {chip('ADJUST', 'Điều chỉnh')}
          {chip('EXPIRED', 'Hết hạn')}
        </div>
      </Panel>

      {/* Nhật ký theo tháng */}
      {groups.length === 0 && (
        <Panel>
          <div className="py-6 text-center text-xs text-ink-muted">
            <CalendarDays className="mx-auto mb-2 h-5 w-5" />
            Không có bút toán nào khớp bộ lọc.
          </div>
        </Panel>
      )}
      {groups.map((g) => (
        <Panel
          key={g.month}
          title={`Tháng ${g.month}`}
          subtitle={`${g.items.length} bút toán`}
          action={
            <span className={`font-mono text-xs font-semibold ${g.items.reduce((s, i) => s + i.amount, 0) >= 0 ? 'text-status-ok' : 'text-status-danger'}`}>
              {fmtDays(g.items.reduce((s, i) => s + i.amount, 0))} ngày
            </span>
          }
          bodyClassName="space-y-2"
        >
          {g.items.map((item) => {
            const meta = TYPE_META[item.type] || TYPE_META.ADJUST;
            return (
              <div key={item.id} className="flex flex-wrap items-start gap-3 rounded-xl border border-line bg-surface px-3.5 py-2.5 sm:flex-nowrap">
                <div className="w-14 shrink-0 text-[11px] font-semibold tabular-nums text-ink-secondary">{item.date}</div>
                <div className="min-w-0 flex-1 basis-[calc(100%-72px)] sm:basis-auto">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                    <span className="rounded-md bg-surface-secondary px-1.5 py-[2px] font-mono text-[10px] font-semibold text-ink-muted">
                      {leaveTypes.find(x => x.code === item.leaveType)?.name || item.leaveType || 'AL'}
                    </span>
                  </div>
                  <div className="mt-1 text-xs leading-snug text-ink-secondary">{item.reason}</div>
                  <div className="mt-0.5 text-[10.5px] text-ink-muted">
                    {item.approvedBy === 'Hệ thống' ? 'Hệ thống' : 'HR duyệt'} · <span className="font-mono">{item.id.slice(0, 8)}</span>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className={`font-mono text-sm font-bold tabular-nums ${item.amount >= 0 ? 'text-status-ok' : 'text-status-danger'}`}>
                    {fmtDays(item.amount)}
                  </div>
                  <div className="text-[10px] text-ink-muted">còn {item.balanceAfter}</div>
                </div>
              </div>
            );
          })}
        </Panel>
      ))}

      {/* Modal điều chỉnh */}
      <Modal isOpen={isAdjustModalOpen} onClose={() => setIsAdjustModalOpen(false)} title="Điều chỉnh số dư phép" maxWidth="lg">
        <form onSubmit={handleAdjustLeave} className="space-y-3">
          <div>
            <div className="mb-1 text-[11px] font-semibold text-ink">Mã nhân viên *</div>
            <input
              list="ledger-employee-list"
              value={adjustEmpCode}
              onChange={(e) => setAdjustEmpCode(e.target.value)}
              className="w-full rounded-lg border border-line bg-surface p-2.5 text-sm text-ink"
              placeholder="VD: 136ACT"
            />
            <datalist id="ledger-employee-list">
              {employees.map((e) => <option key={e.employeeCode} value={e.employeeCode}>{e.fullName}</option>)}
            </datalist>
          </div>
          <div>
            <div className="mb-1 text-[11px] font-semibold text-ink">Số ngày (âm để trừ) *</div>
            <div className="flex flex-wrap gap-1.5">
              {[1, 0.5, -0.5, -1].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setAdjustAmount(String(n))}
                  className={`rounded-full border px-2.5 py-1 font-mono text-[11px] font-semibold transition-colors ${
                    parseFloat(adjustAmount) === n ? 'border-accent bg-accent-soft text-accent-dark' : 'border-line bg-surface text-ink-secondary'
                  }`}
                >
                  {n > 0 ? `+${n}` : n}
                </button>
              ))}
              <input
                type="number" step="0.5"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
                className="w-20 rounded-lg border border-line bg-surface px-2 py-1 font-mono text-xs text-ink"
              />
            </div>
          </div>
          <div>
            <div className="mb-1 text-[11px] font-semibold text-ink">Căn cứ / lý do *</div>
            <textarea
              rows={3}
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
              className="w-full rounded-lg border border-line bg-surface p-2.5 text-sm text-ink"
              placeholder="VD: Bổ sung phép thâm niên theo quyết định HR"
            />
          </div>
          {adjustError && <div className="text-xs text-status-danger">{adjustError}</div>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setIsAdjustModalOpen(false)} className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-secondary">
              Huỷ
            </button>
            <button
              type="submit"
              disabled={!adjustEmpCode.trim() || !adjustReason.trim() || !(parseFloat(adjustAmount) > 0 || parseFloat(adjustAmount) < 0)}
              className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-on-accent transition-opacity hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              Ghi sổ điều chỉnh
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
