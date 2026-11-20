import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const actions = [
    { label: 'Cần làm (Todo Inbox)', path: '/todo', group: 'Thao tác nhanh' },
    { label: 'Chấm công vào ca Mobile 5 tầng', path: '/attendance/checkin', group: 'Thao tác nhanh' },
    { label: 'Tạo đơn làm việc tại nhà WFH / Nghỉ phép', path: '/attendance/requests', group: 'Thao tác nhanh' },
    { label: 'Hộp thư duyệt đơn từ cấp dưới', path: '/attendance/approvals', group: 'Duyệt đơn' },
    { label: 'Bảng công cá nhân của tôi', path: '/attendance/my-timesheet', group: 'Bảng công' },
    { label: 'Lịch trực quan nhóm Team Schedule', path: '/attendance/team-schedule', group: 'Quản lý nhóm' },
    { label: 'Bảng công & Chốt lương 53 cột', path: '/attendance/timesheet', group: 'Bảng công' },
    { label: 'Số dư phép năm cá nhân', path: '/attendance/leaves', group: 'Phép năm' },
    { label: 'Sổ cái biến động phép toàn công ty', path: '/attendance/leave-ledger', group: 'Quản trị' },
    { label: 'Dashboard OKR cá nhân', path: '/okr/dashboard', group: 'OKR' },
    { label: 'Thiết lập & Check-in tiến độ OKR', path: '/okr/my-okr', group: 'OKR' },
    { label: 'Duyệt mục tiêu OKR nhóm', path: '/okr/team-approvals', group: 'OKR Quản lý' },
    { label: 'Review & Coaching giữa năm', path: '/okr/mid-year-review', group: 'OKR Quản lý' },
    { label: 'Form Đánh giá OKR cuối năm 4 Box', path: '/okr/assessment', group: 'OKR' },
    { label: 'Bảng tổng hợp HR OKR 9 trường', path: '/okr/summary-report', group: 'Báo cáo' },
    { label: 'Quản lý nhân viên & tài khoản', path: '/admin/employees', group: 'Quản trị' },
    { label: 'Sơ đồ tổ chức & phòng ban', path: '/admin/org-tree', group: 'Quản trị' },
    { label: 'Ca làm việc & lịch nghỉ lễ', path: '/admin/shifts', group: 'Quản trị' },
    { label: 'Đăng ký mẫu khuôn mặt 3 góc', path: '/auth/enroll-face', group: 'Xác thực' },
    { label: 'Cấu hình 19 quy định Rule Engine', path: '/admin/rules', group: 'Quản trị' },
    { label: 'Tra cứu nội quy công ty tự động sinh', path: '/admin/policy-doc', group: 'Tra cứu' },
    { label: 'Nhật ký kiểm toán hệ thống Audit Logs', path: '/admin/audit-logs', group: 'Kiểm toán' },
  ];

  const filtered = actions.filter((a) =>
    a.label.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (path: string) => {
    navigate(path);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-black/50 backdrop-blur-xs">
      <div
        className="w-full max-w-xl bg-surface rounded-xl border border-line shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-3.5 border-b border-line flex items-center gap-3">
          <span className="text-ink-muted text-base">🔍</span>
          <input
            autoFocus
            type="text"
            placeholder="Tìm kiếm màn hình, nhân viên, tạo đơn, tra cứu luật... (ESC để đóng)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted"
          />
          <kbd className="text-[10px] bg-canvas px-1.5 py-0.5 rounded border border-line text-ink-muted">ESC</kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-2 divide-y divide-line-soft">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-xs text-ink-muted">Không tìm thấy kết quả phù hợp.</div>
          ) : (
            <div className="space-y-1">
              {filtered.map((action, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelect(action.path)}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs hover:bg-accent-soft hover:text-accent flex items-center justify-between transition-colors group"
                >
                  <span className="font-medium text-ink group-hover:text-accent flex items-center gap-2">
                    <span className="text-ink-muted">⚡</span> {action.label}
                  </span>
                  <span className="text-[10px] text-ink-muted bg-canvas group-hover:bg-accent/10 px-2 py-0.5 rounded">
                    {action.group}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="px-4 py-2.5 bg-canvas border-t border-line text-[11px] text-ink-muted flex items-center justify-between">
          <span>Dùng phím mũi tên để chọn, Enter để mở</span>
          <span className="font-mono text-[10px]">Command Palette</span>
        </div>
      </div>
    </div>
  );
};
