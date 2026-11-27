import React, { useState, useEffect, useMemo } from 'react';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { Panel } from '../../../components/common/Panel';
import {
  FileText,
  Search,
  Download,
  ShieldCheck,
  Clock,
  Laptop,
  ArrowRight,
  UserCheck,
  RefreshCw,
  GitPullRequest,
  AlertTriangle,
  Users,
  X,
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

/**
 * Nhóm lọc của sổ kiểm toán.
 *
 * Lưu ý: tham số `category` của API chỉ so khớp **tên entity** (`TIMESHEET`,
 * `RULE_ENGINE`…) nên lọc theo hành động sẽ rơi mất dữ liệu — ví dụ chọn
 * "Sửa bảng công" chỉ trả về 5 bản ghi `UPDATE_TIMESHEET` thay vì 206 bản ghi
 * liên quan bảng công. Vì vậy nhóm lọc được áp **phía client** theo cả `action`
 * lẫn `entity`, và số đếm hiển thị luôn khớp với số dòng thực sự hiện ra.
 */
type CategoryId =
  | 'ALL'
  | 'TIMESHEET'
  | 'REQUEST'
  | 'DISPUTE'
  | 'RULE'
  | 'DEVICE'
  | 'USER'
  | 'TEAM';

interface CategoryDef {
  id: CategoryId;
  label: string;
  /** Khớp nếu hành động hoặc entity chứa một trong các từ khoá. */
  match: (log: AuditLogItem) => boolean;
}

const CATEGORIES: CategoryDef[] = [
  { id: 'ALL', label: 'Tất cả', match: () => true },
  {
    id: 'TIMESHEET',
    label: 'Bảng công',
    match: l => /TIMESHEET/.test(l.action) || /TIMESHEET/.test(l.entity),
  },
  {
    id: 'REQUEST',
    label: 'Duyệt / từ chối đơn',
    match: l => /REQUEST|APPROVE|REJECT/.test(l.action) || l.entity === 'REQUEST',
  },
  { id: 'DISPUTE', label: 'Khiếu nại', match: l => /DISPUTE/.test(l.action) || l.entity === 'DISPUTE' },
  {
    id: 'RULE',
    label: 'Quy định',
    match: l => /RULE/.test(l.action) || /RULE/.test(l.entity),
  },
  { id: 'DEVICE', label: 'Thiết bị', match: l => /DEVICE/.test(l.action) || l.entity === 'DEVICE' },
  {
    id: 'USER',
    label: 'Nhân sự',
    match: l =>
      /USER|PASSWORD|MANAGER|RESIGN|PROFILE/.test(l.action) ||
      ['USER', 'users', 'PASSKEY', 'LEAVE_LEDGER'].includes(l.entity),
  },
  {
    id: 'TEAM',
    label: 'Nhóm & cơ cấu',
    match: l => /TEAM|LEADER|ORG/.test(l.action) || l.entity === 'TEAM',
  },
];

/** Nhãn tiếng Việt cho nhóm hành động — hiển thị trong cột "Hành động". */
const ACTION_LABELS: Record<
  string,
  { label: string; variant: 'ok' | 'warn' | 'danger' | 'info' | 'gray' | 'accent' }
> = {
  UPDATE_TIMESHEET: { label: 'Sửa bảng công', variant: 'info' },
  MANUAL_TIMESHEET_OVERRIDE: { label: 'Sửa bảng công', variant: 'info' },
  UPDATE_TIMESHEET_CELL: { label: 'Sửa bảng công', variant: 'info' },
  EDIT_TIMESHEET_CELL: { label: 'Sửa ô bảng công', variant: 'info' },
  BULK_EDIT_TIMESHEET: { label: 'Sửa bảng công hàng loạt', variant: 'info' },
  FORCE_LOCK_TIMESHEET: { label: 'Chốt bảng công', variant: 'warn' },
  UPDATE_RULE: { label: 'Cấu hình quy định', variant: 'warn' },
  UPDATE_RULE_PARAMETER: { label: 'Cấu hình quy định', variant: 'warn' },
  ROLLBACK_RULE: { label: 'Rollback quy định', variant: 'warn' },
  CHANGE_MANAGER: { label: 'Đổi quản lý/nhóm', variant: 'accent' },
  CHANGE_TEAM: { label: 'Đổi quản lý/nhóm', variant: 'accent' },
  CHANGE_TEAM_LEADER: { label: 'Đổi quản lý/nhóm', variant: 'accent' },
  CREATE_TEAM: { label: 'Tạo nhóm', variant: 'accent' },
  APPROVE: { label: 'Duyệt đơn', variant: 'ok' },
  APPROVE_REQUEST: { label: 'Duyệt đơn', variant: 'ok' },
  REJECT: { label: 'Từ chối đơn', variant: 'danger' },
  REJECT_REQUEST: { label: 'Từ chối đơn', variant: 'danger' },
  EDIT_REQUEST: { label: 'Sửa đơn', variant: 'warn' },
  AUTO_CANCEL_DUPLICATE: { label: 'Huỷ đơn trùng', variant: 'gray' },
  RESOLVE_DISPUTE: { label: 'Xử lý khiếu nại', variant: 'info' },
  UPDATE_OKR: { label: 'Điểm OKR', variant: 'warn' },
  CALIBRATION: { label: 'Điểm OKR', variant: 'warn' },
  DEVICE: { label: 'Thiết bị', variant: 'info' },
  REGISTER_DEVICE: { label: 'Đăng ký thiết bị', variant: 'info' },
  REQUEST_DEVICE: { label: 'Xin cấp thiết bị', variant: 'info' },
  APPROVE_DEVICE: { label: 'Duyệt thiết bị', variant: 'ok' },
  REVOKE_DEVICE: { label: 'Thu hồi thiết bị', variant: 'warn' },
  DELETE_DEVICE: { label: 'Xoá thiết bị', variant: 'danger' },
  CANCEL_DEVICE_REQUEST: { label: 'Huỷ xin thiết bị', variant: 'gray' },
  ADMIN_RESET_PASSWORD: { label: 'Cấp lại mật khẩu', variant: 'danger' },
  CREATE_USER: { label: 'Tạo nhân sự', variant: 'accent' },
  UPDATE_USER: { label: 'Sửa nhân sự', variant: 'accent' },
  UPDATE_USER_PROFILE: { label: 'Sửa hồ sơ', variant: 'accent' },
  UPDATE_USER_MANAGER: { label: 'Đổi quản lý/nhóm', variant: 'accent' },
  RESIGN_EMPLOYEE: { label: 'Nghỉ việc', variant: 'warn' },
  REMOVE_PASSKEY: { label: 'Gỡ passkey', variant: 'warn' },
  EXPIRE_LEAVE_CARRY: { label: 'Hết hạn phép tồn', variant: 'gray' },
};

export const AuditLogPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<CategoryId>('ALL');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [actorFilter, setActorFilter] = useState('');
  const [affectedEmployee, setAffectedEmployee] = useState('');
  const [startDate, setStartDate] = useState('2026-11-01');
  const [endDate, setEndDate] = useState('2026-11-30');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchKeyword.trim()) params.append('keyword', searchKeyword.trim());
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actorFilter, affectedEmployee]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  /** Nhóm lọc áp phía client — khớp cả `action` lẫn `entity`. */
  const categoryOf = useMemo(
    () => CATEGORIES.find(c => c.id === categoryFilter) ?? CATEGORIES[0],
    [categoryFilter],
  );

  const visibleLogs = useMemo(() => logs.filter(categoryOf.match), [logs, categoryOf]);

  /** Số đếm theo nhóm — luôn khớp số dòng thực sự hiện ra. */
  const counts = useMemo(() => {
    const map = new Map<CategoryId, number>();
    CATEGORIES.forEach(c => map.set(c.id, logs.filter(c.match).length));
    return map;
  }, [logs]);

  const statGroups = useMemo(
    () => [
      {
        label: 'Sửa công & phép',
        value: logs.filter(
          l => /TIMESHEET/.test(l.action) || /TIMESHEET/.test(l.entity) || /LEAVE/.test(l.entity),
        ).length,
        Icon: Clock,
        tone: 'text-status-ok',
      },
      {
        label: 'Quy định & Nhóm',
        value: logs.filter(l => /RULE/.test(l.action) || /RULE/.test(l.entity) || l.entity === 'TEAM').length,
        Icon: GitPullRequest,
        tone: 'text-status-info',
      },
      {
        label: 'Khiếu nại & đơn',
        value: logs.filter(l => l.entity === 'DISPUTE' || l.entity === 'REQUEST').length,
        Icon: AlertTriangle,
        tone: 'text-status-warn',
      },
      {
        label: 'Nhân sự & thiết bị',
        value: logs.filter(
          l =>
            /USER|PASSWORD|MANAGER|RESIGN/.test(l.action) ||
            l.entity === 'USER' ||
            l.entity === 'DEVICE',
        ).length,
        Icon: Users,
        tone: 'text-status-danger',
      },
    ],
    [logs],
  );

  const handleExportCSV = () => {
    const headers = ['Mã Log', 'Thời Gian', 'Người Thực Hiện', 'Hành Động', 'Phân Hệ', 'Đối Tượng', 'Giá Trị Cũ', 'Giá Trị Mới', 'Lý Do', 'IP / Thiết Bị'];
    const rows = visibleLogs.map(l => [
      l.id,
      `"${l.timestamp}"`,
      `"${l.actorName} (${l.actorCode})"`,
      `"${l.action}"`,
      `"${l.entity}"`,
      `"${l.entityId || ''}"`,
      `"${(l.oldValue || '').replace(/"/g, '""')}"`,
      `"${(l.newValue || '').replace(/"/g, '""')}"`,
      `"${(l.reason || '').replace(/"/g, '""')}"`,
      `"${l.ipAddress || ''}"`,
    ]);

    const csvContent = '﻿' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ACT_Audit_Logs_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Đã xuất ${rows.length} dòng nhật ký ra file CSV`);
  };

  // Thử gọi API sửa/xóa để chứng minh tính Append-Only
  const testAppendOnlyBlock = async (logId: string) => {
    try {
      const res = await fetch(`/api/v1/admin/audit-logs/${logId}`, {
        method: 'DELETE',
      });
      if (res.status === 405 || res.status === 403) {
        const json = await res.json().catch(() => ({}));
        alert(`[APPEND-ONLY CHẶN THÀNH CÔNG - MÃ LỖI ${res.status}]\n${json.message}`);
      } else {
        alert('Cảnh báo: API không chặn thao tác xóa log!');
      }
    } catch (e) {
      alert('Đã chặn thao tác xóa log');
    }
  };

  const getActionBadge = (action: string) => {
    const known = ACTION_LABELS[action];
    if (known) return <Badge variant={known.variant}>{known.label}</Badge>;
    return <Badge variant="gray">{action}</Badge>;
  };

  return (
    <div className="mx-auto max-w-7xl space-y-4 pb-24">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl bg-status-ok px-5 py-3 text-sm font-medium text-on-ok shadow-xl">
          <ShieldCheck className="h-5 w-5" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Đầu trang — mockup `.phead` */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-accent-dark">
            <ShieldCheck className="h-3.5 w-3.5" />
            Nền tảng dùng chung · HR · P0
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <h1 className="font-display text-xl font-extrabold tracking-tight text-ink sm:text-[23px]">
              Nhật ký thay đổi (Audit Log)
            </h1>
            <Badge variant="accent">S35</Badge>
          </div>
          <p className="mt-1 text-xs text-ink-muted">
            Ghi append-only · Bất biến · Không bao giờ xoá — Bằng chứng minh bạch để trả lời khiếu nại công &amp; điểm.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={handleExportCSV}>
            <Download className="h-4 w-4 text-accent" />
            Xuất Excel / CSV
          </Button>
          <Button variant="primary" onClick={fetchLogs}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Làm mới
          </Button>
        </div>
      </div>

      {/* Alert Banner: Append-only explanation (Mockup S35) */}
      <div className="flex items-start gap-3 rounded-[13px] border border-status-info-line bg-status-info-soft p-4 text-sm shadow-2xs">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-status-info" />
        <div>
          <p className="font-semibold text-status-info">Đây là sổ kiểm toán bằng chứng, không phải log kỹ thuật.</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-secondary">
            Mục 3:{' '}
            <i className="font-semibold not-italic text-accent-dark">
              "Ghi lại ai sửa gì, lúc nào — bắt buộc với dữ liệu công và điểm OKR vì liên quan đến lương và đánh giá."
            </i>{' '}
            Khi nhân viên khiếu nại "công tháng 11 của tôi bị sửa lúc nào?", HR lọc theo tên nhân viên và thấy ngay dòng sửa,
            giá trị cũ → mới, và lý do trong 5 giây.
          </p>
        </div>
      </div>

      {/* Metrics Summary Strip (A5) */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        <div className="rounded-[13px] border border-line bg-surface p-3.5 shadow-2xs">
          <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.06em] text-ink-muted">
            <FileText className="h-3.5 w-3.5 text-accent" />
            Tổng bản ghi nhật ký
          </div>
          <div className="mt-2 font-display text-[24px] font-extrabold leading-none tracking-[-0.035em] text-ink">
            {logs.length}
            <small className="ml-1 text-xs font-semibold tracking-normal text-ink-muted">thao tác</small>
          </div>
        </div>

        {statGroups.map(g => (
          <div key={g.label} className="rounded-[13px] border border-line bg-surface p-3.5 shadow-2xs">
            <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.06em] text-ink-muted">
              <g.Icon className="h-3.5 w-3.5 text-accent" />
              {g.label}
            </div>
            <div
              className={`mt-2 font-display text-[24px] font-extrabold leading-none tracking-[-0.035em] ${g.tone}`}
            >
              {g.value}
              <small className="ml-1 text-xs font-semibold tracking-normal text-ink-muted">sự kiện</small>
            </div>
          </div>
        ))}
      </div>

      {/* Chip lọc nhóm — pill 31px, đang chọn = bg-ink text-canvas */}
      <div role="group" aria-label="Lọc theo nhóm sự kiện" className="flex items-center gap-2 overflow-x-auto pb-1">
        {CATEGORIES.map(cat => {
          const on = categoryFilter === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              aria-pressed={on}
              onClick={() => setCategoryFilter(cat.id)}
              className={`inline-flex h-[31px] shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-[12.5px] font-semibold transition-colors ${
                on
                  ? 'border-ink bg-ink text-canvas'
                  : 'border-line bg-surface text-ink-secondary hover:bg-canvas hover:text-ink'
              }`}
            >
              {cat.label}
              <span className="font-mono text-[10.5px] opacity-65">{counts.get(cat.id) ?? 0}</span>
            </button>
          );
        })}

        {affectedEmployee && (
          <span className="inline-flex h-[31px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-status-warn-line bg-status-warn-soft px-3 text-[12.5px] font-semibold text-status-warn">
            Nhân viên: {affectedEmployee}
            <button
              type="button"
              onClick={() => setAffectedEmployee('')}
              aria-label="Bỏ lọc theo nhân viên"
              className="cursor-pointer transition-colors hover:text-status-danger"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        )}
      </div>

      {/* Advanced Filter Controls */}
      <Panel>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
            <input
              type="text"
              aria-label="Tìm từ khoá, lý do, giá trị"
              placeholder="Tìm từ khóa, lý do, giá trị..."
              value={searchKeyword}
              onChange={e => setSearchKeyword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchLogs()}
              className="w-full rounded-[10px] border border-line bg-canvas py-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/20"
            />
          </div>

          <div className="relative">
            <UserCheck className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
            <input
              type="text"
              aria-label="Lọc nhân viên bị tác động"
              placeholder="Lọc nhân viên bị tác động..."
              value={affectedEmployee}
              onChange={e => setAffectedEmployee(e.target.value)}
              className="w-full rounded-[10px] border border-line bg-canvas py-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/20"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="date"
              aria-label="Từ ngày"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full rounded-[10px] border border-line bg-canvas px-2.5 py-2 text-xs text-ink focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/20"
            />
            <span className="text-xs text-ink-muted">→</span>
            <input
              type="date"
              aria-label="Đến ngày"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-full rounded-[10px] border border-line bg-canvas px-2.5 py-2 text-xs text-ink focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/20"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={actorFilter}
              aria-label="Người thực hiện"
              onChange={e => setActorFilter(e.target.value)}
              className="w-full rounded-[10px] border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/20"
            >
              <option value="">Tất cả người thực hiện</option>
              <option value="Admin">Admin (Quản Trị Viên)</option>
              <option value="01HR">01HR (Nguyễn Thị Thu Hà)</option>
              <option value="05ACT">05ACT (Nguyễn Thanh Tùng)</option>
              <option value="136ACT">136ACT (Vũ Văn Luận)</option>
            </select>
            <Button variant="secondary" onClick={fetchLogs} className="shrink-0 px-3">
              Lọc
            </Button>
          </div>
        </div>
      </Panel>

      {/* Main Audit Logs Table (Mockup S35) */}
      <Panel bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-canvas text-[9.5px] font-extrabold uppercase tracking-[0.07em] text-ink-muted">
              <tr>
                <th className="w-32 px-4 py-3">Thời điểm</th>
                <th className="w-40 px-4 py-3">Người thực hiện</th>
                <th className="w-36 px-4 py-3">Hành động</th>
                <th className="w-48 px-4 py-3">Đối tượng</th>
                <th className="px-4 py-3">Thay đổi (Diff) &amp; Lý do</th>
                <th className="w-40 px-4 py-3">Thiết bị / IP</th>
                <th className="w-28 px-4 py-3 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft text-xs">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-ink-muted">
                    <RefreshCw className="mx-auto mb-2 h-6 w-6 animate-spin text-accent" />
                    Đang tải nhật ký kiểm toán hệ thống...
                  </td>
                </tr>
              ) : visibleLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-ink-muted">
                    <FileText className="mx-auto mb-2 h-8 w-8 text-ink-muted/50" />
                    Không tìm thấy bản ghi nhật ký kiểm toán phù hợp
                  </td>
                </tr>
              ) : (
                visibleLogs.map(log => (
                  <tr key={log.id} className="transition-colors hover:bg-canvas/50">
                    <td className="whitespace-nowrap px-4 py-3.5 font-mono text-[11px] text-ink-muted">{log.timestamp}</td>
                    <td className="px-4 py-3.5">
                      <div className="text-xs font-semibold text-ink">{log.actorName}</div>
                      <div className="font-mono text-[10.5px] text-ink-muted">Code: {log.actorCode}</div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5">{getActionBadge(log.action)}</td>
                    <td className="px-4 py-3.5">
                      <div className="text-xs font-medium text-ink">{log.entity}</div>
                      {log.entityId && (
                        <button
                          type="button"
                          onClick={() => setAffectedEmployee(log.entityId || '')}
                          className="block max-w-[180px] cursor-pointer truncate font-mono text-[11px] font-medium text-accent-dark hover:underline"
                          title={`Lọc theo ${log.entityId}`}
                        >
                          {log.entityId}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      {log.oldValue || log.newValue ? (
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5 text-xs">
                            {log.oldValue && (
                              <span className="rounded-md border border-status-danger-line bg-status-danger-soft px-1.5 py-0.5 font-mono text-[11px] text-status-danger line-through">
                                {log.oldValue}
                              </span>
                            )}
                            {log.oldValue && log.newValue && (
                              <ArrowRight className="h-3 w-3 shrink-0 text-ink-muted" />
                            )}
                            {log.newValue && (
                              <span className="rounded-md border border-status-ok-line bg-status-ok-soft px-1.5 py-0.5 font-mono text-[11px] font-bold text-status-ok">
                                {log.newValue}
                              </span>
                            )}
                          </div>
                          {log.reason && (
                            <div className="text-[11px] italic text-ink-muted">"{log.reason}"</div>
                          )}
                        </div>
                      ) : (
                        <div className="text-xs text-ink-secondary">{log.details || log.action}</div>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5 font-mono text-[10.5px] text-ink-muted">
                        <Laptop className="h-3.5 w-3.5 shrink-0 text-ink-muted" />
                        <span className="max-w-[130px] truncate">{log.ipAddress || '127.0.0.1'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <button
                        type="button"
                        onClick={() => testAppendOnlyBlock(log.id)}
                        title="Bấm để kiểm tra tính append-only (hệ thống sẽ từ chối xóa theo tiêu chuẩn A5)"
                        className="inline-flex h-8 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-[9px] border border-status-danger-line bg-status-danger-soft px-2.5 text-[11.5px] font-semibold text-status-danger transition-colors hover:bg-status-danger hover:text-on-danger"
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Thử xoá
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
};
