import React, { useEffect, useState } from 'react';
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
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedCode, setSelectedCode] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [filterType, setFilterType] = useState('ALL');
  const [filterMonth, setFilterMonth] = useState('ALL');

  // Adjust leave modal state
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustEmpCode, setAdjustEmpCode] = useState('');
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('1.0');
  const [adjustReason, setAdjustReason] = useState('Điều chỉnh thưởng thêm phép cống hiến dự án Q3');

  // Sổ cái luôn lấy từ API — không dùng dữ liệu mẫu.
  const [ledgerEntries, setLedgerEntries] = useState<EnterpriseLeaveLedgerItem[]>([]);

  const filteredEntries = ledgerEntries.filter((item) => {
    const matchSearch =
      item.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.employeeCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.reason.toLowerCase().includes(searchTerm.toLowerCase());
    const matchDept = selectedDept === 'ALL' || item.department.includes(selectedDept);
    const matchType = filterType === 'ALL' || item.type === filterType;
    const matchMonth = filterMonth === 'ALL' || item.date.includes(`/${filterMonth}/`);
    return matchSearch && matchDept && matchType && matchMonth;
  });

  const authOnly = (): Record<string, string> => { try { const u = JSON.parse(localStorage.getItem('pulse_auth_user') || '{}'); return u?.accessToken ? { Authorization: `Bearer ${u.accessToken}` } : {}; } catch { return {}; } };
  const authJson = (): Record<string, string> => ({ 'Content-Type': 'application/json', ...authOnly() });
  const loadLedger = (code: string) => {
    if (!code) return;
    fetch(`/api/v1/leaves/ledger/by-code/${encodeURIComponent(code)}`, { headers: authOnly() })
      .then(r => r.json()).then(j => {
        if (Array.isArray(j?.data)) setLedgerEntries(j.data.map((e: any) => ({
          id: e.id, employeeCode: code, employeeName: employees.find(x => x.employeeCode === code)?.fullName || code,
          department: '', date: e.createdAt ? new Date(e.createdAt).toLocaleDateString('vi-VN') : '—',
          type: e.action, amount: Number(e.amount || 0), balanceAfter: Number(e.balanceAfter || 0),
          reason: e.reason || e.leaveType, approvedBy: e.performedBySystem ? 'Hệ thống' : 'HR',
        })));
      }).catch(() => undefined);
  };
  useEffect(() => {
    fetch('/api/v1/leaves/table', { headers: authOnly() }).then(r => r.json()).then(j => {
      if (Array.isArray(j?.data)) { setEmployees(j.data); if (j.data[0]) { setSelectedCode(j.data[0].employeeCode); setAdjustEmpCode(prev => prev || j.data[0].employeeCode); } }
    }).catch(() => undefined);
  }, []);
  useEffect(() => { if (selectedCode) loadLedger(selectedCode); }, [selectedCode, employees.length]);

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
    setAdjustReason('Điều chỉnh thưởng thêm phép cống hiến dự án Q3');
    loadLedger(adjustEmpCode.trim());
    alert('Đã ghi sổ cái điều chỉnh phép — có lưu vết người thực hiện');
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

        <select value={selectedCode} onChange={e => setSelectedCode(e.target.value)} className="text-xs p-2.5 rounded-lg border border-line bg-surface font-semibold text-ink">
          {employees.map((e: any) => <option key={e.employeeCode} value={e.employeeCode}>{e.fullName} ({e.employeeCode})</option>)}
        </select>
        <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="text-xs p-2.5 rounded-lg border border-line bg-surface font-semibold text-ink">
          <option value="ALL">Tất cả tháng</option>
          {['01','02','03','04','05','06','07','08','09','10','11','12'].map(m => <option key={m} value={m}>Tháng {m}</option>)}
        </select>
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
        onClose={() => { setIsAdjustModalOpen(false); setAdjustError(null); }}
        title="Điều Chỉnh Số Dư Phép Năm (HR Admin)"
      >
        <form onSubmit={handleAdjustLeave} className="space-y-4 text-xs">
          {adjustError && <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2">{adjustError}</div>}
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
