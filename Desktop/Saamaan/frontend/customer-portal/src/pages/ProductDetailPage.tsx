import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Heart,
  ShoppingBag,
  ShieldCheck,
  Truck,
  RotateCcw,
  Check,
  Sparkles,
  CheckCircle2,
  ChevronRight,
  Share2,
  Layers,
  Award,
  Loader2,
  Store,
  Tag,
  Ban,
  Star,
  Wrench,
  Play,
} from 'lucide-react';
import { Product } from '../types';
import { productsApi, getImageUrl } from '../lib/productsApi';
import { ProductReviewsSection } from '../components/reviews/ProductReviewsSection';
import { reviewsApi, ProductRatingSummary } from '../lib/reviewsApi';

interface ProductDetailPageProps {
  currency: string;
  wishlistIds: string[];
  onToggleWishlist: (product: Product) => void;
  onAddToCart: (product: Product, quantity: number, color?: string, size?: string) => void;
  allProducts: Product[];
}

// Color palette mapping helper for swatches
const COLOR_HEX_MAP: Record<string, string> = {
  black: '#111827',
  'jet black': '#0a0a0a',
  white: '#ffffff',
  'off white': '#f8fafc',
  grey: '#64748b',
  gray: '#64748b',
  silver: '#94a3b8',
  red: '#dc2626',
  'crimson red': '#991b1b',
  blue: '#2563eb',
  'navy blue': '#1e3a8a',
  'sky blue': '#38bdf8',
  green: '#16a34a',
  'olive green': '#3f6212',
  yellow: '#ca8a04',
  gold: '#d97706',
  brown: '#78350f',
  beige: '#d6c7a1',
  tan: '#d2b48c',
  purple: '#9333ea',
  pink: '#db2777',
  orange: '#ea580c',
};

function getColorHex(colorName?: string): string | null {
  if (!colorName) return null;
  const clean = colorName.trim().toLowerCase();
  return COLOR_HEX_MAP[clean] || null;
}

