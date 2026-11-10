import { Request, Response } from 'express';
import { inboundShipmentsService } from './inbound-shipments.service.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { warehousesRepository } from '../warehouses/warehouses.repository.js';

export class InboundShipmentsController {
  private getSellerId(req: Request): bigint {
    const sellerId =
      (req as any).user?.sellers?.[0]?.sellerId ||
      (req as any).sellerContext?.sellerId;
    if (!sellerId) {
      throw new Error('User is not associated with an active seller profile');
    }
    return BigInt(sellerId);
  }

  private async getWarehouseId(req: Request): Promise<bigint> {
    const queryWarehouseId = req.query.warehouseId as string | undefined;
    if (queryWarehouseId) {
      return BigInt(queryWarehouseId);
    }

    const userId = (req as any).user?.userId;
    if (!userId) {
      throw new Error('User not authenticated');
    }

    const staffLink = await warehousesRepository.findWarehouseForStaff(BigInt(userId));
    if (staffLink) {
      return BigInt(staffLink.WarehouseID);
    }

    // Check if req.user has direct warehouseId
    const directWhId = (req as any).user?.warehouseId;
    if (directWhId) {
      return BigInt(directWhId);
    }

    throw new Error('User is not assigned to an active warehouse facility');
  }

  // ==========================================
  // SELLER PORTAL ENDPOINTS
  // ==========================================

  async createShipment(req: Request, res: Response) {
    try {
      const sellerId = this.getSellerId(req);
      const userId = (req as any).user?.userId;

      const result = await inboundShipmentsService.createShipment(
        sellerId,
        req.body,
        userId ? BigInt(userId) : undefined
      );

      return sendSuccess(res, result, 'Inbound shipment created successfully', 201);
    } catch (err: any) {
      return sendError(res, 'CREATE_INBOUND_ERROR', err.message || 'Failed to create inbound shipment', 400);
    }
  }

  async getSellerShipments(req: Request, res: Response) {
    try {
      const sellerId = this.getSellerId(req);
      const { status, warehouseId, search, page, limit } = req.query;

      const result = await inboundShipmentsService.getSellerShipments(sellerId, {
        status: status as string,
        warehouseId: warehouseId ? BigInt(warehouseId as string) : undefined,
        search: search as string,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 20,
      });

      return sendSuccess(res, result, 'Inbound shipments fetched successfully');
    } catch (err: any) {
      return sendError(res, 'FETCH_INBOUND_ERROR', err.message || 'Failed to fetch inbound shipments', 500);
    }
  }

  async getSellerShipmentById(req: Request, res: Response) {
    try {
      const sellerId = this.getSellerId(req);
      const shipmentId = BigInt(req.params.id);

      const shipment = await inboundShipmentsService.getSellerShipmentById(sellerId, shipmentId);
      return sendSuccess(res, shipment, 'Inbound shipment details fetched successfully');
    } catch (err: any) {
      return sendError(res, 'FETCH_SHIPMENT_ERROR', err.message || 'Failed to fetch shipment details', 404);
    }
  }

  async cancelShipment(req: Request, res: Response) {
    try {
      const sellerId = this.getSellerId(req);
      const shipmentId = BigInt(req.params.id);
      const { reason } = req.body;

      const result = await inboundShipmentsService.cancelShipment(sellerId, shipmentId, reason);
      return sendSuccess(res, result, 'Inbound shipment cancelled successfully');
    } catch (err: any) {
      return sendError(res, 'CANCEL_SHIPMENT_ERROR', err.message || 'Failed to cancel shipment', 400);
    }
  }

  async uploadDocument(req: Request, res: Response) {
    try {
      if (!req.file) {
        return sendError(res, 'NO_FILE', 'Please select a document file to upload (PDF, PNG, JPEG)', 400);
      }
      const relativeUrl = `/uploads/seller-documents/${req.file.filename}`;
      return sendSuccess(
        res,
        {
          url: relativeUrl,
          filename: req.file.originalname,
          size: req.file.size,
        },
        'Document uploaded successfully',
        201
      );
    } catch (err: any) {
      return sendError(res, 'UPLOAD_ERROR', err.message || 'Failed to upload document', 500);
    }
  }

