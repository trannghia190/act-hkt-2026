import React, { useState } from 'react';
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
  CheckCheck
} from 'lucide-react';

export interface PersonalTask {
  id: string;
  module: 'timesheet' | 'okr' | 'leave';
  urgency: 'overdue' | 'soon' | 'normal' | 'info';
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

export const TodoInboxPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'PERSONAL' | 'APPROVALS' | 'DONE'>('PERSONAL');
  const [filterPriority, setFilterPriority] = useState<'all' | 'red' | 'yellow' | 'green'>('all');
  const [selectedApproval, setSelectedApproval] = useState<ApprovalRequest | null>(null);
  const [activeActionModal, setActiveActionModal] = useState<'approve' | 'reject' | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // 1. Personal Action Items (Theo hợp đồng C1 / S02 trong docs/04-convenience-features.md)
  const [personalTasks, setPersonalTasks] = useState<PersonalTask[]>([
    {
      id: 'TASK-01',
      module: 'timesheet',
      urgency: 'soon',
      title: 'Chấm công ra ca hôm nay (18/11/2026)',
      description: 'Ca hành chính 08:30 – 17:30 · Check-in lúc 08:22 sáng. Đã đủ 8.0 giờ tiêu chuẩn.',
      dueTime: 'Hạn: Trước 19:00 hôm nay',
      actionLabel: 'Chấm công ra ngay',
      actionUrl: '/attendance/checkin',
    },
    {
      id: 'TASK-02',
      module: 'okr',
      urgency: 'soon',
      title: 'Check-in tiến độ OKR tháng 11 / Quý 4',
      description: '2 Key Results thuộc nhóm Business và People đến hạn cập nhật số liệu thực tế định kỳ.',
      dueTime: 'Hạn: 20/11/2026',
      actionLabel: 'Cập nhật KR ngay',
      actionUrl: '/okr/my-okr',
    },
    {
      id: 'TASK-03',
      module: 'timesheet',
      urgency: 'overdue',
      title: 'Bổ sung giờ ra ca chiều hôm qua (17/11)',
      description: 'Hệ thống ghi nhận thiếu log check-out ngày 17/11. Cần gửi đơn bổ sung trong 48h để tính đủ công.',
      dueTime: 'Quá hạn 12 giờ',
      actionLabel: 'Lập đơn bổ sung',
      actionUrl: '/attendance/requests',
    },
    {
      id: 'TASK-04',
      module: 'leave',
      urgency: 'info',
      title: 'Lưu ý: 3.5 ngày phép tồn năm 2025 sắp hết hạn',
      description: 'Theo quy định số 04, toàn bộ số phép tồn chuyển giao từ năm 2025 sẽ tự động hủy sau 31/03/2027.',
      dueTime: 'Còn 133 ngày',
      actionLabel: 'Xem sổ phép cá nhân',
      actionUrl: '/attendance/leaves',
    },
  ]);

