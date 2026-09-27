import { prisma } from '../../database/prisma.js';
import { BadRequestError } from '../../utils/errors.js';
import { storageService } from '../../services/storage/StorageService.js';
import { MasterProfileInput } from './sellerOnboarding.validation.js';
import { categoryInheritanceService } from '../../services/categoryInheritance.service.js';
import { generateSellerCode } from '../../utils/codeGenerator.js';

export class SellerOnboardingService {
  /**
   * Helper to resolve the seller linked to an authenticated user
   */
  async getSellerForUser(userId: bigint) {
    const sellerUser = await prisma.sellerUsers.findFirst({
      where: { UserID: userId },
      include: {
        Sellers: true,
      },
    });
    return sellerUser?.Sellers || null;
  }

  /**
   * Get complete onboarding and KYC status for the current logged-in seller.
   *
   * isSentBack = application.Status === 'DRAFT' && application.RejectionReason != null
   * This distinguishes "admin sent back for correction" from a fresh in-progress draft.
   */
  async getOnboardingStatus(userId: bigint) {
    const seller = await this.getSellerForUser(userId);

    if (!seller) {
      const baselineReqs = await prisma.sellerDocumentRequirements.findMany({
        where: { IsActive: true },
        include: { DocumentTypes: true },
      });
      const requiredDocuments = baselineReqs.map((b) => ({
        documentTypeId: b.DocumentTypeID,
        code: b.DocumentTypes.Code,
        displayName: b.DocumentTypes.DisplayName,
        isMandatory: b.IsRequired,
        source: 'SELLER_BASELINE',
      }));

      return {
        hasProfile: false,
        status: 'NOT_STARTED',
        isMerchantActive: false,
        isSentBack: false,
        seller: null,
        application: null,
        applications: [],
        activeCategories: [],
        pendingCategories: [],
        requiredDocuments,
        documents: [],
        consents: [],
        statusHistory: [],
      };
    }

    // Fetch all applications for this seller
    const allApplications = await prisma.sellerApplications.findMany({
      where: { SellerID: seller.SellerID },
      orderBy: { CreatedAt: 'desc' },
      include: {
        Categories: true,
        SellerApplicationDocuments: {
          include: {
            DocumentTypes: true,
          },
        },
      },
    });

    // Primary application: prioritize APPROVED application, or fallback to the latest
    const primaryApplication =
      allApplications.find((a) => a.Status === 'APPROVED') || allApplications[0] || null;

    const consents = await prisma.sellerConsents.findMany({
      where: { SellerID: seller.SellerID },
    });

    const statusHistory = await prisma.sellerStatusHistory.findMany({
      where: { SellerID: seller.SellerID },
      orderBy: { CreatedAt: 'desc' },
      include: {
        Users: {
          select: {
            FirstName: true,
            LastName: true,
          },
        },
      },
    });

    // 1. Fetch platform baseline seller document requirements
    const baselineReqs = await prisma.sellerDocumentRequirements.findMany({
      where: { IsActive: true },
      include: { DocumentTypes: true },
    });

    // 2. Fetch category-specific document requirements via hierarchy inheritance
    let catDocs: Array<any> = [];
    if (primaryApplication) {
      catDocs = await categoryInheritanceService.resolveEffectiveCategoryDocuments(primaryApplication.CategoryID);
    }

    // 3. Merge baseline and category-specific requirements into a unified list
    const docMap = new Map<number, {
      documentTypeId: number;
      code: string;
      displayName: string;
      isMandatory: boolean;
      source: string;
    }>();

    for (const b of baselineReqs) {
      docMap.set(b.DocumentTypeID, {
        documentTypeId: b.DocumentTypeID,
        code: b.DocumentTypes.Code,
        displayName: b.DocumentTypes.DisplayName,
        isMandatory: b.IsRequired,
        source: 'SELLER_BASELINE',
      });
    }

    for (const c of catDocs) {
      const existing = docMap.get(c.documentTypeId);
      if (existing) {
        existing.isMandatory = existing.isMandatory || c.isMandatory;
        existing.source = 'BOTH';
      } else {
        docMap.set(c.documentTypeId, {
          documentTypeId: c.documentTypeId,
          code: c.code,
          displayName: c.displayName,
          isMandatory: c.isMandatory,
          source: c.isInherited ? 'CATEGORY_INHERITED' : 'CATEGORY_SPECIFIC',
        });
      }
    }

    const requiredDocuments = Array.from(docMap.values());

    // Collect all documents across applications, ensuring baseline docs are preserved
    const documentMap = new Map<string, any>();
    for (const doc of (primaryApplication?.SellerApplicationDocuments || [])) {
      documentMap.set(doc.DocumentTypes.Code, {
        documentId: Number(doc.SellerApplicationDocumentID),
        code: doc.DocumentTypes.Code,
        displayName: doc.DocumentTypes.DisplayName,
        certificateNumber: doc.CertificateNumber,
        documentUrl: doc.DocumentURL,
        verificationStatus: doc.VerificationStatus,
        rejectionReason: doc.RejectionReason,
        isMandatory: doc.IsMandatory,
      });
    }
    for (const app of allApplications) {
      for (const doc of app.SellerApplicationDocuments) {
        if (!documentMap.has(doc.DocumentTypes.Code)) {
          documentMap.set(doc.DocumentTypes.Code, {
            documentId: Number(doc.SellerApplicationDocumentID),
            code: doc.DocumentTypes.Code,
            displayName: doc.DocumentTypes.DisplayName,
            certificateNumber: doc.CertificateNumber,
            documentUrl: doc.DocumentURL,
            verificationStatus: doc.VerificationStatus,
            rejectionReason: doc.RejectionReason,
            isMandatory: doc.IsMandatory,
          });
        }
      }
    }
    const formattedDocs = Array.from(documentMap.values());

    // Map out all category applications
    const applications = allApplications.map((app) => ({
      applicationId: Number(app.SellerApplicationID),
      categoryId: Number(app.CategoryID),
      categoryName: app.Categories.CategoryName,
      categoryCode: app.Categories.CategoryCode,
      status: app.Status,
      submittedAt: app.SubmittedAt,
      reviewedAt: app.ReviewedAt,
      rejectionReason: app.RejectionReason,
      documents: (app.SellerApplicationDocuments || []).map((doc) => ({
        documentId: Number(doc.SellerApplicationDocumentID),
        code: doc.DocumentTypes.Code,
        displayName: doc.DocumentTypes.DisplayName,
        certificateNumber: doc.CertificateNumber,
        documentUrl: doc.DocumentURL,
        verificationStatus: doc.VerificationStatus,
        rejectionReason: doc.RejectionReason,
        isMandatory: doc.IsMandatory,
      })),
    }));

    const activeCategories = allApplications
      .filter((a) => a.Status === 'APPROVED')
      .map((a) => ({
        categoryId: Number(a.CategoryID),
        categoryName: a.Categories.CategoryName,
        categoryCode: a.Categories.CategoryCode,
        approvedAt: a.ReviewedAt,
      }));

    const pendingCategories = allApplications
      .filter((a) => a.Status === 'SUBMITTED' || a.Status === 'PENDING')
      .map((a) => ({
        categoryId: Number(a.CategoryID),
        categoryName: a.Categories.CategoryName,
        categoryCode: a.Categories.CategoryCode,
        submittedAt: a.SubmittedAt,
      }));

    const isMerchantActive = seller.Status === 'ACTIVE';

    // Derive: was the primary application sent back for correction by admin?
    const isSentBack =
      !isMerchantActive &&
      primaryApplication?.Status === 'DRAFT' &&
      primaryApplication.RejectionReason != null &&
      primaryApplication.RejectionReason.trim().length > 0;

    // Calculate effective onboarding status:
    // If merchant is active, status is permanently 'ACTIVE'.
    // Otherwise, reflect initial onboarding application progress.
    const effectiveStatus = isMerchantActive
      ? 'ACTIVE'
      : primaryApplication
      ? primaryApplication.Status === 'APPROVED'
        ? 'ACTIVE'
        : primaryApplication.Status === 'SUBMITTED'
        ? 'PENDING_VERIFICATION'
        : primaryApplication.Status === 'REJECTED'
        ? 'REJECTED'
        : 'DRAFT'
      : seller.Status;

    return {
      hasProfile: true,
      status: effectiveStatus,
      isMerchantActive,
      isSentBack,
      seller: {
        sellerId: Number(seller.SellerID),
        sellerCode: seller.SellerCode,
        sellerName: seller.SellerName,
        businessName: seller.BusinessName,
        email: seller.Email,
        phoneNumber: seller.PhoneNumber,
        instagramUrl: seller.InstagramURL,
        facebookUrl: seller.FacebookURL,
        youtubeUrl: seller.YouTubeURL,
        linkedinUrl: seller.LinkedInURL,
        status: seller.Status,
      },
      application: primaryApplication
        ? {
            applicationId: Number(primaryApplication.SellerApplicationID),
            categoryId: Number(primaryApplication.CategoryID),
            categoryName: primaryApplication.Categories.CategoryName,
            status: primaryApplication.Status,
            submittedAt: primaryApplication.SubmittedAt,
            reviewedAt: primaryApplication.ReviewedAt,
            rejectionReason: primaryApplication.RejectionReason,
          }
        : null,
      applications,
      activeCategories,
      pendingCategories,
      requiredDocuments,
      documents: formattedDocs,
      consents: consents.map((c) => ({
        consentId: Number(c.SellerConsentID),
        type: c.ConsentType,
        isGranted: c.IsGranted,
        grantedAt: c.GrantedAt,
      })),
      statusHistory: statusHistory.map((h) => ({
        historyId: Number(h.SellerStatusHistoryID),
        status: h.Status,
        comments: h.Comments,
        createdAt: h.CreatedAt,
        changedBy: h.Users ? `${h.Users.FirstName} ${h.Users.LastName}` : 'System / Merchant',
      })),
    };
  }

