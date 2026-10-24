import { getPool, sql } from '../../database/db.js';

export class CatalogMetadataRepository {
  // ==========================================
  // Attributes
  // ==========================================

  async listAttributes(params: { search?: string; dataType?: string; status?: string }): Promise<any[]> {
    const pool = await getPool();
    const req = pool.request();
    const conditions: string[] = [];

    if (params.status && params.status !== 'ALL') {
      req.input('status', sql.VarChar(20), params.status);
      conditions.push('a.Status = @status');
    }

    if (params.dataType && params.dataType !== 'ALL') {
      req.input('dataType', sql.VarChar(20), params.dataType);
      conditions.push('a.DataType = @dataType');
    }

    if (params.search && params.search.trim()) {
      req.input('search', sql.NVarChar(100), `%${params.search.trim()}%`);
      conditions.push('a.AttributeName LIKE @search');
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT 
        a.AttributeID, a.AttributeName, a.DataType, a.Status, a.CreatedAt, a.UpdatedAt,
        (SELECT COUNT(1) FROM AttributeValues av WHERE av.AttributeID = a.AttributeID) AS ValuesCount,
        (SELECT COUNT(1) FROM CategoryAttributes ca WHERE ca.AttributeID = a.AttributeID) AS CategoriesCount
      FROM Attributes a
      ${whereClause}
      ORDER BY a.CreatedAt DESC
    `;

    const result = await req.query(query);
    return result.recordset;
  }

  async getAttributeById(attributeId: bigint): Promise<any | null> {
    const pool = await getPool();
    const attrRes = await pool
      .request()
      .input('id', sql.BigInt, attributeId)
      .query('SELECT * FROM Attributes WHERE AttributeID = @id');

    const attr = attrRes.recordset[0];
    if (!attr) return null;

    const valuesRes = await pool
      .request()
      .input('id', sql.BigInt, attributeId)
      .query('SELECT * FROM AttributeValues WHERE AttributeID = @id ORDER BY ValueName ASC');

    const catRes = await pool
      .request()
      .input('id', sql.BigInt, attributeId)
      .query(`
        SELECT 
          ca.CategoryAttributeID, ca.CategoryID, ca.IsRequired, ca.IsVariantDefining, 
          ca.DisplayOrder, ca.Status,
          c.CategoryName, c.CategoryCode
        FROM CategoryAttributes ca
        JOIN Categories c ON ca.CategoryID = c.CategoryID
        WHERE ca.AttributeID = @id
      `);

    return {
      ...attr,
      AttributeValues: valuesRes.recordset,
      CategoryAttributes: catRes.recordset,
    };
  }

  async findAttributeByName(name: string, excludeId?: bigint): Promise<any | null> {
    const pool = await getPool();
    const req = pool.request().input('name', sql.NVarChar(100), name.trim());
    let query = 'SELECT * FROM Attributes WHERE LOWER(AttributeName) = LOWER(@name)';
    if (excludeId !== undefined) {
      req.input('excludeId', sql.BigInt, excludeId);
      query += ' AND AttributeID != @excludeId';
    }
    const result = await req.query(query);
    return result.recordset[0] ?? null;
  }

  async createAttribute(data: {
    attributeName: string;
    dataType: string;
    status: string;
    userId: bigint;
    values?: { valueName: string; valueCode?: string }[];
  }): Promise<any> {
    const pool = await getPool();
    const res = await pool
      .request()
      .input('name', sql.NVarChar(100), data.attributeName.trim())
      .input('dataType', sql.VarChar(20), data.dataType)
      .input('status', sql.VarChar(20), data.status)
      .input('userId', sql.BigInt, data.userId)
      .input('now', sql.DateTime2, new Date())
      .query(`
        INSERT INTO Attributes (AttributeName, DataType, Status, CreatedBy, CreatedAt)
        OUTPUT Inserted.*
        VALUES (@name, @dataType, @status, @userId, @now)
      `);

    const created = res.recordset[0];

    if (data.values && data.values.length > 0) {
      for (const val of data.values) {
        const valCode = val.valueCode?.trim().toUpperCase() || val.valueName.trim().toUpperCase().replace(/[^A-Z0-9]/g, '_');
        await pool
          .request()
          .input('attrId', sql.BigInt, created.AttributeID)
          .input('vName', sql.NVarChar(100), val.valueName.trim())
          .input('vCode', sql.VarChar(50), valCode)
          .input('status', sql.VarChar(20), 'ACTIVE')
          .input('userId', sql.BigInt, data.userId)
          .input('now', sql.DateTime2, new Date())
          .query(`
            INSERT INTO AttributeValues (AttributeID, ValueName, ValueCode, Status, CreatedBy, CreatedAt)
            VALUES (@attrId, @vName, @vCode, @status, @userId, @now)
          `);
      }
    }

    return this.getAttributeById(BigInt(created.AttributeID));
  }

  async updateAttribute(userId: bigint, attributeId: bigint, updates: { attributeName?: string; dataType?: string; status?: string }): Promise<any> {
    const pool = await getPool();
    const req = pool.request().input('id', sql.BigInt, attributeId);
    const setClauses: string[] = [];

    if (updates.attributeName !== undefined) {
      req.input('name', sql.NVarChar(100), updates.attributeName.trim());
      setClauses.push('AttributeName = @name');
    }
    if (updates.dataType !== undefined) {
      req.input('dataType', sql.VarChar(20), updates.dataType);
      setClauses.push('DataType = @dataType');
    }
    if (updates.status !== undefined) {
      req.input('status', sql.VarChar(20), updates.status);
      setClauses.push('Status = @status');
    }

    req.input('userId', sql.BigInt, userId);
    req.input('now', sql.DateTime2, new Date());
    setClauses.push('UpdatedBy = @userId', 'UpdatedAt = @now');

    const query = `
      UPDATE Attributes
      SET ${setClauses.join(', ')}
      OUTPUT Inserted.*
      WHERE AttributeID = @id
    `;
    const res = await req.query(query);
    return res.recordset[0] ?? null;
  }

  // ==========================================
  // Attribute Values
  // ==========================================

  async listAttributeValues(attributeId: bigint, filters: { search?: string; status?: string }): Promise<any[]> {
    const pool = await getPool();
    const req = pool.request().input('attrId', sql.BigInt, attributeId);
    const conditions: string[] = ['av.AttributeID = @attrId'];

    if (filters.status && filters.status !== 'ALL') {
      req.input('status', sql.VarChar(20), filters.status);
      conditions.push('av.Status = @status');
    }

    if (filters.search && filters.search.trim()) {
      req.input('search', sql.NVarChar(100), `%${filters.search.trim()}%`);
      conditions.push('(av.ValueName LIKE @search OR av.ValueCode LIKE @search)');
    }

    const query = `
      SELECT av.*, 
             (SELECT COUNT(1) FROM ProductVariantAttributes pva WHERE pva.AttributeValueID = av.AttributeValueID) AS VariantUsageCount
      FROM AttributeValues av 
      WHERE ${conditions.join(' AND ')}
      ORDER BY av.ValueName ASC
    `;
    const res = await req.query(query);
    return res.recordset;
  }

  async findAttributeValueById(valId: bigint): Promise<any | null> {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('id', sql.BigInt, valId)
      .query(`
        SELECT av.*, 
               (SELECT COUNT(1) FROM ProductVariantAttributes pva WHERE pva.AttributeValueID = av.AttributeValueID) AS VariantUsageCount
        FROM AttributeValues av 
        WHERE av.AttributeValueID = @id
      `);
    return result.recordset[0] ?? null;
  }

  async findAttributeValueByName(attributeId: bigint, name: string, excludeId?: bigint): Promise<any | null> {
    const pool = await getPool();
    const req = pool
      .request()
      .input('attrId', sql.BigInt, attributeId)
      .input('name', sql.NVarChar(100), name.trim());
    let query = 'SELECT * FROM AttributeValues WHERE AttributeID = @attrId AND LOWER(ValueName) = LOWER(@name)';
    if (excludeId !== undefined) {
      req.input('excludeId', sql.BigInt, excludeId);
      query += ' AND AttributeValueID != @excludeId';
    }
    const result = await req.query(query);
    return result.recordset[0] ?? null;
  }

  async findAttributeValueByCode(attributeId: bigint, code: string, excludeId?: bigint): Promise<any | null> {
    const pool = await getPool();
    const req = pool
      .request()
      .input('attrId', sql.BigInt, attributeId)
      .input('code', sql.VarChar(50), code.trim().toUpperCase());
    let query = 'SELECT * FROM AttributeValues WHERE AttributeID = @attrId AND ValueCode = @code';
    if (excludeId !== undefined) {
      req.input('excludeId', sql.BigInt, excludeId);
      query += ' AND AttributeValueID != @excludeId';
    }
    const result = await req.query(query);
    return result.recordset[0] ?? null;
  }

  async createAttributeValue(userId: bigint, attributeId: bigint, data: { valueName: string; valueCode?: string; status?: string }): Promise<any> {
    const pool = await getPool();
    const valCode = data.valueCode?.trim().toUpperCase() || data.valueName.trim().toUpperCase().replace(/[^A-Z0-9]/g, '_');
    const result = await pool
      .request()
      .input('attrId', sql.BigInt, attributeId)
      .input('vName', sql.NVarChar(100), data.valueName.trim())
      .input('vCode', sql.VarChar(50), valCode)
      .input('status', sql.VarChar(20), data.status || 'ACTIVE')
      .input('userId', sql.BigInt, userId)
      .input('now', sql.DateTime2, new Date())
      .query(`
        INSERT INTO AttributeValues (AttributeID, ValueName, ValueCode, Status, CreatedBy, CreatedAt)
        OUTPUT Inserted.*
        VALUES (@attrId, @vName, @vCode, @status, @userId, @now)
      `);
    return result.recordset[0];
  }

  async updateAttributeValue(userId: bigint, valId: bigint, updates: { valueName?: string; valueCode?: string; status?: string }): Promise<any> {
    const pool = await getPool();
    const req = pool.request().input('id', sql.BigInt, valId);
    const setClauses: string[] = [];

    if (updates.valueName !== undefined) {
      req.input('name', sql.NVarChar(100), updates.valueName.trim());
      setClauses.push('ValueName = @name');
    }
    if (updates.valueCode !== undefined) {
      req.input('code', sql.VarChar(50), updates.valueCode.trim().toUpperCase());
      setClauses.push('ValueCode = @code');
    }
    if (updates.status !== undefined) {
      req.input('status', sql.VarChar(20), updates.status);
      setClauses.push('Status = @status');
    }

    req.input('userId', sql.BigInt, userId);
    req.input('now', sql.DateTime2, new Date());
    setClauses.push('UpdatedBy = @userId', 'UpdatedAt = @now');

    const query = `
      UPDATE AttributeValues
      SET ${setClauses.join(', ')}
      OUTPUT Inserted.*
      WHERE AttributeValueID = @id
    `;
    const result = await req.query(query);
    return result.recordset[0] ?? null;
  }

  async deleteAttributeValue(userId: bigint, valId: bigint, isUsed: boolean): Promise<string> {
    const pool = await getPool();
    if (isUsed) {
      await pool
        .request()
        .input('id', sql.BigInt, valId)
        .input('userId', sql.BigInt, userId)
        .input('now', sql.DateTime2, new Date())
        .query('UPDATE AttributeValues SET Status = \'INACTIVE\', UpdatedBy = @userId, UpdatedAt = @now WHERE AttributeValueID = @id');
      return 'DEACTIVATED';
    } else {
      await pool.request().input('id', sql.BigInt, valId).query('DELETE FROM AttributeValues WHERE AttributeValueID = @id');
      return 'DELETED';
    }
  }

  // ==========================================
  // Units of Measure (UOM)
  // ==========================================

  async listUOMs(params: { search?: string; uomType?: string; status?: string }): Promise<any[]> {
    const pool = await getPool();
    const req = pool.request();
    const conditions: string[] = [];

    if (params.status && params.status !== 'ALL') {
      req.input('status', sql.VarChar(20), params.status);
      conditions.push('Status = @status');
    }

    if (params.uomType && params.uomType !== 'ALL') {
      req.input('uomType', sql.VarChar(30), params.uomType);
      conditions.push('UOMType = @uomType');
    }

    if (params.search && params.search.trim()) {
      req.input('search', sql.NVarChar(100), `%${params.search.trim()}%`);
      conditions.push('(UOMCode LIKE @search OR UOMName LIKE @search)');
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const query = `
      SELECT * FROM UOM
      ${whereClause}
      ORDER BY UOMType ASC, UOMCode ASC
    `;
    const result = await req.query(query);
    return result.recordset;
  }

  async getUOMById(uomId: bigint): Promise<any | null> {
    const pool = await getPool();
    const result = await pool.request().input('id', sql.BigInt, uomId).query('SELECT * FROM UOM WHERE UOMID = @id');
    return result.recordset[0] ?? null;
  }

  async findUOMByCode(code: string, excludeId?: bigint): Promise<any | null> {
    const pool = await getPool();
    const req = pool.request().input('code', sql.VarChar(20), code.trim());
    let query = 'SELECT * FROM UOM WHERE UOMCode = @code';
    if (excludeId !== undefined) {
      req.input('excludeId', sql.BigInt, excludeId);
      query += ' AND UOMID != @excludeId';
    }
    const result = await req.query(query);
    return result.recordset[0] ?? null;
  }

  async createUOM(userId: bigint, data: { uomCode: string; uomName: string; uomType: string; decimalPrecision?: number; status?: string }): Promise<any> {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('code', sql.VarChar(20), data.uomCode.trim())
      .input('name', sql.NVarChar(100), data.uomName.trim())
      .input('type', sql.VarChar(30), data.uomType)
      .input('prec', sql.Int, data.decimalPrecision ?? 0)
      .input('status', sql.VarChar(20), data.status || 'ACTIVE')
      .input('userId', sql.BigInt, userId)
      .input('now', sql.DateTime2, new Date())
      .query(`
        INSERT INTO UOM (UOMCode, UOMName, UOMType, DecimalPrecision, Status, CreatedBy, CreatedAt)
        OUTPUT Inserted.*
        VALUES (@code, @name, @type, @prec, @status, @userId, @now)
      `);
    return result.recordset[0];
  }

  async updateUOM(userId: bigint, uomId: bigint, updates: { uomCode?: string; uomName?: string; uomType?: string; decimalPrecision?: number; status?: string }): Promise<any> {
    const pool = await getPool();
    const req = pool.request().input('id', sql.BigInt, uomId);
    const setClauses: string[] = [];

    if (updates.uomCode !== undefined) {
      req.input('code', sql.VarChar(20), updates.uomCode.trim());
      setClauses.push('UOMCode = @code');
    }
    if (updates.uomName !== undefined) {
      req.input('name', sql.NVarChar(100), updates.uomName.trim());
      setClauses.push('UOMName = @name');
    }
    if (updates.uomType !== undefined) {
      req.input('type', sql.VarChar(30), updates.uomType);
      setClauses.push('UOMType = @type');
    }
    if (updates.decimalPrecision !== undefined) {
      req.input('prec', sql.Int, updates.decimalPrecision);
      setClauses.push('DecimalPrecision = @prec');
    }
    if (updates.status !== undefined) {
      req.input('status', sql.VarChar(20), updates.status);
      setClauses.push('Status = @status');
    }

    req.input('userId', sql.BigInt, userId);
    req.input('now', sql.DateTime2, new Date());
    setClauses.push('UpdatedBy = @userId', 'UpdatedAt = @now');

    const query = `
      UPDATE UOM
      SET ${setClauses.join(', ')}
      OUTPUT Inserted.*
      WHERE UOMID = @id
    `;
    const result = await req.query(query);
    return result.recordset[0] ?? null;
  }
}

export const catalogMetadataRepository = new CatalogMetadataRepository();
