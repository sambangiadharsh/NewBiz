import React, { useState, useEffect } from 'react';
import { X, FolderPlus, Edit3, Loader2, AlertCircle } from 'lucide-react';
import { apiClient } from '../../lib/axios.js';

interface CategoryItem {
  categoryId: number;
  categoryName: string;
  categoryCode?: string;
  parentCategoryId?: number | null;
  description?: string;
  iconUrl?: string;
  imageUrl?: string;
  status: string;
}

interface CreateCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingCategory?: CategoryItem | null;
  allCategories: CategoryItem[];
}

export const CreateCategoryModal: React.FC<CreateCategoryModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  editingCategory,
  allCategories,
}) => {
  const [categoryName, setCategoryName] = useState('');
  const [categoryCode, setCategoryCode] = useState('');
  const [parentCategoryId, setParentCategoryId] = useState<string>('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editingCategory) {
      setCategoryName(editingCategory.categoryName || '');
      setCategoryCode(editingCategory.categoryCode || '');
      setParentCategoryId(editingCategory.parentCategoryId ? String(editingCategory.parentCategoryId) : '');
      setDescription(editingCategory.description || '');
      setStatus((editingCategory.status as 'ACTIVE' | 'INACTIVE') || 'ACTIVE');
    } else {
      setCategoryName('');
      setCategoryCode('');
      setParentCategoryId('');
      setDescription('');
      setStatus('ACTIVE');
    }
    setError(null);
  }, [editingCategory, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryName.trim()) {
      setError('Category name is required.');
      return;
    }
    if (!categoryCode.trim()) {
      setError('Category code is required (e.g. DRO, APP, FD).');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const payload = {
        categoryName: categoryName.trim(),
        categoryCode: categoryCode.trim().toUpperCase(),
        parentCategoryId: parentCategoryId ? parseInt(parentCategoryId, 10) : null,
        description: description.trim() || undefined,
        status,
      };

      if (editingCategory) {
        await apiClient.put(`/admin/categories/${editingCategory.categoryId}`, payload);
      } else {
        await apiClient.post('/admin/categories', payload);
      }

      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.response?.data?.message || 'Failed to save category');
    } finally {
      setSubmitting(false);
    }
  };

  // Prevent circular parent selection
  const validParentCategories = allCategories.filter(
    (c) => !editingCategory || c.categoryId !== editingCategory.categoryId
  );

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center">
              {editingCategory ? <Edit3 className="w-5 h-5" /> : <FolderPlus className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {editingCategory ? 'Edit Category' : 'Create New Category'}
              </h3>
              <p className="text-xs text-slate-500">
                {editingCategory ? 'Update category code, hierarchy or status' : 'Define taxonomy node & SKU segment code'}
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Category Name *
            </label>
            <input
              type="text"
              required
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              placeholder="e.g. Consumer Electronics, Drone Tech, Apparel"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Category Code (SKU Prefix) *
              </label>
              <input
                type="text"
                required
                maxLength={10}
                value={categoryCode}
                onChange={(e) => setCategoryCode(e.target.value.toUpperCase())}
                placeholder="e.g. DRO, APP, FD"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold text-slate-900 uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Used in ParentSKU: <code className="font-bold">BRD-{categoryCode || 'CAT'}-000001</code>
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'ACTIVE' | 'INACTIVE')}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
              >
                <option value="ACTIVE">ACTIVE (Visible)</option>
                <option value="INACTIVE">INACTIVE (Hidden)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Parent Category (Optional)
            </label>
            <select
              value={parentCategoryId}
              onChange={(e) => setParentCategoryId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
            >
              <option value="">None (Top-Level / Root Category)</option>
              {validParentCategories.map((c) => (
                <option key={c.categoryId} value={c.categoryId}>
                  {c.categoryName} ({c.categoryCode || 'No code'})
                </option>
              ))}
            </select>
            <span className="text-[11px] text-slate-400 mt-1 block">
              Leave as None if this is a primary top-level department.
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Description (Optional)
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide a concise description of products encompassed by this category..."
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
            />
          </div>

          {/* Footer actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-600/20 disabled:opacity-50 transition-all flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <span>{editingCategory ? 'Update Category' : 'Create Category'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
