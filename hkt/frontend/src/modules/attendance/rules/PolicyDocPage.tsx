import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, ChevronDown, Lightbulb, Search } from 'lucide-react';
import { Badge } from '../../../components/common/Badge';
import { Panel } from '../../../components/common/Panel';
import { RuleValueSummary } from './RuleValueSummary';

interface RuleApi {
  ruleKey: string;
  name: string;
  category: string;
  currentValue: string;
  description: string;
  effectiveFrom?: string;
  versionCount: number;
}

const EXAMPLES: Record<string, string> = {
  late_early: 'Đi muộn 10 phút → nộp đơn trong 3 ngày, tối đa 2 lần/tháng.',
  wfh: 'Đăng ký WFH thứ Sáu → tối đa 2 ngày/tuần; ngày thứ 3 bị chặn.',
  attendance_security: 'Camera khớp 98% + trong Wi-Fi công ty + trong 150m → chấm công hợp lệ.',
  leave_carryover: 'Còn 7 ngày phép tồn sau 01/04 → chỉ giữ 5 ngày, 2 ngày hết hiệu lực.',
  okr_evaluation: 'Business 4 + People 5 → điểm TB 4.5, không xếp loại A/B/C/D.',
  notification: 'Quá 3 push/ngày → dồn vào email digest 08:00 hôm sau.',
};

/** Ví dụ sinh từ chính giá trị đang cấu hình — không hardcode, tránh lệch khi HR đổi luật (E5). */
const dynamicExample = (r: RuleApi): string | null => {
  if (r.ruleKey === 'payroll_period') {
    try {
      const v = JSON.parse(r.currentValue);
      return `Bảng công đang mở khiếu nại ngay → ngày ${v.close_day} chốt kỳ tháng trước → còn ${v.dispute_window_days} ngày để khiếu nại`
        + ` → tự khoá sau ${v.lock_delay_days} ngày`
        + (v.allow_adjust_after_lock ? ' · vẫn cho phép điều chỉnh sau khi khoá' : ' · khoá xong không sửa được');
    } catch { return null; }
  }
  return EXAMPLES[r.ruleKey] || null;
};

const authHeaders = (): Record<string, string> => {
  try {
    const user = JSON.parse(localStorage.getItem('pulse_auth_user') || '{}');
    return user?.accessToken ? { Authorization: `Bearer ${user.accessToken}` } : {};
  } catch {
    return {};
  }
};

