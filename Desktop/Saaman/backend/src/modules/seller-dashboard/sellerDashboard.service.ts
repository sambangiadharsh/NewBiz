import { sellerDashboardRepository } from './sellerDashboard.repository.js';

export class SellerDashboardService {
  /**
   * Resolve live KPI statistics for the authenticated seller
   */
  async getStats(userId: bigint) {
    const seller = await sellerDashboardRepository.getActiveSeller(userId);

    if (!seller) {
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
          label: '0 Warehouses',
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

    const sellerId = seller.SellerID;

    // 1. Products count
    const { total: totalProducts, active: activeProducts } =
      await sellerDashboardRepository.getProductCounts(sellerId);

    // 2. Connected Warehouses
    const activeWarehouses = await sellerDashboardRepository.getActiveWarehouses(sellerId);

    let ownCount = 0;
    let threePLCount = 0;
    for (const sw of activeWarehouses) {
      if (sw.WarehouseType === 'OWN') ownCount++;
      else if (sw.WarehouseType === '3PL' || sw.WarehouseType === 'THIRD_PARTY') threePLCount++;
    }

    const primaryWh = activeWarehouses.find((sw) => sw.IsPrimary) || activeWarehouses[0];
    const warehouseSubtext =
      activeWarehouses.length > 0
        ? primaryWh
          ? `${primaryWh.WarehouseName}${activeWarehouses.length > 1 ? ` (+${activeWarehouses.length - 1} more)` : ''}`
          : `${ownCount} Own, ${threePLCount} 3PL`
        : 'No warehouse linked yet';

    // 3. Approved Categories & Documents
    const catInfo = await sellerDashboardRepository.getCategoryInfo(sellerId);

    // 4. Total Stock / Allocated Inventory
    const totalStock = await sellerDashboardRepository.getTotalInventoryStock(sellerId);

    return {
      hasProfile: true,
      sellerName: seller.SellerName,
      sellerCode: seller.SellerCode,
      businessName: seller.BusinessName,
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
            ? `${activeWarehouses.length} Warehouse${activeWarehouses.length === 1 ? '' : 's'}`
            : '0 Warehouses',
        sub: warehouseSubtext,
        ownCount,
        threePLCount,
        primaryWarehouseName: primaryWh?.WarehouseName || null,
      },
      categories: {
        count: catInfo.ApprovedAppsCount,
        label: catInfo.ApprovedAppsCount > 0 ? catInfo.CategoryName : '—',
        sub:
          catInfo.ApprovedAppsCount > 0
            ? `${catInfo.VerifiedDocs} / ${catInfo.TotalDocs} documents verified`
            : 'Awaiting category approval',
        categoryName: catInfo.CategoryName,
        verifiedDocs: catInfo.VerifiedDocs,
        totalDocs: catInfo.TotalDocs,
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
