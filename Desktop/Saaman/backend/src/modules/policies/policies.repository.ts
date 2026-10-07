import { getPool, sql } from '../../database/db.js';

export interface ReturnPolicyRecord {
  PolicyID: number;
  PolicyCode: string;
  PolicyName: string;
  IsReturnable: boolean;
  IsReplaceable: boolean;
  ReturnWindowDays: number;
  ReplacementWindowDays: number;
  RequiresTechnicianCheck: boolean;
  ConditionsSummary: string | null;
  TermsAndConditions: string | null;
  Status: string;
  CreatedAt: Date;
  CreatedBy?: bigint | number | null;
  UpdatedAt?: Date | null;
  UpdatedBy?: bigint | number | null;
  CategoriesCount?: number;
  ProductsCount?: number;
}

export interface WarrantyPolicyRecord {
  WarrantyPolicyID: number;
  PolicyCode: string;
  PolicyName: string;
  WarrantyType: 'BRAND' | 'SELLER' | 'NONE';
  DurationMonths: number;
  ServiceType: 'CARRY_IN' | 'ON_SITE' | 'PICKUP_DROP' | 'NONE';
  CoveredSummary: string | null;
  NotCoveredSummary: string | null;
  TermsAndConditions: string | null;
  Status: string;
  CreatedAt: Date;
  CreatedBy?: bigint | number | null;
  UpdatedAt?: Date | null;
  UpdatedBy?: bigint | number | null;
  CategoriesCount?: number;
  ProductsCount?: number;
}

export class PoliciesRepository {
  // ==========================================
  // RETURN POLICIES
  // ==========================================