  // ==========================================
  // WAREHOUSE PORTAL ENDPOINTS
  // ==========================================

  async getWarehouseShipments(req: Request, res: Response) {
    try {
      const warehouseId = await this.getWarehouseId(req);
      const { status, search, page, limit } = req.query;

      const result = await inboundShipmentsService.getWarehouseShipments(warehouseId, {
        status: status as string,
        search: search as string,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 20,
      });

      return sendSuccess(res, result, 'Warehouse inbound shipments fetched successfully');
    } catch (err: any) {
      return sendError(res, 'FETCH_WH_INBOUND_ERROR', err.message || 'Failed to fetch warehouse shipments', 500);
    }
  }

  async getWarehouseShipmentById(req: Request, res: Response) {
    try {
      const warehouseId = await this.getWarehouseId(req);
      const shipmentId = BigInt(req.params.id);

      const shipment = await inboundShipmentsService.getWarehouseShipmentById(warehouseId, shipmentId);
      return sendSuccess(res, shipment, 'Warehouse shipment inspection details fetched');
    } catch (err: any) {
      return sendError(res, 'FETCH_WH_SHIPMENT_ERROR', err.message || 'Failed to fetch shipment', 404);
    }
  }

  async finalizeGRN(req: Request, res: Response) {
    try {
      const warehouseId = await this.getWarehouseId(req);
      const shipmentId = BigInt(req.params.id);
      const userId = (req as any).user?.userId;

      const result = await inboundShipmentsService.receiveAndFinalizeGRN(
        warehouseId,
        shipmentId,
        req.body,
        userId ? BigInt(userId) : undefined
      );

      return sendSuccess(res, result, 'GRN finalized and inventory updated successfully', 200);
    } catch (err: any) {
      return sendError(res, 'GRN_FINALIZATION_ERROR', err.message || 'Failed to finalize GRN', 400);
    }
  }

  async getSellerGrnDetails(req: Request, res: Response) {
    try {
      const sellerId = this.getSellerId(req);
      const shipmentId = BigInt(req.params.id);

      const details = await inboundShipmentsService.getGrnDetails(shipmentId, { sellerId });
      return sendSuccess(res, details, 'GRN details fetched successfully');
    } catch (err: any) {
      return sendError(res, 'GRN_DETAILS_ERROR', err.message || 'Failed to fetch GRN details', 500);
    }
  }

  async downloadSellerGrnPdf(req: Request, res: Response) {
    try {
      const sellerId = this.getSellerId(req);
      const shipmentId = BigInt(req.params.id);

      const { buffer, grnNumber } = await inboundShipmentsService.getGrnPdf(shipmentId, { sellerId });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${grnNumber}.pdf"`);
      res.setHeader('Content-Length', buffer.length);
      return res.end(buffer);
    } catch (err: any) {
      return sendError(res, 'GRN_PDF_ERROR', err.message || 'Failed to generate GRN PDF', 500);
    }
  }

  async getWarehouseGrnDetails(req: Request, res: Response) {
    try {
      const warehouseId = await this.getWarehouseId(req);
      const shipmentId = BigInt(req.params.id);

      const details = await inboundShipmentsService.getGrnDetails(shipmentId, { warehouseId });
      return sendSuccess(res, details, 'GRN details fetched successfully');
    } catch (err: any) {
      return sendError(res, 'GRN_DETAILS_ERROR', err.message || 'Failed to fetch GRN details', 500);
    }
  }

  async downloadWarehouseGrnPdf(req: Request, res: Response) {
    try {
      const warehouseId = await this.getWarehouseId(req);
      const shipmentId = BigInt(req.params.id);

      const { buffer, grnNumber } = await inboundShipmentsService.getGrnPdf(shipmentId, { warehouseId });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${grnNumber}.pdf"`);
      res.setHeader('Content-Length', buffer.length);
      return res.end(buffer);
    } catch (err: any) {
      return sendError(res, 'GRN_PDF_ERROR', err.message || 'Failed to generate GRN PDF', 500);
    }
  }
}

export const inboundShipmentsController = new InboundShipmentsController();

