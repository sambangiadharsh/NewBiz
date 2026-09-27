import { Router } from 'express';
import { authenticate, requireRoles } from '../../middleware/auth.js';
import { catalogMetadataController } from './catalogMetadata.controller.js';

export const catalogMetadataRouter = Router();

// Require Super Admin or Admin role
catalogMetadataRouter.use(authenticate, requireRoles('SUPER_ADMIN', 'ADMIN'));

// ============================================================
// Attributes Routes
// ============================================================
catalogMetadataRouter.get('/attributes', (req, res, next) =>
  catalogMetadataController.listAttributes(req, res, next)
);

catalogMetadataRouter.post('/attributes', (req, res, next) =>
  catalogMetadataController.createAttribute(req, res, next)
);

catalogMetadataRouter.get('/attributes/:id', (req, res, next) =>
  catalogMetadataController.getAttributeById(req, res, next)
);

catalogMetadataRouter.put('/attributes/:id', (req, res, next) =>
  catalogMetadataController.updateAttribute(req, res, next)
);

// ============================================================
// Attribute Values Routes
// ============================================================
catalogMetadataRouter.get('/attributes/:id/values', (req, res, next) =>
  catalogMetadataController.listAttributeValues(req, res, next)
);

catalogMetadataRouter.post('/attributes/:id/values', (req, res, next) =>
  catalogMetadataController.createAttributeValue(req, res, next)
);

catalogMetadataRouter.put('/attribute-values/:valueId', (req, res, next) =>
  catalogMetadataController.updateAttributeValue(req, res, next)
);

catalogMetadataRouter.delete('/attribute-values/:valueId', (req, res, next) =>
  catalogMetadataController.deleteAttributeValue(req, res, next)
);

// ============================================================
// UOM Routes
// ============================================================
catalogMetadataRouter.get('/uom', (req, res, next) =>
  catalogMetadataController.listUOMs(req, res, next)
);

catalogMetadataRouter.post('/uom', (req, res, next) =>
  catalogMetadataController.createUOM(req, res, next)
);

catalogMetadataRouter.get('/uom/:id', (req, res, next) =>
  catalogMetadataController.getUOMById(req, res, next)
);

catalogMetadataRouter.put('/uom/:id', (req, res, next) =>
  catalogMetadataController.updateUOM(req, res, next)
);
