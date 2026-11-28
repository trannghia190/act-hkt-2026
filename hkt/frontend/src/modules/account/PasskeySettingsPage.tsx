import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '../../components/common/Badge';
import { Panel } from '../../components/common/Panel';
import { Clock, Fingerprint, Info, KeyRound, Plus, Trash2 } from 'lucide-react';
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
    <div className="mx-auto max-w-3xl space-y-4 pb-24">
      {/* Đầu trang */}
      <div className="min-w-0">
        <div className="inline-flex items-center gap-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-accent-dark">
          <KeyRound className="h-3.5 w-3.5" />
          Tuỳ chỉnh cá nhân
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <h1 className="font-display text-xl font-extrabold tracking-tight text-ink sm:text-[23px]">
            Passkey &amp; bảo mật
          </h1>
          <Badge variant="accent">AC2</Badge>
        </div>
        <p className="mt-1 text-xs text-ink-muted">
          Đăng nhập nhanh bằng vân tay / Face ID / Windows Hello. Passkey không dùng để chấm công.
        </p>
      </div>

      {/* Bìa tóm tắt */}
      <div className="overflow-hidden rounded-[16px] border border-line bg-ink px-5 py-4 text-canvas">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-canvas/60">
              Đăng nhập không mật khẩu
            </div>
            <div className="mt-1 font-display text-lg font-extrabold">Private key không bao giờ rời thiết bị</div>
            <p className="mt-1 max-w-xl text-xs leading-relaxed text-canvas/75">
              Passkey lưu trong Secure Enclave / KeyStore của máy. Mất máy thì passkey trên máy đó
              không dùng được nữa — các máy khác vẫn đăng nhập bình thường.
            </p>
          </div>
          <dl className="flex gap-7">
            <div>
              <dd className="font-display text-2xl font-extrabold tabular-nums">{passkeys.length}</dd>
              <dt className="text-[11px] text-canvas/60">passkey</dt>
            </div>
            <div>
              <dd className="font-display text-2xl font-extrabold">100%</dd>
              <dt className="text-[11px] text-canvas/60">an toàn phần cứng</dt>
            </div>
          </dl>
        </div>
      </div>

      {!supported && (
        <div className="rounded-xl border border-status-warn-line bg-status-warn-soft p-3 text-sm text-status-warn">
          Trình duyệt này không hỗ trợ WebAuthn/Passkey — hãy dùng Chrome, Edge, Safari hoặc Firefox phiên bản mới.
        </div>
      )}

      {message && (
        <div className={`rounded-xl border p-3 text-sm ${ok
          ? 'border-status-ok-line bg-status-ok-soft text-status-ok'
          : 'border-status-danger-line bg-status-danger-soft text-status-danger'}`}>
          {message}
        </div>
      )}

      <Panel
        title="Passkey của tài khoản"
        subtitle={passkeys.length > 0 ? `Đã có ${passkeys.length} passkey` : 'Chưa đăng ký passkey'}
        action={
          <button
            type="button"
            onClick={handleRegister}
            disabled={!supported || registering}
            className="inline-flex h-[29px] items-center gap-1.5 rounded-lg bg-accent px-2.5 text-[11.5px] font-semibold text-on-accent transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-3 w-3" />
            {registering ? 'Đang chờ xác thực…' : passkeys.length > 0 ? 'Thêm passkey' : 'Đăng ký passkey'}
          </button>
        }
        bodyClassName="space-y-2.5"
      >
        {loading ? (
          <div className="py-2 text-center text-xs text-ink-muted">Đang tải…</div>
        ) : passkeys.length === 0 ? (
          <div className="py-2 text-center text-xs text-ink-muted">
            Chưa có passkey. Đăng ký để lần sau đăng nhập chỉ cần vân tay/Face ID.
          </div>
        ) : (
          passkeys.map((p) => (
            <section
              key={p.id}
              className="flex flex-wrap items-start gap-3 rounded-xl border border-line bg-surface px-3.5 py-3 transition-colors hover:border-line-hover sm:flex-nowrap"
            >
              <div className="grid h-[31px] w-[31px] shrink-0 place-items-center rounded-[9px] border border-line bg-surface-secondary text-ink-secondary">
                <Fingerprint className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1 basis-[calc(100%-46px)] sm:basis-auto">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[13px] font-bold text-ink">{p.label || 'Passkey'}</span>
                  <Badge variant="accent">Đang dùng</Badge>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-muted">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-2.5 w-2.5" />
                    Đăng ký {fmt(p.createdAt)}
                  </span>
                  <span>Dùng gần nhất: {fmt(p.lastUsedAt)}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleRemove(p)}
                disabled={removingId === p.id}
                className="inline-flex h-[29px] w-full items-center justify-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 text-[11.5px] font-semibold text-ink-secondary transition-colors hover:border-line-hover hover:text-ink disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                <Trash2 className="h-3 w-3" />
                {removingId === p.id ? 'Đang gỡ…' : 'Gỡ'}
              </button>
            </section>
          ))
        )}
      </Panel>

      <Panel title="Cách hoạt động" bodyClassName="space-y-2.5">
        {[
          ['Đăng ký một lần cho mỗi thiết bị', 'Touch ID, Face ID, Windows Hello hoặc khóa bảo mật USB (YubiKey).'],
          ['Lần sau chỉ cần bấm “Đăng nhập bằng Passkey”', 'Ở trang đăng nhập — xác thực bằng vân tay/Face ID, không gõ mật khẩu.'],
          ['Gỡ passkey không ảnh hưởng gì khác', 'Mật khẩu và thiết bị chấm công giữ nguyên — chỉ tắt đăng nhập nhanh trên máy đó.'],
        ].map(([t, d], i) => (
          <div key={t} className="flex items-start gap-2.5">
            <span className="grid h-[23px] w-[23px] shrink-0 place-items-center rounded-full bg-accent-soft text-[11px] font-extrabold text-accent-dark">
              {i + 1}
            </span>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-ink">{t}</div>
              <div className="mt-0.5 text-[11px] leading-relaxed text-ink-muted">{d}</div>
            </div>
          </div>
        ))}
        <div className="flex items-start gap-2 rounded-[10px] border border-line bg-canvas px-3 py-2.5 text-[11px] leading-relaxed text-ink-muted">
          <Info className="mt-px h-3.5 w-3.5 shrink-0" />
          <div>
            Passkey <b className="text-ink-secondary">không</b> dùng để chấm công. Thiết bị được phép chấm công quản lý ở{' '}
            <Link to="/attendance/devices" className="font-semibold text-accent-dark">Thiết bị của tôi</Link>.
          </div>
        </div>
      </Panel>
    </div>
  );
};
