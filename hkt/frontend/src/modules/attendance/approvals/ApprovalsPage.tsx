import React, { useState, useEffect } from 'react';
import { Card } from '../../../components/common/Card';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { Modal } from '../../../components/common/Modal';
import { useAuth } from '../../../context/AuthContext';
import { AttendanceRequestItem } from '../requests/requestStore';

export const ApprovalsPage: React.FC = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<AttendanceRequestItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [filterDate, setFilterDate] = useState('');
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Reject modal state
  const [rejectingItem, setRejectingItem] = useState<AttendanceRequestItem | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Approve modal state with comment
  const [approvingItem, setApprovingItem] = useState<AttendanceRequestItem | null>(null);
  const [approveComment, setApproveComment] = useState('Đồng ý phê duyệt');

  const authHeaders = (): Record<string, string> => {
    try { const u = JSON.parse(localStorage.getItem('pulse_auth_user') || '{}'); return u?.accessToken ? { Authorization: `Bearer ${u.accessToken}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' }; } catch { return { 'Content-Type': 'application/json' }; }
  };
  const authOnly = (): Record<string, string> => {
    try { const u = JSON.parse(localStorage.getItem('pulse_auth_user') || '{}'); return u?.accessToken ? { Authorization: `Bearer ${u.accessToken}` } : {}; } catch { return {}; }
  };
  const mapRequest = (r: any): AttendanceRequestItem => {
    const typeNames: Record<string, string> = { LEAVE: 'Nghỉ phép', WFH: 'Làm việc từ xa (WFH)', LATE_EARLY: 'Đi muộn / về sớm', ADJUST: 'Bổ sung chấm công' };
    return {
      id: r.id, requesterCode: r.employeeCode || '', requesterName: r.employeeName || '', requesterEmail: r.employeeEmail || '',
      team: r.team || '', type: r.requestType, typeName: typeNames[r.requestType] || r.requestType,
      startDate: r.workDate || '', endDate: r.workDate || '', durationText: r.minutes ? `${r.minutes} phút` : '1.0 ngày',
      reason: r.reason || '', status: r.status === 'PENDING_APPROVAL' ? 'PENDING' : r.status,
      approver: '—', createdAt: r.createdAt ? new Date(r.createdAt).toLocaleString('vi-VN') : '',
      approverComment: r.decisionComment || undefined,
    } as AttendanceRequestItem;
  };
  const loadInbox = () => {
    fetch('/api/v1/requests/inbox', { headers: authOnly() })
      .then(r => r.json()).then(j => { if (Array.isArray(j?.data)) setRequests(j.data.map(mapRequest)); })
      .catch(() => undefined);
  };
  useEffect(loadInbox, []);

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3000);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]));
  };

  const handleBulkApprove = () => {
    const approverText = `${user?.fullName || 'Manager'} (${user?.role || 'MANAGER'})`;
    fetch('/api/v1/requests/bulk-approve', { method: 'POST', headers: authHeaders(), body: JSON.stringify(selectedIds) })
      .then(r => r.json()).then(j => { if (!j?.success) throw new Error(j?.message); showToast(`Đã duyệt ${selectedIds.length} đơn`); loadInbox(); })
      .catch(e => showToast(e?.message || 'Duyệt hàng loạt thất bại'));
    setSelectedIds([]);
    showToast(`Đã duyệt thành công ${selectedIds.length} đơn yêu cầu`);
  };

  const handleSingleApprove = () => {
    if (!approvingItem) return;
    const approverText = `${user?.fullName || 'Manager'} (${user?.role || 'MANAGER'})`;
    const comment = approveComment.trim() || 'Đồng ý phê duyệt';

    // Dispatch real email notification via Gmail SMTP
    fetch('/api/v1/auth/send-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toEmail: approvingItem.requesterEmail,
        fullName: approvingItem.requesterName,
        requestId: approvingItem.id,
        requestType: approvingItem.typeName,
        decision: 'APPROVED',
        approverName: approverText,
        approverComment: comment
      })
    }).catch(err => console.log('Notification sent background:', err));

    fetch(`/api/v1/requests/${approvingItem.id}/approve`, { method: 'POST', headers: authHeaders() })
      .then(r => r.json()).then(j => { if (!j?.success) throw new Error(j?.message); showToast(`Đã duyệt đơn ${approvingItem.id}`); loadInbox(); })
      .catch(e => showToast(e?.message || 'Duyệt đơn thất bại'));
    setApprovingItem(null);
  };

  const handleSingleReject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingItem) return;
    const approverText = `${user?.fullName || 'Manager'} (${user?.role || 'MANAGER'})`;
    const comment = rejectReason.trim() || 'Từ chối phê duyệt theo quy chế';

    // Dispatch real email notification via Gmail SMTP
    fetch('/api/v1/auth/send-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toEmail: rejectingItem.requesterEmail,
        fullName: rejectingItem.requesterName,
        requestId: rejectingItem.id,
        requestType: rejectingItem.typeName,
        decision: 'REJECTED',
        approverName: approverText,
        approverComment: comment
      })
    }).catch(err => console.log('Notification sent background:', err));

    fetch(`/api/v1/requests/${rejectingItem.id}/reject`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ comment }) })
      .then(r => r.json()).then(j => { if (!j?.success) throw new Error(j?.message); showToast(`Đã từ chối đơn ${rejectingItem.id}`); loadInbox(); })
      .catch(e => showToast(e?.message || 'Từ chối thất bại'));
    setRejectingItem(null);
    setRejectReason('');
  };

  const currentTabItems = requests
    .filter(r => r.status === activeTab)
    .filter(r => filterType === 'ALL' || r.type === filterType)
    .filter(r => !filterDate || (r.startDate || '').includes(filterDate))
    .filter(r => {
      if (!searchKeyword.trim()) return true;
      const q = searchKeyword.toLowerCase();
      return (
        r.id.toLowerCase().includes(q) ||
        r.requesterName.toLowerCase().includes(q) ||
        r.requesterCode.toLowerCase().includes(q) ||
        r.team.toLowerCase().includes(q) ||
        r.reason.toLowerCase().includes(q)
      );
    });
  const pendingCount = requests.filter(r => r.status === 'PENDING').length;
  const approvedCount = requests.filter(r => r.status === 'APPROVED').length;
  const rejectedCount = requests.filter(r => r.status === 'REJECTED').length;

  return (
    <div className="space-y-6">
      {/* Toast */}
      {successToast && (
        <div className="fixed top-16 right-6 z-50 bg-emerald-700 text-white px-4 py-2.5 rounded-lg shadow-lg text-xs font-semibold flex items-center gap-2 animate-bounce">
          <span>✓</span>
          <span>{successToast}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-ink">Phê Duyệt Đơn Nhóm (Manager Approvals)</h1>
            <Badge variant="accent">S12</Badge>
          </div>
          <p className="text-xs text-ink-muted mt-1">
            Duyệt hàng loạt đơn xin nghỉ phép, làm từ xa (WFH), làm thêm giờ (OT) và giải trình vi phạm của nhân viên cấp dưới
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && activeTab === 'PENDING' && (
            <Button variant="primary" size="sm" onClick={handleBulkApprove}>
              ✓ Phê Duyệt Hàng Loạt ({selectedIds.length} Đơn)
            </Button>
          )}
        </div>
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setActiveTab('PENDING');
              setSelectedIds([]);
            }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'PENDING'
                ? 'bg-amber-100/70 text-amber-900 border border-amber-300'
                : 'text-ink-secondary hover:text-ink'
            }`}
          >
            <span>⏳ Chờ Phê Duyệt</span>
            <span className="px-1.5 py-0.2 bg-amber-200 text-amber-900 rounded-full text-[10px] font-bold">
              {pendingCount}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab('APPROVED');
              setSelectedIds([]);
            }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'APPROVED'
                ? 'bg-emerald-100/70 text-emerald-900 border border-emerald-300'
                : 'text-ink-secondary hover:text-ink'
            }`}
          >
            <span>✓ Đã Phê Duyệt</span>
            <span className="px-1.5 py-0.2 bg-emerald-200 text-emerald-900 rounded-full text-[10px] font-bold">
              {approvedCount}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab('REJECTED');
              setSelectedIds([]);
            }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'REJECTED'
                ? 'bg-rose-100/70 text-rose-900 border border-rose-300'
                : 'text-ink-secondary hover:text-ink'
            }`}
          >
            <span>✕ Bị Từ Chối</span>
            <span className="px-1.5 py-0.2 bg-rose-200 text-rose-900 rounded-full text-[10px] font-bold">
              {rejectedCount}
            </span>
          </button>
        </div>

        <div>
          <input
            type="text"
            placeholder="Tìm theo tên NV, mã đơn, lý do..."
            value={searchKeyword}
            onChange={e => setSearchKeyword(e.target.value)}
            className="text-xs px-3 py-1.5 rounded-lg border border-line bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-accent w-64"
          />
          <select value={filterType} onChange={e => setFilterType(e.target.value)} className="ml-2 text-xs px-2 py-1.5 rounded-lg border border-line bg-surface text-ink">
            <option value="ALL">Tất cả loại</option>
            <option value="LEAVE">Nghỉ phép</option>
            <option value="WFH">WFH</option>
            <option value="LATE_EARLY">Đi muộn / về sớm</option>
            <option value="ADJUST">Bổ sung công</option>
          </select>
          <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="ml-2 text-xs px-2 py-1.5 rounded-lg border border-line bg-surface text-ink" />
        </div>
      </div>

      {/* Approvals Table */}
      <div className="bg-surface rounded-xl border border-line shadow-2xs overflow-hidden">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-canvas border-b border-line text-ink-secondary font-medium">
              {activeTab === 'PENDING' && (
                <th className="py-3 px-4 w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === currentTabItems.length && currentTabItems.length > 0}
                    onChange={() =>
                      setSelectedIds(
                        selectedIds.length === currentTabItems.length ? [] : currentTabItems.map(i => i.id)
                      )
                    }
                  />
                </th>
              )}
              <th className="py-3 px-4">Mã Đơn</th>
              <th className="py-3 px-4">Nhân Viên</th>
              <th className="py-3 px-4">Loại Đơn</th>
              <th className="py-3 px-4">Thời Gian &amp; Thời Lượng</th>
              <th className="py-3 px-4">Điều Kiện</th>
              <th className="py-3 px-4">Lý Do Đề Xuất</th>
              <th className="py-3 px-4">Gửi Lúc</th>
              <th className="py-3 px-4 text-right">Thao Tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {currentTabItems.length === 0 ? (
              <tr>
                <td colSpan={activeTab === 'PENDING' ? 8 : 7} className="py-8 text-center text-ink-muted">
                  Không có đơn nào trong mục này.
                </td>
              </tr>
            ) : (
              currentTabItems.map(item => (
                <tr key={item.id} className="hover:bg-canvas/40 transition-colors">
                  {activeTab === 'PENDING' && (
                    <td className="py-3 px-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(item.id)}
                        onChange={() => toggleSelect(item.id)}
                      />
                    </td>
                  )}
                  <td className="py-3 px-4 font-mono font-medium text-ink">
                    {item.id}
                    {item.status === 'PENDING' && item.createdAt && Math.floor((Date.now() - new Date(item.createdAt).getTime()) / 86400000) >= 2 && (
                      <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">⏰ Quá hạn</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-ink">{item.requesterName}</div>
                    <div className="text-[11px] text-ink-muted font-mono">{item.requesterCode} · {item.team}</div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-semibold text-accent-dark">{item.typeName}</span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-mono text-ink-secondary">{item.startDate} {item.startDate !== item.endDate ? `→ ${item.endDate}` : ''}</div>
                    <div className="text-[11px] font-medium text-ink">{item.durationText}</div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex flex-col gap-1 text-[10px]">
                      <span className="text-emerald-700">✅ Trong quota</span>
                      <span className="text-emerald-700">✅ Nộp đúng hạn</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-ink-secondary max-w-xs">
                    <div>{item.reason}</div>
                    {item.approverComment && (
                      <div className="text-[11px] text-accent mt-0.5 font-medium">
                        💬 Ý kiến duyệt: {item.approverComment}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4 text-ink-muted font-mono">{item.createdAt}</td>
                  <td className="py-3 px-4 text-right space-x-1.5">
                    {item.status === 'PENDING' ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setRejectingItem(item);
                            setRejectReason('');
                          }}
                        >
                          Từ Chối
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => {
                            setApprovingItem(item);
                            setApproveComment('Đồng ý phê duyệt');
                          }}
                        >
                          Duyệt
                        </Button>
                      </>
                    ) : (
                      <Badge variant={item.status === 'APPROVED' ? 'ok' : 'danger'}>
                        {item.status === 'APPROVED' ? 'Đã duyệt' : 'Đã từ chối'}
                      </Badge>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Duyệt đơn */}
      {approvingItem && (
        <Modal
          isOpen={true}
          onClose={() => setApprovingItem(null)}
          title={`Phê Duyệt Đơn: ${approvingItem.id}`}
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-canvas rounded-lg space-y-1">
              <div>Nhân viên: <strong className="text-ink">{approvingItem.requesterName} ({approvingItem.requesterCode})</strong></div>
              <div>Loại đơn: <strong className="text-accent">{approvingItem.typeName}</strong></div>
              <div>Thời gian: <span className="font-mono">{approvingItem.startDate} ({approvingItem.durationText})</span></div>
              <div>Lý do: <em>{approvingItem.reason}</em></div>
            </div>

            <div>
              <label className="block text-ink-muted mb-1">Ghi chú hoặc lời dặn của Cấp duyệt</label>
              <input
                type="text"
                value={approveComment}
                onChange={e => setApproveComment(e.target.value)}
                placeholder="VD: Đồng ý duyệt, chú ý hoàn thành tiến độ"
                className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-ink"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <Button variant="outline" size="sm" onClick={() => setApprovingItem(null)}>
                Hủy
              </Button>
              <Button variant="primary" size="sm" onClick={handleSingleApprove}>
                Xác Nhận Phê Duyệt
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Từ chối đơn */}
      {rejectingItem && (
        <Modal
          isOpen={true}
          onClose={() => setRejectingItem(null)}
          title={`Từ Chối Đơn: ${rejectingItem.id}`}
        >
          <form onSubmit={handleSingleReject} className="space-y-4 text-xs">
            <div className="p-3 bg-canvas rounded-lg space-y-1">
              <div>Nhân viên: <strong className="text-ink">{rejectingItem.requesterName} ({rejectingItem.requesterCode})</strong></div>
              <div>Loại đơn: <strong className="text-status-danger">{rejectingItem.typeName}</strong></div>
              <div>Lý do đề xuất: <em>{rejectingItem.reason}</em></div>
            </div>

            <div>
              <label className="block text-ink-muted mb-1">Lý do từ chối (Bắt buộc để gửi thông báo cho nhân viên)</label>
              <textarea
                rows={3}
                required
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="VD: Tuần này team có lịch release lớn, đề nghị dời lịch sang tuần sau..."
                className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-ink"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <Button variant="outline" size="sm" type="button" onClick={() => setRejectingItem(null)}>
                Hủy
              </Button>
              <Button variant="outline" size="sm" type="submit" disabled={!rejectReason.trim()} className="text-status-danger border-status-danger hover:bg-status-danger/10">
                Xác Nhận Từ Chối
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
