import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  Briefcase,
  Calendar,
  Fingerprint,
  Hash,
  KeyRound,
  Mail,
  Pencil,
  Phone,
  ScanFace,
  Shield,
  Smartphone,
  Trash2,
  Upload,
  User as UserIcon,
  Users,
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { useAuth } from '../../context/AuthContext';
import { getMyProfile, resizeAvatar, updateMyProfile } from '../../utils/profile';
import type { MyProfile } from '../../utils/profile';
import { ChangePasswordModal } from './ChangePasswordModal';

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Quản trị viên',
  HR_ADMIN: 'Nhân sự',
  MANAGER: 'Quản lý',
  EMPLOYEE: 'Nhân viên',
};

const STATUS_LABELS: Record<string, { label: string; variant: 'ok' | 'warn' | 'danger' | 'gray' }> = {
  ACTIVE: { label: 'Đang hoạt động', variant: 'ok' },
  PENDING_ACTIVATION: { label: 'Chờ kích hoạt', variant: 'warn' },
  LOCKED: { label: 'Đã khoá', variant: 'danger' },
  INACTIVE: { label: 'Ngừng hoạt động', variant: 'gray' },
};

const fmtDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString('vi-VN') : '—';

export const ProfilePage: React.FC = () => {
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ fullName: '', phone: '' });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);

  // Command Palette: mở thẳng form đổi mật khẩu (CORE-CMD-02).
  useEffect(() => {
    if ((location.state as { openPassword?: boolean } | null)?.openPassword) {
      setPasswordOpen(true);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state, location.pathname, navigate]);

  useEffect(() => {
    getMyProfile()
      .then((p) => {
        setProfile(p);
        setForm({ fullName: p.fullName || '', phone: p.phone || '' });
        // Đồng bộ cờ khuôn mặt/passkey vào header — phiên đăng nhập cũ có thể đã lệch.
        updateUser({ faceEnrolled: p.faceEnrolled, hasPasskey: p.hasPasskey });
      })
      .catch((e: any) => setError(e?.message || 'Không tải được hồ sơ cá nhân.'))
      .finally(() => setLoading(false));
  }, []);

  const applyProfile = (p: MyProfile) => {
    setProfile(p);
    setForm({ fullName: p.fullName || '', phone: p.phone || '' });
    updateUser({
      fullName: p.fullName,
      avatarUrl: p.avatarUrl || undefined,
      email: p.email,
      faceEnrolled: p.faceEnrolled,
      hasPasskey: p.hasPasskey,
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (!form.fullName.trim()) {
      setError('Họ tên không được để trống.');
      return;
    }
    setSaving(true);
    try {
      const p = await updateMyProfile({ fullName: form.fullName.trim(), phone: form.phone.trim() });
      applyProfile(p);
      setEditing(false);
      setMessage('Đã cập nhật thông tin cá nhân.');
    } catch (e: any) {
      setError(e?.message || 'Không lưu được thông tin.');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    setMessage(null);
    setUploading(true);
    try {
      const avatarUrl = await resizeAvatar(file);
      const p = await updateMyProfile({ avatarUrl });
      applyProfile(p);
      setMessage('Đã cập nhật ảnh đại diện.');
    } catch (e: any) {
      setError(e?.message || 'Không cập nhật được ảnh đại diện.');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!window.confirm('Xoá ảnh đại diện? Hệ thống sẽ hiển thị chữ cái đầu của tên.')) return;
    setError(null);
    setMessage(null);
    setUploading(true);
    try {
      const p = await updateMyProfile({ avatarUrl: '' });
      applyProfile(p);
      setMessage('Đã xoá ảnh đại diện.');
    } catch (e: any) {
      setError(e?.message || 'Không xoá được ảnh đại diện.');
    } finally {
      setUploading(false);
    }
  };

  const handlePasswordChanged = () => {
    logout();
    navigate('/login', { replace: true });
  };

  if (loading) {
    return <div className="max-w-5xl mx-auto py-16 text-center text-sm text-ink-muted">Đang tải hồ sơ…</div>;
  }

  const displayName = profile?.fullName || user?.fullName || '';
  const initial = displayName.charAt(0).toUpperCase() || 'A';
  const status = STATUS_LABELS[profile?.status || ''] || { label: profile?.status || '—', variant: 'gray' as const };

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* Hero */}
      <div className="bg-canvas border border-line rounded-2xl p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="relative w-20 h-20 shrink-0">
            {profile?.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt={displayName}
                className="w-20 h-20 rounded-2xl object-cover border border-line shadow-2xs"
              />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-accent text-on-accent flex items-center justify-center text-3xl font-bold shadow-2xs">
                {initial}
              </div>
            )}
            {uploading && (
              <div className="absolute inset-0 rounded-2xl bg-black/50 flex items-center justify-center text-[10px] text-white font-semibold">
                Đang lưu…
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-ink truncate">{displayName || 'Hồ sơ cá nhân'}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              <span className="text-xs font-mono text-ink-muted">{profile?.employeeCode}</span>
              {profile?.role && <Badge variant="accent">{ROLE_LABELS[profile.role] || profile.role}</Badge>}
              <Badge variant={status.variant}>{status.label}</Badge>
            </div>
            <div className="text-xs text-ink-secondary mt-1.5">
              {[profile?.positionName, profile?.teamName].filter(Boolean).join(' · ') || 'Chưa cập nhật nhóm/chức danh'}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleAvatarChange}
            />
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              <Upload className="w-3.5 h-3.5" /> Đổi ảnh
            </Button>
            {profile?.avatarUrl && (
              <Button variant="ghost" size="sm" onClick={handleRemoveAvatar} disabled={uploading}>
                <Trash2 className="w-3.5 h-3.5" /> Xoá ảnh
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-5">
          <button
            type="button"
            onClick={() => setPasswordOpen(true)}
            className="flex items-center gap-2 justify-center rounded-xl border border-line bg-surface px-3 py-2.5 text-xs font-medium text-ink hover:bg-canvas transition-colors"
          >
            <KeyRound className="w-4 h-4 text-accent" /> Đổi mật khẩu
          </button>
          <Link
            to="/account/passkey"
            className="flex items-center gap-2 justify-center rounded-xl border border-line bg-surface px-3 py-2.5 text-xs font-medium text-ink hover:bg-canvas transition-colors"
          >
            <Fingerprint className="w-4 h-4 text-accent" /> Passkey
          </Link>
          <Link
            to="/auth/enroll-face"
            className="flex items-center gap-2 justify-center rounded-xl border border-line bg-surface px-3 py-2.5 text-xs font-medium text-ink hover:bg-canvas transition-colors"
          >
            <ScanFace className="w-4 h-4 text-accent" /> Khuôn mặt
          </Link>
          <Link
            to="/attendance/devices"
            className="flex items-center gap-2 justify-center rounded-xl border border-line bg-surface px-3 py-2.5 text-xs font-medium text-ink hover:bg-canvas transition-colors"
          >
            <Smartphone className="w-4 h-4 text-accent" /> Thiết bị
          </Link>
        </div>
      </div>

      {error && (
        <div className="text-sm text-status-danger bg-status-danger-soft border border-status-danger-line rounded-xl p-3">{error}</div>
      )}
      {message && (
        <div className="text-sm text-status-ok bg-status-ok-soft border border-status-ok-line rounded-xl p-3">{message}</div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {/* Thông tin cá nhân */}
        <Card
          title="Thông tin cá nhân"
          subtitle="Bạn có thể tự sửa tên hiển thị và số điện thoại"
          action={
            !editing && (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                <Pencil className="w-3.5 h-3.5" /> Chỉnh sửa
              </Button>
            )
          }
        >
          {editing ? (
            <form onSubmit={handleSave} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-ink">Họ và tên</label>
                <input
                  value={form.fullName}
                  onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                  maxLength={150}
                  className="w-full px-3 py-2 bg-canvas border border-line rounded-lg text-xs focus:outline-none focus:border-accent"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-ink">Số điện thoại</label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  maxLength={20}
                  placeholder="Ví dụ: 0901234567"
                  className="w-full px-3 py-2 bg-canvas border border-line rounded-lg text-xs focus:outline-none focus:border-accent"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditing(false);
                    setForm({ fullName: profile?.fullName || '', phone: profile?.phone || '' });
                    setError(null);
                  }}
                  disabled={saving}
                >
                  Huỷ
                </Button>
                <Button type="submit" size="sm" disabled={saving}>
                  {saving ? 'Đang lưu…' : 'Lưu thay đổi'}
                </Button>
              </div>
            </form>
          ) : (
            <div className="divide-y divide-line text-xs">
              <InfoRow icon={<UserIcon className="w-4 h-4" />} label="Họ và tên" value={profile?.fullName} />
              <InfoRow icon={<Phone className="w-4 h-4" />} label="Số điện thoại" value={profile?.phone || 'Chưa cập nhật'} />
              <InfoRow
                icon={<Mail className="w-4 h-4" />}
                label="Email"
                value={profile?.email}
                hint="Dùng để đăng nhập — liên hệ HR nếu cần đổi"
              />
              <InfoRow
                icon={<Hash className="w-4 h-4" />}
                label="Tên đăng nhập"
                value={profile?.employeeCode}
                hint="Đăng nhập bằng mã nhân viên hoặc email"
              />
            </div>
          )}
        </Card>

        {/* Công việc */}
        <Card title="Công việc" subtitle="Thông tin do HR quản lý — liên hệ HR nếu cần điều chỉnh">
          <div className="divide-y divide-line text-xs">
            <InfoRow icon={<Users className="w-4 h-4" />} label="Nhóm" value={profile?.teamName || '—'} />
            <InfoRow icon={<Briefcase className="w-4 h-4" />} label="Phòng ban" value={profile?.departmentName || '—'} />
            <InfoRow icon={<Briefcase className="w-4 h-4" />} label="Chức danh" value={profile?.positionName || '—'} />
            <InfoRow
              icon={<UserIcon className="w-4 h-4" />}
              label="Quản lý trực tiếp"
              value={profile?.managerName ? `${profile.managerName}${profile.managerCode ? ` (${profile.managerCode})` : ''}` : '—'}
            />
            <InfoRow icon={<Calendar className="w-4 h-4" />} label="Ngày vào làm" value={fmtDate(profile?.hireDate)} />
            <InfoRow
              icon={<Shield className="w-4 h-4" />}
              label="Vai trò"
              value={ROLE_LABELS[profile?.role || ''] || profile?.role || '—'}
            />
          </div>
        </Card>
      </div>

      {/* Thông báo */}
      <Card title="Thông báo" subtitle="Chọn kênh nhận và khung giờ không làm phiền">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-accent-soft text-accent-dark flex items-center justify-center shrink-0">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-ink">Tuỳ chỉnh thông báo</div>
              <div className="text-[11px] text-ink-muted mt-0.5">
                Bật/tắt từng sự kiện theo Web · Email · Push, giới hạn số lần gửi và giờ yên lặng.
              </div>
            </div>
          </div>
          <Link to="/account/notifications">
            <Button variant="outline" size="sm">Tuỳ chỉnh</Button>
          </Link>
        </div>
      </Card>

      {/* Bảo mật & đăng nhập */}
      <Card title="Bảo mật & đăng nhập" subtitle="Quản lý cách bạn đăng nhập và xác thực">
        <div className="divide-y divide-line">
          <SecurityRow
            icon={<KeyRound className="w-4 h-4" />}
            title="Mật khẩu"
            desc="Đổi mật khẩu định kỳ để bảo vệ tài khoản."
            status={<Badge variant="gray">Đã thiết lập</Badge>}
            action={<Button variant="outline" size="sm" onClick={() => setPasswordOpen(true)}>Đổi mật khẩu</Button>}
          />
          <SecurityRow
            icon={<Fingerprint className="w-4 h-4" />}
            title="Passkey"
            desc="Đăng nhập nhanh bằng vân tay / Face ID / Windows Hello."
            status={
              profile?.hasPasskey
                ? <Badge variant="ok">Đã đăng ký</Badge>
                : <Badge variant="warn">Chưa đăng ký</Badge>
            }
            action={<Link to="/account/passkey"><Button variant="outline" size="sm">Quản lý</Button></Link>}
          />
          <SecurityRow
            icon={<ScanFace className="w-4 h-4" />}
            title="Khuôn mặt chấm công"
            desc="Bắt buộc để chấm công bằng camera."
            status={
              profile?.faceEnrolled
                ? <Badge variant="ok">Đã đăng ký</Badge>
                : <Badge variant="warn">Chưa đăng ký</Badge>
            }
            action={<Link to="/auth/enroll-face"><Button variant="outline" size="sm">Đăng ký</Button></Link>}
          />
          <SecurityRow
            icon={<Smartphone className="w-4 h-4" />}
            title="Thiết bị chấm công"
            desc="Quản lý điện thoại/máy tính được phép chấm công."
            status={null}
            action={<Link to="/attendance/devices"><Button variant="outline" size="sm">Xem thiết bị</Button></Link>}
          />
        </div>
      </Card>

      <ChangePasswordModal
        isOpen={passwordOpen}
        onClose={() => setPasswordOpen(false)}
        onChanged={handlePasswordChanged}
      />
    </div>
  );
};

const InfoRow: React.FC<{ icon: React.ReactNode; label: string; value?: string | null; hint?: string }> = ({
  icon,
  label,
  value,
  hint,
}) => (
  <div className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
    <span className="text-ink-muted mt-0.5">{icon}</span>
    <div className="min-w-0">
      <div className="text-[11px] text-ink-muted">{label}</div>
      <div className="font-medium text-ink break-words">{value || '—'}</div>
      {hint && <div className="text-[10px] text-ink-muted mt-0.5">{hint}</div>}
    </div>
  </div>
);

const SecurityRow: React.FC<{
  icon: React.ReactNode;
  title: string;
  desc: string;
  status: React.ReactNode;
  action: React.ReactNode;
}> = ({ icon, title, desc, status, action }) => (
  <div className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
    <span className="text-ink-muted">{icon}</span>
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold text-ink">{title}</span>
        {status}
      </div>
      <div className="text-[11px] text-ink-muted mt-0.5">{desc}</div>
    </div>
    <div className="shrink-0">{action}</div>
  </div>
);
