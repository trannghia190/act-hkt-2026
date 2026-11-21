import React, { useEffect, useState } from 'react';
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

  useEffect(() => {
    fetch('/api/v1/rules', { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => { if (Array.isArray(j?.data)) setRules(j.data); })
      .catch(() => setError('Không tải được nội quy — vui lòng thử lại'));
  }, []);

  const categories = Array.from(new Set(rules.map((r) => r.category)));
  const filtered = rules.filter((r) => {
    if (category !== 'ALL' && r.category !== category) return false;
    const q = search.trim().toLowerCase();
    return !q || r.name.toLowerCase().includes(q) || r.ruleKey.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="bg-canvas border border-line rounded-xl p-6">
        <h1 className="text-xl font-bold text-ink mt-1">Tra cứu nội quy & quy chế</h1>
        <p className="text-xs text-ink-muted mt-1">Sinh tự động từ 19 quy định HR đang áp dụng — không lệch với phần mềm.</p>
        <input className="mt-3 w-full sm:w-80 text-xs px-3 py-2 rounded-lg border border-line bg-surface"
          placeholder="Tìm quy định (VD: phép, WFH, đi muộn)…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {error && <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">{error}</div>}

      <div className="flex flex-wrap gap-2">
        {['ALL', ...categories].map((c) => (
          <button key={c} onClick={() => setCategory(c)}
            className={`text-xs px-3 py-1.5 rounded-full border ${category === c ? 'bg-accent text-white border-accent' : 'bg-surface border-line text-ink-secondary'}`}>
            {c === 'ALL' ? 'Tất cả nhóm' : c}
          </button>
        ))}
      </div>

      <div className="text-xs text-ink-muted">Mục lục: {filtered.length} quy định{categories.length ? ` · ${categories.length} nhóm` : ''}</div>

      <div className="space-y-2">
        {filtered.map((r) => (
          <details key={r.ruleKey} className="bg-surface border border-line rounded-xl p-4">
            <summary className="cursor-pointer text-sm font-semibold text-ink flex items-center justify-between gap-2">
              <span>{r.name}</span>
              <span className="text-[11px] font-normal text-ink-muted">v{r.versionCount} · hiệu lực {r.effectiveFrom || '—'}</span>
            </summary>
            <div className="mt-2 text-xs text-ink-secondary">{r.description}</div>
            {dynamicExample(r) && <div className="mt-1 text-xs text-emerald-700">Ví dụ: {dynamicExample(r)}</div>}
            <div className="mt-2 bg-canvas rounded-lg p-3">
              <RuleValueSummary ruleKey={r.ruleKey} value={r.currentValue} />
            </div>
          </details>
        ))}
      </div>
    </div>
  );
};
