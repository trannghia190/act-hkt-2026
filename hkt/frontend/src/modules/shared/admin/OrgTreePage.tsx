import React, { useState, useEffect } from 'react';
import { Card } from '../../../components/common/Card';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { Modal } from '../../../components/common/Modal';
import { useAuth } from '../../../context/AuthContext';

export interface TeamNode {
  id: string;
  name: string;
  leadName: string;
  leadCode: string;
  leadEmail: string;
  memberCount: number;
  approvalType: 'STANDARD_2_STEP' | 'DIRECT_HR';
  note: string;
}

export interface DeptNode {
  id: string;
  name: string;
  headName: string;
  headTitle: string;
  teams: TeamNode[];
}

const INITIAL_DEPARTMENTS: DeptNode[] = [
  {
    id: 'D01',
    name: 'Ban Giám Đốc (Executive Board)',
    headName: 'Trịnh Văn Quản Trị',
    headTitle: 'Tổng Giám Đốc',
    teams: [
      {
        id: 'T00',
        name: 'Executive Office',
        leadName: 'Trịnh Văn Quản Trị',
        leadCode: 'ACT0001',
        leadEmail: 'admin@actvn.edu.vn',
        memberCount: 4,
        approvalType: 'STANDARD_2_STEP',
        note: 'Văn phòng điều hành'
      }
    ]
  },
  {
    id: 'D02',
    name: 'Phòng Nhân Sự (HR & Operations)',
    headName: 'Lê Thị Thu Hà',
    headTitle: 'Trưởng Phòng Nhân Sự',
    teams: [
      {
        id: 'T01',
        name: 'HR Operations & C&B',
        leadName: 'Lê Thị Thu Hà',
        leadCode: 'ACT0012',
        leadEmail: 'hr.ha@actvn.edu.vn',
        memberCount: 5,
        approvalType: 'STANDARD_2_STEP',
        note: 'Chịu trách nhiệm chấm công, tính lương và quan hệ lao động'
      }
    ]
  },
  {
    id: 'D03',
    name: 'Trung Tâm Công Nghệ & R&D',
    headName: 'Vũ Quốc Toàn',
    headTitle: 'Giám Đốc Công Nghệ (CTO)',
    teams: [
      {
        id: 'T02',
        name: 'Sirius (Core Platform Team)',
        leadName: 'Phạm Minh Tuấn',
        leadCode: 'ACT0045',
        leadEmail: 'lead.tuan@actvn.edu.vn',
        memberCount: 14,
        approvalType: 'STANDARD_2_STEP',
        note: 'Quy trình chuẩn: Lead duyệt -> HR xác nhận'
      },
      {
        id: 'T03',
        name: 'Optimus (AI & Data Intelligence)',
        leadName: 'Hoàng Anh Dũng',
        leadCode: 'ACT0055',
        leadEmail: 'dung.ha@actvn.edu.vn',
        memberCount: 11,
        approvalType: 'STANDARD_2_STEP',
        note: 'Quy trình chuẩn: Lead duyệt -> HR xác nhận'
      },
      {
        id: 'T04',
        name: 'Zeus (Security & DevOps)',
        leadName: 'Nguyễn Văn Đạt',
        leadCode: 'ACT0062',
        leadEmail: 'dat.nv@actvn.edu.vn',
        memberCount: 9,
        approvalType: 'STANDARD_2_STEP',
        note: 'Quy trình chuẩn: Lead duyệt -> HR xác nhận'
      },
      {
        id: 'T05',
        name: 'CA (Certificate & Auth - Ngoại lệ)',
        leadName: 'Trần Văn Kiên (Tạm quyền)',
        leadCode: 'ACT0078',
        leadEmail: 'kien.tv@actvn.edu.vn',
        memberCount: 6,
        approvalType: 'DIRECT_HR',
        note: '⚠️ NGOẠI LỆ ĐẶC BIỆT: Đơn từ duyệt thẳng HR, không qua Team Lead'
      }
    ]
  },
  {
    id: 'D04',
    name: 'Khối Kinh Doanh & Tiếp Thị (Commercial & Growth)',
    headName: 'Đặng Mai Phương',
    headTitle: 'Giám Đốc Kinh Doanh',
    teams: [
      {
        id: 'T06',
        name: 'Mobile App Product Team (Ngoại lệ)',
        leadName: 'Lý Quốc Huy (Tech Lead)',
        leadCode: 'ACT0090',
        leadEmail: 'huy.lq@actvn.edu.vn',
        memberCount: 12,
        approvalType: 'DIRECT_HR',
        note: '⚠️ NGOẠI LỆ ĐẶC BIỆT: Nhân sự dự án di động chuyển duyệt thẳng HR'
      },
      {
        id: 'T07',
        name: 'Enterprise Growth & Sales',
        leadName: 'Phạm Thị Mỹ Linh',
        leadCode: 'ACT0095',
        leadEmail: 'linh.ptm@actvn.edu.vn',
        memberCount: 8,
        approvalType: 'STANDARD_2_STEP',
        note: 'Quy trình chuẩn'
      }
    ]
  }
];

