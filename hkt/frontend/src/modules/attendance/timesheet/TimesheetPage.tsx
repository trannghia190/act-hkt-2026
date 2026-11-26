import React, { useEffect, useState } from 'react';
import { buildTimesheetXlsx } from './timesheetXlsx';
import { Card } from '../../../components/common/Card';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { Modal } from '../../../components/common/Modal';

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
  const legendRows: ({ code: string; label: string } | undefined)[][] = [];
  for (let i = 0; i < symbolLegend.length; i += 2) legendRows.push([symbolLegend[i], symbolLegend[i + 1]]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-ink">Bảng Tổng Hợp Công &amp; Chốt Lương (Master Timesheet)</h1>
            <Badge variant={sheetStatus === 'locked' ? 'gray' : sheetStatus === 'published' ? 'warn' : 'ok'}>{sheetStatus === 'locked' ? 'Đã khoá (hết hạn khiếu nại)' : sheetStatus === 'published' ? 'Đã chốt — đang nhận khiếu nại' : 'Đang mở (đang chạy)'}</Badge>
            <span className="text-[11px] text-ink-muted ml-2">
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
          <p className="text-xs text-ink-muted mt-1">
            Bảng điều khiển 45 chỉ tiêu công, tự động tính trừ chuyên cần theo luật, cộng công thêm giờ (OT) và cho phép HR điều chỉnh kèm lưu vết
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePublish} disabled={isLocked || sheetStatus === 'published' || isCurrentOrFuture}
            title={isCurrentOrFuture
              ? 'Chỉ chốt được kỳ đã kết thúc — kỳ đang chạy tự chốt theo ngày chốt cấu hình ở đầu tháng sau'
              : sheetStatus === 'draft' ? 'Chốt kỳ đã kết thúc để mở cửa sổ khiếu nại' : 'Kỳ đã chốt/khoá'}>
            📣 {sheetStatus === 'published' ? 'Đã chốt' : isCurrentOrFuture ? 'Chưa thể chốt' : 'Chốt bảng công'}
          </Button>
          <Button
            variant={isLocked ? 'secondary' : 'primary'}
            size="sm"
            onClick={handleLockPayroll}
            disabled={isLocked || sheetStatus !== 'published'}
            title={sheetStatus === 'draft' ? 'Phải chốt bảng công trước khi khoá' : (isLocked ? 'Kỳ đã khoá' : 'Khoá ngay sau khi xử lý xong khiếu nại (còn đơn mở sẽ hỏi khoá cưỡng bức, có ghi audit)')}
          >
            {isLocked ? (allowAfterLock ? '🔒 Đã khoá (cho phép sửa theo cấu hình)' : '🔒 Đã Khóa Kỳ Công Tháng') : '🔒 Khóa Bảng Công Tháng'}
          </Button>
        </div>
      </div>

      {conflictMsg && <div className="p-3 bg-status-danger-soft border border-status-danger-line rounded-xl text-xs text-status-danger">{conflictMsg}</div>}

      {/* Toast Alert */}
      {toastMsg && (
        <div className="p-3 bg-status-ok/10 border border-status-ok/30 rounded-xl text-status-ok text-xs font-bold animate-in fade-in">
          ✓ {toastMsg}
        </div>
      )}

      {/* Floating Bulk Action Bar (Feature C4) */}
      {selectedIds.length > 0 && (
        <div className="p-3 bg-status-ok-soft border border-status-ok-line rounded-xl flex items-center justify-between text-xs text-status-ok shadow-lg animate-in slide-in-from-top duration-200">
          <div className="flex items-center gap-2 font-bold">
            <span>⚡ Đã chọn <strong>{selectedIds.length}</strong> nhân sự</span>
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

      {/* Filter Toolbar (Feature C5) */}
      <Card>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div>
            <label className="text-ink-muted mr-2">Kỳ tính công:</label>
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="p-1.5 border border-line rounded-lg bg-canvas font-medium"
            >
              <option value="11/2026">Tháng 11 / 2026 (Hiện tại)</option>
              <option value="10/2026">Tháng 10 / 2026</option>
              <option value="09/2026">Tháng 09 / 2026</option>
            </select>
          </div>

          <div>
            <label className="text-ink-muted mr-2">Nhóm:</label>
            <select
              value={filterDept}
              onChange={e => setFilterDept(e.target.value)}
              className="p-1.5 border border-line rounded-lg bg-canvas font-medium"
            >
              <option value="ALL">Tất cả nhóm</option>
              {Array.from(new Set(rows.map(r => r.team).filter(t => t && t !== '—'))).map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Tìm theo tên hoặc mã NV..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full p-1.5 border border-line rounded-lg bg-canvas text-xs"
            />
          </div>

          {/* Quick Filter Chips (C5) */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setQuickFilter('ALL')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                quickFilter === 'ALL' ? 'bg-accent text-on-accent' : 'bg-canvas text-ink-muted hover:text-ink'
              }`}
            >
              Tất cả ({rows.length})
            </button>
            <button
              type="button"
              onClick={() => setQuickFilter('LATE')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                quickFilter === 'LATE' ? 'bg-status-warn text-on-warn' : 'bg-canvas text-status-warn hover:text-status-warn'
              }`}
            >
              ⚠️ Đi muộn
            </button>
            <button
              type="button"
              onClick={() => setQuickFilter('OT')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                quickFilter === 'OT' ? 'bg-status-info text-on-info' : 'bg-canvas text-status-info hover:text-status-info'
              }`}
            >
              ⚡ Có OT
            </button>
            <button
              type="button"
              onClick={() => setQuickFilter('DEFICIT')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                quickFilter === 'DEFICIT' ? 'bg-status-danger text-on-danger' : 'bg-canvas text-status-danger hover:text-status-danger'
              }`}
            >
              🔻 Thiếu công
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px]">
            {searchQuery && <span className="px-2 py-1 rounded-full bg-accent-soft text-accent-dark border border-accent-line">Từ khoá: {searchQuery} <button onClick={() => setSearchQuery('')}>✕</button></span>}
            {filterDept !== 'ALL' && <span className="px-2 py-1 rounded-full bg-accent-soft text-accent-dark border border-accent-line">Nhóm: {filterDept} <button onClick={() => setFilterDept('ALL')}>✕</button></span>}
            {quickFilter !== 'ALL' && <span className="px-2 py-1 rounded-full bg-accent-soft text-accent-dark border border-accent-line">Lọc: {quickFilter} <button onClick={() => setQuickFilter('ALL')}>✕</button></span>}
            <button onClick={saveView} className="px-2 py-1 rounded-full border border-line">💾 Lưu view</button>
            <button onClick={shareView} className="px-2 py-1 rounded-full border border-line">🔗 Chia sẻ</button>
            <select onChange={e => { const v = savedViews.find(x => x.name === e.target.value); if (v) applyView(v.f); }}
              className="px-2 py-1 rounded-full border border-line bg-surface" defaultValue="">
              <option value="" disabled>View đã lưu…</option>
              {savedViews.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
            </select>
          </div>

          {/* Xuất Excel nằm ngay dưới bộ lọc và xuất đúng phạm vi đang lọc (nhóm + kỳ). */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
            <span className="text-[11px] text-ink-muted">
              Xuất Excel theo bộ lọc hiện tại:{' '}
              <strong className="text-ink">{filterDept === 'ALL' ? 'Tất cả nhóm' : `Nhóm ${filterDept}`}</strong>
              {' · '}kỳ <strong className="text-ink">{selectedMonth}</strong>
              {' · '}{displayedRows.length}/{rows.length} nhân viên
            </span>
            <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={displayedRows.length === 0}
              title="Tải CSV 53 cột đúng các dòng đang hiển thị (bộ lọc nhóm, tìm kiếm, lọc nhanh)">
              📥 Xuất Excel ({displayedRows.length} NV)
            </Button>
          </div>
        </div>
      </Card>

      {/* Bảng công 53 cột: 5 thông tin + 31 cột ngày + 17 cột tổng hợp */}
      <div className="bg-surface rounded-xl border border-line shadow-2xs overflow-hidden">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 border-b border-line text-[11px] text-ink-muted">
          <span className="font-semibold text-ink-secondary">Màu cột ngày:</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm border border-line-hover/70 bg-line/80" />
            Cuối tuần
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm border border-status-warn-line bg-status-warn-soft" />
            Ngày lễ
          </span>
          <span className="ml-auto hidden sm:inline">Nhấp đúp ô để sửa ký hiệu</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
            <thead>
              <tr className="bg-canvas border-b border-line text-ink-secondary font-medium">
                <th className="py-3 px-2 text-center sticky left-0 bg-canvas z-20 border-r border-line">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === displayedRows.length && displayedRows.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded cursor-pointer"
                  />
                </th>
                <th className="py-3 px-2 text-center sticky left-[32px] bg-canvas z-10 border-r border-line">STT</th>
                <th className="py-3 px-2 sticky left-[64px] bg-canvas z-10 border-r border-line">Mã NV</th>
                <th className="py-3 px-2 sticky left-[136px] bg-canvas z-10 border-r border-line">Họ Tên</th>
                <th className="py-3 px-2">Chức vụ</th>
                <th className="py-3 px-2 border-r border-line">Nhóm</th>
                {monthDays.map((d) => (
                  <th
                    key={d}
                    title={`Ngày ${d}/${calendarMonth}${dayHint(d)}`}
                    className={`py-3 px-1.5 text-center border-r border-line ${dayTint(d, 'head') || 'bg-surface-secondary/60'}`}
                  >
                    {d}
                  </th>
                ))}
                <th className="py-3 px-2 text-center bg-surface-secondary border-x border-line">Công chuẩn</th>
                <th className="py-3 px-2 text-center">Công thực tế</th>
                <th className="py-3 px-2 text-center">Nghỉ phép (AL)</th>
                <th className="py-3 px-2 text-center">WFH (R)</th>
                <th className="py-3 px-2 text-center">Đi muộn</th>
                <th className="py-3 px-2 text-center text-status-danger">Trừ đi muộn</th>
                <th className="py-3 px-2 text-center">OT ngày thường</th>
                <th className="py-3 px-2 text-center">OT cuối tuần</th>
                <th className="py-3 px-2 text-center">Tổng công QĐ lương</th>
                <th className="py-3 px-2 text-center">Trạng thái</th>
                <th className="py-3 px-2 text-center">Nghỉ lễ (NL)</th>
                <th className="py-3 px-2 text-center">Nghỉ không lương (UP)</th>
                <th className="py-3 px-2 text-center">Nghỉ ốm (S)</th>
                <th className="py-3 px-2 text-center">Nghỉ bù (RO)</th>
                <th className="py-3 px-2 text-center">Thai sản (ML)</th>
                <th className="py-3 px-2 text-center">Tổng ngày nghỉ</th>
                <th className="py-3 px-2 text-center">Phép còn lại</th>
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

      {/* Chú thích ký hiệu dùng trong 31 cột ngày */}
      <Card>
        <div className="flex flex-wrap items-baseline gap-2 mb-3">
          <h2 className="text-sm font-bold text-ink">Chú thích ký hiệu</h2>
          <span className="text-[11px] text-ink-muted">Ô nghỉ nửa ngày hiển thị thêm hậu tố <span className="font-mono">/0.50</span></span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-canvas border-b border-line text-ink-secondary font-medium">
                <th className="py-1.5 px-2 w-24">Ký hiệu</th>
                <th className="py-1.5 px-2">Ý nghĩa</th>
                <th className="py-1.5 px-2 w-24 border-l border-line">Ký hiệu</th>
                <th className="py-1.5 px-2">Ý nghĩa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {legendRows.map((pair, i) => (
                <tr key={i} className="hover:bg-canvas/40">
                  <td className="py-1.5 px-2 font-mono font-semibold text-ink whitespace-nowrap">{pair[0]?.code ?? ''}</td>
                  <td className="py-1.5 px-2 text-ink-secondary">{pair[0]?.label ?? ''}</td>
                  <td className="py-1.5 px-2 font-mono font-semibold text-ink whitespace-nowrap border-l border-line">{pair[1]?.code ?? ''}</td>
                  <td className="py-1.5 px-2 text-ink-secondary">{pair[1]?.label ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

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
