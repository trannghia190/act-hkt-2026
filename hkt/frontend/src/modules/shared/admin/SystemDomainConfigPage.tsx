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
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Toast notification */}
      {toastMessage && (
        <div
          className={`fixed top-4 right-4 z-50 p-4 rounded-xl shadow-lg border flex items-center gap-3 text-xs font-semibold transition-all duration-300 animate-in fade-in slide-in-from-top-2 ${
            toastMessage.type === 'ok'
              ? 'bg-status-ok/10 border-status-ok/30 text-status-ok-line'
              : 'bg-status-danger/10 border-status-danger/30 text-status-danger-line'
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

      {/* Header Banner */}
      <div className="bg-surface border border-line rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 bg-accent/10 text-accent rounded-xl">
                <Globe className="w-5 h-5" />
              </span>
              <h1 className="text-xl font-extrabold tracking-tight text-ink">
                Cấu Hình Domain Host &amp; Base URL Hệ Thống
              </h1>
            </div>
            <p className="text-xs text-ink-muted leading-relaxed">
              Thiết lập tên miền gốc được hệ thống <strong>Ascend Tech</strong> sử dụng để tự động sinh toàn bộ liên kết điều hướng (Redirect URL) trong email thông báo, kích hoạt tài khoản, mã xác thực OTP và phê duyệt đơn.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchConfig}
              disabled={loading}
              className="gap-1.5 text-xs"
              title="Tải lại cấu hình từ Database"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Nạp lại</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsGmailModalOpen(true)}
              className="gap-1.5 text-xs border-accent-line text-accent-dark hover:bg-accent-soft"
              title="Cấu hình gửi email Gmail Doanh Nghiệp"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Thiết lập Gmail</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Main Settings Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Form & Presets */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-surface border border-line rounded-2xl p-6 shadow-xs space-y-5">
            <div className="border-b border-line pb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-sm text-ink">
                <Layers className="w-4 h-4 text-accent" />
                <span>Thiết Lập Tên Miền Gốc (Base Domain Host)</span>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-status-ok/10 text-status-ok font-bold border border-status-ok/20">
                Lưu Database Bền Vững
              </span>
            </div>

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

              <div className="pt-2 flex items-center justify-between border-t border-line">
                <div className="text-[11px] text-ink-muted flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-accent" />
                  <span>Thay đổi có hiệu lực ngay lập tức cho các email và thông báo tiếp theo</span>
                </div>
                <Button
                  type="submit"
                  size="sm"
                  disabled={saving || !isHrOrAdmin}
                  className="gap-1.5 text-xs bg-accent hover:bg-accent-dark text-on-accent font-bold"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{saving ? 'Đang lưu...' : 'Lưu Cấu Hình Domain'}</span>
                </Button>
              </div>
            </form>
          </div>

          {/* Live Preview Card */}
          <div className="bg-surface border border-line rounded-2xl p-6 shadow-xs space-y-4">
            <div className="border-b border-line pb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-sm text-ink">
                <Info className="w-4 h-4 text-status-ok" />
                <span>Xem Trước Các Liên Kết Tự Động Được Sinh Ra (Live Preview)</span>
              </div>
              <span className="text-[11px] text-ink-muted">Cập nhật theo Domain Host đang nhập</span>
            </div>

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
          </div>
        </div>

        {/* Right 1 Col: Status & Audit Info */}
        <div className="space-y-6">
          {/* Active Configuration Box */}
          <div className="bg-surface border border-line rounded-2xl p-5 shadow-xs space-y-4">
            <div className="font-bold text-xs text-ink uppercase tracking-wider border-b border-line pb-2 flex items-center justify-between">
              <span>Trạng Thái Cấu Hình Hiện Tại</span>
              <span className="w-2 h-2 rounded-full bg-status-ok animate-pulse" />
            </div>

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
          </div>

          {/* Business & Governance Rules */}
          <div className="bg-surface border border-line rounded-2xl p-5 shadow-xs space-y-3 text-xs">
            <div className="font-bold text-xs text-ink uppercase tracking-wider border-b border-line pb-2">
              Chính Sách &amp; An Toàn Tên Miền
            </div>
            <ul className="space-y-2.5 text-[11px] text-ink-muted leading-relaxed">
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
          </div>

          {/* Quick Hub to Gmail Settings */}
          <div className="bg-status-ok/10 border border-status-ok/30 rounded-2xl p-5 space-y-2.5 text-xs text-status-ok-line">
            <div className="flex items-center gap-2 font-bold text-sm">
              <Mail className="w-4 h-4 text-status-ok" />
              <span>Cấu Hình Gmail SMTP Doanh Nghiệp</span>
            </div>
            <p className="text-[11px] text-status-ok-line/80 leading-relaxed">
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
