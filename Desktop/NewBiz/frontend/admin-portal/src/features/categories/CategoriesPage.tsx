import React, { useState, useEffect } from 'react';
import {
  FolderTree,
  Plus,
  Search,
  RefreshCw,
  FileCheck,
  Edit2,
  CheckCircle2,
  XCircle,
  FileText,
  Layers,
  ShieldCheck,
  Sliders,
} from 'lucide-react';
import { apiClient } from '../../lib/axios.js';
import { CreateCategoryModal } from './CreateCategoryModal.js';
import { CategoryDocumentsDrawer } from './CategoryDocumentsDrawer.js';
import { CategoryAttributesDrawer } from './CategoryAttributesDrawer.js';
import { DocumentTypesModal } from './DocumentTypesModal.js';
import { usePagination } from '../../hooks/usePagination.js';
import { Pagination } from '../../components/common/Pagination.js';

interface CategoryAdminItem {
  categoryId: number;
  parentCategoryId: number | null;
  parentCategory: {
    categoryId: number;
    categoryName: string;
    categoryCode?: string;
  } | null;
  categoryName: string;
  categoryCode?: string;
  description?: string;
  iconUrl?: string;
  imageUrl?: string;
  status: string;
  isLeaf: boolean;
  subcategoriesCount: number;
  documentsCount: number;
  mandatoryDocumentsCount: number;
  attributesCount: number;
}