/** S19 — Trang tra cứu nội quy sinh từ cùng catalog với S16/S17 (docs/06). */
export const PolicyDocPage: React.FC = () => {
  const [rules, setRules] = useState<RuleApi[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('ALL');
  const [error, setError] = useState<string | null>(null);
  /** ruleKey đang mở — chỉ mở tối đa 1 mục để danh sách gọn. */
  const [openKey, setOpenKey] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/v1/rules', { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => { if (Array.isArray(j?.data)) setRules(j.data); })
      .catch(() => setError('Không tải được nội quy — vui lòng thử lại'));
  }, []);

  const categories = useMemo(() => Array.from(new Set(rules.map((r) => r.category))), [rules]);

  /** Số đếm theo nhóm — luôn khớp số mục thực sự hiện ra. */
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    map.set('ALL', rules.length);
    categories.forEach(c => map.set(c, rules.filter(r => r.category === c).length));
    return map;
  }, [rules, categories]);

  const filtered = useMemo(() => rules.filter((r) => {
    if (category !== 'ALL' && r.category !== category) return false;
    const q = search.trim().toLowerCase();
    return !q || r.name.toLowerCase().includes(q) || r.ruleKey.toLowerCase().includes(q);
  }), [rules, category, search]);

  /** Mục lục 2 tầng: nhóm → quy định, giữ nguyên thứ tự catalog trả về. */
  const sections = useMemo(() => {
    const byCategory = new Map<string, RuleApi[]>();
    rules.forEach((r) => {
      const list = byCategory.get(r.category) ?? [];
      list.push(r);
      byCategory.set(r.category, list);
    });
    return Array.from(byCategory, ([name, items]) => ({ name, items }));
  }, [rules]);

  /** Bấm mục lục → xoá bộ lọc/tìm kiếm, mở đúng thẻ rồi cuộn tới. */
  const jumpToRule = (ruleKey: string) => {
    setCategory('ALL');
    setSearch('');
    setOpenKey(ruleKey);
    // Đợi danh sách render lại sau khi xoá bộ lọc rồi mới cuộn tới thẻ.
    window.setTimeout(() => {
      document.getElementById(`rule-${ruleKey}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 60);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4 pb-24">
      {/* Đầu trang — mockup `.phead` */}
      <div className="min-w-0">
        <div className="inline-flex items-center gap-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-accent-dark">
          <BookOpen className="h-3.5 w-3.5" />
          Tra cứu nhân sự
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <h1 className="font-display text-xl font-extrabold tracking-tight text-ink sm:text-[23px]">
            Tra cứu nội quy &amp; quy chế
          </h1>
          <Badge variant="accent">S19</Badge>
        </div>
        <p className="mt-1 text-xs text-ink-muted">
          Sinh tự động từ {rules.length || 19} quy định HR đang áp dụng — không lệch với phần mềm.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-status-danger-line bg-status-danger-soft p-3 text-sm text-status-danger">
          {error}
        </div>
      )}

      {rules.length > 0 && (
        <>
          {/* Bìa — tóm tắt nội quy đang áp dụng */}
          <div className="overflow-hidden rounded-[16px] border border-line bg-ink px-5 py-4 text-canvas">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-canvas/60">
                  Áp dụng cho toàn công ty
                </div>
                <div className="mt-1 font-display text-lg font-extrabold">Nội quy đang có hiệu lực</div>
                <p className="mt-1 max-w-xl text-xs leading-relaxed text-canvas/75">
                  Mỗi mục bên dưới là một luật HR đang bật, sinh từ cùng bộ cấu hình với màn hình quản trị —
                  quản trị viên sửa là trang này đổi ngay, không có bản tài liệu nào lệch phần mềm.
                </p>
              </div>
              <dl className="flex gap-6">
                <div>
                  <dd className="font-display text-2xl font-extrabold tabular-nums">{rules.length}</dd>
                  <dt className="text-[11px] text-canvas/60">quy định</dt>
                </div>
                <div>
                  <dd className="font-display text-2xl font-extrabold tabular-nums">{sections.length}</dd>
                  <dt className="text-[11px] text-canvas/60">nhóm</dt>
                </div>
                <div>
                  <dd className="font-display text-2xl font-extrabold tabular-nums">
                    {rules.filter((r) => r.versionCount > 0).length}
                  </dd>
                  <dt className="text-[11px] text-canvas/60">đã tuỳ chỉnh</dt>
                </div>
              </dl>
            </div>
          </div>

        </>
      )}

      {/* Tìm kiếm + mục lục */}
      <Panel>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
            <input
              type="text"
              aria-label="Tìm quy định"
              placeholder="Tìm quy định (VD: phép, WFH, đi muộn)…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-[10px] border border-line bg-canvas py-2 pl-9 pr-3 text-xs text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/20"
            />
          </div>
          <div className="shrink-0 text-xs text-ink-muted sm:ml-auto">
            Mục lục: <strong className="font-bold text-ink">{filtered.length}</strong> quy định
            {categories.length ? (
              <>
                {' '}· <strong className="font-bold text-ink">{categories.length}</strong> nhóm
              </>
            ) : null}
          </div>
        </div>
      </Panel>

      {/* Chip nhóm — pill 31px, đang chọn = bg-ink text-canvas */}
      <div role="group" aria-label="Lọc theo nhóm quy định" className="flex items-center gap-2 overflow-x-auto pb-1">
        {['ALL', ...categories].map((c) => {
          const on = category === c;
          return (
            <button
              key={c}
              type="button"
              aria-pressed={on}
              onClick={() => setCategory(c)}
              className={`inline-flex h-[31px] shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-[12.5px] font-semibold transition-colors ${
                on
                  ? 'border-ink bg-ink text-canvas'
                  : 'border-line bg-surface text-ink-secondary hover:bg-canvas hover:text-ink'
              }`}
            >
              {c === 'ALL' ? 'Tất cả nhóm' : c}
              <span className="font-mono text-[10.5px] opacity-65">{counts.get(c) ?? 0}</span>
            </button>
          );
        })}
      </div>

      {/* Mục lục 2 tầng — thu gọn mặc định, bấm tên quy định để mở đúng thẻ */}
      {rules.length > 0 && (
        <details className="group overflow-hidden rounded-[13px] border border-line bg-surface shadow-2xs">
          <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-4 py-3 [&::-webkit-details-marker]:hidden">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-accent-dark">Mục lục</span>
              <span className="font-mono text-[10.5px] font-semibold text-ink-muted">
                {rules.length} quy định · {sections.length} nhóm
              </span>
            </span>
            <span className="flex items-center gap-1.5 text-[11px] text-ink-muted">
              Bấm để mở
              <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
            </span>
          </summary>
          <div className="grid gap-x-8 gap-y-3.5 border-t border-line px-4 py-3.5 sm:grid-cols-2">
            {sections.map((sec) => (
              <div key={sec.name} className="min-w-0">
                <button
                  type="button"
                  onClick={() => { setSearch(''); setCategory(sec.name); }}
                  className="flex w-full cursor-pointer items-center gap-1.5 rounded text-left text-[10.5px] font-extrabold uppercase tracking-[0.05em] text-ink-muted transition-colors hover:text-accent-dark"
                >
                  <span className="truncate">{sec.name}</span>
                  <span className="font-mono text-[10.5px] font-semibold opacity-60">({sec.items.length})</span>
                </button>
                <ul className="mt-1 space-y-0.5 border-l border-line pl-3">
                  {sec.items.map((r) => (
                    <li key={r.ruleKey}>
                      <button
                        type="button"
                        onClick={() => jumpToRule(r.ruleKey)}
                        className="block w-full cursor-pointer truncate rounded py-0.5 text-left text-[12px] text-ink transition-colors hover:text-accent-dark"
                      >
                        {r.name}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Danh sách quy định — accordion, chỉ mở 1 mục */}
      <div className="flex flex-col gap-2.5">
        {filtered.map((r) => {
          const isOpen = openKey === r.ruleKey;
          const example = dynamicExample(r);
          return (
            <div
              key={r.ruleKey}
              className={`overflow-hidden rounded-[13px] border bg-surface shadow-2xs ${
                isOpen ? 'border-line-hover' : 'border-line'
              }`}
            >
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpenKey(isOpen ? null : r.ruleKey)}
                className="flex w-full cursor-pointer flex-col gap-1.5 px-4 py-3 text-left transition-colors hover:bg-canvas/60 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
              >
                <span className="min-w-0 text-[13px] font-bold text-ink">{r.name}</span>
                <span className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                  <span className="font-mono text-[10.5px] text-ink-muted">{r.ruleKey}</span>
                  <span className="rounded-md bg-surface-secondary px-2 py-[2.5px] text-[11px] font-semibold text-ink-secondary">
                    {r.versionCount > 0
                      ? `v${r.versionCount} · hiệu lực ${r.effectiveFrom || '—'}`
                      : 'Mặc định · chưa thay đổi'}
                  </span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 shrink-0 text-ink-muted transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  />
                </span>
              </button>

              {isOpen && (
                <div className="flex flex-col gap-3 border-t border-line px-4 py-3.5">
                  <div className="text-xs text-ink-secondary">{r.description}</div>

                  {example && (
                    <div className="flex items-start gap-2 rounded-[11px] border border-status-ok-line bg-status-ok-soft px-3 py-2.5 text-xs text-status-ok">
                      <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <div>{example}</div>
                    </div>
                  )}

                  <div className="rounded-[11px] border border-line bg-canvas p-3">
                    <RuleValueSummary ruleKey={r.ruleKey} value={r.currentValue} />
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="rounded-[13px] border border-dashed border-line p-8 text-center text-sm text-ink-muted">
            Không có quy định nào khớp bộ lọc hiện tại.
          </div>
        )}
      </div>
    </div>
  );
};
