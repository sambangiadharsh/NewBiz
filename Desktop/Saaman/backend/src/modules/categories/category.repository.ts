import { getPool, sql } from '../../database/db.js';

export interface CategoryBaseRecord {
  CategoryID: bigint | number;
  ParentCategoryID: bigint | number | null;
  CategoryName: string;
  CategoryCode: string | null;
  Description: string | null;
  IconURL: string | null;
  ImageURL: string | null;
  Status: string;
}

export interface AdminCategoryRow extends CategoryBaseRecord {
  ParentCategoryName: string | null;
  ParentCategoryCode: string | null;
  ChildCount: number;
  DocumentCount: number;
  MandatoryDocumentCount: number;
  AttributeCount: number;
}

export interface AncestorCategory {
  CategoryID: bigint;
  ParentCategoryID: bigint | null;
  CategoryName: string;
  CategoryCode?: string | null;
  Depth: number;
}

export class CategoryRepository {
  async listPublicCategories(): Promise<CategoryBaseRecord[]> {
    const pool = await getPool();
    const result = await pool.request().query<CategoryBaseRecord>(`
      SELECT 
        CategoryID, ParentCategoryID, CategoryName, CategoryCode, 
        Description, IconURL, ImageURL, Status
      FROM Categories
      WHERE Status = 'ACTIVE'
      ORDER BY CategoryName ASC
    `);
    return result.recordset;
  }

