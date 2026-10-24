import { catalogMetadataRepository } from './catalogMetadata.repository.js';
import { NotFoundError, ConflictError } from '../../utils/errors.js';
import {
  CreateAttributeInput,
  UpdateAttributeInput,
  CreateAttributeValueInput,
  UpdateAttributeValueInput,
  CreateUOMInput,
  UpdateUOMInput,
} from './catalogMetadata.validation.js';

export class CatalogMetadataService {
  // ============================================================
  // Attributes
  // ============================================================

  async listAttributes(params: { search?: string; dataType?: string; status?: string }) {
    const attributes = await catalogMetadataRepository.listAttributes(params);

    return attributes.map((attr) => ({
      attributeId: Number(attr.AttributeID),
      attributeName: attr.AttributeName,
      dataType: attr.DataType,
      status: attr.Status,
      valuesCount: attr.ValuesCount ?? 0,
      categoriesCount: attr.CategoriesCount ?? 0,
      createdAt: attr.CreatedAt,
      updatedAt: attr.UpdatedAt,
    }));
  }

  async getAttributeById(attributeId: bigint) {
    const attribute = await catalogMetadataRepository.getAttributeById(attributeId);

    if (!attribute) {
      throw new NotFoundError('Attribute not found');
    }

    return {
      attributeId: Number(attribute.AttributeID),
      attributeName: attribute.AttributeName,
      dataType: attribute.DataType,
      status: attribute.Status,
      createdAt: attribute.CreatedAt,
      updatedAt: attribute.UpdatedAt,
      values: (attribute.AttributeValues || []).map((v: any) => ({
        attributeValueId: Number(v.AttributeValueID),
        attributeId: Number(v.AttributeID),
        valueName: v.ValueName,
        valueCode: v.ValueCode,
        status: v.Status,
        createdAt: v.CreatedAt,
        updatedAt: v.UpdatedAt,
      })),
      categories: (attribute.CategoryAttributes || []).map((ca: any) => ({
        categoryAttributeId: Number(ca.CategoryAttributeID),
        categoryId: Number(ca.CategoryID),
        categoryName: ca.CategoryName,
        categoryCode: ca.CategoryCode,
        isRequired: Boolean(ca.IsRequired),
        isVariantDefining: Boolean(ca.IsVariantDefining),
        displayOrder: ca.DisplayOrder,
        status: ca.Status,
      })),
    };
  }

  async createAttribute(userId: bigint, input: CreateAttributeInput) {
    const existing = await catalogMetadataRepository.findAttributeByName(input.attributeName);
    if (existing) {
      throw new ConflictError(`Attribute with name "${input.attributeName}" already exists`);
    }

    const created = await catalogMetadataRepository.createAttribute({
      attributeName: input.attributeName,
      dataType: input.dataType,
      status: input.status || 'ACTIVE',
      userId,
      values: input.values,
    });

    return {
      attributeId: Number(created.AttributeID),
      attributeName: created.AttributeName,
      dataType: created.DataType,
      status: created.Status,
      createdAt: created.CreatedAt,
      values: (created.AttributeValues || []).map((v: any) => ({
        attributeValueId: Number(v.AttributeValueID),
        valueName: v.ValueName,
        valueCode: v.ValueCode,
        status: v.Status,
      })),
    };
  }

  async updateAttribute(userId: bigint, attributeId: bigint, input: UpdateAttributeInput) {
    const existing = await catalogMetadataRepository.getAttributeById(attributeId);
    if (!existing) {
      throw new NotFoundError('Attribute not found');
    }

    if (input.attributeName && input.attributeName !== existing.AttributeName) {
      const duplicate = await catalogMetadataRepository.findAttributeByName(input.attributeName, attributeId);
      if (duplicate) {
        throw new ConflictError(`Attribute with name "${input.attributeName}" already exists`);
      }
    }

    const updated = await catalogMetadataRepository.updateAttribute(userId, attributeId, {
      attributeName: input.attributeName,
      dataType: input.dataType,
      status: input.status,
    });

    return {
      attributeId: Number(updated.AttributeID),
      attributeName: updated.AttributeName,
      dataType: updated.DataType,
      status: updated.Status,
      updatedAt: updated.UpdatedAt,
    };
  }

  // ============================================================
  // Attribute Values
  // ============================================================

  async listAttributeValues(attributeId: bigint, filters: { search?: string; status?: string }) {
    const attribute = await catalogMetadataRepository.getAttributeById(attributeId);
    if (!attribute) {
      throw new NotFoundError('Parent attribute not found');
    }

    const values = await catalogMetadataRepository.listAttributeValues(attributeId, filters);
    return values.map((v: any) => ({
      attributeValueId: Number(v.AttributeValueID),
      attributeId: Number(v.AttributeID),
      valueName: v.ValueName,
      valueCode: v.ValueCode,
      status: v.Status,
      createdAt: v.CreatedAt,
      variantUsageCount: v.VariantUsageCount,
    }));
  }

  async createAttributeValue(
    userId: bigint,
    attributeId: bigint,
    input: CreateAttributeValueInput
  ) {
    const attribute = await catalogMetadataRepository.getAttributeById(attributeId);
    if (!attribute) {
      throw new NotFoundError('Parent attribute not found');
    }

    const duplicateName = await catalogMetadataRepository.findAttributeValueByName(attributeId, input.valueName);
    if (duplicateName) {
      throw new ConflictError(`Value "${input.valueName}" already exists for this attribute`);
    }

    if (input.valueCode) {
      const duplicateCode = await catalogMetadataRepository.findAttributeValueByCode(attributeId, input.valueCode);
      if (duplicateCode) {
        throw new ConflictError(`Option code "${input.valueCode}" already exists for this attribute`);
      }
    }

    const created = await catalogMetadataRepository.createAttributeValue(userId, attributeId, {
      valueName: input.valueName,
      valueCode: input.valueCode,
      status: input.status || 'ACTIVE',
    });

    return {
      attributeValueId: Number(created.AttributeValueID),
      attributeId: Number(created.AttributeID),
      valueName: created.ValueName,
      valueCode: created.ValueCode,
      status: created.Status,
      createdAt: created.CreatedAt,
    };
  }