  /**
   * Save or update master D2C company profile and link primary category.
   *
   * Application resolution strategy (no duplicate applications):
   *  1. Find an existing application for the exact same category (any status).
   *  2. If none, find any DRAFT or REJECTED application (correction/resubmit
   *     case) — update its CategoryID rather than creating a new row.
   *  3. Only create a new application row when truly no mutable application
   *     exists (first time ever, or all existing ones are APPROVED).
   */
  async saveMasterProfile(userId: bigint, input: MasterProfileInput) {
    let seller = await this.getSellerForUser(userId);

    if (!seller) {
      // Create new Seller entity (first-time registration)
      const uniqueCode = await generateSellerCode(prisma);

      seller = await prisma.$transaction(async (tx) => {
        const createdSeller = await tx.sellers.create({
          data: {
            SellerCode: uniqueCode,
            SellerName: input.sellerName,
            BusinessName: input.businessName,
            Email: input.email,
            PhoneNumber: input.phoneNumber,
            InstagramURL: input.instagramUrl || null,
            FacebookURL: input.facebookUrl || null,
            YouTubeURL: input.youtubeUrl || null,
            LinkedInURL: input.linkedinUrl || null,
            Status: 'DRAFT',
            CreatedAt: new Date(),
            CreatedBy: userId,
          },
        });

        // Link User to Seller
        await tx.sellerUsers.create({
          data: {
            SellerID: createdSeller.SellerID,
            UserID: userId,
            Status: 'ACTIVE',
            CreatedAt: new Date(),
            CreatedBy: userId,
          },
        });

        return createdSeller;
      });
    } else {
      // Update existing seller profile fields
      seller = await prisma.sellers.update({
        where: { SellerID: seller.SellerID },
        data: {
          SellerName: input.sellerName,
          BusinessName: input.businessName,
          Email: input.email,
          PhoneNumber: input.phoneNumber,
          InstagramURL: input.instagramUrl || null,
          FacebookURL: input.facebookUrl || null,
          YouTubeURL: input.youtubeUrl || null,
          LinkedInURL: input.linkedinUrl || null,
          UpdatedAt: new Date(),
          UpdatedBy: userId,
        },
      });
    }

    const categoryId = BigInt(input.primaryCategoryId);

    // Verify category exists
    const category = await prisma.categories.findUnique({
      where: { CategoryID: categoryId },
    });
    if (!category) {
      throw new BadRequestError('Selected primary category does not exist');
    }

    // Step 1: Look for an existing application with the exact same category
    let application = await prisma.sellerApplications.findFirst({
      where: {
        SellerID: seller.SellerID,
        CategoryID: categoryId,
      },
    });

    if (!application) {
      // Step 2: Look for any mutable (DRAFT or REJECTED) application to reuse.
      // This handles the "sent back for correction" and "rejected, trying again" cases.
      // We update its CategoryID instead of spawning a new row.
      const mutableApplication = await prisma.sellerApplications.findFirst({
        where: {
          SellerID: seller.SellerID,
          Status: { in: ['DRAFT', 'REJECTED'] },
        },
        orderBy: { CreatedAt: 'desc' },
      });

      if (mutableApplication) {
        application = await prisma.sellerApplications.update({
          where: { SellerApplicationID: mutableApplication.SellerApplicationID },
          data: {
            CategoryID: categoryId,
            // Preserve the admin's correction note (RejectionReason) in DRAFT state
            // so the seller can still see it. Only clear it on final resubmission.
            RejectionReason: mutableApplication.Status === 'DRAFT'
              ? mutableApplication.RejectionReason
              : null,
            UpdatedAt: new Date(),
          },
        });
      } else {
        // Step 3: No mutable application exists — create a fresh one
        application = await prisma.sellerApplications.create({
          data: {
            SellerID: seller.SellerID,
            CategoryID: categoryId,
            Status: 'DRAFT',
            CreatedAt: new Date(),
          },
        });
      }
    }

    // Record digital marketplace consent (idempotent)
    const existingConsent = await prisma.sellerConsents.findFirst({
      where: {
        SellerID: seller.SellerID,
        ConsentType: 'MARKETPLACE_SELLER_AGREEMENT',
      },
    });

    if (!existingConsent) {
      await prisma.sellerConsents.create({
        data: {
          SellerID: seller.SellerID,
          ConsentType: 'MARKETPLACE_SELLER_AGREEMENT',
          ConsentVersion: 'v1.0',
          IsGranted: true,
          GrantedAt: new Date(),
          Source: 'WEB_ONBOARDING',
          CreatedAt: new Date(),
        },
      });
    }

    return this.getOnboardingStatus(userId);
  }

