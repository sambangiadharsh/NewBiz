import { prisma } from '../../database/prisma.js';
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

export const bannersService = {
  /**
   * List all banners for admin with optional search, placement, and status filters.
   */
  async listBanners(params: BannerFilterParams = {}) {
    const where: any = {};

    if (params.status && params.status !== 'ALL') {
      where.Status = params.status;
    }

    if (params.placement && params.placement !== 'ALL') {
      where.Placement = params.placement;
    }

    if (params.search && params.search.trim()) {
      const q = params.search.trim();
      where.OR = [
        { Title: { contains: q } },
        { Description: { contains: q } },
      ];
    }

    const banners = await prisma.banners.findMany({
      where,
      orderBy: [{ DisplayOrder: 'asc' }, { CreatedAt: 'desc' }],
    });

    return banners.map((b) => ({
      bannerId: String(b.BannerID),
      title: b.Title || null,
      description: b.Description || null,
      imageUrl: b.ImageURL,
      imageURL: b.ImageURL,
      placement: b.Placement,
      displayOrder: b.DisplayOrder,
      status: b.Status,
      startAt: b.StartAt ? b.StartAt.toISOString() : null,
      endAt: b.EndAt ? b.EndAt.toISOString() : null,
      createdAt: b.CreatedAt.toISOString(),
      updatedAt: b.UpdatedAt ? b.UpdatedAt.toISOString() : null,
    }));
  },

  /**
   * Get single banner by ID
   */
  async getBannerById(id: bigint) {
    const banner = await prisma.banners.findUnique({
      where: { BannerID: id },
    });

    if (!banner) {
      throw new NotFoundError(`Banner with ID ${id} not found`);
    }

    return {
      bannerId: String(banner.BannerID),
      title: banner.Title || null,
      description: banner.Description || null,
      imageUrl: banner.ImageURL,
      imageURL: banner.ImageURL,
      placement: banner.Placement,
      displayOrder: banner.DisplayOrder,
      status: banner.Status,
      startAt: banner.StartAt ? banner.StartAt.toISOString() : null,
      endAt: banner.EndAt ? banner.EndAt.toISOString() : null,
      createdAt: banner.CreatedAt.toISOString(),
      updatedAt: banner.UpdatedAt ? banner.UpdatedAt.toISOString() : null,
    };
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

    const banner = await prisma.banners.create({
      data: {
        Title: data.title ? data.title.trim() : null,
        Description: data.description ? data.description.trim() : null,
        ImageURL: imgUrl,
        Placement: cleanPlacement,
        DisplayOrder: displayOrder,
        Status: status,
        StartAt: startAt,
        EndAt: endAt,
        CreatedAt: new Date(),
        CreatedBy: userId || null,
      },
    });

    return {
      bannerId: String(banner.BannerID),
      title: banner.Title || null,
      description: banner.Description || null,
      imageUrl: banner.ImageURL,
      imageURL: banner.ImageURL,
      placement: banner.Placement,
      displayOrder: banner.DisplayOrder,
      status: banner.Status,
      startAt: banner.StartAt ? banner.StartAt.toISOString() : null,
      endAt: banner.EndAt ? banner.EndAt.toISOString() : null,
      createdAt: banner.CreatedAt.toISOString(),
      updatedAt: null,
    };
  },

  /**
   * Update banner
   */
  async updateBanner(id: bigint, data: UpdateBannerDTO, userId?: bigint) {
    const existing = await prisma.banners.findUnique({
      where: { BannerID: id },
    });

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

    const updated = await prisma.banners.update({
      where: { BannerID: id },
      data: updateData,
    });

    return {
      bannerId: String(updated.BannerID),
      title: updated.Title || null,
      description: updated.Description || null,
      imageUrl: updated.ImageURL,
      imageURL: updated.ImageURL,
      placement: updated.Placement,
      displayOrder: updated.DisplayOrder,
      status: updated.Status,
      startAt: updated.StartAt ? updated.StartAt.toISOString() : null,
      endAt: updated.EndAt ? updated.EndAt.toISOString() : null,
      createdAt: updated.CreatedAt.toISOString(),
      updatedAt: updated.UpdatedAt ? updated.UpdatedAt.toISOString() : null,
    };
  },

  /**
   * Quick toggle status
   */
  async toggleStatus(id: bigint, status: string, userId?: bigint) {
    const existing = await prisma.banners.findUnique({
      where: { BannerID: id },
    });

    if (!existing) {
      throw new NotFoundError(`Banner with ID ${id} not found`);
    }

    const cleanStatus = status.trim().toUpperCase();
    const updated = await prisma.banners.update({
      where: { BannerID: id },
      data: {
        Status: cleanStatus,
        UpdatedAt: new Date(),
        UpdatedBy: userId || null,
      },
    });

    return {
      bannerId: String(updated.BannerID),
      status: updated.Status,
    };
  },

  /**
   * Delete banner
   */
  async deleteBanner(id: bigint) {
    const existing = await prisma.banners.findUnique({
      where: { BannerID: id },
    });

    if (!existing) {
      throw new NotFoundError(`Banner with ID ${id} not found`);
    }

    await prisma.banners.delete({
      where: { BannerID: id },
    });

    return {
      success: true,
      message: 'Banner deleted successfully',
    };
  },

  /**
   * Public storefront query for live banners
   */
  async listPublicBanners(placement?: string) {
    const now = new Date();
    const where: any = {
      Status: 'ACTIVE',
      AND: [
        {
          OR: [{ StartAt: null }, { StartAt: { lte: now } }],
        },
        {
          OR: [{ EndAt: null }, { EndAt: { gte: now } }],
        },
      ],
    };

    if (placement && placement !== 'ALL') {
      where.Placement = placement.toUpperCase();
    }

    const banners = await prisma.banners.findMany({
      where,
      orderBy: [{ DisplayOrder: 'asc' }, { CreatedAt: 'desc' }],
    });

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
