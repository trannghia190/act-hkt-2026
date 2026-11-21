/**
 * Nhãn hiển thị + kiểu nhập cho từng field của 19 quy định (S16/S19).
 * Mục tiêu: HR đọc/chỉnh bằng ngôn ngữ nghiệp vụ, không đọc JSON thô.
 * Field không khai báo ở đây sẽ được suy luận từ tên + giá trị (inferFieldMeta).
 */

export type FieldType = 'bool' | 'number' | 'time' | 'monthday' | 'text' | 'select' | 'tags' | 'steps';

export interface FieldMeta {
  label: string;
  hint?: string;
  unit?: string;
  type?: FieldType;
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; label: string }[];
  /** Gợi ý cho editor dạng tag. */
  suggestions?: 'teams' | 'requestTypes';
}

const REQUEST_TYPES = [
  { value: 'LATE_EARLY', label: 'Đi muộn / về sớm' },
  { value: 'ADJUST', label: 'Bổ sung chấm công' },
  { value: 'LEAVE', label: 'Nghỉ phép' },
  { value: 'WFH', label: 'Làm việc từ xa' },
];

const APPROVER_OPTIONS = [
  { value: 'line_manager', label: 'Quản lý trực tiếp' },
  { value: 'hr', label: 'HR' },
  { value: 'line_manager_hr', label: 'Quản lý trực tiếp → HR' },
];

