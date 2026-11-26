import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card } from '../../../components/common/Card';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { Modal } from '../../../components/common/Modal';
import { OkrSelfAssessmentSection } from '../assessment/OkrSelfAssessmentSection';
import { useForm4Box } from '../assessment/useForm4Box';
import { OKRPhaseTimeline } from '../cycles/OKRPhaseTimeline';
import { NoActiveCycleNotice } from '../components/NoActiveCycleNotice';

type GroupKey = 'BUSINESS' | 'PEOPLE';

/** Kỳ chốt cuối năm được backend đánh dấu hậu tố -FINAL — hiển thị thân thiện hơn. */
const periodLabel = (period?: string | null) => {
  if (!period) return 'kỳ hiện tại';
  return period.endsWith('-FINAL') ? `${period.slice(0, -'-FINAL'.length)} · chốt cuối năm` : period;
};

interface OKRItem {
  id: string;
  groupType: GroupKey;
  title: string;
  detail?: string;
  progress: number;
  weight?: number;
  deletedAt?: string | null;
  deleteReason?: string | null;
}

interface ManagerObjective {
  id: string;
  managerCode: string;
  managerName: string;
  groupType: GroupKey;
  title: string;
  detail: string;
}

interface CheckInRow {
  itemId: string;
  title: string;
  groupType: GroupKey;
  previousValue: number;
  newValue: number;
  progress: number;
  unit?: string;
  lastPeriod?: string | null;
  lastCheckInAt?: string | null;
  lastNote?: string | null;
  checkedInThisPeriod?: boolean;
}

interface CheckInData {
  year: number;
  period: string;
  periodLabel?: string | null;
  finalWindow?: boolean;
  reviewStatus?: string | null;
  isLocked?: boolean;
  deadline?: string | null;
  daysLeft?: number;
  canCheckIn: boolean;
  blockReason?: string | null;
  pendingCount?: number;
  reminder: boolean;
  reminderText: string;
  businessItems: CheckInRow[];
  peopleItems: CheckInRow[];
  totalItems: number;
}

interface CheckInAttachment {
  id: string;
  fileName: string;
  contentType?: string;
  sizeBytes?: number;
}

interface CheckInHistoryRow {
  id: string;
  batchId: string;
  period: string;
  previousValue?: number | null;
  newValue: number;
  progressSnapshot: number;
  note?: string | null;
  createdAt?: string | null;
  attachments: CheckInAttachment[];
}

interface PhaseInfo {
  key: string;
  name: string;
  start_date?: string | null;
  due_date?: string | null;
  review_start?: string | null;
  review_due?: string | null;
  months?: string | null;
  review_months?: string | null;
  effective_status?: 'active' | 'upcoming' | 'locked' | null;
  manager_status?: 'active' | 'upcoming' | 'locked' | null;
}

interface MyOKRData {
  reviewId: string | null;
  cycleYear: number;
  status: 'draft' | 'submitted' | 'locked' | 'reopened' | 'returned';
  currentPhase?: 'SETUP' | 'MIDYEAR' | 'FINAL' | 'NONE';
  phaseName?: string | null;
  phaseStatus?: 'active' | 'upcoming' | 'locked' | null;
  managerReviewing?: boolean;
  /** false = hệ thống chưa có chu kỳ OKR nào đang hoạt động. */
  hasActiveCycle?: boolean;
  updateWindow?: string | null;
  phases?: PhaseInfo[];
  isLocked: boolean;
  lockReason?: string | null;
  box4SubmittedAt?: string | null;
  scoreSource?: 'MANAGER' | 'SELF' | null;
  submittedAt?: string | null;
  managerFeedback?: string | null;
  box4Direction?: string;
  box4Proposal?: string;
  box4ImprovementArea?: string;
  businessScore?: number | null;
  peopleScore?: number | null;
  averageScore?: number | null;
  items: OKRItem[];
  deletedItems: OKRItem[];
}

