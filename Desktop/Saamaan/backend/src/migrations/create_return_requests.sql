-- Migration: ReturnRequests and ReturnRequestAssets
-- Lean enterprise model: Handles Returns, Replacements, Proof Assets & Payout details

IF OBJECT_ID(N'dbo.ReturnRequests', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ReturnRequests (
        ReturnRequestID BIGINT IDENTITY(1,1) NOT NULL,
        RequestNumber NVARCHAR(50) NOT NULL,
        OrderID BIGINT NOT NULL,
        OrderItemID BIGINT NOT NULL,
        CustomerID BIGINT NOT NULL,
        SellerProductID BIGINT NOT NULL,
        RequestType VARCHAR(20) NOT NULL DEFAULT 'RETURN', -- 'RETURN', 'REPLACEMENT'
        ReasonCategory NVARCHAR(100) NOT NULL,
        ReasonDescription NVARCHAR(1000) NULL,
        Quantity INT NOT NULL DEFAULT 1,
        ResolutionType VARCHAR(20) NOT NULL DEFAULT 'REFUND', -- 'REFUND', 'REPLACEMENT'
        RefundMethod VARCHAR(30) NULL, -- 'ORIGINAL_PAYMENT', 'UPI', 'BANK_ACCOUNT'
        RefundDetailsJson NVARCHAR(MAX) NULL, -- UPI ID or Account Number/IFSC
        Status VARCHAR(30) NOT NULL DEFAULT 'REQUESTED', -- Lean 5-state model: 'REQUESTED', 'IN_PROGRESS', 'RESOLVED', 'REJECTED', 'CANCELLED'
        AdminComments NVARCHAR(1000) NULL,
        PickupAddressJson NVARCHAR(MAX) NULL,
        TrackingNumber NVARCHAR(100) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2 NULL,
        CONSTRAINT PK_ReturnRequests PRIMARY KEY CLUSTERED (ReturnRequestID),
        CONSTRAINT UQ_ReturnRequests_Number UNIQUE (RequestNumber)
    );

    CREATE NONCLUSTERED INDEX IX_ReturnRequests_Customer ON dbo.ReturnRequests (CustomerID, Status);
    CREATE NONCLUSTERED INDEX IX_ReturnRequests_Order ON dbo.ReturnRequests (OrderID, OrderItemID);
    PRINT 'ReturnRequests table created successfully.';
END;

IF OBJECT_ID(N'dbo.ReturnRequestAssets', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ReturnRequestAssets (
        ReturnAssetID BIGINT IDENTITY(1,1) NOT NULL,
        ReturnRequestID BIGINT NOT NULL,
        AssetURL NVARCHAR(1000) NOT NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_ReturnRequestAssets PRIMARY KEY CLUSTERED (ReturnAssetID)
    );

    CREATE NONCLUSTERED INDEX IX_ReturnRequestAssets_Return ON dbo.ReturnRequestAssets (ReturnRequestID);
    PRINT 'ReturnRequestAssets table created successfully.';
END;

