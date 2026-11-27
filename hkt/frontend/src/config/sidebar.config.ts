// S00 — Cấu trúc điều hướng: Một nguồn sự thật duy nhất (Single Source of Truth)
// Luật bắt buộc: Employee ⊂ Manager ⊂ HR.
// Mỗi variant là superset của variant nhỏ hơn. Mọi mục của nhân viên có ở cả 2 bản còn lại.

export interface NavChildItem {
  label: string;
  path: string;
}

export interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: string;
  badgeKey?: 'todo' | 'notif' | 'reqs' | 'checkin' | 'approve' | 'dispute';
  badgeColor?: 'accent' | 'danger' | 'warning' | 'gray';
  screenId: string;
  children?: NavChildItem[];
}

export interface NavGroup {
  groupName: string;
  items: NavItem[];
}

// =========================================================================
// 1. NHÓM DÙNG CHUNG CHO MỌI VAI TRÒ (COMMON — BIẾN THỂ NHÂN VIÊN: 14 MỤC)
// =========================================================================
export const COMMON_GROUPS: NavGroup[] = [
  {
    groupName: 'Hôm nay',
    items: [
      { id: 'todo', label: 'Cần làm', path: '/todo', icon: 'CheckSquare', badgeKey: 'todo', badgeColor: 'accent', screenId: 'S02' },
      { id: 'notif', label: 'Thông báo', path: '/notifications', icon: 'Bell', badgeKey: 'notif', badgeColor: 'accent', screenId: 'S04m' },
    ],
  },
  {
    groupName: 'Chấm công',
    items: [
      { id: 'punch', label: 'Chấm công', path: '/attendance/checkin', icon: 'Fingerprint', screenId: 'S05' },
      {
        id: 'reqs',
        label: 'Đơn của tôi',
        path: '/attendance/requests',
        icon: 'FilePlus',
        badgeKey: 'reqs',
        screenId: 'S08',
      },
      { id: 'cal', label: 'Lịch công', path: '/attendance/calendar', icon: 'Calendar', screenId: 'S06' },
      { id: 'team', label: 'Lịch nhóm', path: '/attendance/team-schedule', icon: 'Users', screenId: 'S14' },
      { id: 'balance', label: 'Số dư phép', path: '/attendance/leaves', icon: 'Sun', screenId: 'S09' },
      { id: 'mytime', label: 'Bảng công của tôi', path: '/attendance/my-timesheet', icon: 'FileText', screenId: 'S11' },
      { id: 'policy', label: 'Quy định tra cứu', path: '/admin/policy-doc', icon: 'BookOpen', screenId: 'S19' },
    ],
  },
  {
    groupName: 'OKR',
    items: [
      { id: 'myokr', label: 'Tổng quan OKR', path: '/okr/dashboard', icon: 'Target', screenId: 'S20' },
      // Một workspace duy nhất: thiết lập, check-in và tự đánh giá đổi theo phase (S21/S22/S23)
      { id: 'newokr', label: 'OKR của tôi', path: '/okr/my-okr', icon: 'Edit3', badgeKey: 'checkin', screenId: 'S21' },
    ],
  },
  {
    groupName: 'Cá nhân',
    items: [
      { id: 'profile', label: 'Hồ sơ cá nhân', path: '/account/profile', icon: 'UserCircle', screenId: 'S29' },
      { id: 'prefs', label: 'Tuỳ chỉnh thông báo', path: '/account/notifications', icon: 'Settings', screenId: 'S36' },
      { id: 'device', label: 'Thiết bị của tôi', path: '/attendance/devices', icon: 'Smartphone', screenId: 'S27' },
      { id: 'passkey', label: 'Passkey & bảo mật', path: '/account/passkey', icon: 'Shield', screenId: 'S28m' },
    ],
  },
];

