import React, { useState, useEffect } from 'react';
import { Card } from '../../../components/common/Card';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { Modal } from '../../../components/common/Modal';
import { useAuth } from '../../../context/AuthContext';
import {
  Network,
  Users,
  AlertTriangle,
  ChevronRight,
  ChevronDown,
  UserCheck,
  Search,
  Plus,
  ArrowRight,
  GitPullRequest,
  CheckCircle2,
  Clock,
  ShieldAlert,
  UserX,
  ExternalLink,
  Edit2
} from 'lucide-react';

export interface EmployeeItem {
  id: string;
  employeeCode: string;
  fullName: string;
  email: string;
  phone?: string;
  team?: string;
  teamId?: string;
  positionName?: string;
  role?: string;
  status?: string;
  managerId?: string;
  managerName?: string;
  managerCode?: string;
  approvalChain?: string;
}

export interface OrgNode {
  id: string;
  name: string;
  code: string;
  parentId?: string | null;
  parentName?: string | null;
  leaderId?: string | null;
  leaderCode?: string | null;
  leaderName?: string | null;
  hasLeader: boolean;
  memberCount: number;
  totalMemberCount: number;
  pendingRequestsCount: number;
  totalPendingRequestsCount: number;
  isSpecialApproval?: boolean;
  members: EmployeeItem[];
  children: OrgNode[];
}

