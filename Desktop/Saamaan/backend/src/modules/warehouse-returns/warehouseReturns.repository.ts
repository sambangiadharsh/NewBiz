import { getPool, sql } from '../../database/db.js';

export class WarehouseReturnsRepository {
  /**
   * Fetch paginated list of customer returns routed to this warehouse.
   */
  async getReturnsList(
    warehouseId: bigint,
    params: {
      search?: string;
      status?: string;
      page: number;
      limit: number;
    }
  ) {
    const pool = await getPool();
    const req = pool.request();
    const offset = (params.page - 1) * params.limit;
    req.input('whId', sql.BigInt, warehouseId);
    req.input('offset', sql.Int, offset);
    req.input('limit', sql.Int, params.limit);

    // Route condition: explicitly routed to this warehouse or fulfilled by this warehouse
    let whereSql = `(
      (rr.DestinationType = 'WAREHOUSE' AND rr.DestinationID = @whId)
      OR (rr.DestinationID IS NULL AND f.WarehouseID = @whId)
    )`;

    if (params.search && params.search.trim()) {
      req.input('search', sql.NVarChar, `%${params.search.trim()}%`);
      whereSql += ` AND (
        rr.RequestNumber LIKE @search OR
        o.OrderNumber LIKE @search OR
        pm.ProductName LIKE @search OR
        pv.VariantSKU LIKE @search OR
        c.FirstName LIKE @search OR
        c.LastName LIKE @search OR
        rr.TrackingNumber LIKE @search
      )`;
    }

    if (params.status && params.status !== 'ALL') {
      const s = params.status.toUpperCase();
      if ([
        'REQUESTED',
        'APPROVED',
        'RECEIVED',
        'QC_PASSED',
        'QC_FAILED',
        'REFUNDED',
        'REPLACED',
        'REJECTED',
        'CANCELLED',
      ].includes(s)) {
        req.input('status', sql.VarChar(30), s);
        whereSql += ` AND rr.Status = @status`;
      }
    }

    const query = `
      SELECT 
        rr.ReturnRequestID,
        rr.RequestNumber,
        rr.OrderID,
        rr.OrderItemID,
        rr.CustomerID,
        rr.SellerProductID,
        rr.RequestType,
        rr.ReasonCategory,
        rr.ReasonDescription,
        rr.Quantity,
        rr.ResolutionType,
        rr.RefundMethod,
        rr.Status,
        rr.DestinationType,
        rr.DestinationID,
        rr.QCStatus,
        rr.QCNotes,
        rr.QCGrade,
        rr.RestockedInventory,
        rr.AdminComments,
        rr.PickupAddressJson,
        rr.TrackingNumber,
        rr.CreatedAt,
        rr.UpdatedAt,
        o.OrderNumber,
        o.Status AS OrderStatus,
        CONCAT(c.FirstName, ' ', c.LastName) AS CustomerName,
        c.Email AS CustomerEmail,
        c.PhoneNumber AS CustomerPhone,
        pm.ProductName,
        pv.VariantSKU,
        sp.SellerSKU,
        s.TradeName AS SellerName,
        rp.PolicyCode,
        rp.PolicyName,
        rp.RequiresTechnicianCheck,
        (
          SELECT rra.AssetURL
          FROM dbo.ReturnRequestAssets rra
          WHERE rra.ReturnRequestID = rr.ReturnRequestID
          FOR JSON PATH
        ) AS AssetsJson,
        COUNT(1) OVER() AS TotalCount
      FROM dbo.ReturnRequests rr
      JOIN dbo.Orders o ON rr.OrderID = o.OrderID
      JOIN dbo.Customers c ON rr.CustomerID = c.CustomerID
      JOIN dbo.OrderItems oi ON rr.OrderItemID = oi.OrderItemID
      LEFT JOIN dbo.Fulfillments f ON oi.FulfillmentID = f.FulfillmentID
      JOIN dbo.SellerProducts sp ON oi.SellerProductID = sp.SellerProductID
      JOIN dbo.Sellers s ON sp.SellerID = s.SellerID
      LEFT JOIN dbo.ProductVariants pv ON sp.ProductVariantID = pv.ProductVariantID
      LEFT JOIN dbo.ProductMaster pm ON pv.ProductMasterID = pm.ProductID
      OUTER APPLY (
        SELECT TOP 1 cat.DefaultReturnPolicyID
        FROM dbo.ProductCategories pc
        JOIN dbo.Categories cat ON pc.CategoryID = cat.CategoryID
        WHERE pc.ProductID = pm.ProductID
        ORDER BY pc.ProductCategoryID ASC
      ) cat_pol
      LEFT JOIN dbo.ReturnReplacementPolicies rp ON rp.PolicyID = COALESCE(pm.ReturnPolicyID, cat_pol.DefaultReturnPolicyID, 1)
      WHERE ${whereSql}
      ORDER BY rr.ReturnRequestID DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;
    `;

    const summaryQuery = `
      SELECT 
        COUNT(1) AS TotalCount,
        SUM(CASE WHEN rr.Status = 'APPROVED' THEN 1 ELSE 0 END) AS ApprovedCount,
        SUM(CASE WHEN rr.Status = 'RECEIVED' THEN 1 ELSE 0 END) AS ReceivedCount,
        SUM(CASE WHEN rr.Status = 'QC_PASSED' THEN 1 ELSE 0 END) AS QcPassedCount,
        SUM(CASE WHEN rr.Status = 'QC_FAILED' THEN 1 ELSE 0 END) AS QcFailedCount,
        SUM(CASE WHEN rr.Status IN ('REFUNDED', 'REPLACED') THEN 1 ELSE 0 END) AS ResolvedCount
      FROM dbo.ReturnRequests rr
      JOIN dbo.OrderItems oi ON rr.OrderItemID = oi.OrderItemID
      LEFT JOIN dbo.Fulfillments f ON oi.FulfillmentID = f.FulfillmentID
      WHERE (
        (rr.DestinationType = 'WAREHOUSE' AND rr.DestinationID = @whId)
        OR (rr.DestinationID IS NULL AND f.WarehouseID = @whId)
      );
    `;

    const sumReq = pool.request().input('whId', sql.BigInt, warehouseId);
    const [result, summaryRes] = await Promise.all([
      req.query(query),
      sumReq.query(summaryQuery),
    ]);

    const total = result.recordset.length > 0 ? Number(result.recordset[0].TotalCount) : 0;
    const summaryRow = summaryRes.recordset[0] || {};

    const items = result.recordset.map((r: any) => ({
      returnRequestId: String(r.ReturnRequestID),
      requestNumber: r.RequestNumber,
      orderId: String(r.OrderID),
      orderItemId: String(r.OrderItemID),
      orderNumber: r.OrderNumber,
      orderStatus: r.OrderStatus,
      customerName: r.CustomerName,
      customerEmail: r.CustomerEmail,
      customerPhone: r.CustomerPhone,
      productName: r.ProductName,
      variantSku: r.VariantSKU || 'N/A',
      sellerSku: r.SellerSKU || 'N/A',
      sellerName: r.SellerName,
      quantity: Number(r.Quantity || 1),
      requestType: r.RequestType,
      reasonCategory: r.ReasonCategory,
      reasonDescription: r.ReasonDescription,
      resolutionType: r.ResolutionType,
      status: r.Status,
      destinationType: r.DestinationType,
      destinationId: String(r.DestinationID || ''),
      qcStatus: r.QCStatus || 'PENDING',
      qcNotes: r.QCNotes || null,
      qcGrade: r.QCGrade || null,
      restockedInventory: Boolean(r.RestockedInventory),
      adminComments: r.AdminComments,
      pickupAddress: r.PickupAddressJson ? JSON.parse(r.PickupAddressJson) : null,
      trackingNumber: r.TrackingNumber,
      policy: {
        policyCode: r.PolicyCode,
        policyName: r.PolicyName,
        requiresTechnicianCheck: Boolean(r.RequiresTechnicianCheck),
      },
      assets: r.AssetsJson ? JSON.parse(r.AssetsJson).map((a: any) => a.AssetURL) : [],
      createdAt: r.CreatedAt,
      updatedAt: r.UpdatedAt,
    }));

    return {
      items,
      total,
      summary: {
        total: Number(summaryRow.TotalCount || 0),
        approved: Number(summaryRow.ApprovedCount || 0),
        received: Number(summaryRow.ReceivedCount || 0),
        qcPassed: Number(summaryRow.QcPassedCount || 0),
        qcFailed: Number(summaryRow.QcFailedCount || 0),
        resolved: Number(summaryRow.ResolvedCount || 0),
      },
    };
  }

