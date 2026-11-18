import React, { useState } from 'react';
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
}

export const LeavesPage: React.FC = () => {
  const [balance] = useState({
    carriedOver: 3.5, // Rollover from 2025
    grantedCurrentYear: 12.0,
    seniorityBonus: 1.0,
    totalEntitlement: 16.5,
    used: 4.5,
    remaining: 12.0,
    expiringOnMarch31: 3.5,
  });

  const [ledger] = useState<LeaveLedgerEntry[]>([
    {
      id: 'L-004',
      date: '18/11/2026',
      type: 'USED',
      description: 'Nghỉ phép ốm cá nhân (Đơn REQ-2026-0042)',
      amount: -1.5,
      balanceAfter: 12.0
    },
    {
      id: 'L-003',
      date: '13/11/2026',
      type: 'USED',
      description: 'Nghỉ phép năm cá nhân (Đơn REQ-2026-0030)',
      amount: -1.0,
      balanceAfter: 13.5
    },
    {
      id: 'L-002',
      date: '15/06/2026',
      type: 'USED',
      description: 'Nghỉ mát hè cùng gia đình',
      amount: -2.0,
      balanceAfter: 14.5
    },
    {
      id: 'L-001',
      date: '01/01/2026',
      type: 'GRANT',
      description: 'Cấp phép năm 2026 (12 ngày) + Bảo lưu 2025 (3.5 ngày) + Thâm niên (1 ngày)',
      amount: +16.5,
      balanceAfter: 16.5
    }
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-ink">Số Dư Phép &amp; Sổ Phép Cá Nhân</h1>
            <Badge variant="accent">S09 / S34</Badge>
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
          <div className="font-bold">Lưu ý về Hạn sử dụng phép tồn năm trước (Rollover Deadline)</div>
          <p className="mt-0.5 text-amber-800 leading-relaxed">
            Bạn hiện có <strong>{balance.expiringOnMarch31} ngày phép tồn từ năm trước</strong>. Theo điều khoản số 04 trong Quy chế Nội bộ, toàn bộ số phép tồn này sẽ tự động hết hiệu lực sau ngày <strong>31/03/2027</strong>. Hãy chủ động lên kế hoạch nghỉ phép trước hạn.
          </p>
        </div>
      </div>

      {/* Balance Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-surface rounded-xl border border-line">
          <div className="text-xs text-ink-muted">Tổng Phép Năm Được Hưởng</div>
          <div className="text-2xl font-bold text-ink mt-1">{balance.totalEntitlement} ngày</div>
          <div className="text-[11px] text-ink-secondary mt-1">12 chuẩn + 3.5 tồn + 1 thâm niên</div>
        </div>

        <div className="p-4 bg-surface rounded-xl border border-line">
          <div className="text-xs text-ink-muted">Phép Đã Sử Dụng</div>
          <div className="text-2xl font-bold text-rose-700 mt-1">{balance.used} ngày</div>
          <div className="text-[11px] text-rose-600 mt-1">3 đợt nghỉ đã được duyệt</div>
        </div>

        <div className="p-4 bg-surface rounded-xl border border-accent/40 bg-accent-soft/20">
          <div className="text-xs text-accent-dark font-medium">Số Dư Phép Còn Lại</div>
          <div className="text-2xl font-extrabold text-accent mt-1">{balance.remaining} ngày</div>
          <div className="text-[11px] text-accent-dark mt-1">Sẵn sàng để đăng ký</div>
        </div>

        <div className="p-4 bg-surface rounded-xl border border-line">
          <div className="text-xs text-ink-muted">Phép Tồn Cần Dùng Trước 31/3</div>
          <div className="text-2xl font-bold text-amber-700 mt-1">{balance.expiringOnMarch31} ngày</div>
          <div className="text-[11px] text-amber-600 mt-1">Cần ưu tiên trừ trước</div>
        </div>
      </div>

      {/* Ledger Table */}
      <Card title="Sổ Phép Cá Nhân (Nhật Ký Biến Động - S34)">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-canvas border-b border-line text-ink-secondary font-medium">
                <th className="py-2.5 px-3">Ngày Ghi Sổ</th>
                <th className="py-2.5 px-3">Nghiệp Vụ Biến Động</th>
                <th className="py-2.5 px-3">Chi Tiết / Mã Đơn</th>
                <th className="py-2.5 px-3 text-center">Số Ngày</th>
                <th className="py-2.5 px-3 text-right">Số Dư Sau Biến Động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {ledger.map(entry => (
                <tr key={entry.id} className="hover:bg-canvas/40 transition-colors">
                  <td className="py-2.5 px-3 font-mono text-ink-secondary">{entry.date}</td>
                  <td className="py-2.5 px-3">
                    <Badge variant={entry.type === 'GRANT' ? 'ok' : 'gray'}>
                      {entry.type === 'GRANT' ? 'Cấp phép đầu kỳ' : 'Sử dụng phép'}
                    </Badge>
                  </td>
                  <td className="py-2.5 px-3 font-medium text-ink">{entry.description}</td>
                  <td className={`py-2.5 px-3 text-center font-bold ${entry.amount > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {entry.amount > 0 ? `+${entry.amount}` : entry.amount}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-ink">
                    {entry.balanceAfter} ngày
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
