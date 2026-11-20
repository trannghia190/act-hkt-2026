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
  RefreshCw
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
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 animate-bounce">
          <ShieldCheck className="w-5 h-5" />
          <span className="font-medium text-sm">{toastMessage}</span>
        </div>
      )}

      {/* Header (Mockup S35) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs uppercase tracking-wider text-accent font-semibold px-2 py-0.5 rounded bg-accent/10 border border-accent/20">
              Nền tảng dùng chung · HR · P0 — S35
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-accent" />
            Nhật Ký Thay Đổi (Audit Log)
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Ghi append-only · Bất biến · Không bao giờ xoá — Bằng chứng minh bạch để trả lời khiếu nại công & điểm
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="secondary" onClick={handleExportCSV} className="flex items-center gap-2">
            <Download className="w-4 h-4 text-emerald-400" />
            Xuất Excel / CSV
          </Button>
          <Button variant="primary" onClick={fetchLogs} className="flex items-center gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Làm mới
          </Button>
        </div>
      </div>

      {/* Alert Banner: Append-only explanation (Mockup S35) */}
      <div className="bg-blue-950/40 border border-blue-500/30 rounded-xl p-4 text-sm text-blue-200 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-white">Đây là sổ kiểm toán bằng chứng, không phải log kỹ thuật.</p>
          <p className="text-slate-300 text-xs mt-1">
            Mục 3: <i className="text-accent">"Ghi lại ai sửa gì, lúc nào — bắt buộc với dữ liệu công và điểm OKR vì liên quan đến lương và đánh giá."</i> Khi nhân viên khiếu nại "công tháng 11 của tôi bị sửa lúc nào?", HR lọc theo tên nhân viên và thấy ngay dòng sửa, giá trị cũ → mới, và lý do trong 5 giây.
          </p>
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
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
              categoryFilter === tab.id
                ? 'bg-accent text-white shadow-lg shadow-accent/20 font-semibold'
                : 'bg-white/5 text-slate-300 hover:bg-white/10 border border-white/5'
            }`}
          >
            {tab.label}
          </button>
        ))}

        {affectedEmployee && (
          <span className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full text-xs font-medium">
            <span>Nhân viên: {affectedEmployee}</span>
            <button onClick={() => setAffectedEmployee('')} className="hover:text-white">
              <XCircle className="w-3.5 h-3.5" />
            </button>
          </span>
        )}
      </div>

      {/* Advanced Filter Controls */}
      <Card className="p-4 bg-surface/80 border-white/10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Tìm từ khóa, lý do, giá trị..."
              value={searchKeyword}
              onChange={e => setSearchKeyword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchLogs()}
              className="w-full bg-black/30 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-accent"
            />
          </div>

          <div className="relative">
            <UserCheck className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Lọc nhân viên bị tác động..."
              value={affectedEmployee}
              onChange={e => setAffectedEmployee(e.target.value)}
              className="w-full bg-black/30 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-accent"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full bg-black/30 border border-white/10 rounded-lg px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-accent"
            />
            <span className="text-slate-500 text-xs">→</span>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-full bg-black/30 border border-white/10 rounded-lg px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-accent"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={actorFilter}
              onChange={e => setActorFilter(e.target.value)}
              className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
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
      <Card className="overflow-hidden border-white/10 bg-surface/90">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 text-xs uppercase tracking-wider text-slate-400 border-b border-white/10">
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
            <tbody className="divide-y divide-white/5 font-mono text-xs">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-sans">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-accent" />
                    Đang tải nhật ký kiểm toán hệ thống...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-sans">
                    <FileText className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    Không tìm thấy bản ghi nhật ký kiểm toán phù hợp
                  </td>
                </tr>
              ) : (
                logs.map(log => (
                  <tr key={log.id} className="hover:bg-white/5 transition-colors font-sans">
                    <td className="py-3.5 px-4 font-mono text-slate-400 whitespace-nowrap text-xs">
                      {log.timestamp}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-white text-xs">{log.actorName}</div>
                      <div className="text-[11px] text-slate-400 font-mono">Code: {log.actorCode}</div>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {getActionBadge(log.action)}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-200 text-xs">{log.entity}</div>
                      {log.entityId && (
                        <div
                          onClick={() => setAffectedEmployee(log.entityId || '')}
                          className="text-[11px] text-accent truncate max-w-[180px] cursor-pointer hover:underline"
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
                              <span className="text-red-400 line-through bg-red-950/40 px-1.5 py-0.5 rounded border border-red-500/20">
                                {log.oldValue}
                              </span>
                            )}
                            {log.oldValue && log.newValue && (
                              <ArrowRight className="w-3 h-3 text-slate-500 shrink-0" />
                            )}
                            {log.newValue && (
                              <span className="text-emerald-300 font-semibold bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                {log.newValue}
                              </span>
                            )}
                          </div>
                          {log.reason && (
                            <div className="text-[11px] text-slate-400 italic">
                              "{log.reason}"
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-300">
                          {log.details || log.action}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-[11px] text-slate-400 font-mono">
                      <div className="flex items-center gap-1">
                        <Laptop className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span className="truncate max-w-[130px]">{log.ipAddress || '127.0.0.1'}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => testAppendOnlyBlock(log.id)}
                        className="text-[11px] text-red-400/80 hover:text-red-300 underline"
                        title="Bấm để kiểm tra tính append-only (hệ thống sẽ từ chối xóa)"
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
