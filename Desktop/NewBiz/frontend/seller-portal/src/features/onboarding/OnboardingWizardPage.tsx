import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  AlertCircle,
  Upload,
  Clock,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  ExternalLink,
  Check,
  RefreshCw,
  FileText,
  AlertTriangle,
  X,
  Lock,
  RotateCcw,
  Info,
} from 'lucide-react';
import { apiClient } from '../../lib/axios.js';
import { DocumentPreviewModal } from '../../components/common/DocumentPreviewModal.js';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface Category {
  categoryId: number;
  CategoryID?: number;
  parentCategoryId: number | null;
  ParentCategoryID?: number | null;
  categoryName: string;
  CategoryName?: string;
  description?: string;
  Description?: string;
  isLeaf?: boolean;
}

interface RequiredDocument {
  documentTypeId: number;
  code: string;
  displayName: string;
  isMandatory: boolean;
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

interface ConsentItem {
  consentId: number;
  type: string;
  isGranted: boolean;
  grantedAt?: string;
}

interface OnboardingData {
  hasProfile: boolean;
  status: string;
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
    youtubeUrl?: string;
    linkedinUrl?: string;
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
  requiredDocuments?: RequiredDocument[];
  documents: DocumentItem[];
  consents: ConsentItem[];
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

const getDocDescription = (code: string, displayName: string, isMandatory: boolean, categoryName?: string) => {
  switch (code) {
    case 'BIS_CERT':
      return 'Mandatory Bureau of Indian Standards (BIS) Certification required under Indian Quality Control Orders (QCO) for this product category.';
    case 'MFG_AUTH':
      return 'Mandatory Brand / Manufacturer Authorization & Warranty undertaking authorizing direct marketplace retail distribution.';
    case 'FSSAI':
      return 'Mandatory Food Safety and Standards Authority of India (FSSAI) License / Registration Certificate.';
    case 'GST':
      return 'Government issued 15-digit Goods & Services Tax Registration Certificate (Form REG-06).';
    case 'PAN':
      return '10-character Permanent Account Number issued by the Income Tax Department of India.';
    case 'BANK_PROOF':
      return 'Settlement bank account proof: Cancelled Cheque, Bank Passbook, or Bank Statement showing Account & IFSC.';
    default:
      return isMandatory
        ? `Mandatory ${displayName} compliance document required for ${categoryName || 'this category'}.`
        : `Optional supporting ${displayName} document.`;
  }
};

const getDocPlaceholder = (code: string) => {
  switch (code) {
    case 'GST': return 'e.g. 36AABCK1234F1Z5';
    case 'PAN': return 'e.g. AABCK1234F';
    case 'BIS_CERT': return 'e.g. CM/L-0000000';
    case 'MFG_AUTH': return 'e.g. AUTH/2026/001';
    case 'FSSAI': return 'e.g. 10012345678901';
    default: return 'Registration or Certificate Number';
  }
};

const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/;

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export const OnboardingWizardPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [onboardingData, setOnboardingData] = useState<OnboardingData | null>(null);

