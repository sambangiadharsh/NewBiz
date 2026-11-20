import { adminOrdersRepository } from './adminOrders.repository.js';
import { BadRequestError, NotFoundError } from '../../utils/errors.js';
import { Response } from 'express';
import { streamXlsxExport, XlsxColumn } from '../../utils/xlsxExporter.js';

export class AdminOrdersService {
  /**
   * Helper to mask customer phone numbers for list displays (PII protection).
   * Example: "9876543210" -> "98*** ***10"
   */
  private maskPhoneNumber(phone: string | null): string | null {
    if (!phone) return null;
    const clean = phone.trim();
    if (clean.length < 6) return '****';
    const first2 = clean.slice(0, 2);
    const last2 = clean.slice(-2);
    return `${first2}******${last2}`;
  }

  /**
   * Aggregate GMV, order volume, and payment statuses.
   */
  async getSummary() {
    return adminOrdersRepository.getOrdersSummary();
  }

  /**
   * Paginated list of master orders with masked PII for list safety.
   */
  async getOrdersList(params: {
    search?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(50, Math.max(1, params.limit || 20)); // Cap at 50

    const { items, total } = await adminOrdersRepository.getOrdersList({
      search: params.search,
      status: params.status,
      startDate: params.startDate,
      endDate: params.endDate,
      page,
      limit,
    });

    const maskedItems = items.map((item) => ({
      ...item,
      customerPhone: this.maskPhoneNumber(item.customerPhone),
    }));

    return {
      items: maskedItems,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Complete order details (unmasked for authorized detail review).
   */
  async getOrderDetail(orderIdStr: string) {
    let orderId: bigint;
    try {
      orderId = BigInt(orderIdStr);
    } catch {
      throw new BadRequestError('Invalid Order ID format');
    }

    const detail = await adminOrdersRepository.getOrderDetail(orderId);
    if (!detail) {
      throw new NotFoundError(`Order with ID ${orderIdStr} not found`);
    }

    return detail;
  }

  /**
   * List of fulfillments across all warehouses.
   */
  async getFulfillmentsList(params: {
    status?: string;
    warehouseId?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(50, Math.max(1, params.limit || 20));

    const { items, total } = await adminOrdersRepository.getFulfillmentsList({
      status: params.status,
      warehouseId: params.warehouseId,
      search: params.search,
      page,
      limit,
    });

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * List of all payment records.
   */
  async getPaymentsList(params: {
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(50, Math.max(1, params.limit || 20));

    const { items, total } = await adminOrdersRepository.getPaymentsList({
      status: params.status,
      search: params.search,
      page,
      limit,
    });

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * List of cancelled orders and drop-offs.
   */
  async getCancelledOrdersList(params: {
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(50, Math.max(1, params.limit || 20));

    const { items, total } = await adminOrdersRepository.getCancelledOrdersList({
      search: params.search,
      page,
      limit,
    });

    const maskedItems = items.map((item) => ({
      ...item,
      customerPhone: this.maskPhoneNumber(item.customerPhone),
    }));

    return {
      items: maskedItems,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Force cancel an order before dispatch.
   */
  async cancelOrder(orderIdStr: string, reason: string, adminUserId: bigint) {
    let orderId: bigint;
    try {
      orderId = BigInt(orderIdStr);
    } catch {
      throw new BadRequestError('Invalid Order ID format');
    }

    if (!reason || reason.trim().length < 3) {
      throw new BadRequestError('A valid cancellation reason of at least 3 characters is required');
    }

    try {
      return await adminOrdersRepository.cancelOrder({
        orderId,
        reason: reason.trim(),
        adminUserId,
      });
    } catch (err: any) {
      if (err.message && (err.message.includes('Cannot cancel order') || err.message.includes('not found'))) {
        throw new BadRequestError(err.message);
      }
      throw err;
    }
  }

  /**
   * Paginated list of return requests with summary counts.
   */
  async getReturnsList(params: {
    search?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(50, Math.max(1, params.limit || 20));

    const { items, total, summary } = await adminOrdersRepository.getReturnsList({
      search: params.search,
      status: params.status,
      page,
      limit,
    });

    const maskedItems = items.map((item) => ({
      ...item,
      customerPhone: this.maskPhoneNumber(item.customerPhone),
    }));

    return {
      items: maskedItems,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      summary,
    };
  }

  /**
   * Update return request status with workflow transition check.
   */
  async updateReturnStatus(params: {
    returnRequestIdStr: string;
    status: string;
    adminComments?: string;
    trackingNumber?: string;
    qcStatus?: 'PENDING' | 'PASSED' | 'FAILED';
    qcNotes?: string;
    qcGrade?: string;
    refundTransactionId?: string;
    replacementOrderId?: bigint;
    restockInventory?: boolean;
    adminUserId: bigint;
  }) {
    let returnRequestId: bigint;
    try {
      returnRequestId = BigInt(params.returnRequestIdStr);
    } catch {
      throw new BadRequestError('Invalid Return Request ID format');
    }

    const validStatuses = [
      'REQUESTED',
      'APPROVED',
      'RECEIVED',
      'QC_PASSED',
      'QC_FAILED',
      'REFUNDED',
      'REPLACED',
      'REJECTED',
      'CANCELLED',
      'IN_PROGRESS',
      'RESOLVED',
    ];

    if (!validStatuses.includes(params.status)) {
      throw new BadRequestError(`Invalid return status: ${params.status}`);
    }

    const updated = await adminOrdersRepository.updateReturnStatus({
      returnRequestId,
      status: params.status,
      adminComments: params.adminComments,
      trackingNumber: params.trackingNumber,
      qcStatus: params.qcStatus,
      qcNotes: params.qcNotes,
      qcGrade: params.qcGrade,
      refundTransactionId: params.refundTransactionId,
      replacementOrderId: params.replacementOrderId,
      restockInventory: params.restockInventory,
      adminUserId: params.adminUserId,
    });

    if (!updated) {
      throw new NotFoundError('Return request not found');
    }

    return {
      success: true,
      returnRequestId: String(updated.ReturnRequestID),
      requestNumber: updated.RequestNumber,
      status: updated.Status,
      updatedAt: updated.UpdatedAt,
      message: `Return request status updated to ${updated.Status}`,
    };
  }

  /**
   * Universal streaming XLSX (Excel) export for master admin orders.
   */
  async exportOrdersXlsx(
    res: Response,
    filters: { search?: string; status?: string; startDate?: string; endDate?: string }
  ) {
    const filename = `admin_orders_${new Date().toISOString().slice(0, 10)}.xlsx`;

    const columns: XlsxColumn[] = [
      { header: 'Order Number', key: 'orderNumber', width: 22 },
      {
        header: 'Order Date',
        key: 'createdAt',
        width: 20,
        transform: (val) => (val ? new Date(val).toISOString().replace('T', ' ').slice(0, 19) : ''),
      },
      { header: 'Customer Name', key: 'customerName', width: 24 },
      { header: 'Customer Phone', key: 'customerPhone', width: 16 },
      { header: 'Customer Email', key: 'customerEmail', width: 26 },
      { header: 'Order Status', key: 'orderStatus', width: 16 },
      {
        header: 'Payment Status',
        key: 'paymentStatus',
        width: 16,
        transform: (val) => val || 'PENDING',
      },
      {
        header: 'Payment Mode',
        key: 'paymentModeName',
        width: 18,
        transform: (val) => val || 'N/A',
      },
      { header: 'Total Items', key: 'itemsCount', width: 12 },
      { header: 'Subtotal (INR)', key: 'subtotalAmount', width: 16 },
      { header: 'Tax Amount (INR)', key: 'taxAmount', width: 16 },
      { header: 'Discount (INR)', key: 'discountAmount', width: 16 },
      { header: 'Shipping Fee (INR)', key: 'shippingAmount', width: 16 },
      { header: 'Total Amount (INR)', key: 'totalAmount', width: 18 },
      {
        header: 'Shipping City',
        key: 'shippingCity',
        width: 18,
        transform: (val) => val || 'N/A',
      },
      {
        header: 'Shipping State',
        key: 'shippingState',
        width: 18,
        transform: (val) => val || 'N/A',
      },
      {
        header: 'Shipping Pincode',
        key: 'shippingPincode',
        width: 16,
        transform: (val) => val || 'N/A',
      },
    ];

    await streamXlsxExport(res, {
      filename,
      sheetName: 'Orders Master',
      columns,
      chunkSize: 500,
      fetchChunk: async (offset, limit) => {
        const page = Math.floor(offset / limit) + 1;
        const { items } = await adminOrdersRepository.getOrdersList({
          search: filters.search,
          status: filters.status,
          startDate: filters.startDate,
          endDate: filters.endDate,
          page,
          limit,
        });
        return items;
      },
    });
  }
}

export const adminOrdersService = new AdminOrdersService();

