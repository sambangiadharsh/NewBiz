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
import { InventoryGridPage } from './features/inventory/InventoryGridPage.js';
import { InboundNoticePage } from './features/inventory/InboundNoticePage.js';
import { StockLedgerPage } from './features/inventory/StockLedgerPage.js';
import { RestockAlertsPage } from './features/inventory/RestockAlertsPage.js';
import { SellerOrdersPage } from './features/orders/SellerOrdersPage.js';
import { NotFoundPage } from './features/common/NotFoundPage.js';

export const App: React.FC = () => {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/signup" element={<Navigate to="/register" replace />} />

      {/* Protected Seller Routes */}
      <Route element={<ProtectedRoute allowedRoles={['SELLER_ADMIN']} />}>
        <Route element={<DashboardLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/onboarding" element={<OnboardingWizardPage />} />
          <Route path="/applications" element={<ApplicationStatusPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/products/add-existing" element={<AddExistingProductPage />} />
          <Route path="/products/propose" element={<ProposeProductWizard />} />
          <Route path="/warehouses" element={<WarehouseManagementPage />} />

          {/* Option A: Inventory & Stock */}
          <Route path="/inventory" element={<InventoryGridPage />} />
          <Route path="/inventory/inbound" element={<InboundNoticePage />} />
          <Route path="/inventory/ledger" element={<StockLedgerPage />} />
          <Route path="/inventory/alerts" element={<RestockAlertsPage />} />

          {/* Orders & Shipments */}
          <Route path="/orders" element={<SellerOrdersPage />} />
          <Route path="/orders/to-pack" element={<Navigate to="/" replace />} />
          <Route path="/orders/shipments" element={<Navigate to="/" replace />} />
          <Route path="/orders/returns" element={<Navigate to="/" replace />} />
        </Route>
      </Route>

      {/* 404 Fallback */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};
