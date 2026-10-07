import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ArrowRight, Truck, ShieldCheck, Clock, Lock, Sparkles } from 'lucide-react';
import { bannersApi, getFullBannerImageUrl, StorefrontBanner } from '../../lib/bannersApi';

interface HeroBannerProps {
  onExploreCategory: (categorySlug: string) => void;
}

interface CarouselSlide {
  id: string | number;
  title: string;
  subtitle?: string;
  ctaText: string;
  categorySlug: string;
  image: string;
  accentGradient: string;
  isDynamic: boolean;
}

const DEFAULT_STORE_BANNER: CarouselSlide = {
  id: 'store-hero-default',
  title: 'Curated Essentials & Quality Marketplace',
  subtitle: 'Shop verified products from certified brands and sellers with express doorstep fulfillment.',
  ctaText: 'Explore Catalog',
  categorySlug: 'All',
  image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&q=80&w=1600',
  accentGradient: 'from-slate-950/85 via-slate-900/60 to-black/40',
  isDynamic: false,
};

const ACCENT_GRADIENTS = [
  'from-primary-950/80 via-slate-950/50 to-transparent',
  'from-amber-950/80 via-slate-950/50 to-transparent',
  'from-emerald-950/80 via-slate-950/50 to-transparent',
  'from-purple-950/80 via-slate-950/50 to-transparent',
];

export const HeroBanner: React.FC<HeroBannerProps> = ({ onExploreCategory }) => {
  const [slides, setSlides] = useState<CarouselSlide[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch dynamic banners from the database
  useEffect(() => {
    let isMounted = true;

    async function loadDynamicBanners() {
      try {
        const dynamicBanners: StorefrontBanner[] = await bannersApi.getBannersByPlacement('HERO_CAROUSEL');
        
        if (isMounted) {
          if (dynamicBanners && dynamicBanners.length > 0) {
            // Map database banners to carousel slide format
            const mappedSlides: CarouselSlide[] = dynamicBanners.map((b, idx) => ({
              id: `db-banner-${b.bannerId}`,
              title: b.title || 'Curated For Your Lifestyle',
              subtitle: b.description || 'Explore our newest verified catalog products and everyday essentials.',
              ctaText: 'Explore Now',
              categorySlug: 'all',
              image: getFullBannerImageUrl(b.imageUrl || b.imageURL),
              accentGradient: ACCENT_GRADIENTS[idx % ACCENT_GRADIENTS.length],
              isDynamic: true,
            }));
            setSlides(mappedSlides);
          } else {
            setSlides([DEFAULT_STORE_BANNER]);
          }
        }
      } catch (err) {
        console.warn('Error loading dynamic banners, using fallback:', err);
        if (isMounted) {
          setSlides([DEFAULT_STORE_BANNER]);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadDynamicBanners();

    return () => {
      isMounted = false;
    };
  }, []);

  // Automatic Carousel Slide Rotation
  useEffect(() => {
    if (slides.length <= 1) return;

    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 6000);

    return () => clearInterval(timer);
  }, [slides.length]);

  // Keep slide index in bounds if slides change
  useEffect(() => {
    if (currentSlide >= slides.length && slides.length > 0) {
      setCurrentSlide(0);
    }
  }, [slides.length, currentSlide]);

  if (isLoading || slides.length === 0) {
    return (
      <div className="relative overflow-hidden bg-slate-950 h-[250px] sm:h-[440px] lg:h-[300px] w-full flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white/10" />
          <div className="h-4 w-48 bg-white/10 rounded-full" />
        </div>
      </div>
    );
  }

  const slide = slides[currentSlide]; 

  return (
    <div className="relative overflow-hidden bg-slate-950">
      {/* Carousel Container */}
      <div className="relative h-[380px] sm:h-[440px] lg:h-[480px] w-full">
        {slides.map((s, idx) => (
          <div
            key={s.id}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
              idx === currentSlide ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
            }`}
          >
            {/* Background Graphic Image */}
            <img
              src={s.image}
              alt={s.title}
              className="w-full h-full object-cover object-center filter brightness-[0.75]"
              onError={(e) => {
                // If local image fails, fall back to high quality placeholder
                (e.target as HTMLImageElement).src =
                  'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&q=80&w=2000';
              }}
            />

            {/* Dark & Gradient Overlay for Superb Contrast & Text Readability */}
            <div className={`absolute inset-0 bg-gradient-to-r ${s.accentGradient}`} />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-black/40" />

            {/* Slide Content */}
            <div className="absolute inset-0 flex items-center">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
                <div className="max-w-2xl space-y-4 animate-slide-up">
                  {/* Title */}
                  <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-[1.15] drop-shadow-md">
                    {s.title}
                  </h1>

                  {/* Subtitle / Description */}
                  {s.subtitle && (
                    <p className="text-xs sm:text-sm text-slate-200 font-normal leading-relaxed max-w-xl drop-shadow-sm line-clamp-2 sm:line-clamp-none">
                      {s.subtitle}
                    </p>
                  )}

                  {/* CTA Action Buttons */}
                  <div className="pt-1 flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => onExploreCategory(s.categorySlug)}
                      className="px-5 py-3 rounded-2xl bg-white text-slate-950 hover:bg-slate-100 font-bold text-xs uppercase tracking-wider flex items-center space-x-2 transition-all shadow-xl hover:scale-105 active:scale-95"
                    >
                      <span>{s.ctaText}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onExploreCategory('deals')}
                      className="px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white font-bold text-xs uppercase tracking-wider transition-all active:scale-95"
                    >
                      View Special Deals
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Carousel Navigation Arrows (visible when more than 1 slide exists) */}
        {slides.length > 1 && (
          <>
            <button
              onClick={() => setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length)}
              aria-label="Previous slide"
              className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-2xl bg-white/10 hover:bg-white/25 backdrop-blur-md border border-white/15 text-white flex items-center justify-center transition-all shadow-lg active:scale-90"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => setCurrentSlide((prev) => (prev + 1) % slides.length)}
              aria-label="Next slide"
              className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-2xl bg-white/10 hover:bg-white/25 backdrop-blur-md border border-white/15 text-white flex items-center justify-center transition-all shadow-lg active:scale-90"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}

        {/* Dots Indicator */}
        {slides.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center space-x-2">
            {slides.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentSlide(idx)}
                aria-label={`Go to slide ${idx + 1}`}
                className={`h-2 rounded-full transition-all duration-300 ${
                  currentSlide === idx ? 'w-8 bg-white shadow-sm' : 'w-2 bg-white/40 hover:bg-white/70'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Trust & Value Proposition Bar */}
      <div className="bg-white border-b border-slate-200/90 shadow-sm relative z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="flex items-center space-x-3.5">
              <div className="w-10 h-10 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center flex-shrink-0">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900">Complimentary Shipping</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">Orders with tracking</p>
              </div>
            </div>

            <div className="flex items-center space-x-3.5">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900">30-Day Risk-Free</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">Hassle-free return labels</p>
              </div>
            </div>

            <div className="flex items-center space-x-3.5">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900">24/7 Dedicated Support</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">Live chat & phone support</p>
              </div>
            </div>

            <div className="flex items-center space-x-3.5">
              <div className="w-10 h-10 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center flex-shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900">Bank-Grade Security</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">256-bit SSL encrypted</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
