-- ============================================================
-- E-COMMERCE MARKETPLACE / OMS / WMS V1
-- Microsoft SQL Server / SSMS
-- Generated from the agreed DBML design.
-- Key decisions preserved:
--   * Seller <-> Warehouse is many-to-many through SellerWarehouses
--   * ProductMaster is the customer-facing parent product; ProductVariants are sellable variant definitions
--   * Categories contain taxonomy through Product Family
--   * CategoryAttributes defines attributes for each Product Family
--   * ProductAssets belongs to ProductVariants; thumbnails are derived by storage/CDN
--   * RefreshTokens table omitted because V1 uses access tokens only
-- ============================================================

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
GO

USE [ecomgd];
GO

-- Run this inside your target database. Example:
-- USE EcommerceMarketplace;
-- GO

BEGIN TRY
    BEGIN TRANSACTION;

    CREATE TABLE [DataAuditLogs] (
    [AuditLogID] bigint IDENTITY(1,1),
    [TableName] varchar(100) NOT NULL,
    [PrimaryKeyID] bigint NOT NULL,
    [ActionType] varchar(20) NOT NULL,
    [OldData] nvarchar(max) NULL,
    [NewData] nvarchar(max) NULL,
    [ContextUserID] bigint NULL,
    [IPAddress] varchar(45) NULL,
    [UserAgent] nvarchar(500) NULL,
    [CreatedAt] datetime2 NOT NULL,
    CONSTRAINT [PK_DataAuditLogs] PRIMARY KEY CLUSTERED ([AuditLogID])
    );

    CREATE TABLE [DocumentTypes] (
    [DocumentTypeID] int IDENTITY(1,1),
    [Code] varchar(50) NOT NULL,
    [DisplayName] nvarchar(150) NOT NULL,
    [Status] varchar(20) NOT NULL DEFAULT 'ACTIVE',
    CONSTRAINT [PK_DocumentTypes] PRIMARY KEY CLUSTERED ([DocumentTypeID])
    );

    CREATE TABLE [PaymentModes] (
    [PaymentModeID] bigint IDENTITY(1,1),
    [PaymentModeCode] varchar(30) NOT NULL,
    [PaymentModeName] nvarchar(100) NOT NULL,
    [PaymentModeType] varchar(30) NOT NULL,
    [Status] varchar(20) NOT NULL,
    [CreatedAt] datetime2 NOT NULL,
    [CreatedBy] bigint,
    [UpdatedAt] datetime2,
    [UpdatedBy] bigint,
    CONSTRAINT [PK_PaymentModes] PRIMARY KEY CLUSTERED ([PaymentModeID])
    );

    CREATE TABLE [Promotions] (
    [PromotionID] bigint IDENTITY(1,1),
    [PromotionName] nvarchar(255) NOT NULL,
    [DiscountType] varchar(20) NOT NULL,
    [DiscountValue] decimal(18,2) NOT NULL,
    [StartAt] datetime2 NOT NULL,
    [EndAt] datetime2 NOT NULL,
    [Status] varchar(20) NOT NULL,
    CONSTRAINT [PK_Promotions] PRIMARY KEY CLUSTERED ([PromotionID])
    );

    CREATE TABLE [Users] (
    [UserID] bigint IDENTITY(1,1),
    [FirstName] nvarchar(100) NOT NULL,
    [LastName] nvarchar(100) NOT NULL,
    [Email] nvarchar(255) NOT NULL,
    [PhoneNumber] nvarchar(20),
    [PasswordHash] nvarchar(500),
    [Status] varchar(20) NOT NULL,
    [LastLoginAt] datetime2,
    [PasswordLastChangedAt] datetime2,
    [CreatedAt] datetime2 NOT NULL,
    [CreatedBy] bigint,
    [UpdatedAt] datetime2,
    [UpdatedBy] bigint,
    CONSTRAINT [PK_Users] PRIMARY KEY CLUSTERED ([UserID])
    );

    CREATE TABLE [Attributes] (
    [AttributeID] bigint IDENTITY(1,1),
    [AttributeName] nvarchar(100) NOT NULL,
    [DataType] varchar(20) NOT NULL,
    [Status] varchar(20) NOT NULL,
    [CreatedAt] datetime2 NOT NULL,
    [CreatedBy] bigint,
    [UpdatedAt] datetime2,
    [UpdatedBy] bigint,
    CONSTRAINT [PK_Attributes] PRIMARY KEY CLUSTERED ([AttributeID])
    );

    CREATE TABLE [AttributeValues] (
    [AttributeValueID] bigint IDENTITY(1,1),
    [AttributeID] bigint NOT NULL,
    [ValueName] nvarchar(150) NOT NULL,
    [ValueCode] varchar(50) NOT NULL,
    [Status] varchar(20) NOT NULL DEFAULT 'ACTIVE',
    [CreatedAt] datetime2 NOT NULL,
    [CreatedBy] bigint,
    [UpdatedAt] datetime2,
    [UpdatedBy] bigint,
    CONSTRAINT [PK_AttributeValues] PRIMARY KEY CLUSTERED ([AttributeValueID])
    );

    CREATE TABLE [Brands] (
    [BrandID] bigint IDENTITY(1,1),
    [BrandCode] varchar(50),
    [BrandName] nvarchar(150) NOT NULL,
    [Manufacturer] nvarchar(150),
    [Description] nvarchar(500),
    [Status] varchar(20) NOT NULL,
    [ImageURL] nvarchar(500),
    [IsFeatured] bit NOT NULL CONSTRAINT [DF_Brands_IsFeatured] DEFAULT 0,
    [DisplayOrder] int NOT NULL CONSTRAINT [DF_Brands_DisplayOrder] DEFAULT 0,
    [CreatedAt] datetime2 NOT NULL,
    [CreatedBy] bigint,
    [UpdatedAt] datetime2,
    [UpdatedBy] bigint,
    CONSTRAINT [PK_Brands] PRIMARY KEY CLUSTERED ([BrandID])
    );

    CREATE TABLE [CMSPages] (
    [PageID] bigint IDENTITY(1,1),
    [PageType] varchar(50) NOT NULL,
    [Title] nvarchar(255) NOT NULL,
    [Slug] varchar(255) NOT NULL,
    [Content] nvarchar(max) NOT NULL,
    [Status] varchar(20) NOT NULL,
    [MetaTitle] nvarchar(255),
    [MetaDescription] nvarchar(500),
    [IsSystemPage] bit DEFAULT 1,
    [CreatedAt] datetime2 NOT NULL,
    [CreatedBy] bigint,
    [UpdatedAt] datetime2,
    [UpdatedBy] bigint,
    CONSTRAINT [PK_CMSPages] PRIMARY KEY CLUSTERED ([PageID])
    );

    CREATE TABLE [Categories] (
    [CategoryID] bigint IDENTITY(1,1),
    [ParentCategoryID] bigint,
    [CategoryCode] varchar(50),
    [CategoryName] nvarchar(150) NOT NULL,
    [Description] nvarchar(500),
    [IconURL] nvarchar(1000),
    [ImageURL] nvarchar(1000),
    [BannerURL] nvarchar(1000),
    [Status] varchar(20) NOT NULL,
    [CreatedAt] datetime2 NOT NULL,
    [CreatedBy] bigint,
    [UpdatedAt] datetime2,
    [UpdatedBy] bigint,
    CONSTRAINT [PK_Categories] PRIMARY KEY CLUSTERED ([CategoryID])
    );

    CREATE TABLE [Inventory] (
    [InventoryID] bigint IDENTITY(1,1),
    [WarehouseProductID] bigint NOT NULL,
    [PhysicalQuantity] int NOT NULL,
    [ReservedQuantity] int NOT NULL,
    [DamagedQuantity] int NOT NULL,
    [SafetyStockQuantity] int NOT NULL,
    [UpdatedAt] datetime2 NOT NULL,
    [UpdatedBy] bigint,
    CONSTRAINT [PK_Inventory] PRIMARY KEY CLUSTERED ([InventoryID])
    );

    CREATE TABLE [Permissions] (
    [PermissionID] int IDENTITY(1,1),
    [PermissionCode] varchar(100) NOT NULL,
    [PermissionName] nvarchar(150) NOT NULL,
    [Description] nvarchar(500),
    [CreatedAt] datetime2 NOT NULL,
    [CreatedBy] bigint,
    CONSTRAINT [PK_Permissions] PRIMARY KEY CLUSTERED ([PermissionID])
    );

    CREATE TABLE [Roles] (
    [RoleID] int IDENTITY(1,1),
    [RoleName] nvarchar(100) NOT NULL,
    [Description] nvarchar(500),
    [Status] varchar(20) NOT NULL,
    [CreatedAt] datetime2 NOT NULL,
    [CreatedBy] bigint,
    [UpdatedAt] datetime2,
    [UpdatedBy] bigint,
    CONSTRAINT [PK_Roles] PRIMARY KEY CLUSTERED ([RoleID])
    );
    

    CREATE TABLE [Sellers] (
    [SellerID] bigint IDENTITY(1,1),
    [SellerCode] nvarchar(50) NOT NULL,
    [SellerName] nvarchar(200) NOT NULL,
    [BusinessName] nvarchar(255),
    [Email] nvarchar(255),
    [PhoneNumber] nvarchar(20),
    [InstagramURL] nvarchar(1000),
    [FacebookURL] nvarchar(1000),
    [YouTubeURL] nvarchar(1000),
    [LinkedInURL] nvarchar(1000),
    [Status] varchar(30) NOT NULL,
    [CreatedAt] datetime2 NOT NULL,
    [CreatedBy] bigint,
    [UpdatedAt] datetime2,
    [UpdatedBy] bigint,
    CONSTRAINT [PK_Sellers] PRIMARY KEY CLUSTERED ([SellerID])
    );
     
    CREATE TABLE [UOM] (
    [UOMID] bigint IDENTITY(1,1),
    [UOMCode] varchar(20) NOT NULL,
    [UOMName] nvarchar(50) NOT NULL,
    [UOMType] varchar(30) NOT NULL,
    [DecimalPrecision] int NOT NULL DEFAULT 0,
    [Status] varchar(20) NOT NULL,
    [CreatedAt] datetime2 NOT NULL,
    [CreatedBy] bigint,
    [UpdatedAt] datetime2,
    [UpdatedBy] bigint,
    CONSTRAINT [PK_UOM] PRIMARY KEY CLUSTERED ([UOMID])
    );

    CREATE TABLE [Warehouses] (
    [WarehouseID] bigint IDENTITY(1,1),
    [WarehouseName] nvarchar(200) NOT NULL,
    [WarehouseCode] nvarchar(50) NOT NULL,
    [WarehouseType] varchar(30) NOT NULL,
    [ContactPersonName] nvarchar(150),
    [ContactEmail] nvarchar(255),
    [ContactPhoneNumber] nvarchar(20),
    [AddressLine1] nvarchar(255) NOT NULL,
    [AddressLine2] nvarchar(255),
    [City] nvarchar(100) NOT NULL,
    [State] nvarchar(100) NOT NULL,
    [PostalCode] nvarchar(20) NOT NULL,
    [Country] nvarchar(100) NOT NULL,
    [Latitude] decimal(10,7),
    [Longitude] decimal(10,7),
    [Status] varchar(30) NOT NULL,
    [CreatedAt] datetime2 NOT NULL,
    [CreatedBy] bigint,
    [UpdatedAt] datetime2,
    [UpdatedBy] bigint,
    CONSTRAINT [PK_Warehouses] PRIMARY KEY CLUSTERED ([WarehouseID])
    );

    CREATE TABLE [CategoryAttributes] (
    [CategoryAttributeID] bigint IDENTITY(1,1),
    [CategoryID] bigint NOT NULL,
    [AttributeID] bigint NOT NULL,
    [IsRequired] bit NOT NULL DEFAULT 0,
    [IsVariantDefining] bit NOT NULL DEFAULT 0,
    --- Controls UI order and, for variant-defining
    ---attributes, their order in VariantSKU
    [DisplayOrder] int NOT NULL DEFAULT 0,
    [Status] varchar(20) NOT NULL DEFAULT 'ACTIVE',
    [CreatedAt] datetime2 NOT NULL,
    [CreatedBy] bigint,
    [UpdatedAt] datetime2,
    [UpdatedBy] bigint,
    CONSTRAINT [PK_CategoryAttributes] PRIMARY KEY CLUSTERED ([CategoryAttributeID])
    );

    CREATE TABLE [CategoryDocuments] (
    [CategoryDocumentID] bigint IDENTITY(1,1),
    [CategoryID] bigint NOT NULL,
    [DocumentTypeID] int NOT NULL,
    [IsMandatory] bit NOT NULL DEFAULT 0,
    [Status] varchar(20) NOT NULL DEFAULT 'ACTIVE',
    [CreatedAt] datetime2 NOT NULL,
    [CreatedBy] bigint,
    [UpdatedAt] datetime2,
    [UpdatedBy] bigint,
    CONSTRAINT [PK_CategoryDocuments] PRIMARY KEY CLUSTERED ([CategoryDocumentID])
    );
    

    CREATE TABLE [ProductMaster] (
    [ProductID] bigint IDENTITY(1,1),
    [ParentSKU] nvarchar(100) NOT NULL,
    [BrandID] bigint,
    [ProductName] nvarchar(255) NOT NULL,
    [Description] nvarchar(max),
    [Highlights] nvarchar(max),
    [BaseModelCode] nvarchar(100),
    [HSNCode] nvarchar(20),
    [GSTRate] decimal(5,2),
    [IsVerified] bit NOT NULL DEFAULT 0,
    [Status] varchar(20) NOT NULL,
    [CreatedAt] datetime2 NOT NULL,
    [CreatedBy] bigint,
    [UpdatedAt] datetime2,
    [UpdatedBy] bigint,
    CONSTRAINT [PK_ProductMaster] PRIMARY KEY CLUSTERED ([ProductID])
    );
    
    CREATE TABLE [ProductVariants] (
    [ProductVariantID] bigint IDENTITY(1,1),
    [ProductMasterID] bigint NOT NULL,
    [VariantSKU] nvarchar(100) NOT NULL,
    [GTIN] nvarchar(50),
    [VariantModelCode] nvarchar(100),
    [Length] decimal(12,3),
    [Width] decimal(12,3),
    [Height] decimal(12,3),
    [Weight] decimal(12,3),
    [Capacity] decimal(12,3),
    [Status] varchar(20) NOT NULL,
    [CreatedAt] datetime2 NOT NULL,
    [CreatedBy] bigint,
    [UpdatedAt] datetime2,
    [UpdatedBy] bigint,
    CONSTRAINT [PK_ProductVariants] PRIMARY KEY CLUSTERED ([ProductVariantID])
    );

    CREATE TABLE [RolePermissions] (
    [RolePermissionID] bigint IDENTITY(1,1),
    [RoleID] int NOT NULL,
    [PermissionID] int NOT NULL,
    [CreatedAt] datetime2 NOT NULL,
    [CreatedBy] bigint,
    CONSTRAINT [PK_RolePermissions] PRIMARY KEY CLUSTERED ([RolePermissionID])
    );

    CREATE TABLE [SellerApplications] (
    [SellerApplicationID] bigint IDENTITY(1,1),
    [SellerID] bigint NOT NULL,
    [CategoryID] bigint NOT NULL,
    [Status] varchar(30) NOT NULL,
    [SubmittedAt] datetime2,
    [ReviewedAt] datetime2,
    [ReviewedBy] bigint,
    [RejectionReason] nvarchar(1000),
    [CreatedAt] datetime2 NOT NULL,
    [UpdatedAt] datetime2,
    CONSTRAINT [PK_SellerApplications] PRIMARY KEY CLUSTERED ([SellerApplicationID])
    );

    CREATE TABLE [SellerConsents] (
    [SellerConsentID] bigint IDENTITY(1,1),
    [SellerID] bigint NOT NULL,
    [ConsentType] varchar(50) NOT NULL,
    [ConsentVersion] varchar(30) NOT NULL,
    [IsGranted] bit NOT NULL,
    [GrantedAt] datetime2,
    [RevokedAt] datetime2,
    [Source] varchar(30),
    [CreatedAt] datetime2 NOT NULL,
    CONSTRAINT [PK_SellerConsents] PRIMARY KEY CLUSTERED ([SellerConsentID])
    );

    CREATE TABLE [SellerUsers] (
    [SellerUserID] bigint IDENTITY(1,1),
    [SellerID] bigint NOT NULL,
    [UserID] bigint NOT NULL,
    [Status] varchar(20) NOT NULL,
    [CreatedAt] datetime2 NOT NULL,
    [CreatedBy] bigint,
    [UpdatedAt] datetime2,
    [UpdatedBy] bigint,
    CONSTRAINT [PK_SellerUsers] PRIMARY KEY CLUSTERED ([SellerUserID])
    );

    CREATE TABLE [SellerWarehouses] (
    [SellerWarehouseID] bigint IDENTITY(1,1),
    [SellerID] bigint NOT NULL,
    [WarehouseID] bigint NOT NULL,
    [Status] varchar(20) NOT NULL,
    [IsPrimary] bit NOT NULL DEFAULT 0,
    [CreatedAt] datetime2 NOT NULL,
    [CreatedBy] bigint,
    [UpdatedAt] datetime2,
    [UpdatedBy] bigint,
    CONSTRAINT [PK_SellerWarehouses] PRIMARY KEY CLUSTERED ([SellerWarehouseID])
    );

    CREATE TABLE [UserRoles] (
    [UserRoleID] bigint IDENTITY(1,1),
    [UserID] bigint NOT NULL,
    [RoleID] int NOT NULL,
    [CreatedAt] datetime2 NOT NULL,
    [CreatedBy] bigint,
    CONSTRAINT [PK_UserRoles] PRIMARY KEY CLUSTERED ([UserRoleID])
    );

    CREATE TABLE [WarehouseConsents] (
    [WarehouseConsentID] bigint IDENTITY(1,1),
    [WarehouseID] bigint NOT NULL,
    [ConsentType] varchar(50) NOT NULL,
    [ConsentVersion] varchar(30) NOT NULL,
    [IsGranted] bit NOT NULL,
    [GrantedAt] datetime2,
    [RevokedAt] datetime2,
    [Source] varchar(30),
    [CreatedAt] datetime2 NOT NULL,
    CONSTRAINT [PK_WarehouseConsents] PRIMARY KEY CLUSTERED ([WarehouseConsentID])
    );

    CREATE TABLE [WarehouseUsers] (
    [WarehouseUserID] bigint IDENTITY(1,1),
    [WarehouseID] bigint NOT NULL,
    [UserID] bigint NOT NULL,
    [Status] varchar(20) NOT NULL,
    [CreatedAt] datetime2 NOT NULL,
    [CreatedBy] bigint,
    [UpdatedAt] datetime2,
    [UpdatedBy] bigint,
    CONSTRAINT [PK_WarehouseUsers] PRIMARY KEY CLUSTERED ([WarehouseUserID])
    );

    CREATE TABLE [Banners] (
    [BannerID] bigint IDENTITY(1,1),
    [Title] nvarchar(255),
    [Description] nvarchar(500),
    [ImageURL] nvarchar(1000) NOT NULL,
    [Placement] varchar(50) NOT NULL,
    [ProductID] bigint,
    [CategoryID] bigint,
    [WarehouseID] bigint,
    [PromotionID] bigint,
    [DisplayOrder] int NOT NULL,
    [Status] varchar(20) NOT NULL,
    [StartAt] datetime2,
    [EndAt] datetime2,
    [CreatedAt] datetime2 NOT NULL,
    [CreatedBy] bigint,
    [UpdatedAt] datetime2,
    [UpdatedBy] bigint,
    CONSTRAINT [PK_Banners] PRIMARY KEY CLUSTERED ([BannerID])
    );

    CREATE TABLE [ProductAssets] (
    [ProductAssetID] bigint IDENTITY(1,1),
    [ProductVariantID] bigint NOT NULL,
    [AssetType] varchar(30) NOT NULL,
    [AssetURL] nvarchar(1000) NOT NULL,
    [IsPrimary] bit NOT NULL DEFAULT 0,
    [AltText] nvarchar(500),
    [DisplayOrder] int NOT NULL,
    [Status] varchar(20) NOT NULL,
    [CreatedAt] datetime2 NOT NULL,
    [CreatedBy] bigint,
    [UpdatedAt] datetime2,
    [UpdatedBy] bigint,
    CONSTRAINT [PK_ProductAssets] PRIMARY KEY CLUSTERED ([ProductAssetID])
    );

    CREATE TABLE [ProductCategories] (
    [ProductCategoryID] bigint IDENTITY(1,1),
    [ProductID] bigint NOT NULL,
    [CategoryID] bigint NOT NULL,
    [CreatedAt] datetime2 NOT NULL,
    [CreatedBy] bigint,
    CONSTRAINT [PK_ProductCategories] PRIMARY KEY CLUSTERED ([ProductCategoryID])
    );

    CREATE TABLE [ProductVariantAttributes] (
    [ProductVariantAttributeID] bigint IDENTITY(1,1),
    [ProductVariantID] bigint NOT NULL,
    [AttributeID] bigint NOT NULL,
    [AttributeValueID] bigint,
    [AttributeValue] nvarchar(255) NOT NULL,
    [CreatedAt] datetime2 NOT NULL,
    [CreatedBy] bigint,
    [UpdatedAt] datetime2,
    [UpdatedBy] bigint,
    CONSTRAINT [PK_ProductVariantAttributes] PRIMARY KEY CLUSTERED ([ProductVariantAttributeID])
    );

    CREATE TABLE [ProductVariantUOMs] (
    [ProductVariantUOMID] bigint IDENTITY(1,1),
    [ProductVariantID] bigint NOT NULL,
    [UOMID] bigint NOT NULL,
    [Quantity] decimal(18,3) NOT NULL,
    [Status] varchar(20) NOT NULL,
    [CreatedAt] datetime2 NOT NULL,
    [CreatedBy] bigint,
    [UpdatedAt] datetime2,
    [UpdatedBy] bigint,
    CONSTRAINT [PK_ProductVariantUOMs] PRIMARY KEY CLUSTERED ([ProductVariantUOMID])
    );

    CREATE TABLE [PromotionProducts] (
    [PromotionProductID] bigint IDENTITY(1,1),
    [PromotionID] bigint NOT NULL,
    [ProductVariantID] bigint NOT NULL,
    CONSTRAINT [PK_PromotionProducts] PRIMARY KEY CLUSTERED ([PromotionProductID])
    );

    CREATE TABLE [SellerApplicationDocuments] (
    [SellerApplicationDocumentID] bigint IDENTITY(1,1),
    [SellerApplicationID] bigint NOT NULL,
    [DocumentTypeID] int NOT NULL,
    [IsMandatory] bit NOT NULL,
    [CertificateNumber] nvarchar(100),
    [DocumentURL] nvarchar(1000),
    [VerificationStatus] varchar(30) NOT NULL,
    [RejectionReason] nvarchar(500),
    [VerifiedBy] bigint,
    [VerifiedAt] datetime2,
    [CreatedAt] datetime2 NOT NULL,
    [UpdatedAt] datetime2,
    CONSTRAINT [PK_SellerApplicationDocuments] PRIMARY KEY CLUSTERED ([SellerApplicationDocumentID])
    );

    CREATE TABLE [SellerProducts] (
    [SellerProductID] bigint IDENTITY(1,1),
    [SellerID] bigint NOT NULL,
    [ProductVariantID] bigint NOT NULL,
    [SellerSKU] nvarchar(100),
    [PurchasePrice] decimal(18,2) NOT NULL,
    [SellingPrice] decimal(18,2) NOT NULL,
    [MRP] decimal(18,2) NOT NULL,
    [Status] varchar(20) NOT NULL,
    [CreatedAt] datetime2 NOT NULL,
    [CreatedBy] bigint,
    [UpdatedAt] datetime2,
    [UpdatedBy] bigint,
    CONSTRAINT [PK_SellerProducts] PRIMARY KEY CLUSTERED ([SellerProductID])
    );

    CREATE TABLE [SellerStatusHistory] (
    [SellerStatusHistoryID] bigint IDENTITY(1,1),
    [SellerID] bigint NOT NULL,
    [SellerApplicationID] bigint,
    [Status] varchar(30) NOT NULL,
    [Comments] nvarchar(1000),
    [ChangedBy] bigint NOT NULL,
    [ChangedAt] datetime2 NOT NULL,
    [CreatedAt] datetime2 NOT NULL,
    CONSTRAINT [PK_SellerStatusHistory] PRIMARY KEY CLUSTERED ([SellerStatusHistoryID])
    );

    CREATE TABLE [SellerWarehouseDocuments] (
    [SellerWarehouseDocumentID] bigint IDENTITY(1,1),
    [SellerWarehouseID] bigint NOT NULL,
    [DocumentTypeID] int NOT NULL,
    [IsMandatory] bit NOT NULL DEFAULT 0,
    [DocumentNumber] nvarchar(100),
    [DocumentURL] nvarchar(1000),
    [VerificationStatus] varchar(30) NOT NULL,
    [RejectionReason] nvarchar(500),
    [VerifiedBy] bigint,
    [VerifiedAt] datetime2,
    [CreatedAt] datetime2 NOT NULL,
    [UpdatedAt] datetime2,
    CONSTRAINT [PK_SellerWarehouseDocuments] PRIMARY KEY CLUSTERED ([SellerWarehouseDocumentID])
    );

    CREATE TABLE [WarehouseProducts] (
    [WarehouseProductID] bigint IDENTITY(1,1),
    [WarehouseID] bigint NOT NULL,
    [SellerProductID] bigint NOT NULL,
    [WarehouseSKU] nvarchar(100),
    [Status] varchar(20) NOT NULL,
    [CreatedAt] datetime2 NOT NULL,
    [CreatedBy] bigint,
    [UpdatedAt] datetime2,
    [UpdatedBy] bigint,
    CONSTRAINT [PK_WarehouseProducts] PRIMARY KEY CLUSTERED ([WarehouseProductID])
    );

    CREATE TABLE [CartItems] (
    [CartItemID] bigint IDENTITY(1,1),
    [CartID] bigint NOT NULL,
    [SellerProductID] bigint NOT NULL,
    [Quantity] int NOT NULL,
    [CreatedAt] datetime2 NOT NULL,
    [UpdatedAt] datetime2,
    CONSTRAINT [PK_CartItems] PRIMARY KEY CLUSTERED ([CartItemID])
    );

    CREATE TABLE [Carts] (
    [CartID] bigint IDENTITY(1,1),
    [CustomerID] bigint NOT NULL,
    [Status] varchar(20) NOT NULL,
    [CreatedAt] datetime2 NOT NULL,
    [UpdatedAt] datetime2,
    CONSTRAINT [PK_Carts] PRIMARY KEY CLUSTERED ([CartID])
    );

    CREATE TABLE [CustomerAddresses] (
    [CustomerAddressID] bigint IDENTITY(1,1),
    [CustomerID] bigint NOT NULL,
    [AddressLabel] nvarchar(50) NOT NULL,
    [RecipientName] nvarchar(200) NOT NULL,
    [PhoneNumber] nvarchar(20),
    [AddressLine1] nvarchar(255) NOT NULL,
    [AddressLine2] nvarchar(255),
    [City] nvarchar(100) NOT NULL,
    [State] nvarchar(100) NOT NULL,
    [PostalCode] nvarchar(20) NOT NULL,
    [Country] nvarchar(100) NOT NULL,
    [Latitude] decimal(10,7),
    [Longitude] decimal(10,7),
    [IsDefaultShipping] bit NOT NULL DEFAULT 0,
    [IsDefaultBilling] bit NOT NULL DEFAULT 0,
    [CreatedAt] datetime2 NOT NULL,
    [UpdatedAt] datetime2,
    CONSTRAINT [PK_CustomerAddresses] PRIMARY KEY CLUSTERED ([CustomerAddressID])
    );

    CREATE TABLE [CustomerConsents] (
    [CustomerConsentID] bigint IDENTITY(1,1),
    [CustomerID] bigint NOT NULL,
    [ConsentType] varchar(50) NOT NULL,
    [ConsentVersion] varchar(30) NOT NULL,
    [IsGranted] bit NOT NULL,
    [GrantedAt] datetime2,
    [RevokedAt] datetime2,
    [Source] varchar(30),
    [CreatedAt] datetime2 NOT NULL,
    CONSTRAINT [PK_CustomerConsents] PRIMARY KEY CLUSTERED ([CustomerConsentID])
    );

    CREATE TABLE [Customers] (
    [CustomerID] bigint IDENTITY(1,1),
    [FirstName] nvarchar(100) NOT NULL,
    [LastName] nvarchar(100) NOT NULL,
    [Email] nvarchar(255),
    [PhoneNumber] nvarchar(20),
    [PasswordHash] nvarchar(500),
    [Status] varchar(20) NOT NULL,
    [LastLoginAt] datetime2,
    [CreatedAt] datetime2 NOT NULL,
    [CreatedBy] bigint,
    [UpdatedAt] datetime2,
    [UpdatedBy] bigint,
    CONSTRAINT [PK_Customers] PRIMARY KEY CLUSTERED ([CustomerID])
    );
    

    CREATE TABLE PincodeLookups (
    Pincode VARCHAR(6) PRIMARY KEY,
    City NVARCHAR(100) NOT NULL,    -- Maps from District
    State NVARCHAR(100) NOT NULL,   -- Maps from Statename
    Latitude DECIMAL(9,6) NULL,
    Longitude DECIMAL(9,6) NULL,
    CreatedAt DATETIME DEFAULT GETDATE()
);



    CREATE TABLE [OTPVerifications] (
    [OTPVerificationID] bigint IDENTITY(1,1),
    [CustomerID] bigint,
    [VerificationType] varchar(20) NOT NULL,
    [Destination] nvarchar(255) NOT NULL,
    [OTPHash] nvarchar(500) NOT NULL,
    [ExpiresAt] datetime2 NOT NULL,
    [VerifiedAt] datetime2,
    [AttemptCount] int NOT NULL DEFAULT 0,
    [Status] varchar(20) NOT NULL,
    [CreatedAt] datetime2 NOT NULL,
    CONSTRAINT [PK_OTPVerifications] PRIMARY KEY CLUSTERED ([OTPVerificationID])
    );

    CREATE TABLE [Orders] (
    [OrderID] bigint IDENTITY(1,1),
    [OrderNumber] varchar(50) NOT NULL,
    [CustomerID] bigint NOT NULL,
    [Status] varchar(30) NOT NULL,
    [SubtotalAmount] decimal(18,2) NOT NULL,
    [DiscountAmount] decimal(18,2) NOT NULL,
    [ShippingAmount] decimal(18,2) NOT NULL,
    [TaxAmount] decimal(18,2) NOT NULL,
    [TotalAmount] decimal(18,2) NOT NULL,
    [ShippingAddressID] bigint NOT NULL,
    [BillingAddressID] bigint NOT NULL,
    [CreatedAt] datetime2 NOT NULL,
    [UpdatedAt] datetime2,
    CONSTRAINT [PK_Orders] PRIMARY KEY CLUSTERED ([OrderID])
    );

    CREATE TABLE [Wishlists] (
    [WishlistID] bigint IDENTITY(1,1),
    [CustomerID] bigint NOT NULL,
    [Status] varchar(20) NOT NULL,
    [CreatedAt] datetime2 NOT NULL,
    [UpdatedAt] datetime2,
    CONSTRAINT [PK_Wishlists] PRIMARY KEY CLUSTERED ([WishlistID])
    );

    CREATE TABLE [InventoryReservations] (
    [ReservationID] bigint IDENTITY(1,1),
    [InventoryID] bigint NOT NULL,
    [OrderID] bigint NOT NULL,
    [Quantity] int NOT NULL,
    [Status] varchar(20) NOT NULL,
    [ExpiresAt] datetime2,
    [CreatedAt] datetime2 NOT NULL,
    [UpdatedAt] datetime2,
    CONSTRAINT [PK_InventoryReservations] PRIMARY KEY CLUSTERED ([ReservationID])
    );

    CREATE TABLE [InventoryTransactions] (
    [InventoryTransactionID] bigint IDENTITY(1,1),
    [InventoryID] bigint NOT NULL,
    [OrderID] bigint,
    [TransactionType] varchar(30) NOT NULL,
    [Quantity] int NOT NULL,
    [Reason] nvarchar(500),
    [PONumber] nvarchar(100),
    [POAmount] decimal(18,2),
    [PODocumentURL] nvarchar(1000),
    [GRNNumber] nvarchar(100),
    [GRNAmount] decimal(18,2),
    [GRNDocumentURL] nvarchar(1000),
    [SupplierInvoiceNumber] nvarchar(100),
    [InvoiceAmount] decimal(18,2),
    [InvoiceDocumentURL] nvarchar(1000),
    [CreatedAt] datetime2 NOT NULL,
    [CreatedBy] bigint,
    CONSTRAINT [PK_InventoryTransactions] PRIMARY KEY CLUSTERED ([InventoryTransactionID])
    );

    CREATE TABLE [OrderItems] (
    [OrderItemID] bigint IDENTITY(1,1),
    [OrderID] bigint NOT NULL,
    [SellerProductID] bigint NOT NULL,
    [Quantity] int NOT NULL,
    [UnitPrice] decimal(18,2) NOT NULL,
    [MRP] decimal(18,2) NOT NULL,
    [TotalMRP] decimal(18,2) NOT NULL,
    [PurchasePrice] decimal(18,2) NOT NULL,
    [TotalPurchasePrice] decimal(18,2) NOT NULL,
    [DiscountPercentage] decimal(5,2) NOT NULL DEFAULT 0,
    [DiscountAmount] decimal(18,2) NOT NULL DEFAULT 0,
    [CGSTRate] decimal(5,2) NOT NULL DEFAULT 0,
    [CGSTAmount] decimal(18,2) NOT NULL DEFAULT 0,
    [SGSTRate] decimal(5,2) NOT NULL DEFAULT 0,
    [SGSTAmount] decimal(18,2) NOT NULL DEFAULT 0,
    [IGSTRate] decimal(5,2) NOT NULL DEFAULT 0,
    [IGSTAmount] decimal(18,2) NOT NULL DEFAULT 0,
    [TaxAmount] decimal(18,2) NOT NULL DEFAULT 0,
    [TotalAmount] decimal(18,2) NOT NULL,
    [CreatedAt] datetime2 NOT NULL,
    CONSTRAINT [PK_OrderItems] PRIMARY KEY CLUSTERED ([OrderItemID])
    );
    
    CREATE TABLE [OrderStatusHistory] (
    [OrderStatusHistoryID] bigint IDENTITY(1,1),
    [OrderID] bigint NOT NULL,
    [Status] varchar(30) NOT NULL,
    [ChangedAt] datetime2 NOT NULL,
    [ChangedBy] bigint,
    CONSTRAINT [PK_OrderStatusHistory] PRIMARY KEY CLUSTERED ([OrderStatusHistoryID])
    );

    CREATE TABLE [Payments] (
    [PaymentID] bigint IDENTITY(1,1),
    [OrderID] bigint NOT NULL,
    [PaymentModeID] bigint NOT NULL,
    [Amount] decimal(18,2) NOT NULL,
    [Status] varchar(30) NOT NULL,
    [GatewayReference] nvarchar(255),
    [PaidAt] datetime2,
    [CreatedAt] datetime2 NOT NULL,
    [UpdatedAt] datetime2,
    CONSTRAINT [PK_Payments] PRIMARY KEY CLUSTERED ([PaymentID])
    );

    CREATE TABLE [SellerOrders] (
    [SellerOrderID] bigint IDENTITY(1,1),
    [OrderID] bigint NOT NULL,
    [SellerID] bigint NOT NULL,
    [Status] varchar(30) NOT NULL,
    [CreatedAt] datetime2 NOT NULL,
    [UpdatedAt] datetime2,
    CONSTRAINT [PK_SellerOrders] PRIMARY KEY CLUSTERED ([SellerOrderID])
    );

    CREATE TABLE [WishlistItems] (
    [WishlistItemID] bigint IDENTITY(1,1),
    [WishlistID] bigint NOT NULL,
    [ProductVariantID] bigint NOT NULL,
    [CreatedAt] datetime2 NOT NULL,
    CONSTRAINT [PK_WishlistItems] PRIMARY KEY CLUSTERED ([WishlistItemID])
    );
    
    CREATE TABLE [FulfillmentItems] (
    [FulfillmentItemID] bigint IDENTITY(1,1),
    [FulfillmentID] bigint NOT NULL,
    [OrderItemID] bigint NOT NULL,
    [WarehouseProductID] bigint NOT NULL,
    [Quantity] int NOT NULL,
    [CreatedAt] datetime2 NOT NULL,
    [CreatedBy] bigint,
    CONSTRAINT [PK_FulfillmentItems] PRIMARY KEY CLUSTERED ([FulfillmentItemID])
    );

    CREATE TABLE [Fulfillments] (
    [FulfillmentID] bigint IDENTITY(1,1),
    [OrderID] bigint NOT NULL,
    [SellerID] bigint NOT NULL,
    [WarehouseID] bigint NOT NULL,
    [Status] varchar(30) NOT NULL,
    [CreatedAt] datetime2 NOT NULL,
    [CreatedBy] bigint,
    [UpdatedAt] datetime2,
    [UpdatedBy] bigint,
    CONSTRAINT [PK_Fulfillments] PRIMARY KEY CLUSTERED ([FulfillmentID])
    );

    CREATE TABLE [Invoices] (
    [InvoiceID] bigint IDENTITY(1,1),
    [InvoiceNumber] varchar(50) NOT NULL,
    [FulfillmentID] bigint NOT NULL,
    [OrderID] bigint NOT NULL,
    [SellerID] bigint NOT NULL,
    [CustomerID] bigint NOT NULL,
    [InvoiceDate] datetime2 NOT NULL,
    [SubtotalAmount] decimal(18,2) NOT NULL,
    [DiscountAmount] decimal(18,2) NOT NULL,
    [ShippingAmount] decimal(18,2) NOT NULL,
    [CGSTAmount] decimal(18,2) NOT NULL DEFAULT 0,
    [SGSTAmount] decimal(18,2) NOT NULL DEFAULT 0,
    [IGSTAmount] decimal(18,2) NOT NULL DEFAULT 0,
    [TaxAmount] decimal(18,2) NOT NULL DEFAULT 0,
    [TotalAmount] decimal(18,2) NOT NULL,
    [Status] varchar(20) NOT NULL,
    [BillingName] nvarchar(200) NOT NULL,
    [BillingAddressLine1] nvarchar(255) NOT NULL,
    [BillingAddressLine2] nvarchar(255),
    [BillingCity] nvarchar(100) NOT NULL,
    [BillingState] nvarchar(100) NOT NULL,
    [BillingPostalCode] nvarchar(20) NOT NULL,
    [BillingCountry] nvarchar(100) NOT NULL,
    [CreatedAt] datetime2 NOT NULL,
    [CreatedBy] bigint,
    [UpdatedAt] datetime2,
    [UpdatedBy] bigint,
    CONSTRAINT [PK_Invoices] PRIMARY KEY CLUSTERED ([InvoiceID])
    );
    
    CREATE TABLE [Shipments] (
    [ShipmentID] bigint IDENTITY(1,1),
    [FulfillmentID] bigint NOT NULL, 
    [Carrier] nvarchar(100) NOT NULL,
    [TrackingNumber] nvarchar(150),
    [Status] varchar(30) NOT NULL,
    [PackageWeight] decimal(10,3) NOT NULL,
    [PackageLength] decimal(10,2) NOT NULL,
    [PackageWidth] decimal(10,2) NOT NULL,
    [PackageHeight] decimal(10,2) NOT NULL,
    [EstimatedDeliveryDate] datetime2,
    [ShippedAt] datetime2,
    [DeliveredAt] datetime2,
    [CreatedAt] datetime2 NOT NULL,
    [UpdatedAt] datetime2,
    CONSTRAINT [PK_Shipments] PRIMARY KEY CLUSTERED ([ShipmentID])
    );

    CREATE TABLE [InvoiceItems] (
    [InvoiceItemID] bigint IDENTITY(1,1),
    [InvoiceID] bigint NOT NULL,
    [OrderItemID] bigint NOT NULL,
    [ProductName] nvarchar(255) NOT NULL,
    [Quantity] int NOT NULL,
    [MRP] decimal(18,2) NOT NULL,
    [TotalMRP] decimal(18,2) NOT NULL,
    [UnitPrice] decimal(18,2) NOT NULL,
    [DiscountPercentage] decimal(5,2) NOT NULL DEFAULT 0,
    [DiscountAmount] decimal(18,2) NOT NULL DEFAULT 0,
    [TaxableAmount] decimal(18,2) NOT NULL,
    [CGSTRate] decimal(5,2) NOT NULL DEFAULT 0,
    [CGSTAmount] decimal(18,2) NOT NULL DEFAULT 0,
    [SGSTRate] decimal(5,2) NOT NULL DEFAULT 0,
    [SGSTAmount] decimal(18,2) NOT NULL DEFAULT 0,
    [IGSTRate] decimal(5,2) NOT NULL DEFAULT 0,
    [IGSTAmount] decimal(18,2) NOT NULL DEFAULT 0,
    [TaxAmount] decimal(18,2) NOT NULL DEFAULT 0,
    [TotalAmount] decimal(18,2) NOT NULL,
    [CreatedAt] datetime2 NOT NULL,
    [CreatedBy] bigint,
    CONSTRAINT [PK_InvoiceItems] PRIMARY KEY CLUSTERED ([InvoiceItemID])
    );

    CREATE TABLE [ShipmentTrackingEvents] (
    [TrackingEventID] bigint IDENTITY(1,1),
    [ShipmentID] bigint NOT NULL,
    [Status] varchar(30) NOT NULL,
    [Location] nvarchar(255),
    [EventDescription] nvarchar(500),
    [EventTime] datetime2 NOT NULL,
    [CreatedAt] datetime2 NOT NULL,
    CONSTRAINT [PK_ShipmentTrackingEvents] PRIMARY KEY CLUSTERED ([TrackingEventID])
    );

    -- ============================================================
    -- Sequences
    -- ============================================================
    IF NOT EXISTS (SELECT 1 FROM sys.sequences WHERE name = 'ProductMasterSKUSequence' AND schema_id = SCHEMA_ID('dbo'))
    BEGIN
        CREATE SEQUENCE dbo.ProductMasterSKUSequence
            AS bigint
            START WITH 1
            INCREMENT BY 1;
    END;

    CREATE UNIQUE NONCLUSTERED INDEX [UX_Categories_CategoryCode] ON [Categories] ([CategoryCode]) WHERE [CategoryCode] IS NOT NULL;
    -- Indexing for instantaneous checkout lookups
