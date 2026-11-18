import { AttendanceRequestItem } from '../../../types/attendance.types';

export type { AttendanceRequestItem };

const STORAGE_KEY = 'pulse_attendance_requests_store';

export const INITIAL_REQUESTS: AttendanceRequestItem[] = [
  {
    id: 'REQ-2026-0042',
    requesterCode: '136ACT',
    requesterName: 'Vũ Văn Luận',
    requesterEmail: 'luan.vu@act-corp.internal',
    team: 'Sirius Core',
    type: 'LEAVE',
    typeName: 'Nghỉ Phép Ốm Hưởng BHXH',
    startDate: '2026-11-18',
    endDate: '2026-11-19',
    durationText: '1.5 ngày',
    reason: 'Sốt cao, đi khám bệnh viện Hồng Ngọc',
    status: 'PENDING',
    approver: 'Nguyễn Thanh Tùng (Manager)',
    createdAt: '18/11/2026 07:45'
  },
  {
    id: 'REQ-2026-0040',
    requesterCode: '05ACT',
    requesterName: 'Nguyễn Thanh Tùng',
    requesterEmail: 'tung.nguyen@act-corp.internal',
    team: 'Sirius Core',
    type: 'WFH',
    typeName: 'Làm Việc Từ Xa (WFH)',
    startDate: '2026-11-20',
    endDate: '2026-11-20',
    durationText: '1.0 ngày',
    reason: 'Bảo trì đường dây internet chung cư ban ngày',
    status: 'PENDING',
    approver: 'Nguyễn Thị Thu Hà (HR Lead)',
    createdAt: '17/11/2026 15:30'
  },
  {
    id: 'REQ-2026-0039',
    requesterCode: 'ACT0089',
    requesterName: 'Trần Thị Thu Thảo',
    requesterEmail: 'thao.tran@act-corp.internal',
    team: 'Mobile App',
    type: 'MISSED_PUNCH',
    typeName: 'Giải Trình Quên Check-In',
    startDate: '2026-11-17',
    endDate: '2026-11-17',
    durationText: 'Ca Sáng (08:30)',
    reason: 'Quên chấm công ca sáng, check-out đúng giờ 18:15',
    status: 'PENDING',
    approver: 'Nguyễn Thị Thu Hà (HR Lead - Luồng Ngoại Lệ CA/Mobile)',
    createdAt: '17/11/2026 18:05'
  },
  {
    id: 'REQ-2026-0035',
    requesterCode: '136ACT',
    requesterName: 'Vũ Văn Luận',
    requesterEmail: 'luan.vu@act-corp.internal',
    team: 'Sirius Core',
    type: 'WFH',
    typeName: 'Làm Việc Từ Xa (WFH)',
    startDate: '2026-11-11',
    endDate: '2026-11-11',
    durationText: '1.0 ngày',
    reason: 'Bảo trì đường dây internet chung cư ban ngày',
    status: 'APPROVED',
    approver: 'Nguyễn Thanh Tùng (Manager)',
    approverComment: 'Đồng ý duyệt, chú ý online Slack đầy đủ',
    createdAt: '10/11/2026 14:10'
  },
  {
    id: 'REQ-2026-0021',
    requesterCode: '136ACT',
    requesterName: 'Vũ Văn Luận',
    requesterEmail: 'luan.vu@act-corp.internal',
    team: 'Sirius Core',
    type: 'OT',
    typeName: 'Đăng Ký Làm Thêm Giờ (OT)',
    startDate: '2026-11-07',
    endDate: '2026-11-07',
    durationText: '4.0 giờ (Thứ 7)',
    reason: 'Deploy phiên bản thử nghiệm ActPulse lên Staging',
    status: 'APPROVED',
    approver: 'Nguyễn Thanh Tùng (Manager)',
    approverComment: 'Đã hoàn thành deploy xuất sắc',
    createdAt: '05/11/2026 16:30'
  }
];

export function getRequests(): AttendanceRequestItem[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) return JSON.parse(data);
  } catch (e) {
    console.error('Failed to get requests', e);
  }
  return INITIAL_REQUESTS;
}

export function saveRequests(requests: AttendanceRequestItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
  } catch (e) {
    console.error('Failed to save requests', e);
  }
}
