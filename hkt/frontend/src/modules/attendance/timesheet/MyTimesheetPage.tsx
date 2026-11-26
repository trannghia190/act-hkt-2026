import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '../../../components/common/Button';
import { Badge } from '../../../components/common/Badge';
import { Modal } from '../../../components/common/Modal';
import { useAuth } from '../../../context/AuthContext';
import {
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Clock,
  FileSpreadsheet,
  Hourglass,
  Info,
  Lock,
  MonitorSmartphone,
  PenLine,
  Printer,
} from 'lucide-react';

interface DayItem {
  day: number;
  date: string;
  weekday: string;
  isWeekend: boolean;
  isHoliday?: boolean;
  checkIn?: string | null;
  checkOut?: string | null;
  hoursWorked?: number;
  lateMinutes?: number;
  status: string;
  statusText: string;
  symbol: string;
  dispute?: {
    id: string;
    status: string;
    reason: string;
    count?: number; // số đơn đã gửi cho ngày này (tối đa 2)
  } | null;
}

interface TimesheetData {
  month: string;
  daysInMonth: number;
  status: string; // 'draft' | 'published' | 'locked'
  periodStatus: 'OPEN' | 'UNPUBLISHED' | 'DISPUTABLE' | 'EXPIRED' | 'LOCKED' | 'DRAFT';
  canDispute: boolean;
  publishDay?: number;
  closeDay?: number;
  disputeDeadline: string;
  standardDays: number;
  actualDays: number;
  wfhDays: number;
  leaveDays: number;
  lateCount: number;
  holidayDays: number;
  sickDays: number;
  compDays: number;
  unpaidDays: number;
  totalDays: number;
  remainingLeave: number;
  employeeCode?: string;
  employeeName?: string;
  shiftCode?: string;
  shiftName?: string;
  shiftCheckInStart?: string;
  shiftCheckOutEnd?: string;
  shiftRequiredWorkHours?: number;
  shiftIsException?: boolean;
  days: DayItem[];
}

const authHeaders = (): Record<string, string> => {
  try {
    const u = JSON.parse(localStorage.getItem('pulse_auth_user') || '{}');
    return u?.accessToken ? { Authorization: `Bearer ${u.accessToken}` } : {};
  } catch {
    return {};
  }
};

type PeriodStatus = TimesheetData['periodStatus'];

/**
 * Bảng ánh xạ trạng thái kỳ → banner. Dùng Record để TypeScript bắt buộc
 * phải khai báo ĐỦ mọi trạng thái — thêm trạng thái mới mà quên xử lý sẽ lỗi build,
 * thay vì rơi vào nhánh else và hiển thị sai (lỗi đã từng xảy ra: draft hiện "đã khoá").
 */
const PERIOD_BANNER: Record<
  PeriodStatus,
  { icon: React.ComponentType<{ className?: string }>; title: string; cls: string; chip: string; badge: 'accent' | 'warn' | 'gray' | 'ok' }
> = {
  OPEN: { icon: CircleDot, title: 'Bảng công đang mở', cls: 'bg-status-info-soft border-status-info-line text-status-info', chip: 'Có thể khiếu nại', badge: 'accent' },
  UNPUBLISHED: { icon: Hourglass, title: 'Bảng công tạm tính (chưa công bố)', cls: 'bg-status-warn-soft border-status-warn-line text-status-warn', chip: 'Chưa công bố', badge: 'warn' },
  DRAFT: { icon: CircleDot, title: 'Bảng công đang mở', cls: 'bg-status-info-soft border-status-info-line text-status-info', chip: 'Có thể khiếu nại', badge: 'accent' },
  DISPUTABLE: { icon: CheckCircle2, title: 'Bảng công đã công bố', cls: 'bg-status-ok-soft border-status-ok-line text-status-ok', chip: 'Đang mở khiếu nại', badge: 'ok' },
  EXPIRED: { icon: Clock, title: 'Đã hết hạn khiếu nại', cls: 'bg-surface-secondary border-line-hover text-ink', chip: 'Đã hết hạn', badge: 'gray' },
  LOCKED: { icon: Lock, title: 'Kỳ công đã chốt và khóa', cls: 'bg-status-danger-soft border-status-danger-line text-status-danger', chip: 'Đã khóa', badge: 'gray' },
};

/** Mô tả phụ — switch có kiểm tra `never` để không bao giờ bỏ sót trạng thái. */
const periodDescription = (s: PeriodStatus, d: TimesheetData): string => {
  switch (s) {
    case 'OPEN': return `Bảng công tháng đang mở — bạn có thể gửi khiếu nại ngay. Kỳ sẽ được HR chốt vào ngày ${d.closeDay ?? d.publishDay ?? 1} tháng sau.`;
    case 'DISPUTABLE': {
      const [y, m, dd] = String(d.disputeDeadline || '').slice(0, 10).split('-');
      const shown = dd ? `${dd}/${m}/${y}` : String(d.disputeDeadline || '—');
      return `Hạn khiếu nại công: đến hết ngày ${shown}. Hãy kiểm tra kỹ từng ngày công.`;
    }
    case 'UNPUBLISHED': return `Bảng công đang tạm tính. Kỳ trước sẽ được HR chốt vào ngày ${d.closeDay ?? 1} hàng tháng.`;
    case 'DRAFT': return `Bảng công đang mở — bạn có thể gửi khiếu nại ngay. Kỳ sẽ được chốt vào ngày ${d.closeDay ?? d.publishDay ?? 1} tháng sau.`;
    case 'EXPIRED': return 'Đã qua thời hạn 2 ngày kể từ khi công bố. Nút khiếu nại đã bị khóa tự động theo quy chế.';
    case 'LOCKED': return 'Kỳ công đã chốt bởi HR và khóa sổ lương — không thể chỉnh sửa hay khiếu nại.';
    default: { const unreachable: never = s; return unreachable; }
  }
};

