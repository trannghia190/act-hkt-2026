import React from 'react';
import { fieldMeta, formatFieldValue } from './ruleFieldMeta';

/**
 * Hiển thị giá trị một quy định bằng nhãn nghiệp vụ (S17 version, S19 tra cứu),
 * kèm bản JSON gốc thu gọn cho người cần đối chiếu kỹ thuật.
 */
export const RuleValueSummary: React.FC<{ ruleKey: string; value: unknown; showRaw?: boolean }> = ({ ruleKey, value, showRaw = true }) => {
  let obj: Record<string, unknown> = {};
  if (typeof value === 'string') {
    try { obj = JSON.parse(value); } catch { obj = {}; }
  } else if (value && typeof value === 'object') {
    obj = value as Record<string, unknown>;
  }
  const entries = Object.entries(obj);

  return (
    <div className="space-y-1">
      {entries.length === 0 ? (
        <div className="text-xs text-ink-muted">Giá trị không đọc được — xem JSON gốc.</div>
      ) : (
        <dl className="grid gap-x-4 sm:grid-cols-2">
          {entries.map(([key, val]) => {
            const meta = fieldMeta(ruleKey, key, val);
            const isBool = typeof val === 'boolean';
            return (
              <div
                key={key}
                className="flex items-baseline justify-between gap-2 border-b border-line-soft py-1.5"
              >
                <dt className="text-xs text-ink-secondary">{meta.label}</dt>
                <dd
                  className={`text-right text-xs font-semibold ${
                    isBool ? (val ? 'text-status-ok' : 'text-ink-muted') : 'text-ink'
                  }`}
                >
                  {formatFieldValue(meta, val)}
                </dd>
              </div>
            );
          })}
        </dl>
      )}
      {showRaw && entries.length > 0 && (
        <details className="pt-1">
          <summary className="cursor-pointer text-[11px] text-ink-muted">Xem JSON gốc (kỹ thuật)</summary>
          <pre className="mt-1 overflow-x-auto rounded-[9px] border border-line bg-surface p-2.5 font-mono text-[10.5px] text-ink-muted">
            {JSON.stringify(obj, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
};
