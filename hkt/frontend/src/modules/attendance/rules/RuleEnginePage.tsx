import React, { useEffect, useState } from 'react';
import { SlidersHorizontal, Search, History, Pencil, ShieldCheck } from 'lucide-react';
import { Badge } from '../../../components/common/Badge';
import { Panel } from '../../../components/common/Panel';
import { Modal } from '../../../components/common/Modal';
import { RuleFieldEditor } from './RuleFieldEditor';
import { OfficeLocationMap } from './OfficeLocationMap';
import { RuleValueSummary } from './RuleValueSummary';
import { fieldMeta, formatFieldValue } from './ruleFieldMeta';

interface RuleApi {
  ruleKey: string;
  name: string;
  category: string;
  dataType: string;
  currentValue: string;
  description: string;
  versionCount: number;
  effectiveFrom?: string;
}

interface VersionItem {
  id: string;
  version: string;
  value: string;
  effectiveFrom: string;
  changeReason: string;
}

const TOKEN_KEY = 'pulse_auth_user';

const authHeaders = (): Record<string, string> => {
  try {
    const user = JSON.parse(localStorage.getItem(TOKEN_KEY) || '{}');
    return user?.accessToken ? { Authorization: `Bearer ${user.accessToken}` } : {};
  } catch {
    return {};
  }
};

