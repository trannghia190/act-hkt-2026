# 02 — Chấm Công Di Động, Xác Thực Khuôn Mặt & Chống Gian Lận (Mobile Attendance & Anti-Fraud)

> **Mục tiêu:** Mô tả chi tiết trải nghiệm Chấm công 1 chạm trên thiết bị di động, cơ chế xác thực nhận diện khuôn mặt kèm Liveness detection, kiểm tra 5 lớp song song, chuẩn hóa mốc thời gian Server Timestamp và quy trình xử lý ngoại lệ chấm công offline.

---

## 1. Trải Nghiệm Người Dùng (UX 1 Chạm — Screen S05m)

* **Thiết bị ưu tiên:** Chấm công được tối ưu hóa 100% trên thiết bị di động (**Mobile-First**). Máy tính (Web) chỉ hỗ trợ xem dữ liệu và tạo đơn (để ngăn ngừa giả mạo GPS và thiết bị).
* **Bố cục màn hình S05m:**
  * Giờ hiện tại theo chuẩn thời gian máy chủ (đồng bộ động).
  * Trạng thái ngày hôm nay (Chưa check-in / Đã check-in lúc HH:mm / Đã đủ công).
  * Khung quét Camera tròn (Preview căn khuôn mặt) đường kính 160px.
  * **1 Nút bấm duy nhất:** Kích thước lớn (112px) `[VÀO CA]` hoặc `[RA CA]`.
* **Quy trình tương tác:**
  ```
  Mở App → Khung camera kích hoạt → Căn mặt vào khung
         → Bấm 1 chạm
         → Chớp mắt nhẹ (Liveness check 0.5s)
         → Hệ thống quét song song 5 lớp (< 2s)
         → Báo Xanh + Rung nhẹ điện thoại (Haptic feedback)
         → Cập nhật trạng thái tức thì
  ```

---

## 2. Kiến Trúc 5 Lớp Xác Thực Chống Gian Lận

Để đảm bảo dữ liệu chấm công có tính pháp lý và tin cậy tuyệt đối để đưa thẳng vào bảng lương, hệ thống thực thi 5 lớp kiểm tra:

### Lớp 1: Nhận Diện Khuôn Mặt & Phát Hiện Người Thật (Face & Liveness Detection)
* **Client-side Liveness:** Sử dụng mô hình AI nhẹ trên client (Face Mesh / BlazeFace) để nhận diện chuyển động tự nhiên:
  * Phát hiện chớp mắt (Eye blink detection).
  * Phát hiện chuyển động 3D của khuôn mặt (Micro-movements) nhằm loại bỏ:
    * Ảnh in màu tĩnh trên giấy.
    * Màn hình điện thoại/iPad phát lại video người khác.
* **Vector Matching:** 
  * Client trích xuất vector khuôn mặt hiện tại (128D/512D) gửi lên server cùng ảnh chụp khoảnh khắc.
  * Server tính khoảng cách Cosine Distance với vector mẫu ban đầu của nhân viên (`face_embeddings`):
    $$\text{Cosine Similarity} \ge 0.82 \implies \text{HỢP LỆ}$$
  * Nếu không khớp: Lập tức từ chối và thông báo: *"Khuôn mặt không khớp với hồ sơ nhân viên"*.

### Lớp 2: Kiểm Tra Mạng Nội Bộ (Office WiFi / BSSID / Subnet IP)
* Khi bấm chấm công, ứng dụng lấy thông tin kết nối hiện tại:
  * Tên mạng WiFi (SSID) và địa chỉ MAC của Access Point (BSSID).
  * Địa chỉ IP công cộng (Public IP) hoặc Dải IP mạng nội bộ (Subnet).
* Đối chiếu với danh sách mạng văn phòng do HR cấu hình trong Rule Engine:
  * **Khớp WiFi công ty:** Đạt chuẩn hợp lệ.
  * **Ngoài mạng:** Nếu không có đơn WFH được duyệt $\rightarrow$ Đánh dấu cờ cảnh báo `OUTSIDE_OFFICE_NETWORK`.

