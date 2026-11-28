import React, { useState, useEffect } from 'react';
import {
  Globe,
  Save,
  RefreshCw,
  ExternalLink,
  ShieldAlert,
  CheckCircle2,
  Clock,
  User,
  Mail,
  Copy,
  Info,
  Layers,
  ArrowRight
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { Button } from '../../../components/common/Button';
import { Badge } from '../../../components/common/Badge';
import { Panel } from '../../../components/common/Panel';
import { EnterpriseGmailModal } from '../../../components/common/EnterpriseGmailModal';

interface DomainConfigData {
  domainHost: string;
  defaultHost: string;
  configKey?: string;
  description?: string;
  updatedBy?: string;
  updatedAt?: string;
}

export const SystemDomainConfigPage: React.FC = () => {
  const { user } = useAuth();
  const isHrOrAdmin = user?.role === 'ADMIN' || user?.role === 'HR_ADMIN';

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<DomainConfigData>({
    domainHost: 'http://localhost:3000',
    defaultHost: 'http://localhost:3000',
  });
  const [inputHost, setInputHost] = useState('http://localhost:3000');
  const [reason, setReason] = useState('Cập nhật tên miền hệ thống chuẩn doanh nghiệp');
  const [toastMessage, setToastMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [isGmailModalOpen, setIsGmailModalOpen] = useState(false);

  const getAuthHeaders = (): Record<string, string> => {
    try {
      const u = JSON.parse(localStorage.getItem('pulse_auth_user') || '{}');
      return u?.accessToken
        ? { Authorization: `Bearer ${u.accessToken}`, 'Content-Type': 'application/json' }
        : { 'Content-Type': 'application/json' };
    } catch {
      return { 'Content-Type': 'application/json' };
    }
  };

  const showToast = (text: string, type: 'ok' | 'err' = 'ok') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/admin/system-config/domain', {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (res.ok && data.success && data.data) {
        setConfig(data.data);
        setInputHost(data.data.domainHost || 'http://localhost:3000');
      } else {
        showToast(data.message || 'Không thể nạp cấu hình Domain Host', 'err');
      }
    } catch (err: any) {
      showToast('Lỗi kết nối tới máy chủ khi nạp cấu hình', 'err');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isHrOrAdmin) {
      showToast('Chỉ Quản trị viên (Admin) hoặc HR mới có quyền cập nhật Domain Host!', 'err');
      return;
    }

    let clean = inputHost.trim();
    while (clean.endsWith('/')) {
      clean = clean.substring(0, clean.length - 1);
    }

    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      showToast('Domain Host bắt buộc phải bắt đầu bằng http:// hoặc https:// (vd: https://hrm.ascendtech.vn)', 'err');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/v1/admin/system-config/domain', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          domainHost: clean,
          reason: reason.trim() || 'Cập nhật domain host điều hướng hệ thống',
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Đã lưu và đồng bộ Domain Host thành công: ${clean}`, 'ok');
        fetchConfig();
      } else {
        showToast(data.message || 'Lỗi khi lưu cấu hình Domain Host', 'err');
      }
    } catch (err: any) {
      showToast('Lỗi kết nối máy chủ khi cập nhật Domain Host', 'err');
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = (url: string, key: string) => {
    navigator.clipboard.writeText(url);
    setCopiedLink(key);
    setTimeout(() => setCopiedLink(null), 2500);
  };

  const previewBase = (inputHost.trim() || 'http://localhost:3000').replace(/\/+$/, '');

  const sampleLinks = [
    {
      key: 'activation',
      label: 'Liên kết kích hoạt tài khoản nhân viên mới',
      desc: 'Được gửi tự động qua Gmail trong thư chào mừng onboarding',
      url: `${previewBase}/login`,
    },
    {
      key: 'reset',
      label: 'Liên kết xác thực đặt lại mật khẩu OTP',
      desc: 'Được gửi kèm mã OTP 6 số khi người dùng quên mật khẩu',
      url: `${previewBase}/forgot-password`,
    },
    {
      key: 'approval',
      label: 'Liên kết phê duyệt đơn (Quản lý & HR)',
      desc: 'Nút thao tác nhanh trong email thông báo kết quả hoặc nhắc hạn duyệt đơn',
      url: `${previewBase}/attendance/requests`,
    },
    {
      key: 'todo',
      label: 'Liên kết bản tin công việc 08:00 AM (Todo)',
      desc: 'Nút điều hướng trung tâm trong bản tin nhiệm vụ buổi sáng',
      url: `${previewBase}/todo`,
    },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-4 pb-24">
      {/* Toast notification */}
      {toastMessage && (
        <div
          className={`fixed right-4 top-4 z-50 flex items-center gap-3 rounded-xl border p-4 text-xs font-semibold shadow-lg transition-all duration-300 animate-in fade-in slide-in-from-top-2 ${
            toastMessage.type === 'ok'
              ? 'border-status-ok-line bg-status-ok-soft text-status-ok'
              : 'border-status-danger-line bg-status-danger-soft text-status-danger'
          }`}
        >
          {toastMessage.type === 'ok' ? (
            <CheckCircle2 className="w-5 h-5 text-status-ok shrink-0" />
          ) : (
            <ShieldAlert className="w-5 h-5 text-status-danger shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Đầu trang — cùng khuôn với các màn quản trị khác */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-accent-dark">
            <Globe className="h-3.5 w-3.5" />
            Quản trị hệ thống
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <h1 className="font-display text-xl font-extrabold tracking-tight text-ink sm:text-[23px]">
              Cấu hình Domain Host
            </h1>
            <Badge variant="accent">S48</Badge>
          </div>
          <p className="mt-1 text-xs text-ink-muted">
            Tên miền gốc để tự sinh liên kết kích hoạt tài khoản, OTP đặt lại mật khẩu và nút duyệt đơn trong email.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchConfig}
            disabled={loading}
            className="gap-1.5 text-xs"
            title="Tải lại cấu hình từ Database"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Nạp lại</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsGmailModalOpen(true)}
            className="gap-1.5 border-accent-line text-xs text-accent-dark hover:bg-accent-soft"
            title="Cấu hình gửi email Gmail Doanh Nghiệp"
          >
            <Mail className="h-3.5 w-3.5" />
            <span>Thiết lập Gmail</span>
          </Button>
        </div>
      </div>

      {/* Bìa tóm tắt — nền ink, 3 số như các màn redesign */}
      <div className="overflow-hidden rounded-[16px] border border-line bg-ink px-5 py-4 text-canvas">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-canvas/60">
              Hạ tầng &amp; tích hợp
            </div>
            <div className="mt-1 font-display text-lg font-extrabold">
              Một tên miền chuẩn — mọi liên kết hệ thống
            </div>
            <p className="mt-1 max-w-md text-xs leading-relaxed text-canvas/75">
              Đổi tên miền tại đây là email chào mừng, OTP quên mật khẩu, nhắc hạn duyệt đơn và bản tin
              Todo 08:00 dùng ngay tên miền mới — không cần sửa code.
            </p>
          </div>
          <dl className="ml-auto flex flex-wrap gap-6">
            <div className="min-w-0">
              <dd className="max-w-[220px] truncate font-mono text-[13px] font-bold text-canvas" title={config.domainHost || 'http://localhost:3000'}>
                {(config.domainHost || 'http://localhost:3000').replace(/^https?:\/\//, '')}
              </dd>
              <dt className="text-[11px] text-canvas/60">host đang dùng</dt>
            </div>
            <div>
              <dd className="font-display text-xl font-extrabold">
                {(config.domainHost || '').includes('localhost')
                  ? 'Local'
                  : (config.domainHost || '').includes('staging')
                    ? 'Staging'
                    : 'Production'}
              </dd>
              <dt className="text-[11px] text-canvas/60">môi trường</dt>
            </div>
            <div>
              <dd className="font-display text-xl font-extrabold">
                {config.updatedAt
                  ? new Date(config.updatedAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
                  : '—'}
              </dd>
              <dt className="text-[11px] text-canvas/60">cập nhật gần nhất</dt>
            </div>
          </dl>
        </div>
      </div>

      {/* Main Settings Grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Left 2 Cols: Form & Presets */}
        <div className="min-w-0 space-y-4 lg:col-span-2">
          <Panel
            title="Thiết lập tên miền gốc"
            subtitle="Áp dụng ngay cho email & thông báo phát sinh sau khi lưu"
            action={
              <span className="inline-flex items-center gap-1 rounded-md border border-status-ok-line bg-status-ok-soft px-2 py-0.5 text-[10.5px] font-semibold text-status-ok">
                <Layers className="h-3 w-3" />
                Lưu Database
              </span>
            }
            bodyClassName="space-y-4"
          >
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-ink mb-1.5">
                  URL Domain Host Hệ Thống *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={inputHost}
                    onChange={(e) => setInputHost(e.target.value)}
                    placeholder="https://hrm.ascendtech.vn hoặc http://localhost:3000"
                    className="w-full text-xs p-3 pr-24 rounded-xl border border-line bg-canvas text-ink focus:outline-none focus:border-accent font-mono font-bold"
                  />
                  <div className="absolute right-2 top-2 flex items-center gap-1">
                    <a
                      href={previewBase}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-ink-muted hover:text-accent rounded-lg transition-colors cursor-pointer"
                      title="Mở thử nghiệm URL này trong tab mới"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>
                <p className="text-[11px] text-ink-muted mt-1.5">
                  Bắt buộc bao gồm giao thức <code>http://</code> hoặc <code>https://</code>, không cần dấu gạch chéo cuối cùng.
                </p>
              </div>

              {/* Quick Presets */}
              <div>
                <span className="block text-[11px] font-semibold text-ink-muted mb-2">
                  Gợi ý cấu hình nhanh (Bấm để điền):
                </span>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: 'Localhost (Dev 3000)', val: 'http://localhost:3000' },
                    { label: 'Ascend Tech Production', val: 'https://hrm.ascendtech.vn' },
                    { label: 'Ascend Tech Staging', val: 'https://staging-hrm.ascendtech.vn' },
                  ].map((p) => (
                    <button
                      key={p.val}
                      type="button"
                      onClick={() => setInputHost(p.val)}
                      className={`text-[11px] px-2.5 py-1.5 rounded-lg border font-mono transition-colors cursor-pointer ${
                        inputHost === p.val
                          ? 'border-accent bg-accent/10 text-accent font-bold'
                          : 'border-line bg-canvas text-ink-muted hover:border-accent/50 hover:text-ink'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-ink mb-1.5">
                  Lý do cập nhật / Ghi chú thay đổi (Ghi vào Nhật ký Audit Log) *
                </label>
                <input
                  type="text"
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ví dụ: Cập nhật tên miền sản xuất phục vụ toàn thể cán bộ nhân viên"
                  className="w-full text-xs p-2.5 rounded-xl border border-line bg-canvas text-ink focus:outline-none focus:border-accent"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2">
                <div className="flex items-center gap-1.5 text-[11px] text-ink-muted">
                  <ShieldAlert className="h-3.5 w-3.5 text-accent" />
                  <span>Thay đổi có hiệu lực ngay cho email và thông báo tiếp theo</span>
                </div>
                <Button
                  type="submit"
                  size="sm"
                  disabled={saving || !isHrOrAdmin}
                  className="gap-1.5 bg-accent text-xs font-bold text-on-accent hover:bg-accent-dark"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>{saving ? 'Đang lưu...' : 'Lưu cấu hình Domain'}</span>
                </Button>
              </div>
            </form>
          </Panel>

          {/* Live Preview Card */}
          <Panel
            title="Xem trước liên kết tự động"
            subtitle="Cập nhật theo Domain Host đang nhập"
            action={<Info className="h-4 w-4 text-status-ok" />}
          >
            <div className="space-y-3">
              {sampleLinks.map((item) => (
                <div
                  key={item.key}
                  className="p-3.5 bg-canvas border border-line/70 rounded-xl space-y-1.5 transition-all hover:border-line"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-ink">{item.label}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(item.url, item.key)}
                      className="text-[11px] text-accent hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                    >
                      {copiedLink === item.key ? (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-status-ok" />
                          <span className="text-status-ok">Đã chép</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Chép link</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-[11px] text-ink-muted">{item.desc}</p>
                  <div className="flex items-center gap-2 pt-1">
                    <span className="font-mono text-[11px] font-bold text-accent break-all bg-surface px-2 py-1 rounded-md border border-line w-full">
                      {item.url}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        {/* Right 1 Col: Status & Audit Info */}
        <div className="min-w-0 space-y-4">
          {/* Active Configuration Box */}
          <Panel
            title="Trạng thái cấu hình"
            subtitle="Đang đọc từ bảng system_configs"
            action={<span className="mt-1 block h-2 w-2 rounded-full bg-status-ok" aria-hidden="true" />}
          >
            <div className="space-y-3 text-xs">
              <div>
                <span className="text-ink-muted block text-[11px]">Domain Host đang kích hoạt:</span>
                <span className="font-mono font-extrabold text-sm text-accent break-all">
                  {config.domainHost || 'http://localhost:3000'}
                </span>
              </div>

              <div>
                <span className="text-ink-muted block text-[11px]">Khóa cấu hình (DB Key):</span>
                <span className="font-mono font-bold text-ink text-[11px]">
                  {config.configKey || 'SYSTEM_DOMAIN_HOST'}
                </span>
              </div>

              <div className="pt-2 border-t border-line space-y-2">
                <div className="flex items-center gap-2 text-ink-muted text-[11px]">
                  <User className="w-3.5 h-3.5 text-accent shrink-0" />
                  <span>Cập nhật gần nhất bởi:</span>
                  <span className="font-bold text-ink font-mono">{config.updatedBy || 'SYSTEM'}</span>
                </div>

                <div className="flex items-center gap-2 text-ink-muted text-[11px]">
                  <Clock className="w-3.5 h-3.5 text-accent shrink-0" />
                  <span>Thời gian cập nhật:</span>
                  <span className="font-semibold text-ink">
                    {config.updatedAt
                      ? new Date(config.updatedAt).toLocaleString('vi-VN')
                      : 'Mặc định ban đầu'}
                  </span>
                </div>
              </div>
            </div>
          </Panel>

          {/* Business & Governance Rules */}
          <Panel title="Chính sách &amp; an toàn tên miền">
            <ul className="space-y-2.5 text-[11px] leading-relaxed text-ink-muted">
              <li className="flex items-start gap-2">
                <span className="text-accent font-bold">•</span>
                <span>
                  <strong>Phân quyền truy cập:</strong> Chỉ người dùng có vai trò <strong>Admin</strong> hoặc <strong>HR_ADMIN</strong> mới được phép thay đổi tên miền hệ thống.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-accent font-bold">•</span>
                <span>
                  <strong>Lưu trữ tập trung:</strong> Cấu hình được lưu vào bảng <code>system_configs</code> trong PostgreSQL, tồn tại vĩnh viễn và không bị mất khi restart server.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-accent font-bold">•</span>
                <span>
                  <strong>Tự động áp dụng:</strong> Khi bạn lưu tên miền tại đây, tất cả các email chào mừng nhân viên, mã OTP đặt lại mật khẩu và liên kết phê duyệt đơn sẽ tự động dùng tên miền mới mà không cần sửa code.
                </span>
              </li>
            </ul>
          </Panel>

          {/* Quick Hub to Gmail Settings */}
          <div className="space-y-2.5 rounded-[13px] border border-status-ok-line bg-status-ok-soft p-4 text-xs">
            <div className="flex items-center gap-2 text-sm font-bold text-status-ok">
              <Mail className="h-4 w-4" />
              <span>Gmail SMTP doanh nghiệp</span>
            </div>
            <p className="text-[11px] leading-relaxed text-status-ok/80">
              Để các liên kết trên được gửi trực tiếp vào hòm thư Gmail của cán bộ nhân viên, hãy đảm bảo hệ thống đã kết nối tài khoản Google App Password.
            </p>
            <button
              type="button"
              onClick={() => setIsGmailModalOpen(true)}
              className="inline-flex items-center gap-1.5 font-bold text-xs text-status-ok hover:underline cursor-pointer pt-1"
            >
              <span>Mở bảng cấu hình Gmail</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Enterprise Gmail Setup Modal */}
      <EnterpriseGmailModal isOpen={isGmailModalOpen} onClose={() => setIsGmailModalOpen(false)} />
    </div>
  );
};
