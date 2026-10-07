import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Clock,
  ShieldCheck,
  AlertCircle,
  XCircle,
  FileText,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  Calendar,
  FileCheck2,
  PlusCircle,
  X,
} from 'lucide-react';
import { apiClient } from '../../lib/axios.js';
import { DocumentPreviewModal } from '../../components/common/DocumentPreviewModal.js';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  TableSkeleton,
} from '../../components/common/Table';

interface CategoryOption {
  categoryId: number;
  categoryName: string;
  categoryCode?: string;
  isLeaf?: boolean;
}

interface CategoryDocRequirement {
  categoryDocumentId: number;
  categoryId: number;
  documentTypeId: number;
  code: string;
  displayName: string;
  isMandatory: boolean;
  status: string;
  isInherited: boolean;
  inheritedFrom?: {
    categoryId: number;
    categoryName: string;
    categoryCode?: string;
  };
}

interface DocumentItem {
  documentId: number;
  code: string;
  displayName: string;
  certificateNumber?: string;
  documentUrl?: string;
  verificationStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason?: string;
  isMandatory: boolean;
}

interface StatusHistoryItem {
  historyId: number;
  status: string;
  comments?: string;
  createdAt: string;
  changedBy: string;
}

interface CategoryApplicationItem {
  applicationId: number;
  categoryId: number;
  categoryName: string;
  categoryCode?: string;
  status: 'DRAFT' | 'SUBMITTED' | 'PENDING' | 'APPROVED' | 'REJECTED';
  submittedAt?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  documents: DocumentItem[];
}

interface OnboardingStatusData {
  hasProfile: boolean;
  status: string;
  isMerchantActive: boolean;
  isSentBack: boolean;
  seller?: {
    sellerId: number;
    sellerCode: string;
    sellerName: string;
    businessName: string;
    email: string;
    phoneNumber: string;
    instagramUrl?: string;
    facebookUrl?: string;
    status: string;
  } | null;
  application?: {
    applicationId: number;
    categoryId: number;
    categoryName: string;
    status: string;
    submittedAt?: string;
    reviewedAt?: string;
    rejectionReason?: string;
  } | null;
  applications?: CategoryApplicationItem[];
  activeCategories?: Array<{ categoryId: number; categoryName: string; categoryCode?: string; approvedAt?: string }>;
  pendingCategories?: Array<{ categoryId: number; categoryName: string; categoryCode?: string; submittedAt?: string }>;
  documents: DocumentItem[];
  statusHistory?: StatusHistoryItem[];
}

