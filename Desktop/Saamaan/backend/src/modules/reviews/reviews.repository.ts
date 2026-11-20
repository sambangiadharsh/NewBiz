import { getPool, sql } from '../../database/db.js';
import { NotFoundError } from '../../utils/errors.js';

export interface ProductReviewSummary {
  productId: string;
  totalReviews: number;
  averageRating: number;
  ratingDistribution: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
  recommendedPercentage: number;
}

export interface ReviewItem {
  reviewId: string;
  productId: string;
  customerId: string;
  customerName: string;
  rating: number;
  title: string | null;
  comment: string | null;
  status: string;
  isVerifiedPurchase: boolean;
  helpfulVotesCount: number;
  hasVotedHelpful?: boolean;
  createdAt: Date;
  updatedAt: Date | null;
  variant?: {
    variantId: string;
    variantSku: string;
  } | null;
  images: {
    assetId: string;
    url: string;
  }[];
}

export class ReviewsRepository {
  private schemaInitialized = false;

  /**
   * Fail-safe self-healing schema initialization.
   */
  async ensureSchema() {
    if (this.schemaInitialized) return;
    const pool = await getPool();
    await pool.request().query(`
      IF OBJECT_ID(N'dbo.ProductReviews', N'U') IS NULL
      BEGIN
          CREATE TABLE dbo.ProductReviews (
              ReviewID BIGINT IDENTITY(1,1) NOT NULL,
              ProductID BIGINT NOT NULL,
              ProductVariantID BIGINT NULL,
              CustomerID BIGINT NOT NULL,
              OrderID BIGINT NULL,
              OrderItemID BIGINT NULL,
              Rating TINYINT NOT NULL CHECK (Rating BETWEEN 1 AND 5),
              Title NVARCHAR(150) NULL,
              Comment NVARCHAR(MAX) NULL,
              Status VARCHAR(20) NOT NULL DEFAULT 'APPROVED',
              IsVerifiedPurchase BIT NOT NULL DEFAULT 1,
              HelpfulVotesCount INT NOT NULL DEFAULT 0,
              CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
              UpdatedAt DATETIME2 NULL,
              CONSTRAINT PK_ProductReviews PRIMARY KEY CLUSTERED (ReviewID),
              CONSTRAINT UQ_Customer_Product_Review UNIQUE (CustomerID, ProductID)
          );

          CREATE NONCLUSTERED INDEX IX_ProductReviews_Product ON dbo.ProductReviews (ProductID, Status, CreatedAt DESC);
          CREATE NONCLUSTERED INDEX IX_ProductReviews_Customer ON dbo.ProductReviews (CustomerID);
      END;

      IF OBJECT_ID(N'dbo.ProductReviewAssets', N'U') IS NULL
      BEGIN
          CREATE TABLE dbo.ProductReviewAssets (
              ReviewAssetID BIGINT IDENTITY(1,1) NOT NULL,
              ReviewID BIGINT NOT NULL,
              AssetURL NVARCHAR(1000) NOT NULL,
              DisplayOrder INT NOT NULL DEFAULT 1,
              CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
              CONSTRAINT PK_ProductReviewAssets PRIMARY KEY CLUSTERED (ReviewAssetID)
          );

          CREATE NONCLUSTERED INDEX IX_ProductReviewAssets_Review ON dbo.ProductReviewAssets (ReviewID);
      END;

      IF OBJECT_ID(N'dbo.ProductReviewVotes', N'U') IS NULL
      BEGIN
          CREATE TABLE dbo.ProductReviewVotes (
              ReviewVoteID BIGINT IDENTITY(1,1) NOT NULL,
              ReviewID BIGINT NOT NULL,
              CustomerID BIGINT NOT NULL,
              IsHelpful BIT NOT NULL DEFAULT 1,
              CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
              CONSTRAINT PK_ProductReviewVotes PRIMARY KEY CLUSTERED (ReviewVoteID),
              CONSTRAINT UQ_Review_Customer_Vote UNIQUE (ReviewID, CustomerID)
          );

          CREATE NONCLUSTERED INDEX IX_ProductReviewVotes_Review ON dbo.ProductReviewVotes (ReviewID);
      END;
    `);
    this.schemaInitialized = true;
  }

