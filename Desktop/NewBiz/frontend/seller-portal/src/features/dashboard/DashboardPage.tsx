import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore.js';
import { apiClient } from '../../lib/axios.js';
import {
  Package,
  Layers,
  Warehouse,
  ListPlus,
  Store,
  CheckCircle2,
  Clock,
  AlertCircle,
  RotateCcw,
  ArrowRight,
  RefreshCw,
  ShieldCheck,
  FileText,
  AlertTriangle,
  ExternalLink,
  ArrowUpRight,
} from 'lucide-react';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface SellerDashboardMetrics {
  hasProfile: boolean;
  sellerName?: string;
  sellerCode?: string;
  businessName?: string;
  products: {
    count: number;
    activeCount: number;
    label: string;
   
  };
  warehouses: {
    count: number;
    label: string;
    
    ownCount: number;
    threePLCount: number;
    primaryWarehouseName: string | null;
  };
  categories: {
    count: number;
    label: string;
    
    categoryName: string;
    verifiedDocs: number;
    totalDocs: number;
  };
  inventory: {
    totalPhysical: number;
    label: string;
  
  };
}

interface OnboardingStatus {
  hasProfile: boolean;
  status: string;
  isMerchantActive?: boolean;
  isSentBack: boolean;
  seller?: {
    sellerId: number;
    sellerCode: string;
    sellerName: string;
    businessName: string;
    email: string;
    phoneNumber: string;
    status: string;
  } | null;
  application?: {
    applicationId: number;
    categoryId: number;
    categoryName: string;
    status: string;
    submittedAt?: string;
    rejectionReason?: string;
  } | null;
  applications?: Array<{
    applicationId: number;
    categoryId: number;
    categoryName: string;
    status: string;
    submittedAt?: string;
    rejectionReason?: string;
  }>;
  activeCategories?: Array<{ categoryId: number; categoryName: string; approvedAt?: string }>;
  pendingCategories?: Array<{ categoryId: number; categoryName: string; submittedAt?: string }>;
  documents: Array<{
    documentId: number;
    code: string;
    displayName: string;
    verificationStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
    rejectionReason?: string;
    isMandatory: boolean;
  }>;
  consents: Array<{ type: string; isGranted: boolean }>;
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const seller = user?.sellers?.[0];

  const [onboarding, setOnboarding] = useState<OnboardingStatus | null>(null);
  const [metrics, setMetrics] = useState<SellerDashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentDate = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const fetchStatus = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const [onboardingRes, metricsRes] = await Promise.all([
        apiClient.get('/seller/onboarding/status'),
        apiClient.get('/seller/dashboard/stats').catch(() => null),
      ]);

      if (onboardingRes.data.success) {
        setOnboarding(onboardingRes.data.data);
      }
      if (metricsRes?.data?.success) {
        setMetrics(metricsRes.data.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load seller status');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // ─────────────────────────────────────────────
  // Derived state
  // ─────────────────────────────────────────────

  const isMerchantActive = onboarding?.isMerchantActive ?? (onboarding?.seller?.status === 'ACTIVE');
  const isPending = !isMerchantActive && (onboarding?.application?.status === 'SUBMITTED' || onboarding?.status === 'PENDING_VERIFICATION');
  const isSentBack = !isMerchantActive && (onboarding?.isSentBack ?? false);
  const isHardRejected = !isMerchantActive && (onboarding?.application?.status === 'REJECTED' || onboarding?.status === 'REJECTED');
  const isDraft = !isMerchantActive && onboarding?.hasProfile && (onboarding.application?.status === 'DRAFT' || onboarding?.status === 'DRAFT') && !isSentBack;
  const hasNoProfile = !isMerchantActive && onboarding && !onboarding.hasProfile;

  const approvedDocs = onboarding?.documents.filter((d) => d.verificationStatus === 'APPROVED').length ?? 0;
  const totalDocs = onboarding?.documents.length ?? 0;
  const rejectedDocs = onboarding?.documents.filter((d) => d.verificationStatus === 'REJECTED') ?? [];

  // ─────────────────────────────────────────────
  // Loading state
  // ─────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-3">
        <div className="w-10 h-10 border-4 border-[#7E2532] border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-bold text-stone-500 uppercase tracking-wider">Loading seller dashboard...</p>
      </div>
    );
  }

