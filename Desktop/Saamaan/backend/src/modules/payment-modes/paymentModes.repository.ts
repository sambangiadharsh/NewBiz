import { getPool } from '../../database/db.js';

export interface PaymentModeRecord {
  PaymentModeID: bigint | number;
  PaymentModeCode: string;
  PaymentModeName: string;
  PaymentModeType: string;
  Status: string;
}

export class PaymentModesRepository {
  async listActive(): Promise<PaymentModeRecord[]> {
    const pool = await getPool();
    const result = await pool.request().query<PaymentModeRecord>(`
      SELECT 
        PaymentModeID,
        PaymentModeCode,
        PaymentModeName,
        PaymentModeType,
        Status
      FROM dbo.PaymentModes
      WHERE Status = 'ACTIVE'
      ORDER BY PaymentModeID ASC
    `);

    return result.recordset;
  }
}

export const paymentModesRepository = new PaymentModesRepository();
