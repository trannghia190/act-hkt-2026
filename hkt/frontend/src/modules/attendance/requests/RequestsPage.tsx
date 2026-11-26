import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Card } from '../../../components/common/Card';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { Modal } from '../../../components/common/Modal';
import { useAuth } from '../../../context/AuthContext';
import { AttendanceRequestItem } from './requestStore';

export const RequestsPage: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [requests, setRequests] = useState<AttendanceRequestItem[]>([]);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [page, setPage] = useState(0);
  const [pageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  const [quota, setQuota] = useState({ lateUsed: 0, lateMax: 2, adjustUsed: 0, adjustMax: 5, wfhWeekUsed: 0, wfhMax: 2 });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingAttachmentCount, setEditingAttachmentCount] = useState(0);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [leaveBalance, setLeaveBalance] = useState<any>(null);
  const [leaveUnit, setLeaveUnit] = useState<'DAY' | 'HALF_DAY'>('DAY');
  const [halfDayPeriod, setHalfDayPeriod] = useState<'MORNING' | 'AFTERNOON'>('MORNING');
  const [adjustKind, setAdjustKind] = useState<'IN' | 'OUT'>('OUT');
  const [adjustTime, setAdjustTime] = useState('17:30');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [punchLogs, setPunchLogs] = useState<any[]>([]);
  const [holidays, setHolidays] = useState<string[]>([]);
  const [lateEarlyKind, setLateEarlyKind] = useState<'LATE' | 'EARLY'>('LATE');
  const [lateEarlyTime, setLateEarlyTime] = useState('08:45');
  const [myShift, setMyShift] = useState<any>(null);
  const [rulesCfg, setRulesCfg] = useState<Record<string, any>>({});

  useEffect(() => {
    const token = (() => { try { return JSON.parse(localStorage.getItem('pulse_auth_user') || '{}')?.accessToken; } catch { return ''; } })();
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    fetch('/api/v1/leave-types', { headers }).then(r => r.json()).then(j => { if (Array.isArray(j?.data)) setLeaveTypes(j.data); }).catch(() => undefined);
    fetch('/api/v1/leaves/my-balance', { headers }).then(r => r.json()).then(j => { if (j?.data) setLeaveBalance(j.data); }).catch(() => undefined);
    fetch('/api/v1/attendance/my-timesheet', { headers }).then(r => r.json()).then(j => { if (Array.isArray(j?.data)) setPunchLogs(j.data); }).catch(() => undefined);
    fetch('/api/v1/admin/holidays', { headers }).then(r => r.json()).then(j => { if (Array.isArray(j?.data)) setHolidays(j.data.map((h: any) => h.holidayDate)); }).catch(() => undefined);
    fetch('/api/v1/rules', { headers }).then(r => r.json()).then(j => {
      const map: Record<string, any> = {};
      (j?.data || []).forEach((r: any) => { try { map[r.ruleKey] = JSON.parse(r.currentValue || '{}'); } catch { /* ignore */ } });
      setRulesCfg(map);
    }).catch(() => undefined);
    fetch('/api/v1/attendance/my-shift', { headers }).then(r => r.json()).then(j => {
      if (j?.data && j.data.code) {
        setMyShift(j.data);
        const inEnd = String(j.data.checkInEnd || '09:30').slice(0, 5);
        const [h, m] = inEnd.split(':').map(Number);
        const total = h * 60 + m + 15;
        setLateEarlyTime(`${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`);
      }
    }).catch(() => undefined);
  }, []);

  const [newReq, setNewReq] = useState({
    type: 'LEAVE' as 'LEAVE' | 'WFH' | 'LATE_EARLY' | 'ADJUST',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    duration: '1.0 ngày',
    leaveType: 'AL',
    reason: 'Việc cá nhân',
  });

  // Command Palette: mở sẵn form tạo đơn đúng loại (CORE-CMD-02).
  // Todo Inbox: /attendance/requests?create=ADJUST&date=YYYY-MM-DD mở form bổ sung công đúng ngày.
  useEffect(() => {
    const fromState = (location.state as { openCreate?: string } | null)?.openCreate;
    const params = new URLSearchParams(location.search);
    const fromQuery = params.get('create');
    const workDate = params.get('date');
    const openCreate = fromState || (['LEAVE', 'WFH', 'LATE_EARLY', 'ADJUST'].includes(fromQuery || '') ? fromQuery : null);
    if (!openCreate) return;
    if (openCreate === 'LEAVE' || openCreate === 'WFH' || openCreate === 'LATE_EARLY' || openCreate === 'ADJUST') {
      setEditingId(null);
      setEditingAttachmentCount(0);
      setAttachments([]);
      setNewReq(prev => ({
        ...prev,
        type: openCreate,
        startDate: workDate || prev.startDate,
        endDate: workDate || prev.endDate,
      }));
      setIsCreateOpen(true);
    }
    navigate(location.pathname, { replace: true, state: null });
  }, [location.state, location.pathname, location.search, navigate]);

  const authHeaders = (): Record<string, string> => {
    try { const u = JSON.parse(localStorage.getItem('pulse_auth_user') || '{}'); return u?.accessToken ? { Authorization: `Bearer ${u.accessToken}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' }; } catch { return { 'Content-Type': 'application/json' }; }
  };

  const fmtDate = (iso?: string) => {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-');
    return d && m && y ? `${d}/${m}/${y}` : iso;
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
      leaveType: r.leaveType,
      typeName: r.leaveType ? `${typeNames[r.requestType] || r.requestType} — ${r.leaveTypeName || r.leaveType}` : (typeNames[r.requestType] || r.requestType),
      startDate: r.workDate || '',
      endDate: r.endDate || r.workDate || '',
      durationText: (() => {
        try {
          const p = JSON.parse(r.payload || '{}');
          if (p.duration) return String(p.duration);
          if (p.half_day_period) return `0.5 ngày — buổi ${p.half_day_period === 'MORNING' ? 'sáng' : 'chiều'}`;
        } catch { /* ignore */ }
        return r.minutes ? `${r.minutes} phút` : '1.0 ngày';
      })(),
      reason: r.reason || '',
      status: r.status === 'PENDING_APPROVAL' ? 'PENDING' : r.status,
      approver: r.approverName || (r.decidedAt ? 'Quản lý đã xử lý' : '—'),
      payload: r.payload,
      minutes: r.minutes,
      attachmentCount: Number(r.attachmentCount || 0),
      createdAt: r.createdAt ? new Date(r.createdAt).toLocaleString('vi-VN') : '',
      approverComment: r.decisionComment || undefined,
    } as AttendanceRequestItem;
  };

  const loadQuota = () => {
    fetch('/api/v1/requests/my-quota', { headers: authHeaders() })
      .then(r => r.json())
      .then(j => { if (j?.data) setQuota(q => ({ ...q, ...j.data })); })
      .catch(() => undefined);
  };

  const loadRequests = () => {
    loadQuota();
    const params = new URLSearchParams({ page: String(page), size: String(pageSize) });
    if (filterType !== 'ALL') params.set('type', filterType);
    if (filterStatus !== 'ALL') params.set('status', filterStatus);
    if (searchKeyword.trim()) params.set('keyword', searchKeyword.trim());
    if (dateFrom) params.set('from', dateFrom);
    if (dateTo) params.set('to', dateTo);
    fetch(`/api/v1/requests/my-requests?${params.toString()}`, { headers: authHeaders() })
      .then(r => r.json())
      .then(j => {
        const d = j?.data;
        if (Array.isArray(d?.content)) {
          setRequests(d.content.map(mapRequest));
          setTotalPages(Math.max(1, Number(d.totalPages || 1)));
          setTotalElements(Number(d.totalElements || 0));
        } else if (Array.isArray(d)) {
          setRequests(d.map(mapRequest));
          setTotalPages(1);
          setTotalElements(d.length);
        }
      })
      .catch(() => undefined);
  };

  useEffect(() => {
    const timer = setTimeout(loadRequests, 250);
    return () => clearTimeout(timer);
  }, [page, filterType, filterStatus, searchKeyword, dateFrom, dateTo]);

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const workingDays = (start: string, end: string): number => {
    if (!start || !end || end < start) return 0;
    const s = new Date(start + 'T00:00:00');
    const e = new Date(end + 'T00:00:00');
    let count = 0;
    for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
      const iso = d.toLocaleDateString('en-CA');
      const day = d.getDay();
      if (day !== 0 && day !== 6 && !holidays.includes(iso)) count += 1;
    }
    return count;
  };

  const leaveDays = newReq.type === 'LEAVE' ? (leaveUnit === 'HALF_DAY' ? 0.5 : workingDays(newReq.startDate, newReq.endDate)) : 0;
  const wfhDaysCount = newReq.type === 'WFH'
    ? (leaveUnit === 'HALF_DAY' ? 0.5 : workingDays(newReq.startDate, newReq.endDate))
    : 0;
  const wfhWorkingDates = (start: string, end: string): string[] => {
    if (!start || !end || end < start) return [];
    const out: string[] = [];
    for (let d = new Date(start + 'T00:00:00'); d <= new Date(end + 'T00:00:00'); d.setDate(d.getDate() + 1)) {
      const iso = d.toLocaleDateString('en-CA');
      const day = d.getDay();
      if (day !== 0 && day !== 6 && !holidays.includes(iso)) out.push(iso);
    }
    return out;
  };

  // Hạn nộp & giới hạn ngày lấy từ cấu hình quy định hiện hành.
  const isoDaysFromToday = (offset: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toLocaleDateString('en-CA');
  };
  const lateSubmitDays = Number(rulesCfg?.late_early?.submit_within_days ?? 3);
  const lateMinutesMax = Number(rulesCfg?.late_early?.max_minutes ?? 60);
  const adjustDeadlineDays = Number(rulesCfg?.makeup?.deadline_working_days ?? 3);
  const selectedLeaveCfg = leaveTypes.find((lt: any) => lt.code === newReq.leaveType);
  const leaveNeedsAttachment = newReq.type === 'LEAVE' && Boolean(selectedLeaveCfg?.requiresAttachment);
  const leaveSubmitDays = Number(selectedLeaveCfg?.submitWithinDays ?? rulesCfg?.leave_type_defaults?.submit_within_days ?? 3);
  const wfhBackfillDays = Number(rulesCfg?.wfh?.submit_within_days ?? 3);
  // Quỹ phép năm: "remaining" là sổ phép; "availableForLeave" đã trừ ngày của đơn đang chờ duyệt.
  const leaveDeductsAnnual = newReq.type === 'LEAVE' && Boolean(selectedLeaveCfg?.deductsAnnualLeave);
  const leaveRemaining = leaveBalance ? Number(leaveBalance.remaining ?? 0) : null;
  const leaveAvailable = leaveBalance ? Number(leaveBalance.availableForLeave ?? leaveBalance.remaining ?? 0) : null;
  const pendingLeaveDays = leaveBalance ? Number(leaveBalance.pendingLeaveDays ?? 0) : 0;
  const leaveShortfall = leaveDeductsAnnual && leaveAvailable !== null && leaveDays > leaveAvailable;
  const leaveExhausted = leaveDeductsAnnual && leaveAvailable !== null && leaveAvailable <= 0;
  const minDateFor = (type: string) => {
    if (type === 'WFH') return isoDaysFromToday(-wfhBackfillDays);
    if (type === 'LATE_EARLY') return isoDaysFromToday(-lateSubmitDays);
    if (type === 'ADJUST') return isoDaysFromToday(-adjustDeadlineDays);
    return isoDaysFromToday(-leaveSubmitDays);
  };
  const minDateForSelected = minDateFor(newReq.type);
  const handleTypeChange = (type: 'LEAVE' | 'WFH' | 'LATE_EARLY' | 'ADJUST') => {
    const min = minDateFor(type);
    setNewReq(prev => {
      const start = prev.startDate < min ? min : prev.startDate;
      return { ...prev, type, startDate: start, endDate: start };
    });
  };

  // Đi muộn/về sớm: 1 ngày, chọn giờ vào/ra thực tế; số phút tính theo ca thật của nhân viên.
  const hhmm = (value?: string) => (value || '').slice(0, 5);
  const toMinutes = (hhmmValue: string) => {
    const [h, m] = (hhmmValue || '').split(':').map(Number);
    return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : 0;
  };
  const SHIFT_START = hhmm(myShift?.checkInStart) || '08:00';
  const SHIFT_IN_END = hhmm(myShift?.checkInEnd) || '09:30';
  const SHIFT_END = hhmm(myShift?.checkOutStart) || '17:00';
  const shiftStartLabel = hhmm(myShift?.checkInStart) || '08:00';
  const shiftInEnd = hhmm(myShift?.checkInEnd) || '09:30';
  const shiftOutStart = hhmm(myShift?.checkOutStart) || '17:00';
  const shiftOutEnd = hhmm(myShift?.checkOutEnd) || '18:30';
  const shiftHours = myShift?.requiredWorkHours ?? 8;
  const lunchStartLabel = hhmm(myShift?.lunchBreakStart) || '12:00';
  const lunchEndLabel = hhmm(myShift?.lunchBreakEnd) || '13:00';
  const halfDayWindow = leaveUnit === 'HALF_DAY'
    ? (halfDayPeriod === 'MORNING'
        ? { from: lunchEndLabel, to: shiftOutStart, text: `nghỉ sáng, làm việc ${lunchEndLabel}–${shiftOutStart}` }
        : { from: shiftStartLabel, to: lunchStartLabel, text: `nghỉ chiều, làm việc ${shiftStartLabel}–${lunchStartLabel}` })
    : null;
  const halfDayHours = halfDayWindow
    ? Math.round(((toMinutes(halfDayWindow.to) - toMinutes(halfDayWindow.from)) / 60) * 10) / 10
    : 0;
  const lateEarlyMinutes = newReq.type === 'LATE_EARLY'
    ? (lateEarlyKind === 'LATE'
        ? toMinutes(lateEarlyTime) - toMinutes(SHIFT_IN_END)
        : toMinutes(SHIFT_END) - toMinutes(lateEarlyTime))
    : 0;
  const lateEarlyValid = lateEarlyMinutes > 0 && lateEarlyMinutes <= lateMinutesMax;
  const lateEarlyDuration = `${lateEarlyKind === 'LATE' ? 'Đi muộn' : 'Về sớm'} ${lateEarlyMinutes} phút (${lateEarlyTime})`;
  const adjustDuration = `Bổ sung giờ ${adjustKind === 'IN' ? 'vào' : 'ra'} (${adjustTime})`;

  const handleCreate = async (e: React.FormEvent, asDraft = false) => {
    e.preventDefault();
    if (!newReq.reason.trim()) return;
    if (newReq.type === 'LATE_EARLY' && !lateEarlyValid) return;
    if (!asDraft && leaveShortfall) {
      showToast(leaveExhausted
        ? 'Đã hết ngày phép — không thể gửi đơn nghỉ phép năm tới quản lý'
        : `Không đủ ngày phép — đơn cần ${leaveDays} ngày, chỉ còn ${leaveAvailable} ngày khả dụng`,
        'error');
      return;
    }
    if (leaveNeedsAttachment && attachments.length === 0 && !(editingId && editingAttachmentCount > 0)) {
      showToast('Loại nghỉ này bắt buộc đính kèm giấy tờ trước khi gửi', 'error');
      return;
    }

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
      typeName: newReq.type === 'LEAVE'
        ? `Nghỉ phép — ${leaveNames[newReq.leaveType] || 'Phép năm'} (${leaveUnit === 'HALF_DAY' ? `nửa ngày, buổi ${halfDayPeriod === 'MORNING' ? 'sáng' : 'chiều'}` : 'cả ngày'})`
        : newReq.type === 'WFH'
        ? `Làm việc từ xa (WFH)${leaveUnit === 'HALF_DAY' ? ` (nửa ngày, buổi ${halfDayPeriod === 'MORNING' ? 'sáng' : 'chiều'})` : ''}`
        : typeNames[newReq.type],
      startDate: newReq.startDate,
      endDate: (newReq.type === 'LATE_EARLY' || newReq.type === 'WFH' || (newReq.type === 'LEAVE' && leaveUnit === 'HALF_DAY')) ? newReq.startDate : newReq.endDate,
      durationText: newReq.type === 'LATE_EARLY'
        ? lateEarlyDuration
        : newReq.type === 'LEAVE'
        ? (leaveUnit === 'HALF_DAY'
            ? `0.5 ngày — ${halfDayWindow?.text || 'nửa ngày'}`
            : `${leaveDays} ngày làm việc`)
        : newReq.type === 'WFH'
        ? (leaveUnit === 'HALF_DAY'
            ? `0.5 ngày — WFH buổi ${halfDayPeriod === 'MORNING' ? 'sáng' : 'chiều'}`
            : `${wfhDaysCount} ngày làm việc`)
        : newReq.type === 'ADJUST'
        ? adjustDuration
        : newReq.duration,
      reason: newReq.reason,
      status: 'PENDING',
      approver: approverName,
      createdAt: nowStr
    };

    const wfhHalf = newReq.type === 'WFH' && leaveUnit === 'HALF_DAY';
    const halfType = newReq.type === 'LEAVE' || newReq.type === 'WFH';
    const payload = JSON.stringify({
      duration: newReq.type === 'LEAVE'
        ? (leaveUnit === 'HALF_DAY' ? `0.5 ngày — ${halfDayWindow?.text || 'nửa ngày'}` : `${leaveDays} ngày làm việc`)
        : newReq.type === 'WFH'
        ? (wfhHalf ? `0.5 ngày — WFH buổi ${halfDayPeriod === 'MORNING' ? 'sáng' : 'chiều'}`
                   : `${wfhDaysCount} ngày làm việc`)
        : newReq.type === 'LATE_EARLY' ? lateEarlyDuration
        : newReq.type === 'ADJUST' ? adjustDuration : newReq.duration,
      unit: halfType ? leaveUnit : undefined,
      ...(halfType && leaveUnit === 'HALF_DAY' ? {
        half_day_period: halfDayPeriod,
        ...(newReq.type === 'LEAVE' ? {
          work_window_start: halfDayWindow?.from,
          work_window_end: halfDayWindow?.to,
        } : {}),
      } : {}),
      urgent: false,
      ...(newReq.type === 'LATE_EARLY' ? {
        late_early: lateEarlyKind,
        time: lateEarlyTime,
        shift_start: SHIFT_IN_END,
        shift_end: SHIFT_END,
      } : {}),
      ...(newReq.type === 'ADJUST' ? {
        adjust_kind: adjustKind,
        time: adjustTime,
      } : {}),
    });
    const body = {
      type: newReq.type,
      leaveType: newReq.type === 'LEAVE' ? newReq.leaveType : undefined,
      payload,
      workDate: newReq.startDate,
      endDate: (newReq.type === 'LEAVE' || (newReq.type === 'WFH' && leaveUnit === 'DAY')) ? newReq.endDate : newReq.startDate,
      minutes: newReq.type === 'LATE_EARLY' ? lateEarlyMinutes : undefined,
      reason: newReq.reason,
      draft: asDraft,
    };
    let replaceConflicts = false;
    if (!asDraft && (newReq.type === 'LEAVE' || newReq.type === 'WFH')) {
      try {
        const res = await fetch('/api/v1/requests/check-conflicts', {
          method: 'POST', headers: authHeaders(),
          body: JSON.stringify({
            type: newReq.type,
            workDate: newReq.startDate,
            endDate: newReq.type === 'LEAVE' ? newReq.endDate : newReq.endDate,
            payload,
            excludeId: editingId || undefined,
          }),
        });
        const json = await res.json().catch(() => ({}));
        const conflicts: any[] = Array.isArray(json?.data) ? json.data : [];
        if (conflicts.length > 0) {
          const lines = conflicts.map(c => {
            const range = c.workDate === c.endDate ? c.workDate : `${c.workDate} → ${c.endDate}`;
            const status = c.status === 'APPROVED' ? 'đã duyệt' : 'chờ duyệt';
            return `• ${c.typeName}${c.leaveTypeName ? ` (${c.leaveTypeName})` : ''} ${range} — ${status}`;
          }).join('\n');
          const ok = window.confirm(
            `Đơn mới trùng ngày với ${conflicts.length} đơn đã có:\n${lines}\n\nBạn có muốn HỦY đơn cũ và áp dụng đơn mới không?`
          );
          if (!ok) { showToast('Đã giữ đơn cũ — đơn mới chưa được tạo', 'error'); return; }
          replaceConflicts = true;
        }
      } catch { /* nếu kiểm tra lỗi, backend vẫn chặn và trả thông báo */ }
    }
    (body as any).replaceConflicts = replaceConflicts;

    // WFH là MỘT đơn cho cả khoảng ngày; quota theo tuần được backend kiểm tra theo số ngày làm việc.
    const sendDates = [newReq.startDate];
    (async () => {
      const createdIds: string[] = [];
      try {
        if (editingId) {
          const res = await fetch(`/api/v1/requests/${editingId}`, {
            method: 'PUT', headers: authHeaders(), body: JSON.stringify(body),
          });
          const json = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(json?.message || 'Cập nhật đơn thất bại');
          createdIds.push(editingId);
        } else {
          for (const iso of sendDates) {
            const res = await fetch('/api/v1/requests', {
              method: 'POST', headers: authHeaders(), body: JSON.stringify({ ...body, workDate: iso }),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json?.message || 'Gửi đơn thất bại');
            if (json?.data?.id) createdIds.push(json.data.id);
          }
        }
        let uploadFailed = false;
        for (const requestId of createdIds) {
          for (const file of attachments) {
            const fd = new FormData();
            fd.append('file', file);
            const tokenOnly = (() => {
              try {
                const u = JSON.parse(localStorage.getItem('pulse_auth_user') || '{}');
                return u?.accessToken ? { Authorization: `Bearer ${u.accessToken}` } : {};
              } catch { return {}; }
            })();
            const up = await fetch(`/api/v1/requests/${requestId}/attachments`, {
              method: 'POST', headers: tokenOnly, body: fd,
            });
            if (!up.ok) { uploadFailed = true; break; }
          }
          if (uploadFailed) break;
        }
        showToast(uploadFailed
          ? 'Đơn đã cập nhật nhưng tải giấy tờ thất bại — mở chi tiết đơn để đính kèm lại'
          : (editingId ? 'Đã cập nhật đơn và gửi lại quản lý'
              : (asDraft ? 'Đã lưu nháp — không trừ quota, quản lý chưa thấy'
                  : (sendDates.length > 1 ? `Đã gửi ${sendDates.length} ngày WFH` : 'Đã gửi đơn thành công'))),
          uploadFailed ? 'error' : 'success');
        if (!uploadFailed && !asDraft) {
          setTimeout(() => showToast('📨 Đã gửi thông báo tới quản lý trực tiếp', 'info'), 600);
        }
        loadRequests();
        // Đơn mới đang chờ duyệt giữ chỗ phép → nạp lại để cảnh báo "khả dụng" đúng.
        const balanceToken = (() => { try { return JSON.parse(localStorage.getItem('pulse_auth_user') || '{}')?.accessToken; } catch { return ''; } })();
        fetch('/api/v1/leaves/my-balance', { headers: balanceToken ? { Authorization: `Bearer ${balanceToken}` } : {} })
          .then(r => r.json()).then(j => { if (j?.data) setLeaveBalance(j.data); }).catch(() => undefined);
        setIsCreateOpen(false);
        setEditingId(null);
        setEditingAttachmentCount(0);
        setAttachments([]);
        setLeaveUnit('DAY');
        setHalfDayPeriod('MORNING');
        setNewReq({
          type: 'LEAVE',
          startDate: new Date().toISOString().split('T')[0],
          endDate: new Date().toISOString().split('T')[0],
          duration: '1.0 ngày',
          leaveType: 'AL',
          reason: 'Việc cá nhân'
        });
      } catch (e: any) {
        showToast(e?.message || 'Gửi đơn thất bại', 'error');
      }
    })();
  };

  const handleCancelRequest = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn hủy đơn yêu cầu này?')) return;
    const res = await fetch(`/api/v1/requests/${id}/withdraw`, { method: 'POST', headers: authHeaders() });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { showToast(json?.message || 'Hủy đơn thất bại', 'error'); return; }
    showToast('Đã hủy đơn yêu cầu');
    loadRequests();
  };

  const handleSubmitDraft = async (id: string) => {
    const res = await fetch(`/api/v1/requests/${id}/submit`, { method: 'POST', headers: authHeaders() });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { showToast(json?.message || 'Gửi duyệt thất bại', 'error'); return; }
    showToast('Đã gửi đơn nháp tới quản lý');
    loadRequests();
  };

  const openEditRequest = (req: AttendanceRequestItem) => {
    let p: any = {};
    try { p = JSON.parse(req.payload || '{}'); } catch { p = {}; }
    setEditingId(req.id);
    setEditingAttachmentCount(req.attachmentCount || 0);
    setAttachments([]);
    setLeaveUnit(p.unit === 'HALF_DAY' || p.half_day_period ? 'HALF_DAY' : 'DAY');
    setHalfDayPeriod(p.half_day_period === 'AFTERNOON' ? 'AFTERNOON' : 'MORNING');
    if (req.type === 'LATE_EARLY') {
      setLateEarlyKind(p.late_early === 'EARLY' ? 'EARLY' : 'LATE');
      if (p.time) setLateEarlyTime(String(p.time).slice(0, 5));
    }
    if (req.type === 'ADJUST') {
      setAdjustKind(p.adjust_kind === 'IN' ? 'IN' : 'OUT');
      if (p.time) setAdjustTime(String(p.time).slice(0, 5));
    }
    setNewReq({
      type: req.type as any,
      startDate: req.startDate,
      endDate: req.endDate || req.startDate,
      duration: p.duration || req.durationText || '1.0 ngày',
      leaveType: req.leaveType || 'AL',
      reason: req.reason,
    });
    setIsCreateOpen(true);
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
    return Math.max(0, d.getHours() * 60 + d.getMinutes() - toMinutes(SHIFT_IN_END));
  };
  const missingCheckoutLog = punchLogs.find((l: any) => l.checkInAt && !l.checkOutAt && l.workDate >= isoDaysFromToday(-adjustDeadlineDays));
  const lateLog = punchLogs.find((l: any) => lateMinutesOf(l) > 0 && l.workDate >= isoDaysFromToday(-lateSubmitDays));
  const anomalyCount = new Set([
    missingCheckoutLog?.workDate,
    lateLog?.workDate,
  ].filter(Boolean)).size;

  const handleAutoFillPunch = (kind: 'OUT' | 'LATE', log: any) => {
    const logDate = log?.workDate || '';
    if (kind === 'OUT') {
      setAdjustKind('OUT');
      setAdjustTime(SHIFT_END);
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
        type: 'LATE_EARLY', startDate: logDate, endDate: logDate,
        duration: `Muộn ${mins} phút (${timeOf(log.checkInAt)})`, leaveType: 'AL',
        reason: `Đi muộn ${mins} phút ngày ${fmtDay(logDate)} — nhập lý do cụ thể`,
      });
      showToast(`Đã điền sẵn giải trình đi muộn ngày ${fmtDay(logDate)}`);
    }
    setIsCreateOpen(true);
  };

  const filtered = requests;

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-16 right-6 z-[100] px-4 py-2.5 rounded-lg shadow-xl text-xs font-semibold flex items-start gap-2 max-w-sm ${
          toast.type === 'error' ? 'bg-status-danger text-on-danger' : toast.type === 'info' ? 'bg-status-info text-on-info' : 'bg-status-ok text-on-ok'}`}>
          <span>{toast.type === 'error' ? '⚠️' : toast.type === 'info' ? 'ℹ️' : '✓'}</span>
          <span className="whitespace-pre-wrap">{toast.msg}</span>
          <button type="button" className="ml-2 opacity-80 hover:opacity-100" onClick={() => setToast(null)}>✕</button>
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
          <Button variant="primary" size="sm" onClick={() => { setEditingId(null); setEditingAttachmentCount(0); setAttachments([]); setIsCreateOpen(true); }}>
            + Tạo Đơn Mới
          </Button>
        </div>
      </div>

      {anomalyCount > 0 && (
        <div className="p-3.5 bg-status-warn-soft border border-status-warn-line rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-xs">
          <div className="flex items-start sm:items-center gap-2.5">
            <span className="text-lg">⚡</span>
            <div>
              <div className="font-semibold text-status-warn">
                Có {anomalyCount} ngày chấm công cần bổ sung đơn
              </div>
              <p className="text-[11px] text-status-warn mt-0.5">
                Hệ thống đã đọc log chấm công của bạn và điền sẵn ngày, số phút — bạn chỉ cần kiểm tra lại rồi gửi.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {missingCheckoutLog && (
              <Button
                type="button"
                variant="primary"
                size="sm"
                className="font-semibold text-[11px]"
                onClick={() => handleAutoFillPunch('OUT', missingCheckoutLog)}
              >
                + Giờ ra {fmtDay(missingCheckoutLog.workDate)}
              </Button>
            )}
            {lateLog && (
              <button
                type="button"
                onClick={() => handleAutoFillPunch('LATE', lateLog)}
                className="px-2.5 py-1.5 rounded-lg bg-status-warn hover:bg-status-warn text-on-warn font-semibold text-[11px] transition-colors cursor-pointer"
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
            placeholder="Tìm theo lý do..."
            value={searchKeyword}
            onChange={e => { setSearchKeyword(e.target.value); setPage(0); }}
            className="text-xs px-3 py-1.5 rounded-lg border border-line bg-canvas text-ink focus:outline-none focus:ring-1 focus:ring-accent"
          />

          <span className="text-xs text-ink-muted">Loại đơn:</span>
          <select
            value={filterType}
            onChange={e => { setFilterType(e.target.value); setPage(0); }}
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
            onChange={e => { setFilterStatus(e.target.value); setPage(0); }}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-line bg-canvas text-ink"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="PENDING">Chờ phê duyệt</option>
            <option value="APPROVED">Đã phê duyệt</option>
            <option value="REJECTED">Bị từ chối</option>
          </select>

          <span className="text-xs text-ink-muted ml-1">Khoảng ngày:</span>
          <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(0); }}
            className="text-xs px-2 py-1.5 rounded-lg border border-line bg-canvas text-ink" />
          <span className="text-xs text-ink-muted">→</span>
          <input type="date" value={dateTo} min={dateFrom || undefined} onChange={e => { setDateTo(e.target.value); setPage(0); }}
            className="text-xs px-2 py-1.5 rounded-lg border border-line bg-canvas text-ink" />
          {(dateFrom || dateTo) && (
            <button type="button" className="text-[11px] text-accent underline" onClick={() => { setDateFrom(''); setDateTo(''); setPage(0); }}>Xoá lọc ngày</button>
          )}
        </div>

        <div className="text-xs text-ink-muted">
          <div className="text-[11px] text-ink-muted">
            Quota: đi muộn {quota.lateUsed}/{quota.lateMax} · bổ sung {quota.adjustUsed}/{quota.adjustMax} · WFH đã gửi tuần này {quota.wfhWeekUsed}/{quota.wfhMax}
          </div>
          Tổng cộng: <strong className="text-ink">{totalElements}</strong> đơn
        </div>
      </div>

      {/* Requests Table */}
      <div className="bg-surface rounded-xl border border-line shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[1180px] text-left border-collapse text-xs">
          <thead>
            <tr className="bg-canvas border-b border-line text-ink-secondary font-medium">
              <th className="py-3 px-4">Mã Đơn</th>
              <th className="py-3 px-4">Loại Đơn Yêu Cầu</th>
              <th className="py-3 px-4">Ngày áp dụng</th>
              <th className="py-3 px-4">Ngày tạo</th>
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
                <td colSpan={9} className="py-8 text-center text-ink-muted">
                  Không có đơn yêu cầu nào phù hợp điều kiện lọc.
                </td>
              </tr>
            ) : (
              filtered.map(req => (
                <tr key={req.id} className="hover:bg-canvas/40 transition-colors">
                  <td className="py-3 px-4 font-mono font-medium text-ink">{req.id}</td>
                  <td className="py-3 px-4 min-w-[180px]">
                    <span className="font-semibold text-ink whitespace-normal leading-snug block">{req.typeName}</span>
                  </td>
                  <td className="py-3 px-4 font-mono text-ink-secondary whitespace-nowrap">
                    {fmtDate(req.startDate)}{req.startDate !== req.endDate ? ` → ${fmtDate(req.endDate)}` : ''}
                  </td>
                  <td className="py-3 px-4 text-ink-secondary whitespace-nowrap">{req.createdAt || '—'}</td>
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
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <Link to={`/attendance/requests/${req.id}`} className="inline-block mr-2 text-[11px] px-2 py-1 rounded border border-line text-accent-dark hover:bg-accent-soft">
                      Xem chi tiết
                    </Link>
                    {req.status === 'DRAFT' ? (
                      <div className="flex justify-end gap-1.5">
                        <Button variant="primary" size="sm" onClick={() => handleSubmitDraft(req.id)}>Gửi duyệt</Button>
                        <Button variant="ghost" size="sm" onClick={() => handleCancelRequest(req.id)} className="text-status-danger">Hủy</Button>
                      </div>
                    ) : req.status === 'PENDING' ? (
                      <div className="inline-flex gap-1.5">
                        <Button variant="outline" size="sm" onClick={() => openEditRequest(req)}>Sửa đơn</Button>
                        <Button variant="ghost" size="sm" onClick={() => handleCancelRequest(req.id)} className="text-status-danger">Hủy đơn</Button>
                      </div>
                    ) : req.status === 'REJECTED' ? (
                      <Button variant="outline" size="sm" onClick={() => openEditRequest(req)}>Sửa & gửi lại</Button>
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
        <div className="flex items-center justify-between gap-2 border-t border-line px-4 py-2.5 text-xs text-ink-secondary">
          <span>Trang <b>{page + 1}</b> / {totalPages} · {totalElements} đơn</span>
          <div className="flex items-center gap-1.5">
            <button type="button" disabled={page <= 0} onClick={() => setPage(p => Math.max(0, p - 1))}
              className="px-2.5 py-1 rounded border border-line disabled:opacity-40">← Trước</button>
            <button type="button" disabled={page + 1 >= totalPages} onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              className="px-2.5 py-1 rounded border border-line disabled:opacity-40">Sau →</button>
          </div>
        </div>
      </div>

      {/* Create Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => { setIsCreateOpen(false); setEditingId(null); setEditingAttachmentCount(0); }}
        title={editingId ? "Sửa Đơn Yêu Cầu" : "Tạo Đơn Yêu Cầu Mới"}
        maxWidth="md"
      >
        <form onSubmit={handleCreate} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-ink mb-1">Loại Đơn Yêu Cầu</label>
            <select
              autoFocus
              value={newReq.type}
              onChange={e => handleTypeChange(e.target.value as any)}
              className="w-full p-2 border border-line rounded-lg bg-surface font-medium text-ink"
            >
              <option value="LATE_EARLY">🕘 Đi muộn / Về sớm</option>
              <option value="LEAVE">🌴 Nghỉ phép</option>
              <option value="WFH">🏡 Làm việc từ xa (WFH)</option>
              <option value="ADJUST">⏱️ Bổ sung chấm công</option>
            </select>
            {newReq.type === 'LEAVE' && (
              <div className="mt-2">
                <label className="block font-medium text-ink mb-1">Loại nghỉ</label>
                <select
                  value={newReq.leaveType}
                  onChange={e => {
                    const code = e.target.value;
                    const lt: any = leaveTypes.find((x: any) => x.code === code);
                    // Đơn vị theo cấu hình loại nghỉ (S32): loại chỉ tính theo ngày thì khoá nửa ngày.
                    if (lt?.unit === 'DAY') setLeaveUnit('DAY');
                    const days = Number(lt?.submitWithinDays ?? rulesCfg?.leave_type_defaults?.submit_within_days ?? 3);
                    const min = isoDaysFromToday(-days);
                    setNewReq(prev => ({ ...prev, leaveType: code, startDate: prev.startDate < min ? min : prev.startDate }));
                  }}
                  className="w-full p-2 border border-line rounded-lg bg-surface text-ink"
                >
                  {leaveTypes.length === 0 && <option value="AL">Phép năm (AL)</option>}
                  {leaveTypes.map((lt: any) => (
                    <option key={lt.code} value={lt.code}>{lt.name}</option>
                  ))}
                </select>
                {(() => {
                  const lt: any = leaveTypes.find((x: any) => x.code === newReq.leaveType);
                  if (!lt?.requiresAttachment) return null;
                  return <div className="mt-1 text-[10px] text-status-warn">Loại nghỉ này cần giấy tờ đính kèm khi gửi.</div>;
                })()}
              </div>
            )}
            {newReq.type === 'LEAVE' && (
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <label className="font-medium">Đơn vị
                  <select className="mt-1 w-full p-2 border border-line rounded-lg bg-surface" value={leaveUnit}
                    onChange={e => {
                      const unit = e.target.value as 'DAY' | 'HALF_DAY';
                      setLeaveUnit(unit);
                      if (unit === 'HALF_DAY') setNewReq(prev => ({ ...prev, endDate: prev.startDate }));
                    }}>
                    <option value="DAY">Cả ngày</option>
                    {selectedLeaveCfg?.unit !== 'DAY' && <option value="HALF_DAY">Nửa ngày (0.5)</option>}
                  </select>
                </label>
                <div className={`p-2 rounded-lg border ${leaveShortfall ? 'bg-status-danger-soft border-status-danger-line text-status-danger' : 'bg-accent-soft/40 border-accent/30 text-accent-dark'}`}>
                  Số dư phép còn lại: <b>{leaveRemaining !== null ? leaveRemaining : '—'} ngày</b>
                  {pendingLeaveDays > 0 && (
                    <div className="text-[10px] mt-0.5">
                      Đang chờ duyệt: <b>{pendingLeaveDays}</b> ngày · Khả dụng để gửi đơn: <b>{leaveAvailable}</b> ngày
                    </div>
                  )}
                  <div className="text-[10px] mt-0.5">Duyệt 1 cấp bởi quản lý trực tiếp</div>
                  <div className="text-[10px] mt-0.5">Số ngày trừ quỹ phép: <b>{leaveDays}</b> ngày</div>
                  {newReq.type === 'LEAVE' && selectedLeaveCfg && !selectedLeaveCfg.deductsAnnualLeave && (
                    <div className="text-[10px] mt-0.5">Loại nghỉ này không trừ quỹ phép năm.</div>
                  )}
                  {leaveExhausted ? (
                    <div className="mt-1 pt-1 border-t border-status-danger-line font-semibold">
                      Đã hết ngày phép — không thể gửi đơn nghỉ phép năm. Chọn loại nghỉ khác (ốm, không lương…) hoặc liên hệ HR.
                    </div>
                  ) : leaveShortfall ? (
                    <div className="mt-1 pt-1 border-t border-status-danger-line font-semibold">
                      Không đủ ngày phép — đơn cần {leaveDays} ngày, chỉ còn {leaveAvailable} ngày khả dụng.
                    </div>
                  ) : null}
                </div>
                {leaveUnit === 'HALF_DAY' && (
                  <label className="font-medium">Buổi nghỉ
                    <select className="mt-1 w-full p-2 border border-line rounded-lg bg-surface" value={halfDayPeriod}
                      onChange={e => setHalfDayPeriod(e.target.value as 'MORNING' | 'AFTERNOON')}>
                      <option value="MORNING">Buổi sáng</option>
                      <option value="AFTERNOON">Buổi chiều</option>
                    </select>
                  </label>
                )}
                {leaveUnit === 'HALF_DAY' && halfDayWindow && (
                  <div className="col-span-2 p-2 rounded-lg bg-canvas border border-line text-[11px] text-ink-secondary">
                    Nghỉ <b>{halfDayPeriod === 'MORNING' ? 'buổi sáng' : 'buổi chiều'}</b> · thời gian làm việc thực tế hôm đó:
                    <b> {halfDayWindow.from}–{halfDayWindow.to}</b> ({halfDayHours}h)
                  </div>
                )}
              </div>
            )}
            {leaveNeedsAttachment && (
              <div className={`mt-2 p-2 rounded-lg border text-[11px] ${attachments.length ? 'bg-status-ok-soft border-status-ok-line text-status-ok' : 'bg-status-warn-soft border-status-warn-line text-status-warn'}`}>
                <div className="font-semibold">Bắt buộc đính kèm giấy tờ cho loại nghỉ này</div>
                <div className="text-[10px] text-ink-secondary mt-0.5">Có thể chọn nhiều file một lần, hoặc bấm lại để thêm từng file.</div>
                <input type="file" multiple accept="image/*,application/pdf" className="mt-1 block w-full text-[11px]"
                  onChange={e => {
                    const picked = Array.from(e.target.files || []);
                    setAttachments(prev => {
                      const next = [...prev];
                      picked.forEach(f => {
                        if (!next.some(x => x.name === f.name && x.size === f.size && x.lastModified === f.lastModified)) next.push(f);
                      });
                      return next;
                    });
                    e.target.value = '';
                  }} />
                {attachments.length > 0 && (
                  <ul className="mt-1 space-y-0.5">
                    {attachments.map((f, i) => (
                      <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2">
                        <span>📎 {f.name} ({Math.round(f.size / 1024)} KB)</span>
                        <button type="button" className="text-status-danger" onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}>Bỏ</button>
                      </li>
                    ))}
                  </ul>
                )}
                {attachments.length === 0 && <div className="mt-0.5 text-status-danger">Chưa có file — chưa thể gửi đơn.</div>}
              </div>
            )}
          </div>

          {newReq.type === 'WFH' && (
            <div className="p-3 bg-status-info-soft border border-status-info-line rounded-lg text-status-info text-[11px] leading-relaxed space-y-2">
              <div><strong>Quy chế WFH:</strong> tối đa <strong>2 ngày WFH / tuần</strong>; cho phép đăng ký lùi tối đa <strong>{wfhBackfillDays} ngày</strong> (ngày sớm nhất <strong>{minDateForSelected}</strong>) và ngày tương lai. Không giới hạn địa điểm.</div>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-[11px]">Đơn vị
                  <select className="mt-1 w-full border border-status-info-line rounded p-1" value={leaveUnit}
                    onChange={e => {
                      const unit = e.target.value as 'DAY' | 'HALF_DAY';
                      setLeaveUnit(unit);
                      setNewReq(prev => ({ ...prev, endDate: unit === 'HALF_DAY' || prev.endDate < prev.startDate ? prev.startDate : prev.endDate }));
                    }}>
                    <option value="DAY">Cả ngày</option>
                    <option value="HALF_DAY">Nửa ngày (0.5)</option>
                  </select>
                </label>
                {leaveUnit === 'HALF_DAY' && (
                  <label className="block text-[11px]">Buổi
                    <select className="mt-1 w-full border border-status-info-line rounded p-1" value={halfDayPeriod}
                      onChange={e => setHalfDayPeriod(e.target.value as 'MORNING' | 'AFTERNOON')}>
                      <option value="MORNING">Buổi sáng</option>
                      <option value="AFTERNOON">Buổi chiều</option>
                    </select>
                  </label>
                )}
              </div>
              {leaveUnit === 'HALF_DAY' && (
                <div>WFH nửa ngày: tính <b>0.5 công</b> — làm việc tại nhà, không cần ghi khung giờ.</div>
              )}
            </div>
          )}


          {newReq.type === 'ADJUST' && (
            <div className="grid grid-cols-2 gap-3">
              <label className="block font-medium text-ink">Cần bổ sung
                <select className="mt-1 w-full p-2 border border-line rounded-lg bg-surface text-ink"
                  value={adjustKind}
                  onChange={e => {
                    const kind = e.target.value as 'IN' | 'OUT';
                    setAdjustKind(kind);
                    setAdjustTime(kind === 'IN' ? SHIFT_START : SHIFT_END);
                  }}>
                  <option value="IN">Giờ vào (check-in)</option>
                  <option value="OUT">Giờ ra (check-out)</option>
                </select>
              </label>
              <label className="block font-medium text-ink">Giờ thực tế
                <input type="time" required className="mt-1 w-full p-2 border border-line rounded-lg bg-surface text-ink font-mono"
                  value={adjustTime} onChange={e => setAdjustTime(e.target.value)} />
              </label>
            </div>
          )}
          {newReq.type === 'ADJUST' && (
            <div className="p-2 rounded text-[11px] bg-canvas border border-line text-ink-secondary">
              Chỉ chọn <b>hôm nay hoặc trong {adjustDeadlineDays} ngày trước</b> ({isoDaysFromToday(-adjustDeadlineDays)} → {isoDaysFromToday(0)}). Không nhập thời lượng.
            </div>
          )}

          {newReq.type === 'LATE_EARLY' ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-ink mb-1">Ngày</label>
                  <input
                    type="date"
                    required
                    min={isoDaysFromToday(-lateSubmitDays)}
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
                      setLateEarlyTime(kind === 'LATE'
                        ? `${String(Math.floor((toMinutes(SHIFT_IN_END) + 15) / 60)).padStart(2, '0')}:${String((toMinutes(SHIFT_IN_END) + 15) % 60).padStart(2, '0')}`
                        : `${String(Math.floor((toMinutes(SHIFT_END) - 15) / 60)).padStart(2, '0')}:${String((toMinutes(SHIFT_END) - 15) % 60).padStart(2, '0')}`);
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
                    min={lateEarlyKind === 'LATE'
                      ? `${String(Math.floor((toMinutes(SHIFT_IN_END) + 1) / 60)).padStart(2, '0')}:${String((toMinutes(SHIFT_IN_END) + 1) % 60).padStart(2, '0')}`
                      : `${String(Math.floor((toMinutes(SHIFT_END) - lateMinutesMax) / 60)).padStart(2, '0')}:${String((toMinutes(SHIFT_END) - lateMinutesMax) % 60).padStart(2, '0')}`}
                    max={lateEarlyKind === 'LATE'
                      ? `${String(Math.floor((toMinutes(SHIFT_IN_END) + lateMinutesMax) / 60)).padStart(2, '0')}:${String((toMinutes(SHIFT_IN_END) + lateMinutesMax) % 60).padStart(2, '0')}`
                      : `${String(Math.floor((toMinutes(SHIFT_END) - 1) / 60)).padStart(2, '0')}:${String((toMinutes(SHIFT_END) - 1) % 60).padStart(2, '0')}`}
                    value={lateEarlyTime}
                    onChange={e => setLateEarlyTime(e.target.value)}
                    className="w-full p-2 border border-line rounded-lg bg-surface text-ink font-mono"
                  />
                  <div className="text-[10px] text-ink-muted mt-1">
                    Tối đa {lateMinutesMax} phút/lần (cấu hình late_early.max_minutes)
                  </div>
                </div>
                <div className={`p-2 rounded-lg border text-[11px] ${
                  lateEarlyValid ? 'bg-accent-soft/40 border-accent/30 text-accent-dark' : 'bg-status-danger-soft border-status-danger-line text-status-danger'
                }`}>
                  {myShift?.name || 'Ca chuẩn'}
                  <div className="mt-0.5">
                    Vào <b>{shiftStartLabel}–{shiftInEnd}</b> · ra <b>{shiftOutStart}–{shiftOutEnd}</b> · {shiftHours}h/ngày
                  </div>
                  {!(lateEarlyMinutes > 0 && lateEarlyMinutes <= lateMinutesMax) && (
                    <div className="mt-0.5 text-status-danger">
                      Giờ đã chọn không hợp lệ (tối đa {lateMinutesMax} phút).
                    </div>
                  )}
                  <div className="mt-1 text-ink-secondary">Hạn nộp: trong vòng <b>{lateSubmitDays} ngày</b> kể từ ngày xảy ra · chọn từ {isoDaysFromToday(-lateSubmitDays)} · tối đa <b>{lateMinutesMax} phút/lần</b>.</div>
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
                    min={minDateForSelected}
                    max={newReq.type === 'ADJUST' ? isoDaysFromToday(0) : undefined}
                    value={newReq.startDate}
                    onChange={e => { const start = e.target.value; setNewReq(prev => ({ ...prev, startDate: start, endDate: prev.endDate < start ? start : prev.endDate })); }}
                    className="w-full p-2 border border-line rounded-lg bg-surface text-ink font-mono"
                  />
                </div>
                {newReq.type !== 'ADJUST' && !(newReq.type === 'LEAVE' && leaveUnit === 'HALF_DAY') && !(newReq.type === 'WFH' && leaveUnit === 'HALF_DAY') && (
                  <div>
                    <label className="block font-medium text-ink mb-1">Đến Ngày</label>
                    <input
                      type="date"
                      required
                      min={newReq.startDate}
                      value={newReq.endDate}
                      onChange={e => setNewReq({ ...newReq, endDate: e.target.value })}
                      className="w-full p-2 border border-line rounded-lg bg-surface text-ink font-mono"
                    />
                  </div>
                )}
              </div>

              <div className="text-[11px] bg-canvas border border-line rounded-lg px-2 py-1.5 text-ink-secondary">
                {newReq.type === 'LEAVE' && <>Hạn gửi loại nghỉ này: <b>{leaveSubmitDays} ngày</b> kể từ ngày nghỉ — chọn từ <b>{minDateForSelected}</b>.</>}
              </div>

              {newReq.type === 'LEAVE' || newReq.type === 'WFH' ? (
                <div>
                  <label className="block font-medium text-ink mb-1">Số Lượng / Thời Lượng</label>
                  <div className="w-full p-2 border border-line rounded-lg bg-canvas text-ink">
                    {newReq.type === 'LEAVE' ? (
                      leaveUnit === 'HALF_DAY'
                        ? <>0.5 ngày{halfDayWindow ? ` — ${halfDayWindow.text}` : ''}</>
                        : <>{leaveDays} ngày làm việc</>
                    ) : (
                      leaveUnit === 'HALF_DAY'
                        ? <>0.5 ngày — WFH buổi {halfDayPeriod === 'MORNING' ? 'sáng' : 'chiều'}</>
                        : <>{wfhDaysCount} ngày làm việc</>
                    )}
                  </div>
                </div>
              ) : newReq.type === 'ADJUST' ? null : (
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
              )}
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
                  className={`inline-flex items-center h-[31px] px-3 rounded-full border text-[12.5px] font-semibold whitespace-nowrap transition-colors ${newReq.reason === r ? 'bg-ink text-canvas border-ink' : 'bg-surface border-line text-ink-secondary'}`}>
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
            <Button variant="outline" size="sm" type="button" onClick={() => { setIsCreateOpen(false); setEditingId(null); setEditingAttachmentCount(0); }}>
              Hủy
            </Button>
            <Button variant="outline" size="sm" type="button" onClick={(ev) => handleCreate(ev as any, true)}>
              Lưu nháp
            </Button>
            <Button variant="primary" size="sm" type="submit"
              disabled={(newReq.type === 'LEAVE' && leaveDays <= 0) || leaveShortfall || (leaveNeedsAttachment && attachments.length === 0) || (newReq.type === 'WFH' && leaveUnit === 'DAY' && wfhDaysCount <= 0) || (newReq.type === 'LATE_EARLY' && !lateEarlyValid)}
              title={leaveShortfall
                ? (leaveExhausted ? 'Đã hết ngày phép — không thể gửi đơn nghỉ phép năm' : `Chỉ còn ${leaveAvailable} ngày phép khả dụng, đơn cần ${leaveDays} ngày`)
                : undefined}>
              {editingId ? 'Cập nhật & Gửi Lại' : 'Gửi Đơn Phê Duyệt'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
