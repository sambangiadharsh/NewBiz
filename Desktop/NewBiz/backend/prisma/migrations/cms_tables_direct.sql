-- CMS Dynamic Content Tables Migration
-- Run this directly on the database when prisma db push is blocked by constraint conflicts

-- ================================================
-- FAQSections
-- ================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'FAQSections')
BEGIN
  CREATE TABLE [FAQSections] (
    [FAQSectionID]  BIGINT IDENTITY(1,1) NOT NULL,
    [Title]         NVARCHAR(255) NOT NULL,
    [Slug]          VARCHAR(100)  NOT NULL,
    [DisplayOrder]  INT           NOT NULL CONSTRAINT [DF_FAQSections_DisplayOrder] DEFAULT (0),
    [Status]        VARCHAR(20)   NOT NULL CONSTRAINT [DF_FAQSections_Status]       DEFAULT ('ACTIVE'),
    [CreatedAt]     DATETIME2     NOT NULL,
    [CreatedBy]     BIGINT        NULL,
    [UpdatedAt]     DATETIME2     NULL,
    [UpdatedBy]     BIGINT        NULL,
    CONSTRAINT [PK_FAQSections] PRIMARY KEY CLUSTERED ([FAQSectionID] ASC),
    CONSTRAINT [UX_FAQSections_Slug] UNIQUE ([Slug]),
    CONSTRAINT [FK_FAQSections_CreatedBy_Users_UserID]
      FOREIGN KEY ([CreatedBy]) REFERENCES [Users]([UserID]),
    CONSTRAINT [FK_FAQSections_UpdatedBy_Users_UserID]
      FOREIGN KEY ([UpdatedBy]) REFERENCES [Users]([UserID])
  );
  PRINT 'Created table FAQSections';
END
ELSE PRINT 'Table FAQSections already exists';

-- ================================================
-- FAQItems
-- ================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'FAQItems')
BEGIN
  CREATE TABLE [FAQItems] (
    [FAQItemID]     BIGINT IDENTITY(1,1) NOT NULL,
    [FAQSectionID]  BIGINT        NOT NULL,
    [Question]      NVARCHAR(500) NOT NULL,
    [Answer]        NVARCHAR(MAX) NOT NULL,
    [DisplayOrder]  INT           NOT NULL CONSTRAINT [DF_FAQItems_DisplayOrder] DEFAULT (0),
    [Status]        VARCHAR(20)   NOT NULL CONSTRAINT [DF_FAQItems_Status]       DEFAULT ('ACTIVE'),
    [CreatedAt]     DATETIME2     NOT NULL,
    [CreatedBy]     BIGINT        NULL,
    [UpdatedAt]     DATETIME2     NULL,
    [UpdatedBy]     BIGINT        NULL,
    CONSTRAINT [PK_FAQItems] PRIMARY KEY CLUSTERED ([FAQItemID] ASC),
    CONSTRAINT [FK_FAQItems_FAQSectionID_FAQSections_FAQSectionID]
      FOREIGN KEY ([FAQSectionID]) REFERENCES [FAQSections]([FAQSectionID]),
    CONSTRAINT [FK_FAQItems_CreatedBy_Users_UserID]
      FOREIGN KEY ([CreatedBy]) REFERENCES [Users]([UserID]),
    CONSTRAINT [FK_FAQItems_UpdatedBy_Users_UserID]
      FOREIGN KEY ([UpdatedBy]) REFERENCES [Users]([UserID])
  );
  CREATE INDEX [IX_FAQItems_FAQSectionID_DisplayOrder]
    ON [FAQItems] ([FAQSectionID], [DisplayOrder]);
  PRINT 'Created table FAQItems';
END
ELSE PRINT 'Table FAQItems already exists';

