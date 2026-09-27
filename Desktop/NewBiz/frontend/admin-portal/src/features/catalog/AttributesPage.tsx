import React, { useState, useEffect } from 'react';
import {
  ListFilter,
  Plus,
  Search,
  RefreshCw,
  Edit2,
  Tag,
  CheckCircle2,
  Layers,
  Type,
  Binary,
  ToggleLeft,
  AlertCircle,
  FolderTree,
} from 'lucide-react';
import { apiClient } from '../../lib/axios.js';
import { CreateAttributeModal } from './CreateAttributeModal.js';
import { ManageAttributeValuesModal } from './ManageAttributeValuesModal.js';

interface AttributeItem {
  attributeId: number;
  attributeName: string;
  dataType: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'OPTIONS';
  status: 'ACTIVE' | 'INACTIVE';
  valuesCount: number;
  categoriesCount: number;
  createdAt: string;
  updatedAt?: string;
}

export const AttributesPage: React.FC = () => {
  const [attributes, setAttributes] = useState<AttributeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'OPTIONS' | 'STRING' | 'NUMBER' | 'BOOLEAN'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingAttribute, setEditingAttribute] = useState<AttributeItem | null>(null);
  const [managingValuesAttribute, setManagingValuesAttribute] = useState<AttributeItem | null>(null);

  const fetchAttributes = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = {};
      if (typeFilter !== 'ALL') params.dataType = typeFilter;
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const res = await apiClient.get('/admin/catalog/attributes', { params });
      if (res.data.success) {
        setAttributes(res.data.data || []);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load specification attributes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttributes();
  }, [typeFilter, statusFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchAttributes();
  };

  // Metrics
  const totalCount = attributes.length;
  const optionsCount = attributes.filter((a) => a.dataType === 'OPTIONS').length;
  const activeCount = attributes.filter((a) => a.status === 'ACTIVE').length;
  const totalConfiguredValues = attributes.reduce((sum, a) => sum + (a.valuesCount || 0), 0);

  const getDataTypeBadge = (dataType: string) => {
    switch (dataType) {
      case 'OPTIONS':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-violet-50 text-violet-700 border border-violet-200">
            <ListFilter className="w-3 h-3" /> OPTIONS
          </span>
        );
      case 'STRING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200">
            <Type className="w-3 h-3" /> STRING
          </span>
        );
      case 'NUMBER':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200">
            <Binary className="w-3 h-3" /> NUMBER
          </span>
        );
      case 'BOOLEAN':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <ToggleLeft className="w-3 h-3" /> BOOLEAN
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-700">
            {dataType}
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
            <ListFilter className="w-4 h-4" />
            Catalog Schema & Specification Governance
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
            Specification Attributes
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
            Define attributes, data types, and manage standardized option values used across product categories and SKU variants.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => fetchAttributes()}
            disabled={loading}
            className="p-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-2xl shadow-sm transition-all"
            title="Refresh attributes"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-violet-600' : ''}`} />
          </button>

          <button
            onClick={() => {
              setEditingAttribute(null);
              setCreateModalOpen(true);
            }}
            className="px-5 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white text-xs font-bold rounded-2xl shadow-lg shadow-violet-600/20 flex items-center gap-2 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Define Attribute
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Card 1: Total Specs (Purple) */}
        <div className="relative overflow-hidden bg-white rounded-2xl border border-slate-100 p-5 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-md transition-all">
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#7928CA] rounded-l-2xl" />
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-purple-100/60 pointer-events-none" />
          <div className="flex items-start justify-between relative z-10">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-purple-700">
              Total Specs
            </span>
            <div className="w-10 h-10 rounded-2xl bg-white/90 border border-purple-100/80 shadow-xs flex items-center justify-center text-purple-600">
              <Layers className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 relative z-10">
            <div className="text-3xl font-black text-slate-900 tracking-tight">{totalCount}</div>
            <p className="text-[11px] text-slate-400 font-medium mt-1">Global catalog specifications</p>
          </div>
        </div>

        {/* Card 2: Option Specs (Blue) */}
        <div className="relative overflow-hidden bg-white rounded-2xl border border-slate-100 p-5 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-md transition-all">
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#0070F3] rounded-l-2xl" />
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-blue-100/60 pointer-events-none" />
          <div className="flex items-start justify-between relative z-10">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-600">
              Option Specs
            </span>
            <div className="w-10 h-10 rounded-2xl bg-white/90 border border-blue-100/80 shadow-xs flex items-center justify-center text-blue-600">
              <ListFilter className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 relative z-10">
            <div className="text-3xl font-black text-slate-900 tracking-tight">{optionsCount}</div>
            <p className="text-[11px] text-slate-400 font-medium mt-1">Predefined option sets</p>
          </div>
        </div>

        {/* Card 3: Standardized Values (Emerald) */}
        <div className="relative overflow-hidden bg-white rounded-2xl border border-slate-100 p-5 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-md transition-all">
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#059669] rounded-l-2xl" />
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-emerald-100/60 pointer-events-none" />
          <div className="flex items-start justify-between relative z-10">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700">
              Standardized Values
            </span>
            <div className="w-10 h-10 rounded-2xl bg-white/90 border border-emerald-100/80 shadow-xs flex items-center justify-center text-emerald-600">
              <Tag className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 relative z-10">
            <div className="text-3xl font-black text-slate-900 tracking-tight">{totalConfiguredValues}</div>
            <p className="text-[11px] text-slate-400 font-medium mt-1">Configured variant codes</p>
          </div>
        </div>

        {/* Card 4: Active Status (Teal) */}
        <div className="relative overflow-hidden bg-white rounded-2xl border border-slate-100 p-5 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-md transition-all">
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-teal-600 rounded-l-2xl" />
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-teal-100/60 pointer-events-none" />
          <div className="flex items-start justify-between relative z-10">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-teal-700">
              Active Status
            </span>
            <div className="w-10 h-10 rounded-2xl bg-white/90 border border-teal-100/80 shadow-xs flex items-center justify-center text-teal-600">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 relative z-10">
            <div className="text-3xl font-black text-slate-900 tracking-tight">{activeCount}</div>
            <p className="text-[11px] text-slate-400 font-medium mt-1">Available for category mapping</p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-sm flex flex-col lg:flex-row items-center justify-between gap-4">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          {/* Data Type Filter */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200">
            {(['ALL', 'OPTIONS', 'STRING', 'NUMBER', 'BOOLEAN'] as const).map((dt) => (
              <button
                key={dt}
                onClick={() => setTypeFilter(dt)}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                  typeFilter === dt
                    ? 'bg-gradient-to-r from-[#635BFF] to-[#7C5CFC] text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {dt === 'ALL' ? 'All Data Types' : dt}
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
            placeholder="Search specification name..."
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
            <span className="text-xs font-semibold">Loading specification attributes...</span>
          </div>
        ) : error ? (
          <div className="py-16 px-6 text-center">
            <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-800">Failed to Load Attributes</h3>
            <p className="text-xs text-slate-500 mt-1">{error}</p>
            <button
              onClick={() => fetchAttributes()}
              className="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl"
            >
              Try Again
            </button>
          </div>
        ) : attributes.length === 0 ? (
          <div className="py-20 text-center px-4">
            <ListFilter className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-800">No Specification Attributes Found</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {searchQuery
                ? `No specifications match "${searchQuery}". Try clearing filters.`
                : 'Define specifications such as Color, Size, Storage, or Capacity to power the catalog.'}
            </p>
            {!searchQuery && (
              <button
                onClick={() => setCreateModalOpen(true)}
                className="mt-5 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-bold rounded-xl shadow-md"
              >
                Define First Attribute
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                  <th className="py-4 px-6">Specification Attribute</th>
                  <th className="py-4 px-4">Data Type</th>
                  <th className="py-4 px-4">Standardized Options</th>
                  <th className="py-4 px-4">Category Mappings</th>
                  <th className="py-4 px-4">Status</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {attributes.map((attr) => (
                  <tr key={attr.attributeId} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 font-mono font-black text-xs">
                          #{attr.attributeId}
                        </div>
                        <div>
                          <span className="font-bold text-slate-900 block text-xs">
                            {attr.attributeName}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">
                            Added {new Date(attr.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-4">{getDataTypeBadge(attr.dataType)}</td>

                    <td className="py-4 px-4">
                      {attr.dataType === 'OPTIONS' ? (
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-800">
                            {attr.valuesCount}
                          </span>
                          <span className="text-slate-400 text-[11px]">options</span>
                          <button
                            onClick={() => setManagingValuesAttribute(attr)}
                            className="px-2.5 py-1 rounded-lg bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 text-[10px] font-extrabold inline-flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Tag className="w-3 h-3" />
                            Configure Options
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                          <span className="text-slate-400 text-[11px] font-medium">
                            {attr.dataType === 'STRING'
                              ? 'Free text (entered by seller)'
                              : attr.dataType === 'NUMBER'
                              ? 'Numeric (entered by seller)'
                              : 'Yes / No toggle (seller switch)'}
                          </span>
                        </div>
                      )}
                    </td>

                    <td className="py-4 px-4">
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <FolderTree className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-bold">{attr.categoriesCount}</span>
                        <span className="text-slate-400 text-[11px]">
                          {attr.categoriesCount === 1 ? 'category' : 'categories'}
                        </span>
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      {attr.status === 'ACTIVE' ? (
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
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setEditingAttribute(attr);
                            setCreateModalOpen(true);
                          }}
                          className="p-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors"
                          title="Edit attribute metadata"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {attr.dataType === 'OPTIONS' && (
                          <button
                            onClick={() => setManagingValuesAttribute(attr)}
                            className="p-1.5 rounded-xl border border-violet-200 bg-violet-50/50 hover:bg-violet-100 text-violet-700 transition-colors"
                            title="Configure option choices"
                          >
                            <Tag className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      {createModalOpen && (
        <CreateAttributeModal
          attribute={editingAttribute}
          onClose={() => {
            setCreateModalOpen(false);
            setEditingAttribute(null);
          }}
          onSuccess={() => {
            setCreateModalOpen(false);
            setEditingAttribute(null);
            fetchAttributes();
          }}
        />
      )}

      {managingValuesAttribute && (
        <ManageAttributeValuesModal
          attribute={managingValuesAttribute}
          onClose={() => setManagingValuesAttribute(null)}
          onUpdated={() => fetchAttributes()}
        />
      )}
    </div>
  );
};