  /**
   * Check if a customer is eligible to write a verified review.
   */
  async checkReviewEligibility(customerId: bigint, productId: bigint) {
    await this.ensureSchema();
    const pool = await getPool();

    // 1. Check if already reviewed
    const existing = await pool
      .request()
      .input('customerId', sql.BigInt, customerId)
      .input('productId', sql.BigInt, productId)
      .query<{ ReviewID: bigint; Rating: number; Title: string; Comment: string; Status: string; PhotosJson: string }>(`
        SELECT 
          r.ReviewID, 
          r.Rating, 
          r.Title, 
          r.Comment, 
          r.Status,
          (
            SELECT pa.ReviewAssetID AS assetId, pa.AssetURL AS url
            FROM dbo.ProductReviewAssets pa
            WHERE pa.ReviewID = r.ReviewID
            ORDER BY pa.DisplayOrder ASC
            FOR JSON PATH
          ) AS PhotosJson
        FROM dbo.ProductReviews r
        WHERE r.CustomerID = @customerId AND r.ProductID = @productId;
      `);

    if (existing.recordset.length > 0) {
      const row = existing.recordset[0];
      let images: { assetId?: string; url: string }[] = [];
      try {
        if (row.PhotosJson) {
          images = JSON.parse(row.PhotosJson);
        }
      } catch {
        images = [];
      }

      return {
        canReview: false,
        canEdit: true,
        alreadyReviewed: true,
        existingReview: {
          reviewId: String(row.ReviewID),
          rating: Number(row.Rating),
          title: row.Title,
          comment: row.Comment,
          status: row.Status,
          images,
        },
      };
    }

    // 2. Check if customer ordered and received this product
    const orderCheck = await pool
      .request()
      .input('customerId', sql.BigInt, customerId)
      .input('productId', sql.BigInt, productId)
      .query<{
        OrderID: bigint;
        OrderItemID: bigint;
        ProductVariantID: bigint;
        VariantSKU: string;
        OrderStatus: string;
      }>(`
        SELECT TOP 1 
          o.OrderID,
          oi.OrderItemID,
          sp.ProductVariantID,
          pv.VariantSKU,
          o.Status AS OrderStatus
        FROM dbo.OrderItems oi
        JOIN dbo.Orders o ON oi.OrderID = o.OrderID
        JOIN dbo.SellerProducts sp ON oi.SellerProductID = sp.SellerProductID
        JOIN dbo.ProductVariants pv ON sp.ProductVariantID = pv.ProductVariantID
        WHERE o.CustomerID = @customerId 
          AND pv.ProductMasterID = @productId
          AND o.Status IN ('DELIVERED', 'CONFIRMED', 'SHIPPED')
        ORDER BY o.CreatedAt DESC;
      `);

    if (orderCheck.recordset.length === 0) {
      return {
        canReview: false,
        alreadyReviewed: false,
        reason: 'Only verified customers who ordered this product can write a review.',
      };
    }

    const orderRow = orderCheck.recordset[0];
    return {
      canReview: true,
      alreadyReviewed: false,
      orderId: String(orderRow.OrderID),
      orderItemId: String(orderRow.OrderItemID),
      productVariantId: String(orderRow.ProductVariantID),
      variantSku: orderRow.VariantSKU,
    };
  }

