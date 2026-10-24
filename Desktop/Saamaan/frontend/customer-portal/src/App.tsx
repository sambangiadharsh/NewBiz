import React, { useState, useEffect, useMemo } from 'react';
import { BrowserRouter, Routes, Route, useParams, useNavigate } from 'react-router-dom';
import { Product, CartItem, Category } from './types';
import { categoriesApi } from './lib/categoriesApi';
import { productsApi, getImageUrl } from './lib/productsApi';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { CategoryPLPPage } from './pages/CategoryPLPPage';
import { CheckoutPage } from './pages/CheckoutPage';

// Header components
import { AnnouncementBar } from './components/header/AnnouncementBar';
import { MainHeader } from './components/header/MainHeader';
import { CategoryNavBar } from './components/header/CategoryNavBar';
import { MobileNavDrawer } from './components/header/MobileNavDrawer';
import { ProfilePage } from './components/profile/ProfilePage';

// Home & Merchandising components
import { HeroBanner } from './components/home/HeroBanner';
import { CategoryPills } from './components/home/CategoryPills';
import { FlashDealsCountdown } from './components/home/FlashDealsCountdown';
import { CategoryProductRail } from './components/home/CategoryProductRail';
import { FeaturedBrandsSection } from './components/home/FeaturedBrandsSection';
import { ProductCardSkeleton } from './components/product/ProductCard';

// Footer component
import { Footer } from './components/footer/Footer';

// Drawers & Modals
import { CartDrawer } from './components/cart/CartDrawer';
import { WishlistDrawer } from './components/wishlist/WishlistDrawer';
import { AccountModal } from './components/header/AccountModal';
import { TrackOrderModal } from './components/common/TrackOrderModal';
import { HelpConciergeModal } from './components/common/HelpConciergeModal';
import { Toast } from './components/common/Toast';
import { ScrollToTop } from './components/common/ScrollToTop';
import { wishlistApi } from './lib/wishlistApi';
import { cartApi, ApiCartItem } from './lib/cartApi';
import { customerAuthApi } from './lib/authApi';

// CMS Pages
import { CMSPageRenderer, FAQPage, ContactPage } from './components/cms/CMSPages';

// ─── Shared Layout That Wraps Storefront Pages ──────────────────────────────

interface LayoutProps {
  categories?: Category[];
  products?: Product[];
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
  selectedCategory: string;
  onLogout?: () => void;
  children: React.ReactNode;
}

const StorefrontLayout: React.FC<LayoutProps> = (props) => (
  <div className="min-h-screen bg-canvas text-dark-900 flex flex-col font-sans">
    <AnnouncementBar />
    <MainHeader
      categories={props.categories}
      products={props.products}
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
    <main className="flex-1">{props.children}</main>
    <Footer
      onSelectCategory={props.onSelectCategory}
      onOpenTrackOrder={props.onOpenTrackOrder}
    />
  </div>
);

// ─── Production Grade Homepage with Merchandising Rails ─────────────────────

interface HomePageProps {
  categories?: Category[];
  products: Product[];
  currency: string;
  wishlistIds: string[];
  onToggleWishlist: (p: Product) => void;
  onAddToCart: (p: Product, q?: number) => void;
  onExploreCategory: (categorySlug: string) => void;
  onSelectBrand: (brandName: string) => void;
  isLoading?: boolean;
}

