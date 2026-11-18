import React, { useEffect } from 'react';
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
  currentModule: 'attendance' | 'okr' | 'shared';
  onModuleChange: (moduleId: 'attendance' | 'okr' | 'shared') => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentModule,
  onModuleChange,
  isOpenMobile = false,
  onCloseMobile,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Auto-sync module tab with active route to avoid desynchronization
  useEffect(() => {
    if (location.pathname.startsWith('/admin') || location.pathname.startsWith('/auth')) {
      onModuleChange('shared');
    } else if (location.pathname.startsWith('/okr')) {
      onModuleChange('okr');
    } else if (location.pathname.startsWith('/attendance') || location.pathname === '/todo') {
      onModuleChange('attendance');
    }
  }, [location.pathname, onModuleChange]);

  const activeNav = SIDEBAR_CONFIG.find((m) => m.moduleId === currentModule) || SIDEBAR_CONFIG[0];

  // Seamless module tab switch with direct navigation to module landing page
  const handleTabChange = (moduleId: 'attendance' | 'okr' | 'shared') => {
    onModuleChange(moduleId);
    if (moduleId === 'attendance') {
      if (!location.pathname.startsWith('/attendance') && location.pathname !== '/todo') {
        navigate('/attendance/checkin');
      }
    } else if (moduleId === 'okr') {
      if (!location.pathname.startsWith('/okr')) {
        navigate('/okr/dashboard');
      }
    } else if (moduleId === 'shared') {
      if (!location.pathname.startsWith('/admin') && !location.pathname.startsWith('/auth')) {
        navigate('/admin/employees');
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

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#141c1a] text-[#c3d0cc] select-none border-r border-[#1f2b28]">
      {/* Brand Header */}
      <div className="p-4 border-b border-[#23312e] flex items-center justify-between">
        <NavLink to="/todo" onClick={onCloseMobile} className="block cursor-pointer">
          <ActHktLogo size="md" />
        </NavLink>

        {/* Close button on mobile */}
        {onCloseMobile && (
          <button
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            title="Đóng menu"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Module Switcher Tabs (3 Phân Hệ) */}
      <div className="p-2.5 bg-[#111716] border-b border-[#1f2b28] mb-2 space-y-1.5">
        <div className="flex gap-1 bg-[#0d1312] p-1 rounded-lg border border-[#1f2b28]">
          <button
            type="button"
            onClick={() => handleTabChange('attendance')}
            className={`flex-1 py-1.5 px-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer ${
              currentModule === 'attendance'
                ? 'bg-accent text-white shadow-xs'
                : 'text-[#8fa39d] hover:bg-[#1a2422] hover:text-white'
            }`}
          >
            Chấm Công
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('okr')}
            className={`flex-1 py-1.5 px-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer ${
              currentModule === 'okr'
                ? 'bg-accent text-white shadow-xs'
                : 'text-[#8fa39d] hover:bg-[#1a2422] hover:text-white'
            }`}
          >
            OKR
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('shared')}
            className={`flex-1 py-1.5 px-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer ${
              currentModule === 'shared'
                ? 'bg-accent text-white shadow-xs'
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

      {/* Navigation Menu Items */}
      <div className="flex-1 overflow-y-auto py-2 space-y-4 px-2 scrollbar-thin scrollbar-thumb-zinc-700">
        {filteredGroups.map((group, gIdx) => (
          <div key={gIdx}>
            <div className="px-3 pb-1 text-[10px] font-bold tracking-wider uppercase text-[#61756f]">
              {group.groupName}
            </div>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const IconComponent = iconMap[item.icon] || HelpCircle;

                return (
                  <NavLink
                    key={item.id}
                    to={item.path}
                    onClick={onCloseMobile}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                        isActive
                          ? 'bg-[#1b3830] text-white font-semibold shadow-2xs border-l-3 border-emerald-400'
                          : 'text-[#a3b8b2] hover:bg-[#1a2422] hover:text-white'
                      }`
                    }
                  >
                    <IconComponent className="w-4 h-4 shrink-0 opacity-80" />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.badge && (
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none ${
                          item.badgeColor === 'danger'
                            ? 'bg-rose-600 text-white'
                            : 'bg-accent text-white'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                    <span className="text-[9px] font-mono opacity-40 shrink-0">{item.screenId}</span>
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* User Footer */}
      <div className="p-3 border-t border-[#1f2b28] flex items-center gap-3 bg-[#111716]">
        <div className="w-8 h-8 rounded-full bg-accent/40 text-emerald-300 ring-1 ring-accent-line/30 flex items-center justify-center font-bold text-xs shrink-0 uppercase">
          {user ? user.fullName.substring(0, 2) : 'AD'}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-white truncate">{user?.fullName || 'Admin User'}</p>
          <p className="text-[10px] text-[#7c918b] truncate">
            {user?.employeeCode || 'ADMIN'} · {user?.role || 'ADMIN'}
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* 1. Desktop Static Sidebar */}
      <aside className="hidden lg:flex w-64 h-screen sticky top-0 shrink-0 z-30">
        {sidebarContent}
      </aside>

      {/* 2. Mobile / Tablet Slide-over Drawer with Backdrop */}
      {isOpenMobile && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200"
            onClick={onCloseMobile}
          />
          {/* Drawer content */}
          <div className="relative w-72 max-w-[85vw] h-full shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
