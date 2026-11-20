import { warehouseReturnsRepository } from './warehouseReturns.repository.js';

export class WarehouseReturnsService {
  async getReturnsList(
    warehouseId: bigint,
    params: {
      search?: string;
      status?: string;
      page?: number;
      limit?: number;
    }
  ) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(50, Math.max(1, params.limit || 20));

    const result = await warehouseReturnsRepository.getReturnsList(warehouseId, {
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

  async markReceivedAtDock(
    warehouseId: bigint,
    returnRequestIdStr: string,
    trackingNumber?: string,
    receiverNotes?: string
  ) {
    let returnRequestId: bigint;
    try {
      returnRequestId = BigInt(returnRequestIdStr);
    } catch {
      throw new Error('Invalid Return Request ID');
    }

    const updated = await warehouseReturnsRepository.markReceivedAtDock(
      warehouseId,
      returnRequestId,
      trackingNumber,
      receiverNotes
    );

    return {
      success: true,
      returnRequestId: String(updated.ReturnRequestID),
      requestNumber: updated.RequestNumber,
      status: updated.Status,
      updatedAt: updated.UpdatedAt,
      message: `Return #${updated.RequestNumber} successfully marked as Received at Warehouse Dock.`,
    };
  }

  async submitQCInspection(
    warehouseId: bigint,
    params: {
      returnRequestIdStr: string;
      qcDecision: 'PASSED' | 'FAILED';
      qcGrade: string;
      qcNotes: string;
      warehousePhotos?: string[];
      restockInventory?: boolean;
      userId?: bigint;
    }
  ) {
    let returnRequestId: bigint;
    try {
      returnRequestId = BigInt(params.returnRequestIdStr);
    } catch {
      throw new Error('Invalid Return Request ID');
    }

    if (!params.qcDecision || !['PASSED', 'FAILED'].includes(params.qcDecision)) {
      throw new Error("QC Decision must be either 'PASSED' or 'FAILED'");
    }

    if (!params.qcNotes || !params.qcNotes.trim()) {
      throw new Error('QC Inspection Notes are mandatory');
    }

    return await warehouseReturnsRepository.submitQCInspection(warehouseId, {
      returnRequestId,
      qcDecision: params.qcDecision,
      qcGrade: params.qcGrade || (params.qcDecision === 'PASSED' ? 'GRADE_A_RESTOCKABLE' : 'DAMAGED_SCRAP'),
      qcNotes: params.qcNotes.trim(),
      warehousePhotos: params.warehousePhotos,
      restockInventory: Boolean(params.restockInventory),
      userId: params.userId,
    });
  }
}

export const warehouseReturnsService = new WarehouseReturnsService();

