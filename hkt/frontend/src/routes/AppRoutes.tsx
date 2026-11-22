import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '../components/layout/ProtectedRoute';

// 1. Shared & Platform Admin Pages
import { TodoInboxPage } from '../modules/shared/todo/TodoInboxPage';
import { EmployeeManagementPage } from '../modules/shared/admin/EmployeeManagementPage';
import { OrgTreePage } from '../modules/shared/admin/OrgTreePage';
import { ShiftHolidayPage } from '../modules/shared/admin/ShiftHolidayPage';
import { AuditLogPage } from '../modules/shared/admin/AuditLogPage';
import { FaceEnrollmentPage } from '../modules/auth/FaceEnrollmentPage';

// 2. Attendance & Time Tracking Pages
import { CheckInPage } from '../modules/attendance/checkin/CheckInPage';
import { CalendarPage } from '../modules/attendance/calendar/CalendarPage';
import { TeamSchedulePage } from '../modules/attendance/calendar/TeamSchedulePage';
import { RequestsPage } from '../modules/attendance/requests/RequestsPage';
import { RequestDetailPage } from '../modules/attendance/requests/RequestDetailPage';
import { ApprovalsPage } from '../modules/attendance/approvals/ApprovalsPage';
import { LeavesPage } from '../modules/attendance/leaves/LeavesPage';
import { AdminLeaveLedgerPage } from '../modules/attendance/leaves/AdminLeaveLedgerPage';
import { TimesheetPage } from '../modules/attendance/timesheet/TimesheetPage';
import { MyTimesheetPage } from '../modules/attendance/timesheet/MyTimesheetPage';
import { RuleEnginePage } from '../modules/attendance/rules/RuleEnginePage';
import { PolicyDocPage } from '../modules/attendance/rules/PolicyDocPage';
import { MyDevicesPage } from '../modules/attendance/devices/MyDevicesPage';
import { AddDevicePage } from '../modules/attendance/devices/AddDevicePage';
import { AdminDevicesPage } from '../modules/attendance/devices/AdminDevicesPage';
import { PasskeySettingsPage } from '../modules/account/PasskeySettingsPage';
import { LeaveTypesPage } from '../modules/attendance/leaves/LeaveTypesPage';
import { LeaveTablePage } from '../modules/attendance/leaves/LeaveTablePage';
import { DisputesPage } from '../modules/attendance/timesheet/DisputesPage';
import { DisputeDetailPage } from '../modules/attendance/timesheet/DisputeDetailPage';
import { NotificationPrefsPage } from '../modules/shared/notifications/NotificationPrefsPage';
import { MobileNotificationsPage } from '../modules/shared/notifications/MobileNotificationsPage';
import { OKRCyclesPage } from '../modules/okr/cycles/OKRCyclesPage';
import { TeamReviewPage } from '../modules/okr/reports/TeamReviewPage';

// 3. OKR & Performance Appraisal Pages
import { OKRDashboardPage } from '../modules/okr/dashboard/OKRDashboardPage';
import { MyOKRPage } from '../modules/okr/my-okr/MyOKRPage';
import { OKRAssessmentPage } from '../modules/okr/assessment/OKRAssessmentPage';
import { MidYearReviewPage } from '../modules/okr/assessment/MidYearReviewPage';
import { OKRApprovalsPage } from '../modules/okr/reports/OKRApprovalsPage';
import { OKRReportsPage } from '../modules/okr/reports/OKRReportsPage';

const RootRedirect: React.FC = () => {
  const isMobile = typeof window !== 'undefined' && (window.innerWidth < 768 || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent));
  return <Navigate to={isMobile ? "/attendance/checkin" : "/todo"} replace />;
};

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Root redirect: Mobile opens check-in directly without menu (B1 #1); Desktop opens Todo */}
      <Route path="/" element={<RootRedirect />} />

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
        path="/admin/teams"
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
      <Route path="/attendance/check-in" element={<Navigate to="/attendance/checkin" replace />} />
      <Route path="/attendance/enroll" element={<Navigate to="/auth/enroll-face" replace />} />
      <Route path="/attendance/calendar" element={<CalendarPage />} />
      <Route path="/attendance/my-timesheet" element={<MyTimesheetPage />} />
      <Route path="/attendance/team-schedule" element={<TeamSchedulePage />} />
      <Route path="/attendance/requests" element={<RequestsPage />} />
      <Route path="/attendance/requests/:id" element={<RequestDetailPage />} />
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
      <Route path="/attendance/devices" element={<MyDevicesPage />} />
      <Route path="/attendance/devices/add" element={<AddDevicePage />} />
      <Route path="/account/passkey" element={<PasskeySettingsPage />} />
      <Route path="/attendance/disputes" element={<ProtectedRoute allowedRoles={['ADMIN', 'HR_ADMIN']}><DisputesPage /></ProtectedRoute>} />
      <Route path="/attendance/disputes/:id" element={<ProtectedRoute allowedRoles={['ADMIN', 'HR_ADMIN']}><DisputeDetailPage /></ProtectedRoute>} />
      <Route path="/attendance/leave-table" element={<ProtectedRoute allowedRoles={['ADMIN', 'HR_ADMIN']}><LeaveTablePage /></ProtectedRoute>} />
      <Route path="/admin/devices" element={<ProtectedRoute allowedRoles={['ADMIN', 'HR_ADMIN']}><AdminDevicesPage /></ProtectedRoute>} />
      <Route path="/admin/leave-types" element={<ProtectedRoute allowedRoles={['ADMIN', 'HR_ADMIN']}><LeaveTypesPage /></ProtectedRoute>} />
      <Route path="/settings/notifications" element={<NotificationPrefsPage />} />
      <Route path="/notifications" element={<MobileNotificationsPage />} />

      {/* =========================================
          MODULE 3: OKR & PERFORMANCE APPRAISAL
         ========================================= */}
      <Route path="/okr/dashboard" element={<OKRDashboardPage />} />
      <Route path="/okr/my-okr" element={<MyOKRPage />} />
      <Route path="/okr/cycles" element={<ProtectedRoute allowedRoles={['ADMIN', 'HR_ADMIN']}><OKRCyclesPage /></ProtectedRoute>} />
      <Route path="/okr/team-review" element={<ProtectedRoute allowedRoles={['ADMIN', 'HR_ADMIN', 'MANAGER']}><TeamReviewPage /></ProtectedRoute>} />
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
