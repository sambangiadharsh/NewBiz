import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  HelpCircle,
  Phone,
  Share2,
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  EyeOff,
  Globe,
  Archive,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Instagram,
  Twitter,
  Facebook,
  Linkedin,
  Youtube,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { cmsApi, type CMSPage, type FAQItem, type ContactInfo, type SocialPlatform } from './cmsApi.js';
import { RichTextEditor } from '../../components/RichTextEditor.js';
import { confirmProceed, showSweetToast } from '../../lib/swal.js';

// ─── Utility ────────────────────────────────────────────────────────────────

const toSlug = (text: string) =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

const PAGE_TYPE_OPTIONS = [
  { value: 'PRIVACY_POLICY', label: 'Privacy Policy', icon: '🔒' },
  { value: 'TERMS_OF_SERVICE', label: 'Terms of Service', icon: '📋' },
  { value: 'COOKIE_POLICY', label: 'Cookie Policy', icon: '🍪' },
  { value: 'ABOUT_US', label: 'About Us', icon: '👋' },
  { value: 'CAREERS', label: 'Careers', icon: '💼' },
  { value: 'RETURN_POLICY', label: 'Return Policy', icon: '↩️' },
  { value: 'SHIPPING_POLICY', label: 'Shipping & Express Delivery', icon: '🚚' },
  { value: 'CUSTOM', label: 'Custom Page', icon: '📄' },
];