  /**
   * Retrieves aggregate rating score and star breakdown.
   */
  async getProductRatingSummary(productId: bigint): Promise<ProductReviewSummary> {
    await this.ensureSchema();
    const pool = await getPool();
    const result = await pool.request().input('productId', sql.BigInt, productId).query<{
      TotalReviews: number;
      AverageRating: number;
      Rating5: number;
      Rating4: number;
      Rating3: number;
      Rating2: number;
      Rating1: number;
    }>(`
      SELECT 
        COUNT(1) AS TotalReviews,
        ISNULL(AVG(CAST(Rating AS DECIMAL(3,2))), 0) AS AverageRating,
        ISNULL(SUM(CASE WHEN Rating = 5 THEN 1 ELSE 0 END), 0) AS Rating5,
        ISNULL(SUM(CASE WHEN Rating = 4 THEN 1 ELSE 0 END), 0) AS Rating4,
        ISNULL(SUM(CASE WHEN Rating = 3 THEN 1 ELSE 0 END), 0) AS Rating3,
        ISNULL(SUM(CASE WHEN Rating = 2 THEN 1 ELSE 0 END), 0) AS Rating2,
        ISNULL(SUM(CASE WHEN Rating = 1 THEN 1 ELSE 0 END), 0) AS Rating1
      FROM dbo.ProductReviews
      WHERE ProductID = @productId AND Status = 'APPROVED';
    `);

    const r = result.recordset[0];
    const total = Number(r?.TotalReviews || 0);
    const avg = Number(r?.AverageRating || 0);
    const r5 = Number(r?.Rating5 || 0);
    const r4 = Number(r?.Rating4 || 0);
    const positiveReviews = r5 + r4;
    const recommendedPercentage = total > 0 ? Math.round((positiveReviews / total) * 100) : 100;

    return {
      productId: String(productId),
      totalReviews: total,
      averageRating: Number(avg.toFixed(1)),
      ratingDistribution: {
        5: r5,
        4: r4,
        3: Number(r?.Rating3 || 0),
        2: Number(r?.Rating2 || 0),
        1: Number(r?.Rating1 || 0),
      },
      recommendedPercentage,
    };
  }

