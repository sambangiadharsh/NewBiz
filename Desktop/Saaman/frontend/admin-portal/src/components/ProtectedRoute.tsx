import React, { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore.js';
import { ShieldCheck } from 'lucide-react';

interface ProtectedRouteProps {
  allowedRoles?: string[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  allowedRoles = ['SUPER_ADMIN', 'ADMIN'],
}) => {
  const { user, isAuthenticated, isLoading, checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Cold start branded splash (only shows on cold boot if no cached session exists)
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F8F9FE] flex flex-col items-center justify-center p-6 relative overflow-hidden select-none">
        {/* Soft background ambient glows */}
        <div className="absolute w-96 h-96 rounded-full bg-indigo-500/5 blur-3xl pointer-events-none -top-24 -left-24" />
        <div className="absolute w-96 h-96 rounded-full bg-violet-500/5 blur-3xl pointer-events-none -bottom-24 -right-24" />

        <div className="flex flex-col items-center text-center relative z-10 animate-in fade-in duration-300">
          {/* Logo with subtle breathing ring */}
          <div className="relative mb-4 flex items-center justify-center">
            <div className="absolute -inset-1.5 rounded-3xl bg-indigo-500/20 blur-sm animate-pulse" />
            <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#635BFF] via-[#7C5CFC] to-[#9B7BF7] flex items-center justify-center text-white shadow-xl shadow-indigo-500/25">
              <ShieldCheck className="w-7 h-7 text-white" />
            </div>
          </div>

          {/* Clean branding */}
          <h1 className="font-extrabold text-base tracking-tight text-slate-900">
            Marketplace<span className="text-[#635BFF]">Admin</span>
          </h1>
          <p className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase mt-0.5">
            Enterprise Console
          </p>

          {/* High-end indeterminate progress bar (no clunky text) */}
          <div className="w-36 h-1 bg-slate-200/80 rounded-full overflow-hidden mt-6 relative">
            <div className="w-1/2 h-full bg-gradient-to-r from-[#635BFF] via-[#7C5CFC] to-[#9B7BF7] rounded-full animate-splash-progress" />
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  const hasRole =
    user.roles.includes('SUPER_ADMIN') ||
    user.roles.some((r) => allowedRoles.includes(r));

  if (!hasRole) {
    return (
      <div className="min-h-screen bg-[#F8F9FE] flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md bg-white border border-slate-200/80 rounded-3xl p-8 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-1.5">Access Restricted</h2>
          <p className="text-xs text-slate-500 mb-6">
            Your account does not have sufficient administrative privileges to view this section.
          </p>
          <Navigate to="/login" replace />
        </div>
      </div>
    );
  }

  return <Outlet />;
};
