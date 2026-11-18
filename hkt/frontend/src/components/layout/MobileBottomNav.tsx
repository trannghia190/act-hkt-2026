import React from 'react';
import { NavLink } from 'react-router-dom';
import { Inbox, Fingerprint, FilePlus, Target, Menu } from 'lucide-react';

interface MobileBottomNavProps {
  onOpenDrawer: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ onOpenDrawer }) => {
  const navItems = [
    { label: 'Cần Làm', path: '/todo', icon: Inbox },
    { label: 'Chấm Công', path: '/attendance/checkin', icon: Fingerprint, isAccent: true },
    { label: 'Đơn Từ', path: '/attendance/requests', icon: FilePlus },
    { label: 'OKR', path: '/okr/dashboard', icon: Target },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#101715]/95 backdrop-blur-md border-t border-[#1f2b28] px-2 py-1 select-none shadow-lg">
      <div className="flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center py-1.5 px-2 rounded-xl transition-all ${
                  isActive
                    ? 'text-emerald-400 font-bold scale-105'
                    : 'text-[#8fa39d] hover:text-white font-medium'
                }`
              }
            >
              {item.isAccent ? (
                <div className="w-10 h-10 -mt-5 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-md shadow-emerald-950/60 ring-3 ring-[#101715]">
                  <Icon className="w-5 h-5" />
                </div>
              ) : (
                <Icon className="w-5 h-5 mb-0.5" />
              )}
              <span className={`text-[10px] leading-tight ${item.isAccent ? 'mt-0.5' : ''}`}>
                {item.label}
              </span>
            </NavLink>
          );
        })}

        {/* 5th Button: Open Full Drawer Menu */}
        <button
          type="button"
          onClick={onOpenDrawer}
          className="flex flex-col items-center justify-center py-1.5 px-2 text-[#8fa39d] hover:text-white rounded-xl transition-all font-medium cursor-pointer"
        >
          <Menu className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] leading-tight">Menu</span>
        </button>
      </div>
    </nav>
  );
};
