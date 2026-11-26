import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  Briefcase,
  Building2,
  Calendar,
  Check,
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
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { useAuth } from '../../context/AuthContext';
import { getMyProfile, resizeAvatar, updateMyProfile } from '../../utils/profile';
import type { MyProfile } from '../../utils/profile';
import { ChangePasswordModal } from './ChangePasswordModal';
import { DEFAULT_THEME, useTheme } from '../../theme/ThemeContext';
import type { ThemeMeta } from '../../theme/ThemeContext';

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
  const { theme, themes, setTheme } = useTheme();
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
  const activeTheme = themes.find((t) => t.id === theme);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      {/* Đầu trang — mockup `.phead` */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-accent-dark">
            <UserIcon className="h-3.5 w-3.5" />
            Tuỳ chỉnh cá nhân
          </div>
          <h1 className="mt-1.5 font-display text-xl font-extrabold tracking-tight text-ink sm:text-[23px]">
            Hồ sơ cá nhân
          </h1>
          <p className="mt-1 text-xs text-ink-muted">
            Thông tin tài khoản, giao diện và cách bạn đăng nhập — {profile?.employeeCode || '—'}
          </p>
        </div>
        {!editing && (
          <Button variant="outline" size="md" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" /> Chỉnh sửa hồ sơ
          </Button>
        )}
      </div>

      {/* Hero — mockup `.hero` */}
      <div className="rounded-[14px] border border-line bg-surface p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative h-20 w-20 shrink-0">
            {profile?.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt={displayName}
                className="h-20 w-20 rounded-2xl border border-line object-cover shadow-2xs"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-accent text-3xl font-bold text-on-accent shadow-2xs">
                {initial}
              </div>
            )}
            {uploading && (
              <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/50 text-[10px] font-semibold text-white">
                Đang lưu…
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="truncate font-display text-[21px] font-extrabold tracking-[-0.02em] text-ink">
              {displayName || 'Hồ sơ cá nhân'}
            </h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <span className="font-mono text-[11.5px] text-ink-muted">{profile?.employeeCode}</span>
              {profile?.role && <Badge variant="accent">{ROLE_LABELS[profile.role] || profile.role}</Badge>}
              <Badge variant={status.variant}>{status.label}</Badge>
            </div>
            <div className="mt-1.5 text-xs text-ink-secondary">
              {[profile?.positionName, profile?.teamName].filter(Boolean).join(' · ') || 'Chưa cập nhật nhóm/chức danh'}
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleAvatarChange}
            />
            <Button variant="outline" size="md" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              <Upload className="h-3.5 w-3.5" /> Đổi ảnh
            </Button>
            {profile?.avatarUrl && (
              <Button variant="ghost" size="md" onClick={handleRemoveAvatar} disabled={uploading}>
                <Trash2 className="h-3.5 w-3.5" /> Xoá ảnh
              </Button>
            )}
          </div>
        </div>

        {/* 4 hành động nhanh */}
        <div className="mt-5 grid grid-cols-2 gap-2 border-t border-line-soft pt-5 sm:grid-cols-4">
          <button
            type="button"
            onClick={() => setPasswordOpen(true)}
            className="flex h-10 cursor-pointer items-center justify-center gap-2 rounded-[10px] border border-line bg-surface px-3 text-[12.5px] font-semibold text-ink transition-colors hover:bg-canvas-subtle"
          >
            <KeyRound className="h-[15px] w-[15px] shrink-0 text-accent" /> Đổi mật khẩu
          </button>
          <Link
            to="/account/passkey"
            className="flex h-10 items-center justify-center gap-2 rounded-[10px] border border-line bg-surface px-3 text-[12.5px] font-semibold text-ink transition-colors hover:bg-canvas-subtle"
          >
            <Fingerprint className="h-[15px] w-[15px] shrink-0 text-accent" /> Passkey
          </Link>
          <Link
            to="/auth/enroll-face"
            className="flex h-10 items-center justify-center gap-2 rounded-[10px] border border-line bg-surface px-3 text-[12.5px] font-semibold text-ink transition-colors hover:bg-canvas-subtle"
          >
            <ScanFace className="h-[15px] w-[15px] shrink-0 text-accent" /> Khuôn mặt
          </Link>
          <Link
            to="/attendance/devices"
            className="flex h-10 items-center justify-center gap-2 rounded-[10px] border border-line bg-surface px-3 text-[12.5px] font-semibold text-ink transition-colors hover:bg-canvas-subtle"
          >
            <Smartphone className="h-[15px] w-[15px] shrink-0 text-accent" /> Thiết bị
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-status-danger-line bg-status-danger-soft p-3 text-sm text-status-danger">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-xl border border-status-ok-line bg-status-ok-soft p-3 text-sm text-status-ok">
          {message}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {/* Thông tin cá nhân */}
        <Panel
          title="Thông tin cá nhân"
          subtitle="Bạn tự sửa được tên hiển thị và số điện thoại"
          action={
            !editing && (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                <Pencil className="h-3.5 w-3.5" /> Chỉnh sửa
              </Button>
            )
          }
        >
          {editing ? (
            <form onSubmit={handleSave} className="space-y-3">
              <div className="space-y-1">
                <label htmlFor="pf-name" className="text-xs font-semibold text-ink">Họ và tên</label>
                <input
                  id="pf-name"
                  value={form.fullName}
                  onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                  maxLength={150}
                  className="w-full rounded-[10px] border border-line bg-canvas px-3 py-2 text-xs text-ink focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/20"
                  required
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="pf-phone" className="text-xs font-semibold text-ink">Số điện thoại</label>
                <input
                  id="pf-phone"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  maxLength={20}
                  placeholder="Ví dụ: 0901234567"
                  className="w-full rounded-[10px] border border-line bg-canvas px-3 py-2 text-xs text-ink focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/20"
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
            <div className="text-xs">
              <InfoRow icon={<UserIcon className="h-4 w-4" />} label="Họ và tên" value={profile?.fullName} />
              <InfoRow icon={<Phone className="h-4 w-4" />} label="Số điện thoại" value={profile?.phone || 'Chưa cập nhật'} />
              <InfoRow
                icon={<Mail className="h-4 w-4" />}
                label="Email"
                value={profile?.email}
                hint="Dùng để đăng nhập — liên hệ HR nếu cần đổi"
              />
              <InfoRow
                icon={<Hash className="h-4 w-4" />}
                label="Tên đăng nhập"
                value={profile?.employeeCode}
                hint="Đăng nhập bằng mã nhân viên hoặc email"
              />
            </div>
          )}
        </Panel>

        {/* Công việc */}
        <Panel title="Công việc" subtitle="Thông tin do HR quản lý — liên hệ HR nếu cần điều chỉnh">
          <div className="text-xs">
            <InfoRow icon={<Users className="h-4 w-4" />} label="Nhóm" value={profile?.teamName || '—'} />
            <InfoRow icon={<Building2 className="h-4 w-4" />} label="Phòng ban" value={profile?.departmentName || '—'} />
            <InfoRow icon={<Briefcase className="h-4 w-4" />} label="Chức danh" value={profile?.positionName || '—'} />
            <InfoRow
              icon={<UserIcon className="h-4 w-4" />}
              label="Quản lý trực tiếp"
              value={profile?.managerName ? `${profile.managerName}${profile.managerCode ? ` (${profile.managerCode})` : ''}` : '—'}
            />
            <InfoRow icon={<Calendar className="h-4 w-4" />} label="Ngày vào làm" value={fmtDate(profile?.hireDate)} />
            <InfoRow
              icon={<Shield className="h-4 w-4" />}
              label="Vai trò"
              value={ROLE_LABELS[profile?.role || ''] || profile?.role || '—'}
            />
          </div>
        </Panel>
      </div>

      {/* Giao diện — 3 template màu, lưu theo tài khoản (DB) */}
      <Panel
        title="Giao diện"
        subtitle="Chọn template màu cho toàn bộ ứng dụng — lưu theo tài khoản, áp dụng trên mọi thiết bị"
        action={<Badge variant="gray">Đang dùng · {activeTheme?.name || '—'}</Badge>}
      >
        <div role="group" aria-label="Chọn giao diện" className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {themes.map((t) => {
            const on = t.id === theme;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTheme(t.id)}
                aria-pressed={on}
                title={t.description}
                className={`flex cursor-pointer items-start gap-3 rounded-[13px] border p-2.5 text-left transition-colors md:block ${
                  on
                    ? 'border-accent bg-accent-soft shadow-[0_0_0_3px_rgb(var(--accent)/0.18)]'
                    : 'border-line bg-surface hover:border-line-hover hover:bg-canvas-subtle'
                }`}
              >
                {/* Mobile: preview 108px bên trái · Desktop: preview full bên trên */}
                <div className="w-[108px] shrink-0 md:w-auto">
                  <ThemePreview preview={t.preview} />
                </div>
                <div className="min-w-0 flex-1 md:mt-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[12.5px] font-bold ${on ? 'text-accent-dark' : 'text-ink'}`}>{t.name}</span>
                    {on && <Check className="h-3.5 w-3.5 shrink-0 text-accent" />}
                    {t.id === DEFAULT_THEME && (
                      <span className="ml-auto text-[9px] font-bold uppercase tracking-[0.06em] text-ink-muted">
                        Mặc định
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-[10.5px] leading-[1.45] text-ink-muted">{t.description}</div>
                </div>
              </button>
            );
          })}
        </div>
      </Panel>

      {/* Thông báo */}
      <Panel title="Thông báo" subtitle="Chọn kênh nhận và khung giờ không làm phiền">
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-dark">
              <Bell className="h-4 w-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-ink">Tuỳ chỉnh thông báo</div>
              <div className="mt-0.5 text-[11px] text-ink-muted">
                Bật/tắt từng sự kiện theo Web · Email · Push, giới hạn số lần gửi và giờ yên lặng.
              </div>
            </div>
          </div>
          <Link to="/account/notifications" className="shrink-0">
            <Button variant="outline" size="sm">Tuỳ chỉnh</Button>
          </Link>
        </div>
      </Panel>

      {/* Bảo mật & đăng nhập */}
      <Panel title="Bảo mật & đăng nhập" subtitle="Quản lý cách bạn đăng nhập và xác thực">
        <div>
          <SecurityRow
            icon={<KeyRound className="h-4 w-4" />}
            title="Mật khẩu"
            desc="Đổi mật khẩu định kỳ để bảo vệ tài khoản."
            status={<Badge variant="gray">Đã thiết lập</Badge>}
            action={<Button variant="outline" size="sm" onClick={() => setPasswordOpen(true)}>Đổi mật khẩu</Button>}
          />
          <SecurityRow
            icon={<Fingerprint className="h-4 w-4" />}
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
            icon={<ScanFace className="h-4 w-4" />}
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
            icon={<Smartphone className="h-4 w-4" />}
            title="Thiết bị chấm công"
            desc="Quản lý điện thoại/máy tính được phép chấm công."
            status={null}
            action={<Link to="/attendance/devices"><Button variant="outline" size="sm">Xem thiết bị</Button></Link>}
          />
        </div>
      </Panel>

      <ChangePasswordModal
        isOpen={passwordOpen}
        onClose={() => setPasswordOpen(false)}
        onChanged={handlePasswordChanged}
      />
    </div>
  );
};

