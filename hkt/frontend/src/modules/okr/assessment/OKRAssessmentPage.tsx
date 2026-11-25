import React, { useCallback, useEffect, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { Card } from '../../../components/common/Card';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { useAuth } from '../../../context/AuthContext';
import { OkrSelfAssessmentSection } from './OkrSelfAssessmentSection';
import { ScorePicker } from './ScorePicker';
import { useForm4Box } from './useForm4Box';
import { statusLabel, TeamRow } from './types';
import { NoActiveCycleNotice } from '../components/NoActiveCycleNotice';
import { useActiveCycle } from '../../../hooks/useActiveCycle';

/**
 * Màn Quản lý/HR chấm điểm nhân viên khác.
 * Nhân viên (hoặc người xem chính mình) được redirect sang workspace /okr/my-okr.
 */
export const OKRAssessmentPage: React.FC = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const isManager = ['MANAGER', 'HR_ADMIN', 'ADMIN'].includes(String(user?.role || ''));
  const [teamRows, setTeamRows] = useState<TeamRow[]>([]);
  const [selectedCode, setSelectedCode] = useState(searchParams.get('employeeCode') || user?.employeeCode || '');
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const assessment = useForm4Box({ employeeCode: selectedCode, onToast: showToast });
  const {
    form, loading, saving, scaleMin, scaleMax, scaleText, isSelf,
    selfAverage, managerAverage, managerDraft, setManagerDraft,
    canEditManager, submitManager, toggleAllowUpdate,
  } = assessment;

  const loadTeam = useCallback(async () => {
    if (!isManager) {
      setTeamRows([]);
      return;
    }
    try {
      const res = await fetch('/api/v1/okr/team-review');
      const json = await res.json();
      if (res.ok) setTeamRows(json.data || []);
    } catch {
      // ignore
    }
  }, [isManager]);

  useEffect(() => { loadTeam(); }, [loadTeam]);

  // Chưa có chu kỳ OKR đang hoạt động → không có bản tự đánh giá để chấm điểm.
  const { hasActiveCycle } = useActiveCycle();

  return (
    <div className="space-y-5 max-w-4xl mx-auto pb-12">
      {toast && <div className="fixed top-16 right-6 z-[100] bg-ink text-canvas px-4 py-2.5 rounded-lg text-xs font-semibold shadow-lg">{toast}</div>}

      {hasActiveCycle === false && <NoActiveCycleNotice role="manager" />}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink">Chấm điểm &amp; nhận xét OKR cuối năm</h1>
          <p className="text-xs text-ink-muted mt-1">
            Xem bản tự đánh giá của nhân viên và chấm điểm {scaleText} độc lập cho từng nhóm — điểm trung bình hệ thống tự tính.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {form.status && <Badge variant={form.status === 'DA_HOAN_TAT' ? 'ok' : 'warn'}>{statusLabel(form.status)}</Badge>}
          {isManager && (
            <select
              value={selectedCode}
              onChange={(e) => setSelectedCode(e.target.value)}
              className="text-xs p-2 border border-line rounded-lg bg-surface font-semibold text-ink"
            >
              <option value={user?.employeeCode}>{user?.fullName} (Tôi)</option>
              {teamRows.map((r) => <option key={r.reviewId} value={r.employeeCode}>{r.fullName} ({r.employeeCode})</option>)}
            </select>
          )}
        </div>
      </div>

      {loading ? (
        <Card><div className="p-8 text-center text-xs text-ink-muted">Đang tải form đánh giá...</div></Card>
      ) : (
        <>
          <OkrSelfAssessmentSection assessment={assessment} />

          {isManager && (
            <Card className="space-y-3 border-accent/40">
              <div className="flex items-center justify-between border-b border-line pb-2">
                <div>
                  <h2 className="text-sm font-bold text-ink">Quản lý chấm điểm độc lập</h2>
                  <div className="text-[11px] text-ink-muted">Lưu song song điểm tự chấm và điểm Quản lý để đối chiếu.</div>
                </div>
                {!isSelf && form.reviewId && <Badge variant="accent">{scaleText} nguyên</Badge>}
              </div>
              {!isSelf && form.reviewId && form.finalManagerWindowOpen && (
                <label className="flex items-start gap-2 rounded-lg border border-line bg-canvas p-2.5 text-xs text-ink cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={!!form.finalUpdateOverride}
                    onChange={(e) => toggleAllowUpdate(e.target.checked)}
                  />
                  <span>
                    Cho phép nhân viên cập nhật tiến độ trong lúc Quản lý chấm điểm
                    <span className="block text-[11px] text-ink-muted">Mặc định khoá khi đã sang cửa sổ Quản lý; bật để nhân viên bổ sung số liệu trước khi bạn chốt điểm.</span>
                  </span>
                </label>
              )}
              {isSelf ? (
                <div className="text-xs text-ink-muted">Đây là hồ sơ của bạn — phần chấm điểm do Quản lý trực tiếp thực hiện.</div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-xl border border-line bg-canvas p-3">
                      <div className="text-[11px] font-semibold text-ink-muted uppercase tracking-wide">Điểm Business</div>
                      <div className="mt-1.5">
                        <ScorePicker min={scaleMin} max={scaleMax} value={managerDraft.business} onChange={(v) => setManagerDraft({ ...managerDraft, business: v })} disabled={!canEditManager} />
                      </div>
                    </div>
                    <div className="rounded-xl border border-line bg-canvas p-3">
                      <div className="text-[11px] font-semibold text-ink-muted uppercase tracking-wide">Điểm People</div>
                      <div className="mt-1.5">
                        <ScorePicker min={scaleMin} max={scaleMax} value={managerDraft.people} onChange={(v) => setManagerDraft({ ...managerDraft, people: v })} disabled={!canEditManager} />
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl border-2 border-accent bg-accent-soft/30 p-3 flex items-center justify-between">
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wide text-accent-dark">
                        Điểm trung bình Quản lý chấm
                      </div>
                      <div className="text-[11px] text-ink-muted mt-0.5">
                        Tự chấm: <b className="text-ink">{selfAverage == null ? '—' : selfAverage.toFixed(1)}</b>
                        {selfAverage != null && Math.abs(managerAverage - selfAverage) > 0.001 && (
                          <> · lệch {managerAverage - selfAverage > 0 ? '+' : ''}{(managerAverage - selfAverage).toFixed(1)}</>
                        )}
                      </div>
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-4xl font-black leading-none text-accent">{managerAverage.toFixed(1)}</span>
                      <span className="text-[11px] text-ink-muted">/ {scaleText}</span>
                    </div>
                  </div>
                  <textarea
                    rows={3}
                    disabled={!canEditManager}
                    value={managerDraft.comment}
                    onChange={(e) => setManagerDraft({ ...managerDraft, comment: e.target.value })}
                    placeholder="Nhận xét của Quản lý (bắt buộc)..."
                    className="w-full border border-line rounded-lg p-2.5 text-xs bg-canvas disabled:bg-surface disabled:text-ink-muted focus:outline-none focus:border-accent"
                  />
                  <div className="flex justify-end">
                    {!canEditManager && form.managerLockReason && !isSelf && (
                      <span className="text-[11px] text-ink-muted mr-2">🔒 {form.managerLockReason}</span>
                    )}
                    <Button size="sm" variant="primary" onClick={submitManager} disabled={saving || !canEditManager}>{saving ? 'Đang lưu...' : 'Lưu điểm Quản lý'}</Button>
                  </div>
                </>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
};

/**
 * Entry cho /okr/assessment: nhân viên (hoặc người mở hồ sơ của chính mình)
 * được đưa về workspace duy nhất /okr/my-okr; Quản lý/HR xem người khác mới thấy màn chấm điểm.
 */
export const AssessmentPageRoute: React.FC = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const isManager = ['MANAGER', 'HR_ADMIN', 'ADMIN'].includes(String(user?.role || ''));
  const code = searchParams.get('employeeCode') || '';

  if (!isManager || !code || code === user?.employeeCode) {
    return <Navigate to="/okr/my-okr?section=assessment" replace />;
  }
  return <OKRAssessmentPage />;
};
