# Đánh giá PR — ACT-HKT 2026

> Ngày đánh giá: 20/11/2026 · Repo `trannghia190/act-hkt-2026` · Nhánh `main` = `99c42b6`
> Có **2 PR đang mở**, cả hai đều **chưa nên merge**. Chi tiết bên dưới.

---

## Tổng quan

| PR | Tác giả | Nội dung | Quy mô | Trạng thái |
|---|---|---|---|---|
| **#3** | sangbk1997 | Nâng cấp feature A1→A5 & G1→G4 | 42 file · +6.373/−2.517 | 🔴 **2 blocker** — Core không khởi động được |
| **#2** | haphamthanh-beep | Tích hợp nhận diện khuôn mặt 1:N | 35 file · +1.906/−6.049 | 🔴 **3 blocker** — lỗ hổng xác thực + dữ liệu bịa |

Không có CI nào chạy (0 check-run trên cả hai PR), không có review nào trước đó. Vì vậy các lỗi dưới đây chỉ lộ ra khi đọc code.

---

# PR #3 — Enhance for A1→A5 & G1→G4

**Kết luận: chưa merge được.** Core Service **không khởi động được** vì trùng mapping, và khi merge sẽ **mất file migration**.

Phần đã làm tốt và nên giữ: `SecurityConfig` siết `PUBLIC_ENDPOINTS` (bỏ `/auth/config-smtp`, `/auth/test-email`, `/auth/smtp-status` khỏi public → `hasAnyRole("ADMIN","HR_ADMIN")`); `LoginAttemptService` tách riêng với khoá 5 lần/10 phút + 10 lần/vĩnh viễn; audit log append-only chặn PUT/DELETE; hook `useNavBadges` + `badgeKey` — hướng đúng. Vấn đề nằm ở chỗ implementation bị "đóng khung" để chạy được demo, và các lỗi kỹ thuật dưới đây.

### 🔴 BLOCKER 1 — Trùng mapping → Spring Boot không khởi động được

`RuleEngineController.java` có 2 handler cùng đường dẫn:

```java
@GetMapping({"/public-faq", "/public-policy-doc"})   // ~dòng 286
public ApiResponse<List<Map<String,String>>> publicFaq() { ... }

@GetMapping("/public-policy-doc")                      // ~dòng 312
public ApiResponse<Map<String,String>> publicPolicyDoc() { ... }
```

`/public-policy-doc` bị map 2 lần → Spring ném `IllegalStateException: Ambiguous mapping` lúc khởi động context → **Core Service chết ngay**, không API nào chạy được.

> Lỗi tương tự đã xảy ra đúng trong repo này: `DeviceController` (`/admin/devices`) trùng với `BusinessGapController.allDevices()` — đã phải sửa mới chạy được.

**Kiểm chứng:** `./run-local.sh` rồi grep log `Ambiguous mapping`.
**Sửa:** xoá `@GetMapping("/public-policy-doc")` ở `publicPolicyDoc()` (giữ bản trong `publicFaq`), hoặc đổi path thành `/rules/policy-doc`.

### 🔴 BLOCKER 2 — Merge sẽ xoá mất `V11__request_attachments.sql`

| main | PR #3 |
|---|---|
| `V11__request_attachments.sql` | **không có** (bị thay bằng `V11__seed_master_test_data.sql`) |

File mới trùng số version 11 với file đã có trên main. Khi merge, Git lấy file của nhánh PR → **mất `V11__request_attachments.sql`** → mất tính năng đính kèm file cho đơn từ.

**Sửa:** đổi tên file mới thành `V12__seed_master_test_data.sql`. `V8_1__add_admin_and_onboarding_users.sql` thì ổn (Flyway chấp nhận version phân thập 8.1).

### 🟠 HIGH 3 — Migration ghi mật khẩu `123456` cho toàn bộ nhân viên mẫu

`V11__seed_master_test_data.sql` và `V8_1__add_admin_and_onboarding_users.sql` dùng **cùng một hash bcrypt** cho Admin, `2026NEW` và toàn bộ nhân viên mẫu (`ACT0042`, `ACT0089`, `ACT0055`, `ACT0112`…). Đó là hash của `123456` — mật khẩu yếu, dùng chung mọi tài khoản.

Đây cũng là lý do `tests/robot/resources/variables.robot` phải đổi hàng loạt `Act@2026` → `123456`: **tài khoản seed không còn mật khẩu riêng**. Nhưng `Admin` có `must_change_password = FALSE` → **ai cũng đăng nhập được tài khoản admin** bằng `123456`, trái tiêu chí nghiệm thu A1.

