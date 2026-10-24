import { getPool, sql } from '../../database/db.js';

export interface RawAdminApplicationItem {
  SellerApplicationID: string | bigint;
  SellerID: string | bigint;
  SellerCode: string;
  SellerName: string;
  BusinessName: string;
  Email: string;
  PhoneNumber: string | null;
  CategoryName: string;
  Status: string;
  SellerStatus: string;
  SubmittedAt: Date | null;
  ReviewedAt: Date | null;
  RejectionReason: string | null;
  DocumentCount: number;
  VerifiedDocumentCount: number;
}

export interface RawAdminSellerItem {
  SellerID: string | bigint;
  SellerCode: string;
  SellerName: string;
  BusinessName: string;
  Email: string;
  PhoneNumber: string | null;
  SellerStatus: string;
  CreatedAt: Date;
  ApplicationID: string | bigint | null;
  CategoryName: string | null;
  ApplicationStatus: string | null;
  ReviewedAt: Date | null;
  DocumentCount: number;
  VerifiedDocumentCount: number;
}

export interface RawApplicationDetail {
  SellerApplicationID: string | bigint;
  Status: string;
  SubmittedAt: Date | null;
  ReviewedAt: Date | null;
  RejectionReason: string | null;
  ReviewerFirstName: string | null;
  ReviewerLastName: string | null;
  SellerID: string | bigint;
  SellerCode: string;
  SellerName: string;
  BusinessName: string;
  Email: string;
  PhoneNumber: string | null;
  InstagramURL: string | null;
  FacebookURL: string | null;
  SellerStatus: string;
  SellerCreatedAt: Date;
  CategoryID: string | bigint;
  CategoryName: string;
  DocumentsJson: string | null;
  ConsentsJson: string | null;
  HistoryJson: string | null;
}

