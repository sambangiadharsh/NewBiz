import React, { useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import {
  ShieldCheck,
  LayoutDashboard,
  Users,
  Store,
  Warehouse,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Bell,
  ListFilter,
  FileText,
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [openDropdowns, setOpenDropdowns] = useState<Record<string, boolean>>({
    'Seller Management': true,
    'Catalog & Specs': true,
    'Content Management': true,
  });
  const location = useLocation();
  const { user, logout } = useAuthStore();

  const toggleDropdown = (label: string) => {
    setOpenDropdowns((prev) => ({
      ...prev,
      [label]: !prev[label],
    }));
  };

  const navItems: NavItem[] = [
    { label: 'Dashboard', to: '/', icon: LayoutDashboard },
    {
      label: 'Seller Management',
      icon: Store,
      children: [
        { label: 'Active Sellers', to: '/sellers' },
        { label: 'Applications Review', to: '/applications' },
        { label: 'Categories & Docs', to: '/categories' },
      ],
    },
    {
      label: 'Catalog Management',
      icon: ListFilter,
      children: [
        { label: 'All Products', to: '/catalog/products' },
        { label: 'Create Product', to: '/catalog/products/create' },
        { label: 'Master Product QC', to: '/catalog/qc' },
        { label: 'Brands Management', to: '/catalog/brands' },
        { label: 'Policies & Warranty', to: '/catalog/policies' },
        { label: 'Attributes & Values', to: '/catalog/attributes' },
        { label: 'Units of Measure (UOM)', to: '/catalog/uom' },
      ],
    },
    {
      label: 'Warehouse Management',
      icon: Warehouse,
      children: [
        { label: 'All Warehouses', to: '/warehouses' },
        { label: 'Warehouse Approvals', to: '/warehouses/verification' },
      ],
    },
    {
      label: 'Content Management',
      icon: FileText,
      children: [
        { label: 'CMS Pages & Social', to: '/content' },
        { label: 'Promotional Banners', to: '/content/banners' },
      ],
    },
    {
      label: 'Security & Access',
      icon: Users,
      children: [
        { label: 'User Directory', to: '/rbac' },
        { label: 'Role Permissions', to: '/rbac/roles' },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-[#F8F9FE] text-slate-800 flex">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-40 lg:hidden"
        />
      )}

      {/* Sidebar matching warehouse portal style */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 ${
          sidebarCollapsed ? 'w-20' : 'w-64'
        } bg-white border-r border-slate-100 flex flex-col transition-all duration-300 ease-in-out shadow-[4px_0_24px_rgba(0,0,0,0.02)] relative`}
      >
        {/* Border Collapse Trigger Button */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="hidden lg:flex items-center justify-center w-6 h-6 rounded-full bg-white border border-slate-200 shadow-sm text-slate-500 hover:text-slate-900 hover:shadow transition-all absolute -right-3 top-7 z-30"
        >
          {sidebarCollapsed ? (
            <ChevronRight className="w-3.5 h-3.5" />
          ) : (
            <ChevronLeft className="w-3.5 h-3.5" />
          )}
        </button>

        {/* Brand Header */}
        <div className="h-20 flex items-center justify-between px-6 border-b border-slate-50">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#635BFF] via-[#7C5CFC] to-[#9B7BF7] flex items-center justify-center text-white shadow-md shadow-indigo-500/20 shrink-0">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            {!sidebarCollapsed && (
              <div className="truncate">
                <span className="font-extrabold text-base tracking-tight text-slate-900 block">
                  Marketplace<span className="text-[#635BFF]">Admin</span>
                </span>
                <span className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase block">
                  Platform Operations
                </span>
              </div>
            )}
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1 rounded-lg hover:bg-slate-50 text-slate-400 lg:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Active Role Entity Pill with Modern Dropdown Selector */}
        {!sidebarCollapsed && (
          <div className="px-4 pt-4 pb-1">
            <div className="p-3 rounded-2xl bg-[#F8F9FE] border border-slate-100 flex items-center justify-between hover:border-indigo-200/80 transition-all cursor-pointer group shadow-sm">
              <div className="truncate">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Security Context
                </span>
                <span className="text-xs font-bold text-slate-900 truncate block">
                  Platform Master
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] px-2 py-0.5 rounded-lg bg-indigo-50 text-[#635BFF] font-mono font-bold border border-indigo-100/60">
                  SUPER_ADMIN
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#635BFF] transition-transform duration-200" />
              </div>
            </div>
          </div>
        )}

        {/* Nav list with modern dropdown icons */}
        <div className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
          {!sidebarCollapsed && (
            <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Platform Controls
            </div>
          )}
          {navItems.map((item) => {
            const Icon = item.icon;
            const hasChildren = item.children && item.children.length > 0;
            const isOpen = openDropdowns[item.label] || false;
            const isAnyChildActive = hasChildren && item.children?.some((c) => location.pathname === c.to);

            if (hasChildren) {
              return (
                <div key={item.label} className="space-y-1">
                  {/* Parent Dropdown Button with Modern Chevron */}
                  <button
                    onClick={() => toggleDropdown(item.label)}
                    title={sidebarCollapsed ? item.label : undefined}
                    className={`w-full flex items-center ${
                      sidebarCollapsed ? 'justify-center px-2' : 'justify-between px-4'
                    } py-3 rounded-2xl text-sm font-medium transition-all duration-200 group ${
                      isAnyChildActive
                        ? 'bg-indigo-50/70 text-[#635BFF] font-semibold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50/90'
                    }`}
                  >
                    <div className="flex items-center gap-3 truncate">
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-colors ${
                          isAnyChildActive ? 'text-[#635BFF]' : 'text-slate-400 group-hover:text-slate-700'
                        }`}
                      />
                      {!sidebarCollapsed && (
                        <span className="truncate">{item.label}</span>
                      )}
                    </div>
                    {!sidebarCollapsed && (
                      <ChevronDown
                        className={`w-4 h-4 transition-transform duration-200 ${
                          isOpen ? 'rotate-180 text-[#635BFF]' : 'text-slate-400 group-hover:text-slate-700'
                        }`}
                      />
                    )}
                  </button>

                  {/* Submenu with clean guide line */}
                  {!sidebarCollapsed && isOpen && (
                    <div className="pl-6 pr-1 py-1 ml-3 border-l-2 border-indigo-100/80 space-y-1">
                      {item.children?.map((child) => (
                        <NavLink
                          key={child.label}
                          to={child.to}
                          end
                          onClick={() => setSidebarOpen(false)}
                          className={({ isActive }) =>
                            `flex items-center px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 ${
                              isActive
                                ? 'bg-gradient-to-r from-[#635BFF] to-[#7C5CFC] text-white font-bold shadow-md shadow-indigo-500/20'
                                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/70'
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
                title={sidebarCollapsed ? item.label : undefined}
                className={({ isActive }) =>
                  `flex items-center ${
                    sidebarCollapsed ? 'justify-center px-2' : 'justify-start px-4'
                  } py-3 rounded-2xl text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-r from-[#635BFF] to-[#7C5CFC] text-white shadow-lg shadow-indigo-500/25 font-semibold'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50/80'
                  }`
                }
              >
                {({ isActive }) => (
                  <div className="flex items-center gap-3 truncate">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`}
                    />
                    {!sidebarCollapsed && (
                      <span className={`truncate ${isActive ? 'font-semibold text-white' : ''}`}>
                        {item.label}
                      </span>
                    )}
                  </div>
                )}
              </NavLink>
            );
          })}
        </div>

        {/* User Card & Logout */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          <div
            className={`flex items-center ${
              sidebarCollapsed ? 'justify-center p-2' : 'justify-between p-2'
            } rounded-2xl bg-white border border-slate-100 shadow-sm`}
          >
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#635BFF] to-[#9B7BF7] flex items-center justify-center font-bold text-xs text-white shrink-0 shadow-sm">
                {user?.firstName?.[0] || 'A'}
              </div>
              {!sidebarCollapsed && (
                <div className="truncate">
                  <p className="text-xs font-bold text-slate-800 truncate">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate">{user?.email}</p>
                </div>
              )}
            </div>
            {!sidebarCollapsed && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsPasswordModalOpen(true)}
                  title="Change Password"
                  className="p-1.5 rounded-xl text-slate-400 hover:text-[#635BFF] hover:bg-indigo-50 transition-colors"
                >
                  <KeyRound className="w-4 h-4" />
                </button>
                <button
                  onClick={logout}
                  title="Logout"
                  className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-20 bg-white/80 border-b border-slate-100 px-6 sm:px-10 flex items-center justify-between backdrop-blur-md sticky top-0 z-30 shadow-[0_2px_15px_rgba(0,0,0,0.02)]">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-xl text-slate-500 hover:bg-slate-50 lg:hidden"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-4">
            <button className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-50 relative transition-colors">
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#635BFF]" />
            </button>
          </div>
        </header>

        {/* Outlet page container */}
        <main className="flex-1 p-6 sm:p-10 overflow-y-auto table-scrollbar">
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
