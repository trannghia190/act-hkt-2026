import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ArrowRight, Settings, Search, Trash2 } from 'lucide-react';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';

interface MobileNotifItem {
  id: string;
  title: string;
  detail: string;
  kind: 'urgent' | 'warn' | 'ok' | 'info';
  timestamp: string;
  read: boolean;
  actionUrl?: string;
  actionLabel?: string;
  eventKey: string;
}

/** Nhãn cho các thông báo cũ chưa có eventKey (chỉ có type). */
const LEGACY_TYPE_LABELS: Record<string, string> = {
  ATTENDANCE: 'Chấm công',
  REQUEST: 'Đơn từ',
  OKR: 'OKR',
  DISPUTE: 'Khiếu nại bảng công',
  ONBOARDING: 'Onboarding',
  SYSTEM: 'Hệ thống',
};

/** Hiển thị thời gian gọn: 23/11 16:50. */
const formatTime = (raw?: string) => {
  if (!raw) return 'Vừa xong';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())} ${pad(date.getDate())}/${pad(date.getMonth() + 1)}`;
};

const PAGE_SIZE = 30;

const mapNotification = (d: any): MobileNotifItem => ({
  id: d.id,
  title: d.title,
  detail: d.message || d.content || d.title,
  kind: d.level === 'urgent' ? 'urgent' : d.level === 'warning' ? 'warn' : 'info',
  timestamp: formatTime(d.timestamp || d.createdAt),
  read: !!d.read,
  actionUrl: d.actionUrl,
  actionLabel: 'Xử lý ngay',
  eventKey: d.eventKey || d.type || 'OTHER',
});

const headerNumber = (res: Response, name: string): number => {
  const value = Number(res.headers.get(name));
  return Number.isFinite(value) ? value : 0;
};

export const MobileNotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'UNREAD'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [eventFilter, setEventFilter] = useState('ALL');
  const [eventLabels, setEventLabels] = useState<Record<string, string>>({});
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [items, setItems] = useState<MobileNotifItem[]>([]);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);

  // Gõ tìm kiếm → đợi 300ms rồi mới gọi server (tránh bắn request mỗi ký tự).
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Danh mục sự kiện để dựng bộ lọc (không phụ thuộc trang đang tải).
  useEffect(() => {
    fetch('/api/v1/notifications/preferences/events')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data)) {
          const labels: Record<string, string> = {};
          data.data.forEach((e: any) => {
            if (e.key) labels[e.key] = e.label || e.key;
          });
          setEventLabels(labels);
        }
      })
      .catch(() => {});
  }, []);

  // Đổi tab/lọc/từ khoá → tải lại từ trang 0 phía server.
  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({
      page: '0',
      size: String(PAGE_SIZE),
      unread: String(activeFilter === 'UNREAD'),
    });
    if (eventFilter !== 'ALL') params.set('eventKey', eventFilter);
    if (debouncedSearch) params.set('q', debouncedSearch);

    setLoading(true);
    fetch(`/api/v1/notifications?${params.toString()}`)
      .then(async (res) => {
        const total = headerNumber(res, 'X-Total-Count');
        const unread = headerNumber(res, 'X-Unread-Count');
        const more = res.headers.get('X-Has-More') === 'true';
        const data = await res.json();
        return { data, total, unread, more };
      })
      .then(({ data, total, unread, more }) => {
        if (cancelled) return;
        setItems(data.success && Array.isArray(data.data) ? data.data.map(mapNotification) : []);
        setPage(0);
        setTotalCount(total);
        setUnreadCount(unread);
        setHasMore(more);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeFilter, eventFilter, debouncedSearch]);

  const loadMore = () => {
    if (loading || !hasMore) return;
    const nextPage = page + 1;
    const params = new URLSearchParams({
      page: String(nextPage),
      size: String(PAGE_SIZE),
      unread: String(activeFilter === 'UNREAD'),
    });
    if (eventFilter !== 'ALL') params.set('eventKey', eventFilter);
    if (debouncedSearch) params.set('q', debouncedSearch);

    setLoading(true);
    fetch(`/api/v1/notifications?${params.toString()}`)
      .then(async (res) => {
        const unread = headerNumber(res, 'X-Unread-Count');
        const more = res.headers.get('X-Has-More') === 'true';
        const data = await res.json();
        return { data, unread, more };
      })
      .then(({ data, unread, more }) => {
        if (data.success && Array.isArray(data.data)) {
          const mapped = data.data.map(mapNotification);
          setItems((prev) => {
            const seen = new Set(prev.map((i) => i.id));
            return [...prev, ...mapped.filter((i) => !seen.has(i.id))];
          });
        }
        setPage(nextPage);
        setUnreadCount(unread);
        setHasMore(more);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleMarkAllRead = () => {
    fetch('/api/v1/notifications/mark-all-read', { method: 'PUT' }).catch(() => {});
    setUnreadCount(0);
    if (activeFilter === 'UNREAD') {
      setItems([]);
      setTotalCount(0);
      setHasMore(false);
    } else {
      setItems((prev) => prev.map((i) => ({ ...i, read: true })));
    }
    showToast('Đã đánh dấu đã đọc tất cả');
  };

  const handleClickItem = (item: MobileNotifItem) => {
    fetch(`/api/v1/notifications/${item.id}/read`, { method: 'PUT' }).catch(() => {});
    if (!item.read) setUnreadCount((prev) => Math.max(0, prev - 1));
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, read: true } : i)));
    if (item.actionUrl) {
      navigate(item.actionUrl);
    }
  };

  const handleDeleteNotification = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const target = items.find((i) => i.id === id);
    fetch(`/api/v1/notifications/${id}`, { method: 'DELETE' }).catch(() => {});
    setItems((prev) => prev.filter((i) => i.id !== id));
    setTotalCount((prev) => Math.max(0, prev - 1));
    if (target && !target.read) setUnreadCount((prev) => Math.max(0, prev - 1));
    showToast('Đã xóa thông báo thành công');
  };

  // Bộ lọc sự kiện lấy từ danh mục chuẩn, không phụ thuộc trang đang tải.
  const eventOptions = useMemo(() => {
    return Object.entries(eventLabels)
      .map(([key, label]) => ({ key, label: label || LEGACY_TYPE_LABELS[key] || key }))
      .sort((a, b) => a.label.localeCompare(b.label, 'vi'));
  }, [eventLabels]);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-3 pb-12 sm:px-4 lg:max-w-5xl">
      {/* Top Banner (Mockup S04m) */}
      <div className="bg-canvas border border-line rounded-2xl p-4 sm:p-5 shadow-2xs space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <Badge variant="accent">Trung tâm thông báo</Badge>
          <button
            type="button"
            onClick={() => navigate('/account/notifications')}
            className="text-xs text-ink-muted hover:text-accent flex items-center gap-1 cursor-pointer font-medium shrink-0"
          >
            <Settings className="w-3.5 h-3.5" />
            Cài đặt
          </button>
        </div>
        <h1 className="text-lg sm:text-xl font-bold text-ink">Thông Báo &amp; Nhắc Việc</h1>
        <p className="text-xs sm:text-sm text-ink-muted leading-relaxed">
          Thông báo được hệ thống gửi tự động qua 3 kênh: Trong web · Email digest 08:00 · Web Push.
        </p>
      </div>

      {/* Toast Notification */}
      {toastMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold animate-in fade-in flex items-center gap-2 shadow-2xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-700" />
          {toastMsg}
        </div>
      )}

      {/* Search Bar & Event Filter */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo tiêu đề, nội dung..."
            className="w-full pl-8 pr-3 py-2 text-xs bg-surface border border-line rounded-lg text-ink focus:outline-none focus:border-accent"
          />
        </div>
        <select
          value={eventFilter}
          onChange={(e) => setEventFilter(e.target.value)}
          className="w-full sm:w-64 px-3 py-2 text-xs bg-surface border border-line rounded-lg text-ink focus:outline-none focus:border-accent cursor-pointer"
          title="Lọc theo sự kiện"
        >
          <option value="ALL">Tất cả sự kiện</option>
          {eventOptions.map((opt) => (
            <option key={opt.key} value={opt.key}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Filter Tabs & Quick Action */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
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
            Tất cả ({totalCount})
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
      <div className="space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
        {loading && items.length === 0 ? (
          <div className="p-10 text-center bg-surface border border-line rounded-2xl text-xs text-ink-muted shadow-2xs md:col-span-2">
            Đang tải thông báo…
          </div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center bg-surface border border-line rounded-2xl text-xs text-ink-muted space-y-2 shadow-2xs md:col-span-2">
            <div className="text-2xl">🎉</div>
            <div className="font-semibold text-ink">Hộp thông báo trống</div>
            <p>Bạn đã đọc hết mọi thông báo và nhắc việc.</p>
          </div>
        ) : (
          items.map((item) => (
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
                <span className="text-[10px] font-mono text-ink-muted">
                  # {eventLabels[item.eventKey] || LEGACY_TYPE_LABELS[item.eventKey] || item.eventKey}
                </span>
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

      {/* Phân trang: chỉ tải thêm khi người dùng cần */}
      {items.length > 0 && (
        <div className="flex flex-col items-center gap-2 pt-1 text-[11px] text-ink-muted">
          <span>Đã hiển thị {items.length}/{totalCount} thông báo</span>
          {hasMore && (
            <Button variant="outline" size="sm" onClick={loadMore} disabled={loading}>
              {loading ? 'Đang tải…' : 'Tải thêm'}
            </Button>
          )}
        </div>
      )}

      {/* Footer Info */}
      <div className="text-[11px] text-ink-muted text-center pt-2 space-y-1">
        <div>Tắt thông báo không làm mất việc khỏi trang <strong>"Cần làm"</strong>.</div>
        <div>Badge số việc luôn đồng bộ theo thời gian thực.</div>
      </div>

    </div>
  );
};
