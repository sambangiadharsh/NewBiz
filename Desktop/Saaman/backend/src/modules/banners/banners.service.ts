import { bannersRepository, BannerRecord } from './banners.repository.js';
import { NotFoundError, BadRequestError } from '../../utils/errors.js';

export interface BannerFilterParams {
  search?: string;
  placement?: string;
  status?: string;
}

export interface CreateBannerDTO {
  title?: string | null;
  description?: string | null;
  imageUrl?: string;
  imageURL?: string;
  placement: string;
  displayOrder?: number;
  status?: string;
  startAt?: string | Date | null;
  endAt?: string | Date | null;
}

export interface UpdateBannerDTO {
  title?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  imageURL?: string | null;
  placement?: string;
  displayOrder?: number;
  status?: string;
  startAt?: string | Date | null;
  endAt?: string | Date | null;
}

function formatBannerResponse(b: BannerRecord) {
  return {
    bannerId: String(b.BannerID),
    title: b.Title || null,
    description: b.Description || null,
    imageUrl: b.ImageURL,
    imageURL: b.ImageURL,
    placement: b.Placement,
    displayOrder: b.DisplayOrder,
    status: b.Status,
    startAt: b.StartAt ? (b.StartAt instanceof Date ? b.StartAt.toISOString() : new Date(b.StartAt).toISOString()) : null,
    endAt: b.EndAt ? (b.EndAt instanceof Date ? b.EndAt.toISOString() : new Date(b.EndAt).toISOString()) : null,
    createdAt: b.CreatedAt instanceof Date ? b.CreatedAt.toISOString() : new Date(b.CreatedAt).toISOString(),
    updatedAt: b.UpdatedAt ? (b.UpdatedAt instanceof Date ? b.UpdatedAt.toISOString() : new Date(b.UpdatedAt).toISOString()) : null,
  };
}

export const bannersService = {
  /**
   * List all banners for admin with optional search, placement, and status filters.
   */
  async listBanners(params: BannerFilterParams = {}) {
    const banners = await bannersRepository.list(params);
    return banners.map(formatBannerResponse);
  },

  /**
   * Get single banner by ID
   */
  async getBannerById(id: bigint) {
    const banner = await bannersRepository.findById(id);
    if (!banner) {
      throw new NotFoundError(`Banner with ID ${id} not found`);
    }
    return formatBannerResponse(banner);
  },

  /**
   * Create a new banner
   */
  async createBanner(data: CreateBannerDTO, userId?: bigint) {
    const imgUrl = (data.imageUrl || data.imageURL || '').trim();
    if (!imgUrl) {
      throw new BadRequestError('Banner image is required');
    }

    const cleanPlacement = (data.placement || '').trim().toUpperCase();
    if (!cleanPlacement) {
      throw new BadRequestError('Banner placement is required');
    }

    const displayOrder = typeof data.displayOrder === 'number' ? data.displayOrder : 0;
    const status = data.status ? data.status.trim().toUpperCase() : 'ACTIVE';

    const startAt = data.startAt ? new Date(data.startAt) : null;
    const endAt = data.endAt ? new Date(data.endAt) : null;

    if (startAt && endAt && startAt > endAt) {
      throw new BadRequestError('Start schedule cannot be after End schedule');
    }

    const banner = await bannersRepository.create({
      title: data.title ? data.title.trim() : null,
      description: data.description ? data.description.trim() : null,
      imageUrl: imgUrl,
      placement: cleanPlacement,
      displayOrder,
      status,
      startAt,
      endAt,
      createdAt: new Date(),
      createdBy: userId || null,
    });

    return formatBannerResponse(banner);
  },

  /**
   * Update banner
   */
  async updateBanner(id: bigint, data: UpdateBannerDTO, userId?: bigint) {
    const existing = await bannersRepository.findById(id);
    if (!existing) {
      throw new NotFoundError(`Banner with ID ${id} not found`);
    }

    const updateData: any = {
      UpdatedAt: new Date(),
      UpdatedBy: userId || null,
    };

    if (data.title !== undefined) {
      updateData.Title = data.title ? data.title.trim() : null;
    }

    if (data.description !== undefined) {
      updateData.Description = data.description ? data.description.trim() : null;
    }

    if (data.imageUrl !== undefined || data.imageURL !== undefined) {
      const img = (data.imageUrl || data.imageURL || '').trim();
      if (!img) throw new BadRequestError('Banner image URL cannot be empty');
      updateData.ImageURL = img;
    }

    if (data.placement !== undefined) {
      const cleanPlacement = data.placement.trim().toUpperCase();
      if (!cleanPlacement) throw new BadRequestError('Placement cannot be empty');
      updateData.Placement = cleanPlacement;
    }

    if (data.displayOrder !== undefined) {
      updateData.DisplayOrder = Number(data.displayOrder) || 0;
    }

    if (data.status !== undefined) {
      updateData.Status = data.status.trim().toUpperCase();
    }

    if (data.startAt !== undefined) {
      updateData.StartAt = data.startAt ? new Date(data.startAt) : null;
    }

    if (data.endAt !== undefined) {
      updateData.EndAt = data.endAt ? new Date(data.endAt) : null;
    }

    const effectiveStart = updateData.StartAt !== undefined ? updateData.StartAt : existing.StartAt;
    const effectiveEnd = updateData.EndAt !== undefined ? updateData.EndAt : existing.EndAt;
    if (effectiveStart && effectiveEnd && effectiveStart > effectiveEnd) {
      throw new BadRequestError('Start schedule cannot be after End schedule');
    }

    const updated = await bannersRepository.update(id, updateData);
    if (!updated) {
      throw new NotFoundError(`Banner with ID ${id} not found`);
    }

    return formatBannerResponse(updated);
  },

  /**
   * Quick toggle status
   */
  async toggleStatus(id: bigint, status: string, userId?: bigint) {
    const existing = await bannersRepository.findById(id);
    if (!existing) {
      throw new NotFoundError(`Banner with ID ${id} not found`);
    }

    const cleanStatus = status.trim().toUpperCase();
    const updated = await bannersRepository.update(id, {
      Status: cleanStatus,
      UpdatedAt: new Date(),
      UpdatedBy: userId || null,
    });

    if (!updated) {
      throw new NotFoundError(`Banner with ID ${id} not found`);
    }

    return {
      bannerId: String(updated.BannerID),
      status: updated.Status,
    };
  },

  /**
   * Delete banner
   */
  async deleteBanner(id: bigint) {
    const existing = await bannersRepository.findById(id);
    if (!existing) {
      throw new NotFoundError(`Banner with ID ${id} not found`);
    }

    await bannersRepository.delete(id);

    return {
      success: true,
      message: 'Banner deleted successfully',
    };
  },

  /**
   * Public storefront query for live banners
   */
  async listPublicBanners(placement?: string) {
    const banners = await bannersRepository.listPublic(placement);
    return banners.map((b) => ({
      bannerId: String(b.BannerID),
      title: b.Title || null,
      description: b.Description || null,
      imageUrl: b.ImageURL,
      imageURL: b.ImageURL,
      placement: b.Placement,
      displayOrder: b.DisplayOrder,
    }));
  },
};
