import React, { useEffect, useState } from 'react';
import type { FieldMeta } from './ruleFieldMeta';
import { approverLabel, approverOptions, requestTypeOptions } from './ruleFieldMeta';

/**
 * Editor một field của quy định — thay cho ô JSON thô cũ.
 * Kiểu nhập (bool/số/giờ/tag/bước duyệt) do ruleFieldMeta quyết định.
 */
interface Props {
  field: string;
  meta: FieldMeta;
  value: any;
  onChange: (value: any) => void;
}

const Label: React.FC<{ meta: FieldMeta; field: string }> = ({ meta, field }) => (
  <span className="block text-xs font-semibold text-ink">
    {meta.label}
    <span className="ml-1 font-mono text-[10px] font-normal text-ink-muted">{field}</span>
  </span>
);

const Hint: React.FC<{ meta: FieldMeta }> = ({ meta }) => (
  <>
    {meta.hint && <span className="mt-0.5 block text-[11px] text-ink-muted">{meta.hint}</span>}
    {meta.unit && <span className="mt-0.5 block text-[11px] text-ink-muted">Đơn vị: {meta.unit}</span>}
  </>
);

const BoolField: React.FC<Props> = ({ field, meta, value, onChange }) => (
  <label className="flex items-start justify-between gap-3 border border-line rounded-lg px-3 py-2 bg-surface cursor-pointer">
    <span className="min-w-0">
      <Label meta={meta} field={field} />
      <Hint meta={meta} />
    </span>
    <input type="checkbox" className="mt-1 shrink-0" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />
  </label>
);

const NumberField: React.FC<Props> = ({ field, meta, value, onChange }) => (
  <label className="block">
    <Label meta={meta} field={field} />
    <div className="mt-1 flex items-center gap-2">
      <input
        type="number"
        className="w-full border border-line rounded-lg p-2 text-sm bg-surface"
        value={value === '' || value === null || value === undefined ? '' : Number(value)}
        min={meta.min}
        max={meta.max}
        step={meta.step ?? 1}
        onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
      />
      {meta.unit && <span className="shrink-0 text-xs text-ink-muted">{meta.unit}</span>}
    </div>
    {meta.hint && <span className="mt-0.5 block text-[11px] text-ink-muted">{meta.hint}</span>}
  </label>
);

const TimeField: React.FC<Props> = ({ field, meta, value, onChange }) => (
  <label className="block">
    <Label meta={meta} field={field} />
    <input
      type="time"
      className="mt-1 w-full border border-line rounded-lg p-2 text-sm bg-surface"
      value={typeof value === 'string' ? value : ''}
      onChange={(e) => onChange(e.target.value)}
    />
    {meta.hint && <span className="mt-0.5 block text-[11px] text-ink-muted">{meta.hint}</span>}
  </label>
);

/** Mốc MM-DD (quy chế phép) — không dùng được input date vì không gắn năm. */
const MonthDayField: React.FC<Props> = ({ field, meta, value, onChange }) => (
  <label className="block">
    <Label meta={meta} field={field} />
    <input
      type="text"
      inputMode="numeric"
      placeholder="MM-DD"
      pattern="\d{2}-\d{2}"
      className="mt-1 w-full border border-line rounded-lg p-2 text-sm bg-surface font-mono"
      value={typeof value === 'string' ? value : ''}
      onChange={(e) => onChange(e.target.value)}
    />
    <span className="mt-0.5 block text-[11px] text-ink-muted">{meta.hint ?? 'Định dạng MM-DD, ví dụ 04-01 = ngày 1 tháng 4'}</span>
  </label>
);

