import { brandsRepository, BrandRecord } from './brands.repository.js';
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

function formatBrandResponse(b: BrandRecord) {
  const pCount = b.ProductCount ?? 0;
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
    createdAt: b.CreatedAt instanceof Date ? b.CreatedAt.toISOString() : new Date(b.CreatedAt).toISOString(),
    updatedAt: b.UpdatedAt ? (b.UpdatedAt instanceof Date ? b.UpdatedAt.toISOString() : new Date(b.UpdatedAt).toISOString()) : null,
  };
}

export const brandsService = {
  /**
   * List all brands with optional search, status, and isFeatured filters.
   * Includes count of linked products.
   */
  async listBrands(params: BrandFilterParams = {}) {
    const records = await brandsRepository.list(params);
    return records.map(formatBrandResponse);
  },

  /**
   * Get brand by ID
   */
  async getBrandById(id: bigint) {
    const brand = await brandsRepository.findById(id);
    if (!brand) {
      throw new NotFoundError(`Brand with ID ${id} not found`);
    }
    return formatBrandResponse(brand);
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
    const existingName = await brandsRepository.findByName(cleanName);
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
      const existingCode = await brandsRepository.findByCode(cleanCode);
      if (existingCode) {
        cleanCode = `${cleanCode.slice(0, 3)}${Math.floor(10 + Math.random() * 90)}`;
      }
    }

    const imageToSave = data.imageUrl?.trim() || data.imageURL?.trim() || null;
    const orderToSave =
      typeof (data.displayOrder ?? data.DisplayOrder) === 'number'
        ? Number(data.displayOrder ?? data.DisplayOrder)
        : 0;

    const brand = await brandsRepository.create({
      brandName: cleanName,
      brandCode: cleanCode,
      manufacturer: data.manufacturer?.trim() || null,
      description: data.description?.trim() || null,
      status: data.status || 'ACTIVE',
      imageUrl: imageToSave,
      isFeatured: Boolean(data.isFeatured),
      displayOrder: orderToSave,
      createdAt: new Date(),
      createdBy: userId || null,
    });

    return formatBrandResponse(brand);
  },

  /**
   * Update brand
   */
  async updateBrand(id: bigint, data: UpdateBrandDTO, userId?: bigint) {
    const existing = await brandsRepository.findById(id);
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
      const duplicateName = await brandsRepository.findByName(cleanName, id);
      if (duplicateName) {
        throw new ConflictError(`Another brand with name "${cleanName}" already exists`);
      }
      updateData.BrandName = cleanName;
    }

    if (data.brandCode !== undefined) {
      const cleanCode = data.brandCode.trim().toUpperCase();
      if (cleanCode) {
        const duplicateCode = await brandsRepository.findByCode(cleanCode, id);
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

    const updated = await brandsRepository.update(id, updateData);
    if (!updated) {
      throw new NotFoundError(`Brand with ID ${id} not found`);
    }

    return formatBrandResponse(updated);
  },

  /**
   * Toggle isFeatured flag directly
   */
  async toggleFeatured(id: bigint, isFeatured: boolean, userId?: bigint) {
    const existing = await brandsRepository.findById(id);
    if (!existing) {
      throw new NotFoundError(`Brand with ID ${id} not found`);
    }

    const updated = await brandsRepository.update(id, {
      IsFeatured: isFeatured,
      UpdatedAt: new Date(),
      UpdatedBy: userId || null,
    });

    if (!updated) {
      throw new NotFoundError(`Brand with ID ${id} not found`);
    }

    return {
      brandId: String(updated.BrandID),
      isFeatured: Boolean(updated.IsFeatured),
    };
  },

  /**
   * Delete brand safely
   */
  async deleteBrand(id: bigint) {
    const existing = await brandsRepository.findById(id);

    if (!existing) {
      throw new NotFoundError(`Brand with ID ${id} not found`);
    }

    if (existing.ProductCount && existing.ProductCount > 0) {
      throw new ConflictError(
        `Cannot delete brand "${existing.BrandName}" because it is associated with ${existing.ProductCount} catalog product(s). Please deactivate it instead.`
      );
    }

    await brandsRepository.delete(id);

    return {
      success: true,
      message: `Brand "${existing.BrandName}" deleted successfully`,
    };
  },

  /**
   * Get all products linked to a brand
   */
  async getBrandProducts(id: bigint) {
    const brand = await brandsRepository.findById(id);
    if (!brand) {
      throw new NotFoundError(`Brand with ID ${id} not found`);
    }

    const products = await brandsRepository.getBrandProducts(id);

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
        variantsCount: p.VariantsCount,
        createdAt: p.CreatedAt instanceof Date ? p.CreatedAt.toISOString() : new Date(p.CreatedAt).toISOString(),
      })),
    };
  },
};
