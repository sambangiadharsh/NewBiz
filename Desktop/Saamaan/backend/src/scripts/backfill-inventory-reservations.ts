import { getPool, closePool } from '../database/db.js';

async function main() {
  const pool = await getPool();
  console.log('Starting backfill for InventoryReservations...');

  // Check which order items don't have reservations yet
  const items = await pool.request().query<{
    OrderID: string;
    OrderNumber: string;
    OrderStatus: string;
    OrderItemID: string;
    SellerProductID: string;
    Quantity: number;
    FulfillmentID: string | null;
    WarehouseID: string | null;
    InventoryID: string | null;
  }>(`
    SELECT 
      o.OrderID,
      o.OrderNumber,
      o.Status AS OrderStatus,
      oi.OrderItemID,
      oi.SellerProductID,
      oi.Quantity,
      f.FulfillmentID,
      COALESCE(f.WarehouseID, sw.WarehouseID) AS WarehouseID,
      inv.InventoryID
    FROM dbo.Orders o
    JOIN dbo.OrderItems oi ON o.OrderID = oi.OrderID
    LEFT JOIN dbo.Fulfillments f ON oi.FulfillmentID = f.FulfillmentID
    LEFT JOIN dbo.SellerProducts sp ON oi.SellerProductID = sp.SellerProductID
    OUTER APPLY (
      SELECT TOP 1 sw.WarehouseID
      FROM dbo.SellerWarehouses sw
      WHERE sw.SellerID = sp.SellerID
      ORDER BY sw.IsPrimary DESC
    ) sw
    LEFT JOIN dbo.WarehouseProducts wp ON (
      wp.SellerProductID = oi.SellerProductID AND wp.WarehouseID = COALESCE(f.WarehouseID, sw.WarehouseID)
    )
    LEFT JOIN dbo.Inventory inv ON wp.WarehouseProductID = inv.WarehouseProductID
    WHERE NOT EXISTS (
      SELECT 1 FROM dbo.InventoryReservations ir 
      WHERE ir.OrderID = o.OrderID AND ir.InventoryID = inv.InventoryID
    )
    ORDER BY o.OrderID;
  `);

  console.log(`Found ${items.recordset.length} order items needing reservations backfilled.`);

  let inserted = 0;
  for (const item of items.recordset) {
    if (!item.InventoryID) {
      console.warn(`Could not resolve InventoryID for Order ${item.OrderNumber}, SellerProduct ${item.SellerProductID}`);
      continue;
    }

    const reservationStatus = item.OrderStatus === 'DELIVERED' ? 'FULFILLED' : 
                              item.OrderStatus === 'CANCELLED' ? 'CANCELLED' : 'RESERVED';

    await pool.request()
      .input('invId', item.InventoryID)
      .input('orderId', item.OrderID)
      .input('qty', item.Quantity)
      .input('status', reservationStatus)
      .query(`
        INSERT INTO dbo.InventoryReservations (
          InventoryID, OrderID, Quantity, Status, ExpiresAt, CreatedAt, UpdatedAt
        )
        VALUES (
          @invId, @orderId, @qty, @status, NULL, SYSUTCDATETIME(), SYSUTCDATETIME()
        );
      `);

    inserted++;
  }

  console.log(`Successfully backfilled ${inserted} reservations into dbo.InventoryReservations.`);

  const verify = await pool.request().query(`
    SELECT ReservationID, InventoryID, OrderID, Quantity, Status, CreatedAt
    FROM dbo.InventoryReservations
    ORDER BY ReservationID;
  `);
  console.log('Reservations in database now:', verify.recordset);

  await closePool();
}

main().catch(err => {
  console.error('Backfill error:', err);
  process.exit(1);
});
