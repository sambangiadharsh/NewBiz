import { getPool, sql } from '../../database/db.js';

export interface PromotionRecord {
  PromotionID: bigint | number;
  PromotionName: string;
  PromotionCode: string | null;
  DiscountType: string;
  DiscountValue: number;
  MinOrderValue: number | null;
  MaxDiscountAmount: number | null;
  StartAt: Date;
  EndAt: Date;
  Status: string;
}

export class CustomerPromotionsRepository {
  async findByCode(code: string): Promise<PromotionRecord | null> {
    const pool = await getPool();
    const cleanCode = code.trim();

    const result = await pool
      .request()
      .input('code', sql.NVarChar(100), cleanCode)
      .query<PromotionRecord>(`
        SELECT TOP 1
          PromotionID,
          PromotionName,
          PromotionCode,
          DiscountType,
          DiscountValue,
          MinOrderValue,
          MaxDiscountAmount,
          StartAt,
          EndAt,
          Status
        FROM dbo.Promotions
        WHERE (UPPER(LTRIM(RTRIM(PromotionCode))) = UPPER(@code) 
           OR UPPER(LTRIM(RTRIM(PromotionName))) = UPPER(@code))
          AND Status = 'ACTIVE'
          AND SYSUTCDATETIME() >= StartAt
          AND SYSUTCDATETIME() <= EndAt
      `);

    return result.recordset[0] || null;
  }
}

export const customerPromotionsRepository = new CustomerPromotionsRepository();
