import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card } from '../../../components/common/Card';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { useAuth } from '../../../context/AuthContext';

interface PersonalInfo {
  fullName?: string;
  employeeCode?: string;
  jobTitle?: string | null;
  department?: string | null;
  managerName?: string | null;
  joinedDate?: string | null;
  seniority?: string | null;
  newJoiner?: boolean;
  monthsWorked?: number | null;
  seniorityNote?: string | null;
  cycleYear?: number;
}

// 4 mục của mỗi box nhóm (Box 2 Business / Box 3 People) theo form HR
const GROUP_ITEMS: { suffix: 'Results' | 'Adjustments' | 'Difficulties' | 'Lessons'; label: string; placeholder: string; required?: boolean }[] = [
  { suffix: 'Results', label: 'Kết quả', placeholder: 'Kết quả đạt được so với mục tiêu…', required: true },
  { suffix: 'Adjustments', label: 'Điều chỉnh', placeholder: 'Mục tiêu / cách làm đã điều chỉnh trong năm…' },
  { suffix: 'Difficulties', label: 'Khó khăn', placeholder: 'Khó khăn, trở ngại gặp phải…' },
  { suffix: 'Lessons', label: 'Bài học', placeholder: 'Bài học rút ra…' },
];

interface Form4Box {
  employeeCode: string;
  employeeName: string;
  jobTitle?: string;
  year: number;
  reviewId?: string | null;
  reviewStatus?: string | null;
  status: string;
  box1?: PersonalInfo;
  box2?: { progress?: number | null };
  box3?: { progress?: number | null };
  box2Results?: string | null;
  box2Adjustments?: string | null;
  box2Difficulties?: string | null;
  box2Lessons?: string | null;
  box2BusinessScore?: number | null;
  box3Results?: string | null;
  box3Adjustments?: string | null;
  box3Difficulties?: string | null;
  box3Lessons?: string | null;
  box3PeopleScore?: number | null;
  box4SelfProposal?: string | null;
  box4ImprovementArea?: string | null;
  managerBusinessScore?: number | null;
  managerPeopleScore?: number | null;
  managerComment?: string | null;
  selfAverageScore?: number | null;
  managerAverageScore?: number | null;
  canManage?: boolean;
  isSelf?: boolean;
  canSelfEdit?: boolean;
  scaleMin?: number;
  scaleMax?: number;
  selfAssessPhase?: 'MIDYEAR' | 'FINAL' | null;
  selfLockReason?: string | null;
  canManagerAssess?: boolean;
  managerLockReason?: string | null;
}

interface TeamRow {
  reviewId: string;
  employeeCode: string;
  fullName: string;
  team?: string;
}

const emptyForm: Form4Box = {
  employeeCode: '',
  employeeName: '',
  year: new Date().getFullYear(),
  status: 'CHUA_TU_DANH_GIA',
};

const statusLabel = (status: string) => {
  if (status === 'DA_HOAN_TAT') return 'Đã chấm xong';
  if (status === 'CHO_QL_CHAM') return 'Chờ QL chấm';
  if (status === 'CHUA_CO_OKR') return 'Chưa có OKR được duyệt';
  return 'Chưa tự đánh giá';
};

// Thang điểm lấy theo cấu hình chu kỳ của HR (mặc định 1–5)
const ScorePicker: React.FC<{ value?: number | null; onChange?: (v: number) => void; disabled?: boolean; min?: number; max?: number }> = ({ value, onChange, disabled, min = 1, max = 5 }) => (
  <div className="flex items-center gap-2">
    {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((score) => (
      <button
        key={score}
        type="button"
        disabled={disabled}
        onClick={() => onChange?.(score)}
        className={`w-10 h-9 rounded-lg font-bold border transition-all disabled:cursor-not-allowed ${
          value === score
            ? 'bg-accent text-white border-accent shadow-xs'
            : 'bg-canvas text-ink-secondary border-line hover:border-line-focus'
        }`}
      >
        {score}
      </button>
    ))}
    <span className="text-xs text-ink-muted">{value ? `Điểm ${value}/${max}` : 'Chưa chấm'}</span>
  </div>
);

