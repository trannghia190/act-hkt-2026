import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { Badge } from '../../../components/common/Badge';

interface Device {
  id: string;
  name: string;
  fingerprint: string;
  status: 'ACTIVE' | 'PENDING' | 'REVOKED';
  lastActive: string;
  osVersion?: string;
  createdAt?: string;
}

export const MyDevicesPage: React.FC = () => {
  const { user } = useAuth();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDevices = () => {
    const token = (() => {
      try {
        const u = JSON.parse(localStorage.getItem('pulse_auth_user') || '{}');
        return u?.accessToken || user?.accessToken || '';
      } catch {
        return user?.accessToken || '';
      }
    })();

    fetch('/api/v1/devices', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json())
      .then((j) => {
        if (Array.isArray(j?.data)) {
          setDevices(
            j.data.map((d: any) => ({
              id: d.id,
              name: d.deviceModel || 'Thiết bị Web',
              fingerprint: d.deviceFingerprint,
              status: d.isApproved ? 'ACTIVE' : 'PENDING',
              lastActive: d.lastActiveAt ? new Date(d.lastActiveAt).toLocaleString('vi-VN') : 'Chưa có hoạt động',
              osVersion: d.osVersion || 'Trình duyệt Web',
              createdAt: d.createdAt ? new Date(d.createdAt).toLocaleDateString('vi-VN') : '',
            }))
          );
        }
      })
      .catch((err) => console.error('Fetch devices error:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadDevices();
  }, [user]);

  const activeCount = devices.filter((d) => d.status === 'ACTIVE').length;
  const pendingCount = devices.filter((d) => d.status === 'PENDING').length;

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Header Card */}
      <div className="bg-canvas border border-line rounded-xl p-6">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-accent-soft text-accent rounded-full text-xs font-semibold border border-accent-line mb-2">
          <span>🔒</span> Quản Lý Thiết Bị Cá Nhân (S27)
        </div>
        <h1 className="text-xl font-bold text-ink">Thiết bị đăng ký & Hồ sơ nhận diện</h1>
        <p className="text-xs text-ink-muted mt-1">
          Hạn mức mặc định 2 thiết bị/tài khoản. Quota chấm công tính theo người (tối đa 1 check-in + 1 check-out/ngày), không phụ thuộc vào thiết bị.
        </p>
      </div>

      {/* Device List Card */}
      <div className="bg-surface border border-line rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div>
            <h2 className="text-sm font-bold text-ink">
              Thiết bị của tôi ({activeCount}/2 đang hoạt động)
            </h2>
            <p className="text-[11px] text-ink-muted mt-0.5">
              {pendingCount > 0
                ? `Có ${pendingCount} thiết bị đang ở hàng chờ HR duyệt`
                : 'Đang dùng các thiết bị đã được định danh hợp lệ'}
            </p>
          </div>
          <Link
            to="/attendance/devices/add"
            className="text-xs px-3.5 py-1.5 rounded-lg bg-accent text-white font-semibold hover:bg-accent-hover transition-colors shadow-xs"
          >
            + Thêm thiết bị mới
          </Link>
        </div>

        {loading ? (
          <div className="py-6 text-center text-xs text-ink-muted">Đang tải danh sách thiết bị...</div>
        ) : devices.length === 0 ? (
          <div className="py-6 text-center text-xs text-ink-muted">
            Chưa có thiết bị nào được ghi nhận. Hãy đăng ký thiết bị để bắt đầu chấm công.
          </div>
        ) : (
          <div className="space-y-2.5">
            {devices.map((d) => (
              <div
                key={d.id}
                className={`flex flex-col sm:flex-row sm:items-center justify-between border rounded-xl p-3.5 gap-2 transition-all ${
                  d.status === 'ACTIVE'
                    ? 'border-line bg-surface hover:border-accent/40'
                    : 'border-amber-200 bg-amber-50/40'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-ink">{d.name}</span>
                    <Badge variant={d.status === 'ACTIVE' ? 'accent' : 'warn'}>
                      {d.status === 'ACTIVE' ? 'Đang hoạt động' : 'Chờ HR duyệt'}
                    </Badge>
                  </div>
                  <div className="text-[11px] text-ink-muted font-mono">
                    Mã thiết bị: {d.fingerprint}
                  </div>
                  <div className="text-[11px] text-ink-secondary">
                    Lần chấm công gần nhất: <span className="font-medium text-ink">{d.lastActive}</span> · Nền tảng: {d.osVersion}
                  </div>
                </div>

                <div className="text-right flex items-center gap-2">
                  {d.status === 'PENDING' ? (
                    <span className="text-[11px] text-amber-700 font-medium italic bg-amber-100/60 px-2.5 py-1 rounded-md border border-amber-300">
                      ⏳ Đang chờ HR duyệt — không thể tự xóa
                    </span>
                  ) : (
                    <span className="text-[11px] text-emerald-700 font-medium bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                      ✓ Đã kích hoạt
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Face Biometric Card */}
      <div className="bg-surface border border-line rounded-xl p-5">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="text-sm font-bold text-ink">Hồ sơ khuôn mặt AI Biometrics (S05m)</div>
            <div className="text-xs text-ink-muted">
              Tài khoản: <strong className="text-ink">{user?.employeeCode || '—'}</strong> ({user?.fullName || '—'})
            </div>
            <div className="text-[11px] text-ink-secondary">
              Bảo mật tiêu chuẩn: Chỉ lưu trữ vector đặc trưng 512 chiều trích xuất qua OpenCV, tuyệt đối không lưu ảnh thô.
            </div>
          </div>
          <Link
            to="/auth/enroll-face"
            className="text-xs px-3 py-1.5 rounded-lg border border-line bg-canvas text-ink font-semibold hover:border-accent hover:text-accent transition-colors"
          >
            Chụp lại mẫu mặt
          </Link>
        </div>
      </div>
    </div>
  );
};
