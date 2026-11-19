export type KRStatus = 'ON_TRACK' | 'BEHIND' | 'AT_RISK';
export type OKRQuarter = 'Q1' | 'Q2' | 'Q3' | 'Q4';

export interface KeyResult {
  id: string;
  title: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  status: KRStatus;
}

export interface Objective {
  id: string;
  title: string;
  quarter: OKRQuarter;
  keyResults: KeyResult[];
}

export interface EmployeeRating {
  id: string;
  code: string;
  fullName: string;
  team: string;
  managerScore: number;
}

export interface HRSummaryRecord {
  code: string;
  fullName: string;
  team: string;
  jobTitle: string;
  avgOkrProgress: number;
  assessmentScore: number;
  bonusFactor: number;
  hrStatus: 'COMPLETED' | 'IN_REVIEW';
}
