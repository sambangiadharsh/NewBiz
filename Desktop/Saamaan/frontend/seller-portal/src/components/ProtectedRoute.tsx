import React, { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore.js';
import { Store } from 'lucide-react';

interface ProtectedRouteProps {
  allowedRoles?: string[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  allowedRoles = ['SELLER_ADMIN'],
}) => {
  const { user, isAuthenticated, isLoading, checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Cold start branded splash (only shows on cold boot if no cached session exists)
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0D080A] flex flex-col items-center justify-center p-6 relative overflow-hidden select-none">
        {/* Soft background ambient glows */}
        <div className="absolute w-96 h-96 rounded-full bg-rose-900/10 blur-3xl pointer-events-none -top-24 -left-24" />
        <div className="absolute w-96 h-96 rounded-full bg-[#7E2532]/10 blur-3xl pointer-events-none -bottom-24 -right-24" />

        <div className="flex flex-col items-center text-center relative z-10 animate-in fade-in duration-300">
          {/* Logo with subtle breathing pulse ring */}
          <div className="relative mb-4 flex items-center justify-center">
            <div className="absolute -inset-1.5 rounded-3xl bg-rose-600/20 blur-sm animate-pulse" />
            <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#7E2532] via-[#9E2C3F] to-[#C24157] flex items-center justify-center text-white shadow-xl shadow-black/40">
              <Store className="w-7 h-7 text-rose-100" />
            </div>
          </div>

          {/* Clean branding */}
          <h1 className="font-extrabold text-base tracking-tight text-white">
            Seller<span className="text-[#F7CBD2]">Studio</span>
          </h1>
          <p className="text-[10px] font-semibold text-rose-200/60 tracking-wider uppercase mt-0.5">
            Merchant Operations
          </p>

          {/* High-end indeterminate progress bar (no clunky text) */}
          <div className="w-36 h-1 bg-white/10 rounded-full overflow-hidden mt-6 relative">
            <div className="w-1/2 h-full bg-gradient-to-r from-[#7E2532] via-[#9E2C3F] to-[#F7CBD2] rounded-full animate-splash-progress" />
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  const hasRole = user.roles.some((r) => allowedRoles.includes(r));

  if (!hasRole) {
    return (
      <div className="min-h-screen bg-[#0D080A] flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-md">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto mb-4">
            <Store className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-white mb-1.5">Access Restricted</h2>
          <p className="text-xs text-rose-200/60 mb-6">
            Your account does not have seller permissions to access the Seller Portal.
          </p>
          <Navigate to="/login" replace />
        </div>
      </div>
    );
  }

  return <Outlet />;
};
