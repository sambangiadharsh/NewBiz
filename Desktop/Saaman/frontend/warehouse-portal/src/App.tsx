import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './features/auth/LoginPage.js';
import { AcceptInvitePage } from './features/auth/AcceptInvitePage.js';
import { ProtectedRoute } from './components/ProtectedRoute.js';
import { DashboardLayout } from './layouts/DashboardLayout.js';
import { DashboardPage } from './features/dashboard/DashboardPage.js';
import { WarehouseProfilePage } from './features/profile/WarehouseProfilePage.js';
import { NotFoundPage } from './features/common/NotFoundPage.js';

export const App: React.FC = () => {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/accept-invite" element={<AcceptInvitePage />} />

      {/* Protected Warehouse Routes */}
      <Route element={<ProtectedRoute allowedRoles={['WAREHOUSE_MANAGER', 'SUPER_ADMIN']} />}>
        <Route element={<DashboardLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/profile" element={<WarehouseProfilePage />} />
          <Route path="/products" element={<Navigate to="/" replace />} />
          <Route path="/inventory" element={<Navigate to="/" replace />} />
          <Route path="/transactions" element={<Navigate to="/" replace />} />
          <Route path="/fulfillments" element={<Navigate to="/" replace />} />
          <Route path="/shipments" element={<Navigate to="/" replace />} />
        </Route>
      </Route>

      {/* 404 Fallback */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};
