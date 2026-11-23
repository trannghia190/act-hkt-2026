import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Đổi mật khẩu thành công — server đã thu hồi mọi phiên nên cần đăng nhập lại. */
  onChanged: () => void;
}

const validatePasswordStrength = (pass: string): string | null => {
  if (pass.length < 8) return 'Mật khẩu phải chứa ít nhất 8 ký tự.';
  if (!/[A-Z]/.test(pass)) return 'Mật khẩu phải chứa ít nhất 1 chữ cái in hoa (A-Z).';
  if (!/[a-z]/.test(pass)) return 'Mật khẩu phải chứa ít nhất 1 chữ cái in thường (a-z).';
  if (!/[0-9]/.test(pass)) return 'Mật khẩu phải chứa ít nhất 1 chữ số (0-9).';
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pass)) return 'Mật khẩu phải chứa ít nhất 1 ký tự đặc biệt (!@#$...).';
  return null;
};

export const ChangePasswordModal: React.FC<Props> = ({ isOpen, onClose, onChanged }) => {
  const { user } = useAuth();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const reset = () => {
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError(null);
    setSuccess(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!oldPassword) {
      setError('Vui lòng nhập mật khẩu hiện tại.');
      return;
    }
    const strengthErr = validatePasswordStrength(newPassword);
    if (strengthErr) {
      setError(strengthErr);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }
    if (newPassword === oldPassword) {
      setError('Mật khẩu mới không được trùng với mật khẩu cũ.');
      return;
    }

    setSubmitting(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (user?.accessToken) headers.Authorization = `Bearer ${user.accessToken}`;

      const res = await fetch('/api/v1/auth/change-password', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          employeeCode: user?.employeeCode,
          oldPassword,
          newPassword,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        setError(json.message || 'Không đổi được mật khẩu — vui lòng thử lại.');
        return;
      }
      setSuccess(true);
      setTimeout(onChanged, 1500);
    } catch {
      setError('Không kết nối được máy chủ — vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md bg-surface rounded-2xl shadow-xl border border-line p-6 space-y-4">
        <div>
          <h2 className="text-base font-bold text-ink">Đổi mật khẩu</h2>
          <p className="text-xs text-ink-muted mt-1">
            Sau khi đổi, mọi phiên đăng nhập sẽ bị thu hồi — bạn cần đăng nhập lại.
          </p>
        </div>

        {success ? (
          <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
            Đã đổi mật khẩu. Đang đăng xuất để đăng nhập lại…
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            {error && (
              <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2.5">
                {error}
              </div>
            )}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-ink">Mật khẩu hiện tại</label>
              <input
                autoFocus
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full px-3 py-2 bg-canvas border border-line rounded-lg text-xs focus:outline-none focus:border-accent"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-ink">Mật khẩu mới</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Ít nhất 8 ký tự, có hoa/thường/số/ký tự đặc biệt"
                autoComplete="new-password"
                className="w-full px-3 py-2 bg-canvas border border-line rounded-lg text-xs focus:outline-none focus:border-accent"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-ink">Xác nhận mật khẩu mới</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                className="w-full px-3 py-2 bg-canvas border border-line rounded-lg text-xs focus:outline-none focus:border-accent"
                required
              />
            </div>
            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={handleClose}
                disabled={submitting}
                className="px-4 py-2 text-xs font-medium text-ink-secondary hover:text-ink hover:bg-canvas rounded-lg disabled:opacity-50"
              >
                Huỷ
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 text-xs font-semibold bg-accent text-white rounded-lg hover:bg-accent-hover transition-all disabled:opacity-50"
              >
                {submitting ? 'Đang cập nhật…' : 'Đổi mật khẩu'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
