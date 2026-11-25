import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '../../../components/common/Card';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { Modal } from '../../../components/common/Modal';
import { NoActiveCycleNotice } from '../components/NoActiveCycleNotice';
import { useActiveCycle } from '../../../hooks/useActiveCycle';

interface OKRItem {
  id: string;
  groupType: 'BUSINESS' | 'PEOPLE';
  title: string;
  detail?: string;
  progress: number;
}

interface TeamApprovalItem {
  reviewId: string;
  id: string;
  employeeName: string;
  employeeCode: string;
  department: string;
  position: string;
  quarter: string;
  status: 'DRAFT' | 'SUBMITTED' | 'LOCKED' | 'REOPENED' | 'RETURNED';
  submittedDate: string | null;
  submittedAt?: string;
  selfDirection?: string;
  selfProposal?: string;
  selfImprovementArea?: string;
  businessItems: OKRItem[];
  peopleItems: OKRItem[];
  totalItems: number;
}

export const OKRApprovalsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'SUBMITTED' | 'LOCKED' | 'ALL'>('SUBMITTED');
  const [items, setItems] = useState<TeamApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<TeamApprovalItem | null>(null);
  const [feedbackModal, setFeedbackModal] = useState<{ isOpen: boolean; action: 'RETURN' | 'APPROVE' | 'REOPEN' }>({
    isOpen: false,
    action: 'APPROVE',
  });
  const [managerComment, setManagerComment] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  // Lỗi hiển thị NGAY TRONG modal xác nhận — toast nằm sau lớp mờ của modal nên
  // người dùng không đọc được khi thao tác duyệt/trả lại/mở sửa thất bại.
  const [actionError, setActionError] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // Chưa có chu kỳ OKR đang hoạt động → không có bộ mục tiêu nào chờ duyệt.
  const { hasActiveCycle } = useActiveCycle();

  const loadData = useCallback(() => {
    setLoading(true);
    fetch('/api/v1/okr/team-approvals')
      .then((res) => {
        if (!res.ok) throw new Error('Không thể tải danh sách duyệt');
        return res.json();
      })
      .then((json) => {
        if (json?.data) {
          setItems(json.data);
        }
      })
      .catch((err) => {
        console.error('Lỗi tải duyệt OKR:', err);
        showToast('Lỗi kết nối máy chủ');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Mỗi lần mở modal xác nhận (hoặc đổi thao tác) thì xoá lỗi của lần trước.
  useEffect(() => {
    if (feedbackModal.isOpen) setActionError(null);
  }, [feedbackModal.isOpen, feedbackModal.action]);

  const handleAction = async (action: 'APPROVE' | 'RETURN' | 'REOPEN') => {
    if (!selectedItem) return;

    setActionError(null);

    if (action === 'RETURN' && !managerComment.trim()) {
      setActionError('Góp ý / lý do là bắt buộc khi trả lại yêu cầu');
      return;
    }

    try {
      const res = await fetch(`/api/v1/okr/reviews/${selectedItem.reviewId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          feedback: managerComment.trim() || (action === 'APPROVE' ? 'Đồng ý phê duyệt' : 'Mở cho nhân viên sửa'),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || 'Lỗi khi xử lý');

      showToast(
        action === 'APPROVE'
          ? 'Đã phê duyệt bộ mục tiêu OKR!'
          : action === 'RETURN'
          ? 'Đã trả lại yêu cầu kèm góp ý!'
          : 'Đã mở lại quyền sửa cho nhân viên!'
      );
      setFeedbackModal({ isOpen: false, action: 'APPROVE' });
      setSelectedItem(null);
      setManagerComment('');
      loadData();
    } catch (err: any) {
      setActionError(err.message || 'Lỗi xử lý duyệt');
    }
  };

  const displayedItems = items.filter((item) => {
    if (activeTab === 'ALL') return true;
    if (activeTab === 'SUBMITTED') return item.status === 'SUBMITTED';
    if (activeTab === 'LOCKED') return item.status === 'LOCKED';
    return true;
  });

  const getStatusBadge = (st: string) => {
    switch (st) {
      case 'SUBMITTED':
        return <Badge variant="accent">Chờ Quản lý duyệt</Badge>;
      case 'LOCKED':
        return <Badge variant="ok">Đã duyệt (Khoá sửa)</Badge>;
      case 'REOPENED':
        return <Badge variant="info">Đang mở sửa bổ sung</Badge>;
      case 'RETURNED':
        return <Badge variant="danger">Đã trả lại (Cần sửa)</Badge>;
      default:
        return <Badge variant="gray">Đang soạn thảo</Badge>;
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {toast && (
        <div className="fixed top-16 right-6 z-[100] bg-ink text-canvas px-4 py-2.5 rounded-lg text-xs font-semibold shadow-lg">
          {toast}
        </div>
      )}

      {hasActiveCycle === false && <NoActiveCycleNotice role="manager" />}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink">Duyệt Mục Tiêu OKR Cấp Dưới</h1>
          <p className="text-xs text-ink-muted mt-1">
            Phê duyệt hoặc trả lại bộ mục tiêu 2 nhóm (Business & People) của nhân viên thuộc phạm vi quản lý trực tiếp.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-1 bg-surface p-1 rounded-xl border border-line text-xs">
          <button
            onClick={() => setActiveTab('SUBMITTED')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              activeTab === 'SUBMITTED' ? 'bg-accent text-white shadow-xs' : 'text-ink-secondary hover:text-ink'
            }`}
          >
            Chờ duyệt ({items.filter((i) => i.status === 'SUBMITTED').length})
          </button>
          <button
            onClick={() => setActiveTab('LOCKED')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              activeTab === 'LOCKED' ? 'bg-accent text-white shadow-xs' : 'text-ink-secondary hover:text-ink'
            }`}
          >
            Đã duyệt ({items.filter((i) => i.status === 'LOCKED').length})
          </button>
          <button
            onClick={() => setActiveTab('ALL')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              activeTab === 'ALL' ? 'bg-accent text-white shadow-xs' : 'text-ink-secondary hover:text-ink'
            }`}
          >
            Tất cả ({items.length})
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-xs text-ink-muted">Đang tải danh sách mục tiêu cấp dưới...</div>
      ) : displayedItems.length === 0 ? (
        <Card className="p-12 text-center text-ink-muted text-xs">
          Không có nhân viên nào trong danh sách {activeTab === 'SUBMITTED' ? 'chờ duyệt' : 'này'}.
        </Card>
      ) : (
        <div className="space-y-4">
          {displayedItems.map((item) => (
            <Card key={item.reviewId} className="space-y-4 hover:border-line-hover transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-ink text-sm">{item.employeeName}</span>
                    <span className="text-xs text-ink-muted font-mono">({item.employeeCode})</span>
                    {getStatusBadge(item.status)}
                  </div>
                  <div className="text-xs text-ink-secondary">
                    {item.department} · {item.position} · Ngày nộp: {item.submittedDate || '—'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => setSelectedItem(item)}>
                    Xem chi tiết 2 nhóm
                  </Button>
                </div>
              </div>

              {/* Tóm tắt 2 nhóm Business & People */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg border border-line bg-surface space-y-2">
                  <div className="font-semibold text-accent flex items-center justify-between">
                    <span>Business (Thành tựu công việc)</span>
                    <span className="text-[11px] text-ink-muted font-normal">{item.businessItems.length} mục</span>
                  </div>
                  <div className="space-y-1.5">
                    {item.businessItems.map((b) => (
                      <div key={b.id} className="text-[11px] text-ink-secondary flex items-start gap-1.5">
                        <span className="text-accent">•</span>
                        <span className="line-clamp-1 flex-1">{b.title}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-line bg-surface space-y-2">
                  <div className="font-semibold text-emerald-600 flex items-center justify-between">
                    <span>People (Thành tựu con người)</span>
                    <span className="text-[11px] text-ink-muted font-normal">{item.peopleItems.length} mục</span>
                  </div>
                  <div className="space-y-1.5">
                    {item.peopleItems.map((p) => (
                      <div key={p.id} className="text-[11px] text-ink-secondary flex items-start gap-1.5">
                        <span className="text-emerald-500">•</span>
                        <span className="line-clamp-1 flex-1">{p.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Nút thao tác nhanh của Quản lý */}
              {(item.status === 'SUBMITTED' || item.status === 'LOCKED') && (
                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-amber-600 border-amber-300 hover:bg-amber-50"
                    onClick={() => {
                      setSelectedItem(item);
                      setManagerComment(
                        item.status === 'LOCKED'
                          ? 'Mở lại để nhân viên bổ sung/cập nhật theo đợt review'
                          : 'Mở cho nhân viên bổ sung thêm mục tiêu phát sinh'
                      );
                      setFeedbackModal({ isOpen: true, action: 'REOPEN' });
                    }}
                  >
                    🔓 {item.status === 'LOCKED' ? 'Mở lại để nhân viên sửa' : 'Mở cho nhân viên sửa'}
                  </Button>
                  {item.status === 'SUBMITTED' && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-danger border-danger/40 hover:bg-danger-soft"
                        onClick={() => {
                          setSelectedItem(item);
                          setManagerComment('');
                          setFeedbackModal({ isOpen: true, action: 'RETURN' });
                        }}
                      >
                        ↩️ Trả lại kèm góp ý
                      </Button>
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => {
                          setSelectedItem(item);
                          setManagerComment('Đồng ý phê duyệt bộ mục tiêu OKR đầu năm');
                          setFeedbackModal({ isOpen: true, action: 'APPROVE' });
                        }}
                      >
                        ✅ Phê duyệt OKR
                      </Button>
                    </>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Modal Xem chi tiết 2 nhóm cạnh nhau */}
      <Modal
        isOpen={Boolean(selectedItem) && !feedbackModal.isOpen}
        onClose={() => setSelectedItem(null)}
        title={`Chi tiết OKR: ${selectedItem?.employeeName} (${selectedItem?.employeeCode})`}
        maxWidth="4xl"
      >
        {selectedItem && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Nhóm Business */}
              <div className="border border-line rounded-xl p-4 space-y-3 bg-surface">
                <div className="flex items-center justify-between border-b border-line pb-2">
                  <h3 className="font-bold text-sm text-accent flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-accent" />
                    Business (Mục tiêu công việc & Dự án)
                  </h3>
                  <Badge variant="ok">{selectedItem.businessItems.length} mục</Badge>
                </div>
                <div className="space-y-3">
                  {selectedItem.businessItems.map((b, idx) => (
                    <div key={b.id} className="p-3 bg-canvas rounded-lg border border-line text-xs space-y-1">
                      <div className="font-semibold text-ink">
                        {idx + 1}. {b.title}
                      </div>
                      {b.detail && <p className="text-ink-muted text-[11px]">{b.detail}</p>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Nhóm People */}
              <div className="border border-line rounded-xl p-4 space-y-3 bg-surface">
                <div className="flex items-center justify-between border-b border-line pb-2">
                  <h3 className="font-bold text-sm text-emerald-600 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    People (Mục tiêu con người & Đội ngũ)
                  </h3>
                  <Badge variant="ok">{selectedItem.peopleItems.length} mục</Badge>
                </div>
                <div className="space-y-3">
                  {selectedItem.peopleItems.map((p, idx) => (
                    <div key={p.id} className="p-3 bg-canvas rounded-lg border border-line text-xs space-y-1">
                      <div className="font-semibold text-ink">
                        {idx + 1}. {p.title}
                      </div>
                      {p.detail && <p className="text-ink-muted text-[11px]">{p.detail}</p>}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Định hướng & đề xuất của kỳ */}
            {(selectedItem.selfDirection || selectedItem.selfProposal || selectedItem.selfImprovementArea) && (
              <div className="p-3.5 bg-canvas rounded-xl border border-line text-xs space-y-2">
                {selectedItem.selfDirection && (
                  <div>
                    <span className="font-bold text-purple-600">Định hướng phát triển:</span>
                    <p className="text-ink-secondary">{selectedItem.selfDirection}</p>
                  </div>
                )}
                {selectedItem.selfProposal && (
                  <div>
                    <span className="font-bold text-purple-600">Đề xuất:</span>
                    <p className="text-ink-secondary">{selectedItem.selfProposal}</p>
                  </div>
                )}
                {selectedItem.selfImprovementArea && (
                  <div>
                    <span className="font-bold text-purple-600">Điểm cần cải thiện:</span>
                    <p className="text-ink-secondary">{selectedItem.selfImprovementArea}</p>
                  </div>
                )}
              </div>
            )}

            {/* Action footer */}
            <div className="flex justify-end gap-2 pt-3 border-t border-line">
              <Button variant="ghost" size="sm" onClick={() => setSelectedItem(null)}>
                Đóng
              </Button>
              {(selectedItem.status === 'SUBMITTED' || selectedItem.status === 'LOCKED') && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-amber-600 border-amber-300"
                    onClick={() => {
                      setManagerComment(
                        selectedItem.status === 'LOCKED'
                          ? 'Mở lại để nhân viên bổ sung/cập nhật theo đợt review'
                          : 'Mở cho nhân viên bổ sung thêm mục tiêu phát sinh'
                      );
                      setFeedbackModal({ isOpen: true, action: 'REOPEN' });
                    }}
                  >
                    🔓 {selectedItem.status === 'LOCKED' ? 'Mở lại để nhân viên sửa' : 'Mở cho nhân viên sửa'}
                  </Button>
                  {selectedItem.status === 'SUBMITTED' && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-danger border-danger/40"
                        onClick={() => {
                          setManagerComment('');
                          setFeedbackModal({ isOpen: true, action: 'RETURN' });
                        }}
                      >
                        ↩️ Trả lại kèm góp ý
                      </Button>
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => {
                          setManagerComment('Đồng ý phê duyệt bộ mục tiêu OKR đầu năm');
                          setFeedbackModal({ isOpen: true, action: 'APPROVE' });
                        }}
                      >
                        ✅ Phê duyệt OKR
                      </Button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Nhập góp ý / Xác nhận duyệt */}
      <Modal
        isOpen={feedbackModal.isOpen}
        onClose={() => setFeedbackModal({ isOpen: false, action: 'APPROVE' })}
        title={
          feedbackModal.action === 'APPROVE'
            ? 'Xác nhận phê duyệt OKR'
            : feedbackModal.action === 'RETURN'
            ? 'Trả lại yêu cầu chỉnh sửa kèm góp ý'
            : 'Mở lại quyền chỉnh sửa cho nhân viên'
        }
      >
        <div className="space-y-4">
          <p className="text-xs text-ink">
            Nhân viên: <b>{selectedItem?.employeeName} ({selectedItem?.employeeCode})</b>
          </p>

          <div>
            <label className="block text-xs font-semibold text-ink mb-1">
              {feedbackModal.action === 'RETURN' ? (
                <>
                  Góp ý điều chỉnh <span className="text-danger">* (Bắt buộc theo quy định)</span>:
                </>
              ) : (
                'Nhận xét / Ghi chú của Quản lý:'
              )}
            </label>
            <textarea
              rows={3}
              required={feedbackModal.action === 'RETURN'}
              className="w-full border border-line rounded-lg p-2.5 text-xs bg-canvas focus:outline-none focus:border-accent"
              placeholder={
                feedbackModal.action === 'RETURN'
                  ? 'Ví dụ: Cần bổ sung thêm chỉ số đo lường cho mục tiêu thứ 2...'
                  : 'Ghi chú cho nhân viên...'
              }
              value={managerComment}
              onChange={(e) => setManagerComment(e.target.value)}
            />
          </div>

          {actionError && (
            <div
              role="alert"
              className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs font-semibold text-danger"
            >
              {actionError}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-line">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setFeedbackModal({ isOpen: false, action: 'APPROVE' })}
            >
              Huỷ
            </Button>
            <Button
              type="button"
              variant={feedbackModal.action === 'RETURN' ? 'danger' : 'primary'}
              size="sm"
              disabled={feedbackModal.action === 'RETURN' && !managerComment.trim()}
              onClick={() => handleAction(feedbackModal.action)}
            >
              {feedbackModal.action === 'APPROVE'
                ? 'Xác nhận duyệt'
                : feedbackModal.action === 'RETURN'
                ? 'Gửi trả lại'
                : 'Mở quyền sửa'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