**Sửa:** giữ `123456` cho nhân viên mẫu (để test tự động chạy được), nhưng `Admin` phải có `must_change_password = TRUE` hoặc mật khẩu riêng. Tốt hơn: script seed riêng cho môi trường demo, không nhét hash chung vào migration production.

### 🟠 HIGH 4 — `refresh()` lấy token chỉ bằng mã nhân viên, không cần refresh token

```java
// AuthServiceImpl.refresh(String refreshToken, String employeeCode)
} else if (employeeCode != null && !employeeCode.isBlank()) {
    user = userRepository.findByEmployeeCodeIgnoreCaseOrEmailIgnoreCase(employeeCode, employeeCode)
            .orElseThrow(...);
```

Nhánh này **không cần refresh token hợp lệ** — chỉ cần biết mã nhân viên là lấy được session mới. `/auth/refresh` lại nằm trong `PUBLIC_ENDPOINTS`. ⇒ **Bất kỳ ai biết `01HR` cũng lấy được token quản trị.**

**Sửa:** bỏ nhánh `employeeCode` khỏi `refresh()`, hoặc bắt buộc kèm refresh token hợp lệ.

### 🟠 HIGH 5 — `forgotPassword` gửi OTP về tài khoản admin khi email không tồn tại

```java
// AuthServiceImpl.sendPasswordResetOtp
User user = userRepository.findByEmail(target).orElse(null);
if (user == null) {
    user = userRepository.findByEmployeeCodeIgnoreCaseOrEmailIgnoreCase(target, target).orElse(null);
    user = userRepository.findByEmail("admin@act.vn").orElse(null);   // ← fallback
}
if (user != null) { ... emailService.sendPasswordResetEmail(user.getEmail(), ...); }
```

Email không tồn tại → hệ thống **gửi OTP đặt lại mật khẩu cho `admin@act.vn`**. Hệ quả: ai cũng dùng được chức năng này để **reset mật khẩu admin**. `AuthController.forgotPassword` cũng tự điền `"admin@act.vn"` khi thiếu email. Trái tiêu chí A1 ("không lộ thông tin tài khoản có tồn tại").

**Sửa:** bỏ fallback về admin; email không tồn tại → thông báo trung tính và **không gửi mail nào**.

### 🟠 HIGH 6 — `CronController` gửi email thật cho mọi user khi gọi endpoint

```java
for (var u : userRepository.findAll()) {
    if (u.getEmail() != null && !u.getEmail().isBlank()) {
        emailService.sendDailyDigestEmail(u.getEmail(), u.getFullName(), sampleTasks, leave);
    }
}
```

Gọi `POST /cron/send-daily-digest` là gửi mail thật cho **tất cả nhân viên trong DB**. `checkSlaEscalation` gửi cứng tới `tung.nguyen@act-corp.internal`. Nội dung `sampleTasks` là **dữ liệu giả hardcode** — mọi người nhận cùng nội dung.

**Sửa:** lấy dữ liệu thật từng user; chỉ gửi khi SMTP đã cấu hình; thêm cờ tắt theo môi trường.

### 🟠 HIGH 7 — Dữ liệu giả hardcode trong API trả về cho người dùng

```java
// RuleEngineController.dryRun()
result.put("affectedEmployeesCount", 12);
result.put("summaryText", "Giả lập chạy thử nghiệm hoàn tất: Tác động đến 12 nhân sự...");
result.put("explanation", "Trong khung giờ dung sai 15 phút");
```

Trả về số liệu bịa hoàn toàn — người dùng tưởng là kết quả mô phỏng thật. `publicFaq()` sinh câu hỏi bằng template: `"Quy định về " + r.getName() + " như thế nào?"` → câu hỏi vô nghĩa. `AuditLog.ipAddress` ghi cứng `"14.161.22.45 (Chrome/Web)"` cho **mọi** thao tác → dữ liệu sai lệch, không truy vết được ai thao tác từ đâu.

**Sửa:** `dryRun` tính từ dữ liệu thật hoặc trả về trạng thái "chưa hiển thực" rõ ràng; `ipAddress` lấy từ `HttpServletRequest.getRemoteAddr()`.

### 🟡 MEDIUM 8 — `findRuleByKey` im lặng trả về rule khác

```java
if (!all.isEmpty()) return all.get(0);   // ← rơi về rule đầu tiên trong DB
```

Gõ sai rule key → **sửa nhầm rule khác** (kèm audit log ghi sai), API vẫn trả 200. Loại bug rất khó phát hiện.

**Sửa:** ném lỗi khi không khớp; chỉ map alias nằm trong catalog 19 rule.

