import React, { useState, useEffect } from 'react';
import {
  Store,
  Search,
  RefreshCw,
  CheckCircle2,
  ExternalLink,
  TrendingUp,
  ShieldCheck,
  Mail,
  Phone,
  UserPlus,
} from 'lucide-react';
import { apiClient } from '../../lib/axios.js';
import { OnboardSellerModal } from './OnboardSellerModal.js';
import { usePagination } from '../../hooks/usePagination.js';
import { Pagination } from '../../components/common/Pagination.js';

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
  const [onboardModalOpen, setOnboardModalOpen] = useState<boolean>(false);

  const fetchActiveSellers = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/admin/sellers', {
        params: { status: 'ACTIVE', limit: 200 },
      });
      if (res.data.success) {
        setSellers(res.data.data.items || []);
      }
    } catch (err) {
      console.error('Failed to load active sellers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActiveSellers();
  }, []);

  const filtered = sellers.filter((s) => {
    const term = searchTerm.toLowerCase();
    return (
      s.sellerName.toLowerCase().includes(term) ||
      s.businessName.toLowerCase().includes(term) ||
      s.sellerCode.toLowerCase().includes(term) ||
      s.email.toLowerCase().includes(term) ||
      s.categoryName.toLowerCase().includes(term)
    );
  });

  // Client-side pagination
  const { paginatedData: paginatedSellers, paginationProps } = usePagination({
    data: filtered,
    initialPageSize: 12,
    pageSizeOptions: [12, 24, 48],
  });

  const totalVerifiedDocs = sellers.reduce((sum, s) => sum + s.verifiedDocumentCount, 0);
  const uniqueCategories = [...new Set(sellers.map((s) => s.categoryName))].length;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
            Active Sellers
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-semibold">
            KYC-verified, platform-approved sellers authorized to list and sell products
          </p>
        </div>
        <div className="flex items-center gap-3 self-start sm:self-auto">
          <button
            onClick={fetchActiveSellers}
            className="px-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-sm flex items-center gap-2 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Directory
          </button>
          <button
            onClick={() => setOnboardModalOpen(true)}
            className="px-4 py-2.5 bg-gradient-to-r from-[#635BFF] to-[#7C5CFC] hover:from-[#5147FF] hover:to-[#6C4BF5] text-white rounded-2xl text-xs font-black shadow-md shadow-indigo-500/20 flex items-center gap-2 transition-all"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Onboard New Seller
          </button>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {[
          {
            title: 'Active Sellers',
            value: sellers.length,
            sub: 'KYC approved & authorized',
            icon: Store,
            blobColor: 'bg-violet-200',
            labelColor: 'text-violet-700',
            iconBg: 'bg-violet-50',
            iconColor: 'text-violet-600',
          },
          {
            title: 'Verified Documents',
            value: totalVerifiedDocs,
            sub: 'GST, PAN & Bank proofs on file',
            icon: ShieldCheck,
            blobColor: 'bg-emerald-200',
            labelColor: 'text-emerald-700',
            iconBg: 'bg-emerald-50',
            iconColor: 'text-emerald-600',
          },
          {
            title: 'Category Coverage',
            value: uniqueCategories,
            sub: 'Unique product categories active',
            icon: TrendingUp,
            blobColor: 'bg-blue-200',
            labelColor: 'text-blue-700',
            iconBg: 'bg-blue-50',
            iconColor: 'text-blue-600',
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
              <div className="flex items-start justify-between mb-5 relative z-10">
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

              {/* Sub */}
              <p className="text-[11px] text-slate-400 font-medium mt-1 relative z-10">{stat.sub}</p>
            </div>
          );
        })}
      </div>


      {/* Seller Directory */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">

        {/* Search bar */}
        <div className="px-6 py-5 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-900">Seller Directory</span>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-[11px] font-bold">
              {filtered.length} Active
            </span>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by brand, legal name, code, category..."
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-[#F8F9FE] border border-slate-200/80 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#635BFF]/30"
            />
          </div>
        </div>

        {/* Cards Grid */}
        {loading ? (
          <div className="py-20 text-center">
            <RefreshCw className="w-7 h-7 animate-spin mx-auto mb-3 text-[#635BFF]" />
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Loading seller directory...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center space-y-3">
            <Store className="w-12 h-12 mx-auto text-slate-200" />
            <p className="text-sm font-bold text-slate-400">
              {sellers.length === 0
                ? 'No active sellers yet. Approve KYC applications to see sellers here.'
                : 'No sellers match your search.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 p-6">
            {paginatedSellers.map((seller) => (
              <div
                key={seller.sellerId}
                className="group relative rounded-3xl border border-slate-100 bg-[#FAFBFF] hover:border-[#635BFF]/30 hover:shadow-lg hover:shadow-indigo-500/5 transition-all p-5 space-y-4"
              >
                {/* Verified badge */}
                <div className="absolute top-4 right-4">
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-[10px] font-bold">
                    <CheckCircle2 className="w-3 h-3" /> Active
                  </span>
                </div>

                {/* Avatar + Identity */}
                <div className="flex items-center gap-3 pr-16">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#635BFF] to-[#9B7BF7] flex items-center justify-center text-white font-black text-lg shadow-md shadow-indigo-500/20 shrink-0">
                    {seller.sellerName?.[0]?.toUpperCase() || 'S'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-black text-slate-900 truncate">{seller.sellerName}</p>
                    <p className="text-[11px] text-slate-500 font-medium truncate">{seller.businessName}</p>
                    <span className="inline-block mt-1 px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[10px] font-mono font-bold text-slate-600">
                      {seller.sellerCode}
                    </span>
                  </div>
                </div>

                {/* Category chip */}
                <div className="px-3 py-2 rounded-2xl bg-white border border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Primary Category</span>
                  <span className="text-xs font-bold text-[#635BFF]">{seller.categoryName}</span>
                </div>

                {/* Contact */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{seller.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="font-mono">{seller.phoneNumber}</span>
                  </div>
                </div>

                {/* KYC compliance bar */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">KYC Compliance</span>
                    <span className="text-[11px] font-bold text-emerald-700">
                      {seller.verifiedDocumentCount}/{seller.documentCount} verified
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all"
                      style={{
                        width: seller.documentCount > 0
                          ? `${(seller.verifiedDocumentCount / seller.documentCount) * 100}%`
                          : '0%',
                      }}
                    />
                  </div>
                </div>

                {/* Footer */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-medium">
                    Approved{' '}
                    {seller.reviewedAt
                      ? new Date(seller.reviewedAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })
                      : '—'}
                  </span>
                  <button className="p-1.5 rounded-lg text-slate-400 hover:text-[#635BFF] hover:bg-indigo-50 transition-colors">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Reusable Pagination Controls */}
        <Pagination {...paginationProps} itemLabel="sellers" />
      </div>

      {/* Onboard Seller Modal */}
      <OnboardSellerModal
        isOpen={onboardModalOpen}
        onClose={() => setOnboardModalOpen(false)}
        onSuccess={fetchActiveSellers}
      />
    </div>
  );
};
