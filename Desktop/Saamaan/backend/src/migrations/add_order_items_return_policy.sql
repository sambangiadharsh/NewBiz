-- Migration: Add Return Policy Snapshot to OrderItems & Filtered Unique Index for Active Returns
-- Run on database: ecomgd

-- 1. Add ReturnPolicyID column to OrderItems if not exists
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'OrderItems' AND COLUMN_NAME = 'ReturnPolicyID'
)
BEGIN
    ALTER TABLE dbo.OrderItems ADD [ReturnPolicyID] INT NULL;
    PRINT 'Added ReturnPolicyID column to dbo.OrderItems';
END
GO

-- 2. Add ReturnPolicySnapshot column to OrderItems if not exists
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'OrderItems' AND COLUMN_NAME = 'ReturnPolicySnapshot'
)
BEGIN
    ALTER TABLE dbo.OrderItems ADD [ReturnPolicySnapshot] NVARCHAR(MAX) NULL;
    PRINT 'Added ReturnPolicySnapshot column to dbo.OrderItems';
END
GO

-- 3. Add Filtered Unique Index to prevent concurrent / duplicate active return requests on the same OrderItem
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes 
    WHERE name = 'UQ_Active_ReturnRequest_Per_OrderItem' 
      AND object_id = OBJECT_ID('dbo.ReturnRequests')
)
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX [UQ_Active_ReturnRequest_Per_OrderItem]
    ON dbo.ReturnRequests ([OrderItemID])
    WHERE [Status] IN ('REQUESTED', 'IN_PROGRESS');
    PRINT 'Created UQ_Active_ReturnRequest_Per_OrderItem filtered unique index on dbo.ReturnRequests';
END
GO

