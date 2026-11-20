# Review PR #2 — "Feature/face recognize"

> Đánh giá: 20/11/2026 · `trannghia190/act-hkt-2026` · PR #2 · head `b434afc` → base `49daed6`
> 35 file · +1.906 / −6.049 · 12 commit · tác giả `haphamthanh-beep` · 0 review · 0 CI check

## Kết luận: **CHƯA MERGE ĐƯỢC**

Nhánh này đã từng được merge một lần (`439ab95`) nhưng 12 commit mới chưa qua review. Mình đọc toàn bộ patch và tìm thấy **4 lỗi bảo mật nghiêm trọng** — trong đó có 2 lỗi khiến tính năng "chống chấm công hộ" **hoàn toàn không có tác dụng**, và 1 lỗi mở toàn bộ API ra công khai.

> Bối cảnh quan trọng: nhánh này **xoá 12 file demo** ở `hkt/face-recognition/` (~5.800 dòng) và chuyển toàn bộ sang `ai-face-service/`. Việc dọn demo là đúng hướng. Nhưng logic nhận diện mặt đã bị thay bằng phiên bản **chạy được demo** — nghĩa là chấp nhận sai dữ liệu và hạ ngưỡng. Đây chính xác là những lỗi `docs/23-tech-gap-map.md` đã ghi nhận ở lần review trước (K-01…K-14) — **chúng chưa được đóng, mà còn mở rộng ra**.

---

## 🔴 BLOCKER A — `SecurityConfig` mở toàn bộ API ra public

```java
private static final String[] PUBLIC_ENDPOINTS = {
        "/auth/**",              // ← toàn bộ nhóm auth
        "/attendance/check-in",
        "/attendance/check-out",
        ...
};
```

`/auth/**` bao trọn **mọi** endpoint của nhóm auth: login, refresh, **reset-password**, **forgot-password**, **config-smtp**, **test-email**, **send-notification**, **enroll-face**, **face-profile/{code}** (DELETE).

Hậu quả trực tiếp:
- `POST /auth/reset-password` — ai cũng đặt lại được mật khẩu của người khác.
- `POST /auth/config-smtp` — ai cũng cấu hình lại SMTP server.
- `DELETE /auth/face-profile/{employeeCode}` — ai cũng xoá được hồ sơ khuôn mặt của nhân viên khác.
- `POST /auth/enroll-face` — đăng ký khuôn mặt hộ người khác.

Thay đổi này cũng **đảo ngược** phần RBAC mà PR #3 đang làm (PR #3 siết `PUBLIC_ENDPOINTS` lại). Hai PR này **xung đột trực tiếp** ở đúng file này.

**Sửa:** về danh sách tối thiểu của `main` (`/auth/login`, `/auth/refresh`, `/auth/reset-password-request`, `/swagger-ui/**`, `/v3/api-docs/**`, `/actuator/health`), và **không** mở `/attendance/check-in` — chấm công bắt buộc phải có token.

## 🔴 BLOCKER B — `check-in` nhận `employeeCode` từ client, fallback về `136ACT` khi không có token

```java
// AttendanceServiceImpl.processAttendancePunch
User requester = null;
if (authenticatedUserId != null) { ... }
if (requester == null && request.getEmployeeCode() != null ...) {
    requester = userRepository.findByEmployeeCodeIgnoreCaseOrEmailIgnoreCase(code, code).orElse(null);
}
if (requester == null) {
    // Default demo employee fallback if unspecified
    requester = userRepository.findByEmployeeCodeIgnoreCaseOrEmailIgnoreCase("136ACT", "136ACT").orElse(null);
}
```

Bản `main` ghi rõ trong comment: *"Nhân viên lấy từ token đang đăng nhập — KHÔNG tin employeeCode do client gửi lên"*. PR #2 **xoá đúng comment đó** và thay bằng logic tin client.

Kết hợp với BLOCKER A (check-in public) và JWT filter có thể trả `userId = null` khi không có token ⇒ **gọi `/attendance/check-in` không cần đăng nhập vẫn chấm công được**, và mặc định ghi vào tài khoản `136ACT`.

**Sửa:** bắt buộc `CurrentUser.userId() != null`, bỏ mọi fallback. Đây là nguyên tắc "1 check-in/ngày" và chống share-account của `docs/01` §2.

