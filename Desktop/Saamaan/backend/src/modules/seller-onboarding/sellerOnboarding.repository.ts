import { getPool, sql } from '../../database/db.js';

export interface RawSellerRecord {
  SellerID: string | bigint;
  SellerCode: string;
  SellerName: string;
  BusinessName: string;
  Email: string;
  PhoneNumber: string | null;
  InstagramURL: string | null;
  FacebookURL: string | null;
  YouTubeURL: string | null;
  LinkedInURL: string | null;
  Status: string;
  CreatedAt: Date;
  UpdatedAt: Date | null;
}

export interface RawBaselineRequirement {
  DocumentTypeID: number;
  IsRequired: boolean;
  Code: string;
  DisplayName: string;
}

export interface RawApplicationWithDetails {
  SellerApplicationID: string | bigint;
  SellerID: string | bigint;
  CategoryID: string | bigint;
  CategoryName: string;
  CategoryCode: string;
  Status: string;
  SubmittedAt: Date | null;
  ReviewedAt: Date | null;
  RejectionReason: string | null;
  CreatedAt: Date;
  DocumentsJson: string | null;
}

export interface RawStatusHistoryRecord {
  SellerStatusHistoryID: string | bigint;
  Status: string;
  Comments: string | null;
  CreatedAt: Date;
  FirstName: string | null;
  LastName: string | null;
}

export interface RawConsentRecord {
  SellerConsentID: string | bigint;
  ConsentType: string;
  IsGranted: boolean;
  GrantedAt: Date;
}

export class SellerOnboardingRepository {
  /**
   * Resolve the seller entity linked to a user.
   */
  async getSellerForUser(userId: bigint): Promise<RawSellerRecord | null> {
    const pool = await getPool();
    const result = await pool.request()
      .input('userId', sql.BigInt, userId)
      .query<RawSellerRecord>(`
        SELECT TOP 1 s.*
        FROM dbo.SellerUsers su
        JOIN dbo.Sellers s ON su.SellerID = s.SellerID
        WHERE su.UserID = @userId
      `);

    return result.recordset[0] || null;
  }

  /**
   * Get active baseline document requirements for sellers.
   */
  async getBaselineRequirements(): Promise<RawBaselineRequirement[]> {
    const pool = await getPool();
    const result = await pool.request().query<RawBaselineRequirement>(`
      SELECT 
        sdr.DocumentTypeID,
        sdr.IsRequired,
        dt.Code,
        dt.DisplayName
      FROM dbo.SellerDocumentRequirements sdr
      JOIN dbo.DocumentTypes dt ON sdr.DocumentTypeID = dt.DocumentTypeID
      WHERE sdr.IsActive = 1
    `);

    return result.recordset;
  }

  /**
   * Get all onboarding and category applications for a seller.
   */
  async getAllSellerApplications(sellerId: bigint): Promise<RawApplicationWithDetails[]> {
    const pool = await getPool();
    const result = await pool.request()
      .input('sellerId', sql.BigInt, sellerId)
      .query<RawApplicationWithDetails>(`
        SELECT 
          sa.SellerApplicationID,
          sa.SellerID,
          sa.CategoryID,
          c.CategoryName,
          c.CategoryCode,
          sa.Status,
          sa.SubmittedAt,
          sa.ReviewedAt,
          sa.RejectionReason,
          sa.CreatedAt,
          (
            SELECT 
              sad.SellerApplicationDocumentID,
              sad.DocumentTypeID,
              sad.CertificateNumber,
              sad.DocumentURL,
              sad.VerificationStatus,
              sad.RejectionReason,
              sad.IsMandatory,
              dt.Code,
              dt.DisplayName
            FROM dbo.SellerApplicationDocuments sad
            JOIN dbo.DocumentTypes dt ON sad.DocumentTypeID = dt.DocumentTypeID
            WHERE sad.SellerApplicationID = sa.SellerApplicationID
            FOR JSON PATH
          ) AS DocumentsJson
        FROM dbo.SellerApplications sa
        JOIN dbo.Categories c ON sa.CategoryID = c.CategoryID
        WHERE sa.SellerID = @sellerId
        ORDER BY sa.CreatedAt DESC
      `);

    return result.recordset;
  }