export const OrgTreePage: React.FC = () => {
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN' || user?.role === 'HR_ADMIN';

  const [treeData, setTreeData] = useState<OrgNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [hideEmpty, setHideEmpty] = useState(false);
  const [onlyIssues, setOnlyIssues] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const [selectedNode, setSelectedNode] = useState<OrgNode | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modal: Đổi trưởng nhóm
  const [isLeaderModalOpen, setIsLeaderModalOpen] = useState(false);
  const [targetTeam, setTargetTeam] = useState<OrgNode | null>(null);
  const [newLeaderId, setNewLeaderId] = useState('');
  const [leaderChangeReason, setLeaderChangeReason] = useState('');

  // Modal: Thêm nhóm con
  const [isAddTeamModalOpen, setIsAddTeamModalOpen] = useState(false);
  const [parentTeamForAdd, setParentTeamForAdd] = useState<OrgNode | null>(null);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamLeaderId, setNewTeamLeaderId] = useState('');

  // Modal: Gán quản lý cho nhân viên chưa có quản lý
  const [isAssignMgrModalOpen, setIsAssignMgrModalOpen] = useState(false);
  const [targetEmployee, setTargetEmployee] = useState<EmployeeItem | null>(null);
  const [assignMgrId, setAssignMgrId] = useState('d0000000-0000-0000-0000-000000000002');
  const [assignMgrReason, setAssignMgrReason] = useState('Gán quản lý trực tiếp từ sơ đồ phân tầng');

  const fetchTree = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/org/tree');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setTreeData(json.data);
          // Mặc định mở tất cả node gốc
          const exp: Record<string, boolean> = {};
          const traverse = (nodes: OrgNode[]) => {
            nodes.forEach(n => {
              exp[n.id] = true;
              if (n.children && n.children.length > 0) traverse(n.children);
            });
          };
          traverse(json.data);
          setExpandedNodes(exp);
        }
      }
    } catch (e) {
      console.error('Lỗi tải cây sơ đồ tổ chức', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTree();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedNodes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Tính số điểm gãy: nhóm chưa có trưởng + nhân viên chưa có quản lý
  let brokenGroups = 0;
  let brokenMembers = 0;
  let totalMembersAll = 0;
  let totalPendingAll = 0;

  const countIssues = (nodes: OrgNode[]) => {
    nodes.forEach(n => {
      if (!n.hasLeader) brokenGroups++;
      totalMembersAll += n.memberCount;
      totalPendingAll += n.pendingRequestsCount;
      if (n.members) {
        n.members.forEach(m => {
          if (!m.managerId) brokenMembers++;
        });
      }
      if (n.children) countIssues(n.children);
    });
  };
  countIssues(treeData);

  // Đổi trưởng nhóm
  const handleSaveLeader = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetTeam || !newLeaderId || !leaderChangeReason.trim()) {
      alert('Vui lòng chọn trưởng nhóm mới và nhập lý do bắt buộc!');
      return;
    }
    try {
      const res = await fetch(`/api/v1/admin/teams/${targetTeam.id}/change-leader`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newLeaderId: newLeaderId.trim(),
          reason: leaderChangeReason.trim()
        })
      });
      const json = await res.json();
      if (json.success) {
        showToast(json.message || 'Đổi trưởng nhóm thành công và chuyển đơn chờ duyệt!');
        setIsLeaderModalOpen(false);
        fetchTree();
        if (selectedNode && selectedNode.id === targetTeam.id) {
          setSelectedNode(null);
        }
      } else {
        alert(json.message || 'Lỗi đổi trưởng nhóm');
      }
    } catch (e) {
      alert('Lỗi kết nối tới máy chủ');
    }
  };

  // Thêm nhóm mới
  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) {
      alert('Vui lòng nhập tên nhóm!');
      return;
    }
    try {
      const res = await fetch('/api/v1/admin/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTeamName.trim(),
          parentId: parentTeamForAdd ? parentTeamForAdd.id : null,
          leaderId: newTeamLeaderId.trim() || null,
          reason: 'Mở rộng cơ cấu phân tầng nhóm'
        })
      });
      const json = await res.json();
      if (json.success) {
        showToast(`Đã tạo nhóm "${newTeamName.trim()}" thành công!`);
        setIsAddTeamModalOpen(false);
        setNewTeamName('');
        setNewTeamLeaderId('');
        fetchTree();
      } else {
        alert(json.message || 'Lỗi tạo nhóm');
      }
    } catch (e) {
      alert('Lỗi kết nối');
    }
  };

  // Gán quản lý cho nhân viên
  const handleAssignManager = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetEmployee || !assignMgrId) return;
    try {
      const res = await fetch(`/api/v1/admin/users/${targetEmployee.employeeCode}/change-manager`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newManagerId: assignMgrId,
          reason: assignMgrReason.trim() || 'Gán quản lý trực tiếp từ sơ đồ cây'
        })
      });
      const json = await res.json();
      if (json.success) {
        showToast(`Đã gán quản lý cho ${targetEmployee.fullName} thành công!`);
        setIsAssignMgrModalOpen(false);
        fetchTree();
        if (selectedNode) {
          // refresh selected node members
          setSelectedNode(prev => {
            if (!prev) return null;
            return {
              ...prev,
              members: prev.members.map(m =>
                m.id === targetEmployee.id
                  ? { ...m, managerId: assignMgrId, managerName: 'Đã gán quản lý' }
                  : m
              )
            };
          });
        }
      } else {
        alert(json.message || 'Lỗi gán quản lý');
      }
    } catch (e) {
      alert('Lỗi kết nối');
    }
  };

  // Render đệ quy từng node (KHÔNG GIỚI HẠN TẦNG)
  const renderTreeNode = (node: OrgNode, level: number = 0) => {
    const isExpanded = !!expandedNodes[node.id];
    const hasChildren = node.children && node.children.length > 0;
    const isSelected = selectedNode?.id === node.id;
    const isBroken = !node.hasLeader;

    // Filter "Ẩn nhánh rỗng"
    if (hideEmpty && node.totalMemberCount === 0 && node.totalPendingRequestsCount === 0) {
      return null;
    }

    // Filter "Chỉ hiện nhánh có lỗi / đơn chờ"
    if (onlyIssues && node.hasLeader && node.totalPendingRequestsCount === 0) {
      return null;
    }

    // Highlight nếu từ khóa khớp
    const isMatch = searchQuery.trim() && (
      node.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (node.leaderName && node.leaderName.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return (
      <div key={node.id} className="relative transition-all">
        {/* Node Card */}
        <div
          onClick={() => setSelectedNode(node)}
          className={`cursor-pointer group flex flex-col md:flex-row md:items-center justify-between gap-3 p-3.5 rounded-xl border transition-all mb-2.5 ${
            isSelected
              ? 'bg-accent/15 border-accent shadow-lg shadow-accent/10'
              : isBroken
              ? 'bg-amber-950/20 border-amber-500/40 hover:border-amber-400'
              : isMatch
              ? 'bg-emerald-950/20 border-emerald-500 shadow-md'
              : 'bg-surface/80 border-white/10 hover:border-white/20 hover:bg-white/5'
          }`}
          style={{ marginLeft: `${Math.min(level * 24, 160)}px` }}
        >
          <div className="flex items-center gap-3">
            {hasChildren ? (
              <button
                onClick={(e) => toggleExpand(node.id, e)}
                className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-accent" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                )}
              </button>
            ) : (
              <div className="w-6 h-6 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-500" />
              </div>
            )}

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ${
                  level === 0 ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' :
                  level === 1 ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30' :
                  'bg-white/10 text-slate-300'
                }`}>
                  {level === 0 ? 'Khối / Ban Gốc' : level === 1 ? 'Phòng / Nhóm Cha' : `Tầng ${level + 1}`}
                </span>
                <span className="font-semibold text-white text-sm group-hover:text-accent transition-colors">
                  {node.name}
                </span>
                {node.isSpecialApproval && (
                  <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1.5 py-0.5 rounded">
                    Duyệt đặc biệt
                  </span>
                )}
              </div>

              <div className="text-xs text-slate-400 flex items-center gap-2 mt-1">
                {node.hasLeader ? (
                  <span>
                    Trưởng nhóm: <b className="text-slate-200">{node.leaderName}</b> ({node.leaderCode})
                  </span>
                ) : (
                  <span className="text-amber-400 font-medium flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    Chưa có trưởng nhóm — cần gán để duyệt đơn
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap md:self-auto self-end">
            <span className="px-2.5 py-1 bg-white/5 border border-white/10 rounded-lg text-xs font-mono text-slate-300">
              {node.totalMemberCount > node.memberCount ? (
                <span>{node.memberCount} ng <span className="text-slate-500">({node.totalMemberCount} cả nhánh)</span></span>
              ) : (
                <span>{node.memberCount} người</span>
              )}
            </span>

            {node.totalPendingRequestsCount > 0 ? (
              <span className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs font-semibold text-amber-300 flex items-center gap-1 animate-pulse">
                <Clock className="w-3.5 h-3.5" />
                {node.totalPendingRequestsCount} đơn chờ
              </span>
            ) : (
              <span className="px-2 py-1 bg-white/5 rounded-lg text-xs text-slate-500">
                0 đơn
              </span>
            )}

            {canManage && (
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setTargetTeam(node);
                    setNewLeaderId(node.leaderId || '');
                    setLeaderChangeReason('');
                    setIsLeaderModalOpen(true);
                  }}
                  className="px-2 py-1 text-xs bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded border border-white/10"
                  title="Đổi trưởng nhóm"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setParentTeamForAdd(node);
                    setIsAddTeamModalOpen(true);
                  }}
                  className="px-2 py-1 text-xs bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded border border-white/10"
                  title="Thêm nhóm con trực thuộc"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Children Subtree */}
        {hasChildren && isExpanded && (
          <div className="border-l-2 border-white/10 pl-2 ml-4">
            {node.children.map(child => renderTreeNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6 pb-24">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5" />
          <span className="font-medium text-sm">{toastMessage}</span>
        </div>
      )}

      {/* Header (Mockup S41) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs uppercase tracking-wider text-accent font-semibold px-2 py-0.5 rounded bg-accent/10 border border-accent/20">
              Nền tảng dùng chung · HR · P0 — S41
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Network className="w-6 h-6 text-accent" />
            Cây Phân Tầng Quản Lý
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Nhóm lồng nhau không giới hạn số tầng · Tìm ra chỗ kẹt duyệt đơn và nhân viên chưa có quản lý
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {brokenGroups + brokenMembers > 0 && (
            <span className="px-3 py-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-semibold flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              ⚠ {brokenGroups + brokenMembers} điểm cần sửa ({brokenMembers} người thiếu sếp, {brokenGroups} nhóm thiếu trưởng)
            </span>
          )}
          {canManage && (
            <Button
              variant="primary"
              onClick={() => {
                setParentTeamForAdd(null);
                setIsAddTeamModalOpen(true);
              }}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Thêm nhóm gốc mới
            </Button>
          )}
        </div>
      </div>

      {/* Warning Box (Mockup S41) */}
      {brokenMembers > 0 && (
        <div className="bg-amber-950/30 border border-amber-500/40 rounded-xl p-4 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-white">
                Cảnh báo luồng duyệt: {brokenMembers} nhân viên chưa có quản lý trực tiếp!
              </p>
              <p className="text-xs text-slate-300 mt-1">
                Những đơn của các nhân viên này sẽ <b>không có ai duyệt được và bị kẹt vĩnh viễn</b>. Bấm vào nhóm tương ứng bên dưới để gán quản lý trực tiếp.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Top Filter & Search Controls */}
      <Card className="p-4 bg-surface/80 border-white/10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Tìm tên nhóm, mã nhóm, trưởng nhóm..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-black/30 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-accent"
            />
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={hideEmpty}
                onChange={e => setHideEmpty(e.target.checked)}
                className="rounded border-white/20 text-accent focus:ring-accent"
              />
              Ẩn nhánh rỗng
            </label>

            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={onlyIssues}
                onChange={e => setOnlyIssues(e.target.checked)}
                className="rounded border-white/20 text-accent focus:ring-accent"
              />
              Chỉ hiện nhánh có đơn / lỗi
            </label>

            <Button variant="secondary" onClick={fetchTree} className="text-xs px-3">
              Tải lại cây
            </Button>
          </div>
        </div>
      </Card>

      {/* Layout 2 Cột: Cây phân tầng bên trái (7 phần) & Chi tiết node bên phải (5 phần) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Cột trái: Cây phân tầng đệ quy */}
        <div className="lg:col-span-7 space-y-2">
          {loading ? (
            <div className="p-12 text-center text-slate-400 bg-surface/40 rounded-xl border border-white/10">
              <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              Đang phân tích và xây dựng cây phân tầng quản lý...
            </div>
          ) : treeData.length === 0 ? (
            <div className="p-12 text-center text-slate-400 bg-surface/40 rounded-xl border border-white/10">
              Không có nhóm nào trong hệ thống.
            </div>
          ) : (
            treeData.map(rootNode => renderTreeNode(rootNode, 0))
          )}
        </div>

        {/* Cột phải: Chi tiết nhóm được chọn (Mockup S41 Drawer / Detail Card) */}
        <div className="lg:col-span-5 sticky top-20">
          {selectedNode ? (
            <Card className="p-5 bg-surface/90 border-white/15 shadow-xl space-y-5">
              <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
                <div>
                  <span className="text-xs text-accent uppercase font-bold tracking-wider">
                    {selectedNode.code}
                  </span>
                  <h3 className="text-lg font-bold text-white mt-0.5">
                    {selectedNode.name}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    {selectedNode.parentName ? `Trực thuộc: ${selectedNode.parentName}` : 'Nhóm cấp cao nhất (Root)'}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedNode(null)}
                  className="text-slate-400 hover:text-white p-1"
                >
                  ✕
                </button>
              </div>

              {/* Thông tin Trưởng nhóm & Cấp duyệt */}
              <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Trưởng nhóm:</span>
                  {selectedNode.hasLeader ? (
                    <span className="font-semibold text-white">
                      {selectedNode.leaderName} ({selectedNode.leaderCode})
                    </span>
                  ) : (
                    <span className="text-amber-400 font-semibold flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Chưa có
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Đơn chờ duyệt trong nhóm:</span>
                  <span className={`font-semibold ${selectedNode.pendingRequestsCount > 0 ? 'text-amber-400' : 'text-slate-300'}`}>
                    {selectedNode.pendingRequestsCount} đơn
                  </span>
                </div>

                {canManage && (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setTargetTeam(selectedNode);
                      setNewLeaderId(selectedNode.leaderId || '');
                      setLeaderChangeReason('');
                      setIsLeaderModalOpen(true);
                    }}
                    className="w-full text-xs mt-2 py-1.5"
                  >
                    <Edit2 className="w-3.5 h-3.5 mr-1.5" />
                    Đổi trưởng nhóm & Chuyển đơn chờ
                  </Button>
                )}
              </div>

              {/* Danh sách nhân viên trong nhóm */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Thành viên trực thuộc ({selectedNode.members.length})
                  </h4>
                  <span className="text-[11px] text-slate-400">Click để gán sếp</span>
                </div>

                {selectedNode.members.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-3 text-center">
                    Nhóm hiện chưa có nhân sự trực thuộc
                  </p>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                    {selectedNode.members.map(member => {
                      const hasMgr = !!member.managerId;
                      return (
                        <div
                          key={member.id}
                          className={`p-2.5 rounded-lg border text-xs flex items-center justify-between gap-3 ${
                            hasMgr
                              ? 'bg-black/20 border-white/5'
                              : 'bg-red-950/20 border-red-500/30'
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-white">
                                {member.fullName}
                              </span>
                              <span className="text-[11px] text-slate-400 font-mono">
                                ({member.employeeCode})
                              </span>
                            </div>
                            <div className="text-[11px] mt-0.5">
                              {hasMgr ? (
                                <span className="text-slate-400">
                                  QL: <span className="text-slate-200">{member.managerName}</span>
                                </span>
                              ) : (
                                <span className="text-red-400 font-medium">
                                  ⚠ Chưa có quản lý trực tiếp
                                </span>
                              )}
                            </div>
                          </div>

                          {!hasMgr && canManage && (
                            <Button
                              variant="danger"
                              onClick={() => {
                                setTargetEmployee(member);
                                setIsAssignMgrModalOpen(true);
                              }}
                              className="text-[11px] px-2 py-1 h-auto shrink-0"
                            >
                              Gán sếp
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </Card>
          ) : (
            <Card className="p-8 text-center text-slate-400 bg-surface/40 border-white/10">
              <Network className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="font-medium text-sm text-slate-300">Chọn một nhóm để xem chi tiết</p>
              <p className="text-xs text-slate-500 mt-1">
                Xem danh sách người bên dưới, ai chưa có quản lý, đơn chờ duyệt và đổi trưởng nhóm
              </p>
            </Card>
          )}
        </div>
      </div>

      {/* Modal: Đổi trưởng nhóm (Mockup S41) */}
      {isLeaderModalOpen && targetTeam && (
        <Modal
          isOpen={isLeaderModalOpen}
          onClose={() => setIsLeaderModalOpen(false)}
          title={`Đổi Trưởng Nhóm: ${targetTeam.name}`}
        >
          <form onSubmit={handleSaveLeader} className="space-y-4">
            <div className="p-3 bg-amber-950/30 border border-amber-500/30 rounded-lg text-xs text-amber-200">
              <b>Lưu ý chuyển đơn:</b> Khi đổi trưởng nhóm, toàn bộ các đơn đang chờ duyệt của thành viên trong nhóm sẽ tự động chuyển sang trưởng nhóm mới để không bị kẹt đơn.
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Chọn Trưởng Nhóm Mới <span className="text-red-400">*</span>
              </label>
              <select
                value={newLeaderId}
                onChange={e => setNewLeaderId(e.target.value)}
                required
                className="w-full bg-surface border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
              >
                <option value="">-- Chọn nhân sự làm trưởng nhóm --</option>
                <option value="d0000000-0000-0000-0000-000000000002">NGUYỄN THANH TÙNG (05ACT) - Manager</option>
                <option value="d0000000-0000-0000-0000-000000000001">Nguyễn Thị Thu Hà (01HR) - HR Admin</option>
                <option value="d0000000-0000-0000-0000-000000000003">Vũ Văn Luận (136ACT) - Team Lead</option>
                <option value="d0000000-0000-0000-0000-000000000000">Quản Trị Viên Hệ Thống (Admin)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Lý Do Đổi Trưởng Nhóm (Bắt buộc ghi Audit Log) <span className="text-red-400">*</span>
              </label>
              <textarea
                value={leaderChangeReason}
                onChange={e => setLeaderChangeReason(e.target.value)}
                required
                rows={3}
                placeholder="Nhập lý do điều động / bổ nhiệm trưởng nhóm..."
                className="w-full bg-surface border border-white/10 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-accent"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setIsLeaderModalOpen(false)}>
                Hủy
              </Button>
              <Button variant="primary" type="submit">
                Xác Nhận Đổi Trưởng Nhóm
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: Thêm nhóm con */}
      {isAddTeamModalOpen && (
        <Modal
          isOpen={isAddTeamModalOpen}
          onClose={() => setIsAddTeamModalOpen(false)}
          title={parentTeamForAdd ? `Thêm Nhóm Con Trực Thuộc: ${parentTeamForAdd.name}` : 'Thêm Nhóm Gốc Mới'}
        >
          <form onSubmit={handleCreateTeam} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Tên Nhóm / Phòng Ban <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={newTeamName}
                onChange={e => setNewTeamName(e.target.value)}
                required
                placeholder="Ví dụ: Backend Core, AI Intelligence..."
                className="w-full bg-surface border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Trưởng Nhóm (Có thể để trống để gán sau)
              </label>
              <select
                value={newTeamLeaderId}
                onChange={e => setNewTeamLeaderId(e.target.value)}
                className="w-full bg-surface border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
              >
                <option value="">-- Chưa có trưởng nhóm (Sẽ hiển thị cảnh báo để bổ sung) --</option>
                <option value="d0000000-0000-0000-0000-000000000002">NGUYỄN THANH TÙNG (05ACT)</option>
                <option value="d0000000-0000-0000-0000-000000000001">Nguyễn Thị Thu Hà (01HR)</option>
                <option value="d0000000-0000-0000-0000-000000000003">Vũ Văn Luận (136ACT)</option>
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setIsAddTeamModalOpen(false)}>
                Hủy
              </Button>
              <Button variant="primary" type="submit">
                Tạo Nhóm
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: Gán sếp cho nhân viên */}
      {isAssignMgrModalOpen && targetEmployee && (
        <Modal
          isOpen={isAssignMgrModalOpen}
          onClose={() => setIsAssignMgrModalOpen(false)}
          title={`Gán Quản Lý Trực Tiếp Cho ${targetEmployee.fullName}`}
        >
          <form onSubmit={handleAssignManager} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Chọn Quản Lý Trực Tiếp <span className="text-red-400">*</span>
              </label>
              <select
                value={assignMgrId}
                onChange={e => setAssignMgrId(e.target.value)}
                required
                className="w-full bg-surface border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
              >
                <option value="d0000000-0000-0000-0000-000000000002">NGUYỄN THANH TÙNG (05ACT) - Quản lý kỹ thuật</option>
                <option value="d0000000-0000-0000-0000-000000000001">Nguyễn Thị Thu Hà (01HR) - HR Admin</option>
                <option value="d0000000-0000-0000-0000-000000000000">Quản Trị Viên Hệ Thống (Admin)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Lý Do Gán Quản Lý <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={assignMgrReason}
                onChange={e => setAssignMgrReason(e.target.value)}
                required
                className="w-full bg-surface border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setIsAssignMgrModalOpen(false)}>
                Hủy
              </Button>
              <Button variant="primary" type="submit">
                Gán Quản Lý
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
