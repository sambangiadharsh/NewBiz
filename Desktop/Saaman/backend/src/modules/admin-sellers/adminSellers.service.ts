import bcrypt from 'bcryptjs';
import { withTransaction } from '../../database/db.js';
import { NotFoundError, BadRequestError } from '../../utils/errors.js';
import { generateSellerCode } from '../../utils/codeGenerator.js';
import { adminSellersRepository } from './adminSellers.repository.js';

export class AdminSellersService {
  /**
   * List all seller onboarding applications with optional status filter
   */
  async listApplications(params: { status?: string; page?: number; limit?: number }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(50, Math.max(1, params.limit || 20));

    const { total, items } = await adminSellersRepository.listApplications({
      status: params.status,
      page,
      limit,
    });

    const data = items.map((app) => ({
      applicationId: Number(app.SellerApplicationID),
      sellerId: Number(app.SellerID),
      sellerCode: app.SellerCode,
      sellerName: app.SellerName,
      businessName: app.BusinessName,
      email: app.Email,
      phoneNumber: app.PhoneNumber,
      categoryName: app.CategoryName,
      status: app.Status,
      sellerStatus: app.SellerStatus,
      submittedAt: app.SubmittedAt,
      reviewedAt: app.ReviewedAt,
      rejectionReason: app.RejectionReason,
      documentCount: Number(app.DocumentCount),
      verifiedDocumentCount: Number(app.VerifiedDocumentCount),
    }));

    return {
      items: data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * List active merchants directly from Sellers table
   */
  async listActiveSellers(params: { status?: string; page?: number; limit?: number }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(200, Math.max(1, params.limit || 50));

    const { total, items } = await adminSellersRepository.listActiveSellers({
      status: params.status,
      page,
      limit,
    });

    const formatted = items.map((seller) => ({
      applicationId: seller.ApplicationID ? Number(seller.ApplicationID) : null,
      sellerId: Number(seller.SellerID),
      sellerCode: seller.SellerCode,
      sellerName: seller.SellerName,
      businessName: seller.BusinessName,
      email: seller.Email,
      phoneNumber: seller.PhoneNumber,
      categoryName: seller.CategoryName || 'General Marketplace',
      status: seller.ApplicationStatus || 'APPROVED',
      sellerStatus: seller.SellerStatus,
      reviewedAt: seller.ReviewedAt || seller.CreatedAt,
      documentCount: Number(seller.DocumentCount),
      verifiedDocumentCount: Number(seller.VerifiedDocumentCount),
    }));

    return {
      items: formatted,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get detailed application record with documents and audit history
   */
  async getApplicationDetails(applicationId: bigint) {
    const app = await adminSellersRepository.getApplicationDetails(applicationId);
    if (!app) {
      throw new NotFoundError('Seller application not found');
    }

    const docs: any[] = app.DocumentsJson ? JSON.parse(app.DocumentsJson) : [];
    const consents: any[] = app.ConsentsJson ? JSON.parse(app.ConsentsJson) : [];
    const history: any[] = app.HistoryJson ? JSON.parse(app.HistoryJson) : [];

    return {
      applicationId: Number(app.SellerApplicationID),
      status: app.Status,
      submittedAt: app.SubmittedAt,
      reviewedAt: app.ReviewedAt,
      rejectionReason: app.RejectionReason,
      reviewedBy: app.ReviewerFirstName ? `${app.ReviewerFirstName} ${app.ReviewerLastName || ''}`.trim() : null,
      seller: {
        sellerId: Number(app.SellerID),
        sellerCode: app.SellerCode,
        sellerName: app.SellerName,
        businessName: app.BusinessName,
        email: app.Email,
        phoneNumber: app.PhoneNumber,
        instagramUrl: app.InstagramURL,
        facebookUrl: app.FacebookURL,
        status: app.SellerStatus,
        createdAt: app.SellerCreatedAt,
      },
      category: {
        categoryId: Number(app.CategoryID),
        categoryName: app.CategoryName,
      },
      documents: docs.map((doc: any) => ({
        documentId: Number(doc.SellerApplicationDocumentID),
        code: doc.Code,
        displayName: doc.DisplayName,
        certificateNumber: doc.CertificateNumber,
        documentUrl: doc.DocumentURL,
        verificationStatus: doc.VerificationStatus,
        rejectionReason: doc.RejectionReason,
        verifiedAt: doc.VerifiedAt,
        verifiedBy: doc.VerifierFirstName ? `${doc.VerifierFirstName} ${doc.VerifierLastName || ''}`.trim() : null,
        isMandatory: doc.IsMandatory,
      })),
      consents: consents.map((c: any) => ({
        consentId: Number(c.SellerConsentID),
        type: c.ConsentType,
        isGranted: c.IsGranted,
        grantedAt: c.GrantedAt,
      })),
      statusHistory: history.map((h: any) => ({
        historyId: Number(h.SellerStatusHistoryID),
        status: h.Status,
        comments: h.Comments,
        changedAt: h.ChangedAt,
        changedBy: h.ChangedByFirstName ? `${h.ChangedByFirstName} ${h.ChangedByLastName || ''}`.trim() : 'System',
      })),
    };
  }

  /**
   * Verify or reject an individual document
   */
  async verifyDocument(
    docId: bigint,
    adminUserId: bigint,
    status: 'APPROVED' | 'REJECTED',
    rejectionReason?: string
  ) {
    const doc = await adminSellersRepository.findDocumentById(docId);
    if (!doc) {
      throw new NotFoundError('Document record not found');
    }

    const updated = await adminSellersRepository.verifyDocument(docId, adminUserId, status, rejectionReason);

    return {
      documentId: Number(updated.SellerApplicationDocumentID),
      code: updated.Code,
      displayName: updated.DisplayName,
      verificationStatus: updated.VerificationStatus,
      rejectionReason: updated.RejectionReason,
    };
  }

  /**
   * Make final approval or rejection decision on the whole application
   */
  async makeDecision(
    applicationId: bigint,
    adminUserId: bigint,
    decision: 'APPROVE' | 'REJECT',
    rejectionReason?: string
  ) {
    const app = await adminSellersRepository.findApplicationForDecision(applicationId);
    if (!app) {
      throw new NotFoundError('Application record not found');
    }

    const sellerId = BigInt(app.SellerID);

    if (decision === 'APPROVE') {
      await withTransaction(async (tx) => {
        await adminSellersRepository.approveApplicationTransaction(applicationId, sellerId, adminUserId, tx);
      });
    } else {
      await withTransaction(async (tx) => {
        await adminSellersRepository.rejectApplicationTransaction(
          applicationId,
          sellerId,
          adminUserId,
          rejectionReason,
          tx
        );
      });
    }

    return this.getApplicationDetails(applicationId);
  }

  /**
   * Reopen a rejected application for seller correction.
   * - Resets application status → DRAFT
   * - Resets seller status → DRAFT
   * - Resets only REJECTED documents → PENDING (APPROVED docs stay APPROVED)
   * - Records audit log entry
   */
  async reopenApplication(applicationId: bigint, adminUserId: bigint, correctionNote?: string) {
    const app = await adminSellersRepository.findApplicationForDecision(applicationId);
    if (!app) {
      throw new NotFoundError('Application record not found');
    }

    if (app.Status === 'APPROVED') {
      throw new Error('Approved applications cannot be sent back for correction');
    }

    const sellerId = BigInt(app.SellerID);
    const note = correctionNote || 'Please review and re-upload the flagged documents.';

    await withTransaction(async (tx) => {
      await adminSellersRepository.reopenApplicationTransaction(applicationId, sellerId, adminUserId, note, tx);
    });

    return this.getApplicationDetails(applicationId);
  }

  /**
   * Assisted Onboarding: Administrator creates and provisions a merchant directly from Admin Portal
   */
  async onboardSeller(
    adminUserId: bigint,
    input: {
      sellerName: string;
      businessName: string;
      email: string;
      phoneNumber: string;
      primaryCategoryId: number;
      instagramUrl?: string;
      facebookUrl?: string;
      initialStatus: 'APPROVED' | 'PENDING';
      temporaryPassword?: string;
      gstNumber?: string;
      panNumber?: string;
    }
  ) {
    const existingSeller = await adminSellersRepository.findSellerByEmail(input.email);
    if (existingSeller) {
      throw new BadRequestError(
        `A merchant with email "${input.email}" is already registered (${existingSeller.SellerCode})`
      );
    }

    const categoryId = BigInt(input.primaryCategoryId);
    const category = await adminSellersRepository.findCategoryById(categoryId);
    if (!category) {
      throw new BadRequestError('Selected category does not exist');
    }

    const tempPassword = input.temporaryPassword?.trim() || 'Seller@123';
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    const uniqueCode = await generateSellerCode();
    const isApproved = input.initialStatus === 'APPROVED';

    const result = await withTransaction(async (tx) => {
      // 1. Resolve or create user
      const user = await adminSellersRepository.findOrCreateUser(
        {
          sellerName: input.sellerName,
          email: input.email,
          phoneNumber: input.phoneNumber,
          passwordHash,
          adminUserId,
        },
        tx
      );

      const userId = BigInt(user.UserID);

      // Assign role SELLER_ADMIN
      await adminSellersRepository.ensureSellerRole(userId, tx);

      // 2. Create Seller
      const seller = await adminSellersRepository.createAssistedSeller(
        {
          sellerCode: uniqueCode,
          sellerName: input.sellerName,
          businessName: input.businessName,
          email: input.email,
          phoneNumber: input.phoneNumber,
          instagramUrl: input.instagramUrl || null,
          facebookUrl: input.facebookUrl || null,
          status: isApproved ? 'ACTIVE' : 'DRAFT',
          adminUserId,
        },
        tx
      );

      const sellerId = BigInt(seller.SellerID);

      // 3. Link user to seller
      await adminSellersRepository.linkSellerUser(sellerId, userId, adminUserId, tx);

      // 4. Create application
      const application = await adminSellersRepository.createAssistedApplication(
        {
          sellerId,
          categoryId,
          isApproved,
          adminUserId,
        },
        tx
      );

      const applicationId = BigInt(application.SellerApplicationID);

      // 5. Consent
      await adminSellersRepository.createAssistedConsent(sellerId, tx);

      // 6. Category documents
      const catDocs = await adminSellersRepository.getCategoryDocuments(categoryId, tx);
      for (const cd of catDocs) {
        let certNumber = '';
        if (cd.Code === 'GST' && input.gstNumber) {
          certNumber = input.gstNumber;
        } else if (cd.Code === 'PAN' && input.panNumber) {
          certNumber = input.panNumber;
        } else if (isApproved) {
          certNumber = 'VERIFIED-BY-ADMIN';
        }

        await adminSellersRepository.insertAssistedDocument(
          {
            applicationId,
            documentTypeId: cd.DocumentTypeID,
            certificateNumber: certNumber || null,
            documentUrl: isApproved ? '/uploads/seller-documents/admin-verified.pdf' : null,
            isApproved,
            isMandatory: cd.IsMandatory,
            adminUserId,
          },
          tx
        );
      }

      // 7. Status history
      await adminSellersRepository.createAssistedStatusHistory(
        {
          sellerId,
          applicationId,
          status: isApproved ? 'ACTIVE' : 'PENDING_VERIFICATION',
          comments: `Merchant onboarded via Admin Assisted Onboarding by platform administrator (Initial status: ${input.initialStatus})`,
          adminUserId,
        },
        tx
      );

      return {
        sellerId: Number(seller.SellerID),
        sellerCode: seller.SellerCode,
        sellerName: seller.SellerName,
        businessName: seller.BusinessName,
        email: seller.Email,
        phoneNumber: seller.PhoneNumber,
        categoryName: category.CategoryName,
        status: seller.Status,
        applicationId: Number(application.SellerApplicationID),
        applicationStatus: application.Status,
        userCredentials: {
          email: user.Email,
          temporaryPassword: tempPassword,
        },
      };
    });

    return result;
  }
}

export const adminSellersService = new AdminSellersService();
