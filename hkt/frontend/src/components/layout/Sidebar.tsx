import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { SIDEBAR_CONFIG } from '../../config/sidebar.config';
import { useAuth } from '../../context/AuthContext';
import { ActHktLogo } from '../common/ActHktLogo';
import {
  Home,
  Inbox,
  Fingerprint,
  Calendar,
  FileText,
  FilePlus,
  Sun,
  CheckSquare,
  Users,
  Table,
  Sliders,
  BookOpen,
  Book,
  Target,
  Edit3,
  Award,
  CheckCircle,
  MessageSquare,
  Layout,
  BarChart2,
  FileSpreadsheet,
  UserCheck,
  GitPullRequest,
  Clock,
  Repeat,
  Shield,
  Settings,
  HelpCircle,
  PanelLeftClose,
  PanelLeft,
  X,
} from 'lucide-react';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Home,
  Inbox,
  Fingerprint,
  Calendar,
  FileText,
  FilePlus,
  Sun,
  CheckSquare,
  Users,
  Table,
  Sliders,
  BookOpen,
  Book,
  Target,
  Edit3,
  Award,
  CheckCircle,
  MessageSquare,
  Layout,
  BarChart2,
  FileSpreadsheet,
  UserCheck,
  GitPullRequest,
  Clock,
  Repeat,
  Shield,
  Settings,
  HelpCircle,
};

