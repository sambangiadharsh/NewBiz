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
  Sparkles,
  AlertCircle,
  ChevronDown,
} from 'lucide-react';
import { NoResults } from '../../components/common/NoResults.js';

export const DashboardPage: React.FC = () => {
  const { user } = useAuthStore();
  const availableWarehouses = user?.warehouses || [];

  // Currently selected warehouse facility
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
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Top Bar: Warehouse Selector & Refresh Control */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white px-4 py-3 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2">
          <h1 className="text-base font-bold tracking-tight text-slate-900">
            Overview
          </h1>
          <span className="text-xs text-slate-300">•</span>
          <span className="text-xs text-slate-600 font-medium">
            {stats?.warehouse.warehouseName ||
              availableWarehouses[0]?.warehouseName ||
              'Warehouse Facility'}
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {availableWarehouses.length > 1 && (
            <div className="relative">
              <select
                value={selectedWarehouseId}
                onChange={(e) => setSelectedWarehouseId(e.target.value)}
                className="appearance-none bg-slate-50 pl-3 pr-7 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#0C6E7E]"
              >
                {availableWarehouses.map((wh) => (
                  <option key={wh.warehouseId} value={wh.warehouseId}>
                    {wh.warehouseName} ({wh.warehouseCode})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )}

          {lastRefreshedAt && (
            <span className="text-[11px] text-slate-400 font-medium hidden sm:inline mr-1">
              Updated {lastRefreshedAt}
            </span>
          )}

          <button
            onClick={() => fetchStats(true)}
            disabled={isRefreshing || isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 hover:border-[#0C6E7E] text-slate-700 hover:text-[#0C6E7E] text-xs font-semibold transition-all disabled:opacity-50"
            title="Refresh statistics"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-[#0C6E7E] ${isRefreshing ? 'animate-spin' : ''}`}
            />
            <span>{isRefreshing ? 'Syncing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Error Banner if API fails */}
      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span className="font-semibold">{error}</span>
          </div>
          <button
            onClick={() => fetchStats()}
            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs animate-pulse space-y-3"
              >
                <div className="flex justify-between items-center">
                  <div className="w-9 h-9 bg-slate-100 rounded-lg" />
                  <div className="w-12 h-5 bg-slate-100 rounded-md" />
                </div>
                <div className="space-y-1.5">
                  <div className="w-24 h-6 bg-slate-200 rounded-md" />
                  <div className="w-32 h-3 bg-slate-100 rounded" />
                </div>
                <div className="pt-2 border-t border-slate-100">
                  <div className="w-20 h-3 bg-slate-100 rounded" />
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-white rounded-xl p-5 border border-slate-200 h-64 animate-pulse" />
            <div className="bg-white rounded-xl p-5 border border-slate-200 h-64 animate-pulse" />
          </div>
        </div>
      )}

      {/* Loaded Dynamic Statistics Content */}
      {!isLoading && stats && (
        <>
          {/* Dynamic Metrics Cards: Compact & Balanced */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {metricCards.map((stat, i) => {
              const Icon = stat.icon;
              return (
                <div
                  key={i}
                  className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs hover:border-[#0C6E7E]/40 transition-colors relative overflow-hidden group"
                >
                  <div className="flex items-center justify-between mb-2.5">
                    <div
                      className={`w-9 h-9 rounded-lg ${stat.iconBg} flex items-center justify-center`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-50 text-slate-600 border border-slate-200">
                      {stat.badgeText}
                      <ArrowUpRight className="w-3 h-3 text-slate-400" />
                    </span>
                  </div>

                  <div>
                    <div className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                      {stat.value}
                    </div>
                    <p className="text-xs font-medium text-slate-500 mt-0.5">{stat.title}</p>
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-medium">
                    <span className={stat.trendColor}>{stat.trend}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Visual Activity & Dynamic Wave Chart Section with Facility Details */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Main Dynamic Activity Card */}
            <div className="lg:col-span-2 bg-white rounded-xl p-4 sm:p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h2 className="text-sm font-bold text-slate-900">
                        Inventory Activity & Inbound Volume
                      </h2>
                      <span className="p-0.5 rounded bg-teal-50 text-[#0C6E7E]">
                        <Sparkles className="w-3 h-3" />
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Real-time stock intake and catalog allocations across 7 days
                    </p>
                  </div>
                  <div className="self-start sm:self-auto px-2.5 py-1 rounded-lg bg-slate-50 text-slate-600 border border-slate-200 text-xs font-semibold">
                    {stats.activityChart.currentDateBadge}
                  </div>
                </div>

                {/* Chart Area with Dynamic Axis Labels & SVG Wave */}
                <div className="h-44 w-full relative flex pt-1">
                  {/* Dynamic Y-Axis Labels */}
                  <div className="w-12 flex flex-col justify-between text-[11px] font-medium text-slate-400 pb-5 pr-2.5 border-r border-slate-200 select-none text-right">
                    {stats.activityChart.axisLabels.map((lbl, idx) => (
                      <span key={idx}>{lbl >= 1000 ? `${(lbl / 1000).toFixed(1)}k` : lbl}</span>
                    ))}
                  </div>

                  {/* Chart Area with Gridlines and Curve */}
                  <div className="flex-1 relative pb-5 pl-2">
                    {/* Horizontal Gridlines */}
                    <div className="absolute inset-x-0 top-0 border-b border-slate-100" />
                    <div className="absolute inset-x-0 top-1/4 border-b border-slate-100" />
                    <div className="absolute inset-x-0 top-2/4 border-b border-slate-100" />
                    <div className="absolute inset-x-0 top-3/4 border-b border-slate-100" />
                    <div className="absolute inset-x-0 bottom-5 border-b border-slate-200" />

                    <svg
                      viewBox="0 0 500 140"
                      className="w-full h-full overflow-visible"
                      preserveAspectRatio="none"
                    >
                      <defs>
                        <linearGradient id="tealWaveGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#0C6E7E" stopOpacity="0.25" />
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
                        strokeWidth="2.8"
                        strokeLinecap="round"
                      />

                      {/* Interactive Point Markers */}
                      {stats.activityChart.points.map((pt, idx) => (
                        <g key={idx}>
                          <circle
                            cx={pt.x}
                            cy={pt.y}
                            r={pt.isPeak ? 5 : 3.5}
                            fill={pt.isPeak ? '#0C6E7E' : '#14B8A6'}
                            stroke="#ffffff"
                            strokeWidth="2"
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
                        className="absolute pointer-events-none px-2 py-1 rounded-lg bg-slate-900 text-white text-[11px] font-semibold shadow-md -translate-x-1/2 -translate-y-full mb-1.5 z-10 whitespace-nowrap"
                        style={{
                          left: `${(hoveredPoint.x / 500) * 100}%`,
                          top: `${(hoveredPoint.y / 140) * 100}%`,
                        }}
                      >
                        <div>
                          {hoveredPoint.day}, {hoveredPoint.date}
                        </div>
                        <div className="text-teal-300 font-bold">
                          {hoveredPoint.units.toLocaleString()} units intake
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Dynamic 4 Summary Checkpoints */}
              <div className="grid grid-cols-4 pt-3 border-t border-slate-100 text-center gap-2">
                {stats.activityChart.summaryCards.map((card, idx) => (
                  <div key={idx}>
                    <span className="text-[10px] uppercase font-semibold text-slate-400 block tracking-wider">
                      {card.dayLabel}
                    </span>
                    <span
                      className={`text-xs font-bold ${
                        card.isPeak ? 'text-[#0C6E7E]' : 'text-slate-800'
                      }`}
                    >
                      {card.unitsFormatted}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Warehouse Dynamic Metadata Card */}
            <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-[#0C6E7E] text-xs font-bold uppercase tracking-wider">
                    <TrendingUp className="w-3.5 h-3.5" />
                    Facility Details
                  </div>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {stats.warehouse.status}
                  </span>
                </div>

                <h2 className="text-base font-bold text-slate-900">
                  {stats.warehouse.warehouseName}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed truncate" title={stats.warehouse.address}>
                  {stats.warehouse.address}
                </p>

                {/* Details List with Clean Lines */}
                <div className="mt-3 divide-y divide-slate-100 border-y border-slate-100 text-xs">
                  <div className="flex items-center justify-between py-2">
                    <span className="text-slate-500 font-medium">Warehouse Type</span>
                    <span className="font-semibold text-slate-800">
                      {stats.warehouse.warehouseType === 'OWN'
                        ? 'Seller Owned (OWN)'
                        : '3PL Partner Facility'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-2">
                    <span className="text-slate-500 font-medium">Warehouse Code</span>
                    <span className="font-mono font-bold text-[#0C6E7E]">
                      {stats.warehouse.warehouseCode}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-2">
                    <span className="text-slate-500 font-medium">Active SKUs</span>
                    <span className="font-semibold text-slate-800">
                      {stats.metrics.totalSKUs} Products
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-2">
                    <span className="text-slate-500 font-medium">Linked Sellers</span>
                    <span className="font-semibold text-slate-800">
                      {stats.metrics.connectedSellersCount} Seller Accounts
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-2">
                    <span className="text-slate-500 font-medium">Safety Buffer</span>
                    <span className="font-semibold text-slate-800">
                      {stats.metrics.safetyStockTotal.toLocaleString()} Units
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-2">
                    <span className="text-slate-500 font-medium">User Account</span>
                    <span className="font-semibold text-slate-800 truncate max-w-[160px]" title={user?.email}>
                      {user?.email}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-medium">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#0C6E7E]" />
                  <span>WMS Inventory Synced</span>
                </div>
                <div className="flex items-center gap-1 text-[#0C6E7E] font-semibold">
                  <Warehouse className="w-3.5 h-3.5" />
                  <span>WH-{stats.warehouse.warehouseId}</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {!isLoading && !stats && !error && (
        <div className="bg-white rounded-xl p-8 border border-slate-200 shadow-xs text-center">
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
