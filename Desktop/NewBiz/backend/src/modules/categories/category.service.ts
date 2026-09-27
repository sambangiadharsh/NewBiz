import { prisma } from '../../database/prisma.js';
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
    const categories = await prisma.categories.findMany({
      where: { Status: 'ACTIVE' },
      select: {
        CategoryID: true,
        ParentCategoryID: true,
        CategoryName: true,
        CategoryCode: true,
        Description: true,
        IconURL: true,
        ImageURL: true,
        Status: true,
      },
      orderBy: { CategoryName: 'asc' },
    });

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
    const where: any = {};
    if (query?.status && query.status !== 'ALL') {
      where.Status = query.status;
    }
    if (query?.search?.trim()) {
      const q = query.search.trim();
      where.OR = [
        { CategoryName: { contains: q } },
        { CategoryCode: { contains: q } },
        { Description: { contains: q } },
      ];
    }

    const categories = await prisma.categories.findMany({
      where,
      include: {
        Categories: {
          select: {
            CategoryID: true,
            CategoryName: true,
            CategoryCode: true,
          },
        },
        other_Categories: {
          select: {
            CategoryID: true,
          },
        },
        CategoryDocuments: {
          where: { Status: 'ACTIVE' },
          select: {
            CategoryDocumentID: true,
            IsMandatory: true,
          },
        },
        CategoryAttributes: {
          where: { Status: 'ACTIVE' },
          select: {
            CategoryAttributeID: true,
          },
        },
      },
      orderBy: { CategoryName: 'asc' },
    });

    return categories.map((c) => {
      const hasChildren = c.other_Categories.length > 0;
      return {
        categoryId: Number(c.CategoryID),
        parentCategoryId: c.ParentCategoryID ? Number(c.ParentCategoryID) : null,
        parentCategory: c.Categories
          ? {
              categoryId: Number(c.Categories.CategoryID),
              categoryName: c.Categories.CategoryName,
              categoryCode: c.Categories.CategoryCode,
            }
          : null,
        categoryName: c.CategoryName,
        categoryCode: c.CategoryCode,
        description: c.Description,
        iconUrl: c.IconURL,
        imageUrl: c.ImageURL,
        status: c.Status,
        isLeaf: !hasChildren,
        subcategoriesCount: c.other_Categories.length,
        documentsCount: c.CategoryDocuments.length,
        mandatoryDocumentsCount: c.CategoryDocuments.filter((d) => d.IsMandatory).length,
        attributesCount: c.CategoryAttributes.length,
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
      const existing = await prisma.categories.findFirst({
        where: { CategoryCode: input.categoryCode },
      });
      if (existing) {
        throw new BadRequestError(`Category code "${input.categoryCode}" is already in use.`);
      }
    }

    if (input.parentCategoryId) {
      const parent = await prisma.categories.findUnique({
        where: { CategoryID: BigInt(input.parentCategoryId) },
      });
      if (!parent) {
        throw new NotFoundError('Specified parent category does not exist.');
      }
    }

    const created = await prisma.categories.create({
      data: {
        CategoryName: input.categoryName,
        CategoryCode: input.categoryCode,
        ParentCategoryID: input.parentCategoryId ? BigInt(input.parentCategoryId) : null,
        Description: input.description,
        IconURL: input.iconUrl,
        ImageURL: input.imageUrl,
        Status: input.status,
        CreatedBy: userId,
        CreatedAt: new Date(),
      },
    });

    return {
      categoryId: Number(created.CategoryID),
      categoryName: created.CategoryName,
      categoryCode: created.CategoryCode,
      status: created.Status,
      createdAt: created.CreatedAt,
    };
  }

  /**
   * Admin: Updates an existing Category.
   */
  async updateCategory(categoryIdStr: string, input: UpdateCategoryInput, userIdStr: string) {
    const categoryId = BigInt(categoryIdStr);
    const userId = BigInt(userIdStr);

    const existing = await prisma.categories.findUnique({
      where: { CategoryID: categoryId },
    });
    if (!existing) {
      throw new NotFoundError('Category not found');
    }

    if (input.categoryCode && input.categoryCode !== existing.CategoryCode) {
      const duplicate = await prisma.categories.findFirst({
        where: {
          CategoryCode: input.categoryCode,
          NOT: { CategoryID: categoryId },
        },
      });
      if (duplicate) {
        throw new BadRequestError(`Category code "${input.categoryCode}" is already in use.`);
      }
    }

    if (input.parentCategoryId) {
      if (BigInt(input.parentCategoryId) === categoryId) {
        throw new BadRequestError('A category cannot be its own parent.');
      }
      const parent = await prisma.categories.findUnique({
        where: { CategoryID: BigInt(input.parentCategoryId) },
      });
      if (!parent) {
        throw new NotFoundError('Specified parent category does not exist.');
      }
    }

    const updated = await prisma.categories.update({
      where: { CategoryID: categoryId },
      data: {
        CategoryName: input.categoryName,
        CategoryCode: input.categoryCode,
        ParentCategoryID:
          input.parentCategoryId !== undefined
            ? input.parentCategoryId
              ? BigInt(input.parentCategoryId)
              : null
            : undefined,
        Description: input.description,
        IconURL: input.iconUrl,
        ImageURL: input.imageUrl,
        Status: input.status,
        UpdatedBy: userId,
        UpdatedAt: new Date(),
      },
    });

    return {
      categoryId: Number(updated.CategoryID),
      categoryName: updated.CategoryName,
      categoryCode: updated.CategoryCode,
      status: updated.Status,
      updatedAt: updated.UpdatedAt,
    };
  }

  /**
   * Retrieves all document requirements linked to a category.
   */
  async getCategoryDocuments(categoryIdStr: string) {
    const categoryId = BigInt(categoryIdStr);

    const category = await prisma.categories.findUnique({
      where: { CategoryID: categoryId },
    });
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
      prisma.categories.findUnique({ where: { CategoryID: categoryId } }),
      prisma.documentTypes.findUnique({ where: { DocumentTypeID: input.documentTypeId } }),
    ]);

    if (!category) throw new NotFoundError('Category not found');
    if (!docType) throw new NotFoundError('Document type not found');

    const result = await prisma.categoryDocuments.upsert({
      where: {
        CategoryID_DocumentTypeID: {
          CategoryID: categoryId,
          DocumentTypeID: input.documentTypeId,
        },
      },
      create: {
        CategoryID: categoryId,
        DocumentTypeID: input.documentTypeId,
        IsMandatory: input.isMandatory,
        Status: input.status || 'ACTIVE',
        CreatedBy: userId,
        CreatedAt: new Date(),
      },
      update: {
        IsMandatory: input.isMandatory,
        Status: input.status || 'ACTIVE',
        UpdatedBy: userId,
        UpdatedAt: new Date(),
      },
      include: {
        DocumentTypes: true,
      },
    });

    return {
      categoryDocumentId: Number(result.CategoryDocumentID),
      categoryId: Number(result.CategoryID),
      documentTypeId: result.DocumentTypeID,
      code: result.DocumentTypes.Code,
      displayName: result.DocumentTypes.DisplayName,
      isMandatory: result.IsMandatory,
      status: result.Status,
    };
  }

  /**
   * Admin: Deletes/removes a document requirement from a category.
   */
  async removeCategoryDocument(categoryIdStr: string, documentTypeIdNum: number) {
    const categoryId = BigInt(categoryIdStr);

    const existing = await prisma.categoryDocuments.findUnique({
      where: {
        CategoryID_DocumentTypeID: {
          CategoryID: categoryId,
          DocumentTypeID: documentTypeIdNum,
        },
      },
    });

    if (!existing) {
      throw new NotFoundError('Document requirement not found on this category');
    }

    await prisma.categoryDocuments.delete({
      where: {
        CategoryID_DocumentTypeID: {
          CategoryID: categoryId,
          DocumentTypeID: documentTypeIdNum,
        },
      },
    });

    return { success: true, message: 'Document requirement removed successfully' };
  }

  /**
   * Admin: Retrieves all available DocumentTypes.
   */
  async getDocumentTypes() {
    const list = await prisma.documentTypes.findMany({
      orderBy: { DisplayName: 'asc' },
      include: {
        CategoryDocuments: {
          select: { CategoryDocumentID: true },
        },
      },
    });

    return list.map((dt) => ({
      documentTypeId: dt.DocumentTypeID,
      code: dt.Code,
      displayName: dt.DisplayName,
      status: dt.Status,
      assignedCategoriesCount: dt.CategoryDocuments.length,
    }));
  }

  /**
   * Admin: Creates a new DocumentType.
   */
  async createDocumentType(input: CreateDocumentTypeInput) {
    const existing = await prisma.documentTypes.findFirst({
      where: { Code: input.code },
    });
    if (existing) {
      throw new BadRequestError(`Document type with code "${input.code}" already exists.`);
    }

    const created = await prisma.documentTypes.create({
      data: {
        Code: input.code,
        DisplayName: input.displayName,
        Status: input.status || 'ACTIVE',
      },
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

    const category = await prisma.categories.findUnique({
      where: { CategoryID: categoryId },
    });
    if (!category) {
      throw new NotFoundError('Category not found');
    }

    const resolved = await categoryInheritanceService.resolveEffectiveCategoryAttributes(categoryId);

    return {
      all: resolved.all,
      variantDefining: resolved.variantDefining,
      requiredSpecs: resolved.requiredSpecs,
      optionalSpecs: resolved.optionalSpecs,
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
      prisma.categories.findUnique({ where: { CategoryID: categoryId } }),
      prisma.attributes.findUnique({ where: { AttributeID: attributeId } }),
    ]);

    if (!category) throw new NotFoundError('Category not found');
    if (!attribute) throw new NotFoundError('Attribute not found');

    const result = await prisma.categoryAttributes.upsert({
      where: {
        CategoryID_AttributeID: {
          CategoryID: categoryId,
          AttributeID: attributeId,
        },
      },
      create: {
        CategoryID: categoryId,
        AttributeID: attributeId,
        IsRequired: input.isRequired,
        IsVariantDefining: input.isVariantDefining,
        DisplayOrder: input.displayOrder,
        Status: input.status || 'ACTIVE',
        CreatedBy: userId,
        CreatedAt: new Date(),
      },
      update: {
        IsRequired: input.isRequired,
        IsVariantDefining: input.isVariantDefining,
        DisplayOrder: input.displayOrder,
        Status: input.status || 'ACTIVE',
        UpdatedBy: userId,
        UpdatedAt: new Date(),
      },
      include: {
        Attributes: true,
      },
    });

    return {
      categoryAttributeId: Number(result.CategoryAttributeID),
      categoryId: Number(result.CategoryID),
      attributeId: result.AttributeID.toString(),
      attributeName: result.Attributes.AttributeName,
      dataType: result.Attributes.DataType,
      isRequired: result.IsRequired,
      isVariantDefining: result.IsVariantDefining,
      displayOrder: result.DisplayOrder,
      status: result.Status,
    };
  }

  /**
   * Admin: Removes a direct attribute from a category.
   */
  async removeCategoryAttribute(categoryIdStr: string, attributeIdStr: string) {
    const categoryId = BigInt(categoryIdStr);
    const attributeId = BigInt(attributeIdStr);

    const category = await prisma.categories.findUnique({
      where: { CategoryID: categoryId },
    });
    if (!category) throw new NotFoundError('Category not found');

    const deleted = await prisma.categoryAttributes.deleteMany({
      where: {
        CategoryID: categoryId,
        AttributeID: attributeId,
      },
    });

    if (deleted.count === 0) {
      throw new NotFoundError('Direct category attribute not found or already removed');
    }

    return { success: true, message: 'Category attribute unlinked successfully' };
  }
}

export const categoryService = new CategoryService();
