import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, PRESET_USERS } from '../../context/AuthContext';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { ActHktLogo } from '../../components/common/ActHktLogo';

export const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('Admin');
  const [password, setPassword] = useState('Admin');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMessage, setForgotMessage] = useState<string | null>(null);

  const { login, loginAsPreset } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const success = await login(username, password);
      if (success) {
        navigate('/todo');
      } else {
        setError('Tài khoản hoặc mật khẩu không chính xác. Mặc định là Admin/Admin');
      }
    } catch (err: any) {
      setError(err?.message || 'Đăng nhập thất bại');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (key: keyof typeof PRESET_USERS) => {
    loginAsPreset(key);
    navigate('/todo');
  };

  const handleSendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotMessage(null);
    try {
      const res = await fetch('/api/v1/auth/reset-password-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
      });
      if (res.ok) {
        setForgotMessage(`Mã OTP đã được gửi về email ${forgotEmail}. Vui lòng kiểm tra hộp thư hoặc mở Mailpit (http://localhost:8025).`);
      } else {
        setForgotMessage('Đã phát lệnh gửi email đặt lại mật khẩu. Bạn có thể kiểm tra tại Mailpit: http://localhost:8025.');
      }
    } catch (err) {
      setForgotMessage('Đã mô phỏng gửi email OTP đặt lại mật khẩu qua hệ thống.');
    }
  };

  return (
    <div className="min-h-screen bg-canvas flex flex-col justify-center items-center p-4 select-none">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Banner */}
        <div className="text-center space-y-2 flex flex-col items-center">
          <ActHktLogo size="lg" />
          <p className="text-xs text-ink-muted mt-2">
            Hệ Thống Quản Trị Nhân Sự &amp; Hiệu Suất Toàn Diện (ACT-HKT 2026)
          </p>
        </div>

        {/* Login Form Card */}
        <div className="bg-surface rounded-2xl border border-line shadow-sm p-6 sm:p-8 space-y-5">
          <div>
            <h2 className="text-base font-bold text-ink">Đăng nhập tài khoản</h2>
            <p className="text-xs text-ink-secondary mt-0.5">
              Sử dụng tài khoản Quản trị <code className="font-mono font-bold text-accent">Admin / Admin</code> hoặc tài khoản nhân sự
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-ink mb-1.5">
                Mã nhân viên hoặc Email
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ví dụ: Admin hoặc admin@act-corp.internal"
                className="w-full text-xs p-2.5 rounded-lg border border-line bg-canvas focus:outline-none focus:border-accent font-medium text-ink"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-ink">Mật khẩu</label>
                <button
                  type="button"
                  onClick={() => setIsForgotPasswordOpen(true)}
                  className="text-[11px] text-accent hover:underline font-medium"
                >
                  Quên mật khẩu?
                </button>
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu..."
                className="w-full text-xs p-2.5 rounded-lg border border-line bg-canvas focus:outline-none focus:border-accent font-medium text-ink"
              />
            </div>

            <Button
              variant="primary"
              size="md"
              type="submit"
              disabled={loading}
              className="w-full py-2.5 font-bold"
            >
              {loading ? 'Đang xác thực...' : 'Đăng Nhập Vào Hệ Thống'}
            </Button>
          </form>

          {/* Quick Demo Accounts */}
          <div className="pt-4 border-t border-line space-y-2.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-ink-muted text-center">
              ⚡ Đăng nhập nhanh để test phân quyền (1-Click Login)
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => handleQuickLogin('admin')}
                className="p-2 rounded-lg border border-line bg-canvas hover:border-accent hover:bg-surface text-left transition-all"
              >
                <div className="font-bold text-accent">👑 Admin (Toàn quyền)</div>
                <div className="text-[10px] text-ink-muted">Admin / Admin</div>
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('hr')}
                className="p-2 rounded-lg border border-line bg-canvas hover:border-accent hover:bg-surface text-left transition-all"
              >
                <div className="font-bold text-ink">📋 HR Admin (Nhân sự)</div>
                <div className="text-[10px] text-ink-muted">01HR / Admin</div>
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('manager')}
                className="p-2 rounded-lg border border-line bg-canvas hover:border-accent hover:bg-surface text-left transition-all"
              >
                <div className="font-bold text-ink">👔 Manager (Quản lý)</div>
                <div className="text-[10px] text-ink-muted">05ACT / Admin</div>
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('employee')}
                className="p-2 rounded-lg border border-line bg-canvas hover:border-accent hover:bg-surface text-left transition-all"
              >
                <div className="font-bold text-ink">💻 Employee (Nhân viên)</div>
                <div className="text-[10px] text-ink-muted">136ACT / Admin</div>
              </button>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center text-[11px] text-ink-muted space-y-1">
          <p>Hệ thống hỗ trợ gửi thông báo và mã kích hoạt qua Gmail / Mailpit.</p>
          <p>
            Xem hộp thư giả lập SMTP tại: <a href="http://localhost:8025" target="_blank" rel="noreferrer" className="text-accent underline">http://localhost:8025</a>
          </p>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {isForgotPasswordOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsForgotPasswordOpen(false)}
          title="Quên Mật Khẩu &amp; Khôi Phục Tài Khoản"
          maxWidth="md"
        >
          <form onSubmit={handleSendReset} className="space-y-4 text-xs">
            <p className="text-ink-secondary leading-relaxed">
              Nhập email công ty đã đăng ký. Hệ thống sẽ tạo mã OTP xác thực và gửi hướng dẫn đặt lại mật khẩu về hộp thư của bạn.
            </p>

            <div>
              <label className="block font-semibold text-ink mb-1">Email tài khoản</label>
              <input
                type="email"
                required
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                placeholder="example@act-corp.internal hoặc email Gmail của bạn"
                className="w-full p-2 border border-line rounded-lg bg-canvas text-xs"
              />
            </div>

            {forgotMessage && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs leading-relaxed">
                {forgotMessage}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <Button variant="outline" size="sm" type="button" onClick={() => setIsForgotPasswordOpen(false)}>
                Đóng
              </Button>
              <Button variant="primary" size="sm" type="submit">
                Gửi Mã OTP Về Email
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
