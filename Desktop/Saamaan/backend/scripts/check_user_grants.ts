import { getPool } from '../src/database/db.js';

async function main() {
  const pool = await getPool();

  try {
    const grantCart = await pool.query(`GRANT DELETE ON dbo.CartItems TO SamanUser; GRANT DELETE ON dbo.WishlistItems TO SamanUser;`);
    console.log('GRANT SUCCESS:', grantCart);
  } catch (err: any) {
    console.error('GRANT FAILED:', err.message);
  }

  // Check current permissions of SamanUser
  try {
    const perms = await pool.query(`
      SELECT 
        pr.name AS principal_name,
        pr.type_desc,
        pe.permission_name,
        pe.state_desc,
        OBJECT_NAME(pe.major_id) AS object_name
      FROM sys.database_permissions pe
      JOIN sys.database_principals pr ON pe.grantee_principal_id = pr.principal_id
      WHERE pr.name = 'SamanUser' OR pr.name = 'public'
    `);
    console.log('PERMISSIONS:', perms.recordset);
  } catch (err: any) {
    console.error('PERMS QUERY FAILED:', err.message);
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