export const MyTimesheetPage: React.FC = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showAllStats, setShowAllStats] = useState(false);

  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const selectedMonth = searchParams.get('month') || currentMonthStr;
  const viewedEmployeeCode = searchParams.get('employeeCode') || '';
  const isOwnTimesheet = !viewedEmployeeCode || viewedEmployeeCode === user?.employeeCode;

  const [data, setData] = useState<TimesheetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dispute modal state
  const [disputeDay, setDisputeDay] = useState<DayItem | null>(null);
  const [disputeReason, setDisputeReason] = useState('');
  // Giờ vào/ra nhân viên đề xuất — HR duyệt FIX sẽ áp thẳng vào bảng công.
  const [disputeCheckIn, setDisputeCheckIn] = useState('');
  const [disputeCheckOut, setDisputeCheckOut] = useState('');
  // Ngày đó nên thành gì: sửa giờ | WFH | nghỉ theo danh mục loại nghỉ.
  const [disputeKind, setDisputeKind] = useState<'TIME_FIX' | 'WFH' | 'LEAVE'>('TIME_FIX');
  const [disputeLeaveType, setDisputeLeaveType] = useState('');
  // Nghỉ/WFH nửa ngày: NV chọn buổi để HR duyệt đúng ô công (AL/0.50, R/0.50).
  const [disputeHalf, setDisputeHalf] = useState<'FULL' | 'MORNING' | 'AFTERNOON'>('FULL');
  const [leaveTypeOptions, setLeaveTypeOptions] = useState<{ code: string; name: string; requiresAttachment?: boolean }[]>([]);
  // Giấy tờ đính kèm khiếu nại — bắt buộc với loại nghỉ có requires_attachment (ốm, thai sản…).
  const [disputeFiles, setDisputeFiles] = useState<File[]>([]);
  const [submittingDispute, setSubmittingDispute] = useState(false);
  const [disputeError, setDisputeError] = useState<string | null>(null);

  // 12-month history list (Criterion B4 #8)
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const loadData = () => {
    setLoading(true);
    setError(null);
    fetch(`/api/v1/attendance/my-timesheet?month=${selectedMonth}${viewedEmployeeCode ? `&employeeCode=${encodeURIComponent(viewedEmployeeCode)}` : ''}`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        if (j?.data && Array.isArray(j.data.days)) {
          setData(j.data);
        } else if (Array.isArray(j?.data)) {
          // Fallback legacy array
          setData({
            month: selectedMonth,
            daysInMonth: 30,
            status: 'draft',
            periodStatus: 'DRAFT',
            canDispute: false,
            publishDay: 1,
            closeDay: 1,
            disputeDeadline: '',
            standardDays: 22,
            actualDays: j.data.length,
            wfhDays: 0,
            leaveDays: 0,
            lateCount: 0,
            holidayDays: 0,
            sickDays: 0,
            compDays: 0,
            unpaidDays: 0,
            totalDays: j.data.length,
            remainingLeave: 12,
            days: [],
          });
        } else {
          setError(j?.message || 'Không tải được dữ liệu bảng công');
        }
      })
      .catch((err) => {
        console.error('Fetch timesheet error', err);
        setError('Không tải được bảng công. Vui lòng thử lại sau.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [selectedMonth, user]);

  // Danh mục loại nghỉ đang áp dụng — dùng cho lựa chọn "chuyển thành nghỉ" trong khiếu nại.
  useEffect(() => {
    fetch('/api/v1/leave-types', { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        if (Array.isArray(j?.data)) setLeaveTypeOptions(j.data.map((x: any) => ({
          code: x.code,
          name: x.name,
          requiresAttachment: x.requiresAttachment === true,
        })));
      })
      .catch(() => undefined);
  }, []);

  const handleMonthChange = (newMonth: string) => {
    const next: Record<string, string> = { month: newMonth };
    if (viewedEmployeeCode) next.employeeCode = viewedEmployeeCode;
    setSearchParams(next);
  };

  const handlePrevMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    handleMonthChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const handleNextMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m, 1);
    handleMonthChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const openDisputeModal = (day: DayItem) => {
    setDisputeDay(day);
    setDisputeReason('');
    // Prefill giờ đang ghi nhận để nhân viên chỉ cần sửa phần sai.
    setDisputeCheckIn(day.checkIn || '');
    setDisputeCheckOut(day.checkOut || '');
    setDisputeKind('TIME_FIX');
    setDisputeLeaveType('');
    setDisputeHalf('FULL');
    setDisputeFiles([]);
    setDisputeError(null);
  };

  // Loại nghỉ đang chọn — quyết định có bắt buộc giấy tờ hay không.
  const selectedLeaveCfg = leaveTypeOptions.find((t) => t.code === disputeLeaveType);

  /** Đọc tệp thành base64 (bỏ tiền tố data:…) để gửi kèm khiếu nại trong 1 request. */
  const fileToBase64 = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result || '');
      const comma = raw.indexOf(',');
      resolve(comma >= 0 ? raw.slice(comma + 1) : raw);
    };
    reader.onerror = () => reject(new Error(`Không đọc được tệp ${file.name}`));
    reader.readAsDataURL(file);
  });

  const handleSubmitDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disputeDay) return;
    if (!disputeReason.trim()) {
      setDisputeError('Bắt buộc nhập lý do khiếu nại');
      return;
    }
    if (disputeKind === 'LEAVE' && !disputeLeaveType) {
      setDisputeError('Chọn loại nghỉ cụ thể');
      return;
    }
    // Sửa giờ: bắt buộc đủ cả giờ vào và giờ ra — công ngày đó tính theo đúng cặp giờ này.
    if (disputeKind === 'TIME_FIX') {
      if (!disputeCheckIn || !disputeCheckOut) {
        setDisputeError('Nhập đủ CẢ giờ vào và giờ ra — bảng công tính công theo cặp giờ này');
        return;
      }
      // "HH:mm" so sánh chuỗi là đủ; backend vẫn kiểm tra lại.
      if (disputeCheckOut <= disputeCheckIn) {
        setDisputeError('Giờ ra phải sau giờ vào');
        return;
      }
    }
    // Loại nghỉ yêu cầu giấy tờ (ốm/thai sản…) → phải đính kèm ít nhất 1 tệp.
    if (disputeKind === 'LEAVE' && selectedLeaveCfg?.requiresAttachment && disputeFiles.length === 0) {
      setDisputeError(`Loại nghỉ ${selectedLeaveCfg.name} bắt buộc có giấy tờ đính kèm — tải lên ít nhất 1 tệp`);
      return;
    }
    setSubmittingDispute(true);
    setDisputeError(null);

    try {
      const attachments = disputeFiles.length
        ? await Promise.all(disputeFiles.map(async (f) => ({
            fileName: f.name,
            contentType: f.type || 'application/octet-stream',
            data: await fileToBase64(f),
          })))
        : [];
      const res = await fetch('/api/v1/disputes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(),
        },
        body: JSON.stringify({
          workDate: disputeDay.date,
          reason: disputeReason.trim(),
          requestedKind: disputeKind,
          ...(disputeKind === 'LEAVE' ? { requestedLeaveType: disputeLeaveType } : {}),
          ...(disputeKind !== 'TIME_FIX' && disputeHalf !== 'FULL' ? { requestedHalfDay: disputeHalf } : {}),
          ...(disputeKind === 'TIME_FIX' ? { requestedCheckIn: disputeCheckIn, requestedCheckOut: disputeCheckOut } : {}),
          ...(attachments.length ? { attachments } : {}),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDisputeError(json?.message || 'Gửi khiếu nại thất bại');
        setSubmittingDispute(false);
        return;
      }
      setSubmittingDispute(false);
      setDisputeDay(null);
      loadData();
    } catch (err: any) {
      setDisputeError(err?.message || 'Không thể gửi khiếu nại');
      setSubmittingDispute(false);
    }
  };

  // Explanation text for dispute restriction
  const getDisputeTooltip = (periodStatus?: string) => {
    switch (periodStatus) {
      case 'UNPUBLISHED':
        return 'Bảng công đang mở — bạn có thể gửi khiếu nại ngay';
      case 'EXPIRED':
        return 'Đã quá thời hạn khiếu nại (2 ngày kể từ ngày công bố)';
      case 'LOCKED':
        return 'Kỳ công đã chốt & khóa — chỉ đọc, không thể khiếu nại';
      case 'OPEN':
      case 'DRAFT':
        return 'Bảng công đang mở — bạn có thể gửi khiếu nại ngay';
      default:
        return '';
    }
  };

  // Nhãn/màu trạng thái đơn khiếu nại của ngày (PENDING/RESOLVED/REJECTED/EXPIRED).
  const disputeStatusText = (s: string) => s === 'PENDING' ? 'HR đang xử lý'
    : s === 'RESOLVED' ? 'Đã xử lý' : s === 'REJECTED' ? 'Đã từ chối' : s === 'EXPIRED' ? 'Quá hạn' : s;
  const disputeIcon = (s: string) => s === 'PENDING' ? '⏳'
    : s === 'RESOLVED' ? '✔' : s === 'REJECTED' ? '✖' : s === 'EXPIRED' ? '⌛' : '•';
  const disputeBadgeCls = (s: string) => s === 'PENDING' ? 'text-status-warn bg-status-warn-soft border-status-warn-line'
    : s === 'RESOLVED' ? 'text-status-ok bg-status-ok-soft border-status-ok-line'
      : s === 'REJECTED' ? 'text-status-danger bg-status-danger-soft border-status-danger-line'
        : 'text-ink-secondary bg-surface-secondary border-line';

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Đầu trang + điều hướng kỳ công */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-accent-dark">
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Bảng công cá nhân
          </div>
          <h1 className="mt-1 font-display text-xl font-extrabold tracking-tight text-ink sm:text-[23px]">
            {isOwnTimesheet ? 'Bảng công của tôi' : `Bảng công của ${data?.employeeName || viewedEmployeeCode || 'nhân viên'}`}
          </h1>
          <p className="mt-1 text-xs text-ink-muted">
            {`Kỳ công tháng ${selectedMonth.slice(5, 7)}/${selectedMonth.slice(0, 4)}`}
            {data?.employeeCode ? ` · ${data.employeeCode}` : ''}
          </p>
          <p className="mt-0.5 text-[11px] text-ink-muted">
            {data
              ? data.shiftName
                ? `${data.shiftName} · ${(data.shiftCheckInStart || '').slice(0, 5)}–${(data.shiftCheckOutEnd || '').slice(0, 5)} · ${data.shiftRequiredWorkHours ?? 8}h/ngày`
                : 'Ca chuẩn 08:00–17:00 · 8h/ngày'
              : 'Ca chuẩn 08:00–17:00 · 8h/ngày'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex h-9 items-center overflow-hidden rounded-[10px] border border-line bg-surface shadow-2xs">
            <button
              type="button"
              onClick={handlePrevMonth}
              title="Tháng trước"
              className="grid h-full w-8 cursor-pointer place-items-center text-ink-muted hover:bg-canvas-subtle hover:text-ink"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <select
              value={selectedMonth}
              onChange={(e) => handleMonthChange(e.target.value)}
              className="h-full cursor-pointer border-x border-line bg-transparent px-2 font-mono text-xs font-semibold text-ink outline-none"
            >
              {monthOptions.map((m) => (
                <option key={m} value={m}>
                  Tháng {m.slice(5, 7)} / {m.slice(0, 4)}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleNextMonth}
              title="Tháng sau"
              className="grid h-full w-8 cursor-pointer place-items-center text-ink-muted hover:bg-canvas-subtle hover:text-ink"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <Button variant="secondary" size="md" onClick={() => window.print()} title="In bảng công hoặc lưu PDF">
            <Printer className="h-4 w-4" />
            <span className="hidden sm:inline">In / PDF</span>
            <span className="sm:hidden">In</span>
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-status-danger-line bg-status-danger-soft p-3 text-xs text-status-danger">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Banner trạng thái kỳ công */}
      {data && (() => {
        const b = PERIOD_BANNER[data.periodStatus];
        const Icon = b.icon;
        return (
          <div className={`flex flex-col gap-2 rounded-xl border p-3.5 text-xs shadow-2xs sm:flex-row sm:items-center sm:justify-between ${b.cls}`}>
            <div className="flex items-start gap-2.5">
              <Icon className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <span className="font-bold">{b.title}</span>
                <p className="mt-0.5 text-[11px] opacity-90">{periodDescription(data.periodStatus, data)}</p>
              </div>
            </div>
            <div className="self-start sm:self-auto">
              <Badge variant={b.badge}>{b.chip}</Badge>
            </div>
          </div>
        );
      })()}

      {/* Chỉ số công — 6 chỉ số chính + dải chỉ số phụ */}
      {data && (
        <>
          <section className="overflow-hidden rounded-xl border border-line bg-line-soft shadow-2xs">
            <div className="grid grid-cols-2 gap-px md:grid-cols-6">
              <div className="order-1 bg-accent-soft/50 p-3 sm:px-3.5">
                <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.05em] text-accent-dark">
                  <PenLine className="h-3 w-3" /> Tổng ngày công
                </div>
                <div className="mt-1.5 font-display text-lg font-extrabold tracking-tight text-accent sm:text-xl">
                  {data.totalDays}<span className="ml-1 text-[10.5px] font-semibold text-ink-muted">ngày</span>
                </div>
                <div className="mt-1 text-[10px] text-ink-muted">Đã gồm phép &amp; ngày lễ</div>
              </div>

              <div className="order-2 bg-surface p-3 sm:px-3.5">
                <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.05em] text-ink-muted">
                  <Check className="h-3 w-3" /> Công thực tế
                </div>
                <div className="mt-1.5 font-display text-lg font-extrabold tracking-tight text-status-ok sm:text-xl">
                  {data.actualDays}<span className="ml-1 text-[10.5px] font-semibold text-ink-muted">ngày</span>
                </div>
                <div className="mt-1 text-[10px] text-ink-muted">Trên {data.standardDays} ngày công chuẩn</div>
              </div>

              <div className="order-3 bg-surface p-3 sm:px-3.5 md:order-6">
                <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.05em] text-ink-muted">
                  <CalendarDays className="h-3 w-3" /> Phép còn lại
                </div>
                <div className="mt-1.5 font-display text-lg font-extrabold tracking-tight text-ink sm:text-xl">
                  {data.remainingLeave}<span className="ml-1 text-[10.5px] font-semibold text-ink-muted">ngày</span>
                </div>
                <div className="mt-1 text-[10px] text-ink-muted">Tính đến kỳ này</div>
              </div>

              <div className="order-4 hidden bg-surface p-3 sm:px-3.5 md:order-3 md:block">
                <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.05em] text-ink-muted">
                  <CalendarDays className="h-3 w-3" /> Phép năm đã dùng
                </div>
                <div className="mt-1.5 font-display text-lg font-extrabold tracking-tight text-status-info sm:text-xl">
                  {data.leaveDays}<span className="ml-1 text-[10.5px] font-semibold text-ink-muted">ngày</span>
                </div>
                <div className="mt-1 text-[10px] text-ink-muted">Còn lại {data.remainingLeave} ngày phép</div>
              </div>

              <div className="order-5 bg-surface p-3 sm:px-3.5 md:order-4">
                <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.05em] text-ink-muted">
                  <MonitorSmartphone className="h-3 w-3" /> Làm từ xa (WFH)
                </div>
                <div className="mt-1.5 font-display text-lg font-extrabold tracking-tight text-status-wfh sm:text-xl">
                  {data.wfhDays}<span className="ml-1 text-[10.5px] font-semibold text-ink-muted">ngày</span>
                </div>
                <div className="mt-1 text-[10px] text-ink-muted">Ngày làm từ xa</div>
              </div>

              <div className="order-6 hidden bg-surface p-3 sm:px-3.5 md:order-5 md:block">
                <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.05em] text-ink-muted">
                  <Clock className="h-3 w-3" /> Đi muộn / sớm
                </div>
                <div className="mt-1.5 font-display text-lg font-extrabold tracking-tight text-status-warn sm:text-xl">
                  {data.lateCount}<span className="ml-1 text-[10.5px] font-semibold text-ink-muted">lần</span>
                </div>
                <div className="mt-1 text-[10px] text-ink-muted">Trong kỳ công này</div>
              </div>

              <div className="order-7 col-span-2 hidden flex-wrap items-center gap-x-5 gap-y-1.5 bg-canvas/60 px-3.5 py-2 sm:flex md:col-span-6">
                <span className="text-[10px] font-bold uppercase tracking-[0.05em] text-ink-muted">Chi tiết ký hiệu</span>
                <span className="text-[11px] text-ink-secondary">Công chuẩn <b className="font-mono text-xs text-ink">{data.standardDays}</b></span>
                <span className="text-[11px] text-ink-secondary">Ngày lễ (NL) <b className="font-mono text-xs text-ink">{data.holidayDays}</b></span>
                <span className="text-[11px] text-ink-secondary">Nghỉ ốm (S) <b className="font-mono text-xs text-ink">{data.sickDays}</b></span>
                <span className="text-[11px] text-ink-secondary">Nghỉ bù (RO) <b className="font-mono text-xs text-ink">{data.compDays}</b></span>
                <span className="text-[11px] text-ink-secondary">Không lương (UP) <b className="font-mono text-xs text-status-danger">{data.unpaidDays}</b></span>
              </div>
            </div>
          </section>

          <button
            type="button"
            onClick={() => setShowAllStats((v) => !v)}
            className="flex w-full cursor-pointer items-center justify-between rounded-[10px] border border-dashed border-line bg-surface px-3 py-2 text-[11px] text-ink-muted sm:hidden"
          >
            <span>
              Phép năm <b className="text-ink">{data.leaveDays}</b> · Lễ <b className="text-ink">{data.holidayDays}</b> · Muộn <b className="text-ink">{data.lateCount}</b> · Ốm <b className="text-ink">{data.sickDays}</b>
            </span>
            <span className="flex items-center gap-1 font-bold text-accent-dark">
              {showAllStats ? 'Thu gọn' : 'Đủ chỉ số'}
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAllStats ? 'rotate-180' : ''}`} />
            </span>
          </button>

          {showAllStats && (
            <div className="grid grid-cols-2 gap-2 sm:hidden">
              {[
                ['Phép năm đã dùng', data.leaveDays, 'ngày'],
                ['Đi muộn / sớm', data.lateCount, 'lần'],
                ['Công chuẩn', data.standardDays, 'ngày'],
                ['Ngày lễ (NL)', data.holidayDays, 'ngày'],
                ['Nghỉ ốm (S)', data.sickDays, 'ngày'],
                ['Nghỉ bù (RO)', data.compDays, 'ngày'],
                ['Không lương (UP)', data.unpaidDays, 'ngày'],
              ].map(([label, value, unit]) => (
                <div key={String(label)} className="rounded-[10px] border border-line bg-surface px-3 py-2">
                  <div className="text-[9.5px] font-bold uppercase tracking-[0.05em] text-ink-muted">{label}</div>
                  <div className="mt-0.5 text-base font-extrabold text-ink">
                    {value}<span className="ml-1 text-[9.5px] font-semibold text-ink-muted">{unit}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Lịch tháng dạng ô vuông */}
      {data && (
        <section className="overflow-hidden rounded-xl border border-line bg-surface shadow-2xs">
          <div className="flex flex-wrap items-start justify-between gap-2 border-b border-line px-4 py-3.5">
            <div>
              <h2 className="text-sm font-bold tracking-tight text-ink">
                Lịch công tháng {selectedMonth.slice(5, 7)}/{selectedMonth.slice(0, 4)}
              </h2>
              <p className="mt-0.5 text-[11px] text-ink-muted">
                1.00 = đủ công · R = WFH · AL = phép · NL = lễ
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {[
                ['Đúng giờ', 'bg-status-ok'],
                ['Muộn / thiếu', 'bg-status-warn'],
                ['Nghỉ phép', 'bg-status-info'],
                ['WFH', 'bg-status-wfh'],
              ].map(([label, dot]) => (
                <span key={label} className="inline-flex items-center gap-1.5 text-[10.5px] text-ink-muted">
                  <span className={`h-2 w-2 rounded-[3px] ${dot}`} />
                  {label}
                </span>
              ))}
            </div>
          </div>
          <div className="p-3 sm:p-4">
            <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
              {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((d) => (
                <div key={d} className="py-1 text-center text-[10px] font-bold uppercase tracking-[0.06em] text-ink-muted">
                  {d}
                </div>
              ))}
              {(() => {
                const [yy, mm] = selectedMonth.split('-').map(Number);
                const offset = (new Date(yy, mm - 1, 1).getDay() + 6) % 7; // 0 = Thứ 2
                return Array.from({ length: offset }, (_, i) => (
                  <div key={`lead-${i}`} aria-hidden="true" />
                ));
              })()}
              {data.days.map((d) => {
                // Vắng (ABSENT) chỉ tô chữ đỏ, không tô nền: một tháng nhiều ngày vắng
                // sẽ thành "biển đỏ" át hết thông tin. Muộn/thiếu chấm công mới đánh dấu nổi.
                const hasIssue = d.status === 'LATE' || d.status === 'INCOMPLETE';
                const cls =
                  d.status === 'LEAVE'
                    ? 'bg-status-info-soft border-status-info-line text-status-info'
                    : d.status === 'WFH'
                    ? 'bg-status-wfh-soft border-status-wfh-line text-status-wfh'
                    : d.status === 'LATE'
                    ? 'bg-status-warn-soft border-status-warn-line text-status-warn'
                    : d.status === 'INCOMPLETE'
                    ? 'bg-status-danger-soft border-status-danger-line text-status-danger'
                    : d.status === 'ABSENT'
                    ? 'bg-canvas border-line text-status-danger'
                    : d.status === 'ON_TIME'
                    ? 'bg-status-ok-soft/60 border-status-ok-line text-status-ok'
                    : d.isHoliday
                    ? 'bg-status-ok-soft/40 border-status-ok-line text-status-ok'
                    : d.isWeekend
                    ? 'bg-canvas-subtle border-line-soft text-ink-muted'
                    : 'bg-canvas border-line text-ink-muted';

                return (
                  <div
                    key={d.date}
                    title={`${d.date} (${d.weekday}): ${d.statusText}`}
                    className={`flex min-h-[52px] flex-col justify-between rounded-lg border px-1 py-1 transition-colors sm:min-h-[62px] sm:rounded-[10px] sm:px-1.5 sm:py-1.5 ${cls}`}
                  >
                    <div className="flex w-full items-start justify-between gap-0.5">
                      <span className="font-mono text-[10.5px] font-extrabold sm:text-[11.5px]">{d.day}</span>
                      {d.dispute ? (
                        <span
                          className="rounded bg-status-warn px-1 text-[8px] font-bold text-on-warn sm:text-[9px]"
                          title="Đã có khiếu nại"
                        >
                          KN
                        </span>
                      ) : hasIssue ? (
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-status-danger" title="Ngày có vấn đề" />
                      ) : null}
                    </div>
                    <div className="flex w-full items-end justify-between gap-1">
                      <span className="font-mono text-[9.5px] font-bold sm:text-[10.5px]">
                        {d.isWeekend && d.status === 'WEEKEND' ? '—' : d.symbol}
                      </span>
                      {typeof d.hoursWorked === 'number' && d.hoursWorked > 0 && (
                        <span className="hidden font-mono text-[9px] text-ink-muted sm:inline">{d.hoursWorked}h</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Bảng kê chi tiết 11 cột */}
      <section className="overflow-hidden rounded-xl border border-line bg-surface shadow-2xs">
        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-line px-4 py-3.5">
          <div>
            <h2 className="text-sm font-bold tracking-tight text-ink">Chi tiết từng ngày</h2>
            <p className="mt-0.5 text-[11px] text-ink-muted">
              Đối soát giờ vào/ra, ký hiệu công và trạng thái khiếu nại của {user?.fullName || 'nhân viên'} ({user?.employeeCode || '—'})
            </p>
            <p className="mt-0.5 text-[10.5px] text-ink-muted sm:hidden">Vuốt ngang để xem thêm cột — cột Ngày cố định</p>
          </div>
          {data && <Badge variant="gray">{data.daysInMonth} ngày</Badge>}
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-ink-muted">Đang tải dữ liệu bảng công...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-[11.5px]">
              <thead>
                <tr className="border-b border-line bg-canvas">
                  {['Ngày', 'Thứ', 'Ca làm', 'Vào', 'Ra', 'Giờ làm', 'Muộn', 'Ký hiệu', 'Trạng thái', 'Khiếu nại', 'Ghi chú'].map((h, i) => (
                    <th
                      key={h}
                      className={`whitespace-nowrap px-3 py-2.5 text-[9.5px] font-extrabold uppercase tracking-[0.06em] text-ink-muted ${
                        i === 0 ? 'sticky left-0 z-10 bg-canvas' : ''
                      } ${i >= 3 && i <= 7 ? 'text-center' : ''} ${i === 9 ? 'text-center' : ''}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(!data || data.days.length === 0) && (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-ink-muted">
                      Chưa có dữ liệu bảng công trong tháng này.
                    </td>
                  </tr>
                )}
                {data?.days.map((r) => {
                  const isIssue = r.status === 'LATE' || r.status === 'INCOMPLETE' || r.status === 'ABSENT';
                  // Ngày được phép khiếu nại (chưa xét đã có đơn hay chưa) — dùng cho cả "Khiếu nại lại".
                  const dayDisputable = isOwnTimesheet && data.canDispute && !r.isWeekend;
                  const canDisputeThisDay = dayDisputable && !r.dispute;

                  // Ô Ngày dính (sticky) luôn nền đục để không lộ chữ bên dưới khi cuộn ngang.
                  const rowTint = isIssue ? 'bg-status-warn-soft/30' : '';

                  return (
                    <tr
                      key={r.date}
                      className={`border-b border-line-soft transition-colors last:border-0 hover:bg-canvas/60 ${rowTint}`}
                    >
                      <td className="sticky left-0 z-[1] whitespace-nowrap border-r border-line-soft bg-surface px-3 py-2 font-mono font-semibold text-ink">{r.date}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-ink-secondary">{r.weekday}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-ink-secondary">
                        {data.shiftName
                          ? `${data.shiftName} (${(data.shiftCheckInStart || '').slice(0, 5)}–${(data.shiftCheckOutEnd || '').slice(0, 5)}) · ${data.shiftRequiredWorkHours ?? 8}h`
                          : 'Ca chuẩn (08:00–17:00)'}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-center font-mono">{r.checkIn || '—'}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-center font-mono">{r.checkOut || '—'}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-center font-mono">
                        {r.hoursWorked ? `${r.hoursWorked}h` : '—'}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-center font-mono">
                        {r.lateMinutes ? (
                          <span className="font-bold text-status-warn">{r.lateMinutes}′</span>
                        ) : (
                          '0'
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-center font-mono font-bold">{r.symbol}</td>
                      <td className="whitespace-nowrap px-3 py-2">
                        <Badge
                          variant={
                            r.status === 'ON_TIME'
                              ? 'ok'
                              : r.status === 'LATE'
                              ? 'warn'
                              : r.status === 'INCOMPLETE' || r.status === 'ABSENT'
                              ? 'danger'
                              : r.status === 'WFH' || r.status === 'LEAVE'
                              ? 'info'
                              : 'gray'
                          }
                        >
                          {r.statusText}
                        </Badge>
                      </td>
                      <td className="min-w-[200px] px-3 py-2 text-center">
                        {r.dispute ? (
                          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
                            <span
                              className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-semibold ${disputeBadgeCls(r.dispute.status)}`}
                              title={r.dispute.reason}
                            >
                              <span>{disputeIcon(r.dispute.status)}</span>
                              <span>{disputeStatusText(r.dispute.status)}</span>
                            </span>
                            {r.dispute.status !== 'PENDING' && dayDisputable && (r.dispute.count ?? 1) < 2 && (
                              <button
                                type="button"
                                onClick={() => openDisputeModal(r)}
                                title="Đã bị từ chối/kết luận — bạn còn 1 lần gửi lại cho ngày này"
                                className="cursor-pointer whitespace-nowrap text-[11px] text-status-warn underline hover:text-status-warn"
                              >
                                Khiếu nại lại
                              </button>
                            )}
                            {(r.dispute.count ?? 1) >= 2 && (
                              <span className="text-[10px] text-ink-muted" title="Mỗi ngày chỉ được gửi tối đa 2 đơn khiếu nại">
                                Đã hết lượt
                              </span>
                            )}
                          </div>
                        ) : canDisputeThisDay ? (
                          <button
                            type="button"
                            onClick={() => openDisputeModal(r)}
                            className="cursor-pointer rounded-md bg-status-warn px-2.5 py-1 text-[11px] font-semibold text-on-warn hover:bg-status-warn/90"
                          >
                            Khiếu nại
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled
                            title={getDisputeTooltip(data.periodStatus)}
                            className="cursor-not-allowed rounded-md border border-line px-2.5 py-1 text-[11px] text-ink-muted opacity-60"
                          >
                            Khóa
                          </button>
                        )}
                      </td>
                      <td className="max-w-[260px] truncate px-3 py-2 text-[10.5px] text-ink-muted" title={r.dispute ? `Khiếu nại: ${r.dispute.reason}` : r.statusText}>
                        {r.dispute
                          ? `Khiếu nại: ${
                              r.dispute.status === 'RESOLVED' ? 'đã xử lý'
                              : r.dispute.status === 'REJECTED' ? 'bị từ chối'
                              : r.dispute.status === 'EXPIRED' ? 'quá hạn'
                              : 'chờ xử lý'
                            } — ${r.dispute.reason}`
                          : r.statusText}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {data && !loading && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-canvas/50 px-4 py-2 text-[10.5px] text-ink-muted">
            <span>{data.days.length} ngày trong kỳ · Mỗi ngày tối đa 2 đơn khiếu nại</span>
            <span>Hạn khiếu nại: {data.disputeDeadline ? String(data.disputeDeadline).slice(0, 10).split('-').reverse().join('/') : '—'}</span>
          </div>
        )}
      </section>

      {/* Dispute Modal Dialog */}
      {disputeDay && (
        <Modal
          isOpen={true}
          onClose={() => setDisputeDay(null)}
          title={`Khiếu nại ngày công ${disputeDay.date} (${disputeDay.weekday})`}
        >
          <form onSubmit={handleSubmitDispute} className="space-y-4 text-xs">
            <div className="p-3 bg-canvas rounded-lg border border-line space-y-1">
              <div>
                <span className="text-ink-muted">Dữ liệu log hiện tại:</span>
                <span className="ml-2 font-mono font-semibold">
                  Vào: {disputeDay.checkIn || 'Không có'} — Ra: {disputeDay.checkOut || 'Không có'}
                </span>
              </div>
              <div>
                <span className="text-ink-muted">Trạng thái ghi nhận:</span>
                <span className="ml-2 font-semibold text-status-danger">{disputeDay.statusText}</span>
              </div>
            </div>

            <div className="p-3 bg-canvas rounded-lg border border-line space-y-2">
              <label className="block">
                <span className="block font-semibold text-ink mb-1">Ngày này nên được ghi nhận là</span>
                <select
                  value={disputeKind === 'LEAVE' && disputeLeaveType ? `LEAVE:${disputeLeaveType}` : disputeKind}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v.startsWith('LEAVE:')) {
                      setDisputeKind('LEAVE');
                      setDisputeLeaveType(v.slice('LEAVE:'.length));
                    } else {
                      setDisputeKind(v as 'TIME_FIX' | 'WFH');
                      setDisputeLeaveType('');
                    }
                  }}
                  className="w-full border border-line rounded-lg p-2 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  <option value="TIME_FIX">Sửa giờ vào/ra</option>
                  <option value="WFH">Công nhận làm việc từ xa (WFH)</option>
                  {leaveTypeOptions.length > 0 && (
                    <optgroup label="Chuyển thành nghỉ">
                      {leaveTypeOptions.map((t) => (
                        <option key={t.code} value={`LEAVE:${t.code}`}>{t.name}</option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </label>

              {disputeKind === 'TIME_FIX' ? (
                <>
              <p className="text-[11px] text-ink-muted">
                Bắt buộc đủ cả giờ vào và giờ ra. HR duyệt thì giờ này được ghi thẳng vào bảng công;
                ngày hôm đó tự tính lại số công, giờ làm và đi muộn theo đúng cặp giờ này.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-ink-muted mb-1">Giờ vào <span className="text-status-danger">*</span></span>
                  <input
                    type="time"
                    required
                    value={disputeCheckIn}
                    onChange={(e) => setDisputeCheckIn(e.target.value)}
                    className="w-full border border-line rounded-lg p-2 font-mono text-xs text-ink focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </label>
                <label className="block">
                  <span className="block text-ink-muted mb-1">Giờ ra <span className="text-status-danger">*</span></span>
                  <input
                    type="time"
                    required
                    value={disputeCheckOut}
                    onChange={(e) => setDisputeCheckOut(e.target.value)}
                    className="w-full border border-line rounded-lg p-2 font-mono text-xs text-ink focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </label>
              </div>
                </>
              ) : (
                <>
                <label className="block">
                  <span className="block text-ink-muted mb-1">Thời lượng</span>
                  <select
                    value={disputeHalf}
                    onChange={(e) => setDisputeHalf(e.target.value as typeof disputeHalf)}
                    className="w-full border border-line rounded-lg p-2 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-accent"
                  >
                    <option value="FULL">Cả ngày</option>
                    <option value="MORNING">Nửa ngày — buổi sáng</option>
                    <option value="AFTERNOON">Nửa ngày — buổi chiều</option>
                  </select>
                </label>
                <p className="text-[11px] text-ink-muted">
                  {disputeKind === 'WFH'
                    ? (disputeHalf === 'FULL'
                      ? 'HR duyệt thì ngày này được công nhận làm việc từ xa — không cần giờ vào/ra.'
                      : 'HR duyệt thì nửa ngày này được công nhận WFH (ô công R/0.50), nửa ngày còn lại vẫn tính công đi làm.')
                    : (disputeHalf === 'FULL'
                      ? 'HR duyệt thì ngày này thành ngày nghỉ theo loại đã chọn và trừ quỹ phép tương ứng.'
                      : 'HR duyệt thì nửa ngày này thành nghỉ (ô công ' + disputeLeaveType + '/0.50) và trừ 0.5 ngày quỹ phép.')}
                </p>
                </>
              )}
            </div>

            {disputeKind === 'LEAVE' && (
              <div className={`p-3 rounded-lg border space-y-2 ${
                selectedLeaveCfg?.requiresAttachment ? 'bg-status-warn-soft border-status-warn-line' : 'bg-canvas border-line'
              }`}>
                <div className="font-semibold text-ink">
                  Giấy tờ đính kèm
                  {selectedLeaveCfg?.requiresAttachment
                    ? <span className="text-status-danger"> * (Bắt buộc với {selectedLeaveCfg.name})</span>
                    : <span className="text-ink-muted font-normal"> (tuỳ chọn)</span>}
                </div>
                {selectedLeaveCfg?.requiresAttachment && (
                  <p className="text-[11px] text-status-warn">
                    Loại nghỉ này yêu cầu giấy tờ chứng minh — thiếu giấy tờ thì khiếu nại không gửi được và HR cũng không duyệt được.
                  </p>
                )}
                <input
                  type="file"
                  multiple
                  accept="image/*,.pdf,.doc,.docx"
                  onChange={(e) => setDisputeFiles(Array.from(e.target.files || []))}
                  className="block w-full text-[11px] text-ink"
                />
                {disputeFiles.length > 0 && (
                  <ul className="text-[11px] text-ink-muted space-y-0.5">
                    {disputeFiles.map((f) => (
                      <li key={f.name}>📎 {f.name} — {(f.size / 1024).toFixed(0)} KB</li>
                    ))}
                  </ul>
                )}
                <p className="text-[11px] text-ink-muted">Tối đa 5 tệp, mỗi tệp ≤ 10 MB. Giấy tờ được chuyển kèm đơn nghỉ khi HR duyệt.</p>
              </div>
            )}

            {disputeError && (
              <div className="p-2.5 rounded bg-status-danger-soft border border-status-danger-line text-status-danger text-xs">
                ⚠️ {disputeError}
              </div>
            )}

            <div>
              <label className="block font-semibold text-ink mb-1">
                Lý do khiếu nại <span className="text-status-danger">* (Bắt buộc)</span>
              </label>
              <textarea
                rows={3}
                required
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                className="w-full border border-line rounded-lg p-2.5 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-accent"
                placeholder="VD: Ngày 05/11 tôi có check-in lúc 08:35 bằng webcam nhưng bảng công ghi nhận thiếu giờ..."
              />
              <p className="text-[11px] text-ink-muted mt-1">
                Yêu cầu khiếu nại sẽ được chuyển thẳng đến màn hình giải quyết khiếu nại của HR.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <Button type="button" variant="outline" size="sm" onClick={() => setDisputeDay(null)}>
                Hủy
              </Button>
              <button
                type="submit"
                disabled={!disputeReason.trim() || submittingDispute}
                className="px-4 py-2 rounded-lg bg-accent text-on-accent text-xs font-semibold shadow-xs disabled:opacity-40 disabled:cursor-not-allowed hover:bg-accent-hover transition-colors"
              >
                {submittingDispute ? 'Đang gửi...' : 'Gửi khiếu nại lên HR'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