  /**
   * Upload an individual KYC compliance document (GST, PAN, BANK_PROOF, etc.)
   */
  async uploadDocument(
    userId: bigint,
    documentTypeCode: string,
    certificateNumber: string | undefined,
    file: Express.Multer.File
  ) {
    const seller = await this.getSellerForUser(userId);
    if (!seller) {
      throw new BadRequestError('Please complete business profile setup before uploading documents');
    }

    // Resolve primary application (most recent mutable one)
    const application = await prisma.sellerApplications.findFirst({
      where: { SellerID: seller.SellerID },
      orderBy: { CreatedAt: 'desc' },
    });

    if (!application) {
      throw new BadRequestError('Active onboarding application not found. Please complete profile step.');
    }

    // Lookup DocumentType
    const docType = await prisma.documentTypes.findFirst({
      where: { Code: documentTypeCode },
    });

    if (!docType) {
      throw new BadRequestError(`Document type ${documentTypeCode} is not recognized`);
    }

    const { relativeUrl } = await storageService.saveFile(file);

    // Check if mandatory in either SellerDocumentRequirements or CategoryDocuments
    const baselineDocReq = await prisma.sellerDocumentRequirements.findFirst({
      where: {
        DocumentTypeID: docType.DocumentTypeID,
        IsActive: true,
      },
    });

    const effectiveCatDocs = await categoryInheritanceService.resolveEffectiveCategoryDocuments(application.CategoryID);
    const catDocReq = effectiveCatDocs.find((d) => d.documentTypeId === docType.DocumentTypeID);

    const isMandatory = (baselineDocReq?.IsRequired === true) || (catDocReq?.isMandatory === true);

    // Upsert into SellerApplicationDocuments
    const existingDoc = await prisma.sellerApplicationDocuments.findFirst({
      where: {
        SellerApplicationID: application.SellerApplicationID,
        DocumentTypeID: docType.DocumentTypeID,
      },
    });

    if (existingDoc) {
      await prisma.sellerApplicationDocuments.update({
        where: { SellerApplicationDocumentID: existingDoc.SellerApplicationDocumentID },
        data: {
          CertificateNumber: certificateNumber?.trim() || existingDoc.CertificateNumber,
          DocumentURL: relativeUrl,
          VerificationStatus: 'PENDING',
          RejectionReason: null,
          IsMandatory: isMandatory,
          UpdatedAt: new Date(),
        },
      });
    } else {
      await prisma.sellerApplicationDocuments.create({
        data: {
          SellerApplicationID: application.SellerApplicationID,
          DocumentTypeID: docType.DocumentTypeID,
          IsMandatory: isMandatory,
          CertificateNumber: certificateNumber?.trim() || null,
          DocumentURL: relativeUrl,
          VerificationStatus: 'PENDING',
          CreatedAt: new Date(),
        },
      });
    }

    return this.getOnboardingStatus(userId);
  }

