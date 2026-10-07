import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  PackagePlus,
  Loader2,
  Building2,
  Sliders,
  Layers,
  FileCheck,
} from 'lucide-react';
import { useProductForm, STEP_STORAGE_KEY } from '../../hooks/useProductForm.js';
import { Step1ProductInfo } from './steps/Step1ProductInfo.js';
import { Step2Specifications } from './steps/Step2Specifications.js';
import { Step3Variants } from './steps/Step3Variants.js';
import { Step4Review } from './steps/Step4Review.js';
import { apiClient } from '../../lib/axios.js';
import { showSweetToast, confirmProceed } from '../../lib/swal.js';

const STEPS = [
  { id: 1, title: 'Product Info', icon: Building2 },
  { id: 2, title: 'Specifications', icon: Sliders },
  { id: 3, title: 'Variants', icon: Layers },
  { id: 4, title: 'Review & Publish', icon: FileCheck },
];

export const CreateProductPage: React.FC = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    state,
    setField,
    setResolvedAttributes,
    updateSpec,
    addVariant,
    updateVariant,
    removeVariant,
    duplicateVariant,
    clearProductDraft,
    loadSavedDraft,
    hasSavedDraft,
  } = useProductForm();

  const hasCheckedDraftRef = useRef(false);

  // Check for unsaved draft on mount and prompt user with SweetAlert (Option C)
  useEffect(() => {
    if (hasCheckedDraftRef.current) return;
    hasCheckedDraftRef.current = true;

    if (hasSavedDraft()) {
      confirmProceed({
        title: 'Restore Unsaved Draft?',
        text: 'You have an unsaved product draft from your previous session. Would you like to restore it or start fresh?',
        confirmButtonText: 'Restore Draft',
        cancelButtonText: 'Start Fresh',
        icon: 'question',
      }).then((shouldRestore) => {
        if (shouldRestore) {
          const success = loadSavedDraft();
          if (success) {
            try {
              const savedStep = parseInt(sessionStorage.getItem(STEP_STORAGE_KEY) || '1', 10);
              if (savedStep >= 1 && savedStep <= 4) {
                setCurrentStep(savedStep);
              }
            } catch {
              // ignore
            }
            showSweetToast('Draft restored successfully.', 'success');
          }
        } else {
          clearProductDraft();
          setCurrentStep(1);
          showSweetToast('Started with a fresh form.', 'info');
        }
      });
    }
  }, [hasSavedDraft, loadSavedDraft, clearProductDraft]);

  // Save current step to sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem(STEP_STORAGE_KEY, String(currentStep));
    } catch {
      // ignore
    }
  }, [currentStep]);

  // Determine if category has specs
  const hasSpecs = Boolean(
    state.resolvedAttributes &&
    (state.resolvedAttributes.requiredSpecs.length > 0 ||
      state.resolvedAttributes.optionalSpecs.length > 0)
  );

  const validateStep = (step: number): boolean => {
    setSubmitError(null);

    if (step === 1) {
      if (!state.brandId) {
        showSweetToast('Please select a Brand.', 'warning');
        return false;
      }
      if (!state.leafCategoryId) {
        showSweetToast('Please select a Leaf Category.', 'warning');
        return false;
      }
      if (!state.productName || state.productName.trim().length < 3) {
        showSweetToast('Product title must be at least 3 characters long.', 'warning');
        return false;
      }
      return true;
    }

    if (step === 2) {
      const requiredSpecs = state.specifications.filter((s) => s.isRequired);
      for (const spec of requiredSpecs) {
        const val = spec.attributeValue?.trim() || spec.attributeValueId;
        if (!val) {
          showSweetToast(`Required specification "${spec.attributeName}" is missing.`, 'warning');
          return false;
        }
      }
      return true;
    }

    if (step === 3) {
      if (state.variants.length === 0) {
        showSweetToast('Please define at least one variant before proceeding.', 'warning');
        return false;
      }
      return true;
    }

    return true;
  };

  const handleNext = () => {
    if (!validateStep(currentStep)) return;

    if (currentStep === 1) {
      // If category has no specs, skip Step 2 and proceed directly to Step 3
      if (hasSpecs) {
        setCurrentStep(2);
      } else {
        setCurrentStep(3);
      }
    } else if (currentStep === 2) {
      setCurrentStep(3);
    } else if (currentStep === 3) {
      setCurrentStep(4);
    }
  };

  const handleBack = () => {
    setSubmitError(null);
    if (currentStep === 4) {
      setCurrentStep(3);
    } else if (currentStep === 3) {
      // If category had no specs, back from 3 goes to 1
      setCurrentStep(hasSpecs ? 2 : 1);
    } else if (currentStep === 2) {
      setCurrentStep(1);
    } else if (currentStep === 1) {
      navigate('/catalog/products');
    }
  };

  const handleSubmit = async () => {
    if (!validateStep(3)) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const payload = {
        brandId: state.brandId,
        leafCategoryId: state.leafCategoryId,
        productName: state.productName.trim(),
        description: state.description.trim() || undefined,
        highlights: state.highlights.filter(Boolean),
        baseModelCode: state.baseModelCode.trim() || undefined,
        hsnCode: state.hsnCode.trim() || undefined,
        gstRate: state.gstRate !== '' ? Number(state.gstRate) : undefined,
        initialStatus: state.initialStatus,
        specifications: state.specifications
          .filter((s) => Boolean(s.attributeValue?.trim() || s.attributeValueId))
          .map((s) => ({
            attributeId: s.attributeId,
            attributeValueId: s.attributeValueId && String(s.attributeValueId).trim() ? String(s.attributeValueId) : undefined,
            attributeValue: s.attributeValue ? s.attributeValue.trim() : '',
          })),
        variants: state.variants.map((v) => ({
          attributeValues: v.attributeValues.map((av) => ({
            attributeId: av.attributeId,
            attributeValueId: av.attributeValueId && String(av.attributeValueId).trim() ? av.attributeValueId : undefined,
            attributeValue: av.valueName || '',
            valueName: av.valueName || '',
          })),
          gtin: v.gtin.trim() || undefined,
          variantModelCode: v.variantModelCode.trim() || undefined,
          length: v.length !== '' ? Number(v.length) : undefined,
          width: v.width !== '' ? Number(v.width) : undefined,
          height: v.height !== '' ? Number(v.height) : undefined,
          weight: v.weight !== '' ? Number(v.weight) : undefined,
          capacity: v.capacity !== '' ? Number(v.capacity) : undefined,
          uoms: (v.uoms || [])
            .filter((u) => Boolean(u.uomId && String(u.uomId).trim()))
            .map((u) => ({
              uomId: String(u.uomId),
              quantity: Number(u.quantity) || 1,
            })),
          assets: (v.assets || [])
            .filter((a) => Boolean(a.assetUrl && a.assetUrl.trim()))
            .map((a, i) => ({
              assetType: a.assetType || 'IMAGE',
              assetUrl: a.assetUrl.trim(),
              isPrimary: a.isPrimary,
              altText: a.altText ? a.altText.trim() : undefined,
              displayOrder: a.displayOrder || i + 1,
            })),
        })),
      };

      const res = await apiClient.post('/admin/catalog/products/create', payload);

      if (res.data?.success) {
        clearProductDraft();
        const prod = res.data.data;
        showSweetToast(
          `Product created! Parent SKU: ${prod.parentSku}`,
          'success'
        );
        navigate('/catalog/products');
      }
    } catch (err: any) {
      console.error('Failed to create product', err);
      const msg =
        err.response?.data?.message ||
        err.message ||
        'An error occurred while creating product.';
      setSubmitError(msg);
      showSweetToast(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16">
      {/* Top Breadcrumb & Heading */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() => navigate('/catalog/products')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors mb-2 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Products</span>
          </button>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <PackagePlus className="w-6 h-6 text-indigo-600" />
            Create Catalog Master Product
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Admin pre-verified product creation. Product will be instantly verified and published to the live marketplace catalog.
          </p>
        </div>
      </div>

      {/* Stepper Progress Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
        <div className="flex items-center justify-between relative">
          {STEPS.map((step, idx) => {
            const isCompleted = currentStep > step.id;
            const isCurrent = currentStep === step.id;
            const StepIcon = step.icon;

            return (
              <React.Fragment key={step.id}>
                {/* Step Node */}
                <div
                  className="flex items-center gap-3 z-10 cursor-pointer"
                  onClick={() => {
                    // Only allow navigating backwards or to validated step
                    if (step.id < currentStep) {
                      setCurrentStep(step.id);
                    }
                  }}
                >
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs transition-all ${isCompleted
                        ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/20'
                        : isCurrent
                          ? 'bg-gradient-to-r from-[#635BFF] to-[#7C5CFC] text-white shadow-md shadow-indigo-500/30 ring-4 ring-indigo-50'
                          : 'bg-slate-100 text-slate-400'
                      }`}
                  >
                    {isCompleted ? <Check className="w-4 h-4 stroke-[3]" /> : <StepIcon className="w-4 h-4" />}
                  </div>
                  <div className="hidden md:block text-left">
                    <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                      Step 0{step.id}
                    </div>
                    <div
                      className={`text-xs font-semibold ${isCurrent ? 'text-indigo-600' : isCompleted ? 'text-slate-800' : 'text-slate-400'
                        }`}
                    >
                      {step.title}
                    </div>
                  </div>
                </div>

                {/* Connecting Line */}
                {idx < STEPS.length - 1 && (
                  <div className="flex-1 mx-3 h-0.5 bg-slate-100 relative">
                    <div
                      className="absolute inset-0 bg-indigo-500 transition-all duration-300"
                      style={{
                        width: isCompleted ? '100%' : '0%',
                      }}
                    />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Submission Error Banner */}
      {submitError && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs font-medium flex items-center gap-2">
          <span>{submitError}</span>
        </div>
      )}

      {/* Active Step Content */}
      <div className="min-h-[400px]">
        {currentStep === 1 && (
          <Step1ProductInfo
            state={state}
            setField={setField}
            setResolvedAttributes={setResolvedAttributes}
          />
        )}

        {currentStep === 2 && (
          <Step2Specifications state={state} updateSpec={updateSpec} />
        )}

        {currentStep === 3 && (
          <Step3Variants
            state={state}
            addVariant={addVariant}
            updateVariant={updateVariant}
            removeVariant={removeVariant}
            duplicateVariant={duplicateVariant}
          />
        )}

        {currentStep === 4 && (
          <Step4Review
            state={state}
            setField={setField}
            categoryPath={state.resolvedAttributes?.categoryName}
          />
        )}
      </div>

      {/* Wizard Footer Controls */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex items-center justify-between">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{currentStep === 1 ? 'Cancel' : 'Back'}</span>
        </button>

        {currentStep < 4 ? (
          <button
            type="button"
            onClick={handleNext}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-[#635BFF] to-[#7C5CFC] hover:opacity-90 text-white text-xs font-semibold rounded-xl shadow-md shadow-indigo-500/20 transition-all cursor-pointer"
          >
            <span>Continue to Next Step</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-7 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-90 text-white text-xs font-semibold rounded-xl shadow-md shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Creating Product...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4 stroke-[3]" />
                <span>
                  {state.initialStatus === 'ACTIVE'
                    ? 'Create Product & Publish'
                    : 'Save Product as Draft'}
                </span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};
