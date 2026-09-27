import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useParams } from 'react-router-dom';
import { PRODUCTS, CATEGORIES as FALLBACK_CATEGORIES } from './data/mockData';
import { Product, CartItem, Category } from './types';
import { categoriesApi } from './lib/categoriesApi';

// Header components
import { AnnouncementBar } from './components/header/AnnouncementBar';
import { MainHeader } from './components/header/MainHeader';
import { CategoryNavBar } from './components/header/CategoryNavBar';
import { MobileNavDrawer } from './components/header/MobileNavDrawer';
import { ProfilePage } from './components/profile/ProfilePage';

// Home & Catalog components
import { HeroBanner } from './components/home/HeroBanner';
import { CategoryPills } from './components/home/CategoryPills';
import { FlashDealsCountdown } from './components/home/FlashDealsCountdown';
import { CuratedCollections } from './components/home/CuratedCollections';
import { ProductCatalogSection } from './components/product/ProductCatalogSection';
import { FeaturedBrandsSection } from './components/home/FeaturedBrandsSection';

// Footer component
import { Footer } from './components/footer/Footer';

// Drawers & Modals
import { CartDrawer } from './components/cart/CartDrawer';
import { WishlistDrawer } from './components/wishlist/WishlistDrawer';
import { QuickViewModal } from './components/product/QuickViewModal';
import { TrackOrderModal } from './components/common/TrackOrderModal';
import { HelpConciergeModal } from './components/common/HelpConciergeModal';
import { Toast } from './components/common/Toast';
import { CookieConsentModal } from './components/common/CookieConsentModal';
import { CookieBanner } from './components/common/CookieBanner';
import { ScrollToTop } from './components/common/ScrollToTop';

// CMS Pages
import { CMSPageRenderer, FAQPage, ContactPage } from './components/cms/CMSPages';

// ─── Shared layout that wraps every page ────────────────────────────────────

interface LayoutProps {
  categories?: Category[];
  currency: string;
  onCurrencyChange: (c: string) => void;
  cartCount: number;
  cartTotal: number;
  wishlistCount: number;
  user: { name: string; email: string } | null;
  onOpenCart: () => void;
  onOpenWishlist: () => void;
  onOpenAccount: () => void;
  onOpenMobileMenu: () => void;
  onSelectProduct: (p: Product) => void;
  onSearchSubmit: (query: string, category: string) => void;
  onSelectCategory: (c: string) => void;
  onSelectSubcategory: (c: string, s: string) => void;
  onOpenTrackOrder: () => void;
  onOpenHelp: () => void;
  onOpenCookieSettings: () => void;
  selectedCategory: string;
  onLogout?: () => void;
  children: React.ReactNode;
}

const StorefrontLayout: React.FC<LayoutProps> = (props) => (
  <div className="min-h-screen bg-canvas text-dark-900 flex flex-col font-sans">
    <AnnouncementBar />
    <MainHeader
      categories={props.categories}
      cartCount={props.cartCount}
      cartTotal={props.cartTotal}
      wishlistCount={props.wishlistCount}
      currency={props.currency}
      onOpenCart={props.onOpenCart}
      onOpenWishlist={props.onOpenWishlist}
      onOpenAccount={props.onOpenAccount}
      onOpenMobileMenu={props.onOpenMobileMenu}
      onSelectProduct={props.onSelectProduct}
      onSearchSubmit={props.onSearchSubmit}
      user={props.user}
      onLogout={props.onLogout}
      onOpenTrackOrder={props.onOpenTrackOrder}
      onOpenHelp={props.onOpenHelp}
    />
    <CategoryNavBar
      categories={props.categories}
      selectedCategory={props.selectedCategory}
      onSelectCategory={props.onSelectCategory}
      onSelectSubcategory={props.onSelectSubcategory}
    />
    <main className="flex-1">
      {props.children}
    </main>
    <Footer
      onSelectCategory={props.onSelectCategory}
      onOpenTrackOrder={props.onOpenTrackOrder}
      onOpenCookieSettings={props.onOpenCookieSettings}
    />
  </div>
);

// ─── Home Page ───────────────────────────────────────────────────────────────

interface HomePageProps {
  categories?: Category[];
  products: typeof PRODUCTS;
  currency: string;
  selectedCategory: string;
  setSelectedCategory: (c: string) => void;
  searchFilterQuery: string;
  wishlist: Product[];
  onToggleWishlist: (p: Product) => void;
  onQuickView: (p: Product) => void;
  onAddToCart: (p: Product, q?: number) => void;
  onSelectCategory: (c: string) => void;
  onSearchSubmit: (query: string, category: string) => void;
  onClearSearch: () => void;
}