  async listAdminCategories(query?: { status?: string; search?: string }): Promise<AdminCategoryRow[]> {
    const pool = await getPool();
    const req = pool.request();
    const conditions: string[] = [];

    if (query?.status && query.status !== 'ALL') {
      req.input('status', sql.VarChar(20), query.status);
      conditions.push('c.Status = @status');
    }

    if (query?.search && query.search.trim()) {
      req.input('search', sql.NVarChar(100), `%${query.search.trim()}%`);
      conditions.push('(c.CategoryName LIKE @search OR c.CategoryCode LIKE @search OR c.Description LIKE @search)');
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sqlQuery = `
      SELECT 
        c.CategoryID, c.ParentCategoryID, c.CategoryName, c.CategoryCode, 
        c.Description, c.IconURL, c.ImageURL, c.Status,
        p.CategoryName AS ParentCategoryName, p.CategoryCode AS ParentCategoryCode,
        (SELECT COUNT(1) FROM Categories ch WHERE ch.ParentCategoryID = c.CategoryID) AS ChildCount,
        (SELECT COUNT(1) FROM CategoryDocuments cd WHERE cd.CategoryID = c.CategoryID AND cd.Status = 'ACTIVE') AS DocumentCount,
        (SELECT COUNT(1) FROM CategoryDocuments cd WHERE cd.CategoryID = c.CategoryID AND cd.Status = 'ACTIVE' AND cd.IsMandatory = 1) AS MandatoryDocumentCount,
        (SELECT COUNT(1) FROM CategoryAttributes ca WHERE ca.CategoryID = c.CategoryID AND ca.Status = 'ACTIVE') AS AttributeCount
      FROM Categories c
      LEFT JOIN Categories p ON c.ParentCategoryID = p.CategoryID
      ${whereClause}
      ORDER BY c.CategoryName ASC
    `;

    const result = await req.query<AdminCategoryRow>(sqlQuery);
    return result.recordset;
  }

  async findCategoryById(categoryId: bigint): Promise<CategoryBaseRecord | null> {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('id', sql.BigInt, categoryId)
      .query<CategoryBaseRecord>('SELECT * FROM Categories WHERE CategoryID = @id');
    return result.recordset[0] ?? null;
  }

  async findCategoryByCode(code: string, excludeId?: bigint): Promise<CategoryBaseRecord | null> {
    const pool = await getPool();
    const req = pool.request().input('code', sql.VarChar(50), code.trim());
    let sqlQuery = 'SELECT * FROM Categories WHERE CategoryCode = @code';
    if (excludeId !== undefined) {
      req.input('excludeId', sql.BigInt, excludeId);
      sqlQuery += ' AND CategoryID != @excludeId';
    }
    const result = await req.query<CategoryBaseRecord>(sqlQuery);
    return result.recordset[0] ?? null;
  }

  async createCategory(data: {
    categoryName: string;
    categoryCode?: string | null;
    parentCategoryId?: bigint | null;
    description?: string | null;
    iconUrl?: string | null;
    imageUrl?: string | null;
    status: string;
    createdBy: bigint;
    createdAt: Date;
  }): Promise<CategoryBaseRecord> {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('name', sql.NVarChar(150), data.categoryName)
      .input('code', sql.VarChar(50), data.categoryCode ?? null)
      .input('parentId', sql.BigInt, data.parentCategoryId ?? null)
      .input('desc', sql.NVarChar(500), data.description ?? null)
      .input('icon', sql.NVarChar(500), data.iconUrl ?? null)
      .input('image', sql.NVarChar(500), data.imageUrl ?? null)
      .input('status', sql.VarChar(20), data.status)
      .input('createdBy', sql.BigInt, data.createdBy)
      .input('createdAt', sql.DateTime2, data.createdAt)
      .query<CategoryBaseRecord>(`
        INSERT INTO Categories (
          CategoryName, CategoryCode, ParentCategoryID, Description, 
          IconURL, ImageURL, Status, CreatedBy, CreatedAt
        )
        OUTPUT Inserted.*
        VALUES (
          @name, @code, @parentId, @desc, 
          @icon, @image, @status, @createdBy, @createdAt
        )
      `);
    return result.recordset[0];
  }

  async updateCategory(categoryId: bigint, updates: Partial<{
    CategoryName: string;
    CategoryCode: string | null;
    ParentCategoryID: bigint | null;
    Description: string | null;
    IconURL: string | null;
    ImageURL: string | null;
    Status: string;
    UpdatedBy: bigint;
    UpdatedAt: Date;
  }>): Promise<CategoryBaseRecord | null> {
    const pool = await getPool();
    const req = pool.request().input('id', sql.BigInt, categoryId);
    const setClauses: string[] = [];

    if (updates.CategoryName !== undefined) {
      req.input('name', sql.NVarChar(150), updates.CategoryName);
      setClauses.push('CategoryName = @name');
    }
    if (updates.CategoryCode !== undefined) {
      req.input('code', sql.VarChar(50), updates.CategoryCode);
      setClauses.push('CategoryCode = @code');
    }
    if (updates.ParentCategoryID !== undefined) {
      req.input('parentId', sql.BigInt, updates.ParentCategoryID);
      setClauses.push('ParentCategoryID = @parentId');
    }
    if (updates.Description !== undefined) {
      req.input('desc', sql.NVarChar(500), updates.Description);
      setClauses.push('Description = @desc');
    }
    if (updates.IconURL !== undefined) {
      req.input('icon', sql.NVarChar(500), updates.IconURL);
      setClauses.push('IconURL = @icon');
    }
    if (updates.ImageURL !== undefined) {
      req.input('image', sql.NVarChar(500), updates.ImageURL);
      setClauses.push('ImageURL = @image');
    }
    if (updates.Status !== undefined) {
      req.input('status', sql.VarChar(20), updates.Status);
      setClauses.push('Status = @status');
    }
    if (updates.UpdatedBy !== undefined) {
      req.input('updatedBy', sql.BigInt, updates.UpdatedBy);
      setClauses.push('UpdatedBy = @updatedBy');
    }
    if (updates.UpdatedAt !== undefined) {
      req.input('updatedAt', sql.DateTime2, updates.UpdatedAt);
      setClauses.push('UpdatedAt = @updatedAt');
    }

    if (setClauses.length === 0) return this.findCategoryById(categoryId);

    const query = `
      UPDATE Categories
      SET ${setClauses.join(', ')}
      OUTPUT Inserted.*
      WHERE CategoryID = @id
    `;
    const result = await req.query<CategoryBaseRecord>(query);
    return result.recordset[0] ?? null;
  }

  /**
   * Fast recursive CTE to resolve category ancestry tree in 1 query
   */
  async getCategoryAncestry(categoryId: bigint): Promise<AncestorCategory[]> {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('categoryId', sql.BigInt, categoryId)
      .query<{
        CategoryID: bigint | number;
        ParentCategoryID: bigint | number | null;
        CategoryName: string;
        CategoryCode: string | null;
        Depth: number;
      }>(`
        WITH CategoryHierarchy AS (
          SELECT CategoryID, ParentCategoryID, CategoryName, CategoryCode, 0 AS Depth
          FROM Categories
          WHERE CategoryID = @categoryId
          UNION ALL
          SELECT c.CategoryID, c.ParentCategoryID, c.CategoryName, c.CategoryCode, ch.Depth + 1
          FROM Categories c
          JOIN CategoryHierarchy ch ON c.CategoryID = ch.ParentCategoryID
        )
        SELECT * FROM CategoryHierarchy ORDER BY Depth DESC
      `);

    return result.recordset.map((r, idx) => ({
      CategoryID: BigInt(r.CategoryID),
      ParentCategoryID: r.ParentCategoryID ? BigInt(r.ParentCategoryID) : null,
      CategoryName: r.CategoryName,
      CategoryCode: r.CategoryCode,
      Depth: idx,
    }));
  }

  async getCategoryAttributesForCategories(categoryIds: bigint[]): Promise<any[]> {
    if (categoryIds.length === 0) return [];
    const pool = await getPool();
    const idList = categoryIds.map((id) => id.toString()).join(',');

    const query = `
      SELECT 
        ca.CategoryAttributeID, ca.CategoryID, ca.AttributeID, ca.IsRequired, 
        ca.IsVariantDefining, ca.DisplayOrder, ca.Status,
        c.CategoryName, c.CategoryCode,
        a.AttributeName, a.DataType,
        (
          SELECT 
            av.AttributeValueID, av.ValueName, av.ValueCode
          FROM AttributeValues av
          WHERE av.AttributeID = ca.AttributeID AND av.Status = 'ACTIVE'
          ORDER BY av.ValueName ASC
          FOR JSON PATH
        ) AS ValuesJson
      FROM CategoryAttributes ca
      JOIN Categories c ON ca.CategoryID = c.CategoryID
      JOIN Attributes a ON ca.AttributeID = a.AttributeID
      WHERE ca.CategoryID IN (${idList})
      ORDER BY ca.DisplayOrder ASC
    `;

    const result = await pool.request().query(query);
    return result.recordset.map((row) => ({
      ...row,
      AttributeValues: row.ValuesJson ? JSON.parse(row.ValuesJson) : [],
    }));
  }

  async getCategoryDocumentsForCategories(categoryIds: bigint[]): Promise<any[]> {
    if (categoryIds.length === 0) return [];
    const pool = await getPool();
    const idList = categoryIds.map((id) => id.toString()).join(',');

    const query = `
      SELECT 
        cd.CategoryDocumentID, cd.CategoryID, cd.DocumentTypeID, cd.IsMandatory, cd.Status,
        c.CategoryName, c.CategoryCode,
        dt.Code, dt.DisplayName
      FROM CategoryDocuments cd
      JOIN Categories c ON cd.CategoryID = c.CategoryID
      JOIN DocumentTypes dt ON cd.DocumentTypeID = dt.DocumentTypeID
      WHERE cd.CategoryID IN (${idList}) AND cd.Status = 'ACTIVE'
      ORDER BY cd.DocumentTypeID ASC
    `;

    const result = await pool.request().query(query);
    return result.recordset;
  }

  async listDocumentTypes(): Promise<any[]> {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT 
        dt.DocumentTypeID, dt.Code, dt.DisplayName, dt.Status,
        (SELECT COUNT(1) FROM CategoryDocuments cd WHERE cd.DocumentTypeID = dt.DocumentTypeID) AS AssignedCategoriesCount
      FROM DocumentTypes dt
      ORDER BY dt.DisplayName ASC
    `);
    return result.recordset;
  }

  async findDocumentTypeById(id: number): Promise<any | null> {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('id', sql.Int, id)
      .query('SELECT * FROM DocumentTypes WHERE DocumentTypeID = @id');
    return result.recordset[0] ?? null;
  }

  async findDocumentTypeByCode(code: string): Promise<any | null> {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('code', sql.VarChar(50), code.trim().toUpperCase())
      .query('SELECT * FROM DocumentTypes WHERE Code = @code');
    return result.recordset[0] ?? null;
  }

  async createDocumentType(data: { code: string; displayName: string; status: string }): Promise<any> {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('code', sql.VarChar(50), data.code.trim().toUpperCase())
      .input('displayName', sql.NVarChar(150), data.displayName.trim())
      .input('status', sql.VarChar(20), data.status)
      .query(`
        INSERT INTO DocumentTypes (Code, DisplayName, Status)
        OUTPUT Inserted.*
        VALUES (@code, @displayName, @status)
      `);
    return result.recordset[0];
  }

  async upsertCategoryDocument(data: {
    categoryId: bigint;
    documentTypeId: number;
    isMandatory: boolean;
    status: string;
    userId: bigint;
  }): Promise<any> {
    const pool = await getPool();
    const check = await pool
      .request()
      .input('catId', sql.BigInt, data.categoryId)
      .input('docId', sql.Int, data.documentTypeId)
      .query('SELECT CategoryDocumentID FROM CategoryDocuments WHERE CategoryID = @catId AND DocumentTypeID = @docId');

    if (check.recordset.length > 0) {
      const result = await pool
        .request()
        .input('catId', sql.BigInt, data.categoryId)
        .input('docId', sql.Int, data.documentTypeId)
        .input('isMandatory', sql.Bit, data.isMandatory ? 1 : 0)
        .input('status', sql.VarChar(20), data.status)
        .input('userId', sql.BigInt, data.userId)
        .input('now', sql.DateTime2, new Date())
        .query(`
          UPDATE CategoryDocuments
          SET IsMandatory = @isMandatory, Status = @status, UpdatedBy = @userId, UpdatedAt = @now
          WHERE CategoryID = @catId AND DocumentTypeID = @docId;

          SELECT cd.*, dt.Code, dt.DisplayName
          FROM CategoryDocuments cd
          JOIN DocumentTypes dt ON cd.DocumentTypeID = dt.DocumentTypeID
          WHERE cd.CategoryID = @catId AND cd.DocumentTypeID = @docId;
        `);
      return result.recordset[0];
    } else {
      const result = await pool
        .request()
        .input('catId', sql.BigInt, data.categoryId)
        .input('docId', sql.Int, data.documentTypeId)
        .input('isMandatory', sql.Bit, data.isMandatory ? 1 : 0)
        .input('status', sql.VarChar(20), data.status)
        .input('userId', sql.BigInt, data.userId)
        .input('now', sql.DateTime2, new Date())
        .query(`
          INSERT INTO CategoryDocuments (CategoryID, DocumentTypeID, IsMandatory, Status, CreatedBy, CreatedAt)
          VALUES (@catId, @docId, @isMandatory, @status, @userId, @now);

          SELECT cd.*, dt.Code, dt.DisplayName
          FROM CategoryDocuments cd
          JOIN DocumentTypes dt ON cd.DocumentTypeID = dt.DocumentTypeID
          WHERE cd.CategoryID = @catId AND cd.DocumentTypeID = @docId;
        `);
      return result.recordset[0];
    }
  }

  async removeCategoryDocument(categoryId: bigint, documentTypeId: number): Promise<boolean> {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('catId', sql.BigInt, categoryId)
      .input('docId', sql.Int, documentTypeId)
      .query('DELETE FROM CategoryDocuments WHERE CategoryID = @catId AND DocumentTypeID = @docId');
    return (result.rowsAffected[0] ?? 0) > 0;
  }

  async findAttributeById(attributeId: bigint): Promise<any | null> {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('id', sql.BigInt, attributeId)
      .query('SELECT * FROM Attributes WHERE AttributeID = @id');
    return result.recordset[0] ?? null;
  }

  async upsertCategoryAttribute(data: {
    categoryId: bigint;
    attributeId: bigint;
    isRequired: boolean;
    isVariantDefining: boolean;
    displayOrder: number;
    status: string;
    userId: bigint;
  }): Promise<any> {
    const pool = await getPool();
    const check = await pool
      .request()
      .input('catId', sql.BigInt, data.categoryId)
      .input('attrId', sql.BigInt, data.attributeId)
      .query('SELECT CategoryAttributeID FROM CategoryAttributes WHERE CategoryID = @catId AND AttributeID = @attrId');

    if (check.recordset.length > 0) {
      const result = await pool
        .request()
        .input('catId', sql.BigInt, data.categoryId)
        .input('attrId', sql.BigInt, data.attributeId)
        .input('isRequired', sql.Bit, data.isRequired ? 1 : 0)
        .input('isVariantDefining', sql.Bit, data.isVariantDefining ? 1 : 0)
        .input('displayOrder', sql.Int, data.displayOrder)
        .input('status', sql.VarChar(20), data.status)
        .input('userId', sql.BigInt, data.userId)
        .input('now', sql.DateTime2, new Date())
        .query(`
          UPDATE CategoryAttributes
          SET IsRequired = @isRequired, IsVariantDefining = @isVariantDefining, 
              DisplayOrder = @displayOrder, Status = @status, UpdatedBy = @userId, UpdatedAt = @now
          WHERE CategoryID = @catId AND AttributeID = @attrId;

          SELECT ca.*, a.AttributeName, a.DataType
          FROM CategoryAttributes ca
          JOIN Attributes a ON ca.AttributeID = a.AttributeID
          WHERE ca.CategoryID = @catId AND ca.AttributeID = @attrId;
        `);
      return result.recordset[0];
    } else {
      const result = await pool
        .request()
        .input('catId', sql.BigInt, data.categoryId)
        .input('attrId', sql.BigInt, data.attributeId)
        .input('isRequired', sql.Bit, data.isRequired ? 1 : 0)
        .input('isVariantDefining', sql.Bit, data.isVariantDefining ? 1 : 0)
        .input('displayOrder', sql.Int, data.displayOrder)
        .input('status', sql.VarChar(20), data.status)
        .input('userId', sql.BigInt, data.userId)
        .input('now', sql.DateTime2, new Date())
        .query(`
          INSERT INTO CategoryAttributes (
            CategoryID, AttributeID, IsRequired, IsVariantDefining, DisplayOrder, Status, CreatedBy, CreatedAt
          )
          VALUES (@catId, @attrId, @isRequired, @isVariantDefining, @displayOrder, @status, @userId, @now);

          SELECT ca.*, a.AttributeName, a.DataType
          FROM CategoryAttributes ca
          JOIN Attributes a ON ca.AttributeID = a.AttributeID
          WHERE ca.CategoryID = @catId AND ca.AttributeID = @attrId;
        `);
      return result.recordset[0];
    }
  }

  async removeCategoryAttribute(categoryId: bigint, attributeId: bigint): Promise<boolean> {
    const pool = await getPool();
    // Soft-delete to INACTIVE to adhere to SQL Server user permissions and support reversible exclusion
    const result = await pool
      .request()
      .input('catId', sql.BigInt, categoryId)
      .input('attrId', sql.BigInt, attributeId)
      .query(`
        UPDATE CategoryAttributes
        SET Status = 'INACTIVE', UpdatedAt = GETDATE()
        WHERE CategoryID = @catId AND AttributeID = @attrId;
      `);
    return (result.rowsAffected[0] ?? 0) > 0;
  }

  async restoreCategoryAttribute(categoryId: bigint, attributeId: bigint): Promise<boolean> {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('catId', sql.BigInt, categoryId)
      .input('attrId', sql.BigInt, attributeId)
      .query(`
        UPDATE CategoryAttributes
        SET Status = 'ACTIVE', UpdatedAt = GETDATE()
        WHERE CategoryID = @catId AND AttributeID = @attrId;
      `);
    return (result.rowsAffected[0] ?? 0) > 0;
  }
}

export const categoryRepository = new CategoryRepository();