export class AdminSellersRepository {
  /**
   * List seller onboarding applications for admin queue.
   */
  async listApplications(params: {
    status?: string;
    page: number;
    limit: number;
  }): Promise<{ total: number; items: RawAdminApplicationItem[] }> {
    const pool = await getPool();
    const request = pool.request();

    const conditions: string[] = ["sa.Status != 'DRAFT'"];
    if (params.status && params.status !== 'ALL') {
      conditions.length = 0; // clear default condition
      conditions.push('sa.Status = @status');
      request.input('status', sql.VarChar(30), params.status);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // Total
    const countResult = await request.query<{ Total: number }>(`
      SELECT COUNT(*) AS Total
      FROM dbo.SellerApplications sa
      ${whereClause}
    `);
    const total = countResult.recordset[0]?.Total || 0;

    const skip = (params.page - 1) * params.limit;
    request.input('skip', sql.Int, skip);
    request.input('limit', sql.Int, params.limit);

    const itemsResult = await request.query<RawAdminApplicationItem>(`
      SELECT 
        sa.SellerApplicationID,
        sa.SellerID,
        s.SellerCode,
        s.SellerName,
        s.BusinessName,
        s.Email,
        s.PhoneNumber,
        c.CategoryName,
        sa.Status,
        s.Status AS SellerStatus,
        sa.SubmittedAt,
        sa.ReviewedAt,
        sa.RejectionReason,
        (
          SELECT COUNT(*) 
          FROM dbo.SellerApplicationDocuments sad 
          WHERE sad.SellerApplicationID = sa.SellerApplicationID
        ) AS DocumentCount,
        (
          SELECT COUNT(*) 
          FROM dbo.SellerApplicationDocuments sad 
          WHERE sad.SellerApplicationID = sa.SellerApplicationID AND sad.VerificationStatus = 'APPROVED'
        ) AS VerifiedDocumentCount
      FROM dbo.SellerApplications sa
      JOIN dbo.Sellers s ON sa.SellerID = s.SellerID
      JOIN dbo.Categories c ON sa.CategoryID = c.CategoryID
      ${whereClause}
      ORDER BY sa.CreatedAt DESC
      OFFSET @skip ROWS FETCH NEXT @limit ROWS ONLY
    `);

    return {
      total,
      items: itemsResult.recordset,
    };
  }

  /**
   * List active merchants directly from Sellers table.
   */
  async listActiveSellers(params: {
    status?: string;
    page: number;
    limit: number;
  }): Promise<{ total: number; items: RawAdminSellerItem[] }> {
    const pool = await getPool();
    const request = pool.request();

    const targetStatus = params.status && params.status !== 'ALL' ? params.status : 'ACTIVE';
    request.input('targetStatus', sql.VarChar(30), targetStatus);

    const countResult = await request.query<{ Total: number }>(`
      SELECT COUNT(*) AS Total
      FROM dbo.Sellers s
      WHERE s.Status = @targetStatus
    `);
    const total = countResult.recordset[0]?.Total || 0;

    const skip = (params.page - 1) * params.limit;
    request.input('skip', sql.Int, skip);
    request.input('limit', sql.Int, params.limit);

    const itemsResult = await request.query<RawAdminSellerItem>(`
      SELECT 
        s.SellerID,
        s.SellerCode,
        s.SellerName,
        s.BusinessName,
        s.Email,
        s.PhoneNumber,
        s.Status AS SellerStatus,
        s.CreatedAt,
        latestApp.SellerApplicationID AS ApplicationID,
        latestApp.Status AS ApplicationStatus,
        latestApp.ReviewedAt,
        c.CategoryName,
        (
          SELECT COUNT(*)
          FROM dbo.SellerApplicationDocuments sad
          WHERE sad.SellerApplicationID = latestApp.SellerApplicationID
        ) AS DocumentCount,
        (
          SELECT COUNT(*)
          FROM dbo.SellerApplicationDocuments sad
          WHERE sad.SellerApplicationID = latestApp.SellerApplicationID AND sad.VerificationStatus = 'APPROVED'
        ) AS VerifiedDocumentCount
      FROM dbo.Sellers s
      OUTER APPLY (
        SELECT TOP 1 sa.SellerApplicationID, sa.CategoryID, sa.Status, sa.ReviewedAt
        FROM dbo.SellerApplications sa
        WHERE sa.SellerID = s.SellerID
        ORDER BY sa.CreatedAt DESC
      ) latestApp
      LEFT JOIN dbo.Categories c ON latestApp.CategoryID = c.CategoryID
      WHERE s.Status = @targetStatus
      ORDER BY s.CreatedAt DESC
      OFFSET @skip ROWS FETCH NEXT @limit ROWS ONLY
    `);

    return {
      total,
      items: itemsResult.recordset,
    };
  }

  /**
   * Get application details with seller, categories, documents, consents, and status history.
   */
  async getApplicationDetails(applicationId: bigint): Promise<RawApplicationDetail | null> {
    const pool = await getPool();
    const result = await pool.request()
      .input('appId', sql.BigInt, applicationId)
      .query<RawApplicationDetail>(`
        SELECT TOP 1
          sa.SellerApplicationID,
          sa.Status,
          sa.SubmittedAt,
          sa.ReviewedAt,
          sa.RejectionReason,
          uRev.FirstName AS ReviewerFirstName,
          uRev.LastName AS ReviewerLastName,
          s.SellerID,
          s.SellerCode,
          s.SellerName,
          s.BusinessName,
          s.Email,
          s.PhoneNumber,
          s.InstagramURL,
          s.FacebookURL,
          s.Status AS SellerStatus,
          s.CreatedAt AS SellerCreatedAt,
          c.CategoryID,
          c.CategoryName,
          (
            SELECT 
              sad.SellerApplicationDocumentID,
              sad.CertificateNumber,
              sad.DocumentURL,
              sad.VerificationStatus,
              sad.RejectionReason,
              sad.VerifiedAt,
              sad.IsMandatory,
              dt.Code,
              dt.DisplayName,
              uVer.FirstName AS VerifierFirstName,
              uVer.LastName AS VerifierLastName
            FROM dbo.SellerApplicationDocuments sad
            JOIN dbo.DocumentTypes dt ON sad.DocumentTypeID = dt.DocumentTypeID
            LEFT JOIN dbo.Users uVer ON sad.VerifiedBy = uVer.UserID
            WHERE sad.SellerApplicationID = sa.SellerApplicationID
            FOR JSON PATH
          ) AS DocumentsJson,
          (
            SELECT sc.SellerConsentID, sc.ConsentType, sc.IsGranted, sc.GrantedAt
            FROM dbo.SellerConsents sc
            WHERE sc.SellerID = s.SellerID
            FOR JSON PATH
          ) AS ConsentsJson,
          (
            SELECT 
              ssh.SellerStatusHistoryID,
              ssh.Status,
              ssh.Comments,
              ssh.ChangedAt,
              uHist.FirstName AS ChangedByFirstName,
              uHist.LastName AS ChangedByLastName
            FROM dbo.SellerStatusHistory ssh
            LEFT JOIN dbo.Users uHist ON ssh.ChangedBy = uHist.UserID
            WHERE ssh.SellerApplicationID = sa.SellerApplicationID
            ORDER BY ssh.ChangedAt DESC
            FOR JSON PATH
          ) AS HistoryJson
        FROM dbo.SellerApplications sa
        JOIN dbo.Sellers s ON sa.SellerID = s.SellerID
        JOIN dbo.Categories c ON sa.CategoryID = c.CategoryID
        LEFT JOIN dbo.Users uRev ON sa.ReviewedBy = uRev.UserID
        WHERE sa.SellerApplicationID = @appId
      `);

    return result.recordset[0] || null;
  }

  /**
   * Find application document by ID.
   */
  async findDocumentById(docId: bigint) {
    const pool = await getPool();
    const result = await pool.request()
      .input('docId', sql.BigInt, docId)
      .query<{ SellerApplicationDocumentID: string | bigint }>(`
        SELECT SellerApplicationDocumentID
        FROM dbo.SellerApplicationDocuments
        WHERE SellerApplicationDocumentID = @docId
      `);

    return result.recordset[0] || null;
  }

  /**
   * Verify or reject an individual document.
   */
  async verifyDocument(
    docId: bigint,
    adminUserId: bigint,
    status: 'APPROVED' | 'REJECTED',
    rejectionReason?: string
  ) {
    const pool = await getPool();
    const result = await pool.request()
      .input('docId', sql.BigInt, docId)
      .input('adminUserId', sql.BigInt, adminUserId)
      .input('status', sql.VarChar(30), status)
      .input('reason', sql.NVarChar(500), status === 'REJECTED' ? rejectionReason || 'Document rejected by reviewer' : null)
      .query<{
        SellerApplicationDocumentID: string | bigint;
        Code: string;
        DisplayName: string;
        VerificationStatus: string;
        RejectionReason: string | null;
      }>(`
        UPDATE sad
        SET sad.VerificationStatus = @status,
            sad.RejectionReason = @reason,
            sad.VerifiedBy = @adminUserId,
            sad.VerifiedAt = GETDATE(),
            sad.UpdatedAt = GETDATE()
        OUTPUT 
          INSERTED.SellerApplicationDocumentID,
          dt.Code,
          dt.DisplayName,
          INSERTED.VerificationStatus,
          INSERTED.RejectionReason
        FROM dbo.SellerApplicationDocuments sad
        JOIN dbo.DocumentTypes dt ON sad.DocumentTypeID = dt.DocumentTypeID
        WHERE sad.SellerApplicationDocumentID = @docId
      `);

    return result.recordset[0];
  }

  /**
   * Find application for decision.
   */
  async findApplicationForDecision(applicationId: bigint) {
    const pool = await getPool();
    const result = await pool.request()
      .input('appId', sql.BigInt, applicationId)
      .query<{
        SellerApplicationID: string | bigint;
        SellerID: string | bigint;
        Status: string;
      }>(`
        SELECT SellerApplicationID, SellerID, Status
        FROM dbo.SellerApplications
        WHERE SellerApplicationID = @appId
      `);

    return result.recordset[0] || null;
  }

  /**
   * Approve application transaction.
   */
  async approveApplicationTransaction(
    applicationId: bigint,
    sellerId: bigint,
    adminUserId: bigint,
    tx: sql.Transaction
  ) {
    const req = new sql.Request(tx);
    await req
      .input('appId', sql.BigInt, applicationId)
      .input('sellerId', sql.BigInt, sellerId)
      .input('adminUserId', sql.BigInt, adminUserId)
      .query(`
        UPDATE dbo.SellerApplications
        SET Status = 'APPROVED',
            ReviewedAt = GETDATE(),
            ReviewedBy = @adminUserId,
            RejectionReason = NULL,
            UpdatedAt = GETDATE()
        WHERE SellerApplicationID = @appId;

        UPDATE dbo.Sellers
        SET Status = 'ACTIVE',
            UpdatedAt = GETDATE(),
            UpdatedBy = @adminUserId
        WHERE SellerID = @sellerId;

        INSERT INTO dbo.SellerStatusHistory (
          SellerID, SellerApplicationID, Status, Comments, ChangedBy, ChangedAt, CreatedAt
        )
        VALUES (
          @sellerId, @appId, 'ACTIVE',
          'Application and legal KYC approved by platform administrator',
          @adminUserId, GETDATE(), GETDATE()
        );
      `);
  }

  /**
   * Reject application transaction.
   */
  async rejectApplicationTransaction(
    applicationId: bigint,
    sellerId: bigint,
    adminUserId: bigint,
    rejectionReason?: string,
    tx?: sql.Transaction
  ) {
    const pool = await getPool();
    const req = tx ? new sql.Request(tx) : pool.request();
    await req
      .input('appId', sql.BigInt, applicationId)
      .input('sellerId', sql.BigInt, sellerId)
      .input('adminUserId', sql.BigInt, adminUserId)
      .input('reason', sql.NVarChar(sql.MAX), rejectionReason || 'Application rejected by platform administrator')
      .query(`
        UPDATE dbo.SellerApplications
        SET Status = 'REJECTED',
            ReviewedAt = GETDATE(),
            ReviewedBy = @adminUserId,
            RejectionReason = @reason,
            UpdatedAt = GETDATE()
        WHERE SellerApplicationID = @appId;

        UPDATE dbo.Sellers
        SET Status = 'REJECTED',
            UpdatedAt = GETDATE(),
            UpdatedBy = @adminUserId
        WHERE SellerID = @sellerId;

        INSERT INTO dbo.SellerStatusHistory (
          SellerID, SellerApplicationID, Status, Comments, ChangedBy, ChangedAt, CreatedAt
        )
        VALUES (
          @sellerId, @appId, 'REJECTED',
          @reason,
          @adminUserId, GETDATE(), GETDATE()
        );
      `);
  }

  /**
   * Reopen application for correction transaction.
   */
  async reopenApplicationTransaction(
    applicationId: bigint,
    sellerId: bigint,
    adminUserId: bigint,
    correctionNote: string,
    tx: sql.Transaction
  ) {
    const req = new sql.Request(tx);
    await req
      .input('appId', sql.BigInt, applicationId)
      .input('sellerId', sql.BigInt, sellerId)
      .input('adminUserId', sql.BigInt, adminUserId)
      .input('note', sql.NVarChar(sql.MAX), correctionNote)
      .query(`
        UPDATE dbo.SellerApplications
        SET Status = 'DRAFT',
            RejectionReason = @note,
            UpdatedAt = GETDATE()
        WHERE SellerApplicationID = @appId;

        UPDATE dbo.Sellers
        SET Status = 'DRAFT',
            UpdatedAt = GETDATE(),
            UpdatedBy = @adminUserId
        WHERE SellerID = @sellerId;

        UPDATE dbo.SellerApplicationDocuments
        SET VerificationStatus = 'PENDING',
            UpdatedAt = GETDATE()
        WHERE SellerApplicationID = @appId AND VerificationStatus = 'REJECTED';

        INSERT INTO dbo.SellerStatusHistory (
          SellerID, SellerApplicationID, Status, Comments, ChangedBy, ChangedAt, CreatedAt
        )
        VALUES (
          @sellerId, @appId, 'DRAFT',
          @note,
          @adminUserId, GETDATE(), GETDATE()
        );
      `);
  }

  /**
   * Find seller by email.
   */
  async findSellerByEmail(email: string) {
    const pool = await getPool();
    const result = await pool.request()
      .input('email', sql.NVarChar(150), email)
      .query<{ SellerID: string | bigint; SellerCode: string }>(`
        SELECT TOP 1 SellerID, SellerCode
        FROM dbo.Sellers
        WHERE Email = @email
      `);

    return result.recordset[0] || null;
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
   * Find or create user for assisted onboarding.
   */
  async findOrCreateUser(
    data: {
      sellerName: string;
      email: string;
      phoneNumber: string;
      passwordHash: string;
      adminUserId: bigint;
    },
    tx: sql.Transaction
  ) {
    const req = new sql.Request(tx);
    const existing = await req
      .input('email', sql.NVarChar(150), data.email)
      .query<{ UserID: string | bigint; Email: string }>(`
        SELECT TOP 1 UserID, Email FROM dbo.Users WHERE Email = @email
      `);

    if (existing.recordset[0]) {
      return existing.recordset[0];
    }

    const createReq = new sql.Request(tx);
    const created = await createReq
      .input('firstName', sql.NVarChar(100), data.sellerName)
      .input('lastName', sql.NVarChar(100), 'Merchant')
      .input('email', sql.NVarChar(150), data.email)
      .input('phone', sql.NVarChar(30), data.phoneNumber)
      .input('hash', sql.NVarChar(255), data.passwordHash)
      .input('adminUserId', sql.BigInt, data.adminUserId)
      .query<{ UserID: string | bigint; Email: string }>(`
        INSERT INTO dbo.Users (
          FirstName, LastName, Email, PhoneNumber, PasswordHash, Status, CreatedAt, CreatedBy
        )
        OUTPUT INSERTED.UserID, INSERTED.Email
        VALUES (
          @firstName, @lastName, @email, @phone, @hash, 'ACTIVE', GETDATE(), @adminUserId
        )
      `);

    return created.recordset[0];
  }

  /**
   * Assign SELLER_USER role if needed.
   */
  async ensureSellerRole(userId: bigint, tx: sql.Transaction) {
    const req = new sql.Request(tx);
    await req
      .input('userId', sql.BigInt, userId)
      .query(`
        DECLARE @sellerAdminId BIGINT;
        SELECT @sellerAdminId = RoleID FROM dbo.Roles WHERE RoleName = 'SELLER_ADMIN';
        IF @sellerAdminId IS NOT NULL
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM dbo.UserRoles WHERE UserID = @userId AND RoleID = @sellerAdminId)
          BEGIN
            INSERT INTO dbo.UserRoles (UserID, RoleID, CreatedAt)
            VALUES (@userId, @sellerAdminId, GETDATE());
          END
        END
      `);
  }

  /**
   * Create seller entity for assisted onboarding.
   */
  async createAssistedSeller(
    data: {
      sellerCode: string;
      sellerName: string;
      businessName: string;
      email: string;
      phoneNumber: string;
      instagramUrl?: string | null;
      facebookUrl?: string | null;
      status: string;
      adminUserId: bigint;
    },
    tx: sql.Transaction
  ) {
    const req = new sql.Request(tx);
    const result = await req
      .input('code', sql.NVarChar(50), data.sellerCode)
      .input('name', sql.NVarChar(150), data.sellerName)
      .input('bName', sql.NVarChar(200), data.businessName)
      .input('email', sql.NVarChar(150), data.email)
      .input('phone', sql.NVarChar(30), data.phoneNumber)
      .input('insta', sql.NVarChar(255), data.instagramUrl || null)
      .input('fb', sql.NVarChar(255), data.facebookUrl || null)
      .input('status', sql.VarChar(30), data.status)
      .input('adminUserId', sql.BigInt, data.adminUserId)
      .query<{
        SellerID: string | bigint;
        SellerCode: string;
        SellerName: string;
        BusinessName: string;
        Email: string;
        PhoneNumber: string | null;
        Status: string;
      }>(`
        INSERT INTO dbo.Sellers (
          SellerCode, SellerName, BusinessName, Email, PhoneNumber,
          InstagramURL, FacebookURL, Status, CreatedAt, CreatedBy
        )
        OUTPUT 
          INSERTED.SellerID, INSERTED.SellerCode, INSERTED.SellerName,
          INSERTED.BusinessName, INSERTED.Email, INSERTED.PhoneNumber, INSERTED.Status
        VALUES (
          @code, @name, @bName, @email, @phone, @insta, @fb, @status, GETDATE(), @adminUserId
        )
      `);

    return result.recordset[0];
  }

  /**
   * Link seller user.
   */
  async linkSellerUser(sellerId: bigint, userId: bigint, adminUserId: bigint, tx: sql.Transaction) {
    const req = new sql.Request(tx);
    await req
      .input('sellerId', sql.BigInt, sellerId)
      .input('userId', sql.BigInt, userId)
      .input('adminUserId', sql.BigInt, adminUserId)
      .query(`
        INSERT INTO dbo.SellerUsers (SellerID, UserID, Status, CreatedAt, CreatedBy)
        VALUES (@sellerId, @userId, 'ACTIVE', GETDATE(), @adminUserId)
      `);
  }

  /**
   * Create seller application for assisted onboarding.
   */
  async createAssistedApplication(
    data: {
      sellerId: bigint;
      categoryId: bigint;
      isApproved: boolean;
      adminUserId: bigint;
    },
    tx: sql.Transaction
  ) {
    const req = new sql.Request(tx);
    const result = await req
      .input('sellerId', sql.BigInt, data.sellerId)
      .input('categoryId', sql.BigInt, data.categoryId)
      .input('status', sql.VarChar(30), data.isApproved ? 'APPROVED' : 'SUBMITTED')
      .input('adminUserId', sql.BigInt, data.adminUserId)
      .query<{ SellerApplicationID: string | bigint; Status: string }>(`
        INSERT INTO dbo.SellerApplications (
          SellerID, CategoryID, Status, SubmittedAt, ReviewedAt, ReviewedBy, CreatedAt
        )
        OUTPUT INSERTED.SellerApplicationID, INSERTED.Status
        VALUES (
          @sellerId, @categoryId, @status, GETDATE(),
          CASE WHEN @status = 'APPROVED' THEN GETDATE() ELSE NULL END,
          CASE WHEN @status = 'APPROVED' THEN @adminUserId ELSE NULL END,
          GETDATE()
        )
      `);

    return result.recordset[0];
  }

  /**
   * Add assisted consent.
   */
  async createAssistedConsent(sellerId: bigint, tx: sql.Transaction) {
    const req = new sql.Request(tx);
    await req.input('sellerId', sql.BigInt, sellerId).query(`
      INSERT INTO dbo.SellerConsents (
        SellerID, ConsentType, ConsentVersion, IsGranted, GrantedAt, Source, CreatedAt
      )
      VALUES (
        @sellerId, 'MARKETPLACE_SELLER_AGREEMENT', 'v1.0', 1, GETDATE(), 'ADMIN_ASSISTED', GETDATE()
      )
    `);
  }

  /**
   * Get active category documents.
   */
  async getCategoryDocuments(categoryId: bigint, tx: sql.Transaction) {
    const req = new sql.Request(tx);
    const result = await req
      .input('categoryId', sql.BigInt, categoryId)
      .query<{
        DocumentTypeID: number;
        IsMandatory: boolean;
        Code: string;
      }>(`
        SELECT cd.DocumentTypeID, cd.IsMandatory, dt.Code
        FROM dbo.CategoryDocuments cd
        JOIN dbo.DocumentTypes dt ON cd.DocumentTypeID = dt.DocumentTypeID
        WHERE cd.CategoryID = @categoryId AND cd.Status = 'ACTIVE'
      `);

    return result.recordset;
  }

  /**
   * Insert assisted application document.
   */
  async insertAssistedDocument(
    data: {
      applicationId: bigint;
      documentTypeId: number;
      certificateNumber: string | null;
      documentUrl: string | null;
      isApproved: boolean;
      isMandatory: boolean;
      adminUserId: bigint;
    },
    tx: sql.Transaction
  ) {
    const req = new sql.Request(tx);
    await req
      .input('appId', sql.BigInt, data.applicationId)
      .input('docTypeId', sql.Int, data.documentTypeId)
      .input('certNum', sql.NVarChar(100), data.certificateNumber)
      .input('docUrl', sql.NVarChar(sql.MAX), data.documentUrl)
      .input('status', sql.VarChar(30), data.isApproved ? 'APPROVED' : 'PENDING')
      .input('isMandatory', sql.Bit, data.isMandatory ? 1 : 0)
      .input('adminUserId', sql.BigInt, data.adminUserId)
      .query(`
        INSERT INTO dbo.SellerApplicationDocuments (
          SellerApplicationID, DocumentTypeID, CertificateNumber, DocumentURL,
          VerificationStatus, IsMandatory, VerifiedBy, VerifiedAt, CreatedAt
        )
        VALUES (
          @appId, @docTypeId, @certNum, @docUrl, @status, @isMandatory,
          CASE WHEN @status = 'APPROVED' THEN @adminUserId ELSE NULL END,
          CASE WHEN @status = 'APPROVED' THEN GETDATE() ELSE NULL END,
          GETDATE()
        )
      `);
  }

  /**
   * Insert assisted status history.
   */
  async createAssistedStatusHistory(
    data: {
      sellerId: bigint;
      applicationId: bigint;
      status: string;
      comments: string;
      adminUserId: bigint;
    },
    tx: sql.Transaction
  ) {
    const req = new sql.Request(tx);
    await req
      .input('sellerId', sql.BigInt, data.sellerId)
      .input('appId', sql.BigInt, data.applicationId)
      .input('status', sql.VarChar(30), data.status)
      .input('comments', sql.NVarChar(sql.MAX), data.comments)
      .input('adminUserId', sql.BigInt, data.adminUserId)
      .query(`
        INSERT INTO dbo.SellerStatusHistory (
          SellerID, SellerApplicationID, Status, Comments, ChangedBy, ChangedAt, CreatedAt
        )
        VALUES (
          @sellerId, @appId, @status, @comments, @adminUserId, GETDATE(), GETDATE()
        )
      `);
  }
}

export const adminSellersRepository = new AdminSellersRepository();