// =========================================================================
// 2. NHÓM RIÊNG CỦA QUẢN LÝ (MANAGE: 3 MỤC)
// =========================================================================
export const MANAGER_GROUPS: NavGroup[] = [
  {
    groupName: 'Quản lý',
    items: [
      { id: 'approve', label: 'Duyệt đơn', path: '/attendance/approvals', icon: 'CheckCircle', badgeKey: 'approve', badgeColor: 'danger', screenId: 'S12' },
      { id: 'okrapprove', label: 'Duyệt OKR', path: '/okr/team-approvals', icon: 'ClipboardCheck', screenId: 'S42' },
      { id: 'midyear', label: 'Review giữa năm', path: '/okr/mid-year-review', icon: 'MessageCircle', screenId: 'S43' },
      { id: 'review', label: 'Review OKR nhóm', path: '/okr/team-review', icon: 'MessageSquare', screenId: 'S24' },
    ],
  },
];

// =========================================================================
// 3. NHÓM RIÊNG CỦA HR (HR: 12 MỤC)
// =========================================================================
export const HR_GROUPS: NavGroup[] = [
  {
    groupName: 'HR',
    items: [
      { id: 'tsheet', label: 'Bảng công & chốt', path: '/attendance/timesheet', icon: 'Table', screenId: 'S15' },
      { id: 'dispute', label: 'Danh sách khiếu nại', path: '/attendance/disputes', icon: 'AlertTriangle', badgeKey: 'dispute', badgeColor: 'danger', screenId: 'S45' },
      { id: 'leave', label: 'Bảng phép', path: '/attendance/leave-table', icon: 'Layers', screenId: 'S46' },
      { id: 'rules', label: 'Cấu hình quy định', path: '/admin/rules', icon: 'Sliders', screenId: 'S16' },
      { id: 'shift', label: 'Ca & lịch nghỉ lễ', path: '/admin/shifts', icon: 'Clock', screenId: 'S26' },
      { id: 'leavetypes', label: 'Quản lý loại nghỉ', path: '/admin/leave-types', icon: 'Tag', screenId: 'S32' },
      { id: 'okrcycle', label: 'Chu kỳ OKR', path: '/okr/cycles', icon: 'CalendarRange', screenId: 'S44' },
      { id: 'okrrep', label: 'Báo cáo OKR', path: '/okr/summary-report', icon: 'BarChart2', screenId: 'S25' },
      { id: 'audit', label: 'Nhật ký thay đổi', path: '/admin/audit-logs', icon: 'Shield', screenId: 'S35' },
      { id: 'hrdev', label: 'Quản lý thiết bị', path: '/admin/devices', icon: 'MonitorSmartphone', screenId: 'S28' },
      { id: 'sysdomain', label: 'Cấu hình Domain Host', path: '/admin/system-config', icon: 'Globe', screenId: 'S48' },
      { id: 'people', label: 'Quản lý nhân viên', path: '/admin/employees', icon: 'UserCheck', screenId: 'S40' },
      { id: 'mtree', label: 'Cây quản lý', path: '/admin/org-tree', icon: 'GitPullRequest', screenId: 'S41' },
    ],
  },
];

// =========================================================================
// 4. SINH 3 BIẾN THỂ TỪ 1 NGUỒN CẤU HÌNH DUY NHẤT
// =========================================================================
// Employee (13) ⊂ Manager (17) ⊂ HR (25) / Admin (29)
export const VARIANTS = {
  employee: COMMON_GROUPS,
  manager: [...COMMON_GROUPS, ...MANAGER_GROUPS],
  hr: [...COMMON_GROUPS, ...HR_GROUPS],
  admin: [...COMMON_GROUPS, ...MANAGER_GROUPS, ...HR_GROUPS],
};

export const DEFAULT_BADGES: Record<string, number> = {
  todo: 0,
  notif: 0,
  reqs: 0,
  checkin: 0,
  approve: 0,
  dispute: 0,
};

/**
 * Trả về cấu hình NavGroup[] theo vai trò của người dùng
 */
export function getNavForRole(role?: string): NavGroup[] {
  const norm = (role || '').toUpperCase();
  if (norm === 'ADMIN') return VARIANTS.admin;
  if (norm === 'HR_ADMIN' || norm === 'HR') return VARIANTS.hr;
  if (norm === 'MANAGER') return VARIANTS.manager;
  return VARIANTS.employee;
}
