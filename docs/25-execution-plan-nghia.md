# 25 — Kế hoạch thực thi 21 task của Nghĩa (C + D + E)

> **Nguồn:** `docs/task-tracking.xlsx` (mô tả, Prompt AI, tiêu chí nghiệm thu, mockup, tài liệu)
> **Nguyên tắc:** làm theo dependency, mỗi task xong → cập nhật `Trạng thái` + `Đạt?` trong file tracking.

## 1. Thứ tự thực thi

| Batch | Task | Điều kiện |
|---|---|---|
| **1** | **E3** Cấu hình quy định · **E4** Cấu hình 1 luật · **E5** Trang quy định tra cứu | Không phụ thuộc |
| **1b** | **E6** Ca & lịch nghỉ lễ · **E7** Quản lý loại nghỉ | Không phụ thuộc |
| **2** | **E8** Quản lý thiết bị | sau B5 (Hà) |
| **2b** | **C6c** Số dư phép · **C4c** Xin nghỉ phép · **D5** Sổ phép · **E10** Bảng phép | sau E8/E7 |
| **2c** | **C5c** Đăng ký WFH · **D3** Lịch nhóm | sau E7 |
| **3** | **C1c** Đi muộn prefill · **C2c** Bổ sung công · **C3c** Đơn của tôi · **D1** Duyệt đơn · **D2** Chi tiết đơn | sau B1 (Hà) |
| **4** | **E1** Bảng công & chốt · **E2** Bộ lọc + lưu view | sau C1c/C2c |
| **5** | **E9** Danh sách khiếu nại · **D4** Chi tiết khiếu nại | sau E1, sửa vòng D4↔E9 |

## 2. Sửa trước khi chạy- **Vòng dependency D4 ↔ E9**: đổi `D4` phụ thuộc `E1, B4`; `E9` phụ thuộc `E1`.
- Cập nhật trạng thái thực tế (nhiều task đã có code) để mở khoá dependency.

## 3. Định nghĩa "Xong"- Tất cả tiêu chí trong sheet **Tiêu chí nghiệm thu** đạt → `Đạt? = Có`.
- `npx tsc --noEmit` + `mvn compile` + `bash scripts/check-consistency.sh` pass.
- Cập nhật `Trạng thái = Xong`, `Cập nhật lần cuối`, ghi chú test vào file tracking.
