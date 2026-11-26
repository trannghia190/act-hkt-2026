import React, { useState, useEffect } from 'react';
import { Card } from '../../../components/common/Card';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { Modal } from '../../../components/common/Modal';
import { useAuth } from '../../../context/AuthContext';
import { Link } from 'react-router-dom';
import { AttendanceRequestItem } from '../requests/requestStore';
import {
  Check,
  Clock,
  Inbox,
  MessageSquare,
  Paperclip,
  RefreshCw,
  Search,
} from 'lucide-react';

export const ApprovalsPage: React.FC = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<AttendanceRequestItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [filterDate, setFilterDate] = useState('');
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

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
      team: r.team || '', type: r.requestType, typeName: r.leaveTypeName ? `${typeNames[r.requestType] || r.requestType} — ${r.leaveTypeName}` : (typeNames[r.requestType] || r.requestType),
      startDate: r.workDate || '', endDate: r.endDate || r.workDate || '', durationText: (() => {
        try {
          const p = JSON.parse(r.payload || '{}');
          // Đơn chuyển từ khiếu nại: hiện đúng thứ nhân viên đề nghị (giờ vào/ra) để quản lý biết đang duyệt gì.
          if (p.requested_check_in || p.requested_check_out) {
            const from = p.requested_check_in || '—';
            const to = p.requested_check_out || '—';
            return `${from} → ${to}${r.requestType === 'ADJUST' ? ' (giờ đề xuất)' : ''}`;
          }
          if (p.half_day_period) {
            return `0.5 ngày — nghỉ ${p.half_day_period === 'MORNING' ? 'sáng' : 'chiều'}`
              + (p.work_window_start && p.work_window_end ? ` (làm ${p.work_window_start}–${p.work_window_end})` : '');
          }
        } catch { /* ignore */ }
        return r.minutes ? `${r.minutes} phút` : '1.0 ngày';
      })(),
      reason: r.reason || '', status: r.status === 'PENDING_APPROVAL' ? 'PENDING' : r.status,
      approver: '—', createdAt: r.createdAt ? new Date(r.createdAt).toLocaleString('vi-VN') : '',
      approverComment: r.decisionComment || undefined,
      attachmentCount: Number(r.attachmentCount || 0),
      selfRequest: Boolean(r.selfRequest),
    } as AttendanceRequestItem;
  };
  const loadInbox = () => {
    setRefreshing(true);
    Promise.all([
      fetch('/api/v1/requests/inbox', { headers: authOnly() }).then(r => r.json()).catch(() => ({ data: [] })),
      fetch('/api/v1/requests/history', { headers: authOnly() }).then(r => r.json()).catch(() => ({ data: [] })),
    ]).then(([pendingJson, historyJson]) => {
      const merged: any[] = [];
      const seen = new Set<string>();
      [...(Array.isArray(pendingJson?.data) ? pendingJson.data : []),
       ...(Array.isArray(historyJson?.data) ? historyJson.data : [])].forEach((r: any) => {
        if (!r?.id || seen.has(r.id)) return;
        seen.add(r.id);
        merged.push(r);
      });
      setRequests(merged.map(mapRequest));
    }).catch(() => undefined).finally(() => setRefreshing(false));
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
        <div className="fixed top-16 right-6 z-[100] flex items-center gap-2 rounded-lg bg-status-ok px-4 py-2.5 text-xs font-semibold text-on-ok shadow-lg animate-bounce">
          <Check className="h-3.5 w-3.5 shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Header — mockup `.phead` */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-accent-dark">
            <Inbox className="h-3.5 w-3.5" />
            Hộp thư duyệt của quản lý
          </div>
          <h1 className="mt-1.5 font-display text-xl font-extrabold tracking-tight text-ink sm:text-[23px]">
            Duyệt đơn
          </h1>
          <p className="mt-1 text-xs text-ink-muted">
            Nghỉ phép · WFH · đi muộn / về sớm · bổ sung chấm công
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {selectedIds.length > 0 && activeTab === 'PENDING' && (
            <Button variant="primary" size="md" onClick={handleBulkApprove}
              title={`Duyệt ${selectedIds.length} đơn đã chọn — chỉ ghi 1 dòng audit cho cả lô`}>
              <Check className="h-4 w-4" />
              Duyệt {selectedIds.length} đơn đã chọn
            </Button>
          )}
          <Button variant="outline" size="md" onClick={loadInbox} disabled={refreshing}
            title="Tải lại danh sách đơn từ server">
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Đang tải…' : 'Tải lại'}
          </Button>
        </div>
      </div>

      {/* Tabs — mockup `.seg` (segmented control 3 mục) */}
      <div
        role="group"
        aria-label="Trạng thái duyệt"
        className="grid max-w-[460px] grid-cols-3 gap-1 rounded-xl border border-line bg-canvas p-1"
      >
        {([
          { key: 'PENDING' as const, label: 'Chờ duyệt', cnt: pendingCount },
          { key: 'APPROVED' as const, label: 'Đã duyệt', cnt: approvedCount },
          { key: 'REJECTED' as const, label: 'Bị từ chối', cnt: rejectedCount },
        ]).map(t => {
          const active = activeTab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              aria-pressed={active}
              onClick={() => { setActiveTab(t.key); setSelectedIds([]); }}
              className={`flex h-[34px] cursor-pointer items-center justify-center gap-1.5 rounded-[9px] px-2 text-xs font-bold transition-colors ${
                active ? 'bg-ink text-canvas' : 'text-ink-muted hover:bg-surface/70 hover:text-ink'
              }`}
            >
              {t.label}
              <span className="font-mono text-[10.5px] opacity-65">{t.cnt}</span>
            </button>
          );
        })}
      </div>

      {/* Filter panel — mockup `.filters` */}
      <div className="rounded-[13px] border border-line bg-surface p-3 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex h-[34px] min-w-[220px] flex-1 items-center gap-2 rounded-[9px] border border-line bg-canvas px-2.5">
            <Search className="h-3.5 w-3.5 shrink-0 text-ink-muted" />
            <input
              type="text"
              placeholder="Tìm theo tên NV, mã đơn, lý do..."
              value={searchKeyword}
              onChange={e => setSearchKeyword(e.target.value)}
              className="w-full border-0 bg-transparent p-0 text-xs text-ink outline-none placeholder:text-ink-muted"
            />
          </label>

          <label className="inline-flex h-[34px] items-center gap-2 rounded-[9px] border border-line bg-canvas px-2.5">
            <span className="text-[11px] font-semibold text-ink-muted">Loại</span>
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="max-w-[150px] border-0 bg-transparent p-0 text-xs font-medium text-ink outline-none"
            >
              <option value="ALL">Tất cả loại</option>
              <option value="LEAVE">Nghỉ phép</option>
              <option value="WFH">WFH</option>
              <option value="LATE_EARLY">Đi muộn / về sớm</option>
              <option value="ADJUST">Bổ sung công</option>
            </select>
          </label>

          <label className="inline-flex h-[34px] items-center gap-2 rounded-[9px] border border-line bg-canvas px-2.5">
            <span className="text-[11px] font-semibold text-ink-muted">Ngày</span>
            <input
              type="date"
              value={filterDate}
              onChange={e => setFilterDate(e.target.value)}
              className="w-[112px] border-0 bg-transparent p-0 text-xs text-ink outline-none"
            />
          </label>
        </div>
      </div>

      {/* Danh sách đơn — mockup `.panel` (desktop bảng · mobile danh sách 2 dòng) */}
      <div className="overflow-hidden rounded-[13px] border border-line bg-surface shadow-2xs">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          <h2 className="text-[13.5px] font-bold tracking-[-0.01em] text-ink">
            {activeTab === 'PENDING' ? 'Đơn chờ duyệt' : activeTab === 'APPROVED' ? 'Đơn đã duyệt' : 'Đơn bị từ chối'}
          </h2>
          <span className="ml-auto font-mono text-[10.5px] text-ink-muted">
            {currentTabItems.length} / {requests.length}
          </span>
        </div>

        {/* Desktop: bảng */}
        <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[1120px] text-left border-collapse text-[11.5px]">
          <thead>
            <tr className="bg-canvas text-ink-secondary">
              {activeTab === 'PENDING' && (
                <th className="w-10 border-b border-line px-3 py-2.5">
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
              <th className="border-b border-line px-3 py-2.5 text-[9.5px] font-extrabold uppercase tracking-[0.07em] text-ink-muted">Mã Đơn</th>
              <th className="border-b border-line px-3 py-2.5 text-[9.5px] font-extrabold uppercase tracking-[0.07em] text-ink-muted">Nhân Viên</th>
              <th className="border-b border-line px-3 py-2.5 text-[9.5px] font-extrabold uppercase tracking-[0.07em] text-ink-muted">Loại Đơn</th>
              <th className="border-b border-line px-3 py-2.5 text-[9.5px] font-extrabold uppercase tracking-[0.07em] text-ink-muted">Thời Gian &amp; Thời Lượng</th>
              <th className="border-b border-line px-3 py-2.5 text-[9.5px] font-extrabold uppercase tracking-[0.07em] text-ink-muted">Điều Kiện</th>
              <th className="border-b border-line px-3 py-2.5 text-[9.5px] font-extrabold uppercase tracking-[0.07em] text-ink-muted">Lý Do Đề Xuất</th>
              <th className="border-b border-line px-3 py-2.5 text-[9.5px] font-extrabold uppercase tracking-[0.07em] text-ink-muted">Gửi Lúc</th>
              <th className="border-b border-line px-3 py-2.5 text-right text-[9.5px] font-extrabold uppercase tracking-[0.07em] text-ink-muted">Thao Tác</th>
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
                    <td className="w-10 px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(item.id)}
                        onChange={() => toggleSelect(item.id)}
                        aria-label={`Chọn đơn ${item.requesterName}`}
                      />
                    </td>
                  )}
                  <td className="px-3 py-2.5">
                    <Link to={`/attendance/requests/${item.id}`} className="font-mono font-medium text-ink hover:text-accent hover:underline" title="Xem chi tiết đơn">
                      {item.id.slice(0, 8)}
                    </Link>
                    {item.status === 'PENDING' && item.createdAt && Math.floor((Date.now() - new Date(item.createdAt).getTime()) / 86400000) >= 2 && (
                      <span className="ml-1.5 inline-flex items-center gap-1 rounded-md bg-status-danger-soft px-1.5 py-0.5 text-[10px] font-semibold text-status-danger">
                        <Clock className="h-2.5 w-2.5" />
                        Quá hạn
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="font-semibold text-ink">
                      {item.requesterName}
                      {item.selfRequest && (
                        <span className="ml-1.5 inline-block rounded-md bg-status-warn-soft px-1.5 py-0.5 align-middle text-[10px] font-medium text-status-warn">
                          Đơn của tôi — tự duyệt
                        </span>
                      )}
                    </div>
                    <div className="font-mono text-[10.5px] text-ink-muted">{item.requesterCode} · {item.team}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="block whitespace-normal font-semibold leading-snug text-accent-dark">{item.typeName}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="font-mono text-ink-secondary">{item.startDate} {item.startDate !== item.endDate ? `→ ${item.endDate}` : ''}</div>
                    <div className="text-[11px] font-medium text-ink">{item.durationText}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    {/* Chip ✅/❌ điều kiện hiện NGAY trên dòng — không phải mở mới thấy */}
                    <div className="flex flex-col gap-1 whitespace-nowrap text-[10.5px]">
                      <span className="inline-flex items-center gap-1 font-semibold text-status-ok">
                        <Check className="h-3 w-3 shrink-0" />
                        Trong quota
                      </span>
                      <span className="inline-flex items-center gap-1 font-semibold text-status-ok">
                        <Check className="h-3 w-3 shrink-0" />
                        Nộp đúng hạn
                      </span>
                    </div>
                  </td>
                  <td className="max-w-xs px-3 py-2.5 text-ink-secondary">
                    <div className="truncate">{item.reason}</div>
                    {!!item.attachmentCount && (
                      <Link to={`/attendance/requests/${item.id}`} className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-accent-dark">
                        <Paperclip className="h-3 w-3" />
                        {item.attachmentCount} giấy tờ đính kèm
                      </Link>
                    )}
                    {item.approverComment && (
                      <div className="mt-0.5 flex items-start gap-1 text-[11px] font-medium text-accent-dark">
                        <MessageSquare className="mt-px h-3 w-3 shrink-0" />
                        <span className="truncate">Ý kiến duyệt: {item.approverComment}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-ink-muted">{item.createdAt}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right">
                    <Link to={`/attendance/requests/${item.id}`}
                      className="mr-1 inline-flex h-7 items-center rounded-lg border border-line px-2 text-[11.5px] font-semibold text-accent-dark hover:bg-accent-soft">
                      Chi tiết
                    </Link>
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
                          Từ chối
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

        {/* Mobile: danh sách 2 dòng — NV + trạng thái · thời gian · chip điều kiện · thao tác */}
        <div className="flex flex-col gap-2 p-3 md:hidden">
          {currentTabItems.length === 0 ? (
            <p className="px-1 py-6 text-center text-[11.5px] text-ink-muted">
              Không có đơn nào trong mục này.
            </p>
          ) : (
            currentTabItems.map(item => (
              <div key={item.id} className="rounded-xl border border-line bg-surface p-3">
                <div className="flex items-start gap-2">
                  <span className="text-[12.5px] font-bold leading-snug text-ink">{item.requesterName}</span>
                  <span className="ml-auto flex shrink-0 items-center gap-1">
                    {item.status === 'PENDING' && item.createdAt
                      && Math.floor((Date.now() - new Date(item.createdAt).getTime()) / 86400000) >= 2 && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-status-danger-soft px-1.5 py-0.5 text-[10px] font-semibold text-status-danger">
                        <Clock className="h-2.5 w-2.5" />
                        Quá hạn
                      </span>
                    )}
                    {item.selfRequest && (
                      <span className="rounded-md bg-status-warn-soft px-1.5 py-0.5 text-[10px] font-medium text-status-warn">Tự duyệt</span>
                    )}
                    {item.status !== 'PENDING' && (
                      <Badge variant={item.status === 'APPROVED' ? 'ok' : 'danger'}>
                        {item.status === 'APPROVED' ? 'Đã duyệt' : 'Đã từ chối'}
                      </Badge>
                    )}
                  </span>
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-ink-secondary">
                  <span className="font-mono text-[10.5px] text-ink-muted">{item.startDate}</span>
                  <span className="font-semibold text-ink">{item.typeName}</span>
                  <span className="font-medium">{item.durationText}</span>
                </div>

                {/* Chip điều kiện ngay trên dòng */}
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px]">
                  <span className="inline-flex items-center gap-1 font-semibold text-status-ok">
                    <Check className="h-3 w-3 shrink-0" />
                    Trong quota
                  </span>
                  <span className="inline-flex items-center gap-1 font-semibold text-status-ok">
                    <Check className="h-3 w-3 shrink-0" />
                    Nộp đúng hạn
                  </span>
                  {!!item.attachmentCount && (
                    <span className="inline-flex items-center gap-1 font-medium text-accent-dark">
                      <Paperclip className="h-3 w-3 shrink-0" />
                      {item.attachmentCount} tệp
                    </span>
                  )}
                </div>

                <p className="mt-1.5 line-clamp-2 text-[11px] leading-relaxed text-ink-secondary">{item.reason}</p>

                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {item.status === 'PENDING' ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setRejectingItem(item); setRejectReason(''); }}
                      >
                        Từ chối
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => { setApprovingItem(item); setApproveComment('Đồng ý phê duyệt'); }}
                      >
                        Duyệt
                      </Button>
                    </>
                  ) : null}
                  <Link to={`/attendance/requests/${item.id}`}
                    className="ml-auto inline-flex h-7 items-center rounded-lg border border-line px-2.5 text-[11.5px] font-semibold text-accent-dark">
                    Chi tiết
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal Duyệt đơn */}
      {approvingItem && (
        <Modal
          isOpen={true}
          onClose={() => setApprovingItem(null)}
          title={`Phê duyệt đơn: ${approvingItem.id}`}
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
                Xác nhận phê duyệt
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
          title={`Từ chối đơn: ${rejectingItem.id}`}
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
                Xác nhận từ chối
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
