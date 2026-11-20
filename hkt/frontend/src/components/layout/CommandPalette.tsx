import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface SearchResultItem {
  title: string;
  subtitle?: string;
  kind: 'user' | 'request' | 'rule' | 'action' | 'page';
  url: string;
  keywords?: string;
}

// Chuẩn hóa tiếng Việt bỏ dấu (Acceptance criteria G2-#5)
export function removeAccents(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);

  // Danh mục màn hình, quy định và thao tác nhanh tích hợp sẵn
  const baseCatalog: SearchResultItem[] = [
    // 1. Thao tác nhanh & Chấm công
    { title: 'Cần làm (Todo Inbox)', subtitle: 'S02 · Màn hình mặc định sau đăng nhập', kind: 'page', url: '/todo', keywords: 'can lam todo inbox viec can lam' },
    { title: 'Chấm công khuôn mặt', subtitle: 'S05m · Camera nhận diện 3 góc', kind: 'action', url: '/attendance/checkin', keywords: 'cham cong checkin check in check out face mobile ca lam' },
    { title: 'Bảng công cá nhân của tôi', subtitle: 'S11 · Lịch sử công, giờ vào/ra', kind: 'page', url: '/attendance/my-timesheet', keywords: 'bang cong ca nhan cong cua toi timesheet' },
    { title: 'Bảng công tổng hợp 53 cột', subtitle: 'S15 · Bảng công tháng 11, chốt lương', kind: 'page', url: '/attendance/timesheet', keywords: 'bang cong tong hop 53 cot chot cong chot luong thang 11 thang 12' },
    { title: 'Tạo đơn xin nghỉ phép / WFH / Đi muộn', subtitle: 'S08 · Đơn từ cá nhân tự động kiểm tra rule', kind: 'action', url: '/attendance/requests', keywords: 'tao don xin nghi don tu wfh nghi phep di muon bo sung cong' },
    { title: 'Hộp thư duyệt đơn từ cấp dưới', subtitle: 'S12 · Phê duyệt đơn nhóm', kind: 'action', url: '/attendance/approvals', keywords: 'duyet don phe duyet approval approvals cap duoi' },
    { title: 'Lịch trực quan nhóm (Team Schedule)', subtitle: 'S14 · Xem ca và lịch vắng mặt của nhóm', kind: 'page', url: '/attendance/team-schedule', keywords: 'lich truc quan nhom team schedule ca lam' },
    { title: 'Số dư phép năm cá nhân', subtitle: 'S09 · Xem sổ phép, hạn dùng phép tồn', kind: 'page', url: '/attendance/leaves', keywords: 'so du phep nam phep ton so phep' },
    { title: 'Sổ cái biến động phép toàn công ty', subtitle: 'S34 · Sổ phép append-only', kind: 'page', url: '/attendance/leave-ledger', keywords: 'so cai phep leave ledger' },

    // 2. Quy định & Chính sách tra cứu (Criteria G2-#5: phep -> "phép", dieu -> "đi muộn")
    { title: 'Quy định Đi muộn, về sớm', subtitle: 'S19 · Quota 2 lần/tháng, tối đa 60 phút, nộp trong 3 ngày', kind: 'rule', url: '/admin/policy-doc', keywords: 'dieu di muon ve som 60 phut 2 lan quota' },
    { title: 'Quy định Phép tồn & chuyển phép năm', subtitle: 'S19 · Hạn chót bảo lưu phép cũ đến 31/03', kind: 'rule', url: '/admin/policy-doc', keywords: 'phep phep ton nghi phep phep nam 31 03 chuyen phep' },
    { title: 'Quy định Làm việc từ xa (WFH)', subtitle: 'S19 · Tối đa 2 ngày/tuần, báo cáo công việc cuối ngày', kind: 'rule', url: '/admin/policy-doc', keywords: 'wfh lam viec tu xa online bao cao cong viec' },
    { title: 'Quy định Bổ sung chấm công quên quét', subtitle: 'S19 · Hạn nộp trong 3 ngày làm việc kể từ ngày quên', kind: 'rule', url: '/attendance/requests', keywords: 'bo sung quen cham cong checkin checkout' },
    { title: 'Cấu hình 19 quy định (Rule Engine)', subtitle: 'S16/S17 · HR cấu hình quota, bán kính geofence, SLA', kind: 'rule', url: '/admin/rules', keywords: 'cau hinh quy dinh rule engine 19 quy dinh tham so' },

    // 3. Phân hệ OKR
    { title: 'Dashboard OKR cá nhân', subtitle: 'S20 · Tiến độ mục tiêu và kết quả then chốt', kind: 'page', url: '/okr/dashboard', keywords: 'okr dashboard muc tieu kr tien do' },
    { title: 'Thiết lập & Check-in tiến độ OKR', subtitle: 'S21 · Cập nhật chỉ số thực tế Key Results', kind: 'action', url: '/okr/my-okr', keywords: 'check in okr thiet lap my okr cap nhat tien do' },
    { title: 'Duyệt mục tiêu OKR nhóm', subtitle: 'S42 · Quản lý phê duyệt mục tiêu cấp dưới', kind: 'page', url: '/okr/team-approvals', keywords: 'duyet okr phe duyet muc tieu nhom' },
    { title: 'Form Đánh giá OKR cuối năm 4 Box', subtitle: 'S23 · Tự chấm điểm Business & People', kind: 'action', url: '/okr/assessment', keywords: 'danh gia okr form 4 box business people cuoi nam' },

    // 4. Quản trị & Hệ thống
    { title: 'Quản lý nhân viên & tài khoản', subtitle: 'S40 · Danh sách nhân sự, chuỗi cấp trên', kind: 'page', url: '/admin/employees', keywords: 'quan ly nhan vien employees danh ba tai khoan' },
    { title: 'Sơ đồ tổ chức phòng ban (Org Tree)', subtitle: 'S41 · Cây nhóm lồng nhau không giới hạn tầng', kind: 'page', url: '/admin/org-tree', keywords: 'so do to chuc org tree phong ban cay nhom' },
    { title: 'Nhật ký kiểm toán hệ thống (Audit Logs)', subtitle: 'S35 · Lịch sử sửa công, sửa điểm append-only', kind: 'page', url: '/admin/audit-logs', keywords: 'audit log nhat ky kiem toan lich su thay doi' },
    { title: 'Tùy chỉnh thông báo & Giờ yên lặng', subtitle: 'S36 · 3 kênh, chống spam, quiet hours', kind: 'page', url: '/notifications/preferences', keywords: 'thong bao tuy chinh cai dat preferences quiet hours gio yen lang' },
  ];

  // Shortcut Ctrl+K / Cmd+K và Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        }
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Live Search khi gõ
  useEffect(() => {
    if (!isOpen) return;
    const cleanQ = removeAccents(query);
    setSelectedIndex(0);

    // Client-side quick filter
    const localMatches = baseCatalog.filter((item) => {
      if (!cleanQ) return true;
      const titleMatch = removeAccents(item.title).includes(cleanQ);
      const subMatch = item.subtitle ? removeAccents(item.subtitle).includes(cleanQ) : false;
      const kwMatch = item.keywords ? removeAccents(item.keywords).includes(cleanQ) : false;
      return titleMatch || subMatch || kwMatch;
    });

    // Query backend API /api/v1/search/quick?q=... for users, rules and requests with role scoping
    setIsLoading(true);
    fetch(`/api/v1/search/quick?q=${encodeURIComponent(query)}`)
      .then((res) => res.json())
      .then((data) => {
        setIsLoading(false);
        if (data.success && Array.isArray(data.data)) {
          const apiItems: SearchResultItem[] = data.data.map((i: any) => ({
            title: i.title,
            subtitle: i.subtitle,
            kind: i.kind || 'page',
            url: i.url,
          }));

          // Merge without duplicates by URL and title
          const existingUrls = new Set(apiItems.map((a) => a.url + '|' + a.title));
          const uniqueLocal = localMatches.filter((l) => !existingUrls.has(l.url + '|' + l.title));
          setSearchResults([...apiItems, ...uniqueLocal].slice(0, 15));
        } else {
          setSearchResults(localMatches.slice(0, 15));
        }
      })
      .catch(() => {
        setIsLoading(false);
        setSearchResults(localMatches.slice(0, 15));
      });
  }, [query, isOpen]);

  // Keyboard navigation: Arrow Up / Down, Enter
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
        handleSelect(searchResults[selectedIndex].url);
      }
    }
  };

  const handleSelect = (path: string) => {
    navigate(path);
    onClose();
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
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-100"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-surface rounded-2xl border border-line shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input bar */}
        <div className="p-3.5 border-b border-line flex items-center gap-3 bg-canvas/40">
          <span className="text-ink-muted text-base">🔍</span>
          <input
            ref={inputRef}
            autoFocus
            type="text"
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
            <button type="button" onClick={() => setQuery('okr')} className="px-2 py-0.5 bg-canvas rounded border border-line hover:border-accent text-ink cursor-pointer">okr</button>
          </div>
        )}

        {/* Search Results List */}
        <div className="max-h-88 overflow-y-auto p-2 divide-y divide-line-soft">
          {searchResults.length === 0 ? (
            <div className="p-8 text-center text-xs text-ink-muted">
              Không tìm thấy kết quả phù hợp với từ khóa "{query}".
            </div>
          ) : (
            <div className="space-y-1">
              {searchResults.map((item, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <button
                    key={idx}
                    onClick={() => handleSelect(item.url)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-xs flex items-center justify-between transition-colors group cursor-pointer ${
                      isSelected
                        ? 'bg-accent-soft border border-accent-line text-accent shadow-2xs'
                        : 'border border-transparent text-ink hover:bg-canvas'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <span className="text-sm shrink-0">
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
          <span className="font-mono text-[10px] text-ink-muted">S03 · Command Palette</span>
        </div>
      </div>
    </div>
  );
};
