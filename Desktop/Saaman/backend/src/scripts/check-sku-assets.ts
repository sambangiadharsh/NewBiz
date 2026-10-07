import { getPool, closePool } from '../database/db.js';

async function main() {
  const pool = await getPool();

  console.log('=== CHECKING PRODUCT FOR SKU TRG-PHA-000003 ===');
  const pmRes = await pool.request().query(`
    SELECT ProductID, ParentSKU, ProductName, Status, IsVerified
    FROM dbo.ProductMaster
    WHERE ParentSKU = 'TRG-PHA-000003'
  `);
  console.log('ProductMaster:', pmRes.recordset);

  if (pmRes.recordset.length > 0) {
    const productId = pmRes.recordset[0].ProductID;

    const pvRes = await pool.request()
      .input('productId', productId)
      .query(`
        SELECT ProductVariantID, VariantSKU, VariantModelCode, Status
        FROM dbo.ProductVariants
        WHERE ProductMasterID = @productId
      `);
    console.log('ProductVariants:', pvRes.recordset);

    for (const v of pvRes.recordset) {
      const paRes = await pool.request()
        .input('variantId', v.ProductVariantID)
        .query(`
          SELECT ProductAssetID, ProductVariantID, AssetType, AssetURL, IsPrimary, Status, DisplayOrder
          FROM dbo.ProductAssets
          WHERE ProductVariantID = @variantId
        `);
      console.log(`ProductAssets for variant ${v.VariantSKU} (${v.ProductVariantID}):`, paRes.recordset);
    }
  }

  await closePool();
}

main().catch(console.error);
