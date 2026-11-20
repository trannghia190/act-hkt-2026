import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../../components/common/Button';

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getDeviceFingerprint = (): string => {
    const raw = [
      navigator.userAgent,
      screen.width,
      screen.height,
      screen.colorDepth,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    ].join('|');
    let hash = 0;
    for (let i = 0; i < raw.length; i += 1) {
      hash = (hash * 31 + raw.charCodeAt(i)) | 0;
    }
    return `web-${Math.abs(hash).toString(16)}`;
  };

  const [fingerprint] = useState(getDeviceFingerprint());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Bắt buộc nhập lý do khi yêu cầu thêm thiết bị');
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
          reason: reason.trim(),
          wifiBssid: 'ACT_OFFICE_5G',
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 403) {
          setError('Yêu cầu thêm thiết bị chỉ nhận từ mạng nội bộ công ty (Wi-Fi ACT_OFFICE_5G).');
        } else {
          setError(json?.message || `Gửi yêu cầu thất bại (HTTP ${res.status})`);
        }
        setLoading(false);
        return;
      }

      setSent(true);
      setLoading(false);
    } catch (err: any) {
      setError(err?.message || 'Không thể kết nối đến máy chủ. Vui lòng thử lại.');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div className="bg-canvas border border-line rounded-xl p-6">
        <h1 className="text-xl font-bold text-ink mt-1">Đăng ký thêm thiết bị (S29)</h1>
        <p className="text-xs text-ink-muted mt-1">
          Một flow duy nhất: Thiết bị mặc định 2 máy. Muốn thêm máy thứ 3 phải có lý do và chờ HR duyệt từ mạng nội bộ công ty.
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
          <h2 className="text-sm font-bold text-emerald-800">Yêu cầu đã được gửi thành công</h2>
          <p className="text-xs text-ink-muted">
            Thiết bị <code className="font-mono bg-canvas px-1 rounded">{fingerprint}</code> đang ở hàng chờ HR duyệt.
            Sau khi HR phê duyệt, bạn có thể dùng thiết bị này để chấm công.
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
              Thiếu lý do hệ thống sẽ không cho phép gửi yêu cầu.
            </p>
          </div>

          <div className="p-3 bg-canvas-subtle rounded-lg border border-line text-[11px] text-ink-muted space-y-1">
            <div className="font-semibold text-ink">Quy định phê duyệt:</div>
            <div>• Chỉ gửi được yêu cầu từ mạng nội bộ công ty (ACT_OFFICE_5G).</div>
            <div>• Yêu cầu có thời hạn hiệu lực 30 ngày trong hàng chờ của HR.</div>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => navigate('/attendance/devices')}>
              Hủy
            </Button>
            <button
              type="submit"
              disabled={!reason.trim() || loading}
              className="px-4 py-2 rounded-lg bg-accent text-white text-xs font-semibold shadow-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer hover:bg-accent-hover transition-colors"
            >
              {loading ? 'Đang gửi...' : 'Gửi yêu cầu chờ HR duyệt'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
