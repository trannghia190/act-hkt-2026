import React from 'react';

/**
 * Segmented control dùng chung — chọn 1 trong N lựa chọn (Vào ca / Ra ca,
 * bộ lọc, phạm vi xem…).
 *
 * QUY TẮC (xem docs/26-design-system-rules.md):
 * - Mục đang chọn: `bg-accent-soft text-accent-dark` — cùng một màu accent cho
 *   MỌI lựa chọn. Không tô xanh cho "vào" và đen cho "ra": màu không mang
 *   nghĩa nghiệp vụ, chỉ thể hiện trạng thái đang chọn.
 * - Mục chưa chọn: chữ `ink-muted`, hover `ink`.
 * - Trạng thái nghiệp vụ (thành công / lỗi / cảnh báo) chỉ dùng ở badge, toast,
 *   icon — không dùng làm nền nút điều hướng.
 */

export interface SegmentedOption<T extends string> {
  value: T;
  label: React.ReactNode;
  disabled?: boolean;
  title?: string;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Nhãn cho trình đọc màn hình, ví dụ "Chọn loại chấm công". */
  ariaLabel: string;
  className?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className = '',
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
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            disabled={option.disabled}
            title={option.title}
            onClick={() => onChange(option.value)}
            className={`h-9 rounded-lg px-2 text-xs font-bold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              active
                ? 'bg-accent-soft text-accent-dark shadow-sm'
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
