export type AttendanceStatus =
  | 'ON_TIME'
  | 'LATE'
  | 'LEAVE'
  | 'WFH'
  | 'ABSENT'
  | 'WEEKEND'
  | 'FUTURE';

export interface DayAttendance {
  day: number;
  weekday: string;
  isWeekend: boolean;
  checkIn?: string;
  checkOut?: string;
  status: AttendanceStatus;
  statusText: string;
  hoursWorked?: number;
}

export interface ShiftConfig {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  breakStart: string;
  breakEnd: string;
  standardWorkHours: number;
  paidHours: number;
  gracePeriodMinutes: number;
  targetGroup: string;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface HolidayConfig {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  type: 'PUBLIC_HOLIDAY' | 'COMPENSATION_DAY';
  isPaid: boolean;
}

export interface TimesheetRow {
  id: string;
  code: string;
  fullName: string;
  department: string;
  team: string;
  standardDays: number;
  actualWorkDays: number;
  paidLeaveDays: number;
  holidayDays: number;
  wfhDays: number;
  lateCount: number;
  penaltyLatePercent: number;
  otWeekdayHours: number;
  otWeekendHours: number;
  totalPayrollDays: number;
  status: 'OPEN' | 'HR_LOCKED';
}

export interface AttendanceRequestItem {
  id: string;
  requesterCode: string;
  requesterName: string;
  requesterEmail: string;
  team: string;
  type: 'LEAVE' | 'WFH' | 'LATE_EARLY' | 'ADJUST';
  typeName: string;
  startDate: string;
  endDate: string;
  durationText: string;
  reason: string;
  status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN';
  approver: string;
  approverComment?: string;
  attachmentCount?: number;
  leaveType?: string;
  payload?: string;
  minutes?: number;
  createdAt: string;
}

export interface RuleItem {
  code: string;
  name: string;
  category: 'CHECKIN' | 'LEAVE' | 'WFH' | 'OVERTIME' | 'PENALTY';
  currentVersion: string;
  parameters: Record<string, any>;
  effectiveDate: string;
  description: string;
  status: 'ACTIVE' | 'DRAFT';
}
