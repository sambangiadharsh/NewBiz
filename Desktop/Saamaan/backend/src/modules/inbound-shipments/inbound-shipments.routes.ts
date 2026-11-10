import { Router } from 'express';
import { inboundShipmentsController } from './inbound-shipments.controller.js';
import { authenticate, requireAnyPermission } from '../../middleware/auth.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import { documentUpload } from '../../services/storage/StorageService.js';

// ==========================================
// SELLER INBOUND SHIPMENTS ROUTER
// ==========================================
export const sellerInboundShipmentsRouter = Router();

sellerInboundShipmentsRouter.use(
  authenticate,
  requireAnyPermission(PERMISSIONS.INVENTORY_READ, PERMISSIONS.INVENTORY_MANAGE)
);

sellerInboundShipmentsRouter.post('/', (req, res) => inboundShipmentsController.createShipment(req, res));
sellerInboundShipmentsRouter.post(
  '/upload-document',
  documentUpload.single('file'),
  (req, res) => inboundShipmentsController.uploadDocument(req, res)
);
sellerInboundShipmentsRouter.get('/', (req, res) => inboundShipmentsController.getSellerShipments(req, res));
sellerInboundShipmentsRouter.get('/:id', (req, res) => inboundShipmentsController.getSellerShipmentById(req, res));
sellerInboundShipmentsRouter.get('/:id/grn', (req, res) => inboundShipmentsController.getSellerGrnDetails(req, res));
sellerInboundShipmentsRouter.get('/:id/grn/pdf', (req, res) => inboundShipmentsController.downloadSellerGrnPdf(req, res));
sellerInboundShipmentsRouter.post('/:id/cancel', (req, res) => inboundShipmentsController.cancelShipment(req, res));

// ==========================================
// WAREHOUSE INBOUND SHIPMENTS ROUTER
// ==========================================
export const warehouseInboundShipmentsRouter = Router();

warehouseInboundShipmentsRouter.use(
  authenticate,
  requireAnyPermission(PERMISSIONS.WAREHOUSES_READ, PERMISSIONS.FULFILLMENTS_MANAGE, PERMISSIONS.INVENTORY_MANAGE)
);

warehouseInboundShipmentsRouter.post(
  '/upload-document',
  documentUpload.single('file'),
  (req, res) => inboundShipmentsController.uploadDocument(req, res)
);
warehouseInboundShipmentsRouter.get('/', (req, res) => inboundShipmentsController.getWarehouseShipments(req, res));
warehouseInboundShipmentsRouter.get('/:id', (req, res) => inboundShipmentsController.getWarehouseShipmentById(req, res));
warehouseInboundShipmentsRouter.get('/:id/grn', (req, res) => inboundShipmentsController.getWarehouseGrnDetails(req, res));
warehouseInboundShipmentsRouter.get('/:id/grn/pdf', (req, res) => inboundShipmentsController.downloadWarehouseGrnPdf(req, res));
warehouseInboundShipmentsRouter.post('/:id/receive', (req, res) => inboundShipmentsController.finalizeGRN(req, res));

