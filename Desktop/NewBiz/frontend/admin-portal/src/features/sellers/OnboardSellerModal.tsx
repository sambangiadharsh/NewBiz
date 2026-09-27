import React, { useState, useEffect } from 'react';
import {
  X,
  UserPlus,
  Store,
  Building2,
  Mail,
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import { apiClient } from '../../lib/axios.js';

interface Category {
  CategoryID: number;
  ParentCategoryID: number | null;
  CategoryName: string;
  isLeaf?: boolean;
}

interface OnboardSellerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface CreatedSellerResult {
  sellerId: number;
  sellerCode: string;
  sellerName: string;
  businessName: string;
  email: string;
  categoryName: string;
  status: string;
  applicationId: number;
  userCredentials: {
    email: string;
    temporaryPassword: string;
  };
}

export const OnboardSellerModal: React.FC<OnboardSellerModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [createdResult, setCreatedResult] = useState<CreatedSellerResult | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  // Form State
  const [formData, setFormData] = useState({
    sellerName: '',
    businessName: '',
    email: '',
    phoneNumber: '',
    primaryCategoryId: '',
    gstNumber: '',
    panNumber: '',
    temporaryPassword: 'Seller@123',
    initialStatus: 'APPROVED' as 'APPROVED' | 'PENDING',
  });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      setCreatedResult(null);
      setError(null);
      setFieldErrors({});
      setCopied(false);
      setLoadingCategories(true);

      apiClient
        .get('/categories')
        .then((res) => {
          if (res.data.success) {
            setCategories(res.data.data);
          }
        })
        .catch((err) => {
          console.error('Failed to load categories:', err);
        })
        .finally(() => setLoadingCategories(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.sellerName.trim()) errors.sellerName = 'Brand / Store name is required';
    if (!formData.businessName.trim()) errors.businessName = 'Legal business entity name is required';
    if (!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
      errors.email = 'Valid seller email is required';
    if (!formData.phoneNumber.trim() || !/^[6-9]\d{9}$/.test(formData.phoneNumber.replace(/\s/g, '')))
      errors.phoneNumber = 'Enter a valid 10-digit Indian mobile number';
    if (!formData.primaryCategoryId) errors.primaryCategoryId = 'Please select a primary operating category';

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      const res = await apiClient.post('/admin/sellers/onboard', {
        sellerName: formData.sellerName.trim(),
        businessName: formData.businessName.trim(),
        email: formData.email.trim().toLowerCase(),
        phoneNumber: formData.phoneNumber.trim(),
        primaryCategoryId: Number(formData.primaryCategoryId),
        gstNumber: formData.gstNumber.trim().toUpperCase() || undefined,
        panNumber: formData.panNumber.trim().toUpperCase() || undefined,
        temporaryPassword: formData.temporaryPassword.trim() || 'Seller@123',
        initialStatus: formData.initialStatus,
      });

      if (res.data.success) {
        setCreatedResult(res.data.data);
        onSuccess();
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to onboard seller');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyCredentials = () => {
    if (!createdResult) return;
    const text = `SellerStudio Login Details:
Portal URL: http://localhost:5174/login
Seller Code: ${createdResult.sellerCode}
Email: ${createdResult.userCredentials.email}
Temporary Password: ${createdResult.userCredentials.temporaryPassword}
Status: ${createdResult.status}`;

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-3xl w-full max-w-2xl border border-slate-200 shadow-2xl overflow-hidden my-8 transition-all animate-in fade-in zoom-in-95 duration-200">

        {/* ── Modal Header ── */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 via-white to-indigo-50/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#635BFF]/10 flex items-center justify-center text-[#635BFF] shadow-sm">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">Assisted Seller Onboarding</h2>
              <p className="text-xs text-slate-500 font-medium">
                Provision a verified seller account and generate seller access credentials
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Success Screen ── */}
        {createdResult ? (
          <div className="p-8 space-y-6">
            <div className="p-6 rounded-3xl bg-emerald-50 border border-emerald-200 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-emerald-950">Seller Successfully Onboarded!</h3>
                <p className="text-xs text-emerald-700 font-medium mt-1">
                  <strong>{createdResult.businessName}</strong> ({createdResult.sellerCode}) has been provisioned and linked to category <strong>{createdResult.categoryName}</strong>.
                </p>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-200/60 text-emerald-900 text-xs font-bold">
                <ShieldCheck className="w-3.5 h-3.5" />
                Status: {createdResult.status === 'ACTIVE' ? 'Active & KYC Approved' : 'Pending Verification'}
              </div>
            </div>

            {/* Generated Credentials Box */}
            <div className="bg-slate-900 text-white rounded-3xl p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Seller Access Credentials
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyCredentials}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white flex items-center gap-1.5 transition-all"
                >
                  {copied ? <><Check className="w-3.5 h-3.5 text-emerald-400" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy Details</>}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px]">Portal Login URL</span>
                  <a
                    href="http://localhost:5174/login"
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-indigo-400 font-bold hover:underline inline-flex items-center gap-1 mt-0.5"
                  >
                    http://localhost:5174/login <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Seller Code</span>
                  <span className="font-mono font-bold text-slate-200 mt-0.5 block">{createdResult.sellerCode}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Seller Email</span>
                  <span className="font-mono font-bold text-emerald-400 mt-0.5 block">{createdResult.userCredentials.email}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Temporary Password</span>
                  <span className="font-mono font-bold text-amber-300 mt-0.5 block">{createdResult.userCredentials.temporaryPassword}</span>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed border-t border-slate-800/80 pt-3">
                Provide these credentials to the seller so they can access their store on <strong>SellerStudio</strong>.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all"
              >
                Close Window
              </button>
            </div>
          </div>
        ) : (
          /* ── Registration Form ── */
          <form onSubmit={handleSubmit} className="p-6 space-y-6" noValidate>
            {error && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2.5 font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Entity Details */}
            <div className="space-y-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Store className="w-3.5 h-3.5 text-[#635BFF]" /> Business & Brand Identity
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Brand / Store Display Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.sellerName}
                    onChange={(e) => {
                      setFormData({ ...formData, sellerName: e.target.value });
                      setFieldErrors({ ...fieldErrors, sellerName: '' });
                    }}
                    placeholder="e.g. Apex Spices"
                    className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-2xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#635BFF]/20 focus:border-[#635BFF] transition-all font-medium ${
                      fieldErrors.sellerName ? 'border-rose-400' : 'border-slate-200'
                    }`}
                  />
                  {fieldErrors.sellerName && (
                    <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.sellerName}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Legal Business Entity Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.businessName}
                    onChange={(e) => {
                      setFormData({ ...formData, businessName: e.target.value });
                      setFieldErrors({ ...fieldErrors, businessName: '' });
                    }}
                    placeholder="e.g. Apex Agro Foods Pvt Ltd"
                    className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-2xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#635BFF]/20 focus:border-[#635BFF] transition-all font-medium ${
                      fieldErrors.businessName ? 'border-rose-400' : 'border-slate-200'
                    }`}
                  />
                  {fieldErrors.businessName && (
                    <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.businessName}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Seller Contact & Category */}
            <div className="space-y-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-[#635BFF]" /> Seller Account & Contact
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Seller Email (Login Account) *
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => {
                      setFormData({ ...formData, email: e.target.value });
                      setFieldErrors({ ...fieldErrors, email: '' });
                    }}
                    placeholder="seller@brand.example"
                    className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-2xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#635BFF]/20 focus:border-[#635BFF] transition-all font-medium ${
                      fieldErrors.email ? 'border-rose-400' : 'border-slate-200'
                    }`}
                  />
                  {fieldErrors.email && (
                    <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.email}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Registered Mobile Number *
                  </label>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={formData.phoneNumber}
                    onChange={(e) => {
                      setFormData({ ...formData, phoneNumber: e.target.value.replace(/\D/g, '') });
                      setFieldErrors({ ...fieldErrors, phoneNumber: '' });
                    }}
                    placeholder="e.g. 9876500000"
                    className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-2xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#635BFF]/20 focus:border-[#635BFF] transition-all font-medium ${
                      fieldErrors.phoneNumber ? 'border-rose-400' : 'border-slate-200'
                    }`}
                  />
                  {fieldErrors.phoneNumber && (
                    <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.phoneNumber}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Primary Operating Category *
                </label>
                <select
                  required
                  value={formData.primaryCategoryId}
                  onChange={(e) => {
                    setFormData({ ...formData, primaryCategoryId: e.target.value });
                    setFieldErrors({ ...fieldErrors, primaryCategoryId: '' });
                  }}
                  className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-2xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#635BFF]/20 focus:border-[#635BFF] transition-all font-medium ${
                    fieldErrors.primaryCategoryId ? 'border-rose-400' : 'border-slate-200'
                  }`}
                >
                  <option value="">-- Select Category --</option>
                  {categories.map((cat) => (
                    <option
                      key={cat.CategoryID}
                      value={cat.CategoryID}
                      disabled={cat.isLeaf === false}
                      className={cat.isLeaf === false ? 'font-bold text-slate-400 bg-slate-100' : 'text-slate-900 font-medium'}
                    >
                      {cat.isLeaf === false ? `${cat.CategoryName} (Parent Group)` : cat.CategoryName}
                    </option>
                  ))}
                </select>
                {fieldErrors.primaryCategoryId && (
                  <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.primaryCategoryId}</p>
                )}
              </div>
            </div>

            {/* Statutory Compliance (Optional) */}
            <div className="space-y-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-[#635BFF]" /> Statutory Numbers (Optional)
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    GSTIN Registration Number
                  </label>
                  <input
                    type="text"
                    maxLength={15}
                    value={formData.gstNumber}
                    onChange={(e) => setFormData({ ...formData, gstNumber: e.target.value.toUpperCase() })}
                    placeholder="e.g. 36AABCK1234F1Z5"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-900 placeholder-slate-400 uppercase font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-[#635BFF]/20 focus:border-[#635BFF] transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    PAN Card Number
                  </label>
                  <input
                    type="text"
                    maxLength={10}
                    value={formData.panNumber}
                    onChange={(e) => setFormData({ ...formData, panNumber: e.target.value.toUpperCase() })}
                    placeholder="e.g. AABCK1234F"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-900 placeholder-slate-400 uppercase font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-[#635BFF]/20 focus:border-[#635BFF] transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Activation Mode Toggle */}
            <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 flex items-center justify-between gap-4">
              <div>
                <span className="text-xs font-black text-slate-900 block">Instant Activation Mode</span>
                <span className="text-[11px] text-slate-500 font-medium block mt-0.5">
                  Directly approves KYC credentials and authorizes store for commercial listings immediately.
                </span>
              </div>
              <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200 shrink-0">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, initialStatus: 'APPROVED' })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                    formData.initialStatus === 'APPROVED'
                      ? 'bg-[#635BFF] text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Approve Now
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, initialStatus: 'PENDING' })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                    formData.initialStatus === 'PENDING'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Leave Pending
                </button>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-2xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || loadingCategories}
                className="px-6 py-3 bg-gradient-to-r from-[#635BFF] to-[#7C5CFC] hover:from-[#5147FF] hover:to-[#6C4BF5] text-white text-xs font-black rounded-2xl shadow-lg shadow-indigo-500/25 flex items-center gap-2 transition-all disabled:opacity-50"
              >
                {submitting ? (
                  <>Provisioning Seller...</>
                ) : (
                  <><Sparkles className="w-4 h-4" />  Onboard Seller</>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
