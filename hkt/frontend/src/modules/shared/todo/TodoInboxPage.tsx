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
  /** Số đơn hiển thị trong tab Duyệt đơn — danh sách thật có thể >100 đơn. */
  const [visibleApprovals, setVisibleApprovals] = useState(20);
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
    const tone =
      task.urgency === 'overdue'
        ? { tile: 'bg-status-danger-soft text-status-danger', tag: 'bg-status-danger-soft text-status-danger border-status-danger-line', bar: 'bg-status-danger', text: 'text-status-danger', soft: 'bg-status-danger-soft text-status-danger' }
        : task.urgency === 'soon'
          ? { tile: 'bg-status-warn-soft text-status-warn', tag: 'bg-status-warn-soft text-status-warn border-status-warn-line', bar: 'bg-status-warn', text: 'text-status-warn', soft: 'bg-status-warn-soft text-status-warn' }
          : task.urgency === 'info'
            ? { tile: 'bg-status-info-soft text-status-info', tag: 'bg-status-info-soft text-status-info border-status-info-line', bar: 'bg-status-info', text: 'text-status-info', soft: 'bg-status-info-soft text-status-info' }
            : { tile: 'bg-status-ok-soft text-status-ok', tag: 'bg-status-ok-soft text-status-ok border-status-ok-line', bar: 'bg-status-ok', text: 'text-status-ok', soft: 'bg-status-ok-soft text-status-ok' };

    // Nhãn nút hành động rút gọn trên mobile ("Xem Đơn Của Tôi" → "Xem Đơn") để
    // dòng cuối không tràn ngang — nhãn đầy đủ vẫn nằm trong title/aria-label.
    const shortLabel = SHORT_ACTION_LABELS[task.actionLabel] ?? task.actionLabel;

    // Chỉ việc gấp mới dùng nút đặc đỏ; các việc còn lại dùng nút viền như mockup
    // để mắt tập trung vào đúng 1-2 hành động cần làm ngay.
    const isUrgentAction = ['Xem Đơn Của Tôi', 'Chấm Công Ngay', 'Chấm Công Ra'].includes(task.actionLabel);

    const actionButton = (
      <Button
        variant={isUrgentAction ? 'primary' : 'secondary'}
        size="sm"
        onClick={() => navigate(task.actionUrl)}
        className="shrink-0 h-8 px-3 text-[12px] font-semibold rounded-[9px]"
        title={task.actionLabel}
        aria-label={task.actionLabel}
      >
        <span className="hidden sm:inline">{task.actionLabel}</span>
        <span className="sm:hidden">{shortLabel}</span>
      </Button>
    );

    const menuButton = (
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => setOpenTaskMenu((prev) => (prev === task.id ? null : task.id))}
          className="w-8 h-8 grid place-items-center rounded-lg text-ink-muted hover:bg-canvas hover:text-ink transition-colors cursor-pointer"
          title="Tuỳ chọn khác"
          aria-label={`Tuỳ chọn khác cho ${task.title}`}
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
        {openTaskMenu === task.id && (
          <div className="absolute right-0 top-9 z-20 w-44 bg-surface border border-line rounded-lg shadow-lg py-1">
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
              <div className="px-3 py-2 text-[11px] text-ink-muted leading-relaxed">
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
        data-testid="todo-card"
        className="bg-surface border border-line rounded-[14px] px-3.5 py-3 sm:px-4 sm:py-3.5 transition-shadow hover:shadow-xs"
      >
        {/* MOBILE: 2 dòng — nội dung trên, hành động dưới */}
        <div className="sm:hidden">
          <div className="flex items-start gap-3">
            <div className={`w-9 h-9 rounded-[10px] grid place-items-center shrink-0 ${tone.tile}`}>
              {MODULE_ICONS[task.module] ?? <Calendar className="w-4 h-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold text-ink leading-snug">{task.title}</div>
              <p className="text-[12px] text-ink-muted mt-1 leading-relaxed line-clamp-2">{task.description}</p>
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <span className="text-[10.5px] px-2 py-0.5 rounded-full border border-line bg-surface-secondary text-ink-secondary font-semibold">
                  {MODULE_LABELS[task.module] ?? 'Hệ thống'}
                </span>
                <span className="text-[10.5px] px-2 py-0.5 rounded-full border border-line bg-surface-secondary text-ink-muted font-mono">
                  {task.dueTime}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2.5 pt-2.5 border-t border-line-soft">
            {actionButton}
            <span className="ml-auto text-[10.5px] text-ink-muted font-mono truncate max-w-[110px]">{task.dueTime}</span>
            {menuButton}
          </div>
        </div>

        {/* DESKTOP: icon · nội dung · hành động */}
        <div className="hidden sm:flex items-start gap-3">
          <div className={`w-9 h-9 rounded-[10px] grid place-items-center shrink-0 ${tone.tile}`}>
            {MODULE_ICONS[task.module] ?? <Calendar className="w-4 h-4" />}
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-[13.5px] font-semibold text-ink leading-snug">{task.title}</div>
            <p className="text-[12.5px] text-ink-muted mt-1 leading-relaxed line-clamp-2">{task.description}</p>
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className="text-[10.5px] px-2 py-0.5 rounded-full border border-line bg-surface-secondary text-ink-secondary font-semibold">
                {MODULE_LABELS[task.module] ?? 'Hệ thống'}
              </span>
              <span className={`text-[10.5px] px-2 py-0.5 rounded-full border font-mono ${tone.tag}`}>{task.dueTime}</span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1 shrink-0 pt-0.5">
            {actionButton}
            {menuButton}
          </div>
        </div>
      </div>
    );
  };

  /** Nhãn mục (Quá hạn / Sắp tới / Hôm nay / Lưu ý) — vạch màu + số lượng. */
  const renderSectionHeader = (
    label: string,
    count: number,
    tone: 'danger' | 'warn' | 'ok' | 'info',
  ) => {
    if (count === 0) return null;
    const cls =
      tone === 'danger'
        ? { bar: 'bg-status-danger', text: 'text-status-danger', soft: 'bg-status-danger-soft text-status-danger' }
        : tone === 'warn'
          ? { bar: 'bg-status-warn', text: 'text-status-warn', soft: 'bg-status-warn-soft text-status-warn' }
          : tone === 'info'
            ? { bar: 'bg-status-info', text: 'text-status-info', soft: 'bg-status-info-soft text-status-info' }
            : { bar: 'bg-status-ok', text: 'text-status-ok', soft: 'bg-status-ok-soft text-status-ok' };
    return (
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-[3px] h-3.5 rounded-full ${cls.bar}`} />
        <h4 className={`text-[10.5px] font-extrabold uppercase tracking-[0.1em] ${cls.text}`}>{label}</h4>
        <span className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-md leading-none ${cls.soft}`}>{count}</span>
      </div>
    );
  };

  const tabChipClass = (active: boolean) =>
    `inline-flex items-center gap-1.5 h-[31px] px-3 rounded-full border text-[12.5px] font-semibold whitespace-nowrap transition-colors cursor-pointer ${
      active
        ? 'bg-accent-soft border-accent-line text-accent-dark'
        : 'bg-surface border-line text-ink-secondary hover:border-line-hover'
    }`;
  const tabCountClass = (active: boolean) =>
    `text-[10.5px] font-mono font-semibold leading-none ${
      active ? 'bg-accent border border-accent text-on-accent px-1.5 py-0.5 rounded-md' : 'bg-canvas border border-line text-ink-muted px-1.5 py-0.5 rounded-md'
    }`;

  const formatDays = (n: number) =>
    Number(n || 0).toLocaleString('vi-VN', { maximumFractionDigits: 2 });
  /** Số dư âm = đã dùng vượt quỹ → tô màu cảnh báo thay vì để số âm vô nghĩa. */
  const remainClass = (n: number) => (n < 0 ? 'text-status-danger' : 'text-ink');
  /** Tỷ lệ quỹ phép năm đã dùng (0–100) — dùng cho thanh tiến độ. */
  const annualUsedPct = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        ((leaveSummary.annualUsed ?? 0) /
          Math.max(1, leaveSummary.annualEntitlement || leaveSummary.granted || 1)) *
          100,
      ),
    ),
  );

  /** Panel phép còn lại — hiện cột phải trên desktop, full-width trên mobile. */
  const leavePanel = (
    <div className="bg-surface border border-line rounded-[14px] overflow-hidden">
      <div className="flex items-center gap-2 px-3.5 py-3 border-b border-line-soft">
        <Sun className="w-4 h-4 text-accent" />
        <h4 className="text-[12.5px] font-bold text-ink">Phép còn lại</h4>
      </div>

      <div className="px-3.5 pt-1 pb-2">
        <div className="flex items-center gap-2.5 py-2">
          <div className="w-[30px] h-[30px] rounded-[9px] grid place-items-center shrink-0 bg-accent-soft text-accent-dark">
            <CalendarDays className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <b className="block text-[12px] font-semibold text-ink truncate">
              Phép năm {leaveSummary.annualYear ?? new Date().getFullYear()}
            </b>
            <span className="block text-[10.5px] text-ink-muted truncate">
              Đã dùng {formatDays(leaveSummary.annualUsed ?? 0)} / {formatDays(leaveSummary.annualEntitlement ?? leaveSummary.granted ?? 0)} ngày
            </span>
          </div>
          <div className="text-right shrink-0">
            <b className={`block font-mono text-[14px] font-bold ${remainClass(leaveSummary.annualRemaining)}`}>
              {formatDays(leaveSummary.annualRemaining)}
            </b>
            <span className="text-[9.5px] text-ink-muted">ngày</span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 py-2 border-t border-line-soft">
          <div className="w-[30px] h-[30px] rounded-[9px] grid place-items-center shrink-0 bg-status-warn-soft text-status-warn">
            <Clock className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <b className="block text-[12px] font-semibold text-ink truncate">
              Phép tồn {leaveSummary.carriedYear ?? new Date().getFullYear() - 1}
            </b>
            <span className="block text-[10.5px] text-ink-muted truncate">
              {leaveSummary.carriedRemaining > 0
                ? leaveSummary.carriedExpiryDate
                  ? `Hết hạn ${leaveSummary.carriedExpiryDate}`
                  : 'Theo quy chế'
                : 'Không còn phép tồn'}
            </span>
          </div>
          <div className="text-right shrink-0">
            <b className={`block font-mono text-[14px] font-bold ${remainClass(leaveSummary.carriedRemaining)}`}>
              {formatDays(leaveSummary.carriedRemaining)}
            </b>
            <span className="text-[9.5px] text-ink-muted">ngày</span>
          </div>
        </div>

        <div
          className="h-1.5 rounded-full bg-canvas overflow-hidden mt-1.5"
          title={`Đã dùng ${annualUsedPct}% quỹ phép năm`}
        >
          <div
            className={`h-full rounded-full ${annualUsedPct >= 100 ? 'bg-status-danger' : 'bg-accent'}`}
            style={{ width: `${annualUsedPct}%` }}
          />
        </div>

        <div className="flex items-center gap-2.5 py-2 mt-1">
          <div className="w-[30px] h-[30px] rounded-[9px] grid place-items-center shrink-0 bg-status-ok-soft text-status-ok">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <b className="block text-[12px] font-semibold text-ink truncate">Tổng còn lại</b>
            <span className="text-[10.5px] text-ink-muted">Theo ngày onboard</span>
          </div>
          <div className="text-right shrink-0">
            <b
              className={`block font-mono text-[14px] font-bold ${
                leaveSummary.totalRemaining < 0 ? 'text-status-danger' : 'text-status-ok'
              }`}
            >
              {formatDays(leaveSummary.totalRemaining)}
            </b>
            <span className="text-[9.5px] text-ink-muted">ngày</span>
          </div>
        </div>

        {leaveSummary.policyNotice && (
          <p className="text-[10.5px] leading-relaxed text-ink-muted mt-1 line-clamp-2">
            {leaveSummary.policyNotice}
          </p>
        )}
      </div>

      <div className="flex gap-2 px-3.5 py-3 border-t border-line-soft">
        <Button variant="outline" size="sm" className="flex-1 h-8 text-[12px]" onClick={() => navigate('/attendance/leaves')}>
          Xem Sổ Phép
        </Button>
        <Button
          variant="primary"
          size="sm"
          className="flex-1 h-8 text-[12px]"
          onClick={() => navigate('/attendance/requests', { state: { openCreate: 'LEAVE' } })}
        >
          + Tạo Đơn
        </Button>
      </div>
    </div>
  );

  /** Tóm tắt hôm nay — panel cột phải. */
  const summaryPanel = (
    <div className="bg-surface border border-line rounded-[14px] overflow-hidden">
      <div className="flex items-center gap-2 px-3.5 py-3 border-b border-line-soft">
        <CheckCheck className="w-4 h-4 text-status-ok" />
        <h4 className="text-[12.5px] font-bold text-ink">Tóm tắt hôm nay</h4>
      </div>
      <div className="p-3.5 grid grid-cols-2 gap-2">
        {[
          {
            value: personalTasks.length,
            label: 'việc đang chờ',
            cls: personalTasks.length > 0 ? 'text-status-danger' : 'text-ink',
          },
          { value: canApprove ? approvals.length : 0, label: 'đơn chờ duyệt', cls: 'text-ink' },
          { value: completedTodayCount, label: 'đã xong hôm nay', cls: 'text-status-ok' },
          { value: overdueTasks.length, label: 'việc quá hạn', cls: 'text-status-danger' },
        ].map((s) => (
          <div key={s.label} className="bg-canvas border border-line rounded-[10px] px-2.5 py-2.5">
            <b className={`block font-display text-xl font-extrabold leading-none ${s.cls}`}>{s.value}</b>
            <span className="text-[10.5px] text-ink-muted">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );

  const personalList =
    searchedTasks.length === 0 ? (
      <div className="bg-surface border border-line rounded-[14px] py-14 px-6 text-center">
        <div className="w-11 h-11 mx-auto rounded-full bg-status-ok-soft text-status-ok grid place-items-center mb-3">
          <CheckCircle2 className="w-5 h-5" />
        </div>
        <div className="text-[13px] font-semibold text-ink">
          {searchTerm ? 'Không tìm thấy việc phù hợp' : 'Tuyệt vời — không còn việc nào chờ bạn!'}
        </div>
        <p className="text-[12px] text-ink-muted mt-1">
          {searchTerm ? 'Thử từ khóa khác hoặc xoá bộ lọc tìm kiếm.' : 'Hệ thống sẽ tự nhắc bạn khi có việc mới.'}
        </p>
      </div>
    ) : (
      <div className="space-y-4">
        {overdueTasks.length > 0 && (
          <section>
            {renderSectionHeader('Quá hạn', overdueTasks.length, 'danger')}
            <div className="space-y-2">{overdueTasks.map(renderTaskCard)}</div>
          </section>
        )}
        {soonTasks.length > 0 && (
          <section>
            {renderSectionHeader('Sắp tới', soonTasks.length, 'warn')}
            <div className="space-y-2">{soonTasks.map(renderTaskCard)}</div>
          </section>
        )}
        {todayTasks.length > 0 && (
          <section>
            {renderSectionHeader('Hôm nay', todayTasks.length, 'ok')}
            <div className="space-y-2">{todayTasks.map(renderTaskCard)}</div>
          </section>
        )}
        {infoTasks.length > 0 && (
          <section>
            {renderSectionHeader('Lưu ý', infoTasks.length, 'info')}
            <div className="space-y-2">{infoTasks.map(renderTaskCard)}</div>
          </section>
        )}
      </div>
    );

  return (
    <div className="space-y-4 max-w-[1180px] mx-auto px-3 sm:px-0 pb-24 lg:pb-10">
      {/* Page Header — tiêu đề + ngày giờ + lối tắt tạo đơn */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[22px] font-extrabold tracking-tight text-ink">Cần làm</h1>
          <div className="text-[12.5px] text-ink-muted mt-1">{todayLabel}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {activeTab === 'APPROVALS' && canApprove && greenCount > 0 && (
            <Button variant="outline" size="sm" onClick={handleBulkApproveGreen} className="h-9 text-[12px]">
              <CheckCheck className="w-3.5 h-3.5 mr-1.5" />
              Duyệt nhanh {greenCount} mục xanh
            </Button>
          )}
          <Button
            variant="primary"
            size="sm"
            className="h-9 text-[12px]"
            onClick={() => navigate('/attendance/requests', { state: { openCreate: 'LEAVE' } })}
          >
            + Tạo đơn
          </Button>
        </div>
      </div>

      {/* Toast */}
      {toastMessage && (
        <div className="p-3 rounded-xl bg-status-ok-soft border border-status-ok-line text-status-ok text-xs font-medium animate-in fade-in slide-in-from-top-1">
          {toastMessage}
        </div>
      )}

      {/* Tabs dạng chip + ô tìm kiếm */}
      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2.5">
        <div className="flex items-center gap-2 overflow-x-auto -mx-1 px-1 pb-0.5">
          <button
            type="button"
            onClick={() => setActiveTab('PERSONAL')}
            className={tabChipClass(activeTab === 'PERSONAL')}
          >
            <Clock className="hidden sm:block w-3.5 h-3.5" />
            Việc của tôi
            <span className={tabCountClass(activeTab === 'PERSONAL')}>{personalTasks.length}</span>
          </button>
          {canApprove && (
            <button
              type="button"
              onClick={() => setActiveTab('APPROVALS')}
              className={tabChipClass(activeTab === 'APPROVALS')}
            >
              <Inbox className="hidden sm:block w-3.5 h-3.5" />
              Duyệt đơn
              <span className={tabCountClass(activeTab === 'APPROVALS')}>{approvals.length}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveTab('DONE')}
            className={tabChipClass(activeTab === 'DONE')}
          >
            <CheckCheck className="hidden sm:block w-3.5 h-3.5" />
            Đã xong
            <span className={tabCountClass(activeTab === 'DONE')}>{completedList.length}</span>
          </button>
        </div>

        <div className="relative w-full sm:w-[300px] shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-muted pointer-events-none" />
          <input
            id="todo-search"
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm việc, đơn từ, người gửi..."
            className="w-full h-9 pl-9 pr-3 text-[12px] rounded-[10px] border border-line bg-surface text-ink placeholder:text-ink-muted focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/20 transition"
          />
        </div>
      </div>

      {/* Nội dung + panel phải */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-4 items-start">
        <div className="min-w-0">
          {activeTab === 'PERSONAL' && personalList}

          {activeTab === 'APPROVALS' && (
            <div className="space-y-4">
              {/* Bộ lọc ưu tiên */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { key: 'all' as const, label: 'Tất cả', sub: 'Mọi đơn chờ duyệt', count: approvals.length, dot: 'bg-ink-muted' },
                  { key: 'red' as const, label: 'Khẩn cấp', sub: 'Cần duyệt ngay', count: redCount, dot: 'bg-status-danger' },
                  { key: 'yellow' as const, label: 'Sớm', sub: 'Hạn 1–3 ngày tới', count: yellowCount, dot: 'bg-status-warn' },
                  { key: 'green' as const, label: 'Theo lịch', sub: 'Kế hoạch dài hạn', count: greenCount, dot: 'bg-status-ok' },
                ].map((p) => {
                  const active = filterPriority === p.key;
                  return (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => {
                        setFilterPriority(p.key);
                        setVisibleApprovals(20);
                      }}
                      className={`text-left rounded-xl border p-3 transition-colors cursor-pointer ${
                        active
                          ? 'bg-accent-soft border-accent shadow-xs'
                          : 'bg-surface border-line hover:border-line-hover'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className={`text-[11px] font-semibold ${active ? 'text-accent-dark' : 'text-ink-secondary'}`}>
                          {p.label}
                        </span>
                        <span className={`w-2 h-2 rounded-full ${p.dot}`} />
                      </div>
                      <div className={`font-display text-2xl font-extrabold leading-none mt-1 ${active ? 'text-accent-dark' : 'text-ink'}`}>
                        {p.count}
                      </div>
                      <div className="text-[10px] text-ink-muted leading-tight mt-0.5">{p.sub}</div>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between gap-2">
                <h4 className="text-[10.5px] font-extrabold uppercase tracking-[0.1em] text-ink-muted">
                  Đơn cần phê duyệt
                </h4>
                <span className="text-[11px] text-ink-muted">{filteredApprovals.length} đơn</span>
              </div>

              {filteredApprovals.length === 0 ? (
                <div className="bg-surface border border-line rounded-[14px] py-14 px-6 text-center">
                  <div className="w-11 h-11 mx-auto rounded-full bg-status-ok-soft text-status-ok grid place-items-center mb-3">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div className="text-[13px] font-semibold text-ink">Không có đơn nào đang chờ bạn</div>
                  <p className="text-[12px] text-ink-muted mt-1">Đơn mới sẽ xuất hiện ở đây ngay khi nhân viên gửi.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredApprovals.slice(0, visibleApprovals).map((item) => {
                    const pri =
                      item.priority === 'red'
                        ? { tile: 'bg-status-danger-soft text-status-danger', badge: 'bg-status-danger-soft text-status-danger border-status-danger-line', label: 'Khẩn cấp' }
                        : item.priority === 'yellow'
                          ? { tile: 'bg-status-warn-soft text-status-warn', badge: 'bg-status-warn-soft text-status-warn border-status-warn-line', label: 'Sớm' }
                          : { tile: 'bg-status-ok-soft text-status-ok', badge: 'bg-status-ok-soft text-status-ok border-status-ok-line', label: 'Theo lịch' };
                    return (
                      <div
                        key={item.id}
                        data-testid="approval-card"
                        className="bg-surface border border-line rounded-[14px] px-3.5 py-3 sm:px-4 sm:py-3.5 hover:shadow-xs transition-shadow cursor-pointer"
                        onClick={() => setSelectedApproval(item)}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-9 h-9 rounded-[10px] grid place-items-center shrink-0 ${pri.tile}`}>
                            {item.category === 'okr' ? <Target className="w-4 h-4" /> : item.category === 'system' ? <Info className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[13px] sm:text-[13.5px] font-semibold text-ink">{item.title}</span>
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${pri.badge}`}>
                                {item.badgeText}
                              </span>
                              <span className="text-[10px] font-mono text-accent font-semibold" title={String(item.id)}>
                                #{String(item.id).slice(0, 8).toUpperCase()}
                              </span>
                            </div>
                            <p className="text-[12px] text-ink-secondary mt-0.5 leading-relaxed">{item.subtitle}</p>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-muted mt-1.5">
                              <span className="inline-flex items-center gap-1">
                                <span className="w-1 h-1 rounded-full bg-ink-muted" />
                                {item.requester}
                              </span>
                              <span>{item.dept}</span>
                              <span className="font-mono">{item.submittedAt}</span>
                            </div>
                          </div>
                        </div>

                        <div
                          className="flex items-center gap-2 mt-2.5 pt-2.5 border-t border-line-soft"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="text-[10.5px] font-mono text-ink-muted sm:ml-0">{pri.label}</span>
                          <div className="ml-auto flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-[12px] rounded-[9px]"
                              onClick={() => {
                                setSelectedApproval(item);
                              }}
                            >
                              Chi tiết
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-[12px] rounded-[9px] text-status-danger border-status-danger-line hover:bg-status-danger-soft"
                              onClick={() => {
                                setSelectedApproval(item);
                                setActiveActionModal('reject');
                              }}
                            >
                              Từ chối
                            </Button>
                            <Button
                              variant="primary"
                              size="sm"
                              className="h-8 text-[12px] rounded-[9px]"
                              onClick={() => {
                                setSelectedApproval(item);
                                setActiveActionModal('approve');
                              }}
                            >
                              Phê duyệt
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {filteredApprovals.length > visibleApprovals && (
                    <div className="pt-1 text-center">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 text-[12px]"
                        onClick={() => setVisibleApprovals((n) => n + 20)}
                      >
                        Xem thêm 20 đơn (còn {filteredApprovals.length - visibleApprovals})
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'DONE' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-[10.5px] font-extrabold uppercase tracking-[0.1em] text-ink-muted">
                  Nhật ký đã xử lý
                </h4>
                <span className="text-[11px] text-ink-muted">{completedList.length} mục</span>
              </div>

              {completedList.length === 0 ? (
                <div className="bg-surface border border-line rounded-[14px] py-14 px-6 text-center">
                  <div className="w-11 h-11 mx-auto rounded-full bg-surface-secondary text-ink-muted grid place-items-center mb-3">
                    <CheckCheck className="w-5 h-5" />
                  </div>
                  <div className="text-[13px] font-semibold text-ink">Chưa có việc nào hoàn tất</div>
                  <p className="text-[12px] text-ink-muted mt-1">Các việc bạn đánh dấu xong sẽ được lưu ở đây.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {completedList.map((item) => (
                    <div
                      key={item.id}
                      className="bg-surface border border-line rounded-[14px] px-3.5 py-3 flex items-center gap-3"
                    >
                      <div className="w-9 h-9 rounded-[10px] bg-status-ok-soft text-status-ok grid place-items-center shrink-0">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-semibold text-ink leading-snug">{item.title}</div>
                        <div className="text-[10.5px] text-ink-muted font-mono mt-0.5">
                          {formatCompletedAt(item.completedAt)}
                        </div>
                      </div>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-status-ok-soft text-status-ok border border-status-ok-line shrink-0">
                        Hoàn tất
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Panel phụ chỉ hiện trên desktop rộng */}
        <aside className="hidden xl:block space-y-3">
          {leavePanel}
          {summaryPanel}
        </aside>
      </div>

      {/* Panel phép cho tablet/mobile (cột phải bị ẩn dưới xl) */}
      <div className="xl:hidden space-y-3">{leavePanel}</div>

      {/* Modal chi tiết đơn */}
      {selectedApproval && !activeActionModal && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedApproval(null)}
          title={`Hồ Sơ Yêu Cầu · #${String(selectedApproval.id).slice(0, 8).toUpperCase()}`}
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

      {/* Modal xác nhận duyệt / từ chối */}
      {selectedApproval && activeActionModal && (
        <Modal
          isOpen={true}
          onClose={() => setActiveActionModal(null)}
          title={activeActionModal === 'approve' ? 'Xác Nhận Phê Duyệt Đơn' : 'Xác Nhận Từ Chối Đơn'}
        >
          <div className="space-y-4 text-xs">
            <p className="text-ink">
              Bạn đang chuẩn bị {activeActionModal === 'approve' ? 'chấp thuận' : 'từ chối'} đơn{' '}
              <strong>{selectedApproval.title}</strong> của <strong>{selectedApproval.requester}</strong>{' '}
              <span className="font-mono text-ink-muted">#{String(selectedApproval.id).slice(0, 8).toUpperCase()}</span>.
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