export const FIELD_META: Record<string, Record<string, FieldMeta>> = {
  approval_flow: {
    default_steps: { label: 'Các bước duyệt mặc định', type: 'steps', hint: 'Thứ tự duyệt đơn: bước 1 duyệt trước, bước 2 duyệt sau' },
    sla_hours: { label: 'Hạn xử lý đơn', unit: 'giờ', type: 'number', hint: 'Quá hạn này đơn được nhắc người duyệt' },
    allow_withdraw: { label: 'Cho phép rút đơn đã gửi', type: 'bool' },
    allow_self_approval: { label: 'Cho phép quản lý tự duyệt đơn của mình', type: 'bool', hint: 'Bật: cấp quản lý trở lên được duyệt đơn do chính mình gửi — đơn hiện trong hộp thư duyệt của họ' },
    self_approval_min_role: {
      label: 'Vai trò tối thiểu được tự duyệt', type: 'select',
      options: [
        { value: 'MANAGER', label: 'Manager trở lên' },
        { value: 'EXECUTIVE', label: 'Executive trở lên' },
        { value: 'HR_ADMIN', label: 'HR Admin trở lên' },
        { value: 'ADMIN', label: 'Chỉ Admin' },
      ],
      hint: 'Nhân sự có vai trò thấp hơn vẫn phải qua quản lý trực tiếp',
    },
    self_approval_scope: {
      label: 'Phạm vi tự duyệt', type: 'select',
      options: [
        { value: 'NO_MANAGER', label: 'Chỉ khi không có quản lý trực tiếp hợp lệ' },
        { value: 'ALWAYS', label: 'Mọi lúc' },
      ],
      hint: 'NO_MANAGER: đơn của quản lý cấp cao nhất (không ai duyệt được) mới tự duyệt; ALWAYS: mọi quản lý được tự duyệt đơn của mình',
    },
  },
  attendance_security: {
    require_internal_network: { label: 'Bắt buộc Wi-Fi/IP công ty', type: 'bool', hint: 'Chấm công chỉ hợp lệ khi dùng mạng nội bộ' },
    require_geofence: { label: 'Bắt buộc trong vùng GPS', type: 'bool' },
    geofence_radius_m: { label: 'Bán kính vùng chấm công', unit: 'm', type: 'number', min: 10 },
    gps_accuracy_tolerance_m: { label: 'Sai số GPS cho phép', unit: 'm', type: 'number', min: 0 },
    allow_offline_punch: { label: 'Cho phép chấm công offline', type: 'bool' },
    offline_max_hours: { label: 'Chấm offline tối đa', unit: 'giờ', type: 'number', min: 0 },
    max_devices: { label: 'Số thiết bị tối đa / người', unit: 'thiết bị', type: 'number', min: 1 },
    require_face_verification: { label: 'Bắt buộc xác thực khuôn mặt', type: 'bool' },
    face_match_threshold: { label: 'Ngưỡng khớp khuôn mặt', unit: '%', type: 'number', min: 0, max: 100 },
    require_liveness: { label: 'Bắt buộc kiểm tra người thật', type: 'bool', hint: 'Chống dùng ảnh/video để qua mặt' },
    face_max_attempts: { label: 'Số lần thử khuôn mặt', unit: 'lần', type: 'number', min: 1 },
    grace_minutes: { label: 'Thời gian ân hạn', unit: 'phút', type: 'number', min: 0, hint: 'Đi muộn trong khoảng này chưa tính vi phạm' },
  },
  hr_approval: {
    teams: { label: 'Nhóm cần HR duyệt thêm', type: 'tags', suggestions: 'teams', hint: 'Chỉ đơn của các nhóm này mới chuyển thêm bước HR' },
    request_types: { label: 'Loại đơn cần HR duyệt', type: 'tags', suggestions: 'requestTypes' },
  },
  late_early: {
    max_count: { label: 'Số lần đi muộn tối đa', unit: 'lần/tháng', type: 'number', min: 0 },
    max_minutes: { label: 'Mức muộn tối đa được tạo đơn', unit: 'phút', type: 'number', min: 0 },
    submit_within_days: { label: 'Hạn nộp đơn', unit: 'ngày', type: 'number', min: 0 },
    allow_late_request: { label: 'Cho phép nộp đơn muộn', type: 'bool', hint: 'Nộp sau hạn vẫn được chấp nhận' },
  },
  late_without_request: {
    deduct_actual_minutes: { label: 'Trừ đúng số phút đi muộn', type: 'bool', hint: 'Tắt = trừ theo mốc cố định' },
    count_as_absent: { label: 'Tính là vắng mặt', type: 'bool' },
  },
  leave_accrual: {
    base_days_per_year: { label: 'Phép chuẩn mỗi năm', unit: 'ngày', type: 'number', min: 0 },
    accrual_on: { label: 'Cộng phép vào ngày', unit: 'trong tháng', type: 'number', min: 1, max: 28 },
    probation_days: { label: 'Phép cho nhân viên thử việc', unit: 'ngày/tháng', type: 'number', min: 0, step: 0.5 },
    on_confirmation: { label: 'Cộng bù khi ký hợp đồng chính thức', type: 'bool' },
    advance_max_days: { label: 'Số phép được ứng trước', unit: 'ngày', type: 'number', min: 0 },
  },
  leave_carryover: {
    keep_all_until: { label: 'Giữ đủ phép tồn đến', type: 'monthday', hint: 'Định dạng MM-DD, ví dụ 04-01 = 1 tháng 4' },
    max_keep_from: { label: 'Bắt đầu giới hạn phép tồn từ', type: 'monthday', hint: 'Sau mốc này chỉ giữ tối đa số ngày bên dưới' },
    max_keep_days: { label: 'Số ngày tồn được giữ tối đa', unit: 'ngày', type: 'number', min: 0 },
    expire_from: { label: 'Phép tồn hết hiệu lực từ', type: 'monthday', hint: 'Từ mốc này phép tồn còn lại bị xoá' },
    prioritize_carryover: { label: 'Ưu tiên trừ phép tồn trước', type: 'bool', hint: 'Khi nghỉ, trừ phép tồn năm cũ trước phép năm nay' },
  },
  leave_position_bonus: {
    manager_bonus_days: { label: 'Phép thêm cho quản lý', unit: 'ngày', type: 'number', min: 0 },
    position_bonus_days: { label: 'Phép thêm theo chức vụ', unit: 'ngày', type: 'number', min: 0 },
  },
  leave_request: {
    submit_within_days: { label: 'Hạn nộp đơn sau khi nghỉ', unit: 'ngày', type: 'number', min: 0 },
    allow_overdue_with_approval: { label: 'Nộp quá hạn nếu được duyệt', type: 'bool' },
    min_lead_days: { label: 'Báo trước tối thiểu', unit: 'ngày', type: 'number', min: 0 },
  },
  leave_seniority: {
    interval_years: { label: 'Mốc thâm niên', unit: 'năm/lần', type: 'number', min: 1 },
    days_per_interval: { label: 'Phép thâm niên mỗi mốc', unit: 'ngày', type: 'number', min: 0 },
    accrual_on_anniversary: { label: 'Cộng vào ngày ký hợp đồng', type: 'bool' },
  },
  leave_type_defaults: {
    submit_within_days: { label: 'Hạn nộp đơn', unit: 'ngày', type: 'number', min: 0 },
    require_attachment: { label: 'Bắt buộc đính kèm minh chứng', type: 'bool' },
    allow_negative_balance: { label: 'Cho phép số dư âm', type: 'bool' },
  },
  makeup: {
    max_count: { label: 'Số lần bổ sung tối đa', unit: 'lần/tháng', type: 'number', min: 0 },
    deadline_working_days: { label: 'Hạn nộp bổ sung', unit: 'ngày làm việc', type: 'number', min: 0 },
    allow_overdue_with_approval: { label: 'Nộp quá hạn nếu được duyệt', type: 'bool' },
  },
  notification: {
    max_push_per_day: { label: 'Số push tối đa mỗi ngày', unit: 'push/ngày', type: 'number', min: 0 },
    quiet_hours_start: { label: 'Bắt đầu giờ yên tĩnh', type: 'time' },
    quiet_hours_end: { label: 'Kết thúc giờ yên tĩnh', type: 'time' },
    dedupe_window_hours: { label: 'Gộp thông báo trùng trong', unit: 'giờ', type: 'number', min: 0 },
    escalate_after_days: { label: 'Leo thang nhắc việc sau', unit: 'ngày', type: 'number', min: 0 },
    digest_email_at: { label: 'Gửi email tổng hợp lúc', type: 'time' },
  },
  okr_evaluation: {
    scale_min: { label: 'Thang điểm từ', type: 'number' },
    scale_max: { label: 'Thang điểm đến', type: 'number' },
    score_categories: { label: 'Số nhóm điểm đánh giá', unit: 'nhóm', type: 'number', min: 1, max: 5 },
    checkin_interval: { label: 'Chu kỳ check-in', type: 'select', options: [
      { value: 'WEEKLY', label: 'Hàng tuần' },
      { value: 'MONTHLY', label: 'Hàng tháng' },
      { value: 'QUARTERLY', label: 'Hàng quý' },
    ] },
    alignment_enabled: { label: 'Bắt buộc OKR cá nhân gắn mục tiêu công ty', type: 'bool' },
    weight_sum: { label: 'Tổng trọng số', unit: '%', type: 'number', min: 0, max: 100 },
  },
  payroll_period: {
    close_day: { label: 'Ngày chốt kỳ tháng trước', unit: 'ngày', type: 'number', min: 1, max: 28 },
    lock_delay_days: { label: 'Tự khoá bảng công sau khi chốt', unit: 'ngày', type: 'number', min: 0 },
    dispute_window_days: { label: 'Hạn khiếu nại sau khi chốt', unit: 'ngày', type: 'number', min: 0 },
    allow_adjust_after_lock: { label: 'Cho phép điều chỉnh sau khi khoá', type: 'bool' },
  },
  share_account: {
    max_checkin_per_day: { label: 'Số lần chấm công mỗi ngày', unit: 'lần/ngày', type: 'number', min: 1 },
    require_password_change: { label: 'Bắt buộc đổi mật khẩu ban đầu', type: 'bool' },
    require_2fa: { label: 'Bắt buộc 2FA', type: 'bool' },
    device_confirm_required: { label: 'Bắt buộc xác nhận thiết bị', type: 'bool' },
    alert_on_new_device: { label: 'Cảnh báo khi có thiết bị lạ', type: 'bool' },
    max_additional_devices: { label: 'Số thiết bị thêm tối đa', unit: 'thiết bị', type: 'number', min: 0 },
    device_request_need_reason: { label: 'Yêu cầu thiết bị phải nêu lý do', type: 'bool' },
    device_grant_days: { label: 'Thời gian xử lý cấp thiết bị', unit: 'ngày', type: 'number', min: 0 },
    device_request_from_office_only: { label: 'Chỉ gửi yêu cầu tại văn phòng', type: 'bool' },
    device_expiry_days: { label: 'Thiết bị hết hiệu lực sau', unit: 'ngày', type: 'number', min: 0 },
  },
  shift: {
    default_shift_start: { label: 'Giờ vào ca mặc định', type: 'time' },
    default_shift_end: { label: 'Giờ tan ca mặc định', type: 'time' },
    default_lunch_start: { label: 'Bắt đầu nghỉ trưa', type: 'time' },
    default_lunch_end: { label: 'Kết thúc nghỉ trưa', type: 'time' },
  },
  shift_times: {
    check_in_start: { label: 'Mở chấm công vào', type: 'time' },
    check_in_end: { label: 'Đóng chấm công vào', type: 'time' },
    check_out_start: { label: 'Mở chấm công ra', type: 'time' },
    check_out_end: { label: 'Đóng chấm công ra', type: 'time' },
    lunch_break_start: { label: 'Bắt đầu nghỉ trưa', type: 'time' },
    lunch_break_end: { label: 'Kết thúc nghỉ trưa', type: 'time' },
    required_work_hours: { label: 'Số giờ làm bắt buộc', unit: 'giờ', type: 'number', min: 0, step: 0.5 },
    is_flexible: { label: 'Giờ làm linh hoạt', type: 'bool' },
    flexible_checkin_from: { label: 'Flex vào: từ', type: 'time' },
    flexible_checkin_to: { label: 'Flex vào: đến', type: 'time' },
    flexible_checkout_from: { label: 'Flex ra: từ', type: 'time' },
    flexible_checkout_to: { label: 'Flex ra: đến', type: 'time' },
    full_day_hours: { label: 'Giờ quy đổi 1 ngày công', unit: 'giờ', type: 'number', min: 0, step: 0.5 },
    half_day_hours: { label: 'Giờ quy đổi nửa ngày công', unit: 'giờ', type: 'number', min: 0, step: 0.5 },
    allow_exception_shift: { label: 'Cho phép ca ngoại lệ', type: 'bool' },
  },
  wfh: {
    max_count: { label: 'Số ngày WFH tối đa', unit: 'ngày/tuần', type: 'number', min: 0 },
    block_third_day: { label: 'Chặn ngày WFH thứ 3 trong tuần', type: 'bool' },
    min_duration_days: { label: 'Thời lượng WFH tối thiểu', unit: 'ngày', type: 'number', min: 0, step: 0.5 },
    submit_within_days: { label: 'Hạn nộp đơn WFH', unit: 'ngày', type: 'number', min: 0 },
  },
};

