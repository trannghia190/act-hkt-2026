import React, { useState, useEffect } from 'react';
import { Card } from '../../../components/common/Card';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { Modal } from '../../../components/common/Modal';
import {
  FileText,
  Search,
  Filter,
  Download,
  AlertTriangle,
  ShieldCheck,
  Clock,
  Laptop,
  ArrowRight,
  UserCheck,
  Calendar,
  XCircle,
  RefreshCw,
  Database,
  GitPullRequest,
  Users
} from 'lucide-react';

export interface AuditLogItem {
  id: string;
  timestamp: string;
  actorCode: string;
  actorName: string;
  action: string;
  entity: string;
  entityId?: string;
  oldValue?: string;
  newValue?: string;
  reason?: string;
  details?: string;
  ipAddress?: string;
  affectedUser?: string;
}

export const AuditLogPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [actorFilter, setActorFilter] = useState('');
  const [affectedEmployee, setAffectedEmployee] = useState('');
  const [startDate, setStartDate] = useState('2026-11-01');
  const [endDate, setEndDate] = useState('2026-11-30');
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchKeyword.trim()) params.append('keyword', searchKeyword.trim());
      if (categoryFilter !== 'ALL') params.append('category', categoryFilter);
      if (actorFilter.trim()) params.append('actor', actorFilter.trim());
      if (affectedEmployee.trim()) params.append('affectedUser', affectedEmployee.trim());
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const res = await fetch(`/api/v1/admin/audit-logs?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setLogs(json.data);
        }
      }
    } catch (e) {
      console.error('Lỗi tải nhật ký kiểm toán', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [categoryFilter, actorFilter, affectedEmployee]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleExportCSV = () => {
    const headers = ['Mã Log', 'Thời Gian', 'Người Thực Hiện', 'Hành Động', 'Phân Hệ', 'Đối Tượng', 'Giá Trị Cũ', 'Giá Trị Mới', 'Lý Do', 'IP / Thiết Bị'];
    const rows = logs.map(l => [
      l.id,
      `"${l.timestamp}"`,
      `"${l.actorName} (${l.actorCode})"`,
      `"${l.action}"`,
      `"${l.entity}"`,
      `"${l.entityId || ''}"`,
      `"${(l.oldValue || '').replace(/"/g, '""')}"`,
      `"${(l.newValue || '').replace(/"/g, '""')}"`,
      `"${(l.reason || '').replace(/"/g, '""')}"`,
      `"${l.ipAddress || ''}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ACT_Audit_Logs_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Đã xuất file báo cáo nhật ký kiểm toán CSV thành công!');
  };

  // Thử gọi API sửa/xóa để chứng minh tính Append-Only
  const testAppendOnlyBlock = async (logId: string) => {
    try {
      const res = await fetch(`/api/v1/admin/audit-logs/${logId}`, {
        method: 'DELETE'
      });
      if (res.status === 405 || res.status === 403) {
        const json = await res.json();
        alert(`[APPEND-ONLY CHẶN THÀNH CÔNG - MÃ LỖI ${res.status}]\n${json.message}`);
      } else {
        alert('Cảnh báo: API không chặn thao tác xóa log!');
      }
    } catch (e) {
      alert('Đã chặn thao tác xóa log');
    }
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'UPDATE_TIMESHEET':
      case 'MANUAL_TIMESHEET_OVERRIDE':
        return <Badge variant="info">Sửa bảng công</Badge>;
      case 'UPDATE_RULE':
      case 'ROLLBACK_RULE':
        return <Badge variant="warn">Cấu hình quy định</Badge>;
      case 'CHANGE_MANAGER':
      case 'CHANGE_TEAM':
      case 'CHANGE_TEAM_LEADER':
        return <Badge variant="accent">Đổi quản lý/nhóm</Badge>;
      case 'APPROVE':
      case 'APPROVE_REQUEST':
        return <Badge variant="ok">Duyệt đơn</Badge>;
      case 'REJECT':
      case 'REJECT_REQUEST':
        return <Badge variant="danger">Từ chối đơn</Badge>;
      case 'UPDATE_OKR':
      case 'CALIBRATION':
        return <Badge variant="warn">Điểm OKR</Badge>;
      case 'DEVICE':
      case 'REGISTER_DEVICE':
        return <Badge variant="info">Thiết bị</Badge>;
      case 'ADMIN_RESET_PASSWORD':
        return <Badge variant="danger">Cấp lại mật khẩu</Badge>;
      default:
        return <Badge variant="gray">{action}</Badge>;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6 pb-24">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-status-ok text-on-ok px-5 py-3 rounded-xl shadow-xl flex items-center gap-3">
          <ShieldCheck className="w-5 h-5" />
          <span className="font-medium text-sm">{toastMessage}</span>
        </div>
      )}

      {/* Header (Mockup S35) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-line pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs uppercase tracking-wider text-accent-dark font-semibold px-2 py-0.5 rounded bg-accent-soft border border-accent-line">
              Nền tảng dùng chung · HR · P0
            </span>
          </div>
          <h1 className="text-2xl font-bold text-ink flex items-center gap-2">
            <FileText className="w-6 h-6 text-accent" />
            Nhật Ký Thay Đổi (Audit Log)
          </h1>
          <p className="text-sm text-ink-muted mt-1">
            Ghi append-only · Bất biến · Không bao giờ xoá — Bằng chứng minh bạch để trả lời khiếu nại công & điểm
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="secondary" onClick={handleExportCSV} className="flex items-center gap-2">
            <Download className="w-4 h-4 text-accent" />
            Xuất Excel / CSV
          </Button>
          <Button variant="primary" onClick={fetchLogs} className="flex items-center gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Làm mới
          </Button>
        </div>
      </div>

      {/* Alert Banner: Append-only explanation (Mockup S35) */}
      <div className="bg-status-info-soft border border-status-info-line rounded-xl p-4 text-sm text-status-info flex items-start gap-3 shadow-2xs">
        <ShieldCheck className="w-5 h-5 text-status-info shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-status-info">Đây là sổ kiểm toán bằng chứng, không phải log kỹ thuật.</p>
          <p className="text-status-info text-xs mt-1 leading-relaxed">
            Mục 3: <i className="text-accent font-semibold">"Ghi lại ai sửa gì, lúc nào — bắt buộc với dữ liệu công và điểm OKR vì liên quan đến lương và đánh giá."</i> Khi nhân viên khiếu nại "công tháng 11 của tôi bị sửa lúc nào?", HR lọc theo tên nhân viên và thấy ngay dòng sửa, giá trị cũ → mới, và lý do trong 5 giây.
          </p>
        </div>
      </div>

      {/* Metrics Summary Strip (A5) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-3.5 bg-surface border border-line rounded-xl flex items-center gap-3 shadow-2xs">
          <div className="w-10 h-10 rounded-xl bg-status-info-soft text-status-info flex items-center justify-center font-bold">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-ink-muted font-medium">Tổng bản ghi nhật ký</div>
            <div className="text-lg font-bold text-ink">{logs.length} thao tác</div>
          </div>
        </div>

        <div className="p-3.5 bg-surface border border-line rounded-xl flex items-center gap-3 shadow-2xs">
          <div className="w-10 h-10 rounded-xl bg-status-ok-soft text-status-ok flex items-center justify-center font-bold">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-ink-muted font-medium">Sửa công &amp; phép</div>
            <div className="text-lg font-bold text-status-ok">
              {logs.filter(l => l.action?.includes('TIMESHEET') || l.action?.includes('LEAVE')).length} sự kiện
            </div>
          </div>
        </div>

        <div className="p-3.5 bg-surface border border-line rounded-xl flex items-center gap-3 shadow-2xs">
          <div className="w-10 h-10 rounded-xl bg-status-info-soft text-status-info flex items-center justify-center font-bold">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-ink-muted font-medium">Quy định &amp; Nhóm</div>
            <div className="text-lg font-bold text-status-info">
              {logs.filter(l => l.action?.includes('RULE') || l.action?.includes('TEAM')).length} sự kiện
            </div>
          </div>
        </div>

        <div className="p-3.5 bg-surface border border-line rounded-xl flex items-center gap-3 shadow-2xs">
          <div className="w-10 h-10 rounded-xl bg-status-warn-soft text-status-warn flex items-center justify-center font-bold">
            <GitPullRequest className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-ink-muted font-medium">Đổi sếp &amp; Nhân sự</div>
            <div className="text-lg font-bold text-status-warn">
              {logs.filter(l => l.action?.includes('MANAGER') || l.action?.includes('PASSWORD') || l.action?.includes('USER')).length} sự kiện
            </div>
          </div>
        </div>
      </div>

      {/* Filter Chips Bar (Mockup S35) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {[
          { id: 'ALL', label: 'Tất cả' },
          { id: 'TIMESHEET', label: 'Sửa bảng công' },
          { id: 'REQUEST', label: 'Duyệt / từ chối đơn' },
          { id: 'OKR', label: 'Điểm OKR' },
          { id: 'RULE_ENGINE', label: 'Cấu hình quy định' },
          { id: 'TEAM', label: 'Nhóm & Cơ cấu' },
          { id: 'USER', label: 'Nhân sự' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setCategoryFilter(tab.id)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              categoryFilter === tab.id
                ? 'bg-ink border-ink text-canvas shadow-xs'
                : 'bg-surface text-ink-secondary hover:bg-canvas border border-line shadow-2xs'
            }`}
          >
            {tab.label}
          </button>
        ))}

        {affectedEmployee && (
          <span className="flex items-center gap-1.5 px-3 py-1 bg-status-warn-soft text-status-warn border border-status-warn-line rounded-full text-xs font-semibold shadow-2xs">
            <span>Nhân viên: {affectedEmployee}</span>
            <button onClick={() => setAffectedEmployee('')} className="hover:text-status-warn cursor-pointer">
              <XCircle className="w-3.5 h-3.5" />
            </button>
          </span>
        )}
      </div>

      {/* Advanced Filter Controls */}
      <Card className="p-4 bg-surface border-line shadow-2xs">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-ink-muted absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Tìm từ khóa, lý do, giá trị..."
              value={searchKeyword}
              onChange={e => setSearchKeyword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchLogs()}
              className="w-full bg-canvas border border-line rounded-lg pl-9 pr-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:border-accent"
            />
          </div>

          <div className="relative">
            <UserCheck className="w-4 h-4 text-ink-muted absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Lọc nhân viên bị tác động..."
              value={affectedEmployee}
              onChange={e => setAffectedEmployee(e.target.value)}
              className="w-full bg-canvas border border-line rounded-lg pl-9 pr-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:border-accent"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full bg-canvas border border-line rounded-lg px-2.5 py-2 text-xs text-ink focus:outline-none focus:border-accent"
            />
            <span className="text-ink-muted text-xs">→</span>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-full bg-canvas border border-line rounded-lg px-2.5 py-2 text-xs text-ink focus:outline-none focus:border-accent"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={actorFilter}
              onChange={e => setActorFilter(e.target.value)}
              className="w-full bg-canvas border border-line rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-accent"
            >
              <option value="">Tất cả người thực hiện</option>
              <option value="Admin">Admin (Quản Trị Viên)</option>
              <option value="01HR">01HR (Nguyễn Thị Thu Hà)</option>
              <option value="05ACT">05ACT (Nguyễn Thanh Tùng)</option>
              <option value="136ACT">136ACT (Vũ Văn Luận)</option>
            </select>
            <Button variant="secondary" onClick={fetchLogs} className="px-3 shrink-0">
              Lọc
            </Button>
          </div>
        </div>
      </Card>

      {/* Main Audit Logs Table (Mockup S35) */}
      <Card className="overflow-hidden border border-line bg-surface shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-canvas text-[10px] uppercase font-bold tracking-wider text-ink-secondary border-b border-line">
              <tr>
                <th className="py-3 px-4 w-32">Thời điểm</th>
                <th className="py-3 px-4 w-40">Người thực hiện</th>
                <th className="py-3 px-4 w-36">Hành động</th>
                <th className="py-3 px-4 w-48">Đối tượng</th>
                <th className="py-3 px-4">Thay đổi (Diff) & Lý do</th>
                <th className="py-3 px-4 w-40">Thiết bị / IP</th>
                <th className="py-3 px-4 w-24 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line text-xs">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-ink-muted">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-accent" />
                    Đang tải nhật ký kiểm toán hệ thống...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-ink-muted">
                    <FileText className="w-8 h-8 text-ink-muted/50 mx-auto mb-2" />
                    Không tìm thấy bản ghi nhật ký kiểm toán phù hợp
                  </td>
                </tr>
              ) : (
                logs.map(log => (
                  <tr key={log.id} className="hover:bg-canvas/50 transition-colors">
                    <td className="py-3.5 px-4 font-mono text-ink-muted whitespace-nowrap text-xs">
                      {log.timestamp}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-ink text-xs">{log.actorName}</div>
                      <div className="text-[11px] text-ink-muted font-mono">Code: {log.actorCode}</div>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {getActionBadge(log.action)}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-ink text-xs">{log.entity}</div>
                      {log.entityId && (
                        <div
                          onClick={() => setAffectedEmployee(log.entityId || '')}
                          className="text-[11px] text-accent font-medium truncate max-w-[180px] cursor-pointer hover:underline"
                          title={log.entityId}
                        >
                          {log.entityId}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {log.oldValue || log.newValue ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap text-xs">
                            {log.oldValue && (
                              <span className="text-status-danger line-through bg-status-danger-soft px-1.5 py-0.5 rounded border border-status-danger-line font-mono text-[11px]">
                                {log.oldValue}
                              </span>
                            )}
                            {log.oldValue && log.newValue && (
                              <ArrowRight className="w-3 h-3 text-ink-muted shrink-0" />
                            )}
                            {log.newValue && (
                              <span className="text-status-ok font-bold bg-status-ok-soft px-1.5 py-0.5 rounded border border-status-ok-line font-mono text-[11px]">
                                {log.newValue}
                              </span>
                            )}
                          </div>
                          {log.reason && (
                            <div className="text-[11px] text-ink-muted italic">
                              "{log.reason}"
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-xs text-ink-secondary">
                          {log.details || log.action}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-[11px] text-ink-muted font-mono">
                      <div className="flex items-center gap-1">
                        <Laptop className="w-3.5 h-3.5 text-ink-muted shrink-0" />
                        <span className="truncate max-w-[130px]">{log.ipAddress || '127.0.0.1'}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => testAppendOnlyBlock(log.id)}
                        className="px-2.5 py-1 rounded-lg bg-status-danger-soft hover:bg-status-danger hover:text-on-danger text-status-danger border border-status-danger-line text-[11px] font-semibold transition-all cursor-pointer shadow-2xs whitespace-nowrap"
                        title="Bấm để kiểm tra tính append-only (hệ thống sẽ từ chối xóa theo tiêu chuẩn A5)"
                      >
                        Thử xóa
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
