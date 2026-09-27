import { prisma } from '../database/prisma.js';
import { NotFoundError } from '../utils/errors.js';

export interface EffectiveAttributeValue {
  attributeValueId: string;
  valueName: string;
  valueCode: string;
}

export interface EffectiveCategoryAttribute {
  categoryAttributeId?: number;
  attributeId: string;
  attributeName: string;
  dataType: string;
  isRequired: boolean;
  isVariantDefining: boolean;
  displayOrder: number;
  status: string;
  isInherited: boolean;
  inheritedFrom?: {
    categoryId: number;
    categoryName: string;
    categoryCode?: string | null;
  };
  values: EffectiveAttributeValue[];
}

export interface EffectiveCategoryDocument {
  categoryDocumentId?: number;
  categoryId: number;
  documentTypeId: number;
  code: string;
  displayName: string;
  isMandatory: boolean;
  status: string;
  isInherited: boolean;
  inheritedFrom?: {
    categoryId: number;
    categoryName: string;
    categoryCode?: string | null;
  };
}

export interface AncestorCategory {
  CategoryID: bigint;
  ParentCategoryID: bigint | null;
  CategoryName: string;
  CategoryCode?: string | null;
  Depth: number;
}

export class CategoryInheritanceService {
  /**
   * Walks up the category hierarchy tree from the target category to the root.
   * Returns ordered list from ROOT down to TARGET category: [Root, ..., Parent, Target].
   */
  async getCategoryAncestry(categoryId: bigint): Promise<AncestorCategory[]> {
    const ancestors: AncestorCategory[] = [];
    let currentId: bigint | null = categoryId;
    const visited = new Set<string>();

    while (currentId !== null) {
      const idStr = currentId.toString();
      if (visited.has(idStr)) {
        // Guard against cycles
        break;
      }
      visited.add(idStr);

      const cat: {
        CategoryID: bigint;
        ParentCategoryID: bigint | null;
        CategoryName: string;
        CategoryCode: string | null;
      } | null = await prisma.categories.findUnique({
        where: { CategoryID: currentId },
        select: {
          CategoryID: true,
          ParentCategoryID: true,
          CategoryName: true,
          CategoryCode: true,
        },
      });

      if (!cat) {
        if (ancestors.length === 0) {
          throw new NotFoundError(`Category with ID ${categoryId} not found`);
        }
        break;
      }

      ancestors.unshift({
        CategoryID: cat.CategoryID,
        ParentCategoryID: cat.ParentCategoryID,
        CategoryName: cat.CategoryName,
        CategoryCode: cat.CategoryCode,
        Depth: 0,
      });

      currentId = cat.ParentCategoryID;
    }

    // Assign depths relative to root
    return ancestors.map((a, idx) => ({ ...a, Depth: idx }));
  }

