export interface Phase {
  key: string;
  name: string;
  start_date?: string;
  due_date?: string;
  review_start?: string; // cửa sổ QL duyệt/nhận xét/chấm điểm
  review_due?: string;
  status: string; // lưu: locked = khoá cứng, còn lại = theo ngày
  effective_status?: string; // cửa sổ NV: active | upcoming | locked
  manager_status?: string; // cửa sổ QL: active | upcoming | locked
  days_left?: number | null;
}

export interface CompanyObjective {
  id?: string;
  title: string;
  category: 'BUSINESS' | 'PEOPLE';
  progress: number;
}

export interface Cycle {
  id: string;
  name: string;
  year: number;
  scaleMin: number;
  scaleMax: number;
  checkinInterval: string;
  alignmentEnabled: boolean;
  status: string;
  phases: Phase[];
  companyObjectives: CompanyObjective[];
  seniorityCutoffDate?: string | null;
  effectiveSeniorityCutoff?: string;
  directorReviewedAt?: string | null;
  directorReviewComment?: string | null;
  directorReviewPending?: boolean;
}

export const PHASE_LABELS: Record<string, string> = {
  setup: 'Thiết lập OKR',
  midyear: 'Review giữa năm',
  final: 'Đánh giá cuối năm',
};

export const emptyPhase = (key: string): Phase => ({
  key,
  name: PHASE_LABELS[key] || key,
  start_date: '',
  due_date: '',
  review_start: '',
  review_due: '',
  status: 'scheduled',
});

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const isoToday = (): string => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

export const addDaysIso = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

export const isPhaseOverdue = (phase: Phase): boolean =>
  Boolean(phase.due_date && phase.due_date < isoToday());

/** Nhãn mốc tháng chỉ để hiển thị — luôn suy ra từ start/due, không cho nhập tay. */
export const monthsLabel = (start?: string, due?: string): string => {
  if (!start || !due || start.length < 10 || due.length < 10) return '';
  const sy = Number(start.slice(0, 4));
  const sm = Number(start.slice(5, 7)) - 1;
  const dy = Number(due.slice(0, 4));
  const dm = Number(due.slice(5, 7)) - 1;
  if (Number.isNaN(sy) || Number.isNaN(sm) || Number.isNaN(dy) || Number.isNaN(dm)) return '';
  if (sy !== dy) return `${MONTHS[sm]} ${sy}–${MONTHS[dm]} ${dy}`;
  if (sm === dm) return MONTHS[sm];
  return `${MONTHS[sm]}–${MONTHS[dm]}`;
};

export const PHASE_STATUS_LABEL: Record<string, string> = {
  active: 'Đang mở',
  upcoming: 'Sắp tới',
  locked: 'Đã khoá',
};

export const PHASE_ACTIONS: Record<string, { nv: string; ql: string }> = {
  setup: { nv: 'Nhân viên tạo & cập nhật OKR', ql: 'Quản lý duyệt OKR' },
  midyear: { nv: 'Nhân viên check-in tiến độ giữa năm', ql: 'Quản lý nhận xét giữa năm' },
  final: { nv: 'Nhân viên tự đánh giá cuối năm', ql: 'Quản lý chấm điểm & xếp hộp' },
};

const dayMs = (iso?: string): number => {
  if (!iso || iso.length < 10) return NaN;
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return y && m && d ? Date.UTC(y, m - 1, d) : NaN;
};

/** Ngày đóng thực tế của phase: hết cửa sổ Quản lý nếu có, ngược lại hết cửa sổ nhân viên. */
export const phaseEndDate = (p: Phase): string => p.review_due || p.due_date || '';

/**
 * Vi phạm quy tắc "mỗi thời điểm chỉ 1 giai đoạn OKR được mở".
 * Cùng logic với backend (OKRCycleController#apply) để cảnh báo ngay khi HR sửa ngày.
 */
export const phaseWindowConflicts = (phases: Phase[]): string[] => {
  const out: string[] = [];
  const ordered = ['setup', 'midyear', 'final']
    .map((k) => phases.find((p) => p.key === k))
    .filter(Boolean) as Phase[];
  ordered.forEach((p) => {
    const start = dayMs(p.start_date);
    const due = dayMs(p.due_date);
    const rs = dayMs(p.review_start);
    const rd = dayMs(p.review_due);
    if (!Number.isNaN(start) && !Number.isNaN(due) && start > due) {
      out.push(`${p.name}: ngày bắt đầu phải trước hạn chót nhân viên.`);
    }
    if (!Number.isNaN(rs) && !Number.isNaN(rd) && rs > rd) {
      out.push(`${p.name}: cửa sổ Quản lý phải bắt đầu trước hạn chót.`);
    }
    if (!Number.isNaN(rs) && !Number.isNaN(due) && rs <= due) {
      out.push(`${p.name}: cửa sổ Quản lý phải mở sau khi cửa sổ nhân viên đóng (${p.due_date}).`);
    }
  });
  for (let i = 1; i < ordered.length; i++) {
    const prev = ordered[i - 1];
    const cur = ordered[i];
    const prevEnd = phaseEndDate(prev);
    if (prevEnd && cur.start_date && dayMs(prevEnd) >= dayMs(cur.start_date)) {
      out.push(`${prev.name} kết thúc ${prevEnd} nhưng ${cur.name} bắt đầu ${cur.start_date} — hai giai đoạn bị chồng lấn.`);
    }
  }
  return out;
};

export const CYCLE_STATUS_META: Record<string, { label: string; variant: 'ok' | 'warn' | 'gray' | 'info' }> = {
  active: { label: 'Đang hoạt động', variant: 'ok' },
  draft: { label: 'Bản nháp', variant: 'info' },
  closed: { label: 'Đã chốt & khoá', variant: 'gray' },
};

export const cycleStatusMeta = (status?: string | null) =>
  CYCLE_STATUS_META[(status || '').toLowerCase()] || { label: status || '—', variant: 'gray' as const };

/** Chuẩn hoá ngày về yyyy-MM-dd và đủ 3 phase bắt buộc để form không vỡ. */
export const normalizeCycle = (c: Cycle): Cycle => {
  const keys = ['setup', 'midyear', 'final'];
  const byKey = new Map((c.phases || []).map((p) => [p.key, p]));
  return {
    ...c,
    companyObjectives: c.companyObjectives || [],
    phases: keys.map((k) => {
      const p = byKey.get(k) || emptyPhase(k);
      return {
        ...p,
        start_date: p.start_date ? p.start_date.substring(0, 10) : '',
        due_date: p.due_date ? p.due_date.substring(0, 10) : '',
        review_start: p.review_start ? p.review_start.substring(0, 10) : '',
        review_due: p.review_due ? p.review_due.substring(0, 10) : '',
      };
    }),
  };
};
