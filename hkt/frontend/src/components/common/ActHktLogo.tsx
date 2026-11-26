import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

/**
 * Logo nhận diện **Ascend Technology** — dùng đúng lockup (mark + wordmark
 * "ascend") đã tách sẵn trong `public/brand`, khớp mockup thiết kế.
 *
 * - Bản đỏ (`ascend_lockup.png`) cho nền sáng.
 * - Bản trắng (`ascend_lockup_white.png`) cho rail tối (Midnight Rail / Bento).
 *   Đổi bản do CSS theo `data-theme` qua `.brand-logo-light/dark` trong index.css.
 */
export const ActHktLogo: React.FC<LogoProps> = ({ size = 'md', showText = true, className = '' }) => {
  const imgH = { sm: 'h-6', md: 'h-7', lg: 'h-10' }[size];

  return (
    <div className={`flex items-center gap-2.5 min-w-0 select-none ${className}`}>
      <img
        src="/brand/ascend_lockup.png"
        alt="Ascend Technology"
        className={`${imgH} w-auto object-contain shrink-0 brand-logo-light`}
      />
      <img
        src="/brand/ascend_lockup_white.png"
        alt=""
        aria-hidden="true"
        className={`${imgH} w-auto object-contain shrink-0 brand-logo-dark`}
      />

      {showText && (
        <div className="flex flex-col leading-[1.15] min-w-0">
          <b className="font-display text-[13.5px] font-extrabold tracking-tight text-ink truncate">ACT HR</b>
          <span className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-ink-muted brand-logo-subtitle truncate">
            Ascend Tech
          </span>
        </div>
      )}
    </div>
  );
};