## 🔴 BLOCKER C — AI service **tự chọn ứng viên** khi không khớp ai ⇒ chấm công hộ vẫn thành công

```python
# verify_face_json
if chosen_candidate is None and payload.expected_employee_code:
    exp_code = payload.expected_employee_code.strip()
    chosen_candidate = (exp_code, f"Nhân Viên {exp_code}", "Khối Kỹ Thuật")
    chosen_score = 0.965          # ← tự gán điểm cao
```

Khi **không tìm được ứng viên nào khớp**, service tự chọn chính mã nhân viên mà client khai báo, gán điểm 0.965, rồi:

```python
conf_score = round(min(0.999, max(0.85, (chosen_score + 1.0) / 2.0 ...)), 4)
```
→ `conf_score = 0.982`.

Nghĩa là: **đưa bất kỳ ảnh nào lên (miễn qua được kiểm tra chất lượng), AI service sẽ trả về "khớp 98.2%" và `is_matched=True`.** Lớp xác thực khuôn mặt — lớp quan trọng nhất trong 5 lớp — **không chặn được gì cả**.

Comment trong code ghi rõ: `# Fallback for dev/demo if expected employee is specified and test image passed quality`. Đây là **fallback chấm công hộ**, trái hoàn toàn `docs/02` §2.1.1 (*"KHÔNG có nhánh fallback… Trước đây khi thiếu/không khớp khuôn mặt, code vẫn ghi log VALID — nghĩa là gian lận đi thẳng vào bảng công"*).

**Sửa:** xoá hẳn nhánh fallback. Không khớp ⇒ `is_matched=False`, `error_code="FACE_NOT_RECOGNIZED"`, và Core **không ghi log `VALID`**.

## 🔴 BLOCKER D — Frontend **tự bỏ qua** kiểm tra "chấm công hộ" cho Admin/HR

```tsx
// CheckInPage.tsx
const isAdminOrManager = user?.role === 'ADMIN' || user?.role === 'HR_ADMIN' || loggedInCode?.toLowerCase() === 'admin';

if (!isAdminOrManager && loggedInCode && detectedCode && detectedCode.toLowerCase() !== loggedInCode.toLowerCase()) {
  setCheckInStep('error');   // chỉ chặn khi KHÔNG phải admin
  ...
}
...
const targetEmpCode = (isAdminOrManager && detectedCode) ? detectedCode : (loggedInCode || detectedCode || '136ACT');
```

Với tài khoản Admin/HR: **được phép chấm công hộ bất kỳ ai**, và `employeeCode` gửi lên Core là **người đứng trước camera**, không phải người đang đăng nhập.

Đây là đường đi trực tiếp để ghi công cho người khác — chính xác là thứ `docs/01` §2 (`share_account`) và tiêu chí B1 cấm. Việc "test bằng role admin" có thể là ý đồ tốt, nhưng **phải là chế độ test được bật/tắt rõ ràng**, không phải nhánh mặc định trong luồng chấm công thật.

**Sửa:** bỏ nhánh admin này khỏi luồng chấm công. Nếu cần test thì để nút "mô phỏng" chỉ gọi API AI (`verify-json`) để xem kết quả, **không** gọi `/attendance/check-in`. `employeeCode` luôn lấy từ token.

---

## 🟠 HIGH E — Ngưỡng khớp 0.363, đọc từ biến hằng chứ không lấy từ rule

```python
SFACE_SIMILARITY_THRESHOLD = 0.363
effective_threshold = SFACE_SIMILARITY_THRESHOLD if len(query_vec) == 128 else SIMILARITY_THRESHOLD
...
if chosen_candidate and (chosen_score >= effective_threshold or chosen_score >= 0.80):
```

Business chốt **85%** (`attendance_security.face_match_threshold`, `docs/06` §3.1). PR dùng 0.363 cho vector SFace 128 chiều, và `or chosen_score >= 0.80` làm điều kiện trước vô nghĩa.

Tệ hơn: **ngưỡng hard-code trong Python**, không đọc từ `rules` của Core ⇒ HR đổi ngưỡng trên UI S16 **không có tác dụng** với AI service. Vi phạm tiêu chí E3/E4/E5 (rule phải là nguồn sự thật duy nhất).

