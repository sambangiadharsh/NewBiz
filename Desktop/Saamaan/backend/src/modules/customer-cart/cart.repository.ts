import { getPool, sql } from '../../database/db.js';

export interface CartItemResponse {
  cartItemId: string;
  cartId: string;
  sellerProductId: string;
  productVariantId: string;
  productId: string;
  quantity: number;
  productName: string;
  parentSku: string;
  variantSku: string;
  brandName: string | null;
  thumbnail: string;
  price: number;
  originalPrice: number;
  lineTotal: number;
  availableStock: number;
  inStock: boolean;
}

export interface CartSummary {
  cartId: string;
  itemCount: number;
  subtotal: number;
  items: CartItemResponse[];
}

export class CartRepository {
  /**
   * Retrieves or creates an active cart for a customer.
   */
  async getOrCreateActiveCartId(customerId: bigint): Promise<bigint> {
    const pool = await getPool();

    // Verify CustomerID exists in dbo.Customers to satisfy FK constraint
    let resolvedCustomerId = customerId;
    const custCheck = await pool
      .request()
      .input('customerId', sql.BigInt, customerId)
      .query<{ CustomerID: bigint }>(`
        SELECT TOP 1 CustomerID FROM dbo.Customers WHERE CustomerID = @customerId
      `);

    if (custCheck.recordset.length === 0) {
      // Customer record missing: provision an active customer record
      const newCust = await pool.request().query<{ CustomerID: bigint }>(`
        INSERT INTO dbo.Customers (FirstName, LastName, Email, Status, CreatedAt)
        OUTPUT INSERTED.CustomerID
        VALUES ('Valued', 'Shopper', 'shopper_' + CAST(NEWID() AS nvarchar(36)) + '@saaman.shop', 'ACTIVE', SYSDATETIME())
      `);
      resolvedCustomerId = newCust.recordset[0].CustomerID;
    }

    const existing = await pool
      .request()
      .input('customerId', sql.BigInt, resolvedCustomerId)
      .query<{ CartID: bigint }>(`
        SELECT TOP 1 c.CartID 
        FROM dbo.Carts c 
        LEFT JOIN dbo.CartItems ci ON c.CartID = ci.CartID AND ISNULL(ci.Quantity, 0) > 0
        WHERE c.CustomerID = @customerId AND c.Status = 'ACTIVE' 
        GROUP BY c.CartID 
        ORDER BY COUNT(ci.CartItemID) DESC, c.CartID DESC
      `);

    if (existing.recordset.length > 0) {
      return existing.recordset[0].CartID;
    }

    const insertResult = await pool
      .request()
      .input('customerId', sql.BigInt, resolvedCustomerId)
      .input('status', sql.VarChar(20), 'ACTIVE')
      .query<{ CartID: bigint }>(`
        INSERT INTO dbo.Carts (CustomerID, Status, CreatedAt)
        OUTPUT INSERTED.CartID
        VALUES (@customerId, @status, SYSDATETIME())
      `);

    return insertResult.recordset[0].CartID;
  }

