import { prisma } from '../../database/prisma.js';
import { NotFoundError, ConflictError, BadRequestError } from '../../utils/errors.js';

export interface BrandFilterParams {
  search?: string;
  status?: string;
  isFeatured?: boolean;
}

export interface CreateBrandDTO {
  brandName: string;
  brandCode?: string;
  manufacturer?: string;
  description?: string;
  status?: string;
  imageUrl?: string;
  imageURL?: string;
  isFeatured?: boolean;
  displayOrder?: number;
  DisplayOrder?: number;
}

export interface UpdateBrandDTO {
  brandName?: string;
  brandCode?: string;
  manufacturer?: string;
  description?: string;
  status?: string;
  imageUrl?: string | null;
  imageURL?: string | null;
  isFeatured?: boolean;
  displayOrder?: number;
  DisplayOrder?: number;
}

export const brandsService = {
  /**
   * List all brands with optional search, status, and isFeatured filters.
   * Includes count of linked products.
   */
  async listBrands(params: BrandFilterParams = {}) {
    const where: any = {};

    if (params.status && params.status !== 'ALL') {
      where.Status = params.status;
    }

    if (typeof params.isFeatured === 'boolean') {
      where.IsFeatured = params.isFeatured;
    }

    if (params.search && params.search.trim()) {
      const q = params.search.trim();
      where.OR = [
        { BrandName: { contains: q } },
        { BrandCode: { contains: q } },
        { Manufacturer: { contains: q } },
        { Description: { contains: q } },
      ];
    }

    const brands = await prisma.brands.findMany({
      where,
      include: {
        _count: {
          select: {
            ProductMaster: true,
          },
        },
      },
      orderBy: [{ IsFeatured: 'desc' }, { DisplayOrder: 'asc' }, { BrandName: 'asc' }],
    });

    return brands.map((b: any) => {
      const pCount = b._count?.ProductMaster || 0;
      return {
        brandId: String(b.BrandID),
        brandName: b.BrandName,
        brandCode: b.BrandCode || b.BrandName.slice(0, 3).toUpperCase(),
        manufacturer: b.Manufacturer || null,
        description: b.Description || null,
        status: b.Status,
        imageUrl: b.ImageURL || null,
        imageURL: b.ImageURL || null,
        isFeatured: Boolean(b.IsFeatured),
        displayOrder: typeof b.DisplayOrder === 'number' ? b.DisplayOrder : 0,
        productsCount: pCount,
        _count: {
          ProductMaster: pCount,
        },
        createdAt: b.CreatedAt.toISOString(),
        updatedAt: b.UpdatedAt ? b.UpdatedAt.toISOString() : null,
      };
    });
  },

  /**
   * Get brand by ID
   */
  async getBrandById(id: bigint) {
    const brand: any = await prisma.brands.findUnique({
      where: { BrandID: id },
      include: {
        _count: {
          select: {
            ProductMaster: true,
          },
        },
      },
    });

    if (!brand) {
      throw new NotFoundError(`Brand with ID ${id} not found`);
    }

    const pCount = brand._count?.ProductMaster || 0;
    return {
      brandId: String(brand.BrandID),
      brandName: brand.BrandName,
      brandCode: brand.BrandCode,
      manufacturer: brand.Manufacturer,
      description: brand.Description,
      status: brand.Status,
      imageUrl: brand.ImageURL || null,
      imageURL: brand.ImageURL || null,
      isFeatured: Boolean(brand.IsFeatured),
      displayOrder: typeof brand.DisplayOrder === 'number' ? brand.DisplayOrder : 0,
      productsCount: pCount,
      _count: {
        ProductMaster: pCount,
      },
      createdAt: brand.CreatedAt.toISOString(),
      updatedAt: brand.UpdatedAt ? brand.UpdatedAt.toISOString() : null,
    };
  },

  /**
   * Create a new brand
   */
  async createBrand(data: CreateBrandDTO, userId?: bigint) {
    const cleanName = data.brandName.trim();
    if (!cleanName) {
      throw new BadRequestError('Brand name is required');
    }

    // Check name uniqueness
    const existingName = await prisma.brands.findFirst({
      where: { BrandName: cleanName },
    });
    if (existingName) {
      throw new ConflictError(`A brand with name "${cleanName}" already exists`);
    }

    // Format brand code
    let cleanCode = data.brandCode?.trim().toUpperCase();
    if (!cleanCode) {
      cleanCode = cleanName.replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase();
    }

    // Check code uniqueness
    if (cleanCode) {
      const existingCode = await prisma.brands.findFirst({
        where: { BrandCode: cleanCode },
      });
      if (existingCode) {
        cleanCode = `${cleanCode.slice(0, 3)}${Math.floor(10 + Math.random() * 90)}`;
      }
    }

    const imageToSave = data.imageUrl?.trim() || data.imageURL?.trim() || null;
    const orderToSave =
      typeof (data.displayOrder ?? data.DisplayOrder) === 'number'
        ? Number(data.displayOrder ?? data.DisplayOrder)
        : 0;

    const brand: any = await prisma.brands.create({
      data: {
        BrandName: cleanName,
        BrandCode: cleanCode,
        Manufacturer: data.manufacturer?.trim() || null,
        Description: data.description?.trim() || null,
        Status: data.status || 'ACTIVE',
        ImageURL: imageToSave,
        IsFeatured: Boolean(data.isFeatured),
        DisplayOrder: orderToSave,
        CreatedAt: new Date(),
        CreatedBy: userId || null,
      } as any,
    });

    return {
      brandId: String(brand.BrandID),
      brandName: brand.BrandName,
      brandCode: brand.BrandCode,
      manufacturer: brand.Manufacturer,
      description: brand.Description,
      status: brand.Status,
      imageUrl: brand.ImageURL,
      isFeatured: Boolean(brand.IsFeatured),
      displayOrder: typeof brand.DisplayOrder === 'number' ? brand.DisplayOrder : orderToSave,
      productsCount: 0,
      createdAt: brand.CreatedAt.toISOString(),
      updatedAt: null,
    };
  },

  /**
   * Update brand
   */
  async updateBrand(id: bigint, data: UpdateBrandDTO, userId?: bigint) {
    const existing = await prisma.brands.findUnique({
      where: { BrandID: id },
    });
    if (!existing) {
      throw new NotFoundError(`Brand with ID ${id} not found`);
    }

    const updateData: any = {
      UpdatedAt: new Date(),
      UpdatedBy: userId || null,
    };

    if (data.brandName !== undefined) {
      const cleanName = data.brandName.trim();
      if (!cleanName) throw new BadRequestError('Brand name cannot be empty');

      // Check name uniqueness excluding self
      const duplicateName = await prisma.brands.findFirst({
        where: {
          BrandName: cleanName,
          NOT: { BrandID: id },
        },
      });
      if (duplicateName) {
        throw new ConflictError(`Another brand with name "${cleanName}" already exists`);
      }
      updateData.BrandName = cleanName;
    }

    if (data.brandCode !== undefined) {
      const cleanCode = data.brandCode.trim().toUpperCase();
      if (cleanCode) {
        const duplicateCode = await prisma.brands.findFirst({
          where: {
            BrandCode: cleanCode,
            NOT: { BrandID: id },
          },
        });
        if (duplicateCode) {
          throw new ConflictError(`Brand code "${cleanCode}" is already in use`);
        }
        updateData.BrandCode = cleanCode;
      }
    }

    if (data.manufacturer !== undefined) {
      updateData.Manufacturer = data.manufacturer ? data.manufacturer.trim() : null;
    }

    if (data.description !== undefined) {
      updateData.Description = data.description ? data.description.trim() : null;
    }

    if (data.status !== undefined) {
      updateData.Status = data.status;
    }

    if (data.imageUrl !== undefined || data.imageURL !== undefined) {
      const img = data.imageUrl?.trim() || data.imageURL?.trim() || null;
      updateData.ImageURL = img;
    }

    if (data.isFeatured !== undefined) {
      updateData.IsFeatured = Boolean(data.isFeatured);
    }

    const displayOrderVal = data.displayOrder ?? data.DisplayOrder;
    if (displayOrderVal !== undefined) {
      updateData.DisplayOrder = Number(displayOrderVal) || 0;
    }

    const updated: any = await prisma.brands.update({
      where: { BrandID: id },
      data: updateData,
      include: {
        _count: {
          select: {
            ProductMaster: true,
          },
        },
      },
    });

    const pCount = updated._count?.ProductMaster || 0;
    return {
      brandId: String(updated.BrandID),
      brandName: updated.BrandName,
      brandCode: updated.BrandCode,
      manufacturer: updated.Manufacturer,
      description: updated.Description,
      status: updated.Status,
      imageUrl: updated.ImageURL || null,
      imageURL: updated.ImageURL || null,
      isFeatured: Boolean(updated.IsFeatured),
      displayOrder: typeof updated.DisplayOrder === 'number' ? updated.DisplayOrder : 0,
      productsCount: pCount,
      _count: {
        ProductMaster: pCount,
      },
      createdAt: updated.CreatedAt.toISOString(),
      updatedAt: updated.UpdatedAt ? updated.UpdatedAt.toISOString() : null,
    };
  },

  /**
   * Toggle isFeatured flag directly
   */
  async toggleFeatured(id: bigint, isFeatured: boolean, userId?: bigint) {
    const existing = await prisma.brands.findUnique({
      where: { BrandID: id },
    });
    if (!existing) {
      throw new NotFoundError(`Brand with ID ${id} not found`);
    }

    const updated = await prisma.brands.update({
      where: { BrandID: id },
      data: {
        IsFeatured: isFeatured,
        UpdatedAt: new Date(),
        UpdatedBy: userId || null,
      },
    });

    return {
      brandId: String(updated.BrandID),
      isFeatured: Boolean(updated.IsFeatured),
    };
  },

  /**
   * Delete brand safely
   */
  async deleteBrand(id: bigint) {
    const existing = await prisma.brands.findUnique({
      where: { BrandID: id },
      include: {
        _count: {
          select: {
            ProductMaster: true,
          },
        },
      },
    });

    if (!existing) {
      throw new NotFoundError(`Brand with ID ${id} not found`);
    }

    if (existing._count?.ProductMaster && existing._count.ProductMaster > 0) {
      throw new ConflictError(
        `Cannot delete brand "${existing.BrandName}" because it is associated with ${existing._count.ProductMaster} catalog product(s). Please deactivate it instead.`
      );
    }

    await prisma.brands.delete({
      where: { BrandID: id },
    });

    return {
      success: true,
      message: `Brand "${existing.BrandName}" deleted successfully`,
    };
  },

  /**
   * Get all products linked to a brand
   */
  async getBrandProducts(id: bigint) {
    const brand = await prisma.brands.findUnique({
      where: { BrandID: id },
      select: { BrandID: true, BrandName: true },
    });
    if (!brand) {
      throw new NotFoundError(`Brand with ID ${id} not found`);
    }

    const products = await prisma.productMaster.findMany({
      where: { BrandID: id },
      include: {
        _count: {
          select: {
            ProductVariants: true,
          },
        },
      },
      orderBy: { CreatedAt: 'desc' },
    });

    return {
      brand: {
        brandId: String(brand.BrandID),
        brandName: brand.BrandName,
      },
      total: products.length,
      products: products.map((p) => ({
        productId: String(p.ProductID),
        parentSku: p.ParentSKU,
        productName: p.ProductName,
        status: p.Status,
        isVerified: Boolean(p.IsVerified),
        variantsCount: p._count.ProductVariants,
        createdAt: p.CreatedAt.toISOString(),
      })),
    };
  },
};
