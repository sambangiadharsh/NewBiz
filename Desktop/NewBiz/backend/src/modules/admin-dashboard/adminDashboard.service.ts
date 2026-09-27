import { prisma } from '../../database/prisma.js';

export class AdminDashboardService {
  /**
   * Get dynamic platform KPI statistics and recent queue activity
   */
  async getStats() {
    const [
      activeSellersCount,
      totalSellersCount,
      activeSellerSamples,
      activeWarehousesCount,
      totalWarehousesCount,
      warehouseTypeGroups,
      totalProductsCount,
      activeCategoriesCount,
      pendingApplicationsCount,
      pendingWarehousesCount,
      pendingAppDocsCount,
      pendingWhDocsCount,
      recentApplications,
      recentWarehouses,
    ] = await Promise.all([
      // 1. Active Sellers
      prisma.sellers.count({ where: { Status: 'ACTIVE' } }),
      prisma.sellers.count(),
      prisma.sellers.findMany({
        where: { Status: 'ACTIVE' },
        select: { SellerName: true },
        take: 3,
        orderBy: { CreatedAt: 'desc' },
      }),

      // 2. Warehouses
      prisma.warehouses.count({ where: { Status: 'ACTIVE' } }),
      prisma.warehouses.count(),
      prisma.warehouses.groupBy({
        by: ['WarehouseType'],
        where: { Status: 'ACTIVE' },
        _count: true,
      }),

      // 3. Products & Categories
      prisma.productMaster.count(),
      prisma.categories.count({ where: { Status: 'ACTIVE' } }),

      // 4. Pending Queue
      prisma.sellerApplications.count({
        where: { Status: { in: ['SUBMITTED', 'IN_REVIEW'] } },
      }),
      prisma.warehouses.count({
        where: { Status: 'PENDING_APPROVAL' },
      }),
      prisma.sellerApplicationDocuments.count({
        where: { VerificationStatus: 'PENDING' },
      }),
      prisma.sellerWarehouseDocuments.count({
        where: { VerificationStatus: 'PENDING' },
      }),

      // 5. Recent applications
      prisma.sellerApplications.findMany({
        where: { Status: { not: 'DRAFT' } },
        take: 4,
        orderBy: { CreatedAt: 'desc' },
        include: {
          Sellers: { select: { SellerName: true, SellerCode: true, Email: true } },
          Categories: { select: { CategoryName: true } },
        },
      }),

      // 6. Recent warehouses submitted
      prisma.warehouses.findMany({
        take: 4,
        orderBy: { CreatedAt: 'desc' },
        select: {
          WarehouseID: true,
          WarehouseName: true,
          WarehouseCode: true,
          WarehouseType: true,
          City: true,
          State: true,
          Status: true,
          CreatedAt: true,
        },
      }),
    ]);

    // Parse warehouse breakdown
    let ownCount = 0;
    let threePLCount = 0;
    for (const group of warehouseTypeGroups) {
      if (group.WarehouseType === 'OWN') {
        ownCount = group._count;
      } else if (group.WarehouseType === '3PL' || group.WarehouseType === 'THIRD_PARTY') {
        threePLCount += group._count;
      }
    }

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
        sellerName: app.Sellers.SellerName,
        sellerCode: app.Sellers.SellerCode,
        categoryName: app.Categories?.CategoryName || 'General',
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
