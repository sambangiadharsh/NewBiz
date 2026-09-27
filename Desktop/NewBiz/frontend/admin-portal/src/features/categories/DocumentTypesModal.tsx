import React, { useState, useEffect } from 'react';
import { X, FileText, Plus, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { apiClient } from '../../lib/axios.js';

interface DocumentTypeItem {
  documentTypeId: number;
  code: string;
  displayName: string;
  status: string;
  assignedCategoriesCount?: number;
}

interface DocumentTypesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DocumentTypesModal: React.FC<DocumentTypesModalProps> = ({ isOpen, onClose }) => {
  const [docTypes, setDocTypes] = useState<DocumentTypeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New Type Form
  const [showAddForm, setShowAddForm] = useState(false);
  const [code, setCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchDocumentTypes = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient.get('/admin/categories/document-types');
      if (res.data?.success) {
        setDocTypes(res.data.data || []);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load document types');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDocumentTypes();
      setShowAddForm(false);
      setCode('');
      setDisplayName('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !displayName.trim()) return;

    try {
      setCreating(true);
      setError(null);
      await apiClient.post('/admin/categories/document-types', {
        code: code.trim().toUpperCase(),
        displayName: displayName.trim(),
        status: 'ACTIVE',
      });
      setCode('');
      setDisplayName('');
      setShowAddForm(false);
      fetchDocumentTypes();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to register document type');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Master Document Types Registry</h3>
              <p className="text-xs text-slate-500">
                Compliance document classifications available across marketplace categories
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

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Action Bar */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Registered Documents ({docTypes.length})
            </span>
            <button
              type="button"
              onClick={() => setShowAddForm(!showAddForm)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{showAddForm ? 'Cancel Registration' : 'Register New Type'}</span>
            </button>
          </div>

          {/* Inline Create Form */}
          {showAddForm && (
            <form
              onSubmit={handleCreate}
              className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3"
            >
              <h4 className="text-xs font-bold text-slate-900">Register New Compliance Document Type</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Document Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. BIS_CERT, ISO_9001"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold uppercase text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Display Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Bureau of Indian Standards Certificate"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={creating || !code.trim() || !displayName.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm disabled:opacity-50 transition-all flex items-center gap-1.5"
                >
                  {creating ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                  <span>Save Document Type</span>
                </button>
              </div>
            </form>
          )}

          {/* Table */}
          {loading ? (
            <div className="p-8 text-center">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-600 mb-2" />
              <p className="text-xs text-slate-500">Loading document registry...</p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="px-4 py-3">Code</th>
                    <th className="px-4 py-3">Document Title</th>
                    <th className="px-4 py-3">Assigned Categories</th>
                    <th className="px-4 py-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {docTypes.map((dt) => (
                    <tr key={dt.documentTypeId} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">
                        {dt.code}
                      </td>
                      <td className="px-4 py-3 text-slate-800">
                        {dt.displayName}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        <span className="font-semibold text-slate-900">{dt.assignedCategoriesCount ?? 0}</span> category mapping(s)
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" /> Active
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/80 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
