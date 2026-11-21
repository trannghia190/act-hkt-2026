"""
Kiểm tra file .xlsx thật do frontend sinh (fixture đủ loại ký hiệu + XML escaping).
Chạy sau: node tests/frontend/test_timesheet_export.mjs
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from xlsx_read import read_xlsx, values, styles_xml, sheet_xml

PATH = '/tmp/pulse_timesheet_fixture.xlsx'


def check(name, cond, extra=''):
    print(('PASS ' if cond else 'FAIL ') + name + (f' — {extra}' if extra and not cond else ''))
    if not cond:
        sys.exit(1)


sheet_name, dimension, rows = read_xlsx(PATH)
vals = values(rows)

check('XLSX: tên sheet là "Timekeeping Report"', sheet_name == 'Timekeeping Report', sheet_name)
check('XLSX: dimension đúng 53 cột × 2 dòng', dimension == 'A1:BA2', dimension)
check('XLSX: có đúng 1 header + 1 dòng dữ liệu', len(rows) == 2, str(len(rows)))
check('XLSX: mọi dòng đủ 53 ô', all(len(r) == 53 for r in rows), str([len(r) for r in rows]))

header, data = vals
check('XLSX: header ngày 1/2 (Thứ Bảy)', header[5] == '1 - T Bảy', header[5])
check('XLSX: header ngày 28/2 (Thứ Sáu)', header[32] == '28 - T Sáu', header[32])
check('XLSX: ngày 29-31 chỉ ghi số', header[33:36] == ['29', '30', '31'], str(header[33:36]))
check('XLSX: header có dấu phẩy giữ nguyên một ô',
      header[51] == 'Số ngày phép sử dụng, nghỉ bù, nghỉ đặc biệt', header[51])

idx = {h: i for i, h in enumerate(header)}
check('XLSX: tên có &, <, >, dấu phẩy, ngoặc kép đọc lại đúng',
      data[idx['Họ và Tên/Full Name']] == 'A & B <tag> "C"', data[idx['Họ và Tên/Full Name']])
check('XLSX: chức vụ có &, <, > đọc lại đúng',
      data[idx['Chức vụ/Position']] == 'QA & <Lead>', data[idx['Chức vụ/Position']])
check('XLSX: nhóm có dấu phẩy vẫn là một ô', data[idx['Nhóm/Team']] == 'Pine,Team')

check('XLSX: ô ngày 1 = 1.00', data[5] == '1.00', data[5])
check('XLSX: ô ngày 2 = AL/0.50', data[6] == 'AL/0.50', data[6])
check('XLSX: ô ngày 3 = S-BH', data[7] == 'S-BH', data[7])
check('XLSX: WFH = 1.5', data[idx['Làm việc tại nhà/R']] == '1.5')
check('XLSX: Tổng/Total = 25', data[idx['Tổng/Total']] == '25')
check('XLSX: Phép đã dùng = 5', data[idx['Số ngày phép sử dụng, nghỉ bù, nghỉ đặc biệt']] == '5')
check('XLSX: Không hưởng lương = 1.5', data[idx['Số ngày nghỉ không hưởng lương']] == '1.5')

# Số phải lưu kiểu number (không phải text) để Excel tính toán được.
num_cells = [is_num for row in rows for _, is_num in row]
check('XLSX: các cột tổng hợp lưu kiểu số', num_cells.count(True) >= 13, str(num_cells.count(True)))
check('XLSX: ô ngày lưu kiểu text', not rows[1][5][1])

styles = styles_xml(PATH)
check('XLSX: header in đậm', '<b/>' in styles and 'FFD9E1F2' in styles)
check('XLSX: có viền ô', 'style="thin"' in styles, '')
sx = sheet_xml(PATH)
check('XLSX: khóa dòng header', 'state="frozen"' in sx and 'ySplit="1"' in sx)
check('XLSX: có autoFilter', '<autoFilter ref="A1:BA2"/>' in sx)

print('\nALL XLSX FILE TESTS PASSED')
