import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'success' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-lg transition-all focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed select-none';

  const sizeStyles = {
    sm: 'text-xs px-2.5 py-1.5 gap-1.5',
    md: 'text-xs px-3.5 py-2 gap-2',
    lg: 'text-sm px-4 py-2.5 gap-2.5',
  };

  const variantStyles = {
    primary: 'bg-accent text-on-accent hover:bg-accent-hover shadow-sm',
    secondary: 'bg-btn-secondary text-btn-secondary-ink hover:bg-btn-secondary-hover shadow-sm',
    outline: 'border border-line bg-surface text-ink hover:bg-canvas',
    danger: 'bg-status-danger text-on-danger hover:bg-danger-hover shadow-sm',
    /** Chỉ dùng cho hành động DUYỆT / xác nhận kết quả tích cực — không dùng cho điều hướng, tab. */
    success: 'bg-status-ok text-on-ok hover:opacity-90 shadow-sm',
    ghost: 'text-ink-secondary hover:bg-canvas hover:text-ink',
  };

  return (
    <button
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
