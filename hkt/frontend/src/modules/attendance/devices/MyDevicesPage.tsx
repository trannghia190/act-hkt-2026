import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Ban, Clock, Fingerprint, Laptop, Plus, ScanFace, ShieldCheck, Smartphone, Trash2 } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { Badge } from '../../../components/common/Badge';
import { Panel } from '../../../components/common/Panel';
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

const statusBadge = (s: Device['status']) => {
  if (s === 'ACTIVE') return <Badge variant="ok">đang hoạt động</Badge>;
  if (s === 'PENDING') return <Badge variant="warn">chờ HR duyệt</Badge>;
  return <Badge variant="gray">đã thu hồi</Badge>;
};

/** Một dòng thiết bị — cùng cấu trúc cho cả 3 trạng thái, khác nhau ở nhãn + nút. */
const DeviceRow: React.FC<{
  device: Device;
  isCurrent: boolean;
  deleting: boolean;
  onRemove: (d: Device) => void;
}> = ({ device: d, isCurrent, deleting, onRemove }) => {
  const isLaptop = /pc|windows|mac|linux|browser/i.test(`${d.name} ${d.osVersion || ''}`);
  const Icon = isLaptop ? Laptop : Smartphone;
  const revoked = d.status === 'REVOKED';
  return (
    <section
      className={`flex flex-wrap items-start gap-3 rounded-xl border px-3.5 py-3 transition-colors sm:flex-nowrap ${
        revoked ? 'border-line bg-canvas' : d.status === 'PENDING' ? 'border-status-warn-line bg-status-warn-soft/40' : 'border-line bg-surface hover:border-line-hover'
      }`}
    >
      <div className="grid shrink-0 place-items-center rounded-[9px] border border-line bg-surface-secondary text-ink-secondary" style={{ width: 34, height: 34 }}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1 basis-[calc(100%-46px)] space-y-1 sm:basis-auto">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[13.5px] font-bold tracking-[-0.01em] text-ink">{d.name}</span>
          <span className="rounded-md bg-surface-secondary px-1.5 py-[2px] text-[10.5px] font-semibold text-ink-muted">
            {d.osVersion || 'Web'}
          </span>
          {statusBadge(d.status)}
          {isCurrent && <Badge variant="accent">thiết bị hiện tại</Badge>}
        </div>
        <div className="inline-flex items-center gap-1 font-mono text-[10.5px] text-ink-muted">
          <Fingerprint className="h-2.5 w-2.5" />
          {d.fingerprint}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-muted">
          {revoked ? (
            <span className="inline-flex items-center gap-1"><Ban className="h-2.5 w-2.5" />Không thể chấm công</span>
          ) : (
            <span className="inline-flex items-center gap-1"><Clock className="h-2.5 w-2.5" />
              {d.status === 'PENDING' ? `Gửi yêu cầu ${d.createdAt || ''}`.trim() : `Hoạt động ${d.lastActive}`}
            </span>
          )}
        </div>
      </div>
      <div className="flex w-full shrink-0 gap-1.5 sm:w-auto">
        {d.status === 'ACTIVE' && (
          <span className="hidden items-center gap-1 rounded-lg border border-status-ok-line bg-status-ok-soft px-2.5 text-[11px] font-semibold text-status-ok sm:inline-flex">
            đã kích hoạt
          </span>
        )}
        <button
          type="button"
          onClick={() => onRemove(d)}
          disabled={deleting}
          title={d.status === 'ACTIVE' ? 'Xóa thiết bị khỏi tài khoản — máy này sẽ không chấm công được nữa' : undefined}
          className={`inline-flex h-[29px] flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 text-[11.5px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none ${
            d.status === 'PENDING'
              ? 'border border-status-warn-line bg-surface text-status-warn hover:bg-status-warn-soft'
              : 'border border-status-danger-line bg-surface text-status-danger hover:bg-status-danger-soft'
          }`}
        >
          {d.status === 'PENDING' ? <Ban className="h-3 w-3" /> : <Trash2 className="h-3 w-3" />}
          {deleting ? 'Đang xóa…' : d.status === 'PENDING' ? 'Hủy yêu cầu' : 'Xóa thiết bị'}
        </button>
      </div>
    </section>
  );
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
  const revokedCount = devices.filter((d) => d.status === 'REVOKED').length;
  const isCurrentDevice = (d: Device): boolean => d.fingerprint === currentFingerprint;

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-24">
      {/* Đầu trang — mockup T14 */}
      <div className="min-w-0">
        <div className="inline-flex items-center gap-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-accent-dark">
          <Smartphone className="h-3.5 w-3.5" />
          Chấm công
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <h1 className="font-display text-xl font-extrabold tracking-tight text-ink sm:text-[23px]">
            Thiết bị của tôi
          </h1>
          <Badge variant="accent">T14</Badge>
        </div>
        <p className="mt-1 text-xs text-ink-muted">
          Hạn mức 2 thiết bị/tài khoản — máy trong hạn mức kích hoạt ngay, máy thứ 3 cần lý do và chờ HR duyệt.
          Nhận diện bằng fingerprint trình duyệt + khuôn mặt khi chấm công.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-status-danger-line bg-status-danger-soft p-3 text-sm text-status-danger">
          {error}
        </div>
      )}

      {/* Bìa tóm tắt */}
      <div className="overflow-hidden rounded-[16px] border border-line bg-ink px-5 py-4 text-canvas">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-canvas/60">Thiết bị tin cậy</div>
            <div className="mt-1 font-display text-lg font-extrabold">Chỉ máy đã đăng ký mới chấm công được</div>
            <p className="mt-1 max-w-md text-xs leading-relaxed text-canvas/75">
              Fingerprint trình duyệt định danh máy; máy lạ tự vào hàng chờ HR duyệt. Đổi máy thì đăng ký lại tại đây.
            </p>
          </div>
          <dl className="ml-auto flex gap-7">
            <div>
              <dd className="font-display text-2xl font-extrabold tabular-nums text-status-ok">{activeCount}/2</dd>
              <dt className="text-[11px] text-canvas/60">đang hoạt động</dt>
            </div>
            <div>
              <dd className="font-display text-2xl font-extrabold tabular-nums text-status-warn">{pendingCount}</dd>
              <dt className="text-[11px] text-canvas/60">chờ duyệt</dt>
            </div>
            <div>
              <dd className="font-display text-2xl font-extrabold tabular-nums">{revokedCount}</dd>
              <dt className="text-[11px] text-canvas/60">đã thu hồi</dt>
            </div>
          </dl>
        </div>
      </div>

      <Panel
        title="Thiết bị của tôi"
        subtitle={pendingCount > 0 ? `${pendingCount} máy chờ HR duyệt` : 'Các thiết bị đã được định danh hợp lệ'}
        action={
          devices.some(isCurrentDevice) ? (
            <span
              className="inline-flex h-[29px] items-center rounded-lg border border-line bg-canvas px-2.5 text-[11.5px] font-semibold text-ink-muted"
              title="Trình duyệt này đã được đăng ký. Đổi máy khác thì mở trang này trên máy đó."
            >
              ✓ Máy này đã đăng ký
            </span>
          ) : (
            <Link
              to="/attendance/devices/add"
              className="inline-flex h-[29px] items-center gap-1 rounded-lg bg-accent px-2.5 text-[11.5px] font-semibold text-on-accent transition-colors hover:bg-accent-hover"
            >
              <Plus className="h-3 w-3" />
              Đăng ký
            </Link>
          )
        }
        bodyClassName="space-y-2.5"
      >
        {loading ? (
          <div className="py-3 text-xs text-ink-muted">Đang tải danh sách thiết bị…</div>
        ) : devices.length === 0 ? (
          <div className="py-3 text-xs text-ink-muted">
            Chưa có thiết bị nào được ghi nhận. Hãy đăng ký thiết bị để bắt đầu chấm công.
          </div>
        ) : (
          devices.map((d) => (
            <DeviceRow
              key={d.id}
              device={d}
              isCurrent={isCurrentDevice(d)}
              deleting={deletingId === d.id}
              onRemove={removeDevice}
            />
          ))
        )}
      </Panel>

      <Panel bodyClassName="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 space-y-0.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[13.5px] font-bold text-ink">Hồ sơ khuôn mặt</span>
              <Badge variant={user?.faceEnrolled ? 'ok' : 'warn'}>
                {user?.faceEnrolled ? 'đã đăng ký' : 'chưa đăng ký'}
              </Badge>
            </div>
            <div className="text-[11.5px] text-ink-muted">
              {user?.employeeCode || '—'} · {user?.fullName || '—'}
            </div>
            {!user?.faceEnrolled && (
              <div className="text-[11px] text-ink-secondary">Chưa có mẫu khuôn mặt — đăng ký để xác thực khi chấm công.</div>
            )}
          </div>
          <Link
            to="/auth/enroll-face"
            className="inline-flex h-[29px] items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 text-[11.5px] font-semibold text-ink-secondary transition-colors hover:bg-canvas hover:text-ink"
          >
            <ScanFace className="h-3 w-3" />
            {user?.faceEnrolled ? 'Cập nhật mẫu mặt' : 'Đăng ký khuôn mặt'}
          </Link>
        </div>
        <p className="text-[11px] leading-relaxed text-ink-muted">
          Đăng nhập nhanh bằng vân tay/Face ID nằm ở trang{' '}
          <Link to="/account/passkey" className="font-semibold text-accent-dark hover:underline">Passkey &amp; bảo mật</Link>.
        </p>
      </Panel>

      <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-ink-muted">
        <ShieldCheck className="mt-px h-3 w-3 shrink-0" />
        Thiết bị bị xóa hoặc thu hồi sẽ bị chặn chấm công ngay — đăng ký lại phải chờ HR duyệt.
      </p>
    </div>
  );
};
