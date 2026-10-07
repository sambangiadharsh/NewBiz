import { getPool, sql } from '../../database/db.js';
import {
  customerOrdersRepository,
  OrderItemInput,
  RawAddressInput,
  CreateOrderDbInput,
} from './customerOrders.repository.js';
import { customerPromotionsService } from '../customer-promotions/promotions.service.js';
import { cartRepository } from '../customer-cart/cart.repository.js';
import { BadRequestError } from '../../utils/errors.js';

export interface CheckoutItemPayload {
  productId: string;
  sellerProductId?: string;
  quantity: number;
  price?: number;
  originalPrice?: number;
}

export interface PlaceOrderInput {
  customerId: bigint;
  shippingAddressId?: string;
  rawAddress?: RawAddressInput;
  paymentModeCode: string;
  couponCode?: string;
  items: CheckoutItemPayload[];
}

export class CustomerOrdersService {
  async placeOrder(input: PlaceOrderInput) {
    if (!input.items || input.items.length === 0) {
      throw new BadRequestError('Cannot place an order with an empty shopping bag.');
    }

    const pool = await getPool();

    // 1. Resolve PaymentModeID from code (default to COD)
    const modeCode = (input.paymentModeCode || 'COD').toUpperCase();
    const modeRes = await pool
      .request()
      .input('code', sql.VarChar, modeCode)
      .query<{ PaymentModeID: bigint }>(`
        SELECT TOP 1 PaymentModeID 
        FROM dbo.PaymentModes 
        WHERE UPPER(PaymentModeCode) = @code AND Status = 'ACTIVE'
      `);

    let paymentModeId: bigint;
    if (modeRes.recordset.length > 0) {
      paymentModeId = modeRes.recordset[0].PaymentModeID;
    } else {
      // Fallback to first active mode
      const defaultModeRes = await pool.request().query<{ PaymentModeID: bigint }>(`
        SELECT TOP 1 PaymentModeID FROM dbo.PaymentModes WHERE Status = 'ACTIVE' ORDER BY PaymentModeID ASC
      `);
      if (defaultModeRes.recordset.length === 0) {
        throw new Error('No active payment modes configured.');
      }
      paymentModeId = defaultModeRes.recordset[0].PaymentModeID;
    }

    // 2. Resolve items, SellerProducts, and prices
    const resolvedItems: OrderItemInput[] = [];
    let calculatedSubtotal = 0;

    for (const item of input.items) {
      const qty = Math.max(1, Number(item.quantity) || 1);
      let spId: bigint | null = null;

      if (item.sellerProductId) {
        spId = BigInt(item.sellerProductId);
      } else if (item.productId && !isNaN(Number(item.productId))) {
        spId = await cartRepository.resolveSellerProductId({
          productId: BigInt(item.productId),
        });
      }

      // Query seller product details
      let spRow: any = null;
      if (spId) {
        const spQuery = await pool
          .request()
          .input('spId', sql.BigInt, spId)
          .query(`
            SELECT TOP 1 SellerProductID, SellerID, SellingPrice, MRP, PurchasePrice
            FROM dbo.SellerProducts
            WHERE SellerProductID = @spId AND Status = 'ACTIVE'
          `);
        if (spQuery.recordset.length > 0) {
          spRow = spQuery.recordset[0];
        }
      }

      // Fallback if not found: select first active seller product
      if (!spRow) {
        const fallbackQuery = await pool.request().query(`
          SELECT TOP 1 SellerProductID, SellerID, SellingPrice, MRP, PurchasePrice
          FROM dbo.SellerProducts
          WHERE Status = 'ACTIVE'
        `);
        if (fallbackQuery.recordset.length > 0) {
          spRow = fallbackQuery.recordset[0];
        }
      }

      if (!spRow) {
        throw new BadRequestError('Could not resolve seller product for order items.');
      }

      const unitPrice = item.price && item.price > 0 ? Number(item.price) : Number(spRow.SellingPrice || 0);
      const mrp = item.originalPrice && item.originalPrice > 0 ? Number(item.originalPrice) : Number(spRow.MRP || unitPrice);
      const purchasePrice = spRow.PurchasePrice ? Number(spRow.PurchasePrice) : Number((unitPrice * 0.7).toFixed(2));

      calculatedSubtotal += unitPrice * qty;

      resolvedItems.push({
        sellerProductId: BigInt(spRow.SellerProductID),
        sellerId: BigInt(spRow.SellerID),
        quantity: qty,
        unitPrice,
        mrp,
        purchasePrice,
        discountPercentage: mrp > unitPrice ? ((mrp - unitPrice) / mrp) * 100 : 0,
        discountAmount: Math.max(0, (mrp - unitPrice) * qty),
      });
    }

    // 3. Discount validation
    let discountAmount = 0;
    if (input.couponCode && input.couponCode.trim()) {
      try {
        const promoRes = await customerPromotionsService.validatePromotion({
          code: input.couponCode.trim(),
          subtotal: calculatedSubtotal,
        });
        discountAmount = promoRes.promotion.discountAmount;
      } catch (err: any) {
        console.warn('Coupon application skipped in placeOrder:', err.message);
      }
    }

    // 4. Shipping & COD Convenience fee
    const shippingAmount = calculatedSubtotal >= 499 ? 0 : 49;
    const codFee = modeCode === 'COD' ? 29 : 0;
    const netSubtotal = Math.max(0, calculatedSubtotal - discountAmount);
    const totalAmount = netSubtotal + shippingAmount + codFee;

    // 5. Construct DB input
    const dbPayload: CreateOrderDbInput = {
      customerId: input.customerId,
      shippingAddressId: input.shippingAddressId ? BigInt(input.shippingAddressId) : undefined,
      rawAddress: input.rawAddress,
      paymentModeId,
      subtotalAmount: calculatedSubtotal,
      discountAmount,
      shippingAmount: shippingAmount + codFee, // Combine shipping & delivery convenience
      taxAmount: 0,
      totalAmount,
      items: resolvedItems,
    };

    return customerOrdersRepository.createOrder(dbPayload);
  }

  async getCustomerOrders(customerId: bigint) {
    return customerOrdersRepository.getCustomerOrders(customerId);
  }
}

export const customerOrdersService = new CustomerOrdersService();