const HomePage: React.FC<HomePageProps> = ({
  categories = [],
  products,
  currency,
  wishlistIds,
  onToggleWishlist,
  onAddToCart,
  onExploreCategory,
  onSelectBrand,
  isLoading = false,
}) => {
  // Select products for flash deals strictly from real database catalog
  const flashDealProducts = useMemo(() => {
    const discounted = products.filter((p) => p.originalPrice > p.price);
    if (discounted.length > 0) return discounted;
    return products;
  }, [products]);
  // Derive categorized merchandising rails dynamically:
  // 1. First map defined database categories that have matching active products.
  // 2. Then capture any remaining uncategorized products so no catalog items are hidden.
  const activeRails = useMemo(() => {
    const rails: { category: Category; products: Product[] }[] = [];
    const matchedProductIds = new Set<string>();

    // Match categories from category tree (including child subcategories and leaf items)
    categories.forEach((cat) => {
      const cName = cat.name.toLowerCase();
      const cSlug = cat.slug.toLowerCase();

      // Collect all subcategory titles and leaf item names for this root category
      const subItemNames = (cat.subCategories || []).flatMap((s) => [
        s.title.toLowerCase(),
        ...(s.items || []).map((i) => i.toLowerCase()),
      ]);

      const catProducts = products.filter((p) => {
        const pCat = (p.category || '').toLowerCase();
        const pSlug = (p.categorySlug || '').toLowerCase();
        return (
          pCat.includes(cName) ||
          cName.includes(pCat) ||
          pCat.includes(cSlug) ||
          subItemNames.some(
            (sub) =>
              sub.includes(pCat) ||
              pCat.includes(sub) ||
              (pSlug && (sub.includes(pSlug) || pSlug.includes(sub)))
          )
        );
      });

      if (catProducts.length > 0) {
        catProducts.forEach((p) => matchedProductIds.add(p.id));
        rails.push({
          category: { ...cat, itemCount: catProducts.length },
          products: catProducts,
        });
      }
    });

    // Capture products whose category was not part of the tree
    const remainingProducts = products.filter((p) => !matchedProductIds.has(p.id));
    if (remainingProducts.length > 0) {
      const remainingMap = new Map<string, Product[]>();
      remainingProducts.forEach((p) => {
        const c = p.category || 'Trending Catalog';
        if (!remainingMap.has(c)) remainingMap.set(c, []);
        remainingMap.get(c)!.push(p);
      });

      remainingMap.forEach((prods, catName) => {
        const fallbackSlug = catName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        rails.push({
          category: {
            id: `derived-${fallbackSlug}`,
            name: catName,
            slug: fallbackSlug,
            icon: 'layers',
            image:
              prods[0]?.thumbnail ||
              'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&auto=format&fit=crop&q=80',
            itemCount: prods.length,
            subCategories: [],
          },
          products: prods,
        });
      });
    }

    return rails;
  }, [categories, products]);

  return (
    <>
      {/* Hero Carousel */}
      <HeroBanner onExploreCategory={onExploreCategory} />

      {/* Visual Category Tiles */}
      <CategoryPills
        categories={categories}
        selectedCategory="All"
        onSelectCategory={onExploreCategory}
        isLoading={isLoading}
      />

      {/* High-Converting Flash Deals with Live Countdown */}
      <FlashDealsCountdown
        products={flashDealProducts}
        currency={currency}
        wishlistIds={wishlistIds}
        onAddToCart={onAddToCart}
        onToggleWishlist={onToggleWishlist}
        isLoading={isLoading}
      />

      {/* Merchandising Category Tabs: Single section, all categories as tabs */}
      {activeRails.length > 0 ? (
        <CategoryProductRail
          category={activeRails[0].category}
          products={activeRails[0].products}
          allRails={activeRails}
          currency={currency}
          wishlistIds={wishlistIds}
          onToggleWishlist={onToggleWishlist}
          onAddToCart={onAddToCart}
          onExploreCategory={onExploreCategory}
        />
      ) : isLoading ? (
        /* High-fidelity skeleton shimmer matching CategoryProductRail structure */
        <section className="py-14 bg-white border-b border-stone-200/70">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Department Tab Bar Skeleton */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
              <div className="space-y-2">
                <div className="h-4 w-36 rounded-md animate-shimmer" />
                <div className="h-7 w-64 rounded-lg animate-shimmer" />
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-9 w-28 rounded-xl animate-shimmer shrink-0" />
                ))}
              </div>
            </div>

            {/* Split Rail Layout Skeleton: 5-col Featured Hero + 7-col Products Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              {/* Left Featured Department Card Placeholder */}
              <div className="lg:col-span-5 rounded-3xl min-h-[460px] p-8 flex flex-col justify-between border border-stone-200/80 animate-shimmer">
                <div className="flex gap-2">
                  <div className="h-6 w-24 rounded-full bg-white/60" />
                  <div className="h-6 w-20 rounded-full bg-white/60" />
                </div>
                <div className="space-y-3 mt-auto pt-8">
                  <div className="h-4 w-28 rounded-md bg-white/60" />
                  <div className="h-8 w-56 rounded-xl bg-white/70" />
                  <div className="h-4 w-full rounded-md bg-white/50" />
                  <div className="h-10 w-44 rounded-2xl bg-white/80 mt-4" />
                </div>
              </div>

              {/* Right Curated Products Grid (6 ProductCardSkeletons matching layout) */}
              <div className="lg:col-span-7">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <ProductCardSkeleton key={i} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {/* Featured Verified Brands Section */}
      <FeaturedBrandsSection onSelectBrand={onSelectBrand} />
    </>
  );
};

