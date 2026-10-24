import { getPool, sql } from '../database/db.js';

async function main() {
  const pool = await getPool();

  const adminRole = await pool.request().query<{ RoleID: number }>(
    "SELECT RoleID FROM Roles WHERE RoleName = 'ADMIN'"
  );
  if (!adminRole.recordset.length) {
    throw new Error('ADMIN role not found');
  }
  const adminRoleId = adminRole.recordset[0].RoleID;
  console.log('ADMIN RoleID:', adminRoleId);

  // Grant all permissions except roles.manage to ADMIN
  const perms = await pool.request().query<{ PermissionID: number; PermissionCode: string }>(
    "SELECT PermissionID, PermissionCode FROM Permissions WHERE PermissionCode != 'roles.manage'"
  );
  console.log(`Granting ${perms.recordset.length} permissions to ADMIN`);

  for (const p of perms.recordset) {
    await pool
      .request()
      .input('roleId', sql.BigInt, adminRoleId)
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

  console.log('ADMIN permissions seeded successfully!');
  process.exit(0);
}

main().catch((err) => {
  console.error('Failed to seed admin permissions:', err);
  process.exit(1);
});
