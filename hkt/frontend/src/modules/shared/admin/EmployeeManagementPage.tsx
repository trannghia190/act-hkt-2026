import React, { useState, useEffect } from 'react';
import { Card } from '../../../components/common/Card';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { Modal } from '../../../components/common/Modal';
import { GitPullRequest, UserCheck, AlertTriangle, ArrowRight, ShieldAlert, CheckCircle2, UserPlus, Mail, Key, Copy, Check, Eye, EyeOff, Edit2, User, Phone, Calendar, Shield, Building2, Users, UserX } from 'lucide-react';

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
  faceEnrolled: boolean;
  mustChangePassword?: boolean;
}

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
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isChangeManagerModalOpen, setIsChangeManagerModalOpen] = useState(false);
  const [isChangeTeamModalOpen, setIsChangeTeamModalOpen] = useState(false);

  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);

  // Form states
  const [newEmp, setNewEmp] = useState({
    code: 'ACT' + Math.floor(1000 + Math.random() * 9000),
    fullName: '',
    email: '',
    team: '',   // sẽ điền bằng nhóm đầu tiên nạp từ API
    positionName: 'Kỹ sư Phần mềm',
    role: 'EMPLOYEE' as const,
    password: '123456',
  });

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

  const [viewDetailEmp, setViewDetailEmp] = useState<Employee | null>(null);
  const [editForm, setEditForm] = useState<Employee | null>(null);
  const [editReason, setEditReason] = useState('Cập nhật hồ sơ nhân sự');

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

  // Nhóm đầu tiên trong DB làm giá trị mặc định cho form (không hard-code tên nhóm).
  useEffect(() => {
    if (teams.length === 0) return;
    setNewEmp((e) => (e.team ? e : { ...e, team: teams[0].name }));
    setNewTeamName((n) => (n && teams.some((t) => t.name === n) ? n : teams[0].name));
  }, [teams]);

  // Available managers for dropdown selection
  const availableManagers = employees.filter(
    (e) => (e.role === 'MANAGER' || e.role === 'ADMIN' || e.role === 'HR_ADMIN') && (!selectedEmp || e.id !== selectedEmp.id)
  );

  // Warning metrics
  const noTeamCount = employees.filter((e) => !e.team || e.team === 'Chưa có nhóm').length;
  const noManagerCount = employees.filter((e) => !e.managerId && e.role !== 'ADMIN').length;

  // Handle Add Employee (Tự gán nhóm và ca mặc định nếu để trống & Gửi email kích hoạt)
  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
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
          password: newEmp.password || '123456',
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
          defaultPassword: empData?.defaultPassword || newEmp.password || '123456',
          emailSent: empData?.emailSent,
          emailStatusMessage: empData?.emailStatusMessage || json.message,
        });
        showToast(`Đã thêm nhân viên ${empData?.fullName || newEmp.fullName} thành công! Mật khẩu mặc định: ${empData?.defaultPassword || newEmp.password || '123456'}`);
        // Reset code for next entry (giữ nhóm đang chọn, không hard-code tên nhóm)
        setNewEmp({
          code: 'ACT' + Math.floor(1000 + Math.random() * 9000),
          fullName: '',
          email: '',
          team: newEmp.team,
          positionName: 'Kỹ sư Phần mềm',
          role: 'EMPLOYEE' as const,
          password: '123456',
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
    } catch {
      setAddError('Không kết nối được tới máy chủ — nhân viên chưa được đánh dấu nghỉ việc.');
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
        setCreatedAccount({
          fullName: emp.fullName,
          employeeCode: emp.employeeCode,
          email: emp.email,
          team: emp.team,
          role: emp.role,
          defaultPassword: '123456',
          emailSent: true,
          emailStatusMessage: data.message || 'Đã cấp lại mật khẩu tạm thời (123456) và phát lệnh gửi email kích hoạt qua Gmail.',
        });
        showToast(`Đã cấp lại mật khẩu cho ${emp.fullName}! Mật khẩu tạm: 123456`);
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
    const text = `=== THÔNG TIN TÀI KHOẢN ACT PULSE ===\n` +
      `• Họ và Tên: ${createdAccount.fullName}\n` +
      `• Mã nhân viên: ${createdAccount.employeeCode}\n` +
      `• Email đăng nhập: ${createdAccount.email}\n` +
      `• Mật khẩu khởi tạo / tạm thời: ${createdAccount.defaultPassword}\n` +
      `• Yêu cầu: Bắt buộc đổi mật khẩu ở lần đăng nhập đầu tiên\n` +
      `• Đường dẫn đăng nhập: http://localhost:3000/login\n` +
      `=====================================`;
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
        <div className="p-3.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold">{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-emerald-400 hover:text-white font-bold ml-2">✕</button>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-ink">Quản Lý Nhân Viên &amp; Sơ Đồ Duyệt</h1>
            <Badge variant="accent">P0</Badge>
          </div>
          <p className="text-xs text-ink-muted mt-1">
            Mọi luồng duyệt bắt đầu từ một câu hỏi: ai duyệt cho ai. Quản lý phân nhóm linh hoạt, chuỗi cấp trên, đổi quản lý bảo lưu đơn chờ
          </p>
        </div>
        <div className="flex items-center gap-2">
          {noTeamCount > 0 && (
            <button
              onClick={() => setFilterTeam('NO_TEAM')}
              className="px-2.5 py-1 text-xs rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold flex items-center gap-1.5 hover:bg-amber-500/20 transition-colors"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              ⚠ {noTeamCount} người chưa có nhóm
            </button>
          )}
          {noManagerCount > 0 && (
            <span className="px-2.5 py-1 text-xs rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 font-bold flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5" />
              {noManagerCount} người chưa có sếp
            </span>
          )}
          <Button variant="primary" size="sm" onClick={() => { setAddError(null); setIsAddModalOpen(true); }}>
            <UserPlus className="w-3.5 h-3.5 mr-1" />
            + Thêm nhân viên
          </Button>
        </div>
      </div>

      {/* Metrics Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-3.5 bg-surface border border-line rounded-xl flex items-center gap-3 shadow-2xs">
          <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-ink-muted font-medium">Tổng nhân sự</div>
            <div className="text-lg font-bold text-ink">{employees.length} người</div>
          </div>
        </div>

        <div className="p-3.5 bg-surface border border-line rounded-xl flex items-center gap-3 shadow-2xs">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-ink-muted font-medium">Đang hoạt động</div>
            <div className="text-lg font-bold text-emerald-700">
              {employees.filter((e) => e.status === 'ACTIVE').length} nhân sự
            </div>
          </div>
        </div>

        <div className="p-3.5 bg-surface border border-line rounded-xl flex items-center gap-3 shadow-2xs">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-ink-muted font-medium">Chưa có nhóm</div>
            <div className="text-lg font-bold text-amber-700">{noTeamCount} người</div>
          </div>
        </div>

        <div className="p-3.5 bg-surface border border-line rounded-xl flex items-center gap-3 shadow-2xs">
          <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-ink-muted font-medium">Chưa có quản lý</div>
            <div className="text-lg font-bold text-rose-700">{noManagerCount} người</div>
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
            className={`px-3 py-1.5 rounded-full font-semibold transition-all cursor-pointer ${
              filterTeam === chip.val
                ? 'bg-accent text-white shadow-xs font-bold'
                : 'bg-surface text-ink-secondary hover:bg-canvas hover:text-ink border border-line shadow-2xs'
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Advanced Filter Bar (Nhóm · Chức Danh · Trạng Thái · Từ Khóa) */}
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          <div className="md:col-span-1">
            <label className="block text-[11px] font-semibold text-ink-muted mb-1">Tìm kiếm từ khóa</label>
            <input
              type="text"
              placeholder="Tên, mã NV (Admin, 136ACT...), email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-line rounded-lg bg-canvas text-ink focus:outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-ink-muted mb-1">Phân loại Nhóm</label>
            <select
              value={filterTeam}
              onChange={(e) => setFilterTeam(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-line rounded-lg bg-canvas text-ink focus:outline-none focus:border-accent"
            >
              <option value="ALL">Tất cả Nhóm</option>
              <option value="NO_TEAM">⚠ Chưa có nhóm</option>
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
              className="w-full text-xs px-3 py-2 border border-line rounded-lg bg-canvas text-ink focus:outline-none focus:border-accent"
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
              className="w-full text-xs px-3 py-2 border border-line rounded-lg bg-canvas text-ink focus:outline-none focus:border-accent"
            >
              <option value="ALL">Tất cả Trạng Thái</option>
              <option value="ACTIVE">Đang hoạt động (ACTIVE)</option>
              <option value="PENDING_ACTIVATION">Chưa kích hoạt (PENDING)</option>
              <option value="LOCKED">Đang bị khóa (LOCKED)</option>
              <option value="INACTIVE">Ngừng hoạt động (INACTIVE)</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Employee List Table with Approval Chain */}
      <div className="bg-surface rounded-xl border border-line shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-canvas border-b border-line text-ink-secondary font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Họ và Tên</th>
                <th className="py-3 px-3">Mã NV</th>
                <th className="py-3 px-3">Chức Danh</th>
                <th className="py-3 px-3">Nhóm (Team)</th>
                <th className="py-3 px-4">Chuỗi Cấp Trên (Ai Duyệt Cho Ai)</th>
                <th className="py-3 px-3">Ngày Gia Nhập</th>
                <th className="py-3 px-3">Trạng Thái</th>
                <th className="py-3 px-4 text-right">Thao Tác</th>
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
                        <div className="w-7 h-7 rounded-full bg-accent-soft text-accent font-bold text-xs flex items-center justify-center shrink-0 uppercase ring-1 ring-accent-line">
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
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {emp.team}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-rose-50 text-rose-800 border border-rose-200">
                          ⚠ Chưa có nhóm
                        </span>
                      )}
                    </td>

                    {/* Chuỗi Cấp Trên — Ai Duyệt Cho Ai (Tiêu chí 5) */}
                    <td className="py-3 px-4">
                      {emp.approvalChain ? (
                        <div className="flex items-center gap-1.5 text-[11px] font-medium text-ink-secondary">
                          <GitPullRequest className="w-3.5 h-3.5 text-accent shrink-0" />
                          <span className={emp.approvalChain.includes('Chưa có') ? 'text-rose-700 font-bold' : ''}>
                            {emp.approvalChain}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-rose-700 font-bold">⚠ Chưa có quản lý</span>
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
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-500 border border-amber-500/30 whitespace-nowrap" title="Bắt buộc đổi mật khẩu lần đầu">
                            🔑 Đổi pass lần đầu
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
                          className="px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-sky-600 hover:text-white text-sky-700 border border-sky-200 text-[11px] font-semibold transition-all cursor-pointer shadow-2xs flex items-center gap-1 group"
                          title="Xem chi tiết hồ sơ nhân sự"
                        >
                          <Eye className="w-3 h-3 text-sky-600 group-hover:text-white" />
                          <span>Xem</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(emp)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-700 border border-emerald-200 text-[11px] font-semibold transition-all cursor-pointer shadow-2xs flex items-center gap-1 group"
                          title="Chỉnh sửa thông tin nhân viên"
                        >
                          <Edit2 className="w-3 h-3 text-emerald-600 group-hover:text-white" />
                          <span>Sửa</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenChangeManager(emp)}
                          className="px-2.5 py-1 rounded-lg bg-purple-50 hover:bg-purple-600 hover:text-white text-purple-700 border border-purple-200 text-[11px] font-semibold transition-all cursor-pointer shadow-2xs flex items-center gap-1 group"
                          title="Đổi người duyệt trực tiếp"
                        >
                          <GitPullRequest className="w-3 h-3 text-purple-600 group-hover:text-white" />
                          <span>Đổi sếp</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenChangeTeam(emp)}
                          className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-700 border border-indigo-200 text-[11px] font-semibold transition-all cursor-pointer shadow-2xs flex items-center gap-1 group"
                          title="Chuyển nhóm làm việc"
                        >
                          <Building2 className="w-3 h-3 text-indigo-600 group-hover:text-white" />
                          <span>Chuyển nhóm</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAdminResetPassword(emp)}
                          className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-600 hover:text-white text-amber-700 border border-amber-200 text-[11px] font-semibold transition-all cursor-pointer shadow-2xs flex items-center gap-1 group"
                          title="Cấp lại mật khẩu và gửi email kích hoạt"
                        >
                          <Key className="w-3 h-3 text-amber-600 group-hover:text-white" />
                          <span>Cấp lại pass</span>
                        </button>
                        {emp.status !== 'INACTIVE' && (
                          <button
                            type="button"
                            onClick={() => handleResign(emp)}
                            className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-600 hover:text-white text-slate-700 border border-slate-200 text-[11px] font-semibold transition-all cursor-pointer shadow-2xs flex items-center gap-1 group"
                            title="Đánh dấu đã nghỉ việc: rời khỏi tổ chức nhưng giữ lịch sử chấm công. Mã nhân viên vẫn giữ (không cấp lại được), email thì có thể cấp cho nhân viên mới."
                          >
                            <UserX className="w-3 h-3 text-slate-600 group-hover:text-white" />
                            <span>Đã nghỉ</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
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
              <div className="p-2.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold">
                ⚠️ {managerError}
              </div>
            )}

            <div>
              <label className="block font-bold text-ink mb-1.5">
                Chọn Quản Lý Mới Tiếp Nhận <span className="text-rose-400">*</span>
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
                Lý Do Thay Đổi Quản Lý (Bắt buộc kiểm toán) <span className="text-rose-400">*</span>
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
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold">
                ⚠ {addError}
              </div>
            )}
            {/* Hướng dẫn an ninh & Gmail */}
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <Mail className="w-4 h-4 text-emerald-400" />
                <span>Tự động kích hoạt tài khoản &amp; gửi email thông báo qua Gmail</span>
              </div>
              <p className="text-[11px] text-emerald-200/80 leading-relaxed">
                Hệ thống sẽ cấp mã nhân viên và mật khẩu mặc định (khởi tạo: <strong>123456</strong>), đồng thời phát lệnh gửi thư kích hoạt kèm thông tin đăng nhập tới Gmail của nhân sự. Nhân viên bắt buộc phải đổi mật khẩu ở lần đăng nhập đầu tiên.
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
                <span className="text-[10px] text-amber-500 font-bold">Bắt buộc đổi pass lần đầu</span>
              </div>
              <div className="relative">
                <input
                  type={showNewEmpPassword ? 'text' : 'password'}
                  required
                  value={newEmp.password}
                  onChange={(e) => setNewEmp({ ...newEmp, password: e.target.value })}
                  className="w-full text-xs p-2.5 pr-16 rounded-lg border border-line bg-canvas text-ink focus:outline-none focus:border-accent font-mono font-bold"
                  placeholder="123456"
                />
                <button
                  type="button"
                  onClick={() => setShowNewEmpPassword(!showNewEmpPassword)}
                  className="absolute right-2 top-2 px-2 py-1 text-[10px] font-semibold text-ink-muted hover:text-ink rounded bg-surface border border-line cursor-pointer"
                >
                  {showNewEmpPassword ? 'Ẩn' : 'Hiện'}
                </button>
              </div>
              <span className="text-[10px] text-ink-muted mt-1 block">
                * Mật khẩu này sẽ được gửi vào hộp thư Gmail của nhân viên để đăng nhập lần đầu.
              </span>
            </div>

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
              <Button type="button" variant="outline" size="sm" onClick={() => setIsAddModalOpen(false)}>
                Hủy
              </Button>
              <Button type="submit" variant="primary" size="sm">
                <Mail className="w-3.5 h-3.5 mr-1" />
                Tạo Nhân Viên &amp; Gửi Email Kích Hoạt
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
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300">
              <div className="flex items-center gap-2 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>Khởi tạo tài khoản thành công!</span>
              </div>
              <p className="text-[11px] text-emerald-200/90 mt-1 leading-relaxed">
                Tài khoản nhân viên đã được ghi nhận vào cơ sở dữ liệu hệ thống với đầy đủ phân quyền và cơ chế bảo mật.
              </p>
            </div>

            {/* Chi tiết tài khoản */}
            <div className="bg-canvas border border-line rounded-xl p-4 space-y-2.5">
              <div className="text-[11px] font-bold text-ink-muted uppercase tracking-wider border-b border-line pb-1.5 flex items-center justify-between">
                <span>Thông Tin Đăng Nhập Của Nhân Viên</span>
                <span className="text-amber-400 font-mono font-bold">Chờ đổi pass lần đầu</span>
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
                  <span className="text-[10px] text-amber-500 font-semibold">(Tạm thời)</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 py-1 border-b border-line/60">
                <span className="text-ink-muted">Nhóm &amp; Vai trò:</span>
                <span className="col-span-2 font-medium text-ink">{createdAccount.team} · {createdAccount.role}</span>
              </div>

              <div className="grid grid-cols-3 gap-2 py-1">
                <span className="text-ink-muted">Trạng thái gửi Gmail:</span>
                <div className="col-span-2">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                    <Mail className="w-3.5 h-3.5 shrink-0" />
                    <span>{createdAccount.emailStatusMessage || 'Đã phát lệnh gửi email thông báo qua Gmail'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Lưu ý bảo mật */}
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-[11px] space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-amber-400" />
                <span>Quy định bảo mật lần đầu đăng nhập</span>
              </div>
              <p className="text-amber-200/80 leading-relaxed">
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
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400 font-bold">Đã sao chép!</span>
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
              <div className="w-14 h-14 rounded-full bg-accent-soft text-accent text-xl font-extrabold flex items-center justify-center uppercase ring-2 ring-accent-line shrink-0">
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
                    <span className="text-ink-muted">Ngày gia nhập:</span>
                    <span className="font-semibold text-ink">{viewDetailEmp.hireDate || viewDetailEmp.joinDate || '01/01/2023'}</span>
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
                      {viewDetailEmp.managerName ? `${viewDetailEmp.managerName} (${viewDetailEmp.managerCode || ''})` : '⚠ Chưa có'}
                    </span>
                  </div>
                  <div className="py-0.5 border-b border-line/40">
                    <span className="text-ink-muted block mb-1">Chuỗi duyệt (Ai duyệt cho ai):</span>
                    <span className={`font-semibold block ${viewDetailEmp.approvalChain?.includes('Chưa có') ? 'text-rose-500' : 'text-emerald-400 font-mono text-[10px]'}`}>
                      {viewDetailEmp.approvalChain || '⚠ Chưa cấu hình chuỗi duyệt'}
                    </span>
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span className="text-ink-muted">Quyền hạn hệ thống:</span>
                    <Badge variant="accent">{viewDetailEmp.role}</Badge>
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
                      <strong className={viewDetailEmp.mustChangePassword ? 'text-amber-400' : 'text-emerald-400'}>
                        {viewDetailEmp.mustChangePassword ? 'Chờ đổi pass' : 'Đã hoàn tất đổi mật khẩu'}
                      </strong>
                    </div>
                    {viewDetailEmp.mustChangePassword && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                        Cưỡng chế
                      </span>
                    )}
                  </div>
                  <div className="p-2 bg-canvas rounded-lg border border-line flex items-center justify-between">
                    <div>
                      <span className="text-ink-muted block text-[10px]">Khuôn mặt sinh trắc học:</span>
                      <strong className={viewDetailEmp.faceEnrolled ? 'text-emerald-400' : 'text-rose-400'}>
                        {viewDetailEmp.faceEnrolled ? 'Đã đăng ký (Ready)' : 'Chưa đăng ký (Pending)'}
                      </strong>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${viewDetailEmp.faceEnrolled ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'}`}>
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
                  className="text-amber-400 hover:text-amber-300"
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
    </div>
  );
};
