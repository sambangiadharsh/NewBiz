import { categoryRepository } from './category.repository.js';
import { NotFoundError, BadRequestError } from '../../utils/errors.js';
import {
  CreateCategoryInput,
  UpdateCategoryInput,
  LinkCategoryDocumentInput,
  CreateDocumentTypeInput,
  LinkCategoryAttributeInput,
} from './category.validation.js';
import { categoryInheritanceService } from '../../services/categoryInheritance.service.js';

export class CategoryService {
  /**
   * Retrieves all categories for public/seller consumption (Active only).
   */
  async getPublicCategories() {
    const categories = await categoryRepository.listPublicCategories();

    const parentIdSet = new Set(
      categories.filter((c) => c.ParentCategoryID !== null).map((c) => Number(c.ParentCategoryID))
    );

    return categories.map((c) => ({
      categoryId: Number(c.CategoryID),
      parentCategoryId: c.ParentCategoryID ? Number(c.ParentCategoryID) : null,
      categoryName: c.CategoryName,
      categoryCode: c.CategoryCode,
      description: c.Description,
      iconUrl: c.IconURL,
      imageUrl: c.ImageURL,
      status: c.Status,
      isLeaf: !parentIdSet.has(Number(c.CategoryID)),
    }));
  }

  /**
   * Admin: Retrieves all categories with parent hierarchy, document counts, and child counts.
   */
  async getAdminCategories(query?: { status?: string; search?: string }) {
    const categories = await categoryRepository.listAdminCategories(query);

    return categories.map((c) => {
      const hasChildren = c.ChildCount > 0;
      return {
        categoryId: Number(c.CategoryID),
        parentCategoryId: c.ParentCategoryID ? Number(c.ParentCategoryID) : null,
        parentCategory: c.ParentCategoryName
          ? {
              categoryId: Number(c.ParentCategoryID),
              categoryName: c.ParentCategoryName,
              categoryCode: c.ParentCategoryCode,
            }
          : null,
        categoryName: c.CategoryName,
        categoryCode: c.CategoryCode,
        description: c.Description,
        iconUrl: c.IconURL,
        imageUrl: c.ImageURL,
        status: c.Status,
        isLeaf: !hasChildren,
        subcategoriesCount: c.ChildCount,
        documentsCount: c.DocumentCount,
        mandatoryDocumentsCount: c.MandatoryDocumentCount,
        attributesCount: c.AttributeCount,
      };
    });
  }

  /**
   * Admin: Creates a new Category.
   */
  async createCategory(input: CreateCategoryInput, userIdStr: string) {
    const userId = BigInt(userIdStr);

    // Check code uniqueness if provided
    if (input.categoryCode) {
      const existing = await categoryRepository.findCategoryByCode(input.categoryCode);
      if (existing) {
        throw new BadRequestError(`Category code "${input.categoryCode}" is already in use.`);
      }
    }

    if (input.parentCategoryId) {
      const parent = await categoryRepository.findCategoryById(BigInt(input.parentCategoryId));
      if (!parent) {
        throw new NotFoundError('Specified parent category does not exist.');
      }
    }

    const created = await categoryRepository.createCategory({
      categoryName: input.categoryName,
      categoryCode: input.categoryCode,
      parentCategoryId: input.parentCategoryId ? BigInt(input.parentCategoryId) : null,
      description: input.description,
      iconUrl: input.iconUrl ? input.iconUrl.trim() : null,
      imageUrl: input.imageUrl ? input.imageUrl.trim() : null,
      status: input.status,
      createdBy: userId,
      createdAt: new Date(),
    });

    return {
      categoryId: Number(created.CategoryID),
      categoryName: created.CategoryName,
      categoryCode: created.CategoryCode,
      status: created.Status,
      createdAt: (created as any).CreatedAt,
    };
  }

