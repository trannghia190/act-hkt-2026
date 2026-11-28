import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Fingerprint, Send, Smartphone } from 'lucide-react';
import { Button } from '../../../components/common/Button';
import { Badge } from '../../../components/common/Badge';
import { getDeviceFingerprint } from '../../../utils/deviceFingerprint';
import { detectClientDeviceType } from '../../../utils/deviceType';

/** Hạn mức thiết bị mặc định — khớp attendance_security.max_devices bên backend. */
const MAX_DEVICES = 2;

const authToken = (): string => {
  try {
    return JSON.parse(localStorage.getItem('pulse_auth_user') || '{}')?.accessToken || '';
  } catch {
    return '';
  }
};

export const AddDevicePage: React.FC = () => {
  const navigate = useNavigate();
  const [reason, setReason] = useState('');
  const [deviceName, setDeviceName] = useState(() => {
    const ua = navigator.userAgent;
    if (/iPhone/i.test(ua)) return 'iPhone Mobile Safari';
    if (/Android/i.test(ua)) return 'Android Chrome';
    if (/Macintosh/i.test(ua)) return 'MacBook Chrome';
    if (/Windows/i.test(ua)) return 'Windows PC Chrome';
    return 'Web Device';
  });
  const [sent, setSent] = useState(false);
  const [activeNow, setActiveNow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Còn hạn mức → kích hoạt ngay; hết hạn mức mới phải nhập lý do + chờ HR duyệt.
  const [withinQuota, setWithinQuota] = useState<boolean | null>(null);
  const [approvedCount, setApprovedCount] = useState(0);

  const [fingerprint] = useState(getDeviceFingerprint());

  useEffect(() => {
    const token = authToken();
    fetch('/api/v1/devices', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((r) => r.json())
      .then((j) => {
        const approved = Array.isArray(j?.data)
          ? j.data.filter((d: any) => d.isApproved && !d.revokedAt).length
          : 0;
        setApprovedCount(approved);
        setWithinQuota(approved < MAX_DEVICES);
      })
      .catch(() => setWithinQuota(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (withinQuota === null) return;
    if (!withinQuota && !reason.trim()) {
      setError(`Bắt buộc nhập lý do khi đăng ký quá ${MAX_DEVICES} thiết bị`);
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const token = authToken();

      const res = await fetch('/api/v1/devices/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'X-Office-Network': 'true',
        },
        body: JSON.stringify({
          fingerprint,
          deviceName,
          reason: reason.trim() || 'Đăng ký thiết bị trong hạn mức',
          wifiBssid: 'ACT_OFFICE_5G',
          // Giúp server phân biệt iPad (UA giống macOS); server chỉ dùng để hiển thị.
          deviceTypeHint: detectClientDeviceType(),
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 403) {
          setError('Yêu cầu thêm thiết bị chỉ nhận từ mạng nội bộ công ty (Wi-Fi ACT_OFFICE_5G).');
        } else {
          setError(json?.message || `Đăng ký thiết bị thất bại (HTTP ${res.status})`);
        }
        setLoading(false);
        return;
      }

      setSent(true);
      setActiveNow(!!json?.data?.isApproved);
      setLoading(false);
    } catch (err: any) {
      setError(err?.message || 'Không thể kết nối đến máy chủ. Vui lòng thử lại.');
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-4 pb-24">
      {/* Đầu trang — mockup T15 */}
      <div className="min-w-0">
        <div className="inline-flex items-center gap-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-accent-dark">
          <Smartphone className="h-3.5 w-3.5" />
          Chấm công
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <h1 className="font-display text-xl font-extrabold tracking-tight text-ink sm:text-[23px]">
            Đăng ký thiết bị
          </h1>
          <Badge variant="accent">T15</Badge>
        </div>
        <p className="mt-1 text-xs text-ink-muted">
          Trang này đăng ký chính trình duyệt/thiết bị bạn đang mở. Máy thứ 3 trở đi cần lý do và chờ HR duyệt từ mạng nội bộ công ty.
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
            <div className="text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-canvas/60">Đăng ký thiết bị</div>
            <div className="mt-1 font-display text-lg font-extrabold">
              {withinQuota === false ? `Đã đủ hạn mức ${MAX_DEVICES}/${MAX_DEVICES} thiết bị` : 'Kích hoạt thiết bị đang mở'}
            </div>
            <p className="mt-1 max-w-md text-xs leading-relaxed text-canvas/75">
              {withinQuota === false
                ? 'Bạn đang đăng ký thêm máy ngoài hạn mức — cần nêu lý do, gửi từ Wi-Fi nội bộ và chờ HR duyệt trong 30 ngày.'
                : 'Máy trong hạn mức kích hoạt ngay, không cần lý do hay chờ HR duyệt.'}
            </p>
          </div>
          <dl className="ml-auto flex gap-7">
            <div>
              <dd className="font-display text-2xl font-extrabold tabular-nums">{approvedCount}/{MAX_DEVICES}</dd>
              <dt className="text-[11px] text-canvas/60">đã dùng</dt>
            </div>
            <div>
              <dd className="font-display text-2xl font-extrabold tabular-nums">{withinQuota === false ? '30' : 'Ngay'}</dd>
              <dt className="text-[11px] text-canvas/60">{withinQuota === false ? 'ngày hiệu lực' : 'kích hoạt'}</dt>
            </div>
            <div>
              <dd className="font-display text-xl font-extrabold">Wi-Fi</dd>
              <dt className="text-[11px] text-canvas/60">nội bộ</dt>
            </div>
          </dl>
        </div>
      </div>

      {sent ? (
        <div className="rounded-[13px] border border-status-ok-line bg-status-ok-soft p-6 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-status-ok" />
          <h2 className="mt-2 text-sm font-bold text-status-ok">
            {activeNow ? 'Thiết bị đã được kích hoạt' : 'Yêu cầu đã được gửi thành công'}
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-ink-secondary">
            {activeNow ? (
              <>Thiết bị <code className="rounded bg-surface px-1 font-mono">{fingerprint}</code> đã dùng để chấm công được ngay.</>
            ) : (
              <>Thiết bị <code className="rounded bg-surface px-1 font-mono">{fingerprint}</code> đang ở hàng chờ HR duyệt.
                Sau khi HR phê duyệt, bạn có thể dùng thiết bị này để chấm công.</>
            )}
          </p>
          <div className="mt-4">
            <Button variant="primary" size="sm" onClick={() => navigate('/attendance/devices')}>
              Quay lại danh sách thiết bị
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="rounded-[13px] border border-line bg-surface">
          <div className="border-b border-line px-4 py-3">
            <div className="text-[13.5px] font-bold text-ink">Thông tin thiết bị</div>
            <div className="mt-0.5 text-[11px] text-ink-muted">Fingerprint do trình duyệt sinh, không sửa được — chỉ đổi tên để dễ nhận biết</div>
          </div>
          <div className="space-y-3 px-4 py-3.5">
            <label className="block">
              <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-ink">
                <Fingerprint className="h-3 w-3" />
                Mã định danh thiết bị (Fingerprint)
              </span>
              <input
                type="text"
                readOnly
                value={fingerprint}
                className="w-full rounded-lg border border-line bg-canvas p-2 font-mono text-xs text-ink-secondary"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold text-ink">Tên / Model thiết bị</span>
              <input
                type="text"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink"
                placeholder="VD: iPhone 15 Pro, MacBook Pro M3…"
              />
              <span className="mt-1 block text-[11px] text-ink-muted">Tên hiển thị trong danh sách thiết bị của bạn.</span>
            </label>

            {withinQuota === true ? (
              <div className="flex items-start gap-2 rounded-[10px] border border-status-ok-line bg-status-ok-soft p-2.5 text-[11px] leading-relaxed text-status-ok">
                <CheckCircle2 className="mt-px h-3.5 w-3.5 shrink-0" />
                <span>Bạn còn hạn mức thiết bị — bấm đăng ký là dùng được ngay, không cần lý do hay chờ HR duyệt.</span>
              </div>
            ) : withinQuota === false ? (
              <>
                <label className="block">
                  <span className="mb-1.5 block text-[11px] font-semibold text-ink">
                    Lý do cần thêm thiết bị <span className="text-status-danger">* (Bắt buộc)</span>
                  </span>
                  <textarea
                    className="w-full rounded-lg border border-line bg-surface p-2.5 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-accent"
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="VD: Đổi máy mới do điện thoại cũ bị hỏng màn hình…"
                  />
                  <span className="mt-1 block text-[11px] text-ink-muted">
                    Bạn đã đủ {MAX_DEVICES} thiết bị — thiếu lý do hệ thống sẽ không cho phép gửi yêu cầu.
                  </span>
                </label>

                <div className="flex items-start gap-2 rounded-[10px] border border-status-warn-line bg-status-warn-soft p-2.5 text-[11px] leading-relaxed text-status-warn">
                  <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
                  <span>Yêu cầu thêm thiết bị chỉ nhận từ mạng nội bộ công ty (Wi-Fi <b>ACT_OFFICE_5G</b>). Ngoài mạng này hệ thống trả lỗi 403.</span>
                </div>

                <div className="rounded-[10px] border border-line bg-canvas p-2.5 text-[11px] leading-relaxed text-ink-muted">
                  <b className="mb-0.5 block text-[11.5px] text-ink">Quy định phê duyệt</b>
                  • Chỉ gửi được yêu cầu từ mạng nội bộ công ty (ACT_OFFICE_5G).<br />
                  • Yêu cầu có thời hạn hiệu lực 30 ngày trong hàng chờ của HR.
                </div>
              </>
            ) : null}

            <div className="flex flex-wrap justify-end gap-1.5 pt-0.5">
              <Button type="button" variant="outline" size="sm" onClick={() => navigate('/attendance/devices')}>
                Hủy
              </Button>
              <button
                type="submit"
                disabled={withinQuota === null || (!withinQuota && !reason.trim()) || loading}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-on-accent shadow-xs transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Send className="h-3 w-3" />
                {withinQuota === null
                  ? 'Đang kiểm tra hạn mức…'
                  : loading
                    ? 'Đang xử lý…'
                    : withinQuota ? 'Thêm thiết bị' : 'Gửi yêu cầu chờ HR duyệt'}
              </button>
            </div>
          </div>
        </form>
      )}

      <p className="text-center text-[11px] text-ink-muted">
        Thiết bị trong hạn mức được kích hoạt ngay, không cần lý do. Xem danh sách tại{' '}
        <button type="button" onClick={() => navigate('/attendance/devices')} className="font-semibold text-accent-dark hover:underline">
          Thiết bị của tôi
        </button>.
      </p>
    </div>
  );
};