CREATE INDEX IX_PincodeLookups_Pincode ON PincodeLookups(Pincode);
    CREATE UNIQUE NONCLUSTERED INDEX [UX_Brands_BrandCode] ON [Brands] ([BrandCode]) WHERE [BrandCode] IS NOT NULL;
    CREATE UNIQUE NONCLUSTERED INDEX [UX_AttributeValues_AttributeID_ValueName] ON [AttributeValues] ([AttributeID], [ValueName]);
    CREATE UNIQUE NONCLUSTERED INDEX [UX_AttributeValues_AttributeID_ValueCode] ON [AttributeValues] ([AttributeID], [ValueCode]);
    CREATE INDEX [IX_AttributeValues_AttributeID] ON [AttributeValues] ([AttributeID]);
    CREATE UNIQUE NONCLUSTERED INDEX [UX_CategoryAttributes_CategoryID_AttributeID] ON [CategoryAttributes] ([CategoryID], [AttributeID]);
    CREATE UNIQUE NONCLUSTERED INDEX [UX_CategoryDocuments_CategoryID_DocumentTypeID] ON [CategoryDocuments] ([CategoryID], [DocumentTypeID]);
    CREATE UNIQUE NONCLUSTERED INDEX [UX_ProductMaster_ParentSKU] ON [ProductMaster] ([ParentSKU]);
    CREATE UNIQUE NONCLUSTERED INDEX [UX_ProductVariants_VariantSKU] ON [ProductVariants] ([VariantSKU]);
    CREATE UNIQUE NONCLUSTERED INDEX [UX_ProductVariants_GTIN] ON [ProductVariants] ([GTIN]) WHERE [GTIN] IS NOT NULL;
    CREATE INDEX [IX_ProductVariants_ProductMasterID] ON [ProductVariants] ([ProductMasterID]);
    CREATE UNIQUE NONCLUSTERED INDEX [UX_RolePermissions_RoleID_PermissionID] ON [RolePermissions] ([RoleID], [PermissionID]);
    CREATE UNIQUE NONCLUSTERED INDEX [UX_SellerApplications_SellerID_CategoryID] ON [SellerApplications] ([SellerID], [CategoryID]);
    CREATE UNIQUE NONCLUSTERED INDEX [UX_SellerUsers_SellerID_UserID] ON [SellerUsers] ([SellerID], [UserID]);
    CREATE UNIQUE NONCLUSTERED INDEX [UX_SellerWarehouses_SellerID_WarehouseID] ON [SellerWarehouses] ([SellerID], [WarehouseID]);
    CREATE UNIQUE NONCLUSTERED INDEX [UX_UserRoles_UserID_RoleID] ON [UserRoles] ([UserID], [RoleID]);
    CREATE UNIQUE NONCLUSTERED INDEX [UX_WarehouseUsers_WarehouseID_UserID] ON [WarehouseUsers] ([WarehouseID], [UserID]);
    CREATE UNIQUE NONCLUSTERED INDEX [UX_ProductCategories_ProductID_CategoryID] ON [ProductCategories] ([ProductID], [CategoryID]);
    CREATE UNIQUE NONCLUSTERED INDEX [UX_ProductVariantAttributes_ProductVariantID_AttributeID] ON [ProductVariantAttributes] ([ProductVariantID], [AttributeID]);
    CREATE UNIQUE NONCLUSTERED INDEX [UX_ProductVariantUOMs_ProductVariantID_UOMID] ON [ProductVariantUOMs] ([ProductVariantID], [UOMID]);
    CREATE UNIQUE NONCLUSTERED INDEX [UX_PromotionProducts_PromotionID_ProductVariantID] ON [PromotionProducts] ([PromotionID], [ProductVariantID]);
    CREATE UNIQUE NONCLUSTERED INDEX [UX_SellerApplicationDocuments_SellerApplicationID_DocumentTypeID] ON [SellerApplicationDocuments] ([SellerApplicationID], [DocumentTypeID]);
    CREATE UNIQUE NONCLUSTERED INDEX [UX_SellerProducts_SellerID_ProductVariantID] ON [SellerProducts] ([SellerID], [ProductVariantID]);
    CREATE UNIQUE NONCLUSTERED INDEX [UX_SellerProducts_SellerID_SellerSKU] ON [SellerProducts] ([SellerID], [SellerSKU]);
    CREATE UNIQUE NONCLUSTERED INDEX [UX_SellerWarehouseDocuments_SellerWarehouseID_DocumentTypeID] ON [SellerWarehouseDocuments] ([SellerWarehouseID], [DocumentTypeID]);
    CREATE UNIQUE NONCLUSTERED INDEX [UX_WarehouseProducts_WarehouseID_SellerProductID] ON [WarehouseProducts] ([WarehouseID], [SellerProductID]);
    CREATE UNIQUE NONCLUSTERED INDEX [UX_WarehouseProducts_WarehouseID_WarehouseSKU] ON [WarehouseProducts] ([WarehouseID], [WarehouseSKU]);
    CREATE UNIQUE NONCLUSTERED INDEX [UX_SellerOrders_OrderID_SellerID] ON [SellerOrders] ([OrderID], [SellerID]);
    CREATE UNIQUE NONCLUSTERED INDEX [UX_WishlistItems_WishlistID_ProductVariantID] ON [WishlistItems] ([WishlistID], [ProductVariantID]);
    CREATE UNIQUE NONCLUSTERED INDEX [UX_Invoices_OrderID_SellerID] ON [Invoices] ([OrderID], [SellerID]);
    CREATE UNIQUE NONCLUSTERED INDEX [UX_InvoiceItems_InvoiceID_OrderItemID] ON [InvoiceItems] ([InvoiceID], [OrderItemID]);
    CREATE UNIQUE NONCLUSTERED INDEX [UX_ProductAssets_Variant_Primary] ON [ProductAssets] ([ProductVariantID]) WHERE [IsPrimary] = 1;
    CREATE INDEX [IX_CategoryDocuments_CategoryID] ON [CategoryDocuments] ([CategoryID]);
    CREATE INDEX [IX_ProductCategories_CategoryID] ON [ProductCategories] ([CategoryID]);
    CREATE INDEX [IX_WarehouseProducts_SellerProductID] ON [WarehouseProducts] ([SellerProductID]);
    CREATE INDEX [IX_InventoryReservations_OrderID] ON [InventoryReservations] ([OrderID]);
    CREATE INDEX [IX_InventoryTransactions_InventoryID_CreatedAt] ON [InventoryTransactions] ([InventoryID], [CreatedAt]);
    CREATE INDEX [IX_Orders_CustomerID_CreatedAt] ON [Orders] ([CustomerID], [CreatedAt]);
    CREATE INDEX [IX_OrderItems_SellerProductID] ON [OrderItems] ([SellerProductID]);
    CREATE INDEX [IX_Fulfillments_WarehouseID_Status] ON [Fulfillments] ([WarehouseID], [Status]);
    CREATE INDEX [IX_Shipments_TrackingNumber] ON [Shipments] ([TrackingNumber]) WHERE [TrackingNumber] IS NOT NULL;
    ALTER TABLE [CategoryDocuments] ADD CONSTRAINT [FK_CategoryDocuments_CategoryID_Categories_CategoryID] FOREIGN KEY ([CategoryID]) REFERENCES [Categories]([CategoryID]);
    ALTER TABLE [CategoryDocuments] ADD CONSTRAINT [FK_CategoryDocuments_DocumentTypeID_DocumentTypes_DocumentTypeID] FOREIGN KEY ([DocumentTypeID]) REFERENCES [DocumentTypes]([DocumentTypeID]);
    ALTER TABLE [SellerWarehouseDocuments] ADD CONSTRAINT [FK_SellerWarehouseDocuments_SellerWarehouseID_SellerWarehouses_SellerWarehouseID] FOREIGN KEY ([SellerWarehouseID]) REFERENCES [SellerWarehouses]([SellerWarehouseID]);
    ALTER TABLE [SellerWarehouseDocuments] ADD CONSTRAINT [FK_SellerWarehouseDocuments_DocumentTypeID_DocumentTypes_DocumentTypeID] FOREIGN KEY ([DocumentTypeID]) REFERENCES [DocumentTypes]([DocumentTypeID]);
    ALTER TABLE [SellerWarehouseDocuments] ADD CONSTRAINT [FK_SellerWarehouseDocuments_VerifiedBy_Users_UserID] FOREIGN KEY ([VerifiedBy]) REFERENCES [Users]([UserID]);
    ALTER TABLE [Invoices] ADD CONSTRAINT [FK_Invoices_FulfillmentID_Fulfillments_FulfillmentID] FOREIGN KEY ([FulfillmentID]) REFERENCES [Fulfillments]([FulfillmentID]);
    ALTER TABLE [UserRoles] ADD CONSTRAINT [FK_UserRoles_UserID_Users_UserID] FOREIGN KEY ([UserID]) REFERENCES [Users]([UserID]);
    ALTER TABLE [UserRoles] ADD CONSTRAINT [FK_UserRoles_RoleID_Roles_RoleID] FOREIGN KEY ([RoleID]) REFERENCES [Roles]([RoleID]);
    ALTER TABLE [RolePermissions] ADD CONSTRAINT [FK_RolePermissions_RoleID_Roles_RoleID] FOREIGN KEY ([RoleID]) REFERENCES [Roles]([RoleID]);
    ALTER TABLE [RolePermissions] ADD CONSTRAINT [FK_RolePermissions_PermissionID_Permissions_PermissionID] FOREIGN KEY ([PermissionID]) REFERENCES [Permissions]([PermissionID]);
    ALTER TABLE [CustomerConsents] ADD CONSTRAINT [FK_CustomerConsents_CustomerID_Customers_CustomerID] FOREIGN KEY ([CustomerID]) REFERENCES [Customers]([CustomerID]);
    ALTER TABLE [CustomerAddresses] ADD CONSTRAINT [FK_CustomerAddresses_CustomerID_Customers_CustomerID] FOREIGN KEY ([CustomerID]) REFERENCES [Customers]([CustomerID]);
    ALTER TABLE [OTPVerifications] ADD CONSTRAINT [FK_OTPVerifications_CustomerID_Customers_CustomerID] FOREIGN KEY ([CustomerID]) REFERENCES [Customers]([CustomerID]);
    ALTER TABLE [SellerUsers] ADD CONSTRAINT [FK_SellerUsers_SellerID_Sellers_SellerID] FOREIGN KEY ([SellerID]) REFERENCES [Sellers]([SellerID]);
    ALTER TABLE [SellerUsers] ADD CONSTRAINT [FK_SellerUsers_UserID_Users_UserID] FOREIGN KEY ([UserID]) REFERENCES [Users]([UserID]);
    ALTER TABLE [Categories] ADD CONSTRAINT [FK_Categories_ParentCategoryID_Categories_CategoryID] FOREIGN KEY ([ParentCategoryID]) REFERENCES [Categories]([CategoryID]);
    ALTER TABLE [AttributeValues] ADD CONSTRAINT [FK_AttributeValues_AttributeID_Attributes_AttributeID] FOREIGN KEY ([AttributeID]) REFERENCES [Attributes]([AttributeID]);
    ALTER TABLE [AttributeValues] ADD CONSTRAINT [FK_AttributeValues_CreatedBy_Users_UserID] FOREIGN KEY ([CreatedBy]) REFERENCES [Users]([UserID]);
    ALTER TABLE [AttributeValues] ADD CONSTRAINT [FK_AttributeValues_UpdatedBy_Users_UserID] FOREIGN KEY ([UpdatedBy]) REFERENCES [Users]([UserID]);
    ALTER TABLE [ProductMaster] ADD CONSTRAINT [FK_ProductMaster_BrandID_Brands_BrandID] FOREIGN KEY ([BrandID]) REFERENCES [Brands]([BrandID]);
    ALTER TABLE [ProductVariants] ADD CONSTRAINT [FK_ProductVariants_ProductMasterID_ProductMaster_ProductID] FOREIGN KEY ([ProductMasterID]) REFERENCES [ProductMaster]([ProductID]);
    ALTER TABLE [ProductVariants] ADD CONSTRAINT [FK_ProductVariants_CreatedBy_Users_UserID] FOREIGN KEY ([CreatedBy]) REFERENCES [Users]([UserID]);
    ALTER TABLE [ProductVariants] ADD CONSTRAINT [FK_ProductVariants_UpdatedBy_Users_UserID] FOREIGN KEY ([UpdatedBy]) REFERENCES [Users]([UserID]);
    ALTER TABLE [ProductCategories] ADD CONSTRAINT [FK_ProductCategories_ProductID_ProductMaster_ProductID] FOREIGN KEY ([ProductID]) REFERENCES [ProductMaster]([ProductID]);
    ALTER TABLE [ProductCategories] ADD CONSTRAINT [FK_ProductCategories_CategoryID_Categories_CategoryID] FOREIGN KEY ([CategoryID]) REFERENCES [Categories]([CategoryID]);
    ALTER TABLE [ProductAssets] ADD CONSTRAINT [FK_ProductAssets_ProductVariantID_ProductVariants_ProductVariantID] FOREIGN KEY ([ProductVariantID]) REFERENCES [ProductVariants]([ProductVariantID]);
    ALTER TABLE [ProductVariantAttributes] ADD CONSTRAINT [FK_ProductVariantAttributes_ProductVariantID_ProductVariants_ProductVariantID] FOREIGN KEY ([ProductVariantID]) REFERENCES [ProductVariants]([ProductVariantID]);
    ALTER TABLE [ProductVariantAttributes] ADD CONSTRAINT [FK_ProductVariantAttributes_AttributeID_Attributes_AttributeID] FOREIGN KEY ([AttributeID]) REFERENCES [Attributes]([AttributeID]);
    ALTER TABLE [ProductVariantAttributes] ADD CONSTRAINT [FK_ProductVariantAttributes_AttributeValueID_AttributeValues_AttributeValueID] FOREIGN KEY ([AttributeValueID]) REFERENCES [AttributeValues]([AttributeValueID]);
    ALTER TABLE [ProductVariantUOMs] ADD CONSTRAINT [FK_ProductVariantUOMs_ProductVariantID_ProductVariants_ProductVariantID] FOREIGN KEY ([ProductVariantID]) REFERENCES [ProductVariants]([ProductVariantID]);
    ALTER TABLE [ProductVariantUOMs] ADD CONSTRAINT [FK_ProductVariantUOMs_UOMID_UOM_UOMID] FOREIGN KEY ([UOMID]) REFERENCES [UOM]([UOMID]);
    ALTER TABLE [SellerProducts] ADD CONSTRAINT [FK_SellerProducts_SellerID_Sellers_SellerID] FOREIGN KEY ([SellerID]) REFERENCES [Sellers]([SellerID]);
    ALTER TABLE [SellerProducts] ADD CONSTRAINT [FK_SellerProducts_ProductVariantID_ProductVariants_ProductVariantID] FOREIGN KEY ([ProductVariantID]) REFERENCES [ProductVariants]([ProductVariantID]);
    ALTER TABLE [SellerConsents] ADD CONSTRAINT [FK_SellerConsents_SellerID_Sellers_SellerID] FOREIGN KEY ([SellerID]) REFERENCES [Sellers]([SellerID]);
    ALTER TABLE [WarehouseConsents] ADD CONSTRAINT [FK_WarehouseConsents_WarehouseID_Warehouses_WarehouseID] FOREIGN KEY ([WarehouseID]) REFERENCES [Warehouses]([WarehouseID]);
    ALTER TABLE [WarehouseUsers] ADD CONSTRAINT [FK_WarehouseUsers_WarehouseID_Warehouses_WarehouseID] FOREIGN KEY ([WarehouseID]) REFERENCES [Warehouses]([WarehouseID]);
    ALTER TABLE [WarehouseUsers] ADD CONSTRAINT [FK_WarehouseUsers_UserID_Users_UserID] FOREIGN KEY ([UserID]) REFERENCES [Users]([UserID]);
    ALTER TABLE [SellerWarehouses] ADD CONSTRAINT [FK_SellerWarehouses_SellerID_Sellers_SellerID] FOREIGN KEY ([SellerID]) REFERENCES [Sellers]([SellerID]);
    ALTER TABLE [SellerWarehouses] ADD CONSTRAINT [FK_SellerWarehouses_WarehouseID_Warehouses_WarehouseID] FOREIGN KEY ([WarehouseID]) REFERENCES [Warehouses]([WarehouseID]);
    ALTER TABLE [SellerStatusHistory] ADD CONSTRAINT [FK_SellerStatusHistory_SellerID_Sellers_SellerID] FOREIGN KEY ([SellerID]) REFERENCES [Sellers]([SellerID]);
    ALTER TABLE [SellerStatusHistory] ADD CONSTRAINT [FK_SellerStatusHistory_SellerApplicationID_SellerApplications_SellerApplicationID] FOREIGN KEY ([SellerApplicationID]) REFERENCES [SellerApplications]([SellerApplicationID]);
    ALTER TABLE [SellerStatusHistory] ADD CONSTRAINT [FK_SellerStatusHistory_ChangedBy_Users_UserID] FOREIGN KEY ([ChangedBy]) REFERENCES [Users]([UserID]);
    ALTER TABLE [SellerApplications] ADD CONSTRAINT [FK_SellerApplications_SellerID_Sellers_SellerID] FOREIGN KEY ([SellerID]) REFERENCES [Sellers]([SellerID]);
    ALTER TABLE [SellerApplications] ADD CONSTRAINT [FK_SellerApplications_CategoryID_Categories_CategoryID] FOREIGN KEY ([CategoryID]) REFERENCES [Categories]([CategoryID]);
    ALTER TABLE [SellerApplicationDocuments] ADD CONSTRAINT [FK_SellerApplicationDocuments_SellerApplicationID_SellerApplications_SellerApplicationID] FOREIGN KEY ([SellerApplicationID]) REFERENCES [SellerApplications]([SellerApplicationID]);
    ALTER TABLE [SellerApplicationDocuments] ADD CONSTRAINT [FK_SellerApplicationDocuments_DocumentTypeID_DocumentTypes_DocumentTypeID] FOREIGN KEY ([DocumentTypeID]) REFERENCES [DocumentTypes]([DocumentTypeID]);
    ALTER TABLE [WarehouseProducts] ADD CONSTRAINT [FK_WarehouseProducts_WarehouseID_Warehouses_WarehouseID] FOREIGN KEY ([WarehouseID]) REFERENCES [Warehouses]([WarehouseID]);
    ALTER TABLE [WarehouseProducts] ADD CONSTRAINT [FK_WarehouseProducts_SellerProductID_SellerProducts_SellerProductID] FOREIGN KEY ([SellerProductID]) REFERENCES [SellerProducts]([SellerProductID]);
    ALTER TABLE [Inventory] ADD CONSTRAINT [FK_Inventory_WarehouseProductID_WarehouseProducts_WarehouseProductID] FOREIGN KEY ([WarehouseProductID]) REFERENCES [WarehouseProducts]([WarehouseProductID]);
    ALTER TABLE [InventoryReservations] ADD CONSTRAINT [FK_InventoryReservations_InventoryID_Inventory_InventoryID] FOREIGN KEY ([InventoryID]) REFERENCES [Inventory]([InventoryID]);
    ALTER TABLE [InventoryReservations] ADD CONSTRAINT [FK_InventoryReservations_OrderID_Orders_OrderID] FOREIGN KEY ([OrderID]) REFERENCES [Orders]([OrderID]);
    ALTER TABLE [InventoryTransactions] ADD CONSTRAINT [FK_InventoryTransactions_InventoryID_Inventory_InventoryID] FOREIGN KEY ([InventoryID]) REFERENCES [Inventory]([InventoryID]);
    ALTER TABLE [InventoryTransactions] ADD CONSTRAINT [FK_InventoryTransactions_OrderID_Orders_OrderID] FOREIGN KEY ([OrderID]) REFERENCES [Orders]([OrderID]);
    ALTER TABLE [Carts] ADD CONSTRAINT [FK_Carts_CustomerID_Customers_CustomerID] FOREIGN KEY ([CustomerID]) REFERENCES [Customers]([CustomerID]);
    ALTER TABLE [CartItems] ADD CONSTRAINT [FK_CartItems_CartID_Carts_CartID] FOREIGN KEY ([CartID]) REFERENCES [Carts]([CartID]);
    ALTER TABLE [CartItems] ADD CONSTRAINT [FK_CartItems_SellerProductID_SellerProducts_SellerProductID] FOREIGN KEY ([SellerProductID]) REFERENCES [SellerProducts]([SellerProductID]);
    ALTER TABLE [Orders] ADD CONSTRAINT [FK_Orders_CustomerID_Customers_CustomerID] FOREIGN KEY ([CustomerID]) REFERENCES [Customers]([CustomerID]);
    ALTER TABLE [OrderItems] ADD CONSTRAINT [FK_OrderItems_OrderID_Orders_OrderID] FOREIGN KEY ([OrderID]) REFERENCES [Orders]([OrderID]);
    ALTER TABLE [OrderItems] ADD CONSTRAINT [FK_OrderItems_SellerProductID_SellerProducts_SellerProductID] FOREIGN KEY ([SellerProductID]) REFERENCES [SellerProducts]([SellerProductID]);
    ALTER TABLE [OrderStatusHistory] ADD CONSTRAINT [FK_OrderStatusHistory_OrderID_Orders_OrderID] FOREIGN KEY ([OrderID]) REFERENCES [Orders]([OrderID]);
    ALTER TABLE [Orders] ADD CONSTRAINT [FK_Orders_ShippingAddressID_CustomerAddresses_CustomerAddressID] FOREIGN KEY ([ShippingAddressID]) REFERENCES [CustomerAddresses]([CustomerAddressID]);
    ALTER TABLE [Orders] ADD CONSTRAINT [FK_Orders_BillingAddressID_CustomerAddresses_CustomerAddressID] FOREIGN KEY ([BillingAddressID]) REFERENCES [CustomerAddresses]([CustomerAddressID]);
    ALTER TABLE [SellerOrders] ADD CONSTRAINT [FK_SellerOrders_OrderID_Orders_OrderID] FOREIGN KEY ([OrderID]) REFERENCES [Orders]([OrderID]);
    ALTER TABLE [SellerOrders] ADD CONSTRAINT [FK_SellerOrders_SellerID_Sellers_SellerID] FOREIGN KEY ([SellerID]) REFERENCES [Sellers]([SellerID]);
    ALTER TABLE [Payments] ADD CONSTRAINT [FK_Payments_PaymentModeID_PaymentModes_PaymentModeID] FOREIGN KEY ([PaymentModeID]) REFERENCES [PaymentModes]([PaymentModeID]);
    ALTER TABLE [Payments] ADD CONSTRAINT [FK_Payments_OrderID_Orders_OrderID] FOREIGN KEY ([OrderID]) REFERENCES [Orders]([OrderID]);
    ALTER TABLE [Fulfillments] ADD CONSTRAINT [FK_Fulfillments_OrderID_Orders_OrderID] FOREIGN KEY ([OrderID]) REFERENCES [Orders]([OrderID]);
    ALTER TABLE [Fulfillments] ADD CONSTRAINT [FK_Fulfillments_SellerID_Sellers_SellerID] FOREIGN KEY ([SellerID]) REFERENCES [Sellers]([SellerID]);
    ALTER TABLE [Fulfillments] ADD CONSTRAINT [FK_Fulfillments_WarehouseID_Warehouses_WarehouseID] FOREIGN KEY ([WarehouseID]) REFERENCES [Warehouses]([WarehouseID]);
    ALTER TABLE [FulfillmentItems] ADD CONSTRAINT [FK_FulfillmentItems_FulfillmentID_Fulfillments_FulfillmentID] FOREIGN KEY ([FulfillmentID]) REFERENCES [Fulfillments]([FulfillmentID]);
    ALTER TABLE [FulfillmentItems] ADD CONSTRAINT [FK_FulfillmentItems_OrderItemID_OrderItems_OrderItemID] FOREIGN KEY ([OrderItemID]) REFERENCES [OrderItems]([OrderItemID]);
    ALTER TABLE [FulfillmentItems] ADD CONSTRAINT [FK_FulfillmentItems_WarehouseProductID_WarehouseProducts_WarehouseProductID] FOREIGN KEY ([WarehouseProductID]) REFERENCES [WarehouseProducts]([WarehouseProductID]);
    ALTER TABLE [Shipments] ADD CONSTRAINT [FK_Shipments_FulfillmentID_Fulfillments_FulfillmentID] FOREIGN KEY ([FulfillmentID]) REFERENCES [Fulfillments]([FulfillmentID]);
    ALTER TABLE [ShipmentTrackingEvents] ADD CONSTRAINT [FK_ShipmentTrackingEvents_ShipmentID_Shipments_ShipmentID] FOREIGN KEY ([ShipmentID]) REFERENCES [Shipments]([ShipmentID]);
    ALTER TABLE [Wishlists] ADD CONSTRAINT [FK_Wishlists_CustomerID_Customers_CustomerID] FOREIGN KEY ([CustomerID]) REFERENCES [Customers]([CustomerID]);
    ALTER TABLE [WishlistItems] ADD CONSTRAINT [FK_WishlistItems_WishlistID_Wishlists_WishlistID] FOREIGN KEY ([WishlistID]) REFERENCES [Wishlists]([WishlistID]);
    ALTER TABLE [WishlistItems] ADD CONSTRAINT [FK_WishlistItems_ProductVariantID_ProductVariants_ProductVariantID] FOREIGN KEY ([ProductVariantID]) REFERENCES [ProductVariants]([ProductVariantID]);
    ALTER TABLE [Invoices] ADD CONSTRAINT [FK_Invoices_OrderID_Orders_OrderID] FOREIGN KEY ([OrderID]) REFERENCES [Orders]([OrderID]);
    ALTER TABLE [Invoices] ADD CONSTRAINT [FK_Invoices_SellerID_Sellers_SellerID] FOREIGN KEY ([SellerID]) REFERENCES [Sellers]([SellerID]);
    ALTER TABLE [Invoices] ADD CONSTRAINT [FK_Invoices_CustomerID_Customers_CustomerID] FOREIGN KEY ([CustomerID]) REFERENCES [Customers]([CustomerID]);
    ALTER TABLE [InvoiceItems] ADD CONSTRAINT [FK_InvoiceItems_InvoiceID_Invoices_InvoiceID] FOREIGN KEY ([InvoiceID]) REFERENCES [Invoices]([InvoiceID]);
    ALTER TABLE [InvoiceItems] ADD CONSTRAINT [FK_InvoiceItems_OrderItemID_OrderItems_OrderItemID] FOREIGN KEY ([OrderItemID]) REFERENCES [OrderItems]([OrderItemID]);
    ALTER TABLE [Invoices] ADD CONSTRAINT [FK_Invoices_CreatedBy_Users_UserID] FOREIGN KEY ([CreatedBy]) REFERENCES [Users]([UserID]);
    ALTER TABLE [Invoices] ADD CONSTRAINT [FK_Invoices_UpdatedBy_Users_UserID] FOREIGN KEY ([UpdatedBy]) REFERENCES [Users]([UserID]);
    ALTER TABLE [InvoiceItems] ADD CONSTRAINT [FK_InvoiceItems_CreatedBy_Users_UserID] FOREIGN KEY ([CreatedBy]) REFERENCES [Users]([UserID]);
    ALTER TABLE [CMSPages] ADD CONSTRAINT [FK_CMSPages_CreatedBy_Users_UserID] FOREIGN KEY ([CreatedBy]) REFERENCES [Users]([UserID]);
    ALTER TABLE [CMSPages] ADD CONSTRAINT [FK_CMSPages_UpdatedBy_Users_UserID] FOREIGN KEY ([UpdatedBy]) REFERENCES [Users]([UserID]);
    ALTER TABLE [Banners] ADD CONSTRAINT [FK_Banners_CreatedBy_Users_UserID] FOREIGN KEY ([CreatedBy]) REFERENCES [Users]([UserID]);
    ALTER TABLE [Banners] ADD CONSTRAINT [FK_Banners_UpdatedBy_Users_UserID] FOREIGN KEY ([UpdatedBy]) REFERENCES [Users]([UserID]);
    ALTER TABLE [Banners] ADD CONSTRAINT [FK_Banners_ProductID_ProductMaster_ProductID] FOREIGN KEY ([ProductID]) REFERENCES [ProductMaster]([ProductID]);
    ALTER TABLE [Banners] ADD CONSTRAINT [FK_Banners_CategoryID_Categories_CategoryID] FOREIGN KEY ([CategoryID]) REFERENCES [Categories]([CategoryID]);
    ALTER TABLE [Banners] ADD CONSTRAINT [FK_Banners_WarehouseID_Warehouses_WarehouseID] FOREIGN KEY ([WarehouseID]) REFERENCES [Warehouses]([WarehouseID]);
    ALTER TABLE [Banners] ADD CONSTRAINT [FK_Banners_PromotionID_Promotions_PromotionID] FOREIGN KEY ([PromotionID]) REFERENCES [Promotions]([PromotionID]);
    ALTER TABLE [PromotionProducts] ADD CONSTRAINT [FK_PromotionProducts_PromotionID_Promotions_PromotionID] FOREIGN KEY ([PromotionID]) REFERENCES [Promotions]([PromotionID]);
    ALTER TABLE [PromotionProducts] ADD CONSTRAINT [FK_PromotionProducts_ProductVariantID_ProductVariants_ProductVariantID] FOREIGN KEY ([ProductVariantID]) REFERENCES [ProductVariants]([ProductVariantID]);
    ALTER TABLE [CategoryAttributes] ADD CONSTRAINT [FK_CategoryAttributes_CategoryID_Categories_CategoryID] FOREIGN KEY ([CategoryID]) REFERENCES [Categories]([CategoryID]);
    ALTER TABLE [CategoryAttributes] ADD CONSTRAINT [FK_CategoryAttributes_AttributeID_Attributes_AttributeID] FOREIGN KEY ([AttributeID]) REFERENCES [Attributes]([AttributeID]);
    ALTER TABLE [Users] ADD CONSTRAINT [FK_Users_CreatedBy_Users_UserID] FOREIGN KEY ([CreatedBy]) REFERENCES [Users]([UserID]);
    ALTER TABLE [Users] ADD CONSTRAINT [FK_Users_UpdatedBy_Users_UserID] FOREIGN KEY ([UpdatedBy]) REFERENCES [Users]([UserID]);
    ALTER TABLE [Roles] ADD CONSTRAINT [FK_Roles_CreatedBy_Users_UserID] FOREIGN KEY ([CreatedBy]) REFERENCES [Users]([UserID]);
    ALTER TABLE [Roles] ADD CONSTRAINT [FK_Roles_UpdatedBy_Users_UserID] FOREIGN KEY ([UpdatedBy]) REFERENCES [Users]([UserID]);
    ALTER TABLE [Permissions] ADD CONSTRAINT [FK_Permissions_CreatedBy_Users_UserID] FOREIGN KEY ([CreatedBy]) REFERENCES [Users]([UserID]);
    ALTER TABLE [UserRoles] ADD CONSTRAINT [FK_UserRoles_CreatedBy_Users_UserID] FOREIGN KEY ([CreatedBy]) REFERENCES [Users]([UserID]);
    ALTER TABLE [RolePermissions] ADD CONSTRAINT [FK_RolePermissions_CreatedBy_Users_UserID] FOREIGN KEY ([CreatedBy]) REFERENCES [Users]([UserID]);
    ALTER TABLE [Customers] ADD CONSTRAINT [FK_Customers_CreatedBy_Users_UserID] FOREIGN KEY ([CreatedBy]) REFERENCES [Users]([UserID]);
    ALTER TABLE [Customers] ADD CONSTRAINT [FK_Customers_UpdatedBy_Users_UserID] FOREIGN KEY ([UpdatedBy]) REFERENCES [Users]([UserID]);
    ALTER TABLE [Sellers] ADD CONSTRAINT [FK_Sellers_CreatedBy_Users_UserID] FOREIGN KEY ([CreatedBy]) REFERENCES [Users]([UserID]);
    ALTER TABLE [Sellers] ADD CONSTRAINT [FK_Sellers_UpdatedBy_Users_UserID] FOREIGN KEY ([UpdatedBy]) REFERENCES [Users]([UserID]);
    ALTER TABLE [SellerUsers] ADD CONSTRAINT [FK_SellerUsers_CreatedBy_Users_UserID] FOREIGN KEY ([CreatedBy]) REFERENCES [Users]([UserID]);
    ALTER TABLE [SellerUsers] ADD CONSTRAINT [FK_SellerUsers_UpdatedBy_Users_UserID] FOREIGN KEY ([UpdatedBy]) REFERENCES [Users]([UserID]);
    ALTER TABLE [Categories] ADD CONSTRAINT [FK_Categories_CreatedBy_Users_UserID] FOREIGN KEY ([CreatedBy]) REFERENCES [Users]([UserID]);
    ALTER TABLE [Categories] ADD CONSTRAINT [FK_Categories_UpdatedBy_Users_UserID] FOREIGN KEY ([UpdatedBy]) REFERENCES [Users]([UserID]);
    ALTER TABLE [Brands] ADD CONSTRAINT [FK_Brands_CreatedBy_Users_UserID] FOREIGN KEY ([CreatedBy]) REFERENCES [Users]([UserID]);
    ALTER TABLE [Brands] ADD CONSTRAINT [FK_Brands_UpdatedBy_Users_UserID] FOREIGN KEY ([UpdatedBy]) REFERENCES [Users]([UserID]);
    ALTER TABLE [ProductMaster] ADD CONSTRAINT [FK_ProductMaster_CreatedBy_Users_UserID] FOREIGN KEY ([CreatedBy]) REFERENCES [Users]([UserID]);
    ALTER TABLE [ProductMaster] ADD CONSTRAINT [FK_ProductMaster_UpdatedBy_Users_UserID] FOREIGN KEY ([UpdatedBy]) REFERENCES [Users]([UserID]);
    ALTER TABLE [ProductCategories] ADD CONSTRAINT [FK_ProductCategories_CreatedBy_Users_UserID] FOREIGN KEY ([CreatedBy]) REFERENCES [Users]([UserID]);
    ALTER TABLE [ProductAssets] ADD CONSTRAINT [FK_ProductAssets_CreatedBy_Users_UserID] FOREIGN KEY ([CreatedBy]) REFERENCES [Users]([UserID]);
    ALTER TABLE [ProductAssets] ADD CONSTRAINT [FK_ProductAssets_UpdatedBy_Users_UserID] FOREIGN KEY ([UpdatedBy]) REFERENCES [Users]([UserID]);
    ALTER TABLE [Attributes] ADD CONSTRAINT [FK_Attributes_CreatedBy_Users_UserID] FOREIGN KEY ([CreatedBy]) REFERENCES [Users]([UserID]);
    ALTER TABLE [Attributes] ADD CONSTRAINT [FK_Attributes_UpdatedBy_Users_UserID] FOREIGN KEY ([UpdatedBy]) REFERENCES [Users]([UserID]);
    ALTER TABLE [ProductVariantAttributes] ADD CONSTRAINT [FK_ProductVariantAttributes_CreatedBy_Users_UserID] FOREIGN KEY ([CreatedBy]) REFERENCES [Users]([UserID]);
    ALTER TABLE [ProductVariantAttributes] ADD CONSTRAINT [FK_ProductVariantAttributes_UpdatedBy_Users_UserID] FOREIGN KEY ([UpdatedBy]) REFERENCES [Users]([UserID]);
    ALTER TABLE [UOM] ADD CONSTRAINT [FK_UOM_CreatedBy_Users_UserID] FOREIGN KEY ([CreatedBy]) REFERENCES [Users]([UserID]);
    ALTER TABLE [UOM] ADD CONSTRAINT [FK_UOM_UpdatedBy_Users_UserID] FOREIGN KEY ([UpdatedBy]) REFERENCES [Users]([UserID]);
    ALTER TABLE [ProductVariantUOMs] ADD CONSTRAINT [FK_ProductVariantUOMs_CreatedBy_Users_UserID] FOREIGN KEY ([CreatedBy]) REFERENCES [Users]([UserID]);
    ALTER TABLE [ProductVariantUOMs] ADD CONSTRAINT [FK_ProductVariantUOMs_UpdatedBy_Users_UserID] FOREIGN KEY ([UpdatedBy]) REFERENCES [Users]([UserID]);
    ALTER TABLE [SellerProducts] ADD CONSTRAINT [FK_SellerProducts_CreatedBy_Users_UserID] FOREIGN KEY ([CreatedBy]) REFERENCES [Users]([UserID]);
    ALTER TABLE [SellerProducts] ADD CONSTRAINT [FK_SellerProducts_UpdatedBy_Users_UserID] FOREIGN KEY ([UpdatedBy]) REFERENCES [Users]([UserID]);
    ALTER TABLE [Warehouses] ADD CONSTRAINT [FK_Warehouses_CreatedBy_Users_UserID] FOREIGN KEY ([CreatedBy]) REFERENCES [Users]([UserID]);
    ALTER TABLE [Warehouses] ADD CONSTRAINT [FK_Warehouses_UpdatedBy_Users_UserID] FOREIGN KEY ([UpdatedBy]) REFERENCES [Users]([UserID]);
    ALTER TABLE [SellerApplications] ADD CONSTRAINT [FK_SellerApplications_ReviewedBy_Users_UserID] FOREIGN KEY ([ReviewedBy]) REFERENCES [Users]([UserID]);
    ALTER TABLE [SellerApplicationDocuments] ADD CONSTRAINT [FK_SellerApplicationDocuments_VerifiedBy_Users_UserID] FOREIGN KEY ([VerifiedBy]) REFERENCES [Users]([UserID]);
    ALTER TABLE [WarehouseUsers] ADD CONSTRAINT [FK_WarehouseUsers_CreatedBy_Users_UserID] FOREIGN KEY ([CreatedBy]) REFERENCES [Users]([UserID]);
    ALTER TABLE [WarehouseUsers] ADD CONSTRAINT [FK_WarehouseUsers_UpdatedBy_Users_UserID] FOREIGN KEY ([UpdatedBy]) REFERENCES [Users]([UserID]);
    ALTER TABLE [WarehouseProducts] ADD CONSTRAINT [FK_WarehouseProducts_CreatedBy_Users_UserID] FOREIGN KEY ([CreatedBy]) REFERENCES [Users]([UserID]);
    ALTER TABLE [WarehouseProducts] ADD CONSTRAINT [FK_WarehouseProducts_UpdatedBy_Users_UserID] FOREIGN KEY ([UpdatedBy]) REFERENCES [Users]([UserID]);
    ALTER TABLE [SellerWarehouses] ADD CONSTRAINT [FK_SellerWarehouses_CreatedBy_Users_UserID] FOREIGN KEY ([CreatedBy]) REFERENCES [Users]([UserID]);
    ALTER TABLE [SellerWarehouses] ADD CONSTRAINT [FK_SellerWarehouses_UpdatedBy_Users_UserID] FOREIGN KEY ([UpdatedBy]) REFERENCES [Users]([UserID]);
    ALTER TABLE [Inventory] ADD CONSTRAINT [FK_Inventory_UpdatedBy_Users_UserID] FOREIGN KEY ([UpdatedBy]) REFERENCES [Users]([UserID]);
    ALTER TABLE [InventoryTransactions] ADD CONSTRAINT [FK_InventoryTransactions_CreatedBy_Users_UserID] FOREIGN KEY ([CreatedBy]) REFERENCES [Users]([UserID]);
    ALTER TABLE [OrderStatusHistory] ADD CONSTRAINT [FK_OrderStatusHistory_ChangedBy_Users_UserID] FOREIGN KEY ([ChangedBy]) REFERENCES [Users]([UserID]);
    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
