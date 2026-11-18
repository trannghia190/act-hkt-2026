import React, { useState } from 'react';
import { Bell, Check, Clock, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  type: 'attendance' | 'okr' | 'system';
  level: 'urgent' | 'warning' | 'info';
  read: boolean;
  actionUrl?: string;
}

export const NotificationDropdown: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'ALL' | 'UNREAD'>('ALL');
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: 'NOTIF-01',
      title: 'Nhắc nhở chấm công ra ca chiều',
      message: 'Đã 17:35, bạn đã đủ 8.0 giờ làm việc. Hãy thực hiện chấm công ra ca để ghi nhận đủ công.',
      timestamp: '10 phút trước',
      type: 'attendance',
      level: 'urgent',
      read: false,
      actionUrl: '/attendance/checkin',
    },
    {
      id: 'NOTIF-02',
      title: 'Đơn xin nghỉ phép năm đã được duyệt',
      message: 'Quản lý Phạm Minh Tuấn đã phê duyệt đơn nghỉ phép năm (REQ-2026-0030) của bạn.',
      timestamp: '2 giờ trước',
      type: 'attendance',
      level: 'info',
      read: false,
      actionUrl: '/attendance/requests',
    },
    {
      id: 'NOTIF-03',
      title: 'Hạn chót check-in OKR Quý 4/2026',
      message: 'Hôm nay là hạn chót cập nhật số liệu tiến độ các Key Result tháng 11.',
      timestamp: 'Hôm nay 08:30',
      type: 'okr',
      level: 'warning',
      read: false,
      actionUrl: '/okr/my-okr',
    },
    {
      id: 'NOTIF-04',
      title: 'Cập nhật nội quy lao động mới (Quy tắc 04)',
      message: 'Phòng Nhân sự vừa ban hành phiên bản quy chế mới về thời hạn bảo lưu phép năm 31/03.',
      timestamp: 'Hôm qua',
      type: 'system',
      level: 'info',
      read: true,
      actionUrl: '/admin/policy-doc',
    },
  ]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleClickItem = (item: NotificationItem) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, read: true } : n))
    );
    setIsOpen(false);
    if (item.actionUrl) {
      navigate(item.actionUrl);
    }
  };

  const displayedList = activeTab === 'ALL'
    ? notifications
    : notifications.filter((n) => !n.read);

  return (
    <div className="relative">
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative p-1.5 sm:p-2 rounded-lg border border-line bg-canvas hover:bg-surface text-ink-secondary transition-colors cursor-pointer"
        title="Trung tâm thông báo (S04)"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-600 text-[10px] font-bold text-white flex items-center justify-center animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-surface rounded-xl border border-line shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-3.5 border-b border-line flex items-center justify-between bg-canvas">
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs text-ink">Trung Tâm Thông Báo (S04)</span>
                {unreadCount > 0 && (
                  <span className="text-[10px] bg-rose-500/10 text-rose-500 px-1.5 py-0.5 rounded font-bold">
                    {unreadCount} mới
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllAsRead}
                  className="text-[11px] text-emerald-500 hover:text-emerald-400 font-medium flex items-center gap-1 cursor-pointer"
                >
                  <Check className="w-3 h-3" />
                  Đọc tất cả
                </button>
              )}
            </div>

            {/* Filter Tabs */}
            <div className="flex border-b border-line text-xs font-semibold bg-surface">
              <button
                type="button"
                onClick={() => setActiveTab('ALL')}
                className={`flex-1 py-2 text-center transition-colors cursor-pointer ${
                  activeTab === 'ALL'
                    ? 'text-emerald-500 border-b-2 border-emerald-500 font-bold'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                Tất cả ({notifications.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('UNREAD')}
                className={`flex-1 py-2 text-center transition-colors cursor-pointer ${
                  activeTab === 'UNREAD'
                    ? 'text-emerald-500 border-b-2 border-emerald-500 font-bold'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                Chưa đọc ({unreadCount})
              </button>
            </div>

            {/* Notification Items List */}
            <div className="max-h-80 overflow-y-auto divide-y divide-line/60">
              {displayedList.length === 0 ? (
                <div className="p-8 text-center text-xs text-ink-muted">
                  Không có thông báo nào trong mục này.
                </div>
              ) : (
                displayedList.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleClickItem(item)}
                    className={`p-3 text-xs flex items-start gap-2.5 transition-colors cursor-pointer ${
                      !item.read
                        ? 'bg-emerald-500/5 hover:bg-emerald-500/10'
                        : 'hover:bg-canvas/60 opacity-80'
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {item.level === 'urgent' && <AlertTriangle className="w-4 h-4 text-rose-500" />}
                      {item.level === 'warning' && <Clock className="w-4 h-4 text-amber-500" />}
                      {item.level === 'info' && <Info className="w-4 h-4 text-sky-500" />}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className={`font-semibold truncate ${!item.read ? 'text-ink' : 'text-ink-secondary'}`}>
                          {item.title}
                        </span>
                        {!item.read && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />}
                      </div>
                      <p className="text-[11px] text-ink-secondary mt-0.5 line-clamp-2 leading-relaxed">
                        {item.message}
                      </p>
                      <div className="text-[10px] text-ink-muted mt-1 font-mono">
                        {item.timestamp}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-2 border-t border-line bg-canvas text-center">
              <span className="text-[10px] text-ink-muted font-medium">
                Thông báo đẩy đa kênh: In-app · Mobile Push · Gmail Enterprise
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
