import { getPool, closePool } from '../database/db.js';
import { categoryInheritanceService } from '../services/categoryInheritance.service.js';

async function migrateCategoryInheritance() {
  console.log('🚀 Starting Category Inheritance Migration...');
  const pool = await getPool();

  // 1. Identify Root Categories
  const rootsRes = await pool.request().query<{ CategoryID: string | bigint; CategoryName: string }>(`
    SELECT CategoryID, CategoryName FROM dbo.Categories WHERE ParentCategoryID IS NULL
  `);
  const roots = rootsRes.recordset;

  console.log(`Found ${roots.length} root categories:`, roots.map((r) => `[${r.CategoryID}] ${r.CategoryName}`));

  // 2. Define universal attributes to configure at root level
  // Material (23), Color (24), Size (25)
  const commonAttributes = [
    { attributeId: 23, isRequired: true, isVariantDefining: false, displayOrder: 1 },
    { attributeId: 24, isRequired: true, isVariantDefining: true, displayOrder: 2 },
    { attributeId: 25, isRequired: true, isVariantDefining: true, displayOrder: 3 },
  ];

  // 3. Upsert common attributes on all Root categories
  let rootCreatedCount = 0;
  for (const root of roots) {
    for (const attr of commonAttributes) {
      const existing = await pool.request()
        .input('catId', root.CategoryID)
        .input('attrId', attr.attributeId)
        .query(`
          SELECT TOP 1 CategoryAttributeID FROM dbo.CategoryAttributes 
          WHERE CategoryID = @catId AND AttributeID = @attrId
        `);

      if (!existing.recordset.length) {
        await pool.request()
          .input('catId', root.CategoryID)
          .input('attrId', attr.attributeId)
          .input('isReq', attr.isRequired ? 1 : 0)
          .input('isVar', attr.isVariantDefining ? 1 : 0)
          .input('order', attr.displayOrder)
          .query(`
            INSERT INTO dbo.CategoryAttributes (CategoryID, AttributeID, IsRequired, IsVariantDefining, DisplayOrder, Status, CreatedAt)
            VALUES (@catId, @attrId, @isReq, @isVar, @order, 'ACTIVE', GETDATE())
          `);
        rootCreatedCount++;
        console.log(`  + Assigned Attr ${attr.attributeId} to Root [${root.CategoryID}] ${root.CategoryName}`);
      } else {
        console.log(`  ✓ Attr ${attr.attributeId} already exists on Root [${root.CategoryID}] ${root.CategoryName}`);
      }
    }
  }
  console.log(`Configured ${rootCreatedCount} new root attribute assignments.`);

  // 4. Clean up redundant child rows that are identical to the root configuration
  const rootIds = roots.map((r) => r.CategoryID).join(',');
  const redundantRes = await pool.request().query<{ CategoryAttributeID: string | bigint }>(`
    SELECT CategoryAttributeID FROM dbo.CategoryAttributes
    WHERE AttributeID IN (23, 24, 25)
    AND CategoryID NOT IN (${rootIds})
  `);
  const redundantRows = redundantRes.recordset;

  console.log(`Found ${redundantRows.length} redundant leaf CategoryAttribute rows.`);

  if (redundantRows.length > 0) {
    const idList = redundantRows.map((r) => r.CategoryAttributeID).join(',');
    await pool.request().query(`
      DELETE FROM dbo.CategoryAttributes WHERE CategoryAttributeID IN (${idList})
    `);
    console.log(`🗑️ Deleted ${redundantRows.length} redundant leaf rows.`);
  }

  // 5. Verification across all leaf categories
  console.log('🔍 Verifying inheritance resolution across leaf categories...');
  const leavesRes = await pool.request().query<{ CategoryID: string | bigint; CategoryName: string }>(`
    SELECT c.CategoryID, c.CategoryName 
    FROM dbo.Categories c
    WHERE NOT EXISTS (SELECT 1 FROM dbo.Categories sub WHERE sub.ParentCategoryID = c.CategoryID)
  `);
  const leaves = leavesRes.recordset;

  let verifiedCount = 0;
  for (const leaf of leaves) {
    const resolved = await categoryInheritanceService.resolveEffectiveCategoryAttributes(BigInt(leaf.CategoryID));
    
    // Check that Material, Color, Size are present and inherited
    const hasMaterial = resolved.all.some((a) => a.attributeId === '23' && a.isInherited);
    const hasColor = resolved.all.some((a) => a.attributeId === '24' && a.isInherited);
    const hasSize = resolved.all.some((a) => a.attributeId === '25' && a.isInherited);

    if (hasMaterial && hasColor && hasSize && resolved.all.length >= 3) {
      verifiedCount++;
    } else {
      console.warn(`⚠️ Leaf [${leaf.CategoryID}] ${leaf.CategoryName} resolved incomplete attributes:`, resolved.all.map((a) => a.attributeName));
    }
  }

  console.log(`✅ Inheritance Verification: ${verifiedCount} of ${leaves.length} leaf categories successfully resolve inherited attributes!`);

  // 6. Check CategoryDocuments resolution for Anti-Theft Bags (126)
  const bagDocs = await categoryInheritanceService.resolveEffectiveCategoryDocuments(BigInt(126));
  console.log(`✅ CategoryDocuments for Anti-Theft Bags [126]:`, bagDocs.map((d) => `${d.code} (Mandatory: ${d.isMandatory}, Inherited: ${d.isInherited})`));

  console.log('🎉 Category Inheritance Migration completed successfully!');
}

migrateCategoryInheritance()
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  })
  .finally(() => closePool());

