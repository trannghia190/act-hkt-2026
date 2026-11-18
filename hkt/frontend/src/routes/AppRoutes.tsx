import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '../components/layout/ProtectedRoute';

// 1. Shared & Platform Admin Pages
import { TodoInboxPage } from '../modules/shared/todo/TodoInboxPage';
import { EmployeeManagementPage } from '../modules/shared/admin/EmployeeManagementPage';
import { OrgTreePage } from '../modules/shared/admin/OrgTreePage';
import { ShiftHolidayPage } from '../modules/shared/admin/ShiftHolidayPage';
import { AuditLogPage } from '../modules/shared/admin/AuditLogPage';
import { DelegationPage } from '../modules/shared/notifications/DelegationPage';
import { FaceEnrollmentPage } from '../modules/auth/FaceEnrollmentPage';

// 2. Attendance & Time Tracking Pages
import { CheckInPage } from '../modules/attendance/checkin/CheckInPage';
import { CalendarPage } from '../modules/attendance/calendar/CalendarPage';
import { TeamSchedulePage } from '../modules/attendance/calendar/TeamSchedulePage';
import { RequestsPage } from '../modules/attendance/requests/RequestsPage';
import { ApprovalsPage } from '../modules/attendance/approvals/ApprovalsPage';
import { LeavesPage } from '../modules/attendance/leaves/LeavesPage';
import { AdminLeaveLedgerPage } from '../modules/attendance/leaves/AdminLeaveLedgerPage';
import { TimesheetPage } from '../modules/attendance/timesheet/TimesheetPage';
import { MyTimesheetPage } from '../modules/attendance/timesheet/MyTimesheetPage';
import { RuleEnginePage } from '../modules/attendance/rules/RuleEnginePage';
import { PolicyDocPage } from '../modules/attendance/rules/PolicyDocPage';

// 3. OKR & Performance Appraisal Pages
import { OKRDashboardPage } from '../modules/okr/dashboard/OKRDashboardPage';
import { MyOKRPage } from '../modules/okr/my-okr/MyOKRPage';
import { OKRAssessmentPage } from '../modules/okr/assessment/OKRAssessmentPage';
import { MidYearReviewPage } from '../modules/okr/assessment/MidYearReviewPage';
import { OKRApprovalsPage } from '../modules/okr/reports/OKRApprovalsPage';
import { TeamBoardPage } from '../modules/okr/reports/TeamBoardPage';
import { CalibrationPage } from '../modules/okr/calibration/CalibrationPage';
import { OKRReportsPage } from '../modules/okr/reports/OKRReportsPage';

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Root redirect to S02 Todo Inbox */}
      <Route path="/" element={<Navigate to="/todo" replace />} />

      {/* 0. Auth & Onboarding */}
      <Route path="/auth/enroll-face" element={<FaceEnrollmentPage />} />

      {/* =========================================
          MODULE 1: SHARED & PLATFORM ADMIN
         ========================================= */}
      <Route path="/todo" element={<TodoInboxPage />} />
      <Route
        path="/admin/employees"
        element={
          <ProtectedRoute allowedRoles={['ADMIN', 'HR_ADMIN']}>
            <EmployeeManagementPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/users"
        element={
          <ProtectedRoute allowedRoles={['ADMIN', 'HR_ADMIN']}>
            <EmployeeManagementPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/org-tree"
        element={
          <ProtectedRoute allowedRoles={['ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE']}>
            <OrgTreePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/departments"
        element={
          <ProtectedRoute allowedRoles={['ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE']}>
            <OrgTreePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/shifts"
        element={
          <ProtectedRoute allowedRoles={['ADMIN', 'HR_ADMIN']}>
            <ShiftHolidayPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/delegations"
        element={
          <ProtectedRoute allowedRoles={['ADMIN', 'HR_ADMIN', 'MANAGER']}>
            <DelegationPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/audit-logs"
        element={
          <ProtectedRoute allowedRoles={['ADMIN', 'HR_ADMIN']}>
            <AuditLogPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/rules"
        element={
          <ProtectedRoute allowedRoles={['ADMIN', 'HR_ADMIN']}>
            <RuleEnginePage />
          </ProtectedRoute>
        }
      />
      <Route path="/admin/policy-doc" element={<PolicyDocPage />} />

      {/* =========================================
          MODULE 2: ATTENDANCE & TIME TRACKING
         ========================================= */}
      <Route path="/attendance/checkin" element={<CheckInPage />} />
      <Route path="/attendance/calendar" element={<CalendarPage />} />
      <Route path="/attendance/my-timesheet" element={<MyTimesheetPage />} />
      <Route
        path="/attendance/team-schedule"
        element={
          <ProtectedRoute allowedRoles={['ADMIN', 'HR_ADMIN', 'MANAGER']}>
            <TeamSchedulePage />
          </ProtectedRoute>
        }
      />
      <Route path="/attendance/requests" element={<RequestsPage />} />
      <Route
        path="/attendance/approvals"
        element={
          <ProtectedRoute allowedRoles={['ADMIN', 'HR_ADMIN', 'MANAGER']}>
            <ApprovalsPage />
          </ProtectedRoute>
        }
      />
      <Route path="/attendance/leaves" element={<LeavesPage />} />
      <Route
        path="/attendance/leave-ledger"
        element={
          <ProtectedRoute allowedRoles={['ADMIN', 'HR_ADMIN']}>
            <AdminLeaveLedgerPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/attendance/timesheet"
        element={
          <ProtectedRoute allowedRoles={['ADMIN', 'HR_ADMIN']}>
            <TimesheetPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/attendance/rules"
        element={
          <ProtectedRoute allowedRoles={['ADMIN', 'HR_ADMIN']}>
            <RuleEnginePage />
          </ProtectedRoute>
        }
      />
      <Route path="/attendance/policy-doc" element={<PolicyDocPage />} />

      {/* =========================================
          MODULE 3: OKR & PERFORMANCE APPRAISAL
         ========================================= */}
      <Route path="/okr/dashboard" element={<OKRDashboardPage />} />
      <Route path="/okr/my-okr" element={<MyOKRPage />} />
      <Route path="/okr/assessment" element={<OKRAssessmentPage />} />
      <Route
        path="/okr/mid-year-review"
        element={
          <ProtectedRoute allowedRoles={['ADMIN', 'HR_ADMIN', 'MANAGER']}>
            <MidYearReviewPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/okr/team-approvals"
        element={
          <ProtectedRoute allowedRoles={['ADMIN', 'HR_ADMIN', 'MANAGER']}>
            <OKRApprovalsPage />
          </ProtectedRoute>
        }
      />
      <Route path="/okr/team-board" element={<TeamBoardPage />} />
      <Route
        path="/okr/calibration"
        element={
          <ProtectedRoute allowedRoles={['ADMIN', 'HR_ADMIN', 'MANAGER']}>
            <CalibrationPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/okr/summary-report"
        element={
          <ProtectedRoute allowedRoles={['ADMIN', 'HR_ADMIN']}>
            <OKRReportsPage />
          </ProtectedRoute>
        }
      />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/todo" replace />} />
    </Routes>
  );
};
