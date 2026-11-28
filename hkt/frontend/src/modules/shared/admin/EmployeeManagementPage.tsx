import React, { useState, useEffect } from 'react';
import { Panel } from '../../../components/common/Panel';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { Modal } from '../../../components/common/Modal';
import { GitPullRequest, UserCheck, AlertTriangle, ArrowRight, ShieldAlert, CheckCircle2, UserPlus, Mail, Key, Copy, Check, Eye, EyeOff, Edit2, User, Phone, Calendar, Shield, Building2, Users, UserX, X, RefreshCw, FileSpreadsheet, UploadCloud, Download, AlertCircle, FileCheck, CheckCircle } from 'lucide-react';

interface Employee {
  id: string;
  employeeCode: string;
  fullName: string;
  email: string;
  phone?: string;
  department?: string;
  team: string;
  teamId?: string;
  positionName?: string;
  role: 'ADMIN' | 'HR_ADMIN' | 'MANAGER' | 'EMPLOYEE';
  status: 'ACTIVE' | 'PENDING_ACTIVATION' | 'LOCKED' | 'INACTIVE';
  managerId?: string;
  managerCode?: string;
  managerName?: string;
  approvalChain?: string;
  hireDate?: string;
  joinDate?: string;
  seniorityYears?: number;
  seniorityMonths?: number;
  seniorityDays?: string;
  totalAnnualDays?: string;
  faceEnrolled: boolean;
  mustChangePassword?: boolean;
}

/** Ngày hôm nay theo giờ địa phương, dạng yyyy-MM-dd (không lệch múi giờ như toISOString). */
const todayISO = (): string => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

