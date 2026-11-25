import { useCallback, useEffect, useRef, useState } from 'react';
import { emptyForm, Form4Box } from './types';

interface UseForm4BoxOptions {
  /** Mã nhân viên cần xem; để trống = form của chính mình. */
  employeeCode?: string;
  /** Chỉ fetch khi workspace thực sự cần (ví dụ đang ở phase FINAL). */
  enabled?: boolean;
  onToast?: (msg: string) => void;
}

export const useForm4Box = ({ employeeCode = '', enabled = true, onToast }: UseForm4BoxOptions) => {
  const [form, setForm] = useState<Form4Box>(emptyForm);
  const [selfDraft, setSelfDraft] = useState<Form4Box>(emptyForm);
  const [managerDraft, setManagerDraft] = useState({ business: 4, people: 4, comment: '' });
  const [loading, setLoading] = useState(enabled);
  const [saving, setSaving] = useState(false);

  const toastRef = useRef(onToast);
  toastRef.current = onToast;
  const showToast = useCallback((msg: string) => toastRef.current?.(msg), []);

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
  }, [showToast]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    loadForm(employeeCode);
  }, [enabled, employeeCode, loadForm]);

  const reload = useCallback(() => loadForm(employeeCode), [employeeCode, loadForm]);

  const scaleMin = form.scaleMin ?? 1;
  const scaleMax = form.scaleMax ?? 5;
  const scaleText = `${scaleMin}–${scaleMax}`;
  const isSelf = form.isSelf ?? !employeeCode;
  const selfAverage = selfDraft.box2BusinessScore && selfDraft.box3PeopleScore
    ? (selfDraft.box2BusinessScore + selfDraft.box3PeopleScore) / 2
    : null;
  const managerAverage = (managerDraft.business + managerDraft.people) / 2;

  const submitSelf = async () => {
    if (!selfDraft.box2BusinessScore || !selfDraft.box3PeopleScore) {
      showToast(`Cần chọn điểm ${scaleText} cho cả Business và People`);
      return;
    }
    if (!selfDraft.box2Results?.trim() || !selfDraft.box3Results?.trim()) {
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
          box4Direction: selfDraft.box4Direction,
          box4SelfProposal: selfDraft.box4SelfProposal,
          box4ImprovementArea: selfDraft.box4ImprovementArea,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || 'Không nộp được bản tự đánh giá');
      showToast(json?.message || 'Đã nộp bản tự đánh giá');
      reload();
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
      reload();
    } catch (err: any) {
      showToast(err.message || 'Không lưu được điểm Quản lý');
    } finally {
      setSaving(false);
    }
  };

  const toggleAllowUpdate = async (nextEnabled: boolean) => {
    if (!form.reviewId) { showToast('Nhân viên chưa có hồ sơ OKR'); return; }
    try {
      const res = await fetch(`/api/v1/okr/reviews/${form.reviewId}/allow-update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phase: 'FINAL', enabled: nextEnabled }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || 'Không đổi được quyền cập nhật');
      showToast(json?.message || 'Đã cập nhật quyền cập nhật cho nhân viên');
      reload();
    } catch (err: any) {
      showToast(err.message || 'Không đổi được quyền cập nhật');
    }
  };

  // Quyền sửa do server quyết định theo phase / trạng thái (không tự suy ở client)
  const canEditSelf = Boolean(form.canSelfEdit);
  const canEditManager = Boolean(form.canManagerAssess);

  return {
    form,
    selfDraft,
    setSelfDraft,
    managerDraft,
    setManagerDraft,
    loading,
    saving,
    scaleMin,
    scaleMax,
    scaleText,
    isSelf,
    selfAverage,
    managerAverage,
    canEditSelf,
    canEditManager,
    loadForm,
    reload,
    submitSelf,
    submitManager,
    toggleAllowUpdate,
  };
};

export type Form4BoxState = ReturnType<typeof useForm4Box>;