const SelectField: React.FC<Props> = ({ field, meta, value, onChange }) => (
  <label className="block">
    <Label meta={meta} field={field} />
    <select
      className="mt-1 w-full border border-line rounded-lg p-2 text-sm bg-surface"
      value={String(value ?? '')}
      onChange={(e) => onChange(e.target.value)}
    >
      {(meta.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </label>
);

const TextField: React.FC<Props> = ({ field, meta, value, onChange }) => (
  <label className="block">
    <Label meta={meta} field={field} />
    <input
      className="mt-1 w-full border border-line rounded-lg p-2 text-sm bg-surface"
      value={value === null || value === undefined ? '' : String(value)}
      onChange={(e) => onChange(e.target.value)}
    />
    {meta.hint && <span className="mt-0.5 block text-[11px] text-ink-muted">{meta.hint}</span>}
  </label>
);

/** Cache danh sách nhóm để gợi ý cho rule hr_approval.teams. */
let teamCache: string[] | null = null;
const useTeamSuggestions = (enabled: boolean) => {
  const [teams, setTeams] = useState<string[]>(teamCache ?? []);
  useEffect(() => {
    if (!enabled || teamCache) return;
    const token = (() => { try { return JSON.parse(localStorage.getItem('pulse_auth_user') || '{}')?.accessToken; } catch { return ''; } })();
    fetch('/api/v1/org/tree', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((r) => r.json())
      .then((j) => {
        const names: string[] = [];
        const walk = (nodes: any[]) => (nodes || []).forEach((n) => {
          if (n?.name) names.push(n.name);
          walk(n?.children);
          walk(n?.teams);
        });
        walk(j?.data);
        teamCache = Array.from(new Set(names));
        setTeams(teamCache);
      })
      .catch(() => undefined);
  }, [enabled]);
  return teams;
};

const TagsField: React.FC<Props> = ({ field, meta, value, onChange }) => {
  const list: string[] = Array.isArray(value) ? value : [];
  const [draft, setDraft] = useState('');
  const teamSuggestions = useTeamSuggestions(meta.suggestions === 'teams');
  const options = meta.suggestions === 'requestTypes' ? requestTypeOptions.map((o) => o.value) : teamSuggestions;
  const labelOf = (v: string) => (meta.suggestions === 'requestTypes'
    ? requestTypeOptions.find((o) => o.value === v)?.label ?? v
    : v);

  const add = (raw: string) => {
    const v = raw.trim();
    if (!v || list.includes(v)) return setDraft('');
    onChange([...list, v]);
    setDraft('');
  };

  return (
    <div className="sm:col-span-2">
      <Label meta={meta} field={field} />
      <Hint meta={meta} />
      <div className="mt-1 flex flex-wrap items-center gap-1.5 border border-line rounded-lg p-2 bg-surface min-h-10">
        {list.map((v) => (
          <span key={v} className="inline-flex items-center gap-1 text-xs bg-accent-soft/40 text-ink border border-line rounded-full px-2 py-0.5">
            {labelOf(v)}
            <button type="button" className="text-ink-muted hover:text-rose-700" onClick={() => onChange(list.filter((x) => x !== v))}>×</button>
          </span>
        ))}
        <input
          list={`suggest-${field}`}
          className="flex-1 min-w-32 text-xs bg-transparent outline-none px-1 py-1"
          placeholder="Gõ để thêm…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(draft); }
            if (e.key === 'Backspace' && !draft && list.length) onChange(list.slice(0, -1));
          }}
        />
        <datalist id={`suggest-${field}`}>
          {options.filter((o) => !list.includes(o)).map((o) => <option key={o} value={o}>{labelOf(o)}</option>)}
        </datalist>
      </div>
    </div>
  );
};

const StepsField: React.FC<Props> = ({ field, meta, value, onChange }) => {
  const steps: any[] = Array.isArray(value) ? value : [];
  const update = (i: number, approver: string) =>
    onChange(steps.map((s, idx) => (idx === i ? { ...s, approver } : s)));
  const remove = (i: number) => onChange(steps.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, step: idx + 1 })));
  const add = () => onChange([...steps, { step: steps.length + 1, approver: 'line_manager' }]);

  return (
    <div className="sm:col-span-2">
      <Label meta={meta} field={field} />
      <Hint meta={meta} />
      <div className="mt-1 space-y-1.5">
        {steps.map((s, i) => (
          <div key={i} className="flex items-center gap-2 border border-line rounded-lg px-2 py-1.5 bg-surface">
            <span className="shrink-0 text-xs font-semibold text-ink w-16">Bước {s?.step ?? i + 1}</span>
            <select
              className="flex-1 text-xs border border-line rounded p-1.5 bg-surface"
              value={String(s?.approver ?? 'line_manager')}
              onChange={(e) => update(i, e.target.value)}
            >
              {approverOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              {!approverOptions.some((o) => o.value === String(s?.approver)) && (
                <option value={String(s?.approver)}>{approverLabel(String(s?.approver))}</option>
              )}
            </select>
            <button type="button" className="text-xs text-rose-700 px-1.5" onClick={() => remove(i)} title="Xoá bước">Xoá</button>
          </div>
        ))}
        {steps.length === 0 && <div className="text-[11px] text-ink-muted">Chưa có bước duyệt nào.</div>}
        <button type="button" onClick={add} className="text-xs px-2 py-1 rounded border border-line bg-surface">+ Thêm bước duyệt</button>
      </div>
    </div>
  );
};

/** Fallback cho field lồng nhiều tầng chưa có UI riêng: vẫn cho sửa JSON nhưng có kiểm tra cú pháp. */
const JsonField: React.FC<Props> = ({ field, meta, value, onChange }) => {
  const [text, setText] = useState(() => JSON.stringify(value));
  const [err, setErr] = useState<string | null>(null);
  return (
    <label className="block sm:col-span-2">
      <Label meta={meta} field={field} />
      <textarea
        rows={2}
        className="mt-1 w-full border border-line rounded-lg p-2 text-xs font-mono bg-surface"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          try { onChange(JSON.parse(e.target.value)); setErr(null); } catch { setErr('Cú pháp JSON chưa đúng'); }
        }}
      />
      {err && <span className="text-[11px] text-rose-700">{err}</span>}
    </label>
  );
};

export const RuleFieldEditor: React.FC<Props> = (props) => {
  const { meta, value } = props;
  switch (meta.type) {
    case 'bool': return <BoolField {...props} />;
    case 'number': return <NumberField {...props} />;
    case 'time': return <TimeField {...props} />;
    case 'monthday': return <MonthDayField {...props} />;
    case 'select': return <SelectField {...props} />;
    case 'tags': return <TagsField {...props} />;
    case 'steps': return <StepsField {...props} />;
    default:
      if (value !== null && typeof value === 'object') return <JsonField {...props} />;
      return <TextField {...props} />;
  }
};