  async updateAttributeValue(
    userId: bigint,
    attributeValueId: bigint,
    input: UpdateAttributeValueInput
  ) {
    const existing = await catalogMetadataRepository.findAttributeValueById(attributeValueId);
    if (!existing) {
      throw new NotFoundError('Attribute value not found');
    }

    const attrId = BigInt(existing.AttributeID);

    if (input.valueName && input.valueName !== existing.ValueName) {
      const duplicate = await catalogMetadataRepository.findAttributeValueByName(attrId, input.valueName, attributeValueId);
      if (duplicate) {
        throw new ConflictError(`Option with name "${input.valueName}" already exists on this attribute`);
      }
    }

    if (input.valueCode && input.valueCode !== existing.ValueCode) {
      const duplicate = await catalogMetadataRepository.findAttributeValueByCode(attrId, input.valueCode, attributeValueId);
      if (duplicate) {
        throw new ConflictError(`Option code "${input.valueCode}" is already assigned to "${duplicate.ValueName}"`);
      }
    }

    const updated = await catalogMetadataRepository.updateAttributeValue(userId, attributeValueId, {
      valueName: input.valueName,
      valueCode: input.valueCode,
      status: input.status,
    });

    return {
      attributeValueId: Number(updated.AttributeValueID),
      attributeId: Number(updated.AttributeID),
      valueName: updated.ValueName,
      valueCode: updated.ValueCode,
      status: updated.Status,
      updatedAt: updated.UpdatedAt,
    };
  }

  async deleteAttributeValue(userId: bigint, attributeValueId: bigint) {
    const value = await catalogMetadataRepository.findAttributeValueById(attributeValueId);

    if (!value) {
      throw new NotFoundError('Attribute value not found');
    }

    const isUsed = (value.VariantUsageCount ?? 0) > 0;
    const action = await catalogMetadataRepository.deleteAttributeValue(userId, attributeValueId, isUsed);

    if (action === 'DEACTIVATED') {
      return {
        success: true,
        action: 'DEACTIVATED',
        message: 'Value is associated with products; status set to INACTIVE',
      };
    }

    return {
      success: true,
      action: 'DELETED',
      message: 'Attribute value removed permanently',
    };
  }

  // ============================================================
  // Units of Measure (UOM)
  // ============================================================

  async listUOMs(params: { search?: string; uomType?: string; status?: string }) {
    const uoms = await catalogMetadataRepository.listUOMs(params);

    return uoms.map((u) => ({
      uomId: Number(u.UOMID),
      uomCode: u.UOMCode,
      uomName: u.UOMName,
      uomType: u.UOMType,
      decimalPrecision: u.DecimalPrecision,
      status: u.Status,
      createdAt: u.CreatedAt,
      updatedAt: u.UpdatedAt,
    }));
  }

  async getUOMById(uomId: bigint) {
    const uom = await catalogMetadataRepository.getUOMById(uomId);

    if (!uom) {
      throw new NotFoundError('UOM not found');
    }

    return {
      uomId: Number(uom.UOMID),
      uomCode: uom.UOMCode,
      uomName: uom.UOMName,
      uomType: uom.UOMType,
      decimalPrecision: uom.DecimalPrecision,
      status: uom.Status,
      createdAt: uom.CreatedAt,
      updatedAt: uom.UpdatedAt,
    };
  }

  async createUOM(userId: bigint, input: CreateUOMInput) {
    const existing = await catalogMetadataRepository.findUOMByCode(input.uomCode);

    if (existing) {
      throw new ConflictError(`UOM with code "${input.uomCode}" already exists (${existing.UOMName})`);
    }

    const created = await catalogMetadataRepository.createUOM(userId, {
      uomCode: input.uomCode,
      uomName: input.uomName,
      uomType: input.uomType,
      decimalPrecision: input.decimalPrecision ?? 0,
      status: input.status || 'ACTIVE',
    });

    return {
      uomId: Number(created.UOMID),
      uomCode: created.UOMCode,
      uomName: created.UOMName,
      uomType: created.UOMType,
      decimalPrecision: created.DecimalPrecision,
      status: created.Status,
      createdAt: created.CreatedAt,
    };
  }

  async updateUOM(userId: bigint, uomId: bigint, input: UpdateUOMInput) {
    const uom = await catalogMetadataRepository.getUOMById(uomId);

    if (!uom) {
      throw new NotFoundError('UOM not found');
    }

    if (input.uomCode && input.uomCode !== uom.UOMCode) {
      const duplicate = await catalogMetadataRepository.findUOMByCode(input.uomCode, uomId);
      if (duplicate) {
        throw new ConflictError(`UOM with code "${input.uomCode}" already exists`);
      }
    }

    const updated = await catalogMetadataRepository.updateUOM(userId, uomId, {
      uomCode: input.uomCode,
      uomName: input.uomName,
      uomType: input.uomType,
      decimalPrecision: input.decimalPrecision,
      status: input.status,
    });

    return {
      uomId: Number(updated.UOMID),
      uomCode: updated.UOMCode,
      uomName: updated.UOMName,
      uomType: updated.UOMType,
      decimalPrecision: updated.DecimalPrecision,
      status: updated.Status,
      updatedAt: updated.UpdatedAt,
    };
  }
}

export const catalogMetadataService = new CatalogMetadataService();