/** "max_keep_days" → "Max keep days" — chỉ dùng khi field chưa có nhãn khai báo. */
export const humanizeFieldKey = (key: string): string =>
  key.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

export function inferFieldMeta(key: string, value: unknown): FieldMeta {
  const label = humanizeFieldKey(key);
  if (typeof value === 'boolean') return { label, type: 'bool' };
  if (typeof value === 'number') {
    if (/_days?$/.test(key)) return { label, type: 'number', unit: 'ngày' };
    if (/_hours$/.test(key)) return { label, type: 'number', unit: 'giờ' };
    if (/_minutes$/.test(key)) return { label, type: 'number', unit: 'phút' };
    if (/_m$/.test(key)) return { label, type: 'number', unit: 'm' };
    return { label, type: 'number' };
  }
  if (typeof value === 'string') {
    if (/^\d{2}:\d{2}$/.test(value)) return { label, type: 'time' };
    if (/^\d{2}-\d{2}$/.test(value)) return { label, type: 'monthday' };
    return { label, type: 'text' };
  }
  if (Array.isArray(value)) {
    if (value.length > 0 && typeof value[0] === 'object' && value[0] !== null) return { label, type: 'steps' };
    return { label, type: 'tags', suggestions: key === 'teams' ? 'teams' : key === 'request_types' ? 'requestTypes' : undefined };
  }
  return { label, type: 'text' };
}

