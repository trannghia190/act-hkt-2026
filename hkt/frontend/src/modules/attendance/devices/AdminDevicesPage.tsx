import React, { useEffect, useState } from 'react';

interface Device {
  id: string;
  deviceFingerprint: string;
  deviceModel?: string;
  osVersion?: string;
  isApproved: boolean;
  userId: string;
  lastActiveAt?: string;
  revokedAt?: string;
}

const authHeaders = (): Record<string, string> => {
  try { const u = JSON.parse(localStorage.getItem('pulse_auth_user') || '{}'); return u?.accessToken ? { Authorization: `Bearer ${u.accessToken}` } : {}; } catch { return {}; }
};

export const AdminDevicesPage: React.FC = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    fetch('/api/v1/admin/devices', { headers: authHeaders() })
      .then(r => r.json()).then(j => { if (Array.isArray(j?.data)) setDevices(j.data); else setError(j?.message || 'Không tải được thiết bị'); })
      .catch(() => setError('Không tải được thiết bị'));
  };
  useEffect(load, []);
  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2500); };

  const act = async (d: Device, approve: boolean) => {
    let reason = '';
    if (!approve) {
      reason = window.prompt('Lý do thu hồi (bắt buộc):', 'Mất máy / đổi thiết bị mới') || '';
      if (!reason.trim()) return;
    }
    const res = await fetch(`/api/v1/admin/devices/${d.id}/${approve ? 'approve' : 'revoke'}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: approve ? '{}' : JSON.stringify({ reason }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setError(json?.message || 'Thao tác thất bại'); return; }
    showToast(approve ? 'Đã duyệt thiết bị' : 'Đã thu hồi thiết bị'); load();
  };

  const pending = devices.filter(d => !d.isApproved && !d.revokedAt);
  const active = devices.filter(d => d.isApproved);
  const revoked = devices.filter(d => !d.isApproved && d.revokedAt);

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {toast && <div className="fixed top-16 right-6 z-[100] bg-emerald-700 text-white px-4 py-2 rounded text-xs font-semibold">{toast}</div>}
      <div className="bg-canvas border border-line rounded-xl p-6">
        <h1 className="text-xl font-bold text-ink mt-1">Quản lý thiết bị — duyệt & thu hồi</h1>
        <p className="text-xs text-ink-muted mt-1">Mặc định2 thiết bị/người; máy thứ3 trở đi cần lý do. Mọi thao tác ghi nhật ký thay đổi.</p>
      </div>
      {error && <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">{error}</div>}

      <div className="bg-surface border border-line rounded-xl p-4">
        <h2 className="text-sm font-bold mb-2">Chờ duyệt ({pending.length})</h2>
        {pending.length === 0 && <div className="text-xs text-ink-muted mb-2">Không có yêu cầu chờ duyệt.</div>}
        {pending.map(d => (
          <div key={d.id} className="flex items-center justify-between border border-line rounded-lg px-3 py-2 mb-2 text-sm">
            <div><div className="font-semibold">{d.deviceModel || 'Thiết bị'} · {d.userId.slice(0, 8)}</div>
              <div className="text-xs text-ink-muted">{d.deviceFingerprint}</div></div>
            <div className="flex gap-2">
              <button className="text-xs px-3 py-1 rounded bg-emerald-600 text-white" onClick={() => act(d, true)}>Duyệt</button>
              <button className="text-xs px-3 py-1 rounded border border-line" onClick={() => act(d, false)}>Từ chối</button>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-surface border border-line rounded-xl p-4">
        <h2 className="text-sm font-bold mb-2">Đang hoạt động ({active.length})</h2>
        {active.map(d => (
          <div key={d.id} className="flex items-center justify-between border border-line rounded-lg px-3 py-2 mb-2 text-sm">
            <div><div className="font-semibold">{d.deviceModel || 'Thiết bị'} · {d.userId.slice(0, 8)}</div>
              <div className="text-xs text-ink-muted">{d.deviceFingerprint} · {d.osVersion || 'Web'}</div></div>
            <button className="text-xs px-3 py-1 rounded border border-line" onClick={() => act(d, false)}>Thu hồi</button>
          </div>
        ))}
      </div>

      <div className="bg-surface border border-line rounded-xl p-4">
        <h2 className="text-sm font-bold mb-2">Đã thu hồi ({revoked.length})</h2>
        {revoked.length === 0 && <div className="text-xs text-ink-muted mb-2">Chưa có thiết bị nào bị thu hồi.</div>}
        {revoked.map(d => (
          <div key={d.id} className="flex items-center justify-between border border-line bg-canvas rounded-lg px-3 py-2 mb-2 text-sm">
            <div><div className="font-semibold">{d.deviceModel || 'Thiết bị'} · {d.userId.slice(0, 8)}</div>
              <div className="text-xs text-ink-muted">{d.deviceFingerprint} · thu hồi lúc {d.revokedAt ? new Date(d.revokedAt).toLocaleString('vi-VN') : '—'}</div></div>
            <span className="text-[11px] text-ink-muted">Không thể chấm công</span>
          </div>
        ))}
      </div>
    </div>
  );
};