  /**
   * Update certificate number without re-uploading file.
   */
  async updateCertificateNumber(userId: bigint, documentTypeCode: string, certificateNumber: string) {
    const seller = await this.getSellerForUser(userId);
    if (!seller) {
      throw new BadRequestError('Please complete business profile setup before saving certificate numbers');
    }

    const application = await prisma.sellerApplications.findFirst({
      where: { SellerID: seller.SellerID },
      orderBy: { CreatedAt: 'desc' },
    });

    if (!application) {
      throw new BadRequestError('Active onboarding application not found. Please complete profile step.');
    }

    const docType = await prisma.documentTypes.findFirst({
      where: { Code: documentTypeCode },
    });

    if (!docType) {
      throw new BadRequestError(`Document type ${documentTypeCode} is not recognized`);
    }

    const existingDoc = await prisma.sellerApplicationDocuments.findFirst({
      where: {
        SellerApplicationID: application.SellerApplicationID,
        DocumentTypeID: docType.DocumentTypeID,
      },
    });

    if (existingDoc) {
      await prisma.sellerApplicationDocuments.update({
        where: { SellerApplicationDocumentID: existingDoc.SellerApplicationDocumentID },
        data: {
          CertificateNumber: certificateNumber.trim() || null,
          UpdatedAt: new Date(),
        },
      });
    } else {
      const baselineDocReq = await prisma.sellerDocumentRequirements.findFirst({
        where: { DocumentTypeID: docType.DocumentTypeID, IsActive: true },
      });
      const effectiveCatDocs = await categoryInheritanceService.resolveEffectiveCategoryDocuments(application.CategoryID);
      const catDocReq = effectiveCatDocs.find((d) => d.documentTypeId === docType.DocumentTypeID);
      const isMandatory = (baselineDocReq?.IsRequired === true) || (catDocReq?.isMandatory === true);

      await prisma.sellerApplicationDocuments.create({
        data: {
          SellerApplicationID: application.SellerApplicationID,
          DocumentTypeID: docType.DocumentTypeID,
          IsMandatory: isMandatory,
          CertificateNumber: certificateNumber.trim() || null,
          DocumentURL: '',
          VerificationStatus: 'PENDING',
          CreatedAt: new Date(),
        },
      });
    }

    return this.getOnboardingStatus(userId);
  }