-- ================================================
-- ContactInfo
-- ================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ContactInfo')
BEGIN
  CREATE TABLE [ContactInfo] (
    [ContactInfoID]  BIGINT IDENTITY(1,1) NOT NULL,
    [Email]          NVARCHAR(255) NOT NULL,
    [Phone]          NVARCHAR(50)  NULL,
    [SupportPhone]   NVARCHAR(50)  NULL,
    [AddressLine1]   NVARCHAR(255) NULL,
    [AddressLine2]   NVARCHAR(255) NULL,
    [City]           NVARCHAR(100) NULL,
    [State]          NVARCHAR(100) NULL,
    [Country]        NVARCHAR(100) NULL,
    [PostalCode]     NVARCHAR(20)  NULL,
    [BusinessHours]  NVARCHAR(255) NULL,
    [MapEmbedURL]    NVARCHAR(1000) NULL,
    [IsActive]       BIT           NOT NULL CONSTRAINT [DF_ContactInfo_IsActive] DEFAULT (1),
    [CreatedAt]      DATETIME2     NOT NULL,
    [CreatedBy]      BIGINT        NULL,
    [UpdatedAt]      DATETIME2     NULL,
    [UpdatedBy]      BIGINT        NULL,
    CONSTRAINT [PK_ContactInfo] PRIMARY KEY CLUSTERED ([ContactInfoID] ASC),
    CONSTRAINT [FK_ContactInfo_CreatedBy_Users_UserID]
      FOREIGN KEY ([CreatedBy]) REFERENCES [Users]([UserID]),
    CONSTRAINT [FK_ContactInfo_UpdatedBy_Users_UserID]
      FOREIGN KEY ([UpdatedBy]) REFERENCES [Users]([UserID])
  );
  PRINT 'Created table ContactInfo';
END
ELSE PRINT 'Table ContactInfo already exists';

-- ================================================
-- SocialLinks
-- ================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SocialLinks')
BEGIN
  CREATE TABLE [SocialLinks] (
    [SocialLinkID]  BIGINT IDENTITY(1,1) NOT NULL,
    [Platform]      VARCHAR(50)    NOT NULL,
    [Label]         NVARCHAR(100)  NOT NULL,
    [URL]           NVARCHAR(1000) NOT NULL,
    [IconName]      VARCHAR(50)    NULL,
    [DisplayOrder]  INT            NOT NULL CONSTRAINT [DF_SocialLinks_DisplayOrder] DEFAULT (0),
    [IsActive]      BIT            NOT NULL CONSTRAINT [DF_SocialLinks_IsActive]     DEFAULT (1),
    [CreatedAt]     DATETIME2      NOT NULL,
    [CreatedBy]     BIGINT         NULL,
    [UpdatedAt]     DATETIME2      NULL,
    [UpdatedBy]     BIGINT         NULL,
    CONSTRAINT [PK_SocialLinks] PRIMARY KEY CLUSTERED ([SocialLinkID] ASC),
    CONSTRAINT [UX_SocialLinks_Platform] UNIQUE ([Platform]),
    CONSTRAINT [FK_SocialLinks_CreatedBy_Users_UserID]
      FOREIGN KEY ([CreatedBy]) REFERENCES [Users]([UserID]),
    CONSTRAINT [FK_SocialLinks_UpdatedBy_Users_UserID]
      FOREIGN KEY ([UpdatedBy]) REFERENCES [Users]([UserID])
  );
  PRINT 'Created table SocialLinks';
END
ELSE PRINT 'Table SocialLinks already exists';

-- ================================================
-- CMSPages: Verify it exists (should already exist from previous migration)
-- ================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CMSPages')
BEGIN
  CREATE TABLE [CMSPages] (
    [PageID]           BIGINT IDENTITY(1,1) NOT NULL,
    [PageType]         VARCHAR(50)    NOT NULL,
    [Title]            NVARCHAR(255)  NOT NULL,
    [Slug]             VARCHAR(255)   NOT NULL,
    [Content]          NVARCHAR(MAX)  NOT NULL,
    [Status]           VARCHAR(20)    NOT NULL,
    [MetaTitle]        NVARCHAR(255)  NULL,
    [MetaDescription]  NVARCHAR(500)  NULL,
    [IsSystemPage]     BIT            NULL CONSTRAINT [DF__CMSPages__IsSyst__6B24EA82] DEFAULT (1),
    [CreatedAt]        DATETIME2      NOT NULL,
    [CreatedBy]        BIGINT         NULL,
    [UpdatedAt]        DATETIME2      NULL,
    [UpdatedBy]        BIGINT         NULL,
    CONSTRAINT [PK_CMSPages] PRIMARY KEY CLUSTERED ([PageID] ASC),
    CONSTRAINT [FK_CMSPages_CreatedBy_Users_UserID]
      FOREIGN KEY ([CreatedBy]) REFERENCES [Users]([UserID]),
    CONSTRAINT [FK_CMSPages_UpdatedBy_Users_UserID]
      FOREIGN KEY ([UpdatedBy]) REFERENCES [Users]([UserID])
  );
  PRINT 'Created table CMSPages';
END
ELSE PRINT 'Table CMSPages already exists';

PRINT 'Migration complete.';
