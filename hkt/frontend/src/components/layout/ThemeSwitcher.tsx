import React, { useEffect, useRef, useState } from 'react';
import { Palette, Check } from 'lucide-react';
import { useTheme } from '../../theme/ThemeContext';

/**
 * Nút đổi giao diện (3 template): mở popover liệt kê theme kèm swatch màu.
 * Theme lưu ở DB (xem ThemeContext) + cache localStorage để áp tức thì.
 *
 * Swatch dùng hex của TỪNG theme (không phải token) vì mỗi ô đang "quảng cáo"
 * màu của một theme khác với theme hiện tại.
 */
export const ThemeSwitcher: React.FC = () => {
  const { theme, themes, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const active = themes.find((t) => t.id === theme);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="p-1.5 sm:px-2.5 sm:py-1.5 text-xs rounded-lg border border-line bg-canvas hover:bg-surface text-ink-secondary flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
        title={`Giao diện đang dùng: ${active?.name ?? ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Đổi giao diện"
      >
        <Palette className="w-3.5 h-3.5" />
        <span className="hidden xl:inline font-semibold">{active?.name}</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-72 rounded-xl border border-line bg-surface shadow-lg z-50 p-1.5 animate-in fade-in slide-in-from-top-2 duration-150"
        >
          <div className="px-2 py-1.5 text-[11px] font-bold text-ink-muted uppercase tracking-wide">
            Giao diện
          </div>
          {themes.map((t) => {
            const on = t.id === theme;
            return (
              <button
                key={t.id}
                type="button"
                role="menuitemradio"
                aria-checked={on}
                onClick={() => {
                  setTheme(t.id);
                  setOpen(false);
                }}
                className={`w-full text-left flex items-start gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                  on ? 'bg-accent-soft' : 'hover:bg-canvas-subtle'
                }`}
              >
                <div className="flex rounded-md overflow-hidden border border-line shrink-0 mt-0.5" aria-hidden="true">
                  <span className="w-2.5 h-9" style={{ background: t.preview.rail }} />
                  <span className="w-2.5 h-9" style={{ background: t.preview.surface }} />
                  <span className="w-2.5 h-9" style={{ background: t.preview.brand }} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-bold ${on ? 'text-accent' : 'text-ink'}`}>{t.name}</span>
                    {on && <Check className="w-3.5 h-3.5 text-accent shrink-0" />}
                  </div>
                  <div className="text-[11px] text-ink-muted leading-snug mt-0.5">{t.description}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
