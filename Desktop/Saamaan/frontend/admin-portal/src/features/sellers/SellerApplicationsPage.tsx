import React, { useState, useEffect } from 'react';
import {
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  UserPlus,
} from 'lucide-react';
import { apiClient } from '../../lib/axios.js';
import { ApplicationReviewModal } from './ApplicationReviewModal.js';
import { OnboardSellerModal } from './OnboardSellerModal.js';
import { usePagination } from '../../hooks/usePagination.js';
import { DataTable, ColumnDef } from '../../components/common/table/index.js';
import { SearchBar } from '../../components/common/SearchBar.js';

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
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [metrics, setMetrics] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
  });
  const [selectedAppId, setSelectedAppId] = useState<number | null>(null);
  const [onboardModalOpen, setOnboardModalOpen] = useState<boolean>(false);

  const fetchMetrics = async () => {
    try {
      const res = await apiClient.get('/admin/sellers/applications', { params: { limit: 100 } });
      if (res.data?.success && res.data.data?.items) {
        const items: ApplicationItem[] = res.data.data.items;
        setMetrics({
          total: res.data.data.pagination?.total || items.length,
          pending: items.filter((a) => a.status === 'SUBMITTED' || a.status === 'PENDING_VERIFICATION').length,
          approved: items.filter((a) => a.status === 'APPROVED').length,
          rejected: items.filter((a) => a.status === 'REJECTED' || a.status === 'BANNED').length,
        });
      }
    } catch {
      // ignore
    }
  };

  const fetchApplications = async () => {
    try {
      setLoading(true);
      const params: any = {
        page,
        limit: pageSize,
      };
      if (statusFilter !== 'ALL') {
        params.status = statusFilter;
      }
      if (searchTerm.trim()) {
        params.search = searchTerm.trim();
      }

      const res = await apiClient.get('/admin/sellers/applications', { params });
      if (res.data.success) {
        setApplications(res.data.data.items || []);
        if (res.data.data.pagination) {
          setTotalCount(res.data.data.pagination.total || 0);
        } else {
          setTotalCount(res.data.data.items?.length || 0);
        }
      }
    } catch (err) {
      console.error('Failed to load seller applications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  useEffect(() => {
    fetchApplications();
  }, [statusFilter, searchTerm, page, pageSize]);

  // Server-side reusable pagination
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

  const totalCountDisplay = metrics.total || totalCount;
  const pendingCount = metrics.pending;
  const approvedCount = metrics.approved;
  const rejectedCount = metrics.rejected;
  const columns: ColumnDef<ApplicationItem>[] = [
    {
      header: 'Seller Entity',
      cell: ({ row: app }) => (
        <div>
          <span className="font-bold text-slate-900 block">{app.businessName}</span>
          <span className="text-[11px] text-[#635BFF] font-semibold block">{app.sellerName}</span>
          <span className="text-[10px] font-mono text-slate-400 block">{app.sellerCode}</span>
        </div>
      ),
    },
    {
      header: 'Primary Category',
      cell: ({ row: app }) => (
        <span className="font-semibold text-slate-700">{app.categoryName}</span>
      ),
    },
    {
      header: 'Contact Details',
      cell: ({ row: app }) => (
        <div>
          <span className="text-slate-700 font-medium block">{app.email}</span>
          <span className="text-[11px] font-mono text-slate-400 block">{app.phoneNumber}</span>
        </div>
      ),
    },
    {
      header: 'KYC Compliance',
      cell: ({ row: app }) => (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 font-mono font-bold text-slate-700">
          {app.verifiedDocumentCount}/{app.documentCount} Verified
        </span>
      ),
    },
    {
      header: 'Submitted',
      cell: ({ row: app }) => (
        <span className="text-slate-500 font-medium">
          {app.submittedAt ? new Date(app.submittedAt).toLocaleDateString() : 'Draft'}
        </span>
      ),
    },
    {
      header: 'Status',
      cell: ({ row: app }) => (
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
      ),
    },
    {
      header: 'Action',
      align: 'right',
      cell: ({ row: app }) => (
        <button
          onClick={() => setSelectedAppId(app.applicationId)}
          className="px-3.5 py-1.5 rounded-xl bg-[#635BFF] hover:bg-[#5249FF] text-white font-bold inline-flex items-center gap-1 shadow-sm shadow-indigo-500/20 transition-all cursor-pointer"
        >
          <Eye className="w-3.5 h-3.5" /> Inspect
        </button>
      ),
    },
  ];

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
                onClick={() => {
                  setStatusFilter(st);
                  setPage(1);
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  statusFilter === st
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {st === 'ALL'
                  ? `All Submitted (${totalCountDisplay})`
                  : st === 'SUBMITTED'
                  ? `Pending Review (${pendingCount})`
                  : st === 'APPROVED'
                  ? `Approved (${approvedCount})`
                  : `Rejected (${rejectedCount})`}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <SearchBar
            value={searchTerm}
            onChange={(val) => {
              setSearchTerm(val);
              setPage(1);
            }}
            placeholder="Search by brand, legal name, code..."
            isLoading={loading}
            className="w-full sm:w-72"
          />
        </div>

        {/* Reusable Data Table with row & column separation, zebra striping, sticky header, and vertical scroll */}
        <DataTable<ApplicationItem>
          columns={columns}
          data={applications}
          keyExtractor={(app) => app.applicationId}
          loading={loading}
          bordered={true}
          striped={true}
          maxHeight="600px"
          containerClassName="rounded-2xl border border-slate-200"
          emptyTitle="No Applications Found"
          emptyDescription="No onboarding applications match the selected filter criteria."
          pagination={{ ...pagination.paginationProps, itemLabel: 'applications' }}
        />

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