// Slug extractor for parametric /pages/:slug route
const DynamicCMSPageWrapper: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  return <CMSPageRenderer slug={slug || 'about-us'} />;
};

const mapApiItemToCartItem = (
  i: ApiCartItem,
  allProds: Product[],
  prevCart: CartItem[]
): CartItem => {
  const matchFromCatalog = allProds.find((p) => String(p.id) === String(i.productId));
  const matchFromPrev = prevCart.find(
    (p) => String(p.product?.id) === String(i.productId) || p.cartItemId === i.cartItemId
  );
  const baseProduct = matchFromCatalog || matchFromPrev?.product;
  const rawThumb = i.thumbnail || baseProduct?.thumbnail;
  const finalThumb = rawThumb ? getImageUrl(rawThumb) : '';

  return {
    product: baseProduct
      ? {
          ...baseProduct,
          price: i.price,
          originalPrice: i.originalPrice || baseProduct.originalPrice,
          stock: i.availableStock ?? baseProduct.stock,
          thumbnail: finalThumb,
          images: baseProduct.images?.length ? baseProduct.images.map(getImageUrl) : (finalThumb ? [finalThumb] : []),
        }
      : {
          id: i.productId,
          name: i.productName,
          subtitle: i.brandName || '',
          category: 'General',
          price: i.price,
          originalPrice: i.originalPrice,
          rating: 5,
          reviewsCount: 0,
          images: finalThumb ? [finalThumb] : [],
          thumbnail: finalThumb,
          stock: i.availableStock,
          tags: [],
          description: '',
          features: [],
          parentSku: i.parentSku,
          brand: i.brandName ? { brandId: '', brandName: i.brandName } : null,
        },
    quantity: i.quantity,
    cartItemId: i.cartItemId,
    sellerProductId: i.sellerProductId,
    selectedColor: matchFromPrev?.selectedColor,
    selectedSize: matchFromPrev?.selectedSize,
  };
};

