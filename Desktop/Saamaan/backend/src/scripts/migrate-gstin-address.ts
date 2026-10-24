import { getPool, closePool } from '../database/db.js';

async function run() {
  const pool = await getPool();

  console.log('--- Checking & Migrating GSTIN columns ---');

  // 1. CustomerAddresses.GSTIN
  const addrCols = await pool.request().query<{ COLUMN_NAME: string }>(`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'CustomerAddresses' AND COLUMN_NAME = 'GSTIN'
  `);
  if (addrCols.recordset.length === 0) {
    console.log('Adding GSTIN column to CustomerAddresses...');
    await pool.request().query(`
      ALTER TABLE dbo.CustomerAddresses ADD GSTIN NVARCHAR(15) NULL;
    `);
    console.log('Added GSTIN to CustomerAddresses successfully.');
  } else {
    console.log('CustomerAddresses.GSTIN already exists.');
  }

  // 2. Orders.BuyerGSTIN and Orders.BuyerBusinessName
  const orderCols = await pool.request().query<{ COLUMN_NAME: string }>(`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'Orders' AND COLUMN_NAME IN ('BuyerGSTIN', 'BuyerBusinessName')
  `);
  const existingOrderCols = orderCols.recordset.map(r => r.COLUMN_NAME);

  if (!existingOrderCols.includes('BuyerGSTIN')) {
    console.log('Adding BuyerGSTIN column to Orders...');
    await pool.request().query(`
      ALTER TABLE dbo.Orders ADD BuyerGSTIN NVARCHAR(15) NULL;
    `);
    console.log('Added BuyerGSTIN to Orders.');
  } else {
    console.log('Orders.BuyerGSTIN already exists.');
  }

  if (!existingOrderCols.includes('BuyerBusinessName')) {
    console.log('Adding BuyerBusinessName column to Orders...');
    await pool.request().query(`
      ALTER TABLE dbo.Orders ADD BuyerBusinessName NVARCHAR(255) NULL;
    `);
    console.log('Added BuyerBusinessName to Orders.');
  } else {
    console.log('Orders.BuyerBusinessName already exists.');
  }

  // 3. Inspect pincode_lookup and state_master
  const geoCols = await pool.request().query<{ TABLE_NAME: string; COLUMN_NAME: string; DATA_TYPE: string }>(`
    SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME IN ('pincode_lookup', 'state_master', 'PincodeLookups')
    ORDER BY TABLE_NAME, ORDINAL_POSITION
  `);
  console.log('Geo Tables Schema:');
  geoCols.recordset.forEach(c => console.log(`  ${c.TABLE_NAME}.${c.COLUMN_NAME} (${c.DATA_TYPE})`));

  // 4. Test query joining pincode_lookup and state_master
  const samplePincode = await pool.request().query(`
    SELECT TOP 3 p.pincode, p.city_name, p.state_name, p.state_id, sm.state_code, sm.gst_state_code
    FROM dbo.pincode_lookup p
    LEFT JOIN dbo.state_master sm ON p.state_id = sm.state_id
    WHERE p.pincode IS NOT NULL
  `);
  console.log('Sample joined pincode lookup:', samplePincode.recordset);

  await closePool();
  console.log('Migration and verification completed successfully.');
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