const STATUS_CONFIG = {
  PUBLISHED: { label: 'Published', icon: Globe, color: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
  DRAFT: { label: 'Draft', icon: EyeOff, color: 'text-amber-600 bg-amber-50 border-amber-100' },
  ARCHIVED: { label: 'Archived', icon: Archive, color: 'text-slate-500 bg-slate-50 border-slate-200' },
};

const SOCIAL_PLATFORMS: { platform: SocialPlatform; label: string; icon: React.ElementType; placeholder: string }[] = [
  { platform: 'INSTAGRAM', label: 'Instagram', icon: Instagram, placeholder: 'https://instagram.com/yourbrand' },
  { platform: 'TWITTER', label: 'Twitter / X', icon: Twitter, placeholder: 'https://twitter.com/yourbrand' },
  { platform: 'FACEBOOK', label: 'Facebook', icon: Facebook, placeholder: 'https://facebook.com/yourbrand' },
  { platform: 'LINKEDIN', label: 'LinkedIn', icon: Linkedin, placeholder: 'https://linkedin.com/company/yourbrand' },
  { platform: 'YOUTUBE', label: 'YouTube', icon: Youtube, placeholder: 'https://youtube.com/@yourbrand' },
  { platform: 'PINTEREST', label: 'Pinterest', icon: Share2, placeholder: 'https://pinterest.com/yourbrand' },
  { platform: 'TIKTOK', label: 'TikTok', icon: Share2, placeholder: 'https://tiktok.com/@yourbrand' },
  { platform: 'WHATSAPP', label: 'WhatsApp', icon: Phone, placeholder: 'https://wa.me/919876543210' },
];

// ─── Sub-components ──────────────────────────────────────────────────────────

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.DRAFT;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg.color}`}>
      <Icon className="w-2.5 h-2.5" />
      {cfg.label}
    </span>
  );
};

// ─── Tab Types ───────────────────────────────────────────────────────────────

type Tab = 'pages' | 'faqs' | 'contact' | 'social';

// ─── Main Component ──────────────────────────────────────────────────────────

export const ContentManagementPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('pages');
  const qc = useQueryClient();

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    showSweetToast(message, type);
  }, []);

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'pages', label: 'Pages & Policies', icon: FileText },
    { id: 'faqs', label: 'FAQ Management', icon: HelpCircle },
    { id: 'contact', label: 'Contact Info', icon: Phone },
    { id: 'social', label: 'Social Links', icon: Share2 },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Content Management</h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage dynamic content for your customer-facing storefront
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-2xl w-fit">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-white text-slate-900 shadow-sm font-semibold'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'pages' && <PagesTab showToast={showToast} qc={qc} />}
        {activeTab === 'faqs' && <FAQsTab showToast={showToast} qc={qc} />}
        {activeTab === 'contact' && <ContactTab showToast={showToast} qc={qc} />}
        {activeTab === 'social' && <SocialTab showToast={showToast} qc={qc} />}
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════
// PAGES TAB
// ════════════════════════════════════════════════════════════

const PagesTab: React.FC<{ showToast: (m: string, t?: 'success' | 'error') => void; qc: ReturnType<typeof useQueryClient> }> = ({ showToast, qc }) => {
  const [editingPage, setEditingPage] = useState<CMSPage | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    pageType: 'PRIVACY_POLICY',
    title: '',
    slug: '',
    content: '',
    status: 'DRAFT',
    metaTitle: '',
    metaDescription: '',
    isSystemPage: true,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['cms-pages'],
    queryFn: () => cmsApi.listPages().then((r) => r.data.data),
  });

  const createMutation = useMutation({
    mutationFn: cmsApi.createPage,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cms-pages'] }); showToast('Page created successfully'); resetForm(); },
    onError: (err: any) => showToast(err.response?.data?.message ?? 'Failed to create page', 'error'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => cmsApi.updatePage(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cms-pages'] }); showToast('Page saved successfully'); resetForm(); },
    onError: (err: any) => showToast(err.response?.data?.message ?? 'Failed to update page', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: cmsApi.deletePage,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cms-pages'] }); showToast('Page deleted'); },
    onError: (err: any) => showToast(err.response?.data?.message ?? 'Failed to delete page', 'error'),
  });

  const resetForm = () => {
    setShowForm(false);
    setEditingPage(null);
    setFormData({ pageType: 'PRIVACY_POLICY', title: '', slug: '', content: '', status: 'DRAFT', metaTitle: '', metaDescription: '', isSystemPage: true });
  };

  const openEdit = async (page: CMSPage) => {
    setEditingPage(page);
    setFormData({
      pageType: page.PageType,
      title: page.Title,
      slug: page.Slug,
      content: page.Content || '',
      status: page.Status,
      metaTitle: page.MetaTitle ?? '',
      metaDescription: page.MetaDescription ?? '',
      isSystemPage: page.IsSystemPage ?? false,
    });
    setShowForm(true);

    // Also fetch single page details to guarantee fresh full content
    try {
      const res = await cmsApi.getPage(page.PageID);
      if (res.data?.success && res.data.data) {
        const full = res.data.data;
        setFormData({
          pageType: full.PageType,
          title: full.Title,
          slug: full.Slug,
          content: full.Content || '',
          status: full.Status,
          metaTitle: full.MetaTitle ?? '',
          metaDescription: full.MetaDescription ?? '',
          isSystemPage: full.IsSystemPage ?? false,
        });
      }
    } catch {
      // Continue with current page content if single get fails
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      pageType: formData.pageType,
      title: formData.title,
      slug: formData.slug,
      content: formData.content,
      status: formData.status,
      metaTitle: formData.metaTitle || undefined,
      metaDescription: formData.metaDescription || undefined,
      isSystemPage: formData.isSystemPage,
    };
    if (editingPage) {
      updateMutation.mutate({ id: editingPage.PageID, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  if (showForm) {
    return (
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            {editingPage ? `Edit: ${editingPage.Title}` : 'Create New Page'}
          </h2>
          <button type="button" onClick={resetForm} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Content */}
          <div className="lg:col-span-2 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Content *</label>
              <RichTextEditor
                content={formData.content}
                onChange={(html) => setFormData((p) => ({ ...p, content: html }))}
                placeholder="Write your page content here..."
              />
            </div>
          </div>

          {/* Right: Settings */}
          <div className="space-y-4">
            <div className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Page Settings</h3>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Page Type *</label>
                <select
                  value={formData.pageType}
                  onChange={(e) => setFormData((p) => ({ ...p, pageType: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#635BFF]/30 focus:border-[#635BFF]"
                >
                  {PAGE_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.icon} {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Title *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value, slug: p.slug || toSlug(e.target.value) }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#635BFF]/30 focus:border-[#635BFF]"
                  placeholder="Privacy Policy"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">URL Slug *</label>
                <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-[#635BFF]/30 focus-within:border-[#635BFF]">
                  <span className="px-2 text-xs text-slate-400 bg-slate-50 border-r border-slate-200 py-2">/</span>
                  <input
                    type="text"
                    value={formData.slug}
                    onChange={(e) => setFormData((p) => ({ ...p, slug: toSlug(e.target.value) }))}
                    className="flex-1 px-3 py-2 text-sm bg-white focus:outline-none"
                    placeholder="privacy-policy"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Status</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setFormData((p) => ({ ...p, status: s }))}
                      className={`py-1.5 text-xs rounded-xl font-medium border transition-all ${
                        formData.status === s
                          ? 'bg-[#635BFF] text-white border-[#635BFF]'
                          : 'text-slate-500 border-slate-200 hover:border-[#635BFF]/50'
                      }`}
                    >
                      {s.charAt(0) + s.slice(1).toLowerCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* SEO */}
            <div className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">SEO Settings</h3>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Meta Title</label>
                <input
                  type="text"
                  value={formData.metaTitle}
                  onChange={(e) => setFormData((p) => ({ ...p, metaTitle: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#635BFF]/30 focus:border-[#635BFF]"
                  placeholder="SEO title (optional)"
                  maxLength={255}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Meta Description</label>
                <textarea
                  value={formData.metaDescription}
                  onChange={(e) => setFormData((p) => ({ ...p, metaDescription: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-[#635BFF]/30 focus:border-[#635BFF]"
                  placeholder="Meta description for search engines (optional)"
                  maxLength={500}
                />
                <p className="text-[10px] text-slate-400 mt-0.5">{formData.metaDescription.length}/500</p>
              </div>
            </div>

            {/* Save */}
            <button
              type="submit"
              disabled={isSaving}
              className="w-full flex items-center justify-center gap-2 py-3 px-6 bg-gradient-to-r from-[#635BFF] to-[#7C5CFC] text-white text-sm font-semibold rounded-2xl hover:shadow-lg hover:shadow-indigo-500/30 transition-all disabled:opacity-70"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isSaving ? 'Saving...' : editingPage ? 'Save Changes' : 'Create Page'}
            </button>
          </div>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{data?.length ?? 0} pages configured</p>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#635BFF] to-[#7C5CFC] text-white text-sm font-semibold rounded-xl hover:shadow-md hover:shadow-indigo-500/30 transition-all"
        >
          <Plus className="w-4 h-4" />
          New Page
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-[#635BFF]" />
        </div>
      ) : !data?.length ? (
        <div className="text-center py-16 text-slate-400">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">No pages yet</p>
          <p className="text-xs mt-1">Create your first CMS page like Privacy Policy or About Us</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {data.map((page) => {
            const pageType = PAGE_TYPE_OPTIONS.find((o) => o.value === page.PageType);
            return (
              <div
                key={page.PageID}
                className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl hover:border-indigo-100 hover:shadow-sm transition-all group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-lg shrink-0">
                    {pageType?.icon ?? '📄'}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900 truncate">{page.Title}</span>
                      <StatusBadge status={page.Status} />
                      {page.IsSystemPage && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 font-semibold border border-slate-200">
                          SYSTEM
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-slate-400 font-mono">/{page.Slug}</span>
                      <a
                        href={`http://localhost:7004/pages/${page.Slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-[#635BFF] hover:underline flex items-center gap-0.5"
                      >
                        Preview <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => openEdit(page)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-[#635BFF] hover:bg-indigo-50 transition-colors"
                    title="Edit page"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  {!page.IsSystemPage && (
                    <button
                      onClick={async () => {
                        const ok = await confirmProceed({
                          title: 'Delete CMS Page?',
                          text: `Are you sure you want to delete "${page.Title}"? This action cannot be undone.`,
                          confirmButtonText: 'Proceed',
                          icon: 'warning',
                        });
                        if (ok) deleteMutation.mutate(page.PageID);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                      title="Delete page"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ════════════════════════════════════════════════════════════
// FAQs TAB
// ════════════════════════════════════════════════════════════

const FAQsTab: React.FC<{ showToast: (m: string, t?: 'success' | 'error') => void; qc: ReturnType<typeof useQueryClient> }> = ({ showToast, qc }) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [addingSectionForm, setAddingSectionForm] = useState(false);
  const [newSectionData, setNewSectionData] = useState({ title: '', slug: '' });
  const [addingItemToSection, setAddingItemToSection] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<FAQItem | null>(null);
  const [itemForm, setItemForm] = useState({ question: '', answer: '' });

  const { data: sections, isLoading } = useQuery({
    queryKey: ['faq-sections'],
    queryFn: () => cmsApi.listFAQSections().then((r) => r.data.data),
  });

  const createSectionMutation = useMutation({
    mutationFn: cmsApi.createFAQSection,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['faq-sections'] }); showToast('FAQ section created'); setAddingSectionForm(false); setNewSectionData({ title: '', slug: '' }); },
    onError: (err: any) => showToast(err.response?.data?.message ?? 'Failed to create section', 'error'),
  });

  const deleteSectionMutation = useMutation({
    mutationFn: cmsApi.deleteFAQSection,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['faq-sections'] }); showToast('Section deleted'); },
    onError: () => showToast('Failed to delete section', 'error'),
  });

  const createItemMutation = useMutation({
    mutationFn: ({ sectionId, data }: { sectionId: string; data: { question: string; answer: string } }) =>
      cmsApi.createFAQItem(sectionId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['faq-sections'] }); showToast('FAQ item added'); setAddingItemToSection(null); setItemForm({ question: '', answer: '' }); },
    onError: () => showToast('Failed to add FAQ item', 'error'),
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ itemId, data }: { itemId: string; data: any }) => cmsApi.updateFAQItem(itemId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['faq-sections'] }); showToast('FAQ item updated'); setEditingItem(null); setItemForm({ question: '', answer: '' }); },
    onError: () => showToast('Failed to update FAQ item', 'error'),
  });

  const deleteItemMutation = useMutation({
    mutationFn: cmsApi.deleteFAQItem,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['faq-sections'] }); showToast('FAQ item deleted'); },
    onError: () => showToast('Failed to delete FAQ item', 'error'),
  });

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{sections?.length ?? 0} FAQ sections</p>
        <button
          onClick={() => setAddingSectionForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#635BFF] to-[#7C5CFC] text-white text-sm font-semibold rounded-xl hover:shadow-md hover:shadow-indigo-500/30 transition-all"
        >
          <Plus className="w-4 h-4" />
          Add Section
        </button>
      </div>

      {/* Add Section Form */}
      {addingSectionForm && (
        <div className="p-4 bg-white border border-indigo-100 rounded-2xl shadow-sm space-y-3">
          <h3 className="text-sm font-semibold text-slate-800">New FAQ Section</h3>
          <input
            type="text"
            value={newSectionData.title}
            onChange={(e) => setNewSectionData((p) => ({ ...p, title: e.target.value, slug: p.slug || toSlug(e.target.value) }))}
            placeholder="Section title (e.g. Orders & Shipping)"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#635BFF]/30 focus:border-[#635BFF]"
          />
          <input
            type="text"
            value={newSectionData.slug}
            onChange={(e) => setNewSectionData((p) => ({ ...p, slug: toSlug(e.target.value) }))}
            placeholder="slug (e.g. orders-shipping)"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-[#635BFF]/30 focus:border-[#635BFF]"
          />
          <div className="flex gap-2">
            <button
              onClick={() => createSectionMutation.mutate(newSectionData)}
              disabled={!newSectionData.title || !newSectionData.slug || createSectionMutation.isPending}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#635BFF] text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-60"
            >
              {createSectionMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Create Section
            </button>
            <button
              onClick={() => { setAddingSectionForm(false); setNewSectionData({ title: '', slug: '' }); }}
              className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 rounded-xl hover:bg-slate-100"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#635BFF]" /></div>
      ) : !sections?.length ? (
        <div className="text-center py-16 text-slate-400">
          <HelpCircle className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">No FAQ sections yet</p>
          <p className="text-xs mt-1">Create sections to organize your FAQs</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sections.map((section) => {
            const isExpanded = expandedSections.has(section.FAQSectionID);
            return (
              <div key={section.FAQSectionID} className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
                {/* Section header */}
                <div className="flex items-center justify-between px-4 py-3 group">
                  <button
                    onClick={() => toggleSection(section.FAQSectionID)}
                    className="flex items-center gap-3 flex-1 text-left"
                  >
                    <GripVertical className="w-3.5 h-3.5 text-slate-300" />
                    <div>
                      <span className="text-sm font-semibold text-slate-900">{section.Title}</span>
                      <span className="ml-2 text-xs text-slate-400 font-mono">{section.Slug}</span>
                      <span className="ml-2 text-xs text-slate-400">({section.FAQItems?.length ?? 0} items)</span>
                    </div>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </button>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => { setAddingItemToSection(section.FAQSectionID); setExpandedSections((p) => new Set([...p, section.FAQSectionID])); }}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-[#635BFF] hover:bg-indigo-50 rounded-lg font-medium"
                    >
                      <Plus className="w-3 h-3" /> Add Q&A
                    </button>
                    <button
                      onClick={async () => {
                        const ok = await confirmProceed({
                          title: 'Delete FAQ Section?',
                          text: `Are you sure you want to delete "${section.Title}" and all its FAQs?`,
                          confirmButtonText: 'Proceed',
                          icon: 'warning',
                        });
                        if (ok) deleteSectionMutation.mutate(section.FAQSectionID);
                      }}
                      className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Delete section"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* FAQ Items */}
                {isExpanded && (
                  <div className="border-t border-slate-50 divide-y divide-slate-50">
                    {section.FAQItems?.map((item) => (
                      <div key={item.FAQItemID} className="px-5 py-3 group">
                        {editingItem?.FAQItemID === item.FAQItemID ? (
                          <div className="space-y-2">
                            <input
                              value={itemForm.question}
                              onChange={(e) => setItemForm((p) => ({ ...p, question: e.target.value }))}
                              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#635BFF]/30 focus:border-[#635BFF]"
                              placeholder="Question"
                            />
                            <textarea
                              value={itemForm.answer}
                              onChange={(e) => setItemForm((p) => ({ ...p, answer: e.target.value }))}
                              rows={3}
                              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-[#635BFF]/30 focus:border-[#635BFF]"
                              placeholder="Answer"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => updateItemMutation.mutate({ itemId: item.FAQItemID, data: itemForm })}
                                disabled={updateItemMutation.isPending}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#635BFF] text-white text-xs font-semibold rounded-lg"
                              >
                                <Save className="w-3 h-3" /> Save
                              </button>
                              <button onClick={() => setEditingItem(null)} className="px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100 rounded-lg">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-800">{item.Question}</p>
                              <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{item.Answer}</p>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                              <button
                                onClick={() => { setEditingItem(item); setItemForm({ question: item.Question, answer: item.Answer }); }}
                                className="p-1.5 text-slate-400 hover:text-[#635BFF] hover:bg-indigo-50 rounded-lg"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                              <button
                                onClick={async () => {
                                  const ok = await confirmProceed({
                                    title: 'Delete FAQ Item?',
                                    text: 'Are you sure you want to delete this FAQ question and answer?',
                                    confirmButtonText: 'Proceed',
                                    icon: 'warning',
                                  });
                                  if (ok) deleteItemMutation.mutate(item.FAQItemID);
                                }}
                                className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg"
                                title="Delete question"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Add FAQ Item inline form */}
                    {addingItemToSection === section.FAQSectionID ? (
                      <div className="px-5 py-4 bg-indigo-50/30 space-y-2">
                        <input
                          value={itemForm.question}
                          onChange={(e) => setItemForm((p) => ({ ...p, question: e.target.value }))}
                          placeholder="Question (e.g. How do I track my order?)"
                          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#635BFF]/30 focus:border-[#635BFF]"
                        />
                        <textarea
                          value={itemForm.answer}
                          onChange={(e) => setItemForm((p) => ({ ...p, answer: e.target.value }))}
                          placeholder="Answer..."
                          rows={3}
                          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white resize-none focus:outline-none focus:ring-2 focus:ring-[#635BFF]/30 focus:border-[#635BFF]"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => createItemMutation.mutate({ sectionId: section.FAQSectionID, data: itemForm })}
                            disabled={!itemForm.question || !itemForm.answer || createItemMutation.isPending}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#635BFF] text-white text-xs font-semibold rounded-lg disabled:opacity-60"
                          >
                            {createItemMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                            Add
                          </button>
                          <button onClick={() => { setAddingItemToSection(null); setItemForm({ question: '', answer: '' }); }} className="px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100 rounded-lg">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setAddingItemToSection(section.FAQSectionID); setItemForm({ question: '', answer: '' }); }}
                        className="w-full py-2.5 text-xs text-slate-400 hover:text-[#635BFF] hover:bg-indigo-50/30 transition-all flex items-center justify-center gap-1.5"
                      >
                        <Plus className="w-3 h-3" /> Add FAQ Item
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ════════════════════════════════════════════════════════════
// CONTACT INFO TAB
// ════════════════════════════════════════════════════════════

const ContactTab: React.FC<{ showToast: (m: string, t?: 'success' | 'error') => void; qc: ReturnType<typeof useQueryClient> }> = ({ showToast, qc }) => {
  const [form, setForm] = useState<ContactInfo>({
    Email: '',
    Phone: '',
    SupportPhone: '',
    AddressLine1: '',
    AddressLine2: '',
    City: '',
    State: '',
    Country: 'India',
    PostalCode: '',
    BusinessHours: '',
    MapEmbedURL: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['contact-info'],
    queryFn: () => cmsApi.getContactInfo().then((r) => r.data.data),
  });

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const mutation = useMutation({
    mutationFn: cmsApi.upsertContactInfo,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contact-info'] });
      showToast('Contact info saved successfully');
    },
    onError: (err: any) => showToast(err.response?.data?.message ?? 'Failed to save', 'error'),
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#635BFF]" /></div>;

  const field = (label: string, key: keyof ContactInfo, type = 'text', placeholder = '') => (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1.5">{label}</label>
      <input
        type={type}
        value={(form[key] as string) ?? ''}
        onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value || null }))}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#635BFF]/30 focus:border-[#635BFF] bg-white"
      />
    </div>
  );

  return (
    <div className="max-w-2xl space-y-5">
      <p className="text-sm text-slate-500">This information is displayed on the Contact Us page and footer of the storefront.</p>

      <div className="p-5 bg-white border border-slate-100 rounded-2xl shadow-sm space-y-4">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Contact Details</h3>
        <div className="grid grid-cols-2 gap-4">
          {field('Email Address *', 'Email', 'email', 'hello@yourbrand.com')}
          {field('Phone Number', 'Phone', 'tel', '+91 98765 43210')}
          {field('Support Phone', 'SupportPhone', 'tel', '+91 98765 43211')}
          {field('Business Hours', 'BusinessHours', 'text', 'Mon–Sat, 9 AM – 6 PM IST')}
        </div>
      </div>

      <div className="p-5 bg-white border border-slate-100 rounded-2xl shadow-sm space-y-4">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Office Address</h3>
        <div className="space-y-3">
          {field('Address Line 1', 'AddressLine1', 'text', '123 Street Name, Area')}
          {field('Address Line 2', 'AddressLine2', 'text', 'Building / Floor (optional)')}
          <div className="grid grid-cols-2 gap-3">
            {field('City', 'City', 'text', 'Hyderabad')}
            {field('State', 'State', 'text', 'Telangana')}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {field('Country', 'Country', 'text', 'India')}
            {field('Postal Code', 'PostalCode', 'text', '500001')}
          </div>
        </div>
      </div>

      <div className="p-5 bg-white border border-slate-100 rounded-2xl shadow-sm space-y-4">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Map Embed</h3>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Google Maps Embed URL</label>
          <textarea
            value={form.MapEmbedURL ?? ''}
            onChange={(e) => setForm((p) => ({ ...p, MapEmbedURL: e.target.value || null }))}
            rows={3}
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-[#635BFF]/30 focus:border-[#635BFF] font-mono text-xs"
            placeholder="https://www.google.com/maps/embed?pb=..."
          />
        </div>
      </div>

      <button
        onClick={() => mutation.mutate(form)}
        disabled={!form.Email || mutation.isPending}
        className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#635BFF] to-[#7C5CFC] text-white text-sm font-semibold rounded-2xl hover:shadow-lg hover:shadow-indigo-500/30 transition-all disabled:opacity-70"
      >
        {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        {mutation.isPending ? 'Saving...' : 'Save Contact Info'}
      </button>
    </div>
  );
};

// ════════════════════════════════════════════════════════════
// SOCIAL LINKS TAB
// ════════════════════════════════════════════════════════════

const SocialTab: React.FC<{ showToast: (m: string, t?: 'success' | 'error') => void; qc: ReturnType<typeof useQueryClient> }> = ({ showToast, qc }) => {
  const [links, setLinks] = useState<Record<SocialPlatform, { url: string; label: string; isActive: boolean }>>({
    INSTAGRAM: { url: '', label: 'Instagram', isActive: true },
    TWITTER: { url: '', label: 'Twitter / X', isActive: true },
    FACEBOOK: { url: '', label: 'Facebook', isActive: true },
    LINKEDIN: { url: '', label: 'LinkedIn', isActive: true },
    YOUTUBE: { url: '', label: 'YouTube', isActive: true },
    PINTEREST: { url: '', label: 'Pinterest', isActive: false },
    TIKTOK: { url: '', label: 'TikTok', isActive: false },
    WHATSAPP: { url: '', label: 'WhatsApp', isActive: true },
  });
  const [isSaving, setIsSaving] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['social-links'],
    queryFn: async () => {
      const res = await cmsApi.listSocialLinks();
      return res.data?.data || [];
    },
  });

  useEffect(() => {
    if (data && Array.isArray(data)) {
      setLinks((prev) => {
        const updated = { ...prev };
        data.forEach((link: any) => {
          const rawPlatform = (link.Platform || link.platform || '').toString().trim().toUpperCase();
          const p = rawPlatform as SocialPlatform;
          if (updated[p]) {
            updated[p] = {
              url: (link.URL ?? link.url ?? '').toString().trim(),
              label: (link.Label ?? link.label ?? updated[p].label).toString().trim(),
              isActive: link.IsActive !== undefined ? Boolean(link.IsActive) : (link.isActive !== undefined ? Boolean(link.isActive) : true),
            };
          }
        });
        return updated;
      });
    }
  }, [data]);

  const handleSaveAll = async () => {
    try {
      setIsSaving(true);
      const toSave = SOCIAL_PLATFORMS.filter((p) => links[p.platform]?.url?.trim());
      if (toSave.length === 0) {
        showToast('Please enter at least one social link URL', 'error');
        return;
      }
      await Promise.all(
        toSave.map((p, i) => {
          const link = links[p.platform];
          return cmsApi.upsertSocialLink({
            platform: p.platform,
            url: link.url.trim(),
            label: link.label,
            isActive: link.isActive,
            displayOrder: i,
          });
        })
      );
      await qc.invalidateQueries({ queryKey: ['social-links'] });
      showToast('All social links saved successfully');
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to save social links', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#635BFF]" /></div>;

  if (isError) {
    return (
      <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-sm">
        Failed to load social links. Please check your network connection and try again.
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-4">
      <p className="text-sm text-slate-500">Configure social media links displayed in your store's footer and contact page.</p>

      <div className="space-y-3">
        {SOCIAL_PLATFORMS.map((p) => {
          const Icon = p.icon;
          const link = links[p.platform];
          return (
            <div key={p.platform} className="flex items-center gap-3 p-3.5 bg-white border border-slate-100 rounded-2xl">
              <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-slate-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-700 mb-1">{p.label}</p>
                <input
                  type="url"
                  value={link.url}
                  onChange={(e) => setLinks((prev) => ({ ...prev, [p.platform]: { ...prev[p.platform], url: e.target.value } }))}
                  placeholder={p.placeholder}
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#635BFF]/30 focus:border-[#635BFF]"
                />
              </div>
              <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
                <div
                  onClick={() => setLinks((prev) => ({ ...prev, [p.platform]: { ...prev[p.platform], isActive: !prev[p.platform].isActive } }))}
                  className={`relative w-8 h-4 rounded-full transition-colors cursor-pointer ${link.isActive ? 'bg-[#635BFF]' : 'bg-slate-200'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${link.isActive ? 'translate-x-4' : 'translate-x-0'}`} />
                </div>
              </label>
            </div>
          );
        })}
      </div>

      <button
        onClick={handleSaveAll}
        disabled={isSaving}
        className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#635BFF] to-[#7C5CFC] text-white text-sm font-semibold rounded-2xl hover:shadow-lg hover:shadow-indigo-500/30 transition-all disabled:opacity-70"
      >
        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        {isSaving ? 'Saving...' : 'Save All Social Links'}
      </button>
    </div>
  );
};
