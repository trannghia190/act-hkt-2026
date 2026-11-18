import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

export const ActHktLogo: React.FC<LogoProps> = ({ size = 'md', showText = true, className = '' }) => {
  const iconSizes = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-12 h-12 text-base',
  };

  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      {/* High-tech Geometric Shield / Biometric Pulse Icon */}
      <div
        className={`${iconSizes[size]} relative rounded-xl bg-gradient-to-br from-emerald-500 via-teal-600 to-emerald-700 flex items-center justify-center font-black text-white shadow-md shadow-emerald-950/40 ring-1 ring-emerald-400/40 shrink-0 overflow-hidden group`}
      >
        {/* Decorative background grid pattern */}
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:6px_6px]" />

        {/* Dynamic Biometric Pulse SVG Wave */}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-5 h-5 text-white drop-shadow-sm transition-transform duration-300 group-hover:scale-110"
        >
          <path d="M2 12h3.5l2.5-7 4 14 3-10 2 5H22" />
        </svg>

        {/* Corner tech accent */}
        <div className="absolute top-0 right-0 w-2 h-2 bg-emerald-300/80 rounded-bl-sm" />
      </div>

      {/* Brand Typography */}
      {showText && (
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 leading-none">
            <span className="font-extrabold tracking-tight text-white font-mono text-base md:text-lg">
              ACT<span className="text-emerald-400">-HKT</span>
            </span>
            <span className="text-[9px] px-1.5 py-0.5 rounded font-bold font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              2026
            </span>
          </div>
          <p className="text-[10px] text-zinc-400 tracking-wide font-medium mt-0.5 truncate">
            Worklife &amp; Performance
          </p>
        </div>
      )}
    </div>
  );
};