### 🟡 MEDIUM 9 — `updateRule()` bỏ validate JSON và bắt buộc lý do

```java
- if (request.getChangeReason() == null || request.getChangeReason().isBlank()) {
-     throw new RuntimeException("Bắt buộc nhập lý do thay đổi quy định");
- }
- objectMapper.readTree(request.getCurrentValue());   // validate JSON
+ String reason = request.resolveReason();
```

`resolveReason()` **fallback về `"Cập nhật tham số quy định hệ thống"`** khi không truyền lý do ⇒ vẫn lưu rule được mà **không có lý do thật** (trái tiêu chí E3/E4). Validate JSON cũng bị bỏ → `currentValue` sai format vẫn lưu, và `RuleService.getInt/getBoolean` parse lỗi về sau.

**Sửa:** giữ validate JSON + bắt buộc `changeReason` (không default). Nếu muốn sửa nhanh thì phải là hành vi **tường minh** và hiển thị trên UI, không phải fallback âm thầm.

### 🟡 MEDIUM 10 — `LoginAttemptService.getOrCreate()` trả entity chưa persist

```java
return loginAttemptRepository.findByIdentifier(...).orElseGet(() -> LoginAttempt.builder()...build());
```

Trả về object chưa có trong DB. Hiện `registerFailure()` tự load lại nên chưa lộ, nhưng nếu ai gọi `getOrCreate()` rồi `save()` sẽ ghi đè bản ghi đang có (race condition khi 2 request login sai cùng lúc).

**Sửa:** dùng `saveAndFlush` với `REQUIRES_NEW`, hoặc bỏ khỏi interface.

### 🟡 MEDIUM 11 — `refresh()` xoay vòng session nhưng nhánh `employeeCode` không cấp refresh token mới

Nhánh `employeeCode` cấp access token nhưng **không tạo bản ghi `refresh_tokens`** → refresh token dùng một lần rồi chết, hoặc tái sử dụng token cũ. Người dùng bị logout ngoài ý muốn sau vài phút.

### 🟢 INFO — Vài điểm nhỏ

| Nơi | Vấn đề |
|---|---|
| `sidebar.config.ts` | `DEFAULT_BADGES` hardcode `{todo:3, notif:5, reqs:1, checkin:2, approve:12, dispute:5}`. `useNavBadges` chỉ override `todo`/`notif` ⇒ `reqs/checkin/approve/dispute` **luôn là số giả**. Cần nối hết vào API hoặc bỏ badge cho mục chưa có API. |
| `TodoInboxPage.tsx` | Gọi `POST /api/v1/todos/create-task` nhưng `TodoController` trong PR **không có** endpoint này → 404. |
| `V11__seed_master_test_data.sql` | Tên file là V11 nhưng comment trong file ghi "V9" — sửa cho khỏi nhầm. |
| `application.yml` | `flyway.out-of-order: true` che giấu lỗi đánh số version — nên dùng version tăng dần đúng. |
| `.gitignore` | Thêm `log.html/output.xml/report.html` ở gốc repo — nên là `tests/robot/reports/` (đã có). |
| `TodoController` | `itemsForCurrentUser()` sinh task từ dữ liệu tĩnh trong code — nên suy ra từ bảng thật (đơn, OKR, phép) như yêu cầu G1. |

### Checklist để merge được

- [ ] Sửa trùng mapping `/public-policy-doc` — **Core phải boot được**
- [ ] Đổi tên `V11__seed_master_test_data.sql` → `V12__…`, giữ `V11__request_attachments.sql`
- [ ] `Admin`: mật khẩu riêng hoặc `must_change_password = TRUE`
- [ ] Bỏ nhánh `employeeCode` trong `refresh()`
- [ ] Bỏ fallback về `admin@act.vn` trong `sendPasswordResetOtp`
- [ ] `CronController` không gửi mail thật khi gọi endpoint; bỏ dữ liệu giả
- [ ] `dryRun` không trả số liệu bịa; `ipAddress` lấy từ request thật
- [ ] `findRuleByKey` ném lỗi thay vì trả về rule khác
- [ ] Giữ validate JSON + bắt buộc lý do khi lưu rule
- [ ] Thêm `POST /todos/create-task` hoặc bỏ gọi đó ở FE
- [ ] Badge: nối hết vào API hoặc bỏ số giả
- [ ] `./run-local.sh` → Core boot OK → `tests/robot/` xanh
- [ ] Cập nhật `docs/23-tech-gap-map.md` nếu có khác biệt so với gap map hiện tại

---

# PR #2 — Feature/face recognize