export const fieldMeta = (ruleKey: string, field: string, value: unknown): FieldMeta =>
  FIELD_META[ruleKey]?.[field] ?? inferFieldMeta(field, value);

export const requestTypeLabel = (v: string): string =>
  REQUEST_TYPES.find((o) => o.value === v)?.label ?? v;

export const approverLabel = (v: string): string =>
  APPROVER_OPTIONS.find((o) => o.value === v)?.label ?? v;

export const approverOptions = APPROVER_OPTIONS;
export const requestTypeOptions = REQUEST_TYPES;

/** Chuỗi đọc được cho trang tra cứu S19. */
export function formatFieldValue(meta: FieldMeta, value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Bật' : 'Tắt';
  if (meta.type === 'steps' && Array.isArray(value)) {
    return value
      .map((s: any, i: number) => `Bước ${s?.step ?? i + 1}: ${approverLabel(String(s?.approver ?? ''))}`)
      .join(' → ');
  }
  if (Array.isArray(value)) {
    if (meta.suggestions === 'requestTypes') return value.map((v) => requestTypeLabel(String(v))).join(', ') || '—';
    return value.join(', ') || '—';
  }
  if (meta.type === 'select' && meta.options) {
    return meta.options.find((o) => o.value === String(value))?.label ?? String(value);
  }
  const text = String(value);
  return meta.unit ? `${text} ${meta.unit}` : text;
}
