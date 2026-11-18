export type KRStatus = 'ON_TRACK' | 'BEHIND' | 'AT_RISK';
export type OKRQuarter = 'Q1' | 'Q2' | 'Q3' | 'Q4';
export type PerformanceGrade = 'A+' | 'A' | 'B' | 'C' | 'D';

export interface KeyResult {
  id: string;
  title: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  weight: number; // percentage
  confidence: number; // 1-10
  status: KRStatus;
}

export interface Objective {
  id: string;
  title: string;
  quarter: OKRQuarter;
  weight: number;
  keyResults: KeyResult[];
}

export interface EmployeeRating {
  id: string;
  code: string;
  fullName: string;
  team: string;
  managerScore: number;
  calibratedGrade: PerformanceGrade;
}

export interface HRSummaryRecord {
  code: string;
  fullName: string;
  department: string;
  jobTitle: string;
  avgOkrProgress: number; // percentage
  assessmentScore: number; // 1-5
  performanceGrade: PerformanceGrade;
  bonusFactor: number;
  hrStatus: 'COMPLETED' | 'IN_REVIEW';
}