  /**
   * Retrieves paginated reviews with customer names, photo assets, and vote status.
   */
  async getProductReviews(params: {
    productId: bigint;
    page: number;
    limit: number;
    rating?: number;
    sortBy?: 'recent' | 'highest' | 'lowest' | 'helpful';
    currentCustomerId?: bigint | null;
  }): Promise<{ items: ReviewItem[]; total: number }> {
    await this.ensureSchema();
    const pool = await getPool();
    const req = pool.request();
    req.input('productId', sql.BigInt, params.productId);

    const whereClauses: string[] = ['r.ProductID = @productId', "r.Status = 'APPROVED'"];

    if (params.rating && params.rating >= 1 && params.rating <= 5) {
      req.input('ratingFilter', sql.TinyInt, params.rating);
      whereClauses.push('r.Rating = @ratingFilter');
    }

    let orderSql = 'r.CreatedAt DESC';
    if (params.sortBy === 'highest') {
      orderSql = 'r.Rating DESC, r.CreatedAt DESC';
    } else if (params.sortBy === 'lowest') {
      orderSql = 'r.Rating ASC, r.CreatedAt DESC';
    } else if (params.sortBy === 'helpful') {
      orderSql = 'r.HelpfulVotesCount DESC, r.CreatedAt DESC';
    }

    const offset = (params.page - 1) * params.limit;
    req.input('offset', sql.Int, offset);
    req.input('limit', sql.Int, params.limit);

    if (params.currentCustomerId) {
      req.input('currCustomerId', sql.BigInt, params.currentCustomerId);
    }

    const query = `
      SELECT 
        r.ReviewID,
        r.ProductID,
        r.CustomerID,
        CONCAT(c.FirstName, ' ', LEFT(c.LastName, 1), '.') AS CustomerDisplayName,
        r.ProductVariantID,
        pv.VariantSKU,
        r.Rating,
        r.Title,
        r.Comment,
        r.Status,
        r.IsVerifiedPurchase,
        r.HelpfulVotesCount,
        r.CreatedAt,
        r.UpdatedAt,
        ${
          params.currentCustomerId
            ? `CASE WHEN EXISTS (SELECT 1 FROM dbo.ProductReviewVotes rv WHERE rv.ReviewID = r.ReviewID AND rv.CustomerID = @currCustomerId) THEN 1 ELSE 0 END`
            : '0'
        } AS HasVotedHelpful,
        (
          SELECT pa.ReviewAssetID AS assetId, pa.AssetURL AS url
          FROM dbo.ProductReviewAssets pa
          WHERE pa.ReviewID = r.ReviewID
          ORDER BY pa.DisplayOrder ASC
          FOR JSON PATH
        ) AS ImagesJson,
        COUNT(1) OVER() AS TotalCount
      FROM dbo.ProductReviews r
      JOIN dbo.Customers c ON r.CustomerID = c.CustomerID
      LEFT JOIN dbo.ProductVariants pv ON r.ProductVariantID = pv.ProductVariantID
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY ${orderSql}
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;
    `;

    const result = await req.query(query);
    const total = result.recordset.length > 0 ? Number(result.recordset[0].TotalCount) : 0;

    const items: ReviewItem[] = result.recordset.map((row) => {
      let images: { assetId: string; url: string }[] = [];
      if (row.ImagesJson) {
        try {
          images = JSON.parse(row.ImagesJson);
        } catch {
          images = [];
        }
      }

      return {
        reviewId: String(row.ReviewID),
        productId: String(row.ProductID),
        customerId: String(row.CustomerID),
        customerName: row.CustomerDisplayName || 'Verified Buyer',
        rating: Number(row.Rating),
        title: row.Title,
        comment: row.Comment,
        status: row.Status,
        isVerifiedPurchase: Boolean(row.IsVerifiedPurchase),
        helpfulVotesCount: Number(row.HelpfulVotesCount || 0),
        hasVotedHelpful: Boolean(row.HasVotedHelpful),
        createdAt: row.CreatedAt,
        updatedAt: row.UpdatedAt,
        variant: row.ProductVariantID
          ? {
              variantId: String(row.ProductVariantID),
              variantSku: row.VariantSKU || '',
            }
          : null,
        images,
      };
    });

    return { items, total };
  }

  /**
   * Creates a review with optional user photos.
   */
  async createReview(data: {
    productId: bigint;
    customerId: bigint;
    orderId?: bigint | null;
    orderItemId?: bigint | null;
    productVariantId?: bigint | null;
    rating: number;
    title?: string | null;
    comment?: string | null;
    imageUrls?: string[];
  }): Promise<{ reviewId: string }> {
    await this.ensureSchema();
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const insertReq = transaction.request();
      insertReq
        .input('productId', sql.BigInt, data.productId)
        .input('customerId', sql.BigInt, data.customerId)
        .input('orderId', sql.BigInt, data.orderId || null)
        .input('orderItemId', sql.BigInt, data.orderItemId || null)
        .input('productVariantId', sql.BigInt, data.productVariantId || null)
        .input('rating', sql.TinyInt, data.rating)
        .input('title', sql.NVarChar(150), data.title?.trim() || null)
        .input('comment', sql.NVarChar(sql.MAX), data.comment?.trim() || null)
        .input('isVerified', sql.Bit, data.orderId ? 1 : 0);

      const reviewRes = await insertReq.query<{ ReviewID: bigint }>(`
        INSERT INTO dbo.ProductReviews (
          ProductID, CustomerID, OrderID, OrderItemID, ProductVariantID,
          Rating, Title, Comment, Status, IsVerifiedPurchase, HelpfulVotesCount, CreatedAt
        )
        OUTPUT INSERTED.ReviewID
        VALUES (
          @productId, @customerId, @orderId, @orderItemId, @productVariantId,
          @rating, @title, @comment, 'PENDING_APPROVAL', @isVerified, 0, SYSUTCDATETIME()
        );
      `);

      const reviewId = reviewRes.recordset[0].ReviewID;

      // Insert photos if attached
      if (data.imageUrls && data.imageUrls.length > 0) {
        for (let i = 0; i < data.imageUrls.length; i++) {
          const imgUrl = data.imageUrls[i].trim();
          if (!imgUrl) continue;

          await transaction
            .request()
            .input('revId', sql.BigInt, reviewId)
            .input('url', sql.NVarChar(1000), imgUrl)
            .input('order', sql.Int, i + 1)
            .query(`
              INSERT INTO dbo.ProductReviewAssets (ReviewID, AssetURL, DisplayOrder, CreatedAt)
              VALUES (@revId, @url, @order, SYSUTCDATETIME());
            `);
        }
      }

      await transaction.commit();
      return { reviewId: String(reviewId) };
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }

