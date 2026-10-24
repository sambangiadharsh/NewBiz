import { getPool, sql } from '../../database/db.js';

export interface BannerRecord {
  BannerID: bigint | number;
  Title: string | null;
  Description: string | null;
  ImageURL: string;
  Placement: string;
  DisplayOrder: number;
  Status: string;
  StartAt: Date | null;
  EndAt: Date | null;
  CreatedAt: Date;
  CreatedBy?: bigint | number | null;
  UpdatedAt?: Date | null;
  UpdatedBy?: bigint | number | null;
}

export interface CreateBannerData {
  title?: string | null;
  description?: string | null;
  imageUrl: string;
  placement: string;
  displayOrder: number;
  status: string;
  startAt?: Date | null;
  endAt?: Date | null;
  createdAt: Date;
  createdBy?: bigint | null;
}

export class BannersRepository {
  async list(filters: { search?: string; placement?: string; status?: string }): Promise<BannerRecord[]> {
    const pool = await getPool();
    const req = pool.request();
    const conditions: string[] = [];

    if (filters.status && filters.status !== 'ALL') {
      req.input('status', sql.VarChar(20), filters.status);
      conditions.push('Status = @status');
    }

    if (filters.placement && filters.placement !== 'ALL') {
      req.input('placement', sql.VarChar(50), filters.placement);
      conditions.push('Placement = @placement');
    }

    if (filters.search && filters.search.trim()) {
      req.input('search', sql.NVarChar(255), `%${filters.search.trim()}%`);
      conditions.push('(Title LIKE @search OR Description LIKE @search)');
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT 
        BannerID, Title, Description, ImageURL, Placement, 
        DisplayOrder, Status, StartAt, EndAt, CreatedAt, UpdatedAt
      FROM Banners
      ${whereClause}
      ORDER BY DisplayOrder ASC, CreatedAt DESC
    `;

    const result = await req.query<BannerRecord>(query);
    return result.recordset;
  }

  async findById(id: bigint): Promise<BannerRecord | null> {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('id', sql.BigInt, id)
      .query<BannerRecord>(`
        SELECT 
          BannerID, Title, Description, ImageURL, Placement, 
          DisplayOrder, Status, StartAt, EndAt, CreatedAt, UpdatedAt
        FROM Banners
        WHERE BannerID = @id
      `);

    return result.recordset[0] ?? null;
  }

  async create(data: CreateBannerData): Promise<BannerRecord> {
    const pool = await getPool();
    const req = pool
      .request()
      .input('title', sql.NVarChar(255), data.title ?? null)
      .input('description', sql.NVarChar(500), data.description ?? null)
      .input('imageUrl', sql.NVarChar(500), data.imageUrl)
      .input('placement', sql.VarChar(50), data.placement)
      .input('displayOrder', sql.Int, data.displayOrder)
      .input('status', sql.VarChar(20), data.status)
      .input('startAt', sql.DateTime2, data.startAt ?? null)
      .input('endAt', sql.DateTime2, data.endAt ?? null)
      .input('createdAt', sql.DateTime2, data.createdAt)
      .input('createdBy', sql.BigInt, data.createdBy ?? null);

    const query = `
      INSERT INTO Banners (
        Title, Description, ImageURL, Placement, DisplayOrder, 
        Status, StartAt, EndAt, CreatedAt, CreatedBy
      )
      OUTPUT Inserted.*
      VALUES (
        @title, @description, @imageUrl, @placement, @displayOrder, 
        @status, @startAt, @endAt, @createdAt, @createdBy
      )
    `;

    const result = await req.query<BannerRecord>(query);
    return result.recordset[0];
  }

  async update(id: bigint, updates: Partial<{
    Title: string | null;
    Description: string | null;
    ImageURL: string;
    Placement: string;
    DisplayOrder: number;
    Status: string;
    StartAt: Date | null;
    EndAt: Date | null;
    UpdatedAt: Date;
    UpdatedBy: bigint | null;
  }>): Promise<BannerRecord | null> {
    const pool = await getPool();
    const req = pool.request().input('id', sql.BigInt, id);

    const setClauses: string[] = [];

    if (updates.Title !== undefined) {
      req.input('title', sql.NVarChar(255), updates.Title);
      setClauses.push('Title = @title');
    }
    if (updates.Description !== undefined) {
      req.input('description', sql.NVarChar(500), updates.Description);
      setClauses.push('Description = @description');
    }
    if (updates.ImageURL !== undefined) {
      req.input('imageUrl', sql.NVarChar(500), updates.ImageURL);
      setClauses.push('ImageURL = @imageUrl');
    }
    if (updates.Placement !== undefined) {
      req.input('placement', sql.VarChar(50), updates.Placement);
      setClauses.push('Placement = @placement');
    }
    if (updates.DisplayOrder !== undefined) {
      req.input('displayOrder', sql.Int, updates.DisplayOrder);
      setClauses.push('DisplayOrder = @displayOrder');
    }
    if (updates.Status !== undefined) {
      req.input('status', sql.VarChar(20), updates.Status);
      setClauses.push('Status = @status');
    }
    if (updates.StartAt !== undefined) {
      req.input('startAt', sql.DateTime2, updates.StartAt);
      setClauses.push('StartAt = @startAt');
    }
    if (updates.EndAt !== undefined) {
      req.input('endAt', sql.DateTime2, updates.EndAt);
      setClauses.push('EndAt = @endAt');
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
      UPDATE Banners
      SET ${setClauses.join(', ')}
      WHERE BannerID = @id;

      SELECT 
        BannerID, Title, Description, ImageURL, Placement, 
        DisplayOrder, Status, StartAt, EndAt, CreatedAt, UpdatedAt
      FROM Banners
      WHERE BannerID = @id;
    `;

    const result = await req.query<BannerRecord>(query);
    return result.recordset[0] ?? null;
  }

  async delete(id: bigint): Promise<void> {
    const pool = await getPool();
    await pool
      .request()
      .input('id', sql.BigInt, id)
      .query('DELETE FROM Banners WHERE BannerID = @id');
  }

  async listPublic(placement?: string): Promise<BannerRecord[]> {
    const pool = await getPool();
    const req = pool.request();
    const now = new Date();
    req.input('now', sql.DateTime2, now);

    let query = `
      SELECT 
        BannerID, Title, Description, ImageURL, Placement, DisplayOrder
      FROM Banners
      WHERE Status = 'ACTIVE'
        AND (StartAt IS NULL OR StartAt <= @now)
        AND (EndAt IS NULL OR EndAt >= @now)
    `;

    if (placement && placement !== 'ALL') {
      req.input('placement', sql.VarChar(50), placement.toUpperCase());
      query += ' AND Placement = @placement';
    }

    query += ' ORDER BY DisplayOrder ASC, CreatedAt DESC';

    const result = await req.query<BannerRecord>(query);
    return result.recordset;
  }
}

export const bannersRepository = new BannersRepository();
