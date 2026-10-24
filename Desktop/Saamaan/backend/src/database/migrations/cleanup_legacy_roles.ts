import { getPool } from '../db.js';

export async function cleanupLegacyRoles() {
  try {
    const pool = await getPool();

    // 1. Ensure SELLER_ADMIN role exists
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE RoleName = 'SELLER_ADMIN')
      BEGIN
        INSERT INTO dbo.Roles (RoleName, Description, Status, CreatedAt)
        VALUES ('SELLER_ADMIN', 'Seller Administrator with full store access', 'ACTIVE', GETDATE());
      END
    `);

    // 2. Ensure WAREHOUSE_MANAGER role exists
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE RoleName = 'WAREHOUSE_MANAGER')
      BEGIN
        INSERT INTO dbo.Roles (RoleName, Description, Status, CreatedAt)
        VALUES ('WAREHOUSE_MANAGER', 'Warehouse Manager with full facility access', 'ACTIVE', GETDATE());
      END
    `);

    // 3. Migrate any user holding SELLER_USER to SELLER_ADMIN
    await pool.request().query(`
      DECLARE @sellerAdminId BIGINT = (SELECT RoleID FROM dbo.Roles WHERE RoleName = 'SELLER_ADMIN');
      DECLARE @sellerUserId BIGINT = (SELECT RoleID FROM dbo.Roles WHERE RoleName = 'SELLER_USER');

      IF @sellerAdminId IS NOT NULL AND @sellerUserId IS NOT NULL
      BEGIN
        -- Add SELLER_ADMIN if not already assigned
        INSERT INTO dbo.UserRoles (UserID, RoleID, CreatedAt)
        SELECT ur.UserID, @sellerAdminId, GETDATE()
        FROM dbo.UserRoles ur
        WHERE ur.RoleID = @sellerUserId
          AND NOT EXISTS (
            SELECT 1 FROM dbo.UserRoles ur2
            WHERE ur2.UserID = ur.UserID AND ur2.RoleID = @sellerAdminId
          );

        -- Remove SELLER_USER assignments
        DELETE FROM dbo.UserRoles WHERE RoleID = @sellerUserId;
        PRINT 'Migrated and cleaned up SELLER_USER assignments.';
      END
    `);

    // 4. Migrate any user holding WAREHOUSE_USER to WAREHOUSE_MANAGER
    await pool.request().query(`
      DECLARE @wmId BIGINT = (SELECT RoleID FROM dbo.Roles WHERE RoleName = 'WAREHOUSE_MANAGER');
      DECLARE @wuId BIGINT = (SELECT RoleID FROM dbo.Roles WHERE RoleName = 'WAREHOUSE_USER');

      IF @wmId IS NOT NULL AND @wuId IS NOT NULL
      BEGIN
        -- Add WAREHOUSE_MANAGER if not already assigned
        INSERT INTO dbo.UserRoles (UserID, RoleID, CreatedAt)
        SELECT ur.UserID, @wmId, GETDATE()
        FROM dbo.UserRoles ur
        WHERE ur.RoleID = @wuId
          AND NOT EXISTS (
            SELECT 1 FROM dbo.UserRoles ur2
            WHERE ur2.UserID = ur.UserID AND ur2.RoleID = @wmId
          );

        -- Remove WAREHOUSE_USER assignments
        DELETE FROM dbo.UserRoles WHERE RoleID = @wuId;
        PRINT 'Migrated and cleaned up WAREHOUSE_USER assignments.';
      END
    `);

    console.log('Legacy role cleanup executed successfully.');
  } catch (err) {
    console.error('Migration error (cleanupLegacyRoles):', err);
    throw err;
  }
}

if (process.argv[1]?.includes('cleanup_legacy_roles')) {
  cleanupLegacyRoles()
    .then(() => {
      console.log('Done.');
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
