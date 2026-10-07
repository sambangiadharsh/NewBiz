import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
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
  PackageCheck,
  Loader2,
} from 'lucide-react';
import { Product } from '../types';
import { productsApi } from '../lib/productsApi';

interface ProductDetailPageProps {
  currency: string;
  wishlistIds: string[];
  onToggleWishlist: (product: Product) => void;
  onAddToCart: (product: Product, quantity: number, color?: string, size?: string) => void;
  allProducts: Product[];
}

export const ProductDetailPage: React.FC<ProductDetailPageProps> = ({
  currency,
  wishlistIds,
  onToggleWishlist,
  onAddToCart,
  allProducts,
}) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImageIdx, setSelectedImageIdx] = useState(0);
  const [selectedColor, setSelectedColor] = useState<string | undefined>();
  const [selectedSize, setSelectedSize] = useState<string | undefined>();
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<'overview' | 'specs' | 'shipping'>('overview');
  const [justAdded, setJustAdded] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);

  const currSymbol = '₹';

  // Load product from API or fallback from allProducts
  useEffect(() => {
    let isMounted = true;
    async function loadProduct() {
      if (!id) return;
      setLoading(true);

      // Check if product is already in allProducts state
      const localMatch = allProducts.find((p) => p.id === id);
      if (localMatch) {
        setProduct(localMatch);
        setSelectedColor(localMatch.colors?.[0]?.name);
        setSelectedSize(localMatch.sizes?.[0]);
      }

      try {
        const fetched = await productsApi.getProductById(id);
        if (isMounted && fetched) {
          setProduct(fetched);
          setSelectedColor(fetched.colors?.[0]?.name || localMatch?.colors?.[0]?.name);
          setSelectedSize(fetched.sizes?.[0] || localMatch?.sizes?.[0]);
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

  const isWishlisted = wishlistIds.includes(product.id);
  const discountPercent = product.originalPrice > product.price
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0;

  const highlights = product.highlights || product.features || [];

  const handleAdd = () => {
    onAddToCart(product, quantity, selectedColor, selectedSize);
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
    <div className="min-h-screen bg-slate-50/60 pb-20">
      {/* Top Breadcrumb Navigation */}
      <div className="bg-white border-b border-slate-200/80 sticky top-0 z-20 backdrop-blur-md bg-white/90">
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
        {/* Main Product Showcase Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 bg-white rounded-3xl p-6 sm:p-10 border border-slate-200/90 shadow-sm">
          
          {/* Left Column: Multi-Image Gallery */}
          <div className="lg:col-span-6 flex flex-col justify-between space-y-4">
            <div className="relative aspect-square w-full rounded-3xl overflow-hidden bg-slate-50 border border-slate-200/80 shadow-subtle group">
              <img
                src={product.images[selectedImageIdx] || product.thumbnail}
                alt={product.name}
                className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500 ease-out"
              />

            </div>

            {/* Thumbnail Row */}
            {product.images.length > 1 && (
              <div className="flex items-center space-x-3 overflow-x-auto pb-2 pt-1">
                {product.images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImageIdx(idx)}
                    className={`relative w-20 h-20 rounded-2xl overflow-hidden border-2 transition-all flex-shrink-0 cursor-pointer ${
                      selectedImageIdx === idx
                        ? 'border-primary-600 ring-4 ring-primary-500/20 scale-105'
                        : 'border-slate-200 opacity-70 hover:opacity-100 hover:border-slate-300'
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
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
                  <span className="text-xs font-semibold text-slate-600">
                    {product.category}
                  </span>
                </div>

                <button
                  onClick={handleShare}
                  className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 p-2 rounded-xl hover:bg-slate-100 transition-colors"
                  title="Share product"
                >
                  <Share2 className="w-4 h-4" />
                  <span className="text-[11px] font-semibold">{copiedShare ? 'Link Copied!' : 'Share'}</span>
                </button>
              </div>

              {/* Title & ParentSKU */}
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-snug">
                  {product.name}
                </h1>
                {product.parentSku && (
                  <p className="font-mono text-[11px] font-bold text-slate-400 mt-1">
                    ParentSKU: <span className="text-slate-600">{product.parentSku}</span>
                  </p>
                )}
              </div>

              {/* Fulfillment & QC Badge */}
              <div className="flex items-center space-x-2">
                <span className="text-xs text-emerald-700 font-bold flex items-center gap-1.5 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200/80">
                  <PackageCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Marketplace Fulfilled • 100% Quality Checked
                </span>
              </div>

              {/* Price Block */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                <div className="flex items-baseline space-x-3">
                  <span className="text-3xl sm:text-4xl font-black text-slate-900">
                    {currSymbol}{product.price.toFixed(2)}
                  </span>
                  {product.originalPrice > product.price && (
                    <span className="text-base text-slate-400 line-through">
                      {currSymbol}{product.originalPrice.toFixed(2)}
                    </span>
                  )}
                  {discountPercent > 0 && (
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-100/80 px-2.5 py-0.5 rounded-full border border-emerald-200">
                      Save {discountPercent}% OFF
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 font-medium">
                  Inclusive of all taxes & free standard delivery on orders above ₹499.
                </p>
              </div>

              {/* Highlights Bullet Card (Approach 1) */}
              {highlights.length > 0 && (
                <div className="bg-slate-50/90 rounded-2xl p-4 border border-slate-200/80 space-y-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-primary-600" />
                    Key Product Highlights
                  </h3>
                  <ul className="space-y-2">
                    {highlights.map((bullet, idx) => (
                      <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-700">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                        <span className="leading-relaxed font-medium">{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Variant Selector: Color */}
              {product.colors && product.colors.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                    Select Color: <span className="text-primary-600 font-semibold">{selectedColor}</span>
                  </label>
                  <div className="flex items-center space-x-3">
                    {product.colors.map((c) => (
                      <button
                        key={c.name}
                        onClick={() => setSelectedColor(c.name)}
                        className={`w-9 h-9 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer ${
                          selectedColor === c.name
                            ? 'border-primary-600 ring-2 ring-primary-500/30 scale-110 shadow-sm'
                            : 'border-slate-300 hover:scale-105'
                        }`}
                        style={{ backgroundColor: c.hex }}
                        title={c.name}
                      >
                        {selectedColor === c.name && (
                          <Check className="w-4 h-4 text-white mix-blend-difference" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Variant Selector: Size */}
              {product.sizes && product.sizes.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                    Select Size: <span className="text-primary-600 font-semibold">{selectedSize}</span>
                  </label>
                  <div className="flex items-center space-x-2.5">
                    {product.sizes.map((s) => (
                      <button
                        key={s}
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

              {/* Quantity Stepper & Add to Bag CTAs */}
              <div className="pt-4 border-t border-slate-100 space-y-4">
                <div className="flex items-center space-x-4">
                  {/* Quantity Stepper */}
                  <div className="flex items-center border border-slate-200 rounded-2xl p-1 bg-slate-50">
                    <button
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      className="w-10 h-10 flex items-center justify-center text-slate-600 hover:text-slate-900 font-bold cursor-pointer"
                    >
                      -
                    </button>
                    <span className="w-10 text-center text-sm font-bold text-slate-900">{quantity}</span>
                    <button
                      onClick={() => setQuantity((q) => q + 1)}
                      className="w-10 h-10 flex items-center justify-center text-slate-600 hover:text-slate-900 font-bold cursor-pointer"
                    >
                      +
                    </button>
                  </div>

                  {/* Discount Badge left of Add to Bag */}
                  {discountPercent > 0 && (
                    <div className="px-3.5 py-3 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center shrink-0">
                      <span className="text-xs font-black text-rose-600 tracking-tight">
                        {discountPercent}% OFF
                      </span>
                    </div>
                  )}

                  {/* Add to Bag CTA */}
                  <button
                    onClick={handleAdd}
                    className={`flex-1 py-3.5 px-6 rounded-2xl font-bold text-sm flex items-center justify-center space-x-2 transition-all shadow-glow cursor-pointer ${
                      justAdded
                        ? 'bg-emerald-600 text-white shadow-emerald-500/20'
                        : 'bg-primary-600 hover:bg-primary-700 text-white shadow-primary-600/20'
                    }`}
                  >
                    {justAdded ? (
                      <>
                        <Check className="w-5 h-5" />
                        <span>Added to Shopping Bag!</span>
                      </>
                    ) : (
                      <>
                        <ShoppingBag className="w-5 h-5" />
                        <span>Add to Bag • {currSymbol}{(product.price * quantity).toFixed(2)}</span>
                      </>
                    )}
                  </button>

                  {/* Wishlist CTA */}
                  <button
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

              {/* Guarantees Matrix */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-100 text-[11px] text-slate-600">
                <div className="flex flex-col items-center text-center p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  <Truck className="w-5 h-5 text-primary-600 mb-1" />
                  <span className="font-bold text-slate-900">Free Delivery</span>
                  <span className="text-[10px] text-slate-400">Orders above ₹499</span>
                </div>
                <div className="flex flex-col items-center text-center p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  <RotateCcw className="w-5 h-5 text-emerald-600 mb-1" />
                  <span className="font-bold text-slate-900">
                    {product.returnPolicy
                      ? product.returnPolicy.isReturnable
                        ? `${product.returnPolicy.returnWindowDays}-Day Return`
                        : product.returnPolicy.isReplaceable
                        ? `${product.returnPolicy.replacementWindowDays}-Day Replacement`
                        : 'Non-Returnable'
                      : '7-Day Return'}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {product.returnPolicy
                      ? product.returnPolicy.isReturnable
                        ? 'Refund or exchange'
                        : product.returnPolicy.isReplaceable
                        ? 'Replacement only'
                        : 'Hygiene / perishable'
                      : 'Standard policy'}
                  </span>
                </div>
                <div className="flex flex-col items-center text-center p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  <Award className="w-5 h-5 text-amber-600 mb-1" />
                  <span className="font-bold text-slate-900">100% Genuine</span>
                  <span className="text-[10px] text-slate-400">Direct from brand</span>
                </div>
                <div className="flex flex-col items-center text-center p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  <ShieldCheck className="w-5 h-5 text-primary-600 mb-1" />
                  <span className="font-bold text-slate-900">
                    {product.warrantyPolicy && product.warrantyPolicy.durationMonths > 0
                      ? product.warrantyPolicy.durationMonths >= 12
                        ? `${product.warrantyPolicy.durationMonths / 12}-Year Warranty`
                        : `${product.warrantyPolicy.durationMonths}-Mo Warranty`
                      : product.warrantyPolicy?.warrantyType === 'NONE'
                      ? 'No Warranty'
                      : 'Quality Assured'}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {product.warrantyPolicy && product.warrantyPolicy.durationMonths > 0
                      ? product.warrantyPolicy.serviceType === 'ON_SITE'
                        ? 'Doorstep service'
                        : 'Brand service center'
                      : 'Marketplace verified'}
                  </span>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Tabbed In-Depth Information Section */}
        <div className="mt-12 bg-white rounded-3xl p-6 sm:p-10 border border-slate-200/90 shadow-sm space-y-6">
          <div className="flex items-center space-x-2 border-b border-slate-200 pb-3 overflow-x-auto scrollbar-none">
            {[
              { key: 'overview', label: 'Product Overview' },
              { key: 'specs', label: 'Technical Specifications' },
              { key: 'shipping', label: 'Shipping, Returns & Warranty' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                  activeTab === tab.key
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab 1: Overview */}
          {activeTab === 'overview' && (
            <div className="space-y-6 py-2 text-sm text-slate-700 leading-relaxed">
              <div>
                <h4 className="text-base font-bold text-slate-900 mb-2">About this Product Family</h4>
                <p className="text-slate-650">{product.description}</p>
              </div>

              {highlights.length > 0 && (
                <div className="pt-4 border-t border-slate-100">
                  <h4 className="text-sm font-bold text-slate-900 mb-3">Key Value Propositions</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {highlights.map((h, i) => (
                      <div key={i} className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-100">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                        <span className="text-xs text-slate-700 font-medium">{h}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Technical Specifications */}
          {activeTab === 'specs' && (
            <div className="py-2 space-y-4">
              <h4 className="text-sm font-bold text-slate-900">Full Catalog Specification Matrix</h4>
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs">
                  <tbody className="divide-y divide-slate-100">
                    <tr className="bg-slate-50/50">
                      <td className="px-5 py-3 font-bold text-slate-600 w-1/3">Parent SKU</td>
                      <td className="px-5 py-3 font-mono text-slate-900">{product.parentSku || 'N/A'}</td>
                    </tr>
                    <tr>
                      <td className="px-5 py-3 font-bold text-slate-600">Brand Manufacturer</td>
                      <td className="px-5 py-3 text-slate-900">{product.brand?.brandName || product.subtitle}</td>
                    </tr>
                    <tr className="bg-slate-50/50">
                      <td className="px-5 py-3 font-bold text-slate-600">Category Classification</td>
                      <td className="px-5 py-3 text-slate-900">{product.category}</td>
                    </tr>
                    {product.returnPolicy && (
                      <tr>
                        <td className="px-5 py-3 font-bold text-slate-600">Return / Replacement Policy</td>
                        <td className="px-5 py-3 text-slate-900">{product.returnPolicy.policyName}</td>
                      </tr>
                    )}
                    {product.warrantyPolicy && (
                      <tr className="bg-slate-50/50">
                        <td className="px-5 py-3 font-bold text-slate-600">Warranty Protection</td>
                        <td className="px-5 py-3 text-slate-900">
                          {product.warrantyPolicy.policyName} ({product.warrantyPolicy.serviceType === 'ON_SITE' ? 'Doorstep Technician' : 'Authorized Brand Service Center'})
                        </td>
                      </tr>
                    )}
                    {product.specifications && product.specifications.length > 0 ? (
                      product.specifications.map((spec, i) => (
                        <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                          <td className="px-5 py-3 font-bold text-slate-600">{spec.key}</td>
                          <td className="px-5 py-3 text-slate-900">{spec.value}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="px-5 py-3 font-bold text-slate-600">Quality Assurance</td>
                        <td className="px-5 py-3 text-slate-900">Marketplace Certified Inspection Passed</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab 3: Shipping, Returns & Warranty */}
          {activeTab === 'shipping' && (
            <div className="py-2 space-y-4 text-xs text-slate-650 leading-relaxed">
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center space-x-2">
                  <Truck className="w-4 h-4 text-primary-600" />
                  <h4 className="font-bold text-slate-900 text-sm">Delivery & Fulfillment</h4>
                </div>
                <p>
                  Orders placed before 2:00 PM are processed same-day through verified automated warehouse logistics hubs. Standard shipping takes 2-4 business days. Complimentary free express delivery applies on all orders above ₹499.
                </p>
              </div>

              {/* Dynamic Return Policy Box */}
              {product.returnPolicy ? (
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center space-x-2">
                    <RotateCcw className="w-4 h-4 text-emerald-600" />
                    <h4 className="font-bold text-slate-900 text-sm">
                      {product.returnPolicy.policyName}
                    </h4>
                  </div>
                  {product.returnPolicy.conditionsSummary && (
                    <p className="font-semibold text-slate-800">
                      {product.returnPolicy.conditionsSummary}
                    </p>
                  )}
                  {product.returnPolicy.termsAndConditions && (
                    <p className="text-slate-600">
                      {product.returnPolicy.termsAndConditions}
                    </p>
                  )}
                  {product.returnPolicy.requiresTechnicianCheck && (
                    <div className="mt-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-medium">
                      ⚠️ Note: Return approval for this item is subject to an authorized brand technician diagnostic inspection at your doorstep.
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center space-x-2">
                    <RotateCcw className="w-4 h-4 text-emerald-600" />
                    <h4 className="font-bold text-slate-900 text-sm">Hassle-Free 7-Day Returns</h4>
                  </div>
                  <p>
                    If you are not completely satisfied with your purchase, initiate an automated return pickup through your customer dashboard with zero restocking fees.
                  </p>
                </div>
              )}

              {/* Dynamic Warranty Policy Box */}
              {product.warrantyPolicy && product.warrantyPolicy.durationMonths > 0 && (
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center space-x-2">
                    <ShieldCheck className="w-4 h-4 text-primary-600" />
                    <h4 className="font-bold text-slate-900 text-sm">
                      {product.warrantyPolicy.policyName}
                    </h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {product.warrantyPolicy.coveredSummary && (
                      <div className="p-3 bg-white rounded-xl border border-slate-100">
                        <span className="font-bold text-emerald-700 block mb-0.5">What is Covered</span>
                        <span className="text-slate-600">{product.warrantyPolicy.coveredSummary}</span>
                      </div>
                    )}
                    {product.warrantyPolicy.notCoveredSummary && (
                      <div className="p-3 bg-white rounded-xl border border-slate-100">
                        <span className="font-bold text-rose-700 block mb-0.5">What is NOT Covered</span>
                        <span className="text-slate-600">{product.warrantyPolicy.notCoveredSummary}</span>
                      </div>
                    )}
                  </div>
                  {product.warrantyPolicy.termsAndConditions && (
                    <p className="text-slate-600 pt-1">
                      {product.warrantyPolicy.termsAndConditions}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>


      </div>
    </div>
  );
};
