# 08 — Hộp Thư Việc Cần Làm, Thông Báo & Command Palette (Inbox, Notifications & Command Bar)

> **Mục tiêu:** Mô tả chi tiết Màn hình trung tâm "Cần làm" (Todo Inbox — Screen S02), hệ thống thông báo đa kênh (Push, Email 8h sáng, Badge), ma trận 17 sự kiện nghiệp vụ theo từng vai trò (Actor-based Notifications), thuật toán gộp thông báo chống spam và thanh tìm kiếm toàn năng Command Palette Ctrl+K (Screen S03).

---

## 1. Màn Hình Trung Tâm "Cần Làm" (Todo Inbox — Screen S02)

Thay vì bắt người dùng phải lướt qua nhiều menu con để tìm xem mình cần làm gì, **Todo Inbox là màn hình mặc định đầu tiên xuất hiện ngay sau khi đăng nhập**:

```
┌────────────────────────────────────────────────────────────────────────┐
│ TODO INBOX — VIỆC CẦN LÀM CỦA BẠN (Hôm nay: 18/11/2026)                │
├────────────────────────────────────────────────────────────────────────┤
│ 🔴 [Khẩn cấp] Chưa check-in hôm nay (Ca 08:00 - 17:30)  [Chấm Công Ngay]│
│ 🟡 [Chờ duyệt] 3 đơn xin nghỉ phép của thành viên nhóm [Duyệt Nhanh]   │
│ 🟡 [OKR] Đóng link tự đánh giá cuối năm sau 2 ngày       [Vào Form]     │
│ 🟢 [Thông báo] Số dư phép năm 2026 của bạn còn 8.5 ngày [Xem Sổ Phép]  │
└────────────────────────────────────────────────────────────────────────┘
```

* **Xếp hạng mức độ ưu tiên thông minh:**
  * **Mức 1 (Khẩn cấp - Đỏ):** Các việc sắp hết hạn trong ngày (Check-in ca, đơn sắp quá hạn 23:59, khiếu nại bảng công còn 1 ngày).
  * **Mức 2 (Quan trọng - Vàng):** Các đơn chờ quản lý duyệt, nhắc nhở check-in tiến độ OKR.
  * **Mức 3 (Thông tin - Xanh):** Thông báo biến động số dư phép, thông báo chính sách mới từ HR.
* **Hành động 1-chạm (Actionable Buttons):** Mỗi dòng việc cần làm đều có nút CTA bấm thẳng vào việc, không cần chuyển trang thủ công.

---

## 2. Hệ Thống Thông Báo Đa Kênh & Chống Spam (Notification Engine — S04/S04m)

### 2.1. 3 Kênh Truyền Tải Thông Báo
1. **Push Notifications (Web responsive):** Bắn tức thì khi có sự kiện khẩn (quản lý duyệt/từ chối đơn, cảnh báo quên check-out, đơn quá hạn).
2. **Email Digest (Bản tin tổng hợp 8:00 Sáng):** Thay vì gửi email lẻ tẻ làm ngập hộp thư (inbox fatigue), hệ thống gộp tất cả việc cần xử lý trong ngày thành **1 email duy nhất vào 08:00 sáng**.
3. **In-App Badges & Notification Drawer:** Số đỏ hiển thị trên icon chuông và thanh điều hướng.

### 2.2. Ma Trận 17 Sự Kiện Nghiệp Vụ Theo Vai Trò (Actor-Based Matrix)