**Sửa:** Core gửi kèm `face_match_threshold` trong request (đọc từ rule), hoặc AI service đọc rule qua API. Không hard-code.

## 🟠 HIGH F — `face_profiles` seed bằng vector toàn 0 và `must_change_password = false`

```sql
-- V5__seed_admin_user.sql
'admin@act-corp.internal',
'$2y$12$u0TSCzNoCF8AEgSJEV6iNOZEq0Ngcvg72zhBKXarVanAi.IeCzCVm',  -- hash của "123456"
'ADMIN', '2020-01-01', 'ACTIVE',
false,     -- ← must_change_password = FALSE
...
ON CONFLICT (employee_code) DO UPDATE SET
    password_hash = excluded.password_hash,   -- ← reset mật khẩu admin mỗi lần migrate
```

Tài khoản quyền cao nhất: **mật khẩu `123456` công khai trong source**, không bắt buộc đổi lần đầu, và **mỗi lần migrate là reset lại** mật khẩu người dùng đã đổi. Trái tiêu chí A1.

```sql
INSERT INTO face_profiles (user_id, embedding, model_version, status, enrolled_at)
SELECT id, array_fill(0.0::real, ARRAY[512])::vector, 'sface-512-v1', 'active', NOW()
FROM users
ON CONFLICT (user_id) DO UPDATE SET status = 'active';
```

Vector **toàn 0** không phải khuôn mặt, nhưng `status='active'` ⇒ hệ thống **tưởng Admin đã đăng ký** ⇒ bỏ qua nhánh "chưa đăng ký khuôn mặt" của lớp 5.

**Sửa:** không seed `face_profiles` bằng vector giả; Admin phải đăng ký mặt thật (S27/S01-B). Không reset mật khẩu trong `ON CONFLICT DO UPDATE`.

## 🟠 HIGH G — AI service seed **vector ngẫu nhiên** cho 5 nhân viên vào SQLite

```python
defaults = [
    ("Admin", "Quản Trị Viên Hệ Thống (Admin)", "Ban Quản Trị Hệ Thống", 42),
    ("admin", "AD văn min", "Khối Kỹ Thuật", 42),
    ("01HR", "Nguyễn Thị Thu Hà", "Phòng Nhân Sự", 101),
    ("05ACT", "Nguyễn Thanh Tùng", "Khối Kỹ Thuật", 202),
    ("136ACT", "Vũ Văn Luận", "Khối Kỹ Thuật (Optimus)", 303),
]
for uid, name, dept, seed_val in defaults:
    np.random.seed(seed_val)
    raw = np.random.uniform(0.1, 1.0, 128).astype(np.float32)
    conn.execute("INSERT OR REPLACE INTO face_identities ... ", (uid, name, dept, norm.tobytes()))
```

5 hồ sơ "khuôn mặt" là **vector ngẫu nhiên** (chỉ khác seed RNG). Kết hợp với ngưỡng 0.363, một vector ngẫu nhiên bất kỳ có xác suất đáng kể vượt ngưỡng ⇒ hệ thống có thể **khớp nhầm người**.

Ngoài ra service này dùng **SQLite** (`face_identities`) song song với PostgreSQL (`face_profiles`) — hai nguồn dữ liệu khuôn mặt, dễ lệch.

**Sửa:** xoá phần seed SQLite; nguồn sự thật duy nhất là `face_profiles` trong PostgreSQL (đã có `embedding vector(512)` từ V2).

## 🟠 HIGH H — `enroll_face` tự tạo `FaceProfile` với embedding **toàn 0**

```java
// AuthServiceImpl.enrollFace
FaceProfile fp = faceProfileRepository.findByUserId(user.getId())
        .orElse(FaceProfile.builder().userId(user.getId()).build());
fp.setStatus("active");
fp.setEnrolledAt(LocalDateTime.now());
if (fp.getEmbedding() == null) {
    fp.setEmbedding(new float[512]);     // ← vector toàn 0
}
```

`enrollFace` **không nhận vector thật từ AI service** — nó chỉ nhận `faceDataUrl` (ảnh) và tự ghi vector 0. Hệ quả: sau khi đăng ký, hồ sơ có `status='active'` + embedding 0 ⇒ **mọi ảnh đều có thể "khớp" hồ sơ này**.

