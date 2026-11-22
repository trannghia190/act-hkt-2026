import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Clock, AlertTriangle, Info, CheckCircle2, ShieldCheck, ArrowRight, Settings, Search, Plus, Trash2 } from 'lucide-react';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { Modal } from '../../../components/common/Modal';

interface MobileNotifItem {
  id: string;
  title: string;
  detail: string;
  kind: 'urgent' | 'warn' | 'ok' | 'info';
  timestamp: string;
  read: boolean;
  actionUrl?: string;
  actionLabel?: string;
  eventRule?: string;
}

export const MobileNotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'UNREAD'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newType, setNewType] = useState('ATTENDANCE');
  const [newPriority, setNewPriority] = useState('HIGH');
  const [newActionUrl, setNewActionUrl] = useState('/todo');
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [items, setItems] = useState<MobileNotifItem[]>([]);

  useEffect(() => {
    fetch('/api/v1/notifications')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data)) {
          const mapped: MobileNotifItem[] = data.data.map((d: any) => ({
            id: d.id,
            title: d.title,
            detail: d.message || d.content || d.title,
            kind: d.level === 'urgent' ? 'urgent' : d.level === 'warning' ? 'warn' : 'info',
            timestamp: d.timestamp || 'Hôm nay',
            read: !!d.read,
            actionUrl: d.actionUrl,
            actionLabel: 'Xử lý ngay',
            eventRule: d.type ? `#Event · ${d.type}` : '#Event · Đa kênh',
          }));
          setItems(mapped);
        }
      })
      .catch(() => {});
  }, []);

  const unreadCount = items.filter((i) => !i.read).length;

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleMarkAllRead = () => {
    fetch('/api/v1/notifications/mark-all-read', { method: 'PUT' }).catch(() => {});
    setItems((prev) => prev.map((i) => ({ ...i, read: true })));
    showToast('Đã đánh dấu đã đọc tất cả');
  };

  const handleClickItem = (item: MobileNotifItem) => {
    fetch(`/api/v1/notifications/${item.id}/read`, { method: 'PUT' }).catch(() => {});
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, read: true } : i)));
    if (item.actionUrl) {
      navigate(item.actionUrl);
    }
  };

  const handleDeleteNotification = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    fetch(`/api/v1/notifications/${id}`, { method: 'DELETE' }).catch(() => {});
    setItems((prev) => prev.filter((i) => i.id !== id));
    showToast('Đã xóa thông báo thành công');
  };

  const handleCreateNotification = async () => {
    if (!newTitle.trim()) {
      showToast('Vui lòng nhập tiêu đề thông báo');
      return;
    }

    try {
      const res = await fetch('/api/v1/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle,
          content: newContent || newTitle,
          type: newType,
          priority: newPriority,
          actionUrl: newActionUrl,
        }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        const created: MobileNotifItem = {
          id: data.data.id,
          title: data.data.title,
          detail: data.data.content || data.data.title,
          kind: newPriority === 'HIGH' ? 'urgent' : newPriority === 'MEDIUM' ? 'warn' : 'info',
          timestamp: 'Vừa xong',
          read: false,
          actionUrl: data.data.actionUrl || '/todo',
          actionLabel: 'Xử lý ngay',
          eventRule: `#Event · ${newType}`,
        };
        setItems((prev) => [created, ...prev]);
        showToast('Đã lưu thông báo mới vào Database!');
      }
    } catch {
      showToast('Lỗi khi gửi thông báo');
    }
    setIsCreateModalOpen(false);
    setNewTitle('');
    setNewContent('');
  };

  const filteredByTab = activeFilter === 'ALL' ? items : items.filter((i) => !i.read);
  const displayedItems = filteredByTab.filter((i) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return i.title.toLowerCase().includes(term) || i.detail.toLowerCase().includes(term);
  });

  return (
    <div className="max-w-md mx-auto space-y-4 pb-12">
      {/* Top Banner (Mockup S04m) */}
      <div className="bg-canvas border border-line rounded-2xl p-5 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <Badge variant="accent">Mobile Center</Badge>
          <button
            type="button"
            onClick={() => navigate('/notifications/preferences')}
            className="text-xs text-ink-muted hover:text-accent flex items-center gap-1 cursor-pointer font-medium"
          >
            <Settings className="w-3.5 h-3.5" />
            Cài đặt
          </button>
        </div>
        <h1 className="text-lg font-bold text-ink">Thông Báo &amp; Nhắc Việc</h1>
        <p className="text-xs text-ink-muted leading-relaxed">
          3 kênh nhắc việc tự động: Trong web · Email digest 08:00 · Web Push. Đúng người theo ma trận 17 sự kiện × 3 vai trò.
        </p>

        {/* Anti-spam Policy Summary */}
        <div className="p-3 bg-surface rounded-xl border border-line text-[11px] text-ink-secondary space-y-1.5 shadow-2xs">
          <div className="flex items-center gap-1.5 text-accent font-semibold">
            <ShieldCheck className="w-4 h-4 shrink-0 text-accent" />
            Chính sách chống spam thông minh (C2 / C12)
          </div>
          <div className="grid grid-cols-2 gap-2 text-[10px] text-ink-muted pt-1 border-t border-line">
            <div>• Tối đa: <strong>3 push/ngày</strong> (QL: 5)</div>
            <div>• Giờ yên lặng: <strong>21:00 – 07:00</strong></div>
            <div>• Cửa sổ chống trùng: <strong>12 giờ</strong></div>
            <div>• Escalate quá hạn: <strong>&gt; 3 ngày</strong></div>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold animate-in fade-in flex items-center gap-2 shadow-2xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-700" />
          {toastMsg}
        </div>
      )}

      {/* Search Bar & Add Notification Button */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo tiêu đề, nội dung..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-surface border border-line rounded-lg text-ink focus:outline-none focus:border-accent"
          />
        </div>
        <Button variant="primary" size="sm" onClick={() => setIsCreateModalOpen(true)}>
          <Plus className="w-3.5 h-3.5 mr-1" />
          + Tạo Mới
        </Button>
      </div>

      {/* Filter Tabs & Quick Action */}
      <div className="flex items-center justify-between px-1">
        <div className="flex gap-2 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              activeFilter === 'ALL'
                ? 'bg-accent-soft text-accent border border-accent-line font-bold'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            Tất cả ({items.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('UNREAD')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              activeFilter === 'UNREAD'
                ? 'bg-accent-soft text-accent border border-accent-line font-bold'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            Chưa đọc ({unreadCount})
          </button>
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="text-[11px] text-accent hover:underline font-semibold cursor-pointer"
          >
            Đọc tất cả
          </button>
        )}
      </div>

      {/* Notification List */}
      <div className="space-y-3">
        {displayedItems.length === 0 ? (
          <div className="p-10 text-center bg-surface border border-line rounded-2xl text-xs text-ink-muted space-y-2 shadow-2xs">
            <div className="text-2xl">🎉</div>
            <div className="font-semibold text-ink">Hộp thông báo trống</div>
            <p>Bạn đã đọc hết mọi thông báo và nhắc việc.</p>
          </div>
        ) : (
          displayedItems.map((item) => (
            <div
              key={item.id}
              onClick={() => handleClickItem(item)}
              className={`p-4 rounded-xl border bg-surface transition-all cursor-pointer shadow-2xs hover:border-line-focus space-y-2.5 ${
                !item.read
                  ? item.kind === 'urgent'
                    ? 'border-rose-300 bg-rose-50/50'
                    : item.kind === 'warn'
                      ? 'border-amber-300 bg-amber-50/50'
                      : 'border-accent-line bg-accent-soft/30'
                  : 'border-line opacity-75'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      item.kind === 'urgent'
                        ? 'bg-rose-500 animate-pulse'
                        : item.kind === 'warn'
                          ? 'bg-amber-500'
                          : 'bg-accent'
                    }`}
                  />
                  <h3 className="font-bold text-xs text-ink leading-tight">{item.title}</h3>
                </div>
                <span className="text-[10px] font-mono text-ink-muted shrink-0">{item.timestamp}</span>
              </div>

              <p className="text-xs text-ink-secondary leading-relaxed pl-4">{item.detail}</p>

              <div className="pt-2 pl-4 flex items-center justify-between border-t border-line/60">
                <span className="text-[10px] font-mono text-ink-muted">{item.eventRule}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => handleDeleteNotification(item.id, e)}
                    className="p-1 text-ink-muted hover:text-rose-400 transition-colors cursor-pointer"
                    title="Xóa thông báo"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  {item.actionUrl && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleClickItem(item);
                      }}
                    >
                      <span>{item.actionLabel || 'Xử lý ngay'}</span>
                      <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer Info */}
      <div className="text-[11px] text-ink-muted text-center pt-2 space-y-1">
        <div>Tắt thông báo không làm mất việc khỏi trang <strong>"Cần làm"</strong>.</div>
        <div>Badge số việc luôn đồng bộ theo thời gian thực.</div>
      </div>

      {/* Modal: Tạo Thông Báo Mới Vào DB */}
      {isCreateModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsCreateModalOpen(false)}
          title="Tạo Thông Báo Mới (Lưu vào Database)"
        >
          <div className="space-y-3.5 text-xs">
            <div>
              <label className="block text-ink font-semibold mb-1">Tiêu đề thông báo *</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Ví dụ: Nhắc nhở chấm công, duyệt đơn..."
                className="w-full p-2.5 rounded-lg border border-line bg-surface text-ink text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-ink font-semibold mb-1">Nội dung chi tiết</label>
              <textarea
                rows={2}
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="Nội dung gửi đến người nhận..."
                className="w-full p-2.5 rounded-lg border border-line bg-surface text-ink text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-ink font-semibold mb-1">Loại thông báo</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-line bg-surface text-ink text-xs"
                >
                  <option value="ATTENDANCE">Chấm công (ATTENDANCE)</option>
                  <option value="REQUEST">Đơn từ (REQUEST)</option>
                  <option value="OKR">OKR Mục tiêu</option>
                  <option value="SYSTEM">Hệ thống (SYSTEM)</option>
                </select>
              </div>

              <div>
                <label className="block text-ink font-semibold mb-1">Mức độ ưu tiên</label>
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-line bg-surface text-ink text-xs"
                >
                  <option value="HIGH">Khẩn cấp (HIGH - Urgent)</option>
                  <option value="MEDIUM">Cảnh báo (MEDIUM - Warn)</option>
                  <option value="LOW">Thông tin (LOW - Info)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-ink font-semibold mb-1">Đường dẫn hành động (Action URL)</label>
              <input
                type="text"
                value={newActionUrl}
                onChange={(e) => setNewActionUrl(e.target.value)}
                placeholder="/todo, /attendance/checkin, ..."
                className="w-full p-2 rounded-lg border border-line bg-surface text-ink text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-line">
              <Button variant="outline" size="sm" onClick={() => setIsCreateModalOpen(false)}>
                Hủy bỏ
              </Button>
              <Button variant="primary" size="sm" onClick={handleCreateNotification}>
                Lưu &amp; Gửi Thông Báo
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
