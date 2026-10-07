import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { X, ChevronDown, ChevronRight, Flame, Heart, ShoppingBag, User, LogOut, Package, Check } from 'lucide-react';
import logoImg from '../../assets/dummy_logo.png';

import { Category } from '../../types';

interface MobileNavDrawerProps {
  categories?: Category[];
  isOpen: boolean;
  onClose: () => void;
  onSelectCategory: (cat: string) => void;
  onSelectSubcategory?: (catName: string, subName: string) => void;
  onOpenCart: () => void;
  onOpenWishlist: () => void;
  onOpenAccount?: () => void;
  cartCount: number;
  wishlistCount: number;
  user?: { name: string; email: string } | null;
  onLogout?: () => void;
  onOpenTrackOrder?: () => void;
}

export const MobileNavDrawer: React.FC<MobileNavDrawerProps> = ({
  categories,
  isOpen,
  onClose,
  onSelectCategory,
  onSelectSubcategory,
  onOpenCart,
  onOpenWishlist,
  cartCount,
  wishlistCount,
  user,
  onLogout,
  onOpenTrackOrder,
}) => {
  const activeCategories = categories || [];
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const [expandedSubCat, setExpandedSubCat] = useState<string | null>(null);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden animate-fade-in">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="relative w-4/5 max-w-sm h-full bg-white shadow-2xl flex flex-col justify-between overflow-y-auto z-10 animate-slide-up">
        {/* Top Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <Link
            to="/"
            onClick={() => {
              onClose();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="flex items-center space-x-2 cursor-pointer"
          >
            <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
              <img
                src={logoImg}
                alt="Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <span className="font-extrabold text-slate-900 text-lg tracking-tight logo-font">Saamaan</span>
          </Link>
          <button
            onClick={onClose}
            aria-label="Close navigation"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category List */}
        <div className="flex-1 py-4 px-4 space-y-1">
          <div className="pb-2 mb-2 border-b border-slate-100">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Departments & Catalog
            </span>
          </div>

          <button
            onClick={() => {
              onSelectCategory('All');
              onClose();
            }}
            className="w-full text-left px-3 py-2.5 rounded-xl font-semibold text-xs text-slate-800 hover:bg-slate-50 flex items-center justify-between"
          >
            <span>All Catalog</span>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>

          {activeCategories.map((cat) => {
            const isExpanded = expandedCat === cat.id;
            return (
              <div key={cat.id} className="border-b border-slate-50 last:border-none">
                <div className="flex items-center justify-between py-1">
                  <button
                    onClick={() => {
                      onSelectCategory(cat.name);
                      onClose();
                    }}
                    className="flex-1 text-left px-3 py-2 text-xs font-semibold text-slate-800 hover:text-primary-600 cursor-pointer"
                  >
                    {cat.name}
                  </button>
                  {cat.subCategories && cat.subCategories.length > 0 && (
                    <button
                      onClick={() => setExpandedCat(isExpanded ? null : cat.id)}
                      className="p-2 text-slate-400 hover:text-slate-700 cursor-pointer"
                      aria-label={`Toggle ${cat.name} subcategories`}
                    >
                      <ChevronDown
                        className={`w-4 h-4 transition-transform duration-200 ${
                          isExpanded ? 'rotate-180 text-primary-600' : ''
                        }`}
                      />
                    </button>
                  )}
                </div>

                {isExpanded && cat.subCategories && (
                  <div className="pl-4 pr-2 py-2 space-y-2 bg-slate-50/70 rounded-xl mb-2">
                    {cat.subCategories.map((sub, sIdx) => {
                      const subKey = `${cat.id}-${sub.title || sIdx}`;
                      const isSubExpanded = expandedSubCat === subKey;
                      return (
                        <div key={sIdx} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <button
                              type="button"
                              onClick={() => {
                                if (onSelectSubcategory) {
                                  onSelectSubcategory(cat.name, sub.title);
                                } else {
                                  onSelectCategory(cat.name);
                                }
                                onClose();
                              }}
                              className="text-left text-xs font-bold text-slate-700 hover:text-primary-600 py-1 flex items-center space-x-1"
                            >
                              <span>{sub.title}</span>
                            </button>
                            {sub.items && sub.items.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setExpandedSubCat(isSubExpanded ? null : subKey)}
                                className="p-1 text-slate-400 hover:text-slate-600"
                              >
                                <ChevronDown
                                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                                    isSubExpanded ? 'rotate-180 text-primary-600' : ''
                                  }`}
                                />
                              </button>
                            )}
                          </div>

                          {isSubExpanded && sub.items && (
                            <div className="pl-3 py-1 space-y-1 border-l-2 border-primary-200/60 ml-1">
                              {sub.items.map((item, itemIdx) => (
                                <button
                                  key={itemIdx}
                                  onClick={() => {
                                    if (onSelectSubcategory) {
                                      onSelectSubcategory(cat.name, item);
                                    } else {
                                      onSelectCategory(cat.name);
                                    }
                                    onClose();
                                  }}
                                  className="block w-full text-left text-[11px] text-slate-600 hover:text-primary-600 py-1"
                                >
                                  • {item}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          <div className="pt-4 space-y-2">
            <button
              onClick={() => {
                onSelectCategory('Deals');
                onClose();
              }}
              className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 bg-rose-50"
            >
              <Flame className="w-4 h-4 text-rose-500 fill-rose-500" />
              <span>Flash Deals & Offers</span>
            </button>
          </div>
        </div>

        {/* Quick User Actions Bottom */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/80 space-y-2">
          {user ? (
            <div className="space-y-2">
              <div className="flex items-center p-2.5 bg-white rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-primary-700 to-primary-600 text-white font-bold text-xs flex items-center justify-center flex-shrink-0">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">{user.name}</p>
                    <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Link
                  to="/profile"
                  onClick={() => {
                    onClose();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="flex items-center justify-center space-x-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 shadow-sm hover:border-primary-500"
                >
                  <User className="w-3.5 h-3.5 text-primary-600" />
                  <span>Profile</span>
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onLogout?.();
                  }}
                  className="flex items-center justify-center space-x-1.5 px-3 py-2 rounded-xl bg-white border border-rose-200 text-xs font-semibold text-rose-600 shadow-sm hover:bg-rose-50 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Link
                to="/login"
                onClick={() => {
                  onClose();
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="flex items-center justify-center space-x-1.5 py-2.5 px-3 rounded-xl bg-primary-600 text-white text-xs font-bold shadow-sm shadow-primary-500/20"
              >
                <User className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </Link>
              <Link
                to="/register"
                onClick={() => {
                  onClose();
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="flex items-center justify-center space-x-1.5 py-2.5 px-3 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 shadow-sm hover:border-primary-500"
              >
                <span>Register</span>
              </Link>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                onClose();
                onOpenWishlist();
              }}
              className="flex items-center justify-center space-x-1.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-800 shadow-sm"
            >
              <Heart className="w-4 h-4 text-rose-500" />
              <span>Wishlist ({wishlistCount})</span>
            </button>
            <button
              onClick={() => {
                onClose();
                onOpenCart();
              }}
              className="flex items-center justify-center space-x-1.5 py-2.5 rounded-xl bg-[#3F5B45] hover:bg-[#334A38] text-white text-xs font-semibold shadow-sm transition-colors"
            >
              <ShoppingBag className="w-4 h-4 text-white/95" />
              <span>Bag ({cartCount})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
