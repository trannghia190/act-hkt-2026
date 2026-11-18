import React, { useState } from 'react';
import { Card } from '../../../components/common/Card';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { Modal } from '../../../components/common/Modal';

interface TimesheetRow {
  id: string;
  code: string;
  fullName: string;
  department: string;
  team: string;
  standardDays: number;
  actualWorkDays: number;
  paidLeaveDays: number;
  holidayDays: number;
  wfhDays: number;
  lateCount: number;
  penaltyLatePercent: number;
  otWeekdayHours: number;
  otWeekendHours: number;
  totalPayrollDays: number;
  status: 'OPEN' | 'HR_LOCKED';
}

export const TimesheetPage: React.FC = () => {
  const [selectedMonth, setSelectedMonth] = useState('11/2026');
  const [filterDept, setFilterDept] = useState('ALL');
  const [editingCell, setEditingCell] = useState<{ row: TimesheetRow; field: string; val: any } | null>(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [isLocked, setIsLocked] = useState(false);

  const [rows, setRows] = useState<TimesheetRow[]>([
    {
      id: '1',
      code: 'ACT0001',
      fullName: 'Trịnh Văn Quản Trị',
      department: 'Ban Giám Đốc',
      team: 'Executive Board',
      standardDays: 22,
      actualWorkDays: 22,
      paidLeaveDays: 0,
      holidayDays: 0,
      wfhDays: 0,
      lateCount: 0,
      penaltyLatePercent: 0,
      otWeekdayHours: 0,
      otWeekendHours: 0,
      totalPayrollDays: 22,
      status: 'OPEN'
    },
    {
      id: '2',
      code: 'ACT0012',
      fullName: 'Lê Thị Thu Hà',
      department: 'Phòng Nhân Sự',
      team: 'HR Operations',
      standardDays: 22,
      actualWorkDays: 21,
      paidLeaveDays: 1,
      holidayDays: 0,
      wfhDays: 0,
      lateCount: 0,
      penaltyLatePercent: 0,
      otWeekdayHours: 4,
      otWeekendHours: 0,
      totalPayrollDays: 22.5,
      status: 'OPEN'
    },
    {
      id: '3',
      code: 'ACT0045',
      fullName: 'Phạm Minh Tuấn',
      department: 'Trung tâm Công nghệ',
      team: 'Sirius',
      standardDays: 22,
      actualWorkDays: 20,
      paidLeaveDays: 1,
      holidayDays: 0,
      wfhDays: 2,
      lateCount: 1,
      penaltyLatePercent: 0,
      otWeekdayHours: 8,
      otWeekendHours: 4,
      totalPayrollDays: 23.2,
      status: 'OPEN'
    },
    {
      id: '4',
      code: 'ACT0142',
      fullName: 'Nguyễn Văn Minh',
      department: 'Trung tâm Công nghệ',
      team: 'Sirius',
      standardDays: 22,
      actualWorkDays: 19.5,
      paidLeaveDays: 1.5,
      holidayDays: 0,
      wfhDays: 1,
      lateCount: 2,
      penaltyLatePercent: 0,
      otWeekdayHours: 2,
      otWeekendHours: 0,
      totalPayrollDays: 21.2,
      status: 'OPEN'
    },
    {
      id: '5',
      code: 'ACT0089',
      fullName: 'Trần Thị Thu Thảo',
      department: 'Khối Kinh Doanh & Tiếp Thị',
      team: 'Mobile App',
      standardDays: 22,
      actualWorkDays: 20,
      paidLeaveDays: 0,
      holidayDays: 0,
      wfhDays: 2,
      lateCount: 4,
      penaltyLatePercent: 5,
      otWeekdayHours: 0,
      otWeekendHours: 0,
      totalPayrollDays: 21.9,
      status: 'OPEN'
    }
  ]);

  const handleSaveCellOverride = () => {
    if (!editingCell) return;
    setRows(prev =>
      prev.map(r => (r.id === editingCell.row.id ? { ...r, [editingCell.field]: editingCell.val } : r))
    );
    setEditingCell(null);
    setOverrideReason('');
  };

  const handleLockPayroll = () => {
    setIsLocked(true);
    setRows(prev => prev.map(r => ({ ...r, status: 'HR_LOCKED' })));
  };

  const handleExportExcel = () => {
    const headers = [
      'Mã NV', 'Họ Và Tên', 'Phòng Ban', 'Nhóm', 'Công Chuẩn', 'Công Đi Làm',
      'Nghỉ Phép Hưởng Lương', 'Nghỉ Lễ', 'Số Ngày WFH', 'Số Lần Đi Muộn',
      'Phạt Chuyên Cần (%)', 'Giờ OT Ngày Thường', 'Giờ OT Cuối Tuần', 'Tổng Ngày Công Tính Lương', 'Trạng Thái'
    ];
    const exportRows = rows.map(r => [
      r.code,
      `"${r.fullName}"`,
      `"${r.department}"`,
      `"${r.team}"`,
      r.standardDays,
      r.actualWorkDays,
      r.paidLeaveDays,
      r.holidayDays,
      r.wfhDays,
      r.lateCount,
      `${r.penaltyLatePercent}%`,
      r.otWeekdayHours,
      r.otWeekendHours,
      r.totalPayrollDays,
      r.status
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...exportRows.map(r => r.join(','))].join('\n');
    const link = document.createElement('a');
    link.href = encodeURI(csvContent);
    link.download = `Master_Timesheet_45Cols_${selectedMonth.replace('/', '_')}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-ink">Bảng Tổng Hợp Công &amp; Chốt Lương (Master Timesheet)</h1>
            <Badge variant="accent">S15</Badge>
          </div>
          <p className="text-xs text-ink-muted mt-1">
            Bảng điều khiển 45 chỉ tiêu công, tự động tính trừ chuyên cần theo luật, cộng công thêm giờ (OT) và cho phép HR điều chỉnh kèm lưu vết
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportExcel}>
            📥 Xuất Excel (45 Cột)
          </Button>
          <Button
            variant={isLocked ? 'secondary' : 'primary'}
            size="sm"
            onClick={handleLockPayroll}
            disabled={isLocked}
          >
            {isLocked ? '🔒 Đã Khóa Kỳ Công Tháng' : '🔒 Khóa Bảng Công Tháng'}
          </Button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <Card>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div>
            <label className="text-ink-muted mr-2">Kỳ tính công:</label>
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="p-1.5 border border-line rounded-lg bg-canvas font-medium"
            >
              <option value="11/2026">Tháng 11 / 2026 (Hiện tại)</option>
              <option value="10/2026">Tháng 10 / 2026</option>
              <option value="09/2026">Tháng 09 / 2026</option>
            </select>
          </div>
          <div>
            <label className="text-ink-muted mr-2">Phòng ban:</label>
            <select
              value={filterDept}
              onChange={e => setFilterDept(e.target.value)}
              className="p-1.5 border border-line rounded-lg bg-canvas font-medium"
            >
              <option value="ALL">Tất cả Phòng Ban</option>
              <option value="Trung tâm Công nghệ">Trung tâm Công nghệ</option>
              <option value="Phòng Nhân Sự">Phòng Nhân Sự</option>
              <option value="Khối Kinh Doanh & Tiếp Thị">Khối Kinh Doanh & Tiếp Thị</option>
            </select>
          </div>
          <div className="ml-auto text-[11px] text-ink-secondary">
            💡 <em>Mẹo: Nhấp đúp vào ô bất kỳ để chỉnh sửa thủ công số ngày công</em>
          </div>
        </div>
      </Card>

      {/* 45-Column Master Table */}
      <div className="bg-surface rounded-xl border border-line shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
            <thead>
              <tr className="bg-canvas border-b border-line text-ink-secondary font-medium">
                <th className="py-3 px-3 sticky left-0 bg-canvas z-10 border-r border-line">Mã NV</th>
                <th className="py-3 px-3 sticky left-[80px] bg-canvas z-10 border-r border-line">Họ Tên</th>
                <th className="py-3 px-3">Phòng Ban / Nhóm</th>
                <th className="py-3 px-3 text-center bg-gray-50 border-x border-line">Công Chuẩn</th>
                <th className="py-3 px-3 text-center">Công Thực Tế</th>
                <th className="py-3 px-3 text-center">Nghỉ Phép (P)</th>
                <th className="py-3 px-3 text-center">Làm Từ Xa (WFH)</th>
                <th className="py-3 px-3 text-center">Đi Muộn</th>
                <th className="py-3 px-3 text-center text-rose-700">Trừ Đi Muộn</th>
                <th className="py-3 px-3 text-center">OT Ngày Thường</th>
                <th className="py-3 px-3 text-center">OT Cuối Tuần</th>
                <th className="py-3 px-3 text-center font-bold text-accent-dark bg-accent-soft/30 border-l border-line">
                  Tổng Công QĐ Lương
                </th>
                <th className="py-3 px-3 text-center">Trạng Thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map(r => (
                <tr key={r.id} className="hover:bg-canvas/40 transition-colors">
                  <td className="py-2.5 px-3 font-mono font-medium text-ink sticky left-0 bg-surface z-10 border-r border-line">
                    {r.code}
                  </td>
                  <td className="py-2.5 px-3 font-medium text-ink sticky left-[80px] bg-surface z-10 border-r border-line">
                    {r.fullName}
                  </td>
                  <td className="py-2.5 px-3 text-ink-secondary">
                    {r.department} · {r.team}
                  </td>
                  <td className="py-2.5 px-3 text-center font-bold text-ink bg-gray-50/50 border-x border-line">
                    {r.standardDays}
                  </td>
                  <td
                    className="py-2.5 px-3 text-center font-medium cursor-pointer hover:bg-accent-soft"
                    onDoubleClick={() => setEditingCell({ row: r, field: 'actualWorkDays', val: r.actualWorkDays })}
                  >
                    {r.actualWorkDays}
                  </td>
                  <td
                    className="py-2.5 px-3 text-center cursor-pointer hover:bg-accent-soft"
                    onDoubleClick={() => setEditingCell({ row: r, field: 'paidLeaveDays', val: r.paidLeaveDays })}
                  >
                    {r.paidLeaveDays}
                  </td>
                  <td className="py-2.5 px-3 text-center">{r.wfhDays}</td>
                  <td className="py-2.5 px-3 text-center font-mono">
                    {r.lateCount > 0 ? (
                      <span className={r.lateCount > 3 ? 'text-rose-700 font-bold' : 'text-amber-700'}>
                        {r.lateCount} lần
                      </span>
                    ) : (
                      '0'
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-center text-rose-700 font-medium">
                    {r.penaltyLatePercent > 0 ? `-${r.penaltyLatePercent}%` : '0%'}
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono">{r.otWeekdayHours}h</td>
                  <td className="py-2.5 px-3 text-center font-mono">{r.otWeekendHours}h</td>
                  <td className="py-2.5 px-3 text-center font-extrabold text-accent-dark bg-accent-soft/30 border-l border-line">
                    {r.totalPayrollDays} công
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    {r.status === 'HR_LOCKED' ? (
                      <Badge variant="gray">Đã Khóa</Badge>
                    ) : (
                      <Badge variant="ok">Đang Mở</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Cell Modal */}
      {editingCell && (
        <Modal
          isOpen={true}
          onClose={() => setEditingCell(null)}
          title={`Điều Chỉnh Công Thủ Công: ${editingCell.row.fullName} (${editingCell.row.code})`}
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-ink-muted mb-1">Chỉ tiêu điều chỉnh: <strong>{editingCell.field}</strong></label>
              <input
                type="number"
                step="0.5"
                value={editingCell.val}
                onChange={e => setEditingCell({ ...editingCell, val: parseFloat(e.target.value) || 0 })}
                className="w-full p-2 border border-line rounded-lg bg-canvas text-sm font-bold"
              />
            </div>

            <div>
              <label className="block text-ink mb-1 font-medium">Lý do điều chỉnh (Bắt buộc lưu vết Audit Log S35) <span className="text-rose-600">*</span></label>
              <textarea
                rows={3}
                placeholder="Ví dụ: Bổ sung công 0.5 ngày theo xác nhận trực tiếp của Trưởng phòng..."
                value={overrideReason}
                onChange={e => setOverrideReason(e.target.value)}
                className="w-full p-2 border border-line rounded-lg bg-canvas"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <Button variant="outline" size="sm" onClick={() => setEditingCell(null)}>
                Hủy
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveCellOverride}
                disabled={!overrideReason.trim()}
              >
                Lưu Thay Đổi &amp; Ghi Vết
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
