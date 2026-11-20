import {
  CreateInboundShipmentInput,
  FinalizeGRNInput,
  InboundShipmentsFilter,
} from './inbound-shipments.types.js';
import { inboundShipmentsRepository } from './inbound-shipments.repository.js';
import { grnPdfService } from './grnPdf.service.js';
import { Response } from 'express';
import { streamXlsxExport, XlsxColumn } from '../../utils/xlsxExporter.js';

export class InboundShipmentsService {
  /**
   * Seller: Create Inbound Shipment
   */
  async createShipment(
    sellerId: bigint | number,
    data: CreateInboundShipmentInput,
    userId?: bigint | number
  ) {
    if (!data.warehouseId) {
      throw new Error('Please select a destination warehouse');
    }

    if (!data.carrierName || data.carrierName.trim().length === 0) {
      throw new Error('Carrier / Transporter name is required');
    }

    if (data.carrierName.trim().length > 100) {
      throw new Error('Carrier name cannot exceed 100 characters');
    }

    if (data.trackingNumber && data.trackingNumber.trim().length > 100) {
      throw new Error('Tracking number cannot exceed 100 characters');
    }

    if (data.boxCount !== undefined && data.boxCount !== null) {
      const box = Number(data.boxCount);
      if (isNaN(box) || box < 1 || !Number.isInteger(box) || box > 5000) {
        throw new Error('Carton/Box count must be an integer between 1 and 5,000');
      }
    }

    if (data.estimatedArrivalDate) {
      const eta = new Date(data.estimatedArrivalDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (isNaN(eta.getTime())) {
        throw new Error('Invalid estimated arrival date');
      }
      if (eta < today) {
        throw new Error('Estimated arrival date cannot be in the past');
      }
    }

    if (data.notes && data.notes.length > 500) {
      throw new Error('Shipment notes cannot exceed 500 characters');
    }

    if (!Array.isArray(data.items) || data.items.length === 0) {
      throw new Error('Inbound shipment must contain at least one product item');
    }

    for (const item of data.items) {
      if (!item.sellerProductId) {
        throw new Error('Valid product is required for all items');
      }
      const qty = Number(item.expectedQuantity);
      if (isNaN(qty) || qty <= 0 || !Number.isInteger(qty) || qty > 50000) {
        throw new Error('Quantity must be an integer between 1 and 50,000 units');
      }
      if (item.remarks && item.remarks.length > 250) {
        throw new Error('Item remarks cannot exceed 250 characters');
      }
    }

    return await inboundShipmentsRepository.createShipment(sellerId, data, userId);
  }

  /**
   * Seller: List Shipments
   */
  async getSellerShipments(sellerId: bigint | number, filters: InboundShipmentsFilter) {
    return await inboundShipmentsRepository.getSellerShipments(sellerId, filters);
  }

  /**
   * Seller: Get Shipment Detail
   */
  async getSellerShipmentById(sellerId: bigint | number, shipmentId: bigint | number) {
    const shipment = await inboundShipmentsRepository.getSellerShipmentById(sellerId, shipmentId);
    if (!shipment) {
      throw new Error('Inbound shipment not found');
    }
    return shipment;
  }

  /**
   * Seller: Cancel Shipment
   */
  async cancelShipment(sellerId: bigint | number, shipmentId: bigint | number, reason?: string) {
    return await inboundShipmentsRepository.cancelShipment(sellerId, shipmentId, reason);
  }

  /**
   * Warehouse: List Shipments for facility
   */
  async getWarehouseShipments(warehouseId: bigint | number, filters: InboundShipmentsFilter) {
    return await inboundShipmentsRepository.getWarehouseShipments(warehouseId, filters);
  }

  /**
   * Warehouse: Get Shipment Detail for receiving
   */
  async getWarehouseShipmentById(warehouseId: bigint | number, shipmentId: bigint | number) {
    const shipment = await inboundShipmentsRepository.getWarehouseShipmentById(warehouseId, shipmentId);
    if (!shipment) {
      throw new Error('Inbound shipment not found or not assigned to this warehouse');
    }
    return shipment;
  }

  /**
   * Warehouse: Finalize GRN & Post Stock
   */
  async receiveAndFinalizeGRN(
    warehouseId: bigint | number,
    shipmentId: bigint | number,
    input: FinalizeGRNInput,
    userId?: bigint | number
  ) {
    if (!Array.isArray(input.items) || input.items.length === 0) {
      throw new Error('GRN must include verification counts for all shipment items');
    }

    for (const item of input.items) {
      if (!item.inboundShipmentItemId) {
        throw new Error('inboundShipmentItemId is required for each received item');
      }
      const rec = Number(item.receivedQuantity);
      const dmg = Number(item.damagedQuantity);
      if (isNaN(rec) || rec < 0 || !Number.isInteger(rec)) {
        throw new Error('Received good units must be a non-negative integer');
      }
      if (isNaN(dmg) || dmg < 0 || !Number.isInteger(dmg)) {
        throw new Error('Damaged units must be a non-negative integer');
      }
      if (item.remarks && item.remarks.length > 250) {
        throw new Error('Line item remarks cannot exceed 250 characters');
      }
    }

    if (input.grnNotes && input.grnNotes.length > 500) {
      throw new Error('GRN notes cannot exceed 500 characters');
    }

    return await inboundShipmentsRepository.receiveAndFinalizeGRN(
      warehouseId,
      shipmentId,
      input,
      userId
    );
  }

  /**
   * Get Digital GRN structured details for paper/document preview (Accessible by Warehouse & Seller)
   */
  async getGrnDetails(shipmentId: bigint | number, access: { sellerId?: bigint; warehouseId?: bigint }) {
    const details = await inboundShipmentsRepository.getInboundShipmentGRNDetails(shipmentId);
    if (!details) {
      throw new Error('Inbound shipment not found');
    }

    if (access.sellerId && String(details.seller.sellerId) !== String(access.sellerId)) {
      throw new Error('Unauthorized: This shipment does not belong to your seller profile');
    }

    if (access.warehouseId && String(details.warehouse.warehouseId) !== String(access.warehouseId)) {
      throw new Error('Unauthorized: This shipment is not assigned to your warehouse facility');
    }

    return details;
  }

  /**
   * Generate & Download Official Digital GRN PDF (Accessible by Warehouse & Seller)
   */
  async getGrnPdf(shipmentId: bigint | number, access: { sellerId?: bigint; warehouseId?: bigint }) {
    const details = await inboundShipmentsRepository.getInboundShipmentGRNDetails(shipmentId);
    if (!details) {
      throw new Error('Inbound shipment not found');
    }

    if (access.sellerId && String(details.seller.sellerId) !== String(access.sellerId)) {
      throw new Error('Unauthorized: This shipment does not belong to your seller profile');
    }

    if (access.warehouseId && String(details.warehouse.warehouseId) !== String(access.warehouseId)) {
      throw new Error('Unauthorized: This shipment is not assigned to your warehouse facility');
    }

    return await grnPdfService.generateGrnPdf(BigInt(shipmentId));
  }

  /**
   * Universal streaming XLSX (Excel) export for warehouse inbound shipments.
   */
  async exportWarehouseShipmentsXlsx(
    res: Response,
    warehouseId: bigint | number,
    filters: InboundShipmentsFilter
  ) {
    const filename = `warehouse_inbound_${new Date().toISOString().slice(0, 10)}.xlsx`;

    const columns: XlsxColumn[] = [
      { header: 'Shipment Number', key: 'shipmentNumber', width: 22 },
      { header: 'GRN Number', key: 'grnNumber', width: 20, transform: (val) => val || 'Pending GRN' },
      {
        header: 'Seller Name',
        key: 'seller',
        width: 24,
        transform: (_, r: any) => r.seller?.sellerName || r.seller?.businessName || 'N/A',
      },
      {
        header: 'Seller Code',
        key: 'sellerCode',
        width: 16,
        transform: (_, r: any) => r.seller?.sellerCode || 'N/A',
      },
      { header: 'Status', key: 'status', width: 16 },
      { header: 'Box Count', key: 'boxCount', width: 12, transform: (val) => val ?? 1 },
      {
        header: 'Total Declared Units',
        key: 'totalExpectedQuantity',
        width: 18,
        transform: (_, r: any) => r.metrics?.totalExpectedQuantity ?? 0,
      },
      {
        header: 'Total Received Units',
        key: 'totalReceivedQuantity',
        width: 18,
        transform: (_, r: any) => r.metrics?.totalReceivedQuantity ?? 0,
      },
      {
        header: 'Total Accepted Units',
        key: 'totalAcceptedQuantity',
        width: 18,
        transform: (_, r: any) =>
          Math.max(0, (r.metrics?.totalReceivedQuantity ?? 0) - (r.metrics?.totalDamagedQuantity ?? 0)),
      },
      {
        header: 'Total Damaged Units',
        key: 'totalDamagedQuantity',
        width: 18,
        transform: (_, r: any) => r.metrics?.totalDamagedQuantity ?? 0,
      },
      {
        header: 'Total Shortage Units',
        key: 'totalShortageQuantity',
        width: 18,
        transform: (_, r: any) => r.metrics?.totalShortageQuantity ?? 0,
      },
      { header: 'Carrier Name', key: 'carrierName', width: 18, transform: (val) => val || 'N/A' },
      { header: 'Tracking Number', key: 'trackingNumber', width: 20, transform: (val) => val || 'N/A' },
      {
        header: 'Expected Arrival',
        key: 'estimatedArrivalDate',
        width: 18,
        transform: (val) => (val ? new Date(val).toISOString().slice(0, 10) : 'N/A'),
      },
      {
        header: 'Received Date',
        key: 'receivedAt',
        width: 20,
        transform: (val) => (val ? new Date(val).toISOString().replace('T', ' ').slice(0, 19) : 'Pending'),
      },
      {
        header: 'Created Date',
        key: 'createdAt',
        width: 20,
        transform: (val) => (val ? new Date(val).toISOString().replace('T', ' ').slice(0, 19) : ''),
      },
    ];

    await streamXlsxExport(res, {
      filename,
      sheetName: 'Inbound Shipments',
      columns,
      chunkSize: 500,
      fetchChunk: async (offset, limit) => {
        const page = Math.floor(offset / limit) + 1;
        const result = await inboundShipmentsRepository.getWarehouseShipments(warehouseId, {
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

export const inboundShipmentsService = new InboundShipmentsService();
