import React, { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../../store/authStore.js';
import { apiClient } from '../../lib/axios.js';
import { WarehouseDashboardStats } from '../../types/stats.js';
import { ApiResponse } from '../../types/auth.js';
import {
  Boxes,
  ArrowRightLeft,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  ArrowUpRight,
  RefreshCw,
  Warehouse,
  ShieldCheck,
  Clock,
  Sparkles,
  AlertCircle,
  ChevronDown,
} from 'lucide-react';
import { NoResults } from '../../components/common/NoResults.js';

export const DashboardPage: React.FC = () => {
  const { user } = useAuthStore();
  const availableWarehouses = user?.warehouses || [];

  // Currently selected warehouse facility (default to first or user's assigned warehouse)
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | number>(
    availableWarehouses[0]?.warehouseId || ''
  );

  const [stats, setStats] = useState<WarehouseDashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string>('');
  const [hoveredPoint, setHoveredPoint] = useState<{
    day: string;
    date: string;
    units: number;
    x: number;
    y: number;
  } | null>(null);

  // Sync selected warehouse when user profile loads
  useEffect(() => {
    if (!selectedWarehouseId && availableWarehouses.length > 0) {
      setSelectedWarehouseId(availableWarehouses[0].warehouseId);
    }
  }, [availableWarehouses, selectedWarehouseId]);

  const fetchStats = useCallback(
    async (isManualRefresh = false) => {
      if (isManualRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        const queryParam = selectedWarehouseId ? `?warehouseId=${selectedWarehouseId}` : '';
        const res = await apiClient.get<ApiResponse<WarehouseDashboardStats>>(
          `/warehouses/my-warehouse/stats${queryParam}`
        );

        if (res.data.success && res.data.data) {
          setStats(res.data.data);
          const now = new Date();
          setLastRefreshedAt(
            now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          );
        } else {
          setError(res.data.message || 'Unable to fetch dynamic warehouse statistics');
        }
      } catch (err: any) {
        console.error('Failed to fetch warehouse stats:', err);
        setError(
          err.response?.data?.error?.message ||
            err.message ||
            'Failed to connect to warehouse statistics service'
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [selectedWarehouseId]
  );

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const currentDateFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  // Dynamic cards setup
  const metricCards = stats
    ? [
        {
          title: 'Physical Stock On-Hand',
          value: stats.metrics.physicalStockFormatted,
          trend: stats.metrics.physicalStockTrend,
          trendColor: stats.metrics.physicalStockTrendColor || 'text-emerald-700',
          icon: Boxes,
          iconBg: 'bg-teal-50 text-[#0C6E7E] border border-teal-200/60',
          badgeText: `${stats.metrics.totalSKUs} SKUs`,
        },
        {
          title: 'Active Order Reservations',
          value: stats.metrics.reservedStockFormatted,
          trend: stats.metrics.reservedStockTrend,
          trendColor: stats.metrics.reservedStockTrendColor || 'text-[#0C6E7E]',
          icon: ArrowRightLeft,
          iconBg: 'bg-cyan-50 text-cyan-800 border border-cyan-200/60',
          badgeText: `${stats.metrics.activeReservationsCount} Active`,
        },
        {
          title: 'Quality Hold / Damaged',
          value: stats.metrics.damagedStockFormatted,
          trend: stats.metrics.damagedStockTrend,
          trendColor: stats.metrics.damagedStockTrendColor || 'text-amber-700',
          icon: AlertTriangle,
          iconBg: 'bg-amber-50 text-amber-700 border border-amber-200/60',
          badgeText: 'QC Hold',
        },
        {
          title: 'Available To Promise (ATP)',
          value: stats.metrics.availableToPromiseFormatted,
          trend: stats.metrics.availableToPromiseTrend,
          trendColor: stats.metrics.availableToPromiseTrendColor || 'text-emerald-700',
          icon: CheckCircle2,
          iconBg: 'bg-emerald-50 text-emerald-700 border border-emerald-200/60',
          badgeText: 'Net Sellable',
        },
      ]
    : [];

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Overview Title Section with Live Indicator, Warehouse Selector & Manual Refresh */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-white via-white to-teal-50/30 p-6 rounded-3xl border border-slate-100 shadow-[0_4px_25px_rgba(12,110,126,0.03)]">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#0C6E7E]">
              Overview
            </h1>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Dynamic Stream
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-semibold flex flex-wrap items-center gap-2">
            <span>{currentDateFormatted}</span>
            <span>•</span>
            <span className="text-slate-800 font-bold">
              {stats?.warehouse.warehouseName ||
                availableWarehouses[0]?.warehouseName ||
                'Warehouse Facility'}
            </span>
            {lastRefreshedAt && (
              <>
                <span>•</span>
                <span className="text-slate-400 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  Updated {lastRefreshedAt}
                </span>
              </>
            )}
          </p>
        </div>

        {/* Action Controls: Warehouse Selector (if multiple) & Refresh Button */}
        <div className="flex items-center gap-3">
          {availableWarehouses.length > 1 && (
            <div className="relative">
              <select
                value={selectedWarehouseId}
                onChange={(e) => setSelectedWarehouseId(e.target.value)}
                className="appearance-none bg-white pl-3.5 pr-8 py-2 rounded-2xl border border-slate-200 text-xs font-bold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0C6E7E]/30 focus:border-[#0C6E7E]"
              >
                {availableWarehouses.map((wh) => (
                  <option key={wh.warehouseId} value={wh.warehouseId}>
                    {wh.warehouseName} ({wh.warehouseCode})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )}

          <button
            onClick={() => fetchStats(true)}
            disabled={isRefreshing || isLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white border border-slate-200/90 hover:border-[#0C6E7E] text-slate-700 hover:text-[#0C6E7E] text-xs font-bold transition-all duration-200 shadow-sm disabled:opacity-50 active:scale-95"
            title="Refresh dynamic statistics"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-[#0C6E7E] ${
                isRefreshing ? 'animate-spin' : ''
              }`}
            />
            <span>{isRefreshing ? 'Syncing...' : 'Sync Live Data'}</span>
          </button>
        </div>
      </div>

      {/* Error Banner if API fails */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
            <span className="font-semibold">{error}</span>
          </div>
          <button
            onClick={() => fetchStats()}
            className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm animate-pulse space-y-4"
              >
                <div className="flex justify-between items-center">
                  <div className="w-11 h-11 bg-slate-100 rounded-2xl" />
                  <div className="w-5 h-5 bg-slate-100 rounded-lg" />
                </div>
                <div className="space-y-2">
                  <div className="w-24 h-8 bg-slate-200 rounded-xl" />
                  <div className="w-36 h-3 bg-slate-100 rounded" />
                </div>
                <div className="pt-3 border-t border-slate-100">
                  <div className="w-28 h-3 bg-slate-100 rounded" />
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-3xl p-7 border border-slate-100 h-80 animate-pulse" />
            <div className="bg-white rounded-3xl p-7 border border-slate-100 h-80 animate-pulse" />
          </div>
        </div>
      )}

      {/* Loaded Dynamic Statistics Content */}
      {!isLoading && stats && (
        <>
          {/* Dynamic Metrics Cards in Pure White with Teal Accents */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {metricCards.map((stat, i) => {
              const Icon = stat.icon;
              return (
                <div
                  key={i}
                  className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_4px_25px_rgba(12,110,126,0.04)] hover:shadow-[0_12px_35px_rgba(12,110,126,0.08)] hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden group"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div
                      className={`w-11 h-11 rounded-2xl ${stat.iconBg} flex items-center justify-center shadow-sm`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-xl bg-slate-50 text-slate-500 border border-slate-100 group-hover:text-[#0C6E7E] group-hover:border-teal-200/60 transition-colors">
                      {stat.badgeText}
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </span>
                  </div>

                  <div>
                    <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                      {stat.value}
                    </div>
                    <p className="text-xs font-bold text-slate-400 mt-1">{stat.title}</p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold">
                    <span className={stat.trendColor}>{stat.trend}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Visual Activity & Dynamic Wave Chart Section with Live Axis */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Dynamic Activity / Wave Card */}
            <div className="lg:col-span-2 bg-white rounded-3xl p-7 border border-[#E1EFF0] shadow-[0_8px_30px_rgba(12,110,126,0.035)] flex flex-col justify-between">
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-slate-900">
                        Inventory Activity & Inbound Volume
                      </h2>
                      <span className="p-1 rounded-lg bg-teal-50 text-[#0C6E7E]">
                        <Sparkles className="w-3.5 h-3.5" />
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 font-medium">
                      Real-time daily stock intake and catalog allocations across 7 days
                    </p>
                  </div>
                  {/* Dynamic Date Pill Badge matching backend data */}
                  <div className="self-start sm:self-auto px-4 py-1.5 rounded-2xl bg-white text-slate-600 border border-slate-200/90 text-xs font-semibold shadow-sm flex items-center gap-1.5">
                    <span>{stats.activityChart.currentDateBadge}</span>
                  </div>
                </div>

                {/* Chart Area with Dynamic Axis Labels & SVG Wave */}
                <div className="h-56 w-full relative flex pt-2">
                  {/* Dynamic Y-Axis Labels */}
                  <div className="w-14 flex flex-col justify-between text-[11px] font-semibold text-slate-400 pb-6 pr-3 border-r border-slate-200 select-none text-right">
                    {stats.activityChart.axisLabels.map((lbl, idx) => (
                      <span key={idx}>{lbl >= 1000 ? `${(lbl / 1000).toFixed(1)}k` : lbl}</span>
                    ))}
                  </div>

                  {/* Chart Area with Gridlines and Curve */}
                  <div className="flex-1 relative pb-6 pl-2">
                    {/* Horizontal Gridlines */}
                    <div className="absolute inset-x-0 top-0 border-b border-slate-100" />
                    <div className="absolute inset-x-0 top-1/4 border-b border-slate-100" />
                    <div className="absolute inset-x-0 top-2/4 border-b border-slate-100" />
                    <div className="absolute inset-x-0 top-3/4 border-b border-slate-100" />
                    <div className="absolute inset-x-0 bottom-6 border-b border-slate-200" />

                    <svg
                      viewBox="0 0 500 140"
                      className="w-full h-full overflow-visible"
                      preserveAspectRatio="none"
                    >
                      <defs>
                        <linearGradient id="tealWaveGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#0C6E7E" stopOpacity="0.28" />
                          <stop offset="60%" stopColor="#14B8A6" stopOpacity="0.08" />
                          <stop offset="100%" stopColor="#14B8A6" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>

                      {/* Dynamic Shaded Area */}
                      <path d={stats.activityChart.svgArea} fill="url(#tealWaveGradient)" />

                      {/* Dynamic Wave Curve Line */}
                      <path
                        d={stats.activityChart.svgPath}
                        fill="none"
                        stroke="#0C6E7E"
                        strokeWidth="3.2"
                        strokeLinecap="round"
                      />

                      {/* Interactive Point Markers */}
                      {stats.activityChart.points.map((pt, idx) => (
                        <g key={idx}>
                          <circle
                            cx={pt.x}
                            cy={pt.y}
                            r={pt.isPeak ? 6 : 4}
                            fill={pt.isPeak ? '#0C6E7E' : '#14B8A6'}
                            stroke="#ffffff"
                            strokeWidth="2.5"
                            className="cursor-pointer transition-transform hover:scale-150"
                            onMouseEnter={() => setHoveredPoint(pt)}
                            onMouseLeave={() => setHoveredPoint(null)}
                          />
                        </g>
                      ))}
                    </svg>

                    {/* Tooltip on Hover */}
                    {hoveredPoint && (
                      <div
                        className="absolute pointer-events-none px-2.5 py-1.5 rounded-xl bg-slate-900 text-white text-[11px] font-bold shadow-xl -translate-x-1/2 -translate-y-full mb-2 z-10 whitespace-nowrap"
                        style={{
                          left: `${(hoveredPoint.x / 500) * 100}%`,
                          top: `${(hoveredPoint.y / 140) * 100}%`,
                        }}
                      >
                        <div>
                          {hoveredPoint.day}, {hoveredPoint.date}
                        </div>
                        <div className="text-teal-300 font-extrabold">
                          {hoveredPoint.units.toLocaleString()} units intake
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Dynamic 4 Summary Checkpoints matching reference layout */}
              <div className="grid grid-cols-4 pt-4 border-t border-slate-100 text-center gap-2">
                {stats.activityChart.summaryCards.map((card, idx) => (
                  <div key={idx}>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                      {card.dayLabel}
                    </span>
                    <span
                      className={`text-xs font-bold ${
                        card.isPeak ? 'text-[#0C6E7E] font-extrabold' : 'text-slate-800'
                      }`}
                    >
                      {card.unitsFormatted}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Warehouse Dynamic Metadata Card */}
            <div className="bg-white rounded-3xl p-7 border border-slate-100 shadow-[0_4px_25px_rgba(12,110,126,0.04)] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-[#0C6E7E] text-xs font-bold uppercase tracking-wider">
                    <TrendingUp className="w-4 h-4" />
                    Facility Details
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {stats.warehouse.status}
                  </span>
                </div>

                <h2 className="text-lg font-black text-slate-900">
                  {stats.warehouse.warehouseName}
                </h2>
                <p className="text-xs text-slate-500 mt-1 font-medium leading-relaxed">
                  {stats.warehouse.address}
                </p>

                {/* Details Pills */}
                <div className="mt-5 space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-[#F5F8F9] border border-slate-100">
                    <span className="text-xs font-semibold text-slate-500">Warehouse Type</span>
                    <span className="text-xs font-bold text-slate-800">
                      {stats.warehouse.warehouseType === 'OWN'
                        ? 'Seller Owned (OWN)'
                        : '3PL Partner Facility'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-2xl bg-[#F5F8F9] border border-slate-100">
                    <span className="text-xs font-semibold text-slate-500">Warehouse Code</span>
                    <span className="text-xs font-mono font-bold text-[#0C6E7E]">
                      {stats.warehouse.warehouseCode}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-2xl bg-[#F5F8F9] border border-slate-100">
                    <span className="text-xs font-semibold text-slate-500">Active SKUs</span>
                    <span className="text-xs font-bold text-slate-800">
                      {stats.metrics.totalSKUs} Products
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-2xl bg-[#F5F8F9] border border-slate-100">
                    <span className="text-xs font-semibold text-slate-500">Linked Sellers</span>
                    <span className="text-xs font-bold text-slate-800">
                      {stats.metrics.connectedSellersCount} Seller Accounts
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-2xl bg-[#F5F8F9] border border-slate-100">
                    <span className="text-xs font-semibold text-slate-500">Safety Buffer</span>
                    <span className="text-xs font-bold text-slate-800">
                      {stats.metrics.safetyStockTotal.toLocaleString()} Units
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-2xl bg-[#F5F8F9] border border-slate-100">
                    <span className="text-xs font-semibold text-slate-500">User Email</span>
                    <span className="text-xs font-bold text-slate-800 truncate max-w-[170px]" title={user?.email}>
                      {user?.email}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 font-semibold">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#0C6E7E]" />
                  <span>WMS Inventory Synchronized</span>
                </div>
                <div className="flex items-center gap-1.5 text-[#0C6E7E] font-bold">
                  <Warehouse className="w-3.5 h-3.5" />
                  <span>WH-{stats.warehouse.warehouseId}</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {!isLoading && !stats && !error && (
        <div className="bg-white rounded-3xl p-10 border border-slate-100 shadow-sm text-center">
          <NoResults
            title="No Warehouse Data Available"
            description="No real-time inventory statistics or activities were returned for this facility."
            action={{
              label: 'Sync Live Data',
              onClick: () => fetchStats(true),
            }}
          />
        </div>
      )}
    </div>
  );
};
