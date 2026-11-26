import React from 'react';

interface PanelProps {
  title?: string;
  subtitle?: string;
  /** Nội dung bên phải header (badge / nút). */
  action?: React.ReactNode;
  /** Bỏ header, chỉ giữ thân — dùng khi tiêu đề nằm ngoài panel. */
  hideHeader?: boolean;
  /** Class thêm cho thân (ví dụ `p-0` để bảng tự lo padding). */
  bodyClassName?: string;
  className?: string;
  children: React.ReactNode;
}

/**
 * Panel dùng chung — header tách viền + thân padding 14–16px, viền bo 13px.
 * Khác `Card` cũ: header có tiêu đề + mô tả (2 dòng) và số đếm, bo 13px,
 * body padding 16px. Khớp mockup `.panel` trong `mockups/redesign/screens/`.
 */
export const Panel: React.FC<PanelProps> = ({
  title,
  subtitle,
  action,
  hideHeader,
  bodyClassName = '',
  className = '',
  children,
}) => {
  const hasHeader = !hideHeader && (title || subtitle || action);
  return (
    <div className={`overflow-hidden rounded-[13px] border border-line bg-surface shadow-2xs ${className}`}>
      {hasHeader && (
        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-line px-4 py-3">
          <div className="min-w-0">
            {title && <div className="text-[13.5px] font-bold tracking-[-0.01em] text-ink">{title}</div>}
            {subtitle && <div className="mt-0.5 text-[11px] text-ink-muted">{subtitle}</div>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className={`p-4 ${bodyClassName}`}>{children}</div>
    </div>
  );
};
