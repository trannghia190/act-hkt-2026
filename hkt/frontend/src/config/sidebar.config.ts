export interface MenuItem {
  id: string;
  label: string;
  path: string;
  icon: string;
  badge?: string;
  badgeColor?: 'accent' | 'gray' | 'danger';
  screenId: string;
  roles?: string[];
}

export interface MenuGroup {
  groupName: string;
  items: MenuItem[];
}

export interface ModuleNavigation {
  moduleId: 'attendance' | 'okr' | 'shared';
  moduleTitle: string;
  groups: MenuGroup[];
}

export const SIDEBAR_CONFIG: ModuleNavigation[] = [
  // ==========================================
  // PHÂN HỆ 1: CHẤM CÔNG & ĐƠN TỪ
  // ==========================================
  {
    moduleId: 'attendance',
    moduleTitle: 'Chấm Công & Chuyên Cần',
    groups: [
      {
        groupName: 'CÁ NHÂN',
        items: [
          { id: 'todo', label: 'Cần làm (Todo Inbox)', path: '/todo', icon: 'Inbox', badge: '3', screenId: 'S02' },
          { id: 'checkin', label: 'Chấm công Mobile (5 Tầng)', path: '/attendance/checkin', icon: 'Fingerprint', screenId: 'S05m' },
          { id: 'calendar', label: 'Lịch công cá nhân', path: '/attendance/calendar', icon: 'Calendar', screenId: 'S06' },
          { id: 'my-timesheet', label: 'Bảng công của tôi', path: '/attendance/my-timesheet', icon: 'FileText', screenId: 'S11' },
          { id: 'my-requests', label: 'Đơn từ của tôi', path: '/attendance/requests', icon: 'FilePlus', screenId: 'S08' },
          { id: 'my-leaves', label: 'Số dư phép năm', path: '/attendance/leaves', icon: 'Sun', screenId: 'S09' },
        ],
      },
      {
        groupName: 'QUẢN LÝ NHÓM',
        items: [
          { id: 'approvals', label: 'Hộp thư duyệt đơn', path: '/attendance/approvals', icon: 'CheckSquare', badge: '12', badgeColor: 'danger', screenId: 'S12', roles: ['MANAGER', 'HR_ADMIN', 'ADMIN'] },
          { id: 'team-calendar', label: 'Lịch trực quan nhóm', path: '/attendance/team-schedule', icon: 'Users', screenId: 'S14', roles: ['MANAGER', 'HR_ADMIN', 'ADMIN'] },
        ],
      },
      {
        groupName: 'QUẢN TRỊ KỲ CÔNG & PHÉP',
        items: [
          { id: 'master-timesheet', label: 'Bảng công & Chốt lương', path: '/attendance/timesheet', icon: 'Table', screenId: 'S15', roles: ['HR_ADMIN', 'ADMIN'] },
          { id: 'leave-ledger', label: 'Sổ cái biến động phép', path: '/attendance/leave-ledger', icon: 'Book', screenId: 'S34', roles: ['HR_ADMIN', 'ADMIN'] },
        ],
      },
    ],
  },

  // ==========================================
  // PHÂN HỆ 2: OKR — MỤC TIÊU & ĐÁNH GIÁ
  // ==========================================
  {
    moduleId: 'okr',
    moduleTitle: 'Quản Trị & Đánh Giá OKR',
    groups: [
      {
        groupName: 'MỤC TIÊU CÁ NHÂN',
        items: [
          { id: 'okr-dashboard', label: 'Dashboard OKR cá nhân', path: '/okr/dashboard', icon: 'Target', screenId: 'S20' },
          { id: 'my-okr', label: 'Thiết lập & Check-in', path: '/okr/my-okr', icon: 'Edit3', screenId: 'S21' },
          { id: 'annual-assessment', label: 'Đánh giá cuối năm (4 Box)', path: '/okr/assessment', icon: 'Award', screenId: 'S23' },
        ],
      },
      {
        groupName: 'QUẢN LÝ NHÓM',
        items: [
          { id: 'okr-approvals', label: 'Duyệt mục tiêu OKR', path: '/okr/team-approvals', icon: 'CheckCircle', screenId: 'S42', roles: ['MANAGER', 'HR_ADMIN', 'ADMIN'] },
          { id: 'mid-year-review', label: 'Review & Coaching giữa năm', path: '/okr/mid-year-review', icon: 'MessageSquare', screenId: 'S43', roles: ['MANAGER', 'HR_ADMIN', 'ADMIN'] },
          { id: 'team-board', label: 'Team OKR Board', path: '/okr/team-board', icon: 'Layout', screenId: 'S46', roles: ['MANAGER', 'HR_ADMIN', 'ADMIN'] },
          { id: 'calibration', label: 'Cân chuẩn điểm (Calibration)', path: '/okr/calibration', icon: 'BarChart2', screenId: 'S24', roles: ['MANAGER', 'HR_ADMIN', 'ADMIN'] },
        ],
      },
      {
        groupName: 'BÁO CÁO TOÀN CÔNG TY',
        items: [
          { id: 'okr-summary', label: 'Bảng tổng hợp HR 9 trường', path: '/okr/summary-report', icon: 'FileSpreadsheet', screenId: 'S25', roles: ['HR_ADMIN', 'ADMIN'] },
        ],
      },
    ],
  },

  // ==========================================
  // PHÂN HỆ 3: HỆ THỐNG DÙNG CHUNG & TỔ CHỨC
  // ==========================================
  {
    moduleId: 'shared',
    moduleTitle: 'Hệ Thống & Cơ Cấu Tổ Chức',
    groups: [
      {
        groupName: 'CƠ CẤU TỔ CHỨC & NHÂN SỰ',
        items: [
          { id: 'users', label: 'Quản lý nhân viên & tài khoản', path: '/admin/employees', icon: 'UserCheck', screenId: 'S40', roles: ['HR_ADMIN', 'ADMIN'] },
          { id: 'org-tree', label: 'Sơ đồ tổ chức & phòng ban', path: '/admin/org-tree', icon: 'GitPullRequest', screenId: 'S41' },
          { id: 'shifts', label: 'Ca làm việc & lịch nghỉ lễ', path: '/admin/shifts', icon: 'Clock', screenId: 'S26', roles: ['HR_ADMIN', 'ADMIN'] },
          { id: 'delegations', label: 'Ủy quyền phê duyệt', path: '/admin/delegations', icon: 'Repeat', screenId: 'S37', roles: ['MANAGER', 'HR_ADMIN', 'ADMIN'] },
          { id: 'enroll-face-shared', label: 'Đăng ký mẫu khuôn mặt (S01-B)', path: '/auth/enroll-face', icon: 'Fingerprint', screenId: 'S01-B' },
        ],
      },
      {
        groupName: 'NỘI QUY & KIỂM TOÁN HỆ THỐNG',
        items: [
          { id: 'rules', label: 'Cấu hình 19 quy định (Rule Engine)', path: '/admin/rules', icon: 'Sliders', screenId: 'S16', roles: ['HR_ADMIN', 'ADMIN'] },
          { id: 'policy-doc', label: 'Tra cứu nội quy công ty', path: '/admin/policy-doc', icon: 'BookOpen', screenId: 'S19' },
          { id: 'audit-logs', label: 'Nhật ký kiểm toán hệ thống', path: '/admin/audit-logs', icon: 'Shield', screenId: 'S35', roles: ['HR_ADMIN', 'ADMIN'] },
        ],
      },
    ],
  },
];
