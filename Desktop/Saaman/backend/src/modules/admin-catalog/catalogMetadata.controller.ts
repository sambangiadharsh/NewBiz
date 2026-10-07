import { Request, Response, NextFunction } from 'express';
import { catalogMetadataService } from './catalogMetadata.service.js';
import {
  createAttributeSchema,
  updateAttributeSchema,
  createAttributeValueSchema,
  updateAttributeValueSchema,
  createUOMSchema,
  updateUOMSchema,
} from './catalogMetadata.validation.js';
import { sendSuccess } from '../../utils/response.js';
import { BadRequestError } from '../../utils/errors.js';

export class CatalogMetadataController {
  // ============================================================
  // Attributes
  // ============================================================

  async listAttributes(req: Request, res: Response, next: NextFunction) {
    try {
      const { search, dataType, status } = req.query;
      const list = await catalogMetadataService.listAttributes({
        search: search as string | undefined,
        dataType: dataType as string | undefined,
        status: status as string | undefined,
      });
      return sendSuccess(res, list, 'Attributes retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getAttributeById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = BigInt(req.params.id);
      const attribute = await catalogMetadataService.getAttributeById(id);
      return sendSuccess(res, attribute, 'Attribute details retrieved');
    } catch (error) {
      next(error);
    }
  }

  async createAttribute(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new BadRequestError('User not authenticated');
      const userId = BigInt(req.user.userId);
      const input = createAttributeSchema.parse(req.body);
      const created = await catalogMetadataService.createAttribute(userId, input);
      return sendSuccess(res, created, 'Attribute created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async updateAttribute(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new BadRequestError('User not authenticated');
      const userId = BigInt(req.user.userId);
      const id = BigInt(req.params.id);
      const input = updateAttributeSchema.parse(req.body);
      const updated = await catalogMetadataService.updateAttribute(userId, id, input);
      return sendSuccess(res, updated, 'Attribute updated successfully');
    } catch (error) {
      next(error);
    }
  }

  // ============================================================
  // Attribute Values
  // ============================================================

  async listAttributeValues(req: Request, res: Response, next: NextFunction) {
    try {
      const attributeId = BigInt(req.params.id);
      const { search, status } = req.query;
      const values = await catalogMetadataService.listAttributeValues(attributeId, {
        search: search as string | undefined,
        status: status as string | undefined,
      });
      return sendSuccess(res, values, 'Attribute values retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async createAttributeValue(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new BadRequestError('User not authenticated');
      const userId = BigInt(req.user.userId);
      const attributeId = BigInt(req.params.id);
      const input = createAttributeValueSchema.parse(req.body);
      const created = await catalogMetadataService.createAttributeValue(userId, attributeId, input);
      return sendSuccess(res, created, 'Option value added successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async updateAttributeValue(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new BadRequestError('User not authenticated');
      const userId = BigInt(req.user.userId);
      const valueId = BigInt(req.params.valueId);
      const input = updateAttributeValueSchema.parse(req.body);
      const updated = await catalogMetadataService.updateAttributeValue(userId, valueId, input);
      return sendSuccess(res, updated, 'Attribute value updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async deleteAttributeValue(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new BadRequestError('User not authenticated');
      const userId = BigInt(req.user.userId);
      const valueId = BigInt(req.params.valueId);
      const result = await catalogMetadataService.deleteAttributeValue(userId, valueId);
      return sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  // ============================================================
  // Units of Measure (UOM)
  // ============================================================

  async listUOMs(req: Request, res: Response, next: NextFunction) {
    try {
      const { search, uomType, status } = req.query;
      const list = await catalogMetadataService.listUOMs({
        search: search as string | undefined,
        uomType: uomType as string | undefined,
        status: status as string | undefined,
      });
      return sendSuccess(res, list, 'Units of measure retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getUOMById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = BigInt(req.params.id);
      const uom = await catalogMetadataService.getUOMById(id);
      return sendSuccess(res, uom, 'UOM details retrieved');
    } catch (error) {
      next(error);
    }
  }

  async createUOM(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new BadRequestError('User not authenticated');
      const userId = BigInt(req.user.userId);
      const input = createUOMSchema.parse(req.body);
      const created = await catalogMetadataService.createUOM(userId, input);
      return sendSuccess(res, created, 'Unit of measure created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async updateUOM(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new BadRequestError('User not authenticated');
      const userId = BigInt(req.user.userId);
      const id = BigInt(req.params.id);
      const input = updateUOMSchema.parse(req.body);
      const updated = await catalogMetadataService.updateUOM(userId, id, input);
      return sendSuccess(res, updated, 'Unit of measure updated successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const catalogMetadataController = new CatalogMetadataController();