export const ApplicationStatusPage: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<OnboardingStatusData | null>(null);
  const [selectedAppId, setSelectedAppId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Apply for New Category Modal State
  const [isApplyModalOpen, setIsApplyModalOpen] = useState<boolean>(false);
  const [categoriesList, setCategoriesList] = useState<CategoryOption[]>([]);
  const [loadingCategories, setLoadingCategories] = useState<boolean>(false);
  const [selectedApplyCatId, setSelectedApplyCatId] = useState<number | null>(null);
  const [categoryDocs, setCategoryDocs] = useState<CategoryDocRequirement[]>([]);
  const [loadingDocs, setLoadingDocs] = useState<boolean>(false);
  const [applyRemarks, setApplyRemarks] = useState<string>('');
  const [isSubmittingApply, setIsSubmittingApply] = useState<boolean>(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applySuccessAlert, setApplySuccessAlert] = useState<string | null>(null);

  // In-page Document preview overlay
  const [previewModalDoc, setPreviewModalDoc] = useState<{ url: string; title: string; code?: string } | null>(null);

  const handleOpenApplyModal = async () => {
    setIsApplyModalOpen(true);
    setApplyError(null);
    setApplyRemarks('');

    if (categoriesList.length === 0) {
      setLoadingCategories(true);
      try {
        const res = await apiClient.get('/categories');
        if (res.data.success && Array.isArray(res.data.data)) {
          const list: CategoryOption[] = res.data.data
            .map((c: any) => ({
              categoryId: Number(c.categoryId ?? c.CategoryID),
              categoryName: String(c.categoryName ?? c.CategoryName),
              categoryCode: c.categoryCode ?? c.CategoryCode,
              isLeaf: Boolean(c.isLeaf),
            }))
            .sort((a: CategoryOption, b: CategoryOption) => a.categoryName.localeCompare(b.categoryName));
          setCategoriesList(list);

          const appliedCatIds = new Set(
            (data?.applications || [])
              .filter((a) => a.status === 'APPROVED' || a.status === 'SUBMITTED' || a.status === 'PENDING')
              .map((a) => a.categoryId)
          );
          const firstCandidate = list.find((c) => !appliedCatIds.has(c.categoryId));
          if (firstCandidate) {
            setSelectedApplyCatId(firstCandidate.categoryId);
          }
        }
      } catch (err: any) {
        setApplyError(err.response?.data?.error?.message || 'Failed to load available categories');
      } finally {
        setLoadingCategories(false);
      }
    } else {
      const appliedCatIds = new Set(
        (data?.applications || [])
          .filter((a) => a.status === 'APPROVED' || a.status === 'SUBMITTED' || a.status === 'PENDING')
          .map((a) => a.categoryId)
      );
      const firstCandidate = categoriesList.find((c) => !appliedCatIds.has(c.categoryId));
      if (firstCandidate) {
        setSelectedApplyCatId(firstCandidate.categoryId);
      }
    }
  };

  // Dynamic fetch of category compliance documents whenever selected category changes
  useEffect(() => {
    if (!selectedApplyCatId || !isApplyModalOpen) {
      setCategoryDocs([]);
      return;
    }

    setLoadingDocs(true);
    setApplyError(null);

    apiClient
      .get(`/categories/${selectedApplyCatId}/documents`)
      .then((res) => {
        if (res.data.success && Array.isArray(res.data.data)) {
          setCategoryDocs(res.data.data);
        } else {
          setCategoryDocs([]);
        }
      })
      .catch((err) => {
        console.error('Failed to load category documents:', err);
        setCategoryDocs([]);
      })
      .finally(() => {
        setLoadingDocs(false);
      });
  }, [selectedApplyCatId, isApplyModalOpen]);

  const handleSubmitApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApplyCatId) return;

    setIsSubmittingApply(true);
    setApplyError(null);

    const chosenCat = categoriesList.find((c) => c.categoryId === selectedApplyCatId);

    try {
      const res = await apiClient.post(
        `/seller/catalog/categories/${selectedApplyCatId}/apply`,
        {
          remarks: applyRemarks.trim() || undefined,
        }
      );

      const successMsg =
        res.data?.message ||
        `Application for "${chosenCat?.categoryName || 'Category'}" submitted successfully. Marketplace QC team will review your authorization.`;
      setApplySuccessAlert(successMsg);
      setIsApplyModalOpen(false);
      setApplyRemarks('');

      await fetchStatus(true);
      if (res.data?.data?.applicationId) {
        setSelectedAppId(Number(res.data.data.applicationId));
      }
    } catch (err: any) {
      setApplyError(
        err.response?.data?.error?.message || 'Failed to submit category authorization request'
      );
    } finally {
      setIsSubmittingApply(false);
    }
  };

  const fetchStatus = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      setError(null);
      const res = await apiClient.get('/seller/onboarding/status');
      const responseData = res.data.data;
      setData(responseData);
      if (!selectedAppId) {
        // Default to approved application or first application
        const defaultApp =
          responseData.applications?.find((a: any) => a.status === 'APPROVED') ||
          responseData.application ||
          responseData.applications?.[0];
        if (defaultApp) {
          setSelectedAppId(defaultApp.applicationId);
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load application status');
    } finally {
      setLoading(false);
      if (isRefresh) setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[450px]">
        <div className="w-10 h-10 border-4 border-[#7E2532] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs font-bold text-stone-500 uppercase tracking-wider">
          Fetching application status...
        </p>
      </div>
    );
  }

  const isMerchantActive = data?.isMerchantActive || data?.seller?.status === 'ACTIVE';
  
  // Resolve currently active or selected category application
  const selectedCategoryApp = data?.applications?.find((a) => a.applicationId === selectedAppId);
  const selectedApp = selectedCategoryApp || data?.application || null;

  const appStatus = selectedApp?.status || (isMerchantActive ? 'APPROVED' : data?.status === 'ACTIVE' ? 'APPROVED' : 'DRAFT');
  const isPending = appStatus === 'SUBMITTED' || appStatus === 'PENDING' || (!isMerchantActive && data?.status === 'PENDING_VERIFICATION');
  const isApproved = appStatus === 'APPROVED' || (isMerchantActive && !selectedApp);
  const isRejected = appStatus === 'REJECTED';
  const isDraft = !isPending && !isApproved && !isRejected;

  // Selected application documents, falling back to all documents
  const activeDocs: DocumentItem[] =
    selectedCategoryApp?.documents && selectedCategoryApp.documents.length > 0
      ? selectedCategoryApp.documents
      : data?.documents || [];
  const rejectedDocsCount = activeDocs.filter((d: DocumentItem) => d.verificationStatus === 'REJECTED').length;
  const approvedDocsCount = activeDocs.filter((d: DocumentItem) => d.verificationStatus === 'APPROVED').length;
  const totalDocsCount = activeDocs.length;

  // Milestone progression calculation for the selected category application
  const milestones = [
    {
      title: 'Seller Registration',
      description: isMerchantActive ? 'Company KYC & Legal Entity Verified' : data?.hasProfile ? `${data.seller?.businessName}` : 'Incomplete business details',
      status: isMerchantActive || data?.hasProfile ? 'COMPLETED' : 'CURRENT',
    },
    {
      title: 'Compliance Proofs',
      description:
        totalDocsCount > 0
          ? `${totalDocsCount} regulatory proof(s) submitted`
          : 'Pending document upload',
      status: totalDocsCount > 0 ? 'COMPLETED' : 'CURRENT',
    },
    {
      title: 'Compliance Review',
      description: isApproved
        ? 'Category authorization signed off'
        : isPending
        ? 'Under operations team review'
        : isRejected
        ? 'Application requires revision'
        : 'Awaiting submission',
      status: isApproved
        ? 'COMPLETED'
        : isRejected
        ? 'ATTENTION'
        : isPending
        ? 'IN_PROGRESS'
        : 'PENDING',
    },
    {
      title: 'Catalog Activation',
      description: isApproved
        ? 'Authorized to list in this category'
        : 'Listing unlocked upon verification',
      status: isApproved ? 'COMPLETED' : 'PENDING',
    },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-16">
      {/* Top Header & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[#7E2532] text-xs font-bold uppercase tracking-wider mb-1">
            <FileCheck2 className="w-4 h-4" />
            Compliance & Verification Tracker
          </div>
          <h1 className="text-3xl font-black text-stone-900 tracking-tight">
            Application Status
          </h1>
          <p className="text-sm text-stone-500 mt-1 font-medium">
            Monitor real-time verification progress, inspector remarks, and compliance status.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchStatus(true)}
            disabled={refreshing}
            className="px-4 py-2.5 rounded-2xl bg-white border border-[#ECE5DC] text-stone-700 text-xs font-bold hover:bg-stone-50 transition-all flex items-center gap-2 shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-[#7E2532]' : ''}`} />
            Refresh
          </button>
          {(isDraft || isRejected || rejectedDocsCount > 0) && (
            <Link
              to="/onboarding"
              className="px-4 py-2.5 rounded-2xl bg-[#641D26] hover:bg-[#52161E] text-white text-xs font-bold transition-all shadow-sm flex items-center gap-2"
            >
              Update Onboarding
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      </div>

      {applySuccessAlert && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{applySuccessAlert}</span>
          </div>
          <button
            type="button"
            onClick={() => setApplySuccessAlert(null)}
            className="text-emerald-600 hover:text-emerald-800 p-1 rounded-lg hover:bg-emerald-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Hero Status Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#ECE5DC] shadow-[0_8px_30px_rgba(70,20,27,0.035)] relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-stone-100">
          <div className="flex items-start gap-4">
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${
                isApproved
                  ? 'bg-emerald-100 text-emerald-700'
                  : isPending
                  ? 'bg-amber-100 text-amber-700'
                  : isRejected
                  ? 'bg-rose-100 text-rose-700'
                  : 'bg-stone-100 text-stone-700'
              }`}
            >
              {isApproved && <ShieldCheck className="w-8 h-8" />}
              {isPending && <Clock className="w-8 h-8" />}
              {isRejected && <XCircle className="w-8 h-8" />}
              {isDraft && <AlertCircle className="w-8 h-8" />}
            </div>

            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-stone-100 text-stone-700">
                  {selectedApp?.applicationId
                    ? `APP-${String(selectedApp.applicationId).padStart(4, '0')}`
                    : data?.application?.applicationId
                    ? `APP-${String(data.application.applicationId).padStart(4, '0')}`
                    : 'KYC VERIFICATION'}
                </span>
                <span
                  className={`text-xs font-black uppercase px-3 py-1 rounded-full border ${
                    isApproved
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : isPending
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : isRejected
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : 'bg-stone-100 text-stone-700 border-stone-200'
                  }`}
                >
                  {isApproved
                    ? 'Authorized & Active'
                    : isPending
                    ? 'Category Review In Progress'
                    : isRejected
                    ? 'Correction Required'
                    : 'Draft / Incomplete'}
                </span>
                {isMerchantActive && (
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                    Verified Seller Entity
                  </span>
                )}
              </div>

              <h2 className="text-xl font-black text-stone-900 mt-2">
                {data?.seller?.businessName || 'Business Entity Registration'}
              </h2>
              <p className="text-xs text-stone-500 mt-0.5 flex items-center gap-2 flex-wrap">
                <span>Code: <strong className="text-stone-700">{data?.seller?.sellerCode || 'N/A'}</strong></span>
                <span>•</span>
                <span>Selected Category: <strong className="text-[#641D26]">{selectedApp?.categoryName || data?.application?.categoryName || 'General Marketplace'}</strong></span>
              </p>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-3 self-start md:self-auto">
            <div className="px-4 py-3 rounded-2xl bg-[#F3EFEA] border border-[#ECE5DC] text-center min-w-[100px]">
              <span className="text-[10px] uppercase tracking-wider font-bold text-stone-500 block">
                Category Docs
              </span>
              <span className="text-lg font-black text-emerald-700 block mt-0.5">
                {approvedDocsCount} / {totalDocsCount}
              </span>
            </div>
            <div className="px-4 py-3 rounded-2xl bg-[#F3EFEA] border border-[#ECE5DC] text-center min-w-[100px]">
              <span className="text-[10px] uppercase tracking-wider font-bold text-stone-500 block">
                Turnaround
              </span>
              <span className="text-sm font-black text-stone-800 block mt-1">
                {isApproved ? 'Approved' : '24-48 Hrs'}
              </span>
            </div>
          </div>
        </div>

        {/* Rejection / Correction Banner */}
        {selectedApp?.rejectionReason && (
          <div className="mt-6 p-4 rounded-2xl bg-rose-50/90 border border-rose-200 flex items-start gap-3 text-rose-900">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-xs">
              <span className="font-bold block text-rose-800 uppercase tracking-wider text-[10px]">
                Compliance Team Feedback:
              </span>
              <p className="mt-1 leading-relaxed font-semibold italic text-rose-950">
                "{selectedApp.rejectionReason}"
              </p>
              <p className="mt-2 text-rose-700 font-medium">
                Please visit the{' '}
                <Link to="/onboarding" className="font-bold underline hover:text-rose-900">
                  Seller Onboarding Wizard
                </Link>{' '}
                to correct and resubmit the requested credentials.
              </p>
            </div>
          </div>
        )}

        {/* Metadata Details Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6 text-xs">
          <div>
            <span className="text-stone-400 font-semibold block uppercase text-[10px]">
              Application Submitted
            </span>
            <span className="text-stone-800 font-bold block mt-1">
              {selectedApp?.submittedAt || data?.application?.submittedAt
                ? new Date(selectedApp?.submittedAt || data?.application?.submittedAt || '').toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : 'Not submitted'}
            </span>
          </div>

          <div>
            <span className="text-stone-400 font-semibold block uppercase text-[10px]">
              Last Inspection
            </span>
            <span className="text-stone-800 font-bold block mt-1">
              {selectedApp?.reviewedAt || data?.application?.reviewedAt
                ? new Date(selectedApp?.reviewedAt || data?.application?.reviewedAt || '').toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : isPending
                ? 'Queue (Awaiting QC)'
                : 'Pending'}
            </span>
          </div>

          <div>
            <span className="text-stone-400 font-semibold block uppercase text-[10px]">
              Primary Contact
            </span>
            <span className="text-stone-800 font-bold block mt-1 truncate">
              {data?.seller?.email || 'N/A'}
            </span>
          </div>

          <div>
            <span className="text-stone-400 font-semibold block uppercase text-[10px]">
              Seller Status
            </span>
            <span className="text-stone-800 font-bold block mt-1">
              {data?.seller?.status || 'DRAFT'}
            </span>
          </div>
        </div>
      </div>

      {/* ── Category Authorizations & Expansion Section ── */}
      {data?.applications && data.applications.length > 0 && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#ECE5DC] shadow-[0_8px_30px_rgba(70,20,27,0.035)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <span className="text-[#7E2532] text-xs font-bold uppercase tracking-wider block">
                Category Access
              </span>
              <h3 className="text-lg font-black text-stone-900 mt-0.5">
                Category Authorizations & Expansion
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Select a category to inspect compliance requirements and verification progress.
              </p>
            </div>

            <button
              type="button"
              onClick={handleOpenApplyModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#641D26] hover:bg-[#52161E] text-white text-xs font-bold transition-all shadow-sm self-start sm:self-auto cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Apply for New Category</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.applications.map((app) => {
              const isSelected = selectedApp?.applicationId === app.applicationId;
              const isAppApproved = app.status === 'APPROVED';
              const isAppPending = app.status === 'SUBMITTED' || app.status === 'PENDING';
              const isAppRejected = app.status === 'REJECTED';

              return (
                <div
                  key={app.applicationId}
                  onClick={() => setSelectedAppId(app.applicationId)}
                  className={`p-5 rounded-2xl border cursor-pointer transition-all duration-200 relative ${
                    isSelected
                      ? 'bg-gradient-to-r from-[#FDF5F6] to-[#FAF8F5] border-[#7E2532] shadow-md ring-2 ring-[#7E2532]/20'
                      : 'bg-[#FAF8F5]/80 hover:bg-[#F3EFEA] border-[#ECE5DC]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-xs font-mono font-bold text-stone-400">
                      APP-{String(app.applicationId).padStart(4, '0')}
                    </span>
                    <span
                      className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${
                        isAppApproved
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : isAppPending
                          ? 'bg-amber-100 text-amber-800 border-amber-300'
                          : isAppRejected
                          ? 'bg-rose-100 text-rose-800 border-rose-300'
                          : 'bg-stone-100 text-stone-600 border-stone-200'
                      }`}
                    >
                      {isAppApproved ? 'Approved' : isAppPending ? 'Under Review' : isAppRejected ? 'Action Needed' : 'Draft'}
                    </span>
                  </div>

                  <h4 className="text-sm font-black text-stone-900 line-clamp-1">{app.categoryName}</h4>
                  <p className="text-[11px] text-stone-500 mt-1">
                    {app.submittedAt
                      ? `Submitted on ${new Date(app.submittedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
                      : 'Not submitted yet'}
                  </p>

                  <div className="mt-3 pt-3 border-t border-stone-200/60 flex items-center justify-between text-[11px] font-semibold text-stone-600">
                    <span>{app.documents.length} Document(s)</span>
                    {isSelected ? (
                      <span className="text-[#7E2532] font-black text-[11px] flex items-center gap-1">
                        Viewing <ArrowRight className="w-3 h-3" />
                      </span>
                    ) : (
                      <span className="text-stone-400 group-hover:text-stone-600">Click to view</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Visual Milestone Progression Tracker */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#ECE5DC] shadow-[0_8px_30px_rgba(70,20,27,0.035)]">
        <div className="flex items-center justify-between mb-6">
          <div>
            <span className="text-[#7E2532] text-xs font-bold uppercase tracking-wider block">
              Lifecycle Milestones
            </span>
            <h3 className="text-lg font-black text-stone-900 mt-0.5">
              Verification Roadmap
            </h3>
          </div>
          <span className="text-xs font-bold text-stone-500">
            Phase 4 Operations
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
          {milestones.map((m, idx) => {
            const isDone = m.status === 'COMPLETED';
            const isCurr = m.status === 'CURRENT' || m.status === 'IN_PROGRESS';
            const isWarn = m.status === 'ATTENTION';

            return (
              <div
                key={idx}
                className={`p-5 rounded-2xl border transition-all ${
                  isDone
                    ? 'bg-emerald-50/50 border-emerald-200'
                    : isWarn
                    ? 'bg-rose-50/50 border-rose-200'
                    : isCurr
                    ? 'bg-amber-50/50 border-amber-200 shadow-sm'
                    : 'bg-[#F3EFEA]/60 border-[#ECE5DC]'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-black text-stone-400 uppercase tracking-wider">
                    0{idx + 1}
                  </span>
                  {isDone && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                  {isCurr && <Clock className="w-5 h-5 text-amber-600 animate-pulse" />}
                  {isWarn && <AlertCircle className="w-5 h-5 text-rose-600" />}
                  {!isDone && !isCurr && !isWarn && (
                    <div className="w-3 h-3 rounded-full bg-stone-300" />
                  )}
                </div>

                <h4 className="text-sm font-black text-stone-900">{m.title}</h4>
                <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                  {m.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Document Verification Breakdown */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#ECE5DC] shadow-[0_8px_30px_rgba(70,20,27,0.035)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <span className="text-[#7E2532] text-xs font-bold uppercase tracking-wider block">
              Document Verification
            </span>
            <h3 className="text-lg font-black text-stone-900 mt-0.5">
              Compliance Documents Breakdown
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Itemized review status of mandatory tax and identity credentials.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {approvedDocsCount} Approved
            </span>
            {rejectedDocsCount > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                {rejectedDocsCount} Action Required
              </span>
            )}
          </div>
        </div>

        {activeDocs && activeDocs.length > 0 ? (
          <TableContainer>
            <Table>
              <TableHeader>
                <tr>
                  <TableHead>Document Type</TableHead>
                  <TableHead>Document Code</TableHead>
                  <TableHead align="center">Requirement</TableHead>
                  <TableHead>Certificate / ID #</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reviewer Remarks</TableHead>
                  <TableHead align="right">Actions</TableHead>
                </tr>
              </TableHeader>
              <TableBody>
                {activeDocs.map((doc: DocumentItem) => {
                  const isDocApproved = doc.verificationStatus === 'APPROVED';
                  const isDocRejected = doc.verificationStatus === 'REJECTED';
                  const isDocPending = doc.verificationStatus === 'PENDING';

                  return (
                    <TableRow key={doc.documentId}>
                      {/* Document Type Name */}
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-[#F3EFEA] border border-[#ECE5DC] flex items-center justify-center text-[#7E2532] shrink-0">
                            <FileText className="w-4 h-4" />
                          </div>
                          <span className="font-bold text-stone-900 block text-xs">
                            {doc.displayName}
                          </span>
                        </div>
                      </TableCell>

                      {/* Dedicated Document Code Column */}
                      <TableCell>
                        <span className="font-mono text-[11px] text-stone-700 bg-[#FAF7F3] border border-[#ECE5DC] px-2 py-0.5 rounded-md font-bold tracking-tight inline-block">
                          {doc.code}
                        </span>
                      </TableCell>

                      {/* Requirement (Mandatory vs Optional) */}
                      <TableCell align="center">
                        {doc.isMandatory ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-50 text-rose-800 border border-rose-200">
                            Mandatory
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-stone-100 text-stone-500">
                            Optional
                          </span>
                        )}
                      </TableCell>

                      {/* Certificate / ID Number */}
                      <TableCell>
                        <span className="font-mono text-stone-800 font-bold bg-[#FAF7F3] border border-stone-200/60 px-2 py-0.5 rounded text-[11px]">
                          {doc.certificateNumber || 'Not specified'}
                        </span>
                      </TableCell>

                      {/* Status */}
                      <TableCell>
                        <span
                          className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase px-2.5 py-1 rounded-full border ${
                            isDocApproved
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : isDocRejected
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          {isDocApproved && <ShieldCheck className="w-3.5 h-3.5" />}
                          {isDocPending && <Clock className="w-3.5 h-3.5" />}
                          {isDocRejected && <XCircle className="w-3.5 h-3.5" />}
                          {doc.verificationStatus}
                        </span>
                      </TableCell>

                      {/* Reviewer Remarks */}
                      <TableCell>
                        <div className="max-w-xs leading-relaxed">
                          {doc.rejectionReason ? (
                            <span className="text-rose-700 font-semibold block text-xs">
                              {doc.rejectionReason}
                            </span>
                          ) : isDocApproved ? (
                            <span className="text-emerald-700 text-[11px] font-semibold">
                              Verified & securely locked
                            </span>
                          ) : (
                            <span className="text-stone-400 italic text-[11px]">
                              Pending inspection
                            </span>
                          )}
                        </div>
                      </TableCell>

                      {/* Actions */}
                      <TableCell align="right">
                        {doc.documentUrl ? (
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewModalDoc({
                                url: doc.documentUrl!,
                                title: doc.displayName,
                                code: doc.code,
                              })
                            }
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold text-[#7E2532] hover:bg-burgundy-50 border border-transparent hover:border-burgundy-200 transition-all cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>View Document</span>
                          </button>
                        ) : (
                          <span className="text-stone-400 text-xs italic">No file uploaded</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <div className="text-center py-10 bg-[#F3EFEA]/50 rounded-2xl border border-dashed border-[#ECE5DC]">
            <FileText className="w-8 h-8 text-stone-300 mx-auto mb-2" />
            <p className="text-xs font-bold text-stone-600">No documents submitted yet</p>
            <p className="text-[11px] text-stone-400 mt-0.5">
              Complete your profile and upload credentials in the onboarding wizard.
            </p>
            <Link
              to="/onboarding"
              className="inline-flex items-center gap-1.5 mt-3 text-xs font-bold text-[#7E2532] hover:underline"
            >
              Start Onboarding <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        )}
      </div>

      {/* Audit Log / Status History (if available) */}
      {data?.statusHistory && data.statusHistory.length > 0 && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#ECE5DC] shadow-[0_8px_30px_rgba(70,20,27,0.035)]">
          <div className="flex items-center justify-between mb-6">
            <div>
              <span className="text-[#7E2532] text-xs font-bold uppercase tracking-wider block">
                Audit Trail
              </span>
              <h3 className="text-lg font-black text-stone-900 mt-0.5">
                Application Activity History
              </h3>
            </div>
            <span className="text-xs font-bold text-stone-400">
              {data.statusHistory.length} Logged Events
            </span>
          </div>

          <div className="space-y-4">
            {data.statusHistory.map((item) => (
              <div
                key={item.historyId}
                className="flex items-start gap-4 p-4 rounded-2xl bg-[#F3EFEA]/60 border border-[#ECE5DC] text-xs"
              >
                <div className="w-8 h-8 rounded-xl bg-white border border-[#ECE5DC] flex items-center justify-center text-stone-700 shrink-0 mt-0.5">
                  <Calendar className="w-4 h-4 text-[#7E2532]" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="font-bold text-stone-900 uppercase">
                      Status changed to <strong className="text-[#7E2532]">{item.status}</strong>
                    </span>
                    <span className="text-stone-400 text-[11px]">
                      {new Date(item.createdAt).toLocaleString()}
                    </span>
                  </div>
                  {item.comments && (
                    <p className="text-stone-600 mt-1 italic leading-relaxed">
                      "{item.comments}"
                    </p>
                  )}
                  <span className="text-[10px] text-stone-400 font-bold block mt-1">
                    Logged by: {item.changedBy}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom CTA Banner */}
      <div className="bg-gradient-to-r from-[#641D26] to-[#7E2532] rounded-3xl p-6 sm:p-8 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-6 shadow-lg shadow-[#641D26]/20">
        <div>
          <h3 className="text-xl font-black">
            {isApproved
              ? 'Your Seller Account is Active & Verified'
              : isRejected || rejectedDocsCount > 0
              ? 'Need to Correct Your Documents?'
              : 'Application Under Active Review'}
          </h3>
          <p className="text-xs text-stone-200/90 mt-1 max-w-xl leading-relaxed">
            {isApproved
              ? 'You have complete seller selling privileges. Browse the product catalog, assign your prices, and dispatch inventory to fulfillment warehouses.'
              : isRejected || rejectedDocsCount > 0
              ? 'Our compliance team flagged some items in your documents. You can edit and re-upload only the rejected documents without restarting.'
              : 'Our operations team is currently reviewing your registration documents. We maintain strict compliance checks to protect marketplace buyers.'}
          </p>
        </div>

        <div className="shrink-0">
          {isApproved ? (
            <Link
              to="/products"
              className="px-6 py-3 rounded-2xl bg-white text-[#641D26] text-xs font-black hover:bg-stone-100 transition-all shadow flex items-center gap-2"
            >
              Go to Products
              <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <Link
              to="/onboarding"
              className="px-6 py-3 rounded-2xl bg-white text-[#641D26] text-xs font-black hover:bg-stone-100 transition-all shadow flex items-center gap-2"
            >
              Open Onboarding Wizard
              <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      </div>

      {/* ── Category Authorization Modal ── */}
      {isApplyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-xl w-full border border-[#ECE5DC] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-stone-100 flex items-center justify-between bg-gradient-to-r from-[#FAF8F5] to-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#FDF5F6] border border-[#7E2532]/20 flex items-center justify-center text-[#7E2532]">
                  <PlusCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-stone-900">
                    Apply for Category Authorization
                  </h3>
                  <p className="text-xs text-stone-500 font-medium">
                    Expand your catalog into new categories & regulatory sectors.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsApplyModalOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-stone-100 flex items-center justify-center text-stone-400 hover:text-stone-700 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitApply} className="p-6 space-y-5 overflow-y-auto flex-1">
              {applyError && (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{applyError}</span>
                </div>
              )}

              {/* Category Dropdown */}
              <div>
                <label className="block text-xs font-black uppercase text-stone-600 tracking-wider mb-1.5">
                  Select Category to Authorize <span className="text-[#7E2532]">*</span>
                </label>
                {loadingCategories ? (
                  <div className="flex items-center gap-2 text-xs font-bold text-stone-500 py-3 px-4 bg-[#FAF8F5] rounded-2xl border border-[#ECE5DC]">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#7E2532]" />
                    <span>Loading available categories...</span>
                  </div>
                ) : (
                  <select
                    value={selectedApplyCatId ?? ''}
                    onChange={(e) => setSelectedApplyCatId(Number(e.target.value))}
                    className="w-full px-4 py-3 rounded-2xl border border-[#ECE5DC] bg-[#FAF8F5] text-stone-800 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#7E2532]/20 focus:border-[#7E2532] transition-all cursor-pointer"
                    required
                  >
                    <option value="" disabled>-- Select a category to expand into --</option>
                    {categoriesList.map((cat) => {
                      const alreadyApplied = (data?.applications || []).some(
                        (a) => a.categoryId === cat.categoryId && (a.status === 'APPROVED' || a.status === 'SUBMITTED' || a.status === 'PENDING')
                      );
                      return (
                        <option
                          key={cat.categoryId}
                          value={cat.categoryId}
                          disabled={alreadyApplied}
                        >
                          {cat.categoryName} {cat.categoryCode ? `(${cat.categoryCode})` : ''} {alreadyApplied ? '• Already Authorized / Under Review' : ''}
                        </option>
                      );
                    })}
                  </select>
                )}
                <p className="text-[11px] text-stone-400 mt-1 font-medium">
                  Categories already authorized or currently pending inspection are disabled.
                </p>
              </div>

              {/* Dynamic Category Regulatory Requirements */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black uppercase text-stone-600 tracking-wider">
                    Regulatory & Compliance Requirements
                  </span>
                  <span className="text-[10px] font-bold text-[#7E2532] bg-[#FDF5F6] px-2 py-0.5 rounded-md border border-[#7E2532]/20 uppercase">
                    Dynamically Resolved
                  </span>
                </div>

                {loadingDocs ? (
                  <div className="p-5 rounded-2xl border border-dashed border-[#ECE5DC] bg-[#FAF8F5] flex items-center justify-center gap-2 text-stone-500 text-xs font-bold">
                    <RefreshCw className="w-4 h-4 animate-spin text-[#7E2532]" />
                    <span>Fetching compliance documents from category hierarchy...</span>
                  </div>
                ) : categoryDocs.length > 0 ? (
                  <div className="space-y-2.5">
                    <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-2xl text-[11px] text-amber-800 font-medium flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <span>
                        This sector mandates <strong>{categoryDocs.length} compliance document(s)</strong>.
                        Marketplace operations will inspect valid credentials before granting listing access.
                      </span>
                    </div>

                    <div className="divide-y divide-stone-100 border border-[#ECE5DC] rounded-2xl overflow-hidden bg-white shadow-sm">
                      {categoryDocs.map((doc) => (
                        <div key={doc.categoryDocumentId || doc.documentTypeId} className="p-3.5 flex items-start justify-between gap-3 hover:bg-[#FAF8F5]/60 transition-colors">
                          <div className="flex items-start gap-2.5">
                            <div className="w-7 h-7 rounded-xl bg-[#FAF8F5] border border-[#ECE5DC] flex items-center justify-center text-[#7E2532] shrink-0 mt-0.5">
                              <FileCheck2 className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <h5 className="text-xs font-bold text-stone-900 leading-tight">
                                {doc.displayName}
                              </h5>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="font-mono text-[10px] font-bold text-stone-500 uppercase bg-stone-100 px-1.5 py-0.5 rounded">
                                  {doc.code}
                                </span>
                                {doc.isInherited && doc.inheritedFrom && (
                                  <span className="text-[10px] text-stone-500 font-medium">
                                    Inherited from {doc.inheritedFrom.categoryName}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="shrink-0 flex items-center gap-1.5">
                            <span
                              className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                                doc.isMandatory
                                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                                  : 'bg-stone-50 text-stone-600 border-stone-200'
                              }`}
                            >
                              {doc.isMandatory ? 'Mandatory' : 'Optional'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : selectedApplyCatId ? (
                  <div className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/60 flex items-start gap-3 text-xs">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <h5 className="font-black text-emerald-900">Standard Verification Sufficient</h5>
                      <p className="text-[11px] text-emerald-700 mt-0.5 leading-relaxed font-medium">
                        No additional category-specific licenses or statutory permits required for this sector. Your verified seller credentials cover listing permissions.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-5 rounded-2xl border border-dashed border-[#ECE5DC] text-center text-xs text-stone-400 font-medium">
                    Select a category above to inspect its dynamic compliance requirements.
                  </div>
                )}
              </div>

              {/* Justification / Remarks */}
              <div>
                <label className="block text-xs font-black uppercase text-stone-600 tracking-wider mb-1.5">
                  Business Justification & Remarks (Optional)
                </label>
                <textarea
                  value={applyRemarks}
                  onChange={(e) => setApplyRemarks(e.target.value)}
                  placeholder="Provide authorization context (e.g., Authorized distributor, brand owner, or manufacturer license details)..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-2xl border border-[#ECE5DC] bg-[#FAF8F5] text-stone-800 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#7E2532]/20 focus:border-[#7E2532] transition-all"
                />
                <p className="text-[10px] text-stone-400 mt-1 font-medium">
                  Remarks will be logged in your application audit trail for marketplace reviewers.
                </p>
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsApplyModalOpen(false)}
                  disabled={isSubmittingApply}
                  className="px-5 py-2.5 rounded-2xl border border-stone-200 text-stone-600 text-xs font-bold hover:bg-stone-50 transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedApplyCatId || isSubmittingApply}
                  className="px-6 py-2.5 rounded-2xl bg-[#641D26] hover:bg-[#52161E] text-white text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingApply && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isSubmittingApply ? 'Submitting Application...' : 'Submit Category Authorization'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* In-page Compliance Document Preview Overlay */}
      <DocumentPreviewModal
        isOpen={!!previewModalDoc}
        onClose={() => setPreviewModalDoc(null)}
        documentUrl={previewModalDoc?.url || null}
        title={previewModalDoc?.title || 'Compliance Credential'}
        code={previewModalDoc?.code}
      />
    </div>
  );
};