function AppContent() {
  const navigate = useNavigate();

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [currency, setCurrency] = useState('INR');
  // ── Persistent cart: hydrate from localStorage on first render ──────────
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('saamaan_cart');
      return saved ? (JSON.parse(saved) as CartItem[]) : [];
    } catch {
      return [];
    }
  });

  // ── Wishlist: Database-backed only (requires customer authentication) ──────
  const [wishlist, setWishlist] = useState<Product[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isWishlistOpen, setIsWishlistOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [authPrompt, setAuthPrompt] = useState<string | null>(null);
  const [pendingWishlistProduct, setPendingWishlistProduct] = useState<Product | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isTrackOrderOpen, setIsTrackOrderOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');
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

  const [isLoadingProducts, setIsLoadingProducts] = useState(true);

  // Fetch active products from database
  useEffect(() => {
    let isMounted = true;
    async function loadProducts() {
      setIsLoadingProducts(true);
      try {
        const activeProducts = await productsApi.getActiveProducts({ limit: 50 });
        if (isMounted && activeProducts.length > 0) {
          setProducts(activeProducts);

          // Live stock re-validation for cached/stored cart items upon customer revisit
          setCart((prev) =>
            prev.map((item) => {
              const fresh = activeProducts.find((p) => String(p.id) === String(item.product?.id));
              if (!fresh) return item;

              let freshStock = fresh.stock;
              if (fresh.variants && fresh.variants.length > 0) {
                const matchedV = fresh.variants.find((v) =>
                  (!item.selectedColor || (v.attributes || []).some((a) => a.value?.toLowerCase() === item.selectedColor?.toLowerCase())) &&
                  (!item.selectedSize || (v.attributes || []).some((a) => a.value?.toLowerCase() === item.selectedSize?.toLowerCase()))
                );
                if (matchedV && typeof matchedV.stock === 'number') {
                  freshStock = matchedV.stock;
                }
              }

              return {
                ...item,
                product: {
                  ...item.product,
                  stock: freshStock,
                  price: fresh.price,
                  variants: fresh.variants,
                },
              };
            })
          );
        }
      } catch (err) {
        console.warn('Failed to fetch active products from backend:', err);
      } finally {
        if (isMounted) setIsLoadingProducts(false);
      }
    }
    loadProducts();
    return () => {
      isMounted = false;
    };
  }, []);

  const [user, setUser] = useState<{ name: string; email: string } | null>(() => {
    try {
      const saved = localStorage.getItem('saamaan_customer_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // ── Sync cart to localStorage always (ensures no empty cart on page refresh) ─
  useEffect(() => {
    try {
      localStorage.setItem('saamaan_cart', JSON.stringify(cart));
    } catch { /* quota exceeded – ignore */ }
  }, [cart]);

  // ── Hydrate DB Wishlist and DB Cart on initial load / user login ───────────
  useEffect(() => {
    let isMounted = true;

    async function loadUserServerData() {
      const token = localStorage.getItem('saamaan_customer_token');
      // For guest users, the cart is strictly kept in localStorage. Do not query or clobber server cart.
      if (!user && !token) return;

      try {
        const promises: Promise<any>[] = [cartApi.getCart(token || undefined)];
        if (user || token) {
          promises.push(wishlistApi.getWishlist());
        }
        const results = await Promise.allSettled(promises);
        const dbCartRes = results[0];
        const dbWishlistRes = results[1];

        if (isMounted && dbWishlistRes?.status === 'fulfilled' && Array.isArray(dbWishlistRes.value)) {
          setWishlist(
            dbWishlistRes.value.map((w: any) => ({
              id: w.product?.id || w.productVariantId,
              name: w.product?.name || 'Saved Product',
              subtitle: '',
              category: 'General',
              price: w.product?.price || 0,
              originalPrice: w.product?.originalPrice || w.product?.price || 0,
              rating: 5,
              reviewsCount: 0,
              images: [w.product?.thumbnail || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80'],
              thumbnail: w.product?.thumbnail || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80',
              stock: 99,
              tags: [],
              description: w.product?.description || '',
              features: [],
              parentSku: w.product?.parentSku || '',
              brand: w.product?.brandName ? { brandId: '', brandName: w.product.brandName } : null,
            }))
          );
        }

        if (isMounted && dbCartRes.status === 'fulfilled' && dbCartRes.value?.items) {
          const apiItems = dbCartRes.value.items;
          setCart((prev) => apiItems.map((i: any) => mapApiItemToCartItem(i, products, prev)));
        }
      } catch (err) {
        console.warn('Failed to load server data:', err);
      }
    }

    loadUserServerData();
    return () => {
      isMounted = false;
    };
  }, [user, products.length]);

  const showToast = (message: string, type: 'cart' | 'wishlist' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleLogin = async (name: string, email: string, authToken?: string) => {
    const userData = { name, email };
    setUser(userData);
    localStorage.setItem('saamaan_customer_user', JSON.stringify(userData));
    const token = authToken || localStorage.getItem('saamaan_customer_token') || undefined;
    if (token) {
      try {
        localStorage.setItem('saamaan_customer_token', token);
      } catch {}
    }
    showToast(`Signed in as ${name}`, 'info');

    // 1. Auto-save any pending wishlist item clicked before authentication
    if (pendingWishlistProduct) {
      try {
        await wishlistApi.addItem(pendingWishlistProduct.id);
        setWishlist((prev) =>
          prev.some((p) => p.id === pendingWishlistProduct.id) ? prev : [...prev, pendingWishlistProduct]
        );
        showToast(`Saved "${pendingWishlistProduct.name}" to wishlist`, 'wishlist');
      } catch (e) {
        console.warn('Failed to auto-save pending wishlist product:', e);
      }
      setPendingWishlistProduct(null);
    }
    setAuthPrompt(null);
    setIsAccountModalOpen(false);

    // 2. Fetch Wishlist from DB
    try {
      const dbWishlist = await wishlistApi.getWishlist();
      if (Array.isArray(dbWishlist)) {
        setWishlist(
          dbWishlist.map((w: any) => ({
            id: w.product?.id || w.productVariantId,
            name: w.product?.name || 'Saved Product',
            subtitle: '',
            category: 'General',
            price: w.product?.price || 0,
            originalPrice: w.product?.originalPrice || w.product?.price || 0,
            rating: 5,
            reviewsCount: 0,
            images: [w.product?.thumbnail || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80'],
            thumbnail: w.product?.thumbnail || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80',
            stock: 99,
            tags: [],
            description: w.product?.description || '',
            features: [],
            parentSku: w.product?.parentSku || '',
            brand: w.product?.brandName ? { brandId: '', brandName: w.product.brandName } : null,
          }))
        );
      }
    } catch (e) {
      console.warn('Failed to fetch user wishlist on login:', e);
    }

    // 3. Sync & Merge Cart
    try {
      // Check if guest user accumulated any items in localStorage before login
      let guestItems: CartItem[] = [];
      try {
        const saved = localStorage.getItem('saamaan_cart');
        guestItems = saved ? JSON.parse(saved) : cart;
      } catch {
        guestItems = cart;
      }

      if (guestItems.length > 0) {
        const mergePayload = guestItems.map((item) => ({
          productId: item.product.id,
          sellerProductId: item.sellerProductId,
          quantity: item.quantity,
        }));
        const merged = await cartApi.mergeCart(mergePayload, token);
        if (merged?.items && merged.items.length > 0) {
          setCart(merged.items.map((i: any) => mapApiItemToCartItem(i, products, guestItems)));
          return;
        }
      }

      // If guest cart was empty (e.g. login after logout), retrieve customer's active DB cart
      const dbCart = await cartApi.getCart(token);
      if (dbCart?.items) {
        setCart(dbCart.items.map((i: any) => mapApiItemToCartItem(i, products, [])));
      }
    } catch (e) {
      console.warn('Failed to sync cart on login:', e);
    }
  };

  const handleLogout = async () => {
    try {
      await customerAuthApi.logout();
    } catch {}
    setUser(null);
    localStorage.removeItem('saamaan_customer_user');
    localStorage.removeItem('saamaan_customer_token');
    localStorage.removeItem('saamaan_cart');
    localStorage.removeItem('saamaan_wishlist');
    setCart([]);
    setWishlist([]);
    showToast('Signed out successfully', 'info');
  };

  const handleAddToCart = async (
    product: Product,
    quantity = 1,
    color?: string,
    size?: string
  ) => {
    const numQty = Math.max(1, Number(quantity) || 1);
    const prodId = String(product.id);

    // 1. Frictionless optimistic UI update for all customers (stored in localStorage)
    setCart((prev) => {
      const existingIndex = prev.findIndex(
        (item) =>
          String(item.product.id) === prodId &&
          (color ? item.selectedColor === color : true) &&
          (size ? item.selectedSize === size : true)
      );

      if (existingIndex > -1) {
        return prev.map((item, idx) =>
          idx === existingIndex
            ? { ...item, quantity: (Number(item.quantity) || 0) + numQty }
            : item
        );
      }

      return [
        ...prev,
        {
          product,
          quantity: numQty,
          selectedColor: color,
          selectedSize: size,
        },
      ];
    });
    showToast(`Added ${numQty}x "${product.name}" to bag`, 'cart');

    // 2. Call DB only if logged in. Guest user cart is kept in localStorage until login.
    const token = localStorage.getItem('saamaan_customer_token');
    if (user || token) {
      try {
        const updated = await cartApi.addItem({
          productId: product.id,
          quantity: numQty,
        });
        if (updated?.items && updated.items.length > 0) {
          setCart((prev) => updated.items.map((i: any) => mapApiItemToCartItem(i, products, prev)));
        }
      } catch (err) {
        console.warn('Failed to sync item to DB cart:', err);
      }
    }
  };

  const handleUpdateQuantity = async (productId: string, quantity: number) => {
    const numQty = Number(quantity);
    const targetItem = cart.find((item) => String(item.product.id) === String(productId));

    if (numQty <= 0) {
      setCart((prev) => prev.filter((item) => String(item.product.id) !== String(productId)));
    } else {
      setCart((prev) =>
        prev.map((item) => (String(item.product.id) === String(productId) ? { ...item, quantity: numQty } : item))
      );
    }

    const token = localStorage.getItem('saamaan_customer_token');
    if ((user || token) && targetItem?.cartItemId) {
      try {
        if (numQty <= 0) {
          await cartApi.removeItem(targetItem.cartItemId);
        } else {
          await cartApi.updateQuantity(targetItem.cartItemId, numQty);
        }
      } catch (err) {
        console.warn('Failed to update DB cart quantity:', err);
      }
    }
  };

  const handleRemoveItem = async (productId: string) => {
    const targetItem = cart.find((item) => String(item.product.id) === String(productId));
    setCart((prev) => prev.filter((item) => String(item.product.id) !== String(productId)));

    const token = localStorage.getItem('saamaan_customer_token');
    if ((user || token) && targetItem?.cartItemId) {
      try {
        await cartApi.removeItem(targetItem.cartItemId);
      } catch (err) {
        console.warn('Failed to remove item from DB cart:', err);
      }
    }
  };

  const handleToggleWishlist = async (product: Product) => {
    // ── Wishlist is AUTHENTICATED ONLY ───────────────────────────────────────
    if (!user) {
      setPendingWishlistProduct(product);
      setAuthPrompt(`Sign in to save "${product.name}" to your Wishlist across devices`);
      setIsAccountModalOpen(true);
      return;
    }

    const exists = wishlist.some((p) => p.id === product.id);
    if (exists) {
      setWishlist((prev) => prev.filter((p) => p.id !== product.id));
      showToast(`Removed "${product.name}" from wishlist`, 'info');
      try {
        await wishlistApi.removeItem(product.id);
      } catch (err) {
        console.warn('Failed to remove from DB wishlist:', err);
      }
    } else {
      setWishlist((prev) => [...prev, product]);
      showToast(`Saved "${product.name}" to wishlist`, 'wishlist');
      try {
        await wishlistApi.addItem(product.id);
      } catch (err) {
        console.warn('Failed to add to DB wishlist:', err);
      }
    }
  };

  const handleOpenWishlist = () => {
    if (!user) {
      setAuthPrompt('Sign in to view your saved Wishlist across all your devices');
      setIsAccountModalOpen(true);
      return;
    }
    setIsWishlistOpen(true);
  };

  // ─── Production Grade Router-Based Navigation Handlers ────────────────────

  const handleSelectCategory = (catName: string) => {
    setSelectedCategory(catName);
    if (!catName || catName.toLowerCase() === 'all') {
      navigate('/categories');
      return;
    }

    const matched = categories.find(
      (c) =>
        c.name.toLowerCase() === catName.toLowerCase() ||
        c.slug.toLowerCase() === catName.toLowerCase()
    );
    const targetSlug = matched ? matched.slug : catName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    navigate(`/category/${targetSlug}`);
  };

  const handleSelectSubcategory = (catName: string, subName: string) => {
    setSelectedCategory(catName);
    const matched = categories.find(
      (c) =>
        c.name.toLowerCase() === catName.toLowerCase() ||
        c.slug.toLowerCase() === catName.toLowerCase()
    );
    const targetSlug = matched ? matched.slug : catName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    navigate(`/category/${targetSlug}?sub=${encodeURIComponent(subName)}`);
  };

  const handleSearchSubmit = (query: string, category: string) => {
    const params = new URLSearchParams();
    if (query.trim()) {
      params.set('q', query.trim());
    }

    if (category && category !== 'All') {
      const matched = categories.find(
        (c) =>
          c.name.toLowerCase() === category.toLowerCase() ||
          c.slug.toLowerCase() === category.toLowerCase()
      );
      const targetSlug = matched ? matched.slug : category.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      navigate(`/category/${targetSlug}${params.toString() ? `?${params.toString()}` : ''}`);
      return;
    }

    navigate(`/search?${params.toString()}`);
  };

  const handleSelectBrand = (brandName: string) => {
    navigate(`/search?brand=${encodeURIComponent(brandName)}`);
  };

  const cartTotal = cart.reduce(
    (sum, item) => sum + (Number(item.product?.price) || 0) * (Number(item.quantity) || 1),
    0
  );
  // Cart item count is the number of distinct line items in the cart
  const cartCount = cart.length;
  const wishlistIds = wishlist.map((p) => p.id);

  const layoutProps: Omit<LayoutProps, 'children'> = {
    categories,
    products,
    currency,
    onCurrencyChange: setCurrency,
    cartCount,
    cartTotal,
    wishlistCount: wishlist.length,
    user,
    onOpenCart: () => setIsCartOpen(true),
    onOpenWishlist: handleOpenWishlist,
    onOpenAccount: () => {
      if (!user) {
        setIsAccountModalOpen(true);
      } else {
        navigate('/profile');
      }
    },
    onOpenMobileMenu: () => setIsMobileMenuOpen(true),
    onSelectProduct: (p: Product) => navigate(`/product/${p.id}`),
    onSearchSubmit: handleSearchSubmit,
    onSelectCategory: handleSelectCategory,
    onSelectSubcategory: handleSelectSubcategory,
    onOpenTrackOrder: () => setIsTrackOrderOpen(true),
    onOpenHelp: () => setIsHelpOpen(true),
    selectedCategory,
    onLogout: handleLogout,
  };

  const handleRemoveWishlist = async (id: string) => {
    setWishlist((prev) => prev.filter((p) => p.id !== id));
    if (user) {
      try {
        await wishlistApi.removeItem(id);
      } catch (err) {
        console.warn('Failed to remove from DB wishlist:', err);
      }
    }
  };

  return (
    <>
      <ScrollToTop />
      <Routes>
        {/* Production-Grade Homepage with Merchandising Category Rails */}
        <Route
          path="/"
          element={
            <StorefrontLayout {...layoutProps}>
              <HomePage
                categories={categories}
                products={products}
                currency={currency}
                wishlistIds={wishlistIds}
                onToggleWishlist={handleToggleWishlist}
                onAddToCart={handleAddToCart}
                onExploreCategory={handleSelectCategory}
                onSelectBrand={handleSelectBrand}
                isLoading={isLoadingProducts}
              />
            </StorefrontLayout>
          }
        />

        {/* Dedicated Category Product Listing Page (PLP) */}
        <Route
          path="/category/:slug"
          element={
            <StorefrontLayout {...layoutProps}>
              <CategoryPLPPage
                categories={categories}
                allProducts={products}
                isLoading={isLoadingProducts}
                currency={currency}
                wishlistIds={wishlistIds}
                onToggleWishlist={handleToggleWishlist}
                onAddToCart={handleAddToCart}
              />
            </StorefrontLayout>
          }
        />

        {/* Complete Catalog Route */}
        <Route
          path="/categories"
          element={
            <StorefrontLayout {...layoutProps}>
              <CategoryPLPPage
                categories={categories}
                allProducts={products}
                isLoading={isLoadingProducts}
                currency={currency}
                wishlistIds={wishlistIds}
                onToggleWishlist={handleToggleWishlist}
                onAddToCart={handleAddToCart}
              />
            </StorefrontLayout>
          }
        />

        {/* Dedicated Search Results with Facet Filtering */}
        <Route
          path="/search"
          element={
            <StorefrontLayout {...layoutProps}>
              <CategoryPLPPage
                categories={categories}
                allProducts={products}
                isLoading={isLoadingProducts}
                currency={currency}
                wishlistIds={wishlistIds}
                onToggleWishlist={handleToggleWishlist}
                onAddToCart={handleAddToCart}
              />
            </StorefrontLayout>
          }
        />

        {/* Product Detail Page */}
        <Route
          path="/product/:id"
          element={
            <StorefrontLayout {...layoutProps}>
              <ProductDetailPage
                currency={currency}
                wishlistIds={wishlistIds}
                onToggleWishlist={handleToggleWishlist}
                onAddToCart={handleAddToCart}
                allProducts={products}
              />
            </StorefrontLayout>
          }
        />

        {/* Customer Support FAQs */}
        <Route
          path="/faqs"
          element={
            <StorefrontLayout {...layoutProps}>
              <FAQPage />
            </StorefrontLayout>
          }
        />

        {/* Contact Page */}
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

        {/* Profile & Authentication Pages */}
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

        {/* Checkout */}
        <Route
          path="/checkout"
          element={
            <StorefrontLayout {...layoutProps}>
              <CheckoutPage
                cart={cart}
                currency={currency}
                onUpdateQuantity={handleUpdateQuantity}
                onRemoveItem={handleRemoveItem}
                onOrderPlaced={() => {
                  setCart([]);
                  localStorage.removeItem('saamaan_cart');
                  try {
                    cartApi.clearCart();
                  } catch {}
                }}
              />
            </StorefrontLayout>
          }
        />
      </Routes>

      {/* Global Overlays (Cart, Wishlist, Modals, Drawers) */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cart}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={(id) => setCart((p) => p.filter((item) => item.product.id !== id))}
        onCheckout={() => {
          setIsCartOpen(false);
          navigate('/checkout');
        }}
        currency={currency}
      />
      <WishlistDrawer
        isOpen={isWishlistOpen}
        onClose={() => setIsWishlistOpen(false)}
        items={wishlist}
        onRemoveWishlist={handleRemoveWishlist}
        onAddToCart={handleAddToCart}
        onMoveAllToCart={() => {
          wishlist.forEach((p) => {
            handleAddToCart(p, 1);
            handleRemoveWishlist(p.id);
          });
          setIsWishlistOpen(false);
        }}
        currency={currency}
      />
      <AccountModal
        isOpen={isAccountModalOpen}
        onClose={() => {
          setIsAccountModalOpen(false);
          setPendingWishlistProduct(null);
          setAuthPrompt(null);
        }}
        user={user}
        onLogin={handleLogin}
        onLogout={handleLogout}
        promptMessage={authPrompt}
      />
      <TrackOrderModal isOpen={isTrackOrderOpen} onClose={() => setIsTrackOrderOpen(false)} />
      <HelpConciergeModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
      <MobileNavDrawer
        categories={categories}
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        onSelectCategory={handleSelectCategory}
        onSelectSubcategory={handleSelectSubcategory}
        onOpenCart={() => setIsCartOpen(true)}
        onOpenWishlist={handleOpenWishlist}
        cartCount={cartCount}
        wishlistCount={wishlist.length}
        user={user}
        onLogout={handleLogout}
        onOpenTrackOrder={() => setIsTrackOrderOpen(true)}
      />

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </>
  );
}

// ─── Main Application Root ───────────────────────────────────────────────────

export function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