  /**
   * Admin: Updates an existing Category.
   */
  async updateCategory(categoryIdStr: string, input: UpdateCategoryInput, userIdStr: string) {
    const categoryId = BigInt(categoryIdStr);
    const userId = BigInt(userIdStr);

    const existing = await categoryRepository.findCategoryById(categoryId);
    if (!existing) {
      throw new NotFoundError('Category not found');
    }

    if (input.categoryCode && input.categoryCode !== existing.CategoryCode) {
      const duplicate = await categoryRepository.findCategoryByCode(input.categoryCode, categoryId);
      if (duplicate) {
        throw new BadRequestError(`Category code "${input.categoryCode}" is already in use.`);
      }
    }

    if (input.parentCategoryId) {
      if (BigInt(input.parentCategoryId) === categoryId) {
        throw new BadRequestError('A category cannot be its own parent.');
      }
      const parent = await categoryRepository.findCategoryById(BigInt(input.parentCategoryId));
      if (!parent) {
        throw new NotFoundError('Specified parent category does not exist.');
      }
    }

    const updated = await categoryRepository.updateCategory(categoryId, {
      CategoryName: input.categoryName,
      CategoryCode: input.categoryCode,
      ParentCategoryID:
        input.parentCategoryId !== undefined
          ? input.parentCategoryId
            ? BigInt(input.parentCategoryId)
            : null
          : undefined,
      Description: input.description,
      IconURL: input.iconUrl !== undefined ? (input.iconUrl?.trim() || null) : undefined,
      ImageURL: input.imageUrl !== undefined ? (input.imageUrl?.trim() || null) : undefined,
      Status: input.status,
      UpdatedBy: userId,
      UpdatedAt: new Date(),
    });

    if (!updated) throw new NotFoundError('Category not found');

    return {
      categoryId: Number(updated.CategoryID),
      categoryName: updated.CategoryName,
      categoryCode: updated.CategoryCode,
      status: updated.Status,
      updatedAt: (updated as any).UpdatedAt,
    };
  }

  /**
   * Retrieves all document requirements linked to a category.
   */
  async getCategoryDocuments(categoryIdStr: string) {
    const categoryId = BigInt(categoryIdStr);

    const category = await categoryRepository.findCategoryById(categoryId);
    if (!category) {
      throw new NotFoundError('Category not found');
    }

    // Resolves both direct and inherited document requirements across the ancestor tree
    const effectiveDocs = await categoryInheritanceService.resolveEffectiveCategoryDocuments(categoryId);

    return effectiveDocs.map((d) => ({
      categoryDocumentId: d.categoryDocumentId,
      categoryId: d.categoryId,
      documentTypeId: d.documentTypeId,
      code: d.code,
      displayName: d.displayName,
      isMandatory: d.isMandatory,
      status: d.status,
      isInherited: d.isInherited,
      inheritedFrom: d.inheritedFrom,
    }));
  }

  /**
   * Admin: Links or updates a document requirement on a category.
   */
  async linkCategoryDocument(categoryIdStr: string, input: LinkCategoryDocumentInput, userIdStr: string) {
    const categoryId = BigInt(categoryIdStr);
    const userId = BigInt(userIdStr);

    const [category, docType] = await Promise.all([
      categoryRepository.findCategoryById(categoryId),
      categoryRepository.findDocumentTypeById(input.documentTypeId),
    ]);

    if (!category) throw new NotFoundError('Category not found');
    if (!docType) throw new NotFoundError('Document type not found');

    const result = await categoryRepository.upsertCategoryDocument({
      categoryId,
      documentTypeId: input.documentTypeId,
      isMandatory: input.isMandatory,
      status: input.status || 'ACTIVE',
      userId,
    });

    return {
      categoryDocumentId: Number(result.CategoryDocumentID),
      categoryId: Number(result.CategoryID),
      documentTypeId: result.DocumentTypeID,
      code: result.Code,
      displayName: result.DisplayName,
      isMandatory: Boolean(result.IsMandatory),
      status: result.Status,
    };
  }

  /**
   * Admin: Deletes/removes a document requirement from a category.
   */
  async removeCategoryDocument(categoryIdStr: string, documentTypeIdNum: number) {
    const categoryId = BigInt(categoryIdStr);

    const deleted = await categoryRepository.removeCategoryDocument(categoryId, documentTypeIdNum);
    if (!deleted) {
      throw new NotFoundError('Document requirement not found on this category');
    }

    return { success: true, message: 'Document requirement removed successfully' };
  }

  /**
   * Admin: Retrieves all available DocumentTypes.
   */
  async getDocumentTypes() {
    const list = await categoryRepository.listDocumentTypes();

    return list.map((dt) => ({
      documentTypeId: dt.DocumentTypeID,
      code: dt.Code,
      displayName: dt.DisplayName,
      status: dt.Status,
      assignedCategoriesCount: dt.AssignedCategoriesCount,
    }));
  }

  /**
   * Admin: Creates a new DocumentType.
   */
  async createDocumentType(input: CreateDocumentTypeInput) {
    const existing = await categoryRepository.findDocumentTypeByCode(input.code);
    if (existing) {
      throw new BadRequestError(`Document type with code "${input.code}" already exists.`);
    }

    const created = await categoryRepository.createDocumentType({
      code: input.code,
      displayName: input.displayName,
      status: input.status || 'ACTIVE',
    });

    return {
      documentTypeId: created.DocumentTypeID,
      code: created.Code,
      displayName: created.DisplayName,
      status: created.Status,
    };
  }

