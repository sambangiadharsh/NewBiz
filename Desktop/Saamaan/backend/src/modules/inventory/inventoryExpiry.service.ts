import { getPool, sql } from '../../database/db.js';
import { logger } from '../../utils/logger.js';

export class InventoryExpiryService {
  private intervalId: NodeJS.Timeout | null = null;
  private isProcessing = false;

  /**
   * Scans and releases expired stock reservations (15-minute checkout hold TTL).
   * Atomically restores ReservedQuantity, sets Status='EXPIRED', writes 3-column
   * ledger transaction, and updates order/payment status.
   */
  async sweepExpiredReservations(): Promise<number> {
    if (this.isProcessing) return 0;
    this.isProcessing = true;

    try {
      const pool = await getPool();

      // Find expired reservations that are still active (Status = 'RESERVED')
      const expiredQuery = await pool.request().query<{
        ReservationID: bigint;
        InventoryID: bigint;
        OrderID: bigint;
        Quantity: number;
        OrderNumber: string;
      }>(`
        SELECT 
          ir.ReservationID,
          ir.InventoryID,
          ir.OrderID,
          ir.Quantity,
          o.OrderNumber
        FROM dbo.InventoryReservations ir
        JOIN dbo.Orders o ON ir.OrderID = o.OrderID
        WHERE ir.Status = 'RESERVED'
          AND ir.ExpiresAt IS NOT NULL
          AND ir.ExpiresAt < SYSUTCDATETIME()
          AND o.Status = 'PENDING';
      `);

      if (expiredQuery.recordset.length === 0) {
        return 0;
      }

      const expiredList = expiredQuery.recordset;
      logger.info(
        `Found ${expiredList.length} expired reservation(s) to auto-release back to available stock`,
        undefined,
        'InventoryExpiryService'
      );

      const transaction = new sql.Transaction(pool);
      await transaction.begin();

      try {
        for (const item of expiredList) {
          // 1. Release reserved bucket on Inventory and capture balances
          const updateInv = await transaction
            .request()
            .input('invId', sql.BigInt, item.InventoryID)
            .input('qty', sql.Int, item.Quantity)
            .query<{ PhysicalQuantity: number }>(`
              UPDATE dbo.Inventory
              SET ReservedQuantity = CASE WHEN ReservedQuantity >= @qty THEN ReservedQuantity - @qty ELSE 0 END,
                  UpdatedAt = SYSUTCDATETIME()
              OUTPUT INSERTED.PhysicalQuantity
              WHERE InventoryID = @invId;
            `);

          const physBal = updateInv.recordset[0]?.PhysicalQuantity ?? 0;

          // 2. Mark reservation as EXPIRED
          await transaction
            .request()
            .input('resId', sql.BigInt, item.ReservationID)
            .query(`
              UPDATE dbo.InventoryReservations
              SET Status = 'EXPIRED',
                  UpdatedAt = SYSUTCDATETIME()
              WHERE ReservationID = @resId;
            `);

          // 3. Write 3-column ledger audit entry (Quantity, BalanceBefore, BalanceAfter)
          await transaction
            .request()
            .input('invId', sql.BigInt, item.InventoryID)
            .input('orderId', sql.BigInt, item.OrderID)
            .input('qty', sql.Int, item.Quantity)
            .input('balBefore', sql.Int, physBal)
            .input('balAfter', sql.Int, physBal)
            .input('reason', sql.NVarChar(500), `15-minute checkout TTL expired for order #${item.OrderNumber}`)
            .query(`
              INSERT INTO dbo.InventoryTransactions (
                InventoryID, OrderID, TransactionType, Quantity,
                BalanceBefore, BalanceAfter, Reason, CreatedAt
              )
              VALUES (
                @invId, @orderId, 'RESERVATION_EXPIRED', @qty,
                @balBefore, @balAfter, @reason, SYSUTCDATETIME()
              );
            `);

          // 4. Update order status to CANCELLED
          await transaction
            .request()
            .input('orderId', sql.BigInt, item.OrderID)
            .query(`
              UPDATE dbo.Orders
              SET Status = 'CANCELLED',
                  UpdatedAt = SYSUTCDATETIME()
              WHERE OrderID = @orderId AND Status = 'PENDING';

              UPDATE dbo.Payments
              SET Status = 'EXPIRED',
                  FailureReason = 'Payment timed out after 15 minutes',
                  UpdatedAt = SYSUTCDATETIME()
              WHERE OrderID = @orderId AND Status = 'PENDING';
            `);
        }

        await transaction.commit();
        logger.info(
          `Successfully released ${expiredList.length} expired reservation(s) back to available stock`,
          undefined,
          'InventoryExpiryService'
        );
        return expiredList.length;
      } catch (err) {
        await transaction.rollback();
        throw err;
      }
    } catch (err) {
      logger.error('Error during sweepExpiredReservations:', err, 'InventoryExpiryService');
      return 0;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Starts periodic background daemon (defaults to every 60 seconds).
   */
  start(intervalMs: number = 60000) {
    if (this.intervalId) return;
    logger.info(`Starting reservation TTL daemon (interval: ${intervalMs / 1000}s)`, undefined, 'InventoryExpiryService');

    // Run first sweep shortly after startup
    setTimeout(() => {
      this.sweepExpiredReservations();
    }, 5000);

    this.intervalId = setInterval(() => {
      this.sweepExpiredReservations();
    }, intervalMs);
  }

  /**
   * Stops the periodic daemon cleanly on server shutdown.
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('Stopped reservation TTL daemon', undefined, 'InventoryExpiryService');
    }
  }
}

export const inventoryExpiryService = new InventoryExpiryService();