  /**
   * Get consents granted by seller.
   */
  async getSellerConsents(sellerId: bigint): Promise<RawConsentRecord[]> {
    const pool = await getPool();
    const result = await pool.request()
      .input('sellerId', sql.BigInt, sellerId)
      .query<RawConsentRecord>(`
        SELECT SellerConsentID, ConsentType, IsGranted, GrantedAt
        FROM dbo.SellerConsents
        WHERE SellerID = @sellerId
      `);

    return result.recordset;
  }

  /**
   * Get status history audit records for seller.
   */
  async getSellerStatusHistory(sellerId: bigint): Promise<RawStatusHistoryRecord[]> {
    const pool = await getPool();
    const result = await pool.request()
      .input('sellerId', sql.BigInt, sellerId)
      .query<RawStatusHistoryRecord>(`
        SELECT 
          ssh.SellerStatusHistoryID,
          ssh.Status,
          ssh.Comments,
          ssh.CreatedAt,
          u.FirstName,
          u.LastName
        FROM dbo.SellerStatusHistory ssh
        LEFT JOIN dbo.Users u ON ssh.ChangedBy = u.UserID
        WHERE ssh.SellerID = @sellerId
        ORDER BY ssh.CreatedAt DESC
      `);

    return result.recordset;
  }

  /**
   * Create seller entity and link to user within transaction.
   */
  async createSellerWithUser(
    data: {
      sellerCode: string;
      sellerName: string;
      businessName: string;
      email: string;
      phoneNumber: string;
      instagramUrl?: string | null;
      facebookUrl?: string | null;
      youtubeUrl?: string | null;
      linkedinUrl?: string | null;
      userId: bigint;
    },
    tx: sql.Transaction
  ): Promise<RawSellerRecord> {
    const req = new sql.Request(tx);
    const sellerRes = await req
      .input('sellerCode', sql.NVarChar(50), data.sellerCode)
      .input('sellerName', sql.NVarChar(150), data.sellerName)
      .input('businessName', sql.NVarChar(200), data.businessName)
      .input('email', sql.NVarChar(150), data.email)
      .input('phoneNumber', sql.NVarChar(30), data.phoneNumber)
      .input('instagramUrl', sql.NVarChar(255), data.instagramUrl || null)
      .input('facebookUrl', sql.NVarChar(255), data.facebookUrl || null)
      .input('youtubeUrl', sql.NVarChar(255), data.youtubeUrl || null)
      .input('linkedinUrl', sql.NVarChar(255), data.linkedinUrl || null)
      .input('userId', sql.BigInt, data.userId)
      .query<RawSellerRecord>(`
        INSERT INTO dbo.Sellers (
          SellerCode, SellerName, BusinessName, Email, PhoneNumber,
          InstagramURL, FacebookURL, YouTubeURL, LinkedInURL, Status, CreatedAt, CreatedBy
        )
        OUTPUT INSERTED.*
        VALUES (
          @sellerCode, @sellerName, @businessName, @email, @phoneNumber,
          @instagramUrl, @facebookUrl, @youtubeUrl, @linkedinUrl, 'DRAFT', GETDATE(), @userId
        )
      `);

    const createdSeller = sellerRes.recordset[0];

    const linkReq = new sql.Request(tx);
    await linkReq
      .input('sellerId', sql.BigInt, createdSeller.SellerID)
      .input('userId', sql.BigInt, data.userId)
      .query(`
        INSERT INTO dbo.SellerUsers (SellerID, UserID, Status, CreatedAt, CreatedBy)
        VALUES (@sellerId, @userId, 'ACTIVE', GETDATE(), @userId)
      `);

    return createdSeller;
  }

