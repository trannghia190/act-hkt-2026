import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import {
  getWebAuthnStatus,
  isWebAuthnSupported,
  registerPasskey,
  removePasskey,
} from '../../utils/webauthn';
import type { PasskeySummary } from '../../utils/webauthn';

/**
 * Passkey & bảo mật — đăng nhập nhanh bằng vân tay/Face ID.
 * Passkey KHÔNG dùng để chấm công; thiết bị chấm công quản lý ở /attendance/devices.
 */
export const PasskeySettingsPage: React.FC = () => {
  const supported = isWebAuthnSupported();
  const [loading, setLoading] = useState(true);
  const [passkeys, setPasskeys] = useState<PasskeySummary[]>([]);
  const [registering, setRegistering] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const load = () => {
    setLoading(true);
    getWebAuthnStatus()
      .then((s) => setPasskeys(s.credentials))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleRegister = async () => {
    setMessage(null);
    setRegistering(true);
    try {
      const result = await registerPasskey();
      setOk(!!result.hasPasskey);
      setMessage(result.message || 'Đã đăng ký passkey — có thể dùng để đăng nhập nhanh.');
      load();
    } catch (e: any) {
      setOk(false);
      setMessage(e?.message || 'Không đăng ký được passkey.');
    } finally {
      setRegistering(false);
    }
  };

  const handleRemove = async (p: PasskeySummary) => {
    if (!window.confirm(`Gỡ passkey "${p.label || 'Passkey'}"? Bạn sẽ không đăng nhập nhanh bằng passkey này được nữa.`)) {
      return;
    }
    setMessage(null);
    setRemovingId(p.id);
    try {
      await removePasskey(p.id);
      setOk(true);
      setMessage('Đã gỡ passkey.');
      load();
    } catch (e: any) {
      setOk(false);
      setMessage(e?.message || 'Không gỡ được passkey.');
    } finally {
      setRemovingId(null);
    }
  };

  const fmt = (value?: string) => (value ? new Date(value).toLocaleString('vi-VN') : '—');

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="bg-canvas border border-line rounded-xl p-6">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-accent-soft text-accent-dark rounded-full text-xs font-semibold border border-accent-line mb-2">
          <span>🔐</span> Passkey &amp; bảo mật
        </div>
        <h1 className="text-xl font-bold text-ink">Đăng nhập nhanh bằng Passkey</h1>
        <p className="text-xs text-ink-muted mt-1">
          Dùng vân tay / Face ID / Windows Hello để đăng nhập mà không cần gõ mật khẩu.
          Private key lưu trong Secure Enclave/KeyStore — không bao giờ rời khỏi thiết bị.
          Passkey <strong>không</strong> dùng để chấm công; thiết bị chấm công quản lý ở{' '}
          <Link to="/attendance/devices" className="text-accent font-semibold">Thiết bị của tôi</Link>.
        </p>
      </div>

      {!supported && (
        <div className="text-sm text-status-warn bg-status-warn-soft border border-status-warn-line rounded-xl p-3">
          Trình duyệt này không hỗ trợ WebAuthn/Passkey — hãy dùng Chrome, Edge, Safari hoặc Firefox phiên bản mới.
        </div>
      )}

      {message && (
        <div className={`text-sm rounded-xl p-3 border ${ok
          ? 'text-status-ok bg-status-ok-soft border-status-ok-line'
          : 'text-status-danger bg-status-danger-soft border-status-danger-line'}`}>
          {message}
        </div>
      )}

      <Card
        title="Passkey của tài khoản"
        subtitle={passkeys.length > 0 ? `Đã có ${passkeys.length} passkey` : 'Chưa đăng ký passkey'}
        action={
          <Button onClick={handleRegister} disabled={!supported || registering} size="sm">
            {registering ? 'Đang chờ xác thực…' : passkeys.length > 0 ? 'Thêm passkey' : 'Đăng ký passkey'}
          </Button>
        }
      >
        {loading ? (
          <div className="py-4 text-center text-xs text-ink-muted">Đang tải…</div>
        ) : passkeys.length === 0 ? (
          <div className="py-4 text-center text-xs text-ink-muted">
            Chưa có passkey. Đăng ký để lần sau đăng nhập chỉ cần vân tay/Face ID.
          </div>
        ) : (
          <div className="space-y-2.5">
            {passkeys.map((p) => (
              <div key={p.id} className="flex items-center justify-between border border-line rounded-xl p-3.5 gap-2">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-ink">{p.label || 'Passkey'}</span>
                    <Badge variant="accent">Đang dùng</Badge>
                  </div>
                  <div className="text-[11px] text-ink-muted">
                    Đăng ký: {fmt(p.createdAt)} · Dùng gần nhất: {fmt(p.lastUsedAt)}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRemove(p)}
                  disabled={removingId === p.id}
                >
                  {removingId === p.id ? 'Đang gỡ…' : 'Gỡ'}
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Cách hoạt động">
        <ul className="text-xs text-ink-secondary space-y-1.5 list-disc pl-4">
          <li>Đăng ký một lần cho mỗi thiết bị/authenticator (Touch ID, Face ID, Windows Hello, khóa bảo mật USB).</li>
          <li>Lần đăng nhập sau chỉ cần bấm <strong>Đăng nhập bằng Passkey</strong> ở trang đăng nhập.</li>
          <li>Gỡ passkey không ảnh hưởng thiết bị chấm công hay mật khẩu — bạn vẫn đăng nhập bằng mật khẩu bình thường.</li>
        </ul>
      </Card>
    </div>
  );
};
