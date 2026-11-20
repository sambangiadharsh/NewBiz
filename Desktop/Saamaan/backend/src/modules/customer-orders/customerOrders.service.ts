import { getPool, sql } from '../../database/db.js';
import {
  customerOrdersRepository,
  OrderItemInput,
  RawAddressInput,
  CreateOrderDbInput,
} from './customerOrders.repository.js';
import { customerPromotionsService } from '../customer-promotions/promotions.service.js';
import { cartRepository } from '../customer-cart/cart.repository.js';
import { BadRequestError, NotFoundError } from '../../utils/errors.js';
import { invoicePdfService } from '../orders/invoicePdf.service.js';
import { paymentsService } from '../payments/payments.service.js';

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
    const rawCode = (input.paymentModeCode || 'COD').toUpperCase();
    const isOnline = ['ONLINE', 'PHONEPE', 'UPI', 'CARD', 'NETBANKING'].includes(rawCode);
    const lookupCode = isOnline ? 'ONLINE' : rawCode;

    const modeRes = await pool
      .request()
      .input('code', sql.VarChar, lookupCode)
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
      if (defaultModeRes.recordset.length > 0) {
        paymentModeId = defaultModeRes.recordset[0].PaymentModeID;
      } else {
        const anyModeRes = await pool.request().query<{ PaymentModeID: bigint }>(`
          SELECT TOP 1 PaymentModeID FROM dbo.PaymentModes ORDER BY PaymentModeID ASC
        `);
        if (anyModeRes.recordset.length > 0) {
          paymentModeId = anyModeRes.recordset[0].PaymentModeID;
        } else {
          const insMode = await pool.request().query<{ PaymentModeID: bigint }>(`
            INSERT INTO dbo.PaymentModes (PaymentModeCode, PaymentModeName, PaymentModeType, Status, CreatedAt, UpdatedAt)
            OUTPUT INSERTED.PaymentModeID
            VALUES ('COD', 'Cash on Delivery', 'CASH', 'ACTIVE', SYSUTCDATETIME(), SYSUTCDATETIME())
          `);
          paymentModeId = insMode.recordset[0].PaymentModeID;
        }
      }
    }

    // 2. Resolve items, SellerProducts, and prices
    const resolvedItems: OrderItemInput[] = [];
    let calculatedSubtotal = 0;

    for (const item of input.items) {
      const qty = Math.max(1, Number(item.quantity) || 1);
      let spId: bigint | null = null;

      if (item.sellerProductId && !isNaN(Number(item.sellerProductId))) {
        spId = BigInt(item.sellerProductId);
      } else if (item.productId && !isNaN(Number(item.productId))) {
        spId = await cartRepository.resolveSellerProductId({
          productId: BigInt(item.productId),
        });
      }

      // Query seller product details with live warehouse inventory check
      let spRow: any = null;
      if (spId) {
        const spQuery = await pool
          .request()
          .input('spId', sql.BigInt, spId)
          .query(`
            SELECT TOP 1 
              sp.SellerProductID, 
              sp.SellerID, 
              sp.SellingPrice, 
              sp.MRP, 
              sp.PurchasePrice,
              pm.ProductName,
              ISNULL(pm.GSTRate, 18) AS GSTRate,
              ISNULL(
                (
                  SELECT SUM(CASE 
                    WHEN (ISNULL(inv.PhysicalQuantity, 0) - ISNULL(inv.ReservedQuantity, 0) - ISNULL(inv.DamagedQuantity, 0)) > 0 
                    THEN (ISNULL(inv.PhysicalQuantity, 0) - ISNULL(inv.ReservedQuantity, 0) - ISNULL(inv.DamagedQuantity, 0)) 
                    ELSE 0 
                  END)
                  FROM dbo.WarehouseProducts wp WITH (NOLOCK)
                  JOIN dbo.Inventory inv WITH (NOLOCK) ON wp.WarehouseProductID = inv.WarehouseProductID
                  WHERE wp.SellerProductID = sp.SellerProductID AND wp.Status = 'ACTIVE'
                ), 0
              ) AS AvailableStock
            FROM dbo.SellerProducts sp
            LEFT JOIN dbo.ProductVariants pv ON sp.ProductVariantID = pv.ProductVariantID
            LEFT JOIN dbo.ProductMaster pm ON pv.ProductMasterID = pm.ProductID
            WHERE sp.SellerProductID = @spId AND sp.Status = 'ACTIVE'
          `);
        if (spQuery.recordset.length > 0) {
          spRow = spQuery.recordset[0];
        }
      }

      // Fallback if not found: select first active seller product
      if (!spRow) {
        const fallbackQuery = await pool.request().query(`
          SELECT TOP 1 
            sp.SellerProductID, 
            sp.SellerID, 
            sp.SellingPrice, 
            sp.MRP, 
            sp.PurchasePrice,
            pm.ProductName,
            ISNULL(pm.GSTRate, 18) AS GSTRate,
            ISNULL(
              (
                SELECT SUM(CASE 
                  WHEN (ISNULL(inv.PhysicalQuantity, 0) - ISNULL(inv.ReservedQuantity, 0) - ISNULL(inv.DamagedQuantity, 0)) > 0 
                  THEN (ISNULL(inv.PhysicalQuantity, 0) - ISNULL(inv.ReservedQuantity, 0) - ISNULL(inv.DamagedQuantity, 0)) 
                  ELSE 0 
                END)
                FROM dbo.WarehouseProducts wp WITH (NOLOCK)
                JOIN dbo.Inventory inv WITH (NOLOCK) ON wp.WarehouseProductID = inv.WarehouseProductID
                WHERE wp.SellerProductID = sp.SellerProductID AND wp.Status = 'ACTIVE'
              ), 0
            ) AS AvailableStock
          FROM dbo.SellerProducts sp
          LEFT JOIN dbo.ProductVariants pv ON sp.ProductVariantID = pv.ProductVariantID
          LEFT JOIN dbo.ProductMaster pm ON pv.ProductMasterID = pm.ProductID
          WHERE sp.Status = 'ACTIVE'
        `);
        if (fallbackQuery.recordset.length > 0) {
          spRow = fallbackQuery.recordset[0];
        } else {
          const anySp = await pool.request().query(`
            SELECT TOP 1 
              sp.SellerProductID, 
              sp.SellerID, 
              sp.SellingPrice, 
              sp.MRP, 
              sp.PurchasePrice,
              pm.ProductName,
              ISNULL(pm.GSTRate, 18) AS GSTRate,
              0 AS AvailableStock
            FROM dbo.SellerProducts sp
            LEFT JOIN dbo.ProductVariants pv ON sp.ProductVariantID = pv.ProductVariantID
            LEFT JOIN dbo.ProductMaster pm ON pv.ProductMasterID = pm.ProductID
          `);
          if (anySp.recordset.length > 0) {
            spRow = anySp.recordset[0];
          }
        }
      }

      if (!spRow) {
        throw new BadRequestError('Could not resolve seller product for order items.');
      }

      // Live Inventory Guard: Block order if warehouse stock is depleted or insufficient
      const availStock = Number(spRow.AvailableStock || 0);
      const prodName = spRow.ProductName || `Item #${spRow.SellerProductID}`;

      if (availStock <= 0) {
        throw new BadRequestError(`"${prodName}" is currently out of stock and cannot be ordered.`);
      }

      if (availStock < qty) {
        throw new BadRequestError(`"${prodName}" only has ${availStock} unit(s) available in stock (you requested ${qty}). Please update your bag.`);
      }

      const unitPrice = Number(spRow.SellingPrice || 0);
      const mrp = Number(spRow.MRP || unitPrice);
      const purchasePrice = spRow.PurchasePrice ? Number(spRow.PurchasePrice) : Number((unitPrice * 0.7).toFixed(2));
      const gstRate = Number(spRow.GSTRate || 18);

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
        gstRate,
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
    const codFee = (!isOnline && rawCode === 'COD') ? 29 : 0;
    const netSubtotal = Math.max(0, calculatedSubtotal - discountAmount);
    const totalAmount = netSubtotal + shippingAmount + codFee;

    // Calculate total GST tax across all items
    let calculatedTaxAmount = 0;
    for (const item of resolvedItems) {
      const lineTotal = item.unitPrice * item.quantity;
      const rate = item.gstRate || 18;
      const taxable = Number((lineTotal / (1 + rate / 100)).toFixed(2));
      calculatedTaxAmount += Number((lineTotal - taxable).toFixed(2));
    }

    // 5. Construct DB input
    const dbPayload: CreateOrderDbInput = {
      customerId: input.customerId,
      shippingAddressId: input.shippingAddressId ? BigInt(input.shippingAddressId) : undefined,
      rawAddress: input.rawAddress,
      paymentModeId,
      subtotalAmount: calculatedSubtotal,
      discountAmount,
      shippingAmount: shippingAmount + codFee, // Combine shipping & delivery convenience
      taxAmount: Number(calculatedTaxAmount.toFixed(2)),
      totalAmount,
      orderStatus: isOnline ? 'PENDING_PAYMENT' : 'CONFIRMED',
      items: resolvedItems,
    };

    const orderResult = await customerOrdersRepository.createOrder(dbPayload);

    // 6. If online payment mode (PhonePe v2), initiate payment session
    if (isOnline) {
      try {
        const paySession = await paymentsService.initiatePayment({
          orderId: orderResult.orderId,
          customerId: input.customerId,
        });

        return {
          ...orderResult,
          checkoutUrl: paySession.checkoutUrl,
          merchantTransactionId: paySession.merchantTransactionId,
          gateway: paySession.gateway,
        };
      } catch (err: any) {
        console.error('Failed to auto-initiate online payment session for order:', err);
        return {
          ...orderResult,
          paymentError: err.message,
        };
      }
    }

    return orderResult;
  }

  async getCustomerOrders(customerId: bigint) {
    return customerOrdersRepository.getCustomerOrders(customerId);
  }

  async getInvoicePdf(customerId: bigint, orderId: bigint) {
    const order = await customerOrdersRepository.getOrderForCustomerInvoice(customerId, orderId);
    if (!order) {
      throw new NotFoundError('Order not found or access denied.');
    }

    if (order.Status?.toUpperCase() !== 'DELIVERED') {
      throw new BadRequestError('Tax invoice is available for download only after the order is delivered.');
    }

    return await invoicePdfService.generateInvoicePdf(order.SellerID, order.OrderID);
  }

  async submitReturnRequest(input: {
    customerId: bigint;
    orderItemId: bigint;
    requestType: 'RETURN' | 'REPLACEMENT';
    reasonCategory: string;
    reasonDescription?: string;
    quantity?: number;
    resolutionType?: 'REFUND' | 'REPLACEMENT';
    refundMethod?: 'ORIGINAL_PAYMENT' | 'UPI' | 'BANK_ACCOUNT';
    refundDetails?: any;
    pickupAddress?: any;
    images?: string[];
  }) {
    const item = await customerOrdersRepository.getOrderItemForReturn(input.customerId, input.orderItemId);
    // 1. Order and Item existence check
    if (!item) {
      throw new NotFoundError('Order item not found or access denied.');
    }

    // 2. Delivery confirmation verification (Rule 5: Only allow after delivery status is confirmed)
    if (item.OrderStatus?.toUpperCase() !== 'DELIVERED') {
      throw new BadRequestError('Return or replacement can only be initiated on delivered orders.');
    }
    if (!item.DeliveredAt) {
      throw new BadRequestError('Delivery confirmation has not yet been received from the courier carrier.');
    }

    // 3. Block duplicate or concurrent active requests (Rule 4)
    if (item.ActiveReturnRequestJson) {
      throw new BadRequestError('A return or replacement request is already in progress for this item.');
    }

    // 4. Resolve Return Policy: Use immutable snapshot taken at order placement if available, otherwise fallback to live policy
    let policy = {
      isReturnable: Boolean(item.IsReturnable),
      isReplaceable: Boolean(item.IsReplaceable),
      returnWindowDays: Number(item.ReturnWindowDays || 0),
      replacementWindowDays: Number(item.ReplacementWindowDays || 0),
      requiresTechnicianCheck: Boolean(item.RequiresTechnicianCheck),
      policyName: item.PolicyName || 'Return Policy',
      policyCode: item.PolicyCode || 'DEFAULT',
    };

    if (item.ReturnPolicySnapshot) {
      try {
        const snap = JSON.parse(item.ReturnPolicySnapshot);
        policy = {
          isReturnable: Boolean(snap.isReturnable ?? snap.IsReturnable ?? policy.isReturnable),
          isReplaceable: Boolean(snap.isReplaceable ?? snap.IsReplaceable ?? policy.isReplaceable),
          returnWindowDays: Number(snap.returnWindowDays ?? snap.ReturnWindowDays ?? policy.returnWindowDays),
          replacementWindowDays: Number(snap.replacementWindowDays ?? snap.ReplacementWindowDays ?? policy.replacementWindowDays),
          requiresTechnicianCheck: Boolean(snap.requiresTechnicianCheck ?? snap.RequiresTechnicianCheck ?? policy.requiresTechnicianCheck),
          policyName: snap.policyName || snap.PolicyName || policy.policyName,
          policyCode: snap.policyCode || snap.PolicyCode || policy.policyCode,
        };
      } catch {
        // fallback to live policy
      }
    }

    // 5. Check return window against delivery date, not order date (Rule 1 & Rule 2)
    const deliveredDate = new Date(item.DeliveredAt);
    const daysSinceDelivery = Math.floor((Date.now() - deliveredDate.getTime()) / (1000 * 60 * 60 * 24));

    if (input.requestType === 'RETURN') {
      if (!policy.isReturnable) {
        throw new BadRequestError(
          policy.isReplaceable
            ? 'This product is eligible for Replacement only, returns for refund are not supported.'
            : 'This product is Non-Returnable due to hygiene and safety standards.'
        );
      }
      if (daysSinceDelivery > policy.returnWindowDays) {
        throw new BadRequestError(
          `The return window of ${policy.returnWindowDays} day(s) from delivery has expired for this item.`
        );
      }
    } else if (input.requestType === 'REPLACEMENT') {
      if (!policy.isReplaceable) {
        throw new BadRequestError('This product is not eligible for replacement.');
      }
      if (daysSinceDelivery > policy.replacementWindowDays) {
        throw new BadRequestError(
          `The replacement window of ${policy.replacementWindowDays} day(s) from delivery has expired for this item.`
        );
      }
    }

    // 6. Prevent over-returning across multiple requests (Rule 3)
    const totalPurchased = Number(item.Quantity);
    const totalAlreadyReturned = Number(item.TotalReturnedQuantity || 0);
    const remainingEligibleQty = totalPurchased - totalAlreadyReturned;

    if (remainingEligibleQty <= 0) {
      throw new BadRequestError(
        `All ${totalPurchased} purchased unit(s) of this item have already been returned or have return requests pending.`
      );
    }

    const requestedQty = Math.max(1, input.quantity || 1);
    if (requestedQty > remainingEligibleQty) {
      throw new BadRequestError(
        `You have already requested return for ${totalAlreadyReturned} of ${totalPurchased} purchased units. Maximum remaining quantity eligible for return is ${remainingEligibleQty}.`
      );
    }

    const resolvedPickupAddress = input.pickupAddress || {
      recipientName: item.ShippingRecipientName,
      phoneNumber: item.ShippingPhoneNumber,
      addressLine1: item.ShippingAddressLine1,
      addressLine2: item.ShippingAddressLine2 || '',
      city: item.ShippingCity,
      state: item.ShippingState,
      postalCode: item.ShippingPostalCode,
    };

    const resolution = input.requestType === 'RETURN' ? (input.resolutionType || 'REFUND') : 'REPLACEMENT';
    const isCod = (item.PaymentModeCode || 'COD').toUpperCase() === 'COD';
    const refundMethod = input.requestType === 'RETURN'
      ? (input.refundMethod || (isCod ? 'UPI' : 'ORIGINAL_PAYMENT'))
      : undefined;

    return customerOrdersRepository.createReturnRequest({
      orderId: BigInt(item.OrderID),
      orderItemId: BigInt(item.OrderItemID),
      customerId: input.customerId,
      sellerProductId: BigInt(item.SellerProductID),
      requestType: input.requestType,
      reasonCategory: input.reasonCategory,
      reasonDescription: input.reasonDescription,
      quantity: requestedQty,
      resolutionType: resolution,
      refundMethod,
      refundDetailsJson: input.refundDetails ? JSON.stringify(input.refundDetails) : undefined,
      pickupAddressJson: JSON.stringify(resolvedPickupAddress),
      images: input.images,
    });
  }

  async cancelReturnRequest(customerId: bigint, returnRequestId: bigint) {
    const success = await customerOrdersRepository.cancelReturnRequest(customerId, returnRequestId);
    if (!success) {
      throw new BadRequestError('Unable to cancel return request. Only pending requests can be cancelled.');
    }
    return { success: true, message: 'Return request cancelled successfully.' };
  }

  async getCustomerReturnRequests(customerId: bigint) {
    return customerOrdersRepository.getCustomerReturnRequests(customerId);
  }
}

export const customerOrdersService = new CustomerOrdersService();
