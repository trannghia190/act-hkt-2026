import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../../components/common/Card';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { Modal } from '../../../components/common/Modal';
import { useAuth } from '../../../context/AuthContext';
import {
  Inbox,
  Clock,
  CheckCircle2,
  Calendar,
  Target,
  ArrowRight,
  Sun,
  CheckCheck,
  AlertTriangle,
  Info,
  CalendarDays,
  Search,
  MoreHorizontal
} from 'lucide-react';

export interface PersonalTask {
  id: string;
  module: 'timesheet' | 'okr' | 'leave' | 'requests' | 'system';
  urgency: 'overdue' | 'soon' | 'today' | 'normal' | 'info';
  title: string;
  description: string;
  dueTime: string;
  actionLabel: string;
  actionUrl: string;
  completable?: boolean;
}

export interface ApprovalRequest {
  id: string;
  category: 'attendance' | 'okr' | 'system';
  priority: 'red' | 'yellow' | 'green';
  title: string;
  subtitle: string;
  requester: string;
  dept: string;
  submittedAt: string;
  badgeText: string;
  details?: Record<string, string>;
}

export interface LeaveSummary {
  totalRemaining: number;
  carriedRemaining: number;
  annualRemaining: number;
  carriedExpiryDate: string;
  policyNotice?: string;
  carryStatus?: 'AVAILABLE' | 'CAPPED' | 'EXPIRED' | string;
  carriedYear?: number;
  annualYear?: number;
  granted?: number;
  used?: number;
  annualEntitlement?: number;
  annualUsed?: number;
  expiredCarry?: number;
  sickUsed?: number;
}

export interface CompletedLogItem {
  id: string;
  title: string;
  completedAt: string | null;
}

/** Nhãn nguồn của việc — chip nhỏ theo mockup S02. */
const MODULE_LABELS: Record<string, string> = {
  timesheet: 'Chấm công',
  okr: 'OKR',
  leave: 'Phép năm',
  requests: 'Đơn từ',
  system: 'Hệ thống',
};

const MODULE_ICONS: Record<string, React.ReactNode> = {
  timesheet: <Clock className="w-4 h-4" />,
  okr: <Target className="w-4 h-4" />,
  leave: <Sun className="w-4 h-4" />,
  requests: <Inbox className="w-4 h-4" />,
  system: <Calendar className="w-4 h-4" />,
};

/** Nhãn nút hành động rút gọn cho màn hẹp (mobile) — nhãn đầy đủ vẫn ở title/aria-label. */
const SHORT_ACTION_LABELS: Record<string, string> = {
  'Xem Đơn Của Tôi': 'Xem Đơn',
  'Bổ sung Công': 'Bổ sung',
  'Liên Hệ HR': 'Liên hệ HR',
  'Chấm Công Ngay': 'Chấm công',
  'Chấm Công Ra': 'Chấm công ra',
  'Cập Nhật OKR': 'Cập nhật',
  'Xem Bảng Công': 'Xem bảng công',
  'Duyệt Đơn Ngay': 'Duyệt đơn',
};

/** Giờ hoàn tất theo giờ địa phương: 18:46 23/11/2026. */
const formatCompletedAt = (raw: string | null): string => {
  if (!raw) return '';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())} ${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
};

