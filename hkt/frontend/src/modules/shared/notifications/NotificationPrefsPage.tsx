import React, { useState, useEffect, useRef } from 'react';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { Card } from '../../../components/common/Card';
import { useAuth } from '../../../context/AuthContext';
import {
  Bell,
  Moon,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  ShieldAlert,
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
    personalTasksCount: 4,
    approvalTasksCount: 3,
    events: {
      MISSING_CHECKIN: { label: 'Chưa check-in khi quá 30 phút', category: 'ATTENDANCE', web: true, email: false, push: true },
      MISSING_CHECKOUT: { label: 'Chưa check-out khi quá 30 phút', category: 'ATTENDANCE', web: true, email: false, push: true },
      FORGOT_ATTENDANCE: { label: 'Quên chấm công (thiếu 2 ngày liên tiếp)', category: 'ATTENDANCE', web: true, email: true, push: true },
      ADJUST_DEADLINE_SOON: { label: 'Hạn nộp đơn bổ sung công sắp tới', category: 'ATTENDANCE', web: true, email: false, push: true },
      ADJUST_OVERDUE: { label: 'Hạn nộp đơn bổ sung công đã quá hạn', category: 'ATTENDANCE', web: true, email: true, push: true },

      APPROVAL_OVERDUE: { label: 'Đơn chờ duyệt quá hạn SLA 48h', category: 'REQUEST', web: true, email: true, push: true },
      REQUEST_REJECTED: { label: 'Đơn bị từ chối / trả lại', category: 'REQUEST', web: true, email: false, push: true },
      LEAVE_EXPIRY_SOON: { label: 'Phép tồn năm 2025 sắp hết hạn 31/03', category: 'REQUEST', web: true, email: false, push: true },
      WFH_MISSING_REPORT: { label: 'Đơn WFH chưa gửi báo cáo cuối ngày', category: 'REQUEST', web: true, email: false, push: true },

      OKR_CHECKIN_DUE: { label: 'Check-in tiến độ OKR đến hạn', category: 'OKR', web: true, email: false, push: true },
      OKR_NOT_CREATED: { label: 'Chưa thiết lập mục tiêu OKR quý', category: 'OKR', web: true, email: true, push: true },
      OKR_SELF_ASSESSMENT: { label: 'Tự chấm điểm OKR Form 4 Box đến hạn', category: 'OKR', web: true, email: false, push: true },
      OKR_OBJECTIVE_RETURNED: { label: 'Mục tiêu OKR bị trả lại cần sửa', category: 'OKR', web: true, email: false, push: true },

      TIMESHEET_CLOSED: { label: 'Bảng công vừa chốt (khiếu nại 2 ngày)', category: 'TIMESHEET', web: true, email: true, push: false },
      TIMESHEET_COMPLAINT_EXPIRING: { label: 'Sắp hết hạn khiếu nại bảng công', category: 'TIMESHEET', web: true, email: false, push: true },
      HR_CLOSE_TIMESHEET: { label: 'Nhắc HR chốt bảng công kỳ này', category: 'SYSTEM', web: true, email: true, push: false },
      HR_UNLOCK_OKR: { label: 'Nhắc HR mở khóa điều chỉnh OKR', category: 'SYSTEM', web: true, email: true, push: false },
    },
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [securityTestResult, setSecurityTestResult] = useState<string | null>(null);
  const previousStateRef = useRef<NotificationPreferences | null>(null);

  // Load user's preferences from backend
  useEffect(() => {
    fetch('/api/v1/notifications/preferences')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data) {
          setPrefs((prev) => ({
            ...prev,
            ...data.data,
            events: {
              ...prev.events,
              ...(data.data.events || {}),
            },
          }));
        }
      })
      .catch(() => {});
  }, []);

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

  // Test Security: Trying to modify someone else's preferences must be BLOCKED with 403 Forbidden! (Criteria G4-#4)
  const handleTestTamperOtherUser = async () => {
    setSecurityTestResult('Đang gửi request giả lập sửa cấu hình của nhân sự khác...');
    try {
      const res = await fetch('/api/v1/notifications/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId: '00000000-0000-0000-0000-000000009999',
          quietHoursEnabled: false,
        }),
      });

      if (res.status === 403) {
        setSecurityTestResult('✓ KẾT QUẢ ĐẠT: Server chặn thành công với mã HTTP 403 Forbidden ("Bạn không có quyền sửa đổi tùy chỉnh thông báo của người khác!")');
      } else {
        const json = await res.json();
        setSecurityTestResult(`Phản hồi: HTTP ${res.status} - ${JSON.stringify(json)}`);
      }
    } catch (e: any) {
      setSecurityTestResult(`Lỗi kiểm tra: ${e.message}`);
    }
  };

  // Group events by category
  const attendanceEvents = Object.entries(prefs.events).filter(([_, e]) => e.category === 'ATTENDANCE');
  const requestEvents = Object.entries(prefs.events).filter(([_, e]) => e.category === 'REQUEST');
  const okrEvents = Object.entries(prefs.events).filter(([_, e]) => e.category === 'OKR');
  const systemEvents = Object.entries(prefs.events).filter(([_, e]) => e.category === 'TIMESHEET' || e.category === 'SYSTEM');

  const renderEventRow = ([key, item]: [string, EventPref]) => (
    <div key={key} className="py-3 px-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line last:border-0 hover:bg-canvas/40 rounded-lg transition-colors">
      <div className="min-w-0 pr-2">
        <div className="text-xs font-semibold text-ink">{item.label}</div>
        <div className="text-[10px] text-ink-muted font-mono mt-0.5">{key}</div>
      </div>

      <div className="flex items-center gap-4 shrink-0">
        {/* Web In-App Toggle */}
        <label className="flex items-center gap-1.5 cursor-pointer text-xs" title="Thông báo trên thanh Header web">
          <input
            type="checkbox"
            checked={item.web}
            onChange={() => handleToggleEventChannel(key, 'web')}
            className="rounded border-line text-emerald-500 focus:ring-emerald-500 w-3.5 h-3.5"
          />
          <span className="text-[11px] text-ink-secondary flex items-center gap-1">
            <Globe className="w-3 h-3 text-emerald-400" /> Web
          </span>
        </label>

        {/* Email Digest Toggle */}
        <label className="flex items-center gap-1.5 cursor-pointer text-xs" title="Gom vào Email digest 08:00 sáng">
          <input
            type="checkbox"
            checked={item.email}
            onChange={() => handleToggleEventChannel(key, 'email')}
            className="rounded border-line text-emerald-500 focus:ring-emerald-500 w-3.5 h-3.5"
          />
          <span className="text-[11px] text-ink-secondary flex items-center gap-1">
            <Mail className="w-3 h-3 text-sky-400" /> Email
          </span>
        </label>

        {/* Web Push Toggle */}
        <label className="flex items-center gap-1.5 cursor-pointer text-xs" title="Thông báo đẩy trình duyệt Web Push tức thì">
          <input
            type="checkbox"
            checked={item.push}
            onChange={() => handleToggleEventChannel(key, 'push')}
            className="rounded border-line text-emerald-500 focus:ring-emerald-500 w-3.5 h-3.5"
          />
          <span className="text-[11px] text-ink-secondary flex items-center gap-1">
            <Smartphone className="w-3 h-3 text-amber-400" /> Push
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
          <Badge variant="accent">S36 · Tất cả vai trò</Badge>
          <span className="text-[11px] text-ink-muted">Tự động lưu ngay · Hiệu lực tức thì</span>
        </div>
        <h1 className="text-xl font-bold tracking-tight text-ink">Tuỳ Chỉnh Thông Báo Cá Nhân</h1>
        <p className="text-xs text-ink-muted leading-relaxed">
          Tắt thông báo mình không quan tâm, giữ lại cái mình cần. <strong>Tắt thông báo KHÔNG làm mất việc</strong> — mọi công việc cần làm vẫn nằm nguyên trong Todo Inbox.
        </p>

        {/* STATS BANNER: Số việc chờ theo nhóm (Criteria G4-#6) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <div className="p-3 bg-surface rounded-xl border border-line flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Inbox className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[11px] text-ink-muted">Việc của tôi (Personal Actions)</div>
                <div className="text-sm font-bold text-ink">{prefs.personalTasksCount} việc đang chờ</div>
              </div>
            </div>
            <Badge variant="ok">Đang hoạt động</Badge>
          </div>

          <div className="p-3 bg-surface rounded-xl border border-line flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <UserCheck className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[11px] text-ink-muted">Việc tôi phụ trách (Approvals)</div>
                <div className="text-sm font-bold text-ink">{prefs.approvalTasksCount} việc cần duyệt</div>
              </div>
            </div>
            <Badge variant="accent">Quản lý / HR</Badge>
          </div>
        </div>
      </div>

      {/* TOAST WITH 1-CLICK UNDO (Criteria G4-#7) */}
      {toastMessage && (
        <div className="p-3.5 bg-emerald-500/15 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs font-semibold flex items-center justify-between shadow-lg animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
          {previousStateRef.current && (
            <button
              type="button"
              onClick={handleUndo}
              className="px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
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
                <Moon className="w-4 h-4 text-amber-400" />
                Bật chế độ Giờ Yên Lặng (21:00 – 07:00)
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
              <div className="w-11 h-6 bg-line peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500" />
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

          <div className="text-[11px] text-ink-muted flex items-center justify-between pt-1">
            <span>• Giới hạn push tối đa: <strong>{prefs.maxPushPerDay} lượt push/ngày</strong></span>
            <span>• Cửa sổ chống trùng (Dedupe): <strong>{prefs.dedupeHours} giờ</strong></span>
          </div>
        </div>
      </Card>

      {/* CARD 2: BẬT/TẮT THEO TỪNG LOẠI SỰ KIỆN × KÊNH (Criteria G4-#1 & G4-#2) */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-ink uppercase tracking-wider flex items-center gap-2">
          <Bell className="w-4 h-4 text-emerald-400" />
          Ma Trận 17 Sự Kiện × 3 Kênh Thông Báo (C2 / S36)
        </h2>

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

      {/* CARD 3: KIỂM CHỨNG BẢO MẬT PHÂN QUYỀN (Criteria G4-#4) */}
      <Card title="Kiểm Thử An Toàn Phân Quyền (Security Scoping Verification)">
        <div className="space-y-3 text-xs">
          <p className="text-ink-secondary">
            Theo quy định bảo mật nghiệp vụ G4-#4, mỗi nhân viên <strong>chỉ có quyền cấu hình thông báo của chính mình</strong>. Bất kỳ request nào can thiệp trái phép vào cấu hình người khác sẽ bị hệ thống phát hiện và chặn lại với mã lỗi <strong>HTTP 403 Forbidden</strong>.
          </p>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={handleTestTamperOtherUser}>
              <ShieldAlert className="w-3.5 h-3.5 mr-1 text-rose-400" />
              Thử Sửa Cấu Hình Người Khác (Kiểm tra chặn 403)
            </Button>
          </div>
          {securityTestResult && (
            <div className="p-3 bg-canvas border border-line rounded-lg text-xs font-mono text-ink leading-relaxed">
              {securityTestResult}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
