"""Đọc tối thiểu file .xlsx (ZIP + OOXML) bằng thư viện chuẩn để kiểm tra nội dung."""
import zipfile
import xml.etree.ElementTree as ET

NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
T = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t'


def read_xlsx(path):
    """Trả về (tên sheet, dimension, rows). Mỗi ô là (giá_trị, is_number)."""
    z = zipfile.ZipFile(path)
    assert z.testzip() is None, 'ZIP hỏng'
    names = set(z.namelist())
    for required in ('[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml',
                     'xl/worksheets/sheet1.xml', 'xl/styles.xml'):
        assert required in names, f'Thiếu part {required}'
    wb = ET.fromstring(z.read('xl/workbook.xml'))
    sheet_name = wb.find('.//m:sheet', NS).get('name')
    sheet = ET.fromstring(z.read('xl/worksheets/sheet1.xml'))
    dimension = sheet.find('m:dimension', NS).get('ref')
    rows = []
    for row in sheet.findall('.//m:sheetData/m:row', NS):
        cells = []
        for c in row.findall('m:c', NS):
            if c.get('t') == 'inlineStr':
                cells.append((''.join(x.text or '' for x in c.iter(T)), False))
            else:
                v = c.find('m:v', NS)
                cells.append(('' if v is None else v.text, v is not None))
        rows.append(cells)
    return sheet_name, dimension, rows


def values(rows):
    return [[v for v, _ in row] for row in rows]


def styles_xml(path):
    return zipfile.ZipFile(path).read('xl/styles.xml').decode('utf-8')


def sheet_xml(path):
    return zipfile.ZipFile(path).read('xl/worksheets/sheet1.xml').decode('utf-8')
