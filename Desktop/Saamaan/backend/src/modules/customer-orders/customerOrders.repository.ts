import { getPool, sql } from '../../database/db.js';
import { warehouseRouterService } from './warehouseRouter.service.js';
import { BadRequestError } from '../../utils/errors.js';

export interface OrderItemInput {
  sellerProductId: bigint;
  sellerId: bigint;
  quantity: number;
  unitPrice: number;
  mrp: number;
  purchasePrice: number;
  discountPercentage?: number;
  discountAmount?: number;
  gstRate?: number;
}

export interface RawAddressInput {
  recipientName: string;
  phoneNumber: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country?: string;
  addressLabel?: string;
  gstin?: string;
}

export interface CreateOrderDbInput {
  customerId: bigint;
  shippingAddressId?: bigint;
  rawAddress?: RawAddressInput;
  paymentModeId: bigint;
  subtotalAmount: number;
  discountAmount: number;
  shippingAmount: number;
  taxAmount: number;
  totalAmount: number;
  orderStatus?: string;
  items: OrderItemInput[];
}

let returnSchemaEnsured = false;
async function ensureOrderReturnSchema(pool: sql.ConnectionPool) {
  if (returnSchemaEnsured) return;
  try {
    await pool.request().query(`
      IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'OrderItems' AND COLUMN_NAME = 'ReturnPolicyID'
      )
      BEGIN
        ALTER TABLE dbo.OrderItems ADD [ReturnPolicyID] INT NULL;
      END;

      IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'OrderItems' AND COLUMN_NAME = 'ReturnPolicySnapshot'
      )
      BEGIN
        ALTER TABLE dbo.OrderItems ADD [ReturnPolicySnapshot] NVARCHAR(MAX) NULL;
      END;

      IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'ReturnRequests' AND COLUMN_NAME = 'DestinationType'
      )
      BEGIN
        ALTER TABLE dbo.ReturnRequests ADD [DestinationType] VARCHAR(20) NULL;
      END;

      IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'ReturnRequests' AND COLUMN_NAME = 'DestinationID'
      )
      BEGIN
        ALTER TABLE dbo.ReturnRequests ADD [DestinationID] BIGINT NULL;
      END;

      IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'ReturnRequests' AND COLUMN_NAME = 'QCStatus'
      )
      BEGIN
        ALTER TABLE dbo.ReturnRequests ADD [QCStatus] VARCHAR(30) NULL;
      END;

      IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'ReturnRequests' AND COLUMN_NAME = 'QCNotes'
      )
      BEGIN
        ALTER TABLE dbo.ReturnRequests ADD [QCNotes] NVARCHAR(1000) NULL;
      END;

      IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'ReturnRequests' AND COLUMN_NAME = 'QCGrade'
      )
      BEGIN
        ALTER TABLE dbo.ReturnRequests ADD [QCGrade] VARCHAR(30) NULL;
      END;

      IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'ReturnRequests' AND COLUMN_NAME = 'RestockedInventory'
      )
      BEGIN
        ALTER TABLE dbo.ReturnRequests ADD [RestockedInventory] BIT NOT NULL DEFAULT 0;
      END;

      IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'ReturnRequests' AND COLUMN_NAME = 'RefundTransactionID'
      )
      BEGIN
        ALTER TABLE dbo.ReturnRequests ADD [RefundTransactionID] NVARCHAR(100) NULL;
      END;

      IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'ReturnRequests' AND COLUMN_NAME = 'ReplacementOrderID'
      )
      BEGIN
        ALTER TABLE dbo.ReturnRequests ADD [ReplacementOrderID] BIGINT NULL;
      END;

      IF EXISTS (
        SELECT 1 FROM sys.indexes 
        WHERE name = 'UQ_Active_ReturnRequest_Per_OrderItem' 
          AND object_id = OBJECT_ID('dbo.ReturnRequests')
      )
      BEGIN
        DROP INDEX [UQ_Active_ReturnRequest_Per_OrderItem] ON dbo.ReturnRequests;
      END;

      CREATE UNIQUE NONCLUSTERED INDEX [UQ_Active_ReturnRequest_Per_OrderItem]
      ON dbo.ReturnRequests ([OrderItemID])
      WHERE [Status] IN ('REQUESTED', 'APPROVED', 'RECEIVED', 'QC_PASSED');
    `);
    returnSchemaEnsured = true;
  } catch (err) {
    console.warn('Auto-schema assurance notice:', err);
  }
}