  /**
   * Mark parcel as physically received at the warehouse dock.
   */
  async markReceivedAtDock(
    warehouseId: bigint,
    returnRequestId: bigint,
    trackingNumber?: string,
    receiverNotes?: string
  ) {
    const pool = await getPool();

    // Verify parcel destination matches this warehouse
    const checkRes = await pool
      .request()
      .input('whId', sql.BigInt, warehouseId)
      .input('retId', sql.BigInt, returnRequestId)
      .query(`
        SELECT rr.ReturnRequestID, rr.Status, rr.RequestNumber
        FROM dbo.ReturnRequests rr
        JOIN dbo.OrderItems oi ON rr.OrderItemID = oi.OrderItemID
        LEFT JOIN dbo.Fulfillments f ON oi.FulfillmentID = f.FulfillmentID
        WHERE rr.ReturnRequestID = @retId
          AND (
            (rr.DestinationType = 'WAREHOUSE' AND rr.DestinationID = @whId)
            OR (rr.DestinationID IS NULL AND f.WarehouseID = @whId)
          );
      `);

    if (checkRes.recordset.length === 0) {
      throw new Error('Return ticket not found or not assigned to this warehouse destination');
    }

    const res = await pool
      .request()
      .input('retId', sql.BigInt, returnRequestId)
      .input('tracking', sql.NVarChar(100), trackingNumber || null)
      .input('notes', sql.NVarChar(1000), receiverNotes || null)
      .query(`
        UPDATE dbo.ReturnRequests
        SET 
          Status = 'RECEIVED',
          TrackingNumber = COALESCE(@tracking, TrackingNumber),
          AdminComments = CASE 
            WHEN @notes IS NOT NULL THEN CONCAT(ISNULL(AdminComments, ''), ' [Dock Received: ', @notes, ']')
            ELSE AdminComments 
          END,
          UpdatedAt = SYSUTCDATETIME()
        OUTPUT INSERTED.ReturnRequestID, INSERTED.RequestNumber, INSERTED.Status, INSERTED.UpdatedAt
        WHERE ReturnRequestID = @retId;
      `);

    return res.recordset[0] || null;
  }