GO

-- ============================================================
-- SEED DATA
-- ============================================================
SET IDENTITY_INSERT [Categories] ON;
INSERT INTO [Categories] ([CategoryID],[ParentCategoryID],[CategoryName],[Description],[IconURL],[ImageURL],[BannerURL],[Status],[CreatedAt],[CreatedBy],[UpdatedAt],[UpdatedBy]) VALUES (1, NULL, N'Kitchen', N'Kitchen and cooking essentials', NULL, N'/images/categories/kitchen.jpg', N'/images/categories/kitchen-banner.jpg', 'ACTIVE', SYSUTCDATETIME(), NULL, NULL, NULL);
INSERT INTO [Categories] ([CategoryID],[ParentCategoryID],[CategoryName],[Description],[IconURL],[ImageURL],[BannerURL],[Status],[CreatedAt],[CreatedBy],[UpdatedAt],[UpdatedBy]) VALUES (2, NULL, N'Home', N'Home organization and utility products', NULL, N'/images/categories/home.jpg', N'/images/categories/home-banner.jpg', 'ACTIVE', SYSUTCDATETIME(), NULL, NULL, NULL);
INSERT INTO [Categories] ([CategoryID],[ParentCategoryID],[CategoryName],[Description],[IconURL],[ImageURL],[BannerURL],[Status],[CreatedAt],[CreatedBy],[UpdatedAt],[UpdatedBy]) VALUES (3, 1, N'Cookware', N'Cookware and pressure cooking products', NULL, N'/images/categories/cookware.jpg', N'/images/categories/cookware-banner.jpg', 'ACTIVE', SYSUTCDATETIME(), NULL, NULL, NULL);
INSERT INTO [Categories] ([CategoryID],[ParentCategoryID],[CategoryName],[Description],[IconURL],[ImageURL],[BannerURL],[Status],[CreatedAt],[CreatedBy],[UpdatedAt],[UpdatedBy]) VALUES (4, 1, N'Kitchen Preparation', N'Food preparation tools and appliances', NULL, N'/images/categories/kitchen-preparation.jpg', N'/images/categories/kitchen-preparation-banner.jpg', 'ACTIVE', SYSUTCDATETIME(), NULL, NULL, NULL);
INSERT INTO [Categories] ([CategoryID],[ParentCategoryID],[CategoryName],[Description],[IconURL],[ImageURL],[BannerURL],[Status],[CreatedAt],[CreatedBy],[UpdatedAt],[UpdatedBy]) VALUES (5, 2, N'Home Organization', N'Storage and organization products', NULL, N'/images/categories/home-organization.jpg', N'/images/categories/home-organization-banner.jpg', 'ACTIVE', SYSUTCDATETIME(), NULL, NULL, NULL);
INSERT INTO [Categories] ([CategoryID],[ParentCategoryID],[CategoryName],[Description],[IconURL],[ImageURL],[BannerURL],[Status],[CreatedAt],[CreatedBy],[UpdatedAt],[UpdatedBy]) VALUES (6, 2, N'Bathroom Utility', N'Bathroom utility and storage products', NULL, N'/images/categories/bathroom-utility.jpg', N'/images/categories/bathroom-utility-banner.jpg', 'ACTIVE', SYSUTCDATETIME(), NULL, NULL, NULL);
INSERT INTO [Categories] ([CategoryID],[ParentCategoryID],[CategoryName],[Description],[IconURL],[ImageURL],[BannerURL],[Status],[CreatedAt],[CreatedBy],[UpdatedAt],[UpdatedBy]) VALUES (7, 3, N'Pressure Cookers', N'Pressure cookers and pressure cooking vessels', NULL, N'/images/categories/pressure-cookers.jpg', N'/images/categories/pressure-cookers-banner.jpg', 'ACTIVE', SYSUTCDATETIME(), NULL, NULL, NULL);
INSERT INTO [Categories] ([CategoryID],[ParentCategoryID],[CategoryName],[Description],[IconURL],[ImageURL],[BannerURL],[Status],[CreatedAt],[CreatedBy],[UpdatedAt],[UpdatedBy]) VALUES (8, 3, N'Fry Pans', N'Fry pans and cooking pans', NULL, N'/images/categories/fry-pans.jpg', N'/images/categories/fry-pans-banner.jpg', 'ACTIVE', SYSUTCDATETIME(), NULL, NULL, NULL);
INSERT INTO [Categories] ([CategoryID],[ParentCategoryID],[CategoryName],[Description],[IconURL],[ImageURL],[BannerURL],[Status],[CreatedAt],[CreatedBy],[UpdatedAt],[UpdatedBy]) VALUES (9, 4, N'Choppers', N'Manual food choppers', NULL, N'/images/categories/choppers.jpg', N'/images/categories/choppers-banner.jpg', 'ACTIVE', SYSUTCDATETIME(), NULL, NULL, NULL);
INSERT INTO [Categories] ([CategoryID],[ParentCategoryID],[CategoryName],[Description],[IconURL],[ImageURL],[BannerURL],[Status],[CreatedAt],[CreatedBy],[UpdatedAt],[UpdatedBy]) VALUES (10, 5, N'Storage Containers', N'Food and household storage containers', NULL, N'/images/categories/storage-containers.jpg', N'/images/categories/storage-containers-banner.jpg', 'ACTIVE', SYSUTCDATETIME(), NULL, NULL, NULL);
INSERT INTO [Categories] ([CategoryID],[ParentCategoryID],[CategoryName],[Description],[IconURL],[ImageURL],[BannerURL],[Status],[CreatedAt],[CreatedBy],[UpdatedAt],[UpdatedBy]) VALUES (11, 6, N'Bathroom Organizers', N'Bathroom racks and organizers', NULL, N'/images/categories/bathroom-organizers.jpg', N'/images/categories/bathroom-organizers-banner.jpg', 'ACTIVE', SYSUTCDATETIME(), NULL, NULL, NULL);
SET IDENTITY_INSERT [Categories] OFF;

