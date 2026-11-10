import { wishlistRepository, WishlistItemDetail } from './wishlist.repository.js';
import { NotFoundError, BadRequestError } from '../../utils/errors.js';

export interface AddWishlistItemInput {
  variantId?: string;
  productVariantId?: string;
}

export class WishlistService {
  async getWishlist(customerId: string): Promise<WishlistItemDetail[]> {
    return wishlistRepository.getWishlistItems(BigInt(customerId));
  }

  async addItem(customerId: string, input: AddWishlistItemInput | string): Promise<WishlistItemDetail[]> {
    let variantIdStr: string | undefined;

    if (typeof input === 'string') {
      variantIdStr = input;
    } else if (input) {
      variantIdStr = input.variantId || input.productVariantId;
    }

    if (!variantIdStr) {
      throw new BadRequestError('Product Variant ID is required');
    }

    const varNum = Number(variantIdStr);
    if (isNaN(varNum)) {
      throw new BadRequestError('Invalid Product Variant ID');
    }

    const resolvedVariantId = await wishlistRepository.resolveVariantId(BigInt(varNum));
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
