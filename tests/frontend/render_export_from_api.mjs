/**
 * Lấy payload /timesheets thật của kịch bản seed → map như TimesheetPage → chạy module xuất thật.
 * Dùng: node render_export_from_api.mjs <api-payload.json> <out.csv> [month]
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadExportModule, loadXlsxModule } from './buildExport.mjs';

const [, , inPath, outPath, month = '2/2025'] = process.argv;
const data = JSON.parse(fs.readFileSync(inPath, 'utf8'));

// Giữ đồng bộ với mapping trong TimesheetPage.loadSheet().
const rows = (data.rows || []).map((r, i) => ({
  id: String(i + 1), code: r.employeeCode, fullName: r.fullName,
  department: r.teamName || '—', team: r.teamName || '—',
  positionName: r.positionName || '—', managerCode: r.managerCode || '',
  standardDays: r.standardDays ?? 0, actualWorkDays: r.actualDays ?? 0,
  paidLeaveDays: r.leaveDays ?? 0, holidayDays: r.holidayDays ?? 0, wfhDays: r.wfhDays ?? 0,
  lateCount: r.lateCount ?? 0, penaltyLatePercent: 0, otWeekdayHours: 0, otWeekendHours: 0,
  totalPayrollDays: r.actualDays ?? 0, status: data.status === 'locked' ? 'HR_LOCKED' : 'OPEN',
  sickDays: r.sickDays ?? 0, sickBhDays: r.sickBhDays ?? 0, compDays: r.compDays ?? 0,
  unpaidDays: r.unpaidDays ?? 0, maternityDays: r.maternityDays ?? 0,
  paternityDays: r.paternityDays ?? 0, specialLeaveDays: r.specialLeaveDays ?? 0,
  totalDays: r.totalDays ?? 0, remainingLeave: r.remainingLeave ?? 0,
}));
const daySymbol = (row, day) => {
  const apiRow = data.rows[Number(row.id) - 1];
  return (apiRow?.days || {})[String(day)] || '';
};

if (path.extname(outPath).toLowerCase() === '.xlsx') {
  const { buildTimesheetXlsx } = loadXlsxModule();
  const res = buildTimesheetXlsx(rows, month, daySymbol, 'All');
  fs.writeFileSync(outPath, Buffer.from(res.bytes));
  console.log(res.filename);
} else {
  const { buildTimesheetExport } = loadExportModule();
  const res = buildTimesheetExport(rows, month, daySymbol, 'All');
  fs.writeFileSync(outPath, res.csv, 'utf8');
  console.log(res.filename);
}
