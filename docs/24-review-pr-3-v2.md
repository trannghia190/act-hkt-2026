# Review PR #3 (v2) — "Enhance for A1→A5 & G1→G4"

> Đánh giá lại: 20/11/2026 (sau khi PR được cập nhật) · head `a49fca71` (trước: `f59eddc3`) · base `8337dc85`
> 49 file · +6.899 / −2.519 · 8 commit · tác giả `sangbk1997` · 0 review · 0 CI

## Kết luận: **gần merge được — còn 1 blocker + vài điểm cần chốt**

Sau 3 commit sửa (`a49fca71 fix(review): resolve PR-3 review feedback…`, `fbfa9708 refactor(db): rename V11 seed data migration to V12`, `5d2ddd01 Merge branch 'main'…eliminate all hardcoded`), **cả 2 BLOCKER và 5/7 HIGH đã được xử lý đúng**. PR giờ có 8 commit, 49 file.

### Đã sửa ✅

| # | Vấn đề cũ | Cách sửa | Đánh giá |
|---|---|---|---|
| **BLOCKER 1** | Trùng mapping `/public-policy-doc` | Chỉ còn `@GetMapping("/public-faq")`; method `publicPolicyDoc()` đã bỏ | ✅ Đúng |
| **BLOCKER 2** | Mất `V11__request_attachments.sql` | Đổi thành `V12__seed_master_test_data.sql`, **giữ nguyên** `V11__request_attachments.sql` | ✅ Đúng |
| **HIGH 3** | Admin mật khẩu `123456`, `must_change_password=false` | `must_change_password = TRUE` + `ON CONFLICT (employee_code) DO NOTHING` (không còn reset mật khẩu) | ✅ Đúng |
| **HIGH 4** | `refresh()` nhận token bằng mã NV | Nhánh `employeeCode` **xoá hoàn toàn**, chỉ còn nhánh refresh token hợp lệ | ✅ Đúng |
| **HIGH 5** | `forgotPassword` fallback về `admin@act.vn` | Bỏ fallback; trả thông báo trung tính *"Nếu tài khoản tồn tại…"* | ✅ Đúng |
| **HIGH 6** | Cron gửi mail thật cho mọi user | Gate bằng `emailService.isSmtpConfigured()` | ✅ Đúng |
| **HIGH 7** | `dryRun` trả số liệu bịa, `ipAddress` hard-code | `ipAddress` lấy từ `resolveClientIp(httpRequest)`; `dryRun` tính từ dữ liệu thật | ✅ Đúng |
| **MED 8** | `findRuleByKey` rơi về rule đầu tiên | Ném lỗi khi không khớp + map alias giới hạn trong catalog 19 rule | ✅ Đúng |
| **MED 9** | `updateRule` bỏ validate JSON + bắt buộc lý do | Đã khôi phục `objectMapper.readTree(value)` + ném lỗi khi thiếu lý do | ✅ Đúng |
| **MED 10** | Badge hard-code số giả | `DEFAULT_BADGES` → **tất cả = 0**; `useNavBadges` nối **5 API** (`todos/my-inbox`, `notifications`, `todos/approvals`, `requests/my-requests`, `disputes`) | ✅ Đúng |
| **MED 11** | `POST /todos/create-task` thiếu | Đã thêm `@PostMapping("/create-task")` | ✅ Đúng |

Tóm lại: **9/12 điểm mình nêu lần trước đã đóng.** Chất lượng sửa tốt — không phải sửa cho có.

---

## 🔴 BLOCKER CÒN LẠI — `flyway.validate-on-migrate: false` che lỗi checksum

```yaml
# application.yml
flyway:
  enabled: true
  baseline-on-migrate: true
+ validate-on-migrate: false
```

Đây là thay đổi **mới**, không có trong bản mình review lần trước. Và nó là ngược lại đúng thứ cần làm.

Bối cảnh: chính PR này đã từng gặp lỗi *"Migration checksum mismatch"* ở local (bản `main` bị sửa migration sau khi đã apply). Tắt validate là **che lỗi đó đi thay vì sửa**: Flyway sẽ **không cảnh báo** khi file migration đã bị sửa sau khi apply, và sẽ **chạy lại** migration cũ với nội dung mới trên DB đã có dữ liệu.

Rủi ro cụ thể trong chính PR này: `V2__align_with_business.sql` trên `main` đã được sửa nhiều lần; nếu ai đó sửa tiếp, migration sẽ apply lại trên DB đã có dữ liệu ⇒ có thể **mất dữ liệu hoặc lỗi constraint**.

**Sửa:** bỏ dòng `validate-on-migrate: false`. Nếu cần cập nhật migration đã apply thì dùng `flyway repair` (đồng bộ checksum) hoặc tạo migration mới `V13__…` — đúng cách. Lưu ý: `out-of-order: true` ở bản cũ cũng đã bị thay bằng dòng này, nên cả 2 cờ "né" đều đã xử lý — nhưng bằng hướng sai.

## 🟠 HIGH — `checkin` vẫn là badge số 0 cứng (chưa có API)

```ts
export const DEFAULT_BADGES: Record<string, number> = {
  todo: 0, notif: 0, reqs: 0, checkin: 0, approve: 0, dispute: 0,
};
```

