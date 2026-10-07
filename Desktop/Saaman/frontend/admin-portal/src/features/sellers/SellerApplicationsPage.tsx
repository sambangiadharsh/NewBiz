import React, { useState, useEffect } from 'react';
import {
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  RefreshCw,
  Eye,
  UserPlus,
} from 'lucide-react';
import { apiClient } from '../../lib/axios.js';
import { ApplicationReviewModal } from './ApplicationReviewModal.js';
import { OnboardSellerModal } from './OnboardSellerModal.js';
import { usePagination } from '../../hooks/usePagination.js';
import { Pagination } from '../../components/common/Pagination.js';
import { NoResults } from '../../components/common/NoResults.js';

interface ApplicationItem {
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
  submittedAt?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  documentCount: number;
  verifiedDocumentCount: number;
}

export const SellerApplicationsPage: React.FC = () => {
  const [allApplications, setAllApplications] = useState<ApplicationItem[]>([]); // always ALL — for metrics
  const [loading, setLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedAppId, setSelectedAppId] = useState<number | null>(null);
  const [onboardModalOpen, setOnboardModalOpen] = useState<boolean>(false);

  // Always fetch ALL — metrics must never change when switching tabs
  const fetchApplications = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/admin/sellers/applications', { params: { limit: 200 } });
      if (res.data.success) {
        setAllApplications(res.data.data.items || []);
      }
    } catch (err) {
      console.error('Failed to load seller applications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, []);

  // Client-side status filter applied to table only — metrics always use allApplications
  const statusFiltered = statusFilter === 'ALL'
    ? allApplications
    : allApplications.filter((a) => a.status === statusFilter);

  const filteredApps = statusFiltered.filter((app) => {
    const term = searchTerm.toLowerCase();
    return (
      app.sellerName.toLowerCase().includes(term) ||
      app.businessName.toLowerCase().includes(term) ||
      app.sellerCode.toLowerCase().includes(term) ||
      app.email.toLowerCase().includes(term)
    );
  });

  // Client-side reusable pagination
  const { paginatedData: paginatedApps, paginationProps } = usePagination({
    data: filteredApps,
    initialPageSize: 10,
  });

  // Metric counts — always computed from full dataset, never affected by tab selection
  const totalCount = allApplications.length;
  const pendingCount = allApplications.filter((a) => a.status === 'SUBMITTED' || a.status === 'PENDING_VERIFICATION').length;
  const approvedCount = allApplications.filter((a) => a.status === 'APPROVED').length;
  const rejectedCount = allApplications.filter((a) => a.status === 'REJECTED').length;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Overview Title Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
            Seller Onboarding & KYC Queue
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-semibold">
            Inspect legal business entity documents, verify GSTIN/PAN records, and authorize sellers
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <button
            onClick={fetchApplications}
            className="px-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-sm flex items-center gap-2 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Queue
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

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          {
            title: 'Total Applications',
            value: totalCount,
            icon: Users,
            blobColor: 'bg-violet-200',
            labelColor: 'text-violet-700',
            iconBg: 'bg-violet-50',
            iconColor: 'text-violet-600',
          },
          {
            title: 'Awaiting Review',
            value: pendingCount,
            icon: Clock,
            blobColor: 'bg-amber-200',
            labelColor: 'text-amber-700',
            iconBg: 'bg-amber-50',
            iconColor: 'text-amber-600',
          },
          {
            title: 'Approved Sellers',
            value: approvedCount,
            icon: CheckCircle2,
            blobColor: 'bg-emerald-200',
            labelColor: 'text-emerald-700',
            iconBg: 'bg-emerald-50',
            iconColor: 'text-emerald-600',
          },
          {
            title: 'Rejected / Banned',
            value: rejectedCount,
            icon: XCircle,
            blobColor: 'bg-rose-200',
            labelColor: 'text-rose-600',
            iconBg: 'bg-rose-50',
            iconColor: 'text-rose-600',
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
            </div>
          );
        })}
      </div>


      {/* Search and Filters Bar */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-slate-100/80 w-full sm:w-auto">
            {['ALL', 'SUBMITTED', 'APPROVED', 'REJECTED'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  statusFilter === st
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {st === 'ALL'
                  ? `All Submitted (${totalCount})`
                  : st === 'SUBMITTED'
                  ? `Pending Review (${pendingCount})`
                  : st === 'APPROVED'
                  ? `Approved (${approvedCount})`
                  : `Rejected (${rejectedCount})`}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by brand, legal name, code..."
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-[#F8F9FE] border border-slate-200/80 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#635BFF]/30"
            />
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-100">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-100 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                <th className="py-3.5 px-4">Seller Entity</th>
                <th className="py-3.5 px-4">Primary Category</th>
                <th className="py-3.5 px-4">Contact Details</th>
                <th className="py-3.5 px-4">KYC Compliance</th>
                <th className="py-3.5 px-4">Submitted</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#635BFF]" />
                    Loading applications queue...
                  </td>
                </tr>
              ) : filteredApps.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-6">
                    <NoResults
                      title="No Applications Found"
                      description="No onboarding applications match the selected filter criteria."
                      className="py-4"
                    />
                  </td>
                </tr>
              ) : (
                paginatedApps.map((app) => (
                  <tr key={app.applicationId} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-4 px-4">
                      <span className="font-bold text-slate-900 block">{app.businessName}</span>
                      <span className="text-[11px] text-[#635BFF] font-semibold block">{app.sellerName}</span>
                      <span className="text-[10px] font-mono text-slate-400 block">{app.sellerCode}</span>
                    </td>

                    <td className="py-4 px-4 font-semibold text-slate-700">
                      {app.categoryName}
                    </td>

                    <td className="py-4 px-4">
                      <span className="text-slate-700 font-medium block">{app.email}</span>
                      <span className="text-[11px] font-mono text-slate-400 block">{app.phoneNumber}</span>
                    </td>

                    <td className="py-4 px-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 font-mono font-bold text-slate-700">
                        {app.verifiedDocumentCount}/{app.documentCount} Verified
                      </span>
                    </td>

                    <td className="py-4 px-4 text-slate-500 font-medium">
                      {app.submittedAt ? new Date(app.submittedAt).toLocaleDateString() : 'Draft'}
                    </td>

                    <td className="py-4 px-4">
                      <span
                        className={`px-3 py-1 rounded-full font-bold text-[11px] ${
                          app.status === 'APPROVED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : app.status === 'REJECTED'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {app.status === 'APPROVED'
                          ? 'Active'
                          : app.status === 'REJECTED'
                          ? 'Rejected'
                          : 'Pending'}
                      </span>
                    </td>

                    <td className="py-4 px-4 text-right">
                      <button
                        onClick={() => setSelectedAppId(app.applicationId)}
                        className="px-3.5 py-1.5 rounded-xl bg-[#635BFF] hover:bg-[#5249FF] text-white font-bold inline-flex items-center gap-1 shadow-sm shadow-indigo-500/20 transition-all"
                      >
                        <Eye className="w-3.5 h-3.5" /> Inspect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Reusable Pagination Controls */}
        <Pagination {...paginationProps} itemLabel="applications" />
      </div>

      {/* Review & Verification Modal */}
      <ApplicationReviewModal
        applicationId={selectedAppId}
        isOpen={selectedAppId !== null}
        onClose={() => setSelectedAppId(null)}
        onRefresh={fetchApplications}
      />

      {/* Onboard Seller Modal */}
      <OnboardSellerModal
        isOpen={onboardModalOpen}
        onClose={() => setOnboardModalOpen(false)}
        onSuccess={fetchApplications}
      />
    </div>
  );
};
