import React, { useEffect, useMemo, useState } from 'react';
import { Ban, Check, Clock, Fingerprint, Laptop, ShieldCheck, Smartphone, X } from 'lucide-react';
import { Badge } from '../../../components/common/Badge';
import { Modal } from '../../../components/common/Modal';
import { Panel } from '../../../components/common/Panel';

interface Device {
  id: string;
  deviceFingerprint: string;
  deviceModel?: string;
  osVersion?: string;
  isApproved: boolean;
  userId: string;
  expiresAt?: string;
  lastActiveAt?: string;
  createdAt?: string;
  revokedAt?: string;
}

interface UserLite {
  id: string;
  employeeCode?: string;
  fullName?: string;
}

const authHeaders = (): Record<string, string> => {
  try { const u = JSON.parse(localStorage.getItem('pulse_auth_user') || '{}'); return u?.accessToken ? { Authorization: `Bearer ${u.accessToken}` } : {}; } catch { return {}; }
};

const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—');
const fmtDateTime = (iso?: string) => (iso ? new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');

/** Một dòng thiết bị — dùng chung cho cả 3 nhóm, khác nhau ở nút hành động. */
const DeviceRow: React.FC<{
  device: Device;
  owner: UserLite | undefined;
  actions: React.ReactNode;
  revoked?: boolean;
}> = ({ device, owner, actions, revoked }) => {
  const isLaptop = /pc|windows|mac|linux|browser/i.test(device.deviceModel || '');
  const Icon = isLaptop ? Laptop : Smartphone;
  return (
    <section
      className={`flex flex-wrap items-start gap-3 rounded-xl border px-3.5 py-3 transition-colors sm:flex-nowrap ${
        revoked ? 'border-line bg-canvas' : 'border-line bg-surface hover:border-line-hover'
      }`}
    >
      <div className="grid shrink-0 place-items-center rounded-[9px] border border-line bg-surface-secondary text-ink-secondary" style={{ width: 34, height: 34 }}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1 basis-[calc(100%-46px)] space-y-1 sm:basis-auto">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[13.5px] font-bold tracking-[-0.01em] text-ink">{device.deviceModel || 'Thiết bị'}</span>
          <span className="rounded-md bg-surface-secondary px-1.5 py-[2px] text-[10.5px] font-semibold text-ink-muted">
            {device.osVersion || 'Web'}
          </span>
          {revoked ? <Badge variant="gray">đã thu hồi</Badge> : device.isApproved ? <Badge variant="ok">đã duyệt</Badge> : <Badge variant="warn">chờ duyệt</Badge>}
        </div>
        <div className="flex flex-wrap items-center gap-x-1.5 text-[11.5px] text-ink-muted">
          <span className="text-ink-secondary">{owner?.fullName || device.userId.slice(0, 8)}</span>
          {owner?.employeeCode && <span className="font-mono text-[10.5px]">{owner.employeeCode}</span>}
          <span aria-hidden>·</span>
          <span className="inline-flex items-center gap-1 font-mono text-[10.5px]">
            <Fingerprint className="h-2.5 w-2.5" />
            {device.deviceFingerprint}
          </span>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 pt-0.5 text-[11px] text-ink-muted">
          {revoked ? (
            <>
              <span className="inline-flex items-center gap-1"><Clock className="h-2.5 w-2.5" />Thu hồi {fmtDateTime(device.revokedAt)}</span>
              <span className="inline-flex items-center gap-1"><Ban className="h-2.5 w-2.5" />Không thể chấm công</span>
            </>
          ) : (
            <>
              {!device.isApproved && <span className="inline-flex items-center gap-1"><Clock className="h-2.5 w-2.5" />Yêu cầu {fmtDateTime(device.createdAt)}</span>}
              <span className="inline-flex items-center gap-1"><Clock className="h-2.5 w-2.5" />
                {device.lastActiveAt ? `Hoạt động ${fmtDateTime(device.lastActiveAt)}` : 'Chưa chấm công lần nào'}
              </span>
              {device.expiresAt && <span>Hết hạn {fmtDate(device.expiresAt)}</span>}
            </>
          )}
        </div>
      </div>
      {actions && <div className="flex w-full shrink-0 gap-1.5 sm:w-auto sm:flex-col">{actions}</div>}
    </section>
  );
};

const actionBtn = 'inline-flex h-[29px] flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 text-[11.5px] font-semibold transition-colors sm:flex-none';

export const AdminDevicesPage: React.FC = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [users, setUsers] = useState<Record<string, UserLite>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Thiết bị đang mở hộp thoại thu hồi — lý do bắt buộc để lưu vết. */
  const [revokeTarget, setRevokeTarget] = useState<Device | null>(null);
  const [revokeReason, setRevokeReason] = useState('');

  const load = () => {
    fetch('/api/v1/admin/devices', { headers: authHeaders() })
      .then(r => r.json()).then(j => { if (Array.isArray(j?.data)) setDevices(j.data); else setError(j?.message || 'Không tải được thiết bị'); })
      .catch(() => setError('Không tải được thiết bị'));
  };

  useEffect(() => {
    load();
    // Bổ sung tên/mã nhân viên cho từng thiết bị — lỗi thì lùi về mã ID ngắn.
    fetch('/api/v1/admin/users?size=200', { headers: authHeaders() })
      .then(r => (r.ok ? r.json() : null))
      .then(j => {
        const list: UserLite[] = j?.data?.content ?? (Array.isArray(j?.data) ? j.data : []);
        setUsers(Object.fromEntries(list.filter(u => u?.id).map(u => [u.id, u])));
      })
      .catch(() => {});
  }, []);

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2500); };

  const approve = async (d: Device) => {
    const res = await fetch(`/api/v1/admin/devices/${d.id}/approve`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: '{}',
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setError(json?.message || 'Thao tác thất bại'); return; }
    setError(null);
    showToast('Đã duyệt thiết bị');
    load();
  };

  const confirmRevoke = async () => {
    const d = revokeTarget;
    const reason = revokeReason.trim();
    if (!d || !reason) return;
    const res = await fetch(`/api/v1/admin/devices/${d.id}/revoke`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ reason }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setError(json?.message || 'Thao tác thất bại'); return; }
    setError(null);
    setRevokeTarget(null);
    setRevokeReason('');
    showToast('Đã thu hồi thiết bị');
    load();
  };

  const { pending, active, revoked } = useMemo(() => ({
    pending: devices.filter(d => !d.isApproved && !d.revokedAt),
    active: devices.filter(d => d.isApproved && !d.revokedAt),
    revoked: devices.filter(d => !!d.revokedAt),
  }), [devices]);

  return (
    <div className="mx-auto max-w-4xl space-y-4 pb-24">
      {toast && (
        <div className="fixed right-6 top-16 z-[100] rounded-lg bg-status-ok px-4 py-2 text-xs font-semibold text-on-ok shadow-sm">
          {toast}
        </div>
      )}

      {/* Đầu trang — mockup `.phead` */}
      <div className="min-w-0">
        <div className="inline-flex items-center gap-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-accent-dark">
          <ShieldCheck className="h-3.5 w-3.5" />
          Quản trị HR
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <h1 className="font-display text-xl font-extrabold tracking-tight text-ink sm:text-[23px]">
            Thiết bị chấm công
          </h1>
          <Badge variant="accent">S11</Badge>
        </div>
        <p className="mt-1 text-xs text-ink-muted">
          Chỉ thiết bị đã duyệt mới được chấm công — thu hồi là chặn ngay, không cần chờ hết hạn.
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
            <div className="text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-canvas/60">
              Thiết bị tin cậy
            </div>
            <div className="mt-1 font-display text-lg font-extrabold">Duyệt thiết bị trước khi chấm công</div>
            <p className="mt-1 max-w-xl text-xs leading-relaxed text-canvas/75">
              Thiết bị lạ đăng nhập lần đầu sẽ vào hàng chờ. Duyệt xong có hiệu lực 30 ngày;
              thu hồi có hiệu lực tức thì và phải ghi lý do để lưu vết.
            </p>
          </div>
          <dl className="flex gap-6">
            <div>
              <dd className="font-display text-2xl font-extrabold tabular-nums">{pending.length}</dd>
              <dt className="text-[11px] text-canvas/60">chờ duyệt</dt>
            </div>
            <div>
              <dd className="font-display text-2xl font-extrabold tabular-nums">{active.length}</dd>
              <dt className="text-[11px] text-canvas/60">đang hoạt động</dt>
            </div>
            <div>
              <dd className="font-display text-2xl font-extrabold tabular-nums">{revoked.length}</dd>
              <dt className="text-[11px] text-canvas/60">đã thu hồi</dt>
            </div>
          </dl>
        </div>
      </div>

      <Panel
        title="Chờ duyệt"
        subtitle="Thiết bị lạ đăng nhập lần đầu — duyệt để cho phép chấm công trước khi hết hạn"
        action={<Badge variant="warn">{pending.length} thiết bị</Badge>}
        bodyClassName="space-y-2.5"
      >
        {pending.length === 0 && (
          <div className="py-2 text-xs text-ink-muted">Không có yêu cầu chờ duyệt.</div>
        )}
        {pending.map((d) => (
          <DeviceRow
            key={d.id}
            device={d}
            owner={users[d.userId]}
            actions={
              <>
                <button type="button" onClick={() => approve(d)} className={`${actionBtn} bg-accent text-on-accent hover:bg-accent-hover`}>
                  <Check className="h-3 w-3" />
                  Duyệt
                </button>
                <button
                  type="button"
                  onClick={() => { setRevokeTarget(d); setRevokeReason(''); }}
                  className={`${actionBtn} border border-status-danger-line bg-surface text-status-danger hover:bg-status-danger-soft`}
                >
                  <X className="h-3 w-3" />
                  Từ chối
                </button>
              </>
            }
          />
        ))}
      </Panel>

      <Panel
        title="Đang hoạt động"
        subtitle="Thiết bị đã duyệt, còn trong hạn 30 ngày"
        action={<Badge variant="ok">{active.length} thiết bị</Badge>}
        bodyClassName="space-y-2.5"
      >
        {active.length === 0 && (
          <div className="py-2 text-xs text-ink-muted">Chưa có thiết bị nào đang hoạt động.</div>
        )}
        {active.map((d) => (
          <DeviceRow
            key={d.id}
            device={d}
            owner={users[d.userId]}
            actions={
              <button
                type="button"
                onClick={() => { setRevokeTarget(d); setRevokeReason(''); }}
                className={`${actionBtn} border border-line bg-surface text-ink-secondary hover:bg-canvas hover:text-ink`}
              >
                <Ban className="h-3 w-3" />
                Thu hồi
              </button>
            }
          />
        ))}
      </Panel>

      <Panel
        title="Đã thu hồi"
        subtitle="Bị chặn chấm công cho tới khi duyệt lại"
        action={<Badge variant="gray">{revoked.length} thiết bị</Badge>}
        bodyClassName="space-y-2.5"
      >
        {revoked.length === 0 && (
          <div className="py-2 text-xs text-ink-muted">Chưa có thiết bị nào bị thu hồi.</div>
        )}
        {revoked.map((d) => (
          <DeviceRow key={d.id} device={d} owner={users[d.userId]} revoked actions={null} />
        ))}
      </Panel>

      <p className="text-[11px] text-ink-muted">
        Duyệt thiết bị có hiệu lực 30 ngày — máy không hoạt động quá hạn tự chuyển về hàng chờ.
      </p>

      {/* Hộp thoại thu hồi — lý do bắt buộc để lưu vết */}
      <Modal
        isOpen={!!revokeTarget}
        onClose={() => { setRevokeTarget(null); setRevokeReason(''); }}
        title={revokeTarget?.isApproved ? 'Thu hồi thiết bị' : 'Từ chối thiết bị'}
        maxWidth="lg"
      >
        <div className="space-y-3">
          <div className="rounded-lg border border-line bg-canvas px-3 py-2.5 text-xs text-ink-secondary">
            <div className="font-semibold text-ink">{revokeTarget?.deviceModel || 'Thiết bị'}</div>
            <div className="mt-0.5 text-[11px] text-ink-muted">
              {revokeTarget && (users[revokeTarget.userId]?.fullName || revokeTarget.userId.slice(0, 8))}
              {' · '}
              <span className="font-mono text-[10.5px]">{revokeTarget?.deviceFingerprint}</span>
            </div>
          </div>
          <div>
            <div className="mb-1.5 text-[11px] font-semibold text-ink">Lý do *</div>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {['Mất máy', 'Đổi thiết bị mới', 'Thiết bị lạ / nghi ngờ'].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRevokeReason(r)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    revokeReason === r
                      ? 'border-accent bg-accent-soft text-accent-dark'
                      : 'border-line bg-surface text-ink-secondary hover:border-line-hover'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <textarea
              rows={3}
              className="w-full rounded-lg border border-line bg-surface p-2.5 text-sm text-ink"
              placeholder="Ghi rõ lý do — lưu vào nhật ký kiểm toán"
              value={revokeReason}
              onChange={(e) => setRevokeReason(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => { setRevokeTarget(null); setRevokeReason(''); }}
              className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-secondary"
            >
              Huỷ
            </button>
            <button
              type="button"
              disabled={!revokeReason.trim()}
              onClick={confirmRevoke}
              className="inline-flex items-center gap-1.5 rounded-lg bg-status-danger px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Ban className="h-3 w-3" />
              {revokeTarget?.isApproved ? 'Thu hồi thiết bị' : 'Từ chối thiết bị'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
