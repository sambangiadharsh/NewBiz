export type InboundShipmentStatus = 'IN_TRANSIT' | 'RECEIVED' | 'DISCREPANCY' | 'CANCELLED';

export interface CreateInboundShipmentItemInput {
  sellerProductId: number | string;
  expectedQuantity: number;
  remarks?: string;
}

export interface CreateInboundShipmentInput {
  warehouseId: number | string;
  carrierName?: string;
  trackingNumber?: string;
  boxCount?: number;
  estimatedArrivalDate?: string;
  notes?: string;
  poNumber?: string;
  poAmount?: number;
  poDocumentUrl?: string;
  supplierInvoiceNumber?: string;
  invoiceAmount?: number;
  invoiceDocumentUrl?: string;
  items: CreateInboundShipmentItemInput[];
}

export interface FinalizeGRNItemInput {
  inboundShipmentItemId: number | string;
  receivedQuantity: number;
  damagedQuantity: number;
  remarks?: string;
}

export interface FinalizeGRNInput {
  grnNotes?: string;
  grnAmount?: number;
  grnDocumentUrl?: string;
  items: FinalizeGRNItemInput[];
}

export interface InboundShipmentsFilter {
  status?: InboundShipmentStatus | string;
  warehouseId?: bigint | number | string;
  search?: string;
  page?: number;
  limit?: number;
}