**Sửa:** `enrollFace` phải nhận `embedding` (512 float) từ AI service và lưu vào `face_profiles.embedding`; AI service là nơi duy nhất tính vector.

## 🟠 HIGH I — `GlobalExceptionHandler` trả message gốc cho client

```java
@ExceptionHandler(RuntimeException.class)
public ResponseEntity<ApiResponse<Void>> handleRuntimeException(RuntimeException ex) {
    log.error("Runtime exception caught: {}", ex.getMessage(), ex);
    return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(ApiResponse.error(ex.getMessage()));
}
```

`ex.getMessage()` của exception nội bộ có thể chứa **câu SQL, tên bảng, tên cột** ⇒ lộ schema DB cho bất kỳ ai gọi API. Exception handler nên trả message an toàn, chi tiết chỉ log server-side.

## 🟠 HIGH J — `enroll-json` vẫn nhận danh tính từ client

```python
class EnrollJsonRequest(BaseModel):
    employee_code: str
    full_name: str
    department: str
```

Client tự khai `employee_code` + `full_name` + `department` ⇒ **đăng ký khuôn mặt hộ người khác** (lỗ (d) trong `docs/23-tech-gap-map.md`). Danh tính phải lấy từ token, không tin client.

## 🟠 HIGH K — `callAiFaceService` thử 4 URL, log rò thông tin, không timeout

```java
targets.add(primaryUrl);
targets.add(AI_SERVICE_DOCKER_SERVICE_URL);
targets.add(AI_SERVICE_DOCKER_URL);
targets.add(AI_SERVICE_LOCAL_URL);
...
log.info("Calling AI Face Service at endpoint: {}", url);
```

4 URL cố định + không đặt timeout cho `RestTemplate` ⇒ mỗi request có thể treo lâu, và nếu service local chết thì **mọi lần chấm công đều chờ** tới hết timeout của từng URL. `RestTemplate` mặc định **không có timeout** ⇒ treo vô hạn.

**Sửa:** dùng `aiFaceServiceUrl` làm URL duy nhất (đã có cấu hình trong `application.yml`), đặt timeout connect/read (vd 3s/10s), bỏ các URL hard-code.

---

## 🟡 MEDIUM — Các điểm khác

| Nơi | Vấn đề |
|---|---|
| `main.py` | `ensure_models_exist()` **tải model ONNX từ GitHub lúc khởi động** (`urllib.request.urlopen`, timeout 30s). Mất mạng ⇒ `detector = recognizer = None` ⇒ rơi vào fallback Haar, và service khởi động chậm. Nên build model vào image hoặc kiểm tra sẵn lúc build. |
| `main.py` | `attendance_check_in` / `attendance_check_out` / `attendance_today_status` / `get_todos` / `auth_enroll_face` / `smtp_status` trong AI service — **nghiệp vụ lặp sang service khuôn mặt**, và trùng endpoint với Core (`/api/v1/auth/enroll-face`, `/api/v1/todos/my-inbox`). Dễ lệch logic. Nên ở lại Core. |
| `main.py` | `DELETE /api/v1/face/employees/{employee_code}` — xoá hồ sơ mặt bằng mã nhân viên, **không có xác thực** (AI service không có auth). Kết hợp BLOCKER A, ai cũng xoá được. |
| `main.py` | `employee_db` dict trong RAM + `face_db.json` + SQLite + PostgreSQL = **4 nơi lưu khuôn mặt**. Nên gộp còn 1. |
| `main.py` | `FaceEnrollmentPage.tsx` rút từ 3 góc xuống 1 ảnh — trái tiêu chí B0 (*"chụp 3 góc + liveness"*) và `docs/07` §2.4. |
| `CheckInPage.tsx` | Còn nút test scenario `PROXY_FRAUD` / `POOR_QUALITY` — nếu để trong UI production thì phải ẩn sau cờ môi trường. |
| `docker-compose.yml` | +8/−10 — cần xác nhận `AI_FACE_SERVICE_URL` và healthcheck vẫn đúng sau khi đổi tên service. |
| `run.sh` / `start-dev.sh` / `share-local.sh` | +26/−9, +26/−9, +10 — sửa path hạ tầng. Cần xác nhận không làm hỏng script chạy local hiện tại (đang dùng `run-local.sh`). |
| `hkt/face-recognition/` | Xoá 12 file demo (~5.800 dòng) — đúng hướng dọn demo. Nhưng `openapi.json` + Postman collection là **tài liệu API** — nên chuyển sang `docs/` thay vì xoá hẳn. |

