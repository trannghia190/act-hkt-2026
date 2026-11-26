import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { Card } from '../../../components/common/Card';
import { useAuth } from '../../../context/AuthContext';
import {
  disablePushOnThisDevice,
  enablePushOnThisDevice,
  isPushSupported,
} from '../../../utils/push';
import {
  Bell,
  Moon,
  Clock,
  CheckCircle2,
  AlertTriangle,
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
    <div key={key} className="py-3 px-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line last:border-0 hover:bg-canvas/40 rounded-lg transition-colors">
      <div className="min-w-0 pr-2">
        <div className="text-xs font-semibold text-ink flex flex-wrap items-center gap-1.5">
          {item.label}
          {roleHint(item.roles) && (
            <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-accent-soft text-accent-dark border border-accent-line">
              {roleHint(item.roles)}
            </span>
          )}
        </div>
        <div className="text-[10px] text-ink-muted font-mono mt-0.5">{key}</div>
      </div>

      <div className="flex items-center gap-4 shrink-0">
        {/* Web In-App Toggle */}
        <label className="flex items-center gap-1.5 cursor-pointer text-xs" title="Thông báo trên thanh Header web">
          <input
            type="checkbox"
            checked={item.web}
            onChange={() => handleToggleEventChannel(key, 'web')}
            className="rounded border-line text-accent focus:ring-accent w-3.5 h-3.5"
          />
          <span className="text-[11px] text-ink-secondary flex items-center gap-1">
            <Globe className="w-3 h-3 text-accent" /> Web
          </span>
        </label>

        {/* Email Digest Toggle */}
        <label className="flex items-center gap-1.5 cursor-pointer text-xs" title="Gom vào Email digest 08:00 sáng">
          <input
            type="checkbox"
            checked={item.email}
            onChange={() => handleToggleEventChannel(key, 'email')}
            className="rounded border-line text-accent focus:ring-accent w-3.5 h-3.5"
          />
          <span className="text-[11px] text-ink-secondary flex items-center gap-1">
            <Mail className="w-3 h-3 text-status-info" /> Email
          </span>
        </label>

        {/* Web Push Toggle */}
        <label className="flex items-center gap-1.5 cursor-pointer text-xs" title="Thông báo đẩy trình duyệt Web Push tức thì">
          <input
            type="checkbox"
            checked={item.push}
            onChange={() => handleToggleEventChannel(key, 'push')}
            className="rounded border-line text-accent focus:ring-accent w-3.5 h-3.5"
          />
          <span className="text-[11px] text-ink-secondary flex items-center gap-1">
            <Smartphone className="w-3 h-3 text-status-warn" /> Push
          </span>
        </label>
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      {/* Header Banner (Mockup S36) */}
      <div className="bg-canvas border border-line rounded-2xl p-6 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <Badge variant="accent">Tất cả vai trò</Badge>
          <span className="text-[11px] text-ink-muted">Tự động lưu ngay · Hiệu lực tức thì</span>
        </div>
        <h1 className="text-xl font-bold tracking-tight text-ink">Tuỳ Chỉnh Thông Báo Cá Nhân</h1>
        <p className="text-xs text-ink-muted leading-relaxed">
          Tắt thông báo mình không quan tâm, giữ lại cái mình cần. <strong>Tắt thông báo KHÔNG làm mất việc</strong> — mọi công việc cần làm vẫn nằm nguyên trong Todo Inbox.
        </p>

        {/* STATS BANNER: Số việc chờ theo nhóm (Criteria G4-#6) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <Link
            to="/todo"
            className="p-3 bg-surface rounded-xl border border-line flex items-center justify-between shadow-2xs hover:border-accent-line hover:bg-accent-soft/40 transition-colors group"
            title="Mở Todo Inbox"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-accent-soft border border-accent-line flex items-center justify-center text-accent-dark">
                <Inbox className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[11px] text-ink-muted">Việc của tôi (Personal Actions)</div>
                <div className="text-sm font-bold text-ink">{prefs.personalTasksCount} việc đang chờ</div>
              </div>
            </div>
            <Badge variant="ok">Đang hoạt động</Badge>
          </Link>

          <Link
            to="/attendance/approvals"
            className="p-3 bg-surface rounded-xl border border-line flex items-center justify-between shadow-2xs hover:border-status-info-line hover:bg-status-info-soft/40 transition-colors group"
            title="Mở trang Duyệt đơn"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-status-info-soft border border-status-info-line flex items-center justify-center text-status-info">
                <UserCheck className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[11px] text-ink-muted">Việc tôi phụ trách (Approvals)</div>
                <div className="text-sm font-bold text-ink">{prefs.approvalTasksCount} việc cần duyệt</div>
              </div>
            </div>
            <Badge variant="accent">Quản lý / HR</Badge>
          </Link>
        </div>
      </div>

      {/* TOAST WITH 1-CLICK UNDO (Criteria G4-#7) */}
      {toastMessage && (
        <div className="p-3.5 bg-status-ok-soft border border-status-ok-line rounded-xl text-status-ok text-xs font-semibold flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-status-ok shrink-0" />
            <span>{toastMessage}</span>
          </div>
          {previousStateRef.current && (
            <button
              type="button"
              onClick={handleUndo}
              className="px-2.5 py-1 bg-status-ok hover:bg-status-ok text-on-ok rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
            >
              <RotateCcw className="w-3 h-3" />
              Hoàn tác (Undo)
            </button>
          )}
        </div>
      )}

      {/* CARD 1: GIỜ YÊN LẶNG (QUIET HOURS - Criteria G4-#3 & G4-#5) */}
      <Card title="Khung Giờ Yên Lặng (Quiet Hours & Chống Spam)">
        <div className="space-y-4 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-canvas rounded-xl border border-line">
            <div className="space-y-1">
              <div className="font-bold text-sm text-ink flex items-center gap-2">
                <Moon className="w-4 h-4 text-status-warn" />
                Bật chế độ Giờ Yên Lặng ({prefs.quietHoursStart} – {prefs.quietHoursEnd})
              </div>
              <p className="text-ink-muted text-xs leading-relaxed max-w-xl">
                Không gửi Web Push trong khoảng thời gian nghỉ ngơi. <strong>Việc quá hạn vẫn nổi badge đếm số</strong> trên menu và được gom vào email digest lúc 08:00 sáng hôm sau.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={prefs.quietHoursEnabled}
                onChange={handleToggleQuietHours}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-line peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-line-hover after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-status-ok" />
            </label>
          </div>

          {prefs.quietHoursEnabled && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 bg-surface rounded-xl border border-line text-xs">
              <div>
                <label className="block text-ink-muted mb-1 font-medium">Bắt đầu giờ yên lặng:</label>
                <input
                  type="text"
                  value={prefs.quietHoursStart}
                  onChange={(e) => handleChangeQuietTime('quietHoursStart', e.target.value)}
                  className="w-full p-2 rounded-lg border border-line bg-canvas text-ink font-mono"
                  placeholder="21:00"
                />
              </div>
              <div>
                <label className="block text-ink-muted mb-1 font-medium">Kết thúc giờ yên lặng:</label>
                <input
                  type="text"
                  value={prefs.quietHoursEnd}
                  onChange={(e) => handleChangeQuietTime('quietHoursEnd', e.target.value)}
                  className="w-full p-2 rounded-lg border border-line bg-canvas text-ink font-mono"
                  placeholder="07:00"
                />
              </div>
            </div>
          )}

          <div className="text-[11px] text-ink-muted flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-1">
            <label className="flex items-center gap-1.5">
              • Giới hạn push tối đa:
              <input
                type="number"
                min={0}
                max={50}
                value={prefs.maxPushPerDay}
                onChange={(e) => handleChangeNumber('maxPushPerDay', e.target.value)}
                className="w-16 p-1 rounded border border-line bg-canvas text-ink font-mono text-center"
                aria-label="Số lượt push tối đa mỗi ngày"
              />
              lượt push/ngày
            </label>
            <label className="flex items-center gap-1.5">
              • Cửa sổ chống trùng (Dedupe):
              <input
                type="number"
                min={0}
                max={50}
                value={prefs.dedupeHours}
                onChange={(e) => handleChangeNumber('dedupeHours', e.target.value)}
                className="w-16 p-1 rounded border border-line bg-canvas text-ink font-mono text-center"
                aria-label="Số giờ chống trùng thông báo"
              />
              giờ
            </label>
          </div>
        </div>
      </Card>

      {/* Thiết bị nhận Web Push (S36) */}
      <Card title="Thông Báo Đẩy Trên Thiết Bị Này">
        <div className="space-y-3 text-xs">
          <p className="text-ink-secondary leading-relaxed">
            Bật Web Push để nhận thông báo ngay cả khi không mở tab ACT Pulse.
            Trong giờ yên lặng hoặc khi vượt hạn mức push/ngày, thông báo được dồn vào email digest 08:00.
          </p>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-canvas rounded-xl border border-line">
            <div className="flex items-center gap-2.5">
              <Smartphone className="w-4 h-4 text-status-warn" />
              <div>
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
            >
              {pushBusy ? 'Đang xử lý…' : pushOnThisDevice ? 'Tắt trên thiết bị này' : 'Bật thông báo đẩy'}
            </Button>
          </div>
          {!pushSupported && (
            <div className="text-[11px] text-status-warn bg-status-warn-soft border border-status-warn-line rounded-lg p-2">
              Trình duyệt này không hỗ trợ Web Push — thông báo trong ứng dụng và email vẫn hoạt động.
            </div>
          )}
          {pushMsg && (
            <div className="text-[11px] text-ink-secondary bg-surface border border-line rounded-lg p-2">{pushMsg}</div>
          )}
        </div>
      </Card>

      {/* CARD 2: BẬT/TẮT THEO TỪNG LOẠI SỰ KIỆN × KÊNH (Criteria G4-#1 & G4-#2) */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-ink uppercase tracking-wider flex items-center gap-2">
          <Bell className="w-4 h-4 text-status-ok" />
          Ma Trận {Object.keys(prefs.events).length} Sự Kiện × 3 Kênh Thông Báo
        </h2>
        <p className="text-[11px] text-ink-muted">
          Chỉ hiển thị sự kiện áp dụng cho vai trò của bạn (Nhân viên · Quản lý · HR). Đổi vai trò
          sẽ thấy thêm sự kiện tương ứng; cấu hình cũ được giữ nguyên.
        </p>

        {/* Nhóm 1: Chấm công */}
        <Card title="Phân Hệ Chấm Công & Ca Làm Việc">
          <div className="divide-y divide-line/60">
            {attendanceEvents.map(renderEventRow)}
          </div>
        </Card>

        {/* Nhóm 2: Đơn từ & Phép */}
        <Card title="Phân Hệ Đơn Từ & Nghỉ Phép">
          <div className="divide-y divide-line/60">
            {requestEvents.map(renderEventRow)}
          </div>
        </Card>

        {/* Nhóm 3: OKR */}
        <Card title="Phân Hệ Mục Tiêu & Đánh Giá OKR">
          <div className="divide-y divide-line/60">
            {okrEvents.map(renderEventRow)}
          </div>
        </Card>

        {/* Nhóm 4: Bảng công & Quản trị */}
        <Card title="Bảng Công & Quản Trị Hệ Thống">
          <div className="divide-y divide-line/60">
            {systemEvents.map(renderEventRow)}
          </div>
        </Card>
      </div>

    </div>
  );
};