  // In-page Document preview overlay
  const [previewDoc, setPreviewDoc] = useState<{ url: string; title: string; code?: string } | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    businessName: '',
    sellerName: '',
    email: '',
    phoneNumber: '',
    primaryCategoryId: '',
    instagramUrl: '',
    facebookUrl: '',
    youtubeUrl: '',
    linkedinUrl: '',
    consentGranted: false,
  });

  // Validation errors for Step 1
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Terms modal
  const [termsModalOpen, setTermsModalOpen] = useState<boolean>(false);

  // Document upload state
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [certNumbers, setCertNumbers] = useState<Record<string, string>>({});

  // Dynamic category documents
  const [categoryDocuments, setCategoryDocuments] = useState<RequiredDocument[]>([]);
  const [loadingCategoryDocs, setLoadingCategoryDocs] = useState<boolean>(false);

  // ── Auto-clear success message ──────────────────────────────────────────
  const showSuccess = useCallback((msg: string) => {
    setSuccessMessage(msg);
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
    successTimerRef.current = setTimeout(() => setSuccessMessage(null), 5000);
  }, []);

  // ── Fetch category docs whenever category changes ───────────────────────
  useEffect(() => {
    if (!formData.primaryCategoryId) {
      setCategoryDocuments([]);
      return;
    }
    setLoadingCategoryDocs(true);
    apiClient
      .get(`/categories/${formData.primaryCategoryId}/documents`)
      .then((res) => {
        if (res.data.success && Array.isArray(res.data.data)) {
          setCategoryDocuments(res.data.data);
        }
      })
      .catch((err) => {
        console.error('Failed to load category documents:', err);
      })
      .finally(() => setLoadingCategoryDocs(false));
  }, [formData.primaryCategoryId]);

  // ── Fetch onboarding status + categories ───────────────────────────────
  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [statusRes, catRes] = await Promise.all([
        apiClient.get('/seller/onboarding/status'),
        apiClient.get('/categories'),
      ]);

      if (statusRes.data.success) {
        const data: OnboardingData = statusRes.data.data;
        setOnboardingData(data);

        if (data.requiredDocuments && data.requiredDocuments.length > 0) {
          setCategoryDocuments(data.requiredDocuments);
        }

        if (data.seller) {
          // Determine if the seller has previously granted consent
          const hasConsented = data.consents?.some(
            (c) => c.type === 'MARKETPLACE_SELLER_AGREEMENT' && c.isGranted
          ) ?? false;

          setFormData((prev) => ({
            ...prev,
            businessName: data.seller?.businessName || '',
            sellerName: data.seller?.sellerName || '',
            email: data.seller?.email || '',
            phoneNumber: data.seller?.phoneNumber || '',
            primaryCategoryId: data.application ? String(data.application.categoryId) : prev.primaryCategoryId,
            instagramUrl: data.seller?.instagramUrl || '',
            facebookUrl: data.seller?.facebookUrl || '',
            youtubeUrl: data.seller?.youtubeUrl || '',
            linkedinUrl: data.seller?.linkedinUrl || '',
            // Pre-tick consent from the DB record (idempotent)
            consentGranted: hasConsented,
          }));
        }

        // Populate certificate numbers from existing documents
        const initialCerts: Record<string, string> = {};
        data.documents.forEach((doc) => {
          if (doc.certificateNumber) {
            initialCerts[doc.code] = doc.certificateNumber;
          }
        });
        setCertNumbers((prev) => ({ ...prev, ...initialCerts }));

        // ── Smart step auto-navigation ──────────────────────────────────
        // Approved or submitted → show Step 3 (read-only dossier)
        if (data.application?.status === 'APPROVED' || data.application?.status === 'SUBMITTED') {
          setActiveStep(3);
        } else if (data.isSentBack) {
          // Sent back by admin for correction → go to Step 2 to re-upload docs
          setActiveStep(2);
        } else {
          // Default to Step 1 for new, draft, or continuing registrations
          setActiveStep(1);
        }
      }

      if (catRes.data.success && Array.isArray(catRes.data.data)) {
        const normalized: Category[] = catRes.data.data.map((c: any) => ({
          categoryId: Number(c.categoryId ?? c.CategoryID),
          CategoryID: Number(c.categoryId ?? c.CategoryID),
          categoryName: String(c.categoryName ?? c.CategoryName),
          CategoryName: String(c.categoryName ?? c.CategoryName),
          parentCategoryId: c.parentCategoryId ?? c.ParentCategoryID ?? null,
          ParentCategoryID: c.parentCategoryId ?? c.ParentCategoryID ?? null,
          isLeaf: Boolean(c.isLeaf),
          description: c.description ?? c.Description,
        }));
        setCategories(normalized);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load onboarding status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, [fetchStatus]);

  // ─────────────────────────────────────────────
  // Derived state
  // ─────────────────────────────────────────────

  const isPending =
    onboardingData?.application?.status === 'SUBMITTED' ||
    onboardingData?.status === 'PENDING_VERIFICATION';

  const isApproved = onboardingData?.application?.status === 'APPROVED';

  const isHardRejected = onboardingData?.application?.status === 'REJECTED';

  // Sent back: application is DRAFT but has a rejection/correction note from admin
  const isSentBack = onboardingData?.isSentBack ?? false;

  // Category is locked once application progresses past DRAFT (without correction)
  const isCategoryLocked =
    isPending || isApproved || isSentBack || isHardRejected;

  const selectedCategory = categories.find(
    (c) => String(c.categoryId ?? c.CategoryID) === String(formData.primaryCategoryId)
  );

  // Derive active required documents by combining platform baseline KYC docs and category-specific docs dynamically
  const combinedMap = new Map<string, RequiredDocument>();

  // 1. Add all documents returned by the backend for this seller (platform baseline + category docs)
  (onboardingData?.requiredDocuments || []).forEach((d) => combinedMap.set(d.code, d));

  // 2. Overlay dynamic category documents when a category is selected or switched
  categoryDocuments.forEach((d) => {
    const existing = combinedMap.get(d.code);
    if (existing) {
      combinedMap.set(d.code, {
        ...existing,
        isMandatory: existing.isMandatory || d.isMandatory,
        displayName: d.displayName || existing.displayName,
      });
    } else {
      combinedMap.set(d.code, d);
    }
  });

  const activeCategoryDocs = Array.from(combinedMap.values());

  const mandatoryDocs = activeCategoryDocs.filter((d) => d.isMandatory);
  const missingMandatoryDocs = mandatoryDocs.filter((req) => {
    const doc = onboardingData?.documents.find((d) => d.code === req.code);
    return !doc || doc.verificationStatus === 'REJECTED';
  });
  const isReadyToSubmit = missingMandatoryDocs.length === 0 && activeCategoryDocs.length > 0;

  // ─────────────────────────────────────────────
  // Handlers
  // ─────────────────────────────────────────────

  const validateStep1 = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.businessName.trim()) errors.businessName = 'Legal entity name is required';
    if (!formData.sellerName.trim()) errors.sellerName = 'Brand / store name is required';
    if (!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
      errors.email = 'Enter a valid business email address';
    if (!formData.phoneNumber.trim() || !INDIAN_MOBILE_REGEX.test(formData.phoneNumber.replace(/\s/g, '')))
      errors.phoneNumber = 'Enter a valid 10-digit Indian mobile number (starts with 6–9)';
    if (!formData.primaryCategoryId)
      errors.primaryCategoryId = 'Select a primary operating category';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!validateStep1()) return;

    setSubmitting(true);
    try {
      const res = await apiClient.post('/seller/onboarding/profile', {
        ...formData,
        primaryCategoryId: Number(formData.primaryCategoryId),
      });

      if (res.data.success) {
        setOnboardingData(res.data.data);
        showSuccess(
          onboardingData?.hasProfile
            ? 'Business identity updated. Proceed to upload compliance documents.'
            : 'Business identity saved. Now upload your KYC compliance documents.'
        );
        setActiveStep(2);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to save business profile');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileUpload = async (docDef: RequiredDocument, file: File) => {
    setError(null);
    setUploadingDoc(docDef.code);
    try {
      const uploadForm = new FormData();
      uploadForm.append('file', file);
      uploadForm.append('documentTypeCode', docDef.code);
      uploadForm.append('certificateNumber', certNumbers[docDef.code] || '');

      const res = await apiClient.post('/seller/onboarding/documents', uploadForm, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data.success) {
        setOnboardingData(res.data.data);
        showSuccess(`"${docDef.displayName}" uploaded successfully.`);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || `Failed to upload ${docDef.displayName}`);
    } finally {
      setUploadingDoc(null);
    }
  };

  const handleSaveCertNumber = async (docCode: string) => {
    const certNum = certNumbers[docCode] || '';
    try {
      const res = await apiClient.patch(`/seller/onboarding/documents/${docCode}/certificate-number`, {
        certificateNumber: certNum,
      });
      if (res.data.success) {
        setOnboardingData(res.data.data);
        showSuccess(`Certificate number updated.`);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to update certificate number');
    }
  };

  const handleSubmitFinal = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const res = await apiClient.post('/seller/onboarding/submit');
      if (res.data.success) {
        setOnboardingData(res.data.data);
        showSuccess('Application submitted successfully! Our compliance team will review your dossier within 24 hours.');
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to submit application');
    } finally {
      setSubmitting(false);
    }
  };

  // ─────────────────────────────────────────────
  // Loading state
  // ─────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[450px]">
        <div className="w-10 h-10 border-4 border-[#7E2532] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs font-bold text-stone-500 uppercase tracking-wider">Loading verification dossier...</p>
      </div>
    );
  }

  // ─────────────────────────────────────────────
  // Step tab helpers
  // ─────────────────────────────────────────────

  const canNavigateToStep = (step: number): boolean => {
    if (step === 1) return true;
    if (step === 2) return !!onboardingData?.hasProfile;
    if (step === 3) return !!onboardingData?.hasProfile && activeCategoryDocs.length > 0;
    return false;
  };

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-16">

      {/* ── Header ── */}
      <div>
        <div className="flex items-center gap-2.5 text-[#7E2532] text-xs font-bold uppercase tracking-wider mb-2">
          Legal Entity & Seller Verification (India)
        </div>
        <h1 className="text-3xl font-black text-stone-900 tracking-tight">Master Business Onboarding</h1>
        <p className="text-sm text-stone-500 mt-1 font-medium max-w-2xl">
          Register your legal business entity once to establish verified seller status on the platform.
        </p>
      </div>

      {/* ── Global Status Banners ── */}

      {/* SENT BACK FOR CORRECTION — highest priority, amber */}
      {isSentBack && (
        <div className="p-5 rounded-3xl bg-amber-50 border border-amber-300 flex items-start gap-4 shadow-sm">
          <RotateCcw className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-bold text-amber-900">Action Required: Application Sent Back for Correction</h3>
            <p className="text-xs text-amber-800 mt-1 leading-relaxed">
              Our compliance team has reviewed your application and requires corrections before approval.
              Please re-upload or fix the flagged documents and resubmit.
            </p>
            {onboardingData?.application?.rejectionReason && (
              <div className="mt-3 p-3 rounded-xl bg-white border border-amber-200 text-xs text-amber-900 font-medium">
                <span className="font-bold block mb-0.5">Compliance Note from Admin:</span>
                <span className="italic">"{onboardingData.application.rejectionReason}"</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PENDING REVIEW */}
      {isPending && (
        <div className="p-5 rounded-3xl bg-amber-50 border border-amber-200/80 flex items-start gap-4 shadow-sm">
          <Clock className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-amber-900">Application Under Review</h3>
            <p className="text-xs text-amber-700 mt-1 leading-relaxed">
              Your master business verification dossier was submitted on{' '}
              <span className="font-semibold">
                {onboardingData?.application?.submittedAt
                  ? new Date(onboardingData.application.submittedAt).toLocaleString()
                  : '—'}
              </span>
              . Our operations compliance team is inspecting your credentials. You will receive a notification once approved.
            </p>
          </div>
        </div>
      )}

      {/* APPROVED */}
      {isApproved && (
        <div className="p-5 rounded-3xl bg-emerald-50 border border-emerald-200/80 flex items-start gap-4 shadow-sm">
          <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-emerald-900">Seller Entity Verified & Active</h3>
            <p className="text-xs text-emerald-700 mt-1 leading-relaxed">
              Congratulations! Your business legal entity{' '}
              <span className="font-semibold">{onboardingData?.seller?.businessName}</span> is verified and
              approved for catalog operations.
            </p>
          </div>
        </div>
      )}

      {/* HARD REJECTED (permanent) */}
      {isHardRejected && (
        <div className="p-5 rounded-3xl bg-rose-50 border border-rose-200/80 flex items-start gap-4 shadow-sm">
          <AlertCircle className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-rose-900">Application Permanently Rejected</h3>
            <p className="text-xs text-rose-700 mt-1 leading-relaxed">
              Reason:{' '}
              <span className="font-semibold italic">
                "{onboardingData?.application?.rejectionReason || 'Application did not meet compliance requirements'}"
              </span>
              <br />
              Please contact platform support if you believe this is an error.
            </p>
          </div>
        </div>
      )}

      {/* Error & Success alerts */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-3 font-medium">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="ml-auto text-rose-400 hover:text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {successMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-3 font-medium">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMessage}</span>
          <button type="button" onClick={() => setSuccessMessage(null)} className="ml-auto text-emerald-400 hover:text-emerald-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Step Navigation Tabs ── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { step: 1, title: '1. Business Profile', desc: 'Legal Entity & Brand' },
          {
            step: 2,
            title: '2. KYC & Compliance',
            desc: selectedCategory
              ? `${selectedCategory.CategoryName} Compliance`
              : 'Category Compliance & KYC',
          },
          { step: 3, title: '3. Platform Agreement', desc: 'Review & Terms Sign-off' },
        ].map((item) => {
          const isActive = activeStep === item.step;
          const isCompleted = activeStep > item.step || isApproved;
          const isDisabled = !canNavigateToStep(item.step);
          return (
            <button
              key={item.step}
              type="button"
              disabled={isDisabled}
              onClick={() => !isDisabled && setActiveStep(item.step)}
              className={`p-4 rounded-2xl border text-left transition-all ${
                isActive
                  ? 'bg-white border-[#7E2532] shadow-md shadow-[#7E2532]/5 ring-2 ring-[#7E2532]/10'
                  : isCompleted
                  ? 'bg-white/70 border-emerald-200 hover:bg-white'
                  : isDisabled
                  ? 'bg-stone-50/40 border-stone-200 opacity-50 cursor-not-allowed'
                  : 'bg-white/40 border-[#ECE5DC] hover:bg-white/80'
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-xs font-extrabold ${
                    isActive ? 'text-[#7E2532]' : isCompleted ? 'text-emerald-700' : 'text-stone-400'
                  }`}
                >
                  {item.title}
                </span>
                {isCompleted && <Check className="w-4 h-4 text-emerald-600" />}
                {isDisabled && !isCompleted && <Lock className="w-3 h-3 text-stone-400" />}
              </div>
              <p className="text-[11px] text-stone-500 font-medium mt-1">{item.desc}</p>
            </button>
          );
        })}
      </div>

      {/* ══════════════════════════════════════════════
          STEP 1: BUSINESS PROFILE
         ══════════════════════════════════════════════ */}
      {activeStep === 1 && (
        <form onSubmit={handleSaveProfile} className="bg-white rounded-3xl p-8 border border-[#ECE5DC] shadow-sm space-y-6" noValidate>
          <div className="border-b border-stone-100 pb-4">
            <h2 className="text-lg font-bold text-stone-900">Step 1: Legal Business & Brand Identity</h2>
            <p className="text-xs text-stone-400 mt-0.5">
              Establish your business entity as registered with the Ministry of Corporate Affairs / GST authorities.
            </p>
          </div>

          {/* Read-only notice when locked */}
          {isApproved ? (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-2.5 text-xs text-emerald-800 font-semibold">
              <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600" />
              Seller profile is verified & active. Statutory legal information is locked. Contact platform operations for change requests.
            </div>
          ) : isPending ? (
            <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-200 flex items-center gap-2.5 text-xs text-blue-800 font-medium">
              <Info className="w-4 h-4 shrink-0 text-blue-600" />
              Profile fields are read-only while your application is under compliance review.
            </div>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Legal Business Name */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-2">
                Legal Business Entity Name *
              </label>
              <input
                type="text"
                required
                disabled={submitting || isPending || isApproved}
                value={formData.businessName}
                onChange={(e) => {
                  setFormData({ ...formData, businessName: e.target.value });
                  setFieldErrors({ ...fieldErrors, businessName: '' });
                }}
                placeholder="e.g. KitchenKart Products India Pvt Ltd"
                className={`w-full px-4 py-3 rounded-2xl bg-[#F9F7F4] border text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#7E2532]/30 focus:border-[#7E2532] font-medium transition-all disabled:opacity-60 ${fieldErrors.businessName ? 'border-rose-400' : 'border-[#E0D8CD]'}`}
              />
              {fieldErrors.businessName && <p className="text-[11px] text-rose-600 mt-1 font-medium">{fieldErrors.businessName}</p>}
              <span className="text-[10px] text-stone-400 mt-1 block">Exactly as printed on your GST Certificate</span>
            </div>

            {/* Brand Name */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-2">
                Brand / Store Name *
              </label>
              <input
                type="text"
                required
                disabled={submitting || isPending || isApproved}
                value={formData.sellerName}
                onChange={(e) => {
                  setFormData({ ...formData, sellerName: e.target.value });
                  setFieldErrors({ ...fieldErrors, sellerName: '' });
                }}
                placeholder="e.g. KitchenKart"
                className={`w-full px-4 py-3 rounded-2xl bg-[#F9F7F4] border text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#7E2532]/30 focus:border-[#7E2532] font-medium transition-all disabled:opacity-60 ${fieldErrors.sellerName ? 'border-rose-400' : 'border-[#E0D8CD]'}`}
              />
              {fieldErrors.sellerName && <p className="text-[11px] text-rose-600 mt-1 font-medium">{fieldErrors.sellerName}</p>}
              <span className="text-[10px] text-stone-400 mt-1 block">Customer-facing display name on the marketplace</span>
            </div>

            {/* Primary Category */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-2">
                Primary Operating Category *
                {isCategoryLocked && (
                  <span className="ml-2 inline-flex items-center gap-1 text-amber-700 normal-case font-semibold">
                    <Lock className="w-3 h-3" /> Locked
                  </span>
                )}
              </label>
              {isCategoryLocked ? (
                <div className="w-full px-4 py-3 rounded-2xl bg-stone-100 border border-stone-200 text-sm font-bold text-stone-700 flex items-center gap-2">
                  {selectedCategory?.categoryName || selectedCategory?.CategoryName || onboardingData?.application?.categoryName || 'Category not set'}
                  <Lock className="w-3.5 h-3.5 text-stone-400 ml-auto" />
                </div>
              ) : (
                <select
                  required
                  disabled={submitting}
                  value={formData.primaryCategoryId}
                  onChange={(e) => {
                    setFormData({ ...formData, primaryCategoryId: e.target.value });
                    setFieldErrors({ ...fieldErrors, primaryCategoryId: '' });
                  }}
                  className={`w-full px-4 py-3 rounded-2xl bg-[#F9F7F4] border text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#7E2532]/30 focus:border-[#7E2532] font-medium transition-all disabled:opacity-60 ${fieldErrors.primaryCategoryId ? 'border-rose-400' : 'border-[#E0D8CD]'}`}
                >
                  <option value="">-- Select Target Category for Compliance --</option>
                  {categories.map((cat) => {
                    const id = cat.categoryId ?? cat.CategoryID;
                    const name = cat.categoryName ?? cat.CategoryName;
                    return (
                      <option
                        key={id}
                        value={id}
                        className="font-medium text-stone-900"
                      >
                        {cat.isLeaf === false ? `${name} (Parent Group)` : name}
                      </option>
                    );
                  })}
                </select>
              )}
              {fieldErrors.primaryCategoryId && <p className="text-[11px] text-rose-600 mt-1 font-medium">{fieldErrors.primaryCategoryId}</p>}
              <span className="text-[10px] text-stone-400 mt-1 block">
                {isCategoryLocked
                  ? 'Category is locked once an application has been submitted or sent back for correction.'
                  : 'Your core category focus — determines which compliance documents are required.'}
              </span>
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-2">
                Business Contact Email *
              </label>
              <input
                type="email"
                required
                disabled={submitting || isPending || isApproved}
                value={formData.email}
                onChange={(e) => {
                  setFormData({ ...formData, email: e.target.value });
                  setFieldErrors({ ...fieldErrors, email: '' });
                }}
                placeholder="official@brand.com"
                className={`w-full px-4 py-3 rounded-2xl bg-[#F9F7F4] border text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#7E2532]/30 focus:border-[#7E2532] font-medium transition-all disabled:opacity-60 ${fieldErrors.email ? 'border-rose-400' : 'border-[#E0D8CD]'}`}
              />
              {fieldErrors.email && <p className="text-[11px] text-rose-600 mt-1 font-medium">{fieldErrors.email}</p>}
            </div>

            {/* Phone */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-2">
                Registered Mobile Phone *
              </label>
              <input
                type="tel"
                required
                disabled={submitting || isPending || isApproved}
                value={formData.phoneNumber}
                onChange={(e) => {
                  setFormData({ ...formData, phoneNumber: e.target.value.replace(/\D/g, '') });
                  setFieldErrors({ ...fieldErrors, phoneNumber: '' });
                }}
                placeholder="9876543210"
                maxLength={10}
                className={`w-full px-4 py-3 rounded-2xl bg-[#F9F7F4] border text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#7E2532]/30 focus:border-[#7E2532] font-medium font-mono transition-all disabled:opacity-60 ${fieldErrors.phoneNumber ? 'border-rose-400' : 'border-[#E0D8CD]'}`}
              />
              {fieldErrors.phoneNumber && <p className="text-[11px] text-rose-600 mt-1 font-medium">{fieldErrors.phoneNumber}</p>}
            </div>

            {/* Instagram */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-2">
                Instagram URL
              </label>
              <input
                type="url"
                disabled={submitting || isPending || isApproved}
                value={formData.instagramUrl}
                onChange={(e) => setFormData({ ...formData, instagramUrl: e.target.value })}
                placeholder="https://instagram.com/mybrand"
                className="w-full px-4 py-3 rounded-2xl bg-[#F9F7F4] border border-[#E0D8CD] text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#7E2532]/30 focus:border-[#7E2532] font-medium transition-all disabled:opacity-60"
              />
            </div>

            {/* Facebook */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-2">
                Facebook URL
              </label>
              <input
                type="url"
                disabled={submitting || isPending || isApproved}
                value={formData.facebookUrl}
                onChange={(e) => setFormData({ ...formData, facebookUrl: e.target.value })}
                placeholder="https://facebook.com/mybrand"
                className="w-full px-4 py-3 rounded-2xl bg-[#F9F7F4] border border-[#E0D8CD] text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#7E2532]/30 focus:border-[#7E2532] font-medium transition-all disabled:opacity-60"
              />
            </div>

            {/* YouTube */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-2">
                YouTube URL
              </label>
              <input
                type="url"
                disabled={submitting || isPending || isApproved}
                value={formData.youtubeUrl}
                onChange={(e) => setFormData({ ...formData, youtubeUrl: e.target.value })}
                placeholder="https://youtube.com/@mybrand"
                className="w-full px-4 py-3 rounded-2xl bg-[#F9F7F4] border border-[#E0D8CD] text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#7E2532]/30 focus:border-[#7E2532] font-medium transition-all disabled:opacity-60"
              />
            </div>

            {/* LinkedIn */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-2">
                LinkedIn URL
              </label>
              <input
                type="url"
                disabled={submitting || isPending || isApproved}
                value={formData.linkedinUrl}
                onChange={(e) => setFormData({ ...formData, linkedinUrl: e.target.value })}
                placeholder="https://linkedin.com/company/mybrand"
                className="w-full px-4 py-3 rounded-2xl bg-[#F9F7F4] border border-[#E0D8CD] text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#7E2532]/30 focus:border-[#7E2532] font-medium transition-all disabled:opacity-60"
              />
            </div>
          </div>

          <div className="pt-6 border-t border-stone-100 flex items-center justify-end">
            {!(isPending || isApproved) && (
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-3.5 bg-gradient-to-r from-[#7E2532] to-[#9E2C3F] hover:from-[#641D26] hover:to-[#7E2532] text-white text-xs font-bold rounded-2xl shadow-lg shadow-[#7E2532]/25 flex items-center gap-2 transition-all disabled:opacity-60"
              >
                {submitting ? (
                  <><RefreshCw className="w-4 h-4 animate-spin" /> Saving...</>
                ) : onboardingData?.hasProfile ? (
                  <>Update & Continue to KYC Documents <ArrowRight className="w-4 h-4" /></>
                ) : (
                  <>Save & Continue to KYC Documents <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            )}
            {(isPending || isApproved) && (
              <button
                type="button"
                onClick={() => setActiveStep(2)}
                className="px-6 py-3.5 bg-gradient-to-r from-[#7E2532] to-[#9E2C3F] text-white text-xs font-bold rounded-2xl flex items-center gap-2"
              >
                View Documents <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </form>
      )}

      {/* ══════════════════════════════════════════════
          STEP 2: KYC COMPLIANCE DOCUMENTS
         ══════════════════════════════════════════════ */}
      {activeStep === 2 && (
        <div className="bg-white rounded-3xl p-8 border border-[#ECE5DC] shadow-sm space-y-8">
          <div className="border-b border-stone-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-[#7E2532] uppercase tracking-wider mb-1">
                <ShieldCheck className="w-4 h-4" /> Category Regulatory Dossier
              </div>
              <h2 className="text-lg font-black text-stone-900">Step 2: Category Compliance & KYC Documents</h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Upload clear verification copies required specifically for your selected category.
              </p>
            </div>

            {selectedCategory ? (
              <div className="flex items-center gap-3 bg-[#FAF8F5] border border-[#ECE5DC] px-4 py-2.5 rounded-2xl shrink-0">
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-stone-400 block">Category Focus</span>
                  <span className="text-xs font-black text-stone-900">{selectedCategory.categoryName || selectedCategory.CategoryName}</span>
                </div>
                {!isCategoryLocked && (
                  <button
                    type="button"
                    onClick={() => setActiveStep(1)}
                    className="px-2.5 py-1 rounded-xl bg-white border border-[#E0D8CD] text-[11px] font-bold text-[#7E2532] hover:bg-[#FAF8F5] transition-colors"
                  >
                    Change
                  </button>
                )}
                {isCategoryLocked && <Lock className="w-3.5 h-3.5 text-stone-400" />}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setActiveStep(1)}
                className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold"
              >
                No Category Selected — Go to Step 1
              </button>
            )}
          </div>

          {/* Requirements overview banner */}
          {selectedCategory && (
            <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900 font-medium space-y-1">
                <p>
                  Compliance mandates for <strong>{selectedCategory.categoryName || selectedCategory.CategoryName}</strong> under marketplace & Indian statutory regulations:
                </p>
                <div className="flex items-center gap-3 pt-1 text-[11px] font-bold text-amber-800 flex-wrap">
                  <span className="bg-white/80 px-2 py-0.5 rounded-md border border-amber-200">
                    Total: {activeCategoryDocs.length}
                  </span>
                  <span className="bg-white/80 px-2 py-0.5 rounded-md border border-amber-200">
                    Mandatory: {mandatoryDocs.length}
                  </span>
                  <span className="bg-white/80 px-2 py-0.5 rounded-md border border-amber-200">
                    Uploaded: {onboardingData?.documents.filter((d) =>
                      activeCategoryDocs.some((req) => req.code === d.code)
                    ).length ?? 0} / {activeCategoryDocs.length}
                  </span>
                  {missingMandatoryDocs.length > 0 && (
                    <span className="bg-rose-100 px-2 py-0.5 rounded-md border border-rose-300 text-rose-800">
                      Missing Mandatory: {missingMandatoryDocs.length}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Document upload cards */}
          <div className="space-y-6">
            {loadingCategoryDocs ? (
              <div className="py-16 flex flex-col items-center justify-center text-stone-400 gap-3">
                <RefreshCw className="w-8 h-8 animate-spin text-[#7E2532]" />
                <span className="text-xs font-bold uppercase tracking-wider text-stone-600">
                  Loading compliance rules for {selectedCategory?.CategoryName || 'category'}...
                </span>
              </div>
            ) : activeCategoryDocs.length === 0 ? (
              <div className="p-10 text-center bg-[#FAF8F5] rounded-3xl border border-dashed border-[#ECE5DC] space-y-3">
                <p className="text-xs text-stone-600 font-medium">
                  Please select your primary operating category in Step 1 to load compliance document requirements.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveStep(1)}
                  className="px-5 py-2.5 bg-[#7E2532] text-white text-xs font-bold rounded-2xl shadow-md"
                >
                  Go to Step 1: Select Category
                </button>
              </div>
            ) : (
              activeCategoryDocs.map((docDef) => {
                const uploadedDoc = onboardingData?.documents.find((d) => d.code === docDef.code);
                const isUploading = uploadingDoc === docDef.code;
                const isApprovedDoc = uploadedDoc?.verificationStatus === 'APPROVED';
                const isRejectedDoc = uploadedDoc?.verificationStatus === 'REJECTED';
                // Approved docs verified by admin are fully locked from replacing
                const isLocked = isApprovedDoc || isPending || isApproved;

                return (
                  <div
                    key={docDef.code}
                    className={`p-6 rounded-2xl border transition-all ${
                      isApprovedDoc
                        ? 'border-emerald-200 bg-emerald-50/40'
                        : isRejectedDoc
                        ? 'border-rose-200 bg-rose-50/30'
                        : 'border-[#ECE5DC] bg-[#FAF8F5] hover:border-[#DACFBF]'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-black text-stone-900">{docDef.displayName}</span>
                          {docDef.isMandatory ? (
                            <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 text-[10px] font-bold">Mandatory</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-500 text-[10px] font-bold">Optional</span>
                          )}
                          {isApprovedDoc && (
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center gap-1">
                              <Check className="w-3 h-3" /> Verified & Locked
                            </span>
                          )}
                          {uploadedDoc?.verificationStatus === 'PENDING' && (
                            <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold flex items-center gap-1">
                              <Clock className="w-3 h-3" /> Uploaded — Pending Admin Verification
                            </span>
                          )}
                          {isRejectedDoc && (
                            <span className="px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" /> Rejected — Re-upload Required
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-stone-500 font-medium">
                          {getDocDescription(docDef.code, docDef.displayName, docDef.isMandatory, selectedCategory?.categoryName || selectedCategory?.CategoryName)}
                        </p>
                      </div>

                      {uploadedDoc?.documentUrl && (
                        <button
                          type="button"
                          onClick={() => setPreviewDoc({ url: uploadedDoc.documentUrl!, title: docDef.displayName, code: docDef.code })}
                          className="inline-flex items-center gap-1 text-xs font-bold text-[#7E2532] hover:underline shrink-0 cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5" /> View Current
                        </button>
                      )}
                    </div>

                    {/* Rejection reason from admin */}
                    {isRejectedDoc && uploadedDoc?.rejectionReason && (
                      <div className="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium flex items-start gap-2">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-500" />
                        <span><strong>Admin Rejection Reason:</strong> {uploadedDoc.rejectionReason}</span>
                      </div>
                    )}

                    {/* Approved doc — locked notice */}
                    {isApprovedDoc ? (
                      <div className="mt-4 pt-4 border-t border-emerald-200/60 flex items-center gap-2 text-xs text-emerald-700 font-semibold">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        This document has been verified by the compliance team and is locked.
                        {uploadedDoc?.certificateNumber && (
                          <span className="ml-auto font-mono font-bold text-emerald-900 bg-emerald-100 px-2 py-0.5 rounded-lg">
                            {uploadedDoc.certificateNumber}
                          </span>
                        )}
                      </div>
                    ) : isPending || isApproved ? (
                      /* Under review — show read-only cert number only */
                      <div className="mt-4 pt-4 border-t border-stone-200/60 text-xs text-stone-500 font-medium flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5" />
                        Submitted for review.
                        {uploadedDoc?.certificateNumber && (
                          <span className="font-mono font-bold text-stone-700 bg-stone-100 px-2 py-0.5 rounded-lg ml-auto">
                            {uploadedDoc.certificateNumber}
                          </span>
                        )}
                      </div>
                    ) : (
                      /* Editable upload controls */
                      <div className="mt-4 pt-4 border-t border-stone-200/70 grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                        <div>
                          <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1.5">
                            Certificate / Registration Number
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              disabled={isLocked}
                              value={certNumbers[docDef.code] || ''}
                              onChange={(e) =>
                                setCertNumbers({ ...certNumbers, [docDef.code]: e.target.value.toUpperCase() })
                              }
                              placeholder={getDocPlaceholder(docDef.code)}
                              className="flex-1 px-3.5 py-2.5 rounded-xl bg-white border border-[#E0D8CD] text-xs font-mono font-bold text-stone-900 uppercase focus:outline-none focus:ring-2 focus:ring-[#7E2532]/25 disabled:opacity-60"
                            />
                            {!isLocked && (
                              <button
                                type="button"
                                onClick={() => handleSaveCertNumber(docDef.code)}
                                className="px-3 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-[11px] font-bold transition-colors shrink-0"
                                title="Save certificate number"
                              >
                                Save
                              </button>
                            )}
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1.5">
                            {isRejectedDoc ? 'Re-upload Document (Required)' : 'Upload Document (PDF, PNG, JPG)'}
                          </label>
                          <label
                            className={`w-full py-2.5 px-4 rounded-xl border border-dashed text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                              isLocked
                                ? 'bg-stone-100 border-stone-200 text-stone-400 cursor-not-allowed'
                                : isRejectedDoc
                                ? 'bg-white border-rose-400 hover:border-rose-600 text-rose-700 hover:bg-rose-50'
                                : 'bg-white border-[#7E2532]/40 hover:border-[#7E2532] text-[#7E2532] hover:bg-[#FDF8F8]'
                            }`}
                          >
                            {isUploading ? (
                              <><RefreshCw className="w-4 h-4 animate-spin" /> Uploading...</>
                            ) : (
                              <><Upload className="w-4 h-4" /> {uploadedDoc ? 'Replace Document' : 'Select File'}</>
                            )}
                            <input
                              type="file"
                              disabled={isLocked || isUploading}
                              accept=".pdf,.png,.jpg,.jpeg,.webp"
                              className="hidden"
                              onChange={(e) => {
                                if (e.target.files?.[0]) {
                                  handleFileUpload(docDef, e.target.files[0]);
                                  // reset input so same file can be re-selected if needed
                                  e.target.value = '';
                                }
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div className="pt-6 border-t border-stone-100 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setActiveStep(1)}
              className="px-5 py-3 rounded-2xl border border-stone-200 text-xs font-bold text-stone-600 hover:bg-stone-50 flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Profile
            </button>
            <button
              type="button"
              onClick={() => setActiveStep(3)}
              disabled={activeCategoryDocs.length === 0}
              className="px-6 py-3.5 bg-gradient-to-r from-[#7E2532] to-[#9E2C3F] hover:from-[#641D26] hover:to-[#7E2532] text-white text-xs font-bold rounded-2xl shadow-lg shadow-[#7E2532]/25 flex items-center gap-2 transition-all disabled:opacity-50"
            >
              Continue to Final Review <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          STEP 3: REVIEW & PLATFORM AGREEMENT
         ══════════════════════════════════════════════ */}
      {activeStep === 3 && (
        <div className="bg-white rounded-3xl p-8 border border-[#ECE5DC] shadow-sm space-y-8">
          <div className="border-b border-stone-100 pb-4">
            <div className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider mb-1 ${isApproved ? 'text-emerald-700' : 'text-[#7E2532]'}`}>
              <ShieldCheck className="w-4 h-4" /> {isApproved ? 'Compliance Sign-Off Complete' : 'Final Compliance Sign-Off'}
            </div>
            <h2 className="text-lg font-black text-stone-900">
              {isApproved ? 'Step 3: Approved Seller Agreement & Compliance Dossier' : 'Step 3: Review Application & Legal Agreement'}
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              {isApproved
                ? 'Your legal business credentials and category compliance documents are verified and authorized for marketplace operations.'
                : 'Review your master legal application and verify uploaded compliance documents before submitting.'}
            </p>
          </div>

          {/* Missing mandatory docs warning */}
          {!isReadyToSubmit && !isPending && !isApproved && activeCategoryDocs.length > 0 && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs">
                <p className="font-bold text-rose-900">
                  Action Required: {missingMandatoryDocs.length} Mandatory Document{missingMandatoryDocs.length > 1 ? 's' : ''} Missing
                </p>
                <p className="text-rose-700">
                  Application for <strong>{selectedCategory?.CategoryName || 'chosen category'}</strong> cannot be submitted until all statutory documents are uploaded:
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {missingMandatoryDocs.map((doc) => (
                    <span key={doc.code} className="px-2.5 py-1 bg-white border border-rose-300 text-rose-800 rounded-lg font-mono font-bold text-[11px]">
                      {doc.displayName} ({doc.code})
                    </span>
                  ))}
                </div>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveStep(2)}
                    className="px-3.5 py-1.5 bg-rose-600 text-white rounded-xl font-bold text-xs hover:bg-rose-700 transition-colors inline-flex items-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" /> Upload Missing Documents in Step 2
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Application summary card */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 rounded-2xl bg-[#FAF8F5] border border-[#ECE5DC]">
            <div className="space-y-4">
              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400 block border-b border-[#ECE5DC] pb-1.5">
                Business & Brand Identity
              </span>
              {[
                { label: 'Legal Entity Name', value: formData.businessName || 'Not specified', bold: true },
                { label: 'Brand / Trade Name', value: formData.sellerName || 'Not specified', highlight: true },
                { label: 'Primary Category', value: selectedCategory?.CategoryName || onboardingData?.application?.categoryName || 'Not specified' },
              ].map(({ label, value, bold, highlight }) => (
                <div key={label}>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">{label}</span>
                  <span className={`text-sm mt-0.5 block ${bold ? 'font-black text-stone-900' : highlight ? 'font-bold text-[#7E2532]' : 'font-semibold text-stone-800'}`}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
            <div className="space-y-4">
              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400 block border-b border-[#ECE5DC] pb-1.5">
                Registered Contact Information
              </span>
              {[
                { label: 'Official Email', value: formData.email || 'Not specified' },
                { label: 'Registered Mobile', value: formData.phoneNumber || 'Not specified', mono: true },
                ...(formData.instagramUrl ? [{ label: 'Instagram', value: formData.instagramUrl }] : []),
                ...(formData.facebookUrl ? [{ label: 'Facebook', value: formData.facebookUrl }] : []),
                ...(formData.youtubeUrl ? [{ label: 'YouTube', value: formData.youtubeUrl }] : []),
                ...(formData.linkedinUrl ? [{ label: 'LinkedIn', value: formData.linkedinUrl }] : []),
              ].map(({ label, value, mono }) => (
                <div key={label}>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">{label}</span>
                  <span className={`text-xs mt-0.5 block font-semibold text-stone-800 ${mono ? 'font-mono' : ''}`}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Compliance checklist table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-[#7E2532]" />
                Compliance Documents Checklist
              </h3>
              <span className="text-[11px] text-stone-500 font-medium">
                Category: <strong>{selectedCategory?.categoryName || selectedCategory?.CategoryName || 'General'}</strong>
              </span>
            </div>

            <div className="border border-[#ECE5DC] rounded-2xl overflow-hidden divide-y divide-[#ECE5DC]">
              {activeCategoryDocs.length === 0 ? (
                <div className="p-6 text-center text-xs text-stone-400">
                  No document requirements loaded. Please select a category in Step 1.
                </div>
              ) : (
                activeCategoryDocs.map((req) => {
                  const uploaded = onboardingData?.documents.find((d) => d.code === req.code);
                  const vs = uploaded?.verificationStatus;
                  return (
                    <div key={req.code} className="p-4 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-stone-50/50">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-stone-900">{req.displayName}</span>
                          <span className="font-mono text-[10px] text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded">{req.code}</span>
                          {req.isMandatory ? (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-50 text-rose-700">Mandatory</span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-stone-100 text-stone-600">Optional</span>
                          )}
                        </div>
                        <p className="text-[11px] text-stone-400 font-medium">
                          {uploaded?.certificateNumber ? (
                            <span className="font-mono text-stone-700">Cert No: {uploaded.certificateNumber}</span>
                          ) : (
                            'No certificate number recorded'
                          )}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {vs === 'APPROVED' ? (
                          <>
                            <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center gap-1">
                              <ShieldCheck className="w-3 h-3" /> Verified
                            </span>
                            {uploaded?.documentUrl && (
                              <button
                                type="button"
                                onClick={() => setPreviewDoc({ url: uploaded.documentUrl!, title: req.displayName, code: req.code })}
                                className="text-xs text-[#7E2532] font-bold hover:underline inline-flex items-center gap-1 cursor-pointer"
                              >
                                <FileText className="w-3.5 h-3.5" /> View
                              </button>
                            )}
                          </>
                        ) : vs === 'PENDING' ? (
                          <>
                            <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold flex items-center gap-1">
                              <Clock className="w-3 h-3" /> Pending Review
                            </span>
                            {uploaded?.documentUrl && (
                              <button
                                type="button"
                                onClick={() => setPreviewDoc({ url: uploaded.documentUrl!, title: req.displayName, code: req.code })}
                                className="text-xs text-[#7E2532] font-bold hover:underline inline-flex items-center gap-1 cursor-pointer"
                              >
                                <FileText className="w-3.5 h-3.5" /> View
                              </button>
                            )}
                          </>
                        ) : vs === 'REJECTED' ? (
                          <div className="flex flex-col items-end gap-1">
                            <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" /> Rejected
                            </span>
                            {uploaded?.rejectionReason && (
                              <span className="text-[10px] text-rose-600 italic max-w-[180px] text-right">
                                "{uploaded.rejectionReason}"
                              </span>
                            )}
                            <button type="button" onClick={() => setActiveStep(2)}
                              className="text-xs text-[#7E2532] font-bold hover:underline">
                              Re-upload in Step 2
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" /> Missing
                            </span>
                            <button type="button" onClick={() => setActiveStep(2)}
                              className="text-xs text-[#7E2532] font-bold hover:underline">
                              Upload
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Legal Consent */}
          <div className="p-5 rounded-2xl bg-white border border-[#E0D8CD] flex items-start gap-3.5">
            <input
              type="checkbox"
              id="agreementConsent"
              checked={formData.consentGranted}
              disabled={isPending || isApproved}
              onChange={(e) => setFormData({ ...formData, consentGranted: e.target.checked })}
              className="w-4 h-4 mt-1 rounded text-[#7E2532] focus:ring-[#7E2532] accent-[#7E2532] cursor-pointer disabled:cursor-not-allowed"
            />
            <div className="text-xs text-stone-600 leading-relaxed select-none">
              <label htmlFor="agreementConsent" className={`cursor-pointer ${isPending || isApproved ? 'cursor-not-allowed' : ''}`}>
                I hereby declare that I am authorized to represent{' '}
                <strong className="text-stone-900">{formData.businessName || 'this business entity'}</strong>.
                All submitted GSTIN, PAN, and category compliance certificates are authentic, legally valid,
                and compliant under Indian statutory regulations.
              </label>{' '}
              I have read and agree to the{' '}
              <button
                type="button"
                onClick={() => setTermsModalOpen(true)}
                className="text-[#7E2532] font-bold underline hover:text-[#9E2C3F] inline-flex items-center gap-0.5"
              >
                Marketplace Master Seller Terms & Conditions (v1.0)
                <ExternalLink className="w-3 h-3 inline" />
              </button>
              .
            </div>
          </div>

          {/* Navigation & Submit */}
          <div className="pt-6 border-t border-stone-100 flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => setActiveStep(2)}
              disabled={isPending || isApproved}
              className="px-5 py-3 rounded-2xl border border-stone-200 text-xs font-bold text-stone-600 hover:bg-stone-50 flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Documents
            </button>

            <div className="flex items-center gap-3">
              {/* Status indicator when submitted or approved */}
              {isPending && (
                <span className="text-xs text-amber-700 font-bold flex items-center gap-1.5">
                  <Clock className="w-4 h-4" /> Application Under Review
                </span>
              )}
              {isApproved && (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-emerald-700 font-bold flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200">
                    <CheckCircle2 className="w-4 h-4" /> Seller Verified & Active
                  </span>
                  <button
                    type="button"
                    onClick={() => navigate('/')}
                    className="px-6 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white text-xs font-black rounded-2xl shadow-lg shadow-emerald-700/20 flex items-center gap-2 transition-all"
                  >
                    Go to Seller Dashboard <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Submit button — hidden when already submitted or approved */}
              {!isPending && !isApproved && (
                <button
                  type="button"
                  onClick={handleSubmitFinal}
                  disabled={submitting || !formData.consentGranted || !isReadyToSubmit}
                  className="px-8 py-3.5 bg-gradient-to-r from-[#7E2532] to-[#9E2C3F] hover:from-[#641D26] hover:to-[#7E2532] text-white text-xs font-extrabold rounded-2xl shadow-xl shadow-[#7E2532]/25 flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <><RefreshCw className="w-4 h-4 animate-spin" /> Submitting Dossier...</>
                  ) : !isReadyToSubmit ? (
                    <><AlertTriangle className="w-4 h-4" /> Upload Mandatory Docs to Submit</>
                  ) : !formData.consentGranted ? (
                    <><FileText className="w-4 h-4" /> Accept Declaration to Submit</>
                  ) : (
                    <><ShieldCheck className="w-4 h-4" /> Submit Application for Review</>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Terms & Conditions Modal ── */}
      {termsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-2xl border border-[#ECE5DC] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-6 border-b border-[#ECE5DC] flex items-center justify-between bg-[#FAF8F5]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#7E2532]/10 flex items-center justify-center text-[#7E2532]">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-stone-900">Marketplace Master Seller Agreement</h2>
                  <p className="text-xs text-stone-500 font-medium">Standard Seller Terms & Operating Policy (v1.0)</p>
                </div>
              </div>
              <button type="button" onClick={() => setTermsModalOpen(false)}
                className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-xs text-stone-700 leading-relaxed">
              {[
                {
                  title: '1. Regulatory Compliance & Product Authenticity',
                  body: 'The Seller warrants that all listed items are authentic, brand new, and strictly comply with applicable Indian statutory standards, including BIS Quality Control Orders, FSSAI regulations, and the Legal Metrology (Packaged Commodities) Rules.',
                },
                {
                  title: '2. Settlement & Payout Cycles',
                  body: 'Net proceeds from fulfilled marketplace orders will be settled to the Seller\'s verified bank account on a T+2 business day cycle following customer delivery confirmation, deducting platform commission and statutory TDS (Section 194-O) / TCS (GST).',
                },
                {
                  title: '3. Order Fulfillment & Warehouse Operations',
                  body: 'Orders routed to designated marketplace fulfillment centers or seller warehouses must be packed and ready for carrier dispatch within agreed SLA windows (standard: 24 hours from order creation).',
                },
                {
                  title: '4. Cancellation & Customer Return Undertaking',
                  body: 'The Seller agrees to honor platform return and replacement policies for defective, damaged, or mismatched merchandise as mandated under the Consumer Protection (E-Commerce) Rules.',
                },
              ].map(({ title, body }) => (
                <section key={title} className="space-y-1.5">
                  <h4 className="font-bold text-stone-900 text-sm">{title}</h4>
                  <p>{body}</p>
                </section>
              ))}
            </div>

            <div className="p-4 border-t border-[#ECE5DC] bg-[#FAF8F5] flex items-center justify-between gap-3">
              <button type="button" onClick={() => setTermsModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-stone-600 hover:bg-stone-200/50 rounded-xl">
                Close Window
              </button>
              <button
                type="button"
                onClick={() => {
                  setFormData((prev) => ({ ...prev, consentGranted: true }));
                  setTermsModalOpen(false);
                }}
                className="px-5 py-2.5 bg-gradient-to-r from-[#7E2532] to-[#9E2C3F] hover:from-[#641D26] hover:to-[#7E2532] text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" /> I Accept & Agree to Terms
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-page Document Preview Overlay */}
      <DocumentPreviewModal
        isOpen={!!previewDoc}
        onClose={() => setPreviewDoc(null)}
        documentUrl={previewDoc?.url || null}
        title={previewDoc?.title || 'Compliance Document'}
        code={previewDoc?.code}
      />
    </div>
  );
};
