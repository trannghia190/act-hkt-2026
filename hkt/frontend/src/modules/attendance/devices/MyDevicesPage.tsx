import React, { useEffect, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';

interface Device { id: string; name: string; fingerprint: string; status: 'ACTIVE' | 'PENDING' | 'REVOKED'; lastActive: string; }

export const MyDevicesPage: React.FC = () => {
  const { user } = useAuth();
  const [devices, setDevices] = useState<Device[]>([
    { id: 'D1', name: 'iPhone 15', fingerprint: 'web-a91f2c', status: 'ACTIVE', lastActive: '12/11/2026 09:41' },
  ]);
  useEffect(() => {
    fetch('/api/v1/devices')
      .then(r => r.json())
      .then(j => { if (Array.isArray(j?.data)) setDevices(j.data.map((d: any) => ({ id: d.id, name: d.deviceModel || 'Thiết bị', fingerprint: d.deviceFingerprint, status: d.isApproved ? 'ACTIVE' : 'PENDING', lastActive: d.lastActiveAt || '—' }))); })
      .catch(() => undefined);
  }, []);
  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="bg-canvas border border-line rounded-xl p-6">
        <div className="text-xs text-accent font-semibold">S27 · Thiết bị của tôi</div>
        <h1 className="text-xl font-bold text-ink mt-1">Thiết bị đăng ký & hồ sơ khuôn mặt</h1>
        <p className="text-xs text-ink-muted mt-1">Mặc định 2 thiết bị/người. Thiết bị mới cần HR duyệt trước khi chấm công.</p>
      </div>
      <div className="bg-surface border border-line rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold">Thiết bị đang dùng ({devices.filter(d => d.status === 'ACTIVE').length}/2)</h2>
          <a href="/attendance/devices/add" className="text-xs px-3 py-1.5 rounded bg-accent text-white">+ Đăng ký thiết bị</a>
        </div>
        {devices.map(d => (
          <div key={d.id} className="flex items-center justify-between border border-line rounded-lg px-3 py-2 mb-2 text-sm">
            <div>
              <div className="font-semibold">{d.name}</div>
              <div className="text-xs text-ink-muted">{d.fingerprint} · lần cuối {d.lastActive}</div>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded ${d.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{d.status === 'ACTIVE' ? 'Đang hoạt động' : 'Chờ duyệt'}</span>
          </div>
        ))}
      </div>
      <div className="bg-surface border border-line rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-bold">Hồ sơ khuôn mặt</div>
            <div className="text-xs text-ink-muted">Tài khoản {user?.employeeCode} · chỉ lưu vector, không lưu ảnh thô</div>
          </div>
          <a href="/auth/enroll-face" className="text-xs px-3 py-1.5 rounded border border-line">Đăng ký lại</a>
        </div>
      </div>
    </div>
  );
};