  /**
   * Resolves the effective attributes for any category by traversing its ancestor path.
   * Child definitions override ancestor definitions for the same AttributeID.
   */
  async resolveEffectiveCategoryAttributes(categoryId: bigint): Promise<{
    variantDefining: EffectiveCategoryAttribute[];
    requiredSpecs: EffectiveCategoryAttribute[];
    optionalSpecs: EffectiveCategoryAttribute[];
    all: EffectiveCategoryAttribute[];
  }> {
    const ancestry = await this.getCategoryAncestry(categoryId);
    const categoryIds = ancestry.map((a) => a.CategoryID);
    const targetIdStr = categoryId.toString();

    // Fetch all CategoryAttributes along the ancestry path
    const allCatAttrs = await prisma.categoryAttributes.findMany({
      where: {
        CategoryID: { in: categoryIds },
      },
      include: {
        Categories: {
          select: {
            CategoryID: true,
            CategoryName: true,
            CategoryCode: true,
          },
        },
        Attributes: {
          include: {
            AttributeValues: {
              where: { Status: 'ACTIVE' },
              orderBy: { ValueName: 'asc' },
            },
          },
        },
      },
      orderBy: { DisplayOrder: 'asc' },
    });

    // Map by AttributeID. As we iterate from Root to Target, child overrides ancestor.
    const resolvedMap = new Map<string, EffectiveCategoryAttribute>();

    for (const ancestor of ancestry) {
      const ancestorCatAttrs = allCatAttrs.filter(
        (ca) => ca.CategoryID.toString() === ancestor.CategoryID.toString()
      );

      for (const ca of ancestorCatAttrs) {
        const attrIdStr = ca.AttributeID.toString();
        const isTargetCategory = ca.CategoryID.toString() === targetIdStr;

        // If inactive on a child, it deactivates an inherited attribute for this branch
        if (ca.Status !== 'ACTIVE') {
          resolvedMap.delete(attrIdStr);
          continue;
        }

        const attributeValues: EffectiveAttributeValue[] = ca.Attributes.AttributeValues.map((v) => ({
          attributeValueId: v.AttributeValueID.toString(),
          valueName: v.ValueName,
          valueCode: v.ValueCode,
        }));

        resolvedMap.set(attrIdStr, {
          categoryAttributeId: Number(ca.CategoryAttributeID),
          attributeId: attrIdStr,
          attributeName: ca.Attributes.AttributeName,
          dataType: ca.Attributes.DataType,
          isRequired: ca.IsRequired,
          isVariantDefining: ca.IsVariantDefining,
          displayOrder: ca.DisplayOrder,
          status: ca.Status,
          isInherited: !isTargetCategory,
          inheritedFrom: !isTargetCategory
            ? {
                categoryId: Number(ca.Categories.CategoryID),
                categoryName: ca.Categories.CategoryName,
                categoryCode: ca.Categories.CategoryCode,
              }
            : undefined,
          values: attributeValues,
        });
      }
    }

    const all = Array.from(resolvedMap.values()).sort(
      (a, b) => a.displayOrder - b.displayOrder || Number(a.attributeId) - Number(b.attributeId)
    );

    const variantDefining = all.filter((a) => a.isVariantDefining);
    const requiredSpecs = all.filter((a) => a.isRequired && !a.isVariantDefining);
    const optionalSpecs = all.filter((a) => !a.isRequired && !a.isVariantDefining);

    return {
      variantDefining,
      requiredSpecs,
      optionalSpecs,
      all,
    };
  }

  /**
   * Resolves the effective document requirements for any category by traversing its ancestor path.
   * Merges requirements so if any ancestor or child requires mandatory proof, it resolves to mandatory.
   */
  async resolveEffectiveCategoryDocuments(categoryId: bigint): Promise<EffectiveCategoryDocument[]> {
    const ancestry = await this.getCategoryAncestry(categoryId);
    const categoryIds = ancestry.map((a) => a.CategoryID);
    const targetIdStr = categoryId.toString();

    const allCatDocs = await prisma.categoryDocuments.findMany({
      where: {
        CategoryID: { in: categoryIds },
        Status: 'ACTIVE',
      },
      include: {
        DocumentTypes: true,
        Categories: {
          select: {
            CategoryID: true,
            CategoryName: true,
            CategoryCode: true,
          },
        },
      },
      orderBy: { DocumentTypeID: 'asc' },
    });

    const docMap = new Map<number, EffectiveCategoryDocument>();

    for (const ancestor of ancestry) {
      const ancestorCatDocs = allCatDocs.filter(
        (cd) => cd.CategoryID.toString() === ancestor.CategoryID.toString()
      );

      for (const cd of ancestorCatDocs) {
        const docTypeId = cd.DocumentTypeID;
        const isTargetCategory = cd.CategoryID.toString() === targetIdStr;
        const existing = docMap.get(docTypeId);

        if (existing) {
          // If already defined by ancestor, child can override or make mandatory
          existing.isMandatory = existing.isMandatory || cd.IsMandatory;
          if (isTargetCategory) {
            existing.categoryDocumentId = Number(cd.CategoryDocumentID);
            existing.categoryId = Number(cd.CategoryID);
            existing.isInherited = false;
            existing.inheritedFrom = undefined;
          }
        } else {
          docMap.set(docTypeId, {
            categoryDocumentId: Number(cd.CategoryDocumentID),
            categoryId: Number(cd.CategoryID),
            documentTypeId: cd.DocumentTypeID,
            code: cd.DocumentTypes.Code,
            displayName: cd.DocumentTypes.DisplayName,
            isMandatory: cd.IsMandatory,
            status: cd.Status,
            isInherited: !isTargetCategory,
            inheritedFrom: !isTargetCategory
              ? {
                  categoryId: Number(cd.Categories.CategoryID),
                  categoryName: cd.Categories.CategoryName,
                  categoryCode: cd.Categories.CategoryCode,
                }
              : undefined,
          });
        }
      }
    }

    return Array.from(docMap.values()).sort((a, b) => a.documentTypeId - b.documentTypeId);
  }
}

export const categoryInheritanceService = new CategoryInheritanceService();