export const OKRAssessmentPage: React.FC = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const isManager = ['MANAGER', 'HR_ADMIN', 'ADMIN'].includes(String(user?.role || ''));
  const [teamRows, setTeamRows] = useState<TeamRow[]>([]);
  const [selectedCode, setSelectedCode] = useState(searchParams.get('employeeCode') || user?.employeeCode || '');
  const [form, setForm] = useState<Form4Box>(emptyForm);
  const [selfDraft, setSelfDraft] = useState<Form4Box>(emptyForm);
  const [managerDraft, setManagerDraft] = useState({ business: 4, people: 4, comment: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

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

  const loadForm = useCallback(async (code: string) => {
    setLoading(true);
    try {
      const query = code ? `?employeeCode=${encodeURIComponent(code)}` : '';
      const res = await fetch(`/api/v1/okr/reviews/form-4box${query}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || 'Không tải được form đánh giá');
      const data: Form4Box = json.data;
      setForm(data);
      setSelfDraft(data);
      const min = data.scaleMin ?? 1;
      const max = data.scaleMax ?? 5;
      const fallback = Math.round((min + max) / 2);
      const clamp = (v: number | null | undefined) => Math.min(max, Math.max(min, v ?? fallback));
      setManagerDraft({
        business: clamp(data.managerBusinessScore ?? data.box2BusinessScore),
        people: clamp(data.managerPeopleScore ?? data.box3PeopleScore),
        comment: data.managerComment || '',
      });
    } catch (err: any) {
      showToast(err.message || 'Không tải được form đánh giá');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTeam(); }, [loadTeam]);
  useEffect(() => { loadForm(selectedCode); }, [selectedCode, loadForm]);

  const scaleMin = form.scaleMin ?? 1;
  const scaleMax = form.scaleMax ?? 5;
  const scaleText = `${scaleMin}–${scaleMax}`;
  const isSelf = form.isSelf ?? (!selectedCode || selectedCode === user?.employeeCode);
  const selfAverage = selfDraft.box2BusinessScore && selfDraft.box3PeopleScore
    ? (selfDraft.box2BusinessScore + selfDraft.box3PeopleScore) / 2
    : null;
  const managerAverage = (managerDraft.business + managerDraft.people) / 2;

  const submitSelf = async () => {
    if (!selfDraft.box2BusinessScore || !selfDraft.box3PeopleScore) {
      showToast(`Cần chọn điểm ${scaleText} cho cả Business và People`);
      return;
    }
    if (form.selfAssessPhase !== 'MIDYEAR' && (!selfDraft.box2Results?.trim() || !selfDraft.box3Results?.trim())) {
      showToast('Mục "Kết quả" của Thành tựu công việc và Thành tựu con người là bắt buộc');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/v1/okr/reviews/submit-self-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeCode: selfDraft.employeeCode,
          year: form.year,
          box2Results: selfDraft.box2Results,
          box2Adjustments: selfDraft.box2Adjustments,
          box2Difficulties: selfDraft.box2Difficulties,
          box2Lessons: selfDraft.box2Lessons,
          box2BusinessScore: selfDraft.box2BusinessScore,
          box3Results: selfDraft.box3Results,
          box3Adjustments: selfDraft.box3Adjustments,
          box3Difficulties: selfDraft.box3Difficulties,
          box3Lessons: selfDraft.box3Lessons,
          box3PeopleScore: selfDraft.box3PeopleScore,
          box4SelfProposal: selfDraft.box4SelfProposal,
          box4ImprovementArea: selfDraft.box4ImprovementArea,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || 'Không nộp được bản tự đánh giá');
      showToast(json?.message || 'Đã nộp bản tự đánh giá');
      loadForm(selectedCode);
    } catch (err: any) {
      showToast(err.message || 'Không nộp được bản tự đánh giá');
    } finally {
      setSaving(false);
    }
  };

  const submitManager = async () => {
    if (!form.reviewId) { showToast('Nhân viên chưa có hồ sơ OKR'); return; }
    if (!managerDraft.comment.trim()) { showToast('Nhận xét của Quản lý là bắt buộc'); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/okr/reviews/${form.reviewId}/manager-assess`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          managerBusinessScore: managerDraft.business,
          managerPeopleScore: managerDraft.people,
          managerComment: managerDraft.comment,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || 'Không lưu được điểm Quản lý');
      showToast('Đã lưu điểm Quản lý — nhân viên nhận thông báo');
      loadForm(selectedCode);
    } catch (err: any) {
      showToast(err.message || 'Không lưu được điểm Quản lý');
    } finally {
      setSaving(false);
    }
  };

  // Quyền sửa do server quyết định theo phase / trạng thái (không tự suy ở client)
  const canEditSelf = Boolean(form.canSelfEdit);
  const canEditManager = Boolean(form.canManagerAssess);

  return (
    <div className="space-y-5 max-w-4xl mx-auto pb-12">
      {toast && <div className="fixed top-16 right-6 z-50 bg-ink text-canvas px-4 py-2.5 rounded-lg text-xs font-semibold shadow-lg">{toast}</div>}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink">
            {form.selfAssessPhase === 'MIDYEAR' ? 'Tự chấm điểm OKR giữa năm' : 'Đánh giá OKR cuối năm'}
          </h1>
          <p className="text-xs text-ink-muted mt-1">
            Tổng kết thành tựu công việc và con người trong năm, chấm điểm {scaleText} cho từng nhóm — điểm trung bình hệ thống tự tính.
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
          {/* Box 1 — Thông tin cá nhân: hệ thống tự điền từ hồ sơ nhân sự */}
          <Card className="space-y-3">
            <div className="flex items-center justify-between border-b border-line pb-2">
              <h2 className="text-sm font-bold text-ink">Thông tin nhân viên</h2>
              <Badge variant="gray">Tự điền từ hồ sơ</Badge>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              {([
                ['Họ và tên', form.box1?.fullName ?? form.employeeName],
                ['Mã nhân viên', form.box1?.employeeCode ?? form.employeeCode],
                ['Vị trí', form.box1?.jobTitle],
                ['Phòng ban', form.box1?.department],
                ['Quản lý trực tiếp', form.box1?.managerName],
                ['Ngày vào làm', form.box1?.joinedDate],
                ['Thời gian công tác', form.box1?.seniority],
                ['Chu kỳ đánh giá', form.box1?.cycleYear ?? form.year],
              ] as [string, unknown][]).map(([label, value]) => (
                <div key={label} className="rounded-lg border border-line bg-canvas p-2.5">
                  <div className="text-[11px] text-ink-muted">{label}</div>
                  <div className="font-semibold text-ink mt-0.5">{value ? String(value) : '—'}</div>
                </div>
              ))}
            </div>
            {form.box1?.newJoiner && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-[11px] text-amber-800">
                👋 {form.box1.seniorityNote || `Nhân viên mới — đánh giá theo ${form.box1.monthsWorked ?? '—'} tháng thực tế.`}
              </div>
            )}
          </Card>

          {/* Box 2 Business / Box 3 People — mỗi box 4 mục + điểm 1–5 */}
          {([
            { box: 2 as const, title: 'Thành tựu công việc (Business)', scoreKey: 'box2BusinessScore' as const, managerScore: form.managerBusinessScore, progress: form.box2?.progress, badge: 'accent' as const },
            { box: 3 as const, title: 'Thành tựu con người (People)', scoreKey: 'box3PeopleScore' as const, managerScore: form.managerPeopleScore, progress: form.box3?.progress, badge: 'ok' as const },
          ]).map(({ box, title, scoreKey, managerScore, progress, badge }) => (
            <Card key={box} className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-line pb-2">
                <div>
                  <h2 className="text-sm font-bold text-ink">{title}</h2>
                  {typeof progress === 'number' && (
                    <div className="text-[11px] text-ink-muted">Tiến độ check-in của nhóm: {progress}%</div>
                  )}
                </div>
                <Badge variant={badge}>Chấm {scaleText} · không điểm lẻ</Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {GROUP_ITEMS.map(({ suffix, label, placeholder, required }) => {
                  const key = `box${box}${suffix}` as keyof Form4Box;
                  return (
                    <div key={key}>
                      <label className="block text-xs font-semibold text-ink mb-1">
                        {label}
                        {required && form.selfAssessPhase !== 'MIDYEAR' && <span className="text-danger"> *</span>}
                      </label>
                      <textarea
                        rows={3}
                        disabled={!canEditSelf}
                        value={(selfDraft[key] as string | null | undefined) || ''}
                        onChange={(e) => setSelfDraft({ ...selfDraft, [key]: e.target.value })}
                        placeholder={placeholder}
                        className="w-full border border-line rounded-lg p-2.5 text-xs bg-canvas disabled:bg-surface disabled:text-ink-muted focus:outline-none focus:border-accent"
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <div>
                  <div className="text-xs font-semibold text-ink mb-1">Điểm tự chấm</div>
                  <ScorePicker
                    min={scaleMin}
                    max={scaleMax}
                    value={selfDraft[scoreKey]}
                    disabled={!canEditSelf}
                    onChange={(v) => setSelfDraft({ ...selfDraft, [scoreKey]: v })}
                  />
                </div>
                <div className="rounded-lg border border-line bg-canvas px-3 py-2 text-xs text-ink-secondary">
                  Quản lý chấm: <b className="text-accent">{managerScore ?? '—'}</b>
                  {managerScore != null && selfDraft[scoreKey] != null && managerScore !== selfDraft[scoreKey] && (
                    <span className="ml-1 text-ink-muted">(lệch {Number(managerScore) - Number(selfDraft[scoreKey]) > 0 ? '+' : ''}{Number(managerScore) - Number(selfDraft[scoreKey])})</span>
                  )}
                </div>
              </div>
            </Card>
          ))}

          <Card className="space-y-3">
            <div className="flex items-center justify-between border-b border-line pb-2">
              <h2 className="text-sm font-bold text-ink">Điểm trung bình tự tính</h2>
              <Badge variant="accent">Không có ô nhập tay</Badge>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-lg border border-line bg-canvas p-3">
                <div className="text-[11px] text-ink-muted">Tự chấm (Business + People) / 2</div>
                <div className="text-2xl font-black text-ink">{selfAverage == null ? '—' : selfAverage.toFixed(1)}</div>
              </div>
              <div className="rounded-lg border border-line bg-canvas p-3">
                <div className="text-[11px] text-ink-muted">Quản lý chấm (Business + People) / 2</div>
                <div className="text-2xl font-black text-accent">{form.managerAverageScore == null ? '—' : form.managerAverageScore.toFixed(1)}</div>
              </div>
            </div>
            {isSelf && canEditSelf && form.selfAssessPhase === 'MIDYEAR' && (
              <div className="text-[11px] text-blue-700 bg-blue-50 border border-blue-200 rounded-lg p-2">
                Giữa năm: điểm bạn chấm là <b>điểm tự chấm dự kiến</b>, dùng để Quản lý đối chiếu với tiến độ thực tế.
                Cuối năm bạn sẽ cập nhật lại thành điểm chính thức.
              </div>
            )}
            {isSelf && !canEditSelf && form.selfLockReason && (
              <div className="text-[11px] text-ink-muted">🔒 {form.selfLockReason}</div>
            )}
            {canEditSelf && (
              <div className="flex justify-end">
                <Button size="sm" variant="primary" onClick={submitSelf} disabled={saving}>{saving ? 'Đang lưu...' : form.selfAssessPhase === 'MIDYEAR' ? 'Lưu điểm tự chấm dự kiến' : 'Nộp bản tự đánh giá'}</Button>
              </div>
            )}
          </Card>

          <Card className="space-y-3">
            <div className="flex items-center justify-between border-b border-line pb-2">
              <h2 className="text-sm font-bold text-ink">Định hướng năm sau</h2>
              <Badge variant="warn">Tuỳ chọn</Badge>
            </div>
            <textarea
              rows={3}
              disabled={!canEditSelf}
              value={selfDraft.box4SelfProposal || ''}
              onChange={(e) => setSelfDraft({ ...selfDraft, box4SelfProposal: e.target.value })}
              placeholder="Đề xuất mục tiêu / định hướng năm tới..."
              className="w-full border border-line rounded-lg p-2.5 text-xs bg-canvas disabled:bg-surface disabled:text-ink-muted focus:outline-none focus:border-accent"
            />
            <textarea
              rows={2}
              disabled={!canEditSelf}
              value={selfDraft.box4ImprovementArea || ''}
              onChange={(e) => setSelfDraft({ ...selfDraft, box4ImprovementArea: e.target.value })}
              placeholder="Điểm cần cải thiện..."
              className="w-full border border-line rounded-lg p-2.5 text-xs bg-canvas disabled:bg-surface disabled:text-ink-muted focus:outline-none focus:border-accent"
            />
          </Card>

          {isManager && (
            <Card className="space-y-3 border-accent/40">
              <div className="flex items-center justify-between border-b border-line pb-2">
                <div>
                  <h2 className="text-sm font-bold text-ink">Quản lý chấm điểm độc lập</h2>
                  <div className="text-[11px] text-ink-muted">Lưu song song điểm tự chấm và điểm Quản lý để đối chiếu.</div>
                </div>
                {!isSelf && form.reviewId && <Badge variant="accent">{scaleText} nguyên</Badge>}
              </div>
              {isSelf ? (
                <div className="text-xs text-ink-muted">Đây là hồ sơ của bạn — phần chấm điểm do Quản lý trực tiếp thực hiện.</div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs font-semibold text-ink mb-1">Business</div>
                      <ScorePicker min={scaleMin} max={scaleMax} value={managerDraft.business} onChange={(v) => setManagerDraft({ ...managerDraft, business: v })} disabled={!canEditManager} />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-ink mb-1">People</div>
                      <ScorePicker min={scaleMin} max={scaleMax} value={managerDraft.people} onChange={(v) => setManagerDraft({ ...managerDraft, people: v })} disabled={!canEditManager} />
                    </div>
                  </div>
                  <div className="text-xs text-ink-secondary">
                    Điểm TB Quản lý: <b>{managerAverage.toFixed(1)}</b> · Tự chấm: <b>{selfAverage == null ? '—' : selfAverage.toFixed(1)}</b>
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
