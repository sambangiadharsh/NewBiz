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
  items: OrderItemInput[];
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
            @orderNumber, @customerId, 'CONFIRMED',
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

      // Ensure FulfillmentID column exists on dbo.OrderItems
      await transaction.request().query(`
        IF NOT EXISTS (
          SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_NAME = 'OrderItems' AND COLUMN_NAME = 'FulfillmentID'
        )
        BEGIN
          ALTER TABLE dbo.OrderItems ADD FulfillmentID BIGINT NULL;
        END
      `);

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
              .query<{ InventoryID: bigint }>(`
                UPDATE inv
                SET 
                  inv.ReservedQuantity = ISNULL(inv.ReservedQuantity, 0) + @qty,
                  inv.UpdatedAt = SYSUTCDATETIME()
                OUTPUT INSERTED.InventoryID
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

            // Audit Record: Insert active reservation into dbo.InventoryReservations
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
                  @invId, @orderId, @qty, 'RESERVED', NULL, SYSUTCDATETIME(), SYSUTCDATETIME()
                );
              `);

            // Audit Ledger: Insert into dbo.InventoryTransactions
            await transaction
              .request()
              .input('invId', sql.BigInt, inventoryId)
              .input('orderId', sql.BigInt, orderId)
              .input('qty', sql.Int, allocItem.quantity)
              .input('reason', sql.NVarChar(500), `Stock reserved for order #${orderNumber}`)
              .query(`
                INSERT INTO dbo.InventoryTransactions (
                  InventoryID, OrderID, TransactionType, Quantity, Reason, CreatedAt
                )
                VALUES (
                  @invId, @orderId, 'ORDER_RESERVED', @qty, @reason, SYSUTCDATETIME()
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
              .query<{ OrderItemID: bigint }>(`
                INSERT INTO dbo.OrderItems (
                  OrderID, SellerProductID, FulfillmentID, Quantity, UnitPrice, MRP, TotalMRP,
                  PurchasePrice, TotalPurchasePrice, DiscountPercentage, DiscountAmount,
                  CGSTRate, CGSTAmount, SGSTRate, SGSTAmount, IGSTRate, IGSTAmount,
                  TaxAmount, TotalAmount, CreatedAt
                )
                OUTPUT INSERTED.OrderItemID
                VALUES (
                  @orderId, @sellerProductId, @fulfillmentId, @quantity, @unitPrice, @mrp, @totalMRP,
                  @purchasePrice, @totalPurchasePrice, @discountPct, @discountAmt,
                  @cgstRate, @cgstAmt, @sgstRate, @sgstAmt, @igstRate, @igstAmt,
                  @taxAmt, @totalAmount, SYSUTCDATETIME()
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
        status: 'CONFIRMED',
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
          sh.EstimatedDeliveryDate
        FROM dbo.Orders o
        LEFT JOIN dbo.Payments pay ON o.OrderID = pay.OrderID
        LEFT JOIN dbo.PaymentModes pm ON pay.PaymentModeID = pm.PaymentModeID
        OUTER APPLY (
          SELECT TOP 1 sh.Carrier, sh.TrackingNumber, sh.Status AS ShipmentStatus, sh.ShippedAt, sh.EstimatedDeliveryDate
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
        pm.ProductID,
        ISNULL(pm.ProductName, 'Product #' + CAST(oi.SellerProductID AS nvarchar(50))) AS ProductName,
        sp.SellerSKU,
        pv.VariantModelCode,
        pv.VariantSKU,
        (
          SELECT TOP 1 pa.AssetURL
          FROM dbo.ProductAssets pa
          WHERE (
            pa.ProductVariantID = sp.ProductVariantID 
            OR pa.ProductVariantID = pv.ProductVariantID
            OR (pm.ProductID IS NOT NULL AND pa.ProductVariantID IN (SELECT pv2.ProductVariantID FROM dbo.ProductVariants pv2 WHERE pv2.ProductMasterID = pm.ProductID))
          )
          ORDER BY pa.IsPrimary DESC, pa.DisplayOrder ASC
        ) AS ThumbnailURL
      FROM dbo.OrderItems oi
      LEFT JOIN dbo.SellerProducts sp ON oi.SellerProductID = sp.SellerProductID
      LEFT JOIN dbo.ProductVariants pv ON sp.ProductVariantID = pv.ProductVariantID
      LEFT JOIN dbo.ProductMaster pm ON pv.ProductMasterID = pm.ProductID
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
      deliveredAt: o.Status === 'DELIVERED' ? o.ShippedAt || o.CreatedAt : null,
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
}

export const customerOrdersRepository = new CustomerOrdersRepository();