---

## ✅ Phần nên giữ

- **Bỏ `hkt/face-recognition/`** (12 file demo, ~5.800 dòng) — dọn code chết, đúng hướng.
- **Chuyển sang YuNet + SFace (ONNX)** thay cho Haar cascade + HOG thủ công — nâng chất lượng nhận diện thật sự.
- **Thêm `expected_employee_code` + `is_proxy_punch_detected`** — hướng đúng cho chống chấm công hộ (dù chưa nối được với block).
- **`GlobalExceptionHandler`** — cần, nhưng phải sửa phần trả message gốc (HIGH I).
- **`resetFace()`** (`status='reset'` + `face_enrolled=false`) — đúng nghiệp vụ HR reset hồ sơ.
- **`AuthController` thêm `DELETE /auth/face-profile/{employeeCode}`** — cần RBAC.

---

## Checklist để merge được

**Bảo mật (ưu tiên cao — mỗi mục là 1 lỗ hổng):**
- [ ] `SecurityConfig`: thu hẹp `PUBLIC_ENDPOINTS` về danh sách tối thiểu; `/attendance/check-in` **phải** có token
- [ ] `check-in`: bỏ mọi fallback (`employeeCode` từ client, `136ACT` mặc định) — bắt buộc lấy user từ token
- [ ] Xoá nhánh fallback "chosen_candidate = expected, score 0.965" trong AI service
- [ ] Frontend: bỏ nhánh `isAdminOrManager` bỏ qua kiểm tra proxy punch; `employeeCode` luôn từ token
- [ ] Xoá seed `face_profiles` vector 0 (V5) và seed SQLite vector ngẫu nhiên (`init_database`)
- [ ] `enrollFace`: nhận & lưu embedding thật từ AI service, không tự ghi vector 0
- [ ] `enroll-json`: lấy danh tính từ token, không nhận `employee_code`/`full_name` từ client
- [ ] `GlobalExceptionHandler`: không trả `ex.getMessage()` gốc cho client
- [ ] Admin: không có mật khẩu cố định trong migration; `must_change_password = TRUE`; `ON CONFLICT DO NOTHING`
- [ ] Ngưỡng đọc từ rule `attendance_security.face_match_threshold`, bỏ hard-code 0.363 và `or chosen_score >= 0.80`

**Kỹ thuật:**
- [ ] `callAiFaceService`: chỉ dùng `aiFaceServiceUrl`, đặt timeout connect/read
- [ ] `ensure_models_exist()`: build model vào image thay vì tải lúc khởi động
- [ ] Gộp nguồn lưu khuôn mặt còn 1 (PostgreSQL `face_profiles`)
- [ ] Xoá route nghiệp vụ lặp trong AI service
- [ ] `FaceEnrollmentPage`: giữ luồng 3 góc + liveness theo B0
- [ ] Ẩn nút test scenario sau cờ môi trường
- [ ] `./run-local.sh` → Core boot OK, AI `/health` 200; `tests/robot/` xanh

**Nghiệp vụ:**
- [ ] Chứng minh **chấm công hộ bị chặn**: đăng nhập 136ACT, dùng camera của 05ACT → phải ra thông báo từ chối và **không** có dòng `attendance_logs` status=VALID
- [ ] Chứng minh ảnh lạ (không ai trong DB) → `FACE_NOT_RECOGNIZED`, không chấm công
- [ ] Cập nhật `docs/23-tech-gap-map.md`: đánh dấu K-01…K-14 đã đóng **kèm bằng chứng test**

---

## Ghi chú khi merge với PR #3

PR #2 mở `/auth/**` public; PR #3 siết lại. **Hai PR xung đột trực tiếp ở `SecurityConfig.java`** ⇒ phải merge #2 trước rồi rebase #3, hoặc sửa #2 theo hướng của #3 ngay từ đầu để tránh phải resolve 2 lần.