  /**
   * Update existing seller profile.
   */
  async updateSellerProfile(
    sellerId: bigint,
    userId: bigint,
    data: {
      sellerName: string;
      businessName: string;
      email: string;
      phoneNumber: string;
      instagramUrl?: string | null;
      facebookUrl?: string | null;
      youtubeUrl?: string | null;
      linkedinUrl?: string | null;
    }
  ): Promise<RawSellerRecord> {
    const pool = await getPool();
    const result = await pool.request()
      .input('sellerId', sql.BigInt, sellerId)
      .input('sellerName', sql.NVarChar(150), data.sellerName)
      .input('businessName', sql.NVarChar(200), data.businessName)
      .input('email', sql.NVarChar(150), data.email)
      .input('phoneNumber', sql.NVarChar(30), data.phoneNumber)
      .input('instagramUrl', sql.NVarChar(255), data.instagramUrl || null)
      .input('facebookUrl', sql.NVarChar(255), data.facebookUrl || null)
      .input('youtubeUrl', sql.NVarChar(255), data.youtubeUrl || null)
      .input('linkedinUrl', sql.NVarChar(255), data.linkedinUrl || null)
      .input('userId', sql.BigInt, userId)
      .query<RawSellerRecord>(`
        UPDATE dbo.Sellers
        SET SellerName = @sellerName,
            BusinessName = @businessName,
            Email = @email,
            PhoneNumber = @phoneNumber,
            InstagramURL = @instagramUrl,
            FacebookURL = @facebookUrl,
            YouTubeURL = @youtubeUrl,
            LinkedInURL = @linkedinUrl,
            UpdatedAt = GETDATE(),
            UpdatedBy = @userId
        OUTPUT INSERTED.*
        WHERE SellerID = @sellerId
      `);

    return result.recordset[0];
  }

  /**
   * Find category by ID.
   */
  async findCategoryById(categoryId: bigint) {
    const pool = await getPool();
    const result = await pool.request()
      .input('categoryId', sql.BigInt, categoryId)
      .query<{ CategoryID: string | bigint; CategoryName: string }>(`
        SELECT CategoryID, CategoryName
        FROM dbo.Categories
        WHERE CategoryID = @categoryId
      `);

    return result.recordset[0] || null;
  }

  /**
   * Find application for a specific category.
   */
  async findApplicationBySellerAndCategory(sellerId: bigint, categoryId: bigint) {
    const pool = await getPool();
    const result = await pool.request()
      .input('sellerId', sql.BigInt, sellerId)
      .input('categoryId', sql.BigInt, categoryId)
      .query<{ SellerApplicationID: string | bigint; CategoryID: string | bigint; Status: string }>(`
        SELECT TOP 1 SellerApplicationID, CategoryID, Status
        FROM dbo.SellerApplications
        WHERE SellerID = @sellerId AND CategoryID = @categoryId
      `);

    return result.recordset[0] || null;
  }

  /**
   * Find mutable (DRAFT or REJECTED) application to reuse.
   */
  async findMutableApplication(sellerId: bigint) {
    const pool = await getPool();
    const result = await pool.request()
      .input('sellerId', sql.BigInt, sellerId)
      .query<{
        SellerApplicationID: string | bigint;
        CategoryID: string | bigint;
        Status: string;
        RejectionReason: string | null;
      }>(`
        SELECT TOP 1 SellerApplicationID, CategoryID, Status, RejectionReason
        FROM dbo.SellerApplications
        WHERE SellerID = @sellerId AND Status IN ('DRAFT', 'REJECTED')
        ORDER BY CreatedAt DESC
      `);

    return result.recordset[0] || null;
  }

  /**
   * Update category of an existing application.
   */
  async updateApplicationCategory(applicationId: bigint, categoryId: bigint, rejectionReason?: string | null) {
    const pool = await getPool();
    const result = await pool.request()
      .input('appId', sql.BigInt, applicationId)
      .input('categoryId', sql.BigInt, categoryId)
      .input('rejectionReason', sql.NVarChar(sql.MAX), rejectionReason ?? null)
      .query<{ SellerApplicationID: string | bigint; CategoryID: string | bigint; Status: string }>(`
        UPDATE dbo.SellerApplications
        SET CategoryID = @categoryId,
            RejectionReason = @rejectionReason,
            UpdatedAt = GETDATE()
        OUTPUT INSERTED.SellerApplicationID, INSERTED.CategoryID, INSERTED.Status
        WHERE SellerApplicationID = @appId
      `);

    return result.recordset[0];
  }