INSERT INTO [Brands] ([BrandName],[Manufacturer],[Description],[Status],[CreatedAt]) VALUES
(N'Prestige',N'TTK Prestige',N'Kitchen appliances and cookware',N'ACTIVE',SYSUTCDATETIME()),
(N'Hawkins',N'Hawkins Cookers Limited',N'Pressure cookers and cookware',N'ACTIVE',SYSUTCDATETIME()),
(N'Wonderchef',N'Wonderchef Home Appliances Pvt. Ltd.',N'Cookware and kitchen products',N'ACTIVE',SYSUTCDATETIME()),
(N'Cello',N'Cello World',N'Household storage and utility products',N'ACTIVE',SYSUTCDATETIME());

INSERT INTO [Attributes] ([AttributeName],[DataType],[Status],[CreatedAt]) VALUES
(N'Material','STRING','ACTIVE',SYSUTCDATETIME()),
(N'Base Material','STRING','ACTIVE',SYSUTCDATETIME()),
(N'Color','STRING','ACTIVE',SYSUTCDATETIME()),
(N'Power','NUMBER','ACTIVE',SYSUTCDATETIME()),
(N'Blade Material','STRING','ACTIVE',SYSUTCDATETIME()),
(N'Pieces','NUMBER','ACTIVE',SYSUTCDATETIME()),
(N'BPA Free','BOOLEAN','ACTIVE',SYSUTCDATETIME()),
(N'Induction Compatible','BOOLEAN','ACTIVE',SYSUTCDATETIME());

