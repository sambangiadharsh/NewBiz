import { getPool, sql } from '../../database/db.js';

export interface OrderItemInput {
  sellerProductId: bigint;
  sellerId: bigint;
  quantity: number;
  unitPrice: number;
  mrp: number;
  purchasePrice: number;
  discountPercentage?: number;
  discountAmount?: number;
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
   * Strictly touches ONLY: dbo.Orders, dbo.OrderItems, dbo.Payments, dbo.SellerOrders
   * (Does NOT touch Fulfillments, Shipments, or Invoices).
   */
  async createOrder(input: CreateOrderDbInput) {
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // 1. Resolve Shipping Address ID
      let shippingAddressId = input.shippingAddressId;

      if (!shippingAddressId && input.rawAddress) {
        // Insert address row for customer
        const addrRes = await transaction
          .request()
          .input('customerId', sql.BigInt, input.customerId)
          .input('label', sql.NVarChar, input.rawAddress.addressLabel || 'Home')
          .input('name', sql.NVarChar, input.rawAddress.recipientName)
          .input('phone', sql.NVarChar, input.rawAddress.phoneNumber)
          .input('line1', sql.NVarChar, input.rawAddress.addressLine1)
          .input('line2', sql.NVarChar, input.rawAddress.addressLine2 || null)
          .input('city', sql.NVarChar, input.rawAddress.city)
          .input('state', sql.NVarChar, input.rawAddress.state)
          .input('postal', sql.NVarChar, input.rawAddress.postalCode)
          .input('country', sql.NVarChar, input.rawAddress.country || 'India')
          .query<{ CustomerAddressID: bigint }>(`
            INSERT INTO dbo.CustomerAddresses (
              CustomerID, AddressLabel, RecipientName, PhoneNumber,
              AddressLine1, AddressLine2, City, State, PostalCode, Country,
              IsDefaultShipping, IsDefaultBilling, CreatedAt, UpdatedAt
            )
            OUTPUT INSERTED.CustomerAddressID
            VALUES (
              @customerId, @label, @name, @phone,
              @line1, @line2, @city, @state, @postal, @country,
              0, 0, SYSUTCDATETIME(), SYSUTCDATETIME()
            )
          `);
        shippingAddressId = addrRes.recordset[0].CustomerAddressID;
      }

      if (!shippingAddressId) {
        throw new Error('A valid delivery address is required to place an order.');
      }

      // 2. Obtain collision-safe sequential OrderNumber starting at 100000 (1 Lakh)
      const seqRes = await transaction.request().query<{ nextSeq: string | number }>(`
        SELECT NEXT VALUE FOR dbo.OrderNumberSeq AS nextSeq;
      `);
      const nextSeq = seqRes.recordset[0].nextSeq;
      const orderNumber = `ORD-${nextSeq}`;

      // 3. Insert into dbo.Orders
      const orderRes = await transaction
        .request()
        .input('orderNumber', sql.VarChar, orderNumber)
        .input('customerId', sql.BigInt, input.customerId)
        .input('subtotal', sql.Decimal(18, 2), input.subtotalAmount)
        .input('discount', sql.Decimal(18, 2), input.discountAmount)
        .input('shipping', sql.Decimal(18, 2), input.shippingAmount)
        .input('tax', sql.Decimal(18, 2), input.taxAmount)
        .input('total', sql.Decimal(18, 2), input.totalAmount)
        .input('shippingAddressId', sql.BigInt, shippingAddressId)
        .input('billingAddressId', sql.BigInt, shippingAddressId)
        .query<{ OrderID: bigint; OrderNumber: string }>(`
          INSERT INTO dbo.Orders (
            OrderNumber, CustomerID, Status,
            SubtotalAmount, DiscountAmount, ShippingAmount, TaxAmount, TotalAmount,
            ShippingAddressID, BillingAddressID,
            CreatedAt, UpdatedAt
          )
          OUTPUT INSERTED.OrderID, INSERTED.OrderNumber
          VALUES (
            @orderNumber, @customerId, 'CONFIRMED',
            @subtotal, @discount, @shipping, @tax, @total,
            @shippingAddressId, @billingAddressId,
            SYSUTCDATETIME(), SYSUTCDATETIME()
          )
        `);

      const orderId = orderRes.recordset[0].OrderID;

      // 4. Insert Line Items into dbo.OrderItems
      for (const item of input.items) {
        const totalMRP = item.mrp * item.quantity;
        const totalPurchasePrice = item.purchasePrice * item.quantity;
        const totalItemAmount = item.unitPrice * item.quantity;
        const discountAmt = item.discountAmount || Math.max(0, totalMRP - totalItemAmount);
        const discountPct = item.discountPercentage || (item.mrp > 0 ? ((item.mrp - item.unitPrice) / item.mrp) * 100 : 0);

        await transaction
          .request()
          .input('orderId', sql.BigInt, orderId)
          .input('sellerProductId', sql.BigInt, item.sellerProductId)
          .input('quantity', sql.Int, item.quantity)
          .input('unitPrice', sql.Decimal(18, 2), item.unitPrice)
          .input('mrp', sql.Decimal(18, 2), item.mrp)
          .input('totalMRP', sql.Decimal(18, 2), totalMRP)
          .input('purchasePrice', sql.Decimal(18, 2), item.purchasePrice)
          .input('totalPurchasePrice', sql.Decimal(18, 2), totalPurchasePrice)
          .input('discountPct', sql.Decimal(5, 2), Number(discountPct.toFixed(2)))
          .input('discountAmt', sql.Decimal(18, 2), Number(discountAmt.toFixed(2)))
          .input('totalAmount', sql.Decimal(18, 2), Number(totalItemAmount.toFixed(2)))
          .query(`
            INSERT INTO dbo.OrderItems (
              OrderID, SellerProductID, Quantity, UnitPrice, MRP, TotalMRP,
              PurchasePrice, TotalPurchasePrice, DiscountPercentage, DiscountAmount,
              CGSTRate, CGSTAmount, SGSTRate, SGSTAmount, IGSTRate, IGSTAmount,
              TaxAmount, TotalAmount, CreatedAt
            )
            VALUES (
              @orderId, @sellerProductId, @quantity, @unitPrice, @mrp, @totalMRP,
              @purchasePrice, @totalPurchasePrice, @discountPct, @discountAmt,
              0, 0, 0, 0, 0, 0,
              0, @totalAmount, SYSUTCDATETIME()
            )
          `);
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

      // 6. Ensure dbo.SellerOrders entries are created for each unique seller involved in the order
      const uniqueSellerIds = Array.from(new Set(input.items.map((i) => String(i.sellerId))));
      for (const sId of uniqueSellerIds) {
        await transaction
          .request()
          .input('orderId', sql.BigInt, orderId)
          .input('sellerId', sql.BigInt, BigInt(sId))
          .query(`
            IF NOT EXISTS (SELECT 1 FROM dbo.SellerOrders WHERE OrderID = @orderId AND SellerID = @sellerId)
            BEGIN
              INSERT INTO dbo.SellerOrders (OrderID, SellerID, Status, CreatedAt, UpdatedAt)
              VALUES (@orderId, @sellerId, 'CONFIRMED', SYSUTCDATETIME(), SYSUTCDATETIME())
            END
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
          sa.RecipientName,
          sa.PhoneNumber,
          sa.AddressLine1,
          sa.AddressLine2,
          sa.City,
          sa.State,
          sa.PostalCode,
          sa.AddressLabel,
          pm.PaymentModeName AS PaymentModeName,
          pm.PaymentModeCode AS PaymentModeCode,
          pay.Status AS PaymentStatus,
          pay.Amount AS PaymentAmount
        FROM dbo.Orders o
        LEFT JOIN dbo.CustomerAddresses sa ON o.ShippingAddressID = sa.CustomerAddressID
        LEFT JOIN dbo.Payments pay ON o.OrderID = pay.OrderID
        LEFT JOIN dbo.PaymentModes pm ON pay.PaymentModeID = pm.PaymentModeID
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
        pm.ProductName,
        (
          SELECT TOP 1 pa.AssetURL
          FROM dbo.ProductAssets pa
          WHERE pa.ProductVariantID = sp.ProductVariantID AND pa.Status = 'ACTIVE'
          ORDER BY pa.IsPrimary DESC, pa.DisplayOrder ASC
        ) AS ThumbnailURL
      FROM dbo.OrderItems oi
      JOIN dbo.SellerProducts sp ON oi.SellerProductID = sp.SellerProductID
      JOIN dbo.ProductVariants pv ON sp.ProductVariantID = pv.ProductVariantID
      JOIN dbo.ProductMaster pm ON pv.ProductMasterID = pm.ProductID
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
}

export const customerOrdersRepository = new CustomerOrdersRepository();
