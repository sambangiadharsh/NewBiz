import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore.js';
import { apiClient } from '../../lib/axios.js';
import {
  Store,
  Warehouse,
  FileCheck,
  Boxes,
  ShieldCheck,
  ArrowUpRight,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  Clock,
  ExternalLink,
} from 'lucide-react';

interface DashboardStats {
  activeSellers: {
    count: number;
    label: string;
    change: string;
    total: number;
  };
  verifiedWarehouses: {
    count: number;
    label: string;
    change: string;
    ownCount: number;
    threePLCount: number;
    total: number;
  };
  catalogProducts: {
    count: number;
    label: string;
    change: string;
    categoriesCount: number;
  };
  pendingApplications: {
    count: number;
    label: string;
    change: string;
    pendingSellers: number;
    pendingWarehouses: number;
    pendingDocuments: number;
  };
  recentApplications: Array<{
    id: number;
    sellerName: string;
    sellerCode: string;
    categoryName: string;
    status: string;
    submittedAt: string;
  }>;
  recentWarehouses: Array<{
    id: number;
    name: string;
    code: string;
    type: string;
    location: string;
    status: string;
    createdAt: string;
  }>;
}

export const DashboardPage: React.FC = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const fetchStats = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await apiClient.get('/admin/dashboard/stats');
      if (res.data.success) {
        setStats(res.data.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load dashboard metrics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const metricCards = [
    {
      title: 'Active Sellers',
      value: stats ? stats.activeSellers.label : '...',
      change: stats ? stats.activeSellers.change : 'Loading active sellers...',
      icon: Store,
      badge: 'Operational',
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
      blobColor: 'bg-violet-200',
      labelColor: 'text-violet-700',
      iconBg: 'bg-violet-50',
      iconColor: 'text-violet-600',
      route: '/sellers',
    },
    {
      title: 'Verified Warehouses',
      value: stats ? stats.verifiedWarehouses.label : '...',
      change: stats ? stats.verifiedWarehouses.change : 'Loading warehouse counts...',
      icon: Warehouse,
      badge: 'Active OMS',
      badgeColor: 'bg-amber-50 text-amber-700 border-amber-200/60',
      blobColor: 'bg-blue-200',
      labelColor: 'text-blue-700',
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
      route: '/warehouses',
    },
    {
      title: 'Master Catalog SKUs',
      value: stats ? stats.catalogProducts.label : '...',
      change: stats ? stats.catalogProducts.change : 'Loading published SKUs...',
      icon: Boxes,
      badge: 'Live Taxonomy',
      badgeColor: 'bg-blue-50 text-blue-700 border-blue-200/60',
      blobColor: 'bg-emerald-200',
      labelColor: 'text-emerald-700',
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      route: '/categories',
    },
    {
      title: 'Pending Applications',
      value: stats ? stats.pendingApplications.label : '...',
      change: stats ? stats.pendingApplications.change : 'Loading review queue...',
      icon: FileCheck,
      badge: stats && stats.pendingApplications.count > 0 ? 'Requires Review' : 'Up to date',
      badgeColor:
        stats && stats.pendingApplications.count > 0
          ? 'bg-rose-50 text-rose-700 border-rose-200/60'
          : 'bg-purple-50 text-purple-700 border-purple-200/60',
      blobColor: 'bg-rose-200',
      labelColor: 'text-rose-600',
      iconBg: 'bg-rose-50',
      iconColor: 'text-rose-600',
      route: '/applications',
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Welcome Banner */}
      <div className="bg-white border border-slate-100 rounded-2xl p-5 sm:p-6 relative overflow-hidden shadow-[0_8px_30px_rgba(99,102,241,0.04)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-[#635BFF] text-xs font-bold uppercase tracking-wider mb-1">
              <ShieldCheck className="w-4 h-4" />
              Platform Administration
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Welcome back, {user?.firstName + ' ' + user?.lastName || 'Super Admin'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl font-medium leading-relaxed">
              {currentDate} • Marketplace OMS and Multi-Warehouse Control Console. Live database metrics and Seller Application queue.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchStats(true)}
              disabled={loading || refreshing}
              className="px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 flex items-center gap-2 transition-all disabled:opacity-50 shadow-2xs cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-[#635BFF]' : 'text-slate-500'}`} />
              <span>{refreshing ? 'Refreshing...' : 'Refresh Stats'}</span>
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metricCards.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div
              key={i}
              onClick={() => navigate(stat.route)}
              className="bg-white border border-slate-100 rounded-2xl p-5 hover:shadow-[0_16px_40px_rgba(99,102,241,0.08)] hover:border-indigo-100 transition-all duration-300 shadow-[0_8px_30px_rgba(99,102,241,0.04)] relative overflow-hidden cursor-pointer group"
            >
              {/* Blob decoration */}
              <div
                className={`absolute -bottom-6 -left-6 w-28 h-28 rounded-full opacity-40 group-hover:scale-110 transition-transform ${stat.blobColor}`}
              />

              {/* Top row: label + icon */}
              <div className="flex items-start justify-between mb-5 relative z-10">
                <div>
                  <p className={`text-[11px] font-black uppercase tracking-widest ${stat.labelColor}`}>
                    {stat.title}
                  </p>
                  <span
                    className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${stat.badgeColor}`}
                  >
                    {stat.badge}
                  </span>
                </div>
                <div
                  className={`w-10 h-10 rounded-2xl ${stat.iconBg} flex items-center justify-center shadow-sm shrink-0 group-hover:scale-105 transition-transform`}
                >
                  <Icon className={`w-5 h-5 ${stat.iconColor}`} />
                </div>
              </div>

              {/* Value */}
              <div className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight relative z-10">
                {loading ? (
                  <div className="h-9 w-24 bg-slate-100 rounded-lg animate-pulse" />
                ) : (
                  stat.value
                )}
              </div>

              {/* Footer */}
              <div className="mt-4 pt-3.5 border-t border-slate-50 flex items-center justify-between text-xs relative z-10">
                <span className="font-medium text-slate-400 truncate max-w-[200px]" title={stat.change}>
                  {stat.change}
                </span>
                <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-[#635BFF] transition-colors shrink-0 ml-1" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Administrator Profile Card */}
        <div className="bg-white border border-slate-100 rounded-2xl p-5 sm:p-6 shadow-[0_8px_30px_rgba(99,102,241,0.04)]">
          <div className="flex items-center justify-between pb-3.5 border-b border-slate-50 mb-4">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#635BFF]" />
              Authenticated Administrator
            </h2>
            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-indigo-50 text-[#635BFF] font-bold border border-indigo-100/60">
              Active Session
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center py-1.5 border-b border-slate-50">
              <span className="font-medium text-slate-400">Security Email:</span>
              <span className="font-mono text-slate-800 font-bold">{user?.email}</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-slate-50">
              <span className="font-medium text-slate-400">Assigned Platform Roles:</span>
              <div className="flex gap-1.5">
                {user?.roles.map((r) => (
                  <span
                    key={r}
                    className="px-2 py-0.5 rounded-lg bg-gradient-to-r from-[#635BFF] to-[#7C5CFC] text-white text-[11px] font-bold shadow-sm"
                  >
                    {r}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex justify-between items-center py-1.5">
              <span className="font-medium text-slate-400">System Permissions:</span>
              <span className="font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-lg text-xs flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {user?.permissions.length || 24} Permissions Granted
              </span>
            </div>
          </div>
        </div>

        {/* Live Governance Queue Card */}
        <div className="bg-white border border-slate-100 rounded-2xl p-5 sm:p-6 shadow-[0_8px_30px_rgba(99,102,241,0.04)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-50 mb-3.5">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                <Store className="w-4 h-4 text-[#635BFF]" />
                Recent Seller & Warehouse Activity
              </h2>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-100/60">
                Live Data
              </span>
            </div>

            {loading ? (
              <div className="py-8 flex flex-col items-center justify-center text-slate-400 gap-2">
                <RefreshCw className="w-5 h-5 animate-spin text-[#635BFF]" />
                <span className="text-xs">Loading activity stream...</span>
              </div>
            ) : (
              <div className="space-y-3">
                {stats?.recentApplications && stats.recentApplications.length > 0 ? (
                  stats.recentApplications.slice(0, 3).map((app) => (
                    <div
                      key={app.id}
                      onClick={() => navigate('/applications')}
                      className="p-3 rounded-xl bg-slate-50/70 hover:bg-slate-100/80 border border-slate-100 flex items-center justify-between text-xs cursor-pointer transition-colors"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800">{app.sellerName}</span>
                          <span className="font-mono text-[10px] text-slate-400">({app.sellerCode})</span>
                        </div>
                        <span className="text-[11px] text-slate-500 font-medium block">
                          Category: {app.categoryName}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            app.status === 'APPROVED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : app.status === 'REJECTED'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {app.status}
                        </span>
                        <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-6 text-center text-xs text-slate-400 flex flex-col items-center gap-1">
                    <Clock className="w-5 h-5 text-slate-300" />
                    <span>No seller application activity recorded yet.</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div
            onClick={() => navigate('/applications')}
            className="mt-6 p-4 rounded-2xl bg-[#F8F9FE] hover:bg-[#EFF1FD] border border-slate-100 flex items-center justify-between text-xs cursor-pointer transition-colors"
          >
            <span className="font-bold text-slate-800">Review All Applications & Document Compliance</span>
            <ArrowUpRight className="w-4 h-4 text-[#635BFF]" />
          </div>
        </div>
      </div>
    </div>
  );
};