  // 2. Manager / HR Approval Items
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([
    {
      id: 'REQ-2026-0042',
      category: 'attendance',
      priority: 'red',
      title: 'Đơn xin nghỉ phép đột xuất (Sốt cao / Bệnh)',
      subtitle: 'Nghỉ 1.5 ngày từ 18/11 đến hết sáng 19/11/2026',
      requester: 'Nguyễn Văn Minh (ACT0142)',
      dept: 'Trung tâm Công nghệ · Nhóm Sirius',
      submittedAt: '18/11/2026 07:45 (Cách đây 30 phút)',
      badgeText: 'Khẩn cấp / Trong ngày',
      details: {
        'Loại nghỉ': 'Nghỉ ốm hưởng BHXH (Sick Leave)',
        'Số ngày trừ phép': '0 ngày (Có giấy chứng nhận khám bệnh BV Hồng Ngọc)',
        'Người bàn giao': 'Lê Hải Đăng (Sirius Core)',
        'Lý do chi tiết': 'Sốt cao 38.5 độ C sáng nay, bác sĩ chỉ định nghỉ ngơi 1.5 ngày',
      },
    },
    {
      id: 'REQ-2026-0039',
      category: 'attendance',
      priority: 'red',
      title: 'Yêu cầu giải trình Quên chấm công (Missed Check-in)',
      subtitle: 'Ca sáng ngày 17/11/2026 lúc 08:32',
      requester: 'Trần Thị Thu Thảo (ACT0089)',
      dept: 'Khối Kinh Doanh & Tiếp Thị · Nhóm Mobile App',
      submittedAt: '17/11/2026 18:05 (Gần chạm hạn 24h)',
      badgeText: 'Hạn chót giải trình: 18/11 12:00',
      details: {
        'Loại giải trình': 'Quên Check-in ca sáng (Chỉ có log Check-out 18:15)',
        'Bằng chứng': 'Lịch sử log git commit lúc 08:35 và xác nhận của Lead',
        'Số lần đã giải trình trong tháng': '1 / 3 lần tối đa',
      },
    },
    {
      id: 'REQ-2026-0028',
      category: 'okr',
      priority: 'yellow',
      title: 'Phê duyệt Mục tiêu OKR Quý 4/2026',
      subtitle: '2 Nhóm Business + People · 6 Key Results (Trọng số 100%)',
      requester: 'Hoàng Anh Dũng (ACT0055)',
      dept: 'Trung tâm Công nghệ · Nhóm Optimus',
      submittedAt: '16/11/2026 14:20 (Chờ duyệt 2 ngày)',
      badgeText: 'Hạn duyệt quý: 20/11/2026',
      details: {
        'Mục tiêu 1': 'Tối ưu hóa Core Engine giảm latency P99 xuống < 80ms (40%)',
        'Mục tiêu 2': 'Triển khai bảo mật Keycloak RBAC hoàn tất 100% (35%)',
        'Mục tiêu 3': 'Đạt chứng chỉ quốc tế CKA / AWS Solutions Architect (25%)',
      },
    },
    {
      id: 'REQ-2026-0015',
      category: 'attendance',
      priority: 'green',
      title: 'Đăng ký làm thêm giờ (Overtime - OT)',
      subtitle: 'Kế hoạch OT 3 tiếng ngày thứ 7 (21/11/2026)',
      requester: 'Vũ Quốc Toàn (ACT0112)',
      dept: 'Khối Hạ Tầng & Bảo Mật · DevOps Team',
      submittedAt: '15/11/2026 10:12',
      badgeText: 'Kế hoạch tuần tới',
      details: {
        'Thời gian': '09:00 - 12:00 Ngày 21/11/2026 (Thứ 7)',
        'Mục tiêu công việc': 'Bảo trì định kỳ cụm PostgreSQL Cluster và Keycloak v24',
      },
    },
  ]);

