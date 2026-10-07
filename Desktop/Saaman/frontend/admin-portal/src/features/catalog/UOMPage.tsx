import React, { useState, useEffect } from 'react';
import {
  Scale,
  Plus,
  Search,
  RefreshCw,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Hash,
  Layers,
  Sparkles,
} from 'lucide-react';
import { apiClient } from '../../lib/axios.js';
import { CreateUOMModal } from './CreateUOMModal.js';
import { NoResults } from '../../components/common/NoResults.js';

interface UOMItem {
  uomId: number;
  uomCode: string;
  uomName: string;
  uomType: string;
  decimalPrecision: number;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt?: string;
}

export const UOMPage: React.FC = () => {
  const [uoms, setUoms] = useState<UOMItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUOM, setEditingUOM] = useState<UOMItem | null>(null);

  const fetchUOMs = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = {};
      if (typeFilter !== 'ALL') params.uomType = typeFilter;
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const res = await apiClient.get('/admin/catalog/uom', { params });
      if (res.data.success) {
        setUoms(res.data.data || []);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load units of measure');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUOMs();
  }, [typeFilter, statusFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchUOMs();
  };

  // Metrics
  const totalCount = uoms.length;
  const weightCount = uoms.filter((u) => u.uomType === 'WEIGHT').length;
  const volumeCount = uoms.filter((u) => u.uomType === 'VOLUME').length;
  const countCount = uoms.filter((u) => u.uomType === 'COUNT').length;

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'WEIGHT':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
            WEIGHT
          </span>
        );
      case 'VOLUME':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-cyan-50 text-cyan-700 border border-cyan-200">
            VOLUME
          </span>
        );
      case 'LENGTH':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-violet-50 text-violet-700 border border-violet-200">
            LENGTH
          </span>
        );
      case 'COUNT':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200">
            COUNT
          </span>
        );
      case 'AREA':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200">
            AREA
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
            {type}
          </span>
        );
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-violet-600 text-xs font-bold uppercase tracking-wider mb-2">
            <Scale className="w-4 h-4" />
            Standardized Units & Logistics Precision
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
            Units of Measure (UOM)
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
            Define units for product dimensions, weights, volumes, packaging, and dispatch rounding rules.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => fetchUOMs()}
            disabled={loading}
            className="p-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-2xl shadow-sm transition-all"
            title="Refresh UOM list"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-violet-600' : ''}`} />
          </button>

          <button
            onClick={() => {
              setEditingUOM(null);
              setModalOpen(true);
            }}
            className="px-5 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white text-xs font-bold rounded-2xl shadow-lg shadow-violet-600/20 flex items-center gap-2 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Unit of Measure
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Card 1: Total Units (Purple) */}
        <div className="relative overflow-hidden bg-white rounded-2xl border border-slate-100 p-5 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-md transition-all">
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#7928CA] rounded-l-2xl" />
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-purple-100/60 pointer-events-none" />
          <div className="flex items-start justify-between relative z-10">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-purple-700">
              Total Units
            </span>
            <div className="w-10 h-10 rounded-2xl bg-white/90 border border-purple-100/80 shadow-xs flex items-center justify-center text-purple-600">
              <Layers className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 relative z-10">
            <div className="text-3xl font-black text-slate-900 tracking-tight">{totalCount}</div>
            <p className="text-[11px] text-slate-400 font-medium mt-1">Standard measurement units</p>
          </div>
        </div>

        {/* Card 2: Weight Units (Emerald) */}
        <div className="relative overflow-hidden bg-white rounded-2xl border border-slate-100 p-5 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-md transition-all">
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#059669] rounded-l-2xl" />
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-emerald-100/60 pointer-events-none" />
          <div className="flex items-start justify-between relative z-10">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700">
              Weight Units
            </span>
            <div className="w-10 h-10 rounded-2xl bg-white/90 border border-emerald-100/80 shadow-xs flex items-center justify-center text-emerald-600">
              <Scale className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 relative z-10">
            <div className="text-3xl font-black text-slate-900 tracking-tight">{weightCount}</div>
            <p className="text-[11px] text-slate-400 font-medium mt-1">Mass & dispatch scales</p>
          </div>
        </div>

        {/* Card 3: Volume Units (Blue) */}
        <div className="relative overflow-hidden bg-white rounded-2xl border border-slate-100 p-5 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-md transition-all">
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#0070F3] rounded-l-2xl" />
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-blue-100/60 pointer-events-none" />
          <div className="flex items-start justify-between relative z-10">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-600">
              Volume Units
            </span>
            <div className="w-10 h-10 rounded-2xl bg-white/90 border border-blue-100/80 shadow-xs flex items-center justify-center text-blue-600">
              <Sparkles className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 relative z-10">
            <div className="text-3xl font-black text-slate-900 tracking-tight">{volumeCount}</div>
            <p className="text-[11px] text-slate-400 font-medium mt-1">Liquid & capacity scales</p>
          </div>
        </div>

        {/* Card 4: Discrete Count (Amber) */}
        <div className="relative overflow-hidden bg-white rounded-2xl border border-slate-100 p-5 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-md transition-all">
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-amber-500 rounded-l-2xl" />
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-amber-100/60 pointer-events-none" />
          <div className="flex items-start justify-between relative z-10">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-700">
              Discrete Count
            </span>
            <div className="w-10 h-10 rounded-2xl bg-white/90 border border-amber-100/80 shadow-xs flex items-center justify-center text-amber-600">
              <Hash className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 relative z-10">
            <div className="text-3xl font-black text-slate-900 tracking-tight">{countCount}</div>
            <p className="text-[11px] text-slate-400 font-medium mt-1">Pieces, sets & bundles</p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-sm flex flex-col lg:flex-row items-center justify-between gap-4">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          {/* UOM Type Filter */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200 overflow-x-auto">
            {(['ALL', 'WEIGHT', 'VOLUME', 'LENGTH', 'COUNT', 'AREA'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  typeFilter === t
                    ? 'bg-gradient-to-r from-[#635BFF] to-[#7C5CFC] text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t === 'ALL' ? 'All Types' : t}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200">
            {(['ALL', 'ACTIVE', 'INACTIVE'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                  statusFilter === st
                    ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st === 'ALL' ? 'All Status' : st}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="relative flex-1 lg:max-w-xs w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search code or unit name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 font-medium"
          />
        </form>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-2">
            <RefreshCw className="w-7 h-7 animate-spin text-violet-600" />
            <span className="text-xs font-semibold">Loading units of measure...</span>
          </div>
        ) : error ? (
          <div className="py-16 px-6 text-center">
            <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-800">Failed to Load Units</h3>
            <p className="text-xs text-slate-500 mt-1">{error}</p>
            <button
              onClick={() => fetchUOMs()}
              className="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl"
            >
              Try Again
            </button>
          </div>
        ) : uoms.length === 0 ? (
          <NoResults
            title="No Units of Measure Found"
            description={
              searchQuery
                ? `No units match "${searchQuery}". Try clearing filters.`
                : 'Configure units of measure to support product dimensions, volume, weight, and inventory.'
            }
            action={
              !searchQuery
                ? {
                    label: 'Add First Unit',
                    onClick: () => setModalOpen(true),
                    icon: <Plus className="w-4 h-4" />,
                  }
                : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                  <th className="py-4 px-6">UOM Code</th>
                  <th className="py-4 px-4">Unit Name</th>
                  <th className="py-4 px-4">Classification</th>
                  <th className="py-4 px-4">Decimal Precision</th>
                  <th className="py-4 px-4">Sample Format</th>
                  <th className="py-4 px-4">Status</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {uoms.map((u) => {
                  const sampleVal = (12.34567).toFixed(u.decimalPrecision);
                  return (
                    <tr key={u.uomId} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-4 px-6">
                        <span className="px-3 py-1 rounded-xl bg-slate-100 text-slate-900 font-mono font-black text-xs border border-slate-200">
                          {u.uomCode}
                        </span>
                      </td>

                      <td className="py-4 px-4 font-bold text-slate-900">{u.uomName}</td>

                      <td className="py-4 px-4">{getTypeBadge(u.uomType)}</td>

                      <td className="py-4 px-4">
                        <span className="font-mono text-xs font-extrabold text-slate-700">
                          {u.decimalPrecision} {u.decimalPrecision === 1 ? 'place' : 'places'}
                        </span>
                      </td>

                      <td className="py-4 px-4 font-mono font-bold text-violet-700 text-xs">
                        {sampleVal} {u.uomCode}
                      </td>

                      <td className="py-4 px-4">
                        {u.status === 'ACTIVE' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" /> ACTIVE
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                            INACTIVE
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-6 text-right">
                        <button
                          onClick={() => {
                            setEditingUOM(u);
                            setModalOpen(true);
                          }}
                          className="p-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors"
                          title="Edit Unit of Measure"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <CreateUOMModal
          uom={editingUOM}
          onClose={() => {
            setModalOpen(false);
            setEditingUOM(null);
          }}
          onSuccess={() => {
            setModalOpen(false);
            setEditingUOM(null);
            fetchUOMs();
          }}
        />
      )}
    </div>
  );
};
