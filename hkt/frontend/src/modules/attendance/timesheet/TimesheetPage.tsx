import React, { useEffect, useState } from 'react';
import { buildTimesheetXlsx } from './timesheetXlsx';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { Modal } from '../../../components/common/Modal';
import {
  AlertTriangle,
  ArrowUpRight,
  Bookmark,
  CheckCircle2,
  Download,
  Link2,
  Lock,
  Megaphone,
  Search,
  Table2,
  Users,
  X,
  Zap,
} from 'lucide-react';

interface TimesheetRow {
  id: string;
  code: string;
  fullName: string;
  department: string;
  team: string;
  positionName?: string | null;
  managerCode?: string | null;
  standardDays: number;
  actualWorkDays: number;
  paidLeaveDays: number;
  holidayDays: number;
  wfhDays: number;
  lateCount: number;
  penaltyLatePercent: number;
  otWeekdayHours: number;
  otWeekendHours: number;
  totalPayrollDays: number;
  status: 'OPEN' | 'HR_LOCKED';
  sickDays: number;
  sickBhDays: number;
  compDays: number;
  unpaidDays: number;
  maternityDays: number;
  paternityDays: number;
  specialLeaveDays: number;
  totalDays: number;
  remainingLeave: number;
}

export const TimesheetPage: React.FC = () => {
  const [selectedMonth, setSelectedMonth] = useState('11/2026');
  const [filterDept, setFilterDept] = useState('ALL');
  const [quickFilter, setQuickFilter] = useState<'ALL' | 'LATE' | 'OT' | 'DEFICIT'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingCell, setEditingCell] = useState<{ row: TimesheetRow; field: string; val: any } | null>(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [allowAfterLock, setAllowAfterLock] = useState(false);
  const [disputeWindowDays, setDisputeWindowDays] = useState(2);
  // Ngày chốt kỳ (payroll_period.close_day) — API trả về, mặc định 1.
  const [closeDay, setCloseDay] = useState(1);
  const [disputeDeadline, setDisputeDeadline] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [bulkAdjustment, setBulkAdjustment] = useState({ field: 'paidLeaveDays', amount: '1.0', reason: 'Duyệt bù phép cuối năm theo chính sách HR' });
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [dayOverrides, setDayOverrides] = useState<Record<string, string>>({});
  const [holidayDates, setHolidayDates] = useState<string[]>([]);
  const [sheetStatus, setSheetStatus] = useState<string>('draft');
  const [savedViews, setSavedViews] = useState<{ name: string; f: any }[]>(() => {
    try { return JSON.parse(localStorage.getItem('pulse_timesheet_views') || '[]'); } catch { return []; }
  });
  const currentFilters = { filterDept, quickFilter, searchQuery, month: selectedMonth };
  const applyView = (v: any) => {
    setFilterDept(v.filterDept ?? 'ALL'); setQuickFilter(v.quickFilter ?? 'ALL');
    setSearchQuery(v.searchQuery ?? ''); if (v.month) setSelectedMonth(v.month);
  };
  useEffect(() => {
    const qs = new URLSearchParams(location.search).get('view');
    if (qs) { try { applyView(JSON.parse(decodeURIComponent(qs))); } catch { /* ignore */ } }
  }, []);
  const saveView = () => {
    const name = window.prompt('Tên view (VD: Mobile · đi muộn)', 'View của tôi');
    if (!name) return;
    const next = [...savedViews.filter(v => v.name !== name), { name, f: currentFilters }];
    setSavedViews(next); localStorage.setItem('pulse_timesheet_views', JSON.stringify(next));
    showToast('Đã lưu view — mở lại bằng 1 click');
  };
  const shareView = async () => {
    const url = `${location.origin}${location.pathname}?view=${encodeURIComponent(JSON.stringify(currentFilters))}`;
    try { await navigator.clipboard.writeText(url); showToast('Đã copy link chia sẻ view'); } catch { window.prompt('Copy link chia sẻ:', url); }
  };
  const [conflictMsg, setConflictMsg] = useState<string | null>(null);
  const authh = (): Record<string, string> => { try { const u = JSON.parse(localStorage.getItem('pulse_auth_user') || '{}'); return u?.accessToken ? { Authorization: `Bearer ${u.accessToken}` } : {}; } catch { return {}; } };
  // Danh mục loại nghỉ — dùng cho bảng chú thích ký hiệu (S, AL, CL…) để HR thêm loại mới là chú thích tự cập nhật.
  const [leaveTypes, setLeaveTypes] = useState<{ code: string; name: string }[]>([]);
  useEffect(() => {
    fetch('/api/v1/leave-types', { headers: authh() })
      .then(r => r.json())
      .then(j => { if (Array.isArray(j?.data)) setLeaveTypes(j.data.map((x: { code: string; name: string }) => ({ code: x.code, name: x.name }))); })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const loadSheet = () => {
    const ym = (() => { const [m, y] = selectedMonth.split('/'); return `${y}-${m.padStart(2, '0')}`; })();
    return fetch(`/api/v1/timesheets?month=${ym}`, { headers: authh() })
      .then(r => r.json())
      .then(j => {
        const d = j?.data; if (!d) return;
        setSheetStatus(d.status || 'draft');
        setHolidayDates(Array.isArray(d.holidayDates) ? d.holidayDates : []);
        setIsLocked(d.status === 'locked');
        setAllowAfterLock(d.allowAdjustAfterLock === true);
        setDisputeWindowDays(Number(d.disputeWindowDays ?? 2));
        setCloseDay(Number(d.closeDay ?? 1));
        setDisputeDeadline(d.disputeDeadline ?? null);
        const mapped: TimesheetRow[] = (d.rows || []).map((r: any, i: number) => ({
          id: String(i + 1), code: r.employeeCode, fullName: r.fullName, department: r.teamName || '—',
          team: r.teamName || '—', positionName: r.positionName || '—', managerCode: r.managerCode || '',
          standardDays: r.standardDays ?? 0, actualWorkDays: r.actualDays ?? 0,
          paidLeaveDays: r.leaveDays ?? 0, holidayDays: r.holidayDays ?? 0, wfhDays: r.wfhDays ?? 0,
          lateCount: r.lateCount ?? 0, penaltyLatePercent: 0, otWeekdayHours: 0, otWeekendHours: 0,
          totalPayrollDays: r.actualDays ?? 0, status: d.status === 'locked' ? 'HR_LOCKED' : 'OPEN',
          sickDays: r.sickDays ?? 0, sickBhDays: r.sickBhDays ?? 0, compDays: r.compDays ?? 0,
          unpaidDays: r.unpaidDays ?? 0, maternityDays: r.maternityDays ?? 0,
          paternityDays: r.paternityDays ?? 0, specialLeaveDays: r.specialLeaveDays ?? 0,
          totalDays: r.totalDays ?? 0, remainingLeave: r.remainingLeave ?? 0,
        }));
        const ov: Record<string, string> = {};
        (d.rows || []).forEach((r: any, i: number) => {
          Object.entries(r.days || {}).forEach(([day, sym]) => { ov[`${i + 1}-${day}`] = String(sym); });
        });
        setDayOverrides(ov);
        setRows(mapped);
      })
      .catch(() => undefined);
  };
  useEffect(() => { void loadSheet(); }, [selectedMonth]);

  // 31 cột ngày + 17 cột tổng hợp = 53 cột dữ liệu (đúng file Pine thật)
  const monthDays = Array.from({ length: 31 }, (_, i) => i + 1);

  // Chỉ hiển thị ký hiệu gốc do API trả về (attendance_logs + đơn đã duyệt + ngày lễ).
  // Không tự bịa công cho ngày không có dữ liệu.
  const daySymbol = (row: TimesheetRow, day: number): string => dayOverrides[`${row.id}-${day}`] || '';

  const monthOf = () => { const [m, y] = selectedMonth.split('/'); return `${y}-${m.padStart(2, '0')}`; };
  const selectedYm = monthOf();
  const [calendarYear, calendarMonth] = selectedYm.split('-').map(Number);
  const daysInSelectedMonth = new Date(calendarYear, calendarMonth, 0).getDate();
  const holidayDaySet = new Set(
    holidayDates.filter(d => d.startsWith(selectedYm)).map(d => Number(d.slice(8, 10)))
  );
  const isWeekendDay = (day: number) => {
    const dow = new Date(calendarYear, calendarMonth - 1, day).getDay();
    return dow === 0 || dow === 6;
  };
  // Tô màu cả cột ngày (header + ô dữ liệu): cuối tuần xám nhạt, ngày lễ hổ phách.
  const dayTint = (day: number, part: 'head' | 'body') => {
    if (day > daysInSelectedMonth) return '';
    if (holidayDaySet.has(day)) {
      return part === 'head' ? 'bg-status-warn-soft text-status-warn' : 'bg-status-warn-soft/80';
    }
    if (isWeekendDay(day)) {
      return part === 'head' ? 'bg-line/80 text-ink-secondary' : 'bg-surface-secondary/80';
    }
    return '';
  };
  const dayHint = (day: number) => {
    if (day > daysInSelectedMonth) return '';
    if (holidayDaySet.has(day)) return ' — ngày lễ';
    return isWeekendDay(day) ? ' — cuối tuần' : '';
  };
  const _now = new Date();
  const currentYm = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}`;
  // Kỳ đang chạy/tương lai phải giữ MỞ — chỉ chốt được kỳ đã kết thúc.
  const isCurrentOrFuture = selectedYm >= currentYm;
  // Số ngày còn khiếu nại tính từ hạn THẬT (disputeDeadline), không lấy số ngày cấu hình.
  const daysLeftToDeadline = (() => {
    if (!disputeDeadline) return null;
    const [y, m, d] = disputeDeadline.split('-').map(Number);
    const end = new Date(y, m - 1, d); end.setHours(0, 0, 0, 0);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return Math.round((end.getTime() - today.getTime()) / 86400000);
  })();

  const editDayCell = async (row: TimesheetRow, day: number) => {
    if (isLocked && !allowAfterLock) { showToast('Kỳ công đã khoá — không sửa được ô (bật “Cho phép điều chỉnh sau khi khoá” trong Cấu hình Kỳ công & khiếu nại nếu cần)'); return; }
    const current = daySymbol(row, day) || '(trống)';
    const next = window.prompt(`Sửa ô ngày ${day} — ${row.fullName}\nKý hiệu hiện tại: ${current}\nNhập ký hiệu công mới:`, daySymbol(row, day));
    if (next === null) return;
    const reason = window.prompt('Lý do sửa (bắt buộc):', 'HR đối chiếu log chấm công');
    if (!reason || !reason.trim()) return;
    const res = await fetch(`/api/v1/timesheets/cell?month=${monthOf()}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authh() },
      body: JSON.stringify({ employeeCode: row.code, day, symbol: next, reason: reason.trim() }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setConflictMsg(json?.message || 'Sửa ô thất bại'); return; }
    setDayOverrides((prev) => ({ ...prev, [`${row.id}-${day}`]: next }));
    // Tải lại bảng để các cột tổng hợp (công thực tế, phép, WFH…) tính lại theo ô vừa sửa,
    // tránh file xuất ra có ô ngày mới nhưng tổng vẫn là số cũ.
    await loadSheet();
    // Ghi nhật ký kiểm toán Append-Only vào backend
    fetch('/api/v1/attendance/timesheet/override', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employeeCode: row.code,
        employeeName: row.fullName,
        workDate: `2026-11-${day < 10 ? '0' + day : day}`,
        fieldName: `ngày ${day}/11`,
        oldValue: current,
        newValue: next,
        reason: `Điều chỉnh thủ công ô ngày ${day}/11 theo đề xuất giải trình`
      })
    }).catch(err => console.error('Lỗi lưu audit log bảng công', err));

    showToast(`Đã sửa ô ngày ${day}/11 của ${row.fullName} — có ghi nhật ký thay đổi`);
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Dữ liệu thật luôn lấy từ API — không dùng dữ liệu mẫu giả.
  const [rows, setRows] = useState<TimesheetRow[]>([]);

  const handleSaveCellOverride = () => {
    if (!editingCell) return;
    const oldVal = (editingCell.row as any)[editingCell.field];
    const newVal = editingCell.val;
    const reasonText = overrideReason.trim() || 'Điều chỉnh thủ công ô bảng công có xác nhận';

    // Ghi nhật ký kiểm toán Append-Only vào backend
    fetch('/api/v1/attendance/timesheet/override', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employeeCode: editingCell.row.code,
        employeeName: editingCell.row.fullName,
        workDate: '2026-11-05',
        fieldName: editingCell.field,
        oldValue: String(oldVal),
        newValue: String(newVal),
        reason: reasonText
      })
    }).catch(err => console.error('Lỗi lưu audit log bảng công', err));

    setRows(prev =>
      prev.map(r => (r.id === editingCell.row.id ? { ...r, [editingCell.field]: editingCell.val } : r))
    );
    setEditingCell(null);
    setOverrideReason('');
    showToast(`Đã cập nhật thủ công ô công cho ${editingCell.row.fullName} và ghi nhật ký thay đổi`);
  };

  const handleBulkApply = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(bulkAdjustment.amount);
    if (isNaN(amountNum) || selectedIds.length === 0) return;
    const codes = displayedRows.filter(r => selectedIds.includes(r.id)).map(r => r.code);
    const res = await fetch(`/api/v1/timesheets/bulk?month=${monthOf()}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authh() },
      body: JSON.stringify({ employeeCodes: codes, day: 1, symbol: String(amountNum), reason: bulkAdjustment.reason }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setConflictMsg(json?.message || 'Sửa hàng loạt thất bại'); return; }

    setRows(prev =>
      prev.map(r => {
        if (!selectedIds.includes(r.id)) return r;
        const currentVal = (r as any)[bulkAdjustment.field] || 0;
        const newVal = Math.max(0, currentVal + amountNum);
        return {
          ...r,
          [bulkAdjustment.field]: newVal,
          totalPayrollDays: parseFloat((r.totalPayrollDays + amountNum).toFixed(1))
        };
      })
    );
    setIsBulkEditOpen(false);
    showToast(`Đã cập nhật bảng công cho ${selectedIds.length} nhân sự`);
    setSelectedIds([]);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === displayedRows.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(displayedRows.map(r => r.id));
    }
  };

  const toggleSelectRow = (id: string) => {
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]));
  };

  // C5: Filter rows with strong filters & view preservation
  const displayedRows = rows.filter(r => {
    if (filterDept !== 'ALL' && r.department !== filterDept) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (!r.code.toLowerCase().includes(q) && !r.fullName.toLowerCase().includes(q)) return false;
    }
    if (quickFilter === 'LATE' && r.lateCount === 0) return false;
    if (quickFilter === 'OT' && (r.otWeekdayHours + r.otWeekendHours === 0)) return false;
    if (quickFilter === 'DEFICIT' && r.actualWorkDays >= r.standardDays) return false;
    return true;
  });

  const handleLockPayroll = async () => {
    if (!window.confirm(`Khoá kỳ công tháng ${selectedMonth}?\n\nSau khi khoá, nhân viên KHÔNG khiếu nại được nữa. HR vẫn điều chỉnh ô được nếu bật "Cho phép điều chỉnh sau khi khoá" (bắt buộc lý do + ghi audit).`)) return;
    const ym = monthOf();
    const lockOnce = (force: boolean) =>
      fetch(`/api/v1/timesheets/lock?month=${ym}${force ? '&force=true' : ''}`, { method: 'POST', headers: authh() });
    let res = await lockOnce(false);
    let json = await res.json().catch(() => ({}));
    let forced = false;
    // Còn khiếu nại mở trong kỳ: cho HR chọn khoá cưỡng bức (backend ghi audit) thay vì bế tắc.
    if (!res.ok && String(json?.message || '').toLowerCase().includes('khiếu nại')) {
      if (!window.confirm(`${json?.message || 'Còn khiếu nại chưa xử lý.'}\n\nVẫn KHOÁ CƯỠNG BỨC? Các khiếu nại còn mở sẽ bị đóng theo kỳ; hành động này được ghi audit.`)) {
        setConflictMsg(json?.message || 'Khoá kỳ công thất bại'); return;
      }
      res = await lockOnce(true);
      json = await res.json().catch(() => ({}));
      forced = true;
    }
    if (!res.ok) { setConflictMsg(json?.message || 'Khoá kỳ công thất bại'); return; }
    setConflictMsg(null);
    setIsLocked(true);
    setSheetStatus('locked');
    setRows(prev => prev.map(r => ({ ...r, status: 'HR_LOCKED' })));
    showToast((forced ? 'Đã khoá cưỡng bức (còn khiếu nại mở) — ' : '')
      + (allowAfterLock ? 'nhân viên hết khiếu nại (HR vẫn điều chỉnh được kèm lý do)' : 'bản cuối cùng'));
  };

  const handlePublish = async () => {
    const ym = monthOf();
    if (isCurrentOrFuture) {
      setConflictMsg('Chỉ chốt được kỳ đã kết thúc. Kỳ đang chạy luôn mở để nhân viên khiếu nại và sẽ tự chốt theo ngày chốt cấu hình ở đầu tháng sau.');
      return;
    }
    if (!window.confirm(`Chốt bảng công tháng ${selectedMonth}?\n\nKỳ sẽ dừng nhận khiếu nại tự do; nhân viên còn ${disputeWindowDays} ngày khiếu nại kể từ hôm nay, sau đó khoá hoàn toàn.`)) return;
    const res = await fetch(`/api/v1/timesheets/publish?month=${ym}`, { method: 'POST', headers: authh() });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setConflictMsg(json?.message || 'Chốt bảng công thất bại'); return; }
    setConflictMsg(null);
    setSheetStatus('published');
    setDisputeDeadline(json?.data?.disputeDeadline ?? null);
    showToast(`Đã chốt — nhân viên khiếu nại đến ${json?.data?.disputeDeadline ?? ''} (${disputeWindowDays} ngày)`);
  };

  const handleExportExcel = () => {
    // Xuất .xlsx thật để không phụ thuộc locale/dấu phân cách của Excel.
    const { bytes, filename } = buildTimesheetXlsx(
      displayedRows, selectedMonth, daySymbol, filterDept === 'ALL' ? 'All' : filterDept);
    // Copy sang ArrayBuffer chuẩn để Blob nhận (Uint8Array có thể là view trên SharedArrayBuffer).
    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  // Chú thích ký hiệu: ký hiệu cố định của bảng công + toàn bộ loại nghỉ đang dùng.
  const symbolLegend: { code: string; label: string }[] = [
    { code: '1.00', label: 'Đủ công — đúng giờ, hoặc đi muộn có đơn duyệt' },
    { code: '0.50', label: 'Nửa công — thiếu giờ vào hoặc giờ ra' },
    { code: 'R', label: 'Làm việc từ xa (WFH) cả ngày' },
    { code: 'R/0.50', label: 'Làm việc từ xa nửa ngày' },
    { code: 'NL', label: 'Nghỉ lễ, tết (hưởng lương)' },
    { code: 'V', label: 'Vắng mặt — ngày làm việc không có log chấm công' },
    { code: '—', label: 'Cuối tuần hoặc ngày chưa tới' },
    { code: '(trống)', label: 'Chưa có dữ liệu công, HR có thể sửa tay' },
    // NL đã có ở nhóm ký hiệu cố định phía trên — bỏ khỏi danh sách loại nghỉ để không lặp.
    ...leaveTypes.filter(t => t.code !== 'NL').map(t => ({ code: t.code, label: `${t.name} (thêm /0.50 nếu nghỉ nửa ngày)` })),
  ];
  // Chỉ số tổng hợp cho stat row (mockup `.stats3`).
  const departmentCount = new Set(rows.map(r => r.department).filter(d => d && d !== '—')).size;
  // Tỉ lệ nhân viên ĐÃ có dữ liệu chấm công trong kỳ — đo được từ dữ liệu thật,
  // không suy đoán theo "công chuẩn" (kỳ đang chạy thì phần lớn NV chưa chấm đủ).
  const loggedDaysCount = rows.filter(r => r.actualWorkDays > 0).length;
  const loggedDaysPct = rows.length ? Math.round((loggedDaysCount / rows.length) * 100) : 0;
  // NV chưa có bất kỳ log công nào trong kỳ — cần HR rà soát.
  const missingLogCount = rows.length - loggedDaysCount;
  // Ngày chốt kỳ — đọc từ cấu hình payroll_period.close_day (API trả về cùng response).
  const closeDayOfMonth = closeDay;
  // Kỳ chốt là tháng kế tiếp của kỳ đang xem — hiển thị "đầu tháng sau" theo đúng kỳ.
  const closeYm = (() => {
    const [y, m] = selectedYm.split('-').map(Number);
    const d = new Date(y, m, 1); // tháng kế tiếp: tháng gốc là chỉ số m (0-based) → tháng m+1
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  })();
  const closeYmLabel = (() => {
    const [y, m] = closeYm.split('-').map(Number);
    return `${String(closeDayOfMonth).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
  })();


  return (
    <div className="space-y-6">
      {/* Header — mockup `.phead` */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-accent-dark">
            <Table2 className="h-3.5 w-3.5" />
            Bảng công &amp; chốt lương
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <h1 className="font-display text-xl font-extrabold tracking-tight text-ink sm:text-[23px]">
              Bảng công &amp; chốt
            </h1>
            <Badge variant={sheetStatus === 'locked' ? 'gray' : sheetStatus === 'published' ? 'warn' : 'ok'} className="shrink-0">
              {sheetStatus === 'locked' ? 'Đã khoá' : sheetStatus === 'published' ? 'Đã chốt' : 'Đang mở'}
            </Badge>
            <span className="text-[11px] text-ink-muted">
              {sheetStatus === 'draft'
                ? 'Nhân viên khiếu nại được ngay khi kỳ còn mở'
                : sheetStatus === 'published'
                  ? (daysLeftToDeadline == null
                      ? `Còn ${disputeWindowDays} ngày khiếu nại; sau đó HR khoá`
                      : daysLeftToDeadline < 0
                        ? `Đã hết cửa sổ khiếu nại (hạn ${disputeDeadline}) — chờ khoá tự động`
                        : daysLeftToDeadline === 0
                          ? `Hôm nay là hạn cuối khiếu nại (${disputeDeadline}); sau đó tự khoá`
                          : `Còn ${daysLeftToDeadline} ngày khiếu nại (hạn ${disputeDeadline}); sau đó HR khoá`)
                  : allowAfterLock ? 'HR vẫn điều chỉnh được (lý do + audit)' : 'Chỉ đọc'}
            </span>
          </div>
          <p className="mt-1 text-xs text-ink-muted">
            Kỳ {selectedMonth} · {rows.length} nhân viên ·{' '}
            {monthDays.filter(d => d <= daysInSelectedMonth).length} cột ngày ·{' '}
            {isCurrentOrFuture
              ? 'Kỳ đang chạy — tự chốt ở đầu tháng sau'
              : `Chu kỳ đóng ${closeYmLabel}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="md"
            className="hidden sm:inline-flex"
            onClick={handleExportExcel}
            disabled={displayedRows.length === 0}
            title="Tải Excel 53 cột đúng các dòng đang hiển thị (bộ lọc nhóm, tìm kiếm, lọc nhanh)"
          >
            <Download className="h-4 w-4" />
            Xuất Excel
          </Button>
          <Button variant="outline" size="md" onClick={handlePublish} disabled={isLocked || sheetStatus === 'published' || isCurrentOrFuture}
            title={isCurrentOrFuture
              ? 'Chỉ chốt được kỳ đã kết thúc — kỳ đang chạy tự chốt theo ngày chốt cấu hình ở đầu tháng sau'
              : sheetStatus === 'draft' ? 'Chốt kỳ đã kết thúc để mở cửa sổ khiếu nại' : 'Kỳ đã chốt/khoá'}>
            <Megaphone className="h-4 w-4" />
            {sheetStatus === 'published' ? 'Đã chốt' : isCurrentOrFuture ? 'Chưa thể chốt' : 'Chốt bảng công'}
          </Button>
          <Button
            variant={isLocked ? 'secondary' : 'danger'}
            size="md"
            onClick={handleLockPayroll}
            disabled={isLocked || sheetStatus !== 'published'}
            title={sheetStatus === 'draft' ? 'Phải chốt bảng công trước khi khoá' : (isLocked ? 'Kỳ đã khoá' : 'Khoá ngay sau khi xử lý xong khiếu nại (còn đơn mở sẽ hỏi khoá cưỡng bức, có ghi audit)')}
          >
            <Lock className="h-4 w-4" />
            {isLocked ? 'Đã khoá kỳ công' : 'Khoá kỳ công'}
          </Button>
        </div>
      </div>

      {/* Stat row — mockup `.stats3` */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <div className="rounded-[13px] border border-line bg-surface p-3.5 shadow-2xs sm:p-[15px]">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-muted">
            <Users className="h-3.5 w-3.5 text-accent" />
            Nhân viên
          </div>
          <div className="mt-2 font-display text-2xl font-extrabold leading-none tracking-[-0.035em] text-ink">
            {rows.length}
          </div>
          <div className="mt-1.5 text-[11px] font-semibold text-ink-muted">
            {departmentCount} phòng ban · {displayedRows.length} dòng đang lọc
          </div>
        </div>

        <div className="rounded-[13px] border border-line bg-surface p-3.5 shadow-2xs sm:p-[15px]">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-muted">
            <CheckCircle2 className="h-3.5 w-3.5 text-accent" />
            Đã chấm công
          </div>
          <div className="mt-2 font-display text-2xl font-extrabold leading-none tracking-[-0.035em] text-ink">
            {loggedDaysPct}
            <small className="ml-1 text-xs font-semibold tracking-normal text-ink-muted">%</small>
          </div>
          <div className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-status-ok">
            <ArrowUpRight className="h-3 w-3" />
            {loggedDaysCount}/{rows.length} nhân viên có dữ liệu công
          </div>
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-status-ok" style={{ width: `${loggedDaysPct}%` }} />
          </div>
        </div>

        <div className="col-span-2 rounded-[13px] border border-line bg-surface p-3.5 shadow-2xs sm:col-span-1 sm:p-[15px]">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-muted">
            <AlertTriangle className="h-3.5 w-3.5 text-accent" />
            Chưa có log công
          </div>
          <div className="mt-2 font-display text-2xl font-extrabold leading-none tracking-[-0.035em] text-ink">
            {missingLogCount}
            <small className="ml-1 text-xs font-semibold tracking-normal text-ink-muted">NV</small>
          </div>
          <div className="mt-1.5 text-[11px] font-semibold text-status-warn">
            {missingLogCount === 0
              ? 'Mọi nhân viên đều đã có dữ liệu chấm công'
              : `Cần rà soát log chấm công trước ${closeYmLabel}`}
          </div>
        </div>
      </div>


      {conflictMsg && <div className="p-3 bg-status-danger-soft border border-status-danger-line rounded-xl text-xs text-status-danger">{conflictMsg}</div>}

      {/* Toast Alert */}
      {toastMsg && (
        <div className="flex items-start gap-2 rounded-xl border border-status-ok-line bg-status-ok-soft p-3 text-xs font-bold text-status-ok animate-in fade-in">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Floating Bulk Action Bar (Feature C4) */}
      {selectedIds.length > 0 && (
        <div className="p-3 bg-status-ok-soft border border-status-ok-line rounded-xl flex items-center justify-between text-xs text-status-ok shadow-lg animate-in slide-in-from-top duration-200">
          <div className="flex items-center gap-2 font-bold">
            <span className="inline-flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5" />
              Đã chọn <strong>{selectedIds.length}</strong> nhân sự
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="primary" size="sm" onClick={() => setIsBulkEditOpen(true)}>
              Sửa hàng loạt
            </Button>
            <Button variant="outline" size="sm" onClick={() => setSelectedIds([])}>
              Bỏ chọn
            </Button>
          </div>
        </div>
      )}

      {/* Filter Toolbar (Feature C5) — mockup `.filters` */}
      <div className="rounded-[13px] border border-line bg-surface p-3 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <label className="inline-flex h-[34px] items-center gap-2 rounded-[9px] border border-line bg-canvas px-2.5">
            <span className="text-[11px] font-semibold text-ink-muted">Kỳ</span>
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="border-0 bg-transparent p-0 text-xs font-medium text-ink outline-none"
            >
              <option value="11/2026">Tháng 11 / 2026 (Hiện tại)</option>
              <option value="10/2026">Tháng 10 / 2026</option>
              <option value="09/2026">Tháng 09 / 2026</option>
            </select>
          </label>

          <label className="inline-flex h-[34px] items-center gap-2 rounded-[9px] border border-line bg-canvas px-2.5">
            <span className="text-[11px] font-semibold text-ink-muted">Nhóm</span>
            <select
              value={filterDept}
              onChange={e => setFilterDept(e.target.value)}
              className="max-w-[160px] border-0 bg-transparent p-0 text-xs font-medium text-ink outline-none"
            >
              <option value="ALL">Tất cả nhóm</option>
              {Array.from(new Set(rows.map(r => r.team).filter(t => t && t !== '—'))).map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>

          <label className="inline-flex h-[34px] min-w-[200px] flex-1 items-center gap-2 rounded-[9px] border border-line bg-canvas px-2.5">
            <Search className="h-3.5 w-3.5 shrink-0 text-ink-muted" />
            <input
              type="text"
              placeholder="Tìm theo tên hoặc mã NV..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full border-0 bg-transparent p-0 text-xs text-ink outline-none placeholder:text-ink-muted"
            />
          </label>

          {/* Quick Filter Chips (C5) — mockup `.chip`: cao 31px, pill, active nền ink */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { key: 'ALL' as const, label: `Tất cả (${rows.length})`, dot: null },
              { key: 'LATE' as const, label: 'Đi muộn', dot: 'bg-status-warn' },
              { key: 'OT' as const, label: 'Có OT', dot: 'bg-status-info' },
              { key: 'DEFICIT' as const, label: 'Thiếu công', dot: 'bg-status-danger' },
            ].map((chip) => {
              const active = quickFilter === chip.key;
              return (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => setQuickFilter(chip.key)}
                  aria-pressed={active}
                  className={`inline-flex h-[30px] items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors ${
                    active
                      ? 'border-ink bg-ink text-canvas'
                      : 'border-line bg-surface text-ink-secondary hover:border-line-hover'
                  }`}
                >
                  {chip.dot && <span className={`h-1.5 w-1.5 rounded-full ${chip.dot}`} />}
                  {chip.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px]">
          {searchQuery && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-line bg-accent-soft px-2 py-1 text-accent-dark">
              Từ khoá: {searchQuery}
              <button type="button" onClick={() => setSearchQuery('')} title="Xoá từ khoá" className="cursor-pointer">
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {filterDept !== 'ALL' && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-line bg-accent-soft px-2 py-1 text-accent-dark">
              Nhóm: {filterDept}
              <button type="button" onClick={() => setFilterDept('ALL')} title="Xoá lọc nhóm" className="cursor-pointer">
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {quickFilter !== 'ALL' && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-line bg-accent-soft px-2 py-1 text-accent-dark">
              Lọc: {quickFilter}
              <button type="button" onClick={() => setQuickFilter('ALL')} title="Xoá lọc nhanh" className="cursor-pointer">
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          <button type="button" onClick={saveView} className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-ink-secondary hover:border-line-hover">
            <Bookmark className="h-3 w-3" />
            Lưu view
          </button>
          <button type="button" onClick={shareView} className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-ink-secondary hover:border-line-hover">
            <Link2 className="h-3 w-3" />
            Chia sẻ
          </button>
          <select
            onChange={e => { const v = savedViews.find(x => x.name === e.target.value); if (v) applyView(v.f); }}
            className="rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] text-ink-secondary"
            defaultValue=""
          >
            <option value="" disabled>View đã lưu…</option>
            {savedViews.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
          </select>
        </div>

        {/* Xuất Excel nằm ngay dưới bộ lọc và xuất đúng phạm vi đang lọc (nhóm + kỳ). */}
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2.5 text-[11px] text-ink-muted">
          <span>
            Xuất Excel theo bộ lọc hiện tại:{' '}
            <strong className="text-ink">{filterDept === 'ALL' ? 'Tất cả nhóm' : `Nhóm ${filterDept}`}</strong>
            {' · '}kỳ <strong className="text-ink">{selectedMonth}</strong>
            {' · '}<strong className="text-ink">{displayedRows.length}</strong>/{rows.length} nhân viên
          </span>
          <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={displayedRows.length === 0}
            title="Tải Excel 53 cột đúng các dòng đang hiển thị (bộ lọc nhóm, tìm kiếm, lọc nhanh)">
            <Download className="h-3.5 w-3.5" />
            Xuất Excel ({displayedRows.length} NV)
          </Button>
        </div>
      </div>


      {/* Bảng công 53 cột: 5 thông tin + 31 cột ngày + 17 cột tổng hợp */}
      <div className="rounded-[13px] border border-line bg-surface shadow-2xs overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          <h2 className="text-[13.5px] font-bold tracking-[-0.01em] text-ink">Dữ liệu bảng công</h2>
          <span className="ml-auto font-mono text-[10.5px] text-ink-muted">
            {displayedRows.length}/{rows.length} NV
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line px-4 py-2.5 text-[11px] text-ink-muted">
          <span className="font-semibold text-ink-secondary">Màu cột ngày:</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px] border border-line-hover/70 bg-line/80" />
            Cuối tuần
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px] border border-status-warn-line bg-status-warn-soft" />
            Ngày lễ
          </span>
          <span className="ml-auto hidden sm:inline">Nhấp đúp ô để sửa ký hiệu</span>
          <span className="sm:hidden">Vuốt ngang để xem thêm cột — cột Mã NV cố định</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-[11.5px] whitespace-nowrap">
            <thead>
              <tr className="bg-canvas border-b border-line text-ink-secondary">
                <th className="py-2.5 px-2 text-center sticky left-0 bg-canvas z-20 border-r border-line text-[9.5px] font-extrabold uppercase tracking-[0.07em] text-ink-muted">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === displayedRows.length && displayedRows.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded cursor-pointer"
                  />
                </th>
                <th className="py-2.5 px-2 text-center sticky left-[32px] bg-canvas z-10 border-r border-line text-[9.5px] font-extrabold uppercase tracking-[0.07em] text-ink-muted">STT</th>
                <th className="py-2.5 px-2 sticky left-[64px] bg-canvas z-10 border-r border-line text-[9.5px] font-extrabold uppercase tracking-[0.07em] text-ink-muted">Mã NV</th>
                <th className="py-2.5 px-2 sticky left-[136px] bg-canvas z-10 border-r border-line text-[9.5px] font-extrabold uppercase tracking-[0.07em] text-ink-muted">Họ Tên</th>
                <th className="py-2.5 px-2 text-[9.5px] font-extrabold uppercase tracking-[0.07em] text-ink-muted">Chức vụ</th>
                <th className="py-2.5 px-2 border-r border-line text-[9.5px] font-extrabold uppercase tracking-[0.07em] text-ink-muted">Nhóm</th>
                {monthDays.map((d) => (
                  <th
                    key={d}
                    title={`Ngày ${d}/${calendarMonth}${dayHint(d)}`}
                    className={`py-3 px-1.5 text-center border-r border-line ${dayTint(d, 'head') || 'bg-surface-secondary/60'}`}
                  >
                    {d}
                  </th>
                ))}
                <th className="py-2.5 px-2 text-center bg-surface-secondary border-x border-line text-[9.5px] font-extrabold uppercase tracking-[0.07em] text-ink-muted">Công chuẩn</th>
                <th className="py-2.5 px-2 text-center text-[9.5px] font-extrabold uppercase tracking-[0.07em] text-ink-muted">Công thực tế</th>
                <th className="py-2.5 px-2 text-center text-[9.5px] font-extrabold uppercase tracking-[0.07em] text-ink-muted">Nghỉ phép (AL)</th>
                <th className="py-2.5 px-2 text-center text-[9.5px] font-extrabold uppercase tracking-[0.07em] text-ink-muted">WFH (R)</th>
                <th className="py-2.5 px-2 text-center text-[9.5px] font-extrabold uppercase tracking-[0.07em] text-ink-muted">Đi muộn</th>
                <th className="py-2.5 px-2 text-center text-[9.5px] font-extrabold uppercase tracking-[0.07em] text-status-danger">Trừ đi muộn</th>
                <th className="py-2.5 px-2 text-center text-[9.5px] font-extrabold uppercase tracking-[0.07em] text-ink-muted">OT ngày thường</th>
                <th className="py-2.5 px-2 text-center text-[9.5px] font-extrabold uppercase tracking-[0.07em] text-ink-muted">OT cuối tuần</th>
                <th className="py-2.5 px-2 text-center text-[9.5px] font-extrabold uppercase tracking-[0.07em] text-ink-muted">Tổng công QĐ lương</th>
                <th className="py-2.5 px-2 text-center text-[9.5px] font-extrabold uppercase tracking-[0.07em] text-ink-muted">Trạng thái</th>
                <th className="py-2.5 px-2 text-center text-[9.5px] font-extrabold uppercase tracking-[0.07em] text-ink-muted">Nghỉ lễ (NL)</th>
                <th className="py-2.5 px-2 text-center text-[9.5px] font-extrabold uppercase tracking-[0.07em] text-ink-muted">Nghỉ không lương (UP)</th>
                <th className="py-2.5 px-2 text-center text-[9.5px] font-extrabold uppercase tracking-[0.07em] text-ink-muted">Nghỉ ốm (S)</th>
                <th className="py-2.5 px-2 text-center text-[9.5px] font-extrabold uppercase tracking-[0.07em] text-ink-muted">Nghỉ bù (RO)</th>
                <th className="py-2.5 px-2 text-center text-[9.5px] font-extrabold uppercase tracking-[0.07em] text-ink-muted">Thai sản (ML)</th>
                <th className="py-2.5 px-2 text-center text-[9.5px] font-extrabold uppercase tracking-[0.07em] text-ink-muted">Tổng ngày nghỉ</th>
                <th className="py-2.5 px-2 text-center text-[9.5px] font-extrabold uppercase tracking-[0.07em] text-ink-muted">Phép còn lại</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {displayedRows.map((r, idx) => (
                <tr key={r.id} className="hover:bg-canvas/40 transition-colors">
                  <td className="py-2 px-2 text-center sticky left-0 bg-surface z-10 border-r border-line">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(r.id)}
                      onChange={() => toggleSelectRow(r.id)}
                      className="rounded cursor-pointer"
                    />
                  </td>
                  <td className="py-2 px-2 text-center sticky left-[32px] bg-surface z-10 border-r border-line">{idx + 1}</td>
                  <td className="py-2 px-2 font-mono font-medium text-ink sticky left-[64px] bg-surface z-10 border-r border-line">
                    {r.code}
                  </td>
                  <td className="py-2 px-2 font-medium text-ink sticky left-[136px] bg-surface z-10 border-r border-line">
                    {r.fullName}
                  </td>
                  <td className="py-2 px-2 text-ink-secondary">{r.positionName || '—'}</td>
                  <td className="py-2 px-2 text-ink-secondary border-r border-line">{r.team}</td>
                  {monthDays.map((d) => {
                    const symbol = daySymbol(r, d);
                    const edited = Boolean(dayOverrides[`${r.id}-${d}`]);
                    return (
                      <td
                        key={d}
                        title={`Ngày ${d}/${calendarMonth}${dayHint(d)} — nhấp đúp để sửa`}
                        onDoubleClick={() => editDayCell(r, d)}
                        className={`py-2 px-1.5 text-center font-mono border-r border-line cursor-pointer hover:bg-accent-soft/60 ${dayTint(d, 'body')} ${
                          edited ? 'text-status-danger font-bold' : ''
                        }`}
                      >
                        {symbol}
                      </td>
                    );
                  })}
                  <td className="py-2 px-2 text-center font-bold text-ink bg-surface-secondary/50 border-x border-line">{r.standardDays}</td>
                  <td className="py-2 px-2 text-center font-medium">{r.actualWorkDays}</td>
                  <td className="py-2 px-2 text-center">{r.paidLeaveDays}</td>
                  <td className="py-2 px-2 text-center">{r.wfhDays}</td>
                  <td className="py-2 px-2 text-center font-mono">{r.lateCount}</td>
                  <td className="py-2 px-2 text-center text-status-danger">{r.penaltyLatePercent}%</td>
                  <td className="py-2 px-2 text-center">{r.otWeekdayHours}</td>
                  <td className="py-2 px-2 text-center">{r.otWeekendHours}</td>
                  <td className="py-2 px-2 text-center font-bold text-accent-dark bg-accent-soft/30 border-l border-line">{r.totalPayrollDays}</td>
                  <td className="py-2 px-2 text-center">
                    <Badge variant={r.status === 'HR_LOCKED' ? 'gray' : 'ok'}>{r.status === 'HR_LOCKED' ? 'Đã khóa' : 'Đang mở'}</Badge>
                  </td>
                  <td className="py-2 px-2 text-center">{r.holidayDays}</td>
                  <td className="py-2 px-2 text-center">{r.unpaidDays}</td>
                  <td className="py-2 px-2 text-center">{r.sickDays}</td>
                  <td className="py-2 px-2 text-center">{r.compDays}</td>
                  <td className="py-2 px-2 text-center">{r.maternityDays}</td>
                  <td className="py-2 px-2 text-center">{r.paidLeaveDays + r.holidayDays + r.sickDays + r.sickBhDays + r.compDays + r.unpaidDays + r.maternityDays + r.paternityDays + r.specialLeaveDays}</td>
                  <td className="py-2 px-2 text-center font-semibold">{r.remainingLeave.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Chú thích ký hiệu dùng trong 31 cột ngày — mockup `.legend-grid` */}
      <div className="rounded-[13px] border border-line bg-surface shadow-2xs overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          <h2 className="text-[13.5px] font-bold tracking-[-0.01em] text-ink">Chú thích ký hiệu</h2>
          <span className="ml-auto text-[10.5px] text-ink-muted">
            Ô nghỉ nửa ngày thêm hậu tố <span className="font-mono">/0.50</span>
          </span>
        </div>
        <div className="grid grid-cols-1 gap-x-5 px-4 py-3 sm:grid-cols-2">
          {symbolLegend.map((item) => (
            <div key={item.code} className="flex items-baseline gap-2.5 border-b border-dashed border-line-soft py-1.5 text-[11.5px]">
              <code className="w-[58px] shrink-0 font-mono text-[11px] font-bold text-ink">{item.code}</code>
              <span className="text-ink-secondary">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bulk Edit Modal (Feature C4) */}
      <Modal
        isOpen={isBulkEditOpen}
        onClose={() => setIsBulkEditOpen(false)}
        title={`Sửa hàng loạt bảng công cho ${selectedIds.length} nhân sự`}
      >
        <form onSubmit={handleBulkApply} className="space-y-4 text-xs">
          <div>
            <label className="block text-ink font-semibold mb-1">Chỉ tiêu công cần điều chỉnh</label>
            <select
              value={bulkAdjustment.field}
              onChange={e => setBulkAdjustment({ ...bulkAdjustment, field: e.target.value })}
              className="w-full p-2.5 border border-line rounded-lg bg-surface font-medium text-ink"
            >
              <option value="paidLeaveDays">Nghỉ Phép Hưởng Lương (Ngày)</option>
              <option value="actualWorkDays">Công Đi Làm Thực Tế (Ngày)</option>
              <option value="otWeekdayHours">Giờ Làm Thêm OT Ngày Thường (Giờ)</option>
              <option value="penaltyLatePercent">Xóa Phạt Đi Muộn (Về 0%)</option>
            </select>
          </div>

          <div>
            <label className="block text-ink font-semibold mb-1">Số lượng cộng thêm / điều chỉnh</label>
            <input
              type="number"
              step="0.5"
              value={bulkAdjustment.amount}
              onChange={e => setBulkAdjustment({ ...bulkAdjustment, amount: e.target.value })}
              className="w-full p-2.5 border border-line rounded-lg bg-surface font-bold text-ink"
              required
            />
          </div>

          <div>
            <label className="block text-ink font-semibold mb-1">Lý do điều chỉnh (Audit Trail)</label>
            <textarea
              rows={3}
              value={bulkAdjustment.reason}
              onChange={e => setBulkAdjustment({ ...bulkAdjustment, reason: e.target.value })}
              className="w-full p-2.5 border border-line rounded-lg bg-surface text-ink"
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={() => setIsBulkEditOpen(false)}>
              Hủy
            </Button>
            <Button variant="primary" type="submit">
              Xác Nhận Áp Dụng Hàng Loạt
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Cell Modal */}
      {editingCell && (
        <Modal
          isOpen={true}
          onClose={() => setEditingCell(null)}
          title={`Điều Chỉnh Công Thủ Công: ${editingCell.row.fullName} (${editingCell.row.code})`}
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-ink-muted mb-1">Chỉ tiêu điều chỉnh: <strong>{editingCell.field}</strong></label>
              <input
                type="number"
                step="0.5"
                value={editingCell.val}
                onChange={e => setEditingCell({ ...editingCell, val: parseFloat(e.target.value) || 0 })}
                className="w-full p-2 border border-line rounded-lg bg-canvas text-sm font-bold"
              />
            </div>

            <div>
              <label className="block text-ink mb-1 font-medium">Lý do điều chỉnh (Bắt buộc lưu vết Audit Log) <span className="text-status-danger">*</span></label>
              <textarea
                rows={3}
                placeholder="Ví dụ: Bổ sung công 0.5 ngày theo xác nhận trực tiếp của Trưởng phòng..."
                value={overrideReason}
                onChange={e => setOverrideReason(e.target.value)}
                className="w-full p-2 border border-line rounded-lg bg-canvas"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <Button variant="outline" size="sm" onClick={() => setEditingCell(null)}>
                Hủy
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveCellOverride}
                disabled={!overrideReason.trim()}
              >
                Lưu Thay Đổi &amp; Ghi Vết
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
