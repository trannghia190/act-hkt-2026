import React, { useState, useEffect } from 'react';
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

/** Dropdown chỉ tải N thông báo mới nhất — không kéo cả hộp thư lịch sử. */
const DROPDOWN_SIZE = 15;

export const NotificationDropdown: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'ALL' | 'UNREAD'>('ALL');
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadNewest = () => {
    fetch(`/api/v1/notifications?page=0&size=${DROPDOWN_SIZE}`)
      .then((res) => {
        const unreadHeader = Number(res.headers.get('X-Unread-Count'));
        if (Number.isFinite(unreadHeader)) setUnreadCount(unreadHeader);
        return res.json();
      })
      .then((data) => {
        if (data.success && Array.isArray(data.data)) {
          const mapped: NotificationItem[] = data.data.map((d: any) => ({
            id: d.id,
            title: d.title,
            message: d.message || d.content || d.title,
            timestamp: d.timestamp || 'Vừa xong',
            type: (d.type || 'system').toLowerCase() as any,
            level: (d.level || (d.priority === 'HIGH' ? 'urgent' : 'info')) as any,
            read: !!d.read,
            actionUrl: d.actionUrl,
          }));
          setNotifications(mapped);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadNewest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mở dropdown thì làm mới 15 mục mới nhất + badge chưa đọc.
  useEffect(() => {
    if (isOpen) loadNewest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleMarkAllAsRead = () => {
    fetch('/api/v1/notifications/mark-all-read', { method: 'PUT' }).catch(() => {});
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const handleClickItem = (item: NotificationItem) => {
    fetch(`/api/v1/notifications/${item.id}/read`, { method: 'PUT' }).catch(() => {});
    if (!item.read) setUnreadCount((prev) => Math.max(0, prev - 1));
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
        title="Trung tâm thông báo"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-status-danger text-[10px] font-bold text-on-danger flex items-center justify-center animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
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
                <span className="font-bold text-xs text-ink">Trung Tâm Thông Báo</span>
                {unreadCount > 0 && (
                  <span className="text-[10px] bg-status-danger-soft text-status-danger px-1.5 py-0.5 rounded font-bold">
                    {unreadCount > 99 ? '99+' : unreadCount} mới
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllAsRead}
                  className="text-[11px] text-accent hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Check className="w-3 h-3" />
                  Đọc tất cả
                </button>
              )}
            </div>

            {/* Tabs */}
            <div className="flex bg-canvas px-2 border-b border-line">
              <button
                type="button"
                onClick={() => setActiveTab('ALL')}
                className={`px-3 py-2 text-[11px] transition-colors cursor-pointer ${
                  activeTab === 'ALL'
                    ? 'text-accent border-t-2 border-accent font-bold'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                Tất cả
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('UNREAD')}
                className={`px-3 py-2 text-[11px] transition-colors cursor-pointer ${
                  activeTab === 'UNREAD'
                    ? 'text-accent border-t-2 border-accent font-bold'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                Chưa đọc ({unreadCount > 99 ? '99+' : unreadCount})
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
                        ? 'bg-status-ok-soft/40 hover:bg-status-ok-soft'
                        : 'hover:bg-canvas/60 opacity-80'
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {item.level === 'urgent' && <AlertTriangle className="w-4 h-4 text-status-danger" />}
                      {item.level === 'warning' && <Clock className="w-4 h-4 text-status-warn" />}
                      {item.level === 'info' && <Info className="w-4 h-4 text-status-info" />}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className={`font-semibold truncate ${!item.read ? 'text-ink' : 'text-ink-secondary'}`}>
                          {item.title}
                        </span>
                        {!item.read && <span className="w-1.5 h-1.5 rounded-full bg-status-ok shrink-0" />}
                      </div>
                      <p className="text-[11px] text-ink-secondary mt-0.5 line-clamp-2">{item.message}</p>
                      <span className="text-[10px] text-ink-muted mt-1 block">{item.timestamp}</span>
                    </div>

                    {item.read && <CheckCircle2 className="w-3.5 h-3.5 text-status-ok shrink-0 mt-0.5" />}
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-2 border-t border-line bg-canvas flex items-center justify-between text-[11px] px-3">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  navigate('/notifications');
                }}
                className="text-[11px] text-accent hover:underline font-semibold cursor-pointer"
              >
                Xem tất cả thông báo →
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  navigate('/account/notifications');
                }}
                className="text-[11px] text-status-ok hover:underline font-medium cursor-pointer"
              >
                Cài đặt
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