  // 3. Completed Tasks History
  const [completedList, setCompletedList] = useState<string[]>([
    'Đã chấm công vào lúc 08:22:15 sáng nay (18/11)',
    'Đã duyệt đơn xin làm việc tại nhà WFH của Trần Thị Thu Hà',
  ]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleCompletePersonalTask = (task: PersonalTask) => {
    setPersonalTasks((prev) => prev.filter((t) => t.id !== task.id));
    setCompletedList((prev) => [`Đã hoàn thành: ${task.title}`, ...prev]);
    showToast(`Đã đánh dấu hoàn tất: ${task.title}`);
  };

  const handleApprovalAction = (action: 'approve' | 'reject') => {
    if (!selectedApproval) return;
    const actionText = action === 'approve' ? 'Phê duyệt' : 'Từ chối';
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
    setApprovals((prev) => prev.filter((a) => a.priority !== 'green'));
    setCompletedList((prev) => [
      `Đã duyệt hàng loạt ${greenItems.length} đơn kế hoạch theo lịch`,
      ...prev,
    ]);
    showToast(`Đã duyệt nhanh thành công ${greenItems.length} mục xanh theo lịch!`);
  };

  const filteredApprovals = approvals.filter((item) => {
    if (filterPriority === 'all') return true;
    return item.priority === filterPriority;
  });

  const redCount = approvals.filter((i) => i.priority === 'red').length;
  const yellowCount = approvals.filter((i) => i.priority === 'yellow').length;
  const greenCount = approvals.filter((i) => i.priority === 'green').length;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-ink">Hộp Việc Cần Xử Lý (Todo Inbox)</h1>
          </div>
          <p className="text-xs text-ink-muted mt-1">
            Trung tâm điều phối một màn hình gom mọi việc đang chờ: Chấm công ra vào, check-in OKR, đơn từ và các phê duyệt của quản lý
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
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-bold animate-in fade-in flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          {toastMessage}
        </div>
      )}

      {/* Main Tabs (Việc Của Tôi vs Duyệt Đơn vs Lịch Sử) */}
      <div className="flex border-b border-line gap-2 text-xs font-bold">
        <button
          type="button"
          onClick={() => setActiveTab('PERSONAL')}
          className={`pb-3 px-3 transition-colors border-b-2 flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'PERSONAL'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-ink-muted hover:text-ink'
          }`}
        >
          <Clock className="w-4 h-4" />
          Việc Cần Làm Của Tôi
          {personalTasks.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-500/15 text-emerald-400 font-extrabold">
              {personalTasks.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('APPROVALS')}
          className={`pb-3 px-3 transition-colors border-b-2 flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'APPROVALS'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-ink-muted hover:text-ink'
          }`}
        >
          <Inbox className="w-4 h-4" />
          Hộp Thư Phê Duyệt Cấp Dưới
          {approvals.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-rose-500/15 text-rose-400 font-extrabold">
              {approvals.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('DONE')}
          className={`pb-3 px-3 transition-colors border-b-2 flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'DONE'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-ink-muted hover:text-ink'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          Đã Hoàn Tất ({completedList.length})
        </button>
      </div>

      {/* TAB 1: VIỆC CẦN LÀM CỦA TÔI */}
      {activeTab === 'PERSONAL' && (
        <div className="space-y-4">
          {personalTasks.length === 0 ? (
            <div className="p-12 text-center bg-surface rounded-xl border border-line space-y-3">
              <div className="text-3xl">🎉</div>
              <div className="font-bold text-sm text-ink">Hôm nay không còn việc gì cần làm!</div>
              <p className="text-xs text-ink-muted max-w-md mx-auto">
                Bạn đã hoàn thành đủ chỉ tiêu chấm công và cập nhật OKR. Xem lịch làm việc tháng này hoặc số dư phép năm.
              </p>
              <div className="pt-2">
                <Button variant="outline" size="sm" onClick={() => navigate('/attendance/calendar')}>
                  Xem Lịch Công Tháng Này →
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {personalTasks.map((task) => (
                <div
                  key={task.id}
                  className={`p-5 rounded-xl border bg-surface shadow-2xs flex flex-col justify-between transition-all hover:border-line-focus ${
                    task.urgency === 'overdue'
                      ? 'border-rose-500/40 bg-rose-500/5'
                      : task.urgency === 'soon'
                      ? 'border-amber-500/30'
                      : 'border-line'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {task.module === 'timesheet' && <Clock className="w-4 h-4 text-emerald-400" />}
                        {task.module === 'okr' && <Target className="w-4 h-4 text-sky-400" />}
                        {task.module === 'leave' && <Sun className="w-4 h-4 text-amber-400" />}
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
                            : 'accent'
                        }
                      >
                        {task.dueTime}
                      </Badge>
                    </div>

                    <h3 className="font-bold text-sm text-ink">{task.title}</h3>
                    <p className="text-xs text-ink-secondary leading-relaxed">{task.description}</p>
                  </div>

                  <div className="pt-4 mt-2 border-t border-line/60 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleCompletePersonalTask(task)}
                      className="text-[11px] text-ink-muted hover:text-emerald-400 transition-colors font-medium cursor-pointer"
                    >
                      ✓ Đã xong
                    </button>

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
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: HỘP THƯ PHÊ DUYỆT CẤP DƯỚI */}
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
                  : 'bg-surface border-line hover:border-rose-400'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-rose-400">Khẩn cấp (Red Bucket)</span>
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              </div>
              <div className="text-2xl font-bold text-rose-400 mt-0.5">{redCount}</div>
              <div className="text-[10px] text-ink-muted">&lt; 24h hoặc ca hôm nay</div>
            </button>

            <button
              onClick={() => setFilterPriority('yellow')}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                filterPriority === 'yellow'
                  ? 'bg-amber-500/15 border-amber-500 shadow-xs'
                  : 'bg-surface border-line hover:border-amber-400'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-amber-400">Cần làm sớm (Yellow)</span>
                <span className="w-2 h-2 rounded-full bg-amber-500" />
              </div>
              <div className="text-2xl font-bold text-amber-400 mt-0.5">{yellowCount}</div>
              <div className="text-[10px] text-ink-muted">Hạn 1 - 3 ngày tới</div>
            </button>

            <button
              onClick={() => setFilterPriority('green')}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                filterPriority === 'green'
                  ? 'bg-emerald-500/15 border-emerald-500 shadow-xs'
                  : 'bg-surface border-line hover:border-emerald-400'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-emerald-400">Theo lịch (Green)</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
              </div>
              <div className="text-2xl font-bold text-emerald-400 mt-0.5">{greenCount}</div>
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
                          <span className="text-[10px] font-mono text-emerald-400">{item.id}</span>
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
    </div>
  );
};
