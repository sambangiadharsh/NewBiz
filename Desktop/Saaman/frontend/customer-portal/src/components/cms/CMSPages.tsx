import React, { useState, useEffect, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  storeCmsApi,
  type CMSPage,
  type FAQSection,
  type ContactInfo,
} from '../../lib/cmsApi';
import {
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Search,
  CheckCircle2,
  Mail,
  Phone,
  Clock,
  MapPin,
  ArrowRight,
  Printer,
  Copy,
  Check,
  HelpCircle,
  FileText,
  ShieldCheck,
  Send,
  MessageSquare,
} from 'lucide-react';

// ─── Generic CMS Page Renderer ────────────────────────────────────────────────

export const CMSPageRenderer: React.FC<{ slug?: string }> = ({ slug: propSlug }) => {
  const location = useLocation();
  // Extract slug from URL if not provided directly
  const slug = propSlug || location.pathname.replace(/^\/pages\//, '').replace(/^\//, '');

  const [page, setPage] = useState<CMSPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    storeCmsApi
      .getPageBySlug(slug)
      .then(setPage)
      .catch((err) => {
        console.error('Failed to load page:', err);
        setError('This page could not be found or is currently offline.');
      })
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    if (page) {
      document.title = page.MetaTitle ? `${page.MetaTitle} | Saamaan` : `${page.Title} | Saamaan`;
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc && page.MetaDescription) {
        metaDesc.setAttribute('content', page.MetaDescription);
      }
    }
  }, [page]);

  // Extract table of contents headings (h2, h3) from HTML
  const headings = useMemo(() => {
    if (!page?.Content) return [];
    const div = document.createElement('div');
    div.innerHTML = page.Content;
    const elements = div.querySelectorAll('h2, h3');
    return Array.from(elements).map((el, i) => {
      const text = el.textContent || '';
      const id = el.id || `section-${i}-${text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-')}`;
      return {
        id,
        text,
        level: el.tagName.toLowerCase() === 'h2' ? 2 : 3,
      };
    });
  }, [page?.Content]);

  // Inject IDs into HTML content for anchor jumping
  const processedContent = useMemo(() => {
    if (!page?.Content) return '';
    let html = page.Content;
    headings.forEach((h) => {
      const regex = new RegExp(`(<${h.level === 2 ? 'h2' : 'h3'}[^>]*>)(${h.text})`, 'i');
      html = html.replace(regex, `$1<span id="${h.id}">$2</span>`);
    });
    return html;
  }, [page?.Content, headings]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  // Rough reading time estimate: 200 words per minute
  const readingTime = useMemo(() => {
    if (!page?.Content) return 2;
    const text = page.Content.replace(/<[^>]*>/g, '');
    const words = text.trim().split(/\s+/).length;
    return Math.max(1, Math.ceil(words / 200));
  }, [page?.Content]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-36">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600 mb-3" />
        <p className="text-xs text-slate-500 font-medium">Loading document...</p>
      </div>
    );
  }

  if (error || !page) {
    return (
      <div className="max-w-xl mx-auto py-24 px-4 text-center">
        <div className="w-16 h-16 rounded-3xl bg-slate-100 flex items-center justify-center mx-auto mb-4 text-slate-400">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 mb-2">Page Not Found</h1>
        <p className="text-sm text-slate-500 mb-6">
          The requested page could not be located. It may have been relocated or is under administrative revision.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-all shadow-sm"
        >
          Return to Storefront
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-canvas min-h-screen py-10 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-6xl mx-auto">
        {/* Breadcrumb Navigation */}
        <nav className="flex items-center space-x-2 text-xs text-slate-400 mb-8" aria-label="Breadcrumb">
          <Link to="/" className="hover:text-slate-800 transition-colors">Home</Link>
          <span>/</span>
          <span className="text-slate-500">Legal & Information</span>
          <span>/</span>
          <span className="text-slate-900 font-medium">{page.Title}</span>
        </nav>

        {/* Hero Header Card */}
        <header className="mb-10 p-8 sm:p-10 rounded-3xl bg-white border border-slate-100 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-primary-50 rounded-full blur-3xl -z-0 opacity-60 pointer-events-none" />
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-primary-50 text-primary-600 border border-primary-100">
                <FileText className="w-3.5 h-3.5" />
                <span>Official Publication</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
                {page.Title}
              </h1>
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1">
                <span>{readingTime} min read</span>
                <span>•</span>
                <span>
                  Last Revised:{' '}
                  <strong className="text-slate-600 font-medium">
                    {page.UpdatedAt
                      ? new Date(page.UpdatedAt).toLocaleDateString('en-US', {
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : 'Recently updated'}
                  </strong>
                </span>
              </div>
            </div>

            {/* Quick Actions (Print, Copy Link) */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Share'}</span>
              </button>
              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>
            </div>
          </div>
        </header>

        {/* Content Layout */}
        <div className={`grid grid-cols-1 ${headings.length > 0 ? 'lg:grid-cols-12' : ''} gap-8 items-start`}>
          {/* Main Article Content */}
          <article className={`${headings.length > 0 ? 'lg:col-span-9' : 'w-full'} bg-white p-8 sm:p-12 rounded-3xl border border-slate-100 shadow-sm`}>
            <div
              className="prose prose-slate max-w-none
                prose-headings:font-bold prose-headings:text-slate-900
                prose-h2:text-2xl prose-h2:mt-8 prose-h2:mb-4 prose-h2:tracking-tight
                prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-3 prose-h3:tracking-tight
                prose-p:text-slate-600 prose-p:leading-relaxed prose-p:text-[15px]
                prose-a:text-primary-600 prose-a:font-semibold hover:prose-a:underline
                prose-strong:text-slate-900 prose-strong:font-bold
                prose-ul:my-4 prose-ul:list-disc prose-ul:pl-6
                prose-ol:my-4 prose-ol:list-decimal prose-ol:pl-6
                prose-li:text-slate-600 prose-li:my-1.5
                prose-blockquote:border-l-4 prose-blockquote:border-primary-500 prose-blockquote:bg-slate-50 prose-blockquote:py-2 prose-blockquote:px-4 prose-blockquote:rounded-r-xl prose-blockquote:text-slate-700 prose-blockquote:italic
                prose-hr:border-slate-100 prose-hr:my-8"
              dangerouslySetInnerHTML={{ __html: processedContent }}
            />

            {/* Assistance Banner */}
            <div className="mt-12 pt-8 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/60 p-6 rounded-2xl">
              <div>
                <p className="text-xs font-bold text-slate-800">Questions concerning these provisions?</p>
                <p className="text-xs text-slate-500 mt-0.5">Our customer support team is available 24/7 to help you.</p>
              </div>
              <Link
                to="/contact"
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all shadow-sm shrink-0"
              >
                Contact Support
              </Link>
            </div>
          </article>

          {/* Sticky Table of Contents Sidebar */}
          {headings.length > 0 && (
            <aside className="lg:col-span-3 sticky top-6 space-y-4">
              <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-primary-600" />
                  <span>On This Page</span>
                </h3>
                <nav className="space-y-1">
                  {headings.map((h) => (
                    <a
                      key={h.id}
                      href={`#${h.id}`}
                      className={`block text-xs py-1.5 transition-colors line-clamp-1 ${
                        h.level === 3 ? 'pl-3 text-slate-500 hover:text-slate-800' : 'font-semibold text-slate-700 hover:text-primary-600'
                      }`}
                    >
                      {h.text}
                    </a>
                  ))}
                </nav>
              </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── FAQ Page ─────────────────────────────────────────────────────────────────

export const FAQPage: React.FC = () => {
  const [sections, setSections] = useState<FAQSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState<string>('all');

  useEffect(() => {
    document.title = 'Frequently Asked Questions |Saamaan Support';
    storeCmsApi
      .getFAQs()
      .then((data) => {
        setSections(data);
        // Expand first 2 items by default for friendly instant UX
        if (data.length && data[0].FAQItems?.length) {
          const initial = new Set<string>();
          data[0].FAQItems.slice(0, 2).forEach((it) => initial.add(it.FAQItemID));
          setExpandedItems(initial);
        }
      })
      .catch((err) => console.error('Failed to load FAQs:', err))
      .finally(() => setLoading(false));
  }, []);

  const toggleItem = (id: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExpandAll = () => {
    const allIds = new Set<string>();
    sections.forEach((s) => s.FAQItems?.forEach((it) => allIds.add(it.FAQItemID)));
    setExpandedItems(allIds);
  };

  const handleCollapseAll = () => {
    setExpandedItems(new Set());
  };

  // Filter sections and items based on search query and category pill
  const filteredSections = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return sections
      .filter((section) => selectedSectionId === 'all' || section.FAQSectionID === selectedSectionId)
      .map((section) => {
        const matchingItems = (section.FAQItems || []).filter((item) => {
          if (!q) return true;
          return item.Question.toLowerCase().includes(q) || item.Answer.toLowerCase().includes(q);
        });
        return {
          ...section,
          FAQItems: matchingItems,
        };
      })
      .filter((section) => section.FAQItems.length > 0);
  }, [sections, searchQuery, selectedSectionId]);

  const totalResults = useMemo(() => {
    return filteredSections.reduce((sum, sec) => sum + sec.FAQItems.length, 0);
  }, [filteredSections]);

  return (
    <div className="bg-canvas min-h-screen py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-10">
        
        {/* Page Hero & Live Search */}
        <div className="text-center space-y-4">
          
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Frequently Asked Questions
          </h1>
          <p className="text-sm text-slate-500 max-w-xl mx-auto">
            Instant answers covering delivery timelines, hassle-free returns, secure payments, and account management.
          </p>

          {/* Search Input Bar */}
          <div className="pt-4 max-w-xl mx-auto">
            <div className="relative">
              <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search questions (e.g. shipping time, refund method, warranty)..."
                className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 shadow-sm transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 hover:text-slate-700"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Category Pills & Bulk Toggle */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          {/* Pills */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setSelectedSectionId('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                selectedSectionId === 'all'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              All Topics
            </button>
            {sections.map((s) => (
              <button
                key={s.FAQSectionID}
                onClick={() => setSelectedSectionId(s.FAQSectionID)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  selectedSectionId === s.FAQSectionID
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {s.Title}
              </button>
            ))}
          </div>

          {/* Expand / Collapse All */}
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 shrink-0">
            <button onClick={handleExpandAll} className="hover:text-primary-600 transition-colors">
              Expand All
            </button>
            <span>•</span>
            <button onClick={handleCollapseAll} className="hover:text-primary-600 transition-colors">
              Collapse All
            </button>
          </div>
        </div>

        {/* FAQs Accordion Container */}
        {loading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
          </div>
        ) : filteredSections.length === 0 ? (
          <div className="bg-white p-12 rounded-3xl border border-slate-100 text-center space-y-3">
            <HelpCircle className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-base font-bold text-slate-800">No matching answers found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              We couldn't find questions matching "{searchQuery}". Try alternate search terms or get in touch with our team.
            </p>
            <button
              onClick={() => { setSearchQuery(''); setSelectedSectionId('all'); }}
              className="mt-2 text-xs font-bold text-primary-600 hover:underline"
            >
              Reset Search & Filters
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {filteredSections.map((section) => (
              <div key={section.FAQSectionID} className="space-y-3">
                <div className="flex items-center gap-2 pb-1">
                  <span className="w-2 h-2 rounded-full bg-primary-600" />
                  <h2 className="text-base font-bold text-slate-900 tracking-tight">
                    {section.Title}
                  </h2>
                  <span className="text-xs text-slate-400">({section.FAQItems.length})</span>
                </div>

                <div className="space-y-2.5">
                  {section.FAQItems.map((item) => {
                    const isOpen = expandedItems.has(item.FAQItemID);
                    return (
                      <div
                        key={item.FAQItemID}
                        className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm transition-all hover:border-slate-200"
                      >
                        <button
                          type="button"
                          onClick={() => toggleItem(item.FAQItemID)}
                          className="w-full flex items-center justify-between p-5 text-left transition-colors"
                        >
                          <span className="text-sm font-semibold text-slate-800 pr-4 leading-snug">
                            {item.Question}
                          </span>
                          <span className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-200 ${isOpen ? 'bg-primary-50 text-primary-600 rotate-180' : 'bg-slate-50 text-slate-400'}`}>
                            <ChevronDown className="w-4 h-4" />
                          </span>
                        </button>
                        {isOpen && (
                          <div className="px-5 pb-5 text-sm text-slate-600 leading-relaxed border-t border-slate-50 pt-3 animate-fade-in">
                            {item.Answer}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Bottom Concierge Help Banner */}
        <div className="p-8 sm:p-10 rounded-3xl bg-slate-900 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left">
            <h3 className="text-xl font-bold text-white tracking-tight">Still have unanswered questions?</h3>
            <p className="text-xs text-slate-400 max-w-md leading-relaxed">
              Our customer support team is here to assist with order inquiries, product questions, and help.
            </p>
          </div>
          <Link
            to="/contact"
            className="px-6 py-3 bg-primary-600 hover:bg-primary-500 text-white font-bold text-xs uppercase tracking-wider rounded-2xl shadow-glow transition-all shrink-0 hover:scale-105"
          >
            Contact Customer Support
          </Link>
        </div>

      </div>
    </div>
  );
};

// ─── Contact Us Page ──────────────────────────────────────────────────────────

export const ContactPage: React.FC = () => {
  const [info, setInfo] = useState<ContactInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedRef, setSubmittedRef] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    topic: 'General Inquiry',
    orderNumber: '',
    subject: '',
    message: '',
  });

  useEffect(() => {
    document.title = 'Contact Customer Support | Saamaan';
    storeCmsApi
      .getContactInfo()
      .then(setInfo)
      .catch((err) => console.error('Failed to load contact info:', err))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const fullSubject = formData.orderNumber
        ? `[${formData.topic}] ${formData.subject} (Order #${formData.orderNumber})`
        : `[${formData.topic}] ${formData.subject}`;

      const res = await storeCmsApi.submitContactInquiry({
        name: formData.name,
        email: formData.email,
        subject: fullSubject,
        message: formData.message,
      });

      setSubmittedRef(res.referenceId);
      setFormData({
        name: '',
        email: '',
        topic: 'General Inquiry',
        orderNumber: '',
        subject: '',
        message: '',
      });
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to dispatch inquiry. Please reach us via telephone.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-canvas min-h-screen py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-12">
        
        {/* Hero Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-primary-50 text-primary-600 border border-primary-100">
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Customer Support</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            How Can We Help You?
          </h1>
          <p className="text-sm text-slate-500 max-w-xl mx-auto">
            Our support team is here to help. Reach us via email, phone, or message us below.
          </p>
        </div>

        {/* 3 Contact Highlight Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Direct Support Email */}
          <div className="p-6 rounded-3xl bg-white border border-slate-100 shadow-sm flex flex-col justify-between space-y-4">
            <div className="w-10 h-10 rounded-2xl bg-primary-50 border border-primary-100 flex items-center justify-center text-primary-600">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Email Us</p>
              <h3 className="text-base font-bold text-slate-900 mt-0.5">Email Support</h3>
              <p className="text-xs text-slate-500 mt-1">Typical response within 2-4 business hours.</p>
            </div>
            <a
              href={`mailto:${info?.Email || 'support@Saamaan-commerce.com'}`}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-primary-600 hover:underline pt-2"
            >
              <span>{info?.Email || 'support@Saamaan-commerce.com'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* Card 2: Telephone Line */}
          <div className="p-6 rounded-3xl bg-white border border-slate-100 shadow-sm flex flex-col justify-between space-y-4">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <Phone className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Toll-Free Telephony</p>
              <h3 className="text-base font-bold text-slate-900 mt-0.5">Direct Contact</h3>
              <p className="text-xs text-slate-500 mt-1">{info?.BusinessHours || 'Mon – Fri, 9:00am – 8:00pm EST'}</p>
            </div>
            <a
              href={`tel:${info?.SupportPhone || info?.Phone || '+18004922872'}`}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 hover:underline pt-2"
            >
              <span>{info?.SupportPhone || info?.Phone || '+1 (800) 492-Saamaan'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* Card 3: Physical Headquarters */}
          <div className="p-6 rounded-3xl bg-white border border-slate-100 shadow-sm flex flex-col justify-between space-y-4">
            <div className="w-10 h-10 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Head office</p>
              <h3 className="text-base font-bold text-slate-900 mt-0.5">Headquarter Location</h3>
              <p className="text-xs text-slate-500 mt-1">
                {info?.AddressLine1 || '452 Broadway, SoHo Design District'},{' '}
                {info?.City || 'New York'}, {info?.PostalCode || '10013'}
              </p>
            </div>
            <a
              href="#map-section"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-600 hover:underline pt-2"
            >
              <span>View Location Coordinates</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Main Grid: Form + Google Map Embed */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Interactive Contact Form */}
          <div className="lg:col-span-7 bg-white p-8 sm:p-10 rounded-3xl border border-slate-100 shadow-sm space-y-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Send an Inquiry</h2>
              <p className="text-xs text-slate-500 mt-1">
                Fill in the details below and a concierge specialist will respond promptly.
              </p>
            </div>

            {submittedRef ? (
              <div className="p-8 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-center space-y-4 animate-fade-in">
                <div className="w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-md">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-emerald-950">Inquiry Dispatched Successfully</h3>
                  <p className="text-xs text-emerald-800 mt-1">
                    Your reference ticket is <strong className="font-mono font-bold text-emerald-900">{submittedRef}</strong>. A confirmation has been registered with our support desk.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSubmittedRef(null)}
                  className="px-5 py-2.5 rounded-xl bg-white border border-emerald-200 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition-colors shadow-sm"
                >
                  Submit Another Message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {submitError && (
                  <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                    <span>{submitError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Full Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                      placeholder="e.g. Jessica Taylor"
                      className="w-full px-4 py-2.5 bg-slate-50/60 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Email Address <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                      placeholder="jessica@example.com"
                      className="w-full px-4 py-2.5 bg-slate-50/60 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Topic Classification
                    </label>
                    <select
                      value={formData.topic}
                      onChange={(e) => setFormData((p) => ({ ...p, topic: e.target.value }))}
                      className="w-full px-3 py-2.5 bg-slate-50/60 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all"
                    >
                      <option value="General Inquiry">General Inquiry & Help</option>
                      <option value="Order Status">Order Status & Tracking</option>
                      <option value="Returns & Refunds">30-Day Return / Exchange</option>
                      <option value="Product Details">Product Specifications & Inquiries</option>
                      <option value="Wholesale & Press">Wholesale Partnerships / Press</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Order Reference <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      value={formData.orderNumber}
                      onChange={(e) => setFormData((p) => ({ ...p, orderNumber: e.target.value }))}
                      placeholder="e.g. ORD-98210"
                      className="w-full px-4 py-2.5 bg-slate-50/60 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Subject Header <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.subject}
                    onChange={(e) => setFormData((p) => ({ ...p, subject: e.target.value }))}
                    placeholder="Brief summary of your inquiry"
                    className="w-full px-4 py-2.5 bg-slate-50/60 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Detailed Message <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={5}
                    value={formData.message}
                    onChange={(e) => setFormData((p) => ({ ...p, message: e.target.value }))}
                    placeholder="Provide relevant order details, questions, or requirements..."
                    className="w-full px-4 py-2.5 bg-slate-50/60 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 resize-none transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 bg-slate-900 hover:bg-primary-600 text-white font-bold text-xs uppercase tracking-wider rounded-2xl transition-all shadow-md flex items-center justify-center space-x-2 disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Send Message</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>

          {/* Map & Office Address Card */}
          <div id="map-section" className="lg:col-span-5 space-y-6">
            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-100 shadow-sm space-y-5">
              <div>
                <h3 className="text-base font-bold text-slate-900">Visiting Hours & Location</h3>
                <p className="text-xs text-slate-500 mt-1">Showroom visits are welcomed by walk-in or private booking.</p>
              </div>

              {/* Map Embed or Visual Card */}
              <div className="w-full h-64 rounded-2xl overflow-hidden border border-slate-100 bg-slate-100 relative">
                {info?.MapEmbedURL ? (
                  <iframe
                    title="Saamaan Location Map"
                    src={info.MapEmbedURL}
                    className="w-full h-full border-0"
                    loading="lazy"
                    allowFullScreen
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-slate-400 bg-slate-100">
                    <MapPin className="w-8 h-8 mb-2 text-slate-300" />
                    <p className="text-xs font-semibold text-slate-600">SoHo Flagship Studio</p>
                    <p className="text-[11px] mt-1">452 Broadway, New York, NY 10013</p>
                  </div>
                )}
              </div>

              <div className="pt-2 space-y-3 text-xs text-slate-600">
                <div className="flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-primary-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-slate-900 block font-semibold">Street Address</strong>
                    <span>
                      {info?.AddressLine1 || '452 Broadway, SoHo Design District'}
                      {info?.AddressLine2 ? `, ${info.AddressLine2}` : ''}
                      <br />
                      {info?.City || 'New York'}, {info?.State || 'NY'} {info?.PostalCode || '10013'}, {info?.Country || 'USA'}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <Clock className="w-4 h-4 text-primary-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-slate-900 block font-semibold">Customer Support Hours</strong>
                    <span>{info?.BusinessHours || 'Monday – Friday: 9:00 AM – 8:00 PM EST'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