export const ProductDetailPage: React.FC<ProductDetailPageProps> = ({
  currency: _currency,
  wishlistIds,
  onToggleWishlist,
  onAddToCart,
  allProducts,
}) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImageIdx, setSelectedImageIdx] = useState(0);

  // Multi-variant resolution state: key-value map of { "Color": "Black", "Size": "XL", etc. }
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string>>({});

  // Legacy fallback states (for products without variants array)
  const [selectedColor, setSelectedColor] = useState<string | undefined>();
  const [selectedSize, setSelectedSize] = useState<string | undefined>();

  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<'overview' | 'specs' | 'shipping' | 'reviews'>('overview');
  const [ratingSummary, setRatingSummary] = useState<ProductRatingSummary | null>(null);
  const [justAdded, setJustAdded] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);

  const currSymbol = '₹';

  useEffect(() => {
    if (!id) return;
    reviewsApi.getSummary(id).then((sum) => setRatingSummary(sum));
  }, [id]);

  // ── 1. Fetch Product Data ──────────────────────────────────────────────────
  useEffect(() => {
    let isMounted = true;
    async function loadProduct() {
      if (!id) return;
      setLoading(true);

      // Check cache first to prevent layout flicker
      const localMatch = allProducts.find((p) => p.id === id);
      if (localMatch) {
        setProduct(localMatch);
        initializeVariantSelection(localMatch);
      }

      try {
        const fetched = await productsApi.getProductById(id);
        if (isMounted && fetched) {
          setProduct(fetched);
          initializeVariantSelection(fetched);
        }
      } catch (err) {
        console.warn('Error fetching product detail:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadProduct();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return () => {
      isMounted = false;
    };
  }, [id, allProducts]);

  // ── 2. Initialize Selection on Product Load (with Deep-Link Support) ───────
  const initializeVariantSelection = (prod: Product) => {
    if (prod.variants && prod.variants.length > 0) {
      // 1. Check URL query string for ?sku=... or ?variant=...
      const skuParam = searchParams.get('sku')?.trim().toLowerCase();
      const variantParam = searchParams.get('variant')?.trim();

      let matchedVariant = null;
      if (skuParam) {
        matchedVariant = prod.variants.find((v) => {
          const vSku = (v.variantSku || (v as any).sku || '').trim().toLowerCase();
          return vSku === skuParam;
        });
      }
      if (!matchedVariant && variantParam) {
        matchedVariant = prod.variants.find(
          (v) => String(v.variantId) === variantParam || String((v as any).id) === variantParam
        );
      }

      // 2. Fallback: Align default selection with advertised PLP entry price (lowest active variant price)
      const defaultVariant =
        matchedVariant ||
        prod.variants.find((v) => Number(v.price) === Number(prod.price)) ||
        prod.variants.reduce((minV, currV) =>
          Number(currV.price) > 0 && Number(currV.price) < Number(minV.price) ? currV : minV,
          prod.variants[0]
        );

      const initialMap: Record<string, string> = {};
      (defaultVariant.attributes || []).forEach((a) => {
        if (a.name && a.value) {
          initialMap[a.name] = a.value;
        }
      });
      setSelectedAttributes(initialMap);

      // Also sync legacy state if applicable
      const col = defaultVariant.attributes?.find((a) => a.name.toLowerCase() === 'color')?.value;
      const sz = defaultVariant.attributes?.find((a) => a.name.toLowerCase() === 'size')?.value;
      if (col) setSelectedColor(col);
      if (sz) setSelectedSize(sz);
    } else {
      // Legacy fallback
      setSelectedColor(prod.colors?.[0]?.name);
      setSelectedSize(prod.sizes?.[0]);
    }
  };

  // ── 3. Extract Distinct Attribute Dimensions (Variant-Defining Only) ──────
  // An attribute is variant-defining if it varies across variants (values.length > 1)
  // Static attributes with only 1 value are specification attributes for the specs table.
  const attributeDimensions = useMemo(() => {
    if (!product?.variants || product.variants.length === 0) return [];

    const dimMap = new Map<string, Set<string>>();

    product.variants.forEach((v) => {
      (v.attributes || []).forEach((attr) => {
        const name = attr.name?.trim();
        const val = attr.value?.trim();
        if (!name || !val) return;
        if (!dimMap.has(name)) {
          dimMap.set(name, new Set());
        }
        dimMap.get(name)!.add(val);
      });
    });

    return Array.from(dimMap.entries())
      .filter(([_name, valuesSet]) => valuesSet.size > 1) // Only variant-defining (varying) attributes
      .map(([name, valuesSet]) => ({
        name,
        values: Array.from(valuesSet),
      }));
  }, [product]);

  // Extract static specification attributes from variant attributes (those that don't vary)
  const variantSpecificationAttributes = useMemo(() => {
    if (!product?.variants || product.variants.length === 0) return [];

    const dimMap = new Map<string, Set<string>>();
    product.variants.forEach((v) => {
      (v.attributes || []).forEach((attr) => {
        const name = attr.name?.trim();
        const val = attr.value?.trim();
        if (!name || !val) return;
        if (!dimMap.has(name)) {
          dimMap.set(name, new Set());
        }
        dimMap.get(name)!.add(val);
      });
    });

    return Array.from(dimMap.entries())
      .filter(([_name, valuesSet]) => valuesSet.size === 1) // Pure specification attributes
      .map(([name, valuesSet]) => ({
        key: name,
        value: Array.from(valuesSet)[0],
      }));
  }, [product]);

  // ── 4. Smart Combination Matrix: Look-ahead Availability Check ─────────────
  // Returns true if picking `optionValue` for `dimensionName` matches at least one real variant in catalog
  const isOptionAvailable = (dimensionName: string, optionValue: string): boolean => {
    if (!product?.variants || product.variants.length === 0) return true;

    return product.variants.some((v) => {
      // Must match candidate value on this dimension
      const matchesCandidate = (v.attributes || []).some(
        (a) =>
          a.name.toLowerCase() === dimensionName.toLowerCase() &&
          a.value.toLowerCase() === optionValue.toLowerCase()
      );
      if (!matchesCandidate) return false;

      // Must also match all other currently selected dimensions
      return Object.entries(selectedAttributes).every(([otherDim, otherVal]) => {
        if (otherDim.toLowerCase() === dimensionName.toLowerCase()) return true; // skip target dimension
        return (v.attributes || []).some(
          (a) =>
            a.name.toLowerCase() === otherDim.toLowerCase() &&
            a.value.toLowerCase() === otherVal.toLowerCase()
        );
      });
    });
  };

  // ── 5. Select Attribute Value Handler (with smart auto-repair) ───────────────
  const handleSelectAttribute = (dimensionName: string, optionValue: string) => {
    if (!product?.variants) return;

    const nextSelection: Record<string, string> = {
      ...selectedAttributes,
      [dimensionName]: optionValue,
    };

    // Check if the exact combination exists
    const exactMatch = product.variants.find((v) =>
      Object.entries(nextSelection).every(([dim, val]) =>
        (v.attributes || []).some(
          (a) => a.name.toLowerCase() === dim.toLowerCase() && a.value.toLowerCase() === val.toLowerCase()
        )
      )
    );

    if (exactMatch) {
      setSelectedAttributes(nextSelection);
    } else {
      // Combination doesn't exist: find the best alternative variant that has `optionValue` for `dimensionName`
      const candidateVariant = product.variants.find((v) =>
        (v.attributes || []).some(
          (a) =>
            a.name.toLowerCase() === dimensionName.toLowerCase() &&
            a.value.toLowerCase() === optionValue.toLowerCase()
        )
      );

      if (candidateVariant) {
        const repairedSelection: Record<string, string> = {};
        (candidateVariant.attributes || []).forEach((a) => {
          repairedSelection[a.name] = a.value;
        });
        setSelectedAttributes(repairedSelection);
      } else {
        setSelectedAttributes(nextSelection);
      }
    }
  };

  // ── 6. Resolve Active Variant from Current Selection ────────────────────────
  const activeVariant = useMemo(() => {
    if (!product?.variants || product.variants.length === 0) return null;

    return (
      product.variants.find((v) =>
        Object.entries(selectedAttributes).every(([dim, val]) =>
          (v.attributes || []).some(
            (a) => a.name.toLowerCase() === dim.toLowerCase() && a.value.toLowerCase() === val.toLowerCase()
          )
        )
      ) || null
    );
  }, [product, selectedAttributes]);

  // ── 6a. Sync Active Variant to URL Query String (?sku=...) ──────────────────
  // Replaces the query string without adding unnecessary browser history states
  useEffect(() => {
    if (!activeVariant) return;
    const variantSku = activeVariant.variantSku || (activeVariant as any).sku;
    if (!variantSku) return;

    const currentSkuInUrl = searchParams.get('sku');
    if (currentSkuInUrl !== variantSku) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set('sku', variantSku);
      if (nextParams.has('variant')) {
        nextParams.delete('variant');
      }
      setSearchParams(nextParams, { replace: true });
    }
  }, [activeVariant, searchParams, setSearchParams]);

  // ── 6b. Respond to Browser Back/Forward or External URL Changes ──────────────
  useEffect(() => {
    if (!product?.variants || product.variants.length === 0) return;
    const skuParam = searchParams.get('sku')?.trim().toLowerCase();
    const variantParam = searchParams.get('variant')?.trim();
    if (!skuParam && !variantParam) return;

    const currentActiveSku = (activeVariant?.variantSku || (activeVariant as any)?.sku || '').trim().toLowerCase();
    if (skuParam && currentActiveSku === skuParam) return;

    let targetVariant = null;
    if (skuParam) {
      targetVariant = product.variants.find((v) => {
        const vSku = (v.variantSku || (v as any).sku || '').trim().toLowerCase();
        return vSku === skuParam;
      });
    }
    if (!targetVariant && variantParam) {
      targetVariant = product.variants.find(
        (v) => String(v.variantId) === variantParam || String((v as any).id) === variantParam
      );
    }

    if (targetVariant) {
      const newMap: Record<string, string> = {};
      (targetVariant.attributes || []).forEach((a) => {
        if (a.name && a.value) {
          newMap[a.name] = a.value;
        }
      });
      setSelectedAttributes(newMap);
    }
  }, [searchParams, product?.variants]);

  // ── 6c. Resolve Variant Preview (Thumbnail Asset, Price, SKU) for Swatches ──
  const getVariantPreviewForOption = (dimensionName: string, optionValue: string) => {
    if (!product?.variants || product.variants.length === 0) return null;

    const matchingVariants = product.variants.filter((v) =>
      (v.attributes || []).some(
        (a) =>
          a.name.toLowerCase() === dimensionName.toLowerCase() &&
          a.value.toLowerCase() === optionValue.toLowerCase()
      )
    );

    if (matchingVariants.length === 0) return null;

    // Prioritize candidates matching other currently selected attributes
    const bestMatch =
      matchingVariants.find((v) =>
        Object.entries(selectedAttributes).every(([otherDim, otherVal]) => {
          if (otherDim.toLowerCase() === dimensionName.toLowerCase()) return true;
          return (v.attributes || []).some(
            (a) =>
              a.name.toLowerCase() === otherDim.toLowerCase() &&
              a.value.toLowerCase() === otherVal.toLowerCase()
          );
        })
      ) || matchingVariants[0];

    const image = bestMatch.assets && bestMatch.assets.length > 0 ? bestMatch.assets[0] : null;
    const price = Number(bestMatch.price || 0);
    const mrp = Number(bestMatch.mrp || 0);
    const stock = Number(bestMatch.stock ?? 0);
    const sku = bestMatch.variantSku || (bestMatch as any).sku;

    return {
      variant: bestMatch,
      image,
      price,
      mrp,
      stock,
      sku,
      hasImage: Boolean(image),
    };
  };

  // Combined full specification matrix for the ACTIVE selected variant
  // Dynamically updates in real-time when the customer changes any option!
  const allSpecifications = useMemo(() => {
    const list: Array<{ key: string; value: string; isSelectedOption?: boolean }> = [];
    const seen = new Set<string>();

    // 1. Dynamic active variant attributes (e.g. Color, Size, Storage - changes with customer selection)
    if (activeVariant?.attributes && activeVariant.attributes.length > 0) {
      activeVariant.attributes.forEach((attr) => {
        const k = attr.name?.trim();
        const v = attr.value?.trim();
        if (k && v && !seen.has(k.toLowerCase())) {
          seen.add(k.toLowerCase());
          list.push({ key: k, value: v, isSelectedOption: true });
        }
      });
    }

    // 2. Add static specification attributes extracted from catalog variants
    variantSpecificationAttributes.forEach((attr) => {
      const k = attr.key.trim();
      const v = attr.value?.trim();
      if (k && v && !seen.has(k.toLowerCase())) {
        seen.add(k.toLowerCase());
        list.push({ key: k, value: v });
      }
    });

    // 3. Add product-level specifications
    (product?.specifications || []).forEach((spec) => {
      const k = spec.key?.trim();
      const v = spec.value?.trim();
      if (k && v && !seen.has(k.toLowerCase())) {
        seen.add(k.toLowerCase());
        list.push({ key: k, value: v });
      }
    });

    return list;
  }, [product, activeVariant, variantSpecificationAttributes]);

  // Dynamic Warranty Extraction: Only valid if non-empty and not explicitly "none" or "no warranty"
  const warrantySpec = useMemo(() => {
    return allSpecifications.find(
      (s) =>
        s.key.toLowerCase().includes('warranty') &&
        s.value &&
        !['none', 'no warranty', 'n/a', 'na', 'not applicable'].includes(s.value.trim().toLowerCase())
    );
  }, [allSpecifications]);

  const nonWarrantySpecifications = useMemo(() => {
    return allSpecifications.filter((s) => !s.key.toLowerCase().includes('warranty'));
  }, [allSpecifications]);

  // ── 7. Strict Variant Asset Scoping ─────────────────────────────────────────
  // When active variant has photos, show ONLY that variant's photos (no leak of other variant photos)
  const displayImages = useMemo(() => {
    if (!product) return [];
    if (activeVariant?.assets && activeVariant.assets.length > 0) {
      return activeVariant.assets;
    }
    return product.images.length > 0 ? product.images : [product.thumbnail];
  }, [product, activeVariant]);

  // Reset image index if active variant changes images
  useEffect(() => {
    setSelectedImageIdx(0);
  }, [activeVariant?.variantId]);

  // Live Inventory Resolution (Must stay at top level before early returns)
  const currentStock =
    activeVariant?.stock !== undefined
      ? Number(activeVariant.stock)
      : Number(product?.stock ?? 0);
  const currentPrice = activeVariant ? activeVariant.price : (product?.price ?? 0);
  const isCurrentOutOfStock = currentStock <= 0 || currentPrice <= 0;

  // Auto-clamp quantity if active variant has lower stock than selected quantity
  useEffect(() => {
    if (currentStock > 0 && quantity > currentStock) {
      setQuantity(currentStock);
    }
  }, [currentStock, quantity]);

  // Loading & Not Found states
  if (loading && !product) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-10 h-10 text-primary-600 animate-spin" />
        <p className="text-sm font-semibold text-slate-500">Loading catalog specifications...</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="w-16 h-16 rounded-3xl bg-rose-50 text-rose-500 flex items-center justify-center">
          <Layers className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Product Not Found</h2>
        <p className="text-xs text-slate-500 max-w-md">
          The requested product may have been deactivated or moved. Explore our latest featured items instead.
        </p>
        <button
          onClick={() => navigate('/')}
          className="px-6 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors"
        >
          Return to Storefront
        </button>
      </div>
    );
  }

  // Dynamic Commercials & Inventory Resolution
  const currentMrp = activeVariant ? activeVariant.mrp : product.originalPrice;
  const currentSku = activeVariant ? activeVariant.variantSku : product.parentSku;
  const currentSeller = activeVariant?.seller || null;

  const isWishlisted = wishlistIds.includes(product.id);
  const discountPercent =
    currentMrp > currentPrice ? Math.round(((currentMrp - currentPrice) / currentMrp) * 100) : 0;

  const highlights = product.highlights || product.features || [];

  // Add to Bag Handler
  const handleAdd = () => {
    if (isCurrentOutOfStock) return;

    // Construct resolved product with exact active SKU pricing
    const resolvedProduct: Product = {
      ...product,
      price: currentPrice,
      originalPrice: currentMrp,
      parentSku: currentSku || product.parentSku,
      stock: currentStock,
    };

    const resolvedColor =
      selectedAttributes['Color'] || selectedAttributes['Colour'] || selectedColor;
    const resolvedSize =
      selectedAttributes['Size'] ||
      selectedAttributes['Storage'] ||
      selectedAttributes['Pack Size'] ||
      selectedSize;

    onAddToCart(resolvedProduct, quantity, resolvedColor, resolvedSize);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1600);
  };

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] pb-20">
      {/* ── Top Breadcrumb Navigation ────────────────────────────────────────── */}
      <div className="bg-[#FAF9F6]/90 border-b border-stone-200/70 sticky top-0 z-20 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs text-slate-500 overflow-x-auto whitespace-nowrap scrollbar-none py-0.5">
            <Link to="/" className="hover:text-primary-600 font-medium transition-colors">
              Home
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <Link to="/" className="hover:text-primary-600 font-medium transition-colors">
              {product.category}
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="font-bold text-slate-800 truncate max-w-xs">{product.name}</span>
          </div>

          <button
            onClick={() => navigate(-1)}
            className="hidden sm:inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8">
        {/* ── Main Product Showcase Grid ──────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 bg-white rounded-3xl p-6 sm:p-10 border border-slate-200/90 shadow-sm">
          {/* Left Column: Multi-Image Gallery */}
          <div className="lg:col-span-6 flex flex-col justify-between space-y-4">
            <div className="relative aspect-square w-full rounded-3xl overflow-hidden bg-slate-50 border border-slate-200/80 shadow-subtle group flex items-center justify-center">
              {(() => {
                const currentMedia = displayImages[selectedImageIdx] || product.thumbnail;
                const isVideo = /\.(mp4|webm|mov|quicktime)$/i.test(currentMedia);
                if (isVideo) {
                  return (
                    <video
                      src={currentMedia}
                      controls
                      autoPlay
                      muted
                      className="w-full h-full object-contain bg-black"
                    />
                  );
                }
                return (
                  <img
                    src={currentMedia}
                    alt={product.name}
                    className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500 ease-out"
                  />
                );
              })()}

              {activeVariant && (
                <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-200 shadow-sm flex items-center gap-1.5 text-[11px] font-bold text-slate-700 z-10">
                  <Tag className="w-3 h-3 text-primary-600" />
                  <span>SKU: {activeVariant.variantSku}</span>
                </div>
              )}
            </div>

            {/* Thumbnail Row */}
            {displayImages.length > 1 && (
              <div className="flex items-center space-x-3 overflow-x-auto pb-2 pt-1 scrollbar-none">
                {displayImages.map((img, idx) => {
                  const isVideoThumb = /\.(mp4|webm|mov|quicktime)$/i.test(img);
                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedImageIdx(idx)}
                      className={`relative w-20 h-20 rounded-2xl overflow-hidden border-2 transition-all flex-shrink-0 cursor-pointer bg-slate-900 ${
                        selectedImageIdx === idx
                          ? 'border-primary-600 ring-4 ring-primary-500/20 scale-105'
                          : 'border-slate-200 opacity-70 hover:opacity-100 hover:border-slate-300'
                      }`}
                    >
                      {isVideoThumb ? (
                        <div className="w-full h-full flex items-center justify-center bg-slate-900 text-white">
                          <video src={img} className="w-full h-full object-cover opacity-60" muted preload="metadata" />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-6 h-6 rounded-full bg-white/80 text-primary-600 flex items-center justify-center">
                              <Play className="w-3 h-3 fill-current ml-0.5" />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <img src={img} alt="" className="w-full h-full object-cover" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Product Details & Purchase Hub */}
          <div className="lg:col-span-6 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              {/* Brand & Category Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-primary-50 text-primary-700 font-extrabold text-[11px] uppercase tracking-wider border border-primary-100">
                    {product.brand?.brandName || product.subtitle}
                  </span>
                  <span className="text-xs text-slate-400">•</span>
                  <span className="text-xs font-semibold text-slate-600">{product.category}</span>
                </div>

                <button
                  onClick={handleShare}
                  className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 p-2 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Share product"
                >
                  <Share2 className="w-4 h-4" />
                  <span className="text-[11px] font-semibold">
                    {copiedShare ? 'Link Copied!' : 'Share'}
                  </span>
                </button>
              </div>

              {/* Title & SKU Badges */}
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-snug">
                  {product.name}
                </h1>

                {/* Rating Badge */}
                <div className="mt-2 flex items-center gap-2">
                  {ratingSummary && ratingSummary.totalReviews > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('reviews');
                        const el = document.getElementById('product-tabs-section');
                        el?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 hover:bg-amber-100/80 text-amber-900 border border-amber-200 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                    >
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                      <span>{ratingSummary.averageRating.toFixed(1)}</span>
                      <span className="text-amber-700/70 font-normal">
                        ({ratingSummary.totalReviews.toLocaleString()}{' '}
                        {ratingSummary.totalReviews === 1 ? 'review' : 'reviews'})
                      </span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('reviews');
                        const el = document.getElementById('product-tabs-section');
                        el?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200/80 text-slate-600 text-xs font-medium transition-all cursor-pointer"
                    >
                      <Star className="w-3.5 h-3.5 text-slate-400" />
                      <span>No reviews yet</span>
                      <span className="text-primary-600 font-bold">• Write review</span>
                    </button>
                  )}
                </div>

                {currentSku && (
                  <div className="flex flex-wrap items-center gap-3 mt-2 font-mono text-[11px]">
                    <span className="bg-slate-100 text-slate-700 font-bold px-2.5 py-0.5 rounded-md border border-slate-200">
                      SKU: {currentSku}
                    </span>
                  </div>
                )}
              </div>

              {/* Seller Attribution (if available) */}
              {currentSeller?.sellerName && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-600 font-medium flex items-center gap-1.5 bg-slate-50 px-3 py-1 rounded-full border border-slate-200">
                    <Store className="w-3.5 h-3.5 text-slate-500" />
                    Sold by: <strong className="text-slate-800">{currentSeller.businessName || currentSeller.sellerName}</strong>
                  </span>
                </div>
              )}

              {/* Dynamic Price Block */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                <div className="flex items-baseline space-x-3">
                  {currentPrice > 0 ? (
                    <>
                      <span className="text-3xl sm:text-4xl font-black text-slate-900">
                        {currSymbol}
                        {currentPrice.toFixed(2)}
                      </span>
                      {currentMrp > currentPrice && (
                        <span className="text-base text-slate-400 line-through">
                          {currSymbol}
                          {currentMrp.toFixed(2)}
                        </span>
                      )}
                      {discountPercent > 0 && (
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-100/80 px-2.5 py-0.5 rounded-full border border-emerald-200">
                          Save {discountPercent}% OFF
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-2xl font-black text-rose-600">
                      Currently Unavailable
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 font-medium">
                  Inclusive of all taxes • Free standard delivery on orders above ₹499.
                </p>

                {/* Stock Indicator: Show available quantity ONLY IF < 10, otherwise don't show */}
                {currentStock > 0 && currentStock < 10 && (
                  <div className="pt-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200/80">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                      Only {currentStock} left in stock - order soon!
                    </span>
                  </div>
                )}

                {/* Out of stock badge when variant has 0 inventory */}
                {currentStock <= 0 && (
                  <div className="pt-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200">
                      <span className="w-2 h-2 rounded-full bg-rose-500" />
                      Currently Out of Stock
                    </span>
                  </div>
                )}
              </div>

              {/* Highlights Bullet Card */}
              {highlights.length > 0 && (
                <div className="bg-slate-50/90 rounded-2xl p-4 border border-slate-200/80 space-y-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-primary-600" />
                    Key Product Highlights
                  </h3>

                  <ul className="space-y-2">
                    {highlights.map((bullet, idx) => (
                      <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 shrink-0" />
                        <span className="leading-relaxed font-medium">{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* ── 8. DYNAMIC MULTI-VARIANT RESOLUTION MATRIX ──────────────── */}
              {attributeDimensions.length > 0 ? (
                <div className="space-y-4 pt-2 border-t border-slate-100">
                  {attributeDimensions.map((dimension) => {
                    const dimNameLower = dimension.name.toLowerCase().trim();

                    // 1. Explicitly check if dimension is a spec / measurement dimension (MUST ALWAYS be clean text pills)
                    const isSizingOrSpecDim = [
                      'size',
                      'storage',
                      'ram',
                      'capacity',
                      'pack',
                      'pack size',
                      'weight',
                      'wattage',
                      'length',
                      'volume',
                      'dimension',
                      'voltage',
                      'plug',
                      'quantity',
                    ].some((k) => dimNameLower === k || dimNameLower.startsWith(k) || dimNameLower.endsWith(k));

                    // 2. Check if dimension is semantically visual (Color, Style, Pattern, Finish, Shade, etc.)
                    const isVisualAttribute =
                      !isSizingOrSpecDim &&
                      ['color', 'colour', 'style', 'pattern', 'finish', 'shade', 'edition', 'print', 'design', 'material'].some(
                        (k) => dimNameLower.includes(k)
                      );

                    // 3. For visual attributes, check if unique photo assets or colors exist
                    const optionImages = dimension.values
                      .map((val) => getVariantPreviewForOption(dimension.name, val)?.image)
                      .filter(Boolean);
                    const hasDistinctImages = new Set(optionImages).size > 1;
                    const hasColors = dimension.values.some((val) => Boolean(getColorHex(val)));

                    // A dimension renders as miniature image cards ONLY if it is visual AND has either distinct photos or colors
                    const isVisualDim = isVisualAttribute && (hasDistinctImages || hasColors);

                    const currentSelectedVal = selectedAttributes[dimension.name];

                    return (
                      <div key={dimension.name} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                            Select {dimension.name}:{' '}
                            <span className="text-primary-600 font-black normal-case">
                              {currentSelectedVal || 'Choose option'}
                            </span>
                          </label>

                          <span className="text-[11px] text-slate-400 font-medium">
                            {dimension.values.length} options
                          </span>
                        </div>

                        {/* Attribute Option Buttons */}
                        <div className="flex flex-wrap items-center gap-2.5">
                          {dimension.values.map((val) => {
                            const isSelected =
                              currentSelectedVal?.toLowerCase() === val.toLowerCase();
                            const isAvailable = isOptionAvailable(dimension.name, val);
                            const hexColor = getColorHex(val);
                            const preview = getVariantPreviewForOption(dimension.name, val);

                            // Miniature Image Swatch Presentation with Hover Preview Tooltip
                            if (isVisualDim) {
                              return (
                                <div key={val} className="relative group">
                                  {/* Floating Hover Tooltip: Color/Option name + Live Price */}
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-slate-900/95 text-white text-[11px] font-semibold rounded-lg shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-all duration-150 z-30 whitespace-nowrap flex items-center gap-1.5 backdrop-blur-sm border border-slate-700/50">
                                    <span>{val}</span>
                                    {preview?.price ? (
                                      <>
                                        <span className="text-slate-400">•</span>
                                        <span className="text-emerald-400 font-bold">
                                          {currSymbol}{Number(preview.price).toLocaleString('en-IN')}
                                        </span>
                                      </>
                                    ) : null}
                                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900/95 rotate-45 border-r border-b border-slate-700/50" />
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => handleSelectAttribute(dimension.name, val)}
                                    className={`relative w-12 h-12 sm:w-13 sm:h-13 rounded-xl border-2 p-0.5 flex items-center justify-center transition-all cursor-pointer bg-white ${
                                      isSelected
                                        ? 'border-primary-600 ring-2 ring-primary-600 ring-offset-2 scale-105 shadow-md'
                                        : isAvailable
                                        ? 'border-slate-200 hover:border-slate-400 hover:scale-102'
                                        : 'border-slate-200 border-dashed opacity-40 cursor-not-allowed'
                                    }`}
                                    aria-label={`${dimension.name}: ${val}`}
                                  >
                                    <div className="w-full h-full rounded-lg overflow-hidden flex items-center justify-center bg-slate-50">
                                      {preview?.image ? (
                                        <img
                                          src={getImageUrl(preview.image)}
                                          alt={val}
                                          className="w-full h-full object-cover object-center"
                                          loading="lazy"
                                        />
                                      ) : hexColor ? (
                                        <div className="w-full h-full" style={{ backgroundColor: hexColor }} />
                                      ) : (
                                        <span className="text-[10px] font-bold text-slate-700 uppercase tracking-tighter truncate px-1">
                                          {val}
                                        </span>
                                      )}
                                    </div>

                                    {!isAvailable && (
                                      <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/50 backdrop-blur-[0.5px]">
                                        <Ban className="w-4 h-4 text-rose-500 drop-shadow" />
                                      </div>
                                    )}
                                  </button>
                                </div>
                              );
                            }

                            // Standard Pill Presentation (Sizes, Storage, RAM, Pack Size, etc.) with Hover Price Tooltip
                            return (
                              <div key={val} className="relative group">
                                {/* Hover Tooltip with Option Name & Price */}
                                {preview?.price ? (
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-slate-900/95 text-white text-[11px] font-semibold rounded-lg shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-all duration-150 z-30 whitespace-nowrap flex items-center gap-1.5 backdrop-blur-sm border border-slate-700/50">
                                    <span>{val}</span>
                                    <span className="text-slate-400">•</span>
                                    <span className="text-emerald-400 font-bold">
                                      {currSymbol}{Number(preview.price).toLocaleString('en-IN')}
                                    </span>
                                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900/95 rotate-45 border-r border-b border-slate-700/50" />
                                  </div>
                                ) : null}

                                <button
                                  type="button"
                                  onClick={() => handleSelectAttribute(dimension.name, val)}
                                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer relative ${
                                    isSelected
                                      ? 'bg-slate-900 text-white shadow-md'
                                      : isAvailable
                                      ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900'
                                      : 'bg-slate-50 text-slate-300 border border-dashed border-slate-200 line-through opacity-50 cursor-not-allowed'
                                  }`}
                                  aria-label={`${dimension.name}: ${val}`}
                                >
                                  <span>{val}</span>
                                  {!isAvailable && (
                                    <span className="text-[10px] text-rose-400 font-normal no-underline">
                                      ✕
                                    </span>
                                  )}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Legacy Fallback if product has no variants array */
                <div className="space-y-4 pt-2 border-t border-slate-100">
                  {/* Variant Selector: Color */}
                  {product.colors && product.colors.length > 0 && (
                    <div>
                      <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                        Select Color:{' '}
                        <span className="text-primary-600 font-semibold">{selectedColor}</span>
                      </label>
                      <div className="flex items-center space-x-3">
                        {product.colors.map((c) => (
                          <div key={c.name} className="relative group">
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 bg-slate-900/95 text-white text-[11px] font-semibold rounded-lg shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-all duration-150 z-30 whitespace-nowrap backdrop-blur-sm border border-slate-700/50">
                              <span>{c.name}</span>
                              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900/95 rotate-45 border-r border-b border-slate-700/50" />
                            </div>
                            <button
                              type="button"
                              onClick={() => setSelectedColor(c.name)}
                              className={`w-9 h-9 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer ${
                                selectedColor === c.name
                                  ? 'border-primary-600 ring-2 ring-primary-600 ring-offset-2 scale-110 shadow-md'
                                  : 'border-slate-300 hover:scale-105'
                              }`}
                              style={{ backgroundColor: c.hex }}
                              aria-label={c.name}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Variant Selector: Size */}
                  {product.sizes && product.sizes.length > 0 && (
                    <div>
                      <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                        Select Size:{' '}
                        <span className="text-primary-600 font-semibold">{selectedSize}</span>
                      </label>
                      <div className="flex items-center space-x-2.5">
                        {product.sizes.map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setSelectedSize(s)}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                              selectedSize === s
                                ? 'bg-slate-900 text-white shadow-md'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Quantity Stepper & Add to Bag CTAs */}
              <div className="pt-4 border-t border-slate-100 space-y-4">
                <div className="flex items-center space-x-4">
                  {/* Quantity Stepper */}
                  <div
                    className={`flex items-center border rounded-2xl p-1 bg-slate-50 transition-all ${
                      isCurrentOutOfStock
                        ? 'border-slate-200 opacity-40 cursor-not-allowed'
                        : 'border-slate-200'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      disabled={isCurrentOutOfStock}
                      className="w-10 h-10 flex items-center justify-center text-slate-600 hover:text-slate-900 font-bold cursor-pointer disabled:cursor-not-allowed"
                    >
                      -
                    </button>
                    <span className="w-10 text-center text-sm font-bold text-slate-900">
                      {isCurrentOutOfStock ? 0 : quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setQuantity((q) =>
                          currentStock > 0 ? Math.min(currentStock, q + 1) : q + 1
                        )
                      }
                      disabled={isCurrentOutOfStock || (currentStock > 0 && quantity >= currentStock)}
                      className="w-10 h-10 flex items-center justify-center text-slate-600 hover:text-slate-900 font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      +
                    </button>
                  </div>

                  {/* Add to Bag CTA */}
                  <button
                    type="button"
                    onClick={handleAdd}
                    disabled={isCurrentOutOfStock}
                    aria-label={isCurrentOutOfStock ? 'Product out of stock' : 'Add product to bag'}
                    className={`flex-1 py-3.5 px-6 rounded-2xl font-bold text-sm flex items-center justify-center space-x-2 transition-all shadow-glow ${
                      isCurrentOutOfStock
                        ? 'bg-slate-100 text-slate-400 border border-slate-200/80 cursor-not-allowed shadow-none'
                        : justAdded
                        ? 'bg-emerald-600 text-white shadow-emerald-500/20 cursor-pointer'
                        : 'bg-primary-600 hover:bg-primary-700 text-white shadow-primary-600/20 cursor-pointer active:scale-95'
                    }`}
                  >
                    {isCurrentOutOfStock ? (
                      <span>Out of Stock</span>
                    ) : justAdded ? (
                      <>
                        <Check className="w-5 h-5" />
                        <span>Added to Shopping Bag!</span>
                      </>
                    ) : (
                      <>
                        <ShoppingBag className="w-5 h-5" />
                        <span>
                          Add to Bag • {currSymbol}
                          {(currentPrice * quantity).toFixed(2)}
                        </span>
                      </>
                    )}
                  </button>

                  {/* Wishlist CTA */}
                  <button
                    type="button"
                    onClick={() => onToggleWishlist(product)}
                    className={`p-3.5 rounded-2xl border transition-colors cursor-pointer ${
                      isWishlisted
                        ? 'border-rose-200 bg-rose-50 text-rose-500'
                        : 'border-slate-200 text-slate-500 hover:text-rose-500 hover:bg-slate-50'
                    }`}
                    title="Add to Wishlist"
                  >
                    <Heart className={`w-5 h-5 ${isWishlisted ? 'fill-rose-500' : ''}`} />
                  </button>
                </div>
              </div>

              {/* ── Enterprise Guarantees  ────────────────────────── */}
              <div
                className={`grid gap-3 pt-4 border-t border-slate-100 text-[11px] text-slate-600 ${
                  warrantySpec && product.returnPolicy
                    ? 'grid-cols-2 sm:grid-cols-4'
                    : warrantySpec || product.returnPolicy
                    ? 'grid-cols-3'
                    : 'grid-cols-2'
                }`}
              >
                <div className="flex flex-col items-center text-center p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  <Truck className="w-5 h-5 text-primary-600 mb-1" />
                  <span className="font-bold text-slate-900">Free Express Delivery</span>
                  <span className="text-[10px] text-slate-400">Orders above ₹499</span>
                </div>
                {/* Dynamic Return Policy Trust Badge - Exact Policy Name */}
                {product.returnPolicy && (
                  <div className="flex flex-col items-center text-center p-3 rounded-2xl bg-slate-50 border border-slate-100">
                    <RotateCcw className="w-5 h-5 text-emerald-600 mb-1" />
                    <span className="font-bold text-slate-900 line-clamp-1" title={product.returnPolicy.policyName}>
                      {product.returnPolicy.policyName}
                    </span>
                    <span className="text-[10px] text-slate-400">Return Policy</span>
                  </div>
                )}
                <div className="flex flex-col items-center text-center p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  <Award className="w-5 h-5 text-amber-600 mb-1" />
                  <span className="font-bold text-slate-900">100% Genuine</span>
                  <span className="text-[10px] text-slate-400">Direct brand authorized</span>
                </div>
                {/* Dynamic Warranty Badge - Exact Attribute Value */}
                {warrantySpec && (
                  <div className="flex flex-col items-center text-center p-3 rounded-2xl bg-slate-50 border border-slate-100">
                    <ShieldCheck className="w-5 h-5 text-primary-600 mb-1" />
                    <span className="font-bold text-slate-900 line-clamp-1" title={warrantySpec.value}>
                      {warrantySpec.value}
                    </span>
                    <span className="text-[10px] text-slate-400">{warrantySpec.key}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Bottom Information Tabs ────────────────────────────────────────── */}
        <div id="product-tabs-section" className="mt-12 bg-white rounded-3xl p-6 sm:p-10 border border-slate-200/90 shadow-sm space-y-6 scroll-mt-24">
          {/* Tab Navigation */}
          <div className="flex flex-wrap items-center gap-4 sm:gap-6 border-b border-slate-100 pb-4">
            <button
              onClick={() => setActiveTab('overview')}
              className={`text-sm font-bold pb-2 transition-all border-b-2 cursor-pointer ${
                activeTab === 'overview'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Overview & Details
            </button>
            <button
              onClick={() => setActiveTab('specs')}
              className={`text-sm font-bold pb-2 transition-all border-b-2 cursor-pointer ${
                activeTab === 'specs'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Specifications
            </button>
            <button
              onClick={() => setActiveTab('shipping')}
              className={`text-sm font-bold pb-2 transition-all border-b-2 cursor-pointer ${
                activeTab === 'shipping'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {warrantySpec ? 'Shipping, Returns & Warranty' : 'Shipping & Returns'}
            </button>
            <button
              onClick={() => setActiveTab('reviews')}
              className={`text-sm font-bold pb-2 transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'reviews'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
              <span>Reviews</span>
              {ratingSummary && ratingSummary.totalReviews > 0 && (
                <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-bold">
                  {ratingSummary.totalReviews}
                </span>
              )}
            </button>
          </div>

          {/* Tab 1: Overview */}
          {activeTab === 'overview' && (
            <div className="space-y-6 text-xs text-slate-650 leading-relaxed">
              <p className="text-sm font-normal text-slate-700">
                {product.description ||
                  'Engineered for premium performance and verified by marketplace authenticity checks. Every unit undergoes automated intake audits before distribution.'}
              </p>

              {product.features && product.features.length > 0 && (
                <div className="space-y-3 pt-2">
                  <h4 className="text-sm font-bold text-slate-900">Comprehensive Product Capabilities</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {product.features.map((h, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-100"
                      >
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                        <span className="text-xs text-slate-700 font-medium">{h}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Technical Specifications  */}
          {activeTab === 'specs' && (
            <div className="py-2 space-y-4">
              <h4 className="text-sm font-bold text-slate-900">Full Product Specifications </h4>
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs">
                  <tbody className="divide-y divide-slate-100">
                    {/* Dynamic Variant SKU */}
                    {currentSku && (
                      <tr className="bg-primary-50/30">
                        <td className="px-5 py-3 font-bold text-slate-700 w-1/3">
                          SKU
                        </td>
                        <td className="px-5 py-3 font-mono text-primary-700 font-extrabold flex items-center justify-between">
                          <span>{currentSku}</span>
                          <span className="text-[10px] font-bold uppercase tracking-wider bg-primary-100/80 text-primary-800 px-2 py-0.5 rounded">
                            Active
                          </span>
                        </td>
                      </tr>
                    )}
                    {/* Dynamic Variant Model Code if present */}
                    {activeVariant?.modelCode && (
                      <tr>
                        <td className="px-5 py-3 font-bold text-slate-600">Variant Model Code</td>
                        <td className="px-5 py-3 font-mono text-slate-900">{activeVariant.modelCode}</td>
                      </tr>
                    )}
                    {/* Dynamic GTIN / Barcode if present */}
                    {activeVariant?.gtin && (
                      <tr className="bg-slate-50/50">
                        <td className="px-5 py-3 font-bold text-slate-600">GTIN / Barcode</td>
                        <td className="px-5 py-3 font-mono text-slate-900">{activeVariant.gtin}</td>
                      </tr>
                    )}
                    <tr className="bg-slate-50/50">
                      <td className="px-5 py-3 font-bold text-slate-600">Brand Manufacturer</td>
                      <td className="px-5 py-3 text-slate-900">
                        {product.brand?.brandName || product.subtitle}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-5 py-3 font-bold text-slate-600">Category Classification</td>
                      <td className="px-5 py-3 text-slate-900">{product.category}</td>
                    </tr>
                    {product.returnPolicy && (
                      <tr className="bg-slate-50/50">
                        <td className="px-5 py-3 font-bold text-slate-600">Return Policy</td>
                        <td className="px-5 py-3 text-slate-900 font-semibold">{product.returnPolicy.policyName}</td>
                      </tr>
                    )}
                    {warrantySpec && (
                      <tr className="bg-slate-50/50">
                        <td className="px-5 py-3 font-bold text-slate-600">{warrantySpec.key}</td>
                        <td className="px-5 py-3 text-slate-900 font-semibold">{warrantySpec.value}</td>
                      </tr>
                    )}
                    {nonWarrantySpecifications.length > 0 ? (
                      nonWarrantySpecifications.map((spec, i) => (
                        <tr
                          key={i}
                          className={
                            spec.isSelectedOption
                              ? 'bg-amber-50/30 font-medium'
                              : i % 2 === 0
                              ? 'bg-slate-50/50'
                              : 'bg-white'
                          }
                        >
                          <td className="px-5 py-3 font-bold text-slate-600">
                            <span className="flex items-center gap-2">
                              <span>{spec.key}</span>
                              {spec.isSelectedOption && (
                                <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-primary-100 text-primary-700">
                                  Current
                                </span>
                              )}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-slate-900 font-semibold">
                            {typeof spec.value === 'string' && spec.value.includes('\n') ? (
                              <ul className="list-disc list-inside space-y-1 my-1">
                                {spec.value
                                  .split('\n')
                                  .map((line: string) => line.trim())
                                  .filter(Boolean)
                                  .map((item: string, idx: number) => (
                                    <li key={idx} className="leading-snug">
                                      {item.replace(/^[•\-\*]\s*/, '')}
                                    </li>
                                  ))}
                              </ul>
                            ) : (
                              spec.value
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr className="bg-slate-50/50">
                        <td className="px-5 py-3 font-bold text-slate-600">Quality Assurance</td>
                        <td className="px-5 py-3 text-slate-900">
                          Marketplace Certified Inspection Passed
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab 3: Shipping, Returns & Warranty (Static Enterprise Policies) */}
          {activeTab === 'shipping' && (
            <div className="py-2 space-y-4 text-xs text-slate-650 leading-relaxed">
              {/* Delivery Box */}
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center space-x-2">
                  <Truck className="w-4 h-4 text-primary-600" />
                  <h4 className="font-bold text-slate-900 text-sm">Express Delivery & Fulfillment</h4>
                </div>
                <p>
                  Complimentary free express delivery applies on all orders above ₹499.
                </p>
              </div>

              {/* Dynamic Returns Policy Box - Exact Policy Name */}
              {product.returnPolicy && (
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center space-x-2">
                    <RotateCcw className="w-4 h-4 text-emerald-600" />
                    <h4 className="font-bold text-slate-900 text-sm">
                      {product.returnPolicy.policyName}
                    </h4>
                  </div>
                  {product.returnPolicy.conditionsSummary && (
                    <p className="font-semibold text-slate-800">{product.returnPolicy.conditionsSummary}</p>
                  )}
                  {product.returnPolicy.termsAndConditions && (
                    <p className="text-slate-600 leading-relaxed">{product.returnPolicy.termsAndConditions}</p>
                  )}
                </div>
              )}

              {/* Dynamic Warranty Policy Box - Exact Warranty Attribute */}
              {warrantySpec && (
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center space-x-2">
                    <ShieldCheck className="w-4 h-4 text-primary-600" />
                    <h4 className="font-bold text-slate-900 text-sm">
                      {warrantySpec.key}
                    </h4>
                  </div>
                  <p className="font-semibold text-slate-800">
                    {warrantySpec.value}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Tab 4: Verified Customer Reviews & Ratings */}
          {activeTab === 'reviews' && (
            <ProductReviewsSection
              productId={String(product.id)}
              productName={product.name}
              productImage={displayImages[0] || product.thumbnail}
              currentVariantSku={currentSku}
              isLoggedIn={Boolean(localStorage.getItem('saamaan_customer_user'))}
              onRequireLogin={() => {
                window.dispatchEvent(new CustomEvent('saamaan:open-account', { detail: { view: 'LOGIN' } }));
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};