  /**
   * Admin: Retrieves all effective attributes for a category (both inherited and direct).
   */
  async getCategoryAttributes(categoryIdStr: string) {
    const categoryId = BigInt(categoryIdStr);

    const category = await categoryRepository.findCategoryById(categoryId);
    if (!category) {
      throw new NotFoundError('Category not found');
    }

    const resolved = await categoryInheritanceService.resolveEffectiveCategoryAttributes(categoryId);

    return {
      all: resolved.all,
      variantDefining: resolved.variantDefining,
      requiredSpecs: resolved.requiredSpecs,
      optionalSpecs: resolved.optionalSpecs,
      excluded: resolved.excluded || [],
    };
  }

  /**
   * Admin: Links or updates an attribute on a category.
   */
  async linkCategoryAttribute(
    categoryIdStr: string,
    input: LinkCategoryAttributeInput,
    userIdStr: string
  ) {
    const categoryId = BigInt(categoryIdStr);
    const attributeId = BigInt(input.attributeId);
    const userId = BigInt(userIdStr);

    const [category, attribute] = await Promise.all([
      categoryRepository.findCategoryById(categoryId),
      categoryRepository.findAttributeById(attributeId),
    ]);

    if (!category) throw new NotFoundError('Category not found');
    if (!attribute) throw new NotFoundError('Attribute not found');

    const result = await categoryRepository.upsertCategoryAttribute({
      categoryId,
      attributeId,
      isRequired: input.isRequired,
      isVariantDefining: input.isVariantDefining,
      displayOrder: input.displayOrder,
      status: input.status || 'ACTIVE',
      userId,
    });

    return {
      categoryAttributeId: Number(result.CategoryAttributeID),
      categoryId: Number(result.CategoryID),
      attributeId: result.AttributeID.toString(),
      attributeName: result.AttributeName,
      dataType: result.DataType,
      isRequired: Boolean(result.IsRequired),
      isVariantDefining: Boolean(result.IsVariantDefining),
      displayOrder: result.DisplayOrder,
      status: result.Status,
    };
  }

  /**
   * Admin: Removes or excludes an attribute from a category.
   * If the attribute is inherited from an ancestor, it is excluded on this category by setting Status = 'INACTIVE'.
   * If restore=true is requested, any category override is removed, restoring natural inheritance.
   */
  async removeCategoryAttribute(
    categoryIdStr: string,
    attributeIdStr: string,
    userIdStr: string = '1',
    restore: boolean = false
  ) {
    const categoryId = BigInt(categoryIdStr);
    const attributeId = BigInt(attributeIdStr);
    const userId = BigInt(userIdStr);

    const category = await categoryRepository.findCategoryById(categoryId);
    if (!category) throw new NotFoundError('Category not found');

    const attribute = await categoryRepository.findAttributeById(attributeId);
    if (!attribute) throw new NotFoundError('Attribute not found');

    if (restore) {
      await categoryRepository.restoreCategoryAttribute(categoryId, attributeId);
      return { success: true, message: 'Attribute restored to category successfully' };
    }

    // Check if this attribute is inherited from an ancestor category
    const ancestry = await categoryInheritanceService.getCategoryAncestry(categoryId);
    const ancestorIds = ancestry
      .filter((a) => a.CategoryID.toString() !== categoryId.toString())
      .map((a) => a.CategoryID);

    let isInheritedFromAncestor = false;
    if (ancestorIds.length > 0) {
      const ancestorAttrs = await categoryRepository.getCategoryAttributesForCategories(ancestorIds);
      isInheritedFromAncestor = ancestorAttrs.some(
        (ca) => ca.AttributeID.toString() === attributeId.toString() && ca.Status === 'ACTIVE'
      );
    }

    if (isInheritedFromAncestor) {
      // Exclude inherited attribute for this branch by saving Status = 'INACTIVE' on this category node
      await categoryRepository.upsertCategoryAttribute({
        categoryId,
        attributeId,
        isRequired: false,
        isVariantDefining: false,
        displayOrder: 999,
        status: 'INACTIVE',
        userId,
      });
      return { success: true, message: 'Inherited attribute excluded from category successfully' };
    } else {
      // Direct category attribute: remove record completely
      await categoryRepository.removeCategoryAttribute(categoryId, attributeId);
      return { success: true, message: 'Category attribute unlinked successfully' };
    }
  }
}

export const categoryService = new CategoryService();