| Nhóm Nghiệp Vụ | Sự Kiện Phát Sinh | Người Nhận Thông Báo | Kênh Gửi Mặc Định |
|---|---|---|---|
| **Chấm công** | 1. Quên check-in sau 09:30 | Nhân viên | Web Push (09:45) |
| | 2. Quên check-out sau 18:30 | Nhân viên | Web Push (19:00) |
| | 3. Check-in ngoài mạng (gắn cờ) | Quản lý / HR | Bảng tin hàng tuần |
| **Đơn từ** | 4. Đơn mới được nộp | Quản lý trực tiếp | Push tức thì + Email 8h |
| | 5. Đơn được duyệt / từ chối | Nhân viên gửi đơn | Push tức thì |
| | 6. Đơn quá hạn 24h chưa duyệt | Quản lý trực tiếp | Push nhắc việc (Urgent) |
| | 7. Đơn quá hạn 48h (Auto-escalate)| Quản lý cấp trên + HR | Push + Email |
| | 8. Nhân viên rút đơn | Quản lý trực tiếp | In-app notification |
| **Nghỉ phép** | 9. Cộng phép định kỳ ngày 15 | Nhân viên | In-app notification |
| | 10. Cảnh báo mất phép tồn trước 30 ngày| Nhân viên | Email + Web Push (01/03 & 01/06) |
| | 11. Cảnh báo mất phép tồn trước 3 ngày | Nhân viên | Push khẩn cấp |
| **Bảng công** | 12. Bảng công tháng đã sẵn sàng | Toàn thể nhân viên | Email + In-app |
| | 13. Hết hạn khiếu nại bảng công (2 ngày)| Nhân viên | Web Push |
| | 14. Bảng công được khóa chính thức | Toàn công ty | In-app notification |
| **OKR** | 15. Bắt đầu chu kỳ tạo OKR đầu năm | Toàn thể nhân viên | Email phát động + Push |
| | 16. Nhắc check-in tiến độ giữa năm | Nhân viên + Quản lý| Email 8h sáng |
| | 17. Mở kỳ đánh giá cuối năm (5 bước)| Toàn thể nhân viên | Push + Email có deadline |

### 2.3. Thuật Toán Gộp Thông Báo & Chống Spam (Anti-Spam Throttling)

**Quy tắc bắt buộc (rule `notification`):**
* Tối đa **3 push/ngày/người** — vượt hạn mức thì dồn vào digest 08:00 hôm sau.
* **Giờ yên lặng 21:00–07:00** — không gửi push; việc quá hạn vẫn hiện badge.
* **Dedupe 12 giờ** — cùng một việc không nhắc lặp trong 12h.
* Việc **quá hạn > 3 ngày** → báo thêm cho quản lý; nhân viên vẫn thấy việc.
* Tắt một loại thông báo **không làm mất việc** khỏi trang "Cần làm".

* Nếu Quản lý có 10 thành viên nộp đơn cùng lúc trong vòng 10 phút: Hệ thống tự động gộp thành **1 thông báo duy nhất**: *"Bạn có 10 đơn từ mới đang chờ duyệt từ nhóm của bạn"*, kèm link dẫn thẳng vào màn hình Duyệt hàng loạt (`S12`).

---

## 3. Thanh Tìm Kiếm Toàn Năng Command Palette (Ctrl+K — Screen S03)

Lấy cảm hứng từ các công cụ hiện đại như Linear hay Slack, hệ thống trang bị **Command Palette** mở bằng phím tắt `Ctrl + K` (hoặc `Cmd + K` trên macOS):

```
┌────────────────────────────────────────────────────────────────────────┐
│ 🔍 Nhập lệnh hoặc tìm kiếm nhân viên, quy định, thao tác... (Ctrl+K)   │
├────────────────────────────────────────────────────────────────────────┤
│ Thao Tác Nhanh:                                                        │
│ ⚡ Tạo đơn xin nghỉ phép (AL)                                           │
│ ⚡ Tạo đơn làm việc tại nhà (WFH)                                      │
│ ⚡ Đổi mật khẩu tài khoản                                               │
│ Điều Hướng & Nhân Sự:                                                  │
│ 👤 Vũ Văn Luận (Optimus - Senior Software Engineer)                   │
│ 📄 Bảng công chi tiết tháng 10/2026                                    │
│ 📖 Tra cứu quy định: Hạn mức WFH và luật cộng phép thâm niên           │
└────────────────────────────────────────────────────────────────────────┘
```

* **Khả năng tìm kiếm tức thì (< 50ms):**
  * Tìm nhanh nhân viên theo Tên, Mã NV, Nhóm.
  * Mở nhanh các form tạo đơn hành chính trong 1 giây.
  * Tìm kiếm văn bản quy định trong Rule Engine.
  * Dành cho Quản lý & HR: Tìm nhanh nhân viên để chuyển hướng thẳng đến bảng công hoặc hồ sơ OKR của người đó.
