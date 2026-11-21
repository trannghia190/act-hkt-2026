/**
 * Test nội dung file xuất bảng công (frontend) với nhiều tháng và ký hiệu khác nhau.
 * Chạy: node tests/frontend/test_timesheet_export.mjs
 */
import fs from 'node:fs';
import { loadExportModule, loadXlsxModule } from './buildExport.mjs';

const { buildTimesheetExport } = loadExportModule();
const { buildTimesheetXlsx } = loadXlsxModule();

let passed = 0;
const failures = [];
function check(name, cond, detail = '') {
  if (cond) { passed++; console.log(`PASS ${name}`); }
  else { failures.push(name); console.log(`FAIL ${name}${detail ? ' — ' + detail : ''}`); }
}

/** CSV parser RFC4180 tối giản (đủ cho file xuất, không có ô nhiều dòng). */
function parseCsv(text) {
  const s = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
  const rows = []; let row = []; let cur = ''; let quoted = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (c !== '\r') cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

const base = (over = {}) => ({
  code: '01HR', fullName: 'Nguyễn Văn A', positionName: 'HR Admin', team: 'Pine',
  managerCode: '05ACT', wfhDays: 0, totalDays: 0, holidayDays: 0, paidLeaveDays: 0,
  specialLeaveDays: 0, sickDays: 0, sickBhDays: 0, compDays: 0, unpaidDays: 0,
  maternityDays: 0, paternityDays: 0, remainingLeave: 12, ...over,
});
const idx = (headers, name) => headers.indexOf(name);

// ---------- 1. Tháng 11/2026 (30 ngày) ----------
{
  const res = buildTimesheetExport([base()], '11/2026', () => '');
  const rows = parseCsv(res.csv);
  check('11/2026: đúng 53 cột', res.headers.length === 53, String(res.headers.length));
  check('11/2026: header và dòng dữ liệu cùng số cột', rows.every(r => r.length === 53),
    rows.map(r => r.length).join(','));
  check('11/2026: ngày 1 là Chủ nhật', res.headers[5] === '1 - CN', res.headers[5]);
  check('11/2026: ngày 30 là Thứ Hai', res.headers[34] === '30 - T Hai', res.headers[34]);
  check('11/2026: ngày 31 không gán nhầm thứ (chỉ ghi "31")', res.headers[35] === '31', res.headers[35]);
  check('11/2026: ô ngày 31 để trống', res.dataRows[0][35] === '', String(res.dataRows[0][35]));
  check('11/2026: CSV vẫn giữ ô ngày 31 rỗng', parseCsv(res.csv)[1][35] === '', parseCsv(res.csv)[1][35]);
  check('11/2026: header có dấu phẩy được bọc ngoặc kép',
    rows[0].includes('Số ngày phép sử dụng, nghỉ bù, nghỉ đặc biệt'));
}

// ---------- 2. Tháng 2/2026 (28 ngày) và 2/2024 (29 ngày nhuận) ----------
for (const [month, lastDay, labelLast] of [['2/2026', 28, '28 - T Bảy'], ['2/2024', 29, '29 - T Năm']]) {
  const res = buildTimesheetExport([base()], month, () => '');
  check(`${month}: ngày ${lastDay} có thứ`, res.headers[5 + lastDay - 1] === labelLast,
    res.headers[5 + lastDay - 1]);
  for (const d of new Set([lastDay + 1, lastDay + 2, 31])) {
    check(`${month}: ngày ${d} không tồn tại chỉ ghi số`, res.headers[5 + d - 1] === String(d),
      res.headers[5 + d - 1]);
  }
}

// ---------- 3. Đủ loại ký hiệu + tên có dấu phẩy/ngoặc kép + công thức 17 cột ----------
{
  const sym = {
    1: '1.00', 2: '0.50', 3: 'R', 4: 'R/0.50', 5: 'AL', 6: 'AL/0.50', 7: 'S',
    8: 'S-BH', 9: 'RO', 10: 'UP', 11: 'ML', 12: 'PL', 13: 'CL', 14: '', 15: '0.5/AL',
  };
  const row = base({
    code: '137ACT', fullName: 'Nguyễn "A", B', positionName: null, team: 'Pine,Team',
    managerCode: '05ACT', wfhDays: 1.5, totalDays: 18.5, holidayDays: 1, paidLeaveDays: 2,
    specialLeaveDays: 0.5, sickDays: 1, sickBhDays: 0.5, compDays: 0.5, unpaidDays: 1,
    maternityDays: 0, paternityDays: 0, remainingLeave: 7.5,
  });
  const res = buildTimesheetExport([row], '11/2026', (_r, d) => sym[d] ?? '');
  const rows = parseCsv(res.csv);
  const h = rows[0]; const d = rows[1];
  check('ký hiệu: đủ loại ô ngày xuất đúng thứ tự',
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map(n => d[5 + n - 1]).join('|')
      === ['1.00', '0.50', 'R', 'R/0.50', 'AL', 'AL/0.50', 'S', 'S-BH', 'RO', 'UP', 'ML', 'PL', 'CL', '', '0.5/AL'].join('|'),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map(n => d[5 + n - 1]).join('|'));
  check('tên có dấu phẩy/ngoặc kép được giữ nguyên', d[idx(h, 'Họ và Tên/Full Name')] === 'Nguyễn "A", B',
    d[idx(h, 'Họ và Tên/Full Name')]);
  check('nhóm có dấu phẩy không vỡ cột', d[idx(h, 'Nhóm/Team')] === 'Pine,Team', d[idx(h, 'Nhóm/Team')]);
  check('chức vụ null xuất chuỗi rỗng', d[idx(h, 'Chức vụ/Position')] === '');
  check('WFH = wfhDays', d[idx(h, 'Làm việc tại nhà/R')] === '1.5');
  check('Tổng ngày công = totalDays', d[idx(h, 'Tổng ngày công')] === '18.5');
  check('Tổng/Total = công + toàn bộ nghỉ', d[idx(h, 'Tổng/Total')] === '25', d[idx(h, 'Tổng/Total')]);
  check('Phép đã dùng = NL+AL+CL+S+RO', d[idx(h, 'Số ngày phép sử dụng, nghỉ bù, nghỉ đặc biệt')] === '5',
    d[idx(h, 'Số ngày phép sử dụng, nghỉ bù, nghỉ đặc biệt')]);
  check('Không hưởng lương = S-BH+UP+ML+PL', d[idx(h, 'Số ngày nghỉ không hưởng lương')] === '1.5',
    d[idx(h, 'Số ngày nghỉ không hưởng lương')]);
  check('Số ngày làm việc thực tế = Tổng ngày công', d[idx(h, 'Số ngày làm việc thực tế')] === '18.5');
  check('Phép còn lại = remainingLeave', d[idx(h, 'Tổng số ngày phép còn lại')] === '7.5');
}

// ---------- 4. Xuất theo bộ lọc: STT đánh lại từ 1, đúng số dòng ----------
{
  const rows = [base({ code: 'B' }), base({ code: 'C' }), base({ code: 'D' })];
  const res = buildTimesheetExport(rows, '3/2026', () => '');
  const parsed = parseCsv(res.csv);
  check('lọc: chỉ xuất số dòng được truyền', parsed.length === 4, String(parsed.length));
  check('lọc: STT đánh lại 1..n', parsed.slice(1).map(r => r[0]).join(',') === '1,2,3',
    parsed.slice(1).map(r => r[0]).join(','));
  check('lọc: giữ đúng thứ tự dòng', parsed.slice(1).map(r => r[1]).join(',') === 'B,C,D');
}

// ---------- 5. Tên file + tháng không hợp lệ ----------
{
  const res = buildTimesheetExport([base()], '11/2026', () => '', 'Pine/Team:*?');
  check('tên file đúng mẫu và đã làm sạch ký tự cấm',
    res.filename === 'Pine-Team---_Timekeeping_Report_11_2026.csv', res.filename);
  let threw = false;
  try { buildTimesheetExport([base()], '13/2026', () => ''); } catch { threw = true; }
  check('tháng không hợp lệ bị chặn', threw);
}

// ---------- 6. BOM UTF-8 ----------
{
  const res = buildTimesheetExport([base()], '11/2026', () => '');
  check('CSV bắt đầu bằng BOM UTF-8', res.csv.charCodeAt(0) === 0xFEFF);
}

// ---------- 7. XLSX: sinh file thật để test_timesheet_xlsx.py mở lại kiểm tra ----------
{
  const row = base({
    code: 'XLSX01', fullName: 'A & B <tag> "C"', positionName: 'QA & <Lead>',
    team: 'Pine,Team', managerCode: '05ACT', wfhDays: 1.5, totalDays: 18.5, holidayDays: 1,
    paidLeaveDays: 2, specialLeaveDays: 0.5, sickDays: 1, sickBhDays: 0.5, compDays: 0.5,
    unpaidDays: 1, maternityDays: 0, paternityDays: 0, remainingLeave: 7.5,
  });
  const sym = { 1: '1.00', 2: 'AL/0.50', 3: 'S-BH', 4: 'R/0.50', 5: 'AL', 6: 'S', 7: 'RO', 8: 'UP', 9: 'CL' };
  const x = buildTimesheetXlsx([row], '2/2025', (_r, d) => sym[d] ?? '', 'Pine/Team:');
  fs.writeFileSync('/tmp/pulse_timesheet_fixture.xlsx', Buffer.from(x.bytes));
  check('XLSX: file bắt đầu bằng chữ ký ZIP "PK"', x.bytes[0] === 0x50 && x.bytes[1] === 0x4B);
  check('XLSX: tên file .xlsx', x.filename === 'Pine-Team-_Timekeeping_Report_2_2025.xlsx', x.filename);
  check('XLSX: file có dữ liệu thực (> 2KB)', x.bytes.length > 2048, String(x.bytes.length));
}

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log('FAILED: ' + failures.join(' | '));
  process.exit(1);
}
console.log('ALL TIMESHEET EXPORT TESTS PASSED');
