import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Button } from '../../components/common/Button';
import { Eye, EyeOff, KeyRound, ArrowLeft, CheckCircle2, AlertCircle, Mail, ShieldCheck, Check, RefreshCw } from 'lucide-react';

export const ForgotPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const urlEmail = searchParams.get('email') || searchParams.get('employeeCode') || '';
  const urlOtp = searchParams.get('token') || searchParams.get('otp') || '';

  const [step, setStep] = useState<1 | 2>(() => {
    if (urlOtp) return 2;
    const savedStep = localStorage.getItem('pulse_reset_step');
    const savedEmail = localStorage.getItem('pulse_reset_email');
    if (savedStep === '2' && savedEmail) return 2;
    return 1;
  });

  const [emailOrCode, setEmailOrCode] = useState<string>(() => {
    return urlEmail || localStorage.getItem('pulse_reset_email') || '';
  });

  const [otp, setOtp] = useState<string>(() => {
    return urlOtp || localStorage.getItem('pulse_reset_otp') || '';
  });

  const [isAutoFilledFromLink, setIsAutoFilledFromLink] = useState<boolean>(Boolean(urlOtp));
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (urlEmail) {
      setEmailOrCode(urlEmail);
      localStorage.setItem('pulse_reset_email', urlEmail);
    }
    if (urlOtp) {
      setOtp(urlOtp);
      localStorage.setItem('pulse_reset_otp', urlOtp);
      localStorage.setItem('pulse_reset_step', '2');
      setIsAutoFilledFromLink(true);
      setStep(2);
    }
  }, [urlEmail, urlOtp]);

  // Tiêu chí mật khẩu
  const hasMinLength = newPassword.length >= 8;
  const hasUpper = /[A-Z]/.test(newPassword);
  const hasLower = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(newPassword);
  const isMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const isPasswordValid = hasMinLength && hasUpper && hasLower && hasNumber && hasSpecial;

  // Bước 1: Gửi OTP
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    const target = emailOrCode.trim();
    if (!target) {
      setError('Vui lòng nhập Email hoặc Mã nhân viên của bạn.');
      return;
    }

    setLoading(true);
    try {
      localStorage.setItem('pulse_reset_email', target);
      localStorage.setItem('pulse_reset_step', '2');
      const res = await fetch('/api/v1/auth/reset-password-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: target }),
      });
      const data = await res.json().catch(() => ({}));

      setMessage(
        data?.message ||
        `Mã OTP xác thực 6 chữ số đã được gửi tới email liên kết với tài khoản ${target}. Vui lòng kiểm tra hộp thư Gmail của bạn (hiệu lực 15 phút). Bạn có thể nhập mã OTP trực tiếp hoặc nhấp vào liên kết nhanh (1-click) trong email.`
      );
      setStep(2);
    } catch (err: any) {
      setMessage(`Mã OTP đã được gửi về email của bạn (nếu tài khoản tồn tại trong hệ thống).`);
      setStep(2);
    } finally {
      setLoading(false);
    }
  };

  // Bước 2: Xác nhận OTP & Đổi mật khẩu
  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanOtp = otp.trim();
    const cleanTarget = emailOrCode.trim();

    if (!cleanTarget) {
      setError('Thiếu thông tin Email/Mã nhân viên. Vui lòng quay lại bước 1.');
      return;
    }
    if (!cleanOtp) {
      setError('Vui lòng nhập mã OTP 6 chữ số nhận được trong email.');
      return;
    }
    if (!isPasswordValid) {
      setError('Mật khẩu mới chưa thỏa mãn đầy đủ các tiêu chuẩn bảo mật (chữ hoa, chữ thường, số và ký tự đặc biệt).');
      return;
    }
    if (!isMatch) {
      setError('Mật khẩu xác nhận không khớp với mật khẩu mới.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/v1/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanTarget,
          otp: cleanOtp,
          newPassword: newPassword,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        setSuccess(true);
        localStorage.removeItem('pulse_reset_email');
        localStorage.removeItem('pulse_reset_otp');
        localStorage.removeItem('pulse_reset_step');
        setTimeout(() => {
          navigate('/login', { state: { username: cleanTarget } });
        }, 2200);
      } else {
        setError(data?.message || 'Mã OTP không chính xác hoặc đã hết hạn (15 phút). Vui lòng thử lại hoặc yêu cầu mã mới.');
      }
    } catch (err: any) {
      setError(err?.message || 'Không thể kết nối đến máy chủ xác thực.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas select-none lg:grid lg:grid-cols-2">
      {/* ── Brand panel (Desktop) ────────────────────────────────── */}
      <aside className="relative hidden lg:flex flex-col overflow-hidden bg-[#101114] p-10 xl:p-12">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              'radial-gradient(600px 300px at 15% 12%, rgba(227,29,26,.34), transparent 65%), radial-gradient(500px 320px at 85% 88%, rgba(227,29,26,.16), transparent 62%)',
          }}
        />
        <img
          src="/brand/ascend_logo_2_white.png"
          alt="Ascend Technology"
          className="relative h-10 w-auto self-start"
        />
        <div className="relative mt-auto">
          <h2 className="font-display text-[30px] font-extrabold leading-[1.2] tracking-tight text-white">
            Khôi phục quyền truy cập<br />tài khoản an toàn.
          </h2>
          <p className="mt-3 max-w-[38ch] text-sm leading-relaxed text-[#A0A0A8]">
            Hệ thống bảo vệ đa lớp xác thực mã OTP gửi trực tiếp qua Gmail Doanh Nghiệp, đảm bảo an toàn tuyệt đối cho hồ sơ nhân sự của bạn.
          </p>
          <div className="mt-6 flex items-center gap-4 border-t border-[#212127] pt-5 text-xs text-[#7C7C88]">
            <span className="flex items-center gap-1.5 text-white/80 font-medium">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              Mã hóa bảo mật bcrypt
            </span>
            <span>•</span>
            <span>OTP hiệu lực 15 phút</span>
          </div>
        </div>
      </aside>

      {/* ── Main Form Area (Web & Mobile Web Responsive) ─────────── */}
      <main className="flex flex-col justify-center px-6 py-8 sm:px-10 lg:px-12 xl:px-16 max-w-lg mx-auto w-full">
        {/* Mobile Logo */}
        <div className="mb-6 lg:hidden flex justify-center">
          <img
            src="/brand/ascend_mark.png"
            alt="Ascend Tech"
            className="h-10 w-auto"
          />
        </div>

        {/* Form Card */}
        <div className="w-full">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-muted hover:text-accent transition-colors mb-6 group"
          >
            <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
            Quay lại trang Đăng nhập
          </Link>

          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-ink font-display">
              {step === 1 ? 'Quên mật khẩu tài khoản' : 'Thiết lập mật khẩu mới'}
            </h1>
            <p className="mt-1.5 text-xs text-ink-muted leading-relaxed">
              {step === 1
                ? 'Nhập Email hoặc Mã nhân viên để nhận mã xác thực OTP qua hòm thư điện tử.'
                : 'Nhập mã xác thực OTP từ email và thiết lập mật khẩu mới có độ bảo mật cao.'}
            </p>
          </div>

          {/* Alert Message */}
          {message && (
            <div className="mb-5 p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs leading-relaxed flex items-start gap-2.5">
              <Mail className="h-4 w-4 shrink-0 mt-0.5" />
              <div>{message}</div>
            </div>
          )}

          {/* Alert Error */}
          {error && (
            <div className="mb-5 p-3.5 rounded-xl border border-status-danger-line bg-status-danger-soft text-status-danger text-xs leading-relaxed flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>{error}</div>
            </div>
          )}

          {/* Success Notification */}
          {success ? (
            <div className="p-6 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-ink">Đặt lại mật khẩu thành công!</h3>
              <p className="text-xs text-ink-muted leading-relaxed">
                Mật khẩu mới của bạn đã được cập nhật thành công trên toàn hệ thống. Mọi phiên đăng nhập cũ đã được thu hồi an toàn.
              </p>
              <div className="pt-2 text-xs font-semibold text-accent flex items-center justify-center gap-1.5">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                Đang chuyển hướng về trang Đăng nhập...
              </div>
            </div>
          ) : step === 1 ? (
            /* BƯỚC 1: NHẬP EMAIL / MÃ NV */
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-ink mb-1.5">
                  Email công ty hoặc Mã nhân viên *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={emailOrCode}
                    onChange={(e) => setEmailOrCode(e.target.value)}
                    placeholder="Ví dụ: 01HR hoặc ha.nguyen@act-corp.internal"
                    className="w-full h-11 px-3.5 text-xs rounded-xl border border-line bg-surface focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 text-ink font-medium transition"
                  />
                </div>
                <p className="text-[11px] text-ink-muted mt-1">
                  Mã OTP 6 số sẽ được gửi tự động qua Gmail của tài khoản này.
                </p>
              </div>

              <Button
                variant="primary"
                size="md"
                type="submit"
                disabled={loading || !emailOrCode.trim()}
                className="w-full h-11 rounded-xl font-bold text-xs"
              >
                {loading ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    Đang gửi mã OTP...
                  </>
                ) : (
                  'Gửi Mã Xác Thực OTP Về Email →'
                )}
              </Button>
            </form>
          ) : (
            /* BƯỚC 2: NHẬP OTP & ĐỔI MẬT KHẨU */
            <form onSubmit={handleConfirmReset} className="space-y-4">
              {/* Account Identifier Badge */}
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-canvas border border-line text-xs">
                <div>
                  <span className="text-ink-muted text-[11px] block">Tài khoản đặt lại:</span>
                  <span className="font-bold text-ink">{emailOrCode}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem('pulse_reset_step');
                    localStorage.removeItem('pulse_reset_otp');
                    setOtp('');
                    setIsAutoFilledFromLink(false);
                    setStep(1);
                    setError(null);
                    setMessage(null);
                  }}
                  className="text-accent text-[11px] font-semibold hover:underline"
                >
                  Đổi tài khoản khác
                </button>
              </div>

              {/* One-Click verification badge */}
              {isAutoFilledFromLink && (
                <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2.5 font-medium leading-relaxed">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>
                    <strong>Xác thực 1-Click:</strong> Đã tự động nhận diện mã OTP hợp lệ từ liên kết Email. Bạn chỉ cần thiết lập mật khẩu mới bên dưới.
                  </span>
                </div>
              )}

              {/* OTP Input */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-ink">Mã xác thực OTP (6 chữ số) *</label>
                  {isAutoFilledFromLink ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full">
                      <Check className="h-3 w-3" /> Tự động điền từ liên kết
                    </span>
                  ) : (
                    <span className="text-[10px] text-ink-muted font-medium">Kiểm tra hộp thư Gmail</span>
                  )}
                </div>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={otp}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    setOtp(val);
                    localStorage.setItem('pulse_reset_otp', val);
                  }}
                  placeholder="• • • • • •"
                  className="w-full h-12 px-3 text-center font-mono font-black text-xl tracking-[0.35em] rounded-xl border border-line bg-surface focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 text-accent transition"
                />
              </div>

              {/* New Password Input */}
              <div>
                <label className="block text-xs font-semibold text-ink mb-1.5">
                  Mật khẩu mới *
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Nhập mật khẩu mới..."
                    className="w-full h-11 px-3.5 pr-10 text-xs rounded-xl border border-line bg-surface focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 text-ink transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-3 text-ink-muted hover:text-ink cursor-pointer"
                    title={showNewPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4 text-accent" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Realtime Password Strength Indicators */}
              <div className="p-3 rounded-xl bg-canvas border border-line text-[11px] space-y-1.5">
                <span className="font-bold text-ink block text-[10px] uppercase tracking-wider text-ink-muted">
                  Tiêu chuẩn mật khẩu an toàn:
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  <div className={`flex items-center gap-1.5 ${hasMinLength ? 'text-emerald-600 font-semibold' : 'text-ink-muted'}`}>
                    {hasMinLength ? <Check className="h-3 w-3" /> : <span className="w-1.5 h-1.5 rounded-full bg-line ml-1 mr-0.5" />}
                    Tối thiểu 8 ký tự
                  </div>
                  <div className={`flex items-center gap-1.5 ${hasUpper ? 'text-emerald-600 font-semibold' : 'text-ink-muted'}`}>
                    {hasUpper ? <Check className="h-3 w-3" /> : <span className="w-1.5 h-1.5 rounded-full bg-line ml-1 mr-0.5" />}
                    Chữ in hoa (A-Z)
                  </div>
                  <div className={`flex items-center gap-1.5 ${hasLower ? 'text-emerald-600 font-semibold' : 'text-ink-muted'}`}>
                    {hasLower ? <Check className="h-3 w-3" /> : <span className="w-1.5 h-1.5 rounded-full bg-line ml-1 mr-0.5" />}
                    Chữ in thường (a-z)
                  </div>
                  <div className={`flex items-center gap-1.5 ${hasNumber ? 'text-emerald-600 font-semibold' : 'text-ink-muted'}`}>
                    {hasNumber ? <Check className="h-3 w-3" /> : <span className="w-1.5 h-1.5 rounded-full bg-line ml-1 mr-0.5" />}
                    Chữ số (0-9)
                  </div>
                  <div className={`flex items-center gap-1.5 col-span-2 ${hasSpecial ? 'text-emerald-600 font-semibold' : 'text-ink-muted'}`}>
                    {hasSpecial ? <Check className="h-3 w-3" /> : <span className="w-1.5 h-1.5 rounded-full bg-line ml-1 mr-0.5" />}
                    Ký tự đặc biệt (!@#$%^&*...)
                  </div>
                </div>
              </div>

              {/* Confirm Password Input */}
              <div>
                <label className="block text-xs font-semibold text-ink mb-1.5">
                  Xác nhận lại mật khẩu mới *
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Nhập lại mật khẩu mới..."
                    className={`w-full h-11 px-3.5 pr-10 text-xs rounded-xl border bg-surface focus:outline-none transition ${
                      confirmPassword && !isMatch
                        ? 'border-status-danger focus:border-status-danger'
                        : confirmPassword && isMatch
                        ? 'border-emerald-500 focus:border-emerald-500'
                        : 'border-line focus:border-accent'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-3 text-ink-muted hover:text-ink cursor-pointer"
                    title={showConfirmPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4 text-accent" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {confirmPassword && !isMatch && (
                  <p className="text-[11px] text-status-danger mt-1">Mật khẩu xác nhận chưa khớp.</p>
                )}
              </div>

              <Button
                variant="primary"
                size="md"
                type="submit"
                disabled={loading || !isPasswordValid || !isMatch || !otp.trim()}
                className="w-full h-11 rounded-xl font-bold text-xs"
              >
                {loading ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    Đang cập nhật mật khẩu...
                  </>
                ) : (
                  'Xác Nhận Đặt Lại Mật Khẩu'
                )}
              </Button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={handleRequestOtp}
                  disabled={loading}
                  className="text-xs text-accent hover:underline font-semibold"
                >
                  Chưa nhận được mã? Bấm để gửi lại mã OTP
                </button>
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  );
};
