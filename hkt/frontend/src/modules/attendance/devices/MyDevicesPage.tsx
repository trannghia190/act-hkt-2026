import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { Badge } from '../../../components/common/Badge';
import { getDeviceFingerprint } from '../../../utils/deviceFingerprint';

interface Device {
  id: string;
  name: string;
  fingerprint: string;
  status: 'ACTIVE' | 'PENDING' | 'REVOKED';
  lastActive: string;
  osVersion?: string;
  createdAt?: string;
}

/** Token lấy từ phiên đăng nhập — dùng chung cho tải danh sách và xóa thiết bị. */
const authHeaders = (): Record<string, string> => {
  try {
    const u = JSON.parse(localStorage.getItem('pulse_auth_user') || '{}');
    return u?.accessToken ? { Authorization: `Bearer ${u.accessToken}` } : {};
  } catch {
    return {};
  }
};

export const MyDevicesPage: React.FC = () => {
  const { user } = useAuth();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const currentFingerprint = getDeviceFingerprint();

  const loadDevices = () => {
    fetch('/api/v1/devices', { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        if (Array.isArray(j?.data)) {
          setDevices(
            j.data.map((d: any) => ({
              id: d.id,
              name: d.deviceModel || 'Thiết bị Web',
              fingerprint: d.deviceFingerprint,
              // revoked_at do backend trả về: đã thu hồi ≠ đang chờ duyệt.
              status: d.isApproved ? 'ACTIVE' : d.revokedAt ? 'REVOKED' : 'PENDING',
              lastActive: d.lastActiveAt ? new Date(d.lastActiveAt).toLocaleString('vi-VN') : 'Chưa có hoạt động',
              osVersion: d.osVersion || 'Trình duyệt Web',
              createdAt: d.createdAt ? new Date(d.createdAt).toLocaleDateString('vi-VN') : '',
            }))
          );
        }
      })
      .catch((err) => {
        console.error('Fetch devices error:', err);
        setError('Không tải được danh sách thiết bị');
      })
      .finally(() => setLoading(false));
  };

  const removeDevice = async (d: Device) => {
    const message = d.status === 'PENDING'
      ? `Hủy yêu cầu đăng ký thiết bị "${d.name}"? Bạn sẽ cần gửi lại yêu cầu nếu muốn dùng máy này.`
      : d.status === 'ACTIVE'
        ? `Xóa thiết bị "${d.name}" khỏi tài khoản? Thiết bị này sẽ không chấm công được nữa cho tới khi đăng ký lại.`
        : `Xóa thiết bị "${d.name}" khỏi danh sách?`;
    if (!window.confirm(message)) return;
    setError(null);
    setDeletingId(d.id);
    try {
      const res = await fetch(`/api/v1/devices/${d.id}`, { method: 'DELETE', headers: authHeaders() });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j?.message || 'Không xóa được thiết bị');
        return;
      }
      loadDevices();
    } catch {
      setError('Không xóa được thiết bị — kiểm tra kết nối');
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    loadDevices();
  }, [user]);

  const activeCount = devices.filter((d) => d.status === 'ACTIVE').length;
  const pendingCount = devices.filter((d) => d.status === 'PENDING').length;
  const isCurrentDevice = (d: Device): boolean => d.fingerprint === currentFingerprint;

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Header Card */}
      <div className="bg-canvas border border-line rounded-xl p-6">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-accent-soft text-accent-dark rounded-full text-xs font-semibold border border-accent-line mb-2">
          <span>🔒</span> Quản Lý Thiết Bị Cá Nhân
        </div>
        <h1 className="text-xl font-bold text-ink">Thiết bị đăng ký & Hồ sơ nhận diện</h1>
        <p className="text-xs text-ink-muted mt-1">
          Hạn mức mặc định 2 thiết bị/tài khoản — máy trong hạn mức kích hoạt ngay, từ máy thứ 3 cần lý do và chờ HR duyệt.
          {' '}Hệ thống nhận diện thiết bị bằng fingerprint trình duyệt và kết hợp khuôn mặt khi chấm công.
          {' '}Đăng nhập nhanh bằng vân tay/Face ID nằm ở trang <Link to="/account/passkey" className="text-accent font-semibold">Passkey &amp; bảo mật</Link>.
        </p>
      </div>

      {error && (
        <div className="text-sm text-status-danger bg-status-danger-soft border border-status-danger-line rounded-xl p-3">
          {error}
        </div>
      )}

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
          {devices.some(isCurrentDevice) ? (
            <span
              className="text-xs px-3.5 py-1.5 rounded-lg bg-canvas text-ink-muted font-semibold border border-line cursor-not-allowed"
              title="Trình duyệt này đã được đăng ký. Đổi máy khác thì mở trang này trên máy đó."
            >
              ✓ Thiết bị này đã đăng ký
            </span>
          ) : (
            <Link
              to="/attendance/devices/add"
              className="text-xs px-3.5 py-1.5 rounded-lg bg-accent text-on-accent font-semibold hover:bg-accent-hover transition-colors shadow-xs"
            >
              + Đăng ký thiết bị này
            </Link>
          )}
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
                    : d.status === 'PENDING'
                      ? 'border-status-warn-line bg-status-warn-soft/40'
                      : 'border-line bg-canvas'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-ink">{d.name}</span>
                    <Badge variant={d.status === 'ACTIVE' ? 'accent' : d.status === 'PENDING' ? 'warn' : 'gray'}>
                      {d.status === 'ACTIVE' ? 'Đang hoạt động' : d.status === 'PENDING' ? 'Chờ HR duyệt' : 'Đã thu hồi'}
                    </Badge>
                    {isCurrentDevice(d) && <Badge variant="info">Thiết bị hiện tại</Badge>}
                  </div>
                  <div className="text-[11px] text-ink-muted font-mono">
                    Mã thiết bị: {d.fingerprint}
                  </div>
                  <div className="text-[11px] text-ink-secondary">
                    Lần chấm công gần nhất: <span className="font-medium text-ink">{d.lastActive}</span> · Nền tảng: {d.osVersion}
                  </div>
                </div>

                <div className="text-right flex items-center gap-2">
                  {d.status === 'ACTIVE' && (
                    <span className="text-[11px] text-status-ok font-medium bg-status-ok-soft px-2.5 py-1 rounded-md border border-status-ok-line">
                      ✓ Đã kích hoạt
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeDevice(d)}
                    disabled={deletingId === d.id}
                    title={d.status === 'ACTIVE'
                      ? 'Xóa thiết bị khỏi tài khoản — máy này sẽ không chấm công được nữa'
                      : undefined}
                    className={`text-[11px] px-3 py-1.5 rounded-lg border font-semibold disabled:opacity-50 transition-colors ${
                      d.status === 'PENDING'
                        ? 'border-status-warn-line bg-surface text-status-warn hover:bg-status-warn-soft'
                        : 'border-status-danger-line bg-surface text-status-danger hover:bg-status-danger-soft'
                    }`}
                  >
                    {deletingId === d.id
                      ? 'Đang xóa…'
                      : d.status === 'PENDING' ? 'Hủy yêu cầu' : 'Xóa thiết bị'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Face Biometric Card */}
      <div className="bg-surface border border-line rounded-xl p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-ink">Hồ sơ khuôn mặt AI Biometrics</span>
              <Badge variant={user?.faceEnrolled ? 'accent' : 'warn'}>
                {user?.faceEnrolled ? 'Đã đăng ký' : 'Chưa đăng ký'}
              </Badge>
            </div>
            <div className="text-xs text-ink-muted">
              Tài khoản: <strong className="text-ink">{user?.employeeCode || '—'}</strong> ({user?.fullName || '—'})
            </div>
            {!user?.faceEnrolled && (
              <div className="text-[11px] text-ink-secondary">
                Chưa có mẫu khuôn mặt — đăng ký để xác thực khi chấm công.
              </div>
            )}
          </div>
          <Link
            to="/auth/enroll-face"
            className="text-xs px-3 py-1.5 rounded-lg border border-line bg-canvas text-ink font-semibold hover:border-accent hover:text-accent transition-colors whitespace-nowrap"
          >
            {user?.faceEnrolled ? 'Cập nhật mẫu mặt' : 'Đăng ký khuôn mặt'}
          </Link>
        </div>
      </div>
    </div>
  );
};
