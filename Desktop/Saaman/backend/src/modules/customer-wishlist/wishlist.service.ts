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

    const resolvedVariantId = await wishlistRepository.resolveVariantId(BigInt(productIdOrVariantId));
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

    await wishlistRepository.removeItem(BigInt(customerId), BigInt(identifier));
    return wishlistRepository.getWishlistItems(BigInt(customerId));
  }
}

export const wishlistService = new WishlistService();