INSERT INTO [CategoryAttributes] ([CategoryID],[AttributeID],[IsRequired],[DisplayOrder],[Status],[CreatedAt]) SELECT c.CategoryID,a.AttributeID,ca.IsRequired,ca.DisplayOrder,'ACTIVE',SYSUTCDATETIME() FROM (VALUES
('Pressure Cookers','Material',1,1),('Pressure Cookers','Base Material',1,2),('Pressure Cookers','Induction Compatible',0,3),('Fry Pans','Material',1,1),('Fry Pans','Base Material',0,2),('Fry Pans','Induction Compatible',1,3),('Choppers','Power',1,1),('Choppers','Blade Material',1,2),('Choppers','Pieces',0,3),('Storage Containers','Material',1,1),('Storage Containers','Color',0,2),('Storage Containers','Pieces',1,3),('Storage Containers','BPA Free',1,4),('Bathroom Organizers','Material',1,1),('Bathroom Organizers','Color',0,2)) ca(CategoryName,AttributeName,IsRequired,DisplayOrder) JOIN [Categories] c ON c.CategoryName=ca.CategoryName JOIN [Attributes] a ON a.AttributeName=ca.AttributeName;
INSERT INTO [UOM] ([UOMCode],[UOMName],[UOMType],[DecimalPrecision],[Status],[CreatedAt]) VALUES ('L','Litre','VOLUME',2,'ACTIVE',SYSUTCDATETIME()),('ML','Millilitre','VOLUME',0,'ACTIVE',SYSUTCDATETIME()),('PC','Piece','COUNT',0,'ACTIVE',SYSUTCDATETIME()),('KG','Kilogram','WEIGHT',3,'ACTIVE',SYSUTCDATETIME());

