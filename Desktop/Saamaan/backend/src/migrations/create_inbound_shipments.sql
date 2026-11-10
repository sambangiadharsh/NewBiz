-- Migration: InboundShipments and InboundShipmentItems
-- Lean 4-status model: IN_TRANSIT, RECEIVED, DISCREPANCY, CANCELLED
-- Note: Foreign key constraints omitted to comply with DB user permission constraints

IF OBJECT_ID(N'dbo.InboundShipments', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.InboundShipments (
        InboundShipmentID BIGINT IDENTITY(1,1) NOT NULL,
        ShipmentNumber NVARCHAR(50) NOT NULL,
        SellerID BIGINT NOT NULL,
        WarehouseID BIGINT NOT NULL,
        Status VARCHAR(30) NOT NULL DEFAULT 'IN_TRANSIT', -- IN_TRANSIT, RECEIVED, DISCREPANCY, CANCELLED
        CarrierName NVARCHAR(100) NULL,
        TrackingNumber NVARCHAR(150) NULL,
        BoxCount INT NOT NULL DEFAULT 1,
        EstimatedArrivalDate DATE NULL,
        DispatchedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        ReceivedAt DATETIME2 NULL,
        GRNNumber NVARCHAR(100) NULL,
        GRNDate DATETIME2 NULL,
        Notes NVARCHAR(MAX) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CreatedBy BIGINT NULL,
        UpdatedAt DATETIME2 NULL,
        UpdatedBy BIGINT NULL,
        CONSTRAINT PK_InboundShipments PRIMARY KEY CLUSTERED (InboundShipmentID),
        CONSTRAINT UQ_InboundShipments_Number UNIQUE (ShipmentNumber)
    );

    CREATE NONCLUSTERED INDEX IX_InboundShipments_Seller ON dbo.InboundShipments (SellerID, Status);
    CREATE NONCLUSTERED INDEX IX_InboundShipments_Warehouse ON dbo.InboundShipments (WarehouseID, Status);
    PRINT 'InboundShipments table created successfully.';
END;

IF OBJECT_ID(N'dbo.InboundShipmentItems', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.InboundShipmentItems (
        InboundShipmentItemID BIGINT IDENTITY(1,1) NOT NULL,
        InboundShipmentID BIGINT NOT NULL,
        SellerProductID BIGINT NOT NULL,
        ExpectedQuantity INT NOT NULL,
        ReceivedQuantity INT NOT NULL DEFAULT 0,
        DamagedQuantity INT NOT NULL DEFAULT 0,
        ShortageQuantity INT NOT NULL DEFAULT 0,
        Remarks NVARCHAR(500) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2 NULL,
        CONSTRAINT PK_InboundShipmentItems PRIMARY KEY CLUSTERED (InboundShipmentItemID)
    );

    CREATE NONCLUSTERED INDEX IX_InboundShipmentItems_Shipment ON dbo.InboundShipmentItems (InboundShipmentID);
    CREATE NONCLUSTERED INDEX IX_InboundShipmentItems_Product ON dbo.InboundShipmentItems (SellerProductID);
    PRINT 'InboundShipmentItems table created successfully.';
END;
