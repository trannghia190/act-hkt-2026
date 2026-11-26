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
  ShieldCheck,
  Workflow,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Eye,
  X,
  UserPlus,
  Sparkles
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
  const [viewMode, setViewMode] = useState<'graph' | 'chart' | 'tree'>('graph');
  const [zoom, setZoom] = useState<number>(100);
  const [memberFilter, setMemberFilter] = useState<'all' | 'pending' | 'no-mgr'>('all');

  // Available users for manager/leader dropdown
  const [allUsers, setAllUsers] = useState<EmployeeItem[]>([]);

  // Modal: Đổi trưởng nhóm
  const [isLeaderModalOpen, setIsLeaderModalOpen] = useState(false);
  const [targetTeam, setTargetTeam] = useState<OrgNode | null>(null);
  const [newLeaderId, setNewLeaderId] = useState('');
  const [leaderChangeReason, setLeaderChangeReason] = useState('');

  // Modal: Tạo nhóm con / nhóm mới
  const [isAddTeamModalOpen, setIsAddTeamModalOpen] = useState(false);
  const [parentTeamForAdd, setParentTeamForAdd] = useState<OrgNode | null>(null);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamLeaderId, setNewTeamLeaderId] = useState('');

  // Modal: Gán quản lý cho nhân viên trực tiếp
  const [isAssignMgrModalOpen, setIsAssignMgrModalOpen] = useState(false);
  const [targetEmployee, setTargetEmployee] = useState<EmployeeItem | null>(null);
  const [assignMgrId, setAssignMgrId] = useState('');
  const [assignMgrReason, setAssignMgrReason] = useState('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const authHeaders = (): Record<string, string> => {
    try {
      const u = JSON.parse(localStorage.getItem('pulse_auth_user') || '{}');
      return u?.accessToken
        ? { Authorization: `Bearer ${u.accessToken}`, 'Content-Type': 'application/json' }
        : { 'Content-Type': 'application/json' };
    } catch {
      return { 'Content-Type': 'application/json' };
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/v1/admin/users?size=100', {
        headers: authHeaders(),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data?.content) {
          setAllUsers(json.data.content);
        }
      }
    } catch (e) {
      console.warn('Cannot load all users', e);
    }
  };

  const fetchTree = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/org/tree', {
        headers: authHeaders(),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          // Tính toán tổng số thành viên và đơn chờ cho từng subtree
          const processed = computeSubtreeTotals(json.data);
          setTreeData(processed);

          // Tự động mở rộng các nhóm cấp cao nhất
          const initExpanded: Record<string, boolean> = {};
          const expandRecursive = (nodes: OrgNode[]) => {
            nodes.forEach((n) => {
              initExpanded[n.id] = true;
              if (n.children) expandRecursive(n.children);
            });
          };
          expandRecursive(processed);
          setExpandedNodes(initExpanded);

          // Nếu chưa chọn node nào, chọn node đầu tiên để người dùng dễ xem
          if (!selectedNode && processed.length > 0) {
            setSelectedNode(processed[0]);
          }
        }
      }
    } catch (e) {
      console.error('Lỗi khi tải cây cơ cấu tổ chức', e);
    } finally {
      setLoading(false);
    }
  };

  const computeSubtreeTotals = (nodes: OrgNode[]): OrgNode[] => {
    return nodes.map((node) => {
      const children = node.children ? computeSubtreeTotals(node.children) : [];
      const totalMemberCount =
        (node.memberCount || (node.members ? node.members.length : 0)) +
        children.reduce((acc, c) => acc + c.totalMemberCount, 0);
      const totalPendingRequestsCount =
        (node.pendingRequestsCount || 0) +
        children.reduce((acc, c) => acc + c.totalPendingRequestsCount, 0);

      return {
        ...node,
        children,
        totalMemberCount,
        totalPendingRequestsCount,
      };
    });
  };

  useEffect(() => {
    fetchTree();
    fetchUsers();
  }, []);

  const toggleExpand = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedNodes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const expandAll = () => {
    const map: Record<string, boolean> = {};
    const traverse = (nodes: OrgNode[]) => {
      nodes.forEach((n) => {
        map[n.id] = true;
        if (n.children) traverse(n.children);
      });
    };
    traverse(treeData);
    setExpandedNodes(map);
  };

  const collapseAll = () => {
    setExpandedNodes({});
  };

  // Tính số lượng thống kê toàn hệ thống
  let totalTeamsCount = 0;
  let totalMembersAll = 0;
  let totalPendingAll = 0;
  let brokenGroups = 0;
  let brokenMembers = 0;

  const countIssues = (nodes: OrgNode[]) => {
    nodes.forEach((n) => {
      totalTeamsCount++;
      if (!n.hasLeader) brokenGroups++;
      totalMembersAll += n.memberCount || (n.members ? n.members.length : 0);
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
                  ? { ...m, managerId: assignMgrId, managerName: allUsers.find((u) => u.id === assignMgrId)?.fullName }
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
      return node.members.filter((_, idx) => idx % 2 === 0);
    }
    if (memberFilter === 'no-mgr') {
      return node.members.filter((m) => !m.managerId);
    }
    return node.members;
  };

  // ==========================================
  // VIEW MODE 1: INTERACTIVE GRAPH (SƠ ĐỒ GRAPH ĐỒ THỊ)
  // ==========================================
  const renderGraphNode = (node: OrgNode, level: number = 0): React.ReactNode => {
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

    const isMatch =
      searchQuery.trim() &&
      (node.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        node.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (node.leaderName && node.leaderName.toLowerCase().includes(searchQuery.toLowerCase())));

    return (
      <div key={node.id} className="flex flex-col items-center">
        {/* Graph Card */}
        <div
          onClick={() => setSelectedNode(node)}
          className={`w-64 rounded-2xl border transition-all cursor-pointer shadow-sm hover:shadow-xl relative text-left bg-surface select-none group ${
            isSelected
              ? 'ring-2 ring-accent border-accent shadow-lg scale-[1.02]'
              : isBroken
              ? 'border-status-warn ring-2 ring-status-warn/20 shadow-md'
              : isMatch
              ? 'border-status-info ring-2 ring-status-info/30'
              : 'border-line hover:border-accent/40 hover:shadow-md'
          }`}
        >
          {/* Header Strip with Tier Gradient */}
          <div
            className={`px-3.5 py-2.5 rounded-t-2xl flex items-center justify-between text-on-info ${
              level === 0
                ? 'bg-gradient-to-r from-status-info via-status-info to-status-info'
                : level === 1
                ? 'bg-gradient-to-r from-status-ok via-status-ok to-status-ok'
                : level === 2
                ? 'bg-gradient-to-r from-status-info via-status-info to-status-info'
                : 'bg-gradient-to-r from-status-warn via-status-warn to-status-warn'
            }`}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <Building2 className="w-3.5 h-3.5 shrink-0 opacity-90" />
              <span className="font-bold text-xs truncate" title={node.name}>
                {node.name}
              </span>
            </div>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/25 font-bold uppercase shrink-0">
              #{node.code}
            </span>
          </div>

          {/* Card Body */}
          <div className="p-3 space-y-2.5 text-xs">
            {/* Leader Section */}
            <div className="flex items-center gap-2 p-2 rounded-xl bg-canvas/80 border border-line/70">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-on-accent shrink-0 shadow-2xs ${
                  node.hasLeader
                    ? 'bg-gradient-to-br from-accent to-status-ok'
                    : 'bg-gradient-to-br from-status-warn to-status-danger'
                }`}
              >
                {node.hasLeader ? (node.leaderName ? node.leaderName.charAt(0) : 'L') : '?'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] text-ink-muted font-medium">Trưởng nhóm:</div>
                {node.hasLeader ? (
                  <div className="font-bold text-ink truncate text-xs" title={node.leaderName || ''}>
                    {node.leaderName}{' '}
                    <span className="font-mono text-[10px] text-ink-muted font-normal">({node.leaderCode})</span>
                  </div>
                ) : (
                  <div className="text-status-warn font-bold text-[11px] flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    Chưa có trưởng nhóm
                  </div>
                )}
              </div>
            </div>

            {/* Metrics Row (3-column pill cards) */}
            <div className="grid grid-cols-3 gap-1.5 text-center font-semibold">
              <div className="p-1.5 rounded-lg bg-status-info-soft border border-status-info-line/80 text-status-info">
                <div className="text-[10px] text-status-info flex items-center justify-center gap-0.5">
                  <Users className="w-2.5 h-2.5" />
                  <span>Nhân sự</span>
                </div>
                <div className="text-xs font-bold">{node.totalMemberCount}</div>
              </div>

              <div
                className={`p-1.5 rounded-lg border ${
                  node.totalPendingRequestsCount > 0
                    ? 'bg-status-warn-soft border-status-warn-line text-status-warn'
                    : 'bg-canvas border-line text-ink-muted'
                }`}
              >
                <div className="text-[10px] flex items-center justify-center gap-0.5">
                  <Clock className="w-2.5 h-2.5" />
                  <span>Đơn chờ</span>
                </div>
                <div className="text-xs font-bold">{node.totalPendingRequestsCount}</div>
              </div>

              <div
                className={`p-1.5 rounded-lg border ${
                  noMgrCount > 0 || isBroken
                    ? 'bg-status-danger-soft border-status-danger-line text-status-danger'
                    : 'bg-status-ok-soft border-status-ok-line text-status-ok'
                }`}
              >
                <div className="text-[10px] flex items-center justify-center gap-0.5">
                  <ShieldAlert className="w-2.5 h-2.5" />
                  <span>Nghẽn</span>
                </div>
                <div className="text-xs font-bold">{noMgrCount > 0 ? `${noMgrCount} lỗi` : '0'}</div>
              </div>
            </div>

            {/* Quick Actions Row */}
            <div className="flex items-center justify-between pt-1 border-t border-line/60 gap-1 text-[11px]">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedNode(node);
                }}
                className="px-2 py-1 rounded-md bg-accent-soft hover:bg-accent hover:text-on-accent text-accent-dark font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                title="Xem danh sách nhân viên trong nhóm"
              >
                <Eye className="w-3 h-3" />
                <span>Xem ({node.memberCount})</span>
              </button>

              {canManage && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setParentTeamForAdd(node);
                      setIsAddTeamModalOpen(true);
                    }}
                    className="p-1 rounded-md bg-canvas hover:bg-accent-soft border border-line text-ink-secondary hover:text-accent-dark font-semibold transition-colors cursor-pointer"
                    title="Thêm nhóm con trực thuộc"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setTargetTeam(node);
                      setNewLeaderId(node.leaderId || '');
                      setLeaderChangeReason('');
                      setIsLeaderModalOpen(true);
                    }}
                    className="p-1 rounded-md bg-canvas hover:bg-status-warn-soft border border-line text-ink-secondary hover:text-status-warn font-semibold transition-colors cursor-pointer"
                    title="Đổi trưởng nhóm"
                  >
                    <UserCheck className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Expand / Collapse Pill Centered At Bottom */}
          {hasChildren && (
            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-10">
              <button
                type="button"
                onClick={(e) => toggleExpand(node.id, e)}
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border shadow-xs transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                  isExpanded
                    ? 'bg-surface text-ink border-line hover:bg-accent hover:text-on-accent'
                    : 'bg-accent text-on-accent border-accent shadow-sm'
                }`}
                title={isExpanded ? 'Thu gọn các nhánh con' : 'Mở rộng các nhánh con'}
              >
                <span>{isExpanded ? '−' : '+'}</span>
                <span>{node.children.length} nhánh con</span>
              </button>
            </div>
          )}
        </div>

        {/* Child Branches with Pure CSS/SVG Connector Lines */}
        {hasChildren && isExpanded && (
          <div className="flex flex-col items-center w-full">
            {/* Vertical Stem from parent to horizontal rail */}
            <div className="w-0.5 h-8 bg-accent/40" />

            {/* Children container */}
            <div className="flex justify-center items-start relative pt-6 gap-6">
              {/* Horizontal rail bar if more than 1 child */}
              {node.children.length > 1 && (
                <div
                  className="absolute top-0 h-0.5 bg-accent/40"
                  style={{
                    left: `${(1 / (node.children.length * 2)) * 100}%`,
                    right: `${(1 / (node.children.length * 2)) * 100}%`,
                  }}
                />
              )}

              {/* Recursive child nodes */}
              {node.children.map((child) => (
                <div key={child.id} className="relative flex flex-col items-center">
                  {/* Vertical stem from rail down to child card */}
                  <div className="absolute -top-6 w-0.5 h-6 bg-accent/40" />
                  {renderGraphNode(child, level + 1)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ==========================================
  // VIEW MODE 2: VISUAL CARD ORG CHART
  // ==========================================
  const renderVisualNodeCard = (node: OrgNode, level: number = 0) => {
    const isSelected = selectedNode?.id === node.id;
    const isBroken = !node.hasLeader;
    const noMgrCount = getNoManagerCountInNode(node);
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = !!expandedNodes[node.id];

    if (hideEmpty && node.totalMemberCount === 0 && node.totalPendingRequestsCount === 0) return null;
    if (onlyIssues && node.hasLeader && noMgrCount === 0 && node.totalPendingRequestsCount === 0) return null;

    const isMatch =
      searchQuery.trim() &&
      (node.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        node.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (node.leaderName && node.leaderName.toLowerCase().includes(searchQuery.toLowerCase())));

    return (
      <div key={node.id} className="relative flex flex-col items-start w-full">
        {/* Node Card */}
        <div
          onClick={() => setSelectedNode(node)}
          className={`w-full rounded-2xl border transition-all cursor-pointer p-4 shadow-sm hover:shadow-md relative group ${isSelected
            ? 'bg-gradient-to-br from-status-ok/10 via-surface to-surface border-accent ring-2 ring-accent/30'
            : isBroken
              ? 'bg-gradient-to-br from-status-warn/10 via-surface to-surface border-status-warn/40 hover:border-status-warn/60'
              : isMatch
                ? 'bg-gradient-to-br from-status-info/10 via-surface to-surface border-status-info'
                : 'bg-surface border-line hover:border-accent/40 hover:bg-canvas/60'
            }`}
        >
          {/* Top Pill Bar */}
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className={`text-[10px] uppercase font-mono font-bold tracking-wider px-2 py-0.5 rounded-full ${
                  level === 0
                    ? 'bg-status-info-soft text-status-info border border-status-info-line'
                    : level === 1
                    ? 'bg-status-info-soft text-status-info border border-status-info-line'
                    : 'bg-status-ok-soft text-status-ok border border-status-ok-line'
                  }`}
              >
                {level === 0 ? 'Khối Gốc' : level === 1 ? 'Phòng Ban' : `Tiểu Nhóm (L${level})`}
              </span>
              <span className="text-[10px] font-mono text-ink-muted">#{node.code}</span>
              {node.isSpecialApproval && (
                <span className="text-[10px] bg-status-info-soft text-status-info border border-status-info-line px-1.5 py-0.2 rounded font-semibold">
                  Duyệt đặc biệt
                </span>
              )}
            </div>

            {hasChildren && (
              <button
                type="button"
                onClick={(e) => toggleExpand(node.id, e)}
                className="p-1 rounded-md text-ink-muted hover:text-ink hover:bg-surface border border-line text-[11px] flex items-center gap-1 font-semibold"
                title={isExpanded ? 'Thu gọn nhánh con' : 'Mở rộng nhánh con'}
              >
                <span>{node.children.length} nhánh</span>
                {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>

          {/* Department Name */}
          <div className="flex items-center gap-2 mb-3">
            <Building2 className={`w-5 h-5 shrink-0 ${level === 0 ? 'text-status-info' : 'text-accent'}`} />
            <h3 className="text-sm font-bold text-ink truncate group-hover:text-accent transition-colors">
              {node.name}
            </h3>
          </div>

          {/* Leader Section */}
          <div className="p-2.5 rounded-xl bg-canvas/80 border border-line/70 mb-3 text-xs">
            {node.hasLeader ? (
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-accent-soft text-accent-dark font-bold flex items-center justify-center text-xs">
                    {node.leaderName ? node.leaderName.charAt(0) : 'L'}
                  </div>
                  <div>
                    <div className="text-[10px] text-ink-muted">Trưởng nhóm</div>
                    <div className="font-bold text-ink">
                      {node.leaderName}{' '}
                      <span className="font-mono text-ink-muted text-[10px]">({node.leaderCode})</span>
                    </div>
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
                    className="px-2 py-1 text-[11px] font-semibold text-accent-dark hover:bg-accent-soft rounded-lg border border-line"
                  >
                    Đổi trưởng
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-status-warn">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-status-warn" />
                  <div>
                    <div className="font-bold text-xs">Chưa có trưởng nhóm</div>
                    <div className="text-[10px] text-ink-muted">Đơn chờ trong nhóm có thể bị kẹt phê duyệt</div>
                  </div>
                </div>

                {canManage && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setTargetTeam(node);
                      setNewLeaderId('');
                      setLeaderChangeReason('');
                      setIsLeaderModalOpen(true);
                    }}
                    className="px-2 py-1 text-[11px] font-bold text-status-warn bg-status-warn-soft hover:bg-status-warn-line rounded-lg border border-status-warn-line"
                  >
                    Gán trưởng ngay
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Bottom Metrics Bar */}
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-line/60 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 bg-canvas border border-line rounded-md text-[11px] font-mono text-ink-secondary flex items-center gap-1">
                <Users className="w-3 h-3 text-status-info" />
                {node.memberCount} trực tiếp ({node.totalMemberCount} toàn nhánh)
              </span>

              {node.totalPendingRequestsCount > 0 && (
                <span className="px-2 py-0.5 bg-status-warn-soft border border-status-warn-line text-status-warn rounded-md text-[11px] font-semibold flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {node.totalPendingRequestsCount} đơn chờ
                </span>
              )}

              {noMgrCount > 0 && (
                <span className="px-2 py-0.5 bg-status-danger-soft border border-status-danger-line text-status-danger rounded-md text-[11px] font-semibold flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3" />
                  {noMgrCount} thiếu sếp
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              {canManage && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setParentTeamForAdd(node);
                    setIsAddTeamModalOpen(true);
                  }}
                  className="p-1 rounded-md text-ink-muted hover:text-accent hover:bg-canvas"
                  title="Thêm nhóm con"
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
              <ChevronRight className="w-4 h-4 text-ink-muted group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
            </div>
          </div>
        </div>

        {/* Children Rows */}
        {hasChildren && isExpanded && (
          <div className="w-full pl-6 mt-3 border-l-2 border-line/70 space-y-3">
            {node.children.map((child) => renderVisualNodeCard(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  // ==========================================
  // VIEW MODE 3: TREE EXPLORER
  // ==========================================
  const renderTreeNode = (node: OrgNode, level: number = 0) => {
    const isSelected = selectedNode?.id === node.id;
    const isBroken = !node.hasLeader;
    const noMgrCount = getNoManagerCountInNode(node);
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = !!expandedNodes[node.id];

    if (hideEmpty && node.totalMemberCount === 0 && node.totalPendingRequestsCount === 0) return null;
    if (onlyIssues && node.hasLeader && noMgrCount === 0 && node.totalPendingRequestsCount === 0) return null;

    return (
      <div key={node.id} className="space-y-1">
        <div
          onClick={() => setSelectedNode(node)}
          style={{ paddingLeft: `${level * 20 + 8}px` }}
          className={`flex items-center justify-between p-2 rounded-xl transition-all cursor-pointer ${
            isSelected
              ? 'bg-accent-soft text-accent-dark font-bold border border-accent/30'
              : isBroken
              ? 'bg-status-warn-soft text-status-warn border border-status-warn-line'
              : 'hover:bg-canvas text-ink'
            }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {hasChildren ? (
              <button
                type="button"
                onClick={(e) => toggleExpand(node.id, e)}
                className="p-0.5 text-ink-muted hover:text-ink rounded"
              >
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            ) : (
              <span className="w-4" />
            )}

            <Building2 className={`w-4 h-4 shrink-0 ${level === 0 ? 'text-status-info' : 'text-accent'}`} />

            <div className="min-w-0 flex items-center gap-2">
              <span className="font-semibold text-xs truncate">{node.name}</span>
              <span className="font-mono text-[10px] text-ink-muted">#{node.code}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 bg-canvas border border-line rounded-md text-xs font-mono text-ink-secondary">
              {node.memberCount} ng {node.totalMemberCount > node.memberCount && `(${node.totalMemberCount} nhánh)`}
            </span>

            {node.totalPendingRequestsCount > 0 && (
              <span className="px-2 py-0.5 bg-status-warn-soft border border-status-warn-line text-status-warn rounded-md text-xs font-semibold flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {node.totalPendingRequestsCount} đơn
              </span>
            )}

            {noMgrCount > 0 && (
              <span className="px-2 py-0.5 bg-status-danger-soft border border-status-danger-line text-status-danger rounded-md text-xs font-semibold">
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
        <div className="p-3.5 bg-status-ok-soft border border-status-ok-line text-status-ok rounded-xl text-xs flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-status-ok" />
            <span className="font-semibold">{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-status-ok hover:text-status-ok font-bold ml-2">
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
              Cây Phân Tầng Quản Lý &amp; Sơ Đồ Cơ Cấu
            </h1>
            <Badge variant="accent">P0 · A4</Badge>
          </div>
          <p className="text-xs text-ink-muted">
            Quản trị cơ cấu phòng ban lồng nhau không giới hạn số tầng · Khám phá sơ đồ Graph đồ thị, tìm điểm nghẽn và bàn giao đơn chờ tự động
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {brokenGroups + brokenMembers > 0 && (
            <span className="px-3 py-1.5 bg-status-warn-soft text-status-warn border border-status-warn-line rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-2xs">
              <AlertTriangle className="w-4 h-4 text-status-warn" />
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

      {/* Metrics Summary Strip (Vibrant, high-contrast colors) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-3.5 bg-surface border border-line rounded-xl flex items-center gap-3 shadow-2xs">
          <div className="w-10 h-10 rounded-xl bg-status-info-soft text-status-info flex items-center justify-center font-bold">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-ink-muted font-medium">Tổng phòng ban</div>
            <div className="text-lg font-bold text-ink">{totalTeamsCount} nhóm</div>
          </div>
        </div>

        <div className="p-3.5 bg-surface border border-line rounded-xl flex items-center gap-3 shadow-2xs">
          <div className="w-10 h-10 rounded-xl bg-status-info-soft text-status-info flex items-center justify-center font-bold">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-ink-muted font-medium">Tổng nhân sự</div>
            <div className="text-lg font-bold text-ink">{totalMembersAll} người</div>
          </div>
        </div>

        <div className="p-3.5 bg-surface border border-line rounded-xl flex items-center gap-3 shadow-2xs">
          <div className="w-10 h-10 rounded-xl bg-status-warn-soft text-status-warn flex items-center justify-center font-bold">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-ink-muted font-medium">Đơn chờ duyệt</div>
            <div className="text-lg font-bold text-status-warn">{totalPendingAll} đơn</div>
          </div>
        </div>

        <div className="p-3.5 bg-surface border border-line rounded-xl flex items-center gap-3 shadow-2xs">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
              brokenGroups + brokenMembers > 0 ? 'bg-status-danger-soft text-status-danger' : 'bg-status-ok-soft text-status-ok'
            }`}
          >
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-ink-muted font-medium">Điểm nghẽn duyệt</div>
            <div
              className={`text-lg font-bold ${
                brokenGroups + brokenMembers > 0 ? 'text-status-danger' : 'text-status-ok'
              }`}
            >
              {brokenGroups + brokenMembers > 0 ? `${brokenGroups + brokenMembers} điểm lỗi` : 'An toàn 100%'}
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar & Controls */}
      <Card>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          {/* View Mode Toggle Buttons */}
          <div className="flex items-center gap-1 p-1 bg-canvas border border-line rounded-xl self-start">
            <button
              type="button"
              onClick={() => setViewMode('graph')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'graph'
                  ? 'bg-ink text-canvas shadow-xs font-bold'
                  : 'text-ink-secondary hover:text-ink hover:bg-surface'
              }`}
            >
              <Workflow className="w-3.5 h-3.5" />
              <span>Sơ Đồ Graph (Đồ Thị)</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('chart')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'chart'
                  ? 'bg-ink text-canvas shadow-xs font-bold'
                  : 'text-ink-secondary hover:text-ink hover:bg-surface'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Thẻ Phân Tầng</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('tree')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'tree'
                  ? 'bg-ink text-canvas shadow-xs font-bold'
                  : 'text-ink-secondary hover:text-ink hover:bg-surface'
              }`}
            >
              <ListTree className="w-3.5 h-3.5" />
              <span>Cây Thư Mục</span>
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
                  ? 'bg-status-warn-soft border-status-warn-line text-status-warn font-bold'
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
                  ? 'bg-accent-soft border-accent text-accent-dark font-bold'
                  : 'bg-canvas border-line text-ink-muted hover:text-ink'
              }`}
            >
              Ẩn nhóm rỗng
            </button>
            <button
              type="button"
              onClick={expandAll}
              className="px-2.5 py-1.5 rounded-lg bg-canvas border border-line text-xs text-ink-muted hover:text-ink font-semibold cursor-pointer"
            >
              Mở tất cả
            </button>
            <button
              type="button"
              onClick={collapseAll}
              className="px-2.5 py-1.5 rounded-lg bg-canvas border border-line text-xs text-ink-muted hover:text-ink font-semibold cursor-pointer"
            >
              Thu gọn
            </button>
          </div>
        </div>
      </Card>

      {/* Main Layout: Left (Graph / Chart / Tree) · Right (Node Detail Drawer) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column */}
        <div className={selectedNode ? 'lg:col-span-8 space-y-3' : 'lg:col-span-12 space-y-3'}>
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
          ) : viewMode === 'graph' ? (
            <div className="space-y-2">
              {/* Graph Toolbar: Zoom & Actions */}
              <div className="flex items-center justify-between gap-3 p-2.5 bg-surface border border-line rounded-xl text-xs shadow-2xs">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-ink-muted">Thu phóng sơ đồ:</span>
                  <button
                    type="button"
                    onClick={() => setZoom((z) => Math.max(50, z - 15))}
                    className="w-7 h-7 rounded-lg bg-canvas hover:bg-surface border border-line flex items-center justify-center font-bold text-ink cursor-pointer"
                    title="Thu nhỏ"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="font-mono font-bold text-xs text-ink w-12 text-center">{zoom}%</span>
                  <button
                    type="button"
                    onClick={() => setZoom((z) => Math.min(150, z + 15))}
                    className="w-7 h-7 rounded-lg bg-canvas hover:bg-surface border border-line flex items-center justify-center font-bold text-ink cursor-pointer"
                    title="Phóng to"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoom(100)}
                    className="px-2 py-1 rounded-lg bg-canvas hover:bg-surface border border-line text-[11px] font-semibold text-ink-muted hover:text-ink cursor-pointer"
                  >
                    Reset 100%
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-ink-muted hidden sm:inline">
                    💡 Click vào thẻ để xem danh sách nhân viên
                  </span>
                </div>
              </div>

              {/* Graph Canvas Container */}
              <div
                className="w-full overflow-x-auto overflow-y-auto p-8 rounded-2xl border border-line bg-canvas/40 shadow-inner min-h-[580px] relative"
                style={{
                  backgroundImage: 'radial-gradient(circle, rgb(var(--line)) 1.2px, transparent 1.2px)',
                  backgroundSize: '24px 24px',
                }}
              >
                <div
                  style={{
                    transform: `scale(${zoom / 100})`,
                    transformOrigin: 'top center',
                  }}
                  className="transition-transform duration-150 inline-block min-w-full pb-16"
                >
                  <div className="flex justify-center items-start gap-12">
                    {treeData.map((rootNode) => renderGraphNode(rootNode, 0))}
                  </div>
                </div>
              </div>
            </div>
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

        {/* Right Column: Node Details & Member Drawer */}
        {selectedNode && (
          <div className="lg:col-span-4 sticky top-4">
            <Card className="p-4 space-y-4 border-line shadow-sm">
              {/* Header */}
              <div className="border-b border-line pb-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-accent-soft text-accent-dark border border-accent/30 font-bold">
                      #{selectedNode.code}
                    </span>
                    {selectedNode.isSpecialApproval && (
                      <span className="text-[10px] bg-status-info-soft text-status-info border border-status-info-line px-1.5 py-0.5 rounded font-semibold">
                        Duyệt đặc biệt
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedNode(null)}
                    className="p-1 hover:bg-canvas rounded-lg text-ink-muted hover:text-ink text-xs font-bold"
                    title="Đóng ngăn chi tiết"
                  >
                    ✕ Đóng
                  </button>
                </div>

                <h3 className="text-base font-bold text-ink">{selectedNode.name}</h3>
                {selectedNode.parentName && (
                  <div className="text-[11px] text-ink-muted mt-0.5">
                    Thuộc khối: <strong className="text-ink">{selectedNode.parentName}</strong>
                  </div>
                )}
              </div>

              {/* Leader Section */}
              <div className="p-3 bg-canvas border border-line rounded-xl text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-ink-muted">Trưởng nhóm phê duyệt:</span>
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => {
                        setTargetTeam(selectedNode);
                        setNewLeaderId(selectedNode.leaderId || '');
                        setLeaderChangeReason('');
                        setIsLeaderModalOpen(true);
                      }}
                      className="text-[11px] font-bold text-accent hover:underline flex items-center gap-1"
                    >
                      <UserCheck className="w-3 h-3" />
                      Đổi trưởng nhóm
                    </button>
                  )}
                </div>

                {selectedNode.hasLeader ? (
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-accent-soft text-accent-dark font-bold flex items-center justify-center text-xs">
                      {selectedNode.leaderName ? selectedNode.leaderName.charAt(0) : 'L'}
                    </div>
                    <div>
                      <div className="font-bold text-ink">{selectedNode.leaderName}</div>
                      <div className="text-[10px] text-ink-muted font-mono">{selectedNode.leaderCode}</div>
                    </div>
                  </div>
                ) : (
                  <div className="p-2 rounded-lg bg-status-warn-soft border border-status-warn-line text-status-warn text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-status-warn shrink-0" />
                    <div>
                      <div className="font-bold">Chưa có người duyệt trực tiếp</div>
                      <div className="text-[10px]">Đơn từ sẽ bị tắc nếu không gán quản lý</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Members Section with Filter Tabs */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-ink">Thành viên ({selectedNode.members?.length || 0})</span>
                  <div className="flex items-center gap-1 bg-canvas p-0.5 rounded-lg border border-line">
                    <button
                      type="button"
                      onClick={() => setMemberFilter('all')}
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold cursor-pointer ${
                        memberFilter === 'all' ? 'bg-surface text-ink shadow-2xs font-bold' : 'text-ink-muted'
                      }`}
                    >
                      Tất cả
                    </button>
                    <button
                      type="button"
                      onClick={() => setMemberFilter('pending')}
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold cursor-pointer ${
                        memberFilter === 'pending' ? 'bg-surface text-status-warn shadow-2xs font-bold' : 'text-ink-muted'
                      }`}
                    >
                      Có đơn chờ
                    </button>
                    <button
                      type="button"
                      onClick={() => setMemberFilter('no-mgr')}
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold cursor-pointer ${
                        memberFilter === 'no-mgr' ? 'bg-surface text-status-danger shadow-2xs font-bold' : 'text-ink-muted'
                      }`}
                    >
                      Thiếu sếp
                    </button>
                  </div>
                </div>

                <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                  {getFilteredMembers(selectedNode).length === 0 ? (
                    <div className="p-6 text-center text-ink-muted text-xs bg-canvas rounded-xl">
                      Không có nhân sự nào trong danh mục này
                    </div>
                  ) : (
                    getFilteredMembers(selectedNode).map((m) => (
                      <div
                        key={m.id}
                        className="p-2.5 rounded-xl border border-line hover:border-accent/40 bg-surface transition-all text-xs space-y-1.5 shadow-2xs"
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-bold text-ink flex items-center gap-1.5">
                            <span className="truncate">{m.fullName}</span>
                            <span className="text-[10px] font-mono text-ink-muted">({m.employeeCode})</span>
                          </div>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              m.role === 'ADMIN'
                                ? 'bg-status-info-soft text-status-info border border-status-info-line'
                                : m.role === 'MANAGER'
                                ? 'bg-status-warn-soft text-status-warn border border-status-warn-line'
                                : 'bg-status-info-soft text-status-info border border-status-info-line'
                            }`}
                          >
                            {m.role || 'EMPLOYEE'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-line/50">
                          {m.managerId ? (
                            <span className="text-ink-muted flex items-center gap-1">
                              <GitPullRequest className="w-3 h-3 text-accent" />
                              Sếp: <strong className="text-ink">{m.managerName || 'Quản lý'}</strong>
                            </span>
                          ) : (
                            <span className="text-status-danger font-bold flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              Chưa có người duyệt!
                            </span>
                          )}

                          {canManage && (
                            <button
                              type="button"
                              onClick={() => {
                                setTargetEmployee(m);
                                setAssignMgrId(m.managerId || '');
                                setAssignMgrReason('Gán quản lý trực tiếp từ sơ đồ cây');
                                setIsAssignMgrModalOpen(true);
                              }}
                              className="text-accent hover:underline font-bold text-[10px]"
                            >
                              {m.managerId ? 'Đổi sếp' : 'Gán sếp ngay'}
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Sub-teams list in node */}
              {selectedNode.children && selectedNode.children.length > 0 && (
                <div className="pt-2 border-t border-line space-y-2 text-xs">
                  <span className="font-bold text-ink">Nhóm con trực thuộc ({selectedNode.children.length}):</span>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedNode.children.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelectedNode(c)}
                        className="px-2 py-1 rounded-lg bg-canvas hover:bg-surface border border-line text-[11px] font-semibold text-ink flex items-center gap-1 cursor-pointer"
                      >
                        <Building2 className="w-3 h-3 text-accent" />
                        <span>{c.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>

      {/* MODAL 1: Đổi Trưởng Nhóm */}
      <Modal
        isOpen={isLeaderModalOpen}
        onClose={() => setIsLeaderModalOpen(false)}
        title={`Đổi Trưởng Nhóm: ${targetTeam?.name || ''}`}
      >
        <form onSubmit={handleSaveLeader} className="space-y-4 text-xs">
          <div className="p-3 bg-status-warn-soft border border-status-warn-line rounded-xl text-status-warn flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-status-warn shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>Quy tắc A4:</strong> Khi đổi trưởng nhóm, toàn bộ đơn từ đang chờ duyệt (`PENDING_APPROVAL`) của nhóm
              sẽ được <strong>bàn giao tự động</strong> sang cho trưởng nhóm mới để không bị tắc luồng.
            </p>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-ink-muted mb-1">
              Chọn Trưởng Nhóm Mới <span className="text-status-danger">*</span>
            </label>
            <select
              value={newLeaderId}
              onChange={(e) => setNewLeaderId(e.target.value)}
              required
              className="w-full text-xs px-3 py-2 border border-line rounded-lg bg-canvas text-ink focus:outline-none focus:border-accent"
            >
              <option value="">-- Chọn nhân sự làm trưởng nhóm --</option>
              {allUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName} ({u.employeeCode}) - {u.positionName || u.role}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-ink-muted mb-1">
              Lý do thay đổi (Bắt buộc theo A5 - Nhật ký kiểm toán) <span className="text-status-danger">*</span>
            </label>
            <textarea
              value={leaderChangeReason}
              onChange={(e) => setLeaderChangeReason(e.target.value)}
              required
              placeholder="Ví dụ: Bổ nhiệm trưởng phòng mới theo Quyết định số 18/QĐ-NS..."
              rows={3}
              className="w-full text-xs p-2.5 border border-line rounded-lg bg-canvas text-ink focus:outline-none focus:border-accent"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-line">
            <Button variant="ghost" size="sm" type="button" onClick={() => setIsLeaderModalOpen(false)}>
              Hủy
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Xác Nhận &amp; Bàn Giao Đơn
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: Tạo Nhóm Con / Nhóm Mới */}
      <Modal
        isOpen={isAddTeamModalOpen}
        onClose={() => setIsAddTeamModalOpen(false)}
        title={parentTeamForAdd ? `Thêm Nhóm Con Thuộc: ${parentTeamForAdd.name}` : 'Tạo Nhóm Gốc Mới'}
      >
        <form onSubmit={handleCreateTeam} className="space-y-4 text-xs">
          <div>
            <label className="block text-[11px] font-semibold text-ink-muted mb-1">
              Tên Nhóm / Phòng Ban <span className="text-status-danger">*</span>
            </label>
            <input
              type="text"
              required
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              placeholder="Ví dụ: AI Research Team, Khối Vận Hành..."
              className="w-full text-xs px-3 py-2 border border-line rounded-lg bg-canvas text-ink focus:outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-ink-muted mb-1">
              Trưởng Nhóm Ban Đầu (Có thể để trống theo A4)
            </label>
            <select
              value={newTeamLeaderId}
              onChange={(e) => setNewTeamLeaderId(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-line rounded-lg bg-canvas text-ink focus:outline-none focus:border-accent"
            >
              <option value="">-- Để trống (Chưa có trưởng nhóm) --</option>
              {allUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName} ({u.employeeCode})
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-line">
            <Button variant="ghost" size="sm" type="button" onClick={() => setIsAddTeamModalOpen(false)}>
              Hủy
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Tạo Nhóm Ngay
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 3: Gán Quản Lý Cho Nhân Viên */}
      <Modal
        isOpen={isAssignMgrModalOpen}
        onClose={() => setIsAssignMgrModalOpen(false)}
        title={`Gán Quản Lý Trực Tiếp Cho: ${targetEmployee?.fullName || ''}`}
      >
        <form onSubmit={handleAssignManager} className="space-y-4 text-xs">
          <div>
            <label className="block text-[11px] font-semibold text-ink-muted mb-1">
              Chọn Người Quản Lý Trực Tiếp <span className="text-status-danger">*</span>
            </label>
            <select
              value={assignMgrId}
              onChange={(e) => setAssignMgrId(e.target.value)}
              required
              className="w-full text-xs px-3 py-2 border border-line rounded-lg bg-canvas text-ink focus:outline-none focus:border-accent"
            >
              <option value="">-- Chọn sếp trực tiếp --</option>
              {allUsers
                .filter((u) => u.id !== targetEmployee?.id)
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName} ({u.employeeCode}) - {u.team || 'Chưa nhóm'}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-ink-muted mb-1">
              Lý do thay đổi (Kiểm toán A5)
            </label>
            <input
              type="text"
              value={assignMgrReason}
              onChange={(e) => setAssignMgrReason(e.target.value)}
              placeholder="Ví dụ: Gán sếp trực tiếp để thông luồng duyệt..."
              className="w-full text-xs px-3 py-2 border border-line rounded-lg bg-canvas text-ink focus:outline-none focus:border-accent"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-line">
            <Button variant="ghost" size="sm" type="button" onClick={() => setIsAssignMgrModalOpen(false)}>
              Hủy
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Lưu &amp; Cập Nhật Sếp
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
