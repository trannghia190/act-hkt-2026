import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ArrowRight, BellRing, Inbox, Settings, Search, Trash2 } from 'lucide-react';
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
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [eventLabels, setEventLabels] = useState<Record<string, string>>({});
  const [categoryOptions, setCategoryOptions] = useState<{ key: string; label: string }[]>([]);
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
          const categories: { key: string; label: string }[] = [];
          const seen = new Set<string>();
          data.data.forEach((e: any) => {
            if (e.key) labels[e.key] = e.label || e.key;
            if (e.category && !seen.has(e.category)) {
              seen.add(e.category);
              categories.push({ key: e.category, label: e.categoryLabel || e.category });
            }
          });
          setEventLabels(labels);
          setCategoryOptions(categories);
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
    if (categoryFilter !== 'ALL') params.set('category', categoryFilter);
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
  }, [activeFilter, categoryFilter, debouncedSearch]);

  const loadMore = () => {
    if (loading || !hasMore) return;
    const nextPage = page + 1;
    const params = new URLSearchParams({
      page: String(nextPage),
      size: String(PAGE_SIZE),
      unread: String(activeFilter === 'UNREAD'),
    });
    if (categoryFilter !== 'ALL') params.set('category', categoryFilter);
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

  return (
    <div className="mx-auto w-full max-w-5xl space-y-3.5 px-3 pb-12 sm:px-4">
      {/* Đầu trang — mockup `.phead` */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-accent-dark">
            <BellRing className="h-3.5 w-3.5" />
            Trung tâm thông báo
          </div>
          <h1 className="mt-1.5 font-display text-xl font-extrabold tracking-tight text-ink sm:text-[23px]">
            Thông báo &amp; nhắc việc
          </h1>
          <p className="mt-1 text-xs text-ink-muted">
            Hệ thống gửi tự động qua 3 kênh: Trong web · Email digest 08:00 · Web Push
          </p>
        </div>

        <Button
          variant="outline"
          size="md"
          onClick={() => navigate('/account/notifications')}
          className="shrink-0"
        >
          <Settings className="h-3.5 w-3.5" />
          Cài đặt thông báo
        </Button>
      </div>

      {/* Toast Notification */}
      {toastMsg && (
        <div className="flex animate-in fade-in items-center gap-2 rounded-xl border border-status-ok-line bg-status-ok-soft p-3 text-xs font-semibold text-status-ok shadow-2xs">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-status-ok" />
          {toastMsg}
        </div>
      )}

      {/* Bộ lọc — tìm kiếm + nhóm sự kiện */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo tiêu đề, nội dung..."
            aria-label="Tìm thông báo"
            className="w-full rounded-[10px] border border-line bg-surface py-2 pl-8 pr-3 text-xs text-ink focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/20"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="w-full cursor-pointer rounded-[10px] border border-line bg-surface px-3 py-2 text-xs text-ink focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/20 sm:w-56"
          title="Lọc theo nhóm sự kiện"
          aria-label="Lọc theo nhóm sự kiện"
        >
          <option value="ALL">Tất cả nhóm sự kiện</option>
          {categoryOptions.map((opt) => (
            <option key={opt.key} value={opt.key}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Chip lọc trạng thái + Đọc tất cả */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="-mx-3 flex gap-2 overflow-x-auto px-3 sm:mx-0 sm:px-0">
          <button
            type="button"
            onClick={() => setActiveFilter('ALL')}
            aria-pressed={activeFilter === 'ALL'}
            className={`inline-flex h-[31px] shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-semibold transition-colors ${
              activeFilter === 'ALL'
                ? 'border-ink bg-ink text-canvas'
                : 'border-line bg-surface text-ink-secondary hover:border-line-hover'
            }`}
          >
            Tất cả
            <span className="font-mono text-[10.5px] opacity-65">{totalCount}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('UNREAD')}
            aria-pressed={activeFilter === 'UNREAD'}
            className={`inline-flex h-[31px] shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-semibold transition-colors ${
              activeFilter === 'UNREAD'
                ? 'border-ink bg-ink text-canvas'
                : 'border-line bg-surface text-ink-secondary hover:border-line-hover'
            }`}
          >
            Chưa đọc
            <span className="font-mono text-[10.5px] opacity-65">{unreadCount}</span>
          </button>
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="ml-auto cursor-pointer text-[11.5px] font-semibold text-accent hover:underline"
          >
            Đọc tất cả
          </button>
        )}
      </div>

      {/* Danh sách thông báo */}
      <div className="grid gap-2.5 md:grid-cols-2">
        {loading && items.length === 0 ? (
          <div className="rounded-[13px] border border-line bg-surface p-10 text-center text-xs text-ink-muted shadow-2xs md:col-span-2">
            Đang tải thông báo…
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-[13px] border border-line bg-surface p-10 text-center shadow-2xs md:col-span-2">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-status-ok-soft text-status-ok">
              <Inbox className="h-5 w-5" />
            </div>
            <div className="mt-3 text-[13px] font-semibold text-ink">Hộp thông báo trống</div>
            <p className="mt-1 text-xs text-ink-muted">Bạn đã đọc hết mọi thông báo và nhắc việc.</p>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              onClick={() => handleClickItem(item)}
              className={`flex min-w-0 cursor-pointer flex-col gap-2 rounded-[13px] border bg-surface p-3.5 shadow-2xs transition-colors hover:border-line-hover ${
                !item.read
                  ? item.kind === 'urgent'
                    ? 'border-status-danger-line bg-status-danger-soft/40'
                    : item.kind === 'warn'
                      ? 'border-status-warn-line bg-status-warn-soft/40'
                      : 'border-accent-line bg-accent-soft/30'
                  : 'border-line opacity-75'
              }`}
            >
              <div className="flex min-w-0 items-start gap-2">
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                    item.read
                      ? 'bg-ink-muted'
                      : item.kind === 'urgent'
                        ? 'bg-status-danger'
                        : item.kind === 'warn'
                          ? 'bg-status-warn'
                          : 'bg-accent'
                  }`}
                />
                {/* min-w-0 để tiêu đề dài xuống dòng thay vì đẩy card ra ngoài lưới */}
                <h3 className="min-w-0 break-words text-[12.5px] font-bold leading-tight text-ink">{item.title}</h3>
                <span className="ml-auto shrink-0 whitespace-nowrap font-mono text-[10px] text-ink-muted">{item.timestamp}</span>
              </div>

              <p className="break-words pl-4 text-[11.5px] leading-relaxed text-ink-secondary">{item.detail}</p>

              <div className="flex min-w-0 items-center justify-between gap-2 border-t border-line-soft pl-4 pt-2">
                <span className="min-w-0 truncate font-mono text-[10px] text-ink-muted">
                  # {eventLabels[item.eventKey] || LEGACY_TYPE_LABELS[item.eventKey] || item.eventKey}
                </span>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={(e) => handleDeleteNotification(item.id, e)}
                    className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border border-line text-ink-muted transition-colors hover:border-status-danger-line hover:text-status-danger"
                    title="Xoá thông báo"
                    aria-label={`Xoá thông báo: ${item.title}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
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
                      {item.actionLabel || 'Xử lý ngay'}
                      <ArrowRight className="h-3 w-3" />
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
      <div className="pt-1 text-center text-[11px] text-ink-muted">
        Tắt thông báo không làm mất việc khỏi trang <strong className="text-ink-secondary">Cần làm</strong> —
        badge số việc luôn đồng bộ theo thời gian thực.
      </div>
    </div>
  );
};