/** "2026-11-26" → "26/11/2026" để hiển thị cho HR. */
const formatDMY = (iso?: string): string => {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}/${m}/${y}` : iso;
};

interface OnboardPreview {
  joinedDate: string;
  seniorityYears: number;
  seniorityMonths: number;
  seniorityIntervals: number;
  seniorityDays: number;
  baseAccruedDays: number;
  totalAnnualDays: number;
  nextSeniorityDate: string;
  isFuture: boolean;
}

/**
 * Backend gửi chuỗi cấp trên kèm marker "⚠ " khi nhân viên chưa có quản lý.
 * Tách marker ra để render icon thay vì emoji (quy tắc: không dùng emoji làm icon).
 */
const splitApprovalChain = (raw?: string | null): { text: string; missing: boolean } => {
  const value = (raw || '').replace(/^\u26a0\s*/, '').trim();
  return { text: value, missing: !raw || value.startsWith('Chưa có') };
};

export const EmployeeManagementPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTeam, setFilterTeam] = useState('ALL');
  const [filterRole, setFilterRole] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  // Danh sách nhóm thật từ API — dropdown chọn nhóm không hard-code danh sách.
  const [teams, setTeams] = useState<{ id: string; name: string; parentName?: string; memberCount?: number }[]>([]);
  // Lỗi khi thêm nhân viên (trùng mã/email…) — hiện ngay trong modal.
  const [addError, setAddError] = useState<string | null>(null);
  // Lý do đánh dấu nghỉ việc (bắt buộc có lý do như các thao tác nhân sự khác).
  const [resignReason, setResignReason] = useState('');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isCreatingEmp, setIsCreatingEmp] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isChangeManagerModalOpen, setIsChangeManagerModalOpen] = useState(false);
  const [isChangeTeamModalOpen, setIsChangeTeamModalOpen] = useState(false);

  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);

  const generateRandomPassword = (): string => {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghjkmnpqrstuvwxyz';
    const digits = '23456789';
    const special = '@#$!%*';
    const all = upper + lower + digits + special;
    let res = 'Act@';
    res += upper[Math.floor(Math.random() * upper.length)];
    res += lower[Math.floor(Math.random() * lower.length)];
    res += digits[Math.floor(Math.random() * digits.length)];
    res += special[Math.floor(Math.random() * special.length)];
    for (let i = 0; i < 4; i++) {
      res += all[Math.floor(Math.random() * all.length)];
    }
    return res;
  };

  // Form states
  const [newEmp, setNewEmp] = useState({
    code: 'ACT' + Math.floor(1000 + Math.random() * 9000),
    fullName: '',
    email: '',
    team: '',   // sẽ điền bằng nhóm đầu tiên nạp từ API
    positionName: 'Kỹ sư Phần mềm',
    role: 'EMPLOYEE' as const,
    password: generateRandomPassword(),
    joinedDate: todayISO(),
  });
  // Xem trước thâm niên & quỹ phép theo ngày onboard (tính ở backend, cùng rule với lúc tạo).
  const [onboardPreview, setOnboardPreview] = useState<OnboardPreview | null>(null);

  interface CreatedResult {
    fullName: string;
    employeeCode: string;
    email: string;
    team: string;
    role: string;
    defaultPassword: string;
    emailSent?: boolean;
    emailStatusMessage?: string;
  }
  const [createdAccount, setCreatedAccount] = useState<CreatedResult | null>(null);
  const [copiedAccount, setCopiedAccount] = useState(false);
  const [showNewEmpPassword, setShowNewEmpPassword] = useState(false);
  const [systemDomainHost, setSystemDomainHost] = useState<string>(window.location.origin);

  useEffect(() => {
    fetch('/api/v1/admin/system-config/public-domain', { headers: getAuthHeaders() })
      .then(r => r.json())
      .then(data => {
        if (data?.data?.domainHost) {
          setSystemDomainHost(data.data.domainHost);
        }
      })
      .catch(() => {});
  }, []);

  const [viewDetailEmp, setViewDetailEmp] = useState<Employee | null>(null);
  const [editForm, setEditForm] = useState<Employee | null>(null);
  const [editReason, setEditReason] = useState('Cập nhật hồ sơ nhân sự');

  // Excel Import States & Handlers
  interface ImportErrorDetail {
    rowNumber: number;
    employeeCode?: string;
    fullName?: string;
    email?: string;
    errorMessage: string;
  }

  interface ImportedEmployeeSummary {
    employeeCode: string;
    fullName: string;
    email: string;
    phone?: string;
    departmentName?: string;
    teamName: string;
    positionName: string;
    role: string;
    managerCode?: string;
    managerName?: string;
    joinedDate: string;
    defaultPassword: string;
    emailSent: boolean;
    emailStatusMessage?: string;
  }

  interface ImportResult {
    totalRows: number;
    successCount: number;
    errorCount: number;
    successList: ImportedEmployeeSummary[];
    errorList: ImportErrorDetail[];
  }

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [sendActivationEmail, setSendActivationEmail] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [copiedImportCredentials, setCopiedImportCredentials] = useState(false);

  const getAuthToken = (): string => {
    try {
      const u = JSON.parse(localStorage.getItem('pulse_auth_user') || '{}');
      return u?.accessToken ? `Bearer ${u.accessToken}` : '';
    } catch {
      return '';
    }
  };

  const handleDownloadTemplate = async () => {
    setIsDownloadingTemplate(true);
    setImportError(null);
    try {
      const authHeaders: Record<string, string> = {};
      const token = getAuthToken();
      if (token) authHeaders['Authorization'] = token;

      const res = await fetch('/api/v1/admin/users/import-template', { headers: authHeaders });
      if (!res.ok) throw new Error('Không thể tải file mẫu từ hệ thống');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'AscendTech_Mau_Import_Nhan_Vien.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setImportError(err.message || 'Lỗi khi tải file mẫu');
    } finally {
      setIsDownloadingTemplate(false);
    }
  };

  const handleImportExcel = async () => {
    if (!importFile) {
      setImportError('Vui lòng chọn file Excel để import');
      return;
    }
    setIsImporting(true);
    setImportError(null);
    try {
      const formData = new FormData();
      formData.append('file', importFile);

      const token = getAuthToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = token;

      const res = await fetch(`/api/v1/admin/users/import-excel?sendActivationEmail=${sendActivationEmail}`, {
        method: 'POST',
        headers,
        body: formData,
      });
      const json = await res.json();
      if (!res.ok || json.code !== 200) {
        throw new Error(json.message || 'Lỗi xử lý file Excel');
      }
      setImportResult(json.data);
      if (json.data?.successCount > 0) {
        fetchEmployees();
        fetchTeams();
        fetchActiveUsers();
      }
    } catch (err: any) {
      setImportError(err.message || 'Lỗi khi import file Excel');
    } finally {
      setIsImporting(false);
    }
  };

  const handleCopyAllImportCredentials = () => {
    if (!importResult || importResult.successList.length === 0) return;
    const baseUrl = systemDomainHost || window.location.origin;
    let text = `=== DANH SÁCH TÀI KHOẢN ASCEND TECH KHỞI TẠO TỪ EXCEL (${importResult.successList.length} nhân viên) ===\n\n`;
    importResult.successList.forEach((emp, i) => {
      text += `[${i + 1}] ${emp.fullName} - Mã NV: ${emp.employeeCode}\n`;
      text += `  • Email: ${emp.email}${emp.phone ? ` | SĐT: ${emp.phone}` : ''}\n`;
      text += `  • Phòng ban: ${emp.departmentName || emp.teamName || '—'} | Nhóm: ${emp.teamName || '—'}\n`;
      text += `  • Chức danh: ${emp.positionName} | Quản lý: ${emp.managerName || emp.managerCode || '—'} | Vai trò: ${emp.role}\n`;
      text += `  • Mật khẩu khởi tạo: ${emp.defaultPassword}\n`;
      text += `  • Gửi mail thông báo: ${emp.emailSent ? 'Đã gửi qua Gmail' : (emp.emailStatusMessage || 'Chưa gửi')}\n\n`;
    });
    text += `• Đường dẫn đăng nhập: ${baseUrl}/login\n`;
    text += `• Yêu cầu: Bắt buộc đổi mật khẩu ở lần đăng nhập đầu tiên\n`;
    text += `==========================================================`;

    navigator.clipboard.writeText(text);
    setCopiedImportCredentials(true);
    setTimeout(() => setCopiedImportCredentials(false), 3000);
  };

  const handleExportImportResultCsv = () => {
    if (!importResult || importResult.successList.length === 0) return;
    const rows = [
      ['Mã NV', 'Họ và tên', 'Số điện thoại', 'Email', 'Phòng ban', 'Nhóm', 'Chức danh', 'Quản lý trực tiếp', 'Ngày vào làm', 'Vai trò', 'Mật khẩu khởi tạo', 'Trạng thái gửi mail'],
      ...importResult.successList.map(e => [
        e.employeeCode,
        `"${(e.fullName || '').replace(/"/g, '""')}"`,
        e.phone || '',
        e.email,
        `"${(e.departmentName || e.teamName || '').replace(/"/g, '""')}"`,
        `"${(e.teamName || '').replace(/"/g, '""')}"`,
        `"${(e.positionName || '').replace(/"/g, '""')}"`,
        `"${(e.managerName || e.managerCode || '').replace(/"/g, '""')}"`,
        e.joinedDate,
        e.role,
        e.defaultPassword,
        e.emailSent ? 'Đã gửi Gmail' : (e.emailStatusMessage || 'Chưa gửi')
      ])
    ];
    const csvContent = '\uFEFF' + rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AscendTech_Ket_Qua_Import_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  const getAuthHeaders = (): Record<string, string> => {
    try {
      const u = JSON.parse(localStorage.getItem('pulse_auth_user') || '{}');
      return u?.accessToken ? { Authorization: `Bearer ${u.accessToken}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
    } catch {
      return { 'Content-Type': 'application/json' };
    }
  };

  // Change Manager Form (Bắt buộc có lý do theo nghiệp vụ S40 / docs/01 §2)
  const [newManagerId, setNewManagerId] = useState('');
  const [changeManagerReason, setChangeManagerReason] = useState('');
  const [managerError, setManagerError] = useState<string | null>(null);

  // Change Team Form
  const [newTeamName, setNewTeamName] = useState('');
  const [changeTeamReason, setChangeTeamReason] = useState('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 5000);
  };

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append('keyword', searchTerm);
      if (filterTeam && filterTeam !== 'ALL') params.append('team', filterTeam);
      if (filterRole && filterRole !== 'ALL') params.append('role', filterRole);
      if (filterStatus && filterStatus !== 'ALL') params.append('status', filterStatus);

      const res = await fetch(`/api/v1/admin/users?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data?.content) {
          setEmployees(json.data.content);
        }
      }
    } catch (err) {
      console.warn('Failed to load employees from API, keeping state', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, [searchTerm, filterTeam, filterRole, filterStatus]);

  // Nạp danh sách nhóm thật để các dropdown "Nhóm Làm Việc" luôn khớp với DB.
  const fetchTeams = async () => {
    try {
      const res = await fetch('/api/v1/admin/teams', { headers: getAuthHeaders() });
      if (!res.ok) return;
      const json = await res.json();
      if (Array.isArray(json?.data)) {
        setTeams(json.data.map((t: any) => ({
          id: String(t.id), name: String(t.name),
          parentName: t.parentName ?? undefined, memberCount: Number(t.memberCount ?? 0),
        })));
      }
    } catch (err) {
      console.warn('Failed to load teams from API', err);
    }
  };
  useEffect(() => { fetchTeams(); }, []);

  // Xem trước thâm niên/phép khi HR đổi ngày onboard hoặc vai trò — debounce nhẹ để
  // không gọi API theo từng phím bấm của ô ngày.
  useEffect(() => {
    if (!isAddModalOpen || !newEmp.joinedDate) {
      setOnboardPreview(null);
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ joinedDate: newEmp.joinedDate, role: newEmp.role });
      fetch(`/api/v1/admin/users/onboard-preview?${params.toString()}`, {
        headers: getAuthHeaders(), signal: ctrl.signal,
      })
        .then((r) => r.json())
        .then((j) => { if (j?.success && j.data) setOnboardPreview(j.data); })
        .catch(() => { /* giữ preview cũ nếu lỗi mạng */ });
    }, 250);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [isAddModalOpen, newEmp.joinedDate, newEmp.role]);

  // Nhóm đầu tiên trong DB làm giá trị mặc định cho form (không hard-code tên nhóm).
  useEffect(() => {
    if (teams.length === 0) return;
    setNewEmp((e) => (e.team ? e : { ...e, team: teams[0].name }));
    setNewTeamName((n) => (n && teams.some((t) => t.name === n) ? n : teams[0].name));
  }, [teams]);

  const [activeUsers, setActiveUsers] = useState<any[]>([]);

  const fetchActiveUsers = async () => {
    try {
      const res = await fetch('/api/v1/admin/users/active', { headers: getAuthHeaders() });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setActiveUsers(json.data);
        }
      }
    } catch (e) {
      console.warn('Cannot load active users', e);
    }
  };

  useEffect(() => {
    fetchActiveUsers();
  }, []);

  // Available managers for dropdown selection (Chỉ lấy quản lý đang hoạt động ACTIVE)
  const availableManagers = (activeUsers.length > 0 ? activeUsers : employees).filter(
    (e) => (e.status === 'ACTIVE' || !e.status) && (e.role === 'MANAGER' || e.role === 'ADMIN' || e.role === 'HR_ADMIN') && (!selectedEmp || e.id !== selectedEmp.id)
  );

  // Warning metrics
  const noTeamCount = employees.filter((e) => !e.team || e.team === 'Chưa có nhóm').length;
  const noManagerCount = employees.filter((e) => !e.managerId && e.role !== 'ADMIN').length;

  // Handle Add Employee (Tự gán nhóm và ca mặc định nếu để trống & Gửi email kích hoạt)
  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    setIsCreatingEmp(true);
    const pass = newEmp.password || generateRandomPassword();
    try {
      const res = await fetch('/api/v1/admin/users', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          employeeCode: newEmp.code,
          fullName: newEmp.fullName,
          email: newEmp.email,
          team: newEmp.team,
          positionName: newEmp.positionName,
          role: newEmp.role,
          password: pass,
          joinedDate: newEmp.joinedDate,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        const empData = json.data;
        setIsAddModalOpen(false);
        setCreatedAccount({
          fullName: empData?.fullName || newEmp.fullName,
          employeeCode: empData?.employeeCode || newEmp.code,
          email: empData?.email || newEmp.email,
          team: empData?.team || newEmp.team,
          role: empData?.role || newEmp.role,
          defaultPassword: empData?.defaultPassword || pass,
          emailSent: empData?.emailSent,
          emailStatusMessage: empData?.emailStatusMessage || json.message,
        });
        showToast(`Đã thêm nhân viên ${empData?.fullName || newEmp.fullName} thành công! Mật khẩu mặc định: ${empData?.defaultPassword || pass}`);
        // Reset code for next entry (giữ nhóm đang chọn, không hard-code tên nhóm)
        setNewEmp({
          code: 'ACT' + Math.floor(1000 + Math.random() * 9000),
          fullName: '',
          email: '',
          team: newEmp.team,
          positionName: 'Kỹ sư Phần mềm',
          role: 'EMPLOYEE' as const,
          password: generateRandomPassword(),
          joinedDate: todayISO(),
        });
        fetchEmployees();
      } else {
        // Trùng mã/email → hiện lỗi ngay trong modal, không tạo và không ghi đè nhân viên cũ.
        const msg = json.message || 'Không thể tạo nhân viên';
        setAddError(msg);
        showToast(`Lỗi: ${msg}`);
      }
    } catch (err) {
      setAddError('Không kết nối được tới máy chủ — nhân viên chưa được tạo.');
      setIsAddModalOpen(false);
    } finally {
      setIsCreatingEmp(false);
    }
  };

  // Open Change Manager Modal
  const handleOpenChangeManager = (emp: Employee) => {
    setSelectedEmp(emp);
    setNewManagerId('');
    setChangeManagerReason('');
    setManagerError(null);
    setIsChangeManagerModalOpen(true);
  };

  // Submit Change Manager (Bắt buộc lý do + chuyển đơn đang chờ)
  const handleSubmitChangeManager = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmp) return;

    if (!changeManagerReason.trim()) {
      setManagerError('Lý do đổi quản lý là bắt buộc theo quy định kiểm toán.');
      return;
    }
    if (!newManagerId) {
      setManagerError('Vui lòng chọn quản lý trực tiếp mới.');
      return;
    }

    try {
      const res = await fetch(`/api/v1/admin/users/${selectedEmp.id}/change-manager`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newManagerId,
          reason: changeManagerReason.trim(),
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        const transferred = json.data?.transferredRequestsCount ?? 0;
        showToast(
          `Đã chuyển quản lý của ${selectedEmp.fullName} sang ${json.data.newManagerName}! Đã bàn giao ${transferred} đơn chờ duyệt sang sếp mới không làm mất đơn.`
        );
        setIsChangeManagerModalOpen(false);
        fetchEmployees();
      } else {
        setManagerError(json.message || 'Đổi quản lý thất bại');
      }
    } catch (err) {
      setManagerError('Lỗi kết nối tới hệ thống máy chủ');
    }
  };

  // Open Change Team Modal
  const handleOpenChangeTeam = (emp: Employee) => {
    setSelectedEmp(emp);
    setNewTeamName(emp.team && emp.team !== 'Chưa có nhóm'
      ? emp.team
      : (teams[0]?.name ?? ''));
    setChangeTeamReason('');
    setIsChangeTeamModalOpen(true);
  };

  const handleSubmitChangeTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmp) return;

    try {
      const res = await fetch(`/api/v1/admin/users/${selectedEmp.id}/change-team`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamName: newTeamName,
          reason: changeTeamReason,
        }),
      });

      if (res.ok) {
        showToast(`Đã điều chuyển nhân viên ${selectedEmp.fullName} sang nhóm ${newTeamName} thành công.`);
        setIsChangeTeamModalOpen(false);
        fetchEmployees();
      }
    } catch (err) {
      showToast('Đã lưu thông tin chuyển nhóm!');
      setIsChangeTeamModalOpen(false);
    }
  };

  // Đánh dấu nhân viên đã nghỉ việc — rời khỏi tổ chức, giữ lịch sử chấm công.
  const handleResign = async (emp: Employee) => {
    const reason = window.prompt(
      `Đánh dấu ${emp.fullName} (${emp.employeeCode}) đã nghỉ việc?\n\n`
      + `• Rời khỏi nhóm & quản lý trực tiếp, giữ nguyên lịch sử chấm công.\n`
      + `• Mã nhân viên vẫn giữ — không nhân viên mới nào được dùng lại mã này.\n`
      + `• Email được giải phóng: có thể cấp cho nhân viên mới.\n\n`
      + `Lý do nghỉ việc (bắt buộc):`,
      'Nghỉ việc');
    if (reason === null) return;
    if (!reason.trim()) { setAddError('Cần nhập lý do nghỉ việc'); return; }
    try {
      const res = await fetch(`/api/v1/admin/users/${emp.id}/resign`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAddError(json.message || 'Không đánh dấu được nhân viên đã nghỉ việc');
        return;
      }
      showToast(json.message || `Đã đánh dấu ${emp.fullName} đã nghỉ việc.`);
      fetchEmployees();
      fetchActiveUsers();
    } catch {
      setAddError('Không kết nối được tới máy chủ — nhân viên chưa được đánh dấu nghỉ việc.');
    }
  };

  // Kích hoạt lại tài khoản nhân viên (từ trạng thái INACTIVE / LOCKED về ACTIVE)
  const handleReactivate = async (emp: Employee) => {
    if (!window.confirm(`Xác nhận kích hoạt lại tài khoản cho nhân viên ${emp.fullName} (${emp.employeeCode})?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/v1/admin/users/${emp.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          status: 'ACTIVE',
          reason: 'Kích hoạt lại tài khoản nhân sự từ giao diện quản lý',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        showToast(`Đã kích hoạt lại tài khoản cho ${emp.fullName} thành công!`);
        fetchEmployees();
        fetchActiveUsers();
      } else {
        alert(data.message || 'Lỗi khi kích hoạt lại tài khoản');
      }
    } catch {
      alert('Không kết nối được tới máy chủ.');
    }
  };

  // Vô hiệu hóa / Xóa mềm tài khoản nhân viên
  const handleDeleteUser = async (emp: Employee) => {
    const reason = window.prompt(
      `Xác nhận vô hiệu hóa / xóa tài khoản nhân sự ${emp.fullName} (${emp.employeeCode})?\n\n`
      + `Hệ thống sẽ:\n`
      + `• Đánh dấu ngừng hoạt động (INACTIVE)\n`
      + `• Tự động gỡ vị trí trưởng nhóm & chuyển giao toàn bộ đơn chờ duyệt sang quản lý kế tiếp\n`
      + `• Thu hồi toàn bộ phiên đăng nhập\n\n`
      + `Lý do (bắt buộc):`,
      'Vô hiệu hóa nhân sự'
    );
    if (!reason || !reason.trim()) return;
    try {
      const res = await fetch(`/api/v1/admin/users/${emp.id}?reason=${encodeURIComponent(reason.trim())}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        showToast(data.message || `Đã vô hiệu hóa ${emp.fullName} thành công.`);
        fetchEmployees();
        fetchActiveUsers();
      } else {
        alert(data.message || 'Lỗi khi xóa nhân viên');
      }
    } catch {
      alert('Không kết nối được tới máy chủ.');
    }
  };

  const handleAdminResetPassword = async (emp: Employee) => {
    if (!window.confirm(`Xác nhận cấp lại mật khẩu tạm thời cho nhân viên ${emp.fullName} (${emp.employeeCode}) và gửi email hướng dẫn qua Gmail?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/v1/admin/users/${emp.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        const tempPassword = typeof data.data === 'string' && data.data ? data.data : 'Act@RandomPass';
        setCreatedAccount({
          fullName: emp.fullName,
          employeeCode: emp.employeeCode,
          email: emp.email,
          team: emp.team,
          role: emp.role,
          defaultPassword: tempPassword,
          emailSent: true,
          emailStatusMessage: data.message || `Đã cấp lại mật khẩu tạm thời (${tempPassword}) và phát lệnh gửi email kích hoạt qua Gmail.`,
        });
        showToast(`Đã cấp lại mật khẩu cho ${emp.fullName}! Mật khẩu tạm: ${tempPassword}`);
        fetchEmployees();
      } else {
        alert(data.message || 'Lỗi khi cấp lại mật khẩu');
      }
    } catch {
      alert('Không thể kết nối đến máy chủ.');
    }
  };

  const handleCopyCredentials = () => {
    if (!createdAccount) return;
    const baseUrl = systemDomainHost || window.location.origin;
    const text = `=== THÔNG TIN TÀI KHOẢN ASCEND TECH ===\n` +
      `• Họ và Tên: ${createdAccount.fullName}\n` +
      `• Mã nhân viên: ${createdAccount.employeeCode}\n` +
      `• Email đăng nhập: ${createdAccount.email}\n` +
      `• Mật khẩu khởi tạo / tạm thời: ${createdAccount.defaultPassword}\n` +
      `• Yêu cầu: Bắt buộc đổi mật khẩu ở lần đăng nhập đầu tiên\n` +
      `• Đường dẫn đăng nhập: ${baseUrl}/login\n` +
      `======================================`;
    navigator.clipboard.writeText(text);
    setCopiedAccount(true);
    setTimeout(() => setCopiedAccount(false), 3000);
  };

  const handleOpenViewDetail = (emp: Employee) => {
    setViewDetailEmp(emp);
  };

  const handleOpenEdit = (emp: Employee) => {
    setEditForm({ ...emp });
    setEditReason('Cập nhật hồ sơ nhân sự theo quyết định nội bộ');
    setIsEditModalOpen(true);
  };

  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm) return;
    try {
      const res = await fetch(`/api/v1/admin/users/${editForm.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          fullName: editForm.fullName,
          email: editForm.email,
          positionName: editForm.positionName,
          role: editForm.role,
          status: editForm.status,
          teamId: editForm.teamId,
          managerId: editForm.managerId,
          reason: editReason.trim() || 'Cập nhật thông tin nhân viên',
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Đã cập nhật hồ sơ cho ${editForm.fullName} thành công!`);
        setIsEditModalOpen(false);
        setEditForm(null);
        if (viewDetailEmp && viewDetailEmp.id === editForm.id) {
          setViewDetailEmp(data.data || editForm);
        }
        fetchEmployees();
      } else {
        alert(data.message || 'Lỗi khi cập nhật hồ sơ nhân viên');
      }
    } catch {
      alert('Không thể kết nối đến máy chủ.');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="flex animate-in fade-in items-center justify-between gap-3 rounded-xl border border-status-ok-line bg-status-ok-soft p-3.5 text-xs shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-status-ok" />
            <span className="font-semibold text-status-ok">{toastMessage}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            aria-label="Đóng thông báo"
            className="ml-2 flex h-6 w-6 cursor-pointer items-center justify-center rounded-lg text-status-ok transition-colors hover:bg-status-ok/15 hover:text-ink"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Đầu trang — mockup `.phead` */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-accent-dark">
            <Users className="h-3.5 w-3.5" />
            Quản trị nhân sự
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <h1 className="font-display text-xl font-extrabold tracking-tight text-ink sm:text-[23px]">
              Quản lý nhân viên &amp; sơ đồ duyệt
            </h1>
            <Badge variant="accent">P0</Badge>
          </div>
          <p className="mt-1 text-xs text-ink-muted">
            Mọi luồng duyệt bắt đầu từ một câu hỏi: ai duyệt cho ai. Quản lý phân nhóm linh hoạt, chuỗi cấp trên, đổi quản lý bảo lưu đơn chờ.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {noTeamCount > 0 && (
            <button
              onClick={() => setFilterTeam('NO_TEAM')}
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[9px] border border-status-warn-line bg-status-warn-soft px-2.5 text-xs font-bold text-status-warn transition-colors hover:bg-status-warn/20"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              {noTeamCount} người chưa có nhóm
            </button>
          )}
          {noManagerCount > 0 && (
            <span className="inline-flex h-8 items-center gap-1.5 rounded-[9px] border border-status-danger-line bg-status-danger-soft px-2.5 text-xs font-bold text-status-danger">
              <ShieldAlert className="h-3.5 w-3.5" />
              {noManagerCount} người chưa có sếp
            </span>
          )}
          <Button
            variant="outline"
            size="md"
            onClick={() => {
              setImportResult(null);
              setImportFile(null);
              setImportError(null);
              setIsImportModalOpen(true);
            }}
            className="border-status-ok-line text-status-ok hover:bg-status-ok-soft font-semibold"
          >
            <FileSpreadsheet className="h-4 w-4 text-status-ok" />
            Import Excel
          </Button>
          <Button variant="primary" size="md" onClick={() => { setAddError(null); setIsAddModalOpen(true); }}>
            <UserPlus className="h-3.5 w-3.5" />
            Thêm nhân viên
          </Button>
        </div>
      </div>

      {/* Metrics Summary Strip */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <div className="rounded-[13px] border border-line bg-surface p-3.5 shadow-2xs">
          <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.06em] text-ink-muted">
            <Users className="h-3.5 w-3.5 text-accent" />
            Tổng nhân sự
          </div>
          <div className="mt-2 font-display text-[24px] font-extrabold leading-none tracking-[-0.035em] text-ink">
            {employees.length}
            <small className="ml-1 text-xs font-semibold tracking-normal text-ink-muted">người</small>
          </div>
        </div>

        <div className="rounded-[13px] border border-line bg-surface p-3.5 shadow-2xs">
          <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.06em] text-ink-muted">
            <UserCheck className="h-3.5 w-3.5 text-accent" />
            Đang hoạt động
          </div>
          <div className="mt-2 font-display text-[24px] font-extrabold leading-none tracking-[-0.035em] text-status-ok">
            {employees.filter((e) => e.status === 'ACTIVE').length}
            <small className="ml-1 text-xs font-semibold tracking-normal text-ink-muted">nhân sự</small>
          </div>
        </div>

        <div className="rounded-[13px] border border-line bg-surface p-3.5 shadow-2xs">
          <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.06em] text-ink-muted">
            <AlertTriangle className="h-3.5 w-3.5 text-accent" />
            Chưa có nhóm
          </div>
          <div className="mt-2 font-display text-[24px] font-extrabold leading-none tracking-[-0.035em] text-status-warn">
            {noTeamCount}
            <small className="ml-1 text-xs font-semibold tracking-normal text-ink-muted">người</small>
          </div>
        </div>

        <div className="rounded-[13px] border border-line bg-surface p-3.5 shadow-2xs">
          <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.06em] text-ink-muted">
            <ShieldAlert className="h-3.5 w-3.5 text-accent" />
            Chưa có quản lý
          </div>
          <div className="mt-2 font-display text-[24px] font-extrabold leading-none tracking-[-0.035em] text-status-danger">
            {noManagerCount}
            <small className="ml-1 text-xs font-semibold tracking-normal text-ink-muted">người</small>
          </div>
        </div>
      </div>

      {/* Quick Team Filter Chips — nhóm lấy từ API, không hard-code */}
      <div className="flex items-center gap-1.5 flex-wrap text-xs">
        {[
          { label: 'Tất cả', val: 'ALL' },
          { label: 'Chưa có nhóm', val: 'NO_TEAM' },
          ...teams.map((t) => ({ label: t.name, val: t.name })),
        ].map((chip) => (
          <button
            key={chip.val}
            type="button"
            onClick={() => setFilterTeam(chip.val)}
            className={`inline-flex h-[31px] shrink-0 cursor-pointer items-center rounded-full border px-3 text-[12.5px] font-semibold transition-colors ${
              filterTeam === chip.val
                ? 'border-ink bg-ink text-canvas'
                : 'border-line bg-surface text-ink-secondary hover:border-line-hover hover:text-ink'
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Advanced Filter Bar (Nhóm · Chức Danh · Trạng Thái · Từ Khóa) */}
      <Panel>
        <div className="grid grid-cols-1 gap-3 text-xs md:grid-cols-4">
          <div className="md:col-span-1">
            <label className="block text-[11px] font-semibold text-ink-muted mb-1">Tìm kiếm từ khóa</label>
            <input
              type="text"
              placeholder="Tên, mã NV (Admin, 136ACT...), email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Tìm kiếm nhân viên"
              className="w-full rounded-[10px] border border-line bg-canvas px-3 py-2 text-xs text-ink focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/20"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-ink-muted mb-1">Phân loại Nhóm</label>
            <select
              value={filterTeam}
              onChange={(e) => setFilterTeam(e.target.value)}
              aria-label="Phân loại nhóm"
              className="w-full cursor-pointer rounded-[10px] border border-line bg-canvas px-3 py-2 text-xs text-ink focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/20"
            >
              <option value="ALL">Tất cả Nhóm</option>
              <option value="NO_TEAM">Chưa có nhóm</option>
              {teams.map((t) => (
                <option key={t.id} value={t.name}>Nhóm {t.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-ink-muted mb-1">Vai Trò / Cấp Bậc</label>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              aria-label="Vai trò / cấp bậc"
              className="w-full cursor-pointer rounded-[10px] border border-line bg-canvas px-3 py-2 text-xs text-ink focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/20"
            >
              <option value="ALL">Tất cả Vai Trò</option>
              <option value="EMPLOYEE">Nhân viên (EMPLOYEE)</option>
              <option value="MANAGER">Quản lý (MANAGER)</option>
              <option value="HR_ADMIN">Nhân sự (HR_ADMIN)</option>
              <option value="ADMIN">Quản trị viên (ADMIN)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-ink-muted mb-1">Trạng Thái Tài Khoản</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              aria-label="Trạng thái tài khoản"
              className="w-full cursor-pointer rounded-[10px] border border-line bg-canvas px-3 py-2 text-xs text-ink focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/20"
            >
              <option value="ALL">Tất cả Trạng Thái</option>
              <option value="ACTIVE">Đang hoạt động (ACTIVE)</option>
              <option value="PENDING_ACTIVATION">Chưa kích hoạt (PENDING)</option>
              <option value="LOCKED">Đang bị khóa (LOCKED)</option>
              <option value="INACTIVE">Ngừng hoạt động (INACTIVE)</option>
            </select>
          </div>
        </div>
      </Panel>

      {/* Employee List Table with Approval Chain — Desktop: bảng 8 cột · Mobile: card 2 dòng */}
      <div className="overflow-hidden rounded-[13px] border border-line bg-surface shadow-2xs">
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-line bg-canvas">
                <th className="px-4 py-3 text-[9.5px] font-extrabold uppercase tracking-[0.07em] text-ink-muted">Họ và tên</th>
                <th className="px-3 py-3 text-[9.5px] font-extrabold uppercase tracking-[0.07em] text-ink-muted">Mã NV</th>
                <th className="px-3 py-3 text-[9.5px] font-extrabold uppercase tracking-[0.07em] text-ink-muted">Chức danh</th>
                <th className="px-3 py-3 text-[9.5px] font-extrabold uppercase tracking-[0.07em] text-ink-muted">Nhóm</th>
                <th className="px-4 py-3 text-[9.5px] font-extrabold uppercase tracking-[0.07em] text-ink-muted">Chuỗi cấp trên · ai duyệt cho ai</th>
                <th className="px-3 py-3 text-[9.5px] font-extrabold uppercase tracking-[0.07em] text-ink-muted">Ngày gia nhập</th>
                <th className="px-3 py-3 text-[9.5px] font-extrabold uppercase tracking-[0.07em] text-ink-muted">Trạng thái</th>
                <th className="px-4 py-3 text-right text-[9.5px] font-extrabold uppercase tracking-[0.07em] text-ink-muted">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {employees.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-ink-muted">
                    {loading ? 'Đang tải danh sách nhân sự...' : 'Không tìm thấy nhân viên nào phù hợp bộ lọc.'}
                  </td>
                </tr>
              ) : (
                employees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-canvas/50 transition-colors">
                    <td className="py-3 px-4 font-medium text-ink">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-accent-soft text-accent-dark font-bold text-xs flex items-center justify-center shrink-0 uppercase ring-1 ring-accent-line">
                          {emp.fullName.substring(0, 2)}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-ink truncate">{emp.fullName}</div>
                          <div className="text-[10px] text-ink-muted font-mono">{emp.email}</div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-3 font-mono font-bold text-ink">
                      <span className={emp.employeeCode === 'Admin' ? 'text-accent font-extrabold' : ''}>
                        {emp.employeeCode}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-ink">
                      <div className="font-semibold">{emp.positionName || 'Chuyên viên'}</div>
                      <div className="text-[10px] text-ink-muted">{emp.role}</div>
                    </td>

                    <td className="py-3 px-3">
                      {emp.team && emp.team !== 'Chưa có nhóm' ? (
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-status-ok-soft text-status-ok border border-status-ok-line">
                          {emp.team}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md border border-status-danger-line bg-status-danger-soft px-2 py-0.5 text-[11px] font-semibold text-status-danger">
                          <AlertTriangle className="h-3 w-3" />
                          Chưa có nhóm
                        </span>
                      )}
                    </td>

                    {/* Chuỗi Cấp Trên — Ai Duyệt Cho Ai (Tiêu chí 5) */}
                    <td className="py-3 px-4">
                      {emp.approvalChain ? (
                        (() => {
                          const chain = splitApprovalChain(emp.approvalChain);
                          return (
                            <div className="flex items-center gap-1.5 text-[11px] font-medium text-ink-secondary">
                              <GitPullRequest className="h-3.5 w-3.5 shrink-0 text-accent" />
                              <span className={chain.missing ? 'font-bold text-status-danger' : ''}>
                                {chain.text}
                              </span>
                            </div>
                          );
                        })()
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-status-danger">
                          <ShieldAlert className="h-3 w-3" />
                          Chưa có quản lý
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-ink-muted text-[11px]">
                      {emp.hireDate || emp.joinDate || '01/01/2023'}
                    </td>

                    <td className="py-3 px-3">
                      <div className="flex flex-col gap-1 items-start">
                        {emp.status === 'ACTIVE' && <Badge variant="ok">Hoạt động</Badge>}
                        {emp.status === 'PENDING_ACTIVATION' && <Badge variant="warn">Chưa kích hoạt</Badge>}
                        {emp.status === 'LOCKED' && <Badge variant="danger">Đang khoá</Badge>}
                        {emp.status === 'INACTIVE' && <Badge variant="gray">Ngừng</Badge>}
                        {emp.mustChangePassword && (
                          <span className="inline-flex items-center gap-1 whitespace-nowrap rounded border border-status-warn-line bg-status-warn-soft px-1.5 py-0.5 text-[10px] font-semibold text-status-warn" title="Bắt buộc đổi mật khẩu lần đầu">
                            <Key className="h-3 w-3" />
                            Đổi pass lần đầu
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Action buttons */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => handleOpenViewDetail(emp)}
                          className="px-2.5 py-1 rounded-lg bg-status-info-soft hover:bg-status-info hover:text-on-info text-status-info border border-status-info-line text-[11px] font-semibold transition-all cursor-pointer shadow-2xs flex items-center gap-1 group"
                          title="Xem chi tiết hồ sơ nhân sự"
                        >
                          <Eye className="w-3 h-3 text-status-info group-hover:text-canvas" />
                          <span>Xem</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(emp)}
                          className="px-2.5 py-1 rounded-lg bg-accent-soft hover:bg-accent hover:text-on-accent text-accent-dark border border-accent-line text-[11px] font-semibold transition-all cursor-pointer shadow-2xs flex items-center gap-1 group"
                          title="Chỉnh sửa thông tin nhân viên"
                        >
                          <Edit2 className="w-3 h-3 text-accent-dark group-hover:text-on-accent" />
                          <span>Sửa</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenChangeManager(emp)}
                          className="px-2.5 py-1 rounded-lg bg-status-info-soft hover:bg-status-info hover:text-on-info text-status-info border border-status-info-line text-[11px] font-semibold transition-all cursor-pointer shadow-2xs flex items-center gap-1 group"
                          title="Đổi người duyệt trực tiếp"
                        >
                          <GitPullRequest className="w-3 h-3 text-status-info group-hover:text-canvas" />
                          <span>Đổi sếp</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenChangeTeam(emp)}
                          className="px-2.5 py-1 rounded-lg bg-status-info-soft hover:bg-status-info hover:text-on-info text-status-info border border-status-info-line text-[11px] font-semibold transition-all cursor-pointer shadow-2xs flex items-center gap-1 group"
                          title="Chuyển nhóm làm việc"
                        >
                          <Building2 className="w-3 h-3 text-status-info group-hover:text-canvas" />
                          <span>Chuyển nhóm</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAdminResetPassword(emp)}
                          className="px-2.5 py-1 rounded-lg bg-status-warn-soft hover:bg-status-warn hover:text-on-warn text-status-warn border border-status-warn-line text-[11px] font-semibold transition-all cursor-pointer shadow-2xs flex items-center gap-1 group"
                          title="Cấp lại mật khẩu và gửi email kích hoạt"
                        >
                          <Key className="w-3 h-3 text-status-warn group-hover:text-canvas" />
                          <span>Cấp lại pass</span>
                        </button>
                        {emp.status === 'INACTIVE' || emp.status === 'LOCKED' ? (
                          <button
                            type="button"
                            onClick={() => handleReactivate(emp)}
                            className="px-2.5 py-1 rounded-lg bg-status-ok-soft hover:bg-status-ok hover:text-on-ok text-status-ok border border-status-ok-line text-[11px] font-semibold transition-all cursor-pointer shadow-2xs flex items-center gap-1 group"
                            title="Kích hoạt lại tài khoản nhân sự sang trạng thái Hoạt động"
                          >
                            <UserCheck className="w-3 h-3 text-status-ok group-hover:text-canvas" />
                            <span>Kích hoạt lại</span>
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => handleResign(emp)}
                              className="px-2.5 py-1 rounded-lg bg-surface-secondary hover:bg-ink-muted hover:text-canvas text-ink border border-line text-[11px] font-semibold transition-all cursor-pointer shadow-2xs flex items-center gap-1 group"
                              title="Đánh dấu đã nghỉ việc: rời khỏi tổ chức nhưng giữ lịch sử chấm công. Mã nhân viên vẫn giữ (không cấp lại được), email thì có thể cấp cho nhân viên mới."
                            >
                              <UserX className="w-3 h-3 text-ink-secondary group-hover:text-canvas" />
                              <span>Đã nghỉ</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(emp)}
                              className="px-2.5 py-1 rounded-lg bg-status-danger-soft hover:bg-status-danger hover:text-white text-status-danger border border-status-danger-line text-[11px] font-semibold transition-all cursor-pointer shadow-2xs flex items-center gap-1 group"
                              title="Vô hiệu hóa tài khoản nhân sự và tự động chuyển giao đơn chờ"
                            >
                              <X className="w-3 h-3 text-status-danger group-hover:text-white" />
                              <span>Xóa</span>
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile — danh sách 2 dòng: dòng 1 = NV + trạng thái, dòng 2 = nhóm + chuỗi cấp trên, dòng 3 = nút */}
        <div className="divide-y divide-line-soft md:hidden">
          {employees.length === 0 ? (
            <div className="p-8 text-center text-xs text-ink-muted">
              {loading ? 'Đang tải danh sách nhân sự...' : 'Không tìm thấy nhân viên nào phù hợp bộ lọc.'}
            </div>
          ) : (
            employees.map((emp) => (
              <div key={emp.id} className="p-3.5">
                <div className="flex items-start gap-2.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11px] font-bold uppercase text-accent-dark ring-1 ring-accent-line">
                    {emp.fullName.substring(0, 2)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-bold text-ink">{emp.fullName}</div>
                    <div className="mt-0.5 font-mono text-[10px] text-ink-muted">{emp.employeeCode} · {emp.email}</div>
                    <div className="mt-1 text-[11px] text-ink-secondary">
                      {emp.positionName || 'Chuyên viên'} <span className="text-ink-muted">· {emp.role}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {emp.status === 'ACTIVE' && <Badge variant="ok">Hoạt động</Badge>}
                    {emp.status === 'PENDING_ACTIVATION' && <Badge variant="warn">Chưa kích hoạt</Badge>}
                    {emp.status === 'LOCKED' && <Badge variant="danger">Đang khoá</Badge>}
                    {emp.status === 'INACTIVE' && <Badge variant="gray">Ngừng</Badge>}
                    {emp.mustChangePassword && (
                      <span className="inline-flex items-center gap-1 whitespace-nowrap rounded border border-status-warn-line bg-status-warn-soft px-1.5 py-0.5 text-[10px] font-semibold text-status-warn" title="Bắt buộc đổi mật khẩu lần đầu">
                        <Key className="h-3 w-3" />
                        Đổi pass lần đầu
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-2.5 space-y-1.5 pl-9">
                  {emp.team && emp.team !== 'Chưa có nhóm' ? (
                    <span className="inline-flex rounded-md border border-status-ok-line bg-status-ok-soft px-2 py-0.5 text-[11px] font-semibold text-status-ok">
                      {emp.team}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-md border border-status-danger-line bg-status-danger-soft px-2 py-0.5 text-[11px] font-semibold text-status-danger">
                      <AlertTriangle className="h-3 w-3" />
                      Chưa có nhóm
                    </span>
                  )}
                  {emp.approvalChain ? (
                    (() => {
                      const chain = splitApprovalChain(emp.approvalChain);
                      return (
                        <div className="flex items-start gap-1.5 text-[11px] font-medium text-ink-secondary">
                          <GitPullRequest className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                          <span className={chain.missing ? 'font-bold text-status-danger' : ''}>
                            {chain.text}
                          </span>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="flex items-start gap-1.5 text-[11px] font-bold text-status-danger">
                      <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      Chưa có quản lý
                    </div>
                  )}
                  <div className="text-[11px] text-ink-muted">Ngày gia nhập: {emp.hireDate || emp.joinDate || '01/01/2023'}</div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-line-soft pt-2.5">
                  <button
                    type="button"
                    onClick={() => handleOpenViewDetail(emp)}
                    className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-[9px] border border-status-info-line bg-status-info-soft px-2.5 text-[11.5px] font-semibold text-status-info transition-colors hover:bg-status-info hover:text-on-info"
                    title="Xem chi tiết hồ sơ nhân sự"
                  >
                    <Eye className="h-3 w-3" /> Xem
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(emp)}
                    className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-[9px] border border-accent-line bg-accent-soft px-2.5 text-[11.5px] font-semibold text-accent-dark transition-colors hover:bg-accent hover:text-on-accent"
                    title="Chỉnh sửa thông tin nhân viên"
                  >
                    <Edit2 className="h-3 w-3" /> Sửa
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenChangeManager(emp)}
                    className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-[9px] border border-status-info-line bg-status-info-soft px-2.5 text-[11.5px] font-semibold text-status-info transition-colors hover:bg-status-info hover:text-on-info"
                    title="Đổi người duyệt trực tiếp"
                  >
                    <GitPullRequest className="h-3 w-3" /> Đổi sếp
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenChangeTeam(emp)}
                    className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-[9px] border border-status-info-line bg-status-info-soft px-2.5 text-[11.5px] font-semibold text-status-info transition-colors hover:bg-status-info hover:text-on-info"
                    title="Chuyển nhóm làm việc"
                  >
                    <Building2 className="h-3 w-3" /> Chuyển nhóm
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAdminResetPassword(emp)}
                    className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-[9px] border border-status-warn-line bg-status-warn-soft px-2.5 text-[11.5px] font-semibold text-status-warn transition-colors hover:bg-status-warn hover:text-on-warn"
                    title="Cấp lại mật khẩu"
                  >
                    <Key className="h-3 w-3" /> Cấp pass
                  </button>
                  {emp.status === 'INACTIVE' || emp.status === 'LOCKED' ? (
                    <button
                      type="button"
                      onClick={() => handleReactivate(emp)}
                      className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-[9px] border border-status-ok-line bg-status-ok-soft px-2.5 text-[11.5px] font-semibold text-status-ok transition-colors hover:bg-status-ok hover:text-on-ok"
                      title="Kích hoạt lại tài khoản"
                    >
                      <UserCheck className="h-3 w-3" /> Kích hoạt lại
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => handleResign(emp)}
                        className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-[9px] border border-line bg-surface-secondary px-2.5 text-[11.5px] font-semibold text-ink transition-colors hover:bg-ink-muted hover:text-canvas"
                        title="Đánh dấu đã nghỉ việc"
                      >
                        <UserX className="h-3 w-3" /> Đã nghỉ
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteUser(emp)}
                        className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-[9px] border border-status-danger-line bg-status-danger-soft px-2.5 text-[11.5px] font-semibold text-status-danger transition-colors hover:bg-status-danger hover:text-white"
                        title="Vô hiệu hóa tài khoản"
                      >
                        <X className="h-3 w-3" /> Xóa
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal: Đổi Quản Lý Trực Tiếp (Bắt buộc lý do, ghi audit log, chuyển đơn chờ) */}
      {isChangeManagerModalOpen && selectedEmp && (
        <Modal
          isOpen={isChangeManagerModalOpen}
          onClose={() => setIsChangeManagerModalOpen(false)}
          title={`Đổi Quản Lý Trực Tiếp — ${selectedEmp.fullName} (${selectedEmp.employeeCode})`}
        >
          <form onSubmit={handleSubmitChangeManager} className="space-y-4 text-xs">
            <div className="p-3 bg-canvas rounded-lg border border-line space-y-1.5 text-ink-secondary">
              <div>
                • Nhân viên: <strong>{selectedEmp.fullName}</strong> ({selectedEmp.employeeCode})
              </div>
              <div>
                • Quản lý hiện tại: <strong>{selectedEmp.managerName || 'Chưa thiết lập'}</strong>
              </div>
              <div className="text-[11px] text-ink-muted">
                * Quy định bảo toàn: Mọi đơn từ đang chờ duyệt của nhân viên này sẽ được tự động giao sang cho Quản lý mới tiếp quản, không bị mất đơn.
              </div>
            </div>

            {managerError && (
              <div className="p-2.5 rounded-lg bg-status-danger/15 border border-status-danger/30 text-status-danger-line text-xs font-semibold">
                <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />
                {managerError}
              </div>
            )}

            <div>
              <label className="block font-bold text-ink mb-1.5">
                Chọn Quản Lý Mới Tiếp Nhận <span className="text-status-danger">*</span>
              </label>
              <select
                required
                value={newManagerId}
                onChange={(e) => setNewManagerId(e.target.value)}
                className="w-full text-xs p-2.5 rounded-lg border border-line bg-canvas text-ink focus:outline-none focus:border-accent"
              >
                <option value="">-- Chọn Quản lý (Manager / Admin) --</option>
                {availableManagers.map((mgr) => (
                  <option key={mgr.id} value={mgr.id}>
                    {mgr.fullName} ({mgr.employeeCode}) — {mgr.role}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-ink mb-1.5">
                Lý Do Thay Đổi Quản Lý (Bắt buộc kiểm toán) <span className="text-status-danger">*</span>
              </label>
              <textarea
                required
                rows={3}
                placeholder="Nhập lý do điều chuyển quản lý (ví dụ: Thay đổi cơ cấu dự án, Quản lý cũ nghỉ việc, Điều chuyển nhân sự định kỳ...)"
                value={changeManagerReason}
                onChange={(e) => setChangeManagerReason(e.target.value)}
                className="w-full text-xs p-2.5 rounded-lg border border-line bg-canvas text-ink focus:outline-none focus:border-accent resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsChangeManagerModalOpen(false)}>
                Hủy bỏ
              </Button>
              <Button type="submit" variant="primary" size="sm">
                Xác Nhận &amp; Bàn Giao Đơn Chờ
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: Chuyển Nhóm Làm Việc */}
      {isChangeTeamModalOpen && selectedEmp && (
        <Modal
          isOpen={isChangeTeamModalOpen}
          onClose={() => setIsChangeTeamModalOpen(false)}
          title={`Điều Chuyển Nhóm — ${selectedEmp.fullName}`}
        >
          <form onSubmit={handleSubmitChangeTeam} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-ink mb-1.5">Chọn Nhóm Mới</label>
              <select
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                className="w-full text-xs p-2.5 rounded-lg border border-line bg-canvas text-ink focus:outline-none focus:border-accent"
              >
                {teams.length === 0 && <option value="">Chưa có nhóm nào trong hệ thống</option>}
                {teams.map((t) => (
                  <option key={t.id} value={t.name}>
                    Nhóm {t.name}{t.parentName ? ` (thuộc ${t.parentName})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-ink mb-1.5">Lý Do Chuyển Nhóm</label>
              <input
                type="text"
                placeholder="Ví dụ: Tham gia dự án trọng điểm Quý 4"
                value={changeTeamReason}
                onChange={(e) => setChangeTeamReason(e.target.value)}
                className="w-full text-xs p-2.5 rounded-lg border border-line bg-canvas text-ink focus:outline-none focus:border-accent"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsChangeTeamModalOpen(false)}>
                Hủy
              </Button>
              <Button type="submit" variant="primary" size="sm">
                Lưu Thay Đổi
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: Thêm Nhân Viên Mới (Tự gán nhóm, ca mặc định & gửi mail kích hoạt) */}
      {isAddModalOpen && (
        <Modal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          title="Thêm Nhân Viên Mới Vào Tổ Chức"
        >
          <form onSubmit={handleCreateEmployee} className="space-y-4 text-xs">
            {addError && (
              <div className="p-3 rounded-xl bg-status-danger/10 border border-status-danger/30 text-status-danger-line text-xs font-semibold">
                <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />
                {addError}
              </div>
            )}
            {/* Hướng dẫn an ninh & Gmail */}
            <div className="p-3 bg-status-ok/10 border border-status-ok/30 rounded-xl text-status-ok-line text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <Mail className="w-4 h-4 text-status-ok" />
                <span>Tự động kích hoạt tài khoản &amp; gửi email thông báo qua Gmail</span>
              </div>
              <p className="text-[11px] text-status-ok-line/80 leading-relaxed">
                Hệ thống sẽ cấp mã nhân viên và mật khẩu bảo mật ngẫu nhiên mặc định, đồng thời gửi thư kích hoạt kèm thông tin đăng nhập tới Gmail của nhân sự. Nhân viên bắt buộc phải đổi mật khẩu ở lần đăng nhập đầu tiên.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-ink mb-1">Mã Nhân Viên *</label>
                <input
                  type="text"
                  required
                  value={newEmp.code}
                  onChange={(e) => setNewEmp({ ...newEmp, code: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-lg border border-line bg-canvas text-ink focus:outline-none focus:border-accent font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-ink mb-1">Họ và Tên *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Nguyễn Văn An"
                  value={newEmp.fullName}
                  onChange={(e) => setNewEmp({ ...newEmp, fullName: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-lg border border-line bg-canvas text-ink focus:outline-none focus:border-accent font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-ink mb-1">Email Nhận Thông Báo (Gmail / Công Ty) *</label>
              <input
                type="email"
                required
                placeholder="an.nv@act-corp.internal hoặc nguyenvanan@gmail.com"
                value={newEmp.email}
                onChange={(e) => setNewEmp({ ...newEmp, email: e.target.value })}
                className="w-full text-xs p-2.5 rounded-lg border border-line bg-canvas text-ink focus:outline-none focus:border-accent font-medium"
              />
            </div>

            {/* Mật khẩu mặc định / khởi tạo */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block font-semibold text-ink">Mật Khẩu Mặc Định Khởi Tạo *</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setNewEmp(prev => ({ ...prev, password: generateRandomPassword() }))}
                    className="text-[11px] font-semibold text-accent hover:underline flex items-center gap-1 cursor-pointer"
                    title="Tạo ngẫu nhiên mật khẩu bảo mật mới"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Tạo ngẫu nhiên</span>
                  </button>
                  <span className="text-[10px] text-status-warn font-bold">Bắt buộc đổi pass lần đầu</span>
                </div>
              </div>
              <div className="relative">
                <input
                  type={showNewEmpPassword ? 'text' : 'password'}
                  required
                  value={newEmp.password}
                  onChange={(e) => setNewEmp({ ...newEmp, password: e.target.value })}
                  className="w-full text-xs p-2.5 pr-12 rounded-lg border border-line bg-canvas text-ink focus:outline-none focus:border-accent font-mono font-bold"
                  placeholder="Mật khẩu ngẫu nhiên..."
                />
                <button
                  type="button"
                  onClick={() => setShowNewEmpPassword(!showNewEmpPassword)}
                  className="absolute right-2.5 top-2.5 text-ink-muted hover:text-ink transition-colors cursor-pointer flex items-center justify-center"
                  title={showNewEmpPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showNewEmpPassword ? <EyeOff className="w-4 h-4 text-accent" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <span className="text-[10px] text-ink-muted mt-1 block">
                * Mật khẩu ngẫu nhiên này được khởi tạo tự động và gửi qua Gmail cho nhân viên để kích hoạt tài khoản.
              </span>
            </div>

            {/* Ngày onboard — căn cứ tính thâm niên, phép thâm niên & tổng phép năm */}
            <div>
              <label className="block font-semibold text-ink mb-1">Ngày Vào Làm (Onboard) *</label>
              <input
                type="date"
                required
                value={newEmp.joinedDate}
                onChange={(e) => setNewEmp({ ...newEmp, joinedDate: e.target.value })}
                className="w-full text-xs p-2.5 rounded-lg border border-line bg-canvas text-ink focus:outline-none focus:border-accent font-medium"
              />
              <span className="text-[10px] text-ink-muted mt-1 block">
                * Căn cứ xác định thâm niên, phép thâm niên và tổng phép năm được cấp. Nhập ngày trong quá khứ
                thì hệ thống tự cộng bù phép đã tích lũy.
              </span>
            </div>

            {onboardPreview && (
              <div className="p-3 bg-accent-soft/40 border border-accent-line rounded-xl text-[11px] space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-ink">
                  <Calendar className="w-4 h-4 text-accent" />
                  <span>Quỹ phép dự kiến theo ngày vào làm</span>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                  <div className="flex justify-between gap-2">
                    <span className="text-ink-muted">Thâm niên:</span>
                    <strong className="text-ink">{onboardPreview.seniorityYears} năm {onboardPreview.seniorityMonths} tháng</strong>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-ink-muted">Phép thâm niên:</span>
                    <strong className="text-ink">+{onboardPreview.seniorityDays} ngày</strong>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-ink-muted">Phép năm tích lũy:</span>
                    <strong className="text-ink">{onboardPreview.baseAccruedDays} ngày</strong>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-ink-muted">Tổng phép năm:</span>
                    <strong className="text-accent text-sm">{onboardPreview.totalAnnualDays} ngày</strong>
                  </div>
                </div>
                <div className="text-[10px] text-ink-muted">
                  {onboardPreview.isFuture
                    ? 'Ngày vào làm ở tương lai — phép chỉ bắt đầu tích lũy từ tháng onboard.'
                    : `Mốc thâm niên kế tiếp: ${formatDMY(onboardPreview.nextSeniorityDate)}.`}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-ink mb-1">Nhóm Làm Việc</label>
                <select
                  value={newEmp.team}
                  onChange={(e) => setNewEmp({ ...newEmp, team: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-lg border border-line bg-canvas text-ink focus:outline-none focus:border-accent"
                >
                  {teams.length === 0 && <option value="">Chưa có nhóm nào trong hệ thống</option>}
                  {teams.map((t) => (
                    <option key={t.id} value={t.name}>
                      Nhóm {t.name}{t.parentName ? ` (thuộc ${t.parentName})` : ''}
                      {t.memberCount ? ` · ${t.memberCount} người` : ''}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-ink-muted mt-0.5 block">
                  * Danh sách nhóm lấy từ Tổ chức. Để trống thì hệ thống tự gán nhóm đầu tiên &amp; phân ca mặc định.
                </span>
              </div>

              <div>
                <label className="block font-semibold text-ink mb-1">Vai Trò (Role)</label>
                <select
                  value={newEmp.role}
                  onChange={(e) => setNewEmp({ ...newEmp, role: e.target.value as any })}
                  className="w-full text-xs p-2.5 rounded-lg border border-line bg-canvas text-ink focus:outline-none focus:border-accent font-bold"
                >
                  <option value="EMPLOYEE">EMPLOYEE (Nhân viên)</option>
                  <option value="MANAGER">MANAGER (Quản lý)</option>
                  <option value="HR_ADMIN">HR_ADMIN (Quản trị nhân sự)</option>
                  <option value="ADMIN">ADMIN (Quản trị toàn quyền)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-line">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsAddModalOpen(false)} disabled={isCreatingEmp}>
                Hủy
              </Button>
              <Button type="submit" variant="primary" size="sm" disabled={isCreatingEmp}>
                {isCreatingEmp ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Đang Tạo Nhân Viên...
                  </>
                ) : (
                  <>
                    <Mail className="w-3.5 h-3.5 mr-1" />
                    Tạo Nhân Viên &amp; Gửi Email Kích Hoạt
                  </>
                )}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: Xác Nhận & Sao Chép Thông Tin Tài Khoản Vừa Tạo / Reset */}
      {createdAccount && (
        <Modal
          isOpen={Boolean(createdAccount)}
          onClose={() => setCreatedAccount(null)}
          title="🎉 Thông Tin Tài Khoản Khởi Tạo & Thông Báo Gmail"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-status-ok/10 border border-status-ok/30 rounded-xl text-status-ok-line">
              <div className="flex items-center gap-2 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5 text-status-ok shrink-0" />
                <span>Khởi tạo tài khoản thành công!</span>
              </div>
              <p className="text-[11px] text-status-ok-line/90 mt-1 leading-relaxed">
                Tài khoản nhân viên đã được ghi nhận vào cơ sở dữ liệu hệ thống với đầy đủ phân quyền và cơ chế bảo mật.
              </p>
            </div>

            {/* Chi tiết tài khoản */}
            <div className="bg-canvas border border-line rounded-xl p-4 space-y-2.5">
              <div className="text-[11px] font-bold text-ink-muted uppercase tracking-wider border-b border-line pb-1.5 flex items-center justify-between">
                <span>Thông Tin Đăng Nhập Của Nhân Viên</span>
                <span className="text-status-warn font-mono font-bold">Chờ đổi pass lần đầu</span>
              </div>

              <div className="grid grid-cols-3 gap-2 py-1 border-b border-line/60">
                <span className="text-ink-muted">Họ và tên:</span>
                <span className="col-span-2 font-bold text-ink">{createdAccount.fullName}</span>
              </div>

              <div className="grid grid-cols-3 gap-2 py-1 border-b border-line/60">
                <span className="text-ink-muted">Mã nhân viên:</span>
                <span className="col-span-2 font-mono font-bold text-accent">{createdAccount.employeeCode}</span>
              </div>

              <div className="grid grid-cols-3 gap-2 py-1 border-b border-line/60">
                <span className="text-ink-muted">Email đăng nhập:</span>
                <span className="col-span-2 font-semibold text-ink">{createdAccount.email}</span>
              </div>

              <div className="grid grid-cols-3 gap-2 py-1 border-b border-line/60 items-center">
                <span className="text-ink-muted">Mật khẩu mặc định:</span>
                <div className="col-span-2 flex items-center gap-2">
                  <span className="px-2.5 py-1 bg-surface border border-line rounded-lg font-mono font-extrabold text-sm text-ink tracking-wider">
                    {createdAccount.defaultPassword}
                  </span>
                  <span className="text-[10px] text-status-warn font-semibold">(Tạm thời)</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 py-1 border-b border-line/60">
                <span className="text-ink-muted">Nhóm &amp; Vai trò:</span>
                <span className="col-span-2 font-medium text-ink">{createdAccount.team} · {createdAccount.role}</span>
              </div>

              <div className="grid grid-cols-3 gap-2 py-1">
                <span className="text-ink-muted">Trạng thái gửi Gmail:</span>
                <div className="col-span-2">
                  <div className="flex items-center gap-1.5 text-status-ok font-semibold">
                    <Mail className="w-3.5 h-3.5 shrink-0" />
                    <span>{createdAccount.emailStatusMessage || 'Đã phát lệnh gửi email thông báo qua Gmail'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Lưu ý bảo mật */}
            <div className="p-3 bg-status-warn/10 border border-status-warn/30 rounded-xl text-status-warn-line text-[11px] space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-status-warn" />
                <span>Quy định bảo mật lần đầu đăng nhập</span>
              </div>
              <p className="text-status-warn-line/80 leading-relaxed">
                Khi nhân viên đăng nhập bằng mật khẩu mặc định này tại <code>/login</code>, hệ thống sẽ cưỡng chế hiển thị giao diện đổi mật khẩu bắt buộc trước khi cấp quyền truy cập các tính năng chấm công và xin đơn.
              </p>
            </div>

            {/* Thao tác Copy & Close */}
            <div className="flex justify-between items-center pt-3 border-t border-line">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopyCredentials}
                className="gap-1.5"
              >
                {copiedAccount ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-status-ok" />
                    <span className="text-status-ok font-bold">Đã sao chép!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Sao Chép Thông Tin Tài Khoản</span>
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => setCreatedAccount(null)}
              >
                Xác Nhận &amp; Đóng
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: Xem Chi Tiết Hồ Sơ Nhân Viên (View Detail) */}
      {viewDetailEmp && (
        <Modal
          isOpen={Boolean(viewDetailEmp)}
          onClose={() => setViewDetailEmp(null)}
          title={`Hồ Sơ Nhân Sự Chi Tiết — ${viewDetailEmp.fullName} (${viewDetailEmp.employeeCode})`}
        >
          <div className="space-y-4 text-xs">
            {/* Header Card */}
            <div className="p-4 bg-canvas rounded-xl border border-line flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-accent-soft text-accent-dark text-xl font-extrabold flex items-center justify-center uppercase ring-2 ring-accent-line shrink-0">
                {viewDetailEmp.fullName.substring(0, 2)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-bold text-ink">{viewDetailEmp.fullName}</h3>
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-surface border border-line text-accent">
                    {viewDetailEmp.employeeCode}
                  </span>
                  {viewDetailEmp.status === 'ACTIVE' && <Badge variant="ok">Đang hoạt động</Badge>}
                  {viewDetailEmp.status === 'PENDING_ACTIVATION' && <Badge variant="warn">Chưa kích hoạt</Badge>}
                  {viewDetailEmp.status === 'LOCKED' && <Badge variant="danger">Đang khóa</Badge>}
                </div>
                <div className="text-ink-muted mt-1 flex items-center gap-2 text-[11px]">
                  <span>{viewDetailEmp.positionName || 'Chuyên viên'}</span>
                  <span>•</span>
                  <span className="font-semibold text-ink-secondary">{viewDetailEmp.role}</span>
                  <span>•</span>
                  <span>Nhóm: <strong className="text-ink">{viewDetailEmp.team}</strong></span>
                </div>
              </div>
            </div>

            {/* Information Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Box 1: Thông tin liên hệ & Công tác */}
              <div className="p-3 bg-surface rounded-xl border border-line space-y-2">
                <div className="font-bold text-ink flex items-center gap-1.5 border-b border-line pb-1 text-[11px] uppercase tracking-wider text-ink-muted">
                  <User className="w-3.5 h-3.5 text-accent" />
                  <span>Thông Tin Cá Nhân &amp; Liên Hệ</span>
                </div>
                <div className="space-y-1.5 text-[11px]">
                  <div className="flex justify-between py-0.5 border-b border-line/40">
                    <span className="text-ink-muted">Email công ty:</span>
                    <span className="font-mono font-semibold text-ink">{viewDetailEmp.email}</span>
                  </div>
                  <div className="flex justify-between py-0.5 border-b border-line/40">
                    <span className="text-ink-muted">Số điện thoại:</span>
                    <span className="font-semibold text-ink">{viewDetailEmp.phone || '0901234567'}</span>
                  </div>
                  <div className="flex justify-between py-0.5 border-b border-line/40">
                    <span className="text-ink-muted">Ngày vào làm (onboard):</span>
                    <span className="font-semibold text-ink">{formatDMY(viewDetailEmp.hireDate || viewDetailEmp.joinDate)}</span>
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span className="text-ink-muted">Bộ phận / Team:</span>
                    <span className="font-bold text-accent">{viewDetailEmp.team}</span>
                  </div>
                </div>
              </div>

              {/* Box 2: Phân cấp & Luồng duyệt */}
              <div className="p-3 bg-surface rounded-xl border border-line space-y-2">
                <div className="font-bold text-ink flex items-center gap-1.5 border-b border-line pb-1 text-[11px] uppercase tracking-wider text-ink-muted">
                  <GitPullRequest className="w-3.5 h-3.5 text-accent" />
                  <span>Cấp Trên &amp; Chuỗi Phê Duyệt</span>
                </div>
                <div className="space-y-1.5 text-[11px]">
                  <div className="flex justify-between py-0.5 border-b border-line/40">
                    <span className="text-ink-muted">Quản lý trực tiếp:</span>
                    <span className="font-semibold text-ink">
                      {viewDetailEmp.managerName ? `${viewDetailEmp.managerName} (${viewDetailEmp.managerCode || ''})` : 'Chưa có'}
                    </span>
                  </div>
                  <div className="py-0.5 border-b border-line/40">
                    <span className="text-ink-muted block mb-1">Chuỗi duyệt (Ai duyệt cho ai):</span>
                    <span className={`font-semibold block ${viewDetailEmp.approvalChain?.includes('Chưa có') ? 'text-status-danger' : 'text-status-ok font-mono text-[10px]'}`}>
                      {splitApprovalChain(viewDetailEmp.approvalChain).text || 'Chưa cấu hình chuỗi duyệt'}
                    </span>
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span className="text-ink-muted">Quyền hạn hệ thống:</span>
                    <Badge variant="accent">{viewDetailEmp.role}</Badge>
                  </div>
                </div>
              </div>

              {/* Box: Thâm niên & quỹ phép năm — suy ra từ ngày onboard */}
              <div className="p-3 bg-surface rounded-xl border border-line space-y-2 md:col-span-2">
                <div className="font-bold text-ink flex items-center gap-1.5 border-b border-line pb-1 text-[11px] uppercase tracking-wider text-ink-muted">
                  <Calendar className="w-3.5 h-3.5 text-accent" />
                  <span>Thâm Niên &amp; Quỹ Phép Năm</span>
                </div>
                <div className="grid grid-cols-3 gap-3 text-[11px]">
                  <div className="p-2 bg-canvas rounded-lg border border-line">
                    <span className="text-ink-muted block text-[10px]">Thâm niên</span>
                    <strong className="text-ink">{viewDetailEmp.seniorityYears ?? 0} năm {viewDetailEmp.seniorityMonths ?? 0} tháng</strong>
                  </div>
                  <div className="p-2 bg-canvas rounded-lg border border-line">
                    <span className="text-ink-muted block text-[10px]">Phép thâm niên</span>
                    <strong className="text-ink">+{viewDetailEmp.seniorityDays ?? '0'} ngày</strong>
                  </div>
                  <div className="p-2 bg-canvas rounded-lg border border-line">
                    <span className="text-ink-muted block text-[10px]">Tổng phép năm (tích lũy)</span>
                    <strong className="text-accent">{viewDetailEmp.totalAnnualDays ?? '0'} ngày</strong>
                  </div>
                </div>
              </div>

              {/* Box 3: An ninh & Sinh trắc học */}
              <div className="p-3 bg-surface rounded-xl border border-line space-y-2 md:col-span-2">
                <div className="font-bold text-ink flex items-center gap-1.5 border-b border-line pb-1 text-[11px] uppercase tracking-wider text-ink-muted">
                  <Shield className="w-3.5 h-3.5 text-accent" />
                  <span>An Ninh Tài Khoản &amp; Chấm Công Sinh Trắc Học</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-[11px]">
                  <div className="p-2 bg-canvas rounded-lg border border-line flex items-center justify-between">
                    <div>
                      <span className="text-ink-muted block text-[10px]">Đổi mật khẩu lần đầu:</span>
                      <strong className={viewDetailEmp.mustChangePassword ? 'text-status-warn' : 'text-status-ok'}>
                        {viewDetailEmp.mustChangePassword ? 'Chờ đổi pass' : 'Đã hoàn tất đổi mật khẩu'}
                      </strong>
                    </div>
                    {viewDetailEmp.mustChangePassword && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-status-warn/15 text-status-warn border border-status-warn/30">
                        Cưỡng chế
                      </span>
                    )}
                  </div>
                  <div className="p-2 bg-canvas rounded-lg border border-line flex items-center justify-between">
                    <div>
                      <span className="text-ink-muted block text-[10px]">Khuôn mặt sinh trắc học:</span>
                      <strong className={viewDetailEmp.faceEnrolled ? 'text-status-ok' : 'text-status-danger'}>
                        {viewDetailEmp.faceEnrolled ? 'Đã đăng ký (Ready)' : 'Chưa đăng ký (Pending)'}
                      </strong>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${viewDetailEmp.faceEnrolled ? 'bg-status-ok/15 text-status-ok border border-status-ok/30' : 'bg-status-danger/15 text-status-danger border border-status-danger/30'}`}>
                      {viewDetailEmp.faceEnrolled ? '1:N Face' : 'Cần enroll'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions inside Drawer */}
            <div className="flex justify-between items-center pt-3 border-t border-line">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    const emp = viewDetailEmp;
                    setViewDetailEmp(null);
                    handleOpenEdit(emp);
                  }}
                  className="gap-1.5"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Sửa Hồ Sơ</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const emp = viewDetailEmp;
                    setViewDetailEmp(null);
                    handleOpenChangeManager(emp);
                  }}
                >
                  Đổi Sếp
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const emp = viewDetailEmp;
                    setViewDetailEmp(null);
                    handleOpenChangeTeam(emp);
                  }}
                >
                  Chuyển Nhóm
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const emp = viewDetailEmp;
                    setViewDetailEmp(null);
                    handleAdminResetPassword(emp);
                  }}
                  className="text-status-warn hover:text-status-warn-line"
                >
                  Cấp Lại Pass
                </Button>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setViewDetailEmp(null)}
              >
                Đóng
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: Chỉnh Sửa Hồ Sơ Nhân Viên (Edit Employee - CRUD) */}
      {isEditModalOpen && editForm && (
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditForm(null);
          }}
          title={`Chỉnh Sửa Hồ Sơ Nhân Viên — ${editForm.fullName} (${editForm.employeeCode})`}
        >
          <form onSubmit={handleSubmitEdit} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-ink mb-1">Mã Nhân Viên (Không sửa)</label>
                <input
                  type="text"
                  disabled
                  value={editForm.employeeCode}
                  className="w-full text-xs p-2.5 rounded-lg border border-line bg-surface text-ink-muted font-mono font-bold cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block font-semibold text-ink mb-1">Họ và Tên *</label>
                <input
                  type="text"
                  required
                  value={editForm.fullName}
                  onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-lg border border-line bg-canvas text-ink focus:outline-none focus:border-accent font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-ink mb-1">Email Công Ty *</label>
                <input
                  type="email"
                  required
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-lg border border-line bg-canvas text-ink focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block font-semibold text-ink mb-1">Chức Danh / Vị Trí *</label>
                <input
                  type="text"
                  required
                  value={editForm.positionName || ''}
                  onChange={(e) => setEditForm({ ...editForm, positionName: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-lg border border-line bg-canvas text-ink focus:outline-none focus:border-accent"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-ink mb-1">Nhóm Làm Việc</label>
                <select
                  value={editForm.team}
                  onChange={(e) => setEditForm({ ...editForm, team: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-lg border border-line bg-canvas text-ink focus:outline-none focus:border-accent"
                >
                  {teams.map((t) => (
                    <option key={t.id} value={t.name}>Nhóm {t.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-ink mb-1">Quản Lý Trực Tiếp</label>
                <select
                  value={editForm.managerId || ''}
                  onChange={(e) => setEditForm({ ...editForm, managerId: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-lg border border-line bg-canvas text-ink focus:outline-none focus:border-accent"
                >
                  <option value="">-- Chưa thiết lập --</option>
                  {availableManagers
                    .filter((m) => m.id !== editForm.id)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.fullName} ({m.employeeCode}) - {m.role}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-ink mb-1">Vai Trò (Role)</label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value as any })}
                  className="w-full text-xs p-2.5 rounded-lg border border-line bg-canvas text-ink focus:outline-none focus:border-accent font-bold"
                >
                  <option value="EMPLOYEE">EMPLOYEE (Nhân viên)</option>
                  <option value="MANAGER">MANAGER (Quản lý)</option>
                  <option value="HR_ADMIN">HR_ADMIN (Quản trị nhân sự)</option>
                  <option value="ADMIN">ADMIN (Quản trị toàn quyền)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-ink mb-1">Trạng Thái Tài Khoản</label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value as any })}
                  className="w-full text-xs p-2.5 rounded-lg border border-line bg-canvas text-ink focus:outline-none focus:border-accent font-bold"
                >
                  <option value="ACTIVE">ACTIVE (Đang hoạt động)</option>
                  <option value="PENDING_ACTIVATION">PENDING_ACTIVATION (Chờ kích hoạt)</option>
                  <option value="LOCKED">LOCKED (Tạm khóa)</option>
                  <option value="INACTIVE">INACTIVE (Ngừng công tác)</option>
                </select>
              </div>
            </div>

            {/* Bắt buộc nhập lý do theo chuẩn kiểm toán A5 */}
            <div>
              <label className="block font-semibold text-ink mb-1">
                Lý Do Chỉnh Sửa Hồ Sơ * <span className="text-[10px] text-accent font-normal">(Yêu cầu kiểm toán A5)</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ví dụ: Bổ nhiệm chức danh mới theo quyết định số 45/QĐ-HR"
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                className="w-full text-xs p-2.5 rounded-lg border border-line bg-canvas text-ink focus:outline-none focus:border-accent"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-line">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditForm(null);
                }}
              >
                Hủy
              </Button>
              <Button type="submit" variant="primary" size="sm">
                Lưu Thay Đổi
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL IMPORT NHÂN VIÊN TỪ FILE EXCEL */}
      {isImportModalOpen && (
        <Modal
          isOpen={isImportModalOpen}
          onClose={() => {
            setIsImportModalOpen(false);
            setImportResult(null);
            setImportFile(null);
            setImportError(null);
          }}
          title="Import Danh Sách Nhân Viên Từ File Excel"
          maxWidth="4xl"
        >
          {!importResult ? (
            <div className="space-y-5 text-ink">
              {/* Bước 1: Tải file mẫu */}
              <div className="rounded-xl border border-line bg-canvas p-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-accent flex items-center gap-1.5">
                      <Download className="h-4 w-4 text-accent" />
                      Bước 1: Tải File Mẫu Chuẩn Ascend Tech (.xlsx)
                    </h4>
                    <p className="text-xs text-ink-muted mt-1">
                      File mẫu có sẵn tiêu đề chuẩn theo đúng cấu trúc Hồ sơ cá nhân (Mã NV, Họ tên, SĐT, Email, Phòng ban, Nhóm, Chức danh, Quản lý trực tiếp, Ngày vào làm), kèm dữ liệu mẫu và sheet Danh mục tham chiếu.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadTemplate}
                    disabled={isDownloadingTemplate}
                    className="shrink-0 border-accent/40 text-accent hover:bg-accent/10"
                  >
                    {isDownloadingTemplate ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                    {isDownloadingTemplate ? 'Đang tải...' : 'Tải File Mẫu Excel'}
                  </Button>
                </div>
              </div>

              {/* Bước 2: Upload file */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-ink mb-2">
                  Bước 2: Chọn File Excel Dữ Liệu Nhân Viên (.xlsx, .xls)
                </label>
                <div
                  className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${
                    importFile
                      ? 'border-status-ok-line bg-status-ok-soft/40'
                      : 'border-line hover:border-accent bg-canvas/50'
                  }`}
                >
                  <input
                    type="file"
                    accept=".xlsx, .xls"
                    id="excel-file-upload"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setImportFile(e.target.files[0]);
                        setImportError(null);
                      }
                    }}
                  />
                  {!importFile ? (
                    <label
                      htmlFor="excel-file-upload"
                      className="cursor-pointer flex flex-col items-center justify-center gap-2"
                    >
                      <div className="w-12 h-12 rounded-full bg-surface border border-line flex items-center justify-center text-ink-muted hover:text-accent shadow-xs">
                        <UploadCloud className="h-6 w-6 text-accent" />
                      </div>
                      <span className="text-xs font-semibold text-ink">
                        Bấm để chọn file hoặc kéo thả file Excel vào đây
                      </span>
                      <span className="text-[11px] text-ink-muted">
                        Hỗ trợ định dạng .xlsx, .xls (Dung lượng tối đa 15MB)
                      </span>
                    </label>
                  ) : (
                    <div className="flex items-center justify-between gap-4 p-2 bg-surface rounded-lg border border-line">
                      <div className="flex items-center gap-3 overflow-hidden text-left">
                        <div className="w-10 h-10 rounded-lg bg-status-ok-soft flex items-center justify-center text-status-ok shrink-0">
                          <FileSpreadsheet className="h-5 w-5" />
                        </div>
                        <div className="truncate">
                          <p className="text-xs font-bold text-ink truncate">{importFile.name}</p>
                          <p className="text-[10px] text-ink-muted">
                            {(importFile.size / 1024).toFixed(1)} KB • Sẵn sàng import
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <label
                          htmlFor="excel-file-upload"
                          className="text-xs text-accent hover:underline cursor-pointer px-2 py-1 font-semibold"
                        >
                          Đổi file khác
                        </label>
                        <button
                          type="button"
                          onClick={() => setImportFile(null)}
                          className="w-7 h-7 rounded-md text-ink-muted hover:text-status-danger hover:bg-canvas flex items-center justify-center"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Bước 3: Cấu hình gửi email */}
              <div className="rounded-xl border border-line bg-canvas/60 p-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sendActivationEmail}
                    onChange={(e) => setSendActivationEmail(e.target.checked)}
                    className="mt-0.5 rounded border-line text-accent focus:ring-accent h-4 w-4 cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-bold text-ink">
                      Tự động gửi email thông báo kích hoạt & mật khẩu cho từng nhân viên qua Gmail Doanh Nghiệp
                    </span>
                    <p className="text-[11px] text-ink-muted mt-0.5">
                      Nếu bỏ chọn, hệ thống vẫn khởi tạo đầy đủ tài khoản, và bạn có thể sao chép hoặc tải danh sách tài khoản kèm mật khẩu để bàn giao cho nhân viên.
                    </p>
                  </div>
                </label>
              </div>

              {/* Thông báo lỗi nếu có */}
              {importError && (
                <div className="p-3.5 rounded-lg border border-status-danger-line bg-status-danger-soft text-status-danger text-xs flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{importError}</span>
                </div>
              )}

              {/* Nút hành động */}
              <div className="flex justify-end gap-2 pt-3 border-t border-line">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsImportModalOpen(false)}
                >
                  Hủy
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={handleImportExcel}
                  disabled={!importFile || isImporting}
                >
                  {isImporting ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" />
                      Đang Xử Lý Import...
                    </>
                  ) : (
                    <>
                      <FileCheck className="h-3.5 w-3.5 mr-1" />
                      Bắt Đầu Import Excel
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            /* Màn hình kết quả sau khi import */
            <div className="space-y-4 text-ink">
              {/* Thẻ tóm tắt kết quả */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border border-line bg-surface p-3.5">
                  <span className="text-[11px] font-bold uppercase text-ink-muted">Tổng số dòng xử lý</span>
                  <p className="text-xl font-black text-ink mt-1">{importResult.totalRows}</p>
                </div>
                <div className="rounded-xl border border-status-ok-line bg-status-ok-soft p-3.5">
                  <span className="text-[11px] font-bold uppercase text-status-ok flex items-center gap-1">
                    <CheckCircle className="h-3.5 w-3.5" />
                    Import Thành Công
                  </span>
                  <p className="text-xl font-black text-status-ok mt-1">
                    {importResult.successCount} nhân viên
                  </p>
                </div>
                <div className={`rounded-xl border p-3.5 ${
                  importResult.errorCount > 0
                    ? 'border-status-danger-line bg-status-danger-soft text-status-danger'
                    : 'border-line bg-surface text-ink-muted'
                }`}>
                  <span className="text-[11px] font-bold uppercase flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Dòng Lỗi / Bỏ Qua
                  </span>
                  <p className={`text-xl font-black mt-1 ${importResult.errorCount > 0 ? 'text-status-danger' : 'text-ink'}`}>
                    {importResult.errorCount} dòng
                  </p>
                </div>
              </div>

              {/* Bảng lỗi chi tiết nếu có */}
              {importResult.errorList.length > 0 && (
                <div className="rounded-xl border border-status-danger-line bg-status-danger-soft/30 p-3.5">
                  <h4 className="text-xs font-bold text-status-danger flex items-center gap-1.5 mb-2">
                    <AlertCircle className="h-4 w-4" />
                    Danh sách dòng bị lỗi ({importResult.errorList.length})
                  </h4>
                  <div className="max-h-40 overflow-y-auto border border-status-danger-line/50 rounded-lg bg-surface">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-canvas border-b border-line text-ink-muted sticky top-0">
                        <tr>
                          <th className="p-2 font-bold w-16">Dòng #</th>
                          <th className="p-2 font-bold w-28">Mã NV</th>
                          <th className="p-2 font-bold">Họ tên / Email</th>
                          <th className="p-2 font-bold text-status-danger">Nguyên nhân lỗi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {importResult.errorList.map((err, idx) => (
                          <tr key={idx} className="hover:bg-status-danger-soft/20">
                            <td className="p-2 font-mono font-bold text-ink-muted">#{err.rowNumber}</td>
                            <td className="p-2 font-mono">{err.employeeCode || '—'}</td>
                            <td className="p-2">
                              <span className="font-semibold text-ink">{err.fullName || '—'}</span>
                              {err.email && <span className="text-[11px] text-ink-muted block font-mono">{err.email}</span>}
                            </td>
                            <td className="p-2 text-status-danger font-medium">{err.errorMessage}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Bảng danh sách nhân viên đã tạo thành công */}
              {importResult.successList.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-ink flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-status-ok" />
                      Tài khoản vừa khởi tạo ({importResult.successList.length})
                    </h4>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleCopyAllImportCredentials}
                        className="text-xs border-accent-line text-accent"
                      >
                        {copiedImportCredentials ? <Check className="h-3.5 w-3.5 text-status-ok" /> : <Copy className="h-3.5 w-3.5" />}
                        {copiedImportCredentials ? 'Đã sao chép!' : 'Sao chép thông tin tài khoản'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleExportImportResultCsv}
                        className="text-xs border-line"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Tải CSV kết quả
                      </Button>
                    </div>
                  </div>

                  <div className="max-h-64 overflow-y-auto border border-line rounded-xl bg-surface">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-canvas border-b border-line text-ink-muted sticky top-0 z-10">
                        <tr>
                          <th className="p-2.5 font-bold">Mã NV</th>
                          <th className="p-2.5 font-bold">Họ và tên</th>
                          <th className="p-2.5 font-bold">Email / SĐT</th>
                          <th className="p-2.5 font-bold">Phòng ban</th>
                          <th className="p-2.5 font-bold">Nhóm</th>
                          <th className="p-2.5 font-bold">Chức danh / Vai trò</th>
                          <th className="p-2.5 font-bold">Quản lý trực tiếp</th>
                          <th className="p-2.5 font-bold">Mật khẩu khởi tạo</th>
                          <th className="p-2.5 font-bold text-center">Gửi mail</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {importResult.successList.map((emp) => (
                          <tr key={emp.employeeCode} className="hover:bg-canvas/50">
                            <td className="p-2.5 font-mono font-bold text-accent">{emp.employeeCode}</td>
                            <td className="p-2.5 font-bold text-ink">{emp.fullName}</td>
                            <td className="p-2.5">
                              <span className="font-mono text-ink-muted block">{emp.email}</span>
                              {emp.phone && <span className="text-[11px] text-ink-muted block font-mono">{emp.phone}</span>}
                            </td>
                            <td className="p-2.5">
                              <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-accent-soft text-accent-dark">
                                {emp.departmentName || emp.teamName}
                              </span>
                            </td>
                            <td className="p-2.5">
                              <span className="text-[11px] font-medium text-ink">
                                {emp.teamName || '—'}
                              </span>
                            </td>
                            <td className="p-2.5">
                              <span className="text-ink font-medium block">{emp.positionName}</span>
                              <span className="text-[10px] text-ink-muted uppercase font-mono">{emp.role}</span>
                            </td>
                            <td className="p-2.5">
                              <span className="text-[11px] font-medium text-ink block">{emp.managerName || emp.managerCode || '—'}</span>
                            </td>
                            <td className="p-2.5">
                              <code className="px-2 py-1 rounded bg-canvas border border-line font-mono font-bold text-ink text-[11px]">
                                {emp.defaultPassword}
                              </code>
                            </td>
                            <td className="p-2.5 text-center">
                              {emp.emailSent ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-status-ok-soft text-status-ok">
                                  <Check className="h-3 w-3" />
                                  Đã gửi
                                </span>
                              ) : (
                                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-canvas text-ink-muted" title={emp.emailStatusMessage}>
                                  Chưa gửi
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Nút đóng */}
              <div className="flex justify-between items-center pt-3 border-t border-line">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setImportResult(null);
                    setImportFile(null);
                    setImportError(null);
                  }}
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1" />
                  Import file khác
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setIsImportModalOpen(false);
                    setImportResult(null);
                    setImportFile(null);
                    setImportError(null);
                  }}
                >
                  Hoàn Tất & Đóng
                </Button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
};
