import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card } from '../../../components/common/Card';
import { Button } from '../../../components/common/Button';
import { Badge } from '../../../components/common/Badge';
import { Modal } from '../../../components/common/Modal';
import { useAuth } from '../../../context/AuthContext';

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
  } | null;
}

interface TimesheetData {
  month: string;
  daysInMonth: number;
  status: string; // 'draft' | 'published' | 'locked'
  periodStatus: 'UNPUBLISHED' | 'DISPUTABLE' | 'EXPIRED' | 'LOCKED' | 'DRAFT';
  canDispute: boolean;
  publishDay: number;
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

export const MyTimesheetPage: React.FC = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

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
            publishDay: 11,
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
    setDisputeError(null);
  };

  const handleSubmitDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disputeDay) return;
    if (!disputeReason.trim()) {
      setDisputeError('Bắt buộc nhập lý do khiếu nại');
      return;
    }
    setSubmittingDispute(true);
    setDisputeError(null);

    try {
      const res = await fetch('/api/v1/disputes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(),
        },
        body: JSON.stringify({
          workDate: disputeDay.date,
          reason: disputeReason.trim(),
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
        return 'Chỉ khiếu nại được sau khi HR công bố (ngày 11 hàng tháng)';
      case 'EXPIRED':
        return 'Đã quá thời hạn khiếu nại (2 ngày kể từ ngày công bố)';
      case 'LOCKED':
        return 'Kỳ công đã chốt & khóa — chỉ đọc, không thể khiếu nại';
      case 'DRAFT':
        return 'Bảng công đang tạm tính — chưa mở đợt khiếu nại';
      default:
        return '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Month Controls (Criterion B4 #1) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-accent-soft text-accent rounded-full text-xs font-semibold border border-accent-line mb-1">
            <span>📑</span> Bảng Công Cá Nhân (S11)
          </div>
          <h1 className="text-xl font-bold tracking-tight text-ink">{isOwnTimesheet ? 'Bảng Công Cá Nhân Của Tôi' : `Bảng Công Của ${data?.employeeName || viewedEmployeeCode}`}</h1>
          <p className="text-xs text-ink-muted mt-1">
            Tổng hợp dữ liệu công nhật, đối soát ký hiệu chuẩn và thực hiện khiếu nại trong thời hạn quy định.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrevMonth} title="Tháng trước">
            ‹
          </Button>
          <select
            value={selectedMonth}
            onChange={(e) => handleMonthChange(e.target.value)}
            className="text-xs p-2 border border-line rounded-lg bg-surface font-semibold text-ink shadow-2xs font-mono"
          >
            {monthOptions.map((m) => (
              <option key={m} value={m}>
                Kỳ công: Tháng {m.slice(5, 7)} / {m.slice(0, 4)}
              </option>
            ))}
          </select>
          <Button variant="outline" size="sm" onClick={handleNextMonth} title="Tháng sau">
            ›
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            In / PDF
          </Button>
        </div>
      </div>

      {error && (
        <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">
          ⚠️ {error}
        </div>
      )}

      {/* Period Status Notification Banner */}
      {data && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs ${
            data.periodStatus === 'DISPUTABLE'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : data.periodStatus === 'UNPUBLISHED'
              ? 'bg-amber-50 border-amber-300 text-amber-900'
              : data.periodStatus === 'EXPIRED'
              ? 'bg-zinc-50 border-zinc-300 text-zinc-800'
              : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="text-base">
              {data.periodStatus === 'DISPUTABLE'
                ? '🟢'
                : data.periodStatus === 'UNPUBLISHED'
                ? '⏳'
                : data.periodStatus === 'EXPIRED'
                ? '⏰'
                : '🔒'}
            </span>
            <div>
              <span className="font-bold">
                {data.periodStatus === 'DISPUTABLE'
                  ? 'BẢNG CÔNG ĐÃ CÔNG BỐ — ĐANG MỞ KHIẾU NẠI'
                  : data.periodStatus === 'UNPUBLISHED'
                  ? 'BẢNG CÔNG TẠM TÍNH (CHƯA CÔNG BỐ)'
                  : data.periodStatus === 'EXPIRED'
                  ? 'ĐÃ HẾT HẠN KHIẾU NẠI (QUÁ 2 NGÀY)'
                  : 'KỲ CÔNG ĐÃ CHỐT VÀ KHÓA (CHỈ ĐỌC)'}
              </span>
              <p className="text-[11px] opacity-90 mt-0.5">
                {data.periodStatus === 'DISPUTABLE'
                  ? `Hạn khiếu nại công: đến hết ngày ${data.disputeDeadline}. Hãy kiểm tra kỹ từng ngày công.`
                  : data.periodStatus === 'UNPUBLISHED'
                  ? `Số liệu đang tạm tính. HR sẽ công bố chính thức vào ngày ${data.publishDay} hàng tháng, lúc đó nút khiếu nại mới mở.`
                  : data.periodStatus === 'EXPIRED'
                  ? 'Đã qua thời hạn 2 ngày kể từ khi công bố. Nút khiếu nại đã bị khóa tự động theo quy chế.'
                  : 'Kỳ công đã chốt bởi HR và khóa sổ lương — không thể chỉnh sửa hay khiếu nại.'}
              </p>
            </div>
          </div>
          <div>
            <Badge
              variant={
                data.periodStatus === 'DISPUTABLE'
                  ? 'accent'
                  : data.periodStatus === 'UNPUBLISHED'
                  ? 'warn'
                  : 'gray'
              }
            >
              {data.periodStatus}
            </Badge>
          </div>
        </div>
      )}

      {/* 11 KPI / Summary Metrics Cards (Criterion B4 #3) */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
          <div className="p-3 bg-surface rounded-xl border border-line shadow-2xs">
            <div className="text-[10px] text-ink-muted">1. Công Chuẩn</div>
            <div className="text-lg font-bold text-ink mt-0.5">{data.standardDays} ngày</div>
          </div>
          <div className="p-3 bg-surface rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-2xs">
            <div className="text-[10px] text-emerald-800 font-medium">2. Công Thực Tế</div>
            <div className="text-lg font-bold text-emerald-700 mt-0.5">{data.actualDays} ngày</div>
          </div>
          <div className="p-3 bg-surface rounded-xl border border-line shadow-2xs">
            <div className="text-[10px] text-ink-muted">3. Làm Từ Xa (WFH)</div>
            <div className="text-lg font-bold text-purple-700 mt-0.5">{data.wfhDays} ngày</div>
          </div>
          <div className="p-3 bg-surface rounded-xl border border-line shadow-2xs">
            <div className="text-[10px] text-ink-muted">4. Nghỉ Phép Năm</div>
            <div className="text-lg font-bold text-blue-700 mt-0.5">{data.leaveDays} ngày</div>
          </div>
          <div className="p-3 bg-surface rounded-xl border border-line shadow-2xs">
            <div className="text-[10px] text-ink-muted">5. Đi Muộn / Sớm</div>
            <div className="text-lg font-bold text-amber-700 mt-0.5">{data.lateCount} lần</div>
          </div>
          <div className="p-3 bg-surface rounded-xl border border-line shadow-2xs">
            <div className="text-[10px] text-ink-muted">6. Ngày Lễ (NL)</div>
            <div className="text-lg font-bold text-teal-700 mt-0.5">{data.holidayDays} ngày</div>
          </div>
          <div className="p-3 bg-surface rounded-xl border border-line shadow-2xs">
            <div className="text-[10px] text-ink-muted">7. Nghỉ Ốm (S)</div>
            <div className="text-lg font-bold text-ink mt-0.5">{data.sickDays} ngày</div>
          </div>
          <div className="p-3 bg-surface rounded-xl border border-line shadow-2xs">
            <div className="text-[10px] text-ink-muted">8. Nghỉ Bù (RO)</div>
            <div className="text-lg font-bold text-ink mt-0.5">{data.compDays} ngày</div>
          </div>
          <div className="p-3 bg-surface rounded-xl border border-line shadow-2xs">
            <div className="text-[10px] text-ink-muted">9. Không Lương (UP)</div>
            <div className="text-lg font-bold text-rose-700 mt-0.5">{data.unpaidDays} ngày</div>
          </div>
          <div className="p-3 bg-surface rounded-xl border border-accent/40 bg-accent-soft/20 shadow-2xs">
            <div className="text-[10px] text-accent-dark font-medium">10. Tổng Ngày Công</div>
            <div className="text-lg font-black text-accent mt-0.5">{data.totalDays} ngày</div>
          </div>
          <div className="p-3 bg-surface rounded-xl border border-line col-span-2 sm:col-span-1 shadow-2xs">
            <div className="text-[10px] text-ink-muted">11. Phép Còn Lại</div>
            <div className="text-lg font-bold text-ink mt-0.5">{data.remainingLeave} ngày</div>
          </div>
        </div>
      )}

      {/* Square Calendar Grid (Criterion B4 #2) */}
      {data && (
        <Card title={`Lịch Tháng Dạng Ô Vuông — ${selectedMonth.slice(5, 7)}/${selectedMonth.slice(0, 4)} (Nhìn là thấy ngày có vấn đề)`}>
          <div className="grid grid-cols-7 gap-1.5 text-center text-xs">
            {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((d) => (
              <div key={d} className="font-semibold text-ink-muted py-1 text-[11px]">
                {d}
              </div>
            ))}
            {data.days.map((d) => {
              const hasIssue = d.status === 'LATE' || d.status === 'INCOMPLETE' || d.status === 'ABSENT';
              const cls =
                d.status === 'LEAVE'
                  ? 'bg-sky-50 border-sky-200 text-sky-800'
                  : d.status === 'WFH'
                  ? 'bg-violet-50 border-violet-200 text-violet-800'
                  : d.status === 'LATE'
                  ? 'bg-amber-100 border-amber-300 text-amber-900 ring-1 ring-amber-400'
                  : d.status === 'INCOMPLETE'
                  ? 'bg-rose-100 border-rose-300 text-rose-900 ring-1 ring-rose-400'
                  : d.status === 'ABSENT'
                  ? 'bg-red-50 border-red-200 text-red-800'
                  : d.status === 'ON_TIME'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : d.isWeekend
                  ? 'bg-canvas text-ink-muted border-line/40'
                  : 'bg-canvas border-line text-ink-muted';

              return (
                <div
                  key={d.date}
                  title={`${d.date} (${d.weekday}): ${d.statusText}`}
                  className={`rounded-lg border p-1.5 min-h-[56px] flex flex-col items-center justify-between transition-all ${cls}`}
                >
                  <div className="flex items-center justify-between w-full px-0.5">
                    <span className="font-bold text-xs">{d.day}</span>
                    {hasIssue && <span className="w-2 h-2 rounded-full bg-rose-600" title="Ngày có vấn đề" />}
                    {d.dispute && (
                      <span className="text-[9px] px-1 bg-amber-500 text-white rounded" title="Đã có khiếu nại">
                        KN
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-[10px] font-bold mt-1">
                    {d.isWeekend && d.status === 'WEEKEND' ? '—' : d.symbol}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Exactly 11 Columns Timesheet Table (Criterion B4 #3) */}
      <Card title={`Bảng Kê Chi Tiết 11 Cột — ${user?.fullName || 'Nhân Viên'} (${user?.employeeCode || '—'})`}>
        {loading ? (
          <div className="py-8 text-center text-xs text-ink-muted">Đang tải dữ liệu bảng công...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-canvas border-b border-line text-ink-secondary font-semibold">
                  <th className="py-2.5 px-3">1. Ngày</th>
                  <th className="py-2.5 px-3">2. Thứ</th>
                  <th className="py-2.5 px-3">3. Ca Làm</th>
                  <th className="py-2.5 px-3 text-center">4. Giờ Vào</th>
                  <th className="py-2.5 px-3 text-center">5. Giờ Ra</th>
                  <th className="py-2.5 px-3 text-center">6. Giờ Làm</th>
                  <th className="py-2.5 px-3 text-center">7. Muộn (p)</th>
                  <th className="py-2.5 px-3 text-center">8. Ký Hiệu</th>
                  <th className="py-2.5 px-3">9. Trạng Thái</th>
                  <th className="py-2.5 px-3 text-center">10. Khiếu Nại (S33)</th>
                  <th className="py-2.5 px-3">11. Ghi Chú</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {(!data || data.days.length === 0) && (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-ink-muted">
                      Chưa có dữ liệu bảng công trong tháng này.
                    </td>
                  </tr>
                )}
                {data?.days.map((r) => {
                  const isIssue = r.status === 'LATE' || r.status === 'INCOMPLETE' || r.status === 'ABSENT';
                  const canDisputeThisDay = isOwnTimesheet && data.canDispute && !r.isWeekend && !r.dispute;

                  return (
                    <tr
                      key={r.date}
                      className={`hover:bg-canvas/50 transition-colors ${
                        isIssue ? 'bg-amber-50/20' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3 font-mono font-medium">{r.date}</td>
                      <td className="py-2.5 px-3 text-ink-secondary">{r.weekday}</td>
                      <td className="py-2.5 px-3 text-ink-secondary">Ca chuẩn (08:30–17:30)</td>
                      <td className="py-2.5 px-3 text-center font-mono">{r.checkIn || '—'}</td>
                      <td className="py-2.5 px-3 text-center font-mono">{r.checkOut || '—'}</td>
                      <td className="py-2.5 px-3 text-center font-mono">
                        {r.hoursWorked ? `${r.hoursWorked}h` : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono">
                        {r.lateMinutes ? (
                          <span className="text-amber-700 font-bold">{r.lateMinutes}′</span>
                        ) : (
                          '0'
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold">{r.symbol}</td>
                      <td className="py-2.5 px-3">
                        <Badge
                          variant={
                            r.status === 'ON_TIME'
                              ? 'accent'
                              : r.status === 'LATE'
                              ? 'warn'
                              : r.status === 'INCOMPLETE' || r.status === 'ABSENT'
                              ? 'danger'
                              : r.status === 'WFH'
                              ? 'accent'
                              : 'gray'
                          }
                        >
                          {r.statusText}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {r.dispute ? (
                          <span
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200"
                            title={r.dispute.reason}
                          >
                            <span>⏳</span>
                            <span>{r.dispute.status === 'PENDING' ? 'HR đang xử lý' : r.dispute.status}</span>
                          </span>
                        ) : canDisputeThisDay ? (
                          <button
                            type="button"
                            onClick={() => openDisputeModal(r)}
                            className="text-xs px-2.5 py-1 rounded bg-amber-600 text-white font-medium hover:bg-amber-700 shadow-xs cursor-pointer"
                          >
                            Khiếu nại
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled
                            title={getDisputeTooltip(data.periodStatus)}
                            className="text-xs px-2.5 py-1 rounded border border-line text-ink-muted cursor-not-allowed opacity-50"
                          >
                            Khóa khiếu nại
                          </button>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-ink-secondary text-[11px]">
                        {r.dispute ? `Đã khiếu nại: ${r.dispute.reason}` : r.statusText}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

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
                <span className="ml-2 font-semibold text-rose-700">{disputeDay.statusText}</span>
              </div>
            </div>

            {disputeError && (
              <div className="p-2.5 rounded bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                ⚠️ {disputeError}
              </div>
            )}

            <div>
              <label className="block font-semibold text-ink mb-1">
                Lý do khiếu nại <span className="text-rose-500">* (Bắt buộc)</span>
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
                className="px-4 py-2 rounded-lg bg-accent text-white text-xs font-semibold shadow-xs disabled:opacity-40 disabled:cursor-not-allowed hover:bg-accent-hover transition-colors"
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
