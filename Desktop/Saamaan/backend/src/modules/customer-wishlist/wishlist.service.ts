import { wishlistRepository, WishlistItemDetail } from './wishlist.repository.js';
import { NotFoundError, BadRequestError } from '../../utils/errors.js';

export class WishlistService {
  async getWishlist(customerId: string): Promise<WishlistItemDetail[]> {
    return wishlistRepository.getWishlistItems(BigInt(customerId));
  }

  async addItem(customerId: string, productIdOrVariantId: string): Promise<WishlistItemDetail[]> {
    if (!productIdOrVariantId) {
      throw new BadRequestError('Product ID or Variant ID is required');
    }

    const num = Number(productIdOrVariantId);
    if (isNaN(num)) {
      return wishlistRepository.getWishlistItems(BigInt(customerId));
    }

    const resolvedVariantId = await wishlistRepository.resolveVariantId(BigInt(num));
    if (!resolvedVariantId) {
      throw new NotFoundError('Product variant not found or inactive');
    }

    await wishlistRepository.addItem(BigInt(customerId), resolvedVariantId);
    return wishlistRepository.getWishlistItems(BigInt(customerId));
  }

  async removeItem(customerId: string, identifier: string): Promise<WishlistItemDetail[]> {
    if (!identifier) {
      throw new BadRequestError('Identifier is required');
    }

    const num = Number(identifier);
    if (!isNaN(num)) {
      await wishlistRepository.removeItem(BigInt(customerId), BigInt(num));
    }
    return wishlistRepository.getWishlistItems(BigInt(customerId));
  }
}

export const wishlistService = new WishlistService();
