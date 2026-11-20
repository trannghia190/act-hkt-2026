import React, { useState, useEffect } from 'react';
import { Card } from '../../../components/common/Card';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { Modal } from '../../../components/common/Modal';
import { useAuth } from '../../../context/AuthContext';
import { AttendanceRequestItem } from './requestStore';

export const RequestsPage: React.FC = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<AttendanceRequestItem[]>([]);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [leaveBalance, setLeaveBalance] = useState<any>(null);
  const [leaveUnit, setLeaveUnit] = useState<'DAY' | 'HALF_DAY'>('DAY');
  const [punchLogs, setPunchLogs] = useState<any[]>([]);
  const [repeatWeeks, setRepeatWeeks] = useState(1);
  const [holidays, setHolidays] = useState<string[]>([]);
  const [wfhLocation, setWfhLocation] = useState<'HOME' | 'OTHER'>('HOME');
  const [lateEarlyKind, setLateEarlyKind] = useState<'LATE' | 'EARLY'>('LATE');
  const [lateEarlyTime, setLateEarlyTime] = useState('08:45');

  useEffect(() => {
    const token = (() => { try { return JSON.parse(localStorage.getItem('pulse_auth_user') || '{}')?.accessToken; } catch { return ''; } })();
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    fetch('/api/v1/leave-types', { headers }).then(r => r.json()).then(j => { if (Array.isArray(j?.data)) setLeaveTypes(j.data); }).catch(() => undefined);
    fetch('/api/v1/leaves/my-balance', { headers }).then(r => r.json()).then(j => { if (j?.data) setLeaveBalance(j.data); }).catch(() => undefined);
    fetch('/api/v1/attendance/my-timesheet', { headers }).then(r => r.json()).then(j => { if (Array.isArray(j?.data)) setPunchLogs(j.data); }).catch(() => undefined);
    fetch('/api/v1/admin/holidays', { headers }).then(r => r.json()).then(j => { if (Array.isArray(j?.data)) setHolidays(j.data.map((h: any) => h.holidayDate)); }).catch(() => undefined);
  }, []);

  const [newReq, setNewReq] = useState({
    type: 'LEAVE' as 'LEAVE' | 'WFH' | 'LATE_EARLY' | 'ADJUST',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    duration: '1.0 ngày',
    leaveType: 'AL',
    reason: 'Việc cá nhân',
  });

  const authHeaders = (): Record<string, string> => {
    try { const u = JSON.parse(localStorage.getItem('pulse_auth_user') || '{}'); return u?.accessToken ? { Authorization: `Bearer ${u.accessToken}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' }; } catch { return { 'Content-Type': 'application/json' }; }
  };

  const mapRequest = (r: any): AttendanceRequestItem => {
    const typeNames: Record<string, string> = { LEAVE: 'Nghỉ phép', WFH: 'Làm việc từ xa (WFH)', LATE_EARLY: 'Đi muộn / về sớm', ADJUST: 'Bổ sung chấm công' };
    return {
      id: r.id,
      requesterCode: r.employeeCode || user?.employeeCode || '',
      requesterName: r.employeeName || user?.fullName || '',
      requesterEmail: user?.email || '',
      team: r.team || user?.team || '',
      type: r.requestType,
      typeName: r.leaveType ? `${typeNames[r.requestType] || r.requestType} — ${r.leaveType}` : (typeNames[r.requestType] || r.requestType),
      startDate: r.workDate || '',
      endDate: r.workDate || '',
      durationText: r.minutes ? `${r.minutes} phút` : '1.0 ngày',
      reason: r.reason || '',
      status: r.status === 'PENDING_APPROVAL' ? 'PENDING' : r.status,
      approver: r.decisionComment || '—',
      createdAt: r.createdAt ? new Date(r.createdAt).toLocaleString('vi-VN') : '',
      approverComment: r.decisionComment || undefined,
    } as AttendanceRequestItem;
  };

  const loadRequests = () => {
    fetch('/api/v1/requests/my-requests', { headers: authHeaders() })
      .then(r => r.json())
      .then(j => { if (Array.isArray(j?.data)) setRequests(j.data.map(mapRequest)); })
      .catch(() => undefined);
  };

  useEffect(loadRequests, []);

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3000);
  };

  const workingDays = (start: string, end: string): number => {
    if (!start || !end || end < start) return 0;
    const s = new Date(start + 'T00:00:00');
    const e = new Date(end + 'T00:00:00');
    let count = 0;
    for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
      const iso = d.toISOString().slice(0, 10);
      const day = d.getDay();
      if (day !== 0 && day !== 6 && !holidays.includes(iso)) count += 1;
    }
    return count;
  };

  const leaveDays = newReq.type === 'LEAVE' ? workingDays(newReq.startDate, newReq.endDate) : 0;

  // Đi muộn/về sớm: chỉ 1 ngày, chọn giờ vào/ra thực tế; số phút tính theo ca chuẩn 08:30–17:30.
  const SHIFT_START = '08:30';
  const SHIFT_END = '17:30';
  const toMinutes = (hhmm: string) => {
    const [h, m] = (hhmm || '').split(':').map(Number);
    return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : 0;
  };
  const lateEarlyMinutes = newReq.type === 'LATE_EARLY'
    ? (lateEarlyKind === 'LATE'
        ? toMinutes(lateEarlyTime) - toMinutes(SHIFT_START)
        : toMinutes(SHIFT_END) - toMinutes(lateEarlyTime))
    : 0;
  const lateEarlyValid = lateEarlyMinutes > 0 && lateEarlyMinutes <= 60;
  const lateEarlyDuration = `${lateEarlyKind === 'LATE' ? 'Đi muộn' : 'Về sớm'} ${lateEarlyMinutes} phút (${lateEarlyTime})`;

  const handleCreate = (e: React.FormEvent, asDraft = false) => {
    e.preventDefault();
    if (!newReq.reason.trim()) return;
    if (newReq.type === 'LATE_EARLY' && !lateEarlyValid) return;

    const leaveNames: Record<string, string> = { AL: 'Phép năm', S: 'Nghỉ ốm', NL: 'Nghỉ lễ tết', RO: 'Nghỉ bù', CL: 'Việc riêng có lương', ML: 'Thai sản', PL: 'Nghỉ khi có vợ sinh', UP: 'Không lương', HIEU: 'Hiếu hỉ', TANG: 'Tang gia' };
    const typeNames: Record<string, string> = {
      LEAVE: 'Nghỉ Phép',
      WFH: 'Làm Việc Từ Xa (WFH)',
      LATE_EARLY: 'Đi Muộn / Về Sớm',
      ADJUST: 'Bổ Sung Chấm Công'
    };

    // Routing rule: CA or Mobile team routes direct to HR
    const isDirectHR = user?.team?.includes('Mobile') || user?.team?.includes('CA');
    const approverName = isDirectHR
      ? 'Nguyễn Thị Thu Hà (HR Lead - Luồng Ngoại Lệ)'
      : user?.role === 'MANAGER'
      ? 'Nguyễn Thị Thu Hà (HR Lead)'
      : 'Nguyễn Thanh Tùng (Manager)';

    const newId = `REQ-2026-${String(Math.floor(1000 + Math.random() * 9000))}`;
    const nowStr = new Date().toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const item: AttendanceRequestItem = {
      id: newId,
      requesterCode: user?.employeeCode || 'ACT0142',
      requesterName: user?.fullName || 'Người Dùng',
      requesterEmail: user?.email || 'luan.vu@act-corp.internal',
      team: user?.team || 'Sirius Core',
      type: newReq.type,
      typeName: newReq.type === 'LEAVE' ? `Nghỉ phép — ${leaveNames[newReq.leaveType] || 'Phép năm'} (${leaveUnit === 'HALF_DAY' ? 'nửa ngày' : 'cả ngày'})` : typeNames[newReq.type],
      startDate: newReq.startDate,
      endDate: newReq.type === 'LATE_EARLY' ? newReq.startDate : newReq.endDate,
      durationText: newReq.type === 'LATE_EARLY' ? lateEarlyDuration : newReq.duration,
      reason: newReq.reason,
      status: 'PENDING',
      approver: approverName,
      createdAt: nowStr
    };

    const payload = JSON.stringify({
      duration: newReq.type === 'LEAVE' ? `${leaveDays} ngày làm việc`
        : newReq.type === 'LATE_EARLY' ? lateEarlyDuration : newReq.duration,
      unit: newReq.type === 'LEAVE' ? leaveUnit : undefined,
      urgent: false,
      location_allowed: wfhLocation === 'HOME',
      ...(newReq.type === 'LATE_EARLY' ? {
        late_early: lateEarlyKind,
        time: lateEarlyTime,
        shift_start: SHIFT_START,
        shift_end: SHIFT_END,
      } : {}),
    });
    const body = {
      type: newReq.type,
      leaveType: newReq.type === 'LEAVE' ? newReq.leaveType : undefined,
      payload,
      workDate: newReq.startDate,
      minutes: newReq.type === 'LATE_EARLY' ? lateEarlyMinutes : undefined,
      reason: newReq.reason,
      draft: asDraft,
    };
    const weeks = newReq.type === 'WFH' ? Math.max(1, Math.min(8, repeatWeeks)) : 1;
    (async () => {
      try {
        for (let i = 0; i < weeks; i += 1) {
          const d = new Date(newReq.startDate);
          d.setDate(d.getDate() + i * 7);
          const iso = d.toISOString().slice(0, 10);
          const res = await fetch('/api/v1/requests', {
            method: 'POST', headers: authHeaders(),
            body: JSON.stringify({ ...body, workDate: iso, payload: JSON.stringify({ ...JSON.parse(body.payload), repeat_week: i + 1 }) }),
          });
          const json = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(json?.message || 'Gửi đơn thất bại');
        }
        showToast(asDraft ? 'Đã lưu nháp — không trừ quota, quản lý chưa thấy' : (weeks > 1 ? `Đã gửi ${weeks} tuần WFH` : 'Đã gửi đơn thành công'));
        loadRequests();
      } catch (e: any) {
        showToast(e?.message || 'Gửi đơn thất bại');
      }
    })();
    setIsCreateOpen(false);
    setNewReq({
      type: 'LEAVE',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      duration: '1.0 ngày',
      leaveType: 'AL',
      reason: 'Việc cá nhân'
    });
    showToast(`Đã gửi đơn ${newId} thành công tới cấp phê duyệt`);
  };

  const handleCancelRequest = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn hủy đơn yêu cầu này?')) return;
    const res = await fetch(`/api/v1/requests/${id}/withdraw`, { method: 'POST', headers: authHeaders() });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { showToast(json?.message || 'Hủy đơn thất bại'); return; }
    showToast('Đã hủy đơn yêu cầu');
    loadRequests();
  };

  const handleSubmitDraft = async (id: string) => {
    const res = await fetch(`/api/v1/requests/${id}/submit`, { method: 'POST', headers: authHeaders() });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { showToast(json?.message || 'Gửi duyệt thất bại'); return; }
    showToast('Đã gửi đơn nháp tới quản lý');
    loadRequests();
  };

  // Gợi ý điền đơn từ log chấm công thật (không hiển thị mô tả nội bộ của task).
  const fmtDay = (iso: string) => {
    const [y, m, d] = (iso || '').split('-');
    return d && m ? `${d}/${m}` : '';
  };
  const timeOf = (iso: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };
  const lateMinutesOf = (log: any) => {
    if (!log?.checkInAt) return 0;
    const d = new Date(log.checkInAt);
    return Math.max(0, d.getHours() * 60 + d.getMinutes() - (8 * 60 + 30));
  };
  const missingCheckoutLog = punchLogs.find((l: any) => l.checkInAt && !l.checkOutAt);
  const lateLog = punchLogs.find((l: any) => lateMinutesOf(l) > 0);
  const anomalyCount = (missingCheckoutLog ? 1 : 0) + (lateLog ? 1 : 0);

  const handleAutoFillPunch = (kind: 'OUT' | 'LATE', log: any) => {
    const logDate = log?.workDate || '';
    if (kind === 'OUT') {
      setNewReq({
        type: 'ADJUST', startDate: logDate, endDate: logDate, duration: 'Bổ sung giờ ra', leaveType: 'AL',
        reason: `Quên chấm công ra ngày ${fmtDay(logDate)} — đề nghị bổ sung giờ ra theo log chấm công`,
      });
      showToast(`Đã điền sẵn đơn bổ sung giờ ra ngày ${fmtDay(logDate)}`);
    } else {
      const mins = lateMinutesOf(log);
      setLateEarlyKind('LATE');
      setLateEarlyTime(timeOf(log.checkInAt));
      setNewReq({
        type: 'ADJUST', startDate: logDate, endDate: logDate,
        duration: `Muộn ${mins} phút (${timeOf(log.checkInAt)})`, leaveType: 'AL',
        reason: `Đi muộn ${mins} phút ngày ${fmtDay(logDate)} — nhập lý do cụ thể`,
      });
      showToast(`Đã điền sẵn giải trình đi muộn ngày ${fmtDay(logDate)}`);
    }
    setIsCreateOpen(true);
  };

  // Filter requests
  const filtered = requests.filter(r => {
    if (filterType !== 'ALL' && r.type !== filterType) return false;
    if (filterStatus !== 'ALL' && r.status !== filterStatus) return false;
    if (searchKeyword.trim()) {
      const q = searchKeyword.toLowerCase();
      const match = r.id.toLowerCase().includes(q) ||
                    r.reason.toLowerCase().includes(q) ||
                    r.typeName.toLowerCase().includes(q) ||
                    r.approver.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

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
            <h1 className="text-xl font-bold tracking-tight text-ink">Đơn Của Tôi &amp; Đăng Ký Chấm Công</h1>
          </div>
          <p className="text-xs text-ink-muted mt-1">
            Theo dõi tiến độ xét duyệt đơn xin nghỉ, đăng ký làm từ xa (WFH tối đa 2 ngày/tuần), làm thêm giờ (OT) và giải trình quên chấm công
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="primary" size="sm" onClick={() => setIsCreateOpen(true)}>
            + Tạo Đơn Mới
          </Button>
        </div>
      </div>

      {anomalyCount > 0 && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-xs">
          <div className="flex items-start sm:items-center gap-2.5">
            <span className="text-lg">⚡</span>
            <div>
              <div className="font-semibold text-amber-900">
                Có {anomalyCount} ngày chấm công cần bổ sung đơn
              </div>
              <p className="text-[11px] text-amber-800 mt-0.5">
                Hệ thống đã đọc log chấm công của bạn và điền sẵn ngày, số phút — bạn chỉ cần kiểm tra lại rồi gửi.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {missingCheckoutLog && (
              <button
                type="button"
                onClick={() => handleAutoFillPunch('OUT', missingCheckoutLog)}
                className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] transition-colors cursor-pointer"
              >
                + Giờ ra {fmtDay(missingCheckoutLog.workDate)}
              </button>
            )}
            {lateLog && (
              <button
                type="button"
                onClick={() => handleAutoFillPunch('LATE', lateLog)}
                className="px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-[11px] transition-colors cursor-pointer"
              >
                + Đi muộn {lateMinutesOf(lateLog)}p {fmtDay(lateLog.workDate)}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-surface p-3 rounded-xl border border-line shadow-2xs">
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="text"
            placeholder="Tìm theo mã đơn, lý do..."
            value={searchKeyword}
            onChange={e => setSearchKeyword(e.target.value)}
            className="text-xs px-3 py-1.5 rounded-lg border border-line bg-canvas text-ink focus:outline-none focus:ring-1 focus:ring-accent"
          />

          <span className="text-xs text-ink-muted">Loại đơn:</span>
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-line bg-canvas text-ink"
          >
            <option value="ALL">Tất cả loại đơn</option>
            <option value="LEAVE">Nghỉ phép năm / ốm</option>
            <option value="WFH">Làm việc từ xa (WFH)</option>
            <option value="LATE_EARLY">Đi muộn / về sớm</option>
            <option value="ADJUST">Bổ sung chấm công</option>
          </select>

          <span className="text-xs text-ink-muted ml-1">Trạng thái:</span>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-line bg-canvas text-ink"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="PENDING">Chờ phê duyệt</option>
            <option value="APPROVED">Đã phê duyệt</option>
            <option value="REJECTED">Bị từ chối</option>
          </select>
        </div>

        <div className="text-xs text-ink-muted">
          <div className="text-[11px] text-ink-muted">
            Quota: đi muộn {requests.filter(r => r.type === 'LATE_EARLY' && r.status !== 'REJECTED').length}/2 · bổ sung {requests.filter(r => r.type === 'ADJUST' && r.status !== 'REJECTED').length}/5 · WFH đã gửi tuần này {requests.filter(r => r.type === 'WFH' && r.status === 'PENDING').length}/2
          </div>
          Tổng cộng: <strong className="text-ink">{filtered.length}</strong> đơn
        </div>
      </div>

      {/* Requests Table */}
      <div className="bg-surface rounded-xl border border-line shadow-2xs overflow-hidden">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-canvas border-b border-line text-ink-secondary font-medium">
              <th className="py-3 px-4">Mã Đơn</th>
              <th className="py-3 px-4">Loại Đơn Yêu Cầu</th>
              <th className="py-3 px-4">Thời Gian Áp Dụng</th>
              <th className="py-3 px-4">Thời Lượng</th>
              <th className="py-3 px-4">Lý Do</th>
              <th className="py-3 px-4">Người Phê Duyệt</th>
              <th className="py-3 px-4">Trạng Thái</th>
              <th className="py-3 px-4 text-right">Thao Tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-ink-muted">
                  Không có đơn yêu cầu nào phù hợp điều kiện lọc.
                </td>
              </tr>
            ) : (
              filtered.map(req => (
                <tr key={req.id} className="hover:bg-canvas/40 transition-colors">
                  <td className="py-3 px-4 font-mono font-medium text-ink">{req.id}</td>
                  <td className="py-3 px-4">
                    <span className="font-semibold text-ink">{req.typeName}</span>
                    <div className="text-[10px] text-ink-muted">Gửi lúc: {req.createdAt}</div>
                  </td>
                  <td className="py-3 px-4 font-mono text-ink-secondary">
                    {req.startDate} {req.startDate !== req.endDate ? `→ ${req.endDate}` : ''}
                  </td>
                  <td className="py-3 px-4 font-medium text-ink">{req.durationText}</td>
                  <td className="py-3 px-4 text-ink-secondary max-w-xs">
                    <div>{req.reason}</div>
                    {req.approverComment && (
                      <div className="text-[11px] text-accent mt-0.5 font-medium">
                        💬 Phản hồi: {req.approverComment}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4 text-ink-secondary">{req.approver}</td>
                  <td className="py-3 px-4">
                    {req.status === 'DRAFT' && <Badge variant="gray">Nháp — chưa gửi</Badge>}
                    {req.status === 'PENDING' && <Badge variant="warn">Chờ duyệt</Badge>}
                    {req.status === 'APPROVED' && <Badge variant="ok">Đã duyệt</Badge>}
                    {req.status === 'REJECTED' && <Badge variant="danger">Bị từ chối</Badge>}
                    {req.status === 'WITHDRAWN' && <Badge variant="gray">Đã hủy</Badge>}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {req.status === 'DRAFT' ? (
                      <div className="flex justify-end gap-1.5">
                        <Button variant="primary" size="sm" onClick={() => handleSubmitDraft(req.id)}>Gửi duyệt</Button>
                        <Button variant="ghost" size="sm" onClick={() => handleCancelRequest(req.id)} className="text-status-danger">Hủy</Button>
                      </div>
                    ) : req.status === 'PENDING' ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCancelRequest(req.id)}
                        className="text-status-danger"
                      >
                        Hủy đơn
                      </Button>
                    ) : req.status === 'REJECTED' ? (
                      <Button variant="outline" size="sm" onClick={() => {
                        setNewReq({ ...newReq, type: req.type as any, reason: req.reason, startDate: req.startDate || newReq.startDate, endDate: req.endDate || newReq.endDate });
                        setIsCreateOpen(true);
                      }}>Sửa & gửi lại</Button>
                    ) : (
                      <span className="text-ink-muted text-[11px]">Đã xử lý</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Tạo Đơn Yêu Cầu Mới"
        maxWidth="md"
      >
        <form onSubmit={handleCreate} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-ink mb-1">Loại Đơn Yêu Cầu</label>
            <select
              value={newReq.type}
              onChange={e => setNewReq({ ...newReq, type: e.target.value as any })}
              className="w-full p-2 border border-line rounded-lg bg-surface font-medium text-ink"
            >
              <option value="LATE_EARLY">🕘 Đi Muộn / Về Sớm (≤ 60 phút)</option>
              <option value="LEAVE">🌴 Nghỉ Phép (8 loại nghỉ)</option>
              <option value="WFH">🏡 Làm Việc Từ Xa (WFH - Tối đa 2 ngày/tuần)</option>
              <option value="ADJUST">⏱️ Bổ Sung Chấm Công (hạn 3 ngày)</option>
            </select>
            {newReq.type === 'LEAVE' && (
              <div className="mt-2">
                <label className="block font-medium text-ink mb-1">Loại nghỉ</label>
                <select
                  value={newReq.leaveType}
                  onChange={e => setNewReq({ ...newReq, leaveType: e.target.value })}
                  className="w-full p-2 border border-line rounded-lg bg-surface text-ink"
                >
                  {leaveTypes.length === 0 && <option value="AL">Phép năm (AL)</option>}
                  {leaveTypes.map((lt: any) => (
                    <option key={lt.code} value={lt.code}>
                      {lt.name} ({lt.code}){lt.requiresAttachment ? ' · cần giấy tờ' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {newReq.type === 'LEAVE' && (
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <label className="font-medium">Đơn vị
                  <select className="mt-1 w-full p-2 border border-line rounded-lg bg-surface" value={leaveUnit}
                    onChange={e => setLeaveUnit(e.target.value as 'DAY' | 'HALF_DAY')}>
                    <option value="DAY">Cả ngày</option>
                    <option value="HALF_DAY">Nửa ngày</option>
                  </select>
                </label>
                <div className="p-2 rounded-lg bg-accent-soft/40 border border-accent/30 text-accent-dark">
                  Số dư phép còn lại: <b>{leaveBalance ? Number(leaveBalance.remaining || 0) : '—'} ngày</b>
                  <div className="text-[10px] mt-0.5">Hạn gửi: {leaveTypes.find((lt: any) => lt.code === newReq.leaveType)?.submitWithinDays ?? 3} ngày · duyệt1 cấp bởi quản lý</div>
                  <div className="text-[10px] mt-0.5">Số ngày làm việc (trừ cuối tuần + lễ): <b>{leaveDays}</b></div>
                </div>
              </div>
            )}
          </div>

          {newReq.type === 'WFH' && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-900 text-[11px] leading-relaxed space-y-2">
              <div><strong>Quy chế WFH:</strong> tối đa <strong>2 ngày WFH / tuần</strong>; phải đăng ký trước ít nhất1 ngày làm việc.</div>
              <label className="block text-[11px]">
                Địa điểm WFH
                <select className="mt-1 w-full border border-blue-200 rounded p-1" value={wfhLocation} onChange={e => setWfhLocation(e.target.value as 'HOME' | 'OTHER')}>
                  <option value="HOME">Nhà riêng — được phép</option>
                  <option value="OTHER">Địa điểm khác — bị cấm</option>
                </select>
              </label>
              {wfhLocation === 'OTHER' && <div className="text-rose-700 font-semibold">Địa điểm này bị cấm WFH — không thể gửi đơn.</div>}
              <label className="flex items-center gap-2 text-[11px]">
                Lặp hàng tuần trong
                <input type="number" min={1} max={8} className="w-16 border border-blue-200 rounded p-1" value={repeatWeeks} onChange={e => setRepeatWeeks(Number(e.target.value) || 1)} />
                tuần (lẻ hoặc lịch cố định)
              </label>
            </div>
          )}

          {newReq.type === 'ADJUST' && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-[11px] leading-relaxed">
              <strong>Hạn nộp:</strong> Bổ sung chấm công phải gửi trong vòng <strong>3 ngày</strong> kể từ ngày quên chấm (tính theo ngày, không theo giờ).
            </div>
          )}

          {newReq.type === 'ADJUST' && (() => {
            const d = new Date(newReq.startDate + 'T00:00:00');
            const deadline = new Date(d); deadline.setDate(deadline.getDate() + 3);
            const limit = new Date(); limit.setDate(limit.getDate() - 3);
            const overdue = d < limit;
            return (
              <div className={`p-2 rounded text-[11px] ${overdue ? 'bg-rose-50 border border-rose-200 text-rose-700' : 'bg-canvas border border-line text-ink-secondary'}`}>
                Hạn nộp: <b>{deadline.toLocaleDateString('vi-VN')}</b> (3 ngày sau ngày quên chấm)
                {overdue && ' · ⚠️ Đã quá hạn — đơn sẽ bị gắn cờ "nộp trễ", cần lý do rõ ràng'}
              </div>
            );
          })()}

          {newReq.type === 'LATE_EARLY' ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-ink mb-1">Ngày</label>
                  <input
                    type="date"
                    required
                    value={newReq.startDate}
                    onChange={e => setNewReq({ ...newReq, startDate: e.target.value })}
                    className="w-full p-2 border border-line rounded-lg bg-surface text-ink font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-ink mb-1">Hình thức</label>
                  <select
                    value={lateEarlyKind}
                    onChange={e => {
                      const kind = e.target.value as 'LATE' | 'EARLY';
                      setLateEarlyKind(kind);
                      setLateEarlyTime(kind === 'LATE' ? '08:45' : '17:15');
                    }}
                    className="w-full p-2 border border-line rounded-lg bg-surface text-ink"
                  >
                    <option value="LATE">Đi muộn — cập nhật giờ vào</option>
                    <option value="EARLY">Về sớm — cập nhật giờ ra</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-ink mb-1">
                    {lateEarlyKind === 'LATE' ? 'Giờ vào thực tế' : 'Giờ ra thực tế'}
                  </label>
                  <input
                    type="time"
                    required
                    value={lateEarlyTime}
                    onChange={e => setLateEarlyTime(e.target.value)}
                    className="w-full p-2 border border-line rounded-lg bg-surface text-ink font-mono"
                  />
                </div>
                <div className={`p-2 rounded-lg border text-[11px] ${
                  lateEarlyValid ? 'bg-accent-soft/40 border-accent/30 text-accent-dark' : 'bg-rose-50 border-rose-200 text-rose-700'
                }`}>
                  Ca chuẩn <b>{SHIFT_START}–{SHIFT_END}</b>
                  <div className="mt-0.5">
                    {lateEarlyMinutes > 0 && lateEarlyMinutes <= 60
                      ? <>Tính <b>{lateEarlyMinutes} phút</b> {lateEarlyKind === 'LATE' ? 'đi muộn' : 'về sớm'} — sẽ cập nhật vào bảng công sau khi duyệt.</>
                      : <>Giờ đã chọn không tạo ra thời gian {lateEarlyKind === 'LATE' ? 'đi muộn' : 'về sớm'} hợp lệ (tối đa 60 phút).</>}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-ink mb-1">Từ Ngày</label>
                  <input
                    type="date"
                    required
                    value={newReq.startDate}
                    onChange={e => setNewReq({ ...newReq, startDate: e.target.value })}
                    className="w-full p-2 border border-line rounded-lg bg-surface text-ink font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-ink mb-1">Đến Ngày</label>
                  <input
                    type="date"
                    required
                    value={newReq.endDate}
                    onChange={e => setNewReq({ ...newReq, endDate: e.target.value })}
                    className="w-full p-2 border border-line rounded-lg bg-surface text-ink font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-ink mb-1">Số Lượng / Thời Lượng</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: 1.0 ngày hoặc 3.5 giờ OT"
                  value={newReq.duration}
                  onChange={e => setNewReq({ ...newReq, duration: e.target.value })}
                  className="w-full p-2 border border-line rounded-lg bg-surface text-ink"
                />
              </div>
            </>
          )}

          <div>
            <label className="block font-medium text-ink mb-1">Lý Do Chi Tiết &amp; Minh Chứng</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {(newReq.type === 'ADJUST'
                ? ['Việc cá nhân', 'Quên chấm công', 'Lỗi thiết bị', 'Mất kết nối mạng']
                : newReq.type === 'WFH'
                ? ['Việc cá nhân', 'Cần tập trung công việc', 'Nhà có việc', 'Họp online']
                : ['Việc cá nhân', 'Kẹt xe', 'Họp khách hàng', 'Sự cố máy móc', 'Việc gia đình']
              ).map((r) => (
                <button key={r} type="button" onClick={() => setNewReq({ ...newReq, reason: r })}
                  className={`text-[11px] px-2 py-1 rounded-full border ${newReq.reason === r ? 'bg-accent text-white border-accent' : 'bg-surface border-line text-ink-secondary'}`}>
                  {r}
                </button>
              ))}
            </div>
            <textarea
              rows={3}
              required
              placeholder="Nhập lý do cụ thể và thông tin bàn giao công việc..."
              value={newReq.reason}
              onChange={e => setNewReq({ ...newReq, reason: e.target.value })}
              className="w-full p-2 border border-line rounded-lg bg-surface text-ink"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-line">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsCreateOpen(false)}>
              Hủy
            </Button>
            <Button variant="outline" size="sm" type="button" onClick={(ev) => handleCreate(ev as any, true)}>
              Lưu nháp
            </Button>
            <Button variant="primary" size="sm" type="submit" disabled={(newReq.type === 'LEAVE' && leaveDays <= 0) || (newReq.type === 'WFH' && wfhLocation === 'OTHER') || (newReq.type === 'LATE_EARLY' && !lateEarlyValid)}>
              Gửi Đơn Phê Duyệt
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
