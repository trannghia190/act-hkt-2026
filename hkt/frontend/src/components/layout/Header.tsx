import React, { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../common/Button';
import { Menu, Search, Camera, LogOut, Mail } from 'lucide-react';
import { NotificationDropdown } from './NotificationDropdown';
import { ThemeSwitcher } from './ThemeSwitcher';
import { VARIANTS } from '../../config/sidebar.config';

interface HeaderProps {
  onOpenCommandPalette: () => void;
  onOpenGmailModal: () => void;
  onLogout: () => void;
  onOpenMobileMenu?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenCommandPalette,
  onOpenGmailModal,
  onLogout,
  onOpenMobileMenu,
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // Tiêu đề ngữ cảnh trên topbar: lấy từ nav (nguồn sự thật), khớp path hoặc
  // màn cha gần nhất (vd. /okr/cycles/new → "Chu kỳ OKR").
  const navContext = useMemo(() => {
    const custom: Record<string, { group: string; label: string }> = {
      '/auth/enroll-face': { group: 'Tài khoản', label: 'Đăng ký khuôn mặt' },
      '/attendance/devices/add': { group: 'Chấm công', label: 'Đăng ký thiết bị' },
    };
    if (custom[pathname]) return custom[pathname];
    const flat = VARIANTS.admin.flatMap((g) =>
      g.items.map((i) => ({ group: g.groupName, label: i.label, path: i.path })),
    );
    const exact = flat.find((i) => i.path === pathname);
    if (exact) return exact;
    return flat
      .filter((i) => pathname.startsWith(`${i.path}/`))
      .sort((a, b) => b.path.length - a.path.length)[0] ?? null;
  }, [pathname]);
  const shortcutLabel =
    typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform)
      ? '⌘K'
      : 'Ctrl+K';

  return (
    <header className="h-[60px] border-b border-line bg-surface px-3 sm:px-6 flex items-center justify-between sticky top-0 z-20 shadow-2xs">
      {/* Left: Mobile Hamburger & Brand Badge */}
      <div className="flex shrink-0 items-center gap-2.5">
        {onOpenMobileMenu && (
          <button
            type="button"
            onClick={onOpenMobileMenu}
            className="lg:hidden grid h-9 w-9 place-items-center rounded-lg border border-line bg-canvas text-ink transition-colors hover:bg-canvas-subtle cursor-pointer"
            title="Mở menu danh mục"
            aria-label="Mở menu danh mục"
          >
            <Menu className="w-[18px] h-[18px]" />
          </button>
        )}

        {/* Desktop: tiêu đề ngữ cảnh thay cho badge trùng thương hiệu ở sidebar */}
        {navContext && (
          <div className="hidden min-w-0 lg:flex flex-col justify-center leading-tight">
            {navContext.group !== navContext.label && (
              <span className="text-[9.5px] font-extrabold uppercase tracking-[0.09em] text-accent-dark">
                {navContext.group}
              </span>
            )}
            <h2 className="truncate font-display text-[14px] font-extrabold tracking-tight text-ink">
              {navContext.label}
            </h2>
          </div>
        )}

      </div>

      {/* Giữa (desktop rộng): ô tìm kiếm lớn, điểm vào lệnh chính của app */}
      <div className="hidden min-w-0 flex-1 items-center justify-center px-4 lg:flex xl:px-8">
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="flex h-9 w-full max-w-[480px] items-center gap-2 rounded-[10px] border border-line bg-canvas px-3 text-[12.5px] text-ink-muted shadow-2xs transition-colors hover:border-line-hover hover:bg-canvas-subtle hover:text-ink-secondary cursor-pointer"
          title={`Tìm kiếm chức năng nhanh (${shortcutLabel})`}
          aria-label={`Tìm kiếm chức năng nhanh (${shortcutLabel})`}
        >
          <Search className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">Tìm kiếm nhanh…</span>
          <kbd className="ml-auto shrink-0 rounded bg-line px-1 font-mono text-[10px] font-bold">{shortcutLabel}</kbd>
        </button>
      </div>

      {/* Right: Quick Action Controls */}
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
        {/* Tìm kiếm compact ở tablet/màn hẹp — desktop rộng dùng ô giữa */}
        <button
          onClick={onOpenCommandPalette}
          className="grid h-9 w-9 sm:w-[220px] sm:px-3 md:w-[280px] lg:hidden place-items-center sm:flex sm:items-center gap-1.5 sm:gap-2 text-[12.5px] border border-line rounded-[10px] bg-canvas hover:bg-canvas-subtle text-ink-secondary cursor-pointer shadow-2xs transition-colors"
          title={`Tìm kiếm chức năng nhanh (${shortcutLabel})`}
          aria-label={`Tìm kiếm chức năng nhanh (${shortcutLabel})`}
        >
          <Search className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Tìm kiếm</span>
          <kbd className="hidden sm:inline text-[10px] bg-line px-1 rounded font-mono font-bold">{shortcutLabel}</kbd>
        </button>

        {/* Enterprise Gmail Setup Button — chỉ hiển thị cho HR và ADMIN */}
        {user && (user.role === 'ADMIN' || user.role === 'HR_ADMIN') && (
          <div className="hidden md:block">
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenGmailModal}
              className="text-xs gap-1.5 border-accent-line text-accent-dark hover:bg-accent-soft"
              title="Cấu hình gửi email thông báo qua Gmail SMTP (Chỉ dành cho HR & Admin)"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Gmail</span>
            </Button>
          </div>
        )}

        {/* Template / theme picker — mobile đổi theme trong Tuỳ chỉnh cá nhân */}
        <div className="hidden md:block">
          <ThemeSwitcher />
        </div>

        {/* Global Multi-channel Notification Center */}
        <NotificationDropdown />

        {/* Face Enrollment Quick Button — chỉ nhắc khi tài khoản chưa có mẫu mặt */}
        {user?.faceEnrolled === false && (
          <button
            onClick={() => navigate('/auth/enroll-face')}
            className="grid h-9 w-9 sm:w-auto sm:px-2.5 place-items-center sm:flex sm:items-center gap-1.5 text-xs rounded-lg border bg-status-warn-soft text-status-warn border-status-warn-line font-bold transition-colors cursor-pointer"
            title="Tài khoản chưa đăng ký khuôn mặt — bấm để đăng ký"
            aria-label="Tài khoản chưa đăng ký khuôn mặt — bấm để đăng ký"
          >
            <Camera className="w-3.5 h-3.5 text-accent" />
            <span className="hidden lg:inline">Chưa ĐK Mặt</span>
          </button>
        )}

        {/* User Profile Avatar & Logout */}
        <div className="flex items-center gap-2 pl-1 sm:pl-2 border-l border-line">
          <button
            type="button"
            onClick={() => navigate('/account/profile')}
            title="Hồ sơ cá nhân"
            className="flex h-9 items-center gap-2 rounded-lg px-1 transition-colors hover:bg-canvas cursor-pointer"
          >
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user?.fullName || 'Avatar'}
                className="w-7 h-7 rounded-full object-cover border border-line"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-accent text-on-accent flex items-center justify-center font-bold text-xs shadow-2xs">
                {user?.fullName?.charAt(0) || 'A'}
              </div>
            )}
            <div className="text-left text-xs hidden xl:block leading-tight">
              <div className="font-semibold text-ink truncate max-w-[92px] 2xl:max-w-[120px]">{user?.fullName}</div>
              <div className="text-[10px] text-ink-muted font-mono">{user?.employeeCode}</div>
            </div>
          </button>
          <button
            onClick={onLogout}
            className="grid h-9 w-9 place-items-center text-ink-muted hover:text-status-danger hover:bg-canvas rounded-lg transition-colors cursor-pointer"
            title="Đăng xuất khỏi hệ thống ACT-HKT"
            aria-label="Đăng xuất"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
