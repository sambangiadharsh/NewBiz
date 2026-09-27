import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Warehouse,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Check,
  Navigation,
} from 'lucide-react';
import { apiClient } from '../../lib/axios.js';

interface AddWarehouseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface DocRequirement {
  documentTypeId: number;
  code: string;
  displayName: string;
  warehouseType: string;
  isRequired: boolean;
}

type WarehouseType = 'OWN' | '3PL';

interface DocUploadState {
  file: File | null;
  documentNumber: string;
}

export const AddWarehouseModal: React.FC<AddWarehouseModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [warehouseType, setWarehouseType] = useState<WarehouseType>('OWN');

  const [formData, setFormData] = useState({
    warehouseName: '',
    contactPersonName: '',
    contactEmail: '',
    contactPhoneNumber: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'India',
    latitude: '',
    longitude: '',
    isPrimary: false,
  });

  // Compliance doc uploads map: key is documentTypeCode
  const [docUploads, setDocUploads] = useState<Record<string, DocUploadState>>({});
  const [consentAgreed, setConsentAgreed] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dynamic document requirements
  const [docRequirements, setDocRequirements] = useState<DocRequirement[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);

  // Fetch document requirements whenever type changes
  const fetchDocRequirements = useCallback(async (type: WarehouseType) => {
    setDocsLoading(true);
    try {
      const res = await apiClient.get(`/seller/warehouses/document-requirements?type=${type}`);
      if (res.data.success) {
        setDocRequirements(res.data.data || []);
      }
    } catch {
      setDocRequirements([]);
    } finally {
      setDocsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchDocRequirements(warehouseType);
    }
  }, [isOpen, warehouseType, fetchDocRequirements]);

  // Reset when closed
  useEffect(() => {
    if (!isOpen) {
      setStep(1);
      setWarehouseType('OWN');
      setFormData({
        warehouseName: '',
        contactPersonName: '',
        contactEmail: '',
        contactPhoneNumber: '',
        addressLine1: '',
        addressLine2: '',
        city: '',
        state: '',
        postalCode: '',
        country: 'India',
        latitude: '',
        longitude: '',
        isPrimary: false,
      });
      setDocUploads({});
      setConsentAgreed(false);
      setError(null);
      setDocRequirements([]);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTypeChange = (type: WarehouseType) => {
    setWarehouseType(type);
    setError(null);
  };

  const handleDocFileChange = (code: string, file: File | null) => {
    setDocUploads((prev) => ({
      ...prev,
      [code]: {
        ...(prev[code] || { documentNumber: '' }),
        file,
      },
    }));
  };

  const handleDocNumChange = (code: string, documentNumber: string) => {
    setDocUploads((prev) => ({
      ...prev,
      [code]: {
        ...(prev[code] || { file: null }),
        documentNumber,
      },
    }));
  };

  // Step 1 validation
  const validateStep1 = () => {
    setError(null);
    if (!formData.warehouseName.trim()) {
      setError('Warehouse name is required');
      return false;
    }
    return true;
  };

  // Step 2 validationan
  const validateStep2 = () => {
    setError(null);
    if (!formData.addressLine1.trim()) {
      setError('Physical address line 1 is required');
      return false;
    }
    if (!formData.city.trim() || !formData.state.trim() || !formData.postalCode.trim()) {
      setError('City, State, and Postal PIN code are required');
      return false;
    }

    const hasLat = Boolean(formData.latitude.trim());
    const hasLng = Boolean(formData.longitude.trim());

    if (hasLat || hasLng) {
      if (!hasLat || !hasLng) {
        setError('Please provide both Latitude and Longitude if entering GPS coordinates');
        return false;
      }
      const lat = parseFloat(formData.latitude);
      if (isNaN(lat) || lat < -90 || lat > 90) {
        setError('Latitude must be a valid number between -90 and 90');
        return false;
      }
      const lng = parseFloat(formData.longitude);
      if (isNaN(lng) || lng < -180 || lng > 180) {
        setError('Longitude must be a valid number between -180 and 180');
        return false;
      }
    }

    return true;
  };

  // Final submit on Step 3
  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Check mandatory document requirements
    const mandatoryMissing = docRequirements
      .filter((req) => req.isRequired)
      .some((req) => !docUploads[req.code]?.file);

    if (mandatoryMissing) {
      setError('Please upload all mandatory compliance documents before submitting');
      return;
    }

    if (!consentAgreed) {
      setError('You must accept the warehouse safety and dispatch declaration');
      return;
    }

    setLoading(true);
    try {
      // 1. Create warehouse (warehouse code is system generated automatically)
      const res = await apiClient.post('/seller/warehouses', {
        ...formData,
        warehouseType,
        warehouseName: formData.warehouseName.trim(),
        latitude: formData.latitude.trim() ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude.trim() ? parseFloat(formData.longitude) : null,
      });

      if (res.data.success && res.data.data) {
        const warehouseId = res.data.data.warehouseId;

        // 2. Upload each selected document
        for (const [docCode, uploadState] of Object.entries(docUploads)) {
          if (uploadState.file) {
            const fd = new FormData();
            fd.append('file', uploadState.file);
            fd.append('documentTypeCode', docCode);
            if (uploadState.documentNumber.trim()) {
              fd.append('documentNumber', uploadState.documentNumber.trim());
            }

            try {
              await apiClient.post(`/seller/warehouses/${warehouseId}/documents`, fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
              });
            } catch (uploadErr) {
              console.warn(`Failed to upload doc ${docCode}:`, uploadErr);
            }
          }
        }

        onSuccess();
        onClose();
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to register warehouse');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-stone-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-[#FCFAF7] rounded-3xl border border-[#E8E1D7] shadow-2xl my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="bg-[#641D26] px-6 sm:px-8 py-5 text-white flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-rose-200/80 text-xs font-bold uppercase tracking-wider mb-0.5">
              <Warehouse className="w-4 h-4" />
              Warehouse Onboarding Wizard
            </div>
            <h2 className="text-xl font-black tracking-tight text-white">
              Register Warehouse
            </h2>
            <p className="text-xs text-rose-100/70 mt-0.5">
              Step {step} of 3 • {step === 1 ? 'Operating Model & Identity' : step === 2 ? 'Dispatch Location & Specs' : 'Compliance & Document Uploads'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Wizard Steps Progress Bar */}
        <div className="bg-[#52171F] px-8 py-2.5 flex items-center justify-between text-xs text-rose-200/80 font-bold border-t border-rose-900/40">
          <div className={`flex items-center gap-2 ${step === 1 ? 'text-white font-extrabold' : 'opacity-70'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 1 ? 'bg-white text-[#641D26]' : 'bg-white/20 text-white'}`}>1</span>
            <span>Identity</span>
          </div>
          <div className="w-8 h-0.5 bg-white/20" />
          <div className={`flex items-center gap-2 ${step === 2 ? 'text-white font-extrabold' : 'opacity-70'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 2 ? 'bg-white text-[#641D26]' : 'bg-white/20 text-white'}`}>2</span>
            <span>Location</span>
          </div>
          <div className="w-8 h-0.5 bg-white/20" />
          <div className={`flex items-center gap-2 ${step === 3 ? 'text-white font-extrabold' : 'opacity-70'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 3 ? 'bg-white text-[#641D26]' : 'bg-white/20 text-white'}`}>3</span>
            <span>Compliance Docs</span>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="m-6 mb-0 p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-rose-800 text-xs font-semibold">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Wizard Body */}
        <div className="p-6 sm:p-8 max-h-[65vh] overflow-y-auto space-y-6">

          {/* ═══════════════════════════════════════════════════════════════
              STEP 1: OPERATING MODEL & WAREHOUSE IDENTITY
              ═══════════════════════════════════════════════════════════════ */}
          {step === 1 && (
            <div className="space-y-5">
              {/* Operating Model Choice */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-[#221C1E] uppercase tracking-wider block">
                  Operating Model <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  
                  {/* OWN */}
                  <button
                    type="button"
                    onClick={() => handleTypeChange('OWN')}
                    className={`p-4 rounded-2xl border-2 text-left flex items-start gap-3 transition-all ${
                      warehouseType === 'OWN'
                        ? 'border-[#7E2532] bg-[#7E2532]/5 ring-2 ring-[#7E2532]/10'
                        : 'border-stone-200 bg-white hover:border-[#7E2532]/40'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                      warehouseType === 'OWN' ? 'bg-[#7E2532] text-white' : 'border-2 border-stone-300'
                    }`}>
                      {warehouseType === 'OWN' && <Check className="w-3.5 h-3.5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#221C1E]">OWN (Seller-Operated)</span>
                      </div>
                      <p className="text-[11px] text-stone-500 mt-1">
                        Warehouse is owned, leased, or directly managed by your enterprise.
                      </p>
                    </div>
                  </button>

                  {/* 3PL */}
                  <button
                    type="button"
                    onClick={() => handleTypeChange('3PL')}
                    className={`p-4 rounded-2xl border-2 text-left flex items-start gap-3 transition-all ${
                      warehouseType === '3PL'
                        ? 'border-purple-600 bg-purple-50 ring-2 ring-purple-600/10'
                        : 'border-stone-200 bg-white hover:border-purple-400/50'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                      warehouseType === '3PL' ? 'bg-purple-600 text-white' : 'border-2 border-stone-300'
                    }`}>
                      {warehouseType === '3PL' && <Check className="w-3.5 h-3.5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#221C1E]">3PL Partner Logistics</span>
                      </div>
                      <p className="text-[11px] text-stone-500 mt-1">
                        Contracted third-party warehousing & fulfillment hub provider.
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Warehouse Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#221C1E] uppercase tracking-wider block">
                  Warehouse Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Bhiwandi Mega Hub - Sector 4"
                  value={formData.warehouseName}
                  onChange={(e) => setFormData({ ...formData, warehouseName: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-2xl bg-white border border-stone-200 text-xs text-[#221C1E] focus:outline-none focus:ring-2 focus:ring-[#7E2532]/20 focus:border-[#7E2532]"
                />
              </div>

              {/* Contact Information */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#221C1E] uppercase tracking-wider block">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    placeholder="Warehouse Manager"
                    value={formData.contactPersonName}
                    onChange={(e) => setFormData({ ...formData, contactPersonName: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-2xl bg-white border border-stone-200 text-xs text-[#221C1E] focus:outline-none focus:ring-2 focus:ring-[#7E2532]/20"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#221C1E] uppercase tracking-wider block">
                    Contact Email
                  </label>
                  <input
                    type="email"
                    placeholder="dispatch@brand.com"
                    value={formData.contactEmail}
                    onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-2xl bg-white border border-stone-200 text-xs text-[#221C1E] focus:outline-none focus:ring-2 focus:ring-[#7E2532]/20"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#221C1E] uppercase tracking-wider block">
                    Contact Phone
                  </label>
                  <input
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={formData.contactPhoneNumber}
                    onChange={(e) => setFormData({ ...formData, contactPhoneNumber: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-2xl bg-white border border-stone-200 text-xs text-[#221C1E] focus:outline-none focus:ring-2 focus:ring-[#7E2532]/20"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              STEP 2: LOCATION & DISPATCH SPECS
              ═══════════════════════════════════════════════════════════════ */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#221C1E] uppercase tracking-wider block">
                  Address Line 1 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Plot No. / Survey No., Industrial Area, Street Name"
                  value={formData.addressLine1}
                  onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-2xl bg-white border border-stone-200 text-xs text-[#221C1E] focus:outline-none focus:ring-2 focus:ring-[#7E2532]/20"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#221C1E] uppercase tracking-wider block">
                  Address Line 2 (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Building Name, Landmark, Gate No."
                  value={formData.addressLine2}
                  onChange={(e) => setFormData({ ...formData, addressLine2: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-2xl bg-white border border-stone-200 text-xs text-[#221C1E] focus:outline-none focus:ring-2 focus:ring-[#7E2532]/20"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#221C1E] uppercase tracking-wider block">
                    City <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Bhiwandi"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-2xl bg-white border border-stone-200 text-xs text-[#221C1E] focus:outline-none focus:ring-2 focus:ring-[#7E2532]/20"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#221C1E] uppercase tracking-wider block">
                    State <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Maharashtra"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-2xl bg-white border border-stone-200 text-xs text-[#221C1E] focus:outline-none focus:ring-2 focus:ring-[#7E2532]/20"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#221C1E] uppercase tracking-wider block">
                    PIN Code <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="421302"
                    value={formData.postalCode}
                    onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-2xl bg-white border border-stone-200 text-xs font-mono text-[#221C1E] focus:outline-none focus:ring-2 focus:ring-[#7E2532]/20"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#221C1E] uppercase tracking-wider block">
                    Country
                  </label>
                  <input
                    type="text"
                    disabled
                    value={formData.country}
                    className="w-full px-4 py-2.5 rounded-2xl bg-stone-100 border border-stone-200 text-xs text-stone-500 font-semibold"
                  />
                </div>
              </div>

              {/* Geographic Coordinates (GPS / Lat-Long) */}
              <div className="p-4 rounded-2xl bg-white border border-stone-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Navigation className="w-4 h-4 text-[#7E2532]" />
                    <span className="text-xs font-bold text-[#221C1E] uppercase tracking-wider">
                      Geographic Coordinates (GPS / Lat-Long)
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full border border-stone-200">
                    Optional
                  </span>
                </div>
                <p className="text-[11px] text-stone-500 leading-relaxed">
                  Enter precise warehouse GPS coordinates to optimize carrier route planning, fleet tracking, and 3PL dispatch.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#221C1E] uppercase tracking-wider block">
                      Latitude
                    </label>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. 19.2942"
                      value={formData.latitude}
                      onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-2xl bg-[#FCFAF7] border border-stone-200 text-xs font-mono text-[#221C1E] placeholder:text-stone-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#7E2532]/20 focus:border-[#7E2532]"
                    />
                    <span className="text-[10px] text-stone-400">Valid range: -90.0 to 90.0</span>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#221C1E] uppercase tracking-wider block">
                      Longitude
                    </label>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. 73.0634"
                      value={formData.longitude}
                      onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-2xl bg-[#FCFAF7] border border-stone-200 text-xs font-mono text-[#221C1E] placeholder:text-stone-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#7E2532]/20 focus:border-[#7E2532]"
                    />
                    <span className="text-[10px] text-stone-400">Valid range: -180.0 to 180.0</span>
                  </div>
                </div>
              </div>

              {/* Primary Warehouse Toggle */}
              <div className="p-4 rounded-2xl bg-white border border-stone-200 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-[#221C1E] block">Set as Primary Dispatch Hub</span>
                  <span className="text-[11px] text-stone-500">
                    Orders will route to this warehouse by default when stock is available.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={formData.isPrimary}
                  onChange={(e) => setFormData({ ...formData, isPrimary: e.target.checked })}
                  className="w-4 h-4 text-[#7E2532] rounded focus:ring-[#7E2532]"
                />
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              STEP 3: COMPLIANCE DOCUMENTS & DECLARATIONS
              ═══════════════════════════════════════════════════════════════ */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="bg-amber-50/60 p-4 rounded-2xl border border-amber-200/80 text-xs text-amber-900">
                <span className="font-bold block mb-0.5">Required Statutory Compliance Documentation</span>
                <span className="text-amber-800/80">
                  Please upload valid supporting proof for this warehouse location. Admin verification will inspect these documents.
                </span>
              </div>

              {docsLoading ? (
                <div className="p-8 text-center text-stone-400 flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-[#7E2532]" />
                  <span className="text-xs font-medium">Loading required document checklists...</span>
                </div>
              ) : (
                <div className="space-y-4">
                  {docRequirements.map((req) => {
                    const currentDoc = docUploads[req.code] || { file: null, documentNumber: '' };
                    return (
                      <div
                        key={req.documentTypeId}
                        className="p-4 rounded-2xl bg-white border border-stone-200 hover:border-stone-300 space-y-3 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-bold text-[#221C1E]">{req.displayName}</h4>
                              {req.isRequired && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-600 border border-rose-100">
                                  REQUIRED
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] font-mono text-stone-400 mt-0.5 block">
                              Requirement Code: {req.code}
                            </span>
                          </div>

                          {currentDoc.file && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              <CheckCircle2 className="w-3.5 h-3.5" /> File Selected
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                          <div>
                            <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block mb-1">
                              Document / Certificate Ref Number
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. GSTIN / Lease Reg No."
                              value={currentDoc.documentNumber}
                              onChange={(e) => handleDocNumChange(req.code, e.target.value)}
                              className="w-full px-3 py-2 rounded-xl bg-stone-50 border border-stone-200 text-xs text-[#221C1E] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#7E2532]/20"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block mb-1">
                              Upload Proof (PDF / Image) {req.isRequired && <span className="text-rose-500">*</span>}
                            </label>
                            <input
                              type="file"
                              accept=".pdf,.png,.jpg,.jpeg"
                              onChange={(e) => handleDocFileChange(req.code, e.target.files?.[0] || null)}
                              className="w-full text-xs text-stone-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#7E2532]/10 file:text-[#7E2532] hover:file:bg-[#7E2532]/20 cursor-pointer"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Legal Declaration */}
              <div className="p-4 rounded-2xl bg-white border border-stone-200 flex items-start gap-3">
                <input
                  type="checkbox"
                  id="safetyConsent"
                  checked={consentAgreed}
                  onChange={(e) => setConsentAgreed(e.target.checked)}
                  className="w-4 h-4 text-[#7E2532] rounded focus:ring-[#7E2532] mt-0.5 shrink-0"
                />
                <label htmlFor="safetyConsent" className="text-xs text-stone-600 leading-relaxed cursor-pointer">
                  <strong className="text-[#221C1E]">Statutory Safety & Dispatch Declaration:</strong> I hereby certify that the warehouse adheres to all municipal safety regulations, fire security codes, and commercial tax registrations (including APOB/VPOB endorsements where applicable).
                </label>
              </div>
            </div>
          )}

        </div>

        {/* Wizard Footer Navigation */}
        <div className="p-6 bg-stone-50 border-t border-stone-200 flex items-center justify-between">
          <div>
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => (s - 1) as any)}
                className="px-4 py-2 rounded-2xl bg-white border border-stone-200 hover:bg-stone-100 text-xs font-bold text-stone-700 transition-colors flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-2xl text-stone-500 hover:text-stone-800 text-xs font-bold transition-colors"
              >
                Cancel
              </button>
            )}
          </div>

          <div>
            {step < 3 ? (
              <button
                type="button"
                onClick={() => {
                  if (step === 1 && validateStep1()) setStep(2);
                  if (step === 2 && validateStep2()) setStep(3);
                }}
                className="px-5 py-2.5 rounded-2xl bg-[#7E2532] hover:bg-[#641D26] text-white text-xs font-bold transition-colors flex items-center gap-1.5 shadow-md shadow-[#7E2532]/20"
              >
                <span>Continue to Step {step + 1}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                disabled={loading}
                onClick={handleFinalSubmit}
                className="px-6 py-2.5 rounded-2xl bg-[#7E2532] hover:bg-[#641D26] text-white text-xs font-bold transition-colors flex items-center gap-2 shadow-lg shadow-[#7E2532]/30 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Submitting Warehouse Dossier...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Submit Warehouse for Verification</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