export const TodoInboxPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  /** Chỉ người có quyền duyệt mới thấy tab phê duyệt (khớp ProtectedRoute của /attendance/approvals). */
  const canApprove = !!user && ['ADMIN', 'HR_ADMIN', 'MANAGER'].includes(user.role);

  const [activeTab, setActiveTab] = useState<'PERSONAL' | 'APPROVALS' | 'DONE'>('PERSONAL');
  const [filterPriority, setFilterPriority] = useState<'all' | 'red' | 'yellow' | 'green'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedApproval, setSelectedApproval] = useState<ApprovalRequest | null>(null);
  const [activeActionModal, setActiveActionModal] = useState<'approve' | 'reject' | null>(null);
  const [actionReason, setActionReason] = useState('');
  /** Menu "⋯" của một việc — chỉ mở khi bấm, để mỗi dòng chỉ có 1 nút hành động. */
  const [openTaskMenu, setOpenTaskMenu] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Leave balance summary (Criteria G1-#4: Số phép còn lại hiện ngay trên trang này)
  const [leaveSummary, setLeaveSummary] = useState<LeaveSummary>({
    totalRemaining: 0,
    carriedRemaining: 0,
    annualRemaining: 0,
    carriedExpiryDate: '',
    carriedYear: new Date().getFullYear() - 1,
    annualYear: new Date().getFullYear(),
  });

  // 1. Personal Action Items (Theo hợp đồng C1 / S02 trong docs/04-convenience-features.md)
  const [personalTasks, setPersonalTasks] = useState<PersonalTask[]>([]);

  // Load from real backend APIs on mount
  useEffect(() => {
    fetch('/api/v1/todos/my-inbox')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data)) {
          const mapped: PersonalTask[] = data.data.map((item: any) => ({
            id: item.id,
            module: item.module || (item.category === 'OKR' ? 'okr' : 'timesheet'),
            urgency: item.urgency || (item.priority === 'HIGH' ? 'overdue' : 'soon'),
            title: item.title,
            description: item.description,
            dueTime: item.dueDate || 'Hôm nay',
            actionLabel: item.actionLabel || 'Xử lý ngay',
            actionUrl: item.actionUrl || '/attendance/checkin',
            completable: item.completable !== false,
          }));
          setPersonalTasks(mapped);
        }
      })
      .catch(() => {});

    if (canApprove) fetch('/api/v1/todos/approvals')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data)) {
          const mapped: ApprovalRequest[] = data.data.map((item: any) => ({
            id: item.id || `REQ-${Math.floor(Math.random() * 1000)}`,
            category: item.type === 'OKR' ? 'okr' : 'attendance',
            priority: item.priority || (item.slaHoursRemaining < 12 ? 'red' : item.slaHoursRemaining < 36 ? 'yellow' : 'green'),
            title: item.title || `Đơn ${item.type || 'yêu cầu'}`,
            subtitle: item.reason || `${item.days || 1} ngày`,
            requester: item.requester || 'Nhân viên',
            dept: item.dept || 'Trung tâm Công nghệ',
            submittedAt: item.submittedAt || 'Hôm nay',
            badgeText: item.badgeText || (item.slaHoursRemaining ? `Còn ${item.slaHoursRemaining}h` : 'Chờ duyệt'),
            details: {
              'Loại đơn': item.type || 'Phê duyệt',
              'Lý do': item.reason || 'N/A',
              'Thời hạn': item.badgeText || '48h',
            },
          }));
          setApprovals(mapped);
        }
      })
      .catch(() => {});

    fetch('/api/v1/todos/leave-summary')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data) {
          setLeaveSummary(data.data);
        }
      })
      .catch(() => {});

    fetch('/api/v1/todos/completed')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data)) {
          setCompletedList(
            data.data.map((item: any) =>
              typeof item === 'string'
                ? { id: item, title: item, completedAt: null }
                : { id: item.id, title: item.title || 'Việc đã hoàn tất', completedAt: item.completedAt ?? null }
            )
          );
        }
      })
      .catch(() => {});
  }, [canApprove]);

  useEffect(() => {
    // Luôn phát event đồng bộ số lượng việc cần làm thật cho badge trên Sidebar menu
    window.dispatchEvent(new CustomEvent('act_todo_updated', { detail: { count: personalTasks.length } }));
  }, [personalTasks.length]);

  // 2. Manager / HR Approval Items
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);

  // 3. Completed Tasks History
  const [completedList, setCompletedList] = useState<CompletedLogItem[]>([]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleCompletePersonalTask = async (task: PersonalTask) => {
    if (task.completable === false) {
      showToast('Mục tổng hợp này tự cập nhật theo dữ liệu thật, không tick tay được.');
      return;
    }
    try {
      const res = await fetch(`/api/v1/todos/${task.id}/complete`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showToast(err?.message || 'Không cập nhật được trạng thái việc này.');
        return;
      }
    } catch {
      showToast('Không kết nối được máy chủ.');
      return;
    }
    setPersonalTasks((prev) => prev.filter((t) => t.id !== task.id));
    setCompletedList((prev) => [
      { id: task.id, title: task.title, completedAt: new Date().toISOString() },
      ...prev,
    ]);
    showToast(`Đã đánh dấu hoàn tất: ${task.title}`);
  };

  const handleApprovalAction = async (action: 'approve' | 'reject') => {
    if (!selectedApproval) return;
    const actionText = action === 'approve' ? 'Phê duyệt' : 'Từ chối';
    try {
      const res = await fetch(`/api/v1/todos/approvals/${selectedApproval.id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: action.toUpperCase(), comment: actionReason || actionText }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(payload?.message || 'Không xử lý được đơn — kiểm tra quyền duyệt.');
        return;
      }
    } catch {
      showToast('Không kết nối được máy chủ.');
      return;
    }

    setApprovals((prev) => prev.filter((a) => a.id !== selectedApproval.id));
    setCompletedList((prev) => [
      {
        id: `local-${selectedApproval.id}`,
        title: `${actionText} đơn ${selectedApproval.id} của ${selectedApproval.requester}`,
        completedAt: new Date().toISOString(),
      },
      ...prev,
    ]);
    showToast(`Đã ${actionText.toLowerCase()} đơn ${selectedApproval.id} thành công!`);
    setSelectedApproval(null);
    setActiveActionModal(null);
    setActionReason('');
  };

  const handleBulkApproveGreen = () => {
    const greenItems = approvals.filter((a) => a.priority === 'green');
    if (greenItems.length === 0) {
      showToast('Không có mục kế hoạch xanh nào cần duyệt!');
      return;
    }
    fetch('/api/v1/todos/batch-approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestIds: greenItems.map((g) => g.id) }),
    }).catch(() => {});

    setApprovals((prev) => prev.filter((a) => a.priority !== 'green'));
    setCompletedList((prev) => [
      {
        id: `local-batch-${greenItems.length}-${prev.length}`,
        title: `Đã duyệt hàng loạt ${greenItems.length} đơn kế hoạch theo lịch`,
        completedAt: new Date().toISOString(),
      },
      ...prev,
    ]);
    showToast(`Đã duyệt nhanh thành công ${greenItems.length} mục xanh theo lịch!`);
  };

  const filteredApprovals = approvals.filter((item) => {
    if (filterPriority !== 'all' && item.priority !== filterPriority) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        item.title.toLowerCase().includes(term) ||
        item.requester.toLowerCase().includes(term) ||
        item.subtitle.toLowerCase().includes(term)
      );
    }
    return true;
  });

  const redCount = approvals.filter((i) => i.priority === 'red').length;
  const yellowCount = approvals.filter((i) => i.priority === 'yellow').length;
  const greenCount = approvals.filter((i) => i.priority === 'green').length;

  // Filter with Search Term and 4 Urgency Buckets
  const searchedTasks = personalTasks.filter((t) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      t.title.toLowerCase().includes(term) ||
      t.description.toLowerCase().includes(term) ||
      t.module.toLowerCase().includes(term)
    );
  });

  const overdueTasks = searchedTasks.filter((t) => t.urgency === 'overdue');
  const soonTasks = searchedTasks.filter((t) => t.urgency === 'soon');
  const todayTasks = searchedTasks.filter((t) => t.urgency === 'today' || t.urgency === 'normal');
  const infoTasks = searchedTasks.filter((t) => t.urgency === 'info');

  /** Ngày + giờ kiểu mockup: "Thứ Tư, 12/11/2026 · 9:41 sáng". */
  const todayLabel = useMemo(() => {
    const now = new Date();
    const weekday = now.toLocaleDateString('vi-VN', { weekday: 'long' });
    const day = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;
    const hour = now.getHours();
    const period = hour < 12 ? 'sáng' : hour < 18 ? 'chiều' : 'tối';
    const h12 = hour % 12 === 0 ? 12 : hour % 12;
    const min = String(now.getMinutes()).padStart(2, '0');
    return `${weekday}, ${day} · ${h12}:${min} ${period}`;
  }, []);

  /** Số việc đã hoàn tất trong ngày — khớp badge "4 đã xong hôm nay" của mockup. */
  const completedTodayCount = useMemo(() => {
    const today = new Date().toDateString();
    return completedList.filter((item) => {
      if (!item.completedAt) return false;
      const d = new Date(item.completedAt);
      return !Number.isNaN(d.getTime()) && d.toDateString() === today;
    }).length;
  }, [completedList]);

  /**
   * Mỗi việc là MỘT hàng ngang trên desktop (đúng mockup S02): icon · tiêu đề+mô tả ·
   * chip nguồn · nút hành động. Việc phụ ("Đã xong", "Xoá") nằm trong menu ⋯.
   *
   * Trên MOBILE (<sm) 1 hàng ngang không đủ chỗ → chuyển sang 2 dòng: dòng 1 là
   * icon + nội dung (tiêu đề xuống dòng thay vì bị cắt "B…"), dòng 2 là chip
   * nguồn + hạn + nút hành động. Nút hành động luôn nằm ở góc phải dòng 2.
   */
  const renderTaskCard = (task: PersonalTask) => {
    const isOverdue = task.urgency === 'overdue';
    const isSoon = task.urgency === 'soon';
    const isToday = task.urgency === 'today' || task.urgency === 'normal';
    const accentClass = isOverdue
      ? 'border-l-status-danger'
      : isSoon
        ? 'border-l-status-warn'
        : isToday
          ? 'border-l-accent'
          : 'border-l-status-ok';
    const iconClass = isOverdue
      ? 'bg-status-danger-soft text-status-danger'
      : isSoon
        ? 'bg-status-warn-soft text-status-warn'
        : isToday
          ? 'bg-accent-soft text-accent-dark'
          : 'bg-status-ok-soft text-status-ok';

    // Nhãn nút hành động rút gọn trên mobile ("Xem Đơn Của Tôi" → "Xem Đơn") để
    // dòng 2 không tràn ngang — nhưng nhãn đầy đủ vẫn nằm trong title/aria-label.
    const shortLabel = SHORT_ACTION_LABELS[task.actionLabel] ?? task.actionLabel;

    const actionButton = (
      <Button
        variant="primary"
        size="sm"
        onClick={() => navigate(task.actionUrl)}
        className="shrink-0"
        title={task.actionLabel}
        aria-label={task.actionLabel}
      >
        <span className="hidden sm:inline">{task.actionLabel}</span>
        <span className="sm:hidden">{shortLabel}</span>
        <ArrowRight className="w-3.5 h-3.5 ml-1" />
      </Button>
    );

    const menuButton = (
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => setOpenTaskMenu((prev) => (prev === task.id ? null : task.id))}
          className="w-7 h-7 grid place-items-center rounded-lg text-ink-muted hover:bg-canvas hover:text-ink transition-colors cursor-pointer"
          title="Tuỳ chọn khác"
          aria-label={`Tuỳ chọn khác cho ${task.title}`}
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
        {openTaskMenu === task.id && (
          <div className="absolute right-0 top-8 z-20 w-44 bg-surface border border-line rounded-lg shadow-lg py-1">
            {task.completable !== false && (
              <button
                type="button"
                onClick={() => {
                  setOpenTaskMenu(null);
                  handleCompletePersonalTask(task);
                }}
                className="w-full text-left px-3 py-2 text-xs text-ink hover:bg-canvas flex items-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-status-ok" />
                Đánh dấu đã xong
              </button>
            )}
            {!task.completable && (
              <div className="px-3 py-2 text-[11px] text-ink-muted">
                Mục tổng hợp — tự cập nhật theo dữ liệu thật.
              </div>
            )}
          </div>
        )}
      </div>
    );

    return (
      <div
        key={task.id}
        className={`relative bg-surface border border-line border-l-[3px] ${accentClass} rounded-xl px-3 sm:px-4 py-3 transition-shadow hover:shadow-sm`}
      >
        {/* MOBILE: 2 dòng — nội dung trên, hành động dưới */}
        <div className="sm:hidden">
          <div className="flex items-start gap-3">
            <div className={`w-8 h-8 rounded-lg grid place-items-center shrink-0 ${iconClass}`}>
              {MODULE_ICONS[task.module] ?? <Calendar className="w-4 h-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold text-ink leading-snug">{task.title}</div>
              <div className="text-xs text-ink-muted mt-1 leading-relaxed">{task.description}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <span className="text-[11px] px-2 py-0.5 rounded-full border border-line bg-canvas text-ink-secondary font-medium shrink-0">
              {MODULE_LABELS[task.module] ?? 'Hệ thống'}
            </span>
            <span className="text-[11px] text-ink-muted font-mono truncate min-w-0">{task.dueTime}</span>
            <div className="ml-auto flex items-center gap-1.5 shrink-0">
              {menuButton}
              {actionButton}
            </div>
          </div>
        </div>

        {/* DESKTOP: 1 hàng ngang */}
        <div className="hidden sm:flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg grid place-items-center shrink-0 ${iconClass}`}>
            {MODULE_ICONS[task.module] ?? <Calendar className="w-4 h-4" />}
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold text-ink truncate">{task.title}</div>
            <div className="text-xs text-ink-muted mt-0.5 truncate">{task.description}</div>
          </div>

          <span className="text-[11px] px-2 py-0.5 rounded-full border border-line bg-canvas text-ink-secondary font-medium shrink-0">
            {MODULE_LABELS[task.module] ?? 'Hệ thống'}
          </span>

          <span className="text-[11px] text-ink-muted font-mono shrink-0">{task.dueTime}</span>

          {menuButton}
          {actionButton}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 max-w-[840px] mx-auto px-3 sm:px-0 pb-10">
      {/* Page Header — đúng mockup S02: tiêu đề + ngày giờ + số đang chờ/đã xong */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-[19px] font-bold tracking-tight text-ink">Cần làm</h1>
            <Badge variant="accent">Trang Mặc Định</Badge>
          </div>
          <div className="text-xs text-ink-muted mt-0.5">{todayLabel}</div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {personalTasks.length > 0 && (
            <span className="text-[11px] px-2 py-0.5 rounded-full border border-line bg-canvas text-ink-secondary font-semibold">
              {personalTasks.length} đang chờ
            </span>
          )}
          {completedTodayCount > 0 && (
            <span className="text-[11px] px-2 py-0.5 rounded-full border border-status-ok-line bg-status-ok-soft text-status-ok font-semibold">
              {completedTodayCount} đã xong hôm nay
            </span>
          )}
          {activeTab === 'APPROVALS' && (
            <Button variant="primary" size="sm" onClick={handleBulkApproveGreen}>
              <CheckCheck className="w-3.5 h-3.5 mr-1" />
              Duyệt Nhanh Mục Xanh ({greenCount})
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            Làm mới (F5)
          </Button>
        </div>
      </div>

      {toastMessage && (
        <div className="p-3 bg-status-ok-soft border border-status-ok-line rounded-xl text-status-ok text-xs font-semibold animate-in fade-in flex items-center gap-2 shadow-2xs">
          <CheckCircle2 className="w-4 h-4 text-status-ok" />
          {toastMessage}
        </div>
      )}

      {/* Main Tabs (Việc Của Tôi vs Đơn Chờ Duyệt vs Lịch Sử) — cuộn ngang trên mobile */}
      <div className="flex border-b border-line gap-2 text-xs font-bold overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('PERSONAL')}
          className={`pb-3 px-3 transition-colors border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
            activeTab === 'PERSONAL'
              ? 'border-accent text-accent font-bold'
              : 'border-transparent text-ink-muted hover:text-ink'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span className="hidden sm:inline">Việc Cần Làm Của Tôi</span>
          <span className="sm:hidden">Việc Của Tôi</span>
          {personalTasks.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-accent-soft text-accent-dark font-extrabold">
              {personalTasks.length}
            </span>
          )}
        </button>

        {canApprove && (
        <button
          type="button"
          onClick={() => setActiveTab('APPROVALS')}
          className={`pb-3 px-3 transition-colors border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
            activeTab === 'APPROVALS'
              ? 'border-accent text-accent font-bold'
              : 'border-transparent text-ink-muted hover:text-ink'
          }`}
        >
          <Inbox className="w-4 h-4" />
          <span className="hidden sm:inline">Đơn Cần Phê Duyệt</span>
          <span className="sm:hidden">Duyệt Đơn</span>
          {approvals.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-status-danger-soft text-status-danger border border-status-danger-line font-extrabold">
              {approvals.length}
            </span>
          )}
        </button>
        )}

        <button
          type="button"
          onClick={() => setActiveTab('DONE')}
          className={`pb-3 px-3 transition-colors border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
            activeTab === 'DONE'
              ? 'border-accent text-accent font-bold'
              : 'border-transparent text-ink-muted hover:text-ink'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span className="hidden sm:inline">Đã Hoàn Tất</span>
          <span className="sm:hidden">Đã Xong</span>
          <span className="font-mono">({completedList.length})</span>
        </button>
      </div>

      {/* Search Bar & Action Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm kiếm công việc, mã đơn, người gửi..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-surface border border-line rounded-lg text-ink focus:outline-none focus:border-accent"
          />
        </div>
      </div>

      {/* TAB 1: VIỆC CẦN LÀM CỦA TÔI (Gom cả 2 module: Chấm công + OKR) */}
      {activeTab === 'PERSONAL' && (
        <div className="space-y-3">
          {personalTasks.length === 0 ? (
            /* Empty State có CTA (Criteria G1-#7) */
            <div className="p-12 text-center bg-surface rounded-xl border border-line space-y-3 shadow-2xs">
              <div className="text-4xl">🎉</div>
              <div className="font-bold text-base text-ink">Hôm nay không còn việc gì cần làm!</div>
              <p className="text-xs text-ink-muted max-w-md mx-auto">
                Bạn đã hoàn thành đủ chỉ tiêu chấm công và cập nhật OKR. Xem lịch làm việc tháng này hoặc số dư phép năm.
              </p>
              <div className="pt-2">
                <Button variant="primary" size="sm" onClick={() => navigate('/attendance/calendar')}>
                  Xem Lịch Công Tháng Này →
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {/* BUCKET 1: QUÁ HẠN (OVERDUE) */}
              {overdueTasks.length > 0 && (
                <>
                  <div className="flex items-center gap-1.5 mt-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-status-danger" />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-status-danger">
                      Quá hạn ({overdueTasks.length})
                    </span>
                  </div>
                  {overdueTasks.map(renderTaskCard)}
                </>
              )}

              {/* BUCKET 2: SẮP ĐẾN HẠN (SOON) */}
              {soonTasks.length > 0 && (
                <>
                  <div className="flex items-center gap-1.5 mt-2">
                    <Clock className="w-3.5 h-3.5 text-status-warn" />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-status-warn">
                      Sắp đến hạn ({soonTasks.length})
                    </span>
                  </div>
                  {soonTasks.map(renderTaskCard)}
                </>
              )}

              {/* BUCKET 3: HÔM NAY (TODAY) */}
              {todayTasks.length > 0 && (
                <>
                  <div className="flex items-center gap-1.5 mt-2">
                    <CalendarDays className="w-3.5 h-3.5 text-accent" />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-accent">
                      Hôm nay ({todayTasks.length})
                    </span>
                  </div>
                  {todayTasks.map(renderTaskCard)}
                </>
              )}

              {/* BUCKET 4: LƯU Ý (INFO) */}
              {infoTasks.length > 0 && (
                <>
                  <div className="flex items-center gap-1.5 mt-2">
                    <Info className="w-3.5 h-3.5 text-status-info" />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-status-info">
                      Lưu ý ({infoTasks.length})
                    </span>
                  </div>
                  {infoTasks.map(renderTaskCard)}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: HỘP THƯ PHÊ DUYỆT CẤP DƯỚI (Cho Quản lý / HR) */}
      {activeTab === 'APPROVALS' && (
        <div className="space-y-4">
          {/* Priority Filters Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <button
              onClick={() => setFilterPriority('all')}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                filterPriority === 'all'
                  ? 'bg-canvas border-status-ok shadow-xs'
                  : 'bg-surface border-line hover:border-line-focus'
              }`}
            >
              <div className="text-[11px] font-medium text-ink-secondary">Tất cả nhiệm vụ</div>
              <div className="text-2xl font-bold text-ink mt-0.5">{approvals.length}</div>
              <div className="text-[10px] text-ink-muted leading-tight">Tổng việc đang chờ duyệt</div>
            </button>

            <button
              onClick={() => setFilterPriority('red')}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                filterPriority === 'red'
                  ? 'bg-status-danger-soft border-status-danger shadow-xs'
                  : 'bg-surface border-line hover:border-status-danger-line shadow-2xs'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-status-danger">
                  <span className="hidden sm:inline">Khẩn cấp (Red Bucket)</span>
                  <span className="sm:hidden">Khẩn cấp</span>
                </span>
                <span className="w-2 h-2 rounded-full bg-status-danger animate-pulse" />
              </div>
              <div className="text-2xl font-bold text-status-danger mt-0.5">{redCount}</div>
              <div className="text-[10px] text-ink-muted leading-tight">&lt; 24h hoặc ca hôm nay</div>
            </button>

            <button
              onClick={() => setFilterPriority('yellow')}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                filterPriority === 'yellow'
                  ? 'bg-status-warn-soft border-status-warn shadow-xs'
                  : 'bg-surface border-line hover:border-status-warn-line shadow-2xs'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-status-warn">
                  <span className="hidden sm:inline">Cần làm sớm (Yellow)</span>
                  <span className="sm:hidden">Cần làm sớm</span>
                </span>
                <span className="w-2 h-2 rounded-full bg-status-warn" />
              </div>
              <div className="text-2xl font-bold text-status-warn mt-0.5">{yellowCount}</div>
              <div className="text-[10px] text-ink-muted leading-tight">Hạn 1 - 3 ngày tới</div>
            </button>

            <button
              onClick={() => setFilterPriority('green')}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                filterPriority === 'green'
                  ? 'bg-accent-soft border-accent shadow-xs'
                  : 'bg-surface border-line hover:border-accent-line shadow-2xs'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-accent">
                  <span className="hidden sm:inline">Theo lịch (Green)</span>
                  <span className="sm:hidden">Theo lịch</span>
                </span>
                <span className="w-2 h-2 rounded-full bg-accent" />
              </div>
              <div className="text-2xl font-bold text-accent mt-0.5">{greenCount}</div>
              <div className="text-[10px] text-ink-muted leading-tight">Kế hoạch dài hạn &gt; 3 ngày</div>
            </button>
          </div>

          {/* List of Approval Requests */}
          <Card title={`Danh Sách Đơn Cần Phê Duyệt (${filteredApprovals.length})`}>
            {filteredApprovals.length === 0 ? (
              <div className="py-12 text-center text-ink-muted text-xs">
                🎉 Không có đơn nào đang chờ bạn phê duyệt.
              </div>
            ) : (
              <div className="divide-y divide-line">
                {filteredApprovals.map((item) => (
                  <div
                    key={item.id}
                    className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-canvas/40 px-2 rounded-lg transition-colors cursor-pointer"
                    onClick={() => setSelectedApproval(item)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-1">
                        {item.priority === 'red' && <span className="inline-block w-2.5 h-2.5 rounded-full bg-status-danger" />}
                        {item.priority === 'yellow' && <span className="inline-block w-2.5 h-2.5 rounded-full bg-status-warn" />}
                        {item.priority === 'green' && <span className="inline-block w-2.5 h-2.5 rounded-full bg-status-ok" />}
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold text-ink">{item.title}</span>
                          <Badge variant={item.priority === 'red' ? 'danger' : item.priority === 'yellow' ? 'warn' : 'ok'}>
                            {item.badgeText}
                          </Badge>
                          <span className="text-[10px] font-mono text-accent font-semibold">{item.id}</span>
                        </div>
                        <div className="text-xs text-ink-secondary mt-1">{item.subtitle}</div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-muted mt-1.5">
                          <span>👤 <strong>{item.requester}</strong></span>
                          <span>🏢 {item.dept}</span>
                          <span>⏱️ {item.submittedAt}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-stretch md:self-center" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedApproval(item);
                          setActiveActionModal('reject');
                        }}
                        className="flex-1 md:flex-none"
                      >
                        Từ chối
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          setSelectedApproval(item);
                          setActiveActionModal('approve');
                        }}
                        className="flex-1 md:flex-none"
                      >
                        Phê duyệt
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* TAB 3: LỊCH SỬ ĐÃ HOÀN TẤT */}
      {activeTab === 'DONE' && (
        <Card title="Nhật Ký Các Việc Đã Xử Lý Gần Đây">
          {completedList.length === 0 ? (
            <div className="p-8 text-center text-xs text-ink-muted">Chưa có bản ghi nào.</div>
          ) : (
            <div className="divide-y divide-line text-xs">
              {completedList.map((log) => (
                <div key={log.id} className="py-3 flex items-center justify-between gap-3 text-ink-secondary">
                  <div className="flex items-center gap-2 min-w-0">
                    <CheckCircle2 className="w-4 h-4 text-status-ok shrink-0" />
                    <span className="truncate">{log.title}</span>
                  </div>
                  <span className="text-[11px] font-mono text-ink-muted shrink-0">
                    {formatCompletedAt(log.completedAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Card "Phép còn lại" — đặt dưới danh sách theo mockup S02 */}
      <Card
        title="Phép còn lại"
        subtitle="Số dư phép năm của bạn"
        className="mt-2"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-ink-secondary">
                Phép năm {leaveSummary.annualYear ?? new Date().getFullYear()}
              </span>
              <span className="font-semibold text-ink font-mono">
                {leaveSummary.annualRemaining} ngày
              </span>
            </div>
            <div className="h-1.5 bg-canvas rounded-full mt-1.5 overflow-hidden">
              <div
                className="h-full bg-accent rounded-full"
                style={{
                  width: `${Math.min(
                    100,
                    Math.max(
                      0,
                      ((leaveSummary.annualEntitlement ?? 0) - (leaveSummary.annualUsed ?? 0)) /
                        Math.max(1, leaveSummary.annualEntitlement ?? 0) * 100
                    )
                  )}%`,
                }}
              />
            </div>
            <div className="text-[11px] text-ink-muted mt-1.5">
              Cộng thêm 1 ngày vào ngày 15 hàng tháng
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-ink-secondary">
                Phép tồn {leaveSummary.carriedYear ?? new Date().getFullYear() - 1}
              </span>
              <span className="font-semibold text-ink font-mono">
                {leaveSummary.carriedRemaining} ngày
              </span>
            </div>
            <div className="h-1.5 bg-canvas rounded-full mt-1.5 overflow-hidden">
              <div
                className="h-full bg-status-warn rounded-full"
                style={{
                  width: `${Math.min(
                    100,
                    (leaveSummary.carriedRemaining / Math.max(1, leaveSummary.totalRemaining || 1)) * 100
                  )}%`,
                }}
              />
            </div>
            <div className="text-[11px] text-ink-muted mt-1.5">
              {leaveSummary.policyNotice ?? 'Phép tồn được bảo lưu theo quy chế'}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-line">
          <Button variant="outline" size="sm" onClick={() => navigate('/attendance/leaves')}>
            Xem Sổ Phép
          </Button>
          <Button variant="primary" size="sm" onClick={() => navigate('/attendance/requests')}>
            + Tạo Đơn Nghỉ Phép
          </Button>
          <span className="text-[11px] text-ink-muted sm:ml-auto w-full sm:w-auto">
            Tổng còn lại: <strong className="text-ink">{leaveSummary.totalRemaining} ngày</strong>
          </span>
        </div>
      </Card>

      {/* Detail Modal */}
      {selectedApproval && !activeActionModal && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedApproval(null)}
          title={`Hồ Sơ Yêu Cầu: ${selectedApproval.id}`}
        >
          <div className="space-y-4 text-xs">
            <div>
              <span className="text-ink-muted block text-[11px]">Tiêu đề:</span>
              <p className="font-bold text-ink mt-0.5">{selectedApproval.title}</p>
              <p className="text-ink-secondary mt-0.5">{selectedApproval.subtitle}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 p-3 bg-canvas rounded-lg">
              <div>
                <span className="text-ink-muted">Người gửi:</span>
                <div className="font-medium text-ink mt-0.5">{selectedApproval.requester}</div>
              </div>
              <div>
                <span className="text-ink-muted">Phòng ban:</span>
                <div className="font-medium text-ink mt-0.5">{selectedApproval.dept}</div>
              </div>
            </div>

            {selectedApproval.details && (
              <div className="p-3 bg-canvas rounded-lg space-y-2">
                <span className="font-bold text-ink block border-b border-line pb-1">Chi tiết giải trình:</span>
                {Object.entries(selectedApproval.details).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2">
                    <span className="text-ink-muted">{k}:</span>
                    <span className="font-medium text-ink text-right">{v}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setActiveActionModal('reject')}>
                Từ chối
              </Button>
              <Button variant="primary" onClick={() => setActiveActionModal('approve')}>
                Phê duyệt đơn này
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Approval / Rejection Reason Confirmation Modal */}
      {activeActionModal && selectedApproval && (
        <Modal
          isOpen={true}
          onClose={() => setActiveActionModal(null)}
          title={activeActionModal === 'approve' ? 'Xác Nhận Phê Duyệt' : 'Xác Nhận Từ Chối'}
        >
          <div className="space-y-4 text-xs">
            <p className="text-ink">
              Bạn đang chuẩn bị {activeActionModal === 'approve' ? 'chấp thuận' : 'từ chối'} đơn{' '}
              <strong>{selectedApproval.id}</strong> của <strong>{selectedApproval.requester}</strong>.
            </p>

            <div>
              <label className="block text-ink font-semibold mb-1">
                {activeActionModal === 'approve' ? 'Ghi chú phê duyệt (Tùy chọn)' : 'Lý do từ chối (Bắt buộc)'}
              </label>
              <textarea
                rows={3}
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder={
                  activeActionModal === 'approve'
                    ? 'Đồng ý phê duyệt'
                    : 'Nhập lý do từ chối để nhân viên nắm được...'
                }
                className="w-full p-2.5 rounded-lg border border-line bg-surface text-ink"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setActiveActionModal(null)}>
                Hủy bỏ
              </Button>
              <Button
                variant={activeActionModal === 'approve' ? 'primary' : 'secondary'}
                onClick={() => handleApprovalAction(activeActionModal)}
              >
                {activeActionModal === 'approve' ? 'Xác Nhận Phê Duyệt' : 'Xác Nhận Từ Chối'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
};
