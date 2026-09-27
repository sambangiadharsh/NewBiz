import React, { useState, useEffect } from 'react';
import {
  X,
  FileCheck,
  Plus,
  Trash2,
  AlertCircle,
  Loader2,
  ShieldCheck
} from 'lucide-react';
import { apiClient } from '../../lib/axios.js';

interface CategoryDocItem {
  categoryDocumentId?: number;
  categoryId: number;
  documentTypeId: number;
  code: string;
  displayName: string;
  isMandatory: boolean;
  status: string;
  isInherited?: boolean;
  inheritedFrom?: {
    categoryId: number;
    categoryName: string;
    categoryCode?: string | null;
  };
}

interface DocumentTypeOption {
  documentTypeId: number;
  code: string;
  displayName: string;
}

interface CategoryDocumentsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  category: {
    categoryId: number;
    categoryName: string;
    categoryCode?: string;
    isLeaf: boolean;
  } | null;
  onUpdateSuccess: () => void;
}

export const CategoryDocumentsDrawer: React.FC<CategoryDocumentsDrawerProps> = ({
  isOpen,
  onClose,
  category,
  onUpdateSuccess,
}) => {
  const [docs, setDocs] = useState<CategoryDocItem[]>([]);
  const [allDocTypes, setAllDocTypes] = useState<DocumentTypeOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New Link Form
  const [selectedDocTypeId, setSelectedDocTypeId] = useState<string>('');
  const [isMandatory, setIsMandatory] = useState<boolean>(true);
  const [linking, setLinking] = useState(false);

  const fetchCategoryDocs = async () => {
    if (!category) return;
    try {
      setLoading(true);
      setError(null);
      const [catDocsRes, allTypesRes] = await Promise.all([
        apiClient.get(`/admin/categories/${category.categoryId}/documents`),
        apiClient.get('/admin/categories/document-types'),
      ]);

      if (catDocsRes.data?.success) {
        setDocs(catDocsRes.data.data || []);
      }
      if (allTypesRes.data?.success) {
        setAllDocTypes(allTypesRes.data.data || []);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load document requirements');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && category) {
      fetchCategoryDocs();
      setSelectedDocTypeId('');
      setIsMandatory(true);
    }
  }, [isOpen, category]);

  if (!isOpen || !category) return null;

  const linkedDocTypeIds = new Set(docs.map((d) => d.documentTypeId));
  const availableDocTypes = allDocTypes.filter((dt) => !linkedDocTypeIds.has(dt.documentTypeId));

  const handleLinkDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDocTypeId) return;

    try {
      setLinking(true);
      setError(null);
      await apiClient.post(`/admin/categories/${category.categoryId}/documents`, {
        documentTypeId: parseInt(selectedDocTypeId, 10),
        isMandatory,
        status: 'ACTIVE',
      });
      setSelectedDocTypeId('');
      fetchCategoryDocs();
      onUpdateSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to add document requirement');
    } finally {
      setLinking(false);
    }
  };

  const handleToggleMandatory = async (item: CategoryDocItem) => {
    try {
      await apiClient.post(`/admin/categories/${category.categoryId}/documents`, {
        documentTypeId: item.documentTypeId,
        isMandatory: !item.isMandatory,
        status: 'ACTIVE',
      });
      fetchCategoryDocs();
      onUpdateSuccess();
    } catch (err: any) {
      setError('Failed to update mandatory status');
    }
  };

  const handleRemove = async (documentTypeId: number) => {
    if (!confirm('Are you sure you want to remove this document requirement from this category?')) return;
    try {
      await apiClient.delete(`/admin/categories/${category.categoryId}/documents/${documentTypeId}`);
      fetchCategoryDocs();
      onUpdateSuccess();
    } catch (err: any) {
      setError('Failed to remove document requirement');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-end overflow-hidden animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-xl h-full shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">{category.categoryName}</h3>
                {category.categoryCode && (
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                    {category.categoryCode}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Configure mandatory seller verification dossiers for this category
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Quick Notice */}
          <div className="p-4 bg-indigo-50/60 border border-indigo-100 rounded-2xl flex items-start gap-3 text-xs text-indigo-900">
            <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold">Seller Compliance Rule Enforcement</p>
              <p className="text-slate-600 leading-relaxed text-[11px]">
                When sellers apply to sell in <strong className="text-slate-900">{category.categoryName}</strong>, our onboarding workflow will strictly require all documents marked as <strong className="text-indigo-900">Mandatory</strong> before their application can be reviewed and approved.
              </p>
            </div>
          </div>

          {/* Existing Documents List */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Active Document Requirements ({docs.length})
              </h4>
              <span className="text-[11px] text-slate-400">
                {docs.filter((d) => d.isMandatory).length} Mandatory •{' '}
                {docs.filter((d) => !d.isMandatory).length} Optional
              </span>
            </div>

            {loading ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-100">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-600 mb-2" />
                <p className="text-xs text-slate-500 font-medium">Loading requirements...</p>
              </div>
            ) : docs.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <FileCheck className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <p className="text-xs font-bold text-slate-700">No Document Requirements Configured</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Sellers can apply to sell in this category with general profile info alone.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {docs.map((doc) => (
                  <div
                    key={doc.documentTypeId}
                    className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 transition-all flex items-center justify-between gap-3 shadow-sm"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                          {doc.code}
                        </span>
                        <h5 className="text-sm font-bold text-slate-900">{doc.displayName}</h5>
                        {doc.isInherited && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                            Inherited from {doc.inheritedFrom?.categoryName}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Requirement Status:{' '}
                        <strong className={doc.isMandatory ? 'text-amber-700' : 'text-slate-600'}>
                          {doc.isMandatory ? 'Mandatory for Onboarding' : 'Optional / Recommended'}
                        </strong>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleMandatory(doc)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                          doc.isMandatory
                            ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                        title="Click to toggle Mandatory status"
                      >
                        {doc.isMandatory ? 'Mandatory' : 'Optional'}
                      </button>

                      {!doc.isInherited ? (
                        <button
                          type="button"
                          onClick={() => handleRemove(doc.documentTypeId)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                          title="Remove requirement"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      ) : (
                        <span
                          className="p-2 text-slate-300 cursor-not-allowed"
                          title={`Inherited from parent category "${doc.inheritedFrom?.categoryName}". Manage it at the parent category level.`}
                        >
                          <Trash2 className="w-4 h-4 opacity-30" />
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add New Requirement Form */}
          <div className="pt-4 border-t border-slate-100">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              Assign New Document Requirement
            </h4>

            {availableDocTypes.length === 0 ? (
              <div className="p-4 bg-slate-50 rounded-xl text-xs text-slate-500 text-center">
                All registered document types are already mapped to this category.
              </div>
            ) : (
              <form
                onSubmit={handleLinkDocument}
                className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3"
              >
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Select Document Type
                  </label>
                  <select
                    required
                    value={selectedDocTypeId}
                    onChange={(e) => setSelectedDocTypeId(e.target.value)}
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">-- Choose document specification --</option>
                    {availableDocTypes.map((dt) => (
                      <option key={dt.documentTypeId} value={dt.documentTypeId}>
                        {dt.displayName} ({dt.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={isMandatory}
                      onChange={(e) => setIsMandatory(e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                    />
                    <span>Strictly Mandatory for Seller Approval</span>
                  </label>

                  <button
                    type="submit"
                    disabled={!selectedDocTypeId || linking}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm disabled:opacity-50 transition-all flex items-center gap-1.5"
                  >
                    {linking ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Plus className="w-3.5 h-3.5" />
                    )}
                    <span>Link Requirement</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/80 flex items-center justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
