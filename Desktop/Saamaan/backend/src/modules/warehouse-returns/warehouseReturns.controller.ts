import { Request, Response } from 'express';
import { warehouseReturnsService } from './warehouseReturns.service.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { getPool, sql } from '../../database/db.js';

export class WarehouseReturnsController {
  private async getWarehouseId(req: Request): Promise<bigint> {
    const queryWarehouseId = req.query.warehouseId as string | undefined;
    if (queryWarehouseId) {
      return BigInt(queryWarehouseId);
    }

    const directWhId = (req as any).user?.warehouseId;
    if (directWhId) {
      return BigInt(directWhId);
    }

    const userId = (req as any).user?.userId;
    if (userId) {
      const pool = await getPool();
      const staffRes = await pool
        .request()
        .input('userId', sql.BigInt, userId)
        .query(`SELECT TOP 1 WarehouseID FROM dbo.WarehouseStaff WHERE UserID = @userId`);
      if (staffRes.recordset.length > 0 && staffRes.recordset[0].WarehouseID) {
        return BigInt(staffRes.recordset[0].WarehouseID);
      }
    }

    // Default fallback to first active warehouse if user is an admin viewing warehouse portal
    const pool = await getPool();
    const fallbackRes = await pool.request().query(`SELECT TOP 1 WarehouseID FROM dbo.Warehouses ORDER BY WarehouseID ASC`);
    if (fallbackRes.recordset.length > 0) {
      return BigInt(fallbackRes.recordset[0].WarehouseID);
    }

    throw new Error('No warehouse associated with the current session context');
  }

  async getReturnsList(req: Request, res: Response) {
    try {
      const warehouseId = await this.getWarehouseId(req);
      const { search, status, page, limit } = req.query;

      const result = await warehouseReturnsService.getReturnsList(warehouseId, {
        search: search as string,
        status: status as string,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 20,
      });

      return res.status(200).json({
        success: true,
        data: result.items,
        pagination: result.pagination,
        summary: result.summary,
        message: 'Warehouse returns fetched successfully',
      });
    } catch (err: any) {
      return sendError(res, 'FETCH_WAREHOUSE_RETURNS_ERROR', err.message || 'Failed to fetch returns', 500);
    }
  }

  async markReceived(req: Request, res: Response) {
    try {
      const warehouseId = await this.getWarehouseId(req);
      const { returnRequestId } = req.params;
      const { trackingNumber, receiverNotes } = req.body;

      const result = await warehouseReturnsService.markReceivedAtDock(
        warehouseId,
        returnRequestId,
        trackingNumber,
        receiverNotes
      );

      return sendSuccess(res, result, result.message);
    } catch (err: any) {
      return sendError(res, 'DOCK_RECEIVE_ERROR', err.message || 'Failed to mark return as received', 400);
    }
  }

  async submitQC(req: Request, res: Response) {
    try {
      const warehouseId = await this.getWarehouseId(req);
      const { returnRequestId } = req.params;
      const { qcDecision, qcGrade, qcNotes, warehousePhotos, restockInventory } = req.body;
      const userId = (req as any).user?.userId ? BigInt((req as any).user.userId) : undefined;

      const result = await warehouseReturnsService.submitQCInspection(warehouseId, {
        returnRequestIdStr: returnRequestId,
        qcDecision,
        qcGrade,
        qcNotes,
        warehousePhotos,
        restockInventory,
        userId,
      });

      return sendSuccess(res, result, result.message);
    } catch (err: any) {
      return sendError(res, 'QC_SUBMIT_ERROR', err.message || 'Failed to submit QC inspection', 400);
    }
  }
}

export const warehouseReturnsController = new WarehouseReturnsController();

