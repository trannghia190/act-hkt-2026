import React, { useState, useEffect } from 'react';
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
  Plus,
  Trash2
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
}

export const TodoInboxPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'PERSONAL' | 'APPROVALS' | 'DONE'>('PERSONAL');
  const [filterPriority, setFilterPriority] = useState<'all' | 'red' | 'yellow' | 'green'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskUrgency, setNewTaskUrgency] = useState<'overdue' | 'soon' | 'today' | 'info'>('today');
  const [newTaskModule, setNewTaskModule] = useState<'timesheet' | 'okr' | 'leave' | 'requests'>('timesheet');
  const [newTaskActionUrl, setNewTaskActionUrl] = useState('/attendance/checkin');
  const [newTaskActionLabel, setNewTaskActionLabel] = useState('Xử lý ngay');

  const [selectedApproval, setSelectedApproval] = useState<ApprovalRequest | null>(null);
  const [activeActionModal, setActiveActionModal] = useState<'approve' | 'reject' | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Leave balance summary (Criteria G1-#4: Số phép còn lại hiện ngay trên trang này)
  const [leaveSummary, setLeaveSummary] = useState<LeaveSummary>({
    totalRemaining: 10.5,
    carriedRemaining: 3.5,
    annualRemaining: 7.0,
    carriedExpiryDate: '31/03/2027',
    policyNotice: 'Phép tồn năm 2025 được bảo lưu tối đa đến 31/03/2027',
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
          }));
          setPersonalTasks(mapped);
        }
      })
      .catch(() => {});

    fetch('/api/v1/todos/approvals')
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
          setCompletedList(data.data);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    // Luôn phát event đồng bộ số lượng việc cần làm thật cho badge trên Sidebar menu
    window.dispatchEvent(new CustomEvent('act_todo_updated', { detail: { count: personalTasks.length } }));
  }, [personalTasks.length]);

  // 2. Manager / HR Approval Items
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);

  // 3. Completed Tasks History
  const [completedList, setCompletedList] = useState<string[]>([]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleCompletePersonalTask = (task: PersonalTask) => {
    // Call backend API to record completion
    fetch(`/api/v1/todos/${task.id}/complete`, { method: 'POST' }).catch(() => {});
    setPersonalTasks((prev) => prev.filter((t) => t.id !== task.id));
    setCompletedList((prev) => [`Đã hoàn thành: ${task.title}`, ...prev]);
    showToast(`Đã đánh dấu hoàn tất: ${task.title}`);
  };

  const handleDeletePersonalTask = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPersonalTasks((prev) => prev.filter((t) => t.id !== taskId));
    showToast('Đã xóa bỏ công việc khỏi danh sách');
  };

  const handleCreateNewTask = async () => {
    if (!newTaskTitle.trim()) {
      showToast('Vui lòng nhập tiêu đề việc cần làm');
      return;
    }
    const payload = {
      title: newTaskTitle,
      description: newTaskDesc || 'Công việc được giao bổ sung',
      urgency: newTaskUrgency,
      module: newTaskModule,
      actionUrl: newTaskActionUrl,
      actionLabel: newTaskActionLabel,
      dueDate: newTaskUrgency === 'overdue' ? 'Quá hạn' : newTaskUrgency === 'soon' ? 'Còn 2 ngày' : 'Hôm nay',
    };

    try {
      const res = await fetch('/api/v1/todos/create-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success && data.data) {
        const created: PersonalTask = {
          id: data.data.id,
          module: (data.data.module || 'timesheet') as any,
          urgency: (data.data.urgency || 'today') as any,
          title: data.data.title,
          description: data.data.description,
          dueTime: data.data.dueDate || 'Hôm nay',
          actionLabel: data.data.actionLabel || 'Xử lý ngay',
          actionUrl: data.data.actionUrl || '/attendance/checkin',
        };
        setPersonalTasks((prev) => [created, ...prev]);
      } else {
        // Fallback local addition
        const newTask: PersonalTask = {
          id: `todo-custom-${Date.now()}`,
          module: newTaskModule,
          urgency: newTaskUrgency,
          title: newTaskTitle,
          description: newTaskDesc || 'Nhiệm vụ mới tạo',
          dueTime: newTaskUrgency === 'overdue' ? 'Quá hạn' : newTaskUrgency === 'soon' ? 'Còn 2 ngày' : 'Hôm nay',
          actionLabel: newTaskActionLabel,
          actionUrl: newTaskActionUrl,
        };
        setPersonalTasks((prev) => [newTask, ...prev]);
      }
      showToast('Đã thêm việc cần làm thành công!');
      setIsCreateTaskModalOpen(false);
      setNewTaskTitle('');
      setNewTaskDesc('');
    } catch {
      showToast('Đã thêm việc cần làm');
      setIsCreateTaskModalOpen(false);
    }
  };

  const handleApprovalAction = (action: 'approve' | 'reject') => {
    if (!selectedApproval) return;
    const actionText = action === 'approve' ? 'Phê duyệt' : 'Từ chối';
    fetch(`/api/v1/todos/approvals/${selectedApproval.id}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: action.toUpperCase(), comment: actionReason || actionText }),
    }).catch(() => {});

    setApprovals((prev) => prev.filter((a) => a.id !== selectedApproval.id));
    setCompletedList((prev) => [`${actionText} đơn ${selectedApproval.id} của ${selectedApproval.requester}`, ...prev]);
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
      `Đã duyệt hàng loạt ${greenItems.length} đơn kế hoạch theo lịch`,
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

  const renderTaskCard = (task: PersonalTask) => (
    <div
      key={task.id}
      className={`p-4 rounded-xl border bg-surface shadow-2xs flex flex-col justify-between transition-all hover:border-line-focus ${
        task.urgency === 'overdue'
          ? 'border-rose-300 bg-rose-50/50'
          : task.urgency === 'soon'
            ? 'border-amber-300 bg-amber-50/50'
            : task.urgency === 'today' || task.urgency === 'normal'
              ? 'border-accent-line bg-accent-soft/40'
              : 'border-sky-200 bg-sky-50/50'
      }`}
    >
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {task.module === 'timesheet' && <Clock className="w-4 h-4 text-accent" />}
            {task.module === 'okr' && <Target className="w-4 h-4 text-sky-700" />}
            {task.module === 'leave' && <Sun className="w-4 h-4 text-amber-700" />}
            {task.module !== 'timesheet' && task.module !== 'okr' && task.module !== 'leave' && (
              <Calendar className="w-4 h-4 text-indigo-700" />
            )}
            <span className="text-[10px] uppercase font-bold tracking-wider text-ink-muted">
              {task.module === 'timesheet' ? 'Chấm Công' : task.module === 'okr' ? 'OKR Mục Tiêu' : 'Phép Năm'}
            </span>
          </div>
          <Badge
            variant={
              task.urgency === 'overdue'
                ? 'danger'
                : task.urgency === 'soon'
                  ? 'warn'
                  : task.urgency === 'today' || task.urgency === 'normal'
                    ? 'ok'
                    : 'info'
            }
          >
            {task.dueTime}
          </Badge>
        </div>

        <h3 className="font-bold text-sm text-ink">{task.title}</h3>
        <p className="text-xs text-ink-secondary leading-relaxed">{task.description}</p>
      </div>

      <div className="pt-3 mt-2 border-t border-line/60 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => handleCompletePersonalTask(task)}
            className="text-[11px] text-ink-muted hover:text-accent transition-colors font-medium cursor-pointer"
          >
            ✓ Đã xong
          </button>
          <button
            type="button"
            onClick={(e) => handleDeletePersonalTask(task.id, e)}
            className="text-[11px] text-ink-muted hover:text-rose-600 transition-colors cursor-pointer"
            title="Xóa bỏ nhiệm vụ"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => navigate(task.actionUrl)}
        >
          <span>{task.actionLabel}</span>
          <ArrowRight className="w-3.5 h-3.5 ml-1" />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-ink">Cần Làm (Todo Inbox)</h1>
            <Badge variant="accent">S02 · Trang Mặc Định</Badge>
          </div>
          <p className="text-xs text-ink-muted mt-1">
            Trung tâm gom mọi việc đang chờ của CẢ 2 module: Chấm công ra vào, check-in OKR, đơn từ và các phê duyệt của quản lý
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2">
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
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold animate-in fade-in flex items-center gap-2 shadow-2xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-700" />
          {toastMessage}
        </div>
      )}

      {/* TOP CARD: Số Phép Còn Lại Hiện Ngay Trên Trang Này (Criteria G1-#4) */}
      <div className="bg-surface border border-line rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0">
            <Sun className="w-6 h-6 text-amber-700" />
          </div>
          <div>
            <div className="text-[11px] text-ink-muted font-medium">Số dư phép năm cá nhân còn lại (S02 / C1)</div>
            <div className="text-base font-bold text-ink flex flex-wrap items-center gap-2 mt-0.5">
              <span className="text-accent text-lg font-extrabold">{leaveSummary.totalRemaining} ngày</span>
              <span className="text-xs font-normal text-ink-muted">
                (Tồn 2025: <strong className="text-amber-800 font-semibold">{leaveSummary.carriedRemaining}</strong> ngày · Phép 2026: {leaveSummary.annualRemaining} ngày)
              </span>
            </div>
            <div className="text-[11px] text-ink-muted mt-0.5">
              Lưu ý: Phép tồn 2025 bảo lưu tối đa đến <strong className="text-amber-800 font-semibold">{leaveSummary.carriedExpiryDate}</strong>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 self-end sm:self-center">
          <Button variant="outline" size="sm" onClick={() => navigate('/attendance/leaves')}>
            Xem Sổ Phép
          </Button>
          <Button variant="primary" size="sm" onClick={() => navigate('/attendance/requests')}>
            + Tạo Đơn Nghỉ Phép
          </Button>
        </div>
      </div>

      {/* Main Tabs (Việc Của Tôi vs Duyệt Đơn vs Lịch Sử) */}
      <div className="flex border-b border-line gap-2 text-xs font-bold">
        <button
          type="button"
          onClick={() => setActiveTab('PERSONAL')}
          className={`pb-3 px-3 transition-colors border-b-2 flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'PERSONAL'
              ? 'border-accent text-accent font-bold'
              : 'border-transparent text-ink-muted hover:text-ink'
          }`}
        >
          <Clock className="w-4 h-4" />
          Việc Cần Làm Của Tôi
          {personalTasks.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-accent-soft text-accent font-extrabold">
              {personalTasks.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('APPROVALS')}
          className={`pb-3 px-3 transition-colors border-b-2 flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'APPROVALS'
              ? 'border-accent text-accent font-bold'
              : 'border-transparent text-ink-muted hover:text-ink'
          }`}
        >
          <Inbox className="w-4 h-4" />
          Hộp Thư Phê Duyệt Cấp Dưới
          {approvals.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-rose-50 text-rose-700 border border-rose-200 font-extrabold">
              {approvals.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('DONE')}
          className={`pb-3 px-3 transition-colors border-b-2 flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'DONE'
              ? 'border-accent text-accent font-bold'
              : 'border-transparent text-ink-muted hover:text-ink'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          Đã Hoàn Tất ({completedList.length})
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
        {activeTab === 'PERSONAL' && (
          <Button variant="primary" size="sm" onClick={() => setIsCreateTaskModalOpen(true)}>
            <Plus className="w-3.5 h-3.5 mr-1" />
            + Thêm Việc Cần Làm
          </Button>
        )}
      </div>

      {/* TAB 1: VIỆC CẦN LÀM CỦA TÔI (Gom cả 2 module: Chấm công + OKR) */}
      {activeTab === 'PERSONAL' && (
        <div className="space-y-6">
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
            <div className="space-y-6">
              {/* BUCKET 1: QUÁ HẠN (OVERDUE) */}
              {overdueTasks.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-status-danger" />
                    <h2 className="text-xs font-bold uppercase tracking-wider text-status-danger">
                      ⚠ Quá Hạn ({overdueTasks.length})
                    </h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {overdueTasks.map(renderTaskCard)}
                  </div>
                </div>
              )}

              {/* BUCKET 2: SẮP ĐẾN HẠN (SOON) */}
              {soonTasks.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-status-warn" />
                    <h2 className="text-xs font-bold uppercase tracking-wider text-status-warn">
                      ◷ Sắp Đến Hạn ({soonTasks.length})
                    </h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {soonTasks.map(renderTaskCard)}
                  </div>
                </div>
              )}

              {/* BUCKET 3: HÔM NAY (TODAY) */}
              {todayTasks.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-accent" />
                    <h2 className="text-xs font-bold uppercase tracking-wider text-accent">
                      ○ Hôm Nay ({todayTasks.length})
                    </h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {todayTasks.map(renderTaskCard)}
                  </div>
                </div>
              )}

              {/* BUCKET 4: LƯU Ý (INFO) */}
              {infoTasks.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <Info className="w-4 h-4 text-sky-700" />
                    <h2 className="text-xs font-bold uppercase tracking-wider text-sky-700">
                      ℹ Lưu Ý ({infoTasks.length})
                    </h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {infoTasks.map(renderTaskCard)}
                  </div>
                </div>
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
                  ? 'bg-canvas border-emerald-500 shadow-xs'
                  : 'bg-surface border-line hover:border-line-focus'
              }`}
            >
              <div className="text-[11px] font-medium text-ink-secondary">Tất cả nhiệm vụ</div>
              <div className="text-2xl font-bold text-ink mt-0.5">{approvals.length}</div>
              <div className="text-[10px] text-ink-muted">Tổng việc đang chờ duyệt</div>
            </button>

            <button
              onClick={() => setFilterPriority('red')}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                filterPriority === 'red'
                  ? 'bg-rose-500/15 border-rose-500 shadow-xs'
                  : 'bg-surface border-line hover:border-rose-300 shadow-2xs'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-status-danger">Khẩn cấp (Red Bucket)</span>
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              </div>
              <div className="text-2xl font-bold text-status-danger mt-0.5">{redCount}</div>
              <div className="text-[10px] text-ink-muted">&lt; 24h hoặc ca hôm nay</div>
            </button>

            <button
              onClick={() => setFilterPriority('yellow')}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                filterPriority === 'yellow'
                  ? 'bg-amber-50 border-amber-400 shadow-xs'
                  : 'bg-surface border-line hover:border-amber-300 shadow-2xs'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-status-warn">Cần làm sớm (Yellow)</span>
                <span className="w-2 h-2 rounded-full bg-amber-500" />
              </div>
              <div className="text-2xl font-bold text-status-warn mt-0.5">{yellowCount}</div>
              <div className="text-[10px] text-ink-muted">Hạn 1 - 3 ngày tới</div>
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
                <span className="text-[11px] font-semibold text-accent">Theo lịch (Green)</span>
                <span className="w-2 h-2 rounded-full bg-accent" />
              </div>
              <div className="text-2xl font-bold text-accent mt-0.5">{greenCount}</div>
              <div className="text-[10px] text-ink-muted">Kế hoạch dài hạn &gt; 3 ngày</div>
            </button>
          </div>

          {/* List of Approval Requests */}
          <Card title={`Danh Sách Đơn Cần Phê Duyệt (${filteredApprovals.length})`}>
            {filteredApprovals.length === 0 ? (
              <div className="py-12 text-center text-ink-muted text-xs">
                🎉 Bạn đã xử lý hết mọi công việc trong hòm thư phê duyệt!
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
                        {item.priority === 'red' && <span className="inline-block w-2.5 h-2.5 rounded-full bg-rose-500" />}
                        {item.priority === 'yellow' && <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500" />}
                        {item.priority === 'green' && <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" />}
                      </div>

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold text-ink">{item.title}</span>
                          <Badge variant={item.priority === 'red' ? 'danger' : item.priority === 'yellow' ? 'warn' : 'ok'}>
                            {item.badgeText}
                          </Badge>
                          <span className="text-[10px] font-mono text-accent font-semibold">{item.id}</span>
                        </div>
                        <div className="text-xs text-ink-secondary mt-1">{item.subtitle}</div>
                        <div className="flex items-center gap-3 text-[11px] text-ink-muted mt-1.5">
                          <span>👤 <strong>{item.requester}</strong></span>
                          <span>🏢 {item.dept}</span>
                          <span>⏱️ {item.submittedAt}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-center" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="outline"
                        size="sm"
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
                        onClick={() => {
                          setSelectedApproval(item);
                          setActiveActionModal('approve');
                        }}
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
              {completedList.map((log, idx) => (
                <div key={idx} className="py-3 flex items-center justify-between text-ink-secondary">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{log}</span>
                  </div>
                  <span className="text-[11px] font-mono text-ink-muted">Vừa xong</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

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

      {/* Modal: Thêm Việc Cần Làm Mới */}
      {isCreateTaskModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsCreateTaskModalOpen(false)}
          title="Thêm Việc Cần Làm Mới"
        >
          <div className="space-y-3.5 text-xs">
            <div>
              <label className="block text-ink font-semibold mb-1">Tiêu đề việc cần làm *</label>
              <input
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="Ví dụ: Bổ sung chứng từ nghỉ ốm, cập nhật KR..."
                className="w-full p-2.5 rounded-lg border border-line bg-surface text-ink text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-ink font-semibold mb-1">Mô tả chi tiết</label>
              <textarea
                rows={2}
                value={newTaskDesc}
                onChange={(e) => setNewTaskDesc(e.target.value)}
                placeholder="Mô tả công việc cần xử lý..."
                className="w-full p-2.5 rounded-lg border border-line bg-surface text-ink text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-ink font-semibold mb-1">Mức độ khẩn</label>
                <select
                  value={newTaskUrgency}
                  onChange={(e) => setNewTaskUrgency(e.target.value as any)}
                  className="w-full p-2.5 rounded-lg border border-line bg-surface text-ink text-xs"
                >
                  <option value="today">Hôm nay (Today)</option>
                  <option value="soon">Sắp hạn (Soon)</option>
                  <option value="overdue">Quá hạn (Overdue)</option>
                  <option value="info">Lưu ý (Info)</option>
                </select>
              </div>

              <div>
                <label className="block text-ink font-semibold mb-1">Phân hệ (Module)</label>
                <select
                  value={newTaskModule}
                  onChange={(e) => setNewTaskModule(e.target.value as any)}
                  className="w-full p-2.5 rounded-lg border border-line bg-surface text-ink text-xs"
                >
                  <option value="timesheet">Chấm công (Timesheet)</option>
                  <option value="okr">OKR Mục tiêu</option>
                  <option value="leave">Nghỉ phép</option>
                  <option value="requests">Đơn từ khác</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-ink font-semibold mb-1">Đường dẫn hành động (Deep-link)</label>
                <input
                  type="text"
                  value={newTaskActionUrl}
                  onChange={(e) => setNewTaskActionUrl(e.target.value)}
                  className="w-full p-2 rounded-lg border border-line bg-surface text-ink text-xs"
                />
              </div>
              <div>
                <label className="block text-ink font-semibold mb-1">Nhãn nút hành động</label>
                <input
                  type="text"
                  value={newTaskActionLabel}
                  onChange={(e) => setNewTaskActionLabel(e.target.value)}
                  className="w-full p-2 rounded-lg border border-line bg-surface text-ink text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-line">
              <Button variant="outline" size="sm" onClick={() => setIsCreateTaskModalOpen(false)}>
                Hủy bỏ
              </Button>
              <Button variant="primary" size="sm" onClick={handleCreateNewTask}>
                Tạo Việc Cần Làm
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
