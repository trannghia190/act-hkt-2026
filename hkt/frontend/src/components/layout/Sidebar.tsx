import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { getNavForRole } from '../../config/sidebar.config';
import { useNavBadges } from '../../hooks/useNavBadges';
import { useAuth } from '../../context/AuthContext';
import { ActHktLogo } from '../common/ActHktLogo';
import {
  CheckSquare,
  Bell,
  Settings,
  Fingerprint,
  FilePlus,
  Calendar,
  Sun,
  FileText,
  Target,
  Edit3,
  Award,
  BarChart2,
  BookOpen,
  Smartphone,
  CheckCircle,
  Users,
  MessageSquare,
  Table,
  AlertTriangle,
  Layers,
  Sliders,
  Clock,
  CalendarRange,
  Shield,
  MonitorSmartphone,
  UserCheck,
  GitPullRequest,
  HelpCircle,
  PanelLeft,
  PanelLeftClose,
  X,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  MessageCircle,
  Tag,
} from 'lucide-react';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  CheckSquare,
  Bell,
  Settings,
  Fingerprint,
  FilePlus,
  Calendar,
  Sun,
  FileText,
  Target,
  Edit3,
  Award,
  BarChart2,
  BookOpen,
  Smartphone,
  CheckCircle,
  Users,
  MessageSquare,
  Table,
  AlertTriangle,
  Layers,
  Sliders,
  Clock,
  CalendarRange,
  Shield,
  MonitorSmartphone,
  UserCheck,
  GitPullRequest,
  HelpCircle,
  ClipboardCheck,
  MessageCircle,
  Tag,
};

interface SidebarProps {
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpenMobile = false,
  onCloseMobile,
}) => {
  const location = useLocation();
  const { user } = useAuth();
  const badges = useNavBadges();

  // Desktop collapsible state (Icon-only mode vs Expanded)
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('act_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const [expandedSubmenus, setExpandedSubmenus] = useState<Record<string, boolean>>({});

  const toggleSubmenu = (itemId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExpandedSubmenus((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('act_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  // Lấy danh sách menu theo đúng vai trò (Employee ⊂ Manager ⊂ HR) từ một nguồn cấu hình duy nhất
  const navGroups = getNavForRole(user?.role);

  // Render Sidebar inner content
  const renderSidebarContent = (collapsed: boolean, isMobile: boolean = false) => {
    return (
      <div className="w-full h-full flex flex-col bg-[#141c1a] text-[#c3d0cc] select-none border-r border-[#1f2b28] overflow-hidden">
        {/* Brand Header */}
        <div
          className={`border-b border-[#23312e] flex items-center justify-between shrink-0 ${
            collapsed ? 'p-2.5 flex-col gap-2' : 'p-4'
          }`}
        >
          <NavLink
            to="/todo"
            onClick={onCloseMobile}
            className="flex items-center gap-2 cursor-pointer min-w-0"
            title="ACT-HKT 2026 Home (Cần làm)"
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

        {/* Navigation Menu Items List — Cuộn mượt mà trên cả Desktop & Mobile */}
        <div className="flex-1 overflow-y-auto py-3 px-2 scrollbar-thin scrollbar-thumb-zinc-700 min-h-0 space-y-4">
          {navGroups.map((group, gIdx) => (
            <div key={gIdx} className="space-y-1">
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
                  const hasChildren = item.children && item.children.length > 0;
                  const isSubExpanded = !!expandedSubmenus[item.id];
                  const badgeValue = item.badgeKey ? badges[item.badgeKey] : undefined;
                  const showBadge = badgeValue !== undefined && badgeValue > 0;

                  return (
                    <div key={item.id} className="space-y-0.5">
                      <NavLink
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

                            {/* Badge số việc chờ */}
                            {showBadge && (
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none shrink-0 ${
                                  item.badgeColor === 'danger'
                                    ? 'bg-rose-600 text-white'
                                    : 'bg-emerald-600 text-white'
                                }`}
                              >
                                {badgeValue}
                              </span>
                            )}

                            {/* Chevron for items with children */}
                            {hasChildren && (
                              <button
                                type="button"
                                onClick={(e) => toggleSubmenu(item.id, e)}
                                className="p-0.5 hover:text-white text-[#7c918b]"
                              >
                                {isSubExpanded ? (
                                  <ChevronDown className="w-3.5 h-3.5" />
                                ) : (
                                  <ChevronRight className="w-3.5 h-3.5" />
                                )}
                              </button>
                            )}

                            <span className="text-[9px] font-mono opacity-40 shrink-0">{item.screenId}</span>
                          </>
                        ) : (
                          showBadge && (
                            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                          )
                        )}
                      </NavLink>

                      {/* Sub-items list (e.g. Xin nghỉ phép · WFH, Bổ sung chấm công) */}
                      {!collapsed && hasChildren && isSubExpanded && (
                        <div className="pl-7 pr-2 py-0.5 space-y-0.5">
                          {item.children!.map((child, cIdx) => (
                            <NavLink
                              key={cIdx}
                              to={child.path}
                              onClick={onCloseMobile}
                              className={({ isActive }) =>
                                `block px-2.5 py-1.5 rounded-md text-[11px] transition-colors truncate ${
                                  isActive
                                    ? 'text-emerald-400 font-semibold bg-[#1a2b26]'
                                    : 'text-[#7e968f] hover:text-white hover:bg-[#16201e]'
                                }`
                              }
                            >
                              {child.label}
                            </NavLink>
                          ))}
                        </div>
                      )}
                    </div>
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

      {/* 2. Mobile Slide-over Drawer with Backdrop (Responsive ở 390px) */}
      {isOpenMobile && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200"
            onClick={onCloseMobile}
          />
          {/* Mobile Drawer content */}
          <div className="relative w-72 max-w-[85vw] h-full shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {renderSidebarContent(false, true)}
          </div>
        </div>
      )}
    </>
  );
};