  /**
   * Final submission of the master application.
   * Clears the RejectionReason correction note on successful resubmission.
   */
  async submitApplication(userId: bigint) {
    const seller = await this.getSellerForUser(userId);
    if (!seller) {
      throw new BadRequestError('No seller profile found to submit');
    }

    const application = await prisma.sellerApplications.findFirst({
      where: { SellerID: seller.SellerID },
      orderBy: { CreatedAt: 'desc' },
      include: {
        SellerApplicationDocuments: {
          include: { DocumentTypes: true },
        },
      },
    });

    if (!application) {
      throw new BadRequestError('No application found to submit');
    }

    // Dynamically check mandatory documents configured in SellerDocumentRequirements and CategoryDocuments
    const baselineMandatory = await prisma.sellerDocumentRequirements.findMany({
      where: { IsActive: true, IsRequired: true },
      include: { DocumentTypes: true },
    });

    const effectiveCategoryDocs = await categoryInheritanceService.resolveEffectiveCategoryDocuments(application.CategoryID);

    const mandatoryDocTypeMap = new Map<number, string>();
    for (const b of baselineMandatory) {
      mandatoryDocTypeMap.set(b.DocumentTypeID, b.DocumentTypes.DisplayName);
    }
    for (const c of effectiveCategoryDocs.filter((d) => d.isMandatory)) {
      mandatoryDocTypeMap.set(c.documentTypeId, c.displayName);
    }

    const uploadedDocTypeIds = new Set(
      application.SellerApplicationDocuments.filter((d) => d.DocumentURL).map((d) => d.DocumentTypeID)
    );

    const missingNames: string[] = [];
    for (const [docTypeId, displayName] of mandatoryDocTypeMap.entries()) {
      if (!uploadedDocTypeIds.has(docTypeId)) {
        missingNames.push(displayName);
      }
    }

    if (missingNames.length > 0) {
      throw new BadRequestError(
        `Please upload all mandatory verification documents before submitting: ${missingNames.join(', ')}`
      );
    }

    // Transactionally update statuses and record audit log
    await prisma.$transaction(async (tx) => {
      await tx.sellers.update({
        where: { SellerID: seller.SellerID },
        data: {
          Status: 'PENDING_VERIFICATION',
          UpdatedAt: new Date(),
          UpdatedBy: userId,
        },
      });

      await tx.sellerApplications.update({
        where: { SellerApplicationID: application.SellerApplicationID },
        data: {
          Status: 'SUBMITTED',
          SubmittedAt: new Date(),
          // Clear the admin's correction note now that seller has resubmitted
          RejectionReason: null,
          UpdatedAt: new Date(),
        },
      });

      await tx.sellerStatusHistory.create({
        data: {
          SellerID: seller.SellerID,
          SellerApplicationID: application.SellerApplicationID,
          Status: 'PENDING_VERIFICATION',
          Comments: 'Master D2C entity application submitted by merchant for verification',
          ChangedBy: userId,
          ChangedAt: new Date(),
          CreatedAt: new Date(),
        },
      });
    });

    return this.getOnboardingStatus(userId);
  }
}

export const sellerOnboardingService = new SellerOnboardingService();
