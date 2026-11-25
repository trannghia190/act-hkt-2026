export interface PersonalInfo {
  fullName?: string;
  employeeCode?: string;
  jobTitle?: string | null;
  department?: string | null;
  managerName?: string | null;
  joinedDate?: string | null;
  seniority?: string | null;
  newJoiner?: boolean;
  monthsWorked?: number | null;
  seniorityNote?: string | null;
  cycleYear?: number;
}

// 4 mục của mỗi box nhóm (Box 2 Business / Box 3 People) theo form HR
export const GROUP_ITEMS: { suffix: 'Results' | 'Adjustments' | 'Difficulties' | 'Lessons'; label: string; placeholder: string; required?: boolean }[] = [
  { suffix: 'Results', label: 'Kết quả', placeholder: 'Kết quả đạt được so với mục tiêu…', required: true },
  { suffix: 'Adjustments', label: 'Điều chỉnh', placeholder: 'Mục tiêu / cách làm đã điều chỉnh trong năm…' },
  { suffix: 'Difficulties', label: 'Khó khăn', placeholder: 'Khó khăn, trở ngại gặp phải…' },
  { suffix: 'Lessons', label: 'Bài học', placeholder: 'Bài học rút ra…' },
];

export interface OkrItemLite {
  id: string;
  title: string;
  detail?: string | null;
  progress: number;
}

export interface Form4Box {
  employeeCode: string;
  employeeName: string;
  jobTitle?: string;
  year: number;
  reviewId?: string | null;
  reviewStatus?: string | null;
  status: string;
  box1?: PersonalInfo;
  box2?: { progress?: number | null; items?: OkrItemLite[] };
  box3?: { progress?: number | null; items?: OkrItemLite[] };
  box2Items?: OkrItemLite[];
  box3Items?: OkrItemLite[];
  box2Results?: string | null;
  box2Adjustments?: string | null;
  box2Difficulties?: string | null;
  box2Lessons?: string | null;
  box2BusinessScore?: number | null;
  box3Results?: string | null;
  box3Adjustments?: string | null;
  box3Difficulties?: string | null;
  box3Lessons?: string | null;
  box3PeopleScore?: number | null;
  box4Direction?: string | null;
  box4SelfProposal?: string | null;
  box4ImprovementArea?: string | null;
  managerBusinessScore?: number | null;
  managerPeopleScore?: number | null;
  managerComment?: string | null;
  selfAverageScore?: number | null;
  managerAverageScore?: number | null;
  canManage?: boolean;
  isSelf?: boolean;
  canSelfEdit?: boolean;
  scaleMin?: number;
  scaleMax?: number;
  selfAssessPhase?: 'FINAL' | null;
  selfLockReason?: string | null;
  canManagerAssess?: boolean;
  managerLockReason?: string | null;
  finalUpdateOverride?: boolean;
  finalManagerWindowOpen?: boolean;
}

export interface TeamRow {
  reviewId: string;
  employeeCode: string;
  fullName: string;
  team?: string;
}

export const emptyForm: Form4Box = {
  employeeCode: '',
  employeeName: '',
  year: new Date().getFullYear(),
  status: 'CHUA_TU_DANH_GIA',
};

export const statusLabel = (status: string) => {
  if (status === 'DA_HOAN_TAT') return 'Đã chấm xong';
  if (status === 'CHO_QL_CHAM') return 'Chờ QL chấm';
  if (status === 'CHUA_CO_OKR') return 'Chưa có OKR được duyệt';
  return 'Chưa tự đánh giá';
};