### Lớp 3: Định Vị Văn Phòng (Geofencing 2 Vùng)
* Tọa độ văn phòng ACT được cấu hình trong hệ thống (Kinh độ, Vĩ độ).
* Hệ thống tính khoảng cách Euclidean/Haversine giữa vị trí GPS của điện thoại và tâm văn phòng:
  * **Vùng 1 ($\le 150m$):** Nằm hoàn toàn trong khuôn viên văn phòng $\rightarrow$ Hợp lệ.
  * **Vùng 2 ($150m - 300m$):** Do nhiễu sóng tòa nhà hoặc đi bộ gần cửa $\rightarrow$ **Vẫn cho chấm công**, nhưng tự động gắn cờ `LOW_GPS_ACCURACY` để HR hậu kiểm khi cần.
  * **Vùng 3 ($> 300m$):** Nằm ngoài phạm vi văn phòng $\rightarrow$ **Chặn hoàn toàn** (Báo lỗi: *"Bạn đang ở ngoài phạm vi văn phòng"*), trừ trường hợp hôm đó nhân viên có đơn **WFH đã được phê duyệt**.

### Lớp 4: Khóa Thiết Bị Phần Cứng (Device Fingerprint Binding)
* Mỗi nhân viên chỉ được liên kết với **1 thiết bị di động duy nhất** (`hardware_device_id` / `vendor_uuid`).
* Nếu đăng nhập trên thiết bị lạ để chấm công hộ: Hệ thống chặn lại và yêu cầu gửi yêu cầu thay đổi thiết bị đến HR (Screen S28/S29).

### Lớp 5: Chuẩn Hóa Thời Gian Máy Chủ (Server Timestamp)
* **Tuyệt đối không sử dụng `client_time`** của điện thoại để làm căn cứ chấm công.
* Khi request gửi lên backend, trường `check_in_time` được gán bằng `NOW()` của máy chủ database (được đồng bộ chuẩn qua NTP Server).
* Ngăn chặn 100% việc nhân viên chỉnh lùi giờ trên cài đặt điện thoại để "cứu" việc đi muộn.

---

## 3. Quy Trình Xử Lý Ngoại Lệ: Chấm Công Ngoại Tuyến (Offline Mode)

Trong trường hợp nhân viên vào hầm gửi xe hoặc khu vực mất sóng Internet:
1. **Lưu trữ an toàn trên máy (Secure Local Storage):**
   * Ứng dụng chụp ảnh khoảnh khắc và trích xuất vector khuôn mặt.
   * Ghi lại mốc thời gian lấy từ **sóng viễn thông (Cellular Network Time)** hoặc **Vệ tinh GPS (NMEA timestamp)** kèm vị trí tọa độ.
   * Ký số gói tin bằng Private Key lưu trong Secure Enclave/KeyStore của điện thoại.
2. **Đồng bộ khi có mạng (Auto-sync):**
   * Ngay khi điện thoại có kết nối trở lại, ứng dụng tự động đẩy gói tin lên server.
   * **Quy tắc thời hạn 24 giờ:** Dữ liệu ngoại tuyến chỉ được server chấp nhận nếu được đồng bộ trong vòng **24 giờ**. Sau 24h, gói tin bị từ chối và nhân viên phải làm **Đơn bổ sung chấm công (S31)**.
   * Server kiểm tra chữ ký số, nếu hợp lệ sẽ ghi nhận và gắn nhãn `SYNCED_OFFLINE` để quản lý theo dõi.

---

## 4. Ca Làm Việc & Tính Giờ Công (Work Shifts)

### 4.1. Ca Chuẩn Cố Định (Default Standard Shift)
* **Giờ Check-in:** 08:00 đến 09:30 (Khung linh hoạt đầu ngày).
* **Giờ Nghỉ trưa:** 12:00 đến 13:00 (1 tiếng, không tính vào giờ làm việc).
* **Giờ Check-out:** 17:00 đến 18:30.
* **Thời lượng công:**
  * Đủ **8 tiếng làm việc thực tế** $\implies$ Tính **1.0 công**.
  * Đủ **4 tiếng làm việc thực tế** $\implies$ Tính **0.5 công**.
  * Dưới 4 tiếng $\implies$ Tính **0.0 công** (yêu cầu nộp đơn giải trình hoặc tính nghỉ không lương).

### 4.2. Các Ca Ngoại Lệ Được Cấu Hình (Exceptions)
HR có thể gán ca đặc thù cho từng đối tượng trong `S26`:
* **Ca linh hoạt 1:** 07:00 – 16:00
* **Ca linh hoạt 2:** 07:30 – 16:30
* **Ca linh hoạt 3:** 10:00 – 19:00
* **Chính sách thai sản / Con nhỏ dưới 12 tháng:** Giảm 1 giờ làm việc mỗi ngày $\rightarrow$ Chỉ cần đủ **7 tiếng/ngày** vẫn được tính tròn **1.0 công**.
