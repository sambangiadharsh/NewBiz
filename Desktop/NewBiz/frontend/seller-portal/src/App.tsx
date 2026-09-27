import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './features/auth/LoginPage.js';
import { RegisterPage } from './features/auth/RegisterPage.js';
import { ProtectedRoute } from './components/ProtectedRoute.js';
import { DashboardLayout } from './layouts/DashboardLayout.js';
import { DashboardPage } from './features/dashboard/DashboardPage.js';
import { OnboardingWizardPage } from './features/onboarding/OnboardingWizardPage.js';
import { ApplicationStatusPage } from './features/applications/ApplicationStatusPage.js';
import { WarehouseManagementPage } from './features/warehouses/WarehouseManagementPage.js';
import { ProductsPage } from './features/catalog/ProductsPage.js';
import { AddExistingProductPage } from './features/catalog/AddExistingProductPage.js';
import { ProposeProductWizard } from './features/catalog/ProposeProductWizard.js';
import { NotFoundPage } from './features/common/NotFoundPage.js';

export const App: React.FC = () => {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/signup" element={<Navigate to="/register" replace />} />

      {/* Protected Seller Routes */}
      <Route element={<ProtectedRoute allowedRoles={['SELLER_USER']} />}>
        <Route element={<DashboardLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/onboarding" element={<OnboardingWizardPage />} />
          <Route path="/applications" element={<ApplicationStatusPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/products/add-existing" element={<AddExistingProductPage />} />
          <Route path="/products/propose" element={<ProposeProductWizard />} />
          <Route path="/warehouses" element={<WarehouseManagementPage />} />
          <Route path="/inventory" element={<Navigate to="/" replace />} />
          <Route path="/orders" element={<Navigate to="/" replace />} />
        </Route>
      </Route>

      {/* 404 Fallback */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};
