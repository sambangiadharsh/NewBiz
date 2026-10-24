import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import {
  Store,
  LayoutDashboard,
  FileCheck2,
  ListPlus,
  Package,
  Warehouse,
  Boxes,
  ShoppingBag,
  LogOut,
  Menu,
  X,
  Bell,
  Sparkles,
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
  const location = useLocation();
  const { user, logout } = useAuthStore();

  const [openDropdowns, setOpenDropdowns] = useState<Record<string, boolean>>({
    'Products & Pricing': true,
  });

  const toggleDropdown = (label: string) => {
    setOpenDropdowns((prev) => (prev[label] ? {} : { [label]: true }));
  };

  const currentSeller = user?.sellers?.[0];

  const navItems: NavItem[] = [
    { label: 'Dashboard', to: '/', icon: LayoutDashboard },
    { label: 'Seller Onboarding', to: '/onboarding', icon: ListPlus },
    { label: 'Applications Status', to: '/applications', icon: FileCheck2 },
    {
      label: 'Products & Pricing',
      icon: Package,
      children: [
        { label: 'My Listed Products', to: '/products' },
        { label: 'Add Existing Product', to: '/products/add-existing' },
        { label: 'Propose New Product', to: '/products/propose' },
      ],
    },
    { label: 'Fulfillment Warehouses', to: '/warehouses', icon: Warehouse },
    {
      label: 'Inventory & Stock',
      icon: Boxes,
      children: [
        { label: 'Stock by Warehouse', to: '/inventory' },
        { label: 'Send Stock to Warehouse', to: '/inventory/inbound' },
        { label: 'Stock History', to: '/inventory/ledger' },
        { label: 'Low Stock Alerts', to: '/inventory/alerts' },
      ],
    },
    {
      label: 'Orders & Shipments',
      icon: ShoppingBag,
      children: [
        { label: 'All Orders', to: '/orders' },
        { label: 'Orders to Pack', to: '/orders/to-pack' },
        { label: 'Track Shipments', to: '/orders/shipments' },
        { label: 'Customer Returns', to: '/orders/returns' },
      ],
    },
  ];

  // Auto-expand section containing the currently active route
  useEffect(() => {
    for (const item of navItems) {
      if (item.children?.some((c) => location.pathname === c.to || location.pathname.startsWith(c.to + '/'))) {
        setOpenDropdowns({ [item.label]: true });
        break;
      }
    }
  }, [location.pathname]);

  return (
    <div className="h-screen w-full overflow-hidden bg-[#F3EFEA] text-[#221C1E] flex">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-stone-900/50 backdrop-blur-sm z-40 lg:hidden"
        />
      )}

      {/* Luxury Burgundy / Wine Sidebar matching user's exact reference */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 h-full w-64 bg-[#641D26] border-r border-[#52161E] flex flex-col shrink-0 transition-transform duration-200 ease-in-out shadow-[6px_0_30px_rgba(45,10,16,0.12)] relative overflow-hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Subtle decorative luxury watermark motif matching reference image */}
        <div className="absolute -left-10 bottom-24 text-white/[0.035] pointer-events-none select-none">
          <Sparkles className="w-56 h-56 rotate-12" />
        </div>

        {/* Brand Header */}
        <div className="shrink-0 h-16 flex items-center justify-between px-5 border-b border-[#52161E] relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#7E2532] via-[#9E2C3F] to-[#C24157] flex items-center justify-center text-white shadow-md shadow-black/25">
              <Store className="w-4.5 h-4.5 text-rose-100" />
            </div>
            <div>
              <span className="font-extrabold text-base tracking-tight text-white block">
                Seller<span className="text-[#F7CBD2]">Studio</span>
              </span>
              <span className="text-[10px] text-rose-200/70 font-medium tracking-wider uppercase block">
                Seller Operations
              </span>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1 rounded-lg hover:bg-white/10 text-rose-200 lg:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Active Business Entity Pill */}
        <div className="shrink-0 px-4 pt-5 pb-2 relative z-10">
          <div className="p-3.5 rounded-2xl bg-black/25 border border-white/10 flex items-center justify-between">
            <div className="truncate">
              <span className="text-[10px] font-semibold text-rose-200/60 uppercase tracking-wider block">
                Seller Entity
              </span>
              <span className="text-xs font-bold text-white truncate block">
                {currentSeller?.sellerName || 'KitchenKart Direct'}
              </span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-md bg-[#7E2532] text-rose-100 font-mono font-bold border border-rose-400/30">
              {currentSeller?.sellerCode || 'SEL001'}
            </span>
          </div>
        </div>

        {/* Nav List */}
        <div className="flex-1 min-h-0 px-3 py-4 space-y-1.5 overflow-y-auto relative z-10 sidebar-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            const hasChildren = item.children && item.children.length > 0;
            const isOpen = openDropdowns[item.label] || false;
            const isAnyChildActive = Boolean(
              hasChildren &&
                item.children?.some(
                  (c) => location.pathname === c.to || location.pathname.startsWith(c.to + '/')
                )
            );

            if (hasChildren) {
              return (
                <div key={item.label} className="space-y-1">
                  {/* Parent Dropdown Button */}
                  <button
                    type="button"
                    onClick={() => toggleDropdown(item.label)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-medium transition-all duration-200 group ${
                      isAnyChildActive
                        ? 'bg-gradient-to-r from-[#7E2532] to-[#922838] text-white shadow-lg shadow-black/20 font-semibold border-l-2 border-[#F7CBD2]'
                        : 'text-rose-100/75 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-3 truncate">
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-colors ${
                          isAnyChildActive ? 'text-[#F7CBD2]' : 'text-rose-300/70 group-hover:text-rose-200'
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 shrink-0 transition-transform duration-200 ${
                        isOpen ? 'rotate-180 text-[#F7CBD2]' : 'text-rose-300/60 group-hover:text-rose-200'
                      }`}
                    />
                  </button>

                  {/* Submenu with guide line */}
                  {isOpen && (
                    <div className="pl-4 pr-1 py-1 ml-4 border-l border-rose-400/20 space-y-1">
                      {item.children?.map((child) => {
                        const isChildActive = location.pathname === child.to;

                        return (
                          <NavLink
                            key={child.label}
                            to={child.to}
                            end
                            onClick={() => setSidebarOpen(false)}
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 ${
                              isChildActive
                                ? 'bg-white/15 text-white font-bold shadow-sm border-l-2 border-[#F7CBD2]'
                                : 'text-rose-200/70 hover:text-white hover:bg-white/5'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors ${
                                isChildActive ? 'bg-[#F7CBD2]' : 'bg-rose-300/40'
                              }`}
                            />
                            <span className="truncate">{child.label}</span>
                          </NavLink>
                        );
                      })}
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
                      ? 'bg-gradient-to-r from-[#7E2532] to-[#922838] text-white shadow-lg shadow-black/20 font-semibold border-l-2 border-[#F7CBD2]'
                      : 'text-rose-100/75 hover:text-white hover:bg-white/5'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className={`w-4 h-4 ${isActive ? 'text-[#F7CBD2]' : 'text-rose-300/70'}`} />
                    <span className="flex-1">{item.label}</span>
                    {item.to === '/onboarding' && currentSeller?.status === 'ACTIVE' && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        Verified
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </div>

        {/* User Card & Logout */}
        <div className="shrink-0 p-4 border-t border-[#52161E] bg-black/20 relative z-10">
          <div className="flex items-center justify-between p-2 rounded-2xl bg-black/25 border border-white/5 shadow-inner">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#7E2532] to-[#C24157] flex items-center justify-center font-bold text-xs text-white shrink-0 shadow-sm">
                {user?.firstName?.[0] || 'S'}
              </div>
              <div className="truncate">
                <p className="text-xs font-bold text-white truncate">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-[10px] text-rose-200/60 truncate">{user?.email}</p>
              </div>
            </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsPasswordModalOpen(true)}
                  title="Change Password"
                  className="p-1.5 rounded-xl text-rose-300/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <KeyRound className="w-4 h-4" />
                </button>
                <button
                  onClick={logout}
                  title="Logout"
                  className="p-1.5 rounded-xl text-rose-300/70 hover:text-rose-100 hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Header in Warm Cream with glassmorphism */}
        <header className="shrink-0 h-16 bg-[#F3EFEA]/90 border-b border-[#E8E1D7] px-6 sm:px-8 flex items-center justify-between backdrop-blur-md sticky top-0 z-30 shadow-[0_2px_10px_rgba(70,20,27,0.02)]">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-xl text-stone-700 hover:bg-stone-200/60 lg:hidden cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button className="p-2 rounded-xl bg-white/70 border border-[#E8E1D7] text-stone-500 hover:text-stone-800 hover:bg-white relative transition-colors shadow-2xs cursor-pointer">
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#7E2532]" />
            </button>
          </div>
        </header>

        {/* Page Canvas */}
        <main className="flex-1 min-h-0 p-5 sm:p-7 overflow-y-auto">
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
