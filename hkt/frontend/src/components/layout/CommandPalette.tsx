import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export type CommandAction =
  | 'CHECK_IN'
  | 'SUBMIT_LEAVE'
  | 'SUBMIT_WFH'
  | 'CHANGE_PASSWORD'
  | 'VIEW_MY_TIMESHEET'
  | 'CHECKIN_OKR'
  | 'APPROVE_REQUESTS'
  | 'TEAM_SCHEDULE'
  | 'CONFIG_RULES'
  | 'VIEW_AUDIT_LOGS';

export interface SearchResultItem {
  title: string;
  subtitle?: string;
  kind: 'user' | 'request' | 'rule' | 'action' | 'page';
  url: string;
  keywords?: string;
  action?: CommandAction;
}

interface CatalogItem extends SearchResultItem {
  roles?: string[];
}

// Chuẩn hóa tiếng Việt bỏ dấu (Acceptance criteria G2-#5)
export function removeAccents(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

/**
 * Tìm kiếm mờ: khớp chuỗi con, bỏ khoảng trắng (chamcong ≈ chấm công), hoặc
 * khớp đủ từ không cần đúng thứ tự — đủ tốt cho tên tiếng Việt/không dấu.
 */
export function fuzzyMatchText(text: string, query: string): boolean {
  const q = removeAccents(query);
  if (!q) return true;
  const t = removeAccents(text);
  if (t.includes(q)) return true;

  const compactQuery = q.replace(/\s+/g, '');
  if (compactQuery && t.replace(/\s+/g, '').includes(compactQuery)) return true;

  const tokens = q.split(/\s+/).filter(Boolean);
  return tokens.length > 1 && tokens.every((token) => t.includes(token));
}

const HR_ROLES = ['ADMIN', 'HR_ADMIN'];
const MANAGER_ROLES = ['ADMIN', 'HR_ADMIN', 'MANAGER'];
const ALL_ROLES = ['ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE'];

/**
 * Khi chưa gõ từ khóa chỉ hiện vài thao tác hay dùng nhất — danh sách đầy đủ
 * (màn hình, nhân viên, quy định) chỉ xuất hiện sau khi tìm kiếm.
 */
const DEFAULT_ACTION_ORDER: CommandAction[] = [
  'CHECK_IN',
  'SUBMIT_LEAVE',
  'SUBMIT_WFH',
  'APPROVE_REQUESTS',
  'CHANGE_PASSWORD',
  'VIEW_MY_TIMESHEET',
  'CHECKIN_OKR',
  'CONFIG_RULES',
  'TEAM_SCHEDULE',
  'VIEW_AUDIT_LOGS',
];
const DEFAULT_RESULT_LIMIT = 6;

/**
 * Danh mục màn hình/chức năng dùng cho Command Palette.
 * `roles` để không hiển thị đường dẫn mà vai trò hiện tại không mở được (tránh link 403).
 */
const BASE_CATALOG: CatalogItem[] = [
  // Điều hướng chung
  { title: 'Cần làm (Todo Inbox)', subtitle: 'Màn hình mặc định sau đăng nhập', kind: 'page', url: '/todo', keywords: 'can lam todo inbox viec can lam s02', roles: ALL_ROLES },
  { title: 'Hồ sơ cá nhân', subtitle: 'Thông tin, avatar, bảo mật tài khoản', kind: 'page', url: '/account/profile', keywords: 'ho so ca nhan profile thong tin tai khoan avatar s39', roles: ALL_ROLES },
  { title: 'Đổi mật khẩu', subtitle: 'Mở form đổi mật khẩu ngay', kind: 'action', url: '/account/profile', action: 'CHANGE_PASSWORD', keywords: 'doi mat khau password bao mat tai khoan', roles: ALL_ROLES },
  { title: 'Cài đặt Passkey / Sinh trắc học', subtitle: 'Quản lý passkey, vân tay, khuôn mặt', kind: 'page', url: '/account/passkey', keywords: 'passkey sinh trac hoc van tay khuon mat bao mat s39', roles: ALL_ROLES },
  { title: 'Tuỳ chỉnh thông báo', subtitle: 'Web, email, push, giờ yên lặng', kind: 'page', url: '/account/notifications', keywords: 'thong bao tuy chinh cai dat quiet hours gio yen lang push email s36', roles: ALL_ROLES },
  { title: 'Trung tâm thông báo', subtitle: 'Hộp thư thông báo & nhắc việc', kind: 'page', url: '/notifications', keywords: 'thong bao notification hop thu nhan viec s04', roles: ALL_ROLES },

  // Chấm công & đơn từ
  { title: 'Chấm công khuôn mặt', subtitle: 'Camera nhận diện 3 góc', kind: 'action', url: '/attendance/checkin', action: 'CHECK_IN', keywords: 'cham cong checkin check in check out face mobile ca lam s05', roles: ALL_ROLES },
  { title: 'Bảng công cá nhân của tôi', subtitle: 'Chấm công tháng của tôi', kind: 'action', url: '/attendance/my-timesheet', action: 'VIEW_MY_TIMESHEET', keywords: 'bang cong ca nhan my timesheet cham cong thang s15', roles: ALL_ROLES },
  { title: 'Bảng công tổng hợp 53 cột', subtitle: 'Bảng công tháng · chốt công', kind: 'page', url: '/attendance/timesheet', keywords: 'bang cong timesheet thang 11 thang 12 luong chot cong s15', roles: ALL_ROLES },
  { title: 'Lịch chấm công tháng', subtitle: 'Lịch làm việc, ngày công, ngày lễ', kind: 'page', url: '/attendance/calendar', keywords: 'lich cham cong calendar lich thang ngay le ca lam', roles: ALL_ROLES },
  { title: 'Lịch làm việc nhóm', subtitle: 'Ca làm, nghỉ phép của đồng đội', kind: 'action', url: '/attendance/team-schedule', action: 'TEAM_SCHEDULE', keywords: 'lich lam viec nhom team schedule ca lam dong doi', roles: MANAGER_ROLES },
  { title: 'Đơn của tôi', subtitle: 'Theo dõi đơn nghỉ phép, WFH, đi muộn', kind: 'page', url: '/attendance/requests', keywords: 'don cua toi danh sach don don tu requests s08', roles: ALL_ROLES },
  { title: 'Tạo đơn xin nghỉ phép', subtitle: 'Mở form tạo đơn nghỉ phép ngay', kind: 'action', url: '/attendance/requests', action: 'SUBMIT_LEAVE', keywords: 'tao don xin nghi phep nghi phep leave al s08', roles: ALL_ROLES },
  { title: 'Tạo đơn làm việc từ xa (WFH)', subtitle: 'Mở form đăng ký WFH ngay', kind: 'action', url: '/attendance/requests', action: 'SUBMIT_WFH', keywords: 'tao don wfh lam viec tu xa remote s08', roles: ALL_ROLES },
  { title: 'Đơn cần phê duyệt', subtitle: 'Duyệt đơn nghỉ phép, WFH, chấm công', kind: 'action', url: '/attendance/approvals', action: 'APPROVE_REQUESTS', keywords: 'duyet don phe duyet approval approvals s12', roles: MANAGER_ROLES },
  { title: 'Số dư & lịch sử nghỉ phép', subtitle: 'Quỹ phép năm, phép tồn, chuyển phép', kind: 'page', url: '/attendance/leaves', keywords: 'so du phep lich su nghi phep phep ton chuyen phep s32', roles: ALL_ROLES },
  { title: 'Sổ phép nhân sự (Leave Ledger)', subtitle: 'Biến động phép toàn công ty', kind: 'page', url: '/attendance/leave-ledger', keywords: 'so phep leave ledger bien dong phep nhan su', roles: HR_ROLES },
  { title: 'Bảng nghỉ phép toàn công ty', subtitle: 'Tổng hợp phép năm theo nhân viên', kind: 'page', url: '/attendance/leave-table', keywords: 'bang nghi phep leave table phep nam nhan vien', roles: HR_ROLES },
  { title: 'Khiếu nại bảng công', subtitle: 'Xử lý khiếu nại chấm công', kind: 'page', url: '/attendance/disputes', keywords: 'khieu nai bang cong dispute complaint cham cong', roles: HR_ROLES },
  { title: 'Thiết bị chấm công của tôi', subtitle: 'Quản lý thiết bị tin cậy', kind: 'page', url: '/attendance/devices', keywords: 'thiet bi cham cong device trusted thiet bi tin cay', roles: ALL_ROLES },
  { title: 'Thêm thiết bị chấm công', subtitle: 'Đăng ký thiết bị mới', kind: 'page', url: '/attendance/devices/add', keywords: 'them thiet bi cham cong add device dang ky thiet bi', roles: ALL_ROLES },
  { title: 'Quy định & chính sách', subtitle: 'Nội quy, chính sách nhân sự', kind: 'page', url: '/admin/policy-doc', keywords: 'quy dinh chinh sach noi quy policy doc', roles: ALL_ROLES },

  // Quy định (kết quả tìm kiếm mẫu)
  { title: 'Quy định Đi muộn, về sớm', subtitle: 'Chính sách · Quota 2 lần/tháng, tối đa 60 phút', kind: 'rule', url: '/admin/policy-doc', keywords: 'dieu di muon muon som 60 phut 2 lan', roles: ALL_ROLES },
  { title: 'Quy định Phép tồn & chuyển phép năm', subtitle: 'Chính sách · Hạn bảo lưu phép tồn đến 31/03', kind: 'rule', url: '/admin/policy-doc', keywords: 'phep phep ton nghi phep phep nam 31 03', roles: ALL_ROLES },
  { title: 'Quy định Làm việc từ xa (WFH)', subtitle: 'Chính sách · Tối đa 2 ngày/tuần, báo cáo cuối ngày', kind: 'rule', url: '/admin/policy-doc', keywords: 'wfh lam viec tu xa online bao cao', roles: ALL_ROLES },
  { title: 'Quy định Bổ sung chấm công quên quét', subtitle: 'Chính sách · Bổ sung trong 3 ngày, tối đa 5 lần/tháng', kind: 'rule', url: '/admin/policy-doc', keywords: 'bo sung quen cham cong quen quet adjust', roles: ALL_ROLES },

  // Quản trị hệ thống
  { title: 'Quản lý nhân viên', subtitle: 'Hồ sơ, trạng thái, vai trò nhân sự', kind: 'page', url: '/admin/employees', keywords: 'quan ly nhan vien employee nhan su ho so s41', roles: HR_ROLES },
  { title: 'Quản lý tài khoản', subtitle: 'Tài khoản đăng nhập & phân quyền', kind: 'page', url: '/admin/users', keywords: 'quan ly tai khoan user users phan quyen', roles: HR_ROLES },
  { title: 'Sơ đồ tổ chức phòng ban', subtitle: 'Cây phòng ban lồng nhau', kind: 'page', url: '/admin/org-tree', keywords: 'so do to chuc org tree phong ban cay nhom long nhau s41', roles: ALL_ROLES },
  { title: 'Quản lý nhóm & team', subtitle: 'Thành viên, trưởng nhóm', kind: 'page', url: '/admin/teams', keywords: 'quan ly nhom team thanh vien truong nhom', roles: ALL_ROLES },
  { title: 'Ca làm việc & ngày lễ', subtitle: 'Cấu hình ca, lịch nghỉ lễ', kind: 'page', url: '/admin/shifts', keywords: 'ca lam viec ngay le shift holiday lich nghi', roles: HR_ROLES },
  { title: 'Cấu hình quy định Rule Engine', subtitle: 'Quy định hệ thống & tham số', kind: 'action', url: '/admin/rules', action: 'CONFIG_RULES', keywords: 'cau hinh quy dinh rule engine tham so he thong', roles: HR_ROLES },
  { title: 'Quy định chấm công (Rule Engine)', subtitle: 'Quy định đi muộn, phép, WFH', kind: 'page', url: '/attendance/rules', keywords: 'quy dinh cham cong rule engine attendance rules', roles: HR_ROLES },
  { title: 'Loại nghỉ phép', subtitle: 'Danh mục loại nghỉ & hạn nộp', kind: 'page', url: '/admin/leave-types', keywords: 'loai nghi phep leave types han nop', roles: HR_ROLES },
  { title: 'Quản lý thiết bị chấm công', subtitle: 'Thiết bị tin cậy toàn công ty', kind: 'page', url: '/admin/devices', keywords: 'quan ly thiet bi cham cong admin devices', roles: HR_ROLES },
  { title: 'Nhật ký kiểm toán', subtitle: 'Audit log thay đổi hệ thống', kind: 'action', url: '/admin/audit-logs', action: 'VIEW_AUDIT_LOGS', keywords: 'audit log nhat ky kiem toan thay doi he thong', roles: HR_ROLES },

  // OKR
  { title: 'Dashboard OKR cá nhân', subtitle: 'Mục tiêu, Key Results, tiến độ', kind: 'page', url: '/okr/dashboard', keywords: 'okr dashboard muc tieu kr tien do s20', roles: ALL_ROLES },
  { title: 'OKR của tôi', subtitle: 'Thiết lập, cập nhật tiến độ & tự đánh giá theo phase', kind: 'page', url: '/okr/my-okr', keywords: 'okr cua toi my okr muc tieu key results checkin danh gia', roles: ALL_ROLES },
  { title: 'Check-in tiến độ OKR', subtitle: 'Cập nhật kết quả Key Results', kind: 'action', url: '/okr/my-okr', action: 'CHECKIN_OKR', keywords: 'check in checkin tien do okr key results cap nhat', roles: ALL_ROLES },
  { title: 'Tự đánh giá OKR cuối năm', subtitle: 'Form 4 box Business/People trong OKR của tôi', kind: 'page', url: '/okr/my-okr?section=assessment', keywords: 'okr assessment danh gia form 4 box business people s23 tu danh gia', roles: ALL_ROLES },
  { title: 'Duyệt mục tiêu OKR nhóm', subtitle: 'Phê duyệt OKR cấp dưới', kind: 'page', url: '/okr/team-approvals', keywords: 'duyet okr muc tieu nhom team approvals phe duyet', roles: MANAGER_ROLES },
  { title: 'Đánh giá giữa năm', subtitle: 'Mid-year review hiệu suất', kind: 'page', url: '/okr/mid-year-review', keywords: 'danh gia giua nam mid year review hieu suat', roles: MANAGER_ROLES },
  { title: 'Đánh giá nhóm', subtitle: 'Team review kết quả OKR', kind: 'page', url: '/okr/team-review', keywords: 'danh gia nhom team review okr ket qua', roles: MANAGER_ROLES },
  { title: 'Chu kỳ OKR', subtitle: 'Cấu hình kỳ đánh giá', kind: 'page', url: '/okr/cycles', keywords: 'chu ky okr cycles ky danh gia', roles: HR_ROLES },
  { title: 'Báo cáo tổng hợp OKR', subtitle: 'Thống kê hiệu suất toàn công ty', kind: 'page', url: '/okr/summary-report', keywords: 'bao cao tong hop okr summary report hieu suat', roles: HR_ROLES },
];

const HR_ONLY_URLS = new Set([
  '/attendance/leave-ledger',
  '/attendance/leave-table',
  '/attendance/disputes',
  '/attendance/rules',
  '/admin/employees',
  '/admin/users',
  '/admin/shifts',
  '/admin/rules',
  '/admin/leave-types',
  '/admin/devices',
  '/admin/audit-logs',
  '/okr/cycles',
  '/okr/summary-report',
]);
const MANAGER_URLS = new Set(['/okr/team-approvals', '/okr/mid-year-review', '/okr/team-review']);

function canAccessUrl(url: string, role: string): boolean {
  if (HR_ROLES.includes(role)) return true;
  if (HR_ONLY_URLS.has(url)) return false;
  if (MANAGER_URLS.has(url)) return MANAGER_ROLES.includes(role);
  return true;
}

function itemMatches(item: SearchResultItem, cleanQuery: string): boolean {
  if (!cleanQuery) return true;
  return [item.title, item.subtitle || '', item.keywords || '']
    .some((value) => fuzzyMatchText(value, cleanQuery));
}

function dedupeResults(items: SearchResultItem[]): SearchResultItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.action
      ? `action:${item.action}`
      : item.kind === 'page'
        ? `page:${item.url}`
        : `${item.kind}:${item.url}|${item.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [quickActions, setQuickActions] = useState<SearchResultItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const wasOpenRef = useRef(false);

  const role = useMemo(() => (user?.role || 'EMPLOYEE').toUpperCase(), [user?.role]);
  const visibleCatalog = useMemo(
    () => BASE_CATALOG.filter((item) => (item.roles ? item.roles.includes(role) : true)),
    [role]
  );

  const defaultResults = useMemo(() => {
    const rank = (item: SearchResultItem) => {
      const idx = item.action ? DEFAULT_ACTION_ORDER.indexOf(item.action) : -1;
      return idx === -1 ? DEFAULT_ACTION_ORDER.length : idx;
    };
    return [...quickActions]
      .sort((a, b) => rank(a) - rank(b))
      .slice(0, DEFAULT_RESULT_LIMIT);
  }, [quickActions]);

  // Mỗi lần mở: reset từ khóa, focus ô nhập, khoá cuộn nền.
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      setQuery('');
      setSelectedIndex(0);
      setSearchResults([]);
    }
    wasOpenRef.current = isOpen;

    if (!isOpen) return;
    document.body.style.overflow = 'hidden';
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Hành động nhanh theo vai trò do backend trả về (CORE-CMD-02).
  useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();
    fetch('/api/v1/search/actions', { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        if (!data?.success || !Array.isArray(data.data)) return;
        const mapped: SearchResultItem[] = data.data
          .filter((item: any) => item?.action && item?.label && item?.url)
          .map((item: any) => ({
            title: item.label,
            subtitle: 'Thao tác nhanh · mở ngay',
            kind: 'action' as const,
            url: item.url,
            action: item.action as CommandAction,
          }));
        setQuickActions(mapped);
      })
      .catch(() => {
        // Không chặn palette nếu endpoint hành động nhanh lỗi.
      });
    return () => controller.abort();
  }, [isOpen]);

  // Tìm kiếm: debounce + abort để kết quả cũ không ghi đè kết quả mới.
  useEffect(() => {
    if (!isOpen) return;
    const cleanQuery = removeAccents(query);

    // Chưa gõ gì: chỉ gợi ý vài thao tác hay dùng, không đổ cả danh mục ra.
    if (!cleanQuery) {
      setSearchResults(defaultResults);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();

    const timer = window.setTimeout(() => {
      setIsLoading(true);
      fetch(`/api/v1/search/quick?q=${encodeURIComponent(query)}`, { signal: controller.signal })
        .then((res) => res.json())
        .then((data) => {
          if (controller.signal.aborted) return;
          const localMatches = visibleCatalog.filter((item) => itemMatches(item, cleanQuery));
          const actionMatches = quickActions.filter((item) => itemMatches(item, cleanQuery));

          const apiItems: SearchResultItem[] = data?.success && Array.isArray(data.data)
            ? data.data
              .map((item: any) => ({
                title: item.title,
                subtitle: item.subtitle,
                kind: item.kind || 'page',
                url: item.url,
              }))
              .filter((item: SearchResultItem) => canAccessUrl(item.url, role))
            : [];

          setSearchResults(dedupeResults([...actionMatches, ...apiItems, ...localMatches]).slice(0, 15));
          setIsLoading(false);
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          const localMatches = visibleCatalog.filter((item) => itemMatches(item, cleanQuery));
          const actionMatches = quickActions.filter((item) => itemMatches(item, cleanQuery));
          setSearchResults(dedupeResults([...actionMatches, ...localMatches]).slice(0, 15));
          setIsLoading(false);
        });
    }, query.trim() ? 250 : 0);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, isOpen, visibleCatalog, quickActions, role, defaultResults]);

  // Giữ mục đang chọn trong vùng nhìn khi dùng phím mũi tên.
  useEffect(() => {
    if (!isOpen) return;
    const el = panelRef.current?.querySelector<HTMLElement>(`[data-index="${selectedIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex, searchResults.length, isOpen]);

  useEffect(() => {
    setSelectedIndex((prev) => Math.min(prev, Math.max(0, searchResults.length - 1)));
  }, [searchResults.length]);

  // Escape đóng palette ở bất kỳ vị trí focus nào.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const handleSelect = (item: SearchResultItem) => {
    if (item.action === 'SUBMIT_LEAVE' || item.action === 'SUBMIT_WFH') {
      navigate('/attendance/requests', { state: { openCreate: item.action === 'SUBMIT_WFH' ? 'WFH' : 'LEAVE' } });
    } else if (item.action === 'CHANGE_PASSWORD') {
      navigate('/account/profile', { state: { openPassword: true } });
    } else {
      navigate(item.url);
    }
    onClose();
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, searchResults.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + searchResults.length) % Math.max(1, searchResults.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (searchResults[selectedIndex]) {
        handleSelect(searchResults[selectedIndex]);
      }
    }
  };

  const handlePanelKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab' || !panelRef.current) return;
    const focusable = Array.from(
      panelRef.current.querySelectorAll<HTMLElement>('input, button:not([disabled])')
    ).filter((el) => el.offsetParent !== null);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  if (!isOpen) return null;

  const getKindBadge = (kind: SearchResultItem['kind']) => {
    switch (kind) {
      case 'rule':
        return <span className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded font-semibold">Quy định</span>;
      case 'user':
        return <span className="text-[10px] bg-sky-50 text-sky-800 border border-sky-200 px-1.5 py-0.5 rounded font-semibold">Nhân viên</span>;
      case 'request':
        return <span className="text-[10px] bg-rose-50 text-rose-800 border border-rose-200 px-1.5 py-0.5 rounded font-semibold">Đơn từ</span>;
      case 'action':
        return <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded font-semibold">Thao tác</span>;
      default:
        return <span className="text-[10px] bg-canvas text-ink-muted border border-line px-1.5 py-0.5 rounded">Màn hình</span>;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-100"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Tìm kiếm nhanh toàn cục"
        className="w-full max-w-xl bg-surface rounded-2xl border border-line shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handlePanelKeyDown}
      >
        {/* Search input bar */}
        <div className="p-3.5 border-b border-line flex items-center gap-3 bg-canvas/40">
          <span className="text-ink-muted text-base" aria-hidden="true">🔍</span>
          <input
            ref={inputRef}
            autoFocus
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls="command-palette-results"
            aria-autocomplete="list"
            aria-label="Tìm nhân viên, đơn từ, quy định hoặc thao tác nhanh"
            placeholder="Tìm nhân viên, đơn từ, quy định (gõ phep, dieu, wfh...)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted"
          />
          {isLoading && <span className="w-3.5 h-3.5 rounded-full border-2 border-accent border-t-transparent animate-spin shrink-0" />}
          <kbd className="text-[10px] bg-canvas px-1.5 py-0.5 rounded border border-line text-ink-muted font-mono">ESC</kbd>
        </div>

        {/* Quick Hint Chips */}
        {!query && (
          <div className="px-3 py-2 bg-canvas/20 border-b border-line flex items-center gap-1.5 overflow-x-auto text-[11px] text-ink-muted">
            <span className="text-[10px] text-ink-muted shrink-0">Gợi ý gõ:</span>
            <button type="button" onClick={() => setQuery('phep')} className="px-2 py-0.5 bg-canvas rounded border border-line hover:border-accent text-ink cursor-pointer">phep</button>
            <button type="button" onClick={() => setQuery('dieu')} className="px-2 py-0.5 bg-canvas rounded border border-line hover:border-accent text-ink cursor-pointer">dieu</button>
            <button type="button" onClick={() => setQuery('wfh')} className="px-2 py-0.5 bg-canvas rounded border border-line hover:border-accent text-ink cursor-pointer">wfh</button>
            <button type="button" onClick={() => setQuery('cham cong')} className="px-2 py-0.5 bg-canvas rounded border border-line hover:border-accent text-ink cursor-pointer">cham cong</button>
            <button type="button" onClick={() => setQuery('doi mat khau')} className="px-2 py-0.5 bg-canvas rounded border border-line hover:border-accent text-ink cursor-pointer">doi mat khau</button>
          </div>
        )}

        {/* Search Results List */}
        <div id="command-palette-results" role="listbox" className="max-h-88 overflow-y-auto p-2 divide-y divide-line-soft">
          {searchResults.length === 0 ? (
            <div className="p-8 text-center text-xs text-ink-muted">
              {!query.trim()
                ? 'Gõ từ khóa để tìm màn hình, nhân viên, quy định…'
                : isLoading
                  ? 'Đang tìm kiếm…'
                  : `Không tìm thấy kết quả phù hợp với từ khóa "${query}".`}
            </div>
          ) : (
            <div className="space-y-1">
              {searchResults.map((item, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    data-index={idx}
                    key={`${item.kind}-${item.action || item.url}-${idx}`}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-xs flex items-center justify-between transition-colors group cursor-pointer ${
                      isSelected
                        ? 'bg-accent-soft border border-accent-line text-accent shadow-2xs'
                        : 'border border-transparent text-ink hover:bg-canvas'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <span className="text-sm shrink-0" aria-hidden="true">
                        {item.kind === 'rule' ? '📜' : item.kind === 'user' ? '👤' : item.kind === 'action' ? '⚡' : '📄'}
                      </span>
                      <div className="min-w-0">
                        <div className={`font-semibold truncate ${isSelected ? 'text-accent font-bold' : 'text-ink'}`}>
                          {item.title}
                        </div>
                        {item.subtitle && (
                          <div className="text-[11px] text-ink-muted truncate mt-0.5">
                            {item.subtitle}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      {getKindBadge(item.kind)}
                      {isSelected && <span className="text-[10px] text-accent font-mono font-bold">↵ Mở</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2.5 bg-canvas border-t border-line text-[11px] text-ink-muted flex items-center justify-between">
          <span>Dùng phím mũi tên <strong>↑ ↓</strong> để chọn · <strong>Enter</strong> để mở · <strong>Esc</strong> để đóng</span>
          <span className="font-mono text-[10px] text-ink-muted">Command Palette</span>
        </div>
      </div>
    </div>
  );
};