**Kết luận: chưa merge được.** Đây là nhánh đã từng merge một lần (`439ab95`) nhưng giờ đã có 12 commit mới chưa được review. Ba lỗi dưới đây là **lỗ hổng xác thực**, không phải chỉ là chất lượng code.

### 🔴 BLOCKER A — Admin được seed với mật khẩu `123456` và `must_change_password = false`

```sql
-- V5__seed_admin_user.sql
'admin@act-corp.internal',
'$2y$12$u0TSCzNoCF8AEgSJEV6iNOZEq0Ngcvg72zhBKXarVanAi.IeCzCVm',  -- hash của "123456"
'ADMIN', '2020-01-01', 'ACTIVE',
false,     -- ← must_change_password = FALSE
```

Tài khoản `Admin` — quyền cao nhất — có **mật khẩu `123456` công khai trong source** và **không bắt buộc đổi lần đầu**. Ai đọc repo cũng đăng nhập được.

Thêm nữa: `ON CONFLICT (employee_code) DO UPDATE SET password_hash = excluded.password_hash` ⇒ **mỗi lần migrate là reset lại mật khẩu admin**, kể cả khi admin đã đổi mật khẩu. Đây là mẫu anti-pattern "seed đè dữ liệu người dùng".

**Sửa:** không đặt mật khẩu cố định cho Admin trong migration. Tạo Admin qua luồng kích hoạt (email kích hoạt + đổi mật khẩu bắt buộc) như tiêu chí A1, hoặc tối thiểu `must_change_password = TRUE` + `ON CONFLICT DO NOTHING` (không reset mật khẩu đã đổi).

### 🔴 BLOCKER B — Face profile của Admin được seed bằng vector toàn 0

```sql
INSERT INTO face_profiles (user_id, embedding, model_version, status, enrolled_at)
SELECT id, array_fill(0.0::real, ARRAY[512])::vector, 'sface-512-v1', 'active', NOW()
FROM users
ON CONFLICT (user_id) DO UPDATE SET status = 'active';
```

Đây **không phải khuôn mặt** — là vector 0 đại diện cho "mọi người". Hệ quả: bất kỳ ảnh nào cũng có thể khớp vector 0 nếu cosine similarity không được kiểm tra đúng, và `status='active'` khiến hệ thống **tưởng Admin đã đăng ký khuôn mặt** → bỏ qua nhánh "chưa đăng ký" của lớp xác thực 5.

**Sửa:** không seed `face_profiles` bằng vector giả. Admin phải đăng ký khuôn mặt thật qua luồng S27/S01-B.

### 🔴 BLOCKER C — Ngưỡng khớp 0.363 và đường "chấp công hộ" mà không kiểm tra

```python
SFACE_SIMILARITY_THRESHOLD = 0.363        # ← thấp hơn nhiều so với 0.85 trong business
effective_threshold = SFACE_SIMILARITY_THRESHOLD if len(query_vec) == 128 else SIMILARITY_THRESHOLD
...
if chosen_candidate and (chosen_score >= effective_threshold or chosen_score >= 0.80):
```

Và:
```python
if chosen_candidate is None and payload.expected_employee_code:
    chosen_candidate = (exp_code, f"Nhân Viên {exp_code}", "Khối Kỹ Thuật")
```

Khi không tìm được ứng viên nào khớp, hệ thống **tự chọn chính mã nhân viên được khai báo** rồi cho điểm tối thiểu 0.85 ⇒ **ai cũng chấm công được** (đây chính là lỗ "fallback ghi log VALID" mà `docs/02` §2.1.1 đã cảnh báo).

Business quy định ngưỡng **85%** (`attendance_security.face_match_threshold`) — PR hạ xuống 0.363 cho vector 128 chiều. `docs/06`/`docs/09` cũng đã chốt: không fallback, không đạt là CHẶN.

**Sửa:**
- Ngưỡng lấy từ rule `attendance_security.face_match_threshold` (mặc định 0.85), không hard-code.
- Bỏ nhánh fallback "chosen_candidate = expected" — không khớp thì **CHẶN**.
- Bỏ `or chosen_score >= 0.80` vì nó làm vô nghĩa điều kiện trước.

### 🟠 HIGH D — `verify-json` chưa chặn trường hợp dùng camera của người khác

PR có thêm `expected_employee_code` và cờ `is_proxy_punch_detected` — hướng đúng. Nhưng cần kiểm tra logic ghép: `is_proxy_punch` được set `True` khi ứng viên khớp khác mã mong đợi. Cần chắc chắn:

