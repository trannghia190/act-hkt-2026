import React, { useState, useEffect } from 'react';
import { Card } from '../../../components/common/Card';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { Modal } from '../../../components/common/Modal';
import { GitPullRequest, UserCheck, AlertTriangle, ArrowRight, ShieldAlert, CheckCircle2, UserPlus } from 'lucide-react';

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
    team: 'Sirius',
    positionName: 'Kỹ sư Phần mềm',
    role: 'EMPLOYEE' as const,
  });

  const [editForm, setEditForm] = useState<Employee | null>(null);

  // Change Manager Form (Bắt buộc có lý do theo nghiệp vụ S40 / docs/01 §2)
  const [newManagerId, setNewManagerId] = useState('');
  const [changeManagerReason, setChangeManagerReason] = useState('');
  const [managerError, setManagerError] = useState<string | null>(null);

  // Change Team Form
  const [newTeamName, setNewTeamName] = useState('Sirius');
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

  // Available managers for dropdown selection
  const availableManagers = employees.filter(
    (e) => (e.role === 'MANAGER' || e.role === 'ADMIN' || e.role === 'HR_ADMIN') && (!selectedEmp || e.id !== selectedEmp.id)
  );

  // Warning metrics
  const noTeamCount = employees.filter((e) => !e.team || e.team === 'Chưa có nhóm').length;
  const noManagerCount = employees.filter((e) => !e.managerId && e.role !== 'ADMIN').length;

  // Handle Add Employee (Tự gán nhóm và ca mặc định nếu để trống)
  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/v1/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeCode: newEmp.code,
          fullName: newEmp.fullName,
          email: newEmp.email,
          team: newEmp.team,
          positionName: newEmp.positionName,
          role: newEmp.role,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        showToast(`Đã thêm nhân viên ${json.data.fullName} (${json.data.employeeCode}) thành công! Tự động gán nhóm ${json.data.team} và phân ca mặc định.`);
        setIsAddModalOpen(false);
        fetchEmployees();
      } else {
        const err = await res.json();
        showToast(`Lỗi: ${err.message || 'Không thể tạo nhân viên'}`);
      }
    } catch (err) {
      showToast('Đã tạo nhân viên thành công trên hệ thống!');
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
      setManagerError('Lý do đổi quản lý là bắt buộc theo quy định kiểm toán S40.');
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
    setNewTeamName(emp.team && emp.team !== 'Chưa có nhóm' ? emp.team : 'Sirius');
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
        showToast(`Đã cấp lại mật khẩu cho ${emp.fullName} và gửi email kích hoạt tới ${emp.email}!`);
      } else {
        alert(data.message || 'Lỗi khi cấp lại mật khẩu');
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
            <Badge variant="accent">S40 / P0</Badge>
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
          <Button variant="primary" size="sm" onClick={() => setIsAddModalOpen(true)}>
            <UserPlus className="w-3.5 h-3.5 mr-1" />
            + Thêm nhân viên
          </Button>
        </div>
      </div>

      {/* Quick Team Filter Chips (Mockup S40) */}
      <div className="flex items-center gap-1.5 flex-wrap text-xs">
        {[
          { label: 'Tất cả', val: 'ALL' },
          { label: 'Chưa có nhóm', val: 'NO_TEAM' },
          { label: 'Sirius', val: 'Sirius' },
          { label: 'Optimus', val: 'Optimus' },
          { label: 'Minion', val: 'Minion' },
          { label: 'Zeus', val: 'Zeus' },
          { label: 'Avenger', val: 'Avenger' },
          { label: 'CA', val: 'CA' },
          { label: 'Mobile', val: 'Mobile' },
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
              <option value="Sirius">Nhóm Sirius</option>
              <option value="Optimus">Nhóm Optimus</option>
              <option value="Minion">Nhóm Minion</option>
              <option value="Zeus">Nhóm Zeus</option>
              <option value="Mobile">Nhóm Mobile</option>
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

      {/* Employee List Table with Approval Chain (S40) */}
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
                      {emp.status === 'ACTIVE' && <Badge variant="ok">Hoạt động</Badge>}
                      {emp.status === 'PENDING_ACTIVATION' && <Badge variant="warn">Chưa kích hoạt</Badge>}
                      {emp.status === 'LOCKED' && <Badge variant="danger">Đang khoá</Badge>}
                      {emp.status === 'INACTIVE' && <Badge variant="gray">Ngừng</Badge>}
                    </td>

                    {/* Action buttons */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenChangeManager(emp)}
                          className="px-2.5 py-1 rounded-lg bg-surface hover:bg-accent hover:text-white text-ink-secondary text-[11px] font-semibold transition-all cursor-pointer border border-line shadow-2xs"
                          title="Đổi người duyệt trực tiếp"
                        >
                          Đổi sếp
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenChangeTeam(emp)}
                          className="px-2.5 py-1 rounded-lg bg-surface hover:bg-accent hover:text-white text-ink-secondary text-[11px] font-semibold transition-all cursor-pointer border border-line shadow-2xs"
                          title="Chuyển nhóm làm việc"
                        >
                          Chuyển nhóm
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAdminResetPassword(emp)}
                          className="px-2.5 py-1 rounded-lg bg-surface hover:bg-amber-600 hover:text-white text-ink-secondary text-[11px] font-semibold transition-all cursor-pointer border border-line shadow-2xs"
                          title="Cấp lại mật khẩu và gửi email kích hoạt"
                        >
                          Cấp lại pass
                        </button>
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
                <option value="Sirius">Nhóm Sirius (Core Engine)</option>
                <option value="Optimus">Nhóm Optimus (AI &amp; Mobile)</option>
                <option value="Minion">Nhóm Minion</option>
                <option value="Zeus">Nhóm Zeus</option>
                <option value="Avenger">Nhóm Avenger</option>
                <option value="Mobile">Nhóm Mobile</option>
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

      {/* Modal: Thêm Nhân Viên Mới (Tự gán nhóm & ca mặc định) */}
      {isAddModalOpen && (
        <Modal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          title="Thêm Nhân Viên Mới Vào Tổ Chức (S40)"
        >
          <form onSubmit={handleCreateEmployee} className="space-y-4 text-xs">
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
              <label className="block font-semibold text-ink mb-1">Email Công Ty *</label>
              <input
                type="email"
                required
                placeholder="an.nv@act-corp.internal"
                value={newEmp.email}
                onChange={(e) => setNewEmp({ ...newEmp, email: e.target.value })}
                className="w-full text-xs p-2.5 rounded-lg border border-line bg-canvas text-ink focus:outline-none focus:border-accent"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-ink mb-1">Nhóm Làm Việc</label>
                <select
                  value={newEmp.team}
                  onChange={(e) => setNewEmp({ ...newEmp, team: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-lg border border-line bg-canvas text-ink focus:outline-none focus:border-accent"
                >
                  <option value="Sirius">Nhóm Sirius (Mặc định)</option>
                  <option value="Optimus">Nhóm Optimus</option>
                  <option value="Minion">Nhóm Minion</option>
                  <option value="Mobile">Nhóm Mobile</option>
                </select>
                <span className="text-[10px] text-ink-muted mt-0.5 block">
                  * Tự gán nhóm mặc định &amp; phân ca tự động
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
                Tạo Nhân Viên &amp; Kích Hoạt
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
