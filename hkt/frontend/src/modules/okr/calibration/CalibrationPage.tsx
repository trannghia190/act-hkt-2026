import React, { useState } from 'react';
import { Card } from '../../../components/common/Card';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { Modal } from '../../../components/common/Modal';

export interface EmployeeRating {
  id: string;
  code: string;
  fullName: string;
  team: string;
  managerScore: number;
  calibratedGrade: 'A+' | 'A' | 'B' | 'C' | 'D';
}

const INITIAL_RATINGS: EmployeeRating[] = [
  { id: '1', code: 'ACT0001', fullName: 'Trịnh Văn Quản Trị', team: 'Executive', managerScore: 4.8, calibratedGrade: 'A+' },
  { id: '2', code: 'ACT0045', fullName: 'Phạm Minh Tuấn', team: 'Sirius', managerScore: 4.5, calibratedGrade: 'A' },
  { id: '3', code: 'ACT0142', fullName: 'Nguyễn Văn Minh', team: 'Sirius', managerScore: 4.2, calibratedGrade: 'A' },
  { id: '4', code: 'ACT0055', fullName: 'Hoàng Anh Dũng', team: 'Optimus', managerScore: 3.8, calibratedGrade: 'B' },
  { id: '5', code: 'ACT0089', fullName: 'Trần Thị Thu Thảo', team: 'Mobile App', managerScore: 3.6, calibratedGrade: 'B' },
  { id: '6', code: 'ACT0112', fullName: 'Vũ Quốc Toàn', team: 'DevOps', managerScore: 3.5, calibratedGrade: 'B' },
  { id: '7', code: 'ACT0199', fullName: 'Hoàng Quốc Việt', team: 'Optimus', managerScore: 2.9, calibratedGrade: 'C' },
  { id: '8', code: 'ACT0210', fullName: 'Đỗ Thị Lan', team: 'Marketing', managerScore: 2.4, calibratedGrade: 'D' },
];

