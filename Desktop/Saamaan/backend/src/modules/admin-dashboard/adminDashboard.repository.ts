import { getPool } from '../../database/db.js';

export interface AdminDashboardCounts {
  ActiveSellersCount: number;
  TotalSellersCount: number;
  ActiveWarehousesCount: number;
  TotalWarehousesCount: number;
  OwnCount: number;
  ThreePLCount: number;
  TotalProductsCount: number;
  ActiveCategoriesCount: number;
  PendingApplicationsCount: number;
  PendingWarehousesCount: number;
  PendingAppDocsCount: number;
  PendingWhDocsCount: number;
}

export interface AdminDashboardRecentApp {
  SellerApplicationID: bigint | number;
  SellerName: string;
  SellerCode: string;
  CategoryName: string | null;
  Status: string;
  SubmittedAt: Date | null;
  CreatedAt: Date;
}

export interface AdminDashboardRecentWarehouse {
  WarehouseID: bigint | number;
  WarehouseName: string;
  WarehouseCode: string;
  WarehouseType: string;
  City: string;
  State: string;
  Status: string;
  CreatedAt: Date;
}

export class AdminDashboardRepository {
  async getDashboardCounts(): Promise<AdminDashboardCounts> {
    const pool = await getPool();
    const result = await pool.request().query<AdminDashboardCounts>(`
      SELECT
        (SELECT COUNT(1) FROM Sellers WHERE Status = 'ACTIVE') AS ActiveSellersCount,
        (SELECT COUNT(1) FROM Sellers) AS TotalSellersCount,
        (SELECT COUNT(1) FROM Warehouses WHERE Status = 'ACTIVE') AS ActiveWarehousesCount,
        (SELECT COUNT(1) FROM Warehouses) AS TotalWarehousesCount,
        (SELECT COUNT(1) FROM Warehouses WHERE Status = 'ACTIVE' AND WarehouseType = 'OWN') AS OwnCount,
        (SELECT COUNT(1) FROM Warehouses WHERE Status = 'ACTIVE' AND WarehouseType IN ('3PL', 'THIRD_PARTY')) AS ThreePLCount,
        (SELECT COUNT(1) FROM ProductMaster) AS TotalProductsCount,
        (SELECT COUNT(1) FROM Categories WHERE Status = 'ACTIVE') AS ActiveCategoriesCount,
        (SELECT COUNT(1) FROM SellerApplications WHERE Status IN ('SUBMITTED', 'IN_REVIEW')) AS PendingApplicationsCount,
        (SELECT COUNT(1) FROM Warehouses WHERE Status = 'PENDING_APPROVAL') AS PendingWarehousesCount,
        (SELECT COUNT(1) FROM SellerApplicationDocuments WHERE VerificationStatus = 'PENDING') AS PendingAppDocsCount,
        (SELECT COUNT(1) FROM SellerWarehouseDocuments WHERE VerificationStatus = 'PENDING') AS PendingWhDocsCount
    `);

    return (
      result.recordset[0] ?? {
        ActiveSellersCount: 0,
        TotalSellersCount: 0,
        ActiveWarehousesCount: 0,
        TotalWarehousesCount: 0,
        OwnCount: 0,
        ThreePLCount: 0,
        TotalProductsCount: 0,
        ActiveCategoriesCount: 0,
        PendingApplicationsCount: 0,
        PendingWarehousesCount: 0,
        PendingAppDocsCount: 0,
        PendingWhDocsCount: 0,
      }
    );
  }

  async getActiveSellerSamples(limit = 3): Promise<{ SellerName: string }[]> {
    const pool = await getPool();
    const result = await pool.request().query<{ SellerName: string }>(`
      SELECT TOP (${limit}) SellerName
      FROM Sellers
      WHERE Status = 'ACTIVE'
      ORDER BY CreatedAt DESC
    `);
    return result.recordset;
  }

  async getRecentApplications(limit = 4): Promise<AdminDashboardRecentApp[]> {
    const pool = await getPool();
    const result = await pool.request().query<AdminDashboardRecentApp>(`
      SELECT TOP (${limit})
        sa.SellerApplicationID,
        s.SellerName,
        s.SellerCode,
        c.CategoryName,
        sa.Status,
        sa.SubmittedAt,
        sa.CreatedAt
      FROM SellerApplications sa
      JOIN Sellers s ON sa.SellerID = s.SellerID
      LEFT JOIN Categories c ON sa.CategoryID = c.CategoryID
      WHERE sa.Status != 'DRAFT'
      ORDER BY sa.CreatedAt DESC
    `);
    return result.recordset;
  }

  async getRecentWarehouses(limit = 4): Promise<AdminDashboardRecentWarehouse[]> {
    const pool = await getPool();
    const result = await pool.request().query<AdminDashboardRecentWarehouse>(`
      SELECT TOP (${limit})
        WarehouseID, WarehouseName, WarehouseCode, WarehouseType, 
        City, State, Status, CreatedAt
      FROM Warehouses
      ORDER BY CreatedAt DESC
    `);
    return result.recordset;
  }
}

export const adminDashboardRepository = new AdminDashboardRepository();