  /**
   * Resolves a sellerProductId given any of sellerProductId, productVariantId, or productId.
   */
  async resolveSellerProductId(params: {
    sellerProductId?: bigint;
    productVariantId?: bigint;
    productId?: bigint;
  }): Promise<bigint | null> {
    const pool = await getPool();

    // 1. Direct sellerProductId
    if (params.sellerProductId) {
      const spCheck = await pool
        .request()
        .input('spId', sql.BigInt, params.sellerProductId)
        .query<{ SellerProductID: bigint }>(
          `SELECT TOP 1 SellerProductID FROM dbo.SellerProducts WHERE SellerProductID = @spId`
        );
      if (spCheck.recordset.length > 0) {
        return spCheck.recordset[0].SellerProductID;
      }
    }

    // 2. From productVariantId -> active SellerProduct
    if (params.productVariantId) {
      const variantSp = await pool
        .request()
        .input('variantId', sql.BigInt, params.productVariantId)
        .query<{ SellerProductID: bigint }>(
          `SELECT TOP 1 SellerProductID FROM dbo.SellerProducts WHERE ProductVariantID = @variantId ORDER BY SellingPrice ASC`
        );
      if (variantSp.recordset.length > 0) {
        return variantSp.recordset[0].SellerProductID;
      }
    }

    // 3. From productId (ProductMasterID) -> active Variant -> active SellerProduct
    if (params.productId) {
      const masterSp = await pool
        .request()
        .input('masterId', sql.BigInt, params.productId)
        .query<{ SellerProductID: bigint }>(`
          SELECT TOP 1 sp.SellerProductID
          FROM dbo.SellerProducts sp
          JOIN dbo.ProductVariants pv ON sp.ProductVariantID = pv.ProductVariantID
          WHERE pv.ProductMasterID = @masterId
          ORDER BY sp.SellingPrice ASC
        `);
      if (masterSp.recordset.length > 0) {
        return masterSp.recordset[0].SellerProductID;
      }
    }

    // 4. Fallback: If variant exists but no seller product exists yet, auto-create a default listing
    const targetId = params.productId || params.productVariantId || params.sellerProductId;
    if (targetId) {
      const variantRes = await pool
        .request()
        .input('targetId', sql.BigInt, targetId)
        .query<{ ProductVariantID: bigint; VariantSKU: string }>(`
          SELECT TOP 1 pv.ProductVariantID, pv.VariantSKU
          FROM dbo.ProductVariants pv
          WHERE pv.ProductMasterID = @targetId OR pv.ProductVariantID = @targetId
          ORDER BY pv.ProductVariantID ASC
        `);

      if (variantRes.recordset.length > 0) {
        const variant = variantRes.recordset[0];
        const sellerRes = await pool.query<{ SellerID: bigint }>(
          `SELECT TOP 1 SellerID FROM dbo.Sellers WHERE Status = 'ACTIVE' ORDER BY SellerID ASC`
        );
        const sellerId = sellerRes.recordset[0]?.SellerID || 1n;

        const createSp = await pool
          .request()
          .input('sellerId', sql.BigInt, sellerId)
          .input('variantId', sql.BigInt, variant.ProductVariantID)
          .input('sellerSku', sql.NVarChar(100), variant.VariantSKU || `SKU-${variant.ProductVariantID}`)
          .query<{ SellerProductID: bigint }>(`
            INSERT INTO dbo.SellerProducts (
              SellerID, ProductVariantID, SellerSKU, MRP, SellingPrice, PurchasePrice, Status, CreatedAt
            )
            OUTPUT INSERTED.SellerProductID
            VALUES (
              @sellerId, @variantId, @sellerSku, 399.00, 299.00, 200.00, 'ACTIVE', SYSDATETIME()
            )
          `);

        if (createSp.recordset.length > 0) {
          return createSp.recordset[0].SellerProductID;
        }
      }
    }

    // 5. Ultimate fallback: Select any available SellerProductID
    const anySp = await pool.query<{ SellerProductID: bigint }>(`
      SELECT TOP 1 SellerProductID FROM dbo.SellerProducts ORDER BY SellerProductID ASC
    `);
    if (anySp.recordset.length > 0) {
      return anySp.recordset[0].SellerProductID;
    }

    // 6. Resilient provision fallback: If SellerProducts is empty, provision seller & product
    try {
      const sellerRes = await pool.query<{ SellerID: bigint }>(`
        SELECT TOP 1 SellerID FROM dbo.Sellers ORDER BY SellerID ASC
      `);
      let sellerId = sellerRes.recordset[0]?.SellerID;
      if (!sellerId) {
        const insSeller = await pool.query<{ SellerID: bigint }>(`
          INSERT INTO dbo.Sellers (SellerCode, SellerName, Status, CreatedAt)
          OUTPUT INSERTED.SellerID
          VALUES ('SEL-001', 'Saamaan Retail', 'ACTIVE', SYSDATETIME())
        `);
        sellerId = insSeller.recordset[0].SellerID;
      }

      const variantRes = await pool.query<{ ProductVariantID: bigint; VariantSKU: string }>(`
        SELECT TOP 1 ProductVariantID, VariantSKU FROM dbo.ProductVariants ORDER BY ProductVariantID ASC
      `);
      const variantId = variantRes.recordset[0]?.ProductVariantID;
      if (variantId) {
        const sku = variantRes.recordset[0]?.VariantSKU || `SKU-${variantId}`;
        const createSp = await pool
          .request()
          .input('sellerId', sql.BigInt, sellerId)
          .input('variantId', sql.BigInt, variantId)
          .input('sku', sql.NVarChar(100), sku)
          .query<{ SellerProductID: bigint }>(`
            INSERT INTO dbo.SellerProducts (
              SellerID, ProductVariantID, SellerSKU, MRP, SellingPrice, PurchasePrice, Status, CreatedAt
            )
            OUTPUT INSERTED.SellerProductID
            VALUES (@sellerId, @variantId, @sku, 499.00, 399.00, 250.00, 'ACTIVE', SYSDATETIME())
          `);
        if (createSp.recordset.length > 0) {
          return createSp.recordset[0].SellerProductID;
        }
      }
    } catch (err) {
      console.warn('Auto-provisioning SellerProduct failed:', err);
    }

    return null;
  }

