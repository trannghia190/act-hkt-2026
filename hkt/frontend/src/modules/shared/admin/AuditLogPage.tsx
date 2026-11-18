import React, { useState } from 'react';
import { Card } from '../../../components/common/Card';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { Modal } from '../../../components/common/Modal';

interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  actorEmail: string;
  action: string;
  category: 'SECURITY' | 'HR_TIMESHEET' | 'RULE_ENGINE' | 'OKR_CALIBRATION';
  targetResource: string;
  ipAddress: string;
  userAgent: string;
  oldValue?: string;
  newValue?: string;
  note?: string;
}

export const AuditLogPage: React.FC = () => {
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const logs: AuditLogEntry[] = [
    {
      id: 'AUD-88210',
      timestamp: '18/11/2026 08:30:15',
      actor: 'Lê Thị Thu Hà',
      actorEmail: 'hr.ha@actvn.edu.vn',
      action: 'UPDATE_RULE_PARAMETER',
      category: 'RULE_ENGINE',
      targetResource: 'RULE_WORK_REMOTE_MONTHLY_LIMIT',
      ipAddress: '192.168.1.45',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      oldValue: '{"max_days": 2, "applicable_roles": ["ALL"]}',
      newValue: '{"max_days": 3, "applicable_roles": ["TECH_DEV", "DATA"]}',
      note: 'Nâng hạn mức WFH từ 2 lên 3 ngày cho khối Công nghệ & Dữ liệu'
    },
    {
      id: 'AUD-88208',
      timestamp: '17/11/2026 17:42:01',
      actor: 'Trịnh Văn Quản Trị',
      actorEmail: 'admin@actvn.edu.vn',
      action: 'ASSIGN_USER_ROLE',
      category: 'SECURITY',
      targetResource: 'User: ACT0055 (Hoàng Anh Dũng)',
      ipAddress: '192.168.1.10',
      userAgent: 'Chrome 122.0.0 (Windows NT 10.0)',
      oldValue: 'ROLE_EMPLOYEE',
      newValue: 'ROLE_MANAGER',
      note: 'Bổ nhiệm Lead nhóm Optimus'
    },
    {
      id: 'AUD-88195',
      timestamp: '17/11/2026 15:10:22',
      actor: 'Lê Thị Thu Hà',
      actorEmail: 'hr.ha@actvn.edu.vn',
      action: 'MANUAL_TIMESHEET_OVERRIDE',
      category: 'HR_TIMESHEET',
      targetResource: 'Timesheet: ACT0142 - Date: 16/11/2026',
      ipAddress: '192.168.1.45',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      oldValue: '{"checkin": null, "status": "ABSENT"}',
      newValue: '{"checkin": "08:28", "status": "ON_TIME", "reason": "Thẻ từ hỏng tại cổng số 2"}',
      note: 'Điều chỉnh công theo đề xuất giải trình có xác nhận bảo vệ'
    },
    {
      id: 'AUD-88180',
      timestamp: '16/11/2026 14:15:30',
      actor: 'Trịnh Văn Quản Trị',
      actorEmail: 'admin@actvn.edu.vn',
      action: 'CALIBRATION_CURVE_ADJUSTMENT',
      category: 'OKR_CALIBRATION',
      targetResource: 'OKR Cycle: 2026 Annual Evaluation',
      ipAddress: '192.168.1.10',
      userAgent: 'Safari 17.2 (macOS)',
      oldValue: 'Rating Top 10%: Count 15 employees',
      newValue: 'Rating Top 10%: Count 12 employees (Đạt chuẩn Bell Curve 10%)',
      note: 'Khóa kết quả calibration cuối năm của khối Engineering'
    }
  ];

  const filteredLogs = logs.filter(log => {
    const matchesCategory = filterCategory === 'ALL' || log.category === filterCategory;
    const matchesSearch =
      log.actor.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.targetResource.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleExportCSV = () => {
    const headers = ['Mã Log', 'Thời Gian', 'Người Thực Hiện', 'Email', 'Hành Động', 'Phân Loại', 'Tài Nguyên Tác Động', 'Địa Chỉ IP', 'Ghi Chú'];
    const rows = filteredLogs.map(l => [
      l.id,
      l.timestamp,
      `"${l.actor}"`,
      l.actorEmail,
      l.action,
      l.category,
      `"${l.targetResource}"`,
      l.ipAddress,
      `"${l.note || ''}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const link = document.createElement('a');
    link.href = encodeURI(csvContent);
    link.download = `Audit_Logs_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-ink">Nhật Ký Kiểm Toán (Audit Logs)</h1>
            <Badge variant="accent">S35</Badge>
          </div>
          <p className="text-xs text-ink-muted mt-1">
            Ghi vết bất biến toàn bộ các hành động nhạy cảm: thay đổi quyền người dùng, chỉnh sửa bảng công, cập nhật rule engine và hiệu chỉnh điểm OKR
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            Xuất dữ liệu kiểm toán (CSV)
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <Card>
        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="flex-1 w-full">
            <input
              type="text"
              placeholder="Tìm theo người thực hiện, hành động hoặc tài nguyên..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-line rounded-lg bg-canvas focus:outline-none focus:border-accent"
            />
          </div>
          <div className="w-full md:w-64">
            <select
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-line rounded-lg bg-canvas focus:outline-none focus:border-accent"
            >
              <option value="ALL">Tất cả phân loại</option>
              <option value="SECURITY">Bảo mật &amp; Phân quyền (SECURITY)</option>
              <option value="HR_TIMESHEET">Sửa bảng công (HR_TIMESHEET)</option>
              <option value="RULE_ENGINE">Cấu hình Luật (RULE_ENGINE)</option>
              <option value="OKR_CALIBRATION">Cân chuẩn OKR (OKR_CALIBRATION)</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Audit Log Table */}
      <div className="bg-surface rounded-xl border border-line shadow-2xs overflow-hidden">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-canvas border-b border-line text-ink-secondary font-medium">
              <th className="py-3 px-4">Thời gian</th>
              <th className="py-3 px-4">Người thực hiện (Actor)</th>
              <th className="py-3 px-4">Hành động</th>
              <th className="py-3 px-4">Phân loại</th>
              <th className="py-3 px-4">Tài nguyên tác động</th>
              <th className="py-3 px-4">Địa chỉ IP</th>
              <th className="py-3 px-4 text-right">Chi tiết</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filteredLogs.map(log => (
              <tr key={log.id} className="hover:bg-canvas/40 transition-colors">
                <td className="py-3 px-4 font-mono text-ink-secondary">{log.timestamp}</td>
                <td className="py-3 px-4">
                  <div className="font-medium text-ink">{log.actor}</div>
                  <div className="text-[11px] text-ink-muted font-mono">{log.actorEmail}</div>
                </td>
                <td className="py-3 px-4 font-mono font-medium text-ink">{log.action}</td>
                <td className="py-3 px-4">
                  <Badge
                    variant={
                      log.category === 'SECURITY'
                        ? 'danger'
                        : log.category === 'RULE_ENGINE'
                        ? 'accent'
                        : log.category === 'HR_TIMESHEET'
                        ? 'warn'
                        : 'ok'
                    }
                  >
                    {log.category}
                  </Badge>
                </td>
                <td className="py-3 px-4 text-ink-secondary font-mono">{log.targetResource}</td>
                <td className="py-3 px-4 text-ink-muted font-mono">{log.ipAddress}</td>
                <td className="py-3 px-4 text-right">
                  <Button variant="ghost" size="sm" onClick={() => setSelectedLog(log)}>
                    Xem Diff
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Diff / Details Modal */}
      {selectedLog && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedLog(null)}
          title={`Chi tiết vết kiểm toán: ${selectedLog.id}`}
          maxWidth="lg"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 p-3 bg-canvas rounded-lg text-xs">
              <div>
                <span className="text-ink-muted">Người thực hiện:</span>
                <div className="font-medium text-ink mt-0.5">{selectedLog.actor} ({selectedLog.actorEmail})</div>
              </div>
              <div>
                <span className="text-ink-muted">Thời điểm ghi nhận:</span>
                <div className="font-medium text-ink mt-0.5 font-mono">{selectedLog.timestamp}</div>
              </div>
              <div>
                <span className="text-ink-muted">Địa chỉ IP &amp; Client:</span>
                <div className="font-mono text-ink mt-0.5">{selectedLog.ipAddress}</div>
              </div>
              <div>
                <span className="text-ink-muted">Tài nguyên thay đổi:</span>
                <div className="font-mono text-ink mt-0.5">{selectedLog.targetResource}</div>
              </div>
            </div>

            {selectedLog.note && (
              <div className="text-xs">
                <span className="text-ink-muted font-semibold">Ghi chú nghiệp vụ:</span>
                <div className="p-2.5 mt-1 bg-surface border border-line rounded-lg text-ink">
                  {selectedLog.note}
                </div>
              </div>
            )}

            {/* Before vs After Diff */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-ink">So sánh Thay đổi (Before vs After)</div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="border border-rose-200 bg-rose-50/30 rounded-lg p-3">
                  <div className="text-rose-800 font-medium mb-1 flex items-center gap-1">
                    <span>- Giá trị cũ (Old Value)</span>
                  </div>
                  <pre className="p-2 bg-white rounded border border-rose-100 font-mono text-[11px] text-ink overflow-x-auto whitespace-pre-wrap">
                    {selectedLog.oldValue || 'None'}
                  </pre>
                </div>
                <div className="border border-emerald-200 bg-emerald-50/30 rounded-lg p-3">
                  <div className="text-emerald-800 font-medium mb-1 flex items-center gap-1">
                    <span>+ Giá trị mới (New Value)</span>
                  </div>
                  <pre className="p-2 bg-white rounded border border-emerald-100 font-mono text-[11px] text-ink overflow-x-auto whitespace-pre-wrap">
                    {selectedLog.newValue || 'None'}
                  </pre>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-line">
              <Button variant="outline" size="sm" onClick={() => setSelectedLog(null)}>
                Đóng
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
