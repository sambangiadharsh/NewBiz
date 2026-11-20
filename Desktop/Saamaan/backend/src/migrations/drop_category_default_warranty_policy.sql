-- Migration: Drop unused DefaultWarrantyPolicyID column from dbo.Categories
-- Since warranty is maintained via Product & Category Variant Attributes and no warranty policy table exists.

IF EXISTS (
    SELECT 1 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'Categories' AND COLUMN_NAME = 'DefaultWarrantyPolicyID'
)
BEGIN
    PRINT 'Found DefaultWarrantyPolicyID on dbo.Categories. Dropping constraints and column...';

    -- 1. Drop any default constraint associated with DefaultWarrantyPolicyID
    DECLARE @defConstraint NVARCHAR(256);
    SELECT @defConstraint = d.name 
    FROM sys.tables t
    JOIN sys.columns c ON t.object_id = c.object_id
    JOIN sys.default_constraints d ON c.default_object_id = d.object_id
    WHERE t.name = 'Categories' AND c.name = 'DefaultWarrantyPolicyID';

    IF @defConstraint IS NOT NULL
    BEGIN
        EXEC('ALTER TABLE dbo.Categories DROP CONSTRAINT [' + @defConstraint + '];');
        PRINT 'Dropped default constraint: ' + @defConstraint;
    END;

    -- 2. Drop any foreign key constraint referencing DefaultWarrantyPolicyID
    DECLARE @fkConstraint NVARCHAR(256);
    SELECT @fkConstraint = fk.name
    FROM sys.foreign_keys fk
    JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
    JOIN sys.tables t ON fkc.parent_object_id = t.object_id
    JOIN sys.columns c ON fkc.parent_object_id = c.object_id AND fkc.parent_column_id = c.column_id
    WHERE t.name = 'Categories' AND c.name = 'DefaultWarrantyPolicyID';

    IF @fkConstraint IS NOT NULL
    BEGIN
        EXEC('ALTER TABLE dbo.Categories DROP CONSTRAINT [' + @fkConstraint + '];');
        PRINT 'Dropped foreign key constraint: ' + @fkConstraint;
    END;

    -- 3. Drop the column
    ALTER TABLE dbo.Categories DROP COLUMN [DefaultWarrantyPolicyID];
    PRINT 'Successfully dropped column [DefaultWarrantyPolicyID] from dbo.Categories.';
END
ELSE
BEGIN
    PRINT 'Column [DefaultWarrantyPolicyID] does not exist on dbo.Categories. No action needed.';
END;