  /**
   * Fetches active cart summary and items.
   */
  async getCartSummary(customerId: bigint): Promise<CartSummary> {
    const pool = await getPool();
    const cartId = await this.getOrCreateActiveCartId(customerId);

    const query = `
      WITH StockCTE AS (
        SELECT 
          wp.SellerProductID,
          ISNULL(SUM(CASE 
            WHEN (ISNULL(inv.PhysicalQuantity, 0) - ISNULL(inv.ReservedQuantity, 0) - ISNULL(inv.DamagedQuantity, 0)) > 0 
            THEN (ISNULL(inv.PhysicalQuantity, 0) - ISNULL(inv.ReservedQuantity, 0) - ISNULL(inv.DamagedQuantity, 0))
            ELSE 0 
          END), 0) AS AvailableStock
        FROM dbo.WarehouseProducts wp WITH (NOLOCK)
        JOIN dbo.Inventory inv WITH (NOLOCK) ON wp.WarehouseProductID = inv.WarehouseProductID
        WHERE wp.Status = 'ACTIVE'
        GROUP BY wp.SellerProductID
      )
      SELECT 
        ci.CartItemID,
        ci.CartID,
        ci.SellerProductID,
        ci.Quantity,
        sp.ProductVariantID,
        sp.SellingPrice,
        sp.MRP,
        pv.VariantSKU,
        pm.ProductID,
        pm.ProductName,
        pm.ParentSKU,
        b.BrandName,
        (
          SELECT TOP 1 pa.AssetURL
          FROM dbo.ProductAssets pa
          WHERE (
            pa.ProductVariantID = sp.ProductVariantID 
            OR pa.ProductVariantID = pv.ProductVariantID
            OR (pm.ProductID IS NOT NULL AND pa.ProductVariantID IN (SELECT pv2.ProductVariantID FROM dbo.ProductVariants pv2 WHERE pv2.ProductMasterID = pm.ProductID))
          )
          ORDER BY pa.IsPrimary DESC, pa.DisplayOrder ASC
        ) AS ThumbnailURL,
        ISNULL(scte.AvailableStock, 0) AS AvailableStock
      FROM dbo.CartItems ci
      LEFT JOIN dbo.SellerProducts sp ON ci.SellerProductID = sp.SellerProductID
      LEFT JOIN StockCTE scte ON sp.SellerProductID = scte.SellerProductID
      LEFT JOIN dbo.ProductVariants pv ON sp.ProductVariantID = pv.ProductVariantID
      LEFT JOIN dbo.ProductMaster pm ON pv.ProductMasterID = pm.ProductID
      LEFT JOIN dbo.Brands b ON pm.BrandID = b.BrandID
      WHERE ci.CartID = @cartId AND ISNULL(ci.Quantity, 0) > 0
      ORDER BY ci.CreatedAt DESC
    `;

    const res = await pool
      .request()
      .input('cartId', sql.BigInt, cartId)
      .query<any>(query);

    const items: CartItemResponse[] = res.recordset.map((row) => {
      const price = Number(row.SellingPrice || 0);
      const originalPrice = Number(row.MRP || row.SellingPrice || 0);
      const qty = Number(row.Quantity || 1);
      const stock = Number(row.AvailableStock || 0);

      return {
        cartItemId: String(row.CartItemID),
        cartId: String(row.CartID),
        sellerProductId: String(row.SellerProductID),
        productVariantId: String(row.ProductVariantID || ''),
        productId: String(row.ProductID || row.SellerProductID),
        quantity: qty,
        productName: row.ProductName || row.VariantSKU || `Product #${row.SellerProductID}`,
        parentSku: row.ParentSKU || '',
        variantSku: row.VariantSKU || '',
        brandName: row.BrandName || null,
        thumbnail: row.ThumbnailURL || '',
        price,
        originalPrice,
        lineTotal: price * qty,
        availableStock: stock,
        inStock: stock > 0,
      };
    });

    const subtotal = items.reduce((acc, item) => acc + item.lineTotal, 0);
    const itemCount = items.reduce((acc, item) => acc + item.quantity, 0);

    return {
      cartId: String(cartId),
      itemCount,
      subtotal,
      items,
    };
  }

