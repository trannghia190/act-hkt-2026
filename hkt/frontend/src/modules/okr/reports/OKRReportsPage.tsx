import React, { useState } from 'react';
import { Card } from '../../../components/common/Card';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { Modal } from '../../../components/common/Modal';

export interface HRSummaryRecord {
  code: string;
  fullName: string;
  department: string;
  jobTitle: string;
  avgOkrProgress: number; // percentage
  assessmentScore: number; // 1-5
  performanceGrade: 'A+' | 'A' | 'B' | 'C' | 'D';
  bonusFactor: number; // e.g. 1.5x, 1.2x, 1.0x, 0.8x, 0.0x
  hrStatus: 'COMPLETED' | 'IN_REVIEW';
}

const INITIAL_RECORDS: HRSummaryRecord[] = [
  {
    code: 'ACT0001',
    fullName: 'Trịnh Văn Quản Trị',
    department: 'Ban Giám Đốc',
    jobTitle: 'Tổng Giám Đốc',
    avgOkrProgress: 95.5,
    assessmentScore: 4.8,
    performanceGrade: 'A+',
    bonusFactor: 2.0,
    hrStatus: 'COMPLETED'
  },
  {
    code: 'ACT0012',
    fullName: 'Lê Thị Thu Hà',
    department: 'Phòng Nhân Sự',
    jobTitle: 'Trưởng Phòng Nhân Sự',
    avgOkrProgress: 92.0,
    assessmentScore: 4.5,
    performanceGrade: 'A',
    bonusFactor: 1.5,
    hrStatus: 'COMPLETED'
  },
  {
    code: 'ACT0045',
    fullName: 'Phạm Minh Tuấn',
    department: 'Trung tâm Công nghệ',
    jobTitle: 'Engineering Manager (Sirius)',
    avgOkrProgress: 91.2,
    assessmentScore: 4.5,
    performanceGrade: 'A',
    bonusFactor: 1.5,
    hrStatus: 'COMPLETED'
  },
  {
    code: 'ACT0142',
    fullName: 'Nguyễn Văn Minh',
    department: 'Trung tâm Công nghệ',
    jobTitle: 'Senior Backend Engineer',
    avgOkrProgress: 88.5,
    assessmentScore: 4.2,
    performanceGrade: 'A',
    bonusFactor: 1.4,
    hrStatus: 'COMPLETED'
  },
  {
    code: 'ACT0055',
    fullName: 'Hoàng Anh Dũng',
    department: 'Trung tâm Công nghệ',
    jobTitle: 'AI Lead (Optimus)',
    avgOkrProgress: 84.0,
    assessmentScore: 3.8,
    performanceGrade: 'B',
    bonusFactor: 1.0,
    hrStatus: 'COMPLETED'
  },
  {
    code: 'ACT0089',
    fullName: 'Trần Thị Thu Thảo',
    department: 'Khối Kinh Doanh & Tiếp Thị',
    jobTitle: 'Product Specialist',
    avgOkrProgress: 79.5,
    assessmentScore: 3.6,
    performanceGrade: 'B',
    bonusFactor: 1.0,
    hrStatus: 'COMPLETED'
  },
  {
    code: 'ACT0199',
    fullName: 'Hoàng Quốc Việt',
    department: 'Trung tâm Công nghệ',
    jobTitle: 'Junior Developer',
    avgOkrProgress: 65.0,
    assessmentScore: 2.9,
    performanceGrade: 'C',
    bonusFactor: 0.7,
    hrStatus: 'IN_REVIEW'
  }
];