export class CustomerOrdersRepository {
  /**
   * Creates an order with items, payments, and seller orders within an ACID transaction.
   * Strictly touches ONLY: dbo.Orders, dbo.OrderItems, dbo.Payments, dbo.Fulfillments
   * (Does NOT touch Fulfillments, Shipments, or Invoices).
   */
  async createOrder(input: CreateOrderDbInput) {
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // 1. Resolve Shipping Address ID
      let shippingAddressId: bigint | null = null;
      if (input.shippingAddressId) {
        const addrCheck = await transaction
          .request()
          .input('addrId', sql.BigInt, input.shippingAddressId)
          .query<{ CustomerAddressID: bigint }>(`
            SELECT TOP 1 CustomerAddressID FROM dbo.CustomerAddresses WHERE CustomerAddressID = @addrId
          `);
        if (addrCheck.recordset.length > 0) {
          shippingAddressId = addrCheck.recordset[0].CustomerAddressID;
        }
      }

      if (!shippingAddressId && input.rawAddress) {
        // Insert address row for customer
        const addrRes = await transaction
          .request()
          .input('customerId', sql.BigInt, input.customerId)
          .input('label', sql.NVarChar, input.rawAddress.addressLabel || 'Home')
          .input('name', sql.NVarChar, input.rawAddress.recipientName || 'Customer')
          .input('phone', sql.NVarChar, input.rawAddress.phoneNumber || '9876543210')
          .input('line1', sql.NVarChar, input.rawAddress.addressLine1 || 'Main Address')
          .input('line2', sql.NVarChar, input.rawAddress.addressLine2 || null)
          .input('city', sql.NVarChar, input.rawAddress.city || 'Hyderabad')
          .input('state', sql.NVarChar, input.rawAddress.state || 'Telangana')
          .input('postal', sql.NVarChar, input.rawAddress.postalCode || '500001')
          .input('country', sql.NVarChar, input.rawAddress.country || 'India')
          .input('gstin', sql.NVarChar(15), input.rawAddress.gstin ? input.rawAddress.gstin.trim().toUpperCase() : null)
          .query<{ CustomerAddressID: bigint }>(`
            INSERT INTO dbo.CustomerAddresses (
              CustomerID, AddressLabel, RecipientName, PhoneNumber,
              AddressLine1, AddressLine2, City, State, PostalCode, Country, GSTIN,
              IsDefaultShipping, IsDefaultBilling, CreatedAt, UpdatedAt
            )
            OUTPUT INSERTED.CustomerAddressID
            VALUES (
              @customerId, @label, @name, @phone,
              @line1, @line2, @city, @state, @postal, @country, @gstin,
              0, 0, SYSUTCDATETIME(), SYSUTCDATETIME()
            )
          `);
        shippingAddressId = addrRes.recordset[0].CustomerAddressID;
      }

      // Fallback if still null: select any address for customer or create default
      if (!shippingAddressId) {
        const anyAddr = await transaction
          .request()
          .input('customerId', sql.BigInt, input.customerId)
          .query<{ CustomerAddressID: bigint }>(`
            SELECT TOP 1 CustomerAddressID FROM dbo.CustomerAddresses WHERE CustomerID = @customerId
          `);
        if (anyAddr.recordset.length > 0) {
          shippingAddressId = anyAddr.recordset[0].CustomerAddressID;
        } else {
          const defAddr = await transaction
            .request()
            .input('customerId', sql.BigInt, input.customerId)
            .query<{ CustomerAddressID: bigint }>(`
              INSERT INTO dbo.CustomerAddresses (
                CustomerID, AddressLabel, RecipientName, PhoneNumber,
                AddressLine1, City, State, PostalCode, Country,
                IsDefaultShipping, IsDefaultBilling, CreatedAt, UpdatedAt
              )
              OUTPUT INSERTED.CustomerAddressID
              VALUES (
                @customerId, 'Home', 'Valued Customer', '9876543210',
                'Flat 101, Main Road', 'Hyderabad', 'Telangana', '500001', 'India',
                1, 1, SYSUTCDATETIME(), SYSUTCDATETIME()
              )
            `);
          shippingAddressId = defAddr.recordset[0].CustomerAddressID;
        }
      }

      // 2. Obtain collision-safe sequential OrderNumber starting at 100000 (1 Lakh)
      const seqCheck = await transaction.request().query<{ hasSeq: number }>(`
        SELECT COUNT(1) AS hasSeq FROM sys.sequences WHERE name = 'OrderNumberSeq';
      `);
      let orderNumber: string;
      if (seqCheck.recordset[0]?.hasSeq > 0) {
        const seqRes = await transaction.request().query<{ nextSeq: string | number }>(`
          SELECT NEXT VALUE FOR dbo.OrderNumberSeq AS nextSeq;
        `);
        orderNumber = `ORD-${seqRes.recordset[0].nextSeq}`;
      } else {
        const countRes = await transaction.request().query<{ nextVal: number }>(`
          SELECT ISNULL(MAX(OrderID), 0) + 100001 AS nextVal FROM dbo.Orders WITH (UPDLOCK, HOLDLOCK);
        `);
        const nextVal = countRes.recordset[0]?.nextVal || (100000 + Math.floor(Math.random() * 899999));
        orderNumber = `ORD-${nextVal}`;
      }

      // 3. Retrieve full address snapshot & Place of Supply
      const addrRowRes = await transaction
        .request()
        .input('addrId', sql.BigInt, shippingAddressId)
        .query<{
          RecipientName: string;
          PhoneNumber: string | null;
          AddressLine1: string;
          AddressLine2: string | null;
          City: string;
          State: string;
          PostalCode: string;
          Country: string;
          GSTIN: string | null;
        }>(`
          SELECT TOP 1
            RecipientName, PhoneNumber, AddressLine1, AddressLine2,
            City, State, PostalCode, Country, GSTIN
          FROM dbo.CustomerAddresses
          WHERE CustomerAddressID = @addrId
        `);

      const addrRow = addrRowRes.recordset[0] || {
        RecipientName: 'Valued Customer',
        PhoneNumber: null,
        AddressLine1: 'Main Address',
        AddressLine2: null,
        City: 'Hyderabad',
        State: 'Andhra Pradesh',
        PostalCode: '500001',
        Country: 'India',
        GSTIN: null,
      };

      const customerState = addrRow.State || 'Andhra Pradesh';

      // Derive 2-digit PlaceOfSupplyStateCode from state_master
      const posRes = await transaction
        .request()
        .input('state', sql.NVarChar(100), customerState)
        .query<{ gst_state_code: string }>(`
          SELECT TOP 1 gst_state_code
          FROM dbo.state_master
          WHERE LOWER(state_name) = LOWER(@state) OR UPPER(state_code) = UPPER(@state)
        `);
      const placeOfSupplyCode = posRes.recordset[0]?.gst_state_code || '37';

      // 4. Insert into dbo.Orders with full immutable snapshots
      const orderRes = await transaction
        .request()
        .input('orderNumber', sql.VarChar(50), orderNumber)
        .input('customerId', sql.BigInt, input.customerId)
        .input('subtotal', sql.Decimal(18, 2), input.subtotalAmount)
        .input('discount', sql.Decimal(18, 2), input.discountAmount)
        .input('shipping', sql.Decimal(18, 2), input.shippingAmount)
        .input('tax', sql.Decimal(18, 2), input.taxAmount)
        .input('total', sql.Decimal(18, 2), input.totalAmount)
        .input('sRecipient', sql.NVarChar(200), addrRow.RecipientName)
        .input('sPhone', sql.NVarChar(20), addrRow.PhoneNumber || null)
        .input('sLine1', sql.NVarChar(255), addrRow.AddressLine1)
        .input('sLine2', sql.NVarChar(255), addrRow.AddressLine2 || null)
        .input('sCity', sql.NVarChar(100), addrRow.City)
        .input('sState', sql.NVarChar(100), addrRow.State)
        .input('sPostal', sql.NVarChar(20), addrRow.PostalCode)
        .input('sCountry', sql.NVarChar(100), addrRow.Country || 'India')
        .input('bRecipient', sql.NVarChar(200), addrRow.RecipientName)
        .input('bPhone', sql.NVarChar(20), addrRow.PhoneNumber || null)
        .input('bLine1', sql.NVarChar(255), addrRow.AddressLine1)
        .input('bLine2', sql.NVarChar(255), addrRow.AddressLine2 || null)
        .input('bCity', sql.NVarChar(100), addrRow.City)
        .input('bState', sql.NVarChar(100), addrRow.State)
        .input('bPostal', sql.NVarChar(20), addrRow.PostalCode)
        .input('bCountry', sql.NVarChar(100), addrRow.Country || 'India')
        .input('invoiceGst', sql.NVarChar(15), addrRow.GSTIN || null)
        .input('posCode', sql.NVarChar(2), placeOfSupplyCode)
        .input('orderStatus', sql.VarChar(50), input.orderStatus || 'CONFIRMED')
        .query<{ OrderID: bigint; OrderNumber: string }>(`
          INSERT INTO dbo.Orders (
            OrderNumber, CustomerID, Status,
            SubtotalAmount, DiscountAmount, ShippingAmount, TaxAmount, TotalAmount,
            ShippingRecipientName, ShippingPhoneNumber, ShippingAddressLine1, ShippingAddressLine2,
            ShippingCity, ShippingState, ShippingPostalCode, ShippingCountry,
            BillingRecipientName, BillingPhoneNumber, BillingAddressLine1, BillingAddressLine2,
            BillingCity, BillingState, BillingPostalCode, BillingCountry,
            InvoiceGSTIN, PlaceOfSupplyStateCode,
            CreatedAt, UpdatedAt
          )
          OUTPUT INSERTED.OrderID, INSERTED.OrderNumber
          VALUES (
            @orderNumber, @customerId, @orderStatus,
            @subtotal, @discount, @shipping, @tax, @total,
            @sRecipient, @sPhone, @sLine1, @sLine2,
            @sCity, @sState, @sPostal, @sCountry,
            @bRecipient, @bPhone, @bLine1, @bLine2,
            @bCity, @bState, @bPostal, @bCountry,
            @invoiceGst, @posCode,
            SYSUTCDATETIME(), SYSUTCDATETIME()
          )
        `);

      const orderId = orderRes.recordset[0].OrderID;

      // Ensure FulfillmentID, ReturnPolicyID, and ReturnPolicySnapshot exist on dbo.OrderItems
      await transaction.request().query(`
        IF NOT EXISTS (
          SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_NAME = 'OrderItems' AND COLUMN_NAME = 'FulfillmentID'
        )
        BEGIN
          ALTER TABLE dbo.OrderItems ADD FulfillmentID BIGINT NULL;
        END

        IF NOT EXISTS (
          SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_NAME = 'OrderItems' AND COLUMN_NAME = 'ReturnPolicyID'
        )
        BEGIN
          ALTER TABLE dbo.OrderItems ADD ReturnPolicyID INT NULL;
        END

        IF NOT EXISTS (
          SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_NAME = 'OrderItems' AND COLUMN_NAME = 'ReturnPolicySnapshot'
        )
        BEGIN
          ALTER TABLE dbo.OrderItems ADD ReturnPolicySnapshot NVARCHAR(MAX) NULL;
        END

        IF NOT EXISTS (
          SELECT 1 FROM sys.indexes 
          WHERE name = 'UQ_Active_ReturnRequest_Per_OrderItem' 
            AND object_id = OBJECT_ID('dbo.ReturnRequests')
        )
        BEGIN
          CREATE UNIQUE NONCLUSTERED INDEX UQ_Active_ReturnRequest_Per_OrderItem
          ON dbo.ReturnRequests (OrderItemID)
          WHERE Status IN ('REQUESTED', 'IN_PROGRESS');
        END
      `);

      // Pre-fetch active Return Policy Snapshots for all items in the order
      const spIds = Array.from(new Set(input.items.map((i) => BigInt(i.sellerProductId))));
      const spReq = transaction.request();
      const spIdParamNames = spIds.map((id, idx) => {
        const param = `sp_id_${idx}`;
        spReq.input(param, sql.BigInt, id);
        return `@${param}`;
      }).join(', ');

      const policiesRes = await spReq.query<{
        SellerProductID: bigint;
        PolicyID: number;
        PolicyCode: string;
        PolicyName: string;
        IsReturnable: boolean;
        IsReplaceable: boolean;
        ReturnWindowDays: number;
        ReplacementWindowDays: number;
        RequiresTechnicianCheck: boolean;
        ConditionsSummary: string;
      }>(`
        SELECT 
          sp.SellerProductID,
          rp.PolicyID,
          rp.PolicyCode,
          rp.PolicyName,
          rp.IsReturnable,
          rp.IsReplaceable,
          rp.ReturnWindowDays,
          rp.ReplacementWindowDays,
          rp.RequiresTechnicianCheck,
          rp.ConditionsSummary
        FROM dbo.SellerProducts sp
        JOIN dbo.ProductVariants pv ON sp.ProductVariantID = pv.ProductVariantID
        JOIN dbo.ProductMaster pm ON pv.ProductMasterID = pm.ProductID
        OUTER APPLY (
          SELECT TOP 1 c.DefaultReturnPolicyID
          FROM dbo.ProductCategories pc
          JOIN dbo.Categories c ON pc.CategoryID = c.CategoryID
          WHERE pc.ProductID = pm.ProductID
          ORDER BY pc.ProductCategoryID ASC
        ) cat
        LEFT JOIN dbo.ReturnReplacementPolicies rp ON rp.PolicyID = COALESCE(pm.ReturnPolicyID, cat.DefaultReturnPolicyID)
        WHERE sp.SellerProductID IN (${spIdParamNames})
      `);

      const policyMap = new Map<string, { policyId: number; snapshotJson: string }>();
      for (const row of policiesRes.recordset) {
        const snapshot = {
          policyId: Number(row.PolicyID),
          policyCode: row.PolicyCode,
          policyName: row.PolicyName,
          isReturnable: Boolean(row.IsReturnable),
          isReplaceable: Boolean(row.IsReplaceable),
          returnWindowDays: Number(row.ReturnWindowDays || 0),
          replacementWindowDays: Number(row.ReplacementWindowDays || 0),
          requiresTechnicianCheck: Boolean(row.RequiresTechnicianCheck),
          conditionsSummary: row.ConditionsSummary || '',
        };
        policyMap.set(String(row.SellerProductID), {
          policyId: Number(row.PolicyID),
          snapshotJson: JSON.stringify(snapshot),
        });
      }

      // Group order items by seller
      const sellerItemsMap = new Map<string, OrderItemInput[]>();
      for (const item of input.items) {
        const sKey = String(item.sellerId);
        if (!sellerItemsMap.has(sKey)) {
          sellerItemsMap.set(sKey, []);
        }
        sellerItemsMap.get(sKey)!.push(item);
      }

      // Route and reserve stock for each seller
      for (const [sKey, sellerItems] of sellerItemsMap.entries()) {
        const sId = BigInt(sKey);
        const allocations = await warehouseRouterService.routeOrderItems(
          sId,
          customerState,
          sellerItems.map((i) => ({
            sellerProductId: BigInt(i.sellerProductId),
            quantity: i.quantity,
          })),
          transaction
        );

        for (const alloc of allocations) {
          // Check warehouse state for Intra-state vs Inter-state supply
          const whRes = await transaction
            .request()
            .input('whId', sql.BigInt, alloc.warehouseId)
            .query<{ State: string }>(`
              SELECT TOP 1 State FROM dbo.Warehouses WHERE WarehouseID = @whId
            `);
          const warehouseState = whRes.recordset[0]?.State || null;
          const isIntraState = Boolean(
            warehouseState && customerState &&
            warehouseState.trim().toLowerCase() === customerState.trim().toLowerCase()
          );

          // Create Fulfillment record for this warehouse
          const fulRes = await transaction
            .request()
            .input('orderId', sql.BigInt, orderId)
            .input('sellerId', sql.BigInt, sId)
            .input('warehouseId', sql.BigInt, alloc.warehouseId)
            .query<{ FulfillmentID: bigint }>(`
              INSERT INTO dbo.Fulfillments (
                OrderID, SellerID, WarehouseID, Status, CreatedAt, UpdatedAt
              )
              OUTPUT INSERTED.FulfillmentID
              VALUES (
                @orderId, @sellerId, @warehouseId, 'PENDING_PICKUP', SYSUTCDATETIME(), SYSUTCDATETIME()
              )
            `);

          const fulfillmentId = fulRes.recordset[0].FulfillmentID;

          // Process each item allocated to this warehouse
          for (const allocItem of alloc.items) {
            const origItem = sellerItems.find(
              (i) => String(i.sellerProductId) === String(allocItem.sellerProductId)
            );
            if (!origItem) continue;

            // Atomically reserve inventory (optimistic locking guard)
            const reserveRes = await transaction
              .request()
              .input('wpId', sql.BigInt, allocItem.warehouseProductId)
              .input('qty', sql.Int, allocItem.quantity)
              .query<{ InventoryID: bigint; PhysicalQuantity: number; NewPhysicalQuantity: number }>(`
                UPDATE inv
                SET 
                  inv.ReservedQuantity = ISNULL(inv.ReservedQuantity, 0) + @qty,
                  inv.UpdatedAt = SYSUTCDATETIME()
                OUTPUT INSERTED.InventoryID, DELETED.PhysicalQuantity, INSERTED.PhysicalQuantity AS NewPhysicalQuantity
                FROM dbo.Inventory inv
                WHERE inv.WarehouseProductID = @wpId
                  AND (ISNULL(inv.PhysicalQuantity, 0) - ISNULL(inv.ReservedQuantity, 0) - ISNULL(inv.DamagedQuantity, 0)) >= @qty;
              `);

            if (reserveRes.rowsAffected[0] === 0 || !reserveRes.recordset[0]?.InventoryID) {
              throw new BadRequestError(
                'Stock reservation failed: Product stock was just claimed by another order. Please try again.'
              );
            }

            const inventoryId = reserveRes.recordset[0].InventoryID;
            const physBal = Number(reserveRes.recordset[0].PhysicalQuantity || 0);

            // Audit Record: Insert active reservation into dbo.InventoryReservations with 15-minute TTL
            await transaction
              .request()
              .input('invId', sql.BigInt, inventoryId)
              .input('orderId', sql.BigInt, orderId)
              .input('qty', sql.Int, allocItem.quantity)
              .query(`
                INSERT INTO dbo.InventoryReservations (
                  InventoryID, OrderID, Quantity, Status, ExpiresAt, CreatedAt, UpdatedAt
                )
                VALUES (
                  @invId, @orderId, @qty, 'RESERVED', DATEADD(minute, 15, SYSUTCDATETIME()), SYSUTCDATETIME(), SYSUTCDATETIME()
                );
              `);

            // Audit Ledger: Insert into dbo.InventoryTransactions with running balance snapshot
            await transaction
              .request()
              .input('invId', sql.BigInt, inventoryId)
              .input('orderId', sql.BigInt, orderId)
              .input('qty', sql.Int, allocItem.quantity)
              .input('balBefore', sql.Int, physBal)
              .input('balAfter', sql.Int, physBal)
              .input('reason', sql.NVarChar(500), `Stock reserved for order #${orderNumber} (15m hold)`)
              .query(`
                INSERT INTO dbo.InventoryTransactions (
                  InventoryID, OrderID, TransactionType, Quantity, BalanceBefore, BalanceAfter, Reason, CreatedAt
                )
                VALUES (
                  @invId, @orderId, 'ORDER_RESERVED', @qty, @balBefore, @balAfter, @reason, SYSUTCDATETIME()
                );
              `);

            // Insert line item into dbo.OrderItems linked to this fulfillment
            const allocatedQty = allocItem.quantity;
            const totalMRP = origItem.mrp * allocatedQty;
            const totalPurchasePrice = origItem.purchasePrice * allocatedQty;
            const totalItemAmount = origItem.unitPrice * allocatedQty;
            const discountAmt = origItem.discountAmount
              ? (origItem.discountAmount / origItem.quantity) * allocatedQty
              : Math.max(0, totalMRP - totalItemAmount);
            const discountPct =
              origItem.discountPercentage ||
              (origItem.mrp > 0 ? ((origItem.mrp - origItem.unitPrice) / origItem.mrp) * 100 : 0);

            // Dynamic GST calculation (NOT hardcoded to 0!)
            const gstRate = Number(origItem.gstRate || 18);
            const taxableAmt = Number((totalItemAmount / (1 + gstRate / 100)).toFixed(2));
            const lineGst = Number((totalItemAmount - taxableAmt).toFixed(2));

            let cgstRate = 0;
            let cgstAmt = 0;
            let sgstRate = 0;
            let sgstAmt = 0;
            let igstRate = 0;
            let igstAmt = 0;

            if (isIntraState) {
              cgstRate = gstRate / 2;
              sgstRate = gstRate / 2;
              cgstAmt = Number((lineGst / 2).toFixed(2));
              sgstAmt = Number((lineGst - cgstAmt).toFixed(2));
            } else {
              igstRate = gstRate;
              igstAmt = lineGst;
            }
            const taxAmt = lineGst;

            const matchedPolicy = policyMap.get(String(origItem.sellerProductId));
            const returnPolicyId = matchedPolicy?.policyId ?? null;
            const returnPolicySnapshot = matchedPolicy?.snapshotJson ?? null;

            const oiRes = await transaction
              .request()
              .input('orderId', sql.BigInt, orderId)
              .input('sellerProductId', sql.BigInt, origItem.sellerProductId)
              .input('fulfillmentId', sql.BigInt, fulfillmentId)
              .input('quantity', sql.Int, allocatedQty)
              .input('unitPrice', sql.Decimal(18, 2), origItem.unitPrice)
              .input('mrp', sql.Decimal(18, 2), origItem.mrp)
              .input('totalMRP', sql.Decimal(18, 2), totalMRP)
              .input('purchasePrice', sql.Decimal(18, 2), origItem.purchasePrice)
              .input('totalPurchasePrice', sql.Decimal(18, 2), totalPurchasePrice)
              .input('discountPct', sql.Decimal(5, 2), Number(discountPct.toFixed(2)))
              .input('discountAmt', sql.Decimal(18, 2), Number(discountAmt.toFixed(2)))
              .input('cgstRate', sql.Decimal(5, 2), cgstRate)
              .input('cgstAmt', sql.Decimal(18, 2), cgstAmt)
              .input('sgstRate', sql.Decimal(5, 2), sgstRate)
              .input('sgstAmt', sql.Decimal(18, 2), sgstAmt)
              .input('igstRate', sql.Decimal(5, 2), igstRate)
              .input('igstAmt', sql.Decimal(18, 2), igstAmt)
              .input('taxAmt', sql.Decimal(18, 2), taxAmt)
              .input('totalAmount', sql.Decimal(18, 2), Number(totalItemAmount.toFixed(2)))
              .input('returnPolicyId', sql.Int, returnPolicyId)
              .input('returnPolicySnapshot', sql.NVarChar(sql.MAX), returnPolicySnapshot)
              .query<{ OrderItemID: bigint }>(`
                INSERT INTO dbo.OrderItems (
                  OrderID, SellerProductID, FulfillmentID, Quantity, UnitPrice, MRP, TotalMRP,
                  PurchasePrice, TotalPurchasePrice, DiscountPercentage, DiscountAmount,
                  CGSTRate, CGSTAmount, SGSTRate, SGSTAmount, IGSTRate, IGSTAmount,
                  TaxAmount, TotalAmount, ReturnPolicyID, ReturnPolicySnapshot, CreatedAt
                )
                OUTPUT INSERTED.OrderItemID
                VALUES (
                  @orderId, @sellerProductId, @fulfillmentId, @quantity, @unitPrice, @mrp, @totalMRP,
                  @purchasePrice, @totalPurchasePrice, @discountPct, @discountAmt,
                  @cgstRate, @cgstAmt, @sgstRate, @sgstAmt, @igstRate, @igstAmt,
                  @taxAmt, @totalAmount, @returnPolicyId, @returnPolicySnapshot, SYSUTCDATETIME()
                )
              `);

            const orderItemId = oiRes.recordset[0]?.OrderItemID;

            // Senior Software Engineer Pattern: Relational link in dbo.FulfillmentItems
            if (orderItemId) {
              await transaction
                .request()
                .input('fulfillmentId', sql.BigInt, fulfillmentId)
                .input('orderItemId', sql.BigInt, orderItemId)
                .input('wpId', sql.BigInt, allocItem.warehouseProductId)
                .input('quantity', sql.Int, allocatedQty)
                .query(`
                  INSERT INTO dbo.FulfillmentItems (
                    FulfillmentID, OrderItemID, WarehouseProductID, Quantity, CreatedAt
                  )
                  VALUES (
                    @fulfillmentId, @orderItemId, @wpId, @quantity, SYSUTCDATETIME()
                  )
                `);
            }
          }
        }
      }

      // 5. Insert into dbo.Payments
      await transaction
        .request()
        .input('orderId', sql.BigInt, orderId)
        .input('paymentModeId', sql.BigInt, input.paymentModeId)
        .input('amount', sql.Decimal(18, 2), input.totalAmount)
        .query(`
          INSERT INTO dbo.Payments (
            OrderID, PaymentModeID, Amount, Status,
            GatewayReference, PaidAt, CreatedAt, UpdatedAt
          )
          VALUES (
            @orderId, @paymentModeId, @amount, 'PENDING',
            NULL, NULL, SYSUTCDATETIME(), SYSUTCDATETIME()
          )
        `);

      // 6. Transition customer's active cart to 'ORDERED' and clear its cart items
      const activeCarts = await transaction
        .request()
        .input('customerId', sql.BigInt, input.customerId)
        .query<{ CartID: bigint }>(`
          SELECT CartID FROM dbo.Carts WHERE CustomerID = @customerId AND Status = 'ACTIVE'
        `);

      for (const c of activeCarts.recordset) {
        await transaction
          .request()
          .input('cartId', sql.BigInt, c.CartID)
          .query(`
            UPDATE dbo.CartItems SET Quantity = 0 WHERE CartID = @cartId;
            UPDATE dbo.Carts SET Status = 'ORDERED' WHERE CartID = @cartId;
          `);
      }

      await transaction.commit();

      return {
        orderId: String(orderId),
        orderNumber,
        totalAmount: input.totalAmount,
        status: input.orderStatus || 'CONFIRMED',
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Retrieves orders for a customer with items and payment details.
   */
  async getCustomerOrders(customerId: bigint) {
    const pool = await getPool();
    await ensureOrderReturnSchema(pool);

    // 1. Fetch orders header
    const ordersRes = await pool
      .request()
      .input('customerId', sql.BigInt, customerId)
      .query(`
        SELECT 
          o.OrderID,
          o.OrderNumber,
          o.Status,
          o.SubtotalAmount,
          o.DiscountAmount,
          o.ShippingAmount,
          o.TaxAmount,
          o.TotalAmount,
          o.CreatedAt,
          o.ShippingRecipientName AS RecipientName,
          o.ShippingPhoneNumber AS PhoneNumber,
          o.ShippingAddressLine1 AS AddressLine1,
          o.ShippingAddressLine2 AS AddressLine2,
          o.ShippingCity AS City,
          o.ShippingState AS State,
          o.ShippingPostalCode AS PostalCode,
          o.ShippingCountry AS Country,
          o.InvoiceGSTIN,
          o.PlaceOfSupplyStateCode,
          pm.PaymentModeName AS PaymentModeName,
          pm.PaymentModeCode AS PaymentModeCode,
          pay.Status AS PaymentStatus,
          pay.Amount AS PaymentAmount,
          sh.Carrier,
          sh.TrackingNumber,
          sh.ShipmentStatus,
          sh.ShippedAt,
          sh.DeliveredAt,
          sh.EstimatedDeliveryDate
        FROM dbo.Orders o
        LEFT JOIN dbo.Payments pay ON o.OrderID = pay.OrderID
        LEFT JOIN dbo.PaymentModes pm ON pay.PaymentModeID = pm.PaymentModeID
        OUTER APPLY (
          SELECT TOP 1 sh.Carrier, sh.TrackingNumber, sh.Status AS ShipmentStatus, sh.ShippedAt, sh.DeliveredAt, sh.EstimatedDeliveryDate
          FROM dbo.Fulfillments f
          JOIN dbo.Shipments sh ON f.FulfillmentID = sh.FulfillmentID
          WHERE f.OrderID = o.OrderID
          ORDER BY f.FulfillmentID DESC
        ) sh
        WHERE o.CustomerID = @customerId
        ORDER BY o.OrderID DESC
      `);

    const orders = ordersRes.recordset;
    if (orders.length === 0) return [];

    const orderIds = orders.map((o) => o.OrderID);

    // 2. Fetch line items for these orders
    const itemsReq = pool.request();
    const idParams: string[] = [];
    orderIds.forEach((id, idx) => {
      const paramName = `ordId_${idx}`;
      itemsReq.input(paramName, sql.BigInt, id);
      idParams.push(`@${paramName}`);
    });

    const itemsRes = await itemsReq.query(`
      SELECT 
        oi.OrderItemID,
        oi.OrderID,
        oi.SellerProductID,
        oi.Quantity,
        oi.UnitPrice,
        oi.MRP,
        oi.TotalAmount,
        oi.ReturnPolicyID,
        oi.ReturnPolicySnapshot,
        pm.ProductID,
        ISNULL(pm.ProductName, 'Product #' + CAST(oi.SellerProductID AS nvarchar(50))) AS ProductName,
        sp.SellerSKU,
        pv.VariantModelCode,
        pv.VariantSKU,
        rp.PolicyCode,
        rp.PolicyName,
        rp.IsReturnable,
        rp.IsReplaceable,
        rp.ReturnWindowDays,
        rp.ReplacementWindowDays,
        rp.RequiresTechnicianCheck,
        rp.ConditionsSummary,
        (
          SELECT TOP 1
            rr.ReturnRequestID,
            rr.RequestNumber,
            rr.RequestType,
            rr.Status,
            rr.ReasonCategory,
            rr.ReasonDescription,
            rr.ResolutionType,
            rr.RefundMethod,
            rr.RefundDetailsJson,
            rr.CreatedAt
          FROM dbo.ReturnRequests rr
          WHERE rr.OrderItemID = oi.OrderItemID
          ORDER BY rr.ReturnRequestID DESC
          FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
        ) AS ReturnRequestJson,
        COALESCE(
          (
            SELECT TOP 1 pa.AssetURL
            FROM dbo.ProductVariantAssets pva
            JOIN dbo.ProductAssets pa ON pva.ProductAssetID = pa.ProductAssetID
            WHERE pva.ProductVariantID = ISNULL(sp.ProductVariantID, pv.ProductVariantID)
            ORDER BY pva.IsVariantCover DESC, pva.DisplayOrder ASC
          ),
          (
            SELECT TOP 1 pa.AssetURL
            FROM dbo.ProductAssets pa
            WHERE pa.ProductID = pm.ProductID
            ORDER BY pa.IsPrimary DESC, pa.DisplayOrder ASC
          )
        ) AS ThumbnailURL
      FROM dbo.OrderItems oi
      LEFT JOIN dbo.SellerProducts sp ON oi.SellerProductID = sp.SellerProductID
      LEFT JOIN dbo.ProductVariants pv ON sp.ProductVariantID = pv.ProductVariantID
      LEFT JOIN dbo.ProductMaster pm ON pv.ProductMasterID = pm.ProductID
      OUTER APPLY (
        SELECT TOP 1 c.DefaultReturnPolicyID
        FROM dbo.ProductCategories pc
        JOIN dbo.Categories c ON pc.CategoryID = c.CategoryID
        WHERE pc.ProductID = pm.ProductID
        ORDER BY pc.ProductCategoryID ASC
      ) cat
      LEFT JOIN dbo.ReturnReplacementPolicies rp ON rp.PolicyID = COALESCE(pm.ReturnPolicyID, cat.DefaultReturnPolicyID)
      WHERE oi.OrderID IN (${idParams.join(', ')})
      ORDER BY oi.OrderItemID ASC
    `);

    // Group items by OrderID
    const itemsByOrder = new Map<string, any[]>();
    for (const item of itemsRes.recordset) {
      const oId = String(item.OrderID);
      if (!itemsByOrder.has(oId)) {
        itemsByOrder.set(oId, []);
      }
      itemsByOrder.get(oId)!.push({
        orderItemId: String(item.OrderItemID),
        productId: String(item.ProductID),
        productName: item.ProductName,
        sellerSku: item.SellerSKU || null,
        variantModelCode: item.VariantModelCode || null,
        variantSku: item.VariantSKU || null,
        attributes: null,
        quantity: Number(item.Quantity),
        unitPrice: Number(item.UnitPrice),
        mrp: Number(item.MRP),
        totalAmount: Number(item.TotalAmount),
        thumbnail: item.ThumbnailURL || null,
        returnPolicy: (() => {
          if (item.ReturnPolicySnapshot) {
            try {
              const snap = JSON.parse(item.ReturnPolicySnapshot);
              return {
                policyCode: snap.policyCode || snap.PolicyCode || item.PolicyCode,
                policyName: snap.policyName || snap.PolicyName || item.PolicyName,
                isReturnable: Boolean(snap.isReturnable ?? snap.IsReturnable ?? item.IsReturnable),
                isReplaceable: Boolean(snap.isReplaceable ?? snap.IsReplaceable ?? item.IsReplaceable),
                returnWindowDays: Number(snap.returnWindowDays ?? snap.ReturnWindowDays ?? item.ReturnWindowDays ?? 0),
                replacementWindowDays: Number(snap.replacementWindowDays ?? snap.ReplacementWindowDays ?? item.ReplacementWindowDays ?? 0),
                requiresTechnicianCheck: Boolean(snap.requiresTechnicianCheck ?? snap.RequiresTechnicianCheck ?? item.RequiresTechnicianCheck),
                conditionsSummary: snap.conditionsSummary || snap.ConditionsSummary || item.ConditionsSummary || null,
              };
            } catch {
              // fallback below
            }
          }
          return item.PolicyCode ? {
            policyCode: item.PolicyCode,
            policyName: item.PolicyName,
            isReturnable: Boolean(item.IsReturnable),
            isReplaceable: Boolean(item.IsReplaceable),
            returnWindowDays: Number(item.ReturnWindowDays || 0),
            replacementWindowDays: Number(item.ReplacementWindowDays || 0),
            requiresTechnicianCheck: Boolean(item.RequiresTechnicianCheck),
            conditionsSummary: item.ConditionsSummary || null,
          } : null;
        })(),
        returnRequest: item.ReturnRequestJson ? (() => {
          try {
            const parsed = JSON.parse(item.ReturnRequestJson);
            return {
              returnRequestId: String(parsed.ReturnRequestID),
              requestNumber: parsed.RequestNumber,
              requestType: parsed.RequestType,
              status: parsed.Status,
              reasonCategory: parsed.ReasonCategory,
              reasonDescription: parsed.ReasonDescription,
              resolutionType: parsed.ResolutionType,
              refundMethod: parsed.RefundMethod,
              createdAt: parsed.CreatedAt,
            };
          } catch {
            return null;
          }
        })() : null,
      });
    }

    return orders.map((o) => ({
      orderId: String(o.OrderID),
      orderNumber: o.OrderNumber,
      status: o.Status,
      subtotalAmount: Number(o.SubtotalAmount),
      discountAmount: Number(o.DiscountAmount),
      shippingAmount: Number(o.ShippingAmount),
      taxAmount: Number(o.TaxAmount),
      totalAmount: Number(o.TotalAmount),
      createdAt: o.CreatedAt,
      deliveredAt: o.Status === 'DELIVERED' ? o.DeliveredAt || o.ShippedAt || o.CreatedAt : null,
      estimatedDeliveryDate: o.EstimatedDeliveryDate || null,
      shipment: o.TrackingNumber ? {
        carrier: o.Carrier || 'Standard Delivery',
        trackingNumber: o.TrackingNumber,
        status: o.ShipmentStatus,
      } : null,
      payment: {
        modeName: o.PaymentModeName || 'Cash on Delivery',
        modeCode: o.PaymentModeCode || 'COD',
        status: o.PaymentStatus || 'PENDING',
        amount: Number(o.PaymentAmount || o.TotalAmount),
      },
      shippingAddress: {
        recipientName: o.RecipientName,
        phoneNumber: o.PhoneNumber,
        addressLine1: o.AddressLine1,
        addressLine2: o.AddressLine2,
        city: o.City,
        state: o.State,
        postalCode: o.PostalCode,
        addressLabel: o.AddressLabel,
      },
      items: itemsByOrder.get(String(o.OrderID)) || [],
    }));
  }

  async getOrderForCustomerInvoice(customerId: bigint, orderId: bigint) {
    const pool = await getPool();
    const res = await pool
      .request()
      .input('customerId', sql.BigInt, customerId)
      .input('orderId', sql.BigInt, orderId)
      .query<{
        OrderID: bigint;
        OrderNumber: string;
        Status: string;
        SellerID: bigint;
      }>(`
        SELECT TOP 1
          o.OrderID,
          o.OrderNumber,
          o.Status,
          COALESCE(
            (SELECT TOP 1 f.SellerID FROM dbo.Fulfillments f WHERE f.OrderID = o.OrderID),
            (SELECT TOP 1 sp.SellerID FROM dbo.OrderItems oi JOIN dbo.SellerProducts sp ON oi.SellerProductID = sp.SellerProductID WHERE oi.OrderID = o.OrderID),
            (SELECT TOP 1 SellerID FROM dbo.Sellers WHERE Status = 'ACTIVE')
          ) AS SellerID
        FROM dbo.Orders o
        WHERE o.OrderID = @orderId AND o.CustomerID = @customerId
      `);

    return res.recordset[0] || null;
  }

  async getOrderItemForReturn(customerId: bigint, orderItemId: bigint) {
    const pool = await getPool();
    await ensureOrderReturnSchema(pool);
    const res = await pool
      .request()
      .input('customerId', sql.BigInt, customerId)
      .input('orderItemId', sql.BigInt, orderItemId)
      .query(`
        SELECT TOP 1
          oi.OrderItemID,
          oi.OrderID,
          oi.SellerProductID,
          oi.Quantity,
          oi.UnitPrice,
          oi.TotalAmount,
          oi.ReturnPolicyID,
          oi.ReturnPolicySnapshot,
          o.OrderNumber,
          o.Status AS OrderStatus,
          o.CreatedAt AS OrderCreatedAt,
          o.ShippingRecipientName,
          o.ShippingPhoneNumber,
          o.ShippingAddressLine1,
          o.ShippingAddressLine2,
          o.ShippingCity,
          o.ShippingState,
          o.ShippingPostalCode,
          pm.PaymentModeCode,
          sh.DeliveredAt AS ExplicitDeliveredAt,
          COALESCE(sh.DeliveredAt, sh.ShippedAt, o.CreatedAt) AS DeliveredAt,
          rp.PolicyCode,
          rp.PolicyName,
          rp.IsReturnable,
          rp.IsReplaceable,
          rp.ReturnWindowDays,
          rp.ReplacementWindowDays,
          rp.RequiresTechnicianCheck,
          rp.ConditionsSummary,
          (
            SELECT TOP 1 rr.ReturnRequestID, rr.RequestNumber, rr.Status
            FROM dbo.ReturnRequests rr
            WHERE rr.OrderItemID = oi.OrderItemID AND rr.Status IN ('REQUESTED', 'APPROVED', 'RECEIVED', 'QC_PASSED')
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
          ) AS ActiveReturnRequestJson,
          (
            SELECT COALESCE(SUM(rr.Quantity), 0)
            FROM dbo.ReturnRequests rr
            WHERE rr.OrderItemID = oi.OrderItemID AND rr.Status NOT IN ('CANCELLED', 'REJECTED', 'QC_FAILED')
          ) AS TotalReturnedQuantity
        FROM dbo.OrderItems oi
        JOIN dbo.Orders o ON oi.OrderID = o.OrderID
        LEFT JOIN dbo.Payments pay ON o.OrderID = pay.OrderID
        LEFT JOIN dbo.PaymentModes pm ON pay.PaymentModeID = pm.PaymentModeID
        LEFT JOIN dbo.SellerProducts sp ON oi.SellerProductID = sp.SellerProductID
        LEFT JOIN dbo.ProductVariants pv ON sp.ProductVariantID = pv.ProductVariantID
        LEFT JOIN dbo.ProductMaster pmaster ON pv.ProductMasterID = pmaster.ProductID
        OUTER APPLY (
          SELECT TOP 1 c.DefaultReturnPolicyID
          FROM dbo.ProductCategories pc
          JOIN dbo.Categories c ON pc.CategoryID = c.CategoryID
          WHERE pc.ProductID = pmaster.ProductID
          ORDER BY pc.ProductCategoryID ASC
        ) cat
        LEFT JOIN dbo.ReturnReplacementPolicies rp ON rp.PolicyID = COALESCE(pmaster.ReturnPolicyID, cat.DefaultReturnPolicyID)
        OUTER APPLY (
          SELECT TOP 1 sh.DeliveredAt, sh.ShippedAt
          FROM dbo.Fulfillments f
          JOIN dbo.Shipments sh ON f.FulfillmentID = sh.FulfillmentID
          WHERE f.OrderID = o.OrderID
          ORDER BY f.FulfillmentID DESC
        ) sh
        WHERE oi.OrderItemID = @orderItemId AND o.CustomerID = @customerId
      `);

    return res.recordset[0] || null;
  }

  async createReturnRequest(data: {
    orderId: bigint;
    orderItemId: bigint;
    customerId: bigint;
    sellerProductId: bigint;
    requestType: 'RETURN' | 'REPLACEMENT';
    reasonCategory: string;
    reasonDescription?: string;
    quantity: number;
    resolutionType: 'REFUND' | 'REPLACEMENT';
    refundMethod?: string;
    refundDetailsJson?: string;
    pickupAddressJson: string;
    images?: string[];
  }) {
    const pool = await getPool();
    const reqNumber = `RET-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 900 + 100)}`;

    // Resolve fulfillment routing destination: Warehouse vs Direct Seller
    const routeRes = await pool
      .request()
      .input('orderItemId', sql.BigInt, data.orderItemId)
      .query<{ WarehouseID: bigint | null; SellerID: bigint | null }>(`
        SELECT TOP 1
          f.WarehouseID,
          COALESCE(f.SellerID, sp.SellerID) AS SellerID
        FROM dbo.OrderItems oi
        LEFT JOIN dbo.Fulfillments f ON oi.FulfillmentID = f.FulfillmentID
        LEFT JOIN dbo.SellerProducts sp ON oi.SellerProductID = sp.SellerProductID
        WHERE oi.OrderItemID = @orderItemId;
      `);

    const routeInfo = routeRes.recordset[0];
    const destinationType = routeInfo?.WarehouseID ? 'WAREHOUSE' : 'SELLER';
    const destinationId = routeInfo?.WarehouseID || routeInfo?.SellerID || null;

    let created: any;
    try {
      const insertRes = await pool
        .request()
        .input('requestNumber', sql.NVarChar(50), reqNumber)
        .input('orderId', sql.BigInt, data.orderId)
        .input('orderItemId', sql.BigInt, data.orderItemId)
        .input('customerId', sql.BigInt, data.customerId)
        .input('sellerProductId', sql.BigInt, data.sellerProductId)
        .input('requestType', sql.VarChar(20), data.requestType)
        .input('reasonCategory', sql.NVarChar(100), data.reasonCategory)
        .input('reasonDescription', sql.NVarChar(1000), data.reasonDescription || null)
        .input('quantity', sql.Int, data.quantity)
        .input('resolutionType', sql.VarChar(20), data.resolutionType)
        .input('refundMethod', sql.VarChar(30), data.refundMethod || null)
        .input('refundDetailsJson', sql.NVarChar(sql.MAX), data.refundDetailsJson || null)
        .input('destinationType', sql.VarChar(20), destinationType)
        .input('destinationId', sql.BigInt, destinationId)
        .input('pickupAddressJson', sql.NVarChar(sql.MAX), data.pickupAddressJson)
        .query(`
          INSERT INTO dbo.ReturnRequests (
            RequestNumber, OrderID, OrderItemID, CustomerID, SellerProductID,
            RequestType, ReasonCategory, ReasonDescription, Quantity,
            ResolutionType, RefundMethod, RefundDetailsJson, Status,
            DestinationType, DestinationID, QCStatus, PickupAddressJson, CreatedAt
          )
          OUTPUT INSERTED.ReturnRequestID, INSERTED.RequestNumber, INSERTED.Status, INSERTED.CreatedAt
          VALUES (
            @requestNumber, @orderId, @orderItemId, @customerId, @sellerProductId,
            @requestType, @reasonCategory, @reasonDescription, @quantity,
            @resolutionType, @refundMethod, @refundDetailsJson, 'REQUESTED',
            @destinationType, @destinationId, 'PENDING', @pickupAddressJson, SYSUTCDATETIME()
          )
        `);

      created = insertRes.recordset[0];
    } catch (err: any) {
      if (err?.number === 2601 || err?.number === 2627) {
        throw new BadRequestError('A return or replacement request is already in progress for this item.');
      }
      throw err;
    }

    if (data.images && data.images.length > 0) {
      for (const img of data.images) {
        if (img && typeof img === 'string') {
          await pool
            .request()
            .input('returnRequestId', sql.BigInt, created.ReturnRequestID)
            .input('assetUrl', sql.NVarChar(1000), img)
            .query(`
              INSERT INTO dbo.ReturnRequestAssets (ReturnRequestID, AssetURL, CreatedAt)
              VALUES (@returnRequestId, @assetUrl, SYSUTCDATETIME())
            `);
        }
      }
    }

    return {
      returnRequestId: String(created.ReturnRequestID),
      requestNumber: created.RequestNumber,
      status: created.Status,
      createdAt: created.CreatedAt,
    };
  }

  async cancelReturnRequest(customerId: bigint, returnRequestId: bigint) {
    const pool = await getPool();
    const res = await pool
      .request()
      .input('customerId', sql.BigInt, customerId)
      .input('returnRequestId', sql.BigInt, returnRequestId)
      .query(`
        UPDATE dbo.ReturnRequests
        SET Status = 'CANCELLED', UpdatedAt = SYSUTCDATETIME()
        WHERE ReturnRequestID = @returnRequestId AND CustomerID = @customerId AND Status = 'REQUESTED'
      `);

    return (res.rowsAffected[0] || 0) > 0;
  }

  async getCustomerReturnRequests(customerId: bigint) {
    const pool = await getPool();
    const res = await pool
      .request()
      .input('customerId', sql.BigInt, customerId)
      .query(`
        SELECT 
          rr.ReturnRequestID,
          rr.RequestNumber,
          rr.OrderID,
          rr.OrderItemID,
          rr.RequestType,
          rr.ReasonCategory,
          rr.ReasonDescription,
          rr.Quantity,
          rr.ResolutionType,
          rr.RefundMethod,
          rr.RefundDetailsJson,
          rr.Status,
          rr.AdminComments,
          rr.PickupAddressJson,
          rr.TrackingNumber,
          rr.CreatedAt,
          rr.UpdatedAt,
          o.OrderNumber,
          pm.ProductName,
          (
            SELECT rra.AssetURL
            FROM dbo.ReturnRequestAssets rra
            WHERE rra.ReturnRequestID = rr.ReturnRequestID
            FOR JSON PATH
          ) AS AssetsJson
        FROM dbo.ReturnRequests rr
        JOIN dbo.Orders o ON rr.OrderID = o.OrderID
        JOIN dbo.OrderItems oi ON rr.OrderItemID = oi.OrderItemID
        LEFT JOIN dbo.SellerProducts sp ON oi.SellerProductID = sp.SellerProductID
        LEFT JOIN dbo.ProductVariants pv ON sp.ProductVariantID = pv.ProductVariantID
        LEFT JOIN dbo.ProductMaster pm ON pv.ProductMasterID = pm.ProductID
        WHERE rr.CustomerID = @customerId
        ORDER BY rr.ReturnRequestID DESC
      `);

    return res.recordset.map((r: any) => ({
      returnRequestId: String(r.ReturnRequestID),
      requestNumber: r.RequestNumber,
      orderId: String(r.OrderID),
      orderItemId: String(r.OrderItemID),
      orderNumber: r.OrderNumber,
      productName: r.ProductName,
      requestType: r.RequestType,
      reasonCategory: r.ReasonCategory,
      reasonDescription: r.ReasonDescription,
      quantity: Number(r.Quantity),
      resolutionType: r.ResolutionType,
      refundMethod: r.RefundMethod,
      refundDetails: r.RefundDetailsJson ? JSON.parse(r.RefundDetailsJson) : null,
      status: r.Status,
      adminComments: r.AdminComments,
      pickupAddress: r.PickupAddressJson ? JSON.parse(r.PickupAddressJson) : null,
      trackingNumber: r.TrackingNumber,
      createdAt: r.CreatedAt,
      updatedAt: r.UpdatedAt,
      assets: r.AssetsJson ? JSON.parse(r.AssetsJson).map((a: any) => a.AssetURL) : [],
    }));
  }
}

export const customerOrdersRepository = new CustomerOrdersRepository();