interface SidebarProps {
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const getModuleFromPath = (pathname: string): 'attendance' | 'okr' | 'shared' => {
  if (pathname.startsWith('/admin') || pathname.startsWith('/auth')) {
    return 'shared';
  }
  if (pathname.startsWith('/okr')) {
    return 'okr';
  }
  return 'attendance';
};

export const Sidebar: React.FC<SidebarProps> = ({
  isOpenMobile = false,
  onCloseMobile,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Desktop collapsible state (Icon-only mode vs Expanded)
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('act_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('act_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  // Synchronously compute active module from current route (Zero flash, zero layout shift)
  const activeModuleId = getModuleFromPath(location.pathname);
  const activeNav = SIDEBAR_CONFIG.find((m) => m.moduleId === activeModuleId) || SIDEBAR_CONFIG[0];

  // Seamless module tab switch with direct navigation
  const handleTabChange = (moduleId: 'attendance' | 'okr' | 'shared') => {
    if (moduleId === activeModuleId) return;

    if (moduleId === 'attendance') {
      navigate('/todo');
    } else if (moduleId === 'okr') {
      navigate('/okr/dashboard');
    } else if (moduleId === 'shared') {
      if (user?.role === 'ADMIN' || user?.role === 'HR_ADMIN') {
        navigate('/admin/employees');
      } else {
        navigate('/admin/org-tree');
      }
    }
  };

  // Filter groups and items according to user's assigned role
  const filteredGroups = activeNav.groups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => !item.roles || (user?.role && item.roles.includes(user.role))
      ),
    }))
    .filter((group) => group.items.length > 0);

  // Render Sidebar inner content
  const renderSidebarContent = (collapsed: boolean, isMobile: boolean = false) => {
    return (
      <div className="w-full h-full flex flex-col bg-[#141c1a] text-[#c3d0cc] select-none border-r border-[#1f2b28] overflow-hidden">
        {/* Brand Header */}
        <div
          className={`border-b border-[#23312e] flex items-center justify-between ${
            collapsed ? 'p-2.5 flex-col gap-2' : 'p-4'
          }`}
        >
          <NavLink
            to="/todo"
            onClick={onCloseMobile}
            className="flex items-center gap-2 cursor-pointer min-w-0"
            title="ACT-HKT 2026 Home"
          >
            <ActHktLogo size="md" showText={!collapsed} />
          </NavLink>

          {/* Desktop Collapse Toggle Button */}
          {!isMobile && (
            <button
              type="button"
              onClick={toggleCollapse}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              title={collapsed ? 'Mở rộng thanh menu (Ctrl+B)' : 'Thu gọn thanh menu (Icon only)'}
            >
              {collapsed ? (
                <PanelLeft className="w-4 h-4 text-emerald-400" />
              ) : (
                <PanelLeftClose className="w-4 h-4" />
              )}
            </button>
          )}

          {/* Close button on mobile drawer */}
          {isMobile && onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              title="Đóng menu"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Module Switcher Tabs (3 Phân Hệ) */}
        {!collapsed ? (
          <div className="p-2.5 bg-[#111716] border-b border-[#1f2b28] space-y-1.5 shrink-0">
            <div className="flex gap-1 bg-[#0d1312] p-1 rounded-lg border border-[#1f2b28]">
              <button
                type="button"
                onClick={() => handleTabChange('attendance')}
                className={`flex-1 py-1.5 px-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer truncate ${
                  activeModuleId === 'attendance'
                    ? 'bg-emerald-600 text-white font-bold shadow-sm ring-1 ring-emerald-400/30'
                    : 'text-[#8fa39d] hover:bg-[#1a2422] hover:text-white'
                }`}
              >
                Chấm Công
              </button>
              <button
                type="button"
                onClick={() => handleTabChange('okr')}
                className={`flex-1 py-1.5 px-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer ${
                  activeModuleId === 'okr'
                    ? 'bg-emerald-600 text-white font-bold shadow-sm ring-1 ring-emerald-400/30'
                    : 'text-[#8fa39d] hover:bg-[#1a2422] hover:text-white'
                }`}
              >
                OKR
              </button>
              <button
                type="button"
                onClick={() => handleTabChange('shared')}
                className={`flex-1 py-1.5 px-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer truncate ${
                  activeModuleId === 'shared'
                    ? 'bg-emerald-600 text-white font-bold shadow-sm ring-1 ring-emerald-400/30'
                    : 'text-[#8fa39d] hover:bg-[#1a2422] hover:text-white'
                }`}
              >
                Hệ Thống
              </button>
            </div>
            <div className="text-[10px] text-center font-medium text-emerald-400/90 truncate">
              {activeNav.moduleTitle}
            </div>
          </div>
        ) : (
          /* Mini Tab Switcher in Collapsed Mode */
          <div className="py-2 px-1.5 border-b border-[#1f2b28] bg-[#111716] flex flex-col gap-1.5 items-center shrink-0">
            <button
              type="button"
              onClick={() => handleTabChange('attendance')}
              className={`w-9 h-8 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                activeModuleId === 'attendance'
                  ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-400/40'
                  : 'text-[#8fa39d] hover:bg-[#1a2422] hover:text-white'
              }`}
              title="Phân hệ Chấm Công & Chuyên Cần"
            >
              <Fingerprint className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('okr')}
              className={`w-9 h-8 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                activeModuleId === 'okr'
                  ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-400/40'
                  : 'text-[#8fa39d] hover:bg-[#1a2422] hover:text-white'
              }`}
              title="Phân hệ Quản Trị & Đánh Giá OKR"
            >
              <Target className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('shared')}
              className={`w-9 h-8 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                activeModuleId === 'shared'
                  ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-400/40'
                  : 'text-[#8fa39d] hover:bg-[#1a2422] hover:text-white'
              }`}
              title="Phân hệ Hệ Thống & Cơ Cấu Tổ Chức"
            >
              <Sliders className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Navigation Menu Items List */}
        <div className="flex-1 overflow-y-auto py-2 px-2 scrollbar-thin scrollbar-thumb-zinc-700 min-h-0 space-y-4">
          {filteredGroups.map((group, gIdx) => (
            <div key={gIdx}>
              {!collapsed ? (
                <div className="px-3 pb-1 text-[10px] font-bold tracking-wider uppercase text-[#61756f] truncate">
                  {group.groupName}
                </div>
              ) : (
                <div className="my-1.5 border-t border-[#1f2b28]" />
              )}

              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const IconComponent = iconMap[item.icon] || HelpCircle;

                  return (
                    <NavLink
                      key={item.id}
                      to={item.path}
                      onClick={onCloseMobile}
                      title={`${item.label} (${item.screenId})`}
                      className={({ isActive }) =>
                        `flex items-center rounded-lg text-xs font-medium transition-colors cursor-pointer group ${
                          collapsed ? 'justify-center p-2.5 relative' : 'gap-2.5 px-3 py-2'
                        } ${
                          isActive
                            ? 'bg-[#1b3830] text-white font-semibold shadow-2xs border-l-3 border-emerald-400'
                            : 'text-[#a3b8b2] hover:bg-[#1a2422] hover:text-white'
                        }`
                      }
                    >
                      <IconComponent className="w-4 h-4 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity" />

                      {!collapsed ? (
                        <>
                          <span className="flex-1 truncate">{item.label}</span>
                          {item.badge && (
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none shrink-0 ${
                                item.badgeColor === 'danger'
                                  ? 'bg-rose-600 text-white'
                                  : 'bg-accent text-white'
                              }`}
                            >
                              {item.badge}
                            </span>
                          )}
                          <span className="text-[9px] font-mono opacity-40 shrink-0">{item.screenId}</span>
                        </>
                      ) : (
                        item.badge && (
                          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                        )
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* User Profile Footer */}
        <div
          className={`border-t border-[#1f2b28] bg-[#111716] flex items-center shrink-0 ${
            collapsed ? 'p-2 justify-center' : 'p-3 gap-3'
          }`}
        >
          <div
            className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30 flex items-center justify-center font-bold text-xs shrink-0 uppercase cursor-pointer"
            title={`${user?.fullName || 'User'} (${user?.employeeCode || 'ADMIN'}) · Vai trò: ${user?.role || 'ADMIN'}`}
          >
            {user ? user.fullName.substring(0, 2) : 'AD'}
          </div>

          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white truncate">{user?.fullName || 'Admin User'}</p>
              <p className="text-[10px] text-[#7c918b] truncate">
                {user?.employeeCode || 'ADMIN'} · {user?.role || 'ADMIN'}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* 1. Desktop Static Sidebar with Strictly Fixed Animated Width */}
      <aside
        className={`hidden lg:flex flex-col h-screen sticky top-0 shrink-0 z-30 transition-all duration-300 ease-in-out overflow-hidden ${
          isCollapsed
            ? 'w-[70px] min-w-[70px] max-w-[70px]'
            : 'w-64 min-w-[256px] max-w-[256px]'
        }`}
      >
        {renderSidebarContent(isCollapsed, false)}
      </aside>

      {/* 2. Mobile / Tablet Slide-over Drawer with Backdrop */}
      {isOpenMobile && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200"
            onClick={onCloseMobile}
          />
          {/* Full-width drawer content */}
          <div className="relative w-72 max-w-[85vw] h-full shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {renderSidebarContent(false, true)}
          </div>
        </div>
      )}
    </>
  );
};
