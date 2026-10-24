import { getPool, sql } from '../../database/db.js';

export interface SellerDashboardProfile {
  SellerID: bigint | number;
  SellerName: string;
  SellerCode: string;
  BusinessName: string | null;
}

export interface SellerActiveWarehouse {
  WarehouseID: bigint | number;
  WarehouseName: string;
  WarehouseType: string;
  IsPrimary: boolean;
}

export interface SellerCategoryInfo {
  CategoryName: string | null;
  TotalDocs: number;
  VerifiedDocs: number;
  ApprovedAppsCount: number;
}

export class SellerDashboardRepository {
  async getActiveSeller(userId: bigint): Promise<SellerDashboardProfile | null> {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('userId', sql.BigInt, userId)
      .query<SellerDashboardProfile>(`
        SELECT TOP 1 s.SellerID, s.SellerName, s.SellerCode, s.BusinessName
        FROM SellerUsers su
        JOIN Sellers s ON su.SellerID = s.SellerID
        WHERE su.UserID = @userId AND su.Status = 'ACTIVE'
      `);
    return result.recordset[0] ?? null;
  }

  async getProductCounts(sellerId: bigint | number): Promise<{ total: number; active: number }> {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('sellerId', sql.BigInt, sellerId)
      .query<{ total: number; active: number }>(`
        SELECT 
          COUNT(1) AS total,
          COUNT(CASE WHEN Status = 'ACTIVE' THEN 1 END) AS active
        FROM SellerProducts
        WHERE SellerID = @sellerId
      `);
    const row = result.recordset[0];
    return {
      total: row?.total ?? 0,
      active: row?.active ?? 0,
    };
  }

  async getActiveWarehouses(sellerId: bigint | number): Promise<SellerActiveWarehouse[]> {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('sellerId', sql.BigInt, sellerId)
      .query<SellerActiveWarehouse>(`
        SELECT 
          w.WarehouseID, w.WarehouseName, w.WarehouseType, sw.IsPrimary
        FROM SellerWarehouses sw
        JOIN Warehouses w ON sw.WarehouseID = w.WarehouseID
        WHERE sw.SellerID = @sellerId AND sw.Status = 'ACTIVE' AND w.Status = 'ACTIVE'
        ORDER BY sw.IsPrimary DESC, sw.CreatedAt DESC
      `);
    return result.recordset;
  }

  async getCategoryInfo(sellerId: bigint | number): Promise<SellerCategoryInfo> {
    const pool = await getPool();
    const appRes = await pool
      .request()
      .input('sellerId', sql.BigInt, sellerId)
      .query<{ SellerApplicationID: bigint | number; CategoryName: string }>(`
        SELECT TOP 1 sa.SellerApplicationID, c.CategoryName
        FROM SellerApplications sa
        LEFT JOIN Categories c ON sa.CategoryID = c.CategoryID
        WHERE sa.SellerID = @sellerId AND sa.Status = 'APPROVED'
        ORDER BY sa.CreatedAt DESC
      `);

    const app = appRes.recordset[0];
    if (!app) {
      return {
        CategoryName: 'General',
        TotalDocs: 0,
        VerifiedDocs: 0,
        ApprovedAppsCount: 0,
      };
    }

    const docRes = await pool
      .request()
      .input('appId', sql.BigInt, app.SellerApplicationID)
      .query<{ total: number; verified: number }>(`
        SELECT 
          COUNT(1) AS total,
          COUNT(CASE WHEN VerificationStatus = 'APPROVED' THEN 1 END) AS verified
        FROM SellerApplicationDocuments
        WHERE SellerApplicationID = @appId
      `);

    const docRow = docRes.recordset[0];
    return {
      CategoryName: app.CategoryName || 'General',
      TotalDocs: docRow?.total ?? 0,
      VerifiedDocs: docRow?.verified ?? 0,
      ApprovedAppsCount: 1,
    };
  }

  async getTotalInventoryStock(sellerId: bigint | number): Promise<number> {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('sellerId', sql.BigInt, sellerId)
      .query<{ TotalStock: number }>(`
        SELECT ISNULL(SUM(i.PhysicalQuantity), 0) AS TotalStock
        FROM Inventory i
        JOIN WarehouseProducts wp ON i.WarehouseProductID = wp.WarehouseProductID
        JOIN SellerProducts sp ON wp.SellerProductID = sp.SellerProductID
        WHERE sp.SellerID = @sellerId
      `);
    return result.recordset[0]?.TotalStock ?? 0;
  }
}

export const sellerDashboardRepository = new SellerDashboardRepository();