const STORAGE_KEY = 'pulse_org_tree_data';

export const OrgTreePage: React.FC = () => {
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN' || user?.role === 'HR_ADMIN';

  const [departments, setDepartments] = useState<DeptNode[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to parse saved org tree', e);
    }
    return INITIAL_DEPARTMENTS;
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTeam, setSelectedTeam] = useState<TeamNode | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Modals state
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<DeptNode | null>(null);
  const [deptForm, setDeptForm] = useState({ id: '', name: '', headName: '', headTitle: '' });

  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [selectedDeptIdForTeam, setSelectedDeptIdForTeam] = useState<string>('');
  const [editingTeam, setEditingTeam] = useState<{ deptId: string; team: TeamNode } | null>(null);
  const [teamForm, setTeamForm] = useState({
    id: '',
    name: '',
    leadName: '',
    leadCode: '',
    leadEmail: '',
    memberCount: 5,
    approvalType: 'STANDARD_2_STEP' as 'STANDARD_2_STEP' | 'DIRECT_HR',
    note: ''
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(departments));
  }, [departments]);

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3000);
  };

  // Department Handlers
  const handleOpenAddDept = () => {
    const nextId = `D0${departments.length + 1}`;
    setEditingDept(null);
    setDeptForm({ id: nextId, name: '', headName: '', headTitle: 'Trưởng Khối / Phòng' });
    setIsDeptModalOpen(true);
  };

  const handleOpenEditDept = (dept: DeptNode) => {
    setEditingDept(dept);
    setDeptForm({ id: dept.id, name: dept.name, headName: dept.headName, headTitle: dept.headTitle });
    setIsDeptModalOpen(true);
  };

  const handleSaveDept = (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptForm.name.trim() || !deptForm.headName.trim()) return;

    if (editingDept) {
      setDepartments(prev =>
        prev.map(d => (d.id === editingDept.id ? { ...d, ...deptForm } : d))
      );
      showToast(`Đã cập nhật thông tin nhóm "${deptForm.name}" thành công`);
    } else {
      const newDept: DeptNode = {
        ...deptForm,
        teams: []
      };
      setDepartments(prev => [...prev, newDept]);
      showToast(`Đã thêm nhóm "${deptForm.name}" thành công`);
    }
    setIsDeptModalOpen(false);
  };

  const handleDeleteDept = (deptId: string, deptName: string) => {
    const target = departments.find(d => d.id === deptId);
    if (target && target.teams.length > 0) {
      alert(`Không thể xóa nhóm "${deptName}" vì đang có ${target.teams.length} nhóm trực thuộc. Hãy chuyển hoặc xóa các nhóm trước.`);
      return;
    }
    if (confirm(`Bạn có chắc chắn muốn xóa nhóm "${deptName}"?`)) {
      setDepartments(prev => prev.filter(d => d.id !== deptId));
      showToast(`Đã xóa nhóm "${deptName}"`);
    }
  };

  // Team Handlers
  const handleOpenAddTeam = (deptId: string) => {
    const totalTeams = departments.reduce((acc, d) => acc + d.teams.length, 0);
    const nextId = `T${String(totalTeams + 1).padStart(2, '0')}`;
    setSelectedDeptIdForTeam(deptId);
    setEditingTeam(null);
    setTeamForm({
      id: nextId,
      name: '',
      leadName: '',
      leadCode: 'ACT' + Math.floor(1000 + Math.random() * 9000),
      leadEmail: '',
      memberCount: 6,
      approvalType: 'STANDARD_2_STEP',
      note: 'Quy trình chuẩn: Lead duyệt -> HR xác nhận'
    });
    setIsTeamModalOpen(true);
  };

  const handleOpenEditTeam = (deptId: string, team: TeamNode) => {
    setSelectedDeptIdForTeam(deptId);
    setEditingTeam({ deptId, team });
    setTeamForm({
      id: team.id,
      name: team.name,
      leadName: team.leadName,
      leadCode: team.leadCode,
      leadEmail: team.leadEmail,
      memberCount: team.memberCount,
      approvalType: team.approvalType,
      note: team.note
    });
    setIsTeamModalOpen(true);
  };

  const handleSaveTeam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamForm.name.trim() || !teamForm.leadName.trim()) return;

    if (editingTeam) {
      setDepartments(prev =>
        prev.map(d => {
          if (d.id === editingTeam.deptId) {
            return {
              ...d,
              teams: d.teams.map(t => (t.id === editingTeam.team.id ? { ...teamForm } : t))
            };
          }
          return d;
        })
      );
      if (selectedTeam && selectedTeam.id === editingTeam.team.id) {
        setSelectedTeam({ ...teamForm });
      }
      showToast(`Đã cập nhật nhóm "${teamForm.name}" thành công`);
    } else {
      const newTeam: TeamNode = { ...teamForm };
      setDepartments(prev =>
        prev.map(d => {
          if (d.id === selectedDeptIdForTeam) {
            return { ...d, teams: [...d.teams, newTeam] };
          }
          return d;
        })
      );
      showToast(`Đã thêm nhóm "${teamForm.name}" vào nhóm`);
    }
    setIsTeamModalOpen(false);
  };

  const handleDeleteTeam = (deptId: string, teamId: string, teamName: string) => {
    if (confirm(`Bạn có chắc chắn muốn xóa nhóm "${teamName}"?`)) {
      setDepartments(prev =>
        prev.map(d => {
          if (d.id === deptId) {
            return { ...d, teams: d.teams.filter(t => t.id !== teamId) };
          }
          return d;
        })
      );
      if (selectedTeam?.id === teamId) {
        setSelectedTeam(null);
      }
      showToast(`Đã xóa nhóm "${teamName}"`);
    }
  };

  const handleResetToDefault = () => {
    if (confirm('Khôi phục toàn bộ cây tổ chức về mặc định ban đầu?')) {
      setDepartments(INITIAL_DEPARTMENTS);
      localStorage.removeItem(STORAGE_KEY);
      showToast('Đã khôi phục dữ liệu cây tổ chức mẫu');
    }
  };

  // Filtered view
  const filteredDepartments = departments.map(dept => {
    const matchesDept = dept.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        dept.headName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchedTeams = dept.teams.filter(
      t =>
        matchesDept ||
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.leadName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.leadEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.id.toLowerCase().includes(searchQuery.toLowerCase())
    );
    return { ...dept, teams: matchedTeams };
  }).filter(dept => dept.teams.length > 0 || dept.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const totalDepts = departments.length;
  const totalTeams = departments.reduce((acc, d) => acc + d.teams.length, 0);
  const directHrCount = departments.reduce(
    (acc, d) => acc + d.teams.filter(t => t.approvalType === 'DIRECT_HR').length,
    0
  );
  const standardCount = totalTeams - directHrCount;

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed top-16 right-6 z-50 bg-emerald-700 text-white px-4 py-2.5 rounded-lg shadow-lg text-xs font-semibold flex items-center gap-2 animate-bounce">
          <span>✓</span>
          <span>{successToast}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-ink">Sơ Đồ Cơ Cấu Tổ Chức &amp; Luồng Duyệt</h1>
            <Badge variant="accent">S41</Badge>
            {canManage ? (
              <Badge variant="ok">Chế độ Quản trị (Admin/HR)</Badge>
            ) : (
              <Badge variant="gray">Chế độ Xem (Read-only)</Badge>
            )}
          </div>
          <p className="text-xs text-ink-muted mt-1">
            Hiển thị cây nhóm, phân bổ nhóm chức năng, Trưởng nhóm và cấu hình ngoại lệ phê duyệt (CA, Mobile App)
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="text"
            placeholder="Tìm theo tên phòng, nhóm, lead..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-lg border border-line bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-accent"
          />
          {canManage && (
            <>
              <Button variant="outline" size="sm" onClick={handleResetToDefault}>
                Khôi phục mẫu
              </Button>
              <Button variant="primary" size="sm" onClick={handleOpenAddDept}>
                + Thêm Phòng Ban
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Highlights / Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 bg-surface rounded-xl border border-line shadow-2xs">
          <div className="text-xs text-ink-muted">Tổng số Phòng Ban</div>
          <div className="text-2xl font-bold text-ink mt-1">{totalDepts} Khối / Đơn vị</div>
          <div className="text-[11px] text-ink-secondary mt-1">Cơ cấu điều hành toàn công ty</div>
        </div>
        <div className="p-4 bg-surface rounded-xl border border-line shadow-2xs">
          <div className="text-xs text-ink-muted">Tổng số Nhóm Trực Thuộc</div>
          <div className="text-2xl font-bold text-ink mt-1">{totalTeams} Đội nhóm (Teams)</div>
          <div className="text-[11px] text-ink-secondary mt-1">Được gán Lead &amp; luồng duyệt</div>
        </div>
        <div className="p-4 bg-surface rounded-xl border border-line shadow-2xs">
          <div className="text-xs text-ink-muted">Quy Trình Chuẩn (2 Cấp)</div>
          <div className="text-2xl font-bold text-accent mt-1">{standardCount} Nhóm (Standard)</div>
          <div className="text-[11px] text-accent-dark mt-1">Luồng 2 cấp: Team Lead → HR Duyệt</div>
        </div>
        <div className="p-4 bg-surface rounded-xl border border-line shadow-2xs">
          <div className="text-xs text-ink-muted">Quy Trình Ngoại Lệ</div>
          <div className="text-2xl font-bold text-amber-700 mt-1">{directHrCount} Nhóm (Direct HR)</div>
          <div className="text-[11px] text-amber-600 mt-1">Đơn từ chuyển thẳng HR phê duyệt</div>
        </div>
      </div>

      {/* Visual Org Tree */}
      <div className="space-y-6">
        {filteredDepartments.map(dept => (
          <div key={dept.id} className="bg-surface rounded-xl border border-line p-5 shadow-2xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-line gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-ink">{dept.name}</span>
                  <Badge variant="gray">Mã: {dept.id}</Badge>
                </div>
                <div className="text-xs text-ink-secondary mt-0.5">
                  Lãnh đạo phụ trách: <strong className="text-ink">{dept.headName}</strong> · {dept.headTitle}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-ink-muted">{dept.teams.length} Nhóm trực thuộc</span>
                {canManage && (
                  <div className="flex items-center gap-1.5 ml-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenAddTeam(dept.id)}
                      className="text-xs py-1 px-2"
                    >
                      + Thêm Nhóm
                    </Button>
                    <button
                      onClick={() => handleOpenEditDept(dept)}
                      className="p-1 text-xs text-ink-muted hover:text-ink hover:bg-canvas rounded"
                      title="Sửa nhóm"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDeleteDept(dept.id, dept.name)}
                      className="p-1 text-xs text-status-danger hover:bg-status-danger/10 rounded"
                      title="Xóa nhóm"
                    >
                      🗑️
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Teams Grid */}
            {dept.teams.length === 0 ? (
              <div className="p-6 text-center text-xs text-ink-muted">
                Chưa có nhóm nào trực thuộc nhóm này.
                {canManage && (
                  <button
                    onClick={() => handleOpenAddTeam(dept.id)}
                    className="text-accent underline ml-1 font-semibold"
                  >
                    Thêm ngay
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                {dept.teams.map(team => (
                  <div
                    key={team.id}
                    onClick={() => setSelectedTeam(team)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all hover:shadow-xs relative group ${
                      team.approvalType === 'DIRECT_HR'
                        ? 'border-amber-300 bg-amber-50/20 hover:border-amber-400'
                        : 'border-line bg-canvas/40 hover:border-accent'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-xs text-ink">{team.name}</span>
                      {team.approvalType === 'DIRECT_HR' ? (
                        <Badge variant="warn">Duyệt thẳng HR</Badge>
                      ) : (
                        <Badge variant="ok">2 Bước</Badge>
                      )}
                    </div>

                    <div className="mt-3 text-xs space-y-1">
                      <div className="text-ink-secondary">
                        Lead: <strong className="text-ink">{team.leadName}</strong>
                      </div>
                      <div className="text-[11px] text-ink-muted font-mono">{team.leadEmail}</div>
                      <div className="text-[11px] text-ink-muted mt-2">
                        Nhân sự: <strong className="text-ink">{team.memberCount} thành viên</strong>
                      </div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-line/60 text-[11px] text-ink-secondary line-clamp-2">
                      {team.note}
                    </div>

                    {/* Quick Action buttons */}
                    {canManage && (
                      <div className="mt-3 pt-2 border-t border-line/40 flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100">
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            handleOpenEditTeam(dept.id, team);
                          }}
                          className="px-2 py-0.5 text-[11px] text-ink-secondary hover:text-accent rounded bg-surface border border-line"
                        >
                          Sửa
                        </button>
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            handleDeleteTeam(dept.id, team.id, team.name);
                          }}
                          className="px-2 py-0.5 text-[11px] text-status-danger hover:bg-status-danger/10 rounded bg-surface border border-line"
                        >
                          Xóa
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Selected Team Detail */}
      {selectedTeam && (
        <Card
          title={`Chi tiết cấu hình nhóm: ${selectedTeam.name}`}
          action={
            <Button variant="ghost" size="sm" onClick={() => setSelectedTeam(null)}>
              Đóng
            </Button>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="space-y-2">
              <div>
                <span className="text-ink-muted">Trưởng nhóm (Approver L1):</span>
                <div className="font-semibold text-ink mt-0.5">
                  {selectedTeam.leadName} ({selectedTeam.leadCode})
                </div>
                <div className="font-mono text-ink-muted text-[11px]">{selectedTeam.leadEmail}</div>
              </div>
              <div>
                <span className="text-ink-muted">Số lượng nhân viên chính thức:</span>
                <div className="font-semibold text-ink mt-0.5">{selectedTeam.memberCount} người</div>
              </div>
              <div>
                <span className="text-ink-muted">Mã định danh nhóm:</span>
                <div className="font-mono font-semibold text-ink mt-0.5">{selectedTeam.id}</div>
              </div>
            </div>

            <div className="space-y-2">
              <div>
                <span className="text-ink-muted">Luồng phê duyệt (Approval Routing):</span>
                <div className="mt-1">
                  {selectedTeam.approvalType === 'DIRECT_HR' ? (
                    <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-amber-900">
                      <strong>Cấu hình Ngoại lệ (Direct to HR):</strong> Mọi đơn từ xin nghỉ, OT, giải trình của các thành viên trong nhóm sẽ bỏ qua bước Team Lead và xuất hiện trực tiếp trong hòm thư duyệt của HR Admin (S02 &amp; S12).
                    </div>
                  ) : (
                    <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-emerald-900">
                      <strong>Quy trình chuẩn 2 cấp:</strong> Nhân viên gửi đơn → Team Lead ({selectedTeam.leadName}) phê duyệt cấp 1 → HR Admin phê duyệt cấp 2.
                    </div>
                  )}
                </div>
              </div>
              <div>
                <span className="text-ink-muted">Ghi chú vận hành:</span>
                <div className="text-ink text-xs mt-0.5">{selectedTeam.note || 'Không có ghi chú'}</div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Modal: Thêm / Sửa Phòng Ban */}
      <Modal
        isOpen={isDeptModalOpen}
        onClose={() => setIsDeptModalOpen(false)}
        title={editingDept ? 'Chỉnh Sửa Phòng Ban / Khối' : 'Thêm Phòng Ban / Khối Mới'}
      >
        <form onSubmit={handleSaveDept} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-ink-muted mb-1">Mã Phòng Ban</label>
              <input
                type="text"
                required
                value={deptForm.id}
                onChange={e => setDeptForm({ ...deptForm, id: e.target.value.toUpperCase() })}
                disabled={!!editingDept}
                placeholder="VD: D05"
                className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-ink font-mono disabled:bg-canvas"
              />
            </div>
            <div>
              <label className="block text-ink-muted mb-1">Tên Phòng Ban / Khối</label>
              <input
                type="text"
                required
                value={deptForm.name}
                onChange={e => setDeptForm({ ...deptForm, name: e.target.value })}
                placeholder="VD: Khối Tài Chính Kế Toán"
                className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-ink"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-ink-muted mb-1">Họ tên Lãnh Đạo</label>
              <input
                type="text"
                required
                value={deptForm.headName}
                onChange={e => setDeptForm({ ...deptForm, headName: e.target.value })}
                placeholder="VD: Hoàng Văn Nam"
                className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-ink"
              />
            </div>
            <div>
              <label className="block text-ink-muted mb-1">Chức Danh / Vị Trí</label>
              <input
                type="text"
                required
                value={deptForm.headTitle}
                onChange={e => setDeptForm({ ...deptForm, headTitle: e.target.value })}
                placeholder="VD: Giám Đốc Tài Chính (CFO)"
                className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-ink"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-line">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsDeptModalOpen(false)}>
              Hủy
            </Button>
            <Button variant="primary" size="sm" type="submit">
              {editingDept ? 'Cập Nhật Phòng Ban' : 'Tạo Phòng Ban Mới'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Thêm / Sửa Nhóm (Team) */}
      <Modal
        isOpen={isTeamModalOpen}
        onClose={() => setIsTeamModalOpen(false)}
        title={editingTeam ? `Chỉnh Sửa Nhóm: ${editingTeam.team.name}` : 'Thêm Nhóm Chức Năng Mới'}
      >
        <form onSubmit={handleSaveTeam} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-ink-muted mb-1">Mã Nhóm</label>
              <input
                type="text"
                required
                value={teamForm.id}
                onChange={e => setTeamForm({ ...teamForm, id: e.target.value.toUpperCase() })}
                disabled={!!editingTeam}
                placeholder="VD: T08"
                className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-ink font-mono disabled:bg-canvas"
              />
            </div>
            <div>
              <label className="block text-ink-muted mb-1">Tên Nhóm (Team Name)</label>
              <input
                type="text"
                required
                value={teamForm.name}
                onChange={e => setTeamForm({ ...teamForm, name: e.target.value })}
                placeholder="VD: Apollo Mobile Team"
                className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-ink"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-ink-muted mb-1">Họ Tên Team Lead</label>
              <input
                type="text"
                required
                value={teamForm.leadName}
                onChange={e => setTeamForm({ ...teamForm, leadName: e.target.value })}
                placeholder="VD: Nguyễn Văn Bình"
                className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-ink"
              />
            </div>
            <div>
              <label className="block text-ink-muted mb-1">Mã Nhân Viên Lead</label>
              <input
                type="text"
                required
                value={teamForm.leadCode}
                onChange={e => setTeamForm({ ...teamForm, leadCode: e.target.value.toUpperCase() })}
                placeholder="VD: ACT0105"
                className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-ink font-mono"
              />
            </div>
            <div>
              <label className="block text-ink-muted mb-1">Email Công Ty</label>
              <input
                type="email"
                required
                value={teamForm.leadEmail}
                onChange={e => setTeamForm({ ...teamForm, leadEmail: e.target.value })}
                placeholder="binh.nv@act-corp.internal"
                className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-ink"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-ink-muted mb-1">Số Thành Viên</label>
              <input
                type="number"
                min="1"
                max="100"
                required
                value={teamForm.memberCount}
                onChange={e => setTeamForm({ ...teamForm, memberCount: parseInt(e.target.value) || 1 })}
                className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-ink"
              />
            </div>
            <div>
              <label className="block text-ink-muted mb-1">Luồng Phê Duyệt Nghỉ / OT</label>
              <select
                value={teamForm.approvalType}
                onChange={e => setTeamForm({ ...teamForm, approvalType: e.target.value as any })}
                className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-ink"
              >
                <option value="STANDARD_2_STEP">Chuẩn 2 cấp (Team Lead duyệt → HR duyệt)</option>
                <option value="DIRECT_HR">⚠️ Ngoại lệ (Chuyển thẳng HR Admin)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-ink-muted mb-1">Ghi Chú Vận Hành</label>
            <textarea
              rows={2}
              value={teamForm.note}
              onChange={e => setTeamForm({ ...teamForm, note: e.target.value })}
              placeholder="Ghi chú về nhóm hoặc lý do chọn luồng ngoại lệ..."
              className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-ink"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-line">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsTeamModalOpen(false)}>
              Hủy
            </Button>
            <Button variant="primary" size="sm" type="submit">
              {editingTeam ? 'Cập Nhật Nhóm' : 'Thêm Nhóm Vào Phòng'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