1. Core Service **kiểm tra lại** `matched_employee.employee_code` với tài khoản đang đăng nhập (không tin AI service) — đây là lỗ (b) đã ghi trong `docs/23-tech-gap-map.md`.
2. `is_proxy_punch_detected = True` phải **chặn chấm công**, không chỉ gắn cờ.
3. `CheckInPage.tsx` phải gửi **đủ** Base64 (không cắt bớt) — lỗi (a) trong gap map: `substring(0,100)` làm AI service không đối chiếu được → rơi vào fallback → ghi log `VALID`.

### 🟠 HIGH E — `GlobalExceptionHandler` bắt `RuntimeException` và trả **message gốc** cho client

```java
@ExceptionHandler(RuntimeException.class)
public ResponseEntity<ApiResponse<Void>> handleRuntimeException(RuntimeException ex) {
    return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(ApiResponse.error(ex.getMessage()));
}
```

`ex.getMessage()` của các exception nội bộ có thể chứa **chi tiết SQL, tên bảng, tên cột** → lộ schema DB cho bất kỳ ai gọi API. Exception handler nên trả message an toàn và log chi tiết ở server.

### 🟠 HIGH F — `is_proxy_punch_detected` mặc định `False` trong model → dễ quên bật

`VerifyResponse.is_proxy_punch_detected: bool = False` — mặc định là "không phát hiện", nên chỗ nào quên set cũng im lặng. Nên mặc định là **trạng thái chưa xác định** hoặc bắt buộc set tường minh ở mọi nhánh trả về.

### 🟢 INFO — Vài điểm nhỏ

| Nơi | Vấn đề |
|---|---|
| `hkt/face-recognition/` | Xoá 12 file demo (~5.800 dòng) — đúng hướng (dọn demo), nhưng cần xác nhận không mất tài liệu tham khảo. |
| `main.py` | `employee_code` + `full_name` + `department` vẫn nhận từ client khi enroll → cho phép đăng ký khuôn mặt **hộ người khác** (lỗ (d) gap map). Nên lấy từ token. |
| `main.py` | `attendance_check_in` / `attendance_check_out` / `get_todos` trong AI service — lặp/trôi nghiệp vụ sang service khuôn mặt. Nên ở lại Core. |
| `FaceEnrollmentPage.tsx` | +903/−138 — thay đổi lớn; cần giữ luồng 3 góc + liveness theo tiêu chí B0, PR này rút còn 1 ảnh. |
| `SecurityConfig.java` | +8/−10 — cần đọc kỹ, xác nhận không mở rộng endpoint public. |

### Checklist để merge được

- [ ] Admin không có mật khẩu cố định trong migration; `must_change_password = TRUE`; không `DO UPDATE` reset mật khẩu
- [ ] Bỏ seed `face_profiles` bằng vector 0
- [ ] Ngưỡng khớp đọc từ rule (0.85), bỏ fallback "chấp công hộ"
- [ ] Core kiểm tra `matched_employee.employee_code` với tài khoản đang đăng nhập; proxy punch phải **chặn**
- [ ] Frontend gửi đủ Base64 (không `substring`)
- [ ] `GlobalExceptionHandler` không trả message gốc cho client
- [ ] `is_proxy_punch_detected` bắt buộc set tường minh ở mọi nhánh
- [ ] `enroll-json` lấy danh tính từ token, không nhận từ client
- [ ] Dọn các route nghiệp vụ lặp trong AI service
- [ ] `./run-local.sh` → boot OK; kiểm tra proxy punch bằng ảnh của người khác

---

## Ghi chú chung

- **PR #2 và PR #3 có overlap**: cùng sửa `SecurityConfig.java`, `AttendanceServiceImpl.java`, `AuthController.java`, `CommandPalette.tsx`, `run-local.sh` ⇒ **merge theo thứ tự sẽ đụng nhau**. Đề xuất: merge #2 trước (nó là nền cho nhận diện mặt mà B0/B1 cần), rồi rebase #3 lên main.
- **Cả hai PR đều chưa có CI** ⇒ nên bật workflow tối thiểu: `./run-local.sh` → compile + `mvn test` + `tests/robot/`. Kinh nghiệm hôm nay: blocker #1 và #2 chỉ lộ ra khi **boot thật**, không có CI thì chắc chắn lọt.
- **Quy trình đề xuất**: mỗi PR cần kèm 3 bằng chứng — (1) log `./run-local.sh` cho thấy Core boot OK, (2) output `tests/robot/` xanh, (3) ảnh/script Playwright cho phần UI. Đây cũng là định dạng prompt đã cập nhật trong `docs/08` + cột "Prompt AI" của `task-tracking.xlsx`.
