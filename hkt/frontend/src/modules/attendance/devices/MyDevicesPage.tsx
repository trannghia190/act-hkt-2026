import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { Badge } from '../../../components/common/Badge';
import {
  clearLocalPasskeyMark,
  getLocalPasskeyMark,
  getWebAuthnStatus,
  isWebAuthnSupported,
  registerPasskey,
} from '../../../utils/webauthn';
import type { LocalPasskeyMark } from '../../../utils/webauthn';
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
  const [hasPasskey, setHasPasskey] = useState(false);
  const [registeringPasskey, setRegisteringPasskey] = useState(false);
  const [passkeyMessage, setPasskeyMessage] = useState<string | null>(null);
  const [passkeyOk, setPasskeyOk] = useState(false);
  // Dấu passkey của CHÍNH trình duyệt này (khác với hasPasskey = tài khoản đã có passkey ở đâu đó).
  const [passkeyMark, setPasskeyMark] = useState<LocalPasskeyMark | null>(() => getLocalPasskeyMark());
  const webAuthnSupported = isWebAuthnSupported();
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
    const hasPasskeyHere = passkeyMark?.deviceId === d.id;
    const message = d.status === 'PENDING'
      ? `Hủy yêu cầu đăng ký thiết bị "${d.name}"? Bạn sẽ cần gửi lại yêu cầu nếu muốn dùng máy này.`
      : d.status === 'ACTIVE'
        ? `Xóa thiết bị "${d.name}" khỏi tài khoản? Thiết bị này sẽ không chấm công được nữa cho tới khi đăng ký lại.${hasPasskeyHere ? ' Passkey trên máy này cũng bị gỡ.' : ''}`
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
      // Xóa chính passkey của máy này → bỏ dấu + thông báo để nút đăng ký mở lại.
      if (hasPasskeyHere) {
        clearLocalPasskeyMark();
        setPasskeyMark(null);
        setPasskeyMessage(null);
      }
      loadDevices();
      // Xóa máy có passkey có thể làm tài khoản hết passkey → nhãn trạng thái phải cập nhật theo.
      getWebAuthnStatus().then((s) => setHasPasskey(s.hasPasskey));
    } catch {
      setError('Không xóa được thiết bị — kiểm tra kết nối');
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    loadDevices();
    getWebAuthnStatus().then((s) => setHasPasskey(s.hasPasskey));
  }, [user]);

  // Thiết bị bị HR thu hồi → dấu passkey của máy này hết hiệu lực.
  // Chỉ đối chiếu khi tải danh sách thành công: lỗi mạng không được phép xóa dấu.
  // KHÔNG xóa khi thiết bị vắng mặt: danh sách có thể còn là bản cũ ngay sau khi
  // vừa đăng ký, xóa lúc đó sẽ nuốt mất thông báo "đã đăng ký passkey".
  useEffect(() => {
    if (loading || error || !passkeyMark) return;
    const device = devices.find((d) => d.id === passkeyMark.deviceId);
    if (device && device.status === 'REVOKED') {
      clearLocalPasskeyMark();
      setPasskeyMark(null);
      // Dấu đã hết hiệu lực thì thông báo "đã đăng ký máy này" cũng không còn đúng.
      setPasskeyMessage(null);
    }
  }, [devices, loading, error, passkeyMark]);

  const handleRegisterPasskey = async () => {
    setPasskeyMessage(null);
    setRegisteringPasskey(true);
    try {
      const result = await registerPasskey();
      setPasskeyOk(result.approved);
      setPasskeyMessage(result.approved
        ? 'Đã đăng ký passkey cho thiết bị này — có thể dùng vân tay/Face ID khi chấm công.'
        : 'Đã ghi nhận passkey, thiết bị đang chờ HR duyệt.');
      setHasPasskey(true);
      setPasskeyMark(getLocalPasskeyMark());
      loadDevices();
    } catch (e: any) {
      setPasskeyOk(false);
      setPasskeyMessage(e?.message || 'Không đăng ký được passkey.');
    } finally {
      setRegisteringPasskey(false);
    }
  };

  const activeCount = devices.filter((d) => d.status === 'ACTIVE').length;
  const pendingCount = devices.filter((d) => d.status === 'PENDING').length;
  const markDevice = passkeyMark ? devices.find((d) => d.id === passkeyMark.deviceId) : undefined;
  // Dấu local là nguồn chính: danh sách /devices có thể chưa kịp chứa máy vừa đăng ký.
  // Chỉ coi là "máy khác" khi chắc chắn máy trong dấu đã bị thu hồi (effect bên trên sẽ xoá dấu).
  const passkeyOnThisDevice = !!passkeyMark && (!markDevice || markDevice.status !== 'REVOKED');
  const isCurrentDevice = (d: Device): boolean =>
    d.id === passkeyMark?.deviceId || d.fingerprint === currentFingerprint;

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
          {' '}Cách đăng ký: bấm <strong>Đăng ký passkey</strong> — máy còn hạn mức được dùng để chấm công ngay; vượt hạn mức thì chờ HR duyệt.
          {' '}Passkey gắn với authenticator (Touch ID/Face ID/Windows Hello hoặc tài khoản đồng bộ iCloud/Google), và hệ thống đếm mỗi passkey là một thiết bị — passkey đồng bộ dùng trên nhiều máy vẫn chỉ là một thiết bị.
        </p>
      </div>

      {webAuthnSupported && (
        <div className="bg-canvas border border-line rounded-xl p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold text-ink flex items-center gap-2">
                <span>🔐</span> Khóa thiết bị bằng Passkey (WebAuthn)
                {passkeyOnThisDevice && <Badge variant="accent">Đã đăng ký thiết bị này</Badge>}
                {!passkeyOnThisDevice && hasPasskey && !passkeyMessage && (
                  <Badge variant="info">Tài khoản đã có passkey ở thiết bị khác</Badge>
                )}
              </h2>
              <p className="text-xs text-ink-muted mt-1">
                Đây là cách đăng ký thiết bị để chấm công. Dùng vân tay / Face ID / Windows Hello để ký mỗi lần chấm công; private key không rời khỏi thiết bị.
              </p>
              {passkeyMessage && (
                <p className={`text-xs mt-2 ${passkeyOk ? 'text-emerald-700' : 'text-rose-700'}`}>{passkeyMessage}</p>
              )}
            </div>
            <button
              type="button"
              onClick={handleRegisterPasskey}
              disabled={registeringPasskey || passkeyOnThisDevice}
              title={passkeyOnThisDevice ? 'Thiết bị này đã đăng ký passkey — không cần đăng ký lại.' : undefined}
              className="shrink-0 px-4 py-2 rounded-lg bg-accent text-white text-xs font-semibold disabled:opacity-50"
            >
              {registeringPasskey
                ? 'Đang đăng ký…'
                : passkeyOnThisDevice
                  ? '✓ Đã đăng ký thiết bị này'
                  : hasPasskey
                    ? 'Đăng ký passkey thiết bị này'
                    : 'Đăng ký passkey'}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">
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
          {webAuthnSupported ? (
            <span className="text-[11px] text-ink-muted max-w-[230px] text-right">
              {passkeyOnThisDevice
                ? 'Máy này đã khóa bằng passkey — dùng vân tay/Face ID khi chấm công.'
                : 'Máy này hỗ trợ passkey — đăng ký ở khung phía trên, không cần chờ HR duyệt.'}
            </span>
          ) : (
            <Link
              to="/attendance/devices/add"
              className="text-xs px-3.5 py-1.5 rounded-lg bg-accent text-white font-semibold hover:bg-accent-hover transition-colors shadow-xs"
            >
              + Thêm thiết bị mới
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
                      ? 'border-amber-200 bg-amber-50/40'
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
                    <span className="text-[11px] text-emerald-700 font-medium bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
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
                        ? 'border-amber-300 bg-white text-amber-800 hover:bg-amber-100'
                        : 'border-rose-300 bg-white text-rose-700 hover:bg-rose-50'
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
