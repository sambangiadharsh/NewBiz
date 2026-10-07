import React, { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore.js';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  allowedRoles?: string[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles = ['SUPER_ADMIN', 'ADMIN'] }) => {
  const { user, isAuthenticated, isLoading, checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-gray-900 animate-spin" />
          <p className="text-xs text-gray-500 font-medium tracking-wide">Validating session...</p>
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
      <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md bg-white border border-gray-200 rounded-3xl p-8 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-sm text-gray-500 mb-6">
            Your account does not have permission to access the Admin Portal.
          </p>
          <Navigate to="/login" replace />
        </div>
      </div>
    );
  }

  return <Outlet />;
};
