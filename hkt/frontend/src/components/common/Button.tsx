import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
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
  // Style tham chiếu mockup/redesign/index.html: nút cao 36px, bo 10px, chữ 13px/600.
  const baseStyles = 'inline-flex items-center justify-center font-semibold rounded-[10px] transition-all focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed select-none whitespace-nowrap';

  const sizeStyles = {
    sm: 'text-xs px-3 h-8 gap-1.5',
    md: 'text-[13px] px-[15px] h-9 gap-[7px]',
    lg: 'text-sm px-4 h-10 gap-2',
  };

  const variantStyles = {
    primary: 'bg-accent text-on-accent hover:bg-accent-hover shadow-sm',
    /** `.btn-sec` trong mockup: nền surface + viền line + chữ ink. */
    secondary: 'border border-line bg-surface text-ink hover:bg-canvas-subtle shadow-xs',
    /** `.btn-ghost` trong mockup: giống secondary nhưng chữ nhạt hơn. */
    outline: 'border border-line bg-surface text-ink-secondary hover:bg-canvas-subtle hover:text-ink',
    danger: 'bg-status-danger text-on-danger hover:bg-danger-hover shadow-sm',
    /** `.btn-quiet` trong mockup: không nền, không viền. */
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
