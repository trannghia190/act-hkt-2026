import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { ActHktLogo } from '../../components/common/ActHktLogo';
import { isWebAuthnSupported, loginWithPasskey as requestPasskeyLogin } from '../../utils/webauthn';

export const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('136ACT');
  const [password, setPassword] = useState('123456');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState<1 | 2>(1);
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetOtp, setResetOtp] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [forgotMessage, setForgotMessage] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const [passkeyLoading, setPasskeyLoading] = useState(false);

  const { login, loginWithPasskey } = useAuth();
  const navigate = useNavigate();
  const sessionExpired = new URLSearchParams(window.location.search).get('expired') === '1';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const success = await login(username, password);
      if (success) {
        navigate('/todo');
      } else {
        setError('Tài khoản hoặc mật khẩu không chính xác.');
      }
    } catch (err: any) {
      setError(err?.message || 'Đăng nhập thất bại');
    } finally {
      setLoading(false);
    }
  };

  /** Đăng nhập bằng passkey: Windows Hello / Touch ID / Face ID, không cần gõ mật khẩu. */
  const handlePasskeyLogin = async () => {
    setError(null);
    setPasskeyLoading(true);
    try {
      const session = await requestPasskeyLogin();
      loginWithPasskey(session);
      navigate('/todo');
    } catch (err: any) {
      setError(err?.message || 'Đăng nhập bằng passkey thất bại.');
    } finally {
      setPasskeyLoading(false);
    }
  };

  const handleSendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotMessage(null);
    setResetError(null);
    setResetLoading(true);
    try {
      const res = await fetch('/api/v1/auth/reset-password-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setForgotMessage(`Mã OTP đã được gửi về email ${forgotEmail}. Vui lòng kiểm tra hộp thư Gmail hoặc Mailpit (http://localhost:8025).`);
        setForgotStep(2);
      } else {
        setForgotMessage('Mã OTP xác thực đã được gửi về email của bạn (nếu tài khoản tồn tại trong hệ thống).');
        setForgotStep(2);
      }
    } catch (err) {
      setForgotMessage('Đã phát lệnh gửi mã OTP xác thực qua hệ thống.');
      setForgotStep(2);
    } finally {
      setResetLoading(false);
    }
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError(null);

    if (!resetOtp.trim()) {
      setResetError('Vui lòng nhập mã OTP xác thực 6 chữ số từ email.');
      return;
    }
    if (resetNewPassword.length < 8) {
      setResetError('Mật khẩu mới phải có ít nhất 8 ký tự.');
      return;
    }
    if (!/[A-Z]/.test(resetNewPassword) || !/[a-z]/.test(resetNewPassword) || !/[0-9]/.test(resetNewPassword)) {
      setResetError('Mật khẩu mới phải gồm chữ hoa, chữ thường và chữ số.');
      return;
    }
    if (resetNewPassword !== resetConfirmPassword) {
      setResetError('Mật khẩu xác nhận không khớp với mật khẩu mới.');
      return;
    }

    setResetLoading(true);
    try {
      const res = await fetch('/api/v1/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: forgotEmail,
          otp: resetOtp.trim(),
          newPassword: resetNewPassword,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setResetSuccess(true);
        setUsername(forgotEmail);
        setPassword(resetNewPassword);
        setTimeout(() => {
          setIsForgotPasswordOpen(false);
          setForgotStep(1);
          setResetSuccess(false);
          setForgotEmail('');
          setResetOtp('');
          setResetNewPassword('');
          setResetConfirmPassword('');
        }, 2000);
      } else {
        setResetError(data.message || 'Mã OTP không chính xác hoặc đã hết hạn.');
      }
    } catch (err: any) {
      setResetError(err?.message || 'Không thể kết nối đến máy chủ xác thực.');
    } finally {
      setResetLoading(false);
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
              Dùng tài khoản công ty do HR cấp · demo: <code className="font-mono font-bold text-accent">01HR</code> (HR), <code className="font-mono font-bold text-accent">05ACT</code> (Manager), <code className="font-mono font-bold text-accent">136ACT</code> (Nhân viên) — mật khẩu <code className="font-mono font-bold text-accent">123456</code>
            </p>
          </div>

          {sessionExpired && !error && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
              <span>⏳</span>
              <span>Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.</span>
            </div>
          )}
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
                placeholder="Mã nhân viên hoặc email"
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

            {isWebAuthnSupported() && (
              <>
                <div className="flex items-center gap-2">
                  <span className="h-px flex-1 bg-line" />
                  <span className="text-[10px] uppercase tracking-wide text-ink-muted">hoặc</span>
                  <span className="h-px flex-1 bg-line" />
                </div>
                <button
                  type="button"
                  onClick={handlePasskeyLogin}
                  disabled={passkeyLoading}
                  className="w-full py-2.5 rounded-lg border border-line bg-white text-xs font-bold text-ink hover:border-accent hover:text-accent transition disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  <span aria-hidden>🔐</span>
                  {passkeyLoading ? 'Đang xác thực vân tay/Face ID...' : 'Đăng nhập bằng Passkey (Vân tay / Face ID)'}
                </button>
              </>
            )}
          </form>
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
          onClose={() => {
            setIsForgotPasswordOpen(false);
            setForgotStep(1);
            setResetError(null);
            setForgotMessage(null);
          }}
          title={forgotStep === 1 ? "Quên Mật Khẩu — Bước 1/2: Nhận Mã OTP" : "Đặt Lại Mật Khẩu — Bước 2/2: Nhập OTP & Mật Khẩu Mới"}
          maxWidth="md"
        >
          {forgotStep === 1 ? (
            <form onSubmit={handleSendReset} className="space-y-4 text-xs">
              <p className="text-ink-secondary leading-relaxed">
                Nhập email công ty hoặc mã nhân viên đã đăng ký. Hệ thống sẽ tạo mã OTP xác thực 6 chữ số có hiệu lực trong 15 phút và gửi về hộp thư Gmail của bạn.
              </p>

              <div>
                <label className="block font-semibold text-ink mb-1">Email hoặc Mã nhân viên</label>
                <input
                  type="text"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="Ví dụ: 136ACT hoặc luan.vu@act-corp.internal"
                  className="w-full p-2 border border-line rounded-lg bg-canvas text-xs"
                />
              </div>

              {resetError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs leading-relaxed">
                  ⚠️ {resetError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-line">
                <Button variant="outline" size="sm" type="button" onClick={() => setIsForgotPasswordOpen(false)}>
                  Đóng
                </Button>
                <Button variant="primary" size="sm" type="submit" disabled={resetLoading}>
                  {resetLoading ? 'Đang gửi...' : 'Gửi Mã OTP Về Email →'}
                </Button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleConfirmReset} className="space-y-4 text-xs">
              {forgotMessage && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs leading-relaxed">
                  ✉️ {forgotMessage}
                </div>
              )}

              {resetSuccess && (
                <div className="p-4 bg-emerald-100 border border-emerald-300 text-emerald-900 rounded-lg text-xs font-bold text-center leading-relaxed">
                  🎉 Đặt lại mật khẩu thành công! Mật khẩu mới đã có hiệu lực ngay lập tức. Đang chuyển về màn hình đăng nhập...
                </div>
              )}

              {resetError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs leading-relaxed">
                  ⚠️ {resetError}
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-ink">Mã xác thực OTP (6 chữ số)</label>
                  <span className="text-[10px] text-ink-muted">Kiểm tra hộp thư Gmail</span>
                </div>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={resetOtp}
                  onChange={(e) => setResetOtp(e.target.value)}
                  placeholder="Nhập mã 6 chữ số (vd: 123456)"
                  className="w-full p-2.5 border border-line rounded-lg bg-canvas text-center font-mono font-bold text-base tracking-widest text-accent"
                />
              </div>

              <div>
                <label className="block font-semibold text-ink mb-1">Mật khẩu mới (tối thiểu 8 ký tự, gồm chữ hoa, số &amp; ký tự đặc biệt)</label>
                <input
                  type="password"
                  required
                  value={resetNewPassword}
                  onChange={(e) => setResetNewPassword(e.target.value)}
                  placeholder="Nhập mật khẩu mới..."
                  className="w-full p-2 border border-line rounded-lg bg-canvas text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-ink mb-1">Xác nhận mật khẩu mới</label>
                <input
                  type="password"
                  required
                  value={resetConfirmPassword}
                  onChange={(e) => setResetConfirmPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu mới..."
                  className="w-full p-2 border border-line rounded-lg bg-canvas text-xs"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => setForgotStep(1)}
                  className="text-xs text-ink-muted hover:text-ink hover:underline"
                >
                  ← Gửi lại mã OTP
                </button>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" type="button" onClick={() => setIsForgotPasswordOpen(false)}>
                    Hủy
                  </Button>
                  <Button variant="primary" size="sm" type="submit" disabled={resetLoading || resetSuccess}>
                    {resetLoading ? 'Đang cập nhật...' : 'Xác Nhận Đặt Lại Mật Khẩu'}
                  </Button>
                </div>
              </div>
            </form>
          )}
        </Modal>
      )}
    </div>
  );
};
