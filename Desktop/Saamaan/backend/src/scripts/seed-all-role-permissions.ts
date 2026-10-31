import { getPool, sql } from '../database/db.js';

interface RolePermMap {
  [roleName: string]: string[];
}

const ROLE_PERMISSIONS: RolePermMap = {
  ADMIN: [
    'users.read',
    'users.manage',
    'sellers.read',
    'sellers.manage',
    'applications.review',
    'warehouses.read',
    'warehouses.manage',
    'catalog.read',
    'catalog.manage',
    'inventory.read',
    'inventory.manage',
    'orders.read',
    'fulfillments.manage',
  ],
  SELLER_ADMIN: [
    'catalog.read',
    'catalog.manage',
    'inventory.read',
    'inventory.manage',
    'orders.read',
    'warehouses.read',
    'sellers.read',
    'sellers.manage',
  ],
  SELLER_USER: [
    'catalog.read',
    'inventory.read',
    'orders.read',
    'sellers.read',
    'warehouses.read',
  ],
  WAREHOUSE_MANAGER: [
    'warehouses.read',
    'inventory.read',
    'inventory.manage',
    'orders.read',
    'fulfillments.manage',
  ],
  WAREHOUSE_USER: [
    'warehouses.read',
    'inventory.read',
    'orders.read',
  ],
};

async function main() {
  const pool = await getPool();

  console.log('Seeding role permissions...');

  for (const [roleName, permCodes] of Object.entries(ROLE_PERMISSIONS)) {
    // 1. Get RoleID
    const roleRes = await pool
      .request()
      .input('roleName', sql.NVarChar, roleName)
      .query<{ RoleID: number }>('SELECT RoleID FROM Roles WHERE RoleName = @roleName');

    if (roleRes.recordset.length === 0) {
      console.warn(`Role ${roleName} not found in database, skipping.`);
      continue;
    }

    const roleId = roleRes.recordset[0].RoleID;
    console.log(`Configuring Role: ${roleName} (RoleID: ${roleId}) with ${permCodes.length} permissions`);

    for (const code of permCodes) {
      const permRes = await pool
        .request()
        .input('code', sql.NVarChar, code)
        .query<{ PermissionID: number }>('SELECT PermissionID FROM Permissions WHERE PermissionCode = @code');

      if (permRes.recordset.length === 0) {
        console.warn(`Permission ${code} not found in Permissions table, skipping.`);
        continue;
      }

      const permId = permRes.recordset[0].PermissionID;

      await pool
        .request()
        .input('roleId', sql.BigInt, roleId)
        .input('permId', sql.BigInt, permId)
        .query(`
          IF NOT EXISTS (
            SELECT 1 FROM RolePermissions 
            WHERE RoleID = @roleId AND PermissionID = @permId
          )
          BEGIN
            INSERT INTO RolePermissions (RoleID, PermissionID, CreatedAt)
            VALUES (@roleId, @permId, SYSUTCDATETIME())
          END
        `);
    }
  }

  // Also make sure SUPER_ADMIN has everything including roles.manage
  const superAdminRole = await pool.request().query<{ RoleID: number }>(
    "SELECT RoleID FROM Roles WHERE RoleName = 'SUPER_ADMIN'"
  );
  if (superAdminRole.recordset.length > 0) {
    const superAdminId = superAdminRole.recordset[0].RoleID;
    const allPerms = await pool.request().query<{ PermissionID: number }>('SELECT PermissionID FROM Permissions');
    for (const p of allPerms.recordset) {
      await pool
        .request()
        .input('roleId', sql.BigInt, superAdminId)
        .input('permId', sql.BigInt, p.PermissionID)
        .query(`
          IF NOT EXISTS (
            SELECT 1 FROM RolePermissions 
            WHERE RoleID = @roleId AND PermissionID = @permId
          )
          BEGIN
            INSERT INTO RolePermissions (RoleID, PermissionID, CreatedAt)
            VALUES (@roleId, @permId, SYSUTCDATETIME())
          END
        `);
    }
  }

  console.log('Role permissions seeded successfully!');
  process.exit(0);
}

main().catch((err) => {
  console.error('Failed to seed role permissions:', err);
  process.exit(1);
});
