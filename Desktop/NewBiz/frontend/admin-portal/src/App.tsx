import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './features/auth/LoginPage.js';
import { ProtectedRoute } from './components/ProtectedRoute.js';
import { DashboardLayout } from './layouts/DashboardLayout.js';
import { DashboardPage } from './features/dashboard/DashboardPage.js';
import { SellerApplicationsPage } from './features/sellers/SellerApplicationsPage.js';
import { ActiveSellersPage } from './features/sellers/ActiveSellersPage.js';
import { WarehousesPage } from './features/warehouses/WarehousesPage.js';
import { WarehouseVerificationPage } from './features/warehouses/WarehouseVerificationPage.js';
import { AttributesPage } from './features/catalog/AttributesPage.js';
import { UOMPage } from './features/catalog/UOMPage.js';
import { CatalogQCPage } from './features/catalog/CatalogQCPage.js';
import { BrandsPage } from './features/catalog/BrandsPage.js';
import { CategoriesPage } from './features/categories/CategoriesPage.js';
import { ContentManagementPage } from './features/content/ContentManagementPage.js';
import { BannersPage } from './features/banners/BannersPage.js';
import { NotFoundPage } from './features/common/NotFoundPage.js';

export const App: React.FC = () => {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />

      {/* Protected Admin Routes */}
      <Route element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN']} />}>
        <Route element={<DashboardLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/sellers" element={<ActiveSellersPage />} />
          <Route path="/applications" element={<SellerApplicationsPage />} />
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/catalog/qc" element={<CatalogQCPage />} />
          <Route path="/catalog/products" element={<CatalogQCPage />} />
          <Route path="/catalog/brands" element={<BrandsPage />} />
          <Route path="/catalog/attributes" element={<AttributesPage />} />
          <Route path="/catalog/uom" element={<UOMPage />} />
          <Route path="/warehouses" element={<WarehousesPage />} />
          <Route path="/warehouses/verification" element={<WarehouseVerificationPage />} />
          <Route path="/catalog" element={<Navigate to="/catalog/qc" replace />} />
          <Route path="/rbac" element={<Navigate to="/" replace />} />
          <Route path="/content" element={<ContentManagementPage />} />
          <Route path="/content/banners" element={<BannersPage />} />
          <Route path="/banners" element={<Navigate to="/content/banners" replace />} />
        </Route>
      </Route>

      {/* 404 Fallback */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};