  async listReturnPolicies(filter?: { status?: string; search?: string }): Promise<ReturnPolicyRecord[]> {
    const pool = await getPool();
    const req = pool.request();
    const conditions: string[] = [];

    if (filter?.status && filter.status !== 'ALL') {
      req.input('status', sql.VarChar(20), filter.status);
      conditions.push('r.Status = @status');
    }

    if (filter?.search && filter.search.trim()) {
      req.input('search', sql.NVarChar(100), `%${filter.search.trim()}%`);
      conditions.push('(r.PolicyCode LIKE @search OR r.PolicyName LIKE @search)');
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT 
        r.PolicyID, r.PolicyCode, r.PolicyName, r.IsReturnable, r.IsReplaceable,
        r.ReturnWindowDays, r.ReplacementWindowDays, r.RequiresTechnicianCheck,
        r.ConditionsSummary, r.TermsAndConditions, r.Status, r.CreatedAt, r.UpdatedAt,
        (SELECT COUNT(1) FROM Categories c WHERE c.DefaultReturnPolicyID = r.PolicyID) AS CategoriesCount,
        (SELECT COUNT(1) FROM ProductMaster p WHERE p.ReturnPolicyID = r.PolicyID) AS ProductsCount
      FROM ReturnReplacementPolicies r
      ${whereClause}
      ORDER BY r.PolicyID ASC
    `;

    const result = await req.query<ReturnPolicyRecord>(query);
    return result.recordset;
  }

  async findReturnPolicyById(id: number): Promise<ReturnPolicyRecord | null> {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('id', sql.Int, id)
      .query<ReturnPolicyRecord>(`
        SELECT 
          r.PolicyID, r.PolicyCode, r.PolicyName, r.IsReturnable, r.IsReplaceable,
          r.ReturnWindowDays, r.ReplacementWindowDays, r.RequiresTechnicianCheck,
          r.ConditionsSummary, r.TermsAndConditions, r.Status, r.CreatedAt, r.UpdatedAt,
          (SELECT COUNT(1) FROM Categories c WHERE c.DefaultReturnPolicyID = r.PolicyID) AS CategoriesCount,
          (SELECT COUNT(1) FROM ProductMaster p WHERE p.ReturnPolicyID = r.PolicyID) AS ProductsCount
        FROM ReturnReplacementPolicies r
        WHERE r.PolicyID = @id
      `);

    return result.recordset[0] ?? null;
  }

  async findReturnPolicyByCode(code: string): Promise<ReturnPolicyRecord | null> {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('code', sql.VarChar(50), code.trim().toUpperCase())
      .query<ReturnPolicyRecord>(`
        SELECT PolicyID, PolicyCode, PolicyName, Status
        FROM ReturnReplacementPolicies
        WHERE PolicyCode = @code
      `);

    return result.recordset[0] ?? null;
  }

  async createReturnPolicy(data: {
    policyCode: string;
    policyName: string;
    isReturnable: boolean;
    isReplaceable: boolean;
    returnWindowDays: number;
    replacementWindowDays: number;
    requiresTechnicianCheck: boolean;
    conditionsSummary?: string | null;
    termsAndConditions?: string | null;
    status: string;
    createdAt: Date;
    createdBy?: bigint | null;
  }): Promise<ReturnPolicyRecord> {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('policyCode', sql.VarChar(50), data.policyCode)
      .input('policyName', sql.NVarChar(150), data.policyName)
      .input('isReturnable', sql.Bit, data.isReturnable ? 1 : 0)
      .input('isReplaceable', sql.Bit, data.isReplaceable ? 1 : 0)
      .input('returnWindowDays', sql.Int, data.returnWindowDays)
      .input('replacementWindowDays', sql.Int, data.replacementWindowDays)
      .input('requiresTechnicianCheck', sql.Bit, data.requiresTechnicianCheck ? 1 : 0)
      .input('conditionsSummary', sql.NVarChar(500), data.conditionsSummary ?? null)
      .input('termsAndConditions', sql.NVarChar(sql.MAX), data.termsAndConditions ?? null)
      .input('status', sql.VarChar(20), data.status)
      .input('createdAt', sql.DateTime2, data.createdAt)
      .input('createdBy', sql.BigInt, data.createdBy ?? null)
      .query<ReturnPolicyRecord>(`
        INSERT INTO ReturnReplacementPolicies (
          PolicyCode, PolicyName, IsReturnable, IsReplaceable,
          ReturnWindowDays, ReplacementWindowDays, RequiresTechnicianCheck,
          ConditionsSummary, TermsAndConditions, Status, CreatedAt, CreatedBy
        )
        OUTPUT Inserted.*
        VALUES (
          @policyCode, @policyName, @isReturnable, @isReplaceable,
          @returnWindowDays, @replacementWindowDays, @requiresTechnicianCheck,
          @conditionsSummary, @termsAndConditions, @status, @createdAt, @createdBy
        )
      `);

    return result.recordset[0];
  }

  async updateReturnPolicy(id: number, updates: Partial<{
    PolicyName: string;
    IsReturnable: boolean;
    IsReplaceable: boolean;
    ReturnWindowDays: number;
    ReplacementWindowDays: number;
    RequiresTechnicianCheck: boolean;
    ConditionsSummary: string | null;
    TermsAndConditions: string | null;
    Status: string;
    UpdatedAt: Date;
    UpdatedBy: bigint | null;
  }>): Promise<ReturnPolicyRecord | null> {
    const pool = await getPool();
    const req = pool.request().input('id', sql.Int, id);

    const setClauses: string[] = [];

    if (updates.PolicyName !== undefined) {
      req.input('policyName', sql.NVarChar(150), updates.PolicyName);
      setClauses.push('PolicyName = @policyName');
    }
    if (updates.IsReturnable !== undefined) {
      req.input('isReturnable', sql.Bit, updates.IsReturnable ? 1 : 0);
      setClauses.push('IsReturnable = @isReturnable');
    }
    if (updates.IsReplaceable !== undefined) {
      req.input('isReplaceable', sql.Bit, updates.IsReplaceable ? 1 : 0);
      setClauses.push('IsReplaceable = @isReplaceable');
    }
    if (updates.ReturnWindowDays !== undefined) {
      req.input('returnWindowDays', sql.Int, updates.ReturnWindowDays);
      setClauses.push('ReturnWindowDays = @returnWindowDays');
    }
    if (updates.ReplacementWindowDays !== undefined) {
      req.input('replacementWindowDays', sql.Int, updates.ReplacementWindowDays);
      setClauses.push('ReplacementWindowDays = @replacementWindowDays');
    }
    if (updates.RequiresTechnicianCheck !== undefined) {
      req.input('requiresTechnicianCheck', sql.Bit, updates.RequiresTechnicianCheck ? 1 : 0);
      setClauses.push('RequiresTechnicianCheck = @requiresTechnicianCheck');
    }
    if (updates.ConditionsSummary !== undefined) {
      req.input('conditionsSummary', sql.NVarChar(500), updates.ConditionsSummary);
      setClauses.push('ConditionsSummary = @conditionsSummary');
    }
    if (updates.TermsAndConditions !== undefined) {
      req.input('termsAndConditions', sql.NVarChar(sql.MAX), updates.TermsAndConditions);
      setClauses.push('TermsAndConditions = @termsAndConditions');
    }
    if (updates.Status !== undefined) {
      req.input('status', sql.VarChar(20), updates.Status);
      setClauses.push('Status = @status');
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
      return this.findReturnPolicyById(id);
    }

    const query = `
      UPDATE ReturnReplacementPolicies
      SET ${setClauses.join(', ')}
      OUTPUT Inserted.*
      WHERE PolicyID = @id
    `;

    const result = await req.query<ReturnPolicyRecord>(query);
    return result.recordset[0] ?? null;
  }

  // ==========================================
  // WARRANTY POLICIES
  // ==========================================

  async listWarrantyPolicies(filter?: { status?: string; search?: string }): Promise<WarrantyPolicyRecord[]> {
    const pool = await getPool();
    const req = pool.request();
    const conditions: string[] = [];

    if (filter?.status && filter.status !== 'ALL') {
      req.input('status', sql.VarChar(20), filter.status);
      conditions.push('w.Status = @status');
    }

    if (filter?.search && filter.search.trim()) {
      req.input('search', sql.NVarChar(100), `%${filter.search.trim()}%`);
      conditions.push('(w.PolicyCode LIKE @search OR w.PolicyName LIKE @search)');
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT 
        w.WarrantyPolicyID, w.PolicyCode, w.PolicyName, w.WarrantyType,
        w.DurationMonths, w.ServiceType, w.CoveredSummary, w.NotCoveredSummary,
        w.TermsAndConditions, w.Status, w.CreatedAt, w.UpdatedAt,
        (SELECT COUNT(1) FROM Categories c WHERE c.DefaultWarrantyPolicyID = w.WarrantyPolicyID) AS CategoriesCount,
        (SELECT COUNT(1) FROM ProductMaster p WHERE p.WarrantyPolicyID = w.WarrantyPolicyID) AS ProductsCount
      FROM WarrantyPolicies w
      ${whereClause}
      ORDER BY w.WarrantyPolicyID ASC
    `;

    const result = await req.query<WarrantyPolicyRecord>(query);
    return result.recordset;
  }

  async findWarrantyPolicyById(id: number): Promise<WarrantyPolicyRecord | null> {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('id', sql.Int, id)
      .query<WarrantyPolicyRecord>(`
        SELECT 
          w.WarrantyPolicyID, w.PolicyCode, w.PolicyName, w.WarrantyType,
          w.DurationMonths, w.ServiceType, w.CoveredSummary, w.NotCoveredSummary,
          w.TermsAndConditions, w.Status, w.CreatedAt, w.UpdatedAt,
          (SELECT COUNT(1) FROM Categories c WHERE c.DefaultWarrantyPolicyID = w.WarrantyPolicyID) AS CategoriesCount,
          (SELECT COUNT(1) FROM ProductMaster p WHERE p.WarrantyPolicyID = w.WarrantyPolicyID) AS ProductsCount
        FROM WarrantyPolicies w
        WHERE w.WarrantyPolicyID = @id
      `);

    return result.recordset[0] ?? null;
  }

  async findWarrantyPolicyByCode(code: string): Promise<WarrantyPolicyRecord | null> {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('code', sql.VarChar(50), code.trim().toUpperCase())
      .query<WarrantyPolicyRecord>(`
        SELECT WarrantyPolicyID, PolicyCode, PolicyName, Status
        FROM WarrantyPolicies
        WHERE PolicyCode = @code
      `);

    return result.recordset[0] ?? null;
  }

  async createWarrantyPolicy(data: {
    policyCode: string;
    policyName: string;
    warrantyType: 'BRAND' | 'SELLER' | 'NONE';
    durationMonths: number;
    serviceType: 'CARRY_IN' | 'ON_SITE' | 'PICKUP_DROP' | 'NONE';
    coveredSummary?: string | null;
    notCoveredSummary?: string | null;
    termsAndConditions?: string | null;
    status: string;
    createdAt: Date;
    createdBy?: bigint | null;
  }): Promise<WarrantyPolicyRecord> {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('policyCode', sql.VarChar(50), data.policyCode)
      .input('policyName', sql.NVarChar(150), data.policyName)
      .input('warrantyType', sql.VarChar(20), data.warrantyType)
      .input('durationMonths', sql.Int, data.durationMonths)
      .input('serviceType', sql.VarChar(20), data.serviceType)
      .input('coveredSummary', sql.NVarChar(500), data.coveredSummary ?? null)
      .input('notCoveredSummary', sql.NVarChar(500), data.notCoveredSummary ?? null)
      .input('termsAndConditions', sql.NVarChar(sql.MAX), data.termsAndConditions ?? null)
      .input('status', sql.VarChar(20), data.status)
      .input('createdAt', sql.DateTime2, data.createdAt)
      .input('createdBy', sql.BigInt, data.createdBy ?? null)
      .query<WarrantyPolicyRecord>(`
        INSERT INTO WarrantyPolicies (
          PolicyCode, PolicyName, WarrantyType, DurationMonths,
          ServiceType, CoveredSummary, NotCoveredSummary,
          TermsAndConditions, Status, CreatedAt, CreatedBy
        )
        OUTPUT Inserted.*
        VALUES (
          @policyCode, @policyName, @warrantyType, @durationMonths,
          @serviceType, @coveredSummary, @notCoveredSummary,
          @termsAndConditions, @status, @createdAt, @createdBy
        )
      `);

    return result.recordset[0];
  }

  async updateWarrantyPolicy(id: number, updates: Partial<{
    PolicyName: string;
    WarrantyType: 'BRAND' | 'SELLER' | 'NONE';
    DurationMonths: number;
    ServiceType: 'CARRY_IN' | 'ON_SITE' | 'PICKUP_DROP' | 'NONE';
    CoveredSummary: string | null;
    NotCoveredSummary: string | null;
    TermsAndConditions: string | null;
    Status: string;
    UpdatedAt: Date;
    UpdatedBy: bigint | null;
  }>): Promise<WarrantyPolicyRecord | null> {
    const pool = await getPool();
    const req = pool.request().input('id', sql.Int, id);

    const setClauses: string[] = [];

    if (updates.PolicyName !== undefined) {
      req.input('policyName', sql.NVarChar(150), updates.PolicyName);
      setClauses.push('PolicyName = @policyName');
    }
    if (updates.WarrantyType !== undefined) {
      req.input('warrantyType', sql.VarChar(20), updates.WarrantyType);
      setClauses.push('WarrantyType = @warrantyType');
    }
    if (updates.DurationMonths !== undefined) {
      req.input('durationMonths', sql.Int, updates.DurationMonths);
      setClauses.push('DurationMonths = @durationMonths');
    }
    if (updates.ServiceType !== undefined) {
      req.input('serviceType', sql.VarChar(20), updates.ServiceType);
      setClauses.push('ServiceType = @serviceType');
    }
    if (updates.CoveredSummary !== undefined) {
      req.input('coveredSummary', sql.NVarChar(500), updates.CoveredSummary);
      setClauses.push('CoveredSummary = @coveredSummary');
    }
    if (updates.NotCoveredSummary !== undefined) {
      req.input('notCoveredSummary', sql.NVarChar(500), updates.NotCoveredSummary);
      setClauses.push('NotCoveredSummary = @notCoveredSummary');
    }
    if (updates.TermsAndConditions !== undefined) {
      req.input('termsAndConditions', sql.NVarChar(sql.MAX), updates.TermsAndConditions);
      setClauses.push('TermsAndConditions = @termsAndConditions');
    }
    if (updates.Status !== undefined) {
      req.input('status', sql.VarChar(20), updates.Status);
      setClauses.push('Status = @status');
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
      return this.findWarrantyPolicyById(id);
    }

    const query = `
      UPDATE WarrantyPolicies
      SET ${setClauses.join(', ')}
      OUTPUT Inserted.*
      WHERE WarrantyPolicyID = @id
    `;

    const result = await req.query<WarrantyPolicyRecord>(query);
    return result.recordset[0] ?? null;
  }
}

export const policiesRepository = new PoliciesRepository();