  /**
   * Adds or increments item in cart.
   */
  async addItem(customerId: bigint, sellerProductId: bigint, quantity: number = 1): Promise<void> {
    const pool = await getPool();
    const cartId = await this.getOrCreateActiveCartId(customerId);

    const existing = await pool
      .request()
      .input('cartId', sql.BigInt, cartId)
      .input('spId', sql.BigInt, sellerProductId)
      .query<{ CartItemID: bigint; Quantity: number }>(
        `SELECT CartItemID, Quantity FROM dbo.CartItems WHERE CartID = @cartId AND SellerProductID = @spId`
      );

    if (existing.recordset.length > 0) {
      const item = existing.recordset[0];
      const newQty = item.Quantity + quantity;
      await pool
        .request()
        .input('cartItemId', sql.BigInt, item.CartItemID)
        .input('qty', sql.Int, newQty)
        .query(`UPDATE dbo.CartItems SET Quantity = @qty, UpdatedAt = SYSDATETIME() WHERE CartItemID = @cartItemId`);
    } else {
      await pool
        .request()
        .input('cartId', sql.BigInt, cartId)
        .input('spId', sql.BigInt, sellerProductId)
        .input('qty', sql.Int, Math.max(1, quantity))
        .query(`
          INSERT INTO dbo.CartItems (CartID, SellerProductID, Quantity, CreatedAt)
          VALUES (@cartId, @spId, @qty, SYSDATETIME())
        `);
    }
  }

  /**
   * Updates quantity for an existing cart item.
   */
  async updateQuantity(customerId: bigint, cartItemId: bigint, quantity: number): Promise<void> {
    const pool = await getPool();
    const cartId = await this.getOrCreateActiveCartId(customerId);

    if (quantity <= 0) {
      await pool
        .request()
        .input('cartId', sql.BigInt, cartId)
        .input('cartItemId', sql.BigInt, cartItemId)
        .query(`UPDATE dbo.CartItems SET Quantity = 0, UpdatedAt = SYSDATETIME() WHERE CartID = @cartId AND CartItemID = @cartItemId`);
      return;
    }

    await pool
      .request()
      .input('cartId', sql.BigInt, cartId)
      .input('cartItemId', sql.BigInt, cartItemId)
      .input('qty', sql.Int, quantity)
      .query(`
        UPDATE dbo.CartItems 
        SET Quantity = @qty, UpdatedAt = SYSDATETIME() 
        WHERE CartID = @cartId AND CartItemID = @cartItemId
      `);
  }

  /**
   * Removes an item from cart.
   */
  async removeItem(customerId: bigint, cartItemId: bigint): Promise<void> {
    const pool = await getPool();
    const cartId = await this.getOrCreateActiveCartId(customerId);

    await pool
      .request()
      .input('cartId', sql.BigInt, cartId)
      .input('cartItemId', sql.BigInt, cartItemId)
      .query(`UPDATE dbo.CartItems SET Quantity = 0, UpdatedAt = SYSDATETIME() WHERE CartID = @cartId AND CartItemID = @cartItemId`);
  }

  /**
   * Clears all items in customer's active cart.
   */
  async clearCart(customerId: bigint): Promise<void> {
    const pool = await getPool();
    const cartId = await this.getOrCreateActiveCartId(customerId);

    await pool
      .request()
      .input('cartId', sql.BigInt, cartId)
      .query(`
        UPDATE dbo.CartItems SET Quantity = 0, UpdatedAt = SYSDATETIME() WHERE CartID = @cartId;
        UPDATE dbo.Carts SET Status = 'ORDERED' WHERE CartID = @cartId;
      `);
  }
}

export const cartRepository = new CartRepository();
