import React from 'react';

/**
 * Segmented control dùng chung — chọn 1 trong N lựa chọn (Vào ca / Ra ca,
 * bộ lọc, phạm vi xem…).
 *
 * Style lấy từ mockup `mockups/redesign/index.html`:
 * - Container: `bg-canvas border-line rounded-xl p-1 gap-1`.
 * - Mục đang chọn mặc định: `bg-ink text-canvas` — giống chip `.chip.on` trong mockup.
 * - Ngoại lệ có chủ đích theo mockup chấm công
 *   (`screens/checkin.html`): "Vào ca" đang chọn dùng `ok`, "Ra ca" dùng `ink`.
 *   Chỉ truyền `tone` khi mockup của màn đó quy định; không tự chế màu.
 * - Mục chưa chọn: chữ `ink-muted`, hover `ink`.
 */

export type SegmentedTone = 'ink' | 'ok';

export interface SegmentedOption<T extends string> {
  value: T;
  label: React.ReactNode;
  disabled?: boolean;
  title?: string;
  /** Màu nền khi mục này đang chọn — mặc định `ink` như mockup. */
  tone?: SegmentedTone;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Nhãn cho trình đọc màn hình, ví dụ "Chọn loại chấm công". */
  ariaLabel: string;
  className?: string;
  /** Màu khi đang chọn cho mọi mục — mặc định `ink`. */
  tone?: SegmentedTone;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className = '',
  tone = 'ink',
}: SegmentedControlProps<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={`grid gap-1 p-1 rounded-xl w-full bg-canvas border border-line ${className}`}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((option) => {
        const active = option.value === value;
        const activeTone = option.tone ?? tone;
        const activeStyles: Record<SegmentedTone, string> = {
          ink: 'bg-ink text-canvas shadow-sm',
          ok: 'bg-status-ok text-on-ok shadow-sm',
        };
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            disabled={option.disabled}
            title={option.title}
            onClick={() => onChange(option.value)}
            className={`h-[34px] rounded-[9px] px-2 text-xs font-bold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              active
                ? activeStyles[activeTone]
                : 'text-ink-muted hover:text-ink hover:bg-surface/70'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
