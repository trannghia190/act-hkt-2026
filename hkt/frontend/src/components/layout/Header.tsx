import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../common/Button';
import { Menu, Search, Camera, LogOut, Mail } from 'lucide-react';
import { NotificationDropdown } from './NotificationDropdown';
import { ThemeSwitcher } from './ThemeSwitcher';

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
  const shortcutLabel =
    typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform)
      ? '⌘K'
      : 'Ctrl+K';

  return (
    <header className="h-[60px] border-b border-line bg-surface px-3 sm:px-6 flex items-center justify-between sticky top-0 z-20 shadow-2xs">
      {/* Left: Mobile Hamburger & Brand Badge */}
      <div className="flex items-center gap-2.5">
        {onOpenMobileMenu && (
          <button
            type="button"
            onClick={onOpenMobileMenu}
            className="lg:hidden p-1.5 rounded-lg border border-line bg-canvas hover:bg-canvas-subtle text-ink cursor-pointer"
            title="Mở menu danh mục"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div className="flex items-center gap-2 cursor-pointer shrink-0" onClick={() => navigate('/todo')}>
          <span className="text-xs font-black tracking-tight px-2 py-0.5 rounded-md bg-accent-soft text-accent-dark border border-accent-line font-mono whitespace-nowrap">
            ACT-HKT
          </span>
          <span className="text-[11px] text-ink-muted hidden md:inline font-medium">
            · Worklife &amp; Performance
          </span>
        </div>
      </div>

      {/* Right: Quick Action Controls */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Quick Search Button (Desktop: with Ctrl+K shortcut, Mobile: icon button) */}
        <button
          onClick={onOpenCommandPalette}
          className="h-9 px-2.5 sm:px-3 text-[12.5px] border border-line rounded-[10px] bg-canvas hover:bg-canvas-subtle text-ink-secondary flex items-center gap-1.5 sm:gap-2 cursor-pointer shadow-2xs transition-colors"
          title={`Tìm kiếm chức năng nhanh (${shortcutLabel})`}
        >
          <Search className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Tìm kiếm</span>
          <kbd className="hidden sm:inline text-[10px] bg-line px-1 rounded font-mono font-bold">{shortcutLabel}</kbd>
        </button>

        {/* Enterprise Gmail Setup Button — ẩn trên mobile để header không bị chật.
            Bọc ngoài vì Button luôn có `inline-flex`, class `hidden` trên chính nó
            có thể bị luật display của Tailwind ghi đè. */}
        <div className="hidden md:block">
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenGmailModal}
            className="text-xs gap-1.5 border-accent-line text-accent-dark hover:bg-accent-soft"
            title="Cấu hình gửi email thông báo qua Gmail SMTP"
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Gmail</span>
          </Button>
        </div>

        {/* Template / theme picker */}
        <ThemeSwitcher />

        {/* Global Multi-channel Notification Center */}
        <NotificationDropdown />

        {/* Face Enrollment Quick Button — chỉ nhắc khi tài khoản chưa có mẫu mặt */}
        {user?.faceEnrolled === false && (
          <button
            onClick={() => navigate('/auth/enroll-face')}
            className="px-2 sm:px-2.5 py-1.5 text-xs rounded-lg border flex items-center gap-1.5 transition-colors cursor-pointer bg-status-warn-soft text-status-warn border-status-warn-line font-bold"
            title="Tài khoản chưa đăng ký khuôn mặt — bấm để đăng ký"
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
            className="flex items-center gap-2 rounded-lg px-1 py-0.5 hover:bg-canvas transition-colors cursor-pointer"
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
              <div className="font-semibold text-ink truncate max-w-[120px]">{user?.fullName}</div>
              <div className="text-[10px] text-ink-muted font-mono">{user?.employeeCode}</div>
            </div>
          </button>
          <button
            onClick={onLogout}
            className="p-1.5 text-ink-muted hover:text-status-danger hover:bg-canvas rounded-lg transition-colors cursor-pointer"
            title="Đăng xuất khỏi hệ thống ACT-HKT"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
