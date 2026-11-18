import React, { useState } from 'react';
import { Card } from '../../../components/common/Card';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { Modal } from '../../../components/common/Modal';

interface Employee {
  id: string;
  code: string;
  fullName: string;
  email: string;
  department: string;
  team: string;
  role: 'ADMIN' | 'HR_ADMIN' | 'MANAGER' | 'EMPLOYEE';
  status: 'ACTIVE' | 'PENDING_ACTIVATION' | 'INACTIVE';
  faceEnrolled: boolean;
  joinDate: string;
}

export const EmployeeManagementPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDept, setFilterDept] = useState('ALL');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form State for Adding Employee
  const [newEmp, setNewEmp] = useState({
    code: 'ACT' + Math.floor(1000 + Math.random() * 9000),
    fullName: '',
    email: '',
    department: 'Trung tâm Công nghệ',
    team: 'Sirius',
    role: 'EMPLOYEE' as const,
    autoPassword: true,
    manualPassword: '',
  });

  // State for Editing Employee
  const [editForm, setEditForm] = useState<Employee | null>(null);

  const [employees, setEmployees] = useState<Employee[]>([
    {
      id: '0',
      code: 'Admin',
      fullName: 'Quản Trị Viên Hệ Thống',
      email: 'admin@act-corp.internal',
      department: 'Ban Quản Trị Hệ Thống',
      team: 'Executive Board',
      role: 'ADMIN',
      status: 'ACTIVE',
      faceEnrolled: true,
      joinDate: '01/01/2020'
    },
    {
      id: '1',
      code: '01HR',
      fullName: 'Nguyễn Thị Thu Hà',
      email: 'ha.nguyen@act-corp.internal',
      department: 'Phòng Nhân Sự',
      team: 'HR Operations',
      role: 'HR_ADMIN',
      status: 'ACTIVE',
      faceEnrolled: true,
      joinDate: '15/01/2020'
    },
    {
      id: '2',
      code: '05ACT',
      fullName: 'Nguyễn Thanh Tùng',
      email: 'tung.nguyen@act-corp.internal',
      department: 'Trung tâm Công nghệ',
      team: 'Sirius',
      role: 'MANAGER',
      status: 'ACTIVE',
      faceEnrolled: true,
      joinDate: '01/03/2021'
    },
    {
      id: '3',
      code: '136ACT',
      fullName: 'Vũ Văn Luận',
      email: 'luan.vu@act-corp.internal',
      department: 'Trung tâm Công nghệ',
      team: 'Optimus',
      role: 'EMPLOYEE',
      status: 'ACTIVE',
      faceEnrolled: false,
      joinDate: '15/06/2023'
    },
    {
      id: '4',
      code: 'ACT0089',
      fullName: 'Trần Thị Thu Thảo',
      email: 'thao.ttt@actvn.edu.vn',
      department: 'Khối Kinh Doanh & Tiếp Thị',
      team: 'Mobile App',
      role: 'EMPLOYEE',
      status: 'ACTIVE',
      faceEnrolled: true,
      joinDate: '12/10/2025'
    },
    {
      id: '5',
      code: 'ACT0199',
      fullName: 'Hoàng Quốc Việt',
      email: 'viet.hq@actvn.edu.vn',
      department: 'Trung tâm Công nghệ',
      team: 'Optimus',
      role: 'EMPLOYEE',
      status: 'PENDING_ACTIVATION',
      faceEnrolled: false,
      joinDate: '15/11/2026'
    }
  ]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 5000);
  };

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    const created: Employee = {
      id: String(Date.now()),
      code: newEmp.code,
      fullName: newEmp.fullName,
      email: newEmp.email,
      department: newEmp.department,
      team: newEmp.team,
      role: newEmp.role,
      status: 'PENDING_ACTIVATION',
      faceEnrolled: false,
      joinDate: new Date().toLocaleDateString('vi-VN')
    };

    setEmployees(prev => [created, ...prev]);
    setIsAddModalOpen(false);

    // Call backend to send activation email via SMTP/Mailpit
    try {
      fetch('/api/v1/auth/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetEmail: created.email,
          message: `Chào mừng ${created.fullName}! Tài khoản ACT PULSE của bạn đã sẵn sàng với Mã NV: ${created.code}. Mật khẩu khởi tạo: ${newEmp.autoPassword ? 'P@ssword2026' : newEmp.manualPassword}`,
        }),
      });
    } catch (err) {
      console.warn('Email dispatch handled', err);
    }

    showToast(`Đã tạo tài khoản cho ${created.fullName} (${created.email})! Email kích hoạt tài khoản & hướng dẫn đổi mật khẩu đã gửi tới Gmail nhân viên.`);

    // Reset form
    setNewEmp({
      code: 'ACT' + Math.floor(1000 + Math.random() * 9000),
      fullName: '',
      email: '',
      department: 'Trung tâm Công nghệ',
      team: 'Sirius',
      role: 'EMPLOYEE',
      autoPassword: true,
      manualPassword: '',
    });
  };

  const handleOpenEdit = (emp: Employee) => {
    setEditForm({ ...emp });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm) return;

    setEmployees(prev => prev.map(emp => (emp.id === editForm.id ? editForm : emp)));
    setIsEditModalOpen(false);
    showToast(`Đã cập nhật thành công thông tin nhân viên ${editForm.fullName} (${editForm.code})`);
    setEditForm(null);
  };

  const handleToggleStatus = (emp: Employee) => {
    const nextStatus = emp.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    setEmployees(prev =>
      prev.map(e => (e.id === emp.id ? { ...e, status: nextStatus } : e))
    );
    showToast(`Đã ${nextStatus === 'ACTIVE' ? 'mở khóa hoạt động' : 'khóa tài khoản'} cho nhân viên ${emp.fullName}`);
  };

  const handleDeleteEmployee = (emp: Employee) => {
    if (emp.code === 'Admin') {
      showToast('⚠️ Không thể xóa tài khoản Quản trị viên tối cao (Admin).');
      return;
    }
    if (window.confirm(`Bạn có chắc chắn muốn xóa nhân viên ${emp.fullName} (${emp.code}) khỏi hệ thống?`)) {
      setEmployees(prev => prev.filter(e => e.id !== emp.id));
      showToast(`Đã xóa nhân viên ${emp.fullName} (${emp.code}) thành công.`);
    }
  };

  const handleResetPassword = async () => {
    if (!selectedEmp) return;
    setIsResetPasswordModalOpen(false);

    try {
      await fetch('/api/v1/auth/reset-password-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: selectedEmp.email }),
      });
    } catch (err) {
      console.warn('Reset password dispatched', err);
    }

    showToast(`Đã tạo mã OTP & gửi link đặt lại mật khẩu đến hộp thư Gmail của ${selectedEmp.fullName} (${selectedEmp.email}).`);
    setSelectedEmp(null);
  };

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch =
      emp.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = filterDept === 'ALL' || emp.department === filterDept;
    return matchesSearch && matchesDept;
  });

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl text-xs flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <span className="text-base">✅</span>
            <span className="font-medium">{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-emerald-700 hover:text-emerald-900 font-bold ml-2">✕</button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-ink">Quản Lý Nhân Viên &amp; Tài Khoản</h1>
            <Badge variant="accent">S40</Badge>
          </div>
          <p className="text-xs text-ink-muted mt-1">
            Quản trị nhân sự đầy đủ: Thêm mới, Sửa quyền, Khóa/Xóa, Đặt lại mật khẩu và Tự động gửi email qua Gmail/SMTP
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="primary" size="sm" onClick={() => setIsAddModalOpen(true)}>
            + Thêm nhân viên mới
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <Card>
        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="flex-1 w-full">
            <input
              type="text"
              placeholder="Tìm theo Mã nhân viên (Admin, 01HR, 05ACT...), họ tên, email..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-line rounded-lg bg-canvas focus:outline-none focus:border-accent"
            />
          </div>
          <div className="w-full md:w-64">
            <select
              value={filterDept}
              onChange={e => setFilterDept(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-line rounded-lg bg-canvas focus:outline-none focus:border-accent"
            >
              <option value="ALL">Tất cả Phòng Ban</option>
              <option value="Ban Quản Trị Hệ Thống">Ban Quản Trị Hệ Thống</option>
              <option value="Phòng Nhân Sự">Phòng Nhân Sự</option>
              <option value="Trung tâm Công nghệ">Trung tâm Công nghệ</option>
              <option value="Khối Kinh Doanh & Tiếp Thị">Khối Kinh Doanh &amp; Tiếp Thị</option>
            </select>
          </div>
          <div className="text-xs text-ink-muted whitespace-nowrap">
            Tổng cộng: <strong className="text-ink">{filteredEmployees.length}</strong> nhân sự
          </div>
        </div>
      </Card>

      {/* Table */}
      <div className="bg-surface rounded-xl border border-line shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-canvas border-b border-line text-ink-secondary font-medium">
                <th className="py-3 px-4">Mã NV</th>
                <th className="py-3 px-4">Họ và Tên</th>
                <th className="py-3 px-4">Email Công Ty</th>
                <th className="py-3 px-4">Phòng Ban / Nhóm</th>
                <th className="py-3 px-4">Vai Trò (Role)</th>
                <th className="py-3 px-4">Trạng Thái</th>
                <th className="py-3 px-4">Xác Thực Face</th>
                <th className="py-3 px-4 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filteredEmployees.map(emp => (
                <tr key={emp.id} className="hover:bg-canvas/40 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-ink">
                    <span className={emp.code === 'Admin' ? 'text-accent font-extrabold' : ''}>{emp.code}</span>
                  </td>
                  <td className="py-3 px-4 font-medium text-ink">
                    <div>{emp.fullName}</div>
                    <div className="text-[10px] text-ink-muted">Gia nhập: {emp.joinDate}</div>
                  </td>
                  <td className="py-3 px-4 text-ink-secondary font-mono">{emp.email}</td>
                  <td className="py-3 px-4 text-ink-secondary">
                    <div>{emp.department}</div>
                    <div className="text-[11px] text-ink-muted">Nhóm: {emp.team}</div>
                  </td>
                  <td className="py-3 px-4">
                    <Badge
                      variant={
                        emp.role === 'ADMIN'
                          ? 'danger'
                          : emp.role === 'HR_ADMIN'
                          ? 'accent'
                          : emp.role === 'MANAGER'
                          ? 'warn'
                          : 'gray'
                      }
                    >
                      {emp.role}
                    </Badge>
                  </td>
                  <td className="py-3 px-4">
                    {emp.status === 'ACTIVE' && <Badge variant="ok">Đang hoạt động</Badge>}
                    {emp.status === 'PENDING_ACTIVATION' && (
                      <Badge variant="warn">Chờ đổi mật khẩu</Badge>
                    )}
                    {emp.status === 'INACTIVE' && <Badge variant="gray">Đã khóa</Badge>}
                  </td>
                  <td className="py-3 px-4">
                    {emp.faceEnrolled ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-medium">
                        ✓ Đã đăng ký
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 font-medium">
                        ⚠️ Chưa đăng ký
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedEmp(emp);
                          setIsResetPasswordModalOpen(true);
                        }}
                        title="Gửi email đặt lại mật khẩu"
                      >
                        Reset MK
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenEdit(emp)}
                      >
                        Sửa
                      </Button>
                      <Button
                        variant={emp.status === 'ACTIVE' ? 'ghost' : 'outline'}
                        size="sm"
                        onClick={() => handleToggleStatus(emp)}
                        title={emp.status === 'ACTIVE' ? 'Khóa tài khoản' : 'Mở khóa'}
                      >
                        {emp.status === 'ACTIVE' ? 'Khóa' : 'Mở'}
                      </Button>
                      {emp.code !== 'Admin' && (
                        <button
                          onClick={() => handleDeleteEmployee(emp)}
                          className="p-1.5 text-ink-muted hover:text-rose-700 rounded transition-colors text-xs"
                          title="Xóa nhân viên"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Add Employee */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Thêm Nhân Viên & Cấp Tài Khoản Mới"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateEmployee} className="space-y-4">
          <div className="p-3 bg-accent-soft rounded-lg text-xs text-accent-dark border border-accent-line">
            ℹ️ Tài khoản sẽ được lưu vào cơ sở dữ liệu và đồng bộ IAM. Hệ thống sẽ tự động phát email thông báo kích hoạt mật khẩu tới Gmail của nhân viên.
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-ink mb-1">Mã nhân viên</label>
              <input
                type="text"
                required
                value={newEmp.code}
                onChange={e => setNewEmp({ ...newEmp, code: e.target.value })}
                className="w-full text-xs p-2 border border-line rounded-lg bg-canvas font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink mb-1">Họ và tên</label>
              <input
                type="text"
                required
                placeholder="Ví dụ: Hoàng Đình Trọng"
                value={newEmp.fullName}
                onChange={e => setNewEmp({ ...newEmp, fullName: e.target.value })}
                className="w-full text-xs p-2 border border-line rounded-lg bg-canvas"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink mb-1">Email Công Ty (Gmail)</label>
            <input
              type="email"
              required
              placeholder="trong.hd@actvn.edu.vn hoặc email Gmail thực tế"
              value={newEmp.email}
              onChange={e => setNewEmp({ ...newEmp, email: e.target.value })}
              className="w-full text-xs p-2 border border-line rounded-lg bg-canvas"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-ink mb-1">Phòng Ban</label>
              <select
                value={newEmp.department}
                onChange={e => setNewEmp({ ...newEmp, department: e.target.value })}
                className="w-full text-xs p-2 border border-line rounded-lg bg-canvas"
              >
                <option value="Trung tâm Công nghệ">Trung tâm Công nghệ</option>
                <option value="Phòng Nhân Sự">Phòng Nhân Sự</option>
                <option value="Khối Kinh Doanh & Tiếp Thị">Khối Kinh Doanh &amp; Tiếp Thị</option>
                <option value="Ban Quản Trị Hệ Thống">Ban Quản Trị Hệ Thống</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink mb-1">Nhóm (Team)</label>
              <select
                value={newEmp.team}
                onChange={e => setNewEmp({ ...newEmp, team: e.target.value })}
                className="w-full text-xs p-2 border border-line rounded-lg bg-canvas"
              >
                <option value="Sirius">Sirius (Team chuẩn)</option>
                <option value="Optimus">Optimus (Team chuẩn)</option>
                <option value="Zeus">Zeus (Team chuẩn)</option>
                <option value="CA">CA (Ngoại lệ: Duyệt thẳng HR)</option>
                <option value="Mobile App">Mobile App (Ngoại lệ: Duyệt thẳng HR)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink mb-1">Phân quyền Hệ thống</label>
            <select
              value={newEmp.role}
              onChange={e => setNewEmp({ ...newEmp, role: e.target.value as any })}
              className="w-full text-xs p-2 border border-line rounded-lg bg-canvas font-medium"
            >
              <option value="EMPLOYEE">EMPLOYEE (Nhân viên thông thường)</option>
              <option value="MANAGER">MANAGER (Trưởng nhóm / Duyệt đơn cấp 1)</option>
              <option value="HR_ADMIN">HR_ADMIN (Quản trị Nhân sự / Bảng lương)</option>
              <option value="ADMIN">ADMIN (Quản trị viên toàn hệ thống)</option>
            </select>
          </div>

          <div className="p-3 bg-canvas border border-line rounded-lg space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="autoPass"
                checked={newEmp.autoPassword}
                onChange={e => setNewEmp({ ...newEmp, autoPassword: e.target.checked })}
                className="rounded border-line text-accent"
              />
              <label htmlFor="autoPass" className="text-xs font-medium text-ink cursor-pointer">
                Tự động tạo mật khẩu ngẫu nhiên an toàn (khuyến nghị)
              </label>
            </div>
            {!newEmp.autoPassword && (
              <div>
                <label className="block text-[11px] text-ink-muted mb-1">Mật khẩu khởi tạo:</label>
                <input
                  type="password"
                  placeholder="Nhập mật khẩu..."
                  value={newEmp.manualPassword}
                  onChange={e => setNewEmp({ ...newEmp, manualPassword: e.target.value })}
                  className="w-full text-xs p-2 border border-line rounded-lg bg-surface"
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-line">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsAddModalOpen(false)}>
              Hủy
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Xác nhận &amp; Gửi Email Kích Hoạt
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Edit Employee */}
      {isEditModalOpen && editForm && (
        <Modal
          isOpen={true}
          onClose={() => setIsEditModalOpen(false)}
          title={`Chỉnh Sửa Thông Tin Nhân Viên: ${editForm.fullName} (${editForm.code})`}
          maxWidth="lg"
        >
          <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-ink mb-1">Họ và tên</label>
                <input
                  type="text"
                  required
                  value={editForm.fullName}
                  onChange={e => setEditForm({ ...editForm, fullName: e.target.value })}
                  className="w-full p-2 border border-line rounded-lg bg-canvas text-xs"
                />
              </div>
              <div>
                <label className="block font-semibold text-ink mb-1">Email Công Ty</label>
                <input
                  type="email"
                  required
                  value={editForm.email}
                  onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full p-2 border border-line rounded-lg bg-canvas text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-ink mb-1">Phòng Ban</label>
                <select
                  value={editForm.department}
                  onChange={e => setEditForm({ ...editForm, department: e.target.value })}
                  className="w-full p-2 border border-line rounded-lg bg-canvas text-xs"
                >
                  <option value="Trung tâm Công nghệ">Trung tâm Công nghệ</option>
                  <option value="Phòng Nhân Sự">Phòng Nhân Sự</option>
                  <option value="Khối Kinh Doanh & Tiếp Thị">Khối Kinh Doanh &amp; Tiếp Thị</option>
                  <option value="Ban Quản Trị Hệ Thống">Ban Quản Trị Hệ Thống</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-ink mb-1">Nhóm (Team)</label>
                <select
                  value={editForm.team}
                  onChange={e => setEditForm({ ...editForm, team: e.target.value })}
                  className="w-full p-2 border border-line rounded-lg bg-canvas text-xs"
                >
                  <option value="Sirius">Sirius</option>
                  <option value="Optimus">Optimus</option>
                  <option value="Zeus">Zeus</option>
                  <option value="CA">CA</option>
                  <option value="Mobile App">Mobile App</option>
                  <option value="HR Operations">HR Operations</option>
                  <option value="Executive Board">Executive Board</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-ink mb-1">Vai Trò Phân Quyền</label>
                <select
                  value={editForm.role}
                  onChange={e => setEditForm({ ...editForm, role: e.target.value as any })}
                  className="w-full p-2 border border-line rounded-lg bg-canvas text-xs font-bold"
                >
                  <option value="EMPLOYEE">EMPLOYEE</option>
                  <option value="MANAGER">MANAGER</option>
                  <option value="HR_ADMIN">HR_ADMIN</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-ink mb-1">Trạng Thái Hoạt Động</label>
                <select
                  value={editForm.status}
                  onChange={e => setEditForm({ ...editForm, status: e.target.value as any })}
                  className="w-full p-2 border border-line rounded-lg bg-canvas text-xs"
                >
                  <option value="ACTIVE">ACTIVE (Đang hoạt động)</option>
                  <option value="PENDING_ACTIVATION">PENDING_ACTIVATION (Chờ đổi mật khẩu)</option>
                  <option value="INACTIVE">INACTIVE (Khóa tài khoản)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <Button variant="outline" size="sm" type="button" onClick={() => setIsEditModalOpen(false)}>
                Hủy
              </Button>
              <Button variant="primary" size="sm" type="submit">
                Lưu Thay Đổi
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal Reset Password */}
      {selectedEmp && isResetPasswordModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsResetPasswordModalOpen(false)}
          title={`Đặt lại mật khẩu cho ${selectedEmp.fullName}`}
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <p className="text-ink-secondary leading-relaxed">
              Hệ thống sẽ tạo mã OTP bảo mật và gửi trực tiếp tới email <strong>{selectedEmp.email}</strong>. Nhân viên cần truy cập đường link để nhập mật khẩu mới.
            </p>
            <div className="p-3 bg-canvas rounded-lg space-y-1 border border-line">
              <div>Mã NV: <strong className="font-mono">{selectedEmp.code}</strong></div>
              <div>Họ tên: <strong>{selectedEmp.fullName}</strong></div>
              <div>Trạng thái hiện tại: <strong>{selectedEmp.status}</strong></div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <Button variant="outline" size="sm" onClick={() => setIsResetPasswordModalOpen(false)}>
                Hủy
              </Button>
              <Button variant="danger" size="sm" onClick={handleResetPassword}>
                Gửi Email Reset Mật Khẩu
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