  /**
   * Updates an existing customer review and strictly resets Status to 'PENDING_APPROVAL'.
   * Prevents bait-and-switch spam attacks by requiring fresh admin approval.
   */
  async updateCustomerReview(
    reviewId: bigint,
    customerId: bigint,
    data: {
      rating: number;
      title?: string | null;
      comment?: string | null;
      imageUrls?: string[];
    }
  ): Promise<{ reviewId: string; status: string; message: string }> {
    await this.ensureSchema();
    const pool = await getPool();

    // 1. Verify existence and ownership
    const ownerCheck = await pool
      .request()
      .input('reviewId', sql.BigInt, reviewId)
      .input('customerId', sql.BigInt, customerId)
      .query<{ ReviewID: bigint; Status: string }>(`
        SELECT ReviewID, Status
        FROM dbo.ProductReviews
        WHERE ReviewID = @reviewId AND CustomerID = @customerId;
      `);

    if (ownerCheck.recordset.length === 0) {
      throw new NotFoundError('Review not found or you do not have permission to edit it');
    }

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // 2. Update core review fields and force Status = 'PENDING_APPROVAL'
      await transaction
        .request()
        .input('reviewId', sql.BigInt, reviewId)
        .input('rating', sql.TinyInt, data.rating)
        .input('title', sql.NVarChar(150), data.title?.trim() || null)
        .input('comment', sql.NVarChar(sql.MAX), data.comment?.trim() || null)
        .query(`
          UPDATE dbo.ProductReviews
          SET Rating = @rating,
              Title = @title,
              Comment = @comment,
              Status = 'PENDING_APPROVAL',
              UpdatedAt = SYSUTCDATETIME()
          WHERE ReviewID = @reviewId;
        `);

      // 3. Update photo assets if provided
      if (data.imageUrls !== undefined) {
        // Delete previous assets
        await transaction
          .request()
          .input('reviewId', sql.BigInt, reviewId)
          .query(`DELETE FROM dbo.ProductReviewAssets WHERE ReviewID = @reviewId;`);

        // Insert new assets
        if (data.imageUrls.length > 0) {
          for (let i = 0; i < data.imageUrls.length; i++) {
            const imgUrl = data.imageUrls[i].trim();
            if (!imgUrl) continue;

            await transaction
              .request()
              .input('revId', sql.BigInt, reviewId)
              .input('url', sql.NVarChar(1000), imgUrl)
              .input('order', sql.Int, i + 1)
              .query(`
                INSERT INTO dbo.ProductReviewAssets (ReviewID, AssetURL, DisplayOrder, CreatedAt)
                VALUES (@revId, @url, @order, SYSUTCDATETIME());
              `);
          }
        }
      }

      await transaction.commit();
      return {
        reviewId: String(reviewId),
        status: 'PENDING_APPROVAL',
        message: 'Review updated successfully and submitted for moderation',
      };
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }

