import { getPool, sql } from '../../database/db.js';

export interface UserRefreshTokenRecord {
  TokenID: bigint | number;
  UserID: bigint | number;
  TokenHash: string;
  ExpiresAt: Date;
  RevokedAt: Date | null;
  ReplacedByTokenID: bigint | number | null;
  CreatedByIP: string | null;
  UserAgent: string | null;
  CreatedAt: Date;
  UpdatedAt: Date | null;
}

export interface CustomerRefreshTokenRecord {
  TokenID: bigint | number;
  CustomerID: bigint | number;
  TokenHash: string;
  ExpiresAt: Date;
  RevokedAt: Date | null;
  ReplacedByTokenID: bigint | number | null;
  CreatedByIP: string | null;
  UserAgent: string | null;
  CreatedAt: Date;
  UpdatedAt: Date | null;
}

export class RefreshTokenRepository {
  // =========================================================================
  // 1. STAFF / USER REFRESH TOKENS (dbo.UserRefreshTokens)
  // =========================================================================

  async createUserRefreshToken(params: {
    userId: bigint;
    tokenHash: string;
    expiresAt: Date;
    ip?: string;
    userAgent?: string;
  }): Promise<bigint> {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('userId', sql.BigInt, params.userId)
      .input('tokenHash', sql.NVarChar(255), params.tokenHash)
      .input('expiresAt', sql.DateTime2, params.expiresAt)
      .input('ip', sql.VarChar(45), params.ip || null)
      .input('userAgent', sql.NVarChar(500), params.userAgent || null)
      .query<{ TokenID: bigint }>(`
        INSERT INTO dbo.UserRefreshTokens (
          UserID, TokenHash, ExpiresAt, CreatedByIP, UserAgent, CreatedAt
        )
        OUTPUT INSERTED.TokenID
        VALUES (
          @userId, @tokenHash, @expiresAt, @ip, @userAgent, SYSUTCDATETIME()
        );
      `);

    return result.recordset[0].TokenID;
  }

  async findUserTokenByHash(tokenHash: string): Promise<UserRefreshTokenRecord | null> {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('tokenHash', sql.NVarChar(255), tokenHash)
      .query<UserRefreshTokenRecord>(`
        SELECT TOP 1 *
        FROM dbo.UserRefreshTokens
        WHERE TokenHash = @tokenHash;
      `);

    return result.recordset[0] || null;
  }

  async findUserTokenById(tokenId: bigint): Promise<UserRefreshTokenRecord | null> {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('tokenId', sql.BigInt, tokenId)
      .query<UserRefreshTokenRecord>(`
        SELECT TOP 1 *
        FROM dbo.UserRefreshTokens
        WHERE TokenID = @tokenId;
      `);

    return result.recordset[0] || null;
  }

  async revokeUserToken(tokenId: bigint, replacedByTokenId?: bigint): Promise<void> {
    const pool = await getPool();
    await pool
      .request()
      .input('tokenId', sql.BigInt, tokenId)
      .input('replacedById', sql.BigInt, replacedByTokenId || null)
      .query(`
        UPDATE dbo.UserRefreshTokens
        SET RevokedAt = SYSUTCDATETIME(),
            ReplacedByTokenID = @replacedById,
            UpdatedAt = SYSUTCDATETIME()
        WHERE TokenID = @tokenId AND RevokedAt IS NULL;
      `);
  }

  async revokeAllUserTokens(userId: bigint): Promise<void> {
    const pool = await getPool();
    await pool
      .request()
      .input('userId', sql.BigInt, userId)
      .query(`
        UPDATE dbo.UserRefreshTokens
        SET RevokedAt = SYSUTCDATETIME(),
            UpdatedAt = SYSUTCDATETIME()
        WHERE UserID = @userId AND RevokedAt IS NULL;
      `);
  }

  // =========================================================================
  // 2. CUSTOMER REFRESH TOKENS (dbo.CustomerRefreshTokens)
  // =========================================================================

  async createCustomerRefreshToken(params: {
    customerId: bigint;
    tokenHash: string;
    expiresAt: Date;
    ip?: string;
    userAgent?: string;
  }): Promise<bigint> {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('customerId', sql.BigInt, params.customerId)
      .input('tokenHash', sql.NVarChar(255), params.tokenHash)
      .input('expiresAt', sql.DateTime2, params.expiresAt)
      .input('ip', sql.VarChar(45), params.ip || null)
      .input('userAgent', sql.NVarChar(500), params.userAgent || null)
      .query<{ TokenID: bigint }>(`
        INSERT INTO dbo.CustomerRefreshTokens (
          CustomerID, TokenHash, ExpiresAt, CreatedByIP, UserAgent, CreatedAt
        )
        OUTPUT INSERTED.TokenID
        VALUES (
          @customerId, @tokenHash, @expiresAt, @ip, @userAgent, SYSUTCDATETIME()
        );
      `);

    return result.recordset[0].TokenID;
  }

  async findCustomerTokenByHash(tokenHash: string): Promise<CustomerRefreshTokenRecord | null> {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('tokenHash', sql.NVarChar(255), tokenHash)
      .query<CustomerRefreshTokenRecord>(`
        SELECT TOP 1 *
        FROM dbo.CustomerRefreshTokens
        WHERE TokenHash = @tokenHash;
      `);

    return result.recordset[0] || null;
  }

  async findCustomerTokenById(tokenId: bigint): Promise<CustomerRefreshTokenRecord | null> {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('tokenId', sql.BigInt, tokenId)
      .query<CustomerRefreshTokenRecord>(`
        SELECT TOP 1 *
        FROM dbo.CustomerRefreshTokens
        WHERE TokenID = @tokenId;
      `);

    return result.recordset[0] || null;
  }

  async revokeCustomerToken(tokenId: bigint, replacedByTokenId?: bigint): Promise<void> {
    const pool = await getPool();
    await pool
      .request()
      .input('tokenId', sql.BigInt, tokenId)
      .input('replacedById', sql.BigInt, replacedByTokenId || null)
      .query(`
        UPDATE dbo.CustomerRefreshTokens
        SET RevokedAt = SYSUTCDATETIME(),
            ReplacedByTokenID = @replacedById,
            UpdatedAt = SYSUTCDATETIME()
        WHERE TokenID = @tokenId AND RevokedAt IS NULL;
      `);
  }

  async revokeAllCustomerTokens(customerId: bigint): Promise<void> {
    const pool = await getPool();
    await pool
      .request()
      .input('customerId', sql.BigInt, customerId)
      .query(`
        UPDATE dbo.CustomerRefreshTokens
        SET RevokedAt = SYSUTCDATETIME(),
            UpdatedAt = SYSUTCDATETIME()
        WHERE CustomerID = @customerId AND RevokedAt IS NULL;
      `);
  }
}

export const refreshTokenRepository = new RefreshTokenRepository();
