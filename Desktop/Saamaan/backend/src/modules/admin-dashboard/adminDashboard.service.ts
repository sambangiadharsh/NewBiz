import { adminDashboardRepository } from './adminDashboard.repository.js';

export class AdminDashboardService {
  /**
   * Get dynamic platform KPI statistics and recent queue activity
   */
  async getStats() {
    const [counts, activeSellerSamples, recentApplications, recentWarehouses] = await Promise.all([
      adminDashboardRepository.getDashboardCounts(),
      adminDashboardRepository.getActiveSellerSamples(3),
      adminDashboardRepository.getRecentApplications(4),
      adminDashboardRepository.getRecentWarehouses(4),
    ]);

    const activeSellersCount = counts.ActiveSellersCount;
    const totalSellersCount = counts.TotalSellersCount;
    const activeWarehousesCount = counts.ActiveWarehousesCount;
    const totalWarehousesCount = counts.TotalWarehousesCount;
    const ownCount = counts.OwnCount;
    const threePLCount = counts.ThreePLCount;
    const totalProductsCount = counts.TotalProductsCount;
    const activeCategoriesCount = counts.ActiveCategoriesCount;
    const pendingApplicationsCount = counts.PendingApplicationsCount;
    const pendingWarehousesCount = counts.PendingWarehousesCount;
    const pendingAppDocsCount = counts.PendingAppDocsCount;
    const pendingWhDocsCount = counts.PendingWhDocsCount;

    // Active seller names summary
    const sellerNames = activeSellerSamples.map((s) => s.SellerName);
    const remainingSellers = Math.max(0, activeSellersCount - sellerNames.length);
    const sellerSubtext =
      sellerNames.length > 0
        ? `${sellerNames.join(', ')}${remainingSellers > 0 ? ` +${remainingSellers} more` : ''}`
        : 'No active sellers yet';

    const warehouseSubtext =
      activeWarehousesCount > 0
        ? `${ownCount} Own, ${threePLCount} 3PL Partner`
        : 'No verified warehouses';

    const totalPendingInQueue =
      pendingApplicationsCount + pendingWarehousesCount + pendingAppDocsCount + pendingWhDocsCount;

    const pendingSubtext =
      totalPendingInQueue === 0
        ? 'All onboarding verified'
        : `${pendingApplicationsCount} Sellers, ${pendingWarehousesCount} Warehouses, ${pendingAppDocsCount + pendingWhDocsCount} Docs pending`;

    return {
      activeSellers: {
        count: activeSellersCount,
        label: `${activeSellersCount} Seller${activeSellersCount === 1 ? '' : 's'}`,
        change: sellerSubtext,
        total: totalSellersCount,
      },
      verifiedWarehouses: {
        count: activeWarehousesCount,
        label: `${activeWarehousesCount} Warehouse${activeWarehousesCount === 1 ? '' : 's'}`,
        change: warehouseSubtext,
        ownCount,
        threePLCount,
        total: totalWarehousesCount,
      },
      catalogProducts: {
        count: totalProductsCount,
        label: `${totalProductsCount} Product${totalProductsCount === 1 ? '' : 's'}`,
        change: `Published across ${activeCategoriesCount} categories`,
        categoriesCount: activeCategoriesCount,
      },
      pendingApplications: {
        count: totalPendingInQueue,
        label: `${totalPendingInQueue} In Queue`,
        change: pendingSubtext,
        pendingSellers: pendingApplicationsCount,
        pendingWarehouses: pendingWarehousesCount,
        pendingDocuments: pendingAppDocsCount + pendingWhDocsCount,
      },
      recentApplications: recentApplications.map((app) => ({
        id: Number(app.SellerApplicationID),
        sellerName: app.SellerName,
        sellerCode: app.SellerCode,
        categoryName: app.CategoryName || 'General',
        status: app.Status,
        submittedAt: app.SubmittedAt || app.CreatedAt,
      })),
      recentWarehouses: recentWarehouses.map((wh) => ({
        id: Number(wh.WarehouseID),
        name: wh.WarehouseName,
        code: wh.WarehouseCode,
        type: wh.WarehouseType,
        location: `${wh.City}, ${wh.State}`,
        status: wh.Status,
        createdAt: wh.CreatedAt,
      })),
    };
  }
}

export const adminDashboardService = new AdminDashboardService();
