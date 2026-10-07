import { getPool } from '../db.js';

export async function deactivateLegacyRoles() {
  try {
    const pool = await getPool();

    // Ensure all users who currently have SELLER_USER are assigned SELLER_ADMIN
    await pool.request().query(`
      DECLARE @sellerAdminId BIGINT = (SELECT RoleID FROM dbo.Roles WHERE RoleName = 'SELLER_ADMIN');
      DECLARE @sellerUserId BIGINT = (SELECT RoleID FROM dbo.Roles WHERE RoleName = 'SELLER_USER');

      IF @sellerAdminId IS NOT NULL AND @sellerUserId IS NOT NULL
      BEGIN
        INSERT INTO dbo.UserRoles (UserID, RoleID, CreatedAt)
        SELECT ur.UserID, @sellerAdminId, GETDATE()
        FROM dbo.UserRoles ur
        WHERE ur.RoleID = @sellerUserId
          AND NOT EXISTS (
            SELECT 1 FROM dbo.UserRoles ur2
            WHERE ur2.UserID = ur.UserID AND ur2.RoleID = @sellerAdminId
          );
      END
    `);

    // Ensure all users who currently have WAREHOUSE_USER are assigned WAREHOUSE_MANAGER
    await pool.request().query(`
      DECLARE @wmId BIGINT = (SELECT RoleID FROM dbo.Roles WHERE RoleName = 'WAREHOUSE_MANAGER');
      DECLARE @wuId BIGINT = (SELECT RoleID FROM dbo.Roles WHERE RoleName = 'WAREHOUSE_USER');

      IF @wmId IS NOT NULL AND @wuId IS NOT NULL
      BEGIN
        INSERT INTO dbo.UserRoles (UserID, RoleID, CreatedAt)
        SELECT ur.UserID, @wmId, GETDATE()
        FROM dbo.UserRoles ur
        WHERE ur.RoleID = @wuId
          AND NOT EXISTS (
            SELECT 1 FROM dbo.UserRoles ur2
            WHERE ur2.UserID = ur.UserID AND ur2.RoleID = @wmId
          );
      END
    `);

    // Mark SELLER_USER and WAREHOUSE_USER as INACTIVE in Roles table so they are never returned as active roles
    await pool.request().query(`
      UPDATE dbo.Roles 
      SET Status = 'INACTIVE', Description = 'Deprecated legacy role'
      WHERE RoleName IN ('SELLER_USER', 'WAREHOUSE_USER');
    `);

    console.log('Legacy roles deactivated successfully. SELLER_ADMIN and WAREHOUSE_MANAGER are active.');
  } catch (err) {
    console.error('Migration error (deactivateLegacyRoles):', err);
    throw err;
  }
}

if (process.argv[1]?.includes('deactivate_legacy_roles')) {
  deactivateLegacyRoles()
    .then(() => {
      console.log('Done.');
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
