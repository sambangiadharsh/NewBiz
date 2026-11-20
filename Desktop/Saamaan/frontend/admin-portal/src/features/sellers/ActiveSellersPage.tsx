import React, { useState, useEffect } from 'react';
import {
  Store,
  CheckCircle2,
  TrendingUp,
  ShieldCheck,
  Mail,
  Phone,
  UserPlus,
  Eye,
  Calendar,
  Layers,
} from 'lucide-react';
import { apiClient } from '../../lib/axios.js';
import { OnboardSellerModal } from './OnboardSellerModal.js';
import { ApplicationReviewModal } from './ApplicationReviewModal.js';
import { usePagination } from '../../hooks/usePagination.js';
import { DataTable, ColumnDef } from '../../components/common/table/index.js';
import { SearchBar } from '../../components/common/SearchBar.js';

interface ActiveSeller {
  applicationId: number;
  sellerId: number;
  sellerCode: string;
  sellerName: string;
  businessName: string;
  email: string;
  phoneNumber: string;
  categoryName: string;
  status: string;
  sellerStatus: string;
  reviewedAt?: string;
  documentCount: number;
  verifiedDocumentCount: number;
}

export const ActiveSellersPage: React.FC = () => {
  const [sellers, setSellers] = useState<ActiveSeller[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [globalStats, setGlobalStats] = useState({
    activeSellers: 0,
    verifiedDocs: 0,
    activeCategories: 0,
  });
  const [onboardModalOpen, setOnboardModalOpen] = useState<boolean>(false);
  const [selectedAppId, setSelectedAppId] = useState<number | null>(null);

  const fetchGlobalStats = async () => {
    try {
      const res = await apiClient.get('/admin/sellers', { params: { status: 'ACTIVE', limit: 100 } });
      if (res.data.success && res.data.data?.items) {
        const all: ActiveSeller[] = res.data.data.items;
        setGlobalStats({
          activeSellers: res.data.data.pagination?.total || all.length,
          verifiedDocs: all.reduce((sum, s) => sum + (s.verifiedDocumentCount || 0), 0),
          activeCategories: [...new Set(all.map((s) => s.categoryName).filter(Boolean))].length,
        });
      }
    } catch {
      // ignore
    }
  };

  const fetchActiveSellers = async () => {
    try {
      setLoading(true);
      const params: any = {
        status: 'ACTIVE',
        page,
        limit: pageSize,
      };
      if (searchTerm.trim()) {
        params.search = searchTerm.trim();
      }

      const res = await apiClient.get('/admin/sellers', { params });
      if (res.data.success) {
        setSellers(res.data.data.items || []);
        if (res.data.data.pagination) {
          setTotalCount(res.data.data.pagination.total || 0);
        } else {
          setTotalCount(res.data.data.items?.length || 0);
        }
      }
    } catch (err) {
      console.error('Failed to load active sellers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGlobalStats();
  }, []);

  useEffect(() => {
    fetchActiveSellers();
  }, [searchTerm, page, pageSize]);

  // Unique categories for filtering
  const categoriesList = Array.from(
    new Set(sellers.map((s) => s.categoryName).filter(Boolean))
  ).sort();

  // If a category filter is selected, filter display items (or pass to server)
  const displayedSellers = categoryFilter === 'ALL'
    ? sellers
    : sellers.filter((s) => s.categoryName === categoryFilter);

  // Server-side pagination
  const pagination = usePagination({
    totalItems: totalCount,
    initialPage: page,
    initialPageSize: pageSize,
    pageSizeOptions: [10, 20, 50],
    onPageChange: (newPage) => setPage(newPage),
    onPageSizeChange: (newSize) => {
      setPageSize(newSize);
      setPage(1);
    },
  });


  const columns: ColumnDef<ActiveSeller>[] = [
    {
      header: 'Seller Entity',
      cell: ({ row: seller }) => {
        const initial = seller.sellerName?.[0]?.toUpperCase() || 'S';
        return (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white font-black text-sm flex items-center justify-center shadow-xs shrink-0">
              {initial}
            </div>
            <div className="min-w-0">
              <span className="font-bold text-slate-900 text-sm block truncate">
                {seller.businessName || seller.sellerName}
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[11px] font-semibold text-indigo-600 truncate">
                  {seller.sellerName}
                </span>
                <span className="text-slate-300">•</span>
                <span className="font-mono text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                  {seller.sellerCode}
                </span>
              </div>
            </div>
          </div>
        );
      },
    },
    {
      header: 'Primary Category',
      cell: ({ row: seller }) => (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 text-slate-800 font-semibold text-xs border border-slate-200/60">
          <Layers className="w-3.5 h-3.5 text-slate-500" />
          {seller.categoryName || 'General'}
        </span>
      ),
    },
    {
      header: 'Contact Details',
      cell: ({ row: seller }) => (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-slate-700 font-medium">
            <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate max-w-[180px]">{seller.email}</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-500 font-mono text-[11px]">
            <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>{seller.phoneNumber || 'N/A'}</span>
          </div>
        </div>
      ),
    },
    {
      header: 'KYC Compliance',
      cell: ({ row: seller }) => {
        const compliancePercent =
          seller.documentCount > 0
            ? Math.round((seller.verifiedDocumentCount / seller.documentCount) * 100)
            : 100;

        return (
          <div className="space-y-1.5 w-36">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-emerald-700 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                {seller.verifiedDocumentCount}/{seller.documentCount} Verified
              </span>
              <span className="font-mono text-[10px] text-slate-400">
                {compliancePercent}%
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 transition-all"
                style={{ width: `${compliancePercent}%` }}
              />
            </div>
          </div>
        );
      },
    },
    {
      header: 'Approved On',
      cell: ({ row: seller }) => (
        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>
            {seller.reviewedAt
              ? new Date(seller.reviewedAt).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })
              : 'Verified'}
          </span>
        </div>
      ),
    },
    {
      header: 'Status',
      cell: () => (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-[10px] tracking-wider uppercase">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          Active
        </span>
      ),
    },
    {
      header: 'Action',
      align: 'right',
      cell: ({ row: seller }) => (
        <button
          onClick={() => setSelectedAppId(seller.applicationId)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs transition-colors cursor-pointer"
          title="Inspect seller application and documents"
        >
          <Eye className="w-3.5 h-3.5" />
          <span>Inspect</span>
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 sm:p-8 rounded-3xl border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
        <div>
          <div className="flex items-center space-x-3 mb-1">
            <span className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl">
              <Store className="w-6 h-6" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
              Active Sellers
            </h1>
          </div>
         
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <button
            onClick={() => setOnboardModalOpen(true)}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-200 hover:shadow-indigo-300 flex items-center gap-2 transition-all cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Onboard New Seller</span>
          </button>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {[
          {
            title: 'Active Sellers',
            value: globalStats.activeSellers || totalCount,
            sub: 'KYC approved & active merchants',
            icon: Store,
            iconBg: 'bg-indigo-50 text-indigo-600',
          },
          {
            title: 'Verified Documents',
            value: globalStats.verifiedDocs,
            sub: 'GST, PAN & Bank accounts on file',
            icon: ShieldCheck,
            iconBg: 'bg-emerald-50 text-emerald-600',
          },
          {
            title: 'Active Categories',
            value: globalStats.activeCategories,
            sub: 'Distinct product taxonomy segments',
            icon: TrendingUp,
            iconBg: 'bg-blue-50 text-blue-600',
          },
        ].map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div
              key={i}
              className="bg-white rounded-3xl p-6 border border-slate-100 shadow-2xs hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  {stat.title}
                </span>
                <div className={`w-10 h-10 rounded-2xl ${stat.iconBg} flex items-center justify-center shrink-0`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <div className="text-3xl font-black text-slate-900 tracking-tight">
                {stat.value}
              </div>
              <p className="text-[11px] text-slate-400 font-medium mt-1">{stat.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-2xs overflow-hidden">
        {/* Controls Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="text-base font-bold text-slate-900">Sellers List</span>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-bold">
              {searchTerm ? `${totalCount} matching` : `${globalStats.activeSellers || totalCount} Active`}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            {/* Category Filter */}
            {categoriesList.length > 0 && (
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full sm:w-48 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
              >
                <option value="ALL">All Categories</option>
                {categoriesList.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            )}

            {/* Search Box */}
            <SearchBar
              value={searchTerm}
              onChange={(val) => {
                setSearchTerm(val);
                setPage(1);
              }}
              placeholder="Search legal name, trade brand, code..."
              isLoading={loading}
              className="w-full sm:w-80"
            />
          </div>
        </div>

        {/* Reusable Data Table with crisp row and column border separation */}
        <DataTable<ActiveSeller>
          columns={columns}
          data={displayedSellers}
          keyExtractor={(seller) => seller.sellerId}
          loading={loading}
          bordered={true}
          containerClassName="rounded-none border-x-0 border-b-0 shadow-none"
          emptyTitle="No Sellers Found"
          emptyDescription={
            sellers.length === 0
              ? 'No active sellers in directory. Approved applications will appear here.'
              : 'No sellers match the specified search or category filter.'
          }
          pagination={{ ...pagination.paginationProps, itemLabel: 'sellers' }}
        />

      </div>

      {/* Onboard Seller Modal */}
      <OnboardSellerModal
        isOpen={onboardModalOpen}
        onClose={() => setOnboardModalOpen(false)}
        onSuccess={fetchActiveSellers}
      />

      {/* Application KYC Inspection Modal */}
      {selectedAppId && (
        <ApplicationReviewModal
          applicationId={selectedAppId}
          isOpen={!!selectedAppId}
          onClose={() => setSelectedAppId(null)}
          onRefresh={fetchActiveSellers}
        />
      )}
    </div>
  );
};