  /**
   * Create fresh application.
   */
  async createApplication(sellerId: bigint, categoryId: bigint, status: string = 'DRAFT') {
    const pool = await getPool();
    const result = await pool.request()
      .input('sellerId', sql.BigInt, sellerId)
      .input('categoryId', sql.BigInt, categoryId)
      .input('status', sql.VarChar(30), status)
      .query<{ SellerApplicationID: string | bigint; CategoryID: string | bigint; Status: string }>(`
        INSERT INTO dbo.SellerApplications (SellerID, CategoryID, Status, CreatedAt)
        OUTPUT INSERTED.SellerApplicationID, INSERTED.CategoryID, INSERTED.Status
        VALUES (@sellerId, @categoryId, @status, GETDATE())
      `);

    return result.recordset[0];
  }

  /**
   * Check if consent exists.
   */
  async findConsent(sellerId: bigint, consentType: string) {
    const pool = await getPool();
    const result = await pool.request()
      .input('sellerId', sql.BigInt, sellerId)
      .input('consentType', sql.VarChar(50), consentType)
      .query<{ SellerConsentID: string | bigint }>(`
        SELECT TOP 1 SellerConsentID
        FROM dbo.SellerConsents
        WHERE SellerID = @sellerId AND ConsentType = @consentType
      `);

    return result.recordset[0] || null;
  }

  /**
   * Record digital consent.
   */
  async createConsent(data: {
    sellerId: bigint;
    consentType: string;
    consentVersion: string;
    source: string;
  }) {
    const pool = await getPool();
    await pool.request()
      .input('sellerId', sql.BigInt, data.sellerId)
      .input('consentType', sql.VarChar(50), data.consentType)
      .input('consentVersion', sql.VarChar(20), data.consentVersion)
      .input('source', sql.VarChar(50), data.source)
      .query(`
        INSERT INTO dbo.SellerConsents (
          SellerID, ConsentType, ConsentVersion, IsGranted, GrantedAt, Source, CreatedAt
        )
        VALUES (
          @sellerId, @consentType, @consentVersion, 1, GETDATE(), @source, GETDATE()
        )
      `);
  }

  /**
   * Find most recent application for a seller.
   */
  async getLatestApplication(sellerId: bigint) {
    const pool = await getPool();
    const result = await pool.request()
      .input('sellerId', sql.BigInt, sellerId)
      .query<{
        SellerApplicationID: string | bigint;
        CategoryID: string | bigint;
        Status: string;
      }>(`
        SELECT TOP 1 SellerApplicationID, CategoryID, Status
        FROM dbo.SellerApplications
        WHERE SellerID = @sellerId
        ORDER BY CreatedAt DESC
      `);

    return result.recordset[0] || null;
  }

  /**
   * Find document type by code.
   */
  async findDocumentTypeByCode(code: string) {
    const pool = await getPool();
    const result = await pool.request()
      .input('code', sql.VarChar(50), code)
      .query<{ DocumentTypeID: number; Code: string; DisplayName: string }>(`
        SELECT TOP 1 DocumentTypeID, Code, DisplayName
        FROM dbo.DocumentTypes
        WHERE Code = @code
      `);

    return result.recordset[0] || null;
  }

  /**
   * Find baseline requirement for a document type.
   */
  async findBaselineDocRequirement(documentTypeId: number) {
    const pool = await getPool();
    const result = await pool.request()
      .input('docTypeId', sql.Int, documentTypeId)
      .query<{ IsRequired: boolean }>(`
        SELECT TOP 1 IsRequired
        FROM dbo.SellerDocumentRequirements
        WHERE DocumentTypeID = @docTypeId AND IsActive = 1
      `);

    return result.recordset[0] || null;
  }

  /**
   * Find application document.
   */
  async findApplicationDocument(applicationId: bigint, documentTypeId: number) {
    const pool = await getPool();
    const result = await pool.request()
      .input('appId', sql.BigInt, applicationId)
      .input('docTypeId', sql.Int, documentTypeId)
      .query<{
        SellerApplicationDocumentID: string | bigint;
        CertificateNumber: string | null;
        DocumentURL: string | null;
      }>(`
        SELECT TOP 1 SellerApplicationDocumentID, CertificateNumber, DocumentURL
        FROM dbo.SellerApplicationDocuments
        WHERE SellerApplicationID = @appId AND DocumentTypeID = @docTypeId
      `);

    return result.recordset[0] || null;
  }

