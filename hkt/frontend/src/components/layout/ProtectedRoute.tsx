import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types/auth.types';
import { Button } from '../common/Button';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, switchRole } = useAuth();

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return (
      <div className="p-8 max-w-lg mx-auto my-12 bg-surface rounded-xl border border-line text-center space-y-4 shadow-sm">
        <div className="text-3xl">🛡️</div>
        <h2 className="text-lg font-bold text-ink">Quyền Truy Cập Bị Giới Hạn</h2>
        <p className="text-xs text-ink-muted leading-relaxed">
          Tính năng này yêu cầu quyền <strong>{allowedRoles.join(' hoặc ')}</strong>.
          Vai trò hiện tại của bạn là <strong>{user.role}</strong>.
        </p>
        <div className="p-3 bg-canvas rounded-lg text-xs text-ink-secondary text-left space-y-1">
          <div>• Tài khoản: <strong>{user.fullName}</strong> ({user.employeeCode})</div>
          <div>• Phòng ban: {user.department || 'Chưa thiết lập'}</div>
        </div>
        <div className="flex justify-center gap-2 pt-2">
          <Button variant="primary" size="sm" onClick={() => switchRole('ADMIN')}>
            👑 Chuyển sang vai trò Admin ngay
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.history.back()}>
            Quay lại
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
