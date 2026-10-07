import { ordersRepository, OrderListFilters, ShipmentUpdateData } from './orders.repository.js';

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
}

export const ordersService = new OrdersService();
