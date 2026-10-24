import { categoryRepository, AncestorCategory } from '../modules/categories/category.repository.js';
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

export { AncestorCategory };

export class CategoryInheritanceService {
  /**
   * Fast recursive CTE tree traversal from target category up to the root.
   * Returns ordered list from ROOT down to TARGET category: [Root, ..., Parent, Target].
   */
  async getCategoryAncestry(categoryId: bigint): Promise<AncestorCategory[]> {
    const ancestry = await categoryRepository.getCategoryAncestry(categoryId);
    if (ancestry.length === 0) {
      throw new NotFoundError(`Category with ID ${categoryId} not found`);
    }
    return ancestry;
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
    excluded?: EffectiveCategoryAttribute[];
  }> {
    const ancestry = await this.getCategoryAncestry(categoryId);
    const categoryIds = ancestry.map((a) => a.CategoryID);
    const targetIdStr = categoryId.toString();

    // Fetch all CategoryAttributes along the ancestry path
    const allCatAttrs = await categoryRepository.getCategoryAttributesForCategories(categoryIds);

    // Map by AttributeID. As we iterate from Root to Target, child overrides ancestor.
    const resolvedMap = new Map<string, EffectiveCategoryAttribute>();
    const excludedMap = new Map<string, EffectiveCategoryAttribute>();

    for (const ancestor of ancestry) {
      const ancestorCatAttrs = allCatAttrs.filter(
        (ca) => ca.CategoryID.toString() === ancestor.CategoryID.toString()
      );

      for (const ca of ancestorCatAttrs) {
        const attrIdStr = ca.AttributeID.toString();
        const isTargetCategory = ca.CategoryID.toString() === targetIdStr;

        const attributeValues: EffectiveAttributeValue[] = (ca.AttributeValues || []).map((v: any) => ({
          attributeValueId: v.AttributeValueID.toString(),
          valueName: v.ValueName,
          valueCode: v.ValueCode,
        }));

        // If inactive on a child, it deactivates an inherited attribute for this branch
        if (ca.Status !== 'ACTIVE') {
          resolvedMap.delete(attrIdStr);
          if (isTargetCategory) {
            excludedMap.set(attrIdStr, {
              categoryAttributeId: Number(ca.CategoryAttributeID),
              attributeId: attrIdStr,
              attributeName: ca.AttributeName,
              dataType: ca.DataType,
              isRequired: Boolean(ca.IsRequired),
              isVariantDefining: Boolean(ca.IsVariantDefining),
              displayOrder: ca.DisplayOrder,
              status: ca.Status,
              isInherited: false,
              values: attributeValues,
            });
          }
          continue;
        }

        resolvedMap.set(attrIdStr, {
          categoryAttributeId: Number(ca.CategoryAttributeID),
          attributeId: attrIdStr,
          attributeName: ca.AttributeName,
          dataType: ca.DataType,
          isRequired: Boolean(ca.IsRequired),
          isVariantDefining: Boolean(ca.IsVariantDefining),
          displayOrder: ca.DisplayOrder,
          status: ca.Status,
          isInherited: !isTargetCategory,
          inheritedFrom: !isTargetCategory
            ? {
                categoryId: Number(ca.CategoryID),
                categoryName: ca.CategoryName,
                categoryCode: ca.CategoryCode,
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
    const excluded = Array.from(excludedMap.values());

    return {
      variantDefining,
      requiredSpecs,
      optionalSpecs,
      all,
      excluded,
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

    const allCatDocs = await categoryRepository.getCategoryDocumentsForCategories(categoryIds);

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
          existing.isMandatory = existing.isMandatory || Boolean(cd.IsMandatory);
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
            code: cd.Code,
            displayName: cd.DisplayName,
            isMandatory: Boolean(cd.IsMandatory),
            status: cd.Status,
            isInherited: !isTargetCategory,
            inheritedFrom: !isTargetCategory
              ? {
                  categoryId: Number(cd.CategoryID),
                  categoryName: cd.CategoryName,
                  categoryCode: cd.CategoryCode,
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
