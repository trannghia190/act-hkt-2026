-- Chuẩn hoá mã loại nghỉ trong dữ liệu cũ: bảng công in thẳng leave_type làm ký hiệu ô công
-- nên mã không nằm trong danh mục leave_types (vd 'SICK') sẽ hiện sai chuẩn ('SICK' thay vì 'S').
update requests set leave_type = 'S' where leave_type = 'SICK';
update requests set leave_type = 'AL' where leave_type = 'ANNUAL';
update leave_ledger set leave_type = 'S' where leave_type = 'SICK';
update leave_ledger set leave_type = 'AL' where leave_type = 'ANNUAL';
