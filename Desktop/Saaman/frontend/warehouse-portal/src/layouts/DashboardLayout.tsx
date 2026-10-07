import React, { useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import {
  Warehouse,
  LayoutDashboard,
  Boxes,
  PackageCheck,
  LogOut,
  Menu,
  X,
  Bell,
  ChevronDown,
  KeyRound,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore.js';
import { ChangePasswordModal } from '../components/ChangePasswordModal.js';

interface NavItem {
  label: string;
  icon: any;
  to?: string;
  badge?: string;
  children?: { label: string; to: string }[];
}

export const DashboardLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [openDropdowns, setOpenDropdowns] = useState<Record<string, boolean>>({
    'Inventory Operations': true,
  });
  const location = useLocation();
  const { user, logout } = useAuthStore();

  const currentWarehouse = user?.warehouses?.[0];

  const toggleDropdown = (label: string) => {
    setOpenDropdowns((prev) => ({
      ...prev,
      [label]: !prev[label],
    }));
  };

  const navItems: NavItem[] = [
    { label: 'Dashboard', to: '/', icon: LayoutDashboard },
    {
      label: 'Inventory Operations',
      icon: Boxes,
      children: [
        { label: 'Warehouse Products', to: '/products' },
        { label: 'Stock & ATP Allocation', to: '/inventory' },
        { label: 'GRN & Transactions', to: '/transactions' },
      ],
    },
    {
      label: 'Fulfillment & Dispatch',
      icon: PackageCheck,
      children: [
        { label: 'Order Picking Queue', to: '/fulfillments' },
        { label: 'Carrier Shipments', to: '/shipments' },
      ],
    },
    { label: 'Warehouse Profile', to: '/profile', icon: Warehouse },
  ];

  return (
    <div className="min-h-screen bg-[#F5F8F9] text-slate-800 flex">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden"
        />
      )}

      {/* Rich Oceanic Teal Sidebar matching reference image */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-[#0C6E7E] border-r border-[#07525E] flex flex-col transition-transform duration-200 ease-in-out shadow-[6px_0_30px_rgba(12,110,126,0.18)] ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Logo Header */}
        <div className="h-20 flex items-center justify-between px-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#14B8A6] via-[#2DD4BF] to-[#5EEAD4] flex items-center justify-center text-[#043B44] shadow-md shadow-black/10">
              <Warehouse className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-base tracking-tight text-white block">
                Warehouse<span className="text-[#5EEAD4]">Hub</span>
              </span>
              <span className="text-[10px] text-teal-200/70 font-semibold tracking-wider uppercase block">
                WMS Operations
              </span>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1 rounded-lg hover:bg-white/10 text-teal-200 lg:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Assigned Warehouse  with Modern Dropdown Chevron */}
        <div className="px-4 pt-4 pb-2">
          <div className="p-3.5 rounded-2xl bg-black/20 border border-white/15 flex items-center justify-between hover:bg-black/30 hover:border-white/25 transition-all cursor-pointer group shadow-inner">
            <div className="truncate">
              <span className="text-[10px] font-semibold text-teal-200/70 uppercase tracking-wider block">
                Assigned Warehouses
              </span>
              <span className="text-xs font-bold text-white truncate block">
                {currentWarehouse?.warehouseName || 'Hyderabad Warehouse'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-[#14B8A6] text-[#043B44] font-mono font-bold shadow-sm">
                {currentWarehouse?.warehouseCode || 'WH-01'}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-teal-200/80 group-hover:text-white group-hover:translate-y-0.5 transition-all duration-200" />
            </div>
          </div>
        </div>

        {/* Nav list with modern dropdown icons */}
        <div className="flex-1 px-3 py-3 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const hasChildren = item.children && item.children.length > 0;
            const isOpen = openDropdowns[item.label] || false;
            const isAnyChildActive = hasChildren && item.children?.some((c) => location.pathname === c.to);

            if (hasChildren) {
              return (
                <div key={item.label} className="space-y-1">
                  {/* Parent Dropdown with Modern Chevron */}
                  <button
                    onClick={() => toggleDropdown(item.label)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-medium transition-all duration-200 group ${
                      isAnyChildActive
                        ? 'bg-white/15 text-white font-semibold border-l-2 border-[#5EEAD4]'
                        : 'text-teal-100/75 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-3 truncate">
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-colors ${
                          isAnyChildActive ? 'text-[#5EEAD4]' : 'text-teal-300/70 group-hover:text-white'
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 transition-transform duration-200 ${
                        isOpen ? 'rotate-180 text-[#5EEAD4]' : 'text-teal-300/70 group-hover:text-white'
                      }`}
                    />
                  </button>

                  {/* Submenu list */}
                  {isOpen && (
                    <div className="pl-6 pr-1 py-1 ml-3 border-l-2 border-[#14B8A6]/30 space-y-1">
                      {item.children?.map((child) => (
                        <NavLink
                          key={child.label}
                          to={child.to}
                          end={child.to === '/'}
                          onClick={() => setSidebarOpen(false)}
                          className={({ isActive }) =>
                            `flex items-center px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 ${
                              isActive
                                ? 'bg-gradient-to-r from-[#108597] to-[#14B8A6] text-white font-bold shadow-md shadow-black/15'
                                : 'text-teal-100/70 hover:text-white hover:bg-white/10'
                            }`
                          }
                        >
                          <span>{child.label}</span>
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <NavLink
                key={item.to}
                to={item.to || '/'}
                end={item.to === '/'}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-r from-[#108597] to-[#14B8A6] text-white shadow-lg shadow-black/20 font-semibold border-l-2 border-[#5EEAD4]'
                      : 'text-teal-100/75 hover:text-white hover:bg-white/10'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className={`w-4 h-4 ${isActive ? 'text-[#5EEAD4]' : 'text-teal-300/70'}`} />
                    <span>{item.label}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </div>

        {/* User Card & Logout */}
        <div className="p-4 border-t border-[#095764] bg-black/15">
          <div className="flex items-center justify-between p-2 rounded-2xl bg-black/25 border border-white/10 shadow-inner">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#14B8A6] to-[#5EEAD4] flex items-center justify-center font-bold text-xs text-[#042F37] shrink-0 shadow-sm">
                {user?.firstName?.[0] || 'W'}
              </div>
              <div className="truncate">
                <p className="text-xs font-bold text-white truncate">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-[10px] text-teal-200/60 truncate">{user?.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsPasswordModalOpen(true)}
                title="Change Password"
                className="p-1.5 rounded-xl text-teal-300/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <KeyRound className="w-4 h-4" />
              </button>
              <button
                onClick={logout}
                title="Logout"
                className="p-1.5 rounded-xl text-teal-300/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header in Pure White Glass with subtle teal accent */}
        <header className="h-20 bg-white/95 border-b border-slate-100 px-6 sm:px-10 flex items-center justify-between backdrop-blur-md sticky top-0 z-30 shadow-[0_1px_10px_rgba(0,0,0,0.02)]">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 lg:hidden"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-4">
            {/* Status notification */}
            <button className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-50 relative transition-colors">
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#0C6E7E]" />
            </button>
          </div>
        </header>

        {/* Page canvas */}
        <main className="flex-1 p-6 sm:p-10 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
      />
    </div>
  );
};