  // ─────────────────────────────────────────────
  // ── GATE: No profile yet → redirect to onboarding
  // ─────────────────────────────────────────────

  if (hasNoProfile) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 pt-8">
        <div>
          <h1 className="text-2xl font-black text-stone-900 tracking-tight">Welcome to SellerStudio</h1>
          <p className="text-sm text-stone-500 mt-1">
            Hello, <strong>{user?.firstName}</strong>! Let's get your seller account set up.
          </p>
        </div>

        <div className="bg-white rounded-3xl p-8 border border-[#ECE5DC] shadow-sm text-center space-y-5">
          <div className="w-16 h-16 rounded-3xl bg-[#7E2532]/10 flex items-center justify-center mx-auto">
            <Store className="w-8 h-8 text-[#7E2532]" />
          </div>
          <div>
            <h2 className="text-xl font-black text-stone-900">Complete Your Seller Registration</h2>
            <p className="text-sm text-stone-500 mt-2 max-w-md mx-auto leading-relaxed">
              To start selling on the marketplace, you need to register your legal business entity
              and complete the KYC compliance verification process.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 text-center pt-2">
            {[
              { step: '1', label: 'Business Profile', desc: 'Legal entity & brand' },
              { step: '2', label: 'KYC Documents', desc: 'GST, PAN & compliance' },
              { step: '3', label: 'Platform Agreement', desc: 'Review & submit' },
            ].map((s) => (
              <div key={s.step} className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#ECE5DC]">
                <span className="text-2xl font-black text-[#7E2532] block">{s.step}</span>
                <span className="text-xs font-bold text-stone-800 block mt-1">{s.label}</span>
                <span className="text-[11px] text-stone-500 font-medium block mt-0.5">{s.desc}</span>
              </div>
            ))}
          </div>