INSERT INTO [Sellers] ([SellerCode],[SellerName],[BusinessName],[Email],[PhoneNumber],[Status],[CreatedAt]) VALUES ('SEL001',N'KitchenKart',N'KitchenKart Retail Pvt Ltd',N'ops@kitchenkart.example',N'9876500001','ACTIVE',SYSUTCDATETIME()),('SEL002',N'HomeNeeds',N'HomeNeeds Retail Pvt Ltd',N'ops@homeneeds.example',N'9876500002','ACTIVE',SYSUTCDATETIME());

INSERT INTO [Warehouses] ([WarehouseName],[WarehouseCode],[WarehouseType],[ContactPersonName],[ContactEmail],[ContactPhoneNumber],[AddressLine1],[City],[State],[PostalCode],[Country],[Status],[CreatedAt]) VALUES (N'Hyderabad Main Warehouse','WH-HYD-01','OWN',N'Ravi Kumar',N'warehouse1@example.com',N'9000000001',N'Industrial Area Phase 1',N'Hyderabad',N'Telangana',N'500037',N'India','VERIFIED',SYSUTCDATETIME()),(N'Bengaluru 3PL Warehouse','WH-BLR-01','THIRD_PARTY',N'Anita Rao',N'warehouse2@example.com',N'9000000002',N'Peenya Industrial Area',N'Bengaluru',N'Karnataka',N'560058',N'India','VERIFIED',SYSUTCDATETIME());

