import { getPool, sql } from '../../database/db.js';

export interface BrandRecord {
  BrandID: bigint | number;
  BrandName: string;
  BrandCode: string | null;
  Manufacturer: string | null;
  Description: string | null;
  Status: string;
  ImageURL: string | null;
  IsFeatured: boolean;
  DisplayOrder: number;
  CreatedAt: Date;
  CreatedBy?: bigint | number | null;
  UpdatedAt?: Date | null;
  UpdatedBy?: bigint | number | null;
  ProductCount?: number;
}

export interface CreateBrandData {
  brandName: string;
  brandCode: string | null;
  manufacturer?: string | null;
  description?: string | null;
  status: string;
  imageUrl?: string | null;
  isFeatured: boolean;
  displayOrder: number;
  createdAt: Date;
  createdBy?: bigint | null;
}

export interface BrandProductRecord {
  ProductID: bigint | number;
  ParentSKU: string | null;
  ProductName: string;
  Status: string;
  IsVerified: boolean;
  CreatedAt: Date;
  VariantsCount: number;
}

export class BrandsRepository {
  async list(filters: { search?: string; status?: string; isFeatured?: boolean }): Promise<BrandRecord[]> {
    const pool = await getPool();
    const req = pool.request();
    const conditions: string[] = [];

    if (filters.status && filters.status !== 'ALL') {
      req.input('status', sql.VarChar(20), filters.status);
      conditions.push('b.Status = @status');
    }

    if (typeof filters.isFeatured === 'boolean') {
      req.input('isFeatured', sql.Bit, filters.isFeatured ? 1 : 0);
      conditions.push('b.IsFeatured = @isFeatured');
    }

    if (filters.search && filters.search.trim()) {
      req.input('search', sql.NVarChar(100), `%${filters.search.trim()}%`);
      conditions.push(
        '(b.BrandName LIKE @search OR b.BrandCode LIKE @search OR b.Manufacturer LIKE @search OR b.Description LIKE @search)'
      );
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT 
        b.BrandID, b.BrandName, b.BrandCode, b.Manufacturer, 
        b.Description, b.Status, b.ImageURL, b.IsFeatured, 
        b.DisplayOrder, b.CreatedAt, b.UpdatedAt,
        (SELECT COUNT(1) FROM ProductMaster p WHERE p.BrandID = b.BrandID) AS ProductCount
      FROM Brands b
      ${whereClause}
      ORDER BY b.IsFeatured DESC, b.DisplayOrder ASC, b.BrandName ASC
    `;

    const result = await req.query<BrandRecord>(query);
    return result.recordset;
  }

  async findById(id: bigint): Promise<BrandRecord | null> {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('id', sql.BigInt, id)
      .query<BrandRecord>(`
        SELECT 
          b.BrandID, b.BrandName, b.BrandCode, b.Manufacturer, 
          b.Description, b.Status, b.ImageURL, b.IsFeatured, 
          b.DisplayOrder, b.CreatedAt, b.UpdatedAt,
          (SELECT COUNT(1) FROM ProductMaster p WHERE p.BrandID = b.BrandID) AS ProductCount
        FROM Brands b
        WHERE b.BrandID = @id
      `);

    return result.recordset[0] ?? null;
  }

  async findByName(name: string, excludeId?: bigint): Promise<{ BrandID: bigint | number; BrandName: string } | null> {
    const pool = await getPool();
    const req = pool.request().input('name', sql.NVarChar(150), name.trim());

    let query = 'SELECT BrandID, BrandName FROM Brands WHERE BrandName = @name';
    if (excludeId !== undefined) {
      req.input('excludeId', sql.BigInt, excludeId);
      query += ' AND BrandID != @excludeId';
    }

    const result = await req.query(query);
    return result.recordset[0] ?? null;
  }

  async findByCode(code: string, excludeId?: bigint): Promise<{ BrandID: bigint | number; BrandCode: string } | null> {
    const pool = await getPool();
    const req = pool.request().input('code', sql.VarChar(50), code.trim().toUpperCase());

    let query = 'SELECT BrandID, BrandCode FROM Brands WHERE BrandCode = @code';
    if (excludeId !== undefined) {
      req.input('excludeId', sql.BigInt, excludeId);
      query += ' AND BrandID != @excludeId';
    }

    const result = await req.query(query);
    return result.recordset[0] ?? null;
  }

  async create(data: CreateBrandData): Promise<BrandRecord> {
    const pool = await getPool();
    const req = pool
      .request()
      .input('brandName', sql.NVarChar(150), data.brandName)
      .input('brandCode', sql.VarChar(50), data.brandCode)
      .input('manufacturer', sql.NVarChar(150), data.manufacturer ?? null)
      .input('description', sql.NVarChar(500), data.description ?? null)
      .input('status', sql.VarChar(20), data.status)
      .input('imageUrl', sql.NVarChar(500), data.imageUrl ?? null)
      .input('isFeatured', sql.Bit, data.isFeatured ? 1 : 0)
      .input('displayOrder', sql.Int, data.displayOrder)
      .input('createdAt', sql.DateTime2, data.createdAt)
      .input('createdBy', sql.BigInt, data.createdBy ?? null);

    const query = `
      INSERT INTO Brands (
        BrandName, BrandCode, Manufacturer, Description, 
        Status, ImageURL, IsFeatured, DisplayOrder, 
        CreatedAt, CreatedBy
      )
      OUTPUT 
        Inserted.BrandID, Inserted.BrandName, Inserted.BrandCode, 
        Inserted.Manufacturer, Inserted.Description, Inserted.Status, 
        Inserted.ImageURL, Inserted.IsFeatured, Inserted.DisplayOrder, 
        Inserted.CreatedAt, Inserted.UpdatedAt
      VALUES (
        @brandName, @brandCode, @manufacturer, @description, 
        @status, @imageUrl, @isFeatured, @displayOrder, 
        @createdAt, @createdBy
      )
    `;

    const result = await req.query<BrandRecord>(query);
    const created = result.recordset[0];
    created.ProductCount = 0;
    return created;
  }

  async update(id: bigint, updates: Partial<{
    BrandName: string;
    BrandCode: string;
    Manufacturer: string | null;
    Description: string | null;
    Status: string;
    ImageURL: string | null;
    IsFeatured: boolean;
    DisplayOrder: number;
    UpdatedAt: Date;
    UpdatedBy: bigint | null;
  }>): Promise<BrandRecord | null> {
    const pool = await getPool();
    const req = pool.request().input('id', sql.BigInt, id);

    const setClauses: string[] = [];

    if (updates.BrandName !== undefined) {
      req.input('brandName', sql.NVarChar(150), updates.BrandName);
      setClauses.push('BrandName = @brandName');
    }
    if (updates.BrandCode !== undefined) {
      req.input('brandCode', sql.VarChar(50), updates.BrandCode);
      setClauses.push('BrandCode = @brandCode');
    }
    if (updates.Manufacturer !== undefined) {
      req.input('manufacturer', sql.NVarChar(150), updates.Manufacturer);
      setClauses.push('Manufacturer = @manufacturer');
    }
    if (updates.Description !== undefined) {
      req.input('description', sql.NVarChar(500), updates.Description);
      setClauses.push('Description = @description');
    }
    if (updates.Status !== undefined) {
      req.input('status', sql.VarChar(20), updates.Status);
      setClauses.push('Status = @status');
    }
    if (updates.ImageURL !== undefined) {
      req.input('imageUrl', sql.NVarChar(500), updates.ImageURL);
      setClauses.push('ImageURL = @imageUrl');
    }
    if (updates.IsFeatured !== undefined) {
      req.input('isFeatured', sql.Bit, updates.IsFeatured ? 1 : 0);
      setClauses.push('IsFeatured = @isFeatured');
    }
    if (updates.DisplayOrder !== undefined) {
      req.input('displayOrder', sql.Int, updates.DisplayOrder);
      setClauses.push('DisplayOrder = @displayOrder');
    }
    if (updates.UpdatedAt !== undefined) {
      req.input('updatedAt', sql.DateTime2, updates.UpdatedAt);
      setClauses.push('UpdatedAt = @updatedAt');
    }
    if (updates.UpdatedBy !== undefined) {
      req.input('updatedBy', sql.BigInt, updates.UpdatedBy);
      setClauses.push('UpdatedBy = @updatedBy');
    }

    if (setClauses.length === 0) {
      return this.findById(id);
    }

    const query = `
      UPDATE Brands
      SET ${setClauses.join(', ')}
      WHERE BrandID = @id;

      SELECT 
        b.BrandID, b.BrandName, b.BrandCode, b.Manufacturer, 
        b.Description, b.Status, b.ImageURL, b.IsFeatured, 
        b.DisplayOrder, b.CreatedAt, b.UpdatedAt,
        (SELECT COUNT(1) FROM ProductMaster p WHERE p.BrandID = b.BrandID) AS ProductCount
      FROM Brands b
      WHERE b.BrandID = @id;
    `;

    const result = await req.query<BrandRecord>(query);
    return result.recordset[0] ?? null;
  }

  async delete(id: bigint): Promise<void> {
    const pool = await getPool();
    await pool
      .request()
      .input('id', sql.BigInt, id)
      .query('DELETE FROM Brands WHERE BrandID = @id');
  }

  async getBrandProducts(brandId: bigint): Promise<BrandProductRecord[]> {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('brandId', sql.BigInt, brandId)
      .query<BrandProductRecord>(`
        SELECT 
          p.ProductID, p.ParentSKU, p.ProductName, p.Status, 
          p.IsVerified, p.CreatedAt,
          (SELECT COUNT(1) FROM ProductVariants v WHERE v.ProductID = p.ProductID) AS VariantsCount
        FROM ProductMaster p
        WHERE p.BrandID = @brandId
        ORDER BY p.CreatedAt DESC
      `);

    return result.recordset;
  }
}

export const brandsRepository = new BrandsRepository();
