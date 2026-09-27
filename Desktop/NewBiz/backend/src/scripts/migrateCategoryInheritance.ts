import { prisma } from '../database/prisma.js';
import { categoryInheritanceService } from '../services/categoryInheritance.service.js';

async function migrateCategoryInheritance() {
  console.log('🚀 Starting Category Inheritance Migration...');

  // 1. Identify Root Categories
  const roots = await prisma.categories.findMany({
    where: { ParentCategoryID: null },
    select: { CategoryID: true, CategoryName: true },
  });

  console.log(`Found ${roots.length} root categories:`, roots.map((r) => `[${r.CategoryID}] ${r.CategoryName}`));

  // 2. Define universal attributes to configure at root level
  // Material (23), Color (24), Size (25)
  const commonAttributes = [
    { attributeId: BigInt(23), isRequired: true, isVariantDefining: false, displayOrder: 1 },
    { attributeId: BigInt(24), isRequired: true, isVariantDefining: true, displayOrder: 2 },
    { attributeId: BigInt(25), isRequired: true, isVariantDefining: true, displayOrder: 3 },
  ];

  // 3. Upsert common attributes on all Root categories
  let rootCreatedCount = 0;
  for (const root of roots) {
    for (const attr of commonAttributes) {
      const existing = await prisma.categoryAttributes.findUnique({
        where: {
          CategoryID_AttributeID: {
            CategoryID: root.CategoryID,
            AttributeID: attr.attributeId,
          },
        },
      });

      if (!existing) {
        await prisma.categoryAttributes.create({
          data: {
            CategoryID: root.CategoryID,
            AttributeID: attr.attributeId,
            IsRequired: attr.isRequired,
            IsVariantDefining: attr.isVariantDefining,
            DisplayOrder: attr.displayOrder,
            Status: 'ACTIVE',
            CreatedAt: new Date(),
          },
        });
        rootCreatedCount++;
        console.log(`  + Assigned Attr ${attr.attributeId} to Root [${root.CategoryID}] ${root.CategoryName}`);
      } else {
        console.log(`  ✓ Attr ${attr.attributeId} already exists on Root [${root.CategoryID}] ${root.CategoryName}`);
      }
    }
  }
  console.log(`Configured ${rootCreatedCount} new root attribute assignments.`);

  // 4. Clean up redundant child rows that are identical to the root configuration
  const redundantRows = await prisma.categoryAttributes.findMany({
    where: {
      AttributeID: { in: [BigInt(23), BigInt(24), BigInt(25)] },
      CategoryID: { notIn: roots.map((r) => r.CategoryID) },
    },
  });

  console.log(`Found ${redundantRows.length} redundant leaf CategoryAttribute rows.`);

  if (redundantRows.length > 0) {
    const deleteResult = await prisma.categoryAttributes.deleteMany({
      where: {
        CategoryAttributeID: { in: redundantRows.map((r) => r.CategoryAttributeID) },
      },
    });
    console.log(`🗑️ Deleted ${deleteResult.count} redundant leaf rows.`);
  }

  // 5. Verification across all leaf categories
  console.log('🔍 Verifying inheritance resolution across leaf categories...');
  const leaves = await prisma.categories.findMany({
    where: {
      other_Categories: { none: {} },
    },
    select: { CategoryID: true, CategoryName: true },
  });

  let verifiedCount = 0;
  for (const leaf of leaves) {
    const resolved = await categoryInheritanceService.resolveEffectiveCategoryAttributes(leaf.CategoryID);
    
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
  .finally(() => prisma.$disconnect());
