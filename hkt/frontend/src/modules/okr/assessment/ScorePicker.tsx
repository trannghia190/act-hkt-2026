import React from 'react';

// Thang điểm lấy theo cấu hình chu kỳ của HR (mặc định 1–5)
export const ScorePicker: React.FC<{ value?: number | null; onChange?: (v: number) => void; disabled?: boolean; min?: number; max?: number }> = ({ value, onChange, disabled, min = 1, max = 5 }) => (
  <div className="flex items-center gap-2">
    {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((score) => (
      <button
        key={score}
        type="button"
        disabled={disabled}
        onClick={() => onChange?.(score)}
        className={`w-10 h-9 rounded-lg font-bold border transition-all disabled:cursor-not-allowed ${
          value === score
            ? 'bg-ink text-canvas border-ink shadow-xs'
            : 'bg-canvas text-ink-secondary border-line hover:border-line-focus'
        }`}
      >
        {score}
      </button>
    ))}
    <span className="text-xs text-ink-muted">{value ? `Điểm ${value}/${max}` : 'Chưa chấm'}</span>
  </div>
);