  /**
   * Update application document.
   */
  async updateApplicationDocument(
    documentId: bigint,
    data: {
      certificateNumber?: string | null;
      documentUrl?: string;
      isMandatory?: boolean;
    }
  ) {
    const pool = await getPool();
    const req = pool.request().input('docId', sql.BigInt, documentId);
    const sets: string[] = ['UpdatedAt = GETDATE()', "VerificationStatus = 'PENDING'", 'RejectionReason = NULL'];

    if (data.certificateNumber !== undefined) {
      req.input('certNum', sql.NVarChar(100), data.certificateNumber);
      sets.push('CertificateNumber = @certNum');
    }
    if (data.documentUrl !== undefined) {
      req.input('docUrl', sql.NVarChar(sql.MAX), data.documentUrl);
      sets.push('DocumentURL = @docUrl');
    }
    if (data.isMandatory !== undefined) {
      req.input('isMandatory', sql.Bit, data.isMandatory ? 1 : 0);
      sets.push('IsMandatory = @isMandatory');
    }

    await req.query(`
      UPDATE dbo.SellerApplicationDocuments
      SET ${sets.join(', ')}
      WHERE SellerApplicationDocumentID = @docId
    `);
  }

  /**
   * Create application document.
   */
  async createApplicationDocument(data: {
    applicationId: bigint;
    documentTypeId: number;
    isMandatory: boolean;
    certificateNumber?: string | null;
    documentUrl?: string;
  }) {
    const pool = await getPool();
    await pool.request()
      .input('appId', sql.BigInt, data.applicationId)
      .input('docTypeId', sql.Int, data.documentTypeId)
      .input('isMandatory', sql.Bit, data.isMandatory ? 1 : 0)
      .input('certNum', sql.NVarChar(100), data.certificateNumber || null)
      .input('docUrl', sql.NVarChar(sql.MAX), data.documentUrl || '')
      .query(`
        INSERT INTO dbo.SellerApplicationDocuments (
          SellerApplicationID, DocumentTypeID, IsMandatory, CertificateNumber,
          DocumentURL, VerificationStatus, CreatedAt
        )
        VALUES (
          @appId, @docTypeId, @isMandatory, @certNum, @docUrl, 'PENDING', GETDATE()
        )
      `);
  }

  /**
   * Get uploaded documents for an application.
   */
  async getUploadedDocumentsForApplication(applicationId: bigint) {
    const pool = await getPool();
    const result = await pool.request()
      .input('appId', sql.BigInt, applicationId)
      .query<{ DocumentTypeID: number; DocumentURL: string | null }>(`
        SELECT DocumentTypeID, DocumentURL
        FROM dbo.SellerApplicationDocuments
        WHERE SellerApplicationID = @appId
      `);

    return result.recordset;
  }

  /**
   * Final submission transaction: updates Seller, SellerApplication, and writes SellerStatusHistory.
   */
  async submitApplicationTransaction(
    sellerId: bigint,
    applicationId: bigint,
    userId: bigint,
    tx: sql.Transaction
  ) {
    const req = new sql.Request(tx);
    await req
      .input('sellerId', sql.BigInt, sellerId)
      .input('appId', sql.BigInt, applicationId)
      .input('userId', sql.BigInt, userId)
      .query(`
        UPDATE dbo.Sellers
        SET Status = 'PENDING_VERIFICATION',
            UpdatedAt = GETDATE(),
            UpdatedBy = @userId
        WHERE SellerID = @sellerId;

        UPDATE dbo.SellerApplications
        SET Status = 'SUBMITTED',
            SubmittedAt = GETDATE(),
            RejectionReason = NULL,
            UpdatedAt = GETDATE()
        WHERE SellerApplicationID = @appId;

        INSERT INTO dbo.SellerStatusHistory (
          SellerID, SellerApplicationID, Status, Comments, ChangedBy, ChangedAt, CreatedAt
        )
        VALUES (
          @sellerId, @appId, 'PENDING_VERIFICATION',
          'Master D2C entity application submitted by merchant for verification',
          @userId, GETDATE(), GETDATE()
        );
      `);
  }
}

export const sellerOnboardingRepository = new SellerOnboardingRepository();
