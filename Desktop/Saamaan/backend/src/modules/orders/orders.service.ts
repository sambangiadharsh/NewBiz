import { ordersRepository, OrderListFilters, ShipmentUpdateData } from './orders.repository.js';
import { invoicePdfService } from './invoicePdf.service.js';
import { Response } from 'express';
import { streamXlsxExport, XlsxColumn } from '../../utils/xlsxExporter.js';

export class OrdersService {
  async getSummary(sellerId: bigint | number) {
    const summary = await ordersRepository.getOrdersSummary(sellerId);
    return {
      totalOrders: Number(summary?.TotalOrders || 0),
      pendingOrders: Number(summary?.PendingOrders || 0),
      processingOrders: Number(summary?.ProcessingOrders || 0),
      shippedOrders: Number(summary?.ShippedOrders || 0),
      deliveredOrders: Number(summary?.DeliveredOrders || 0),
      cancelledOrders: Number(summary?.CancelledOrders || 0),
      totalRevenue: Number(summary?.TotalRevenue || 0),
    };
  }

  async getList(sellerId: bigint | number, filters: OrderListFilters) {
    return await ordersRepository.getOrdersList(sellerId, filters);
  }

  async getDetail(sellerId: bigint | number, sellerOrderId: bigint | number) {
    const detail = await ordersRepository.getOrderDetail(sellerId, sellerOrderId);
    if (!detail) {
      throw new Error('Order not found or you do not have permission to view it');
    }
    return detail;
  }

  async updateStatus(sellerId: bigint | number, sellerOrderId: bigint | number, newStatus: string) {
    const allowedStatuses = [
      'PENDING',
      'CONFIRMED',
      'PROCESSING',
      'PACKING',
      'READY_TO_SHIP',
      'SHIPPED',
      'DELIVERED',
      'CANCELLED',
    ];

    const upperStatus = newStatus.toUpperCase();
    if (!allowedStatuses.includes(upperStatus)) {
      throw new Error(`Invalid status: ${newStatus}. Allowed: ${allowedStatuses.join(', ')}`);
    }

    return await ordersRepository.updateOrderStatus(sellerId, sellerOrderId, upperStatus);
  }

  async dispatchShipment(
    sellerId: bigint | number,
    sellerOrderId: bigint | number,
    shipmentData: ShipmentUpdateData
  ) {
    if (!shipmentData.carrier || !shipmentData.carrier.trim()) {
      throw new Error('Carrier name is required (e.g. BlueDart, Delhivery, DTDC, FedEx)');
    }
    if (!shipmentData.trackingNumber || !shipmentData.trackingNumber.trim()) {
      throw new Error('Tracking number is required for dispatch');
    }

    return await ordersRepository.createOrUpdateShipment(sellerId, sellerOrderId, {
      ...shipmentData,
      carrier: shipmentData.carrier.trim(),
      trackingNumber: shipmentData.trackingNumber.trim(),
    });
  }

  async getInvoicePdf(sellerId: bigint | number, sellerOrderId: bigint | number) {
    return await invoicePdfService.generateInvoicePdf(sellerId, sellerOrderId);
  }

  async getReturnsList(
    sellerId: bigint,
    params: {
      search?: string;
      status?: string;
      page?: number;
      limit?: number;
    }
  ) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(50, Math.max(1, params.limit || 20));

    const result = await ordersRepository.getReturnsList(sellerId, {
      search: params.search,
      status: params.status,
      page,
      limit,
    });

    return {
      items: result.items,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
      },
      summary: result.summary,
    };
  }

  async updateReturnStatus(
    sellerId: bigint,
    params: {
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
    }
  ) {
    let returnRequestId: bigint;
    try {
      returnRequestId = BigInt(params.returnRequestIdStr);
    } catch {
      throw new Error('Invalid Return Request ID format');
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
      throw new Error(`Invalid return status: ${params.status}`);
    }

    const updated = await ordersRepository.updateReturnStatus(sellerId, {
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
    });

    if (!updated) {
      throw new Error('Return request not found or does not belong to this seller');
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
   * Universal streaming XLSX (Excel) export for seller orders.
   */
  async exportOrdersXlsx(
    res: Response,
    sellerId: bigint | number,
    filters: { status?: string; search?: string }
  ) {
    const filename = `seller_orders_${new Date().toISOString().slice(0, 10)}.xlsx`;

    const columns: XlsxColumn[] = [
      { header: 'Order Number', key: 'OrderNumber', width: 22 },
      {
        header: 'Order Date',
        key: 'OrderPlacedAt',
        width: 20,
        transform: (val) => (val ? new Date(val).toISOString().replace('T', ' ').slice(0, 19) : ''),
      },
      { header: 'Order Status', key: 'SellerOrderStatus', width: 16 },
      {
        header: 'Customer Name',
        key: 'CustomerFirstName',
        width: 24,
        transform: (_val, row: any) =>
          `${row.CustomerFirstName || ''} ${row.CustomerLastName || ''}`.trim() || 'Customer',
      },
      {
        header: 'Customer Phone',
        key: 'CustomerPhone',
        width: 16,
        transform: (val) => val || 'N/A',
      },
      {
        header: 'Customer Email',
        key: 'CustomerEmail',
        width: 26,
        transform: (val) => val || 'N/A',
      },
      { header: 'Total Quantity', key: 'TotalQuantity', width: 14 },
      { header: 'Order Total (INR)', key: 'SellerOrderAmount', width: 18 },
      {
        header: 'Carrier',
        key: 'Carrier',
        width: 16,
        transform: (val) => val || 'N/A',
      },
      {
        header: 'Tracking Number',
        key: 'TrackingNumber',
        width: 20,
        transform: (val) => val || 'N/A',
      },
      {
        header: 'Shipping Recipient',
        key: 'ShippingRecipientName',
        width: 24,
        transform: (val) => val || 'N/A',
      },
      {
        header: 'Shipping City',
        key: 'ShippingCity',
        width: 18,
        transform: (val) => val || 'N/A',
      },
      {
        header: 'Shipping State',
        key: 'ShippingState',
        width: 18,
        transform: (val) => val || 'N/A',
      },
      {
        header: 'Shipping Pincode',
        key: 'ShippingPostalCode',
        width: 16,
        transform: (val) => val || 'N/A',
      },
    ];

    await streamXlsxExport(res, {
      filename,
      sheetName: 'Seller Orders',
      columns,
      chunkSize: 500,
      fetchChunk: async (offset, limit) => {
        const page = Math.floor(offset / limit) + 1;
        const result = await ordersRepository.getOrdersList(sellerId, {
          status: filters.status,
          search: filters.search,
          page,
          limit,
        });
        return result.items || [];
      },
    });
  }
}

export const ordersService = new OrdersService();
