import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types/auth.types';
import { Button } from '../common/Button';
import { Menu, Search, Camera, LogOut } from 'lucide-react';
import { NotificationDropdown } from './NotificationDropdown';

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
  const { user, switchRole } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="h-14 border-b border-line bg-surface px-3 sm:px-6 flex items-center justify-between sticky top-0 z-20 shadow-2xs">
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

        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/todo')}>
          <span className="text-xs font-black tracking-tight px-2 py-0.5 rounded-md bg-accent-soft text-accent border border-accent-line font-mono">
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
          className="px-2 sm:px-2.5 py-1.5 text-xs border border-line rounded-lg bg-canvas hover:bg-surface text-ink-secondary flex items-center gap-1.5 sm:gap-2 cursor-pointer shadow-2xs transition-colors"
          title="Tìm kiếm chức năng nhanh (Ctrl+K)"
        >
          <Search className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Tìm kiếm</span>
          <kbd className="hidden sm:inline text-[10px] bg-line px-1 rounded font-mono font-bold">Ctrl+K</kbd>
        </button>

        {/* Enterprise Gmail Setup Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenGmailModal}
          className="text-xs gap-1.5 hidden md:inline-flex border-accent-line text-accent hover:bg-accent-soft"
          title="Cấu hình gửi email thông báo qua Gmail SMTP"
        >
          <span>📧</span>
          <span>Gmail</span>
        </Button>

        {/* Global Multi-channel Notification Center (S04) */}
        <NotificationDropdown />

        {/* Face Enrollment Quick Button (S01-B) */}
        <button
          onClick={() => navigate('/auth/enroll-face')}
          className={`px-2 sm:px-2.5 py-1.5 text-xs rounded-lg border flex items-center gap-1.5 transition-colors cursor-pointer ${
            user?.faceEnrolled === false
              ? 'bg-amber-500/10 text-amber-600 border-amber-500/30 animate-pulse font-bold'
              : 'border-line bg-canvas hover:bg-surface text-ink-secondary hidden sm:inline-flex'
          }`}
          title="Đăng ký mẫu khuôn mặt 3 góc (S01-B)"
        >
          <Camera className="w-3.5 h-3.5 text-accent" />
          <span className="hidden lg:inline">
            {user?.faceEnrolled === false ? 'Chưa ĐK Mặt' : 'ĐK Mặt (S01-B)'}
          </span>
        </button>

        {/* Role Switcher Dropdown (Phục vụ Manual Testing phân quyền) */}
        <div className="flex items-center gap-1 pl-1 sm:pl-2 border-l border-line text-xs">
          <select
            value={user?.role || 'ADMIN'}
            onChange={(e) => switchRole(e.target.value as UserRole)}
            className="text-[11px] sm:text-xs font-bold py-1 px-1.5 sm:px-2 border border-accent-line rounded-md bg-accent-soft text-accent focus:outline-none cursor-pointer max-w-[90px] sm:max-w-none"
            title="Chuyển vai trò nhanh để kiểm thử phân quyền"
          >
            <option value="ADMIN">👑 Admin</option>
            <option value="HR_ADMIN">👩‍💼 HR</option>
            <option value="MANAGER">👔 Lead</option>
            <option value="EMPLOYEE">👨‍💻 Dev</option>
          </select>
        </div>

        {/* User Profile Avatar & Logout */}
        <div className="flex items-center gap-2 pl-1 sm:pl-2 border-l border-line">
          <div className="w-7 h-7 rounded-full bg-accent text-white flex items-center justify-center font-bold text-xs shadow-2xs">
            {user?.fullName?.charAt(0) || 'A'}
          </div>
          <div className="text-left text-xs hidden xl:block leading-tight">
            <div className="font-semibold text-ink truncate max-w-[120px]">{user?.fullName}</div>
            <div className="text-[10px] text-ink-muted font-mono">{user?.employeeCode}</div>
          </div>
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