  /**
   * Toggles helpful vote by customer.
   */
  async voteHelpful(reviewId: bigint, customerId: bigint): Promise<{ helpfulVotes: number; hasVoted: boolean }> {
    await this.ensureSchema();
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const checkRes = await transaction
        .request()
        .input('revId', sql.BigInt, reviewId)
        .input('custId', sql.BigInt, customerId)
        .query<{ ReviewVoteID: bigint }>(`
          SELECT ReviewVoteID FROM dbo.ProductReviewVotes
          WHERE ReviewID = @revId AND CustomerID = @custId;
        `);

      let hasVoted = false;

      if (checkRes.recordset.length > 0) {
        // Remove vote
        await transaction
          .request()
          .input('revId', sql.BigInt, reviewId)
          .input('custId', sql.BigInt, customerId)
          .query(`
            DELETE FROM dbo.ProductReviewVotes WHERE ReviewID = @revId AND CustomerID = @custId;
            UPDATE dbo.ProductReviews
            SET HelpfulVotesCount = CASE WHEN HelpfulVotesCount > 0 THEN HelpfulVotesCount - 1 ELSE 0 END
            WHERE ReviewID = @revId;
          `);
        hasVoted = false;
      } else {
        // Add vote
        await transaction
          .request()
          .input('revId', sql.BigInt, reviewId)
          .input('custId', sql.BigInt, customerId)
          .query(`
            INSERT INTO dbo.ProductReviewVotes (ReviewID, CustomerID, IsHelpful, CreatedAt)
            VALUES (@revId, @custId, 1, SYSUTCDATETIME());
            UPDATE dbo.ProductReviews
            SET HelpfulVotesCount = HelpfulVotesCount + 1
            WHERE ReviewID = @revId;
          `);
        hasVoted = true;
      }

      const countRes = await transaction
        .request()
        .input('revId', sql.BigInt, reviewId)
        .query<{ HelpfulVotesCount: number }>(`
          SELECT HelpfulVotesCount FROM dbo.ProductReviews WHERE ReviewID = @revId;
        `);

      await transaction.commit();
      return {
        helpfulVotes: Number(countRes.recordset[0]?.HelpfulVotesCount || 0),
        hasVoted,
      };
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }

