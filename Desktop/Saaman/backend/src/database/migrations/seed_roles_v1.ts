import { getPool } from '../db.js';

export async function seedRolesV1() {
  try {
    const pool = await getPool();

    // 1. Ensure SELLER_ADMIN role exists
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE RoleName = 'SELLER_ADMIN')
      BEGIN
        INSERT INTO dbo.Roles (RoleName, Description, Status, CreatedAt)
        VALUES ('SELLER_ADMIN', 'Seller Administrator with full store access', 'ACTIVE', GETDATE());
        PRINT 'Added SELLER_ADMIN role.';
      END
    `);

    // 2. Ensure WAREHOUSE_MANAGER role exists
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE RoleName = 'WAREHOUSE_MANAGER')
      BEGIN
        INSERT INTO dbo.Roles (RoleName, Description, Status, CreatedAt)
        VALUES ('WAREHOUSE_MANAGER', 'Warehouse Manager with full facility access', 'ACTIVE', GETDATE());
        PRINT 'Added WAREHOUSE_MANAGER role.';
      END
    `);

    // 3. Sync existing SELLER_USER users to also have SELLER_ADMIN role
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

    // 4. Sync existing WAREHOUSE_USER users to also have WAREHOUSE_MANAGER role
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

    console.log('Roles & UserRoles migration executed successfully.');
  } catch (err) {
    console.error('Migration error (seedRolesV1):', err);
    throw err;
  }
}

if (process.argv[1]?.includes('seed_roles_v1')) {
  seedRolesV1()
    .then(() => {
      console.log('Migration completed successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
