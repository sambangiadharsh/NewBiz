import { getPool, closePool } from '../database/db.js';

async function run() {
  const pool = await getPool();
  console.log('=== Starting Address Snapshot & GST Migration ===');

  // 1. CustomerAddresses: Add GSTIN
  console.log('\n1. Checking dbo.CustomerAddresses...');
  const addrGstCol = await pool.request().query<{ COLUMN_NAME: string }>(`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'CustomerAddresses' AND COLUMN_NAME = 'GSTIN'
  `);
  if (addrGstCol.recordset.length === 0) {
    console.log('Adding GSTIN column to dbo.CustomerAddresses...');
    await pool.request().query(`
      ALTER TABLE dbo.CustomerAddresses ADD GSTIN NVARCHAR(15) NULL;
    `);
    console.log('+ Added GSTIN to dbo.CustomerAddresses');
  } else {
    console.log('~ dbo.CustomerAddresses.GSTIN already exists');
  }

  // 2. Orders: Add Snapshot Columns
  console.log('\n2. Checking dbo.Orders snapshot columns...');
  const orderColsRes = await pool.request().query<{ COLUMN_NAME: string }>(`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'Orders'
  `);
  const existingOrderCols = new Set(orderColsRes.recordset.map(r => r.COLUMN_NAME));

  const columnsToAdd = [
    { name: 'ShippingRecipientName', type: 'NVARCHAR(200) NULL' },
    { name: 'ShippingPhoneNumber', type: 'NVARCHAR(20) NULL' },
    { name: 'ShippingAddressLine1', type: 'NVARCHAR(255) NULL' },
    { name: 'ShippingAddressLine2', type: 'NVARCHAR(255) NULL' },
    { name: 'ShippingCity', type: 'NVARCHAR(100) NULL' },
    { name: 'ShippingState', type: 'NVARCHAR(100) NULL' },
    { name: 'ShippingPostalCode', type: 'NVARCHAR(20) NULL' },
    { name: 'ShippingCountry', type: 'NVARCHAR(100) NULL' },
    { name: 'BillingRecipientName', type: 'NVARCHAR(200) NULL' },
    { name: 'BillingPhoneNumber', type: 'NVARCHAR(20) NULL' },
    { name: 'BillingAddressLine1', type: 'NVARCHAR(255) NULL' },
    { name: 'BillingAddressLine2', type: 'NVARCHAR(255) NULL' },
    { name: 'BillingCity', type: 'NVARCHAR(100) NULL' },
    { name: 'BillingState', type: 'NVARCHAR(100) NULL' },
    { name: 'BillingPostalCode', type: 'NVARCHAR(20) NULL' },
    { name: 'BillingCountry', type: 'NVARCHAR(100) NULL' },
    { name: 'InvoiceGSTIN', type: 'NVARCHAR(15) NULL' },
    { name: 'PlaceOfSupplyStateCode', type: 'NVARCHAR(2) NULL' }
  ];

  for (const col of columnsToAdd) {
    if (!existingOrderCols.has(col.name)) {
      console.log(`Adding ${col.name} to dbo.Orders...`);
      await pool.request().query(`ALTER TABLE dbo.Orders ADD [${col.name}] ${col.type};`);
      console.log(`+ Added ${col.name}`);
    } else {
      console.log(`~ ${col.name} already exists on dbo.Orders`);
    }
  }

  // 3. Backfill existing orders from CustomerAddresses if ShippingAddressID column still exists
  if (existingOrderCols.has('ShippingAddressID') || existingOrderCols.has('BillingAddressID')) {
    console.log('\n3. Backfilling historical orders with address snapshots...');
    await pool.request().query(`
      UPDATE o
      SET 
        o.ShippingRecipientName = COALESCE(o.ShippingRecipientName, sa.RecipientName, 'Valued Customer'),
        o.ShippingPhoneNumber = COALESCE(o.ShippingPhoneNumber, sa.PhoneNumber),
        o.ShippingAddressLine1 = COALESCE(o.ShippingAddressLine1, sa.AddressLine1, 'Main Street'),
        o.ShippingAddressLine2 = COALESCE(o.ShippingAddressLine2, sa.AddressLine2),
        o.ShippingCity = COALESCE(o.ShippingCity, sa.City, 'City'),
        o.ShippingState = COALESCE(o.ShippingState, sa.State, 'Andhra Pradesh'),
        o.ShippingPostalCode = COALESCE(o.ShippingPostalCode, sa.PostalCode, '500001'),
        o.ShippingCountry = COALESCE(o.ShippingCountry, sa.Country, 'India'),
        o.BillingRecipientName = COALESCE(o.BillingRecipientName, ba.RecipientName, sa.RecipientName, 'Valued Customer'),
        o.BillingPhoneNumber = COALESCE(o.BillingPhoneNumber, ba.PhoneNumber, sa.PhoneNumber),
        o.BillingAddressLine1 = COALESCE(o.BillingAddressLine1, ba.AddressLine1, sa.AddressLine1, 'Main Street'),
        o.BillingAddressLine2 = COALESCE(o.BillingAddressLine2, ba.AddressLine2, sa.AddressLine2),
        o.BillingCity = COALESCE(o.BillingCity, ba.City, sa.City, 'City'),
        o.BillingState = COALESCE(o.BillingState, ba.State, sa.State, 'Andhra Pradesh'),
        o.BillingPostalCode = COALESCE(o.BillingPostalCode, ba.PostalCode, sa.PostalCode, '500001'),
        o.BillingCountry = COALESCE(o.BillingCountry, ba.Country, sa.Country, 'India'),
        o.PlaceOfSupplyStateCode = COALESCE(o.PlaceOfSupplyStateCode, sm.gst_state_code, '37')
      FROM dbo.Orders o
      LEFT JOIN dbo.CustomerAddresses sa ON o.ShippingAddressID = sa.CustomerAddressID
      LEFT JOIN dbo.CustomerAddresses ba ON o.BillingAddressID = ba.CustomerAddressID
      LEFT JOIN dbo.state_master sm ON (
        LOWER(COALESCE(sa.State, 'Andhra Pradesh')) = LOWER(sm.state_name) 
        OR UPPER(COALESCE(sa.State, 'AP')) = sm.state_code
      )
      WHERE o.ShippingRecipientName IS NULL OR o.PlaceOfSupplyStateCode IS NULL;
    `);

    // Fallback for any rows that had null ShippingAddressID/orphaned addresses
    await pool.request().query(`
      UPDATE dbo.Orders
      SET
        ShippingRecipientName = COALESCE(ShippingRecipientName, 'Valued Customer'),
        ShippingAddressLine1 = COALESCE(ShippingAddressLine1, 'Main Street'),
        ShippingCity = COALESCE(ShippingCity, 'City'),
        ShippingState = COALESCE(ShippingState, 'Andhra Pradesh'),
        ShippingPostalCode = COALESCE(ShippingPostalCode, '500001'),
        ShippingCountry = COALESCE(ShippingCountry, 'India'),
        BillingRecipientName = COALESCE(BillingRecipientName, 'Valued Customer'),
        BillingAddressLine1 = COALESCE(BillingAddressLine1, 'Main Street'),
        BillingCity = COALESCE(BillingCity, 'City'),
        BillingState = COALESCE(BillingState, 'Andhra Pradesh'),
        BillingPostalCode = COALESCE(BillingPostalCode, '500001'),
        BillingCountry = COALESCE(BillingCountry, 'India'),
        PlaceOfSupplyStateCode = COALESCE(PlaceOfSupplyStateCode, '37')
      WHERE ShippingRecipientName IS NULL OR BillingRecipientName IS NULL OR PlaceOfSupplyStateCode IS NULL;
    `);

    console.log('+ Backfilled historical orders successfully.');

    // 4. Drop FK constraints referencing ShippingAddressID or BillingAddressID on Orders
    console.log('\n4. Checking & dropping foreign keys on Orders.ShippingAddressID/BillingAddressID...');
    const fkRes = await pool.request().query<{ CONSTRAINT_NAME: string; COLUMN_NAME: string }>(`
      SELECT 
        rc.CONSTRAINT_NAME,
        kcu.COLUMN_NAME
      FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
      JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu 
        ON rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
      WHERE kcu.TABLE_NAME = 'Orders' 
        AND kcu.COLUMN_NAME IN ('ShippingAddressID', 'BillingAddressID')
    `);

    for (const fk of fkRes.recordset) {
      console.log(`Dropping FK constraint ${fk.CONSTRAINT_NAME}...`);
      await pool.request().query(`ALTER TABLE dbo.Orders DROP CONSTRAINT [${fk.CONSTRAINT_NAME}];`);
      console.log(`+ Dropped FK constraint ${fk.CONSTRAINT_NAME}`);
    }

    // Also drop any default constraints or indexes on those columns if any
    const dfRes = await pool.request().query<{ DEFAULT_NAME: string; COLUMN_NAME: string }>(`
      SELECT d.name AS DEFAULT_NAME, c.name AS COLUMN_NAME
      FROM sys.default_constraints d
      JOIN sys.columns c ON d.parent_object_id = c.object_id AND d.parent_column_id = c.column_id
      WHERE d.parent_object_id = OBJECT_ID('dbo.Orders')
        AND c.name IN ('ShippingAddressID', 'BillingAddressID')
    `);
    for (const df of dfRes.recordset) {
      console.log(`Dropping default constraint ${df.DEFAULT_NAME}...`);
      await pool.request().query(`ALTER TABLE dbo.Orders DROP CONSTRAINT [${df.DEFAULT_NAME}];`);
    }

    // Now drop the columns
    if (existingOrderCols.has('ShippingAddressID')) {
      console.log('Dropping ShippingAddressID column from dbo.Orders...');
      await pool.request().query(`ALTER TABLE dbo.Orders DROP COLUMN [ShippingAddressID];`);
      console.log('+ Dropped ShippingAddressID');
    }
    if (existingOrderCols.has('BillingAddressID')) {
      console.log('Dropping BillingAddressID column from dbo.Orders...');
      await pool.request().query(`ALTER TABLE dbo.Orders DROP COLUMN [BillingAddressID];`);
      console.log('+ Dropped BillingAddressID');
    }
  }

  // Enforce NOT NULL on mandatory snapshot columns
  console.log('\nEnforcing NOT NULL on mandatory snapshot columns...');
  await pool.request().query(`
    ALTER TABLE dbo.Orders ALTER COLUMN ShippingRecipientName NVARCHAR(200) NOT NULL;
    ALTER TABLE dbo.Orders ALTER COLUMN ShippingAddressLine1 NVARCHAR(255) NOT NULL;
    ALTER TABLE dbo.Orders ALTER COLUMN ShippingCity NVARCHAR(100) NOT NULL;
    ALTER TABLE dbo.Orders ALTER COLUMN ShippingState NVARCHAR(100) NOT NULL;
    ALTER TABLE dbo.Orders ALTER COLUMN ShippingPostalCode NVARCHAR(20) NOT NULL;
    ALTER TABLE dbo.Orders ALTER COLUMN ShippingCountry NVARCHAR(100) NOT NULL;

    ALTER TABLE dbo.Orders ALTER COLUMN BillingRecipientName NVARCHAR(200) NOT NULL;
    ALTER TABLE dbo.Orders ALTER COLUMN BillingAddressLine1 NVARCHAR(255) NOT NULL;
    ALTER TABLE dbo.Orders ALTER COLUMN BillingCity NVARCHAR(100) NOT NULL;
    ALTER TABLE dbo.Orders ALTER COLUMN BillingState NVARCHAR(100) NOT NULL;
    ALTER TABLE dbo.Orders ALTER COLUMN BillingPostalCode NVARCHAR(20) NOT NULL;
    ALTER TABLE dbo.Orders ALTER COLUMN BillingCountry NVARCHAR(100) NOT NULL;

    ALTER TABLE dbo.Orders ALTER COLUMN PlaceOfSupplyStateCode NVARCHAR(2) NOT NULL;
  `);
  console.log('+ Snapshot columns set to NOT NULL.');

  // 5. Invoices: Drop redundant billing columns
  console.log('\n5. Checking dbo.Invoices redundant billing columns...');
  const invColsRes = await pool.request().query<{ COLUMN_NAME: string }>(`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'Invoices'
  `);
  const existingInvCols = new Set(invColsRes.recordset.map(r => r.COLUMN_NAME));

  const invBillingCols = [
    'BillingName',
    'BillingAddressLine1',
    'BillingAddressLine2',
    'BillingCity',
    'BillingState',
    'BillingPostalCode',
    'BillingCountry'
  ];

  for (const col of invBillingCols) {
    if (existingInvCols.has(col)) {
      // Check for default constraints
      const dfInvRes = await pool.request().query<{ DEFAULT_NAME: string }>(`
        SELECT d.name AS DEFAULT_NAME
        FROM sys.default_constraints d
        JOIN sys.columns c ON d.parent_object_id = c.object_id AND d.parent_column_id = c.column_id
        WHERE d.parent_object_id = OBJECT_ID('dbo.Invoices') AND c.name = '${col}'
      `);
      for (const df of dfInvRes.recordset) {
        await pool.request().query(`ALTER TABLE dbo.Invoices DROP CONSTRAINT [${df.DEFAULT_NAME}];`);
      }
      console.log(`Dropping ${col} from dbo.Invoices...`);
      await pool.request().query(`ALTER TABLE dbo.Invoices DROP COLUMN [${col}];`);
      console.log(`+ Dropped ${col}`);
    } else {
      console.log(`~ ${col} does not exist on dbo.Invoices`);
    }
  }

  await closePool();
  console.log('\n=== Address Snapshot & GST Migration Completed Successfully! ===');
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