const api = (path: string, init?: RequestInit) =>
  fetch(`/api/v1${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...(init?.headers || {}) },
  });

/**
 * S16/S17 — Trình cấu hình 19 quy định (docs/06).
 * - Không dry-run: bấm Lưu → hộp xác nhận → PUT tạo phiên bản mới.
 * - Chỉ scope toàn công ty; không badge trạng thái; có nút "Lịch sử thay đổi".
 */
export const RuleEnginePage: React.FC = () => {
  const [rules, setRules] = useState<RuleApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('ALL');
  const [toast, setToast] = useState<string | null>(null);

  const [editing, setEditing] = useState<RuleApi | null>(null);
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [reason, setReason] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  const [historyRule, setHistoryRule] = useState<RuleApi | null>(null);
  const [versions, setVersions] = useState<VersionItem[]>([]);

  const loadRules = async () => {
    setLoading(true);
    try {
      const res = await api('/rules');
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || `HTTP ${res.status}`);
      if (!Array.isArray(json?.data)) throw new Error('Dữ liệu quy định không hợp lệ');
      if (json.data.length === 0) throw new Error('Chưa có cấu hình quy định nào — kiểm tra lại dữ liệu seed');
      setRules(json.data);
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Không tải được danh sách quy định');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRules();
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const openEdit = (rule: RuleApi) => {
    setEditing(rule);
    let parsed: any = {};
    try {
      parsed = JSON.parse(rule.currentValue || '{}');
    } catch {
      parsed = {};
    }
    setFormValues(parsed && typeof parsed === 'object' ? parsed : {});
    setReason('');
    setEffectiveDate(new Date().toISOString().slice(0, 10));
  };

  const saveRule = async () => {
    if (!editing) return;
    if (!reason.trim()) {
      alert('Bắt buộc nhập lý do thay đổi');
      return;
    }
    const confirmed = window.confirm(
      `Xác nhận thay đổi quy định?\n\n• ${editing.name}\n• Áp dụng từ: ${effectiveDate}\n• Lý do: ${reason}\n\nThay đổi áp dụng cho TOÀN CÔNG TY và sẽ tạo phiên bản mới.`,
    );
    if (!confirmed) return;
    setSaving(true);
    try {
      const res = await api(`/rules/${encodeURIComponent(editing.ruleKey)}`, {
        method: 'PUT',
        body: JSON.stringify({ currentValue: JSON.stringify(formValues), changeReason: reason, effectiveFrom: effectiveDate }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || 'Lưu quy định thất bại');
      setEditing(null);
      showToast('Đã lưu quy định — tạo phiên bản mới');
      await loadRules();
    } catch (e: any) {
      alert(e?.message || 'Lưu quy định thất bại');
    } finally {
      setSaving(false);
    }
  };

  const openHistory = async (rule: RuleApi) => {
    setHistoryRule(rule);
    setVersions([]);
    try {
      const res = await api(`/rules/${encodeURIComponent(rule.ruleKey)}/versions`);
      const json = await res.json();
      if (res.ok) setVersions(json.data || []);
    } catch {
      /* ignore */
    }
  };

  const rollback = async (versionId: string) => {
    if (!historyRule) return;
    const reason = window.prompt('Lý do rollback (bắt buộc):', 'Khôi phục theo quyết định của HR');
    if (!reason || !reason.trim()) return;
    if (!window.confirm('Hoàn tác về phiên bản này? Hệ thống sẽ tạo phiên bản mới, không xoá lịch sử.')) return;
    const res = await api(`/rules/${encodeURIComponent(historyRule.ruleKey)}/rollback/${versionId}`, {
      method: 'POST',
      body: JSON.stringify({ reason: reason.trim() }),
    });
    const json = await res.json();
    if (!res.ok) {
      alert(json?.message || 'Rollback thất bại');
      return;
    }
    showToast('Đã rollback quy định');
    setHistoryRule(null);
    await loadRules();
  };

  const isFieldVisible = (key: string, values: Record<string, any>): boolean => {
    if (key === 'geofence_radius_m' || key === 'gps_accuracy_tolerance_m' || key === 'office_lat' || key === 'office_lng') {
      return Boolean(values.require_geofence);
    }
    if (key === 'office_wifi_keywords' || key === 'office_ip_prefixes') {
      return Boolean(values.require_internal_network);
    }
    if (key === 'face_match_threshold' || key === 'require_liveness' || key === 'face_max_attempts') {
      return Boolean(values.require_face_verification);
    }
    if (key.startsWith('flexible_')) return Boolean(values.is_flexible);
    if (key === 'self_approval_min_role' || key === 'self_approval_scope') return Boolean(values.allow_self_approval);
    return true;
  };

  /** Field được render theo metadata nghiệp vụ — không còn ô JSON thô cho HR. */
  const renderField = (key: string, value: any) => (
    <RuleFieldEditor
      key={key}
      field={key}
      meta={fieldMeta(editing!.ruleKey, key, value)}
      value={value}
      onChange={(next) => setFormValues((v) => ({ ...v, [key]: next }))}
    />
  );

  const q = search.trim().toLowerCase();
  const filtered = rules.filter((r) => {
    if (category !== 'ALL' && r.category !== category) return false;
    if (!q) return true;
    return (r.name || '').toLowerCase().includes(q) || (r.ruleKey || '').toLowerCase().includes(q);
  });

  const categories = Array.from(new Set(rules.map((r) => r.category)));
  const countOf = (c: string) => (c === 'ALL' ? rules.length : rules.filter((r) => r.category === c).length);
  const customized = rules.filter((r) => r.versionCount > 0).length;
  const latest = rules.map((r) => r.effectiveFrom || '').filter(Boolean).sort().pop();

  /** 3–4 giá trị đầu của quy định, hiển thị dạng chip gọn như mockup — phần đầy đủ nằm trong details. */
  const ruleChips = (r: RuleApi): Array<{ label: string; value: string }> => {
    try {
      const obj = JSON.parse(r.currentValue || '{}');
      return Object.entries(obj)
        .slice(0, 4)
        .map(([k, v]) => {
          const meta = fieldMeta(r.ruleKey, k, v);
          return { label: meta.label, value: formatFieldValue(meta, v) };
        });
    } catch {
      return [];
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4 pb-24">
      {toast && (
        <div className="fixed right-6 top-16 z-[100] rounded-lg bg-status-ok px-4 py-2 text-xs font-semibold text-on-ok shadow-sm">
          {toast}
        </div>
      )}

      {/* Đầu trang — mockup `.phead` */}
      <div className="min-w-0">
        <div className="inline-flex items-center gap-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-accent-dark">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Quản trị HR
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <h1 className="font-display text-xl font-extrabold tracking-tight text-ink sm:text-[23px]">
            Bộ quy tắc vận hành
          </h1>
          <Badge variant="accent">S16</Badge>
        </div>
        <p className="mt-1 text-xs text-ink-muted">
          {rules.length || 19} quy định đang áp dụng cho toàn công ty — mỗi lần lưu tạo phiên bản mới có ngày hiệu lực và lý do.
        </p>
      </div>

      {error && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-status-danger-line bg-status-danger-soft p-3 text-sm text-status-danger">
          <span>{error}</span>
          <button
            className="rounded border border-status-danger-line bg-surface px-2.5 py-1 text-xs"
            onClick={loadRules}
          >
            Thử lại
          </button>
        </div>
      )}

      {rules.length > 0 && (
        <>
          {/* Bìa — tóm tắt cấu hình đang áp dụng */}
          <div className="overflow-hidden rounded-[16px] border border-line bg-ink px-5 py-4 text-canvas">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-canvas/60">
                  Áp dụng cho toàn công ty
                </div>
                <div className="mt-1 font-display text-lg font-extrabold">Quy tắc đang có hiệu lực</div>
                <p className="mt-1 max-w-xl text-xs leading-relaxed text-canvas/75">
                  Sửa ở đây là toàn bộ hệ thống đổi theo ngay: đơn từ, chấm công, bảng công, phép.
                  Không xoá lịch sử — mỗi lần lưu tạo phiên bản mới, rollback cũng tạo phiên bản.
                </p>
              </div>
              <dl className="flex gap-6">
                <div>
                  <dd className="font-display text-2xl font-extrabold tabular-nums">{rules.length}</dd>
                  <dt className="text-[11px] text-canvas/60">quy định</dt>
                </div>
                <div>
                  <dd className="font-display text-2xl font-extrabold tabular-nums">{categories.length}</dd>
                  <dt className="text-[11px] text-canvas/60">nhóm</dt>
                </div>
                <div>
                  <dd className="font-display text-2xl font-extrabold tabular-nums">{customized}</dd>
                  <dt className="text-[11px] text-canvas/60">đã tuỳ chỉnh</dt>
                </div>
              </dl>
            </div>
          </div>

          {/* Tìm kiếm */}
          <Panel>
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative min-w-[220px] flex-1 sm:max-w-[380px]">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted" />
                <input
                  className="h-9 w-full rounded-[10px] border border-line bg-canvas pl-8 pr-3 text-xs text-ink outline-none transition-colors placeholder:text-ink-muted focus:border-line-focus focus:bg-surface focus:ring-2 focus:ring-accent/15"
                  placeholder="Tìm quy định (VD: phép, khuôn mặt, duyệt đơn)…"
                  aria-label="Tìm quy định"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="ml-auto text-[11px] text-ink-muted">
                Đang hiện <span className="font-semibold text-ink">{filtered.length}</span> quy định
                {latest && (
                  <>
                    {' '}· cập nhật gần nhất <span className="font-mono font-semibold text-ink">{latest}</span>
                  </>
                )}
              </div>
            </div>
          </Panel>

          {/* Chip nhóm */}
          <div className="flex gap-2 overflow-x-auto pb-0.5 sm:flex-wrap">
            {['ALL', ...categories].map((c) => {
              const on = category === c;
              return (
                <button
                  key={c}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setCategory(c)}
                  className={`inline-flex h-[31px] flex-none items-center gap-1.5 rounded-full border px-3 text-[11.5px] font-semibold transition-colors ${
                    on
                      ? 'border-ink bg-ink text-canvas'
                      : 'border-line bg-surface text-ink-secondary hover:border-line-hover hover:text-ink'
                  }`}
                >
                  {c === 'ALL' ? 'Tất cả nhóm' : c}
                  <span className={`font-mono text-[10.5px] ${on ? 'opacity-65' : 'text-ink-muted'}`}>{countOf(c)}</span>
                </button>
              );
            })}
          </div>

          {/* Danh sách quy định */}
          <div className="flex flex-col gap-2.5">
            {!loading && filtered.length === 0 && (
              <div className="rounded-[13px] border border-line bg-surface p-6 text-center text-xs text-ink-muted">
                Không tìm thấy quy định phù hợp{q ? ` với từ khoá “${search.trim()}”` : ''}.
              </div>
            )}
            {filtered.map((r) => {
              const chips = ruleChips(r);
              return (
                <section
                  key={r.ruleKey}
                  className="rounded-[13px] border border-line bg-surface px-4 py-3.5 transition-colors hover:border-line-hover"
                >
                  <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-5">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-[13.5px] font-bold tracking-[-0.01em] text-ink">{r.name || r.ruleKey}</h3>
                        <Badge variant="gray">{r.category}</Badge>
                        <span className="rounded-md bg-surface-secondary px-1.5 py-[2.5px] text-[10.5px] font-semibold text-ink-secondary">
                          {r.versionCount > 0 ? `v${r.versionCount} · hiệu lực ${r.effectiveFrom || '—'}` : 'chưa tuỳ chỉnh'}
                        </span>
                      </div>
                      <div className="font-mono text-[10.5px] text-ink-muted">{r.ruleKey}</div>

                      {chips.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          {chips.map((c, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1.5 rounded-[7px] border border-line bg-canvas px-2 py-[3px] text-[11px] text-ink-secondary"
                            >
                              <b className="font-semibold text-ink">{c.label}</b>
                              {c.value}
                            </span>
                          ))}
                        </div>
                      )}

                      {r.description && (
                        <p className="max-w-2xl text-[11.5px] leading-relaxed text-ink-muted">{r.description}</p>
                      )}

                      <details className="pt-0.5">
                        <summary className="cursor-pointer text-[11px] font-medium text-ink-muted hover:text-ink">
                          Xem đủ giá trị đang áp dụng
                        </summary>
                        <div className="mt-2 max-w-2xl">
                          <RuleValueSummary ruleKey={r.ruleKey} value={r.currentValue} />
                        </div>
                      </details>
                    </div>

                    <div className="flex shrink-0 gap-2 sm:flex-col">
                      <button
                        type="button"
                        onClick={() => openHistory(r)}
                        className="inline-flex h-[30px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 text-[11.5px] font-semibold text-ink-secondary transition-colors hover:bg-canvas hover:text-ink sm:flex-none"
                      >
                        <History className="h-3 w-3" />
                        Lịch sử
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(r)}
                        className="inline-flex h-[30px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-accent bg-accent px-2.5 text-[11.5px] font-semibold text-on-accent transition-colors hover:bg-accent-hover sm:flex-none"
                      >
                        <Pencil className="h-3 w-3" />
                        Sửa
                      </button>
                    </div>
                  </div>
                </section>
              );
            })}
          </div>

          <div className="flex items-center gap-2 text-[11px] text-ink-muted">
            <ShieldCheck className="h-3.5 w-3.5" />
            Thay đổi quy định có hiệu lực toàn công ty — mọi lần lưu đều ghi audit log và tạo phiên bản.
          </div>
        </>
      )}

      {loading && <div className="text-sm text-ink-muted">Đang tải {rules.length || 19} quy định…</div>}

      {/* Modal sửa quy định */}
      <Modal
        isOpen={!!editing}
        onClose={() => setEditing(null)}
        title={`Sửa quy định — ${editing?.name ?? ''}`}
        maxWidth="2xl"
      >
        {editing && (
          <div className="space-y-3">
            <div className="text-[11px] text-ink-muted">Scope: toàn công ty · {editing.ruleKey}</div>
            {editing.description && <div className="text-xs text-ink-secondary">{editing.description}</div>}
            <div className="text-xs font-semibold text-ink">Thiết lập quy định</div>
            <div className="grid max-h-[50vh] gap-2 overflow-auto pr-1 sm:grid-cols-2">
              {editing.ruleKey === 'attendance_security' && formValues && isFieldVisible('office_lat', formValues) && (
                <OfficeLocationMap
                  lat={Number.isFinite(Number(formValues.office_lat)) ? Number(formValues.office_lat) : 21.0285}
                  lng={Number.isFinite(Number(formValues.office_lng)) ? Number(formValues.office_lng) : 105.8542}
                  radius={Number(formValues.geofence_radius_m) || 150}
                  onChange={(lat, lng) =>
                    setFormValues((v) => ({
                      ...v,
                      office_lat: Number(lat.toFixed(6)),
                      office_lng: Number(lng.toFixed(6)),
                    }))
                  }
                  onRadiusChange={(r) => setFormValues((v) => ({ ...v, geofence_radius_m: r }))}
                />
              )}
              {Object.entries(formValues || {})
                .filter(([key]) => isFieldVisible(key, formValues))
                .filter(([key]) => !(key === 'office_lat' || key === 'office_lng' || key === 'geofence_radius_m'))
                .map(([key, value]) => renderField(key, value))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink">Ngày hiệu lực</label>
                <input
                  type="date"
                  className="w-full rounded-lg border border-line bg-surface p-2 text-sm text-ink"
                  value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink">Lý do thay đổi *</label>
                <input
                  className="w-full rounded-lg border border-line bg-surface p-2 text-sm text-ink"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="VD: HR chốt tăng quota 2 → 3"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-secondary" onClick={() => setEditing(null)}>
                Huỷ
              </button>
              <button
                className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-50"
                disabled={saving}
                onClick={saveRule}
              >
                {saving ? 'Đang lưu…' : 'Lưu phiên bản mới'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal lịch sử phiên bản */}
      <Modal
        isOpen={!!historyRule}
        onClose={() => setHistoryRule(null)}
        title={`Lịch sử thay đổi — ${historyRule?.name ?? ''}`}
        maxWidth="xl"
      >
        <div className="space-y-3">
          {versions.length === 0 && (
            <div className="text-xs text-ink-muted">Chưa có phiên bản nào (đang dùng seed ban đầu).</div>
          )}
          {versions.map((v) => (
            <div key={v.id} className="space-y-1.5 rounded-xl border border-line bg-canvas/40 p-3 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-ink">{v.version} · {v.effectiveFrom}</span>
                <button
                  className="rounded-lg border border-line bg-surface px-2.5 py-1 text-[11px] font-semibold text-ink-secondary transition-colors hover:bg-canvas hover:text-ink"
                  onClick={() => rollback(v.id)}
                >
                  Rollback
                </button>
              </div>
              <div className="text-ink-muted">Lý do: {v.changeReason}</div>
              {historyRule && <RuleValueSummary ruleKey={historyRule.ruleKey} value={v.value} />}
            </div>
          ))}
          <div className="text-right">
            <button
              className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-secondary"
              onClick={() => setHistoryRule(null)}
            >
              Đóng
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