INSERT INTO [SellerWarehouses] ([SellerID],[WarehouseID],[Status],[IsPrimary],[CreatedAt]) VALUES (1,1,'ACTIVE',1,SYSUTCDATETIME()),(1,2,'ACTIVE',0,SYSUTCDATETIME()),(2,1,'ACTIVE',1,SYSUTCDATETIME()),(2,2,'ACTIVE',0,SYSUTCDATETIME());

SET IDENTITY_INSERT [ProductMaster] ON;
INSERT INTO [ProductMaster] ([ProductID],[ParentSKU],[BrandID],[ProductName],[Description],[BaseModelCode],[HSNCode],[GSTRate],[IsVerified],[Status],[CreatedAt]) VALUES
(1,N'PRE-PC',1,N'Prestige Aluminium Pressure Cooker',N'Aluminium pressure cooker product family',N'PRE-PC',N'76151010',18.00,1,'ACTIVE',SYSUTCDATETIME()),
(2,N'HAW-PC',2,N'Hawkins Stainless Steel Pressure Cooker',N'Stainless steel pressure cooker product family',N'HAW-PC',N'76151010',18.00,1,'ACTIVE',SYSUTCDATETIME()),
(3,N'WC-FP',3,N'Wonderchef Granite Fry Pan',N'Granite non-stick fry pan product family',N'WC-FP',N'76151900',18.00,1,'ACTIVE',SYSUTCDATETIME()),
(4,N'WC-CH',3,N'Wonderchef Manual Food Chopper',N'Manual food chopper product family',N'WC-CH',N'85094090',18.00,1,'ACTIVE',SYSUTCDATETIME()),
(5,N'CEL-ST',4,N'Cello Food Storage Container Set',N'Food storage container product family',N'CEL-ST',N'39249090',18.00,1,'ACTIVE',SYSUTCDATETIME()),
(6,N'CEL-BR',4,N'Cello Bathroom Corner Rack',N'Bathroom organizer product family',N'CEL-BR',N'39249090',18.00,1,'ACTIVE',SYSUTCDATETIME());
SET IDENTITY_INSERT [ProductMaster] OFF;

SET IDENTITY_INSERT [ProductVariants] ON;
INSERT INTO [ProductVariants] ([ProductVariantID],[ProductMasterID],[VariantSKU],[GTIN],[VariantModelCode],[Length],[Width],[Height],[Weight],[Capacity],[Status],[CreatedAt]) VALUES
(1,1,N'PROD-PRESTIGE-PC-3L',N'100000000001',N'PRE-PC-3L',30.0,30.0,25.0,2.10,3.0,'ACTIVE',SYSUTCDATETIME()),
(2,1,N'PROD-PRESTIGE-PC-5L',N'100000000002',N'PRE-PC-5L',33.0,33.0,28.0,2.80,5.0,'ACTIVE',SYSUTCDATETIME()),
(3,2,N'PROD-HAWKINS-PC-5L',N'100000000003',N'HAW-PC-5L',33.0,33.0,29.0,3.20,5.0,'ACTIVE',SYSUTCDATETIME()),
(4,3,N'PROD-WONDERCHEF-FP-28',N'100000000004',N'WC-FP-28',48.0,28.0,8.0,1.20,2.8,'ACTIVE',SYSUTCDATETIME()),
(5,4,N'PROD-WONDERCHEF-CHOP-500',N'100000000005',N'WC-CH-500',15.0,15.0,18.0,0.65,0.5,'ACTIVE',SYSUTCDATETIME()),
(6,5,N'PROD-CELLO-STORAGE-5PC',N'100000000006',N'CEL-ST-5PC',30.0,20.0,15.0,0.90,NULL,'ACTIVE',SYSUTCDATETIME()),
(7,6,N'PROD-CELLO-BATH-RACK',N'100000000007',N'CEL-BR-01',25.0,25.0,60.0,1.10,NULL,'ACTIVE',SYSUTCDATETIME());
SET IDENTITY_INSERT [ProductVariants] OFF;