export const OKRReportsPage: React.FC = () => {
  const [records, setRecords] = useState<HRSummaryRecord[]>(INITIAL_RECORDS);
  const [searchTerm, setSearchTerm] = useState('');
  const [gradeFilter, setGradeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Add / Edit Modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newRec, setNewRec] = useState<HRSummaryRecord>({
    code: '',
    fullName: '',
    department: 'Trung tâm Công nghệ',
    jobTitle: 'Software Engineer',
    avgOkrProgress: 85.0,
    assessmentScore: 4.0,
    performanceGrade: 'B',
    bonusFactor: 1.0,
    hrStatus: 'IN_REVIEW'
  });

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3000);
  };

  const handleExportCSV = () => {
    const headers = ['Mã NV', 'Họ và Tên', 'Phòng Ban', 'Vị Trí', 'OKR TB Năm (%)', 'Điểm Đánh Giá', 'Xếp Loại', 'Hệ Số Thưởng', 'Trạng Thái HR'];
    const rows = records.map(r => [
      r.code,
      `"${r.fullName}"`,
      `"${r.department}"`,
      `"${r.jobTitle}"`,
      r.avgOkrProgress,
      r.assessmentScore,
      r.performanceGrade,
      `${r.bonusFactor}x`,
      r.hrStatus
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const link = document.createElement('a');
    link.href = encodeURI(csvContent);
    link.download = `OKR_HR_Report_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    showToast('Đã xuất thành công file báo cáo OKR & Xếp loại HR (CSV)');
  };

  const handleSendToAccounting = () => {
    if (confirm('Chuyển toàn bộ danh sách hệ số thưởng và kết quả xếp loại sang bộ phận Kế toán / C&B để tính thưởng Tết?')) {
      showToast('Đã gửi dữ liệu xếp loại OKR sang cổng thông tin Kế toán & C&B thành công');
    }
  };

  const handleAddRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRec.code.trim() || !newRec.fullName.trim()) return;

    setRecords([...records, { ...newRec, code: newRec.code.trim().toUpperCase() }]);
    setIsAddOpen(false);
    showToast(`Đã thêm nhân sự ${newRec.fullName} vào bảng báo cáo`);
  };

  const handleDeleteRecord = (code: string, name: string) => {
    if (confirm(`Xóa bản ghi của "${name}" khỏi báo cáo?`)) {
      setRecords(records.filter(r => r.code !== code));
      showToast(`Đã xóa bản ghi ${code}`);
    }
  };

  const filteredRecords = records.filter(r => {
    if (gradeFilter !== 'ALL' && r.performanceGrade !== gradeFilter) return false;
    if (statusFilter !== 'ALL' && r.hrStatus !== statusFilter) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const match =
        r.fullName.toLowerCase().includes(q) ||
        r.code.toLowerCase().includes(q) ||
        r.department.toLowerCase().includes(q) ||
        r.jobTitle.toLowerCase().includes(q);
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
            <h1 className="text-xl font-bold tracking-tight text-ink">Báo Cáo Tổng Hợp OKR &amp; Xếp Loại HR (9 Trường Dữ Liệu)</h1>
            <Badge variant="accent">S25</Badge>
          </div>
          <p className="text-xs text-ink-muted mt-1">
            Bảng dữ liệu chuẩn phục vụ Hội Đồng Lương Thưởng: 9 trường thông tin cốt lõi, hệ số thưởng hiệu suất và xuất file Excel
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setIsAddOpen(true)}>
            + Thêm Bản Ghi
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            📥 Xuất File Báo Cáo Excel (CSV)
          </Button>
          <Button variant="primary" size="sm" onClick={handleSendToAccounting}>
            Gửi Báo Cáo Sang Kế Toán / C&amp;B
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-surface p-3 rounded-xl border border-line shadow-2xs">
        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
          <input
            type="text"
            placeholder="Tìm theo tên, mã NV, phòng ban, chức vụ..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="text-xs px-3 py-1.5 rounded-lg border border-line bg-canvas text-ink focus:outline-none focus:ring-1 focus:ring-accent w-full sm:w-64"
          />

          <select
            value={gradeFilter}
            onChange={e => setGradeFilter(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-line bg-canvas text-ink"
          >
            <option value="ALL">Tất cả xếp loại</option>
            <option value="A+">Xếp loại A+</option>
            <option value="A">Xếp loại A</option>
            <option value="B">Xếp loại B</option>
            <option value="C">Xếp loại C</option>
            <option value="D">Xếp loại D</option>
          </select>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-line bg-canvas text-ink"
          >
            <option value="ALL">Tất cả trạng thái HR</option>
            <option value="COMPLETED">Đã Khóa Sổ</option>
            <option value="IN_REVIEW">Đang Rà Soát</option>
          </select>
        </div>

        <div className="text-xs text-ink-muted">
          Tổng cộng: <strong className="text-ink">{filteredRecords.length}</strong> nhân sự
        </div>
      </div>

      {/* 9-Field Table */}
      <div className="bg-surface rounded-xl border border-line shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
            <thead>
              <tr className="bg-canvas border-b border-line text-ink-secondary font-medium">
                <th className="py-3 px-4">1. Mã NV</th>
                <th className="py-3 px-4">2. Họ và Tên</th>
                <th className="py-3 px-4">3. Phòng Ban / Khối</th>
                <th className="py-3 px-4">4. Vị Trí Chức Danh</th>
                <th className="py-3 px-4 text-center">5. OKR TB Năm</th>
                <th className="py-3 px-4 text-center">6. Điểm Cuối Năm</th>
                <th className="py-3 px-4 text-center">7. Xếp Loại (Grade)</th>
                <th className="py-3 px-4 text-center font-bold text-accent">8. Hệ Số Thưởng</th>
                <th className="py-3 px-4 text-center">9. Trạng Thái HR</th>
                <th className="py-3 px-4 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-ink-muted">
                    Không có bản ghi nào phù hợp.
                  </td>
                </tr>
              ) : (
                filteredRecords.map(rec => (
                  <tr key={rec.code} className="hover:bg-canvas/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-ink">{rec.code}</td>
                    <td className="py-3 px-4 font-semibold text-ink">{rec.fullName}</td>
                    <td className="py-3 px-4 text-ink-secondary">{rec.department}</td>
                    <td className="py-3 px-4 text-ink-secondary">{rec.jobTitle}</td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-ink">
                      {rec.avgOkrProgress.toFixed(1)}%
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-ink">
                      {rec.assessmentScore.toFixed(1)} / 5.0
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-block font-black px-2 py-0.5 rounded text-xs ${rec.performanceGrade === 'A+'
                            ? 'bg-accent text-white'
                            : rec.performanceGrade === 'A'
                              ? 'bg-emerald-100 text-emerald-800'
                              : rec.performanceGrade === 'B'
                                ? 'bg-blue-100 text-blue-800'
                                : rec.performanceGrade === 'C'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-rose-100 text-rose-800'
                          }`}
                      >
                        {rec.performanceGrade}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-extrabold text-accent text-sm">
                      {rec.bonusFactor.toFixed(1)}x
                    </td>
                    <td className="py-3 px-4 text-center">
                      {rec.hrStatus === 'COMPLETED' ? (
                        <Badge variant="ok">Đã Khóa Sổ</Badge>
                      ) : (
                        <Badge variant="warn">Đang Rà Soát</Badge>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleDeleteRecord(rec.code, rec.fullName)}
                        className="p-1 text-xs text-ink-muted hover:text-status-danger rounded"
                        title="Xóa bản ghi"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Record Modal */}
      {isAddOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsAddOpen(false)}
          title="Thêm Bản Ghi Xếp Loại &amp; Thưởng OKR"
          maxWidth="md"
        >
          <form onSubmit={handleAddRecord} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-ink mb-1">Mã Nhân Viên *</label>
                <input
                  type="text"
                  required
                  placeholder="VD: ACT0220"
                  value={newRec.code}
                  onChange={e => setNewRec({ ...newRec, code: e.target.value })}
                  className="w-full p-2 border border-line rounded-lg bg-surface text-ink font-mono uppercase"
                />
              </div>
              <div>
                <label className="block font-medium text-ink mb-1">Họ Và Tên *</label>
                <input
                  type="text"
                  required
                  placeholder="VD: Nguyễn Thành Đạt"
                  value={newRec.fullName}
                  onChange={e => setNewRec({ ...newRec, fullName: e.target.value })}
                  className="w-full p-2 border border-line rounded-lg bg-surface text-ink"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-ink mb-1">Phòng Ban / Khối</label>
                <input
                  type="text"
                  required
                  value={newRec.department}
                  onChange={e => setNewRec({ ...newRec, department: e.target.value })}
                  className="w-full p-2 border border-line rounded-lg bg-surface text-ink"
                />
              </div>
              <div>
                <label className="block font-medium text-ink mb-1">Vị Trí Chức Danh</label>
                <input
                  type="text"
                  required
                  value={newRec.jobTitle}
                  onChange={e => setNewRec({ ...newRec, jobTitle: e.target.value })}
                  className="w-full p-2 border border-line rounded-lg bg-surface text-ink"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block font-medium text-ink mb-1">OKR TB Năm (%)</label>
                <input
                  type="number"
                  step="0.5"
                  required
                  value={newRec.avgOkrProgress}
                  onChange={e => setNewRec({ ...newRec, avgOkrProgress: parseFloat(e.target.value) || 0 })}
                  className="w-full p-2 border border-line rounded-lg bg-surface text-ink font-mono"
                />
              </div>
              <div>
                <label className="block font-medium text-ink mb-1">Xếp Loại</label>
                <select
                  value={newRec.performanceGrade}
                  onChange={e => setNewRec({ ...newRec, performanceGrade: e.target.value as any })}
                  className="w-full p-2 border border-line rounded-lg bg-surface text-ink font-bold"
                >
                  <option value="A+">A+ (Xuất sắc)</option>
                  <option value="A">A (Vượt trội)</option>
                  <option value="B">B (Đạt yêu cầu)</option>
                  <option value="C">C (Cần cố gắng)</option>
                  <option value="D">D (Không đạt)</option>
                </select>
              </div>
              <div>
                <label className="block font-medium text-ink mb-1">Hệ Số Thưởng</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={newRec.bonusFactor}
                  onChange={e => setNewRec({ ...newRec, bonusFactor: parseFloat(e.target.value) || 1.0 })}
                  className="w-full p-2 border border-line rounded-lg bg-surface text-ink font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <Button variant="outline" size="sm" type="button" onClick={() => setIsAddOpen(false)}>
                Hủy
              </Button>
              <Button variant="primary" size="sm" type="submit">
                Lưu Bản Ghi
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
