import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import logoImg from '../../assets/dummy_logo.png';
import {
  Mail,
  ArrowRight,
  ShieldCheck,
  Phone,
  MapPin,
  Clock,
  Instagram,
  Twitter,
  Facebook,
  Linkedin,
  Youtube,
  Share2,
  ArrowUp,
  CheckCircle2,
  Cookie,
  ExternalLink,
} from 'lucide-react';
import { storeCmsApi, type ContactInfo, type SocialLink } from '../../lib/cmsApi';

interface FooterProps {
  onSelectCategory: (cat: string) => void;
  onOpenTrackOrder?: () => void;
  onOpenCookieSettings: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  onSelectCategory,
  onOpenTrackOrder,
  onOpenCookieSettings,
}) => {
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [contact, setContact] = useState<ContactInfo | null>(null);
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);
  const navigate = useNavigate();
  const location = useLocation();

  const scrollToTop = () => {
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  };

  const handleCategoryClick = (cat: string) => {
    onSelectCategory(cat);
    if (location.pathname !== '/') {
      navigate('/');
    }
    setTimeout(() => {
      const catalog = document.getElementById('catalog-section');
      if (catalog) {
        catalog.scrollIntoView({ behavior: 'smooth' });
      } else {
        window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
      }
    }, 100);
  };

  useEffect(() => {
    storeCmsApi.getContactInfo().then((data) => {
      if (data) setContact(data);
    }).catch(() => {});

    storeCmsApi.getSocialLinks().then((data) => {
      if (data?.length) setSocialLinks(data);
    }).catch(() => {});
  }, []);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletterEmail) return;
    setIsSubscribed(true);
    setTimeout(() => {
      setNewsletterEmail('');
    }, 2500);
  };

  const renderSocialIcon = (platform: string) => {
    const p = platform.toUpperCase();
    switch (p) {
      case 'INSTAGRAM':
        return <Instagram className="w-4 h-4" />;
      case 'TWITTER':
        return <Twitter className="w-4 h-4" />;
      case 'FACEBOOK':
        return <Facebook className="w-4 h-4" />;
      case 'LINKEDIN':
        return <Linkedin className="w-4 h-4" />;
      case 'YOUTUBE':
        return <Youtube className="w-4 h-4" />;
      case 'WHATSAPP':
        return <Phone className="w-4 h-4" />;
      default:
        return <Share2 className="w-4 h-4" />;
    }
  };

  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-[#0B1E1F] text-slate-300 font-sans border-t border-[#142E2F]">
      
      {/* Newsletter Banner */}
      <div className="border-b border-[#142E2F] bg-[#071516]/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
            <div className="max-w-xl text-center lg:text-left">
              <span className="text-[11px] font-bold text-primary-400 uppercase tracking-widest">
                Join The Circle
              </span>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                Be the first to access limited seasonal capsule drops, member-only flash sales, and design perspectives.
              </p>
            </div>

            {/* Newsletter Input Form */}
            <div className="w-full max-w-md">
              {isSubscribed ? (
                <div className="p-4 rounded-2xl bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center space-x-2 animate-fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Thank you! Your have subscribed to our newsletter.</span>
                </div>
              ) : (
                <form onSubmit={handleSubscribe} className="flex space-x-2">
                  <div className="relative flex-1">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={newsletterEmail}
                      onChange={(e) => setNewsletterEmail(e.target.value)}
                      placeholder="Enter your personal email"
                      className="w-full pl-10 pr-4 py-3 bg-[#071516] border border-[#142E2F] rounded-2xl text-xs text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-6 py-3 rounded-2xl bg-primary-600 hover:bg-primary-500 text-white font-bold text-xs uppercase tracking-wider flex items-center space-x-1.5 transition-all shadow-glow hover:scale-[1.02] flex-shrink-0"
                  >
                    <span>Subscribe</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </form>
              )}
              <p className="text-[11px] text-slate-600 mt-2 text-center lg:text-left">
                Zero spam. You may unsubscribe anytime with one click.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Links Columns */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 lg:gap-12">
          
          {/* Column 1: Brand & Dynamic Contact Info */}
          <div className="col-span-2 space-y-4">
            <Link to="/" onClick={scrollToTop} className="flex items-center space-x-3 cursor-pointer group">
              <div className="w-9 h-9 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                <img
                  src={logoImg}
                  alt="Logo"
                  className="w-full h-full object-contain"
                />
              </div>
              <span className="text-2xl font-black tracking-tight text-white">HESA</span>
            </Link>
            <p className="text-xs text-slate-300 leading-relaxed max-w-sm">
              An architectural approach to modern commerce. Curating timeless minimalist hardware, organic apparel, and mindful home goods.
            </p>

            <div className="space-y-2.5 pt-2 text-xs text-slate-300">
              <div className="flex items-start space-x-2.5">
                <MapPin className="w-4 h-4 text-primary-400 flex-shrink-0 mt-0.5" />
                <span>
                  {contact?.AddressLine1 || '452 Broadway, SoHo Design District'}
                  {contact?.AddressLine2 ? `, ${contact.AddressLine2}` : ''}
                  {contact?.City ? `, ${contact.City}` : ', NY 10013'}
                  {contact?.Country && contact.Country !== 'United States' ? `, ${contact.Country}` : ''}
                </span>
              </div>
              <div className="flex items-center space-x-2.5">
                <Phone className="w-4 h-4 text-primary-400 flex-shrink-0" />
                <a
                  href={`tel:${contact?.SupportPhone || contact?.Phone || '+18004922872'}`}
                  className="hover:text-white transition-colors"
                >
                  {contact?.SupportPhone || contact?.Phone || '+1 (800) 492-HESA (Support)'}
                </a>
              </div>
              <div className="flex items-center space-x-2.5">
                <Clock className="w-4 h-4 text-primary-400 flex-shrink-0" />
                <span>{contact?.BusinessHours || 'Mon – Fri, 9:00am – 8:00pm EST'}</span>
              </div>
            </div>
          </div>

          {/* Column 2: Shop Departments */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Departments
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  onClick={() => handleCategoryClick('Electronics')}
                  className="hover:text-white transition-colors"
                >
                  Electronics & Audio
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleCategoryClick('Fashion & Apparel')}
                  className="hover:text-white transition-colors"
                >
                  Fashion & Linen
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleCategoryClick('Home & Living')}
                  className="hover:text-white transition-colors"
                >
                  Home & Living
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleCategoryClick('Beauty & Wellness')}
                  className="hover:text-white transition-colors"
                >
                  Clean Skincare
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleCategoryClick('Deals')}
                  className="text-rose-400 hover:text-rose-300 transition-colors font-semibold"
                >
                  Seasonal Flash Deals
                </button>
              </li>
            </ul>
          </div>

          {/* Column 3: Customer Care (Managed by Backend / Admin) */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Customer Care
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link to="/faqs" onClick={scrollToTop} className="hover:text-white transition-colors">
                  Help Center & FAQs
                </Link>
              </li>
              <li>
                <button
                  onClick={() => onOpenTrackOrder?.()}
                  className="hover:text-white transition-colors text-left"
                >
                  Track Your Package
                </button>
              </li>
              <li>
                <Link to="/pages/return-policy" onClick={scrollToTop} className="hover:text-white transition-colors">
                  30-Day Returns Policy
                </Link>
              </li>
              <li>
                <Link to="/pages/shipping-policy" onClick={scrollToTop} className="hover:text-white transition-colors">
                  Shipping & Delivery
                </Link>
              </li>
              <li>
                <Link to="/contact" onClick={scrollToTop} className="hover:text-white transition-colors">
                  Contact Support
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4: About & Legal (Managed by Backend / Admin) */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              About & Legal
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link to="/pages/about-us" onClick={scrollToTop} className="hover:text-white transition-colors">
                  Our Brand Philosophy
                </Link>
              </li>
              <li>
                <Link to="/pages/careers" onClick={scrollToTop} className="hover:text-white transition-colors">
                  Careers at HESA
                </Link>
              </li>
              <li>
                <Link to="/pages/privacy-policy" onClick={scrollToTop} className="hover:text-white transition-colors">
                  Privacy & Data Policy
                </Link>
              </li>
              <li>
                <Link to="/pages/terms-of-service" onClick={scrollToTop} className="hover:text-white transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link to="/pages/cookie-policy" onClick={scrollToTop} className="hover:text-white transition-colors">
                  Cookie Policy
                </Link>
              </li>
              <li className="pt-1">
                <button
                  type="button"
                  onClick={onOpenCookieSettings}
                  className="inline-flex items-center gap-1.5 text-primary-400 hover:text-primary-300 font-semibold transition-colors"
                >
                  <Cookie className="w-3.5 h-3.5" />
                  <span>Cookie Settings</span>
                </button>
              </li>
            </ul>
          </div>

        </div>

        {/* Divider & Social Links */}
        <div className="mt-12 pt-8 border-t border-[#142E2F] flex flex-col md:flex-row items-center justify-between gap-6">
          
          {/* Dynamic Social Icons from Backend */}
          <div className="flex items-center space-x-2.5 text-slate-300">
            {(socialLinks.length > 0 ? socialLinks : [
              { SocialLinkID: '1', Platform: 'INSTAGRAM', Label: 'Instagram', URL: 'https://instagram.com/hesa_commerce', DisplayOrder: 1 },
              { SocialLinkID: '2', Platform: 'TWITTER', Label: 'Twitter / X', URL: 'https://twitter.com/hesa_commerce', DisplayOrder: 2 },
              { SocialLinkID: '3', Platform: 'LINKEDIN', Label: 'LinkedIn', URL: 'https://linkedin.com/company/hesa-commerce', DisplayOrder: 3 },
              { SocialLinkID: '4', Platform: 'YOUTUBE', Label: 'YouTube', URL: 'https://youtube.com/@hesacommerce', DisplayOrder: 4 },
            ]).map((s) => (
              <a
                key={s.SocialLinkID || s.Platform}
                href={s.URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.Label || s.Platform}
                className="w-8 h-8 rounded-xl bg-[#071516] hover:bg-[#142E2F] hover:text-white flex items-center justify-center transition-colors shadow-sm border border-[#142E2F]"
              >
                {renderSocialIcon(s.Platform)}
              </a>
            ))}
          </div>

        

          {/* Back to top button */}
          <button
            onClick={scrollToTop}
            className="flex items-center space-x-1.5 text-xs font-semibold text-slate-300 hover:text-white transition-colors"
          >
            <span>Back to top</span>
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Dynamic Copyright Notice */}
        <div className="mt-8 text-center text-[11px] text-slate-600">
          <p>© {currentYear} HESA Commerce Inc. All rights reserved. Designed with architectural minimalism and zero-latency performance.</p>
        </div>

      </div>
    </footer>
  );
};
