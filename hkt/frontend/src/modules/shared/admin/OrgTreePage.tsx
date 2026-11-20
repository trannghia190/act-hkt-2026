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
  Edit2,
  LayoutGrid,
  ListTree,
  RefreshCw,
  Layers,
  Building2,
  ShieldCheck
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
  const [viewMode, setViewMode] = useState<'chart' | 'tree'>('chart');
  const [memberFilter, setMemberFilter] = useState<'all' | 'pending' | 'no-mgr'>('all');

  // Available users for manager/leader dropdown
  const [allUsers, setAllUsers] = useState<EmployeeItem[]>([]);

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
  const [assignMgrId, setAssignMgrId] = useState('');
  const [assignMgrReason, setAssignMgrReason] = useState('Gán quản lý trực tiếp từ sơ đồ phân tầng');

  const authHeaders = (): Record<string, string> => {
    try {
      const u = JSON.parse(localStorage.getItem('pulse_auth_user') || '{}');
      return u?.accessToken ? { Authorization: `Bearer ${u.accessToken}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
    } catch {
      return { 'Content-Type': 'application/json' };
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/v1/admin/users?size=100', { headers: authHeaders() });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data?.content) {
          setAllUsers(json.data.content);
        }
      }
    } catch (e) {
      console.warn('Lỗi tải danh sách nhân sự cho dropdown', e);
    }
  };

  const fetchTree = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/org/tree', { headers: authHeaders() });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setTreeData(json.data);
          // Mặc định mở tất cả node gốc
          const exp: Record<string, boolean> = {};
          const traverse = (nodes: OrgNode[]) => {
            nodes.forEach((n) => {
              exp[n.id] = true;
              if (n.children && n.children.length > 0) traverse(n.children);
            });
          };
          traverse(json.data);
          setExpandedNodes(exp);
          if (json.data.length > 0 && !selectedNode) {
            setSelectedNode(json.data[0]);
          }
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
    fetchUsers();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const toggleExpand = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedNodes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const expandAll = () => {
    const exp: Record<string, boolean> = {};
    const traverse = (nodes: OrgNode[]) => {
      nodes.forEach((n) => {
        exp[n.id] = true;
        if (n.children && n.children.length > 0) traverse(n.children);
      });
    };
    traverse(treeData);
    setExpandedNodes(exp);
  };

  const collapseAll = () => {
    setExpandedNodes({});
  };

  // Tính số điểm gãy: nhóm chưa có trưởng + nhân viên chưa có quản lý
  let brokenGroups = 0;
  let brokenMembers = 0;
  let totalMembersAll = 0;
  let totalPendingAll = 0;
  let totalTeamsCount = 0;

  const countIssues = (nodes: OrgNode[]) => {
    nodes.forEach((n) => {
      totalTeamsCount++;
      if (!n.hasLeader) brokenGroups++;
      totalMembersAll += n.memberCount;
      totalPendingAll += n.pendingRequestsCount;
      if (n.members) {
        n.members.forEach((m) => {
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
        headers: authHeaders(),
        body: JSON.stringify({
          newLeaderId: newLeaderId.trim(),
          reason: leaderChangeReason.trim(),
        }),
      });
      const json = await res.json();
      if (json.success) {
        showToast(json.message || 'Đổi trưởng nhóm thành công và chuyển đơn chờ duyệt sang trưởng mới!');
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
        headers: authHeaders(),
        body: JSON.stringify({
          name: newTeamName.trim(),
          parentId: parentTeamForAdd ? parentTeamForAdd.id : null,
          leaderId: newTeamLeaderId.trim() || null,
          reason: 'Mở rộng cơ cấu phân tầng phòng ban',
        }),
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
      alert('Lỗi kết nối máy chủ');
    }
  };

  // Gán quản lý cho nhân viên
  const handleAssignManager = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetEmployee || !assignMgrId) return;
    try {
      const res = await fetch(`/api/v1/admin/users/${targetEmployee.employeeCode}/change-manager`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          newManagerId: assignMgrId,
          reason: assignMgrReason.trim() || 'Gán quản lý trực tiếp từ sơ đồ cây',
        }),
      });
      const json = await res.json();
      if (json.success) {
        showToast(`Đã gán quản lý cho ${targetEmployee.fullName} thành công!`);
        setIsAssignMgrModalOpen(false);
        fetchTree();
        if (selectedNode) {
          setSelectedNode((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              members: prev.members.map((m) =>
                m.id === targetEmployee.id
                  ? { ...m, managerId: assignMgrId, managerName: 'Đã gán quản lý' }
                  : m
              ),
            };
          });
        }
      } else {
        alert(json.message || 'Lỗi gán quản lý');
      }
    } catch (e) {
      alert('Lỗi kết nối máy chủ');
    }
  };

  // Helper tính số thành viên thiếu quản lý trong 1 node
  const getNoManagerCountInNode = (node: OrgNode): number => {
    return node.members ? node.members.filter((m) => !m.managerId).length : 0;
  };

  // Lọc danh sách nhân viên trong Selected Node Panel
  const getFilteredMembers = (node: OrgNode): EmployeeItem[] => {
    if (!node.members) return [];
    if (memberFilter === 'pending') {
      // giả sử có pending
      return node.members;
    }
    if (memberFilter === 'no-mgr') {
      return node.members.filter((m) => !m.managerId);
    }
    return node.members;
  };

  // ==========================================
  // VIEW MODE 1: VISUAL CARD ORG CHART
  // ==========================================
  const renderVisualNodeCard = (node: OrgNode, level: number = 0) => {
    const isSelected = selectedNode?.id === node.id;
    const isBroken = !node.hasLeader;
    const noMgrCount = getNoManagerCountInNode(node);
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = !!expandedNodes[node.id];

    // Filter "Ẩn nhánh rỗng"
    if (hideEmpty && node.totalMemberCount === 0 && node.totalPendingRequestsCount === 0) {
      return null;
    }

    // Filter "Chỉ hiện nhánh có lỗi / đơn chờ"
    if (onlyIssues && node.hasLeader && noMgrCount === 0 && node.totalPendingRequestsCount === 0) {
      return null;
    }

    // Highlight search match
    const isMatch =
      searchQuery.trim() &&
      (node.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (node.leaderName && node.leaderName.toLowerCase().includes(searchQuery.toLowerCase())));

    return (
      <div key={node.id} className="relative flex flex-col items-start w-full">
        {/* Node Card */}
        <div
          onClick={() => setSelectedNode(node)}
          className={`w-full rounded-2xl border transition-all cursor-pointer p-4 shadow-sm hover:shadow-md relative group ${
            isSelected
              ? 'bg-gradient-to-br from-emerald-500/10 via-surface to-surface border-accent ring-2 ring-accent/30'
              : isBroken
              ? 'bg-gradient-to-br from-amber-500/10 via-surface to-surface border-amber-500/40 hover:border-amber-500/60'
              : isMatch
              ? 'bg-gradient-to-br from-sky-500/10 via-surface to-surface border-sky-400'
              : 'bg-surface border-line hover:border-accent/40 hover:bg-canvas/60'
          }`}
        >
          {/* Top Pill Bar */}
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className={`text-[10px] uppercase font-mono font-bold tracking-wider px-2 py-0.5 rounded-full ${
                  level === 0
                    ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
                    : level === 1
                    ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                    : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                }`}
              >
                {level === 0 ? 'Khối Gốc' : level === 1 ? 'Phòng Ban' : `Tiểu Nhóm (L${level})`}
              </span>
              <span className="text-[10px] font-mono text-ink-muted">#{node.code}</span>
              {node.isSpecialApproval && (
                <span className="text-[10px] bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 px-1.5 py-0.2 rounded font-semibold">
                  Duyệt đặc biệt
                </span>
              )}
            </div>

            {hasChildren && (
              <button
                type="button"
                onClick={(e) => toggleExpand(node.id, e)}
                className="p-1 rounded-md text-ink-muted hover:text-white hover:bg-surface border border-line text-[11px] flex items-center gap-1 font-semibold"
                title={isExpanded ? 'Thu gọn nhánh con' : 'Mở rộng nhánh con'}
              >
                <span>{node.children.length} nhánh</span>
                {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>

          {/* Department Name */}
          <div className="flex items-center gap-2 mb-3">
            <Building2 className={`w-5 h-5 shrink-0 ${level === 0 ? 'text-purple-400' : 'text-accent'}`} />
            <h3 className="text-sm font-bold text-ink truncate group-hover:text-accent transition-colors">
              {node.name}
            </h3>
          </div>

          {/* Leader Section */}
          <div className="p-2.5 rounded-xl bg-canvas/80 border border-line/70 mb-3 text-xs">
            {node.hasLeader ? (
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-accent/20 text-accent font-bold text-[11px] flex items-center justify-center shrink-0 uppercase ring-1 ring-accent/30">
                    {node.leaderName?.substring(0, 2) || 'TR'}
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-ink truncate">{node.leaderName}</div>
                    <div className="text-[10px] text-ink-muted font-mono">Trưởng nhóm · {node.leaderCode}</div>
                  </div>
                </div>
                {canManage && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setTargetTeam(node);
                      setNewLeaderId(node.leaderId || '');
                      setLeaderChangeReason('');
                      setIsLeaderModalOpen(true);
                    }}
                    className="p-1 rounded hover:bg-surface text-ink-muted hover:text-accent transition-colors"
                    title="Đổi trưởng nhóm"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-amber-400 font-semibold text-[11px]">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
                  <span>Chưa có trưởng nhóm!</span>
                </div>
                {canManage && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setTargetTeam(node);
                      setNewLeaderId('');
                      setLeaderChangeReason('Bổ nhiệm trưởng nhóm mới');
                      setIsLeaderModalOpen(true);
                    }}
                    className="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30"
                  >
                    Gán ngay
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Metrics & Status Badges */}
          <div className="flex items-center justify-between gap-2 text-xs flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded-lg bg-surface border border-line text-[11px] font-mono text-ink-secondary">
                <Users className="w-3 h-3 inline mr-1 text-ink-muted" />
                {node.memberCount} ng {node.totalMemberCount > node.memberCount && `(${node.totalMemberCount} cả nhánh)`}
              </span>

              {node.totalPendingRequestsCount > 0 && (
                <span className="px-2 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-[11px] font-bold text-amber-400 flex items-center gap-1 animate-pulse">
                  <Clock className="w-3 h-3" />
                  {node.totalPendingRequestsCount} đơn chờ
                </span>
              )}

              {noMgrCount > 0 && (
                <span className="px-2 py-0.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-[11px] font-bold text-rose-400 flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3" />
                  {noMgrCount} thiếu sếp
                </span>
              )}
            </div>

            {canManage && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setParentTeamForAdd(node);
                  setIsAddTeamModalOpen(true);
                }}
                className="p-1 rounded-md bg-canvas hover:bg-accent hover:text-white text-ink-muted border border-line text-[11px] transition-all"
                title="Thêm nhóm con trực thuộc"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Child Subtree (Connected with Lines) */}
        {hasChildren && isExpanded && (
          <div className="w-full pl-6 sm:pl-8 border-l-2 border-dashed border-line/70 mt-2 space-y-2">
            {node.children.map((child) => renderVisualNodeCard(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  // ==========================================
  // VIEW MODE 2: HIERARCHICAL TREE VIEW
  // ==========================================
  const renderTreeNode = (node: OrgNode, level: number = 0) => {
    const isExpanded = !!expandedNodes[node.id];
    const hasChildren = node.children && node.children.length > 0;
    const isSelected = selectedNode?.id === node.id;
    const isBroken = !node.hasLeader;
    const noMgrCount = getNoManagerCountInNode(node);

    if (hideEmpty && node.totalMemberCount === 0 && node.totalPendingRequestsCount === 0) {
      return null;
    }
    if (onlyIssues && node.hasLeader && noMgrCount === 0 && node.totalPendingRequestsCount === 0) {
      return null;
    }

    return (
      <div key={node.id} className="relative transition-all">
        <div
          onClick={() => setSelectedNode(node)}
          className={`cursor-pointer group flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 rounded-xl border transition-all mb-2 shadow-2xs ${
            isSelected
              ? 'bg-accent/15 border-accent'
              : isBroken
              ? 'bg-amber-500/10 border-amber-500/40'
              : 'bg-surface border-line hover:border-line-focus hover:bg-canvas'
          }`}
          style={{ marginLeft: `${Math.min(level * 20, 140)}px` }}
        >
          <div className="flex items-center gap-2.5">
            {hasChildren ? (
              <button
                type="button"
                onClick={(e) => toggleExpand(node.id, e)}
                className="p-1 rounded hover:bg-canvas text-ink-muted hover:text-ink transition-colors"
              >
                {isExpanded ? <ChevronDown className="w-4 h-4 text-accent" /> : <ChevronRight className="w-4 h-4 text-ink-muted" />}
              </button>
            ) : (
              <div className="w-6 h-6 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-ink-muted/40" />
              </div>
            )}

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-ink text-sm group-hover:text-accent transition-colors">
                  {node.name}
                </span>
                <span className="text-[10px] font-mono text-ink-muted px-1.5 py-0.2 rounded bg-canvas border border-line">
                  {node.code}
                </span>
                {node.isSpecialApproval && (
                  <span className="text-[10px] bg-purple-500/15 text-purple-400 border border-purple-500/30 px-1.5 py-0.2 rounded font-semibold">
                    Duyệt đặc biệt
                  </span>
                )}
              </div>

              <div className="text-xs text-ink-muted flex items-center gap-2 mt-0.5">
                {node.hasLeader ? (
                  <span>
                    Trưởng nhóm: <strong className="text-ink">{node.leaderName}</strong> ({node.leaderCode})
                  </span>
                ) : (
                  <span className="text-amber-400 font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Chưa có trưởng nhóm
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 bg-canvas border border-line rounded-md text-xs font-mono text-ink-secondary">
              {node.memberCount} ng {node.totalMemberCount > node.memberCount && `(${node.totalMemberCount} nhánh)`}
            </span>

            {node.totalPendingRequestsCount > 0 && (
              <span className="px-2 py-0.5 bg-amber-500/15 border border-amber-500/30 text-amber-400 rounded-md text-xs font-semibold flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {node.totalPendingRequestsCount} đơn
              </span>
            )}

            {noMgrCount > 0 && (
              <span className="px-2 py-0.5 bg-rose-500/15 border border-rose-500/30 text-rose-400 rounded-md text-xs font-semibold">
                {noMgrCount} thiếu sếp
              </span>
            )}
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div className="border-l-2 border-dashed border-line pl-3 ml-4 space-y-1">
            {node.children.map((child) => renderTreeNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-24">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="p-3.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold">{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-emerald-400 hover:text-white font-bold ml-2">
            ✕
          </button>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold tracking-tight text-ink flex items-center gap-2">
              <Network className="w-5 h-5 text-accent" />
              Cây Phân Tầng Quản Lý &amp; Sơ Đồ Nhóm
            </h1>
            <Badge variant="accent">S41 / P0 · A4</Badge>
          </div>
          <p className="text-xs text-ink-muted">
            Quản trị cơ cấu phòng ban lồng nhau không giới hạn số tầng · Tìm ngay điểm kẹt phê duyệt đơn và nhân viên chưa có cấp trên
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {brokenGroups + brokenMembers > 0 && (
            <span className="px-3 py-1.5 bg-amber-500/15 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-2xs">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              ⚠ {brokenGroups + brokenMembers} điểm cần sửa ({brokenMembers} người thiếu sếp, {brokenGroups} nhóm thiếu trưởng)
            </span>
          )}

          {canManage && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setParentTeamForAdd(null);
                setIsAddTeamModalOpen(true);
              }}
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              + Tạo Nhóm Gốc
            </Button>
          )}
        </div>
      </div>

      {/* Metrics Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-3.5 bg-surface border border-line rounded-xl flex items-center gap-3 shadow-2xs">
          <div className="w-9 h-9 rounded-lg bg-accent-soft text-accent flex items-center justify-center font-bold">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-ink-muted font-medium">Tổng phòng ban</div>
            <div className="text-lg font-bold text-ink">{totalTeamsCount} nhóm</div>
          </div>
        </div>

        <div className="p-3.5 bg-surface border border-line rounded-xl flex items-center gap-3 shadow-2xs">
          <div className="w-9 h-9 rounded-lg bg-sky-500/15 text-sky-400 flex items-center justify-center font-bold">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-ink-muted font-medium">Tổng nhân sự</div>
            <div className="text-lg font-bold text-ink">{totalMembersAll} người</div>
          </div>
        </div>

        <div className="p-3.5 bg-surface border border-line rounded-xl flex items-center gap-3 shadow-2xs">
          <div className="w-9 h-9 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center font-bold">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-ink-muted font-medium">Đơn chờ duyệt</div>
            <div className="text-lg font-bold text-amber-400">{totalPendingAll} đơn</div>
          </div>
        </div>

        <div className="p-3.5 bg-surface border border-line rounded-xl flex items-center gap-3 shadow-2xs">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold ${brokenGroups + brokenMembers > 0 ? 'bg-rose-500/15 text-rose-400' : 'bg-emerald-500/15 text-emerald-400'}`}>
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-ink-muted font-medium">Điểm nghẽn duyệt</div>
            <div className={`text-lg font-bold ${brokenGroups + brokenMembers > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {brokenGroups + brokenMembers > 0 ? `${brokenGroups + brokenMembers} điểm lỗi` : 'An toàn 100%'}
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar & Controls */}
      <Card>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          {/* View Mode Toggle Buttons */}
          <div className="flex items-center gap-1.5 p-1 bg-canvas border border-line rounded-xl self-start">
            <button
              type="button"
              onClick={() => setViewMode('chart')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'chart'
                  ? 'bg-accent text-white shadow-xs font-bold'
                  : 'text-ink-secondary hover:text-ink'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Sơ Đồ Phân Cấp (Org Chart)</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('tree')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'tree'
                  ? 'bg-accent text-white shadow-xs font-bold'
                  : 'text-ink-secondary hover:text-ink'
              }`}
            >
              <ListTree className="w-3.5 h-3.5" />
              <span>Cây Lồng Nhau (Explorer)</span>
            </button>
          </div>

          {/* Search Input */}
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative w-full">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-ink-muted" />
              <input
                type="text"
                placeholder="Tìm tên nhóm, mã nhóm, tên trưởng nhóm..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs pl-8 pr-3 py-2 border border-line rounded-lg bg-canvas text-ink focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          {/* Quick Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setOnlyIssues(!onlyIssues)}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                onlyIssues
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 font-bold'
                  : 'bg-canvas border-line text-ink-muted hover:text-ink'
              }`}
            >
              ⚠ Chỉ xem điểm kẹt
            </button>
            <button
              type="button"
              onClick={() => setHideEmpty(!hideEmpty)}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                hideEmpty
                  ? 'bg-accent/20 border-accent/40 text-accent font-bold'
                  : 'bg-canvas border-line text-ink-muted hover:text-ink'
              }`}
            >
              Ẩn nhóm rỗng
            </button>
            <button
              type="button"
              onClick={expandAll}
              className="px-2.5 py-1.5 rounded-lg bg-canvas border border-line text-xs text-ink-muted hover:text-ink font-semibold"
            >
              Mở tất cả
            </button>
            <button
              type="button"
              onClick={collapseAll}
              className="px-2.5 py-1.5 rounded-lg bg-canvas border border-line text-xs text-ink-muted hover:text-ink font-semibold"
            >
              Thu gọn
            </button>
          </div>
        </div>
      </Card>

      {/* Main 2-Column Layout: Left (Chart / Tree) · Right (Node Detail Drawer) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: 7 Cols */}
        <div className="lg:col-span-7 space-y-3">
          {loading ? (
            <Card className="p-12 text-center text-ink-muted">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-accent" />
              <p className="font-semibold text-sm text-ink">Đang tải và xây dựng cây phân tầng tổ chức...</p>
            </Card>
          ) : treeData.length === 0 ? (
            <Card className="p-12 text-center text-ink-muted space-y-3">
              <Building2 className="w-10 h-10 mx-auto text-ink-muted/50" />
              <p className="font-bold text-sm text-ink">Chưa có nhóm hoặc phòng ban nào được tạo</p>
              <p className="text-xs text-ink-muted">Bắt đầu bằng việc tạo nhóm gốc đầu tiên cho công ty.</p>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setParentTeamForAdd(null);
                  setIsAddTeamModalOpen(true);
                }}
              >
                + Tạo Nhóm Đầu Tiên
              </Button>
            </Card>
          ) : viewMode === 'chart' ? (
            <div className="space-y-4">
              {treeData.map((rootNode) => renderVisualNodeCard(rootNode, 0))}
            </div>
          ) : (
            <Card className="p-4 space-y-1">
              {treeData.map((rootNode) => renderTreeNode(rootNode, 0))}
            </Card>
          )}
        </div>

        {/* Right Column: 5 Cols (Selected Node Details Panel) */}
        <div className="lg:col-span-5 sticky top-4">
          {selectedNode ? (
            <Card className="p-4 space-y-4 border-line shadow-sm">
              {/* Header */}
              <div className="border-b border-line pb-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/30 font-bold">
                      {selectedNode.code}
                    </span>
                    {selectedNode.isSpecialApproval && (
                      <span className="text-[10px] bg-purple-500/15 text-purple-400 border border-purple-500/30 px-1.5 py-0.5 rounded font-semibold">
                        Duyệt đặc biệt
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-ink-muted font-mono">
                    {selectedNode.parentName ? `Thuộc: ${selectedNode.parentName}` : 'Khối gốc'}
                  </span>
                </div>
                <h2 className="text-base font-bold text-ink">{selectedNode.name}</h2>
              </div>

              {/* Trưởng nhóm card */}
              <div className="p-3 rounded-xl bg-canvas border border-line space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-ink-muted uppercase tracking-wider">
                    Trưởng Nhóm (Leader)
                  </span>
                  {canManage && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setTargetTeam(selectedNode);
                        setNewLeaderId(selectedNode.leaderId || '');
                        setLeaderChangeReason('');
                        setIsLeaderModalOpen(true);
                      }}
                      className="text-[10px] py-0.5 px-2 h-auto"
                    >
                      <Edit2 className="w-3 h-3 mr-1" />
                      Đổi trưởng
                    </Button>
                  )}
                </div>

                {selectedNode.hasLeader ? (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-accent-soft text-accent font-bold text-sm flex items-center justify-center shrink-0 uppercase ring-1 ring-accent-line">
                      {selectedNode.leaderName?.substring(0, 2) || 'TR'}
                    </div>
                    <div>
                      <div className="font-bold text-ink">{selectedNode.leaderName}</div>
                      <div className="text-[11px] text-ink-muted font-mono">{selectedNode.leaderCode} · Người duyệt chính</div>
                    </div>
                  </div>
                ) : (
                  <div className="p-2.5 bg-amber-500/15 border border-amber-500/30 rounded-lg text-amber-300 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Chưa có trưởng nhóm! Đơn từ của các thành viên sẽ bị kẹt không có người duyệt.</span>
                  </div>
                )}
              </div>

              {/* Thống kê nhóm */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 bg-canvas rounded-xl border border-line">
                  <div className="text-[10px] text-ink-muted font-medium">Nhân sự trực thuộc</div>
                  <div className="text-base font-bold text-ink mt-0.5">
                    {selectedNode.memberCount} <span className="text-[11px] text-ink-muted font-normal">({selectedNode.totalMemberCount} cả nhánh)</span>
                  </div>
                </div>

                <div className="p-2.5 bg-canvas rounded-xl border border-line">
                  <div className="text-[10px] text-ink-muted font-medium">Đơn chờ phê duyệt</div>
                  <div className="text-base font-bold text-amber-400 mt-0.5">
                    {selectedNode.totalPendingRequestsCount} đơn
                  </div>
                </div>
              </div>

              {/* Danh sách thành viên trực thuộc */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-ink uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-accent" />
                    <span>Thành viên ({selectedNode.members.length})</span>
                  </h4>

                  {/* Filter chips */}
                  <div className="flex gap-1 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setMemberFilter('all')}
                      className={`px-2 py-0.5 rounded font-semibold ${memberFilter === 'all' ? 'bg-accent text-white' : 'text-ink-muted hover:text-ink'}`}
                    >
                      Tất cả
                    </button>
                    <button
                      type="button"
                      onClick={() => setMemberFilter('no-mgr')}
                      className={`px-2 py-0.5 rounded font-semibold ${memberFilter === 'no-mgr' ? 'bg-rose-500 text-white' : 'text-ink-muted hover:text-ink'}`}
                    >
                      Thiếu sếp ({getNoManagerCountInNode(selectedNode)})
                    </button>
                  </div>
                </div>

                {selectedNode.members.length === 0 ? (
                  <p className="text-xs text-ink-muted italic py-6 text-center border border-dashed border-line rounded-xl">
                    Nhóm hiện chưa có nhân viên nào trực thuộc
                  </p>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                    {getFilteredMembers(selectedNode).map((member) => {
                      const hasMgr = !!member.managerId;
                      return (
                        <div
                          key={member.id}
                          className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-3 ${
                            hasMgr ? 'bg-canvas border-line' : 'bg-rose-500/10 border-rose-500/30'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-ink truncate">{member.fullName}</span>
                              <span className="text-[10px] text-ink-muted font-mono">({member.employeeCode})</span>
                            </div>
                            <div className="text-[11px] mt-0.5 truncate">
                              {hasMgr ? (
                                <span className="text-ink-muted">
                                  Sếp: <strong className="text-ink-secondary">{member.managerName}</strong>
                                </span>
                              ) : (
                                <span className="text-rose-400 font-bold flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3 text-rose-500" />
                                  Chưa có quản lý duyệt đơn
                                </span>
                              )}
                            </div>
                          </div>

                          {!hasMgr && canManage && (
                            <button
                              type="button"
                              onClick={() => {
                                setTargetEmployee(member);
                                setAssignMgrId(allUsers[0]?.id || '');
                                setIsAssignMgrModalOpen(true);
                              }}
                              className="px-2 py-1 text-[10px] font-bold rounded-lg bg-rose-500 hover:bg-rose-600 text-white transition-colors shrink-0"
                            >
                              Gán sếp
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-between items-center pt-3 border-t border-line">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setParentTeamForAdd(selectedNode);
                    setIsAddTeamModalOpen(true);
                  }}
                  className="gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm Nhóm Con</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedNode(null)}
                >
                  Đóng
                </Button>
              </div>
            </Card>
          ) : (
            <Card className="p-8 text-center text-ink-muted bg-surface border-line space-y-2">
              <Network className="w-10 h-10 text-ink-muted/40 mx-auto mb-2" />
              <p className="font-bold text-sm text-ink">Chọn một nhóm để xem chi tiết</p>
              <p className="text-xs text-ink-muted">
                Xem danh sách nhân viên bên dưới, ai chưa có quản lý duyệt đơn, và cơ cấu nhóm con.
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
          <form onSubmit={handleSaveLeader} className="space-y-4 text-xs">
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <span>Bảo lưu và tự động bàn giao đơn chờ duyệt (A4)</span>
              </div>
              <p className="text-[11px] text-amber-200/80 leading-relaxed">
                Khi đổi trưởng nhóm, toàn bộ đơn từ đang chờ phê duyệt của các thành viên trong nhóm sẽ tự động được bàn giao sang trưởng nhóm mới, đảm bảo luồng công việc không bao giờ bị tắc nghẽn.
              </p>
            </div>

            <div>
              <label className="block font-semibold text-ink mb-1">
                Chọn Trưởng Nhóm Mới *
              </label>
              <select
                value={newLeaderId}
                onChange={(e) => setNewLeaderId(e.target.value)}
                required
                className="w-full bg-canvas border border-line rounded-lg p-2.5 text-xs text-ink focus:outline-none focus:border-accent font-medium"
              >
                <option value="">-- Chọn nhân sự từ danh bạ công ty --</option>
                {allUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName} ({u.employeeCode}) - {u.role} ({u.team || 'Không có nhóm'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-ink mb-1">
                Lý Do Đổi Trưởng Nhóm * <span className="text-accent font-normal">(Ghi nhận kiểm toán A5)</span>
              </label>
              <textarea
                value={leaderChangeReason}
                onChange={(e) => setLeaderChangeReason(e.target.value)}
                required
                rows={3}
                placeholder="Nhập lý do điều động / bổ nhiệm trưởng nhóm..."
                className="w-full bg-canvas border border-line rounded-lg p-2.5 text-xs text-ink placeholder:text-ink-muted focus:outline-none focus:border-accent"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsLeaderModalOpen(false)}>
                Hủy
              </Button>
              <Button type="submit" variant="primary" size="sm">
                Xác Nhận Đổi Trưởng Nhóm
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: Thêm nhóm con hoặc nhóm gốc */}
      {isAddTeamModalOpen && (
        <Modal
          isOpen={isAddTeamModalOpen}
          onClose={() => setIsAddTeamModalOpen(false)}
          title={parentTeamForAdd ? `Thêm Nhóm Con Trực Thuộc: ${parentTeamForAdd.name}` : 'Thêm Nhóm Gốc Mới'}
        >
          <form onSubmit={handleCreateTeam} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-ink mb-1">
                Tên Nhóm / Phòng Ban *
              </label>
              <input
                type="text"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                required
                placeholder="Ví dụ: Backend Core, AI Platform, QA..."
                className="w-full bg-canvas border border-line rounded-lg p-2.5 text-xs text-ink placeholder:text-ink-muted focus:outline-none focus:border-accent font-medium"
              />
            </div>

            <div>
              <label className="block font-semibold text-ink mb-1">
                Trưởng Nhóm Khởi Tạo (Tùy chọn)
              </label>
              <select
                value={newTeamLeaderId}
                onChange={(e) => setNewTeamLeaderId(e.target.value)}
                className="w-full bg-canvas border border-line rounded-lg p-2.5 text-xs text-ink focus:outline-none focus:border-accent"
              >
                <option value="">-- Chưa gán trưởng nhóm (Có thể gán bổ sung sau) --</option>
                {allUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName} ({u.employeeCode}) - {u.role}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsAddTeamModalOpen(false)}>
                Hủy
              </Button>
              <Button type="submit" variant="primary" size="sm">
                Tạo Nhóm
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: Gán quản lý cho nhân viên chưa có quản lý */}
      {isAssignMgrModalOpen && targetEmployee && (
        <Modal
          isOpen={isAssignMgrModalOpen}
          onClose={() => setIsAssignMgrModalOpen(false)}
          title={`Gán Quản Lý Trực Tiếp Cho ${targetEmployee.fullName}`}
        >
          <form onSubmit={handleAssignManager} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-ink mb-1">
                Chọn Quản Lý Trực Tiếp *
              </label>
              <select
                value={assignMgrId}
                onChange={(e) => setAssignMgrId(e.target.value)}
                required
                className="w-full bg-canvas border border-line rounded-lg p-2.5 text-xs text-ink focus:outline-none focus:border-accent"
              >
                <option value="">-- Chọn quản lý phê duyệt đơn --</option>
                {allUsers
                  .filter((u) => u.id !== targetEmployee.id)
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName} ({u.employeeCode}) - {u.role} ({u.team || 'Chưa có nhóm'})
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-ink mb-1">
                Lý Do Gán Quản Lý *
              </label>
              <input
                type="text"
                value={assignMgrReason}
                onChange={(e) => setAssignMgrReason(e.target.value)}
                required
                className="w-full bg-canvas border border-line rounded-lg p-2.5 text-xs text-ink focus:outline-none focus:border-accent"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsAssignMgrModalOpen(false)}>
                Hủy
              </Button>
              <Button type="submit" variant="primary" size="sm">
                Xác Nhận Gán Quản Lý
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
