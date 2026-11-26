import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../../components/common/Card';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { Modal } from '../../../components/common/Modal';
import { Cycle, cycleStatusMeta, monthsLabel, PHASE_STATUS_LABEL } from './cycleTypes';

export const OKRCyclesPage: React.FC = () => {
  const navigate = useNavigate();
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/okr/cycles');
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || 'Không tải được chu kỳ');
      setCycles(json.data || []);
    } catch (err: any) {
      showToast(err.message || 'Không tải được chu kỳ OKR');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const changeStatus = async (cycle: Cycle, action: 'activate' | 'deactivate') => {
    const question = action === 'activate'
      ? `Kích hoạt chu kỳ ${cycle.name}? Hệ thống chỉ cho phép 1 chu kỳ OKR hoạt động tại một thời điểm — chu kỳ đang hoạt động (nếu có) phải được tạm ẩn hoặc chốt & khoá trước.`
      : `Tạm ẩn chu kỳ ${cycle.name}? Chu kỳ về trạng thái nháp, dữ liệu giữ nguyên. Nếu đây là chu kỳ duy nhất đang hoạt động, hệ thống sẽ tạm không có chu kỳ active cho tới khi bạn kích hoạt chu kỳ khác.`;
    if (!confirm(question)) return;
    setBusyId(cycle.id);
    try {
      const res = await fetch(`/api/v1/okr/cycles/${cycle.id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || 'Thao tác thất bại');
      showToast(json.message || 'Thành công');
      load();
    } catch (err: any) {
      showToast(err.message || 'Thao tác thất bại');
    } finally {
      setBusyId(null);
    }
  };

  // Quy tắc hệ thống: tối đa 1 chu kỳ active — chu kỳ khác chỉ kích hoạt được sau khi tạm ẩn/chốt chu kỳ này.
  const activeCycle = cycles.find((c) => c.status === 'active') || null;

  // Xoá bị vướng dữ liệu → hiện ô hỏi có muốn xoá cứng (force) không.
  const [forceTarget, setForceTarget] = useState<Cycle | null>(null);
  const [forceInfo, setForceInfo] = useState<{ message: string; linkedReviews?: number; attachments?: number } | null>(null);
  const [forceBusy, setForceBusy] = useState(false);

  const doDelete = async (cycle: Cycle, force: boolean) => {
    setDeletingId(cycle.id);
    try {
      const res = await fetch(`/api/v1/okr/cycles/${cycle.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
      });
      const json = await res.json();
      if (!res.ok) {
        // 409 + requiresForce → mở ô hỏi xoá cứng thay vì báo toast ngắn.
        if (res.status === 409 && json?.data?.requiresForce) {
          setForceTarget(cycle);
          setForceInfo({
            message: json.message || 'Dữ liệu đang vướng ràng buộc.',
            linkedReviews: json.data.linkedReviews,
            attachments: json.data.attachments,
          });
          return;
        }
        throw new Error(json?.message || 'Xoá thất bại');
      }
      showToast(json.message || 'Đã xoá chu kỳ');
      setForceTarget(null);
      setForceInfo(null);
      load();
    } catch (err: any) {
      showToast(err.message || 'Xoá thất bại');
    } finally {
      setDeletingId(null);
      setForceBusy(false);
    }
  };

  const removeCycle = async (cycle: Cycle) => {
    const ok = confirm(
      `Xoá vĩnh viễn chu kỳ "${cycle.name}" (năm ${cycle.year})?\n\n`
      + 'Toàn bộ mục tiêu OKR, check-in và hồ sơ đánh giá thuộc chu kỳ này sẽ bị xoá theo.\n'
      + (cycle.status === 'active'
        ? 'Đây là chu kỳ ĐANG HOẠT ĐỘNG — sau khi xoá, nhân viên sẽ không có chu kỳ OKR để làm việc cho tới khi tạo & kích hoạt chu kỳ mới.\n'
        : '')
      + `Sau khi xoá, bạn có thể tạo lại chu kỳ cho năm ${cycle.year}.`,
    );
    if (!ok) return;
    await doDelete(cycle, false);
  };

  if (loading) {
    return <Card><div className="p-8 text-center text-xs text-ink-muted">Đang tải chu kỳ OKR...</div></Card>;
  }

  return (
    <div className="space-y-5 max-w-6xl mx-auto pb-12">
      {toast && <div className="fixed top-16 right-6 z-[100] bg-ink text-canvas px-4 py-2.5 rounded-lg text-xs font-semibold shadow-lg">{toast}</div>}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink">Quản Lý Chu Kỳ OKR</h1>
          <p className="text-xs text-ink-muted mt-1">Danh sách các chu kỳ theo năm · tạo bản nháp, cấu hình 3 phase, kích hoạt để đưa vào sử dụng, chốt &amp; khoá khi kết thúc.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={load}>↻ Làm mới</Button>
          <Button size="sm" variant="primary" onClick={() => navigate('/okr/cycles/new')}>+ Chu kỳ mới</Button>
        </div>
      </div>

      {cycles.length === 0 ? (
        <Card><div className="p-8 text-center text-xs text-ink-muted">Chưa có chu kỳ OKR. Bấm “+ Chu kỳ mới” để tạo bản nháp đầu tiên.</div></Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-ink-muted border-b border-line bg-canvas">
                  <th className="px-4 py-2.5 font-semibold">Năm</th>
                  <th className="px-4 py-2.5 font-semibold">Chu kỳ</th>
                  <th className="px-4 py-2.5 font-semibold">Timeline 3 phase</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {cycles.map((c) => {
                  const meta = cycleStatusMeta(c.status);
                  return (
                    <tr key={c.id} className="border-b border-line last:border-0 align-top hover:bg-canvas/60">
                      <td className="px-4 py-3 font-bold text-ink whitespace-nowrap">{c.year}</td>
                      <td className="px-4 py-3 min-w-[190px]">
                        <div className="font-semibold text-ink">{c.name}</div>
                        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                          <Badge variant={meta.variant}>{meta.label}</Badge>
                          {c.status === 'active' && c.year === new Date().getFullYear() && (
                            <Badge variant="accent">Chu kỳ hiện tại</Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 min-w-[280px]">
                        <div className="space-y-1">
                          {(c.phases || []).slice(0, 3).map((p) => {
                            const eff = p.effective_status || 'upcoming';
                            return (
                              <div key={p.key} className="flex items-center gap-2 flex-wrap">
                                <span className="text-ink-secondary w-[92px] shrink-0">{p.name || p.key}</span>
                                <span className="text-ink-muted">{monthsLabel(p.start_date, p.due_date) || '—'}</span>
                                <Badge variant={eff === 'active' ? 'ok' : eff === 'locked' ? 'gray' : 'warn'}>
                                  NV: {PHASE_STATUS_LABEL[eff] || eff}
                                </Badge>
                                {p.review_start && p.review_due && (
                                  <Badge variant={(p.manager_status || 'upcoming') === 'active' ? 'ok' : p.manager_status === 'locked' ? 'gray' : 'warn'}>
                                    QL: {PHASE_STATUS_LABEL[p.manager_status || 'upcoming']}
                                  </Badge>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2 flex-wrap">
                          <Button size="sm" variant="ghost" onClick={() => navigate(`/okr/cycles/${c.id}?mode=view`)}>Xem</Button>
                          {c.status !== 'closed' && (
                            <Button size="sm" variant="outline" onClick={() => navigate(`/okr/cycles/${c.id}`)}>Cập nhật</Button>
                          )}
                          {c.status === 'draft' && (
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => changeStatus(c, 'activate')}
                              disabled={busyId === c.id || Boolean(activeCycle)}
                              title={activeCycle ? `Đang có chu kỳ hoạt động: ${activeCycle.name} — tạm ẩn hoặc chốt & khoá chu kỳ đó trước` : undefined}
                            >
                              {busyId === c.id ? 'Đang xử lý...' : 'Kích hoạt'}
                            </Button>
                          )}
                          {c.status === 'active' && (
                            <Button size="sm" variant="outline" onClick={() => changeStatus(c, 'deactivate')} disabled={busyId === c.id}>
                              {busyId === c.id ? 'Đang xử lý...' : 'Tạm ẩn'}
                            </Button>
                          )}
                          {c.status === 'active' && (
                            <Button size="sm" variant="outline" onClick={() => navigate(`/okr/cycles/${c.id}`)} title="Chốt & khoá, gửi nhắc hạn trong trang chi tiết">Chốt &amp; khoá</Button>
                          )}
                          {c.status === 'closed' && (
                            <Button size="sm" variant="outline" onClick={() => navigate(`/okr/cycles/${c.id}`)}>Mở lại</Button>
                          )}
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => removeCycle(c)}
                            disabled={deletingId === c.id}
                            title={`Xoá chu kỳ và toàn bộ dữ liệu OKR của năm ${c.year} — sau đó có thể tạo lại chu kỳ cùng năm`}
                          >
                            {deletingId === c.id ? 'Đang xoá...' : 'Xoá'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div className="rounded-lg border border-line bg-canvas p-3 text-[11px] text-ink-muted">
        <b>Quy tắc</b>: mỗi năm chỉ có 1 chu kỳ OKR (không tạo trùng năm), và toàn hệ thống chỉ 1 chu kỳ hoạt động tại một thời điểm.
        <b> Kích hoạt</b>: chu kỳ nháp trở thành chu kỳ đang hoạt động.
        <b> Tạm ẩn</b>: đưa chu kỳ về nháp, giữ nguyên dữ liệu, dùng khi cấu hình nhầm hoặc chuẩn bị trước.
        <b> Xoá</b>: xoá vĩnh viễn chu kỳ cùng toàn bộ OKR/hồ sơ của năm — sau đó có thể tạo lại cùng năm.
        <b> Chốt &amp; khoá</b>: kết thúc chu kỳ, mọi màn chuyển sang chỉ đọc; chỉ HR mở lại được kèm lý do (ghi audit).
      </div>

      {/* Ô hỏi xoá cứng: chu kỳ đang bị vướng dữ liệu nên cần HR xác nhận thêm */}
      <Modal
        isOpen={Boolean(forceTarget)}
        onClose={() => { if (!forceBusy) { setForceTarget(null); setForceInfo(null); } }}
        title="Xoá cứng chu kỳ OKR"
        maxWidth="md"
      >
        <div className="space-y-3">
          <div className="rounded-lg border border-status-warn-line bg-status-warn-soft p-3 text-xs text-status-warn space-y-1">
            <div className="font-bold">Chưa xoá được — dữ liệu đang vướng</div>
            <div>{forceInfo?.message}</div>
            {typeof forceInfo?.linkedReviews === 'number' && forceInfo.linkedReviews > 0 && (
              <div>· {forceInfo.linkedReviews} hồ sơ OKR gắn trực tiếp với chu kỳ này</div>
            )}
            {typeof forceInfo?.attachments === 'number' && forceInfo.attachments > 0 && (
              <div>· {forceInfo.attachments} tệp đính kèm check-in</div>
            )}
          </div>
          <div className="text-xs text-ink-secondary space-y-1">
            Xoá cứng sẽ xoá vĩnh viễn toàn bộ mục tiêu OKR, check-in, tệp đính kèm và hồ sơ đánh giá
            {forceTarget ? ` của năm ${forceTarget.year}` : ''}. Sau khi xoá, năm đó có thể tạo chu kỳ mới.
            Hành động này được ghi vào nhật ký kiểm toán.
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-line">
            <Button size="sm" variant="ghost" onClick={() => { setForceTarget(null); setForceInfo(null); }} disabled={forceBusy}>
              Huỷ
            </Button>
            <Button
              size="sm"
              variant="danger"
              disabled={forceBusy}
              onClick={async () => {
                if (!forceTarget) return;
                setForceBusy(true);
                await doDelete(forceTarget, true);
              }}
            >
              {forceBusy ? 'Đang xoá...' : 'Xoá cứng'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
