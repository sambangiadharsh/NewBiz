import { getPool, closePool } from '../database/db.js';

async function main() {
  const pool = await getPool();
  
  // Add CodFee to dbo.Orders if not exists
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Orders' AND COLUMN_NAME = 'CodFee')
    BEGIN
      ALTER TABLE dbo.Orders ADD CodFee DECIMAL(18,2) NOT NULL CONSTRAINT DF_Orders_CodFee DEFAULT 0;
      PRINT '+ Added CodFee to dbo.Orders';
    END
    ELSE
    BEGIN
      PRINT '~ CodFee already exists on dbo.Orders';
    END
  `);

  // Add CodFee to dbo.Invoices if not exists
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Invoices' AND COLUMN_NAME = 'CodFee')
    BEGIN
      ALTER TABLE dbo.Invoices ADD CodFee DECIMAL(18,2) NOT NULL CONSTRAINT DF_Invoices_CodFee DEFAULT 0;
      PRINT '+ Added CodFee to dbo.Invoices';
    END
    ELSE
    BEGIN
      PRINT '~ CodFee already exists on dbo.Invoices';
    END
  `);

  // Backfill existing orders:
  // For orders with COD where ShippingAmount was 78 -> Shipping = 49, CodFee = 29
  // For orders with COD where ShippingAmount was 29 -> Shipping = 0, CodFee = 29
  await pool.request().query(`
    UPDATE o
    SET 
      o.ShippingAmount = CASE 
        WHEN o.ShippingAmount = 78 THEN 49
        WHEN o.ShippingAmount = 29 AND pm.PaymentModeCode = 'COD' THEN 0
        ELSE o.ShippingAmount
      END,
      o.CodFee = CASE 
        WHEN pm.PaymentModeCode = 'COD' THEN 29
        ELSE 0
      END
    FROM dbo.Orders o
    JOIN dbo.Payments p ON o.OrderID = p.OrderID
    JOIN dbo.PaymentModes pm ON p.PaymentModeID = pm.PaymentModeID
    WHERE pm.PaymentModeCode = 'COD';

    UPDATE inv
    SET 
      inv.ShippingAmount = o.ShippingAmount,
      inv.CodFee = o.CodFee
    FROM dbo.Invoices inv
    JOIN dbo.Orders o ON inv.OrderID = o.OrderID;
  `);

  console.log('✅ CodFee added and backfilled successfully.');

  const res = await pool.request().query(`
    SELECT o.OrderID, o.OrderNumber, o.SubtotalAmount, o.ShippingAmount AS DeliveryCharges, o.CodFee, o.TotalAmount
    FROM dbo.Orders o
    ORDER BY o.OrderID DESC;
  `);
  console.table(res.recordset);
}

main().catch(console.error).finally(async () => {
  await closePool();
  process.exit(0);
});
