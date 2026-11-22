import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../../components/common/Button';
import { getDeviceFingerprint } from '../../../utils/deviceFingerprint';

/** Hạn mức thiết bị mặc định — khớp attendance_security.max_devices bên backend. */
const MAX_DEVICES = 2;

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

  const [fingerprint] = useState(getDeviceFingerprint());

  useEffect(() => {
    const token = (() => {
      try {
        const u = JSON.parse(localStorage.getItem('pulse_auth_user') || '{}');
        return u?.accessToken || '';
      } catch {
        return '';
      }
    })();
    fetch('/api/v1/devices', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((r) => r.json())
      .then((j) => {
        const approved = Array.isArray(j?.data)
          ? j.data.filter((d: any) => d.isApproved && !d.revokedAt).length
          : 0;
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
      const token = (() => {
        try {
          const u = JSON.parse(localStorage.getItem('pulse_auth_user') || '{}');
          return u?.accessToken || '';
        } catch {
          return '';
        }
      })();

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
    <div className="max-w-xl mx-auto space-y-4">
      <div className="bg-canvas border border-line rounded-xl p-6">
        <h1 className="text-xl font-bold text-ink mt-1">Đăng ký thiết bị đang dùng</h1>
        <p className="text-xs text-ink-muted mt-1">
          Trang này đăng ký chính trình duyệt/thiết bị bạn đang mở. Hạn mức mặc định 2 máy; máy thứ 3 trở đi cần lý do và chờ HR duyệt từ mạng nội bộ công ty.
        </p>
      </div>

      {error && (
        <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">
          ⚠️ {error}
        </div>
      )}

      {sent ? (
        <div className="bg-surface border border-emerald-200 rounded-xl p-6 text-center space-y-3">
          <div className="text-3xl text-emerald-600">✓</div>
          <h2 className="text-sm font-bold text-emerald-800">
            {activeNow ? 'Thiết bị đã được kích hoạt' : 'Yêu cầu đã được gửi thành công'}
          </h2>
          <p className="text-xs text-ink-muted">
            {activeNow ? (
              <>Thiết bị <code className="font-mono bg-canvas px-1 rounded">{fingerprint}</code> đã dùng để chấm công được ngay.</>
            ) : (
              <>Thiết bị <code className="font-mono bg-canvas px-1 rounded">{fingerprint}</code> đang ở hàng chờ HR duyệt.
                Sau khi HR phê duyệt, bạn có thể dùng thiết bị này để chấm công.</>
            )}
          </p>
          <div className="pt-2">
            <Button variant="primary" size="sm" onClick={() => navigate('/attendance/devices')}>
              Quay lại danh sách thiết bị
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-surface border border-line rounded-xl p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-ink mb-1">Mã định danh thiết bị (Fingerprint)</label>
            <input
              type="text"
              readOnly
              value={fingerprint}
              className="w-full border border-line rounded-lg p-2 text-xs font-mono bg-canvas text-ink-secondary"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink mb-1">Tên / Model thiết bị</label>
            <input
              type="text"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              className="w-full border border-line rounded-lg p-2 text-xs bg-surface text-ink"
              placeholder="VD: iPhone 15 Pro, MacBook Pro M3..."
            />
          </div>

          {withinQuota === true ? (
            <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-[11px] text-emerald-800">
              Bạn còn hạn mức thiết bị — bấm đăng ký là dùng được ngay, không cần lý do hay chờ HR duyệt.
            </div>
          ) : withinQuota === false ? (
            <>
              <div>
                <label className="block text-xs font-semibold text-ink mb-1">
                  Lý do cần thêm thiết bị <span className="text-rose-500">* (Bắt buộc)</span>
                </label>
                <textarea
                  className="w-full border border-line rounded-lg p-2.5 text-xs bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-accent"
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="VD: Đổi máy mới do điện thoại cũ bị hỏng màn hình..."
                />
                <p className="text-[11px] text-ink-muted mt-1">
                  Bạn đã đủ {MAX_DEVICES} thiết bị — thiếu lý do hệ thống sẽ không cho phép gửi yêu cầu.
                </p>
              </div>

              <div className="p-3 bg-canvas-subtle rounded-lg border border-line text-[11px] text-ink-muted space-y-1">
                <div className="font-semibold text-ink">Quy định phê duyệt:</div>
                <div>• Chỉ gửi được yêu cầu từ mạng nội bộ công ty (ACT_OFFICE_5G).</div>
                <div>• Yêu cầu có thời hạn hiệu lực 30 ngày trong hàng chờ của HR.</div>
              </div>
            </>
          ) : null}

          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => navigate('/attendance/devices')}>
              Hủy
            </Button>
            <button
              type="submit"
              disabled={withinQuota === null || (!withinQuota && !reason.trim()) || loading}
              className="px-4 py-2 rounded-lg bg-accent text-white text-xs font-semibold shadow-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer hover:bg-accent-hover transition-colors"
            >
              {withinQuota === null
                ? 'Đang kiểm tra hạn mức...'
                : loading
                  ? 'Đang xử lý...'
                  : withinQuota ? 'Thêm thiết bị' : 'Gửi yêu cầu chờ HR duyệt'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
