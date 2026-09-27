import { prisma } from '../../database/prisma.js';
import { BadRequestError, NotFoundError, ConflictError } from '../../utils/errors.js';
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
    const where: any = {};

    if (params.status && params.status !== 'ALL') {
      where.Status = params.status;
    }

    if (params.dataType && params.dataType !== 'ALL') {
      where.DataType = params.dataType;
    }

    if (params.search && params.search.trim()) {
      where.AttributeName = { contains: params.search.trim() };
    }

    const attributes = await prisma.attributes.findMany({
      where,
      orderBy: { CreatedAt: 'desc' },
      include: {
        _count: {
          select: {
            AttributeValues: true,
            CategoryAttributes: true,
          },
        },
      },
    });

    return attributes.map((attr) => ({
      attributeId: Number(attr.AttributeID),
      attributeName: attr.AttributeName,
      dataType: attr.DataType,
      status: attr.Status,
      valuesCount: attr._count.AttributeValues,
      categoriesCount: attr._count.CategoryAttributes,
      createdAt: attr.CreatedAt,
      updatedAt: attr.UpdatedAt,
    }));
  }

  async getAttributeById(attributeId: bigint) {
    const attribute = await prisma.attributes.findUnique({
      where: { AttributeID: attributeId },
      include: {
        AttributeValues: {
          orderBy: { ValueName: 'asc' },
        },
        CategoryAttributes: {
          include: {
            Categories: {
              select: { CategoryID: true, CategoryName: true, CategoryCode: true },
            },
          },
        },
      },
    });

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
      values: attribute.AttributeValues.map((v) => ({
        attributeValueId: Number(v.AttributeValueID),
        attributeId: Number(v.AttributeID),
        valueName: v.ValueName,
        valueCode: v.ValueCode,
        status: v.Status,
        createdAt: v.CreatedAt,
        updatedAt: v.UpdatedAt,
      })),
      categories: attribute.CategoryAttributes.map((ca) => ({
        categoryAttributeId: Number(ca.CategoryAttributeID),
        categoryId: Number(ca.CategoryID),
        categoryName: ca.Categories.CategoryName,
        categoryCode: ca.Categories.CategoryCode,
        isRequired: ca.IsRequired,
        isVariantDefining: ca.IsVariantDefining,
        displayOrder: ca.DisplayOrder,
      })),
    };
  }

  async createAttribute(userId: bigint, input: CreateAttributeInput) {
    const existing = await prisma.attributes.findFirst({
      where: { AttributeName: input.attributeName },
    });

    if (existing) {
      throw new ConflictError(`Attribute with name "${input.attributeName}" already exists`);
    }

    const created = await prisma.attributes.create({
      data: {
        AttributeName: input.attributeName,
        DataType: input.dataType,
        Status: input.status || 'ACTIVE',
        CreatedAt: new Date(),
        CreatedBy: userId,
      },
    });

    return {
      attributeId: Number(created.AttributeID),
      attributeName: created.AttributeName,
      dataType: created.DataType,
      status: created.Status,
      createdAt: created.CreatedAt,
    };
  }

  async updateAttribute(userId: bigint, attributeId: bigint, input: UpdateAttributeInput) {
    const attribute = await prisma.attributes.findUnique({
      where: { AttributeID: attributeId },
    });

    if (!attribute) {
      throw new NotFoundError('Attribute not found');
    }

    if (input.attributeName && input.attributeName !== attribute.AttributeName) {
      const duplicate = await prisma.attributes.findFirst({
        where: {
          AttributeName: input.attributeName,
          AttributeID: { not: attributeId },
        },
      });
      if (duplicate) {
        throw new ConflictError(`Attribute with name "${input.attributeName}" already exists`);
      }
    }

    const updated = await prisma.attributes.update({
      where: { AttributeID: attributeId },
      data: {
        ...(input.attributeName && { AttributeName: input.attributeName }),
        ...(input.dataType && { DataType: input.dataType }),
        ...(input.status && { Status: input.status }),
        UpdatedAt: new Date(),
        UpdatedBy: userId,
      },
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

  async listAttributeValues(attributeId: bigint, params: { search?: string; status?: string }) {
    const attribute = await prisma.attributes.findUnique({
      where: { AttributeID: attributeId },
    });

    if (!attribute) {
      throw new NotFoundError('Attribute not found');
    }

    const where: any = { AttributeID: attributeId };

    if (params.status && params.status !== 'ALL') {
      where.Status = params.status;
    }

    if (params.search && params.search.trim()) {
      const q = params.search.trim();
      where.OR = [
        { ValueName: { contains: q } },
        { ValueCode: { contains: q } },
      ];
    }

    const values = await prisma.attributeValues.findMany({
      where,
      orderBy: { ValueName: 'asc' },
    });

    return values.map((v) => ({
      attributeValueId: Number(v.AttributeValueID),
      attributeId: Number(v.AttributeID),
      valueName: v.ValueName,
      valueCode: v.ValueCode,
      status: v.Status,
      createdAt: v.CreatedAt,
      updatedAt: v.UpdatedAt,
    }));
  }

  async createAttributeValue(userId: bigint, attributeId: bigint, input: CreateAttributeValueInput) {
    const attribute = await prisma.attributes.findUnique({
      where: { AttributeID: attributeId },
    });

    if (!attribute) {
      throw new NotFoundError('Attribute not found');
    }

    if (attribute.DataType !== 'OPTIONS') {
      throw new BadRequestError(
        `Specification "${attribute.AttributeName}" has data type "${attribute.DataType}". Predefined option choices can only be configured for attributes with data type "OPTIONS".`
      );
    }

    // Check duplicate ValueName or ValueCode for this AttributeID
    const duplicate = await prisma.attributeValues.findFirst({
      where: {
        AttributeID: attributeId,
        OR: [
          { ValueName: input.valueName },
          { ValueCode: input.valueCode },
        ],
      },
    });

    if (duplicate) {
      if (duplicate.ValueName.toLowerCase() === input.valueName.toLowerCase()) {
        throw new ConflictError(`Option value "${input.valueName}" already exists for this attribute`);
      }
      if (duplicate.ValueCode.toUpperCase() === input.valueCode.toUpperCase()) {
        throw new ConflictError(`Option code "${input.valueCode}" is already assigned to "${duplicate.ValueName}"`);
      }
    }

    const created = await prisma.attributeValues.create({
      data: {
        AttributeID: attributeId,
        ValueName: input.valueName,
        ValueCode: input.valueCode,
        Status: input.status || 'ACTIVE',
        CreatedAt: new Date(),
        CreatedBy: userId,
      },
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

  async updateAttributeValue(userId: bigint, attributeValueId: bigint, input: UpdateAttributeValueInput) {
    const value = await prisma.attributeValues.findUnique({
      where: { AttributeValueID: attributeValueId },
    });

    if (!value) {
      throw new NotFoundError('Attribute value not found');
    }

    if (input.valueName || input.valueCode) {
      const duplicate = await prisma.attributeValues.findFirst({
        where: {
          AttributeID: value.AttributeID,
          AttributeValueID: { not: attributeValueId },
          OR: [
            ...(input.valueName ? [{ ValueName: input.valueName }] : []),
            ...(input.valueCode ? [{ ValueCode: input.valueCode }] : []),
          ],
        },
      });

      if (duplicate) {
        if (input.valueName && duplicate.ValueName.toLowerCase() === input.valueName.toLowerCase()) {
          throw new ConflictError(`Option value "${input.valueName}" already exists for this attribute`);
        }
        if (input.valueCode && duplicate.ValueCode.toUpperCase() === input.valueCode.toUpperCase()) {
          throw new ConflictError(`Option code "${input.valueCode}" is already assigned to "${duplicate.ValueName}"`);
        }
      }
    }

    const updated = await prisma.attributeValues.update({
      where: { AttributeValueID: attributeValueId },
      data: {
        ...(input.valueName && { ValueName: input.valueName }),
        ...(input.valueCode && { ValueCode: input.valueCode }),
        ...(input.status && { Status: input.status }),
        UpdatedAt: new Date(),
        UpdatedBy: userId,
      },
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
    const value = await prisma.attributeValues.findUnique({
      where: { AttributeValueID: attributeValueId },
      include: {
        ProductVariantAttributes: { take: 1 },
      },
    });

    if (!value) {
      throw new NotFoundError('Attribute value not found');
    }

    if (value.ProductVariantAttributes.length > 0) {
      // In use: soft-disable it
      await prisma.attributeValues.update({
        where: { AttributeValueID: attributeValueId },
        data: {
          Status: 'INACTIVE',
          UpdatedAt: new Date(),
          UpdatedBy: userId,
        },
      });
      return {
        success: true,
        action: 'DEACTIVATED',
        message: 'Value is associated with products; status set to INACTIVE',
      };
    }

    // Not in use: safely delete
    await prisma.attributeValues.delete({
      where: { AttributeValueID: attributeValueId },
    });

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
    const where: any = {};

    if (params.status && params.status !== 'ALL') {
      where.Status = params.status;
    }

    if (params.uomType && params.uomType !== 'ALL') {
      where.UOMType = params.uomType;
    }

    if (params.search && params.search.trim()) {
      const q = params.search.trim();
      where.OR = [
        { UOMCode: { contains: q } },
        { UOMName: { contains: q } },
      ];
    }

    const uoms = await prisma.uOM.findMany({
      where,
      orderBy: [{ UOMType: 'asc' }, { UOMCode: 'asc' }],
    });

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
    const uom = await prisma.uOM.findUnique({
      where: { UOMID: uomId },
    });

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
    const existing = await prisma.uOM.findFirst({
      where: { UOMCode: input.uomCode },
    });

    if (existing) {
      throw new ConflictError(`UOM with code "${input.uomCode}" already exists (${existing.UOMName})`);
    }

    const created = await prisma.uOM.create({
      data: {
        UOMCode: input.uomCode,
        UOMName: input.uomName,
        UOMType: input.uomType,
        DecimalPrecision: input.decimalPrecision ?? 0,
        Status: input.status || 'ACTIVE',
        CreatedAt: new Date(),
        CreatedBy: userId,
      },
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
    const uom = await prisma.uOM.findUnique({
      where: { UOMID: uomId },
    });

    if (!uom) {
      throw new NotFoundError('UOM not found');
    }

    if (input.uomCode && input.uomCode !== uom.UOMCode) {
      const duplicate = await prisma.uOM.findFirst({
        where: {
          UOMCode: input.uomCode,
          UOMID: { not: uomId },
        },
      });
      if (duplicate) {
        throw new ConflictError(`UOM with code "${input.uomCode}" already exists`);
      }
    }

    const updated = await prisma.uOM.update({
      where: { UOMID: uomId },
      data: {
        ...(input.uomCode && { UOMCode: input.uomCode }),
        ...(input.uomName && { UOMName: input.uomName }),
        ...(input.uomType && { UOMType: input.uomType }),
        ...(input.decimalPrecision !== undefined && { DecimalPrecision: input.decimalPrecision }),
        ...(input.status && { Status: input.status }),
        UpdatedAt: new Date(),
        UpdatedBy: userId,
      },
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
