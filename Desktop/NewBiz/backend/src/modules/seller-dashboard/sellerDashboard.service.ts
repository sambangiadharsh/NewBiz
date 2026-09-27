import { prisma } from '../../database/prisma.js';

export class SellerDashboardService {
  /**
   * Resolve live KPI statistics for the authenticated seller
   */
  async getStats(userId: bigint) {
    const sellerUser = await prisma.sellerUsers.findFirst({
      where: { UserID: userId, Status: 'ACTIVE' },
      include: {
        Sellers: {
          include: {
            SellerApplications: {
              where: { Status: 'APPROVED' },
              include: {
                Categories: true,
                SellerApplicationDocuments: true,
              },
            },
          },
        },
      },
    });

    if (!sellerUser || !sellerUser.Sellers) {
      return {
        hasProfile: false,
        products: {
          count: 0,
          activeCount: 0,
          label: '0 SKUs',
          sub: 'No products listed yet',
        },
        warehouses: {
          count: 0,
          label: '0 Facilities',
          sub: 'No warehouse linked yet',
          ownCount: 0,
          threePLCount: 0,
          primaryWarehouseName: null,
        },
        categories: {
          count: 0,
          label: '—',
          sub: '0 documents verified',
          categoryName: 'General',
          verifiedDocs: 0,
          totalDocs: 0,
        },
        inventory: {
          totalPhysical: 0,
          label: '0 Units',
          sub: 'No inventory allocated',
        },
      };
    }

    const sellerId = sellerUser.SellerID;

    // 1. Products count
    const [totalProducts, activeProducts] = await Promise.all([
      prisma.sellerProducts.count({ where: { SellerID: sellerId } }),
      prisma.sellerProducts.count({ where: { SellerID: sellerId, Status: 'ACTIVE' } }),
    ]);

    // 2. Connected Warehouses (where relationship status is ACTIVE and warehouse facility is ACTIVE)
    const activeWarehouses = await prisma.sellerWarehouses.findMany({
      where: {
        SellerID: sellerId,
        Status: 'ACTIVE',
        Warehouses: { Status: 'ACTIVE' },
      },
      include: { Warehouses: true },
      orderBy: [{ IsPrimary: 'desc' }, { CreatedAt: 'desc' }],
    });

    let ownCount = 0;
    let threePLCount = 0;
    for (const sw of activeWarehouses) {
      if (sw.Warehouses.WarehouseType === 'OWN') ownCount++;
      else if (sw.Warehouses.WarehouseType === '3PL' || sw.Warehouses.WarehouseType === 'THIRD_PARTY') threePLCount++;
    }

    const primaryWh = activeWarehouses.find((sw) => sw.IsPrimary) || activeWarehouses[0];
    const warehouseSubtext =
      activeWarehouses.length > 0
        ? primaryWh
          ? `${primaryWh.Warehouses.WarehouseName}${activeWarehouses.length > 1 ? ` (+${activeWarehouses.length - 1} more)` : ''}`
          : `${ownCount} Own, ${threePLCount} 3PL`
        : 'No warehouse linked yet';

    // 3. Approved Categories & Documents
    const approvedApps = sellerUser.Sellers.SellerApplications || [];
    const primaryApp = approvedApps[0];
    const categoryName = primaryApp?.Categories?.CategoryName || 'General';
    const totalDocs = primaryApp?.SellerApplicationDocuments?.length || 0;
    const verifiedDocs =
      primaryApp?.SellerApplicationDocuments?.filter((d) => d.VerificationStatus === 'APPROVED').length || 0;

    // 4. Total Stock / Allocated Inventory
    const inventoryRows = await prisma.inventory.findMany({
      where: {
        WarehouseProducts: {
          SellerProducts: {
            SellerID: sellerId,
          },
        },
      },
      select: {
        PhysicalQuantity: true,
        ReservedQuantity: true,
      },
    });

    const totalStock = inventoryRows.reduce((sum, r) => sum + r.PhysicalQuantity, 0);

    return {
      hasProfile: true,
      sellerName: sellerUser.Sellers.SellerName,
      sellerCode: sellerUser.Sellers.SellerCode,
      businessName: sellerUser.Sellers.BusinessName,
      products: {
        count: totalProducts,
        activeCount: activeProducts,
        label: totalProducts > 0 ? `${totalProducts} Active SKU${totalProducts === 1 ? '' : 's'}` : '0 SKUs',
        sub: totalProducts > 0 ? `${activeProducts} Published to catalog` : 'No products listed yet',
      },
      warehouses: {
        count: activeWarehouses.length,
        label:
          activeWarehouses.length > 0
            ? `${activeWarehouses.length} Facilit${activeWarehouses.length === 1 ? 'y' : 'ies'}`
            : '0 Facilities',
        sub: warehouseSubtext,
        ownCount,
        threePLCount,
        primaryWarehouseName: primaryWh?.Warehouses.WarehouseName || null,
      },
      categories: {
        count: approvedApps.length,
        label: approvedApps.length > 0 ? categoryName : '—',
        sub: approvedApps.length > 0 ? `${verifiedDocs} / ${totalDocs} documents verified` : 'Awaiting category approval',
        categoryName,
        verifiedDocs,
        totalDocs,
      },
      inventory: {
        totalPhysical: totalStock,
        label: totalStock > 0 ? `${totalStock} Units` : '0 Units',
        sub:
          totalStock > 0
            ? `Across ${activeWarehouses.length} active location${activeWarehouses.length === 1 ? '' : 's'}`
            : 'Inventory sync active',
      },
    };
  }
}

export const sellerDashboardService = new SellerDashboardService();