const HomePage: React.FC<HomePageProps> = ({
  categories,
  products,
  currency,
  selectedCategory,
  setSelectedCategory,
  searchFilterQuery,
  wishlist,
  onToggleWishlist,
  onQuickView,
  onAddToCart,
  onSelectCategory,
  onSearchSubmit,
  onClearSearch,
}) => {
  const filteredProducts = products.filter((p) => {
    const matchesCategory =
      selectedCategory === 'All' ||
      selectedCategory === 'Deals' ||
      selectedCategory === 'Trending' ||
      p.category.toLowerCase() === selectedCategory.toLowerCase() ||
      (p.tags && p.tags.some((t) => t.toLowerCase().includes(selectedCategory.toLowerCase()))) ||
      p.name.toLowerCase().includes(selectedCategory.toLowerCase());
    const matchesSearch =
      !searchFilterQuery ||
      p.name.toLowerCase().includes(searchFilterQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchFilterQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchFilterQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const wishlistIds = wishlist.map((p) => p.id);

  return (
    <>
      <HeroBanner onExploreCategory={(slug) => setSelectedCategory(slug || 'All')} />
      <CategoryPills
        categories={categories}
        selectedCategory={selectedCategory}
        onSelectCategory={onSelectCategory}
      />
      <FlashDealsCountdown
        products={products.filter((p) => p.originalPrice > p.price)}
        currency={currency}
        wishlistIds={wishlistIds}
        onQuickView={onQuickView}
        onAddToCart={onAddToCart}
        onToggleWishlist={onToggleWishlist}
      />
      <CuratedCollections onSelectCategory={onSelectCategory} />
      <ProductCatalogSection
        categoryNames={categories && categories.length > 0 ? ['All', ...categories.map((c) => c.name)] : undefined}
        products={filteredProducts}
        currency={currency}
        selectedCategory={selectedCategory}
        onSelectCategory={onSelectCategory}
        wishlistIds={wishlistIds}
        onToggleWishlist={onToggleWishlist}
        onQuickView={onQuickView}
        onAddToCart={onAddToCart}
        searchFilterQuery={searchFilterQuery}
        onClearSearch={onClearSearch}
      />
      <FeaturedBrandsSection
        onSelectBrand={(brandName) => {
          onSearchSubmit(brandName, 'All');
          const catalogEl = document.getElementById('catalog-section');
          if (catalogEl) {
            catalogEl.scrollIntoView({ behavior: 'smooth' });
          }
        }}
      />
    </>
  );
};

// Slug extractor for parametric /pages/:slug route
const DynamicCMSPageWrapper: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  return <CMSPageRenderer slug={slug || 'about-us'} />;
};

// ─── Main Application Root ───────────────────────────────────────────────────

export function App() {
  const [categories, setCategories] = useState<Category[]>(FALLBACK_CATEGORIES);
  const [currency, setCurrency] = useState('USD');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [wishlist, setWishlist] = useState<Product[]>([]);
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isWishlistOpen, setIsWishlistOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isTrackOrderOpen, setIsTrackOrderOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isCookieModalOpen, setIsCookieModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchFilterQuery, setSearchFilterQuery] = useState('');
  const [toast, setToast] = useState<{ message: string; type?: 'cart' | 'wishlist' | 'info' } | null>(null);

  // Fetch dynamic categories hierarchy from database
  useEffect(() => {
    let isMounted = true;
    async function loadTree() {
      try {
        const tree = await categoriesApi.getCategoryTree();
        if (isMounted && tree.length > 0) {
          setCategories(tree);
        }
      } catch (err) {
        console.warn('Failed to fetch categories hierarchy:', err);
      }
    }
    loadTree();
    return () => {
      isMounted = false;
    };
  }, []);
  const [user, setUser] = useState<{ name: string; email: string } | null>(() => {
    try {
      const saved = localStorage.getItem('hesa_customer_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const showToast = (message: string, type: 'cart' | 'wishlist' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleLogin = (name: string, email: string) => {
    const userData = { name, email };
    setUser(userData);
    localStorage.setItem('hesa_customer_user', JSON.stringify(userData));
    showToast(`Signed in as ${name}`, 'info');
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('hesa_customer_user');
    showToast('Signed out successfully', 'info');
  };

  const handleAddToCart = (
    product: Product,
    quantity = 1,
    color?: string,
    size?: string
  ) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + quantity } : item
        );
      }
      return [
        ...prev,
        {
          product,
          quantity,
          selectedColor: color,
          selectedSize: size,
        },
      ];
    });
    showToast(`Added ${quantity}x "${product.name}" to bag`, 'cart');
  };

  const handleUpdateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      setCart((prev) => prev.filter((item) => item.product.id !== productId));
      return;
    }
    setCart((prev) =>
      prev.map((item) => (item.product.id === productId ? { ...item, quantity } : item))
    );
  };

  const handleToggleWishlist = (product: Product) => {
    setWishlist((prev) => {
      const exists = prev.some((p) => p.id === product.id);
      if (exists) {
        showToast(`Removed "${product.name}" from wishlist`, 'info');
        return prev.filter((p) => p.id !== product.id);
      }
      showToast(`Saved "${product.name}" to wishlist`, 'wishlist');
      return [...prev, product];
    });
  };

  const handleSearchSubmit = (query: string, category: string) => {
    setSearchFilterQuery(query);
    if (category !== 'All') setSelectedCategory(category);
    document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSelectCategory = (catName: string) => {
    setSelectedCategory(catName);
    document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const layoutProps: Omit<LayoutProps, 'children'> = {
    categories,
    currency,
    onCurrencyChange: setCurrency,
    cartCount,
    cartTotal,
    wishlistCount: wishlist.length,
    user,
    onOpenCart: () => setIsCartOpen(true),
    onOpenWishlist: () => setIsWishlistOpen(true),
    onOpenAccount: () => { window.location.href = '/profile'; },
    onOpenMobileMenu: () => setIsMobileMenuOpen(true),
    onSelectProduct: setQuickViewProduct,
    onSearchSubmit: handleSearchSubmit,
    onSelectCategory: handleSelectCategory,
    onSelectSubcategory: (cat, sub) => {
      setSelectedCategory(cat);
      setSearchFilterQuery(sub);
      document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth' });
    },
    onOpenTrackOrder: () => setIsTrackOrderOpen(true),
    onOpenHelp: () => setIsHelpOpen(true),
    onOpenCookieSettings: () => setIsCookieModalOpen(true),
    selectedCategory,
    onLogout: handleLogout,
  };

  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        {/* Home */}
        <Route
          path="/"
          element={
            <StorefrontLayout {...layoutProps}>
              <HomePage
                categories={categories}
                products={PRODUCTS}
                currency={currency}
                selectedCategory={selectedCategory}
                setSelectedCategory={setSelectedCategory}
                searchFilterQuery={searchFilterQuery}
                wishlist={wishlist}
                onToggleWishlist={handleToggleWishlist}
                onQuickView={setQuickViewProduct}
                onAddToCart={handleAddToCart}
                onSelectCategory={handleSelectCategory}
                onSearchSubmit={handleSearchSubmit}
                onClearSearch={() => setSearchFilterQuery('')}
              />
            </StorefrontLayout>
          }
        />

        {/* FAQs */}
        <Route
          path="/faqs"
          element={
            <StorefrontLayout {...layoutProps}>
              <FAQPage />
            </StorefrontLayout>
          }
        />

        {/* Contact Us */}
        <Route
          path="/contact"
          element={
            <StorefrontLayout {...layoutProps}>
              <ContactPage />
            </StorefrontLayout>
          }
        />

        {/* Friendly CMS Aliases */}
        <Route
          path="/about"
          element={
            <StorefrontLayout {...layoutProps}>
              <CMSPageRenderer slug="about-us" />
            </StorefrontLayout>
          }
        />
        <Route
          path="/returns"
          element={
            <StorefrontLayout {...layoutProps}>
              <CMSPageRenderer slug="return-policy" />
            </StorefrontLayout>
          }
        />
        <Route
          path="/careers"
          element={
            <StorefrontLayout {...layoutProps}>
              <CMSPageRenderer slug="careers" />
            </StorefrontLayout>
          }
        />
        <Route
          path="/privacy"
          element={
            <StorefrontLayout {...layoutProps}>
              <CMSPageRenderer slug="privacy-policy" />
            </StorefrontLayout>
          }
        />
        <Route
          path="/terms"
          element={
            <StorefrontLayout {...layoutProps}>
              <CMSPageRenderer slug="terms-of-service" />
            </StorefrontLayout>
          }
        />
        <Route
          path="/cookies"
          element={
            <StorefrontLayout {...layoutProps}>
              <CMSPageRenderer slug="cookie-policy" />
            </StorefrontLayout>
          }
        />
        <Route
          path="/shipping"
          element={
            <StorefrontLayout {...layoutProps}>
              <CMSPageRenderer slug="shipping-policy" />
            </StorefrontLayout>
          }
        />

        {/* Profile & Authentication Pages (Standard Full Web Page) */}
        <Route
          path="/profile"
          element={
            <StorefrontLayout {...layoutProps}>
              <ProfilePage
                user={user}
                onLogin={handleLogin}
                onLogout={handleLogout}
                onOpenWishlist={() => setIsWishlistOpen(true)}
                onOpenCart={() => setIsCartOpen(true)}
                onOpenTrackOrder={() => setIsTrackOrderOpen(true)}
                wishlistCount={wishlist.length}
                cartCount={cartCount}
              />
            </StorefrontLayout>
          }
        />
        <Route
          path="/account"
          element={
            <StorefrontLayout {...layoutProps}>
              <ProfilePage
                user={user}
                onLogin={handleLogin}
                onLogout={handleLogout}
                onOpenWishlist={() => setIsWishlistOpen(true)}
                onOpenCart={() => setIsCartOpen(true)}
                onOpenTrackOrder={() => setIsTrackOrderOpen(true)}
                wishlistCount={wishlist.length}
                cartCount={cartCount}
              />
            </StorefrontLayout>
          }
        />
        <Route
          path="/login"
          element={
            <StorefrontLayout {...layoutProps}>
              <ProfilePage
                user={user}
                onLogin={handleLogin}
                onLogout={handleLogout}
                onOpenWishlist={() => setIsWishlistOpen(true)}
                onOpenCart={() => setIsCartOpen(true)}
                onOpenTrackOrder={() => setIsTrackOrderOpen(true)}
                wishlistCount={wishlist.length}
                cartCount={cartCount}
              />
            </StorefrontLayout>
          }
        />
        <Route
          path="/register"
          element={
            <StorefrontLayout {...layoutProps}>
              <ProfilePage
                user={user}
                onLogin={handleLogin}
                onLogout={handleLogout}
                onOpenWishlist={() => setIsWishlistOpen(true)}
                onOpenCart={() => setIsCartOpen(true)}
                onOpenTrackOrder={() => setIsTrackOrderOpen(true)}
                wishlistCount={wishlist.length}
                cartCount={cartCount}
              />
            </StorefrontLayout>
          }
        />

        {/* Dynamic CMS Pages (/pages/:slug) */}
        <Route
          path="/pages/:slug"
          element={
            <StorefrontLayout {...layoutProps}>
              <DynamicCMSPageWrapper />
            </StorefrontLayout>
          }
        />
      </Routes>

      {/* Global Overlays (shared across all routes) */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cart}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={(id) => setCart((p) => p.filter((item) => item.product.id !== id))}
        onCheckout={() => {
          showToast('Redirecting to secure checkout...', 'info');
          setIsCartOpen(false);
        }}
        currency={currency}
      />
      <WishlistDrawer
        isOpen={isWishlistOpen}
        onClose={() => setIsWishlistOpen(false)}
        items={wishlist}
        onRemoveWishlist={(id) => setWishlist((p) => p.filter((p2) => p2.id !== id))}
        onAddToCart={handleAddToCart}
        currency={currency}
      />
      <QuickViewModal
        product={quickViewProduct}
        onClose={() => setQuickViewProduct(null)}
        currency={currency}
        isWishlisted={quickViewProduct ? wishlist.some((p) => p.id === quickViewProduct.id) : false}
        onToggleWishlist={handleToggleWishlist}
        onAddToCart={(p, qty, color, size) => handleAddToCart(p, qty, color, size)}
      />
      <TrackOrderModal isOpen={isTrackOrderOpen} onClose={() => setIsTrackOrderOpen(false)} />
      <HelpConciergeModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
      <MobileNavDrawer
        categories={categories}
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        onSelectCategory={handleSelectCategory}
        onSelectSubcategory={(cat, sub) => {
          setSelectedCategory(cat);
          setSearchFilterQuery(sub);
          document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth' });
        }}
        onOpenCart={() => setIsCartOpen(true)}
        onOpenWishlist={() => setIsWishlistOpen(true)}
        cartCount={cartCount}
        wishlistCount={wishlist.length}
        user={user}
        onLogout={handleLogout}
        onOpenTrackOrder={() => setIsTrackOrderOpen(true)}
      />

      {/* Cookie Consent Banner & Modal */}
      <CookieBanner onOpenSettings={() => setIsCookieModalOpen(true)} />
      <CookieConsentModal
        isOpen={isCookieModalOpen}
        onClose={() => setIsCookieModalOpen(false)}
        onSave={() => showToast('Cookie choices updated', 'info')}
      />

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </BrowserRouter>
  );
}

export default App;
