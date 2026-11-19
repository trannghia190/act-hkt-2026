import React, { useEffect, useState } from 'react';

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
      setRules(json.data || []);
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
    setFormValues(JSON.parse(rule.currentValue || '{}'));
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
    if (key === 'offline_max_hours') return Boolean(values.allow_offline_punch);
    if (key === 'geofence_radius_m' || key === 'gps_accuracy_tolerance_m') return Boolean(values.require_geofence);
    if (key === 'face_match_threshold' || key === 'require_liveness' || key === 'face_max_attempts') {
      return Boolean(values.require_face_verification);
    }
    if (key.startsWith('flexible_')) return Boolean(values.is_flexible);
    return true;
  };

  const renderField = (key: string, value: any) => {
    if (typeof value === 'boolean') {
      return (
        <label key={key} className="flex items-center justify-between border border-line rounded-lg px-3 py-2 text-sm">
          <span className="font-mono text-xs">{key}</span>
          <input type="checkbox" checked={value} onChange={(e) => setFormValues((v) => ({ ...v, [key]: e.target.checked }))} />
        </label>
      );
    }
    if (typeof value === 'number') {
      return (
        <label key={key} className="block text-sm">
          <span className="font-mono text-xs text-ink-muted">{key}</span>
          <input type="number" className="mt-1 w-full border border-line rounded-lg p-2 text-sm"
            value={value} onChange={(e) => setFormValues((v) => ({ ...v, [key]: Number(e.target.value) }))} />
        </label>
      );
    }
    if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
      return (
        <label key={key} className="block text-sm">
          <span className="font-mono text-xs text-ink-muted">{key} (JSON)</span>
          <textarea className="mt-1 w-full border border-line rounded-lg p-2 text-xs font-mono" rows={2}
            value={JSON.stringify(value)} onChange={(e) => { try { setFormValues((v) => ({ ...v, [key]: JSON.parse(e.target.value) })); } catch { /* ignore */ } }} />
        </label>
      );
    }
    return (
      <label key={key} className="block text-sm">
        <span className="font-mono text-xs text-ink-muted">{key}</span>
        <input className="mt-1 w-full border border-line rounded-lg p-2 text-sm" value={String(value)}
          onChange={(e) => setFormValues((v) => ({ ...v, [key]: e.target.value }))} />
      </label>
    );
  };

  const filtered = rules.filter((r) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return r.name.toLowerCase().includes(q) || r.ruleKey.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      {toast && <div className="fixed top-16 right-6 z-50 bg-emerald-700 text-white px-4 py-2 rounded text-xs font-semibold">{toast}</div>}

      <div className="bg-canvas border border-line rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="text-xs text-accent font-semibold">S16 · HR</div>
          <h1 className="text-xl font-bold text-ink mt-1">Cấu hình 19 quy định</h1>
          <p className="text-xs text-ink-muted mt-1">Chỉ áp dụng toàn công ty · mỗi lần lưu tạo phiên bản có ngày hiệu lực + lý do.</p>
        </div>
        <input
          className="text-xs px-3 py-2 rounded-lg border border-line bg-surface w-full sm:w-64"
          placeholder="Tìm theo tên hoặc rule_id…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading && <div className="text-sm text-ink-muted">Đang tải 19 quy định…</div>}
      {error && <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">{error}</div>}

      <div className="bg-surface border border-line rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-canvas text-ink-secondary">
            <tr>
              <th className="text-left p-3">Quy định</th>
              <th className="p-3">Nhóm</th>
              <th className="p-3">Phiên bản</th>
              <th className="p-3">Hiệu lực từ</th>
              <th className="p-3 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.ruleKey} className="border-t border-line align-top">
                <td className="p-3">
                  <div className="font-semibold text-ink">{r.name}</div>
                  <div className="text-[11px] font-mono text-ink-muted">{r.ruleKey}</div>
                  <div className="text-[11px] text-ink-muted mt-1 max-w-xl">{r.description}</div>
                </td>
                <td className="p-3 text-center text-xs">{r.category}</td>
                <td className="p-3 text-center text-xs">v{r.versionCount}</td>
                <td className="p-3 text-center text-xs">{r.effectiveFrom || '—'}</td>
                <td className="p-3 text-right whitespace-nowrap">
                  <button className="text-xs px-2 py-1 rounded bg-accent text-white" onClick={() => openEdit(r)}>Sửa</button>
                  <button className="text-xs px-2 py-1 rounded border border-line ml-1" onClick={() => openHistory(r)}>Lịch sử thay đổi</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/40 z-50 grid place-items-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-surface rounded-xl p-5 w-full max-w-2xl space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold">Sửa quy định — {editing.name}</h3>
            <div className="text-[11px] text-ink-muted">Scope: toàn công ty · {editing.ruleKey}</div>
            <label className="block text-xs font-semibold">Các field của quy định</label>
            <div className="grid sm:grid-cols-2 gap-2 max-h-[45vh] overflow-auto pr-1">
              {Object.entries(formValues)
                .filter(([key]) => isFieldVisible(key, formValues))
                .map(([key, value]) => renderField(key, value))}
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold">Ngày hiệu lực</label>
                <input type="date" className="w-full border border-line rounded-lg p-2 text-sm" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-semibold">Lý do thay đổi *</label>
                <input className="w-full border border-line rounded-lg p-2 text-sm" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="VD: HR chốt tăng quota 2 → 3" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button className="text-xs px-3 py-1.5 rounded border border-line" onClick={() => setEditing(null)}>Huỷ</button>
              <button className="text-xs px-3 py-1.5 rounded bg-accent text-white disabled:opacity-50" disabled={saving} onClick={saveRule}>
                {saving ? 'Đang lưu…' : 'Lưu phiên bản mới'}
              </button>
            </div>
          </div>
        </div>
      )}

      {historyRule && (
        <div className="fixed inset-0 bg-black/40 z-50 grid place-items-center p-4" onClick={() => setHistoryRule(null)}>
          <div className="bg-surface rounded-xl p-5 w-full max-w-xl space-y-3 max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold">Lịch sử thay đổi — {historyRule.name}</h3>
            {versions.length === 0 && <div className="text-xs text-ink-muted">Chưa có phiên bản nào (đang dùng seed ban đầu).</div>}
            {versions.map((v) => (
              <div key={v.id} className="border border-line rounded-lg p-3 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="font-semibold">{v.version} · {v.effectiveFrom}</span>
                  <button className="px-2 py-1 rounded border border-line" onClick={() => rollback(v.id)}>Rollback</button>
                </div>
                <div className="text-ink-muted">Lý do: {v.changeReason}</div>
                <pre className="bg-canvas p-2 rounded overflow-x-auto">{v.value}</pre>
              </div>
            ))}
            <div className="text-right"><button className="text-xs px-3 py-1.5 rounded border border-line" onClick={() => setHistoryRule(null)}>Đóng</button></div>
          </div>
        </div>
      )}
    </div>
  );
};