export const MyOKRPage: React.FC = () => {
  const [data, setData] = useState<MyOKRData | null>(null);
  const [managerObjectives, setManagerObjectives] = useState<ManagerObjective[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  // Thêm đầu việc trực tiếp trên danh sách (inline — nhóm nào đang mở form)
  const [addingGroup, setAddingGroup] = useState<GroupKey | null>(null);
  const [addForm, setAddForm] = useState<{ title: string; detail: string }>({ title: '', detail: '' });
  const [addSaving, setAddSaving] = useState(false);

  // Modal xoá (bắt buộc lý do)
  const [deleteModalItem, setDeleteModalItem] = useState<OKRItem | null>(null);
  const [deleteReason, setDeleteReason] = useState('');

  // Sửa đầu việc trực tiếp trên danh sách (inline)
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ title: string; detail: string }>({ title: '', detail: '' });
  const [editSaving, setEditSaving] = useState(false);

  // Định hướng & đề xuất của kỳ (gửi kèm bộ mục tiêu)
  const [directionText, setDirectionText] = useState('');
  const [proposalText, setProposalText] = useState('');
  const [improvementText, setImprovementText] = useState('');
  const [proposalSaving, setProposalSaving] = useState(false);

  // Check-in tiến độ (S22)
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [checkInData, setCheckInData] = useState<CheckInData | null>(null);
  const [checkInValues, setCheckInValues] = useState<Record<string, string>>({});
  const [checkInNote, setCheckInNote] = useState('');
  const [checkInFiles, setCheckInFiles] = useState<File[]>([]);
  const [checkInSubmitting, setCheckInSubmitting] = useState(false);
  const [historyRow, setHistoryRow] = useState<CheckInRow | null>(null);
  const [historyRows, setHistoryRows] = useState<CheckInHistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Hiển thị gợi ý của manager
  const [showManagerSuggestions] = useState(true);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const loadData = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    Promise.all([
      fetch('/api/v1/okr/my-okr').then((r) => r.json()),
      fetch('/api/v1/okr/manager-objectives').then((r) => r.json()),
    ])
      .then(([okrRes, mgrRes]) => {
        if (okrRes?.data) {
          setData(okrRes.data);
          setDirectionText(okrRes.data.box4Direction || '');
          setProposalText(okrRes.data.box4Proposal || '');
          setImprovementText(okrRes.data.box4ImprovementArea || '');
        }
        if (mgrRes?.data) {
          setManagerObjectives(mgrRes.data);
        }
      })
      .catch((err) => {
        console.error('Lỗi khi tải dữ liệu OKR:', err);
        showToast('Không thể tải dữ liệu OKR từ máy chủ');
      })
      .finally(() => { if (!silent) setLoading(false); });
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Từ Dashboard bấm "Check-in ngay" (/okr/my-okr?checkin=1) → mở luôn form check-in
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get('checkin') === '1' && data) {
      openCheckIn();
      searchParams.delete('checkin');
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const isLocked = Boolean(data?.isLocked);
  const proposalSubmitted = data?.status === 'submitted' || data?.status === 'locked';
  const hasProposalContent = Boolean(directionText.trim() || proposalText.trim() || improvementText.trim());

  // ---- Workspace theo phase: một trang duy nhất cho nhân viên ----
  const currentPhase = data?.currentPhase ?? 'NONE';
  const sectionParam = searchParams.get('section');
  const showAssessment = currentPhase === 'FINAL' || sectionParam === 'assessment';
  const assessment = useForm4Box({ enabled: showAssessment, onToast: showToast });
  const assessmentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (sectionParam !== 'assessment' || !showAssessment || assessment.loading || !data) return;
    const t = setTimeout(() => assessmentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
    return () => clearTimeout(t);
  }, [sectionParam, showAssessment, assessment.loading, data]);

  const phases = data?.phases ?? [];
  const fmtDate = (v?: string | null) => (v ? `${v.slice(8, 10)}/${v.slice(5, 7)}` : '—');
  const phaseStatusText = (s?: string | null) => (s === 'active' ? 'Đang mở' : s === 'upcoming' ? 'Sắp tới' : s === 'locked' ? 'Đã khoá' : '');
  const phaseTitle = currentPhase === 'MIDYEAR'
    ? `Cập nhật tiến độ OKR ${data?.cycleYear ?? ''} — Review giữa năm`
    : currentPhase === 'FINAL'
      ? `Đánh giá OKR cuối năm ${data?.cycleYear ?? ''}`
      : currentPhase === 'SETUP'
        ? `Thiết lập OKR ${data?.cycleYear ?? ''}`
        : `OKR cá nhân ${data?.cycleYear ?? ''}`;

  // Thêm mục mới ngay trên danh sách của nhóm
  const handleAddItem = async (group: GroupKey) => {
    if (addSaving) return;
    if (!addForm.title.trim()) {
      showToast('Vui lòng nhập tên đầu việc');
      return;
    }
    setAddSaving(true);
    try {
      const res = await fetch('/api/v1/okr/objectives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: data?.cycleYear,
          groupType: group,
          title: addForm.title.trim(),
          detail: addForm.detail.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.message || 'Lỗi khi tạo mục tiêu');
      }
      showToast('Đã thêm đầu việc OKR thành công!');
      setAddingGroup(null);
      setAddForm({ title: '', detail: '' });
      loadData(true);
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi thêm mục tiêu');
    } finally {
      setAddSaving(false);
    }
  };

  // Mở/đóng form thêm & sửa inline (chỉ 1 form tại một thời điểm)
  const startAdd = (group: GroupKey) => {
    if (isLocked) return;
    setEditingItemId(null);
    setAddingGroup(group);
    setAddForm({ title: '', detail: '' });
  };

  const cancelAdd = () => {
    setAddingGroup(null);
    setAddForm({ title: '', detail: '' });
  };

  const startEdit = (item: OKRItem) => {
    setAddingGroup(null);
    setEditingItemId(item.id);
    setEditForm({ title: item.title, detail: item.detail || '' });
  };

  const cancelEdit = () => {
    setEditingItemId(null);
    setEditForm({ title: '', detail: '' });
  };

  // Ctrl/⌘ + Enter để lưu, Esc để huỷ — dùng chung cho form inline
  const inlineKeyDown = (e: React.KeyboardEvent, onSave: () => void, onCancel: () => void) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      onSave();
    }
  };

  // 1-Chạm chép từ Quản lý (C14)
  const handleCloneFromManager = async (mgrObj: ManagerObjective) => {
    if (isLocked) {
      showToast('OKR đã khoá, không thể thêm mục mới');
      return;
    }
    try {
      const res = await fetch('/api/v1/okr/objectives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: data?.cycleYear,
          groupType: mgrObj.groupType,
          title: mgrObj.title,
          detail: mgrObj.detail,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.message || 'Lỗi sao chép mục tiêu');
      }
      showToast(`Đã kế thừa mục tiêu từ Quản lý: ${mgrObj.title}`);
      loadData(true);
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi kế thừa mục tiêu');
    }
  };

  // Xoá mục tiêu (Bắt buộc nhập lý do)
  const handleConfirmDelete = async () => {
    if (!deleteModalItem) return;
    if (!deleteReason.trim()) {
      showToast('Lý do xoá là bắt buộc theo quy định HR');
      return;
    }
    try {
      const res = await fetch(
        `/api/v1/okr/items/${deleteModalItem.id}?reason=${encodeURIComponent(deleteReason.trim())}`,
        { method: 'DELETE' }
      );
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.message || 'Lỗi khi xoá mục tiêu');
      }
      showToast('Đã xoá mục tiêu — lưu vết lịch sử thành công');
      setDeleteModalItem(null);
      setDeleteReason('');
      loadData(true);
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi xoá mục tiêu');
    }
  };

  // Lưu nháp định hướng & đề xuất (các đầu việc đã tự lưu khi thêm/sửa)
  const handleSaveDraft = async () => {
    setProposalSaving(true);
    try {
      const res = await fetch('/api/v1/okr/self-proposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: data?.cycleYear,
          direction: directionText,
          proposal: proposalText,
          improvementArea: improvementText,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.message || 'Lỗi khi lưu nháp');
      }
      showToast(json?.message || 'Đã lưu nháp định hướng & đề xuất');
      loadData(true);
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi lưu nháp');
    } finally {
      setProposalSaving(false);
    }
  };

  // Rút lại bộ OKR đang chờ duyệt (Quản lý chưa xử lý)
  const [withdrawing, setWithdrawing] = useState(false);
  const handleWithdraw = async () => {
    if (!window.confirm('Rút lại bộ mục tiêu đang chờ Quản lý duyệt? Bạn sẽ sửa được và cần bấm "Gửi Quản lý duyệt" lại.')) return;
    setWithdrawing(true);
    try {
      const res = await fetch('/api/v1/okr/withdraw-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: data?.cycleYear }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || 'Không rút lại được');
      showToast(json?.message || 'Đã rút lại bộ OKR');
      loadData(true);
    } catch (err: any) {
      showToast(err.message || 'Không rút lại được');
    } finally {
      setWithdrawing(false);
    }
  };

  // Gửi Quản lý duyệt đầu năm (Submit Setup)
  const handleSubmitSetup = async () => {
    const hasBusiness = (data?.items || []).some((i) => i.groupType === 'BUSINESS');
    const hasPeople = (data?.items || []).some((i) => i.groupType === 'PEOPLE');
    if (!hasBusiness || !hasPeople) {
      const missing = !hasBusiness && !hasPeople
        ? 'cả 2 nhóm Business và People'
        : (!hasBusiness ? 'nhóm Business' : 'nhóm People');
      showToast(`Chưa thể gửi: ${missing} phải có ít nhất 1 đầu việc`);
      return;
    }
    if (!window.confirm('Bạn có chắc chắn muốn nộp bộ mục tiêu OKR cho Quản lý phê duyệt? Sau khi gửi, form sẽ được khoá sửa cho tới khi Quản lý mở lại.')) {
      return;
    }
    try {
      const res = await fetch('/api/v1/okr/submit-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: data?.cycleYear,
          direction: directionText,
          proposal: proposalText,
          improvementArea: improvementText,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.message || 'Lỗi khi gửi duyệt');
      }
      showToast('Đã nộp OKR thành công — Form đã được khoá sửa!');
      loadData(true);
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi nộp duyệt');
    }
  };

  // Lưu chỉnh sửa đầu việc (inline)
  const handleUpdateItem = async (itemId: string) => {
    if (editSaving) return;
    if (!editForm.title.trim()) { showToast('Tiêu đề không được để trống'); return; }
    setEditSaving(true);
    try {
      const res = await fetch(`/api/v1/okr/items/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editForm.title.trim(), detail: editForm.detail.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || 'Lỗi khi lưu chỉnh sửa');
      showToast('Đã cập nhật đầu việc thành công!');
      setEditingItemId(null);
      setEditForm({ title: '', detail: '' });
      loadData(true);
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi lưu chỉnh sửa');
    } finally {
      setEditSaving(false);
    }
  };

  // ===== Check-in tiến độ (S22) =====
  const openCheckIn = async () => {
    setCheckInOpen(true);
    setCheckInLoading(true);
    setCheckInNote('');
    setCheckInFiles([]);
    try {
      const res = await fetch(`/api/v1/okr/check-ins/current${data?.cycleYear ? `?year=${data.cycleYear}` : ''}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || 'Không tải được dữ liệu check-in');
      const d: CheckInData = json.data;
      setCheckInData(d);
      const values: Record<string, string> = {};
      [...(d.businessItems || []), ...(d.peopleItems || [])].forEach((row) => {
        values[row.itemId] = String(row.previousValue ?? 0);
      });
      setCheckInValues(values);
    } catch (err: any) {
      showToast(err.message || 'Không tải được dữ liệu check-in');
    } finally {
      setCheckInLoading(false);
    }
  };

  const handleSubmitCheckIn = async () => {
    if (!checkInData) return;
    const rows = [...(checkInData.businessItems || []), ...(checkInData.peopleItems || [])];
    // Mỗi kỳ chỉ check-in 1 lần / đầu việc — bỏ qua đầu việc đã check-in kỳ này
    const items = rows
      .filter((row) => !row.checkedInThisPeriod)
      .map((row) => ({ itemId: row.itemId, newValue: checkInValues[row.itemId] }))
      .filter((it) => it.newValue !== undefined && String(it.newValue).trim() !== '');
    if (items.length === 0) {
      showToast('Vui lòng nhập giá trị mới cho ít nhất 1 đầu việc');
      return;
    }

    setCheckInSubmitting(true);
    try {
      const res = await fetch('/api/v1/okr/check-ins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: checkInData.year,
          period: checkInData.period,
          note: checkInNote.trim(),
          items,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || 'Lỗi khi gửi check-in');

      const batchId = json.data?.batchId;
      let uploaded = 0;
      if (batchId && checkInFiles.length > 0) {
        for (const file of checkInFiles) {
          const fd = new FormData();
          fd.append('file', file);
          const up = await fetch(`/api/v1/okr/check-ins/${batchId}/attachments`, {
            method: 'POST',
            body: fd,
          });
          if (up.ok) uploaded++;
        }
      }

      showToast(
        checkInFiles.length > 0 && uploaded < checkInFiles.length
          ? `Đã gửi check-in, nhưng chỉ ${uploaded}/${checkInFiles.length} file tải lên thành công`
          : 'Đã gửi check-in tiến độ thành công!'
      );
      setCheckInOpen(false);
      setCheckInData(null);
      loadData(true);
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi gửi check-in');
    } finally {
      setCheckInSubmitting(false);
    }
  };

  const openCheckInHistory = async (row: CheckInRow) => {
    setHistoryRow(row);
    setHistoryRows([]);
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/v1/okr/check-ins/history?itemId=${row.itemId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || 'Không tải được lịch sử check-in');
      setHistoryRows(json.data || []);
    } catch (err: any) {
      showToast(err.message || 'Không tải được lịch sử check-in');
    } finally {
      setHistoryLoading(false);
    }
  };

  const downloadCheckInAttachment = async (att: CheckInAttachment) => {
    try {
      const res = await fetch(`/api/v1/okr/check-ins/attachments/${att.id}`);
      if (!res.ok) throw new Error('Không tải được file');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = att.fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      showToast(err.message || 'Không tải được file');
    }
  };

  const formatDateTime = (value?: string | null) => {
    if (!value) return '—';
    try {
      return new Date(value).toLocaleString('vi-VN');
    } catch {
      return value;
    }
  };

  const businessItems = data?.items.filter((i) => i.groupType === 'BUSINESS') || [];
  const peopleItems = data?.items.filter((i) => i.groupType === 'PEOPLE') || [];
  const deletedItems = data?.deletedItems || [];

  const getStatusBadge = () => {
    switch (data?.status) {
      case 'submitted':
        return <Badge variant="accent">Chờ Quản lý duyệt — có thể rút lại</Badge>;
      case 'locked':
        return <Badge variant="ok">Đã duyệt & Khoá sửa</Badge>;
      case 'reopened':
        return <Badge variant="info">Quản lý đã mở lại quyền sửa</Badge>;
      case 'returned':
        return <Badge variant="danger">Đã trả lại — Cần sửa theo góp ý</Badge>;
      default:
        return <Badge variant="warn">Đang soạn thảo (Nháp) — Mở sửa</Badge>;
    }
  };

  const renderGroup = (group: GroupKey, title: string, subtitle: string, itemsList: OKRItem[]) => {
    const mgrSuggestions = managerObjectives.filter((m) => m.groupType === group);

    // Form thêm inline — hiển thị ngay cuối danh sách của nhóm
    const addFormCard = (
      <div className="border-2 border-dashed border-accent/60 rounded-lg p-3.5 bg-accent-soft/20 space-y-2.5">
        <div>
          <label className="block text-[11px] font-semibold text-ink mb-1">
            Tên đầu việc <span className="text-danger">*</span>{' '}
            <span className="text-ink-muted font-normal">(tự do, không giới hạn số chữ)</span>
          </label>
          <textarea
            autoFocus
            rows={2}
            className="w-full border border-line rounded-lg p-2 text-xs bg-canvas focus:outline-none focus:border-accent resize-y"
            placeholder="Nhập tên đầu việc hoặc mục tiêu cụ thể..."
            value={addForm.title}
            onChange={(e) => setAddForm({ ...addForm, title: e.target.value })}
            onKeyDown={(e) => inlineKeyDown(e, () => handleAddItem(group), cancelAdd)}
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-ink mb-1">
            Mô tả chi tiết / Tiêu chí hoàn thành <span className="text-ink-muted font-normal">(tuỳ chọn)</span>
          </label>
          <textarea
            rows={2}
            className="w-full border border-line rounded-lg p-2 text-xs bg-canvas focus:outline-none focus:border-accent resize-y"
            placeholder="Mô tả hành động, chỉ số hoặc kết quả dự kiến..."
            value={addForm.detail}
            onChange={(e) => setAddForm({ ...addForm, detail: e.target.value })}
            onKeyDown={(e) => inlineKeyDown(e, () => handleAddItem(group), cancelAdd)}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[10px] text-ink-muted">
            ℹ️ Không đính kèm tệp ở bước tạo — evidence bổ sung ở bước Check-in · Ctrl/⌘ + Enter để lưu · Esc để huỷ
          </span>
          <div className="flex gap-2 shrink-0 ml-auto">
            <Button type="button" variant="ghost" size="sm" className="h-auto py-1 px-2.5 text-xs" onClick={cancelAdd} disabled={addSaving}>
              Huỷ
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              className="h-auto py-1 px-2.5 text-xs"
              onClick={() => handleAddItem(group)}
              disabled={addSaving || !addForm.title.trim()}
            >
              {addSaving ? 'Đang lưu...' : 'Thêm đầu việc'}
            </Button>
          </div>
        </div>
      </div>
    );

    // Form sửa inline — thay thế đúng dòng đầu việc đang sửa
    const editCard = (item: OKRItem) => (
      <div key={item.id} className="border-2 border-accent rounded-lg p-3.5 bg-surface space-y-2.5">
        <div>
          <label className="block text-[11px] font-semibold text-ink mb-1">
            Tên đầu việc <span className="text-danger">*</span>
          </label>
          <textarea
            autoFocus
            rows={2}
            className="w-full border border-line rounded-lg p-2 text-xs bg-canvas focus:outline-none focus:border-accent resize-y"
            value={editForm.title}
            onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
            onKeyDown={(e) => inlineKeyDown(e, () => handleUpdateItem(item.id), cancelEdit)}
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-ink mb-1">Chi tiết / Mô tả</label>
          <textarea
            rows={2}
            className="w-full border border-line rounded-lg p-2 text-xs bg-canvas focus:outline-none focus:border-accent resize-y"
            placeholder="Mô tả thêm về đầu việc, chỉ số đo lường, deadline..."
            value={editForm.detail}
            onChange={(e) => setEditForm({ ...editForm, detail: e.target.value })}
            onKeyDown={(e) => inlineKeyDown(e, () => handleUpdateItem(item.id), cancelEdit)}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[10px] text-ink-muted">
            ℹ️ Tiến độ cập nhật qua Check-in — hệ thống tự tính · Ctrl/⌘ + Enter để lưu · Esc để huỷ
          </span>
          <div className="flex gap-2 shrink-0 ml-auto">
            <Button type="button" variant="ghost" size="sm" className="h-auto py-1 px-2.5 text-xs" onClick={cancelEdit} disabled={editSaving}>
              Huỷ
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              className="h-auto py-1 px-2.5 text-xs"
              onClick={() => handleUpdateItem(item.id)}
              disabled={editSaving || !editForm.title.trim()}
            >
              {editSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
            </Button>
          </div>
        </div>
      </div>
    );

    return (
      <Card className="space-y-4">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div>
            <h2 className="text-base font-bold text-ink flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${group === 'BUSINESS' ? 'bg-accent' : 'bg-status-ok'}`} />
              {title}
            </h2>
            <p className="text-xs text-ink-muted mt-0.5">{subtitle} · {itemsList.length} đầu việc tự do (không giới hạn số chữ)</p>
          </div>
        </div>

        {/* Gợi ý kế thừa từ Quản lý trực tiếp (C14) */}
        {!isLocked && showManagerSuggestions && (
          <div className="bg-accent-soft/40 border border-accent-line/60 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-accent flex items-center gap-1.5">
                <span>💡 Gợi ý kế thừa từ OKR Quản lý trực tiếp (C14):</span>
                <span className="text-[11px] font-normal text-ink-muted">Bấm 1 chạm để chép mục tiêu đã duyệt</span>
              </div>
            </div>
            {mgrSuggestions.length > 0 ? (
              <div className="space-y-1.5">
                {mgrSuggestions.map((m) => (
                  <div key={m.id} className="flex items-center justify-between bg-surface rounded-lg p-2.5 border border-line text-xs">
                    <div className="pr-3">
                      <span className="font-semibold text-ink">{m.title}</span>
                      {m.detail && <p className="text-[11px] text-ink-muted mt-0.5">{m.detail}</p>}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 text-xs py-1 px-2.5 h-auto text-accent-dark border-accent/40 hover:bg-accent-soft"
                      onClick={() => handleCloneFromManager(m)}
                    >
                      + Chép 1-chạm
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[11px] text-ink-muted bg-surface border border-dashed border-line rounded-lg p-2.5">
                Quản lý chưa có OKR đã duyệt trong chu kỳ này — bạn tự nhập mục tiêu bên dưới.
              </div>
            )}
          </div>
        )}

        {/* Danh sách mục tiêu của nhóm — nút thêm & form thêm nằm ngay cuối danh sách */}
        <div className="space-y-2.5">
          {itemsList.length === 0 ? (
            <div className="text-xs text-ink-muted py-6 text-center bg-canvas rounded-lg border border-dashed border-line">
              {isLocked ? (
                <>Chưa có đầu việc nào. 🔒 {data?.lockReason}</>
              ) : (
                <>
                  Chưa có đầu việc nào trong nhóm này. Hãy bấm <b>+ Thêm đầu việc</b> bên dưới để tự nhập
                  {managerObjectives.some((m) => m.groupType === group) ? <> hoặc <b>Chép 1-chạm</b> từ Quản lý</> : null}.
                </>
              )}
            </div>
          ) : (
            itemsList.map((item) => editingItemId === item.id ? editCard(item) : (
              <div key={item.id} className="border border-line rounded-lg p-3.5 hover:border-line-hover transition-colors bg-surface">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-ink leading-snug">{item.title}</h3>
                    {item.detail && <p className="text-xs text-ink-muted mt-1 leading-relaxed">{item.detail}</p>}
                    <div className="mt-2 flex items-center gap-3 text-[11px] text-ink-muted">
                      <span>Tiến độ thực hiện: <b className="text-ink font-semibold">{item.progress}%</b></span>
                    </div>
                  </div>
                  {!isLocked && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-auto py-1 px-2.5"
                        onClick={() => startEdit(item)}
                      >
                        ✏️ Sửa
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs text-danger hover:bg-danger-soft h-auto py-1 px-2"
                        onClick={() => {
                          setDeleteModalItem(item);
                          setDeleteReason('');
                        }}
                      >
                        Xoá
                      </Button>
                    </div>
                  )}
                </div>
                <div className="mt-2.5 h-1.5 bg-line rounded-full overflow-hidden">
                  <div
                    className={`h-full ${group === 'BUSINESS' ? 'bg-accent' : 'bg-status-ok'}`}
                    style={{ width: `${Math.min(100, item.progress)}%` }}
                  />
                </div>
              </div>
            ))
          )}

          {!isLocked && (
            addingGroup === group ? addFormCard : (
              <button
                type="button"
                onClick={() => startAdd(group)}
                className="w-full border-2 border-dashed border-line rounded-lg py-2.5 text-xs font-semibold text-ink-muted hover:border-accent hover:text-accent-dark hover:bg-accent-soft/20 transition-colors"
              >
                + Thêm đầu việc
              </button>
            )
          )}
        </div>
      </Card>
    );
  };

  const renderCheckInGroup = (group: GroupKey, title: string, rows: CheckInRow[]) => (
    <Card className="space-y-3">
      <div className="flex items-center justify-between border-b border-line pb-2.5">
        <h3 className="text-sm font-bold text-ink flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${group === 'BUSINESS' ? 'bg-accent' : 'bg-status-ok'}`} />
          {title}
        </h3>
        <span className="text-[11px] text-ink-muted">{rows.length} đầu việc</span>
      </div>
      {rows.length === 0 ? (
        <div className="text-xs text-ink-muted py-4 text-center bg-canvas rounded-lg border border-dashed border-line">
          Chưa có đầu việc trong nhóm này.
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.itemId} className="rounded-lg border border-line p-2.5 bg-surface">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-ink">{row.title}</div>
                  <div className="text-[11px] text-ink-muted mt-0.5">
                    Kỳ trước: <b className="text-ink">{row.previousValue}%</b>
                    {row.lastPeriod ? ` (${periodLabel(row.lastPeriod)})` : ' · chưa check-in'}
                    {row.checkedInThisPeriod && (
                      <span className="ml-1 text-status-ok font-semibold">· Đã check-in kỳ này</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      disabled={!checkInData?.canCheckIn || row.checkedInThisPeriod}
                      value={checkInValues[row.itemId] ?? ''}
                      onChange={(e) => setCheckInValues({ ...checkInValues, [row.itemId]: e.target.value })}
                      className="w-24 border border-line rounded-lg p-1.5 pr-7 text-xs bg-canvas disabled:bg-surface disabled:text-ink-muted focus:outline-none focus:border-accent"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-ink-muted">%</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => openCheckInHistory(row)}
                    className="text-[11px] font-semibold text-accent hover:underline"
                  >
                    Lịch sử
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );

  if (loading) {
    return <div className="p-8 text-center text-sm text-ink-muted">Đang tải biểu mẫu OKR...</div>;
  }

  // Chưa có chu kỳ OKR nào đang hoạt động → không có việc nào để làm.
  if (data?.hasActiveCycle === false) {
    return (
      <div className="max-w-4xl mx-auto pb-12">
        <NoActiveCycleNotice role="employee" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-12">
      {toast && (
        <div className="fixed top-16 right-6 z-[100] bg-ink text-canvas px-4 py-2.5 rounded-lg text-xs font-semibold shadow-lg">
          {toast}
        </div>
      )}

      {/* Header & Status Banner */}
      <Card className="space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-ink">{phaseTitle}</h1>
              {getStatusBadge()}
              {data?.managerReviewing && <Badge variant="warn">Quản lý đang chấm điểm</Badge>}
            </div>
            <p className="text-xs text-ink-muted mt-1">
              2 nhóm cố định Business & People · Điểm chấm 1–5 nguyên (không có điểm lẻ) · Không xếp loại A/B/C/D.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" variant="outline" onClick={openCheckIn}>
              ✦ Check-in tiến độ
            </Button>
            {!isLocked && (
              <Button size="sm" variant="outline" onClick={handleSaveDraft} disabled={proposalSaving}>
                {proposalSaving ? 'Đang lưu...' : '💾 Lưu nháp'}
              </Button>
            )}
            {!isLocked && (
              <Button size="sm" variant="primary" onClick={handleSubmitSetup}>
                📤 Gửi Quản lý duyệt
              </Button>
            )}
          </div>
        </div>

        {phases.length > 0 && (
          <OKRPhaseTimeline
            year={data?.cycleYear ?? new Date().getFullYear()}
            phases={phases.map((p) => ({
              key: p.key,
              name: p.name,
              start_date: p.start_date || undefined,
              due_date: p.due_date || undefined,
              review_start: p.review_start || undefined,
              review_due: p.review_due || undefined,
              status: 'scheduled',
              effective_status: p.effective_status || undefined,
              manager_status: p.manager_status || undefined,
            }))}
          />
        )}

        {phases.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {phases.map((p) => {
              const active = p.key.toUpperCase() === currentPhase;
              return (
                <div
                  key={p.key}
                  className={`rounded-xl border p-2.5 text-xs ${active ? 'border-accent bg-accent-soft/30' : 'border-line bg-canvas'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-ink">{p.name}</span>
                    <span className={`text-[11px] font-semibold ${p.effective_status === 'active' ? 'text-accent' : 'text-ink-muted'}`}>
                      {phaseStatusText(p.effective_status)}
                    </span>
                  </div>
                  <div className="text-[11px] text-ink-muted mt-1">NV: {fmtDate(p.start_date)}–{fmtDate(p.due_date)}</div>
                  <div className="text-[11px] text-ink-muted">QL: {fmtDate(p.review_start)}–{fmtDate(p.review_due)}</div>
                </div>
              );
            })}
          </div>
        )}

        {/* Thông báo trạng thái khoá sửa */}
        {isLocked && (
          <div className="bg-status-warn/10 border border-status-warn/30 rounded-xl p-3.5 text-xs text-status-warn flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-base">🔒</span>
              <span>
                <b>Bộ mục tiêu đang khoá sửa (Read-Only).</b> {data?.lockReason}
              </span>
            </div>
            {data?.status === 'submitted' && (
              <Button size="sm" variant="outline" onClick={handleWithdraw} disabled={withdrawing} className="shrink-0">
                {withdrawing ? 'Đang rút...' : '↩ Rút lại để sửa'}
              </Button>
            )}
          </div>
        )}

        {/* Banner khi Quản lý mở lại quyền sửa trong đợt review */}
        {data?.status === 'reopened' && (
          <div className="bg-status-info-soft border border-status-info-line rounded-xl p-3.5 text-xs text-status-info space-y-1">
            <div className="font-bold flex items-center gap-2">
              <span>🔓</span>
              <span>Quản lý đã mở lại quyền chỉnh sửa OKR</span>
            </div>
            {data.managerFeedback && (
              <div className="text-status-info">
                <b>Ghi chú của Quản lý:</b> {data.managerFeedback}
              </div>
            )}
            <div className="text-status-info">
              Bạn có thể sửa/bổ sung mục tiêu, sau đó bấm <b>“Gửi Quản lý duyệt”</b> để nộp lại.
            </div>
          </div>
        )}

        {/* Banner góp ý khi Quản lý trả lại — nhân viên cần sửa */}
        {data?.status === 'returned' && (
          <div className="bg-status-danger-soft border border-status-danger-line rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-status-danger font-bold text-sm">
              <span>⚠️</span>
              <span>Quản lý đã trả lại — Cần chỉnh sửa theo góp ý dưới đây rồi gửi lại</span>
            </div>
            {data.managerFeedback ? (
              <div className="bg-surface rounded-lg p-3 text-xs text-ink border border-status-danger-line">
                <span className="font-semibold text-status-danger">Góp ý của Quản lý: </span>
                {data.managerFeedback}
              </div>
            ) : (
              <div className="text-xs text-status-danger">Quản lý chưa để lại góp ý cụ thể.</div>
            )}
            <div className="text-xs text-status-danger">
              Hãy sửa bộ mục tiêu rồi bấm <b>"Gửi Quản lý duyệt"</b> khi hoàn thành.
            </div>
          </div>
        )}
      </Card>

      {/* Tự đánh giá cuối năm — cùng một workspace, chỉ mở khi phase FINAL (hoặc deep-link ?section=assessment) */}
      {showAssessment && (
        <div ref={assessmentRef} id="self-assessment" className="space-y-5 scroll-mt-20">
          <Card className="space-y-1 border-accent/40">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-bold text-ink">Tự đánh giá cuối năm (Form 4 Box)</h2>
              <Badge variant="accent">{data?.phaseName || 'Đánh giá cuối năm'}</Badge>
            </div>
            <p className="text-xs text-ink-muted">
              Thành tựu công việc &amp; con người, tự chấm {assessment.scaleText} cho từng nhóm và xem lại định hướng phát triển.
              Điểm Quản lý chấm độc lập sau khi bạn nộp.
            </p>
          </Card>
          {assessment.loading ? (
            <Card><div className="p-6 text-center text-xs text-ink-muted">Đang tải form đánh giá...</div></Card>
          ) : (
            <OkrSelfAssessmentSection assessment={assessment} />
          )}
        </div>
      )}

      {/* Nhóm Business */}
      {renderGroup(
        'BUSINESS',
        'Business (Mục tiêu công việc & Dự án)',
        'Mục tiêu chuyên môn, tiến độ dự án, chỉ số kỹ thuật và đóng góp năng suất',
        businessItems
      )}

      {/* Nhóm People */}
      {renderGroup(
        'PEOPLE',
        'People (Phát triển con người & Đội ngũ)',
        'Đào tạo nội bộ, phát triển năng lực cá nhân, văn hóa chia sẻ và kèm cặp đồng nghiệp',
        peopleItems
      )}

      {/* Định hướng & đề xuất của kỳ — gửi kèm bộ mục tiêu; ẩn khi Box 4 trong form tự đánh giá đã sẵn sàng */}
      {!(showAssessment && (assessment.canEditSelf || proposalSubmitted)) && (
        <Card className="space-y-3">
          <div className="flex items-center justify-between border-b border-line pb-2.5">
            <div>
              <h2 className="text-base font-bold text-ink flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-status-info" />
                Định hướng &amp; đề xuất kỳ {data?.cycleYear ?? ''}
              </h2>
              <p className="text-xs text-ink-muted mt-0.5">
                Khai báo cùng bộ mục tiêu, gửi Quản lý duyệt khi bấm “Gửi Quản lý duyệt” (tuỳ chọn)
              </p>
            </div>
            <Badge variant={proposalSubmitted ? 'ok' : hasProposalContent ? 'warn' : 'gray'}>
              {proposalSubmitted ? 'Đã gửi kèm OKR' : hasProposalContent ? 'Đang viết' : 'Chưa viết'}
            </Badge>
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-ink">Định hướng phát triển</label>
            <textarea
              disabled={isLocked}
              rows={3}
              value={directionText}
              onChange={(e) => setDirectionText(e.target.value)}
              placeholder="Ví dụ: Phát triển theo hướng Technical Lead, mở rộng năng lực kiến trúc hệ thống..."
              className="w-full border border-line rounded-lg p-3 text-xs bg-canvas disabled:bg-surface disabled:text-ink-muted focus:outline-none focus:border-accent"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-ink">Đề xuất</label>
            <textarea
              disabled={isLocked}
              rows={3}
              value={proposalText}
              onChange={(e) => setProposalText(e.target.value)}
              placeholder="Ví dụ: Đề xuất tham gia dự án trọng điểm, được kèm cặp bởi mentor, tham gia khoá đào tạo chuyên môn..."
              className="w-full border border-line rounded-lg p-3 text-xs bg-canvas disabled:bg-surface disabled:text-ink-muted focus:outline-none focus:border-accent"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-ink">
              Điểm cần cải thiện <span className="text-ink-muted font-normal">(tuỳ chọn)</span>
            </label>
            <textarea
              disabled={isLocked}
              rows={3}
              value={improvementText}
              onChange={(e) => setImprovementText(e.target.value)}
              placeholder="Ví dụ: Cần cải thiện kỹ năng thuyết trình, quản lý thời gian và chia sẻ kiến thức cho team..."
              className="w-full border border-line rounded-lg p-3 text-xs bg-canvas disabled:bg-surface disabled:text-ink-muted focus:outline-none focus:border-accent"
            />
          </div>
          <div className="text-[11px] text-ink-muted">
            {isLocked
              ? '🔒 Nội dung đã gửi kèm bộ mục tiêu — Quản lý mở lại quyền sửa nếu cần thay đổi.'
              : 'Nội dung được gửi kèm khi bạn bấm “Gửi Quản lý duyệt”.'}
          </div>
        </Card>
      )}

      {/* Lịch sử các mục đã xoá (Lưu vết không mất vết — Tiêu chí 6) */}
      {deletedItems.length > 0 && (
        <Card className="space-y-3 bg-canvas/60 border border-line">
          <div className="flex items-center justify-between border-b border-line pb-2">
            <h3 className="text-xs font-bold text-ink-muted uppercase tracking-wider flex items-center gap-1.5">
              <span>📋 Lịch sử các mục đã xoá ({deletedItems.length} mục — Lưu vết theo quy định HR)</span>
            </h3>
          </div>
          <div className="space-y-2">
            {deletedItems.map((item) => (
              <div key={item.id} className="p-2.5 rounded border border-line bg-surface text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-ink-muted line-through">{item.title}</span>
                  <Badge variant="gray">{item.groupType}</Badge>
                </div>
                <div className="text-[11px] text-danger">
                  <b>Lý do xoá bắt buộc:</b> {item.deleteReason}
                </div>
                {item.deletedAt && (
                  <div className="text-[10px] text-ink-muted">
                    Thời gian xoá: {new Date(item.deletedAt).toLocaleString('vi-VN')}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Modal Xoá mục tiêu (Bắt buộc nhập lý do — Tiêu chí 6) */}
      <Modal isOpen={Boolean(deleteModalItem)} onClose={() => setDeleteModalItem(null)} title="Xác nhận xoá mục tiêu">
        <div className="space-y-4">
          <p className="text-xs text-ink">
            Bạn đang yêu cầu xoá mục tiêu: <br />
            <b className="text-danger font-semibold">{deleteModalItem?.title}</b>
          </p>
          <div>
            <label className="block text-xs font-semibold text-ink mb-1">
              Lý do xoá <span className="text-danger">*</span> (Bắt buộc theo quy định kiểm toán HR):
            </label>
            <textarea
              rows={3}
              required
              className="w-full border border-line rounded-lg p-2.5 text-xs bg-canvas focus:outline-none focus:border-danger"
              placeholder="Ví dụ: Thay đổi chiến lược quý 2, gộp sang dự án khác, chuyển đổi phạm vi công việc..."
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
            />
          </div>
          <div className="text-[11px] text-ink-muted">
            Mục tiêu bị xoá sẽ <b>vẫn còn lưu vết trong lịch sử</b> để quản lý và kiểm toán tra cứu, không bao giờ bị mất hẳn.
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-line">
            <Button type="button" variant="ghost" size="sm" onClick={() => setDeleteModalItem(null)}>
              Huỷ
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              disabled={!deleteReason.trim()}
              onClick={handleConfirmDelete}
            >
              Xác nhận xoá
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal Check-in tiến độ định kỳ (S22) */}
      <Modal
        isOpen={checkInOpen}
        onClose={() => { if (!checkInSubmitting) setCheckInOpen(false); }}
        title={`Check-in tiến độ — ${checkInData?.periodLabel || periodLabel(checkInData?.period)}`}
        maxWidth="4xl"
      >
        {checkInLoading ? (
          <div className="p-8 text-center text-xs text-ink-muted">Đang tải dữ liệu check-in...</div>
        ) : !checkInData ? (
          <div className="p-8 text-center text-xs text-ink-muted">Không có dữ liệu check-in.</div>
        ) : (
          <div className="space-y-4">
            <div className={`rounded-xl border p-3 text-xs space-y-1 ${
              checkInData.reminder
                ? 'bg-status-warn-soft border-status-warn-line text-status-warn'
                : 'bg-status-info-soft border-status-info-line text-status-info'
            }`}>
              <div className="font-bold">
                Kỳ {periodLabel(checkInData.period)} · Hạn check-in: {checkInData.deadline || '—'}
                {typeof checkInData.daysLeft === 'number' ? ` · còn ${checkInData.daysLeft} ngày` : ''}
              </div>
              <div>
                Giá trị kỳ trước <b>đã được điền sẵn</b>. Chỉ sửa con số thay đổi — tiến độ do hệ thống tự tính.
              </div>
              {checkInData.finalWindow && (
                <div className="font-semibold">
                  Đây là kỳ chốt cuối năm — bạn có thể lưu nhiều lần để cập nhật kết quả cho tới khi quản lý chấm điểm.
                </div>
              )}
              {checkInData.reminder && (
                <div className="font-semibold">⏰ {checkInData.reminderText}</div>
              )}
            </div>

            {!checkInData.canCheckIn && (
              <div className="rounded-lg border border-status-warn-line bg-status-warn-soft p-2.5 text-xs text-status-warn">
                {checkInData.blockReason || 'Hiện không nằm trong đợt check-in nên chưa thể gửi cập nhật.'}
              </div>
            )}

            {renderCheckInGroup('BUSINESS', 'Business', checkInData.businessItems || [])}
            {renderCheckInGroup('PEOPLE', 'People', checkInData.peopleItems || [])}

            <div className="rounded-xl border border-line p-3 space-y-2">
              <div className="text-xs font-bold text-ink">📎 Đính kèm evidence (tuỳ chọn)</div>
              <div className="text-[11px] text-ink-muted">
                Ảnh chụp kết quả, báo cáo, tài liệu liên quan — làm bằng chứng cho tiến độ.
              </div>
              <input
                type="file"
                multiple
                accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,.txt"
                onChange={(e) => {
                  const chosen = Array.from(e.target.files || []);
                  if (chosen.length) setCheckInFiles((prev) => [...prev, ...chosen]);
                  e.target.value = '';
                }}
                className="block w-full text-[11px] text-ink-secondary file:mr-3 file:rounded-lg file:border file:border-line file:bg-canvas file:px-3 file:py-1.5 file:text-[11px] file:font-semibold"
              />
              {checkInFiles.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {checkInFiles.map((file, idx) => (
                    <span key={`${file.name}-${idx}`} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-canvas px-2.5 py-1 text-[11px] text-ink-secondary">
                      📎 {file.name}
                      <button
                        type="button"
                        className="text-danger font-bold"
                        onClick={() => setCheckInFiles(checkInFiles.filter((_, i) => i !== idx))}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink mb-1">Ghi chú kỳ check-in (tuỳ chọn)</label>
              <textarea
                rows={3}
                value={checkInNote}
                disabled={!checkInData.canCheckIn}
                onChange={(e) => setCheckInNote(e.target.value)}
                placeholder="Kết quả đạt được, khó khăn và hướng xử lý..."
                className="w-full border border-line rounded-lg p-2.5 text-xs bg-canvas disabled:bg-surface disabled:text-ink-muted focus:outline-none focus:border-accent"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <Button type="button" variant="ghost" size="sm" onClick={() => setCheckInOpen(false)} disabled={checkInSubmitting}>
                Huỷ
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={checkInSubmitting || !checkInData.canCheckIn || checkInData.totalItems === 0}
                onClick={handleSubmitCheckIn}
              >
                {checkInSubmitting ? 'Đang gửi...' : (checkInData.finalWindow ? 'Lưu cập nhật cuối năm' : 'Gửi check-in')}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal lịch sử check-in của 1 đầu việc */}
      <Modal
        isOpen={Boolean(historyRow)}
        onClose={() => setHistoryRow(null)}
        title={`Lịch sử check-in — ${historyRow?.title || ''}`}
        maxWidth="2xl"
      >
        {historyLoading ? (
          <div className="p-6 text-center text-xs text-ink-muted">Đang tải lịch sử...</div>
        ) : historyRows.length === 0 ? (
          <div className="p-6 text-center text-xs text-ink-muted">Chưa có lần check-in nào.</div>
        ) : (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {historyRows.map((row) => (
              <div key={row.id} className="rounded-lg border border-line bg-surface p-3 text-xs space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-ink">Kỳ {periodLabel(row.period)}</span>
                  <span className="text-[11px] text-ink-muted">{formatDateTime(row.createdAt)}</span>
                </div>
                <div className="text-ink-secondary">
                  Giá trị: <b>{row.previousValue ?? '—'}%</b> → <b className="text-accent">{row.newValue}%</b>
                  <span className="text-ink-muted"> · Tiến độ snapshot: {row.progressSnapshot}%</span>
                </div>
                {row.note && <div className="text-[11px] text-ink-muted">Ghi chú: {row.note}</div>}
                {row.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {row.attachments.map((att) => (
                      <button
                        key={att.id}
                        type="button"
                        onClick={() => downloadCheckInAttachment(att)}
                        className="inline-flex items-center gap-1 rounded-full border border-line bg-canvas px-2 py-0.5 text-[10px] text-accent hover:border-accent"
                      >
                        📎 {att.fileName}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
};
