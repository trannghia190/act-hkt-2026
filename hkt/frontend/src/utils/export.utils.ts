/**
 * Xuất dữ liệu sang định dạng CSV/Excel với UTF-8 BOM, đảm bảo tiếng Việt hiển thị chính xác trong Excel
 */
export function exportToCsv(filename: string, headers: string[], rows: (string | number)[][]): void {
  const csvContent =
    'data:text/csv;charset=utf-8,\uFEFF' +
    [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
