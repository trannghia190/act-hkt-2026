import React, { useState } from 'react';
import { Card } from '../../../components/common/Card';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { Modal } from '../../../components/common/Modal';

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
}

export const AdminLeaveLedgerPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [filterType, setFilterType] = useState('ALL');

  // Adjust leave modal state
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustEmpCode, setAdjustEmpCode] = useState('ACT0142');
  const [adjustAmount, setAdjustAmount] = useState('1.0');
  const [adjustReason, setAdjustReason] = useState('Điều chỉnh thưởng thêm phép cống hiến dự án Q3');

  const [ledgerEntries, setLedgerEntries] = useState<EnterpriseLeaveLedgerItem[]>([
    {
      id: 'LEDGER-2026-0091',
      employeeCode: 'ACT0142',
      employeeName: 'Nguyễn Văn Minh',
      department: 'Phát Triển Phần Mềm (Sirius)',
      date: '18/11/2026',
      type: 'USED',
      amount: -1.0,
      balanceAfter: 12.0,
      reason: 'Nghỉ phép năm cá nhân (Đơn REQ-2026-0030)',
      approvedBy: 'Phạm Minh Tuấn (Manager)',
    },
    {
      id: 'LEDGER-2026-0089',
      employeeCode: 'ACT0088',
      employeeName: 'Trần Thị Thu Hà',
      department: 'AI & Khoa Học Dữ Liệu (Optimus)',
      date: '15/11/2026',
      type: 'USED',
      amount: -0.5,
      balanceAfter: 14.5,
      reason: 'Nghỉ nửa ngày khám sức khỏe (Đơn REQ-2026-0028)',
      approvedBy: 'Lê Hoàng Long (Director)',
    },
    {
      id: 'LEDGER-2026-0085',
      employeeCode: 'ACT0092',
      employeeName: 'Hoàng Quốc Bảo',
      department: 'Hạ Tầng & An Ninh (Zeus)',
      date: '10/11/2026',
      type: 'ADJUST',
      amount: +1.0,
      balanceAfter: 15.0,
      reason: 'Cấp bù ngày phép trực sự cố On-call cuối tuần',
      approvedBy: 'Admin Hệ Thống',
    },
    {
      id: 'LEDGER-2026-0074',
      employeeCode: 'ACT0045',
      employeeName: 'Phạm Minh Tuấn',
      department: 'Phát Triển Phần Mềm (Sirius)',
      date: '01/01/2026',
      type: 'GRANT',
      amount: +17.0,
      balanceAfter: 17.0,
      reason: 'Cấp phép năm 2026: Chuẩn 12.0 + Tồn 2025 4.0 + Thâm niên 1.0',
      approvedBy: 'Hệ Thống Tự Động',
    },
    {
      id: 'LEDGER-2026-0073',
      employeeCode: 'ACT0156',
      employeeName: 'Lê Hải Đăng',
      department: 'Phát Triển Phần Mềm (Sirius)',
      date: '01/01/2026',
      type: 'GRANT',
      amount: +15.5,
      balanceAfter: 15.5,
      reason: 'Cấp phép năm 2026: Chuẩn 12.0 + Tồn 2025 3.5',
      approvedBy: 'Hệ Thống Tự Động',
    },
  ]);

  const filteredEntries = ledgerEntries.filter((item) => {
    const matchSearch =
      item.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.employeeCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.reason.toLowerCase().includes(searchTerm.toLowerCase());
    const matchDept = selectedDept === 'ALL' || item.department.includes(selectedDept);
    const matchType = filterType === 'ALL' || item.type === filterType;
    return matchSearch && matchDept && matchType;
  });

  const handleAdjustLeave = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(adjustAmount);
    if (isNaN(amountNum)) return;

    const newEntry: EnterpriseLeaveLedgerItem = {
      id: `LEDGER-2026-${String(ledgerEntries.length + 95).padStart(4, '0')}`,
      employeeCode: adjustEmpCode,
      employeeName: adjustEmpCode === 'ACT0142' ? 'Nguyễn Văn Minh' : 'Nhân Viên ACT',
      department: 'Phát Triển Phần Mềm (Sirius)',
      date: new Date().toLocaleDateString('vi-VN'),
      type: 'ADJUST',
      amount: amountNum,
      balanceAfter: 12.0 + amountNum,
      reason: adjustReason,
      approvedBy: 'HR Admin (Thủ công)',
    };

    setLedgerEntries([newEntry, ...ledgerEntries]);
    setIsAdjustModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-ink">Sổ Cái Biến Động Phép Toàn Doanh Nghiệp</h1>
            <Badge variant="accent">S34</Badge>
          </div>
          <p className="text-xs text-ink-muted mt-1">
            Quản trị sổ cái biến động ngày phép của toàn bộ nhân sự, tra cứu lịch sử cấp phép, trừ phép và điều chỉnh thủ công
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="primary" size="sm" onClick={() => setIsAdjustModalOpen(true)}>
            + Điều Chỉnh Số Dư Phép
          </Button>
          <Button variant="outline" size="sm">
            Xuất Excel Sổ Cái
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Tìm theo tên nhân viên, mã NV hoặc lý do..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="text-xs p-2.5 rounded-lg border border-line bg-surface flex-1 text-ink placeholder:text-ink-muted"
        />

        <select
          value={selectedDept}
          onChange={(e) => setSelectedDept(e.target.value)}
          className="text-xs p-2.5 rounded-lg border border-line bg-surface font-semibold text-ink"
        >
          <option value="ALL">🏢 Tất cả phòng ban</option>
          <option value="Sirius">Sirius (Software Dev)</option>
          <option value="Optimus">Optimus (AI & Data)</option>
          <option value="Zeus">Zeus (DevOps)</option>
        </select>

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="text-xs p-2.5 rounded-lg border border-line bg-surface font-semibold text-ink"
        >
          <option value="ALL">⚡ Tất cả loại biến động</option>
          <option value="GRANT">Cấp phép đầu kỳ (+)</option>
          <option value="USED">Đã sử dụng (-)</option>
          <option value="ADJUST">Điều chỉnh HR (±)</option>
          <option value="EXPIRED">Hết hạn 31/3 (-)</option>
        </select>
      </div>

      {/* Enterprise Ledger Table */}
      <Card title={`Nhật Ký Biến Động (${filteredEntries.length} bản ghi)`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-canvas border-b border-line text-ink-secondary font-medium">
                <th className="py-2.5 px-3">Mã Bút Toán</th>
                <th className="py-2.5 px-3">Nhân Viên</th>
                <th className="py-2.5 px-3">Phòng Ban</th>
                <th className="py-2.5 px-3">Ngày</th>
                <th className="py-2.5 px-3">Loại Biến Động</th>
                <th className="py-2.5 px-3 text-center">Số Ngày</th>
                <th className="py-2.5 px-3 text-right">Số Dư Sau</th>
                <th className="py-2.5 px-3">Lý Do / Căn Cứ</th>
                <th className="py-2.5 px-3">Người Duyệt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filteredEntries.map((item) => (
                <tr key={item.id} className="hover:bg-canvas/40 transition-colors">
                  <td className="py-2.5 px-3 font-mono text-ink-muted text-[11px]">{item.id}</td>
                  <td className="py-2.5 px-3">
                    <span className="font-semibold text-ink">{item.employeeName}</span>
                    <span className="font-mono text-emerald-400 block text-[10px]">{item.employeeCode}</span>
                  </td>
                  <td className="py-2.5 px-3 text-ink-secondary text-[11px]">{item.department}</td>
                  <td className="py-2.5 px-3 font-mono text-ink-secondary">{item.date}</td>
                  <td className="py-2.5 px-3">
                    {item.type === 'GRANT' && <Badge variant="ok">Cấp phép đầu kỳ</Badge>}
                    {item.type === 'USED' && <Badge variant="warn">Trừ phép đã nghỉ</Badge>}
                    {item.type === 'ADJUST' && <Badge variant="accent">HR Điều chỉnh</Badge>}
                    {item.type === 'EXPIRED' && <Badge variant="gray">Hết hạn bảo lưu</Badge>}
                  </td>
                  <td
                    className={`py-2.5 px-3 text-center font-bold ${
                      item.amount > 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {item.amount > 0 ? `+${item.amount}` : item.amount}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-ink">
                    {item.balanceAfter} ngày
                  </td>
                  <td className="py-2.5 px-3 text-ink text-[11px] max-w-[200px] truncate" title={item.reason}>
                    {item.reason}
                  </td>
                  <td className="py-2.5 px-3 text-ink-muted text-[11px]">{item.approvedBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Adjust Leave Modal */}
      <Modal
        isOpen={isAdjustModalOpen}
        onClose={() => setIsAdjustModalOpen(false)}
        title="Điều Chỉnh Số Dư Phép Năm (HR Admin)"
      >
        <form onSubmit={handleAdjustLeave} className="space-y-4 text-xs">
          <div>
            <label className="block text-ink font-semibold mb-1">Mã nhân viên cần điều chỉnh</label>
            <input
              type="text"
              value={adjustEmpCode}
              onChange={(e) => setAdjustEmpCode(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-line bg-surface text-ink font-mono font-bold"
              required
            />
          </div>

          <div>
            <label className="block text-ink font-semibold mb-1">Số ngày điều chỉnh (Dương: cộng thêm, Âm: trừ bớt)</label>
            <input
              type="number"
              step="0.5"
              value={adjustAmount}
              onChange={(e) => setAdjustAmount(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-line bg-surface text-ink font-mono font-bold"
              required
            />
          </div>

          <div>
            <label className="block text-ink font-semibold mb-1">Căn cứ / Lý do điều chỉnh</label>
            <textarea
              rows={3}
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-line bg-surface text-ink"
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={() => setIsAdjustModalOpen(false)}>
              Hủy
            </Button>
            <Button variant="primary" type="submit">
              Xác Nhận Ghi Sổ Cái
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
