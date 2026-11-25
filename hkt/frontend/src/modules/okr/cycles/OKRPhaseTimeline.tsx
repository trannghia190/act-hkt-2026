import React from 'react';
import { Phase, PHASE_ACTIONS, phaseWindowConflicts } from './cycleTypes';

const PHASE_COLOR: Record<string, { dot: string; soft: string; text: string }> = {
  setup: { dot: '#4f46e5', soft: '#eef2ff', text: '#3730a3' },
  midyear: { dot: '#d97706', soft: '#fffbeb', text: '#92400e' },
  final: { dot: '#059669', soft: '#ecfdf5', text: '#065f46' },
};

const colorOf = (key: string) => PHASE_COLOR[key] || PHASE_COLOR.setup;

const fmt = (iso?: string | null): string => {
  if (!iso || iso.length < 10) return '';
  const [, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}`;
};

const range = (a?: string | null, b?: string | null): string => {
  const s = fmt(a);
  const e = fmt(b);
  return s && e ? `${s} – ${e}` : '—';
};

type StepState = 'active' | 'done' | 'upcoming';

const stepState = (p: Phase): StepState => {
  const nv = p.effective_status || 'upcoming';
  const hasQl = Boolean(p.review_start && p.review_due);
  const ql = hasQl ? (p.manager_status || 'upcoming') : 'locked';
  if (nv === 'active' || ql === 'active') return 'active';
  if (nv === 'locked') return 'done';
  return 'upcoming';
};

const STATE_LABEL: Record<StepState, string> = {
  active: 'Đang mở',
  done: 'Đã kết thúc',
  upcoming: 'Sắp tới',
};

interface Props {
  year: number;
  phases: Phase[];
}

/**
 * Lộ trình OKR dạng progress các mốc: mỗi giai đoạn là 1 mốc kèm cửa sổ thời gian
 * của Nhân viên và Quản lý; thanh tiến độ cho biết đã qua bao nhiêu mốc.
 */
export const OKRPhaseTimeline: React.FC<Props> = ({ year, phases }) => {
  const ordered = ['setup', 'midyear', 'final']
    .map((k) => phases.find((p) => p.key === k))
    .filter(Boolean) as Phase[];
  if (ordered.length === 0) return null;

  const states = ordered.map(stepState);
  const doneCount = states.filter((s) => s === 'done').length;
  const activeIdx = states.indexOf('active');
  const progress = Math.min(100, ((doneCount + (activeIdx >= 0 ? 0.5 : 0)) / ordered.length) * 100);

  const conflicts = phaseWindowConflicts(phases);

  return (
    <div className="space-y-2">
      {conflicts.length > 0 && (
        <div className="rounded-lg border border-danger/40 bg-danger/5 px-3 py-2 text-[11px] text-danger space-y-1">
          <div className="font-semibold">Cấu hình đang chồng lấn — mỗi thời điểm chỉ được mở 1 giai đoạn OKR:</div>
          <ul className="list-disc ml-4 space-y-0.5">
            {conflicts.map((c) => <li key={c}>{c}</li>)}
          </ul>
        </div>
      )}

      <div className="rounded-xl border border-line bg-white p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs font-bold text-ink">Lộ trình OKR {year}</div>
          <div className="text-[11px] font-semibold text-ink-muted">
            {doneCount}/{ordered.length} mốc đã xong
          </div>
        </div>

        <div className="h-1.5 rounded-full bg-line/50 overflow-hidden">
          <div
            className="h-full rounded-full bg-accent transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          {ordered.map((p, i) => {
            const st = states[i];
            const c = colorOf(p.key);
            const action = PHASE_ACTIONS[p.key];
            return (
              <div key={p.key} className="flex items-start gap-2.5">
                <span
                  className="w-7 h-7 rounded-full grid place-items-center text-[11px] font-bold shrink-0 text-white"
                  style={{
                    background: st === 'upcoming' ? '#c7cad1' : c.dot,
                    boxShadow: st === 'active' ? `0 0 0 3px ${c.soft}` : undefined,
                  }}
                >
                  {st === 'done' ? '✓' : i + 1}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold text-ink truncate">{p.name}</span>
                    <span
                      className={`text-[10px] font-semibold px-1.5 py-px rounded-full ${
                        st === 'active' ? 'bg-accent-soft text-accent'
                          : st === 'done' ? 'bg-line/40 text-ink-muted'
                            : 'bg-canvas text-ink-muted border border-line'
                      }`}
                    >
                      {STATE_LABEL[st]}{st === 'active' && typeof p.days_left === 'number' ? ` · còn ${p.days_left} ngày` : ''}
                    </span>
                  </div>
                  <div className="text-[11px] text-ink-secondary mt-1">
                    <span className="font-semibold">NV</span> {range(p.start_date, p.due_date)}
                  </div>
                  <div className="text-[11px] text-ink-muted">
                    <span className="font-semibold">QL</span>{' '}
                    {p.review_start && p.review_due ? range(p.review_start, p.review_due) : 'chưa cấu hình'}
                  </div>
                  {action && <div className="text-[10px] text-ink-muted mt-0.5 truncate">{action.nv} → {action.ql}</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