          <button
            onClick={() => navigate('/onboarding')}
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-gradient-to-r from-[#7E2532] to-[#9E2C3F] hover:from-[#641D26] hover:to-[#7E2532] text-white text-sm font-extrabold rounded-2xl shadow-lg shadow-[#7E2532]/25 transition-all"
          >
            Start Seller Registration <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────
  // ── GATE: Application in DRAFT (not yet submitted)
  // ─────────────────────────────────────────────

  if (isDraft) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 pt-8">
        <div>
          <h1 className="text-2xl font-black text-stone-900">Almost There!</h1>
          <p className="text-sm text-stone-500 mt-1">Complete your registration to unlock your seller dashboard.</p>
        </div>

        <div className="bg-white rounded-3xl p-7 border border-amber-200 shadow-sm space-y-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center shrink-0">
              <FileText className="w-6 h-6 text-amber-700" />
            </div>
            <div>
              <h2 className="text-base font-black text-stone-900">Registration In Progress</h2>
              <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                Your business profile is saved. Upload your compliance documents and submit for admin review.
              </p>
            </div>
          </div>

          {/* Progress snapshot */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mb-1.5" />
              <p className="text-xs font-bold text-emerald-900">Business Profile</p>
              <p className="text-[11px] text-emerald-700 font-medium">{onboarding?.seller?.businessName}</p>
            </div>
            <div className={`p-3.5 rounded-2xl border ${totalDocs > 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-stone-50 border-stone-200'}`}>
              {totalDocs > 0 ? <CheckCircle2 className="w-4 h-4 text-emerald-600 mb-1.5" /> : <AlertCircle className="w-4 h-4 text-stone-400 mb-1.5" />}
              <p className="text-xs font-bold text-stone-900">Documents</p>
              <p className="text-[11px] text-stone-600 font-medium">{totalDocs} uploaded so far</p>
            </div>
          </div>

          <button
            onClick={() => navigate('/onboarding')}
            className="w-full py-3 bg-gradient-to-r from-[#7E2532] to-[#9E2C3F] hover:from-[#641D26] hover:to-[#7E2532] text-white text-sm font-extrabold rounded-2xl flex items-center justify-center gap-2 shadow-md transition-all"
          >
            Continue Registration <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────
  // ── GATE: Sent Back for Correction
  // ─────────────────────────────────────────────

  if (isSentBack) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 pt-8">
        <div>
          <h1 className="text-2xl font-black text-stone-900">Correction Required</h1>
          <p className="text-sm text-stone-500 mt-1">
            Our compliance team has reviewed your application and needs a few corrections.
          </p>
        </div>

        <div className="bg-white rounded-3xl p-7 border border-amber-300 shadow-sm space-y-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center shrink-0">
              <RotateCcw className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h2 className="text-base font-black text-amber-900">Sent Back for Correction</h2>
              {onboarding?.application?.rejectionReason && (
                <div className="mt-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 font-medium leading-relaxed">
                  <span className="font-bold block mb-0.5">Admin Correction Note:</span>
                  <span className="italic">"{onboarding.application.rejectionReason}"</span>
                </div>
              )}
            </div>
          </div>

          {/* Rejected docs */}
          {rejectedDocs.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-stone-700 uppercase tracking-wider">Documents to Fix:</p>
              {rejectedDocs.map((d) => (
                <div key={d.documentId} className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2 text-xs">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-rose-900">{d.displayName}</span>
                    {d.rejectionReason && <span className="text-rose-700 block mt-0.5 italic">"{d.rejectionReason}"</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => navigate('/onboarding')}
            className="w-full py-3 bg-gradient-to-r from-[#7E2532] to-[#9E2C3F] hover:from-[#641D26] hover:to-[#7E2532] text-white text-sm font-extrabold rounded-2xl flex items-center justify-center gap-2 shadow-md transition-all"
          >
            Fix & Resubmit Application <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────
  // ── GATE: Pending Review (submitted, awaiting admin)
  // ─────────────────────────────────────────────

  if (isPending) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 pt-8">
        <div>
          <h1 className="text-2xl font-black text-stone-900">Application Under Review</h1>
          <p className="text-sm text-stone-500 mt-1">Hang tight — our compliance team is reviewing your submission.</p>
        </div>

        <div className="bg-white rounded-3xl p-7 border border-amber-200 shadow-sm space-y-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center shrink-0 animate-pulse">
              <Clock className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h2 className="text-base font-black text-stone-900">KYC Verification In Progress</h2>
              <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                Submitted on{' '}
                <strong>
                  {onboarding?.application?.submittedAt
                    ? new Date(onboarding.application.submittedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
                    : '—'}
                </strong>
                . Our operations team typically completes verification within 24–48 hours.
              </p>
            </div>
          </div>

          {/* Document summary */}
          <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#ECE5DC] space-y-2">
            <p className="text-xs font-bold text-stone-700 uppercase tracking-wider">Submitted Documents</p>
            <div className="flex items-center gap-3 text-xs font-bold">
              <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800">{totalDocs} Submitted</span>
              <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">{approvedDocs} Verified</span>
              <span className="px-2.5 py-1 rounded-full bg-stone-100 text-stone-600">{totalDocs - approvedDocs} Pending</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={() => fetchStatus(true)}
              className="flex items-center gap-1.5 text-xs font-bold text-stone-500 hover:text-stone-800 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh Status
            </button>
            <button
              onClick={() => navigate('/onboarding')}
              className="text-xs font-bold text-[#7E2532] hover:underline inline-flex items-center gap-1"
            >
              View Application <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────
  // ── GATE: Hard Rejected
  // ─────────────────────────────────────────────

  if (isHardRejected) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 pt-8">
        <div>
          <h1 className="text-2xl font-black text-stone-900">Application Rejected</h1>
          <p className="text-sm text-stone-500 mt-1">Your seller application was not approved.</p>
        </div>

        <div className="bg-white rounded-3xl p-7 border border-rose-200 shadow-sm space-y-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-6 h-6 text-rose-600" />
            </div>
            <div>
              <h2 className="text-base font-black text-rose-900">Permanently Rejected</h2>
              <p className="text-xs text-rose-700 mt-1 leading-relaxed">
                Reason:{' '}
                <span className="italic font-medium">
                  "{onboarding?.application?.rejectionReason || 'Application did not meet compliance requirements'}"
                </span>
              </p>
              <p className="text-xs text-stone-500 mt-3">
                Please contact platform support if you believe this is an error or need further guidance.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────
  // ── APPROVED — Full Dashboard
  // ─────────────────────────────────────────────

  const stats = [
    {
      title: 'Commercial Listings',
      value: metrics ? metrics.products.label : '0 SKUs',
      
      icon: Package,
      iconBg: 'bg-[#FDF2F4] text-[#7E2532] border border-rose-200/60',
      route: '/products',
    },
    {
      title: 'Connected Warehouses',
      value: metrics ? metrics.warehouses.label : '0 Warehouses',
      
      icon: Warehouse,
      iconBg: 'bg-amber-50 text-amber-700 border border-amber-200/60',
      route: '/warehouses',
    },
    {
      title: 'Approved Categories',
      value: onboarding?.activeCategories && onboarding.activeCategories.length > 0
        ? `${onboarding.activeCategories.length} Active Categor${onboarding.activeCategories.length > 1 ? 'ies' : 'y'}`
        : metrics?.categories.label || onboarding?.application?.categoryName || '—',
      
      icon: ListPlus,
      iconBg: 'bg-emerald-50 text-emerald-700 border border-emerald-200/60',
      route: '/applications',
    },
    {
      title: 'Total Stock Allocated',
      value: metrics ? metrics.inventory.label : '0 Units',
      
      icon: Layers,
      iconBg: 'bg-stone-100 text-stone-700 border border-stone-200/60',
      route: '/warehouses',
    },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs sm:text-sm font-semibold text-[#9E968D] tracking-wide block">
            Welcome back
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#221C1E] mt-0.5">
            {metrics?.sellerName || onboarding?.seller?.sellerName || seller?.sellerName || 'My Store'}
          </h1>
          <p className="text-xs text-stone-500 mt-1 font-medium">
            {currentDate} • Seller ID: {metrics?.sellerCode || onboarding?.seller?.sellerCode || seller?.sellerCode || '—'}
          </p>
        </div>
        <div className="flex items-center gap-3 self-start sm:self-auto">
          <button
            onClick={() => fetchStatus(true)}
            disabled={loading || refreshing}
            className="px-3.5 py-2 rounded-2xl bg-white hover:bg-stone-50 border border-[#ECE5DC] text-xs font-bold text-stone-700 flex items-center gap-2 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-[#7E2532]' : 'text-stone-400'}`} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-50 border border-emerald-200 shadow-2xs">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-bold text-emerald-800">Verified & Active</span>
          </div>
        </div>
      </div>

      {/* ── Category Expansion Alert (Non-blocking) ── */}
      {onboarding?.pendingCategories && onboarding.pendingCategories.length > 0 && (
        <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-amber-50/95 via-[#FDF9F5] to-orange-50/80 border border-amber-200/80 shadow-[0_8px_30px_rgba(245,158,11,0.06)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-amber-100/90 border border-amber-300/70 flex items-center justify-center shrink-0 text-amber-800 shadow-xs">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black uppercase tracking-wider text-amber-900">
                  Category Expansion Under Review
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-200 text-amber-900">
                  {onboarding.pendingCategories.length} Category Application Pending
                </span>
              </div>
              <p className="text-xs text-stone-600 font-medium mt-0.5">
                Your application to sell in{' '}
                <strong className="text-stone-900">{onboarding.pendingCategories.map((c) => c.categoryName).join(', ')}</strong> is currently being reviewed by compliance. All your active categories and current listings remain 100% operational.
              </p>
            </div>
          </div>
          <Link
            to="/applications"
            className="px-4 py-2 rounded-xl bg-white hover:bg-amber-100/50 border border-amber-300 text-amber-950 font-extrabold text-xs shrink-0 flex items-center gap-1.5 transition-all shadow-xs self-start sm:self-auto"
          >
            <span>View Details</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* ── Stats Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div
              key={i}
              onClick={() => stat.route && navigate(stat.route)}
              className="bg-white rounded-3xl p-6 border border-[#ECE5DC] shadow-[0_8px_30px_rgba(70,20,27,0.035)] hover:shadow-[0_14px_38px_rgba(70,20,27,0.06)] hover:border-[#7E2532]/30 transition-all duration-300 relative overflow-hidden group cursor-pointer"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`w-11 h-11 rounded-2xl ${stat.iconBg} flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="p-1 rounded-xl text-stone-300 group-hover:text-[#7E2532] transition-colors">
                  <ArrowUpRight className="w-4 h-4" />
                </span>
              </div>
              <div className="text-xl sm:text-2xl font-black text-[#221C1E] tracking-tight">{stat.value}</div>
              <p className="text-xs font-semibold text-[#9E968D] mt-1">{stat.title}</p>
              
            </div>
          );
        })}
      </div>

      {/* ── Approved Application Summary ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* KYC Verification Status */}
        <div className="bg-white rounded-3xl p-7 border border-[#ECE5DC] shadow-[0_8px_30px_rgba(70,20,27,0.035)]">
          <div className="flex items-center gap-2 text-[#7E2532] text-xs font-bold uppercase tracking-wider mb-4">
            <ShieldCheck className="w-4 h-4" /> KYC & Compliance Status
          </div>
          <div className="space-y-3">
            {onboarding?.documents.map((doc) => (
              <div key={doc.documentId} className="flex items-center justify-between text-xs">
                <span className="font-semibold text-stone-700">{doc.displayName}</span>
                <span className={`px-2.5 py-1 rounded-full font-bold text-[10px] ${
                  doc.verificationStatus === 'APPROVED'
                    ? 'bg-emerald-100 text-emerald-800'
                    : doc.verificationStatus === 'REJECTED'
                    ? 'bg-rose-100 text-rose-800'
                    : 'bg-amber-100 text-amber-800'
                }`}>
                  {doc.verificationStatus === 'APPROVED' ? '✓ Verified' : doc.verificationStatus === 'REJECTED' ? '✗ Rejected' : '⏳ Pending'}
                </span>
              </div>
            ))}
            {(!onboarding?.documents || onboarding.documents.length === 0) && (
              <p className="text-xs text-stone-400 font-medium">No documents on record.</p>
            )}
          </div>
        </div>

        {/* Seller Info Summary */}
        <div className="bg-white rounded-3xl p-7 border border-[#ECE5DC] shadow-[0_8px_30px_rgba(70,20,27,0.035)]">
          <div className="flex items-center gap-2 text-[#7E2532] text-xs font-bold uppercase tracking-wider mb-4">
            <Store className="w-4 h-4" /> Seller Entity
          </div>
          <div className="space-y-3 text-xs">
            {[
              { label: 'Legal Business Name', value: onboarding?.seller?.businessName },
              { label: 'Brand / Store Name', value: onboarding?.seller?.sellerName },
              { label: 'Primary Category', value: onboarding?.application?.categoryName },
              { label: 'Contact Email', value: onboarding?.seller?.email },
              { label: 'Mobile', value: onboarding?.seller?.phoneNumber },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-start justify-between gap-4">
                <span className="text-stone-400 font-semibold shrink-0">{label}</span>
                <span className="font-bold text-stone-800 text-right">{value || '—'}</span>
              </div>
            ))}
          </div>
          <div className="mt-5 pt-4 border-t border-stone-100">
            <button
              onClick={() => navigate('/onboarding')}
              className="text-xs font-bold text-[#7E2532] hover:underline inline-flex items-center gap-1"
            >
              View Full Application <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Coming Soon Features ── */}
      <div className="bg-white rounded-3xl p-7 border border-[#ECE5DC] shadow-[0_8px_30px_rgba(70,20,27,0.035)]">
        <div className="flex items-center gap-2 text-[#7E2532] text-xs font-bold uppercase tracking-wider mb-5">
          <Store className="w-4 h-4" /> Coming Next
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: 'Product Catalog', desc: 'List and manage your product catalog with variants, pricing, and media.' },
            { label: 'Warehouse Binding', desc: 'Connect your inventory to the marketplace fulfillment network.' },
            { label: 'Orders & Shipments', desc: 'Track and manage marketplace orders and delivery assignments.' },
          ].map((f) => (
            <div key={f.label} className="p-5 rounded-2xl bg-[#F3EFEA] border border-[#ECE5DC]">
              <span className="text-sm font-bold text-[#221C1E] block">{f.label}</span>
              <span className="text-xs text-stone-500 block mt-1.5 leading-relaxed">{f.desc}</span>
              <span className="text-[10px] font-bold text-[#7E2532] mt-3 block">Coming Soon</span>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 font-medium">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}
    </div>
  );
};
