import { Request, Response } from 'express';
import { inventoryService } from './inventory.service.js';
import { sendSuccess, sendError } from '../../utils/response.js';

export class InventoryController {
  private getSellerId(req: Request): bigint {
    const sellerId = (req as any).user?.sellers?.[0]?.sellerId || (req as any).sellerContext?.sellerId;
    if (!sellerId) {
      throw new Error('User is not associated with an active seller profile');
    }
    return BigInt(sellerId);
  }

  async getSummary(req: Request, res: Response) {
    try {
      const sellerId = this.getSellerId(req);
      const summary = await inventoryService.getSummary(sellerId);
      return sendSuccess(res, summary, 'Inventory summary fetched successfully');
    } catch (err: any) {
      return sendError(res, 'FETCH_SUMMARY_ERROR', err.message || 'Failed to fetch inventory summary', 500);
    }
  }

  async getGrid(req: Request, res: Response) {
    try {
      const sellerId = this.getSellerId(req);

      const { warehouseId, stockStatus, search, page, limit } = req.query;

      const grid = await inventoryService.getGrid(sellerId, {
        warehouseId: warehouseId ? BigInt(warehouseId as string) : undefined,
        stockStatus: stockStatus as any,
        search: search as string,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 20,
      });

      return sendSuccess(res, grid, 'Inventory stock grid fetched successfully');
    } catch (err: any) {
      return sendError(res, 'FETCH_GRID_ERROR', err.message || 'Failed to fetch inventory grid', 500);
    }
  }

  async createInboundNotice(req: Request, res: Response) {
    try {
      const sellerId = this.getSellerId(req);
      const userId = (req as any).user?.userId;

      const {
        warehouseProductId,
        sellerProductId,
        warehouseId,
        quantity,
        reason,
        poNumber,
        poAmount,
        poDocumentUrl,
        grnNumber,
        grnAmount,
        grnDocumentUrl,
        supplierInvoiceNumber,
        invoiceAmount,
        invoiceDocumentUrl,
      } = req.body;

      const result = await inventoryService.createInboundNotice(
        sellerId,
        {
          warehouseProductId: warehouseProductId ? BigInt(warehouseProductId) : undefined,
          sellerProductId: sellerProductId ? BigInt(sellerProductId) : undefined,
          warehouseId: warehouseId ? BigInt(warehouseId) : undefined,
          quantity: parseInt(quantity, 10),
          reason,
          poNumber,
          poAmount: poAmount ? parseFloat(poAmount) : undefined,
          poDocumentUrl,
          grnNumber,
          grnAmount: grnAmount ? parseFloat(grnAmount) : undefined,
          grnDocumentUrl,
          supplierInvoiceNumber,
          invoiceAmount: invoiceAmount ? parseFloat(invoiceAmount) : undefined,
          invoiceDocumentUrl,
        },
        userId ? BigInt(userId) : undefined
      );

      return sendSuccess(res, result, 'Inbound stock notice created and inventory updated successfully', 201);
    } catch (err: any) {
      return sendError(res, 'INBOUND_NOTICE_ERROR', err.message || 'Failed to create inbound stock notice', 400);
    }
  }

  async getLedger(req: Request, res: Response) {
    try {
      const sellerId = this.getSellerId(req);

      const { warehouseId, productId, transactionType, page, limit } = req.query;

      const ledger = await inventoryService.getLedger(sellerId, {
        warehouseId: warehouseId ? BigInt(warehouseId as string) : undefined,
        productId: productId ? BigInt(productId as string) : undefined,
        transactionType: transactionType as string,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 25,
      });

      return sendSuccess(res, ledger, 'Inventory movement ledger fetched successfully');
    } catch (err: any) {
      return sendError(res, 'FETCH_LEDGER_ERROR', err.message || 'Failed to fetch inventory ledger', 500);
    }
  }

  async getAlerts(req: Request, res: Response) {
    try {
      const sellerId = this.getSellerId(req);

      const alerts = await inventoryService.getAlerts(sellerId);
      return sendSuccess(res, alerts, 'Restock alerts fetched successfully');
    } catch (err: any) {
      return sendError(res, 'FETCH_ALERTS_ERROR', err.message || 'Failed to fetch restock alerts', 500);
    }
  }

  async updateSafetyStock(req: Request, res: Response) {
    try {
      const sellerId = this.getSellerId(req);
      const userId = (req as any).user?.userId;
      const { inventoryId } = req.params;
      const { safetyStockQuantity } = req.body;

      const result = await inventoryService.updateSafetyStock(
        sellerId,
        BigInt(inventoryId),
        parseInt(safetyStockQuantity, 10),
        userId ? BigInt(userId) : undefined
      );

      return sendSuccess(res, result, 'Safety stock threshold updated successfully');
    } catch (err: any) {
      return sendError(res, 'UPDATE_SAFETY_STOCK_ERROR', err.message || 'Failed to update safety stock', 400);
    }
  }
}

export const inventoryController = new InventoryController();