  /**
   * Admin reviews listing for moderation.
   */
  async getAdminReviews(params: {
    page: number;
    limit: number;
    status?: string;
    search?: string;
  }) {
    await this.ensureSchema();
    const pool = await getPool();
    const req = pool.request();
    const whereClauses: string[] = ['1=1'];

    if (params.status && params.status !== 'ALL') {
      req.input('status', sql.VarChar(20), params.status);
      whereClauses.push('r.Status = @status');
    }

    if (params.search && params.search.trim() !== '') {
      req.input('search', sql.NVarChar(150), `%${params.search.trim()}%`);
      whereClauses.push(
        `(pm.ProductName LIKE @search OR c.FirstName LIKE @search OR c.LastName LIKE @search OR r.Title LIKE @search OR r.Comment LIKE @search)`
      );
    }

    const offset = (params.page - 1) * params.limit;
    req.input('offset', sql.Int, offset);
    req.input('limit', sql.Int, params.limit);

    const query = `
      SELECT 
        r.ReviewID,
        r.ProductID,
        pm.ProductName,
        r.CustomerID,
        CONCAT(c.FirstName, ' ', c.LastName) AS CustomerName,
        c.Email AS CustomerEmail,
        r.Rating,
        r.Title,
        r.Comment,
        r.Status,
        r.HelpfulVotesCount,
        r.CreatedAt,
        (
          SELECT TOP 1 pa.AssetURL 
          FROM dbo.ProductAssets pa
          LEFT JOIN dbo.ProductVariantAssets pva ON pa.ProductAssetID = pva.ProductAssetID
          WHERE pa.ProductID = r.ProductID
          ORDER BY 
            CASE WHEN r.ProductVariantID IS NOT NULL AND pva.ProductVariantID = r.ProductVariantID THEN 0 ELSE 1 END,
            pa.IsPrimary DESC, 
            pa.DisplayOrder ASC
        ) AS ProductThumbnail,
        (SELECT AssetURL FROM dbo.ProductReviewAssets WHERE ReviewID = r.ReviewID ORDER BY DisplayOrder ASC FOR JSON PATH) AS PhotosJson,
        COUNT(1) OVER() AS TotalCount
      FROM dbo.ProductReviews r
      JOIN dbo.Customers c ON r.CustomerID = c.CustomerID
      JOIN dbo.ProductMaster pm ON r.ProductID = pm.ProductID
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY 
        CASE WHEN r.Status = 'PENDING_APPROVAL' THEN 0 ELSE 1 END,
        r.CreatedAt DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;
    `;

    const result = await req.query(query);
    const total = result.recordset.length > 0 ? Number(result.recordset[0].TotalCount) : 0;

    return {
      items: result.recordset.map((row) => {
        let photos: string[] = [];
        if (row.PhotosJson) {
          try {
            photos = JSON.parse(row.PhotosJson).map((p: any) => p.AssetURL);
          } catch {}
        }

        return {
          reviewId: String(row.ReviewID),
          productId: String(row.ProductID),
          productName: row.ProductName,
          productThumbnail: row.ProductThumbnail || null,
          customerId: String(row.CustomerID),
          customerName: row.CustomerName,
          customerEmail: row.CustomerEmail,
          rating: Number(row.Rating),
          title: row.Title,
          comment: row.Comment,
          status: row.Status,
          helpfulVotesCount: Number(row.HelpfulVotesCount || 0),
          photos,
          createdAt: row.CreatedAt,
        };
      }),
      total,
    };
  }

  /**
   * Summary metrics for Admin Review Moderation Dashboard.
   */
  async getAdminReviewSummary() {
    await this.ensureSchema();
    const pool = await getPool();
    const result = await pool.request().query<{
      PendingCount: number;
      ApprovedCount: number;
      RejectedCount: number;
      TotalCount: number;
      AverageRating: number;
    }>(`
      SELECT 
        SUM(CASE WHEN Status = 'PENDING_APPROVAL' THEN 1 ELSE 0 END) AS PendingCount,
        SUM(CASE WHEN Status = 'APPROVED' THEN 1 ELSE 0 END) AS ApprovedCount,
        SUM(CASE WHEN Status = 'REJECTED' THEN 1 ELSE 0 END) AS RejectedCount,
        COUNT(1) AS TotalCount,
        ISNULL(AVG(CASE WHEN Status = 'APPROVED' THEN CAST(Rating AS DECIMAL(3,2)) ELSE NULL END), 0) AS AverageRating
      FROM dbo.ProductReviews;
    `);

    const row = result.recordset[0] || {};
    return {
      pendingCount: Number(row.PendingCount || 0),
      approvedCount: Number(row.ApprovedCount || 0),
      rejectedCount: Number(row.RejectedCount || 0),
      totalCount: Number(row.TotalCount || 0),
      averageRating: Number(Number(row.AverageRating || 0).toFixed(1)),
    };
  }

  /**
   * Admin review moderation status update.
   */
  async moderateReview(reviewId: bigint, status: 'APPROVED' | 'FLAGGED' | 'REJECTED' | 'PENDING_APPROVAL') {
    await this.ensureSchema();
    const pool = await getPool();
    await pool
      .request()
      .input('reviewId', sql.BigInt, reviewId)
      .input('status', sql.VarChar(20), status)
      .query(`
        UPDATE dbo.ProductReviews
        SET Status = @status, UpdatedAt = SYSUTCDATETIME()
        WHERE ReviewID = @reviewId;
      `);
    return { success: true, status };
  }
}

export const reviewsRepository = new ReviewsRepository();

