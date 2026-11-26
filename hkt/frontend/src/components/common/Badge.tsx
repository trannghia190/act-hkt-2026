import React from 'react';

interface BadgeProps {
  variant?: 'ok' | 'warn' | 'danger' | 'info' | 'gray' | 'accent';
  children: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ variant = 'gray', children, className = '' }) => {
  const variantStyles = {
    ok: 'bg-status-ok-soft text-status-ok',
    warn: 'bg-status-warn-soft text-status-warn',
    danger: 'bg-status-danger-soft text-status-danger',
    info: 'bg-status-info-soft text-status-info',
    gray: 'bg-surface-secondary text-ink-secondary',
    accent: 'bg-accent-soft text-accent-dark',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-[2.5px] rounded-md ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
};