/**
 * Panel dùng chung — header tiêu đề + mô tả + hành động, thân là padding 14–16px.
 * Khác `Card` cũ ở chỗ viền bo 13px và header tách viền, khớp mockup `.panel`.
 */
const Panel: React.FC<{
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, subtitle, action, children }) => (
  <div className="overflow-hidden rounded-[13px] border border-line bg-surface shadow-2xs">
    <div className="flex flex-wrap items-start justify-between gap-2 border-b border-line px-4 py-3">
      <div className="min-w-0">
        <div className="text-[13.5px] font-bold tracking-[-0.01em] text-ink">{title}</div>
        {subtitle && <div className="mt-0.5 text-[11px] text-ink-muted">{subtitle}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
    <div className="p-4">{children}</div>
  </div>
);

const InfoRow: React.FC<{ icon: React.ReactNode; label: string; value?: string | null; hint?: string }> = ({
  icon,
  label,
  value,
  hint,
}) => (
  <div className="flex items-start gap-3 border-t border-line-soft py-2.5 first:border-t-0 first:pt-0 last:pb-0">
    <span className="mt-0.5 shrink-0 text-ink-muted">{icon}</span>
    <div className="min-w-0">
      <div className="text-[11px] text-ink-muted">{label}</div>
      <div className="break-words font-semibold text-ink">{value || '—'}</div>
      {hint && <div className="mt-0.5 text-[10.5px] text-ink-muted">{hint}</div>}
    </div>
  </div>
);

/**
 * Mini-mockup của một template: rail bên trái, vùng nội dung, các chấm trạng
 * thái + thanh accent. Dùng hex của chính template đó (không phải token) vì
 * mỗi ô đang quảng cáo màu của theme khác với theme đang bật.
 */
const ThemePreview: React.FC<{ preview: ThemeMeta['preview'] }> = ({ preview }) => (
  <div className="flex h-14 overflow-hidden rounded-lg border border-line md:h-16" aria-hidden="true">
    <div className="flex w-1/4 shrink-0 flex-col gap-1 p-1.5" style={{ background: preview.rail }}>
      <span className="h-1 rounded-full opacity-80" style={{ background: preview.ink }} />
      <span className="h-1 w-3/4 rounded-full opacity-40" style={{ background: preview.ink }} />
      <span className="h-1 w-2/3 rounded-full opacity-40" style={{ background: preview.ink }} />
    </div>
    <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-2" style={{ background: preview.surface }}>
      <span className="h-1.5 w-1/2 rounded-full opacity-80" style={{ background: preview.ink }} />
      <span className="h-1 w-full rounded-full opacity-20" style={{ background: preview.ink }} />
      <div className="mt-auto flex items-center gap-1">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: preview.ok }} />
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: preview.warn }} />
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: preview.danger }} />
        <span className="ml-0.5 h-2 flex-1 rounded-full" style={{ background: preview.brand }} />
      </div>
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
  <div className="flex flex-wrap items-center gap-3 border-t border-line-soft py-3 first:border-t-0 first:pt-0 last:pb-0">
    <span className="shrink-0 text-ink-muted">{icon}</span>
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[12.5px] font-semibold text-ink">{title}</span>
        {status}
      </div>
      <div className="mt-0.5 text-[11px] text-ink-muted">{desc}</div>
    </div>
    <div className="shrink-0">{action}</div>
  </div>
);