export const CategoriesPage: React.FC = () => {
  const [categories, setCategories] = useState<CategoryAdminItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [hierarchyFilter, setHierarchyFilter] = useState<'ALL' | 'ROOT_ONLY' | 'LEAF_ONLY'>('ALL');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryAdminItem | null>(null);
  const [selectedCategoryForDocs, setSelectedCategoryForDocs] = useState<CategoryAdminItem | null>(null);
  const [selectedCategoryForAttrs, setSelectedCategoryForAttrs] = useState<CategoryAdminItem | null>(null);
  const [isDocTypesModalOpen, setIsDocTypesModalOpen] = useState(false);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const res = await apiClient.get('/admin/categories', { params });
      if (res.data?.success) {
        setCategories(res.data.data || []);
      } else {
        setCategories([]);
      }
    } catch (err) {
      console.error('Failed to load categories', err);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCategories();
  };

  // Local filtering for hierarchy
  const filteredCategories = categories.filter((c) => {
    if (hierarchyFilter === 'ROOT_ONLY' && c.parentCategoryId !== null) return false;
    if (hierarchyFilter === 'LEAF_ONLY' && !c.isLeaf) return false;
    return true;
  });

  // Client-side pagination
  const { paginatedData: paginatedCategories, paginationProps } = usePagination({
    data: filteredCategories,
    initialPageSize: 10,
  });

  // Metrics
  const totalCount = categories.length;
  const activeCount = categories.filter((c) => c.status === 'ACTIVE').length;
  const leafCount = categories.filter((c) => c.isLeaf).length;
  const totalDocRules = categories.reduce((sum, c) => sum + c.documentsCount, 0);

  return (
    <div className="space-y-6 pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-600 mb-1">
            <FolderTree className="w-4 h-4" />
            <span>Taxonomy & Seller Compliance Governance</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Categories & Compliance Documents
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Govern the marketplace taxonomy tree, SKU category prefixes, and mandatory seller KYC document requirements.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsDocTypesModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-semibold text-xs shadow-sm hover:bg-slate-50 active:scale-95 transition-all"
          >
            <FileText className="w-3.5 h-3.5 text-indigo-600" />
            <span>Document Types</span>
          </button>

          <button
            onClick={() => {
              setEditingCategory(null);
              setIsCreateModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Category</span>
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          {
            title: 'Total Categories',
            value: totalCount,
            subtitle: `${categories.filter((c) => c.parentCategoryId === null).length} Root Departments`,
            icon: FolderTree,
            blobColor: 'bg-violet-200',
            labelColor: 'text-violet-700',
            iconBg: 'bg-violet-50',
            iconColor: 'text-violet-600',
          },
          {
            title: 'Active Taxonomies',
            value: activeCount,
            subtitle: 'Available on Marketplace',
            icon: CheckCircle2,
            blobColor: 'bg-emerald-200',
            labelColor: 'text-emerald-700',
            iconBg: 'bg-emerald-50',
            iconColor: 'text-emerald-600',
          },
          {
            title: 'Leaf Categories',
            value: leafCount,
            subtitle: 'Direct listing targets',
            icon: Layers,
            blobColor: 'bg-indigo-200',
            labelColor: 'text-indigo-700',
            iconBg: 'bg-indigo-50',
            iconColor: 'text-indigo-600',
          },
          {
            title: 'KYC Document Rules',
            value: totalDocRules,
            subtitle: 'Category compliance rules',
            icon: ShieldCheck,
            blobColor: 'bg-amber-200',
            labelColor: 'text-amber-700',
            iconBg: 'bg-amber-50',
            iconColor: 'text-amber-600',
          },
        ].map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div
              key={i}
              className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_4px_25px_rgba(99,102,241,0.04)] hover:shadow-[0_12px_35px_rgba(99,102,241,0.08)] transition-all relative overflow-hidden"
            >
              {/* Blob — bottom-left */}
              <div className={`absolute -bottom-6 -left-6 w-28 h-28 rounded-full opacity-40 ${stat.blobColor}`} />

              {/* Top: label + icon */}
              <div className="flex items-start justify-between mb-4 relative z-10">
                <p className={`text-[11px] font-black uppercase tracking-widest ${stat.labelColor}`}>
                  {stat.title}
                </p>
                <div className={`w-10 h-10 rounded-2xl ${stat.iconBg} flex items-center justify-center shadow-sm shrink-0`}>
                  <Icon className={`w-5 h-5 ${stat.iconColor}`} />
                </div>
              </div>

              {/* Value */}
              <div className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight relative z-10">
                {stat.value}
              </div>
              <p className="text-[11px] text-slate-400 font-semibold mt-1 relative z-10">
                {stat.subtitle}
              </p>
            </div>
          );
        })}
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-80 flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search category name, code..."
              className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
            />
          </div>
          <button
            type="submit"
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all"
          >
            Search
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 text-xs font-semibold rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active Only</option>
            <option value="INACTIVE">Inactive Only</option>
          </select>

          {/* Hierarchy Filter */}
          <select
            value={hierarchyFilter}
            onChange={(e) => setHierarchyFilter(e.target.value as any)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 text-xs font-semibold rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">All Hierarchy Levels</option>
            <option value="ROOT_ONLY">Root Departments Only</option>
            <option value="LEAF_ONLY">Leaf Categories Only</option>
          </select>

          <button
            onClick={fetchCategories}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
            title="Refresh list"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Categories Table View */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center shadow-sm">
          <div className="inline-block animate-spin text-indigo-600 mb-3">
            <RefreshCw className="w-8 h-8" />
          </div>
          <p className="text-sm font-medium text-slate-500">Loading marketplace categories...</p>
        </div>
      ) : filteredCategories.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-16 text-center shadow-sm">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-400">
            <FolderTree className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-900">No Categories Found</h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1 mb-5">
            There are no categories matching your filter criteria. Create a category to build your catalog taxonomy.
          </p>
          <button
            onClick={() => {
              setEditingCategory(null);
              setIsCreateModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md"
          >
            <Plus className="w-4 h-4" />
            <span>Create First Category</span>
          </button>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-5 py-3.5">Category & SKU Prefix</th>
                <th className="px-5 py-3.5">Hierarchy & Parent</th>
                <th className="px-5 py-3.5">Classification</th>
                <th className="px-5 py-3.5">Compliance KYC Dossier</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {paginatedCategories.map((item) => (
                <tr key={item.categoryId} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 shrink-0">
                        {item.categoryCode ? (
                          <span className="font-mono text-xs text-indigo-700 font-extrabold">{item.categoryCode}</span>
                        ) : (
                          <FolderTree className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 leading-snug">{item.categoryName}</h4>
                        {item.description ? (
                          <p className="text-[11px] text-slate-500 line-clamp-1 max-w-xs">{item.description}</p>
                        ) : (
                          <span className="text-[11px] text-slate-400">No description provided</span>
                        )}
                      </div>
                    </div>
                  </td>

                  <td className="px-5 py-4">
                    {item.parentCategory ? (
                      <div className="flex items-center gap-1.5 text-slate-700">
                        <span className="text-slate-400">Subcategory of:</span>
                        <span className="font-bold text-slate-900">{item.parentCategory.categoryName}</span>
                        {item.parentCategory.categoryCode && (
                          <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                            {item.parentCategory.categoryCode}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-bold text-[10px] border border-indigo-200">
                        Top-Level Root Department
                      </span>
                    )}
                  </td>

                  <td className="px-5 py-4">
                    {item.isLeaf ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-bold text-[10px] border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" /> Leaf (Direct Sellable)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 font-semibold text-[10px] border border-amber-200">
                        Branch ({item.subcategoriesCount} child subcategories)
                      </span>
                    )}
                  </td>

                  <td className="px-5 py-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-900">
                          {item.documentsCount} Required Proof(s)
                        </span>
                        {item.mandatoryDocumentsCount > 0 && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                            {item.mandatoryDocumentsCount} Mandatory
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400 block">
                        Seller onboarding verification rules
                      </span>
                    </div>
                  </td>

                  <td className="px-5 py-4">
                    {item.status === 'ACTIVE' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                        <XCircle className="w-3 h-3" /> Inactive
                      </span>
                    )}
                  </td>

                  <td className="px-5 py-4 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        onClick={() => setSelectedCategoryForAttrs(item)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold rounded-xl transition-all"
                        title="Configure specification & variant-defining attributes"
                      >
                        <Sliders className="w-3.5 h-3.5" />
                        <span>Attributes ({item.attributesCount})</span>
                      </button>

                      <button
                        onClick={() => setSelectedCategoryForDocs(item)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl transition-all"
                        title="Configure KYC document requirements"
                      >
                        <FileCheck className="w-3.5 h-3.5" />
                        <span>Docs ({item.documentsCount})</span>
                      </button>

                      <button
                        onClick={() => {
                          setEditingCategory(item);
                          setIsCreateModalOpen(true);
                        }}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                        title="Edit category details"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Reusable Pagination Controls */}
          <Pagination {...paginationProps} itemLabel="categories" />
        </div>
      )}

      {/* Create / Edit Category Modal */}
      {isCreateModalOpen && (
        <CreateCategoryModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => {
            setIsCreateModalOpen(false);
            fetchCategories();
          }}
          editingCategory={editingCategory}
          allCategories={categories}
        />
      )}

      {/* Category Attributes Management Drawer */}
      {selectedCategoryForAttrs && (
        <CategoryAttributesDrawer
          isOpen={!!selectedCategoryForAttrs}
          onClose={() => setSelectedCategoryForAttrs(null)}
          category={selectedCategoryForAttrs}
          onUpdateSuccess={() => {
            fetchCategories();
          }}
        />
      )}

      {/* Category Documents Requirements Drawer */}
      {selectedCategoryForDocs && (
        <CategoryDocumentsDrawer
          isOpen={!!selectedCategoryForDocs}
          onClose={() => setSelectedCategoryForDocs(null)}
          category={selectedCategoryForDocs}
          onUpdateSuccess={() => {
            fetchCategories();
          }}
        />
      )}

      {/* Master Document Types Registry Modal */}
      {isDocTypesModalOpen && (
        <DocumentTypesModal
          isOpen={isDocTypesModalOpen}
          onClose={() => setIsDocTypesModalOpen(false)}
        />
      )}
    </div>
  );
};
