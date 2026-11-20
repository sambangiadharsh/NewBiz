-- Migration: ProductReviews, ProductReviewAssets, ProductReviewVotes
-- Anti-Spam Verified Purchase Reviews, Star Ratings, UGC Images & Helpful Votes

IF OBJECT_ID(N'dbo.ProductReviews', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ProductReviews (
        ReviewID BIGINT IDENTITY(1,1) NOT NULL,
        ProductID BIGINT NOT NULL,              -- ProductMasterID
        ProductVariantID BIGINT NULL,          -- Specific variant purchased (e.g. Red, Size XL)
        CustomerID BIGINT NOT NULL,
        OrderID BIGINT NULL,                   -- Proof of purchase
        OrderItemID BIGINT NULL,
        Rating TINYINT NOT NULL CHECK (Rating BETWEEN 1 AND 5),
        Title NVARCHAR(150) NULL,
        Comment NVARCHAR(MAX) NULL,
        Status VARCHAR(20) NOT NULL DEFAULT 'APPROVED', -- APPROVED, FLAGGED, REJECTED
        IsVerifiedPurchase BIT NOT NULL DEFAULT 1,
        HelpfulVotesCount INT NOT NULL DEFAULT 0,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2 NULL,
        CONSTRAINT PK_ProductReviews PRIMARY KEY CLUSTERED (ReviewID),
        CONSTRAINT UQ_Customer_Product_Review UNIQUE (CustomerID, ProductID)
    );

    CREATE NONCLUSTERED INDEX IX_ProductReviews_Product ON dbo.ProductReviews (ProductID, Status, CreatedAt DESC);
    CREATE NONCLUSTERED INDEX IX_ProductReviews_Customer ON dbo.ProductReviews (CustomerID);
    PRINT 'ProductReviews table created successfully.';
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
    PRINT 'ProductReviewAssets table created successfully.';
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
    PRINT 'ProductReviewVotes table created successfully.';
END;

