/**
 * Xuất bảng công ra .xlsx thật (OOXML) — không cần thư viện ngoài.
 *
 * Vì sao không dùng CSV: Excel bản Việt Nam coi dấu `,` là phân cách thập phân và
 * dấu `;` là phân cách cột, nên CSV dễ dồn cả bảng vào một cột / hiểu sai số.
 * File .xlsx lưu kiểu dữ liệu và định dạng ô nên mở ra là đúng bảng.
 */
import { buildTimesheetExportData, type ExportCell, type TimesheetExportRow } from './timesheetExport';

const enc = new TextEncoder();

/* ----------------------------- ZIP (store) ----------------------------- */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(data: Uint8Array): number {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

/** Đóng gói ZIP không nén (method 0) — Excel chấp nhận và không cần thư viện. */
function zipStore(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const entries = files.map(f => ({
    name: enc.encode(f.name), data: f.data, crc: crc32(f.data), offset: 0,
  }));
  const localSize = entries.reduce((s, e) => s + 30 + e.name.length + e.data.length, 0);
  const centralSize = entries.reduce((s, e) => s + 46 + e.name.length, 0);
  const out = new Uint8Array(localSize + centralSize + 22);
  const dv = new DataView(out.buffer);
  let p = 0;
  for (const e of entries) {
    e.offset = p;
    dv.setUint32(p, 0x04034b50, true); p += 4;
    dv.setUint16(p, 20, true); p += 2;
    dv.setUint16(p, 0x0800, true); p += 2;
    dv.setUint16(p, 0, true); p += 2;
    dv.setUint16(p, 0, true); p += 2;
    dv.setUint16(p, 0x21, true); p += 2;
    dv.setUint32(p, e.crc, true); p += 4;
    dv.setUint32(p, e.data.length, true); p += 4;
    dv.setUint32(p, e.data.length, true); p += 4;
    dv.setUint16(p, e.name.length, true); p += 2;
    dv.setUint16(p, 0, true); p += 2;
    out.set(e.name, p); p += e.name.length;
    out.set(e.data, p); p += e.data.length;
  }
  const cdStart = p;
  for (const e of entries) {
    dv.setUint32(p, 0x02014b50, true); p += 4;
    dv.setUint16(p, 0x0314, true); p += 2;
    dv.setUint16(p, 20, true); p += 2;
    dv.setUint16(p, 0x0800, true); p += 2;
    dv.setUint16(p, 0, true); p += 2;
    dv.setUint16(p, 0, true); p += 2;
    dv.setUint16(p, 0x21, true); p += 2;
    dv.setUint32(p, e.crc, true); p += 4;
    dv.setUint32(p, e.data.length, true); p += 4;
    dv.setUint32(p, e.data.length, true); p += 4;
    dv.setUint16(p, e.name.length, true); p += 2;
    dv.setUint16(p, 0, true); p += 2;
    dv.setUint16(p, 0, true); p += 2;
    dv.setUint16(p, 0, true); p += 2;
    dv.setUint16(p, 0, true); p += 2;
    dv.setUint32(p, 0, true); p += 4;
    dv.setUint32(p, e.offset, true); p += 4;
    out.set(e.name, p); p += e.name.length;
  }
  const cdSize = p - cdStart;
  dv.setUint32(p, 0x06054b50, true); p += 4;
  dv.setUint16(p, 0, true); p += 2;
  dv.setUint16(p, 0, true); p += 2;
  dv.setUint16(p, entries.length, true); p += 2;
  dv.setUint16(p, entries.length, true); p += 2;
  dv.setUint32(p, cdSize, true); p += 4;
  dv.setUint32(p, cdStart, true); p += 4;
  dv.setUint16(p, 0, true); p += 2;
  return out;
}

/* ----------------------------- XLSX XML ----------------------------- */

const xml = (s: string) => s
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

const colLetter = (n: number): string => {
  let s = '';
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
};

function cellXml(ref: string, value: ExportCell, style: number): string {
  if (value === '' || value == null) return `<c r="${ref}" s="${style}"/>`;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<c r="${ref}" s="${style}"><v>${value}</v></c>`;
  }
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(String(value))}</t></is></c>`;
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

const WORKBOOK = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="Timekeeping Report" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;

const WORKBOOK_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2">
  <font><sz val="10"/><name val="Calibri"/></font>
  <font><b/><sz val="10"/><name val="Calibri"/></font>
</fonts>
<fills count="3">
  <fill><patternFill patternType="none"/></fill>
  <fill><patternFill patternType="gray125"/></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FFD9E1F2"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="2">
  <border><left/><right/><top/><bottom/><diagonal/></border>
  <border><left style="thin"><color rgb="FFB0B0B0"/></left><right style="thin"><color rgb="FFB0B0B0"/></right><top style="thin"><color rgb="FFB0B0B0"/></top><bottom style="thin"><color rgb="FFB0B0B0"/></bottom><diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="3">
  <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
  <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
  <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

function sheetXml(headers: string[], rows: ExportCell[][]): string {
  const lastCol = colLetter(headers.length);
  const lastRow = rows.length + 1;
  const widths = headers.map((h, i) => {
    if (i === 0) return 5;
    if (i === 1) return 12;
    if (i === 2) return 26;
    if (i === 3 || i === 4) return 22;
    if (i < 36) return 7;
    return Math.max(12, Math.min(34, h.length + 2));
  });
  const cols = widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('');
  const headerRow = `<row r="1" ht="30" customHeight="1">${headers
    .map((h, i) => cellXml(`${colLetter(i + 1)}1`, h, 1)).join('')}</row>`;
  const bodyRows = rows.map((r, ri) => `<row r="${ri + 2}">${r
    .map((v, ci) => cellXml(`${colLetter(ci + 1)}${ri + 2}`, v, 2)).join('')}</row>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<dimension ref="A1:${lastCol}${lastRow}"/>
<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
<cols>${cols}</cols>
<sheetData>${headerRow}${bodyRows}</sheetData>
<autoFilter ref="A1:${lastCol}${lastRow}"/>
</worksheet>`;
}

export interface TimesheetXlsx {
  bytes: Uint8Array;
  filename: string;
  headers: string[];
  dataRows: ExportCell[][];
}

/**
 * Sinh file .xlsx từ đúng dữ liệu đang hiển thị trên lưới.
 * @param rows      các dòng đang hiển thị (đã lọc/tìm kiếm)
 * @param month     "MM/YYYY"
 * @param daySymbol hàm lấy ký hiệu ô ngày (gồm cả ô HR sửa tay)
 * @param teamLabel nhãn nhóm trong tên file
 */
export function buildTimesheetXlsx<T extends TimesheetExportRow>(
  rows: T[],
  month: string,
  daySymbol: (row: T, day: number) => string,
  teamLabel = 'All',
): TimesheetXlsx {
  const data = buildTimesheetExportData(rows, month, daySymbol, teamLabel);
  const files = [
    { name: '[Content_Types].xml', data: enc.encode(CONTENT_TYPES) },
    { name: '_rels/.rels', data: enc.encode(ROOT_RELS) },
    { name: 'xl/workbook.xml', data: enc.encode(WORKBOOK) },
    { name: 'xl/_rels/workbook.xml.rels', data: enc.encode(WORKBOOK_RELS) },
    { name: 'xl/styles.xml', data: enc.encode(STYLES) },
    { name: 'xl/worksheets/sheet1.xml', data: enc.encode(sheetXml(data.headers, data.dataRows)) },
  ];
  return {
    bytes: zipStore(files),
    filename: `${data.safeTeam}_Timekeeping_Report_${data.month}_${data.year}.xlsx`,
    headers: data.headers,
    dataRows: data.dataRows,
  };
}