  /**
   * Submit physical QC inspection decision and auto-restock if Grade A.
   */
  async submitQCInspection(
    warehouseId: bigint,
    data: {
      returnRequestId: bigint;
      qcDecision: 'PASSED' | 'FAILED';
      qcGrade: string;
      qcNotes: string;
      warehousePhotos?: string[];
      restockInventory: boolean;
      userId?: bigint;
    }
  ) {
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // 1. Fetch Return Request with lock
      const retRes = await transaction
        .request()
        .input('whId', sql.BigInt, warehouseId)
        .input('retId', sql.BigInt, data.returnRequestId)
        .query(`
          SELECT 
            rr.ReturnRequestID,
            rr.RequestNumber,
            rr.OrderItemID,
            rr.SellerProductID,
            rr.Quantity,
            rr.ResolutionType,
            rr.Status
          FROM dbo.ReturnRequests rr WITH (UPDLOCK)
          JOIN dbo.OrderItems oi ON rr.OrderItemID = oi.OrderItemID
          LEFT JOIN dbo.Fulfillments f ON oi.FulfillmentID = f.FulfillmentID
          WHERE rr.ReturnRequestID = @retId
            AND (
              (rr.DestinationType = 'WAREHOUSE' AND rr.DestinationID = @whId)
              OR (rr.DestinationID IS NULL AND f.WarehouseID = @whId)
            );
        `);

      if (retRes.recordset.length === 0) {
        throw new Error('Return ticket not found or not assigned to this warehouse');
      }

      const ret = retRes.recordset[0];
      const nextStatus = data.qcDecision === 'PASSED' ? 'QC_PASSED' : 'QC_FAILED';
      const shouldRestock = Boolean(data.qcDecision === 'PASSED' && data.restockInventory);

      // 2. Update Return Ticket
      await transaction
        .request()
        .input('retId', sql.BigInt, data.returnRequestId)
        .input('status', sql.VarChar(30), nextStatus)
        .input('qcStatus', sql.VarChar(30), data.qcDecision)
        .input('qcGrade', sql.VarChar(30), data.qcGrade)
        .input('qcNotes', sql.NVarChar(1000), data.qcNotes)
        .input('restockInv', sql.Bit, shouldRestock ? 1 : 0)
        .query(`
          UPDATE dbo.ReturnRequests
          SET 
            Status = @status,
            QCStatus = @qcStatus,
            QCGrade = @qcGrade,
            QCNotes = @qcNotes,
            RestockedInventory = @restockInv,
            UpdatedAt = SYSUTCDATETIME()
          WHERE ReturnRequestID = @retId;
        `);

      // 3. Save warehouse unboxing proof photos if provided
      if (data.warehousePhotos && data.warehousePhotos.length > 0) {
        for (const photoUrl of data.warehousePhotos) {
          if (photoUrl && typeof photoUrl === 'string') {
            await transaction
              .request()
              .input('retId', sql.BigInt, data.returnRequestId)
              .input('url', sql.NVarChar(1000), photoUrl)
              .query(`
                INSERT INTO dbo.ReturnRequestAssets (ReturnRequestID, AssetURL, CreatedAt)
                VALUES (@retId, @url, SYSUTCDATETIME());
              `);
          }
        }
      }

      // 4. If QC Passed and Restock requested -> Increment Warehouse Physical Inventory
      if (shouldRestock) {
        const spId = BigInt(ret.SellerProductID);
        const qtyToRestock = Number(ret.Quantity || 1);

        // Find or create WarehouseProducts shelf mapping
        let wpId: bigint;
        const wpCheck = await transaction
          .request()
          .input('spId', sql.BigInt, spId)
          .input('whId', sql.BigInt, warehouseId)
          .query(`
            SELECT WarehouseProductID 
            FROM dbo.WarehouseProducts 
            WHERE SellerProductID = @spId AND WarehouseID = @whId;
          `);

        if (wpCheck.recordset.length > 0) {
          wpId = BigInt(wpCheck.recordset[0].WarehouseProductID);
        } else {
          const insertWp = await transaction
            .request()
            .input('spId', sql.BigInt, spId)
            .input('whId', sql.BigInt, warehouseId)
            .input('whSku', sql.NVarChar(100), `WH-SP${spId}`)
            .input('userId', sql.BigInt, data.userId || null)
            .query(`
              INSERT INTO dbo.WarehouseProducts (
                WarehouseID, SellerProductID, WarehouseSKU, Status, CreatedAt, CreatedBy
              )
              OUTPUT INSERTED.WarehouseProductID
              VALUES (@whId, @spId, @whSku, 'ACTIVE', SYSUTCDATETIME(), @userId);
            `);
          wpId = BigInt(insertWp.recordset[0].WarehouseProductID);
        }

        // Find or create Inventory record
        const invCheck = await transaction
          .request()
          .input('wpId', sql.BigInt, wpId)
          .query(`
            SELECT InventoryID, PhysicalQuantity 
            FROM dbo.Inventory WITH (UPDLOCK)
            WHERE WarehouseProductID = @wpId;
          `);

        if (invCheck.recordset.length === 0) {
          await transaction
            .request()
            .input('wpId', sql.BigInt, wpId)
            .input('physQty', sql.Int, qtyToRestock)
            .input('userId', sql.BigInt, data.userId || null)
            .query(`
              INSERT INTO dbo.Inventory (
                WarehouseProductID, PhysicalQuantity, ReservedQuantity,
                DamagedQuantity, SafetyStockQuantity, UpdatedAt, UpdatedBy
              )
              VALUES (@wpId, @physQty, 0, 0, 10, SYSUTCDATETIME(), @userId);
            `);
        } else {
          const currentPhys = Number(invCheck.recordset[0].PhysicalQuantity || 0);
          const newPhys = currentPhys + qtyToRestock;
          const invId = BigInt(invCheck.recordset[0].InventoryID);

          await transaction
            .request()
            .input('invId', sql.BigInt, invId)
            .input('newPhys', sql.Int, newPhys)
            .input('userId', sql.BigInt, data.userId || null)
            .query(`
              UPDATE dbo.Inventory
              SET PhysicalQuantity = @newPhys,
                  UpdatedAt = SYSUTCDATETIME(),
                  UpdatedBy = @userId
              WHERE InventoryID = @invId;
            `);
        }
      }

      await transaction.commit();

      return {
        success: true,
        returnRequestId: String(ret.ReturnRequestID),
        requestNumber: ret.RequestNumber,
        status: nextStatus,
        qcStatus: data.qcDecision,
        qcGrade: data.qcGrade,
        restocked: shouldRestock,
        message: `QC inspection completed: Marked as ${nextStatus}${shouldRestock ? ' and restocked into warehouse inventory' : ''}.`,
      };
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }
}

export const warehouseReturnsRepository = new WarehouseReturnsRepository();

