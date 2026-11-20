import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search,
  ShoppingCart,
  Heart,
  User,
  ChevronDown,
  X,
  Sparkles,
  ArrowRight,
  Menu,
  Package,
  LogOut,
  HelpCircle,
  Check,
  MapPin,
  Truck,
  ShieldCheck,
  ShoppingBag,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';
import { Product, Category } from '../../types';
import { LanguageSelector } from '../common/LanguageSelector';

interface MainHeaderProps {
  categories?: Category[];
  products?: Product[];
  cartCount: number;
  cartTotal: number;
  wishlistCount: number;
  currency: string;
  onOpenCart: () => void;
  onOpenWishlist: () => void;
  onOpenAccount?: (view?: 'LOGIN' | 'REGISTER') => void;
  onOpenMobileMenu: () => void;
  onSelectProduct: (product: Product) => void;
  onSearchSubmit: (query: string, category: string) => void;
  user: { name: string; email: string } | null;
  onLogout?: () => void;
  onOpenTrackOrder?: () => void;
  onOpenHelp?: () => void;
}

export const MainHeader: React.FC<MainHeaderProps> = ({
  categories,
  products = [],
  cartCount,
  cartTotal,
  wishlistCount,
  currency,
  onOpenCart,
  onOpenWishlist,
  onOpenAccount,
  onOpenMobileMenu,
  onSelectProduct,
  onSearchSubmit,
  user,
  onLogout,
  onOpenTrackOrder,
  onOpenHelp,
}) => {
  const navigate = useNavigate();
  const activeCategories = categories || [];
  const [searchQuery, setSearchQuery] = useState('');
  const [searchCategory, setSearchCategory] = useState('All');
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target as Node)) {
        setIsAccountMenuOpen(false);
      }
    };
    if (isAccountMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isAccountMenuOpen]);

  // Close dropdown on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isAccountMenuOpen) {
        setIsAccountMenuOpen(false);
      }
    };
    if (isAccountMenuOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isAccountMenuOpen]);

  const handleGoToOrders = () => {
    setIsAccountMenuOpen(false);
    navigate('/orders');
  };

  const handleGoToAddresses = () => {
    setIsAccountMenuOpen(false);
    navigate('/addresses');
  };
  const [isCategoryPickerOpen, setIsCategoryPickerOpen] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Filter suggested products based on search query
  const suggestions = searchQuery.trim()
    ? products.filter((p) => {
      const matchesQuery =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.tags && p.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())));
      const matchesCategory =
        searchCategory === 'All' || p.category.toLowerCase() === searchCategory.toLowerCase();
      return matchesQuery && matchesCategory;
    }).slice(0, 5)
    : [];

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchFocused(false);
        setIsCategoryPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSearchFocused(false);
    onSearchSubmit(searchQuery, searchCategory);
  };

  const currencySymbols: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    INR: '₹',
  };
  const currSymbol = currencySymbols['INR'] || '';

  return (
    <div className="bg-[#FAF9F6] border-b border-stone-200/70 sticky top-0 z-30 shadow-xs transition-all duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="flex items-center justify-between gap-4 md:gap-8">

          {/* Mobile Hamburger Menu Button */}
          <button
            onClick={onOpenMobileMenu}
            aria-label="Open mobile navigation menu"
            className="lg:hidden p-2 -ml-2 rounded-xl text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <Menu className="w-6 h-6" />
          </button>

          {/* Brand Logo */}
          <Link
            to="/"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center space-x-3 cursor-pointer group flex-shrink-0"
          >
            
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="text-2xl font-black tracking-tight text-slate-950 font-sans logo-font notranslate" translate="no">
                  Saamaan
                </span>
              </div>
              <p className="text-[10px] font-medium text-slate-400 tracking-wider hidden sm:block">
                PREMIUM ECOMMERCE
              </p>
            </div>
          </Link>

          {/* Smart Search Bar with Category Filter */}
          <div ref={searchContainerRef} className="flex-1 max-w-2xl relative hidden md:block">
            <form
              onSubmit={handleSearch}
              className={`flex items-center rounded-2xl border transition-all duration-200 bg-white shadow-2xs ${isSearchFocused
                  ? 'border-primary-500 ring-4 ring-primary-500/10 shadow-card'
                  : 'border-stone-200/90 hover:border-stone-300'
                }`}
            >
              {/* Category selector button */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsCategoryPickerOpen(!isCategoryPickerOpen)}
                  className="flex items-center space-x-1.5 px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:text-slate-900 border-r border-slate-200 rounded-l-2xl hover:bg-slate-100/60 transition-colors whitespace-nowrap"
                >
                  <span className="max-w-[100px] truncate">{searchCategory}</span>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isCategoryPickerOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Category selector dropdown */}
                {isCategoryPickerOpen && (
                  <div className="absolute left-0 mt-2 w-48 bg-[#FAF9F6] border border-stone-200/90 rounded-2xl shadow-xl py-2 z-50 animate-slide-down">
                    <button
                      type="button"
                      onClick={() => {
                        setSearchCategory('All');
                        setIsCategoryPickerOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-xs hover:bg-slate-50 transition-colors ${searchCategory === 'All' ? 'text-primary-600 font-bold bg-primary-50/50' : 'text-slate-700'
                        }`}
                    >
                      All Categories
                    </button>
                    {activeCategories.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          setSearchCategory(cat.name);
                          setIsCategoryPickerOpen(false);
                        }}
                        className={`w-full text-left px-4 py-2 text-xs hover:bg-slate-50 transition-colors ${searchCategory === cat.name ? 'text-primary-600 font-bold bg-primary-50/50' : 'text-slate-700'
                          }`}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Text Input */}
              <div className="flex-1 relative flex items-center">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  placeholder="Search products, brands, essentials..."
                  className="w-full px-4 py-2.5 text-xs bg-transparent border-none text-slate-900 placeholder:text-slate-400 focus:outline-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="p-1 mr-2 text-slate-400 hover:text-slate-600 rounded-full"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Submit Search Button */}
              <button
                type="submit"
                aria-label="Submit search"
                className="m-1 px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold text-xs flex items-center space-x-1.5 transition-colors shadow-sm"
              >
                <Search className="w-4 h-4" />
                <span className="hidden lg:inline">Search</span>
              </button>
            </form>

            {/* Live Search Suggestions Dropdown */}
            {isSearchFocused && searchQuery.trim().length > 0 && (
              <div className="absolute left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-modal py-3 z-50 animate-slide-down">
                {suggestions.length > 0 ? (
                  <div>
                    <div className="px-4 pb-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                      <span>Matching Products ({suggestions.length})</span>
                      <span className="text-[10px] text-primary-600 font-normal">Press Enter to view all</span>
                    </div>
                    {suggestions.map((prod) => (
                      <div
                        key={prod.id}
                        onClick={() => {
                          onSelectProduct(prod);
                          setIsSearchFocused(false);
                        }}
                        className="flex items-center space-x-3 px-4 py-2.5 hover:bg-slate-50 cursor-pointer transition-colors"
                      >
                        <img
                          src={prod.thumbnail}
                          alt={prod.name}
                          className="w-10 h-10 object-cover rounded-xl border border-slate-100 flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-900 truncate">
                            {prod.name}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate">
                            {prod.category} • {prod.subtitle}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-bold text-slate-900">
                            {currSymbol}{prod.price.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="px-6 py-6 text-center text-slate-500">
                    <p className="text-xs font-medium">No direct matches for "{searchQuery}"</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Try searching for "headphones", "linen", "ceramic", or "keyboard".
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Action Icons: Language, Account, Wishlist, Cart */}
          <div className="flex items-center space-x-2 sm:space-x-4">

            {/* Regional Language Selector */}
            <LanguageSelector variant="header" className="hidden sm:block" />

            {/* Account Menu Trigger & Dropdown */}
            <div className="relative" ref={accountMenuRef}>
              <button
                type="button"
                onClick={() => setIsAccountMenuOpen((prev) => !prev)}
                className={`flex items-center space-x-2.5 p-1.5 sm:px-3 sm:py-2 rounded-2xl transition-all duration-200 text-slate-700 group cursor-pointer select-none ${isAccountMenuOpen
                    ? 'bg-primary-50/80 text-primary-700 ring-2 ring-primary-500/20'
                    : 'hover:bg-slate-100'
                  }`}
                aria-expanded={isAccountMenuOpen}
                aria-haspopup="true"
                aria-label="User account menu"
              >
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all border ${user
                      ? 'bg-gradient-to-tr from-primary-700 to-primary-600 text-white border-primary-600 shadow-sm shadow-primary-500/30'
                      : 'bg-slate-100 text-slate-700 border-slate-200/70 group-hover:bg-primary-50 group-hover:text-primary-600 group-hover:border-primary-200'
                    }`}
                >
                  {user ? (
                    <span className="text-xs font-bold uppercase">{user.name.charAt(0)}</span>
                  ) : (
                    <User className="w-4 h-4" />
                  )}
                </div>
                <div className="hidden xl:block text-left">
                  <span className="block text-[10px] text-slate-400 font-medium leading-none">
                    {user ? 'Welcome back,' : 'Account & Orders'}
                  </span>
                  <span className="block text-xs font-bold text-slate-900 leading-tight mt-0.5 truncate max-w-[130px]">
                    {user ? user.name : 'Sign In / Register'}
                  </span>
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 hidden sm:block ${isAccountMenuOpen ? 'rotate-180 text-primary-600' : 'group-hover:text-slate-600'
                    }`}
                />
              </button>

              {/* Floating Account Dropdown Menu */}
              {isAccountMenuOpen && (
                <div
                  role="menu"
                  aria-label="User Account Menu"
                  className="absolute right-0 top-full mt-2 w-80 sm:w-88 bg-white rounded-2xl shadow-2xl border border-stone-200/80 z-50 max-h-[380px] sm:max-h-[410px] overflow-y-auto scrollbar-dot animate-in fade-in slide-in-from-top-2 duration-150 ring-1 ring-black/5"
                >
                  {user ? (
                    // ─── AUTHENTICATED STATE ───
                    <div>
                      {/* 4-Tile Quick Access Grid */}
                      <div className="p-3 grid grid-cols-2 gap-2 border-b border-stone-200/60 bg-slate-50/40">
                        {/* 1. My Orders */}
                        <button
                          type="button"
                          onClick={handleGoToOrders}
                          className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white border border-stone-200/70 hover:border-primary-300 hover:bg-primary-50/30 transition-all text-left group shadow-xs cursor-pointer"
                        >
                          <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                            <Package className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <span className="block text-xs font-bold text-slate-800 leading-tight group-hover:text-primary-700">My Orders</span>
                            <span className="block text-[10px] text-slate-400 font-medium leading-tight mt-0.5 truncate">Track & history</span>
                          </div>
                        </button>

                        {/* 2. Saved Wishlist */}
                        <button
                          type="button"
                          onClick={() => {
                            setIsAccountMenuOpen(false);
                            onOpenWishlist();
                          }}
                          className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white border border-stone-200/70 hover:border-rose-300 hover:bg-rose-50/30 transition-all text-left group shadow-xs cursor-pointer"
                        >
                          <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                            <Heart className="w-4 h-4 fill-rose-50" />
                          </div>
                          <div className="min-w-0">
                            <span className="block text-xs font-bold text-slate-800 leading-tight group-hover:text-rose-600">Wishlist</span>
                            <span className="block text-[10px] text-slate-400 font-medium leading-tight mt-0.5 truncate">{wishlistCount} saved</span>
                          </div>
                        </button>

                        {/* 3. Delivery Addresses */}
                        <button
                          type="button"
                          onClick={handleGoToAddresses}
                          className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white border border-stone-200/70 hover:border-blue-300 hover:bg-blue-50/30 transition-all text-left group shadow-xs cursor-pointer"
                        >
                          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                            <MapPin className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <span className="block text-xs font-bold text-slate-800 leading-tight group-hover:text-blue-700">Addresses</span>
                            <span className="block text-[10px] text-slate-400 font-medium leading-tight mt-0.5 truncate">Delivery pins</span>
                          </div>
                        </button>

                        {/* 4. Shopping Bag / Cart */}
                        <button
                          type="button"
                          onClick={() => {
                            setIsAccountMenuOpen(false);
                            onOpenCart();
                          }}
                          className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white border border-stone-200/70 hover:border-primary-300 hover:bg-primary-50/30 transition-all text-left group shadow-xs cursor-pointer"
                        >
                          <div className="w-8 h-8 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                            <ShoppingBag className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <span className="block text-xs font-bold text-slate-800 leading-tight group-hover:text-primary-700">Shopping Bag</span>
                            <span className="block text-[10px] text-slate-400 font-medium leading-tight mt-0.5 truncate">{cartCount} {cartCount === 1 ? 'item' : 'items'}</span>
                          </div>
                        </button>
                      </div>

                      {/* Menu Navigation List */}
                      <div className="p-2 space-y-0.5">
                        <Link
                          to="/profile"
                          onClick={() => {
                            setIsAccountMenuOpen(false);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-primary-50 hover:text-primary-700 transition-colors group"
                        >
                          <div className="w-7 h-7 rounded-lg bg-stone-100 flex items-center justify-center text-slate-600 group-hover:bg-primary-100 group-hover:text-primary-700 transition-colors">
                            <User className="w-3.5 h-3.5" />
                          </div>
                          <div className="flex-1">
                            <span>My Profile</span>
                            <p className="text-[10px] text-slate-400 font-normal">Personal info, passwords & contact</p>
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-primary-600 group-hover:translate-x-0.5 transition-all" />
                        </Link>

                        <button
                          type="button"
                          onClick={() => {
                            setIsAccountMenuOpen(false);
                            onOpenTrackOrder?.();
                          }}
                          className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-primary-50 hover:text-primary-700 transition-colors text-left group cursor-pointer"
                        >
                          <div className="w-7 h-7 rounded-lg bg-stone-100 flex items-center justify-center text-slate-600 group-hover:bg-primary-100 group-hover:text-primary-700 transition-colors">
                            <Truck className="w-3.5 h-3.5" />
                          </div>
                          <div className="flex-1">
                            <span>Track Any Order</span>
                            <p className="text-[10px] text-slate-400 font-normal">Check delivery status with tracking ID</p>
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-primary-600 group-hover:translate-x-0.5 transition-all" />
                        </button>

                        <Link
                          to="/returns"
                          onClick={() => {
                            setIsAccountMenuOpen(false);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-primary-50 hover:text-primary-700 transition-colors group"
                        >
                          <div className="w-7 h-7 rounded-lg bg-stone-100 flex items-center justify-center text-slate-600 group-hover:bg-primary-100 group-hover:text-primary-700 transition-colors">
                            <RotateCcw className="w-3.5 h-3.5" />
                          </div>
                          <div className="flex-1">
                            <span>Returns & Replacements</span>
                            <p className="text-[10px] text-slate-400 font-normal">Check return policies & guarantees</p>
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-primary-600 group-hover:translate-x-0.5 transition-all" />
                        </Link>

                        <Link
                          to="/contact"
                          onClick={() => {
                            setIsAccountMenuOpen(false);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-primary-50 hover:text-primary-700 transition-colors group"
                        >
                          <div className="w-7 h-7 rounded-lg bg-stone-100 flex items-center justify-center text-slate-600 group-hover:bg-primary-100 group-hover:text-primary-700 transition-colors">
                            <HelpCircle className="w-3.5 h-3.5" />
                          </div>
                          <div className="flex-1">
                            <span>Help & Customer Care</span>
                            <p className="text-[10px] text-slate-400 font-normal">24/7 dedicated support concierge</p>
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-primary-600 group-hover:translate-x-0.5 transition-all" />
                        </Link>
                      </div>

                      {/* Sign Out Action */}
                      <div className="p-2 border-t border-stone-200/60 bg-stone-50/60">
                        <button
                          type="button"
                          onClick={() => {
                            setIsAccountMenuOpen(false);
                            onLogout?.();
                          }}
                          className="w-full flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>Sign Out</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    // ─── GUEST STATE (OPTION A: MODERN & ACTIONABLE) ───
                    <div>
                      {/* Welcome Greeting & Dual Action Buttons */}
                      <div className="p-4 bg-gradient-to-b from-primary-50/70 via-stone-50/40 to-white border-b border-stone-200/70">
                        <div className="flex items-center gap-2.5">
                          
                        </div>

                        {/* Dual Action CTAs: Sign In + Register */}
                        <div className="grid grid-cols-2 gap-2 mt-3.5">
                          <button
                            type="button"
                            onClick={() => {
                              setIsAccountMenuOpen(false);
                              if (onOpenAccount) {
                                onOpenAccount('LOGIN');
                              } else {
                                navigate('/login');
                              }
                            }}
                            className="flex items-center justify-center space-x-1.5 py-2 px-3 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold shadow-xs transition-all active:scale-[0.98] cursor-pointer"
                          >
                            <span>Sign In</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setIsAccountMenuOpen(false);
                              if (onOpenAccount) {
                                onOpenAccount('REGISTER');
                              } else {
                                navigate('/register');
                              }
                            }}
                            className="flex items-center justify-center space-x-1.5 py-2 px-3 rounded-xl bg-white hover:bg-primary-50 border border-stone-200 hover:border-primary-300 text-slate-800 hover:text-primary-700 text-xs font-bold shadow-2xs transition-all active:scale-[0.98] cursor-pointer"
                          >
                            <span>Register</span>
                          </button>
                        </div>
                      </div>

                      {/* Guest Navigation Menu Items */}
                      <div className="p-2 space-y-0.5">
                        {/* 1. My Orders (Prompts Login) */}
                        <button
                          type="button"
                          onClick={() => {
                            setIsAccountMenuOpen(false);
                            if (onOpenAccount) {
                              onOpenAccount('LOGIN');
                            } else {
                              navigate('/orders');
                            }
                          }}
                          className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors text-left group cursor-pointer"
                        >
                          <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 group-hover:bg-amber-100 transition-colors">
                            <Package className="w-3.5 h-3.5 text-amber-600" />
                          </div>
                          <div className="flex-1">
                            <span>My Orders</span>
                            <p className="text-[10px] text-slate-400 font-normal">Track, view or return past orders</p>
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-amber-600 group-hover:translate-x-0.5 transition-all" />
                        </button>

                        {/* 2. Track Any Order (Direct Tracking without login) */}
                        <button
                          type="button"
                          onClick={() => {
                            setIsAccountMenuOpen(false);
                            onOpenTrackOrder?.();
                          }}
                          className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors text-left group cursor-pointer"
                        >
                          <div className="w-7 h-7 rounded-lg bg-sky-50 flex items-center justify-center text-sky-600 group-hover:bg-sky-100 transition-colors">
                            <Truck className="w-3.5 h-3.5 text-sky-600" />
                          </div>
                          <div className="flex-1">
                            <span>Track Any Order</span>
                            <p className="text-[10px] text-slate-400 font-normal">Check delivery status with order ID</p>
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-sky-600 group-hover:translate-x-0.5 transition-all" />
                        </button>

                        {/* 3. Saved Wishlist */}
                        <button
                          type="button"
                          onClick={() => {
                            setIsAccountMenuOpen(false);
                            onOpenWishlist();
                          }}
                          className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors text-left group cursor-pointer"
                        >
                          <div className="w-7 h-7 rounded-lg bg-rose-50 flex items-center justify-center text-rose-500 group-hover:bg-rose-100 transition-colors">
                            <Heart className="w-3.5 h-3.5 text-rose-500" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <span>Saved Wishlist</span>
                              {wishlistCount > 0 && (
                                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-100">
                                  {wishlistCount}
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-400 font-normal">Your bookmarked favourite items</p>
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-rose-600 group-hover:translate-x-0.5 transition-all" />
                        </button>

                        {/* 4. Easy Returns & Replacements */}
                        <Link
                          to="/returns"
                          onClick={() => {
                            setIsAccountMenuOpen(false);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors group"
                        >
                          <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-100 transition-colors">
                            <RotateCcw className="w-3.5 h-3.5 text-indigo-600" />
                          </div>
                          <div className="flex-1">
                            <span>Easy Returns & Replacements</span>
                            <p className="text-[10px] text-slate-400 font-normal">7-day replacements & refund guarantees</p>
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all" />
                        </Link>

                        {/* 5. Help & Customer Care */}
                        <Link
                          to="/contact"
                          onClick={() => {
                            setIsAccountMenuOpen(false);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors group"
                        >
                          <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-100 transition-colors">
                            <HelpCircle className="w-3.5 h-3.5 text-emerald-600" />
                          </div>
                          <div className="flex-1">
                            <span>Help & Customer Care</span>
                            <p className="text-[10px] text-slate-400 font-normal">24/7 dedicated support concierge</p>
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Wishlist Button with Badge */}
            <button
              onClick={onOpenWishlist}
              aria-label="Saved items wishlist"
              className="relative p-2.5 rounded-2xl hover:bg-slate-100 transition-colors text-slate-700 group"
            >
              <Heart className="w-5 h-5 group-hover:text-rose-600 group-hover:scale-110 transition-all duration-200" />
              {wishlistCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white animate-fade-in shadow-sm">
                  {wishlistCount}
                </span>
              )}
            </button>

            {/* Cart Button with Total Preview */}
            <button
              onClick={onOpenCart}
              aria-label="View shopping bag"
              className="flex items-center space-x-3 px-3.5 py-2 rounded-2xl bg-[#3F5B45] text-white hover:bg-[#334A38] transition-all duration-200 shadow-md group relative hover:shadow-glow"
            >
              <div className="relative">
                <ShoppingCart className="w-5 h-5 text-white/95 group-hover:scale-105 transition-transform" />
                {cartCount > 0 && (
                  <span className="absolute -top-2 -right-2 min-w-4 h-4 px-1 rounded-full bg-rose-600 text-white text-[9px] font-extrabold flex items-center justify-center ring-2 ring-white shadow-sm">
                    {cartCount}
                  </span>
                )}
              </div>
              <div className="hidden sm:block text-left">
                <span className="block text-[10px] text-white/80 font-medium leading-none">
                  Bag ({cartCount})
                </span>
                <span className="block text-xs font-bold text-white mt-0.5">
                  {currSymbol}{cartTotal.toFixed(2)}
                </span>
              </div>
            </button>

          </div>

        </div>

        {/* Mobile Search Bar Row (visible on small screens) */}
        <div className="mt-3 md:hidden">
          <form
            onSubmit={handleSearch}
            className="flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5"
          >
            <Search className="w-4 h-4 text-slate-400 mr-2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products..."
              className="w-full text-xs bg-transparent border-none text-slate-900 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="p-1 text-slate-400"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </form>
        </div>

      </div>
    </div>
  );
};