INSERT INTO [ProductCategories] ([ProductID],[CategoryID],[CreatedAt]) VALUES (1,7,SYSUTCDATETIME()),(2,7,SYSUTCDATETIME()),(3,8,SYSUTCDATETIME()),(4,9,SYSUTCDATETIME()),(5,10,SYSUTCDATETIME()),(6,11,SYSUTCDATETIME());

INSERT INTO [ProductVariantAttributes] ([ProductVariantID],[AttributeID],[AttributeValue],[CreatedAt]) SELECT v.ProductVariantID,a.AttributeID,v.AttributeValue,SYSUTCDATETIME() FROM (VALUES
(1,'Material','Aluminium'),(1,'Base Material','Aluminium'),(1,'Induction Compatible','false'),
(2,'Material','Aluminium'),(2,'Base Material','Aluminium'),(2,'Induction Compatible','false'),
(3,'Material','Stainless Steel'),(3,'Base Material','Stainless Steel'),(3,'Induction Compatible','true'),
(4,'Material','Granite Non-Stick'),(4,'Base Material','Aluminium'),(4,'Induction Compatible','true'),
(5,'Power','0'),(5,'Blade Material','Stainless Steel'),(5,'Pieces','1'),
(6,'Material','Food Grade Plastic'),(6,'Color','Transparent'),(6,'Pieces','5'),(6,'BPA Free','true'),
(7,'Material','Plastic'),(7,'Color','White')) v(ProductVariantID,AttributeName,AttributeValue) JOIN [Attributes] a ON a.AttributeName=v.AttributeName;

INSERT INTO [ProductVariantUOMs] ([ProductVariantID],[UOMID],[Quantity],[Status],[CreatedAt]) SELECT v.ProductVariantID,u.UOMID,v.Quantity,'ACTIVE',SYSUTCDATETIME() FROM (VALUES (1,'L',3.0),(2,'L',5.0),(3,'L',5.0),(4,'PC',1.0),(5,'ML',500.0),(6,'PC',5.0),(7,'PC',1.0)) v(ProductVariantID,UOMCode,Quantity) JOIN [UOM] u ON u.UOMCode=v.UOMCode;

INSERT INTO [ProductAssets] ([ProductVariantID],[AssetType],[AssetURL],[IsPrimary],[AltText],[DisplayOrder],[Status],[CreatedAt]) VALUES
(1,'IMAGE',N'/products/prestige-3l.jpg',1,N'Prestige 3L Aluminium Pressure Cooker',1,'ACTIVE',SYSUTCDATETIME()),
(1,'IMAGE',N'/products/prestige-3l-side.jpg',0,N'Prestige 3L Pressure Cooker side view',2,'ACTIVE',SYSUTCDATETIME()),
(2,'IMAGE',N'/products/prestige-5l.jpg',1,N'Prestige 5L Aluminium Pressure Cooker',1,'ACTIVE',SYSUTCDATETIME()),
(3,'IMAGE',N'/products/hawkins-5l.jpg',1,N'Hawkins 5L Stainless Steel Pressure Cooker',1,'ACTIVE',SYSUTCDATETIME()),
(4,'IMAGE',N'/products/wonderchef-28cm-pan.jpg',1,N'Wonderchef 28cm Granite Fry Pan',1,'ACTIVE',SYSUTCDATETIME()),
(5,'IMAGE',N'/products/wonderchef-chopper-500ml.jpg',1,N'Wonderchef 500ml Manual Food Chopper',1,'ACTIVE',SYSUTCDATETIME()),
(6,'IMAGE',N'/products/cello-storage-5pc.jpg',1,N'Cello 5 Piece Food Storage Container Set',1,'ACTIVE',SYSUTCDATETIME()),
(7,'IMAGE',N'/products/cello-bath-rack.jpg',1,N'Cello Bathroom Corner Rack',1,'ACTIVE',SYSUTCDATETIME());

INSERT INTO [SellerProducts] ([SellerID],[ProductVariantID],[SellerSKU],[PurchasePrice],[SellingPrice],[MRP],[Status],[CreatedAt]) VALUES (1,1,N'KK-PC-3L',650,799,999,'ACTIVE',SYSUTCDATETIME()),(1,2,N'KK-PC-5L',850,999,1199,'ACTIVE',SYSUTCDATETIME()),(1,4,N'KK-FP-28',700,899,1099,'ACTIVE',SYSUTCDATETIME()),(1,5,N'KK-CH-500',250,349,399,'ACTIVE',SYSUTCDATETIME()),(2,3,N'HN-PC-5L',900,1099,1299,'ACTIVE',SYSUTCDATETIME()),(2,6,N'HN-ST-5PC',300,449,549,'ACTIVE',SYSUTCDATETIME()),(2,7,N'HN-BR-01',180,249,299,'ACTIVE',SYSUTCDATETIME());

INSERT INTO [WarehouseProducts] ([WarehouseID],[SellerProductID],[WarehouseSKU],[Status],[CreatedAt]) VALUES (1,1,N'WH1-KK-PC-3L','ACTIVE',SYSUTCDATETIME()),(1,2,N'WH1-KK-PC-5L','ACTIVE',SYSUTCDATETIME()),(2,3,N'WH2-KK-FP-28','ACTIVE',SYSUTCDATETIME()),(1,4,N'WH1-KK-CH-500','ACTIVE',SYSUTCDATETIME()),(1,5,N'WH1-HN-PC-5L','ACTIVE',SYSUTCDATETIME()),(2,6,N'WH2-HN-ST-5PC','ACTIVE',SYSUTCDATETIME()),(1,7,N'WH1-HN-BR-01','ACTIVE',SYSUTCDATETIME());

INSERT INTO [Inventory] ([WarehouseProductID],[PhysicalQuantity],[ReservedQuantity],[DamagedQuantity],[SafetyStockQuantity],[UpdatedAt]) VALUES (1,120,5,1,10,SYSUTCDATETIME()),(2,80,3,0,8,SYSUTCDATETIME()),(3,60,2,1,5,SYSUTCDATETIME()),(4,150,10,2,15,SYSUTCDATETIME()),(5,45,1,0,5,SYSUTCDATETIME()),(6,100,4,0,10,SYSUTCDATETIME()),(7,75,2,0,8,SYSUTCDATETIME());

-- Catalog architecture verification
SELECT t.name AS CatalogTable
FROM (VALUES (N'ProductMaster'),(N'ProductVariants'),(N'ProductVariantAttributes'),(N'ProductVariantUOMs'),(N'ProductAssets'),(N'SellerProducts'),(N'WarehouseProducts'),(N'Inventory')) v(name)
JOIN sys.tables t ON t.name=v.name AND t.schema_id=SCHEMA_ID(N'dbo')
ORDER BY t.name;

IF OBJECT_ID(N'dbo.ProductWiseAttributes', N'U') IS NOT NULL
    THROW 51001, 'Deprecated table ProductWiseAttributes still exists.', 1;

IF OBJECT_ID(N'dbo.ProductWiseUOMs', N'U') IS NOT NULL
    THROW 51002, 'Deprecated table ProductWiseUOMs still exists.', 1;

-- ============================================================
-- Document Requirements Tables
-- ============================================================
IF OBJECT_ID(N'dbo.SellerDocumentRequirements', N'U') IS NULL
BEGIN
    CREATE TABLE [SellerDocumentRequirements] (
        [SellerDocumentRequirementID] bigint IDENTITY(1,1),
        [DocumentTypeID] int NOT NULL,
        [IsRequired] bit NOT NULL DEFAULT 1,
        [IsActive] bit NOT NULL DEFAULT 1,
        [CreatedAt] datetime2 NOT NULL,
        [CreatedBy] bigint NOT NULL,
        [UpdatedAt] datetime2,
        [UpdatedBy] bigint,
        CONSTRAINT [PK_SellerDocumentRequirements] PRIMARY KEY CLUSTERED ([SellerDocumentRequirementID]),
        CONSTRAINT [FK_SellerDocumentRequirements_DocumentTypeID_DocumentTypes] FOREIGN KEY ([DocumentTypeID]) REFERENCES [DocumentTypes]([DocumentTypeID]),
        CONSTRAINT [FK_SellerDocumentRequirements_CreatedBy_Users] FOREIGN KEY ([CreatedBy]) REFERENCES [Users]([UserID]),
        CONSTRAINT [FK_SellerDocumentRequirements_UpdatedBy_Users] FOREIGN KEY ([UpdatedBy]) REFERENCES [Users]([UserID])
    );
    CREATE UNIQUE NONCLUSTERED INDEX [UX_SellerDocumentRequirements_DocumentTypeID] ON [SellerDocumentRequirements] ([DocumentTypeID]);
END;

IF OBJECT_ID(N'dbo.WarehouseDocumentRequirements', N'U') IS NULL
BEGIN
    CREATE TABLE [WarehouseDocumentRequirements] (
        [WarehouseDocumentRequirementID] bigint IDENTITY(1,1),
        [WarehouseType] varchar(20) NOT NULL,
        [DocumentTypeID] int NOT NULL,
        [IsRequired] bit NOT NULL DEFAULT 1,
        [IsActive] bit NOT NULL DEFAULT 1,
        [CreatedAt] datetime2 NOT NULL,
        [CreatedBy] bigint NOT NULL,
        [UpdatedAt] datetime2,
        [UpdatedBy] bigint,
        CONSTRAINT [PK_WarehouseDocumentRequirements] PRIMARY KEY CLUSTERED ([WarehouseDocumentRequirementID]),
        CONSTRAINT [FK_WarehouseDocumentRequirements_DocumentTypeID_DocumentTypes] FOREIGN KEY ([DocumentTypeID]) REFERENCES [DocumentTypes]([DocumentTypeID]),
        CONSTRAINT [FK_WarehouseDocumentRequirements_CreatedBy_Users] FOREIGN KEY ([CreatedBy]) REFERENCES [Users]([UserID]),
        CONSTRAINT [FK_WarehouseDocumentRequirements_UpdatedBy_Users] FOREIGN KEY ([UpdatedBy]) REFERENCES [Users]([UserID])
    );
    CREATE UNIQUE NONCLUSTERED INDEX [UX_WarehouseDocumentRequirements_WarehouseType_DocumentTypeID] ON [WarehouseDocumentRequirements] ([WarehouseType], [DocumentTypeID]);
END;

-- ============================================================
-- POLICY MASTERS (RETURN & WARRANTY)
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ReturnReplacementPolicies')
BEGIN
    CREATE TABLE [ReturnReplacementPolicies] (
        [PolicyID] int IDENTITY(1,1) NOT NULL,
        [PolicyCode] varchar(50) NOT NULL,
        [PolicyName] nvarchar(150) NOT NULL,
        [IsReturnable] bit NOT NULL DEFAULT 1,
        [IsReplaceable] bit NOT NULL DEFAULT 1,
        [ReturnWindowDays] int NOT NULL DEFAULT 0,
        [ReplacementWindowDays] int NOT NULL DEFAULT 0,
        [RequiresTechnicianCheck] bit NOT NULL DEFAULT 0,
        [ConditionsSummary] nvarchar(500) NULL,
        [TermsAndConditions] nvarchar(max) NULL,
        [Status] varchar(20) NOT NULL DEFAULT 'ACTIVE',
        [CreatedAt] datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
        [CreatedBy] bigint NULL,
        [UpdatedAt] datetime2 NULL,
        [UpdatedBy] bigint NULL,
        CONSTRAINT [PK_ReturnReplacementPolicies] PRIMARY KEY CLUSTERED ([PolicyID]),
        CONSTRAINT [UQ_ReturnReplacementPolicies_Code] UNIQUE ([PolicyCode])
    );
END;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'WarrantyPolicies')
BEGIN
    CREATE TABLE [WarrantyPolicies] (
        [WarrantyPolicyID] int IDENTITY(1,1) NOT NULL,
        [PolicyCode] varchar(50) NOT NULL,
        [PolicyName] nvarchar(150) NOT NULL,
        [WarrantyType] varchar(30) NOT NULL DEFAULT 'BRAND',
        [DurationMonths] int NOT NULL DEFAULT 0,
        [ServiceType] varchar(30) NOT NULL DEFAULT 'CARRY_IN',
        [CoveredSummary] nvarchar(500) NULL,
        [NotCoveredSummary] nvarchar(500) NULL,
        [TermsAndConditions] nvarchar(max) NULL,
        [Status] varchar(20) NOT NULL DEFAULT 'ACTIVE',
        [CreatedAt] datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
        [CreatedBy] bigint NULL,
        [UpdatedAt] datetime2 NULL,
        [UpdatedBy] bigint NULL,
        CONSTRAINT [PK_WarrantyPolicies] PRIMARY KEY CLUSTERED ([WarrantyPolicyID]),
        CONSTRAINT [UQ_WarrantyPolicies_Code] UNIQUE ([PolicyCode])
    );
END;

-- ============================================================
-- End of schema + seed
-- ============================================================

-- ============================================================
-- VERIFICATION
-- ============================================================
SELECT COUNT(*) AS TableCount
FROM sys.tables
WHERE schema_id = SCHEMA_ID(N'dbo');

SELECT COUNT(*) AS ForeignKeyCount
FROM sys.foreign_keys
WHERE schema_id = SCHEMA_ID(N'dbo');

SELECT COUNT(*) AS IndexCount
FROM sys.indexes
WHERE object_id IN (SELECT object_id FROM sys.tables WHERE schema_id = SCHEMA_ID(N'dbo'))
  AND index_id > 0;
GO