export const CalibrationPage: React.FC = () => {
  const [employees, setEmployees] = useState<EmployeeRating[]>(INITIAL_RATINGS);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGrade, setFilterGrade] = useState('ALL');
  const [isLocked, setIsLocked] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const [newEmp, setNewEmp] = useState({
    code: '',
    fullName: '',
    team: 'Sirius',
    managerScore: 4.0,
    calibratedGrade: 'B' as const
  });

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3000);
  };

  const total = employees.length;
  const gradeCounts = {
    'A+': employees.filter(e => e.calibratedGrade === 'A+').length,
    'A': employees.filter(e => e.calibratedGrade === 'A').length,
    'B': employees.filter(e => e.calibratedGrade === 'B').length,
    'C': employees.filter(e => e.calibratedGrade === 'C').length,
    'D': employees.filter(e => e.calibratedGrade === 'D').length,
  };

  const handleGradeChange = (id: string, grade: 'A+' | 'A' | 'B' | 'C' | 'D') => {
    if (isLocked) {
      alert('Đợt Calibration đã bị khóa, không thể thay đổi xếp loại!');
      return;
    }
    setEmployees(prev => prev.map(e => (e.id === id ? { ...e, calibratedGrade: grade } : e)));
    showToast(`Đã cập nhật xếp loại thành ${grade}`);
  };

  const handleLockCalibration = () => {
    if (confirm('Khóa kết quả Calibration đợt này? Sau khi khóa, điểm số sẽ được ghi nhận vào Audit Log (S35) và không thể chỉnh sửa.')) {
      setIsLocked(true);
      showToast('Đã khóa kết quả Calibration & lưu vết kiểm toán thành công');
    }
  };

  const handleAddEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmp.code.trim() || !newEmp.fullName.trim()) return;

    const created: EmployeeRating = {
      id: String(Date.now()),
      code: newEmp.code.trim().toUpperCase(),
      fullName: newEmp.fullName.trim(),
      team: newEmp.team,
      managerScore: newEmp.managerScore,
      calibratedGrade: newEmp.calibratedGrade
    };

    setEmployees([...employees, created]);
    setIsAddOpen(false);
    showToast(`Đã thêm ${created.fullName} vào phiên cân chuẩn`);
  };

  const handleDeleteEmployee = (id: string, name: string) => {
    if (isLocked) {
      alert('Đợt Calibration đã bị khóa!');
      return;
    }
    if (confirm(`Xóa nhân sự "${name}" khỏi đợt cân chuẩn này?`)) {
      setEmployees(employees.filter(e => e.id !== id));
      showToast(`Đã xóa ${name}`);
    }
  };

  const handleExportCSV = () => {
    const headers = ['Mã NV', 'Họ Và Tên', 'Nhóm', 'Điểm Quản Lý', 'Xếp Loại Hiệu Chuẩn'];
    const rows = employees.map(e => [e.code, `"${e.fullName}"`, e.team, e.managerScore, e.calibratedGrade]);
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const link = document.createElement('a');
    link.href = encodeURI(csvContent);
    link.download = `Calibration_Report_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    showToast('Đã xuất file báo cáo Calibration (CSV)');
  };

  const filteredEmployees = employees.filter(e => {
    if (filterGrade !== 'ALL' && e.calibratedGrade !== filterGrade) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const match = e.fullName.toLowerCase().includes(q) || e.code.toLowerCase().includes(q) || e.team.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Toast */}
      {successToast && (
        <div className="fixed top-16 right-6 z-50 bg-emerald-700 text-white px-4 py-2.5 rounded-lg shadow-lg text-xs font-semibold flex items-center gap-2 animate-bounce">
          <span>✓</span>
          <span>{successToast}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-ink">Bảng So Sánh &amp; Cân Chuẩn Điểm (Calibration Bell Curve)</h1>
            <Badge variant="accent">S24</Badge>
            {isLocked && <Badge variant="warn">Đã Khóa Phiên</Badge>}
          </div>
          <p className="text-xs text-ink-muted mt-1">
            Hiệu chuẩn phân phối điểm đánh giá toàn công ty theo mô hình hình chuông chuẩn Bell Curve (10% - 20% - 40% - 20% - 10%)
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            📥 Xuất Báo Cáo (CSV)
          </Button>
          {!isLocked && (
            <Button variant="outline" size="sm" onClick={() => setIsAddOpen(true)}>
              + Thêm Nhân Sự
            </Button>
          )}
          <Button
            variant={isLocked ? 'secondary' : 'primary'}
            size="sm"
            onClick={handleLockCalibration}
            disabled={isLocked}
          >
            {isLocked ? '🔒 Đã Khóa Kết Quả' : '🔒 Khóa Kết Quả & Lưu Audit Log (S35)'}
          </Button>
        </div>
      </div>

      {/* Bell Curve Distribution Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="p-3 bg-surface rounded-xl border border-line text-center">
          <div className="text-[11px] font-bold text-accent">A+ (Xuất Sắc - Top 10%)</div>
          <div className="text-2xl font-extrabold text-ink mt-1">
            {gradeCounts['A+']} <span className="text-xs text-ink-muted font-normal">/ {Math.max(1, Math.round(total * 0.1))} chỉ tiêu</span>
          </div>
          <div className="text-[10px] text-ink-muted mt-1">Thực tế: {Math.round((gradeCounts['A+'] / total) * 100)}%</div>
        </div>

        <div className="p-3 bg-surface rounded-xl border border-line text-center">
          <div className="text-[11px] font-bold text-emerald-700">A (Vượt Trội - 20%)</div>
          <div className="text-2xl font-extrabold text-ink mt-1">
            {gradeCounts['A']} <span className="text-xs text-ink-muted font-normal">/ {Math.max(1, Math.round(total * 0.2))} chỉ tiêu</span>
          </div>
          <div className="text-[10px] text-ink-muted mt-1">Thực tế: {Math.round((gradeCounts['A'] / total) * 100)}%</div>
        </div>

        <div className="p-3 bg-surface rounded-xl border border-line text-center">
          <div className="text-[11px] font-bold text-blue-700">B (Đạt Kỳ Vọng - 40%)</div>
          <div className="text-2xl font-extrabold text-ink mt-1">
            {gradeCounts['B']} <span className="text-xs text-ink-muted font-normal">/ {Math.max(1, Math.round(total * 0.4))} chỉ tiêu</span>
          </div>
          <div className="text-[10px] text-ink-muted mt-1">Thực tế: {Math.round((gradeCounts['B'] / total) * 100)}%</div>
        </div>

        <div className="p-3 bg-surface rounded-xl border border-line text-center">
          <div className="text-[11px] font-bold text-amber-700">C (Cần Cải Thiện - 20%)</div>
          <div className="text-2xl font-extrabold text-ink mt-1">
            {gradeCounts['C']} <span className="text-xs text-ink-muted font-normal">/ {Math.max(1, Math.round(total * 0.2))} chỉ tiêu</span>
          </div>
          <div className="text-[10px] text-ink-muted mt-1">Thực tế: {Math.round((gradeCounts['C'] / total) * 100)}%</div>
        </div>

        <div className="p-3 bg-surface rounded-xl border border-line text-center col-span-2 md:col-span-1">
          <div className="text-[11px] font-bold text-rose-700">D (Không Đạt - 10%)</div>
          <div className="text-2xl font-extrabold text-ink mt-1">
            {gradeCounts['D']} <span className="text-xs text-ink-muted font-normal">/ {Math.max(1, Math.round(total * 0.1))} chỉ tiêu</span>
          </div>
          <div className="text-[10px] text-ink-muted mt-1">Thực tế: {Math.round((gradeCounts['D'] / total) * 100)}%</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-surface p-3 rounded-xl border border-line shadow-2xs">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <input
            type="text"
            placeholder="Tìm theo tên nhân sự, mã số, nhóm..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="text-xs px-3 py-1.5 rounded-lg border border-line bg-canvas text-ink focus:outline-none focus:ring-1 focus:ring-accent w-full sm:w-72"
          />

          <select
            value={filterGrade}
            onChange={e => setFilterGrade(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-line bg-canvas text-ink font-semibold"
          >
            <option value="ALL">Tất cả xếp loại</option>
            <option value="A+">Xếp loại A+ (Xuất sắc)</option>
            <option value="A">Xếp loại A (Vượt trội)</option>
            <option value="B">Xếp loại B (Đạt yêu cầu)</option>
            <option value="C">Xếp loại C (Cần nỗ lực)</option>
            <option value="D">Xếp loại D (Không đạt)</option>
          </select>
        </div>

        <div className="text-xs text-ink-muted">
          Tổng cộng: <strong className="text-ink">{filteredEmployees.length}</strong> nhân sự
        </div>
      </div>

      {/* Calibration Table */}
      <div className="bg-surface rounded-xl border border-line shadow-2xs overflow-hidden">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-canvas border-b border-line text-ink-secondary font-medium">
              <th className="py-3 px-4">Mã NV</th>
              <th className="py-3 px-4">Họ Và Tên</th>
              <th className="py-3 px-4">Đội Nhóm</th>
              <th className="py-3 px-4">Điểm Đánh Giá Quản Lý</th>
              <th className="py-3 px-4">Xếp Loại Hiệu Chuẩn (Calibration)</th>
              <th className="py-3 px-4 text-right">Thao Tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filteredEmployees.map(emp => (
              <tr key={emp.id} className="hover:bg-canvas/40 transition-colors">
                <td className="py-3 px-4 font-mono font-medium text-ink">{emp.code}</td>
                <td className="py-3 px-4 font-semibold text-ink">{emp.fullName}</td>
                <td className="py-3 px-4 text-ink-secondary">{emp.team}</td>
                <td className="py-3 px-4 font-mono font-bold text-ink">{emp.managerScore.toFixed(1)} / 5.0</td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-1.5">
                    {(['A+', 'A', 'B', 'C', 'D'] as const).map(grade => (
                      <button
                        key={grade}
                        disabled={isLocked}
                        onClick={() => handleGradeChange(emp.id, grade)}
                        className={`px-2.5 py-1 text-xs font-bold rounded transition-all ${
                          emp.calibratedGrade === grade
                            ? grade === 'A+'
                              ? 'bg-accent text-white shadow-xs'
                              : grade === 'A'
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : grade === 'B'
                              ? 'bg-blue-600 text-white shadow-xs'
                              : grade === 'C'
                              ? 'bg-amber-600 text-white shadow-xs'
                              : 'bg-rose-600 text-white shadow-xs'
                            : 'bg-canvas text-ink-muted hover:text-ink hover:bg-line border border-line'
                        }`}
                      >
                        {grade}
                      </button>
                    ))}
                  </div>
                </td>
                <td className="py-3 px-4 text-right">
                  {!isLocked && (
                    <button
                      onClick={() => handleDeleteEmployee(emp.id, emp.fullName)}
                      className="p-1 text-xs text-ink-muted hover:text-status-danger rounded"
                      title="Xóa khỏi đợt"
                    >
                      🗑️
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Employee Modal */}
      {isAddOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsAddOpen(false)}
          title="Thêm Nhân Sự Vào Phiên Cân Chuẩn Điểm"
          maxWidth="md"
        >
          <form onSubmit={handleAddEmployee} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-ink mb-1">Mã Nhân Viên *</label>
                <input
                  type="text"
                  required
                  placeholder="VD: ACT0155"
                  value={newEmp.code}
                  onChange={e => setNewEmp({ ...newEmp, code: e.target.value })}
                  className="w-full p-2 border border-line rounded-lg bg-surface text-ink font-mono uppercase"
                />
              </div>
              <div>
                <label className="block font-medium text-ink mb-1">Họ Và Tên *</label>
                <input
                  type="text"
                  required
                  placeholder="VD: Nguyễn Văn An"
                  value={newEmp.fullName}
                  onChange={e => setNewEmp({ ...newEmp, fullName: e.target.value })}
                  className="w-full p-2 border border-line rounded-lg bg-surface text-ink"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-ink mb-1">Đội Nhóm *</label>
                <input
                  type="text"
                  required
                  value={newEmp.team}
                  onChange={e => setNewEmp({ ...newEmp, team: e.target.value })}
                  className="w-full p-2 border border-line rounded-lg bg-surface text-ink"
                />
              </div>
              <div>
                <label className="block font-medium text-ink mb-1">Điểm Quản Lý Đánh Giá (1 - 5)</label>
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  max="5"
                  required
                  value={newEmp.managerScore}
                  onChange={e => setNewEmp({ ...newEmp, managerScore: parseFloat(e.target.value) || 3.0 })}
                  className="w-full p-2 border border-line rounded-lg bg-surface text-ink font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <Button variant="outline" size="sm" type="button" onClick={() => setIsAddOpen(false)}>
                Hủy
              </Button>
              <Button variant="primary" size="sm" type="submit">
                Thêm Vào Danh Sách
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
