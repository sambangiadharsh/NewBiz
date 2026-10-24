import { cartRepository, CartSummary } from './cart.repository.js';
import { BadRequestError, NotFoundError } from '../../utils/errors.js';

export interface AddCartItemInput {
  sellerProductId?: string;
  productVariantId?: string;
  productId?: string;
  quantity?: number;
}

export interface MergeCartItemInput {
  sellerProductId?: string;
  productVariantId?: string;
  productId?: string;
  quantity: number;
}

export class CartService {
  async getCart(customerId: string): Promise<CartSummary> {
    return cartRepository.getCartSummary(BigInt(customerId));
  }

  async addItem(customerId: string, input: AddCartItemInput): Promise<CartSummary> {
    const parseBigInt = (val?: string) => {
      if (!val) return undefined;
      const num = Number(val);
      return !isNaN(num) && isFinite(num) ? BigInt(num) : undefined;
    };

    const spId = await cartRepository.resolveSellerProductId({
      sellerProductId: parseBigInt(input.sellerProductId),
      productVariantId: parseBigInt(input.productVariantId),
      productId: parseBigInt(input.productId),
    });

    if (!spId) {
      throw new NotFoundError('Selected product or variant is not available for purchase');
    }

    const qty = Math.max(1, input.quantity || 1);
    await cartRepository.addItem(BigInt(customerId), spId, qty);
    return cartRepository.getCartSummary(BigInt(customerId));
  }

  async updateQuantity(customerId: string, cartItemId: string, quantity: number): Promise<CartSummary> {
    if (quantity < 0) {
      throw new BadRequestError('Quantity must be greater than or equal to 0');
    }

    await cartRepository.updateQuantity(BigInt(customerId), BigInt(cartItemId), quantity);
    return cartRepository.getCartSummary(BigInt(customerId));
  }

  async removeItem(customerId: string, cartItemId: string): Promise<CartSummary> {
    await cartRepository.removeItem(BigInt(customerId), BigInt(cartItemId));
    return cartRepository.getCartSummary(BigInt(customerId));
  }

  async clearCart(customerId: string): Promise<CartSummary> {
    await cartRepository.clearCart(BigInt(customerId));
    return cartRepository.getCartSummary(BigInt(customerId));
  }

  async mergeCart(customerId: string, items: MergeCartItemInput[]): Promise<CartSummary> {
    if (!Array.isArray(items) || items.length === 0) {
      return cartRepository.getCartSummary(BigInt(customerId));
    }

    for (const item of items) {
      try {
        const spId = await cartRepository.resolveSellerProductId({
          sellerProductId: item.sellerProductId ? BigInt(item.sellerProductId) : undefined,
          productVariantId: item.productVariantId ? BigInt(item.productVariantId) : undefined,
          productId: item.productId ? BigInt(item.productId) : undefined,
        });

        if (spId) {
          const qty = Math.max(1, item.quantity || 1);
          await cartRepository.addItem(BigInt(customerId), spId, qty);
        }
      } catch (err) {
        // Continue merging remaining items even if one item has issues
        console.warn('Failed to merge cart item:', item, err);
      }
    }

    return cartRepository.getCartSummary(BigInt(customerId));
  }
}

export const cartService = new CartService();
