/**
 * Dữ liệu bảng công 53 cột theo đúng mẫu HR (Pine):
 * 5 cột thông tin + 31 cột ngày + 17 cột tổng hợp (AK–BA).
 *
 * Tách khỏi component để test được với nhiều tháng / bộ lọc / ký hiệu khác nhau.
 * File .xlsx được đóng gói ở timesheetXlsx.ts từ chính dữ liệu này.
 */

export type ExportCell = string | number;

export interface TimesheetExportRow {
  code: string;
  fullName: string;
  positionName?: string | null;
  team: string;
  managerCode?: string | null;
  wfhDays: number;
  totalDays: number;
  holidayDays: number;
  paidLeaveDays: number;
  specialLeaveDays: number;
  sickDays: number;
  sickBhDays: number;
  compDays: number;
  unpaidDays: number;
  maternityDays: number;
  paternityDays: number;
  remainingLeave: number;
}

export interface TimesheetExportData {
  headers: string[];
  /** Giá trị gốc (chưa bọc ngoặc kép) — dùng cho cả CSV và XLSX. */
  dataRows: ExportCell[][];
  dayColumns: number;
  daysInMonth: number;
  month: string;
  year: string;
  safeTeam: string;
}

export interface TimesheetExport extends TimesheetExportData {
  /** Nội dung CSV kèm BOM UTF-8 (giữ lại cho công cụ khác / test). */
  csv: string;
  filename: string;
}

const DAY_COLUMNS = 31;
const HEADERS = [
  'STT', 'Mã NV/Code', 'Họ và Tên/Full Name', 'Chức vụ/Position', 'Nhóm/Team',
  'Quản lý trực tiếp', 'Làm việc tại nhà/R', 'Tổng ngày công', 'Nghỉ lễ/NL', 'Ngày phép/AL',
  'Nghỉ chế độ/CL', 'Nghỉ ốm/S', 'Nghỉ ốm BH', 'Nghỉ bù/RO', 'Nghỉ không lương/UP',
  'Nghỉ thai sản/ML', 'Nghỉ việc riêng khi có vợ sinh/PL', 'Tổng/Total',
  'Tổng số ngày phép còn lại', 'Số ngày làm việc thực tế',
  'Số ngày phép sử dụng, nghỉ bù, nghỉ đặc biệt', 'Số ngày nghỉ không hưởng lương',
];

const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;

function parseMonth(month: string): { monthIndex: number; year: number } {
  const [mm, yyyy] = month.split('/');
  const monthIndex = Number(mm) - 1;
  const year = Number(yyyy);
  if (!Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11 || !Number.isInteger(year)) {
    throw new Error(`Tháng không hợp lệ: ${month}`);
  }
  return { monthIndex, year };
}

/**
 * Sinh header + dòng dữ liệu gốc của bảng công.
 * @param rows      đúng các dòng đang hiển thị (đã áp nhóm/tìm kiếm/lọc nhanh)
 * @param month     định dạng "MM/YYYY"
 * @param daySymbol hàm lấy ký hiệu ô ngày (đã gồm override HR đang sửa trên lưới)
 * @param teamLabel nhãn nhóm dùng trong tên file; "All" khi không lọc
 */
export function buildTimesheetExportData<T extends TimesheetExportRow>(
  rows: T[],
  month: string,
  daySymbol: (row: T, day: number) => string,
  teamLabel = 'All',
): TimesheetExportData {
  const { monthIndex, year } = parseMonth(month);
  // Tháng 2/30 ngày vẫn đủ 31 cột theo mẫu HR, nhưng ngày không tồn tại chỉ ghi số.
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const days = Array.from({ length: DAY_COLUMNS }, (_, i) => i + 1);

  const headers = [
    ...HEADERS.slice(0, 5),
    ...days.map(d => (d <= daysInMonth
      ? `${d} - ${weekdayName(year, monthIndex, d)}`
      : `${d}`)),
    ...HEADERS.slice(5),
  ];

  const dataRows: ExportCell[][] = rows.map((r, idx) => {
    const total = r.totalDays + r.holidayDays + r.paidLeaveDays + r.specialLeaveDays + r.sickDays
      + r.sickBhDays + r.compDays + r.unpaidDays + r.maternityDays + r.paternityDays;
    return [
      idx + 1, r.code, String(r.fullName ?? ''), String(r.positionName || ''), String(r.team ?? ''),
      ...days.map(d => daySymbol(r, d) || ''),
      r.managerCode || '', r.wfhDays, r.totalDays, r.holidayDays, r.paidLeaveDays,
      r.specialLeaveDays, r.sickDays, r.sickBhDays, r.compDays, r.unpaidDays,
      r.maternityDays, r.paternityDays, total, r.remainingLeave,
      r.totalDays,
      r.holidayDays + r.paidLeaveDays + r.specialLeaveDays + r.sickDays + r.compDays,
      r.sickBhDays + r.unpaidDays + r.maternityDays + r.paternityDays,
    ];
  });

  return {
    headers,
    dataRows,
    dayColumns: DAY_COLUMNS,
    daysInMonth,
    month: String(monthIndex + 1),
    year: String(year),
    safeTeam: String(teamLabel).replace(/[\\/:*?"<>|]/g, '-').trim() || 'All',
  };
}

/** Wrapper tương thích cũ: dữ liệu + nội dung CSV. */
export function buildTimesheetExport<T extends TimesheetExportRow>(
  rows: T[],
  month: string,
  daySymbol: (row: T, day: number) => string,
  teamLabel = 'All',
): TimesheetExport {
  const data = buildTimesheetExportData(rows, month, daySymbol, teamLabel);
  const csvHeaders = data.headers.map(h => (/[,"]/.test(h) ? q(h) : h));
  const csvRows = data.dataRows.map(r => r.map(v => (typeof v === 'number' ? String(v) : q(v))));
  const csv = '﻿' + [csvHeaders.join(','), ...csvRows.map(r => r.join(','))].join('\n');
  return {
    ...data,
    csv,
    filename: `${data.safeTeam}_Timekeeping_Report_${data.month}_${data.year}.csv`,
  };
}

function weekdayName(year: number, monthIndex: number, day: number): string {
  return ['CN', 'T Hai', 'T Ba', 'T Tư', 'T Năm', 'T Sáu', 'T Bảy'][new Date(year, monthIndex, day).getDay()];
}
