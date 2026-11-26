import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { useAuth } from '../../../context/AuthContext';
import {
  disablePushOnThisDevice,
  enablePushOnThisDevice,
  isPushSupported,
} from '../../../utils/push';
import {
  Bell,
  Moon,
  CheckCircle2,
  RotateCcw,
  Inbox,
  UserCheck,
  Mail,
  Smartphone,
  Globe
} from 'lucide-react';

interface EventPref {
  label: string;
  category: string;
  web: boolean;
  email: boolean;
  push: boolean;
  roles?: string[];
}

interface NotificationPreferences {
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  maxPushPerDay: number;
  dedupeHours: number;
  personalTasksCount: number;
  approvalTasksCount: number;
  events: Record<string, EventPref>;
}

export const NotificationPrefsPage: React.FC = () => {
  const { user } = useAuth();

  const [prefs, setPrefs] = useState<NotificationPreferences>({
    quietHoursEnabled: true,
    quietHoursStart: '21:00',
    quietHoursEnd: '07:00',
    maxPushPerDay: 3,
    dedupeHours: 12,
    personalTasksCount: 0,
    approvalTasksCount: 0,
    events: {},
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const previousStateRef = useRef<NotificationPreferences | null>(null);

  // Load user's preferences from backend
  useEffect(() => {
    fetch('/api/v1/notifications/preferences')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data) {
          // Server đã lọc theo vai trò của người dùng — thay toàn bộ, không trộn
          // với danh sách cũ để không hiện sự kiện không áp dụng.
          setPrefs((prev) => ({
            ...prev,
            ...data.data,
            events: data.data.events || {},
          }));
        }
      })
      .catch(() => {});
  }, []);

  // ── Web Push trên thiết bị này (S36) ─────────────────────────────────────
  const pushSupported = isPushSupported();
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMsg, setPushMsg] = useState<string | null>(null);
  const [pushPublicKey, setPushPublicKey] = useState<string | null>(null);
  const [pushOnThisDevice, setPushOnThisDevice] = useState(false);
  const [pushDeviceCount, setPushDeviceCount] = useState(0);

  const loadPushState = async () => {
    try {
      const [pkRes, subsRes] = await Promise.all([
        fetch('/api/v1/notifications/push/public-key'),
        fetch('/api/v1/notifications/push/subscriptions'),
      ]);
      const pk = (await pkRes.json())?.data;
      setPushPublicKey(pk?.enabled ? pk.publicKey : null);
      const subs = (await subsRes.json())?.data || [];
      setPushDeviceCount(subs.length);
      if (pushSupported) {
        const reg = await navigator.serviceWorker.getRegistration('/');
        const sub = await reg?.pushManager.getSubscription();
        setPushOnThisDevice(!!sub && subs.some((s: any) => s.endpoint === sub.endpoint));
      }
    } catch {
      // Không chặn trang nếu push chưa cấu hình.
    }
  };

  useEffect(() => {
    loadPushState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEnablePush = async () => {
    setPushMsg(null);
    if (!pushSupported) {
      setPushMsg('Trình duyệt này không hỗ trợ Web Push.');
      return;
    }
    if (!pushPublicKey) {
      setPushMsg('Máy chủ chưa cấu hình VAPID cho Web Push.');
      return;
    }
    setPushBusy(true);
    try {
      await enablePushOnThisDevice();
      setPushOnThisDevice(true);
      setPushMsg('Đã bật thông báo đẩy trên thiết bị này.');
      loadPushState();
    } catch (e: any) {
      setPushMsg(e?.message || 'Không bật được thông báo đẩy.');
    } finally {
      setPushBusy(false);
    }
  };

  const handleDisablePush = async () => {
    setPushMsg(null);
    setPushBusy(true);
    try {
      await disablePushOnThisDevice();
      setPushOnThisDevice(false);
      setPushMsg('Đã tắt thông báo đẩy trên thiết bị này.');
      loadPushState();
    } catch (e: any) {
      setPushMsg(e?.message || 'Không tắt được thông báo đẩy.');
    } finally {
      setPushBusy(false);
    }
  };

  const showToastWithUndo = (msg: string, prevState: NotificationPreferences) => {
    previousStateRef.current = prevState;
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 5000);
  };

  const saveToBackend = (updated: NotificationPreferences, prevState: NotificationPreferences) => {
    fetch('/api/v1/notifications/preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    }).catch(() => {});
    showToastWithUndo('Đã lưu cài đặt thông báo (Có hiệu lực từ thông báo kế tiếp)', prevState);
  };

  const handleToggleEventChannel = (eventKey: string, channel: 'web' | 'email' | 'push') => {
    const prevState = JSON.parse(JSON.stringify(prefs));
    setPrefs((prev) => {
      const currentEv = prev.events[eventKey];
      if (!currentEv) return prev;
      const updated = {
        ...prev,
        events: {
          ...prev.events,
          [eventKey]: {
            ...currentEv,
            [channel]: !currentEv[channel],
          },
        },
      };
      saveToBackend(updated, prevState);
      return updated;
    });
  };

  const handleToggleQuietHours = () => {
    const prevState = JSON.parse(JSON.stringify(prefs));
    setPrefs((prev) => {
      const updated = { ...prev, quietHoursEnabled: !prev.quietHoursEnabled };
      saveToBackend(updated, prevState);
      return updated;
    });
  };

  const handleChangeQuietTime = (field: 'quietHoursStart' | 'quietHoursEnd', val: string) => {
    const prevState = JSON.parse(JSON.stringify(prefs));
    setPrefs((prev) => {
      const updated = { ...prev, [field]: val };
      saveToBackend(updated, prevState);
      return updated;
    });
  };

  const handleChangeNumber = (field: 'maxPushPerDay' | 'dedupeHours', raw: string) => {
    const parsed = Number(raw);
    const n = Number.isFinite(parsed) ? Math.max(0, Math.min(50, Math.trunc(parsed))) : 0;
    const prevState = JSON.parse(JSON.stringify(prefs));
    setPrefs((prev) => {
      const updated = { ...prev, [field]: n };
      saveToBackend(updated, prevState);
      return updated;
    });
  };

  const handleUndo = () => {
    if (previousStateRef.current) {
      const restored = previousStateRef.current;
      setPrefs(restored);
      fetch('/api/v1/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(restored),
      }).catch(() => {});
      setToastMessage('Đã hoàn tác thay đổi cài đặt!');
      previousStateRef.current = null;
    }
  };

  // Group events by category
  const attendanceEvents = Object.entries(prefs.events).filter(([_, e]) => e.category === 'ATTENDANCE');
  const requestEvents = Object.entries(prefs.events).filter(([_, e]) => e.category === 'REQUEST');
  const okrEvents = Object.entries(prefs.events).filter(([_, e]) => e.category === 'OKR');
  const systemEvents = Object.entries(prefs.events).filter(([_, e]) => e.category === 'TIMESHEET' || e.category === 'SYSTEM');

  const roleHint = (roles?: string[]) => {
    const extra = (roles || []).filter((r) => r !== 'EMPLOYEE');
    if (extra.length === 0) return null;
    return extra.map((r) => (r === 'MANAGER' ? 'Quản lý' : r === 'HR' ? 'HR' : r)).join(' · ');
  };

  const renderEventRow = ([key, item]: [string, EventPref]) => (
    <div
      key={key}
      className="flex flex-col items-start justify-between gap-2.5 border-b border-line-soft px-4 py-3 last:border-b-0 sm:flex-row sm:items-center"
    >
      <div className="min-w-0 pr-2">
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-ink">
          {item.label}
          {roleHint(item.roles) && (
            <span className="rounded border border-accent-line bg-accent-soft px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-accent-dark">
              {roleHint(item.roles)}
            </span>
          )}
        </div>
        <div className="mt-0.5 font-mono text-[10px] text-ink-muted">{key}</div>
      </div>

      <div className="flex shrink-0 items-center gap-4">
        {/* Web In-App Toggle */}
        <label className="flex cursor-pointer items-center gap-1.5 text-xs" title="Thông báo trên thanh Header web">
          <input
            type="checkbox"
            checked={item.web}
            onChange={() => handleToggleEventChannel(key, 'web')}
            className="h-3.5 w-3.5 rounded border-line text-accent focus:ring-accent"
          />
          <span className="flex items-center gap-1 text-[11px] text-ink-secondary">
            <Globe className="h-3 w-3 text-accent" /> Web
          </span>
        </label>

        {/* Email Digest Toggle */}
        <label className="flex cursor-pointer items-center gap-1.5 text-xs" title="Gom vào Email digest 08:00 sáng">
          <input
            type="checkbox"
            checked={item.email}
            onChange={() => handleToggleEventChannel(key, 'email')}
            className="h-3.5 w-3.5 rounded border-line text-accent focus:ring-accent"
          />
          <span className="flex items-center gap-1 text-[11px] text-ink-secondary">
            <Mail className="h-3 w-3 text-status-info" /> Email
          </span>
        </label>

        {/* Web Push Toggle */}
        <label className="flex cursor-pointer items-center gap-1.5 text-xs" title="Thông báo đẩy trình duyệt Web Push tức thì">
          <input
            type="checkbox"
            checked={item.push}
            onChange={() => handleToggleEventChannel(key, 'push')}
            className="h-3.5 w-3.5 rounded border-line text-accent focus:ring-accent"
          />
          <span className="flex items-center gap-1 text-[11px] text-ink-secondary">
            <Smartphone className="h-3 w-3 text-status-warn" /> Push
          </span>
        </label>
      </div>
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-4xl space-y-3.5 px-3 pb-16 sm:px-4">
      {/* Đầu trang — mockup `.phead` */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-accent-dark">
            <Bell className="h-3.5 w-3.5" />
            Tuỳ chỉnh cá nhân
          </div>
          <h1 className="mt-1.5 font-display text-xl font-extrabold tracking-tight text-ink sm:text-[23px]">
            Tuỳ chỉnh thông báo
          </h1>
          <p className="mt-1 text-xs text-ink-muted">
            Tắt thông báo mình không quan tâm, giữ lại cái mình cần.{' '}
            <strong className="text-ink-secondary">Tắt thông báo không làm mất việc</strong> — mọi công việc
            vẫn nằm nguyên trong trang Cần làm.
          </p>
        </div>
        <Badge variant="accent" className="shrink-0">Tự động lưu ngay · Hiệu lực tức thì</Badge>
      </div>

      {/* STATS BANNER: Số việc chờ theo nhóm (Criteria G4-#6) */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <Link
          to="/todo"
          className="flex items-center justify-between gap-3 rounded-[13px] border border-line bg-surface p-3 shadow-2xs transition-colors hover:border-accent-line hover:bg-accent-soft/40"
          title="Mở trang Cần làm"
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-accent-line bg-accent-soft text-accent-dark">
              <Inbox className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] text-ink-muted">Việc của tôi (Personal Actions)</div>
              <div className="text-sm font-bold text-ink">{prefs.personalTasksCount} việc đang chờ</div>
            </div>
          </div>
          <Badge variant="ok" className="shrink-0">Đang hoạt động</Badge>
        </Link>

        <Link
          to="/attendance/approvals"
          className="flex items-center justify-between gap-3 rounded-[13px] border border-line bg-surface p-3 shadow-2xs transition-colors hover:border-status-info-line hover:bg-status-info-soft/40"
          title="Mở trang Duyệt đơn"
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-status-info-line bg-status-info-soft text-status-info">
              <UserCheck className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] text-ink-muted">Việc tôi phụ trách (Approvals)</div>
              <div className="text-sm font-bold text-ink">{prefs.approvalTasksCount} việc cần duyệt</div>
            </div>
          </div>
          <Badge variant="accent" className="shrink-0">Quản lý / HR</Badge>
        </Link>
      </div>

      {/* TOAST WITH 1-CLICK UNDO (Criteria G4-#7) */}
      {toastMessage && (
        <div className="flex animate-in fade-in flex-col items-start justify-between gap-2 rounded-xl border border-status-ok-line bg-status-ok-soft p-3.5 text-xs font-semibold text-status-ok shadow-xs sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-status-ok" />
            <span>{toastMessage}</span>
          </div>
          {previousStateRef.current && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="font-bold"
              onClick={handleUndo}
            >
              <RotateCcw className="h-3 w-3" />
              Hoàn tác (Undo)
            </Button>
          )}
        </div>
      )}

      {/* CARD 1: GIỜ YÊN LẶNG (QUIET HOURS - Criteria G4-#3 & G4-#5) */}
      <Panel title="Khung giờ yên lặng" subtitle="Chống spam — không gửi Web Push trong khung giờ nghỉ">
        <div className="space-y-3.5 text-xs">
          <div className="flex flex-col items-start justify-between gap-3 rounded-xl border border-line bg-canvas p-3.5 sm:flex-row sm:items-center">
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2 text-sm font-bold text-ink">
                <Moon className="h-4 w-4 shrink-0 text-status-warn" />
                Bật chế độ Giờ Yên Lặng ({prefs.quietHoursStart} – {prefs.quietHoursEnd})
              </div>
              <p className="max-w-xl leading-relaxed text-ink-muted">
                Không gửi Web Push trong khoảng thời gian nghỉ ngơi.{' '}
                <strong className="text-ink-secondary">Việc quá hạn vẫn nổi badge đếm số</strong> trên menu và
                được gom vào email digest lúc 08:00 sáng hôm sau.
              </p>
            </div>
            <label className="relative inline-flex shrink-0 cursor-pointer items-center">
              <input
                type="checkbox"
                checked={prefs.quietHoursEnabled}
                onChange={handleToggleQuietHours}
                className="sr-only peer"
                aria-label="Bật chế độ giờ yên lặng"
              />
              <div className="w-11 h-6 bg-line peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-line-hover after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-status-ok" />
            </label>
          </div>

          {prefs.quietHoursEnabled && (
            <div className="grid grid-cols-1 gap-3 rounded-xl border border-line bg-surface p-3 text-xs sm:grid-cols-2">
              <div>
                <label htmlFor="qh-start" className="mb-1 block font-medium text-ink-muted">Bắt đầu giờ yên lặng:</label>
                <input
                  id="qh-start"
                  type="text"
                  value={prefs.quietHoursStart}
                  onChange={(e) => handleChangeQuietTime('quietHoursStart', e.target.value)}
                  className="w-full rounded-[10px] border border-line bg-canvas p-2 font-mono text-ink focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/20"
                  placeholder="21:00"
                />
              </div>
              <div>
                <label htmlFor="qh-end" className="mb-1 block font-medium text-ink-muted">Kết thúc giờ yên lặng:</label>
                <input
                  id="qh-end"
                  type="text"
                  value={prefs.quietHoursEnd}
                  onChange={(e) => handleChangeQuietTime('quietHoursEnd', e.target.value)}
                  className="w-full rounded-[10px] border border-line bg-canvas p-2 font-mono text-ink focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/20"
                  placeholder="07:00"
                />
              </div>
            </div>
          )}

          <div className="flex flex-col items-start justify-between gap-2 pt-0.5 text-[11px] text-ink-muted sm:flex-row sm:items-center">
            <label className="flex items-center gap-1.5">
              Giới hạn push tối đa:
              <input
                type="number"
                min={0}
                max={50}
                value={prefs.maxPushPerDay}
                onChange={(e) => handleChangeNumber('maxPushPerDay', e.target.value)}
                className="w-16 rounded border border-line bg-canvas p-1 text-center font-mono text-ink focus:border-accent focus:outline-none"
                aria-label="Số lượt push tối đa mỗi ngày"
              />
              lượt push/ngày
            </label>
            <label className="flex items-center gap-1.5">
              Cửa sổ chống trùng (Dedupe):
              <input
                type="number"
                min={0}
                max={50}
                value={prefs.dedupeHours}
                onChange={(e) => handleChangeNumber('dedupeHours', e.target.value)}
                className="w-16 rounded border border-line bg-canvas p-1 text-center font-mono text-ink focus:border-accent focus:outline-none"
                aria-label="Số giờ chống trùng thông báo"
              />
              giờ
            </label>
          </div>
        </div>
      </Panel>

      {/* Thiết bị nhận Web Push (S36) */}
      <Panel title="Thông báo đẩy trên thiết bị này" subtitle="Nhận thông báo ngay cả khi không mở tab ACT HR">
        <div className="space-y-2.5 text-xs">
          <p className="leading-relaxed text-ink-secondary">
            Bật Web Push để nhận thông báo ngay cả khi không mở tab ACT HR.
            Trong giờ yên lặng hoặc khi vượt hạn mức push/ngày, thông báo được dồn vào email digest 08:00.
          </p>
          <div className="flex flex-col items-start justify-between gap-3 rounded-xl border border-line bg-canvas p-3 sm:flex-row sm:items-center">
            <div className="flex min-w-0 items-center gap-2.5">
              <Smartphone className="h-4 w-4 shrink-0 text-status-warn" />
              <div className="min-w-0">
                <div className="font-semibold text-ink">
                  {pushOnThisDevice ? 'Thiết bị này đang nhận thông báo đẩy' : 'Thiết bị này chưa bật thông báo đẩy'}
                </div>
                <div className="text-[11px] text-ink-muted">
                  {pushDeviceCount} thiết bị đã đăng ký nhận push
                </div>
              </div>
            </div>
            <Button
              size="sm"
              variant={pushOnThisDevice ? 'outline' : 'primary'}
              disabled={pushBusy || !pushSupported || (!pushOnThisDevice && !pushPublicKey)}
              onClick={pushOnThisDevice ? handleDisablePush : handleEnablePush}
              className="shrink-0"
            >
              {pushBusy ? 'Đang xử lý…' : pushOnThisDevice ? 'Tắt trên thiết bị này' : 'Bật thông báo đẩy'}
            </Button>
          </div>
          {!pushSupported && (
            <div className="rounded-lg border border-status-warn-line bg-status-warn-soft p-2 text-[11px] text-status-warn">
              Trình duyệt này không hỗ trợ Web Push — thông báo trong ứng dụng và email vẫn hoạt động.
            </div>
          )}
          {pushMsg && (
            <div className="rounded-lg border border-line bg-surface p-2 text-[11px] text-ink-secondary">{pushMsg}</div>
          )}
        </div>
      </Panel>

      {/* CARD 2: BẬT/TẮT THEO TỪNG LOẠI SỰ KIỆN × KÊNH (Criteria G4-#1 & G4-#2) */}
      <div className="space-y-3">
        <div className="flex items-center gap-1.5 text-[9.5px] font-extrabold uppercase tracking-[0.07em] text-ink-muted">
          <Bell className="h-3.5 w-3.5" />
          Ma trận {Object.keys(prefs.events).length} sự kiện × 3 kênh thông báo
        </div>
        <p className="-mt-1 text-[11px] text-ink-muted">
          Chỉ hiển thị sự kiện áp dụng cho vai trò của bạn (Nhân viên · Quản lý · HR). Đổi vai trò
          sẽ thấy thêm sự kiện tương ứng; cấu hình cũ được giữ nguyên.
        </p>

        {/* Nhóm 1: Chấm công */}
        <Panel title="Phân hệ Chấm công & Ca làm việc">
          <div className="-mx-4">
            {attendanceEvents.map(renderEventRow)}
          </div>
        </Panel>

        {/* Nhóm 2: Đơn từ & Phép */}
        <Panel title="Phân hệ Đơn từ & Nghỉ phép">
          <div className="-mx-4">
            {requestEvents.map(renderEventRow)}
          </div>
        </Panel>

        {/* Nhóm 3: OKR */}
        <Panel title="Phân hệ Mục tiêu & Đánh giá OKR">
          <div className="-mx-4">
            {okrEvents.map(renderEventRow)}
          </div>
        </Panel>

        {/* Nhóm 4: Bảng công & Quản trị */}
        <Panel title="Bảng công & Quản trị hệ thống">
          <div className="-mx-4">
            {systemEvents.map(renderEventRow)}
          </div>
        </Panel>
      </div>
    </div>
  );
};

/**
 * Panel dùng chung — header tiêu đề + mô tả, thân padding 14–16px. Khác `Card` cũ ở
 * chỗ viền bo 13px và header tách viền, khớp mockup `.panel`.
 */
const Panel: React.FC<{
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}> = ({ title, subtitle, children }) => (
  <div className="overflow-hidden rounded-[13px] border border-line bg-surface shadow-2xs">
    <div className="border-b border-line px-4 py-3">
      <div className="text-[13.5px] font-bold tracking-[-0.01em] text-ink">{title}</div>
      {subtitle && <div className="mt-0.5 text-[11px] text-ink-muted">{subtitle}</div>}
    </div>
    <div className="p-4">{children}</div>
  </div>
);
