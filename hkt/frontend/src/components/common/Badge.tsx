import React from 'react';

interface BadgeProps {
  variant?: 'ok' | 'warn' | 'danger' | 'info' | 'gray' | 'accent';
  children: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ variant = 'gray', children, className = '' }) => {
  const variantStyles = {
    ok: 'bg-status-ok-soft text-status-ok border-status-ok-line',
    warn: 'bg-status-warn-soft text-status-warn border-status-warn-line',
    danger: 'bg-status-danger-soft text-status-danger border-status-danger-line',
    info: 'bg-status-info-soft text-status-info border-status-info-line',
    gray: 'bg-surface-secondary text-ink-secondary border-line',
    accent: 'bg-accent-soft text-accent-dark border-accent-line',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md border ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
};