5/6 badge đã nối API thật. `checkin` thì **luôn = 0** ⇒ mục "Check-in" trên menu **không bao giờ hiện badge**, dù nhân viên chưa chấm công. `useNavBadges` không có nhánh nào set `checkin`.

Đây là điểm nhỏ nhưng nằm đúng tiêu chí **A2** (*"Badge số việc chờ trên menu luôn hiện và khớp số việc thật"*) và **B1**.

**Sửa:** thêm endpoint trả trạng thái chấm công hôm nay (`/attendance/today-status` đã có sẵn ở AI service nhưng nên đặt ở Core), hoặc suy ra từ `todos/my-inbox` (task `CHECKIN_TODAY` có `urgency: "today"`).

## 🟡 MEDIUM — Cần chốt, không chặn

### 1. `resolveClientIp` — lấy IP thật, nhưng cần kiểm tra khi qua proxy
```java
.ipAddress(resolveClientIp(httpRequest))
```
Đúng hướng. Nhưng khi chạy qua Docker/nginx/ngrok, `getRemoteAddr()` trả IP của proxy, không phải IP người dùng. Cần đọc `X-Forwarded-For` (có kiểm tra giá trị hợp lệ, không tin mù quáng) — hiện chưa rõ trong patch.

### 2. `logout` vẫn cho phép thu hồi phiên theo `employeeCode` từ body
```java
} else if (body != null && body.containsKey("employeeCode")) {
    authService.revokeAllSessionsByEmployeeCode(String.valueOf(body.get("employeeCode")), "LOGOUT");
}
```
`/auth/logout` **không nằm trong `PUBLIC_ENDPOINTS`** nên cần token ⇒ nhánh `else if` (không có token) về lý thuyết không kích hoạt được. Nhưng nếu JWT filter cho phép `userId = null` khi token hợp lệ nhưng thiếu claim, thì bất kỳ ai cũng logout được phiên người khác. Nên xoá nhánh này cho chắc — logout chỉ cần token.

### 3. `refresh` vẫn nhận `employeeCode` trong DTO dù không dùng
```java
public class RefreshRequest {
    private String refreshToken;
    private String employeeCode;      // ← đã bỏ dùng ở service
}
```
`AuthServiceImpl.refresh(token, code)` vẫn có tham số `employeeCode` nhưng nhánh tương ứng đã bị xoá. Nên dọn 2 chỗ để tránh hiểu nhầm sau này (đặc biệt khi đọc lại code sẽ tưởng còn đường bypass).

### 4. `V12__seed_master_test_data.sql` vẫn dùng chung hash `123456` cho mọi nhân viên mẫu
Đã chấp nhận (có `must_change_password` cho Admin). Nhưng nên tách **script seed riêng cho môi trường demo** để migration production không mang mật khẩu chung. Ở mức "chấp nhận được cho hackathon" — không chặn.

### 5. `V12` có comment ghi "V9" bên trong
Nhỏ, nhưng gây nhầm khi đọc lịch sử migration. Sửa cho khỏi sai.

---

## Việc còn lại trước khi merge

- [ ] **Bỏ `flyway.validate-on-migrate: false`** — dùng `flyway repair` hoặc migration mới `V13__…` (BLOCKER)
- [ ] Nối badge `checkin` vào API thật, hoặc bỏ `badgeKey: 'checkin'` khỏi menu
- [ ] `resolveClientIp`: xử lý `X-Forwarded-For` khi qua proxy
- [ ] Xoá nhánh `employeeCode` trong `logout` và tham số `employeeCode` trong `RefreshRequest`
- [ ] Sửa comment "V9" trong `V12__seed_master_test_data.sql`

## Việc nên làm (không chặn)

- [ ] Tách script seed dữ liệu demo ra khỏi migration
- [ ] Cập nhật `docs/23-tech-gap-map.md` — đánh dấu các mục đã đóng **kèm bằng chứng test**
- [ ] Bật CI: `./run-local.sh` → compile + `mvn test` + `tests/robot/`. Hai blocker của lần review trước chỉ lộ ra khi **boot thật** ⇒ không có CI thì chắc chắn lọt lần sau

## Bằng chứng merge (theo định dạng prompt đã cập nhật ở `docs/08`)

- [ ] `./run-local.sh` → Core boot OK (log không còn `Ambiguous mapping`), AI `/health` 200
- [ ] `tests/robot/` xanh — lưu ý `variables.robot` đã đổi mật khẩu seed về `123456`, phải khớp V3
- [ ] Script Playwright cho phần UI: badge khớp số việc thật, `/admin/rules` đủ 19 rule, không có badge trạng thái, `/todo` deep-link đúng

---

## Ghi chú: xung đột với PR #2

PR #2 mở `/auth/**` public; PR #3 siết lại thành danh sách tối thiểu. Hai PR sửa **cùng file `SecurityConfig.java`** và cùng `AttendanceServiceImpl.java` ⇒ merge sẽ conflict. Nên merge **#2 trước** (nó là nền cho B0/B1), rồi rebase #3 lên main — lúc đó phải giữ lại phần RBAC của #3.
