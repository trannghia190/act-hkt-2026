import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Badge } from './Badge';
import { Eye, EyeOff, ShieldAlert, Clock, UserCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface EnterpriseGmailModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EnterpriseGmailModal: React.FC<EnterpriseGmailModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const isHrOrAdmin = user?.role === 'ADMIN' || user?.role === 'HR_ADMIN';

  const [smtpHost, setSmtpHost] = useState('smtp.gmail.com');
  const [smtpPort, setSmtpPort] = useState(587);
  const [gmailUser, setGmailUser] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [showAppPassword, setShowAppPassword] = useState(false);
  const [targetEmail, setTargetEmail] = useState('');
  const [testMessage, setTestMessage] = useState('Thử nghiệm gửi email thông báo từ hệ thống Ascend Tech 2026.');
  const [isLoading, setIsLoading] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [currentSender, setCurrentSender] = useState('');
  const [lastConfiguredAt, setLastConfiguredAt] = useState<string | null>(null);
  const [lastConfiguredBy, setLastConfiguredBy] = useState<string | null>(null);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [activeStepTab, setActiveStepTab] = useState<'guide' | 'config'>('config');

  useEffect(() => {
    if (isOpen) {
      const token = localStorage.getItem('token');
      // Fetch current status
      fetch('/api/v1/auth/smtp-status', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
        .then(res => res.json())
        .then(data => {
          if (data.success && data.data) {
            setIsConfigured(data.data.configured);
            setCurrentSender(data.data.senderEmail);
            if (data.data.lastConfiguredAt) setLastConfiguredAt(data.data.lastConfiguredAt);
            if (data.data.lastConfiguredBy) setLastConfiguredBy(data.data.lastConfiguredBy);
            if (data.data.senderEmail && data.data.senderEmail !== 'Chưa cấu hình') {
              setGmailUser(data.data.senderEmail);
            }
          }
        })
        .catch(err => console.error('Failed to get smtp status', err));
    }
  }, [isOpen]);

  const handleSaveAndTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isHrOrAdmin) {
      alert('Chỉ HR hoặc Quản trị viên mới có quyền lưu cấu hình Gmail Doanh Nghiệp!');
      return;
    }

    if (!gmailUser.trim() || !appPassword.trim() || !targetEmail.trim()) {
      alert('Vui lòng nhập đầy đủ Gmail gửi, Mật khẩu ứng dụng và Địa chỉ nhận thật!');
      return;
    }

    setIsLoading(true);
    setResult(null);

    const token = localStorage.getItem('token');
    const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

    try {
      // Step 1: Save SMTP config
      const configRes = await fetch('/api/v1/auth/config-smtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          host: smtpHost,
          port: smtpPort,
          username: gmailUser.trim(),
          password: appPassword.replace(/\s+/g, '') // remove spaces
        })
      });

      const configData = await configRes.json();
      if (!configRes.ok || !configData.success) {
        throw new Error(configData.message || 'Lỗi lưu cấu hình SMTP');
      }

      // Step 2: Send real test email
      const testRes = await fetch('/api/v1/auth/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          targetEmail: targetEmail.trim(),
          message: testMessage.trim()
        })
      });

      const testData = await testRes.json();
      if (testRes.ok && testData.data === true) {
        setIsConfigured(true);
        setCurrentSender(gmailUser.trim());
        setResult({
          success: true,
          message: `✓ THÀNH CÔNG! Đã lưu cấu hình và gửi email thật tới ${targetEmail.trim()}. Hãy mở hòm thư Gmail của bạn để kiểm tra!`
        });
        // Refresh status to show updated lastConfigured info
        fetch('/api/v1/auth/smtp-status', { headers: authHeaders })
          .then(r => r.json())
          .then(d => {
            if (d?.data?.lastConfiguredAt) setLastConfiguredAt(d.data.lastConfiguredAt);
            if (d?.data?.lastConfiguredBy) setLastConfiguredBy(d.data.lastConfiguredBy);
          })
          .catch(() => {});
      } else {
        setResult({
          success: false,
          message: `✕ Gửi thất bại: ${testData.message || 'Không thể xác thực với smtp.gmail.com:587. Vui lòng kiểm tra Mật khẩu ứng dụng (16 ký tự) và đảm bảo đã bật 2-Step Verification trên tài khoản Google.'}`
        });
      }
    } catch (err: any) {
      setResult({
        success: false,
        message: 'Lỗi kết nối máy chủ Core Service: ' + err.message
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Thiết Lập Gmail Doanh Nghiệp & Gửi Email Thật (Production SMTP)"
      maxWidth="lg"
    >
      <div className="space-y-4 text-xs">
        {/* Role permission check banner */}
        {!isHrOrAdmin && (
          <div className="flex items-center gap-2 p-3 bg-status-danger-soft border border-status-danger-line text-status-danger rounded-xl">
            <ShieldAlert size={18} className="shrink-0" />
            <div>
              <strong>Quyền hạn hạn chế:</strong> Bạn đang đăng nhập với vai trò <code className="font-semibold">{user?.role || 'Nhân viên'}</code>. Chỉ nhân sự (HR_ADMIN) hoặc Quản trị viên (ADMIN) mới có quyền lưu cấu hình Gmail.
            </div>
          </div>
        )}

        {/* Status Header */}
        <div className="p-3 bg-surface rounded-xl border border-line space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-ink">Trạng thái SMTP hiện tại:</span>
              {isConfigured ? (
                <Badge variant="ok">Đã kết nối Gmail thật</Badge>
              ) : (
                <Badge variant="warn">Chưa kết nối</Badge>
              )}
            </div>
            <div className="text-ink-muted text-[11px]">
              Tài khoản gửi: <strong className="text-ink">{currentSender || 'Chưa thiết lập'}</strong>
            </div>
          </div>

          {lastConfiguredAt && (
            <div className="flex items-center gap-1.5 text-[11px] text-ink-muted pt-1 border-t border-line/50">
              <Clock size={12} className="text-accent" />
              <span>Được lưu lần cuối: <strong className="text-ink">{lastConfiguredAt}</strong></span>
              {lastConfiguredBy && (
                <span className="flex items-center gap-1 ml-2 text-ink-secondary">
                  <UserCheck size={12} className="text-accent" />
                  Bởi: <strong className="text-accent">{lastConfiguredBy}</strong>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-2 border-b border-line pb-2">
          <button
            onClick={() => setActiveStepTab('config')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
              activeStepTab === 'config'
                ? 'bg-accent-soft text-accent-dark border border-accent-line'
                : 'text-ink-secondary hover:text-ink'
            }`}
          >
            ⚙️ Cấu Hình &amp; Gửi Email Thật
          </button>
          <button
            onClick={() => setActiveStepTab('guide')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
              activeStepTab === 'guide'
                ? 'bg-accent-soft text-accent-dark border border-accent-line'
                : 'text-ink-secondary hover:text-ink'
            }`}
          >
            📖 Hướng Dẫn Từng Bước (Step-by-Step Google Setup)
          </button>
        </div>

        {/* Guide Tab */}
        {activeStepTab === 'guide' && (
          <div className="p-4 bg-canvas rounded-xl border border-line space-y-3 leading-relaxed text-ink">
            <div className="font-bold text-accent text-sm">
              Hướng dẫn 4 bước lấy "Mật khẩu ứng dụng" (Google App Password) cho Gmail / Google Workspace:
            </div>

            <div className="space-y-2.5">
              <div className="p-2.5 bg-surface rounded-lg border border-line">
                <strong>Bước 1: Bật Xác minh 2 bước (2-Step Verification)</strong>
                <p className="text-ink-secondary mt-0.5">
                  Truy cập <a href="https://myaccount.google.com/security" target="_blank" rel="noreferrer" className="text-accent underline">myaccount.google.com/security</a> → Tìm mục <em>"Xác minh 2 bước"</em> và đảm bảo đã BẬT.
                </p>
              </div>

              <div className="p-2.5 bg-surface rounded-lg border border-line">
                <strong>Bước 2: Tạo Mật khẩu ứng dụng (App Password)</strong>
                <p className="text-ink-secondary mt-0.5">
                  Truy cập trực tiếp: <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="text-accent underline">myaccount.google.com/apppasswords</a>
                  <br />Nhập tên ứng dụng (Ví dụ: <code>Ascend Tech HR</code>) → Bấm <strong>Tạo (Create)</strong>.
                </p>
              </div>

              <div className="p-2.5 bg-surface rounded-lg border border-line">
                <strong>Bước 3: Sao chép mã 16 ký tự</strong>
                <p className="text-ink-secondary mt-0.5">
                  Google sẽ hiển thị mã 16 chữ cái (dạng <code>xxxx xxxx xxxx xxxx</code>). Sao chép toàn bộ mã này.
                </p>
              </div>

              <div className="p-2.5 bg-surface rounded-lg border border-line">
                <strong>Bước 4: Nhập vào form bên dưới và Gửi thử</strong>
                <p className="text-ink-secondary mt-0.5">
                  Dán email Gmail gửi và mã 16 ký tự vào form bên dưới, sau đó nhập email cá nhân của bạn để nhận email kiểm thử tức thì!
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Configuration & Test Form */}
        <form onSubmit={handleSaveAndTest} className="space-y-3.5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-ink font-semibold mb-1">
                Tài khoản Gmail Doanh Nghiệp (Sender Email) *
              </label>
              <input
                type="email"
                required
                disabled={!isHrOrAdmin}
                value={gmailUser}
                onChange={e => setGmailUser(e.target.value)}
                placeholder="VD: hr.actpulse@gmail.com hoặc user@act-corp.vn"
                className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-ink text-xs font-medium disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-ink font-semibold mb-1">
                Mật khẩu ứng dụng Google (16 ký tự App Password) *
              </label>
              <div className="relative">
                <input
                  type={showAppPassword ? 'text' : 'password'}
                  required
                  disabled={!isHrOrAdmin}
                  value={appPassword}
                  onChange={e => setAppPassword(e.target.value)}
                  placeholder="xxxx xxxx xxxx xxxx"
                  className="w-full px-3 py-2 pr-9 rounded-lg border border-line bg-surface text-ink text-xs font-mono disabled:opacity-60 disabled:cursor-not-allowed"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowAppPassword(prev => !prev)}
                  title={showAppPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink transition-colors"
                >
                  {showAppPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-ink-secondary text-[11px]">
            <div>
              <span className="text-ink-muted">Máy chủ SMTP:</span> <code>smtp.gmail.com</code>
            </div>
            <div>
              <span className="text-ink-muted">Cổng / Giao thức:</span> <code>587 (STARTTLS)</code>
            </div>
          </div>

          <div className="pt-2 border-t border-line">
            <label className="block text-ink font-semibold mb-1">
              Địa chỉ Gmail người nhận kiểm thử (Recipient Email thật) *
            </label>
            <input
              type="email"
              required
              disabled={!isHrOrAdmin}
              value={targetEmail}
              onChange={e => setTargetEmail(e.target.value)}
              placeholder="Nhập email cá nhân thực tế của bạn để nhận thư (VD: sang.nguyen@gmail.com)"
              className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-ink text-xs disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-ink-muted mb-1">Nội dung thông điệp kiểm thử</label>
            <input
              type="text"
              disabled={!isHrOrAdmin}
              value={testMessage}
              onChange={e => setTestMessage(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-ink text-xs disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>

          {/* Feedback Result Banner */}
          {result && (
            <div
              className={`p-3.5 rounded-xl border text-xs leading-relaxed ${
                result.success
                  ? 'bg-status-ok-soft border-status-ok-line text-status-ok'
                  : 'bg-status-danger-soft border-status-danger-line text-status-danger'
              }`}
            >
              {result.message}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-line">
            <Button variant="outline" size="sm" type="button" onClick={onClose}>
              Đóng
            </Button>
            <Button variant="primary" size="sm" type="submit" disabled={isLoading || !isHrOrAdmin}>
              {isLoading ? '⏳ Đang kết nối & gửi mail...' : '🚀 Lưu Cấu Hình & Gửi Thử Ngay'}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
};
