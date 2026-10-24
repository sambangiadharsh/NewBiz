import { withTransaction } from '../../database/db.js';
import { BadRequestError } from '../../utils/errors.js';
import { storageService } from '../../services/storage/StorageService.js';
import { MasterProfileInput } from './sellerOnboarding.validation.js';
import { categoryInheritanceService } from '../../services/categoryInheritance.service.js';
import { generateSellerCode } from '../../utils/codeGenerator.js';
import { sellerOnboardingRepository } from './sellerOnboarding.repository.js';

export class SellerOnboardingService {
  /**
   * Helper to resolve the seller linked to an authenticated user
   */
  async getSellerForUser(userId: bigint) {
    return sellerOnboardingRepository.getSellerForUser(userId);
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
      const baselineReqs = await sellerOnboardingRepository.getBaselineRequirements();
      const requiredDocuments = baselineReqs.map((b) => ({
        documentTypeId: b.DocumentTypeID,
        code: b.Code,
        displayName: b.DisplayName,
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

    const sellerId = BigInt(seller.SellerID);

    // Fetch all applications for this seller
    const allApplications = await sellerOnboardingRepository.getAllSellerApplications(sellerId);

    // Primary application: prioritize APPROVED application, or fallback to the latest
    const primaryApplication =
      allApplications.find((a) => a.Status === 'APPROVED') || allApplications[0] || null;

    const consents = await sellerOnboardingRepository.getSellerConsents(sellerId);
    const statusHistory = await sellerOnboardingRepository.getSellerStatusHistory(sellerId);

    // 1. Fetch platform baseline seller document requirements
    const baselineReqs = await sellerOnboardingRepository.getBaselineRequirements();

    // 2. Fetch category-specific document requirements via hierarchy inheritance
    let catDocs: Array<any> = [];
    if (primaryApplication) {
      catDocs = await categoryInheritanceService.resolveEffectiveCategoryDocuments(BigInt(primaryApplication.CategoryID));
    }

    // 3. Merge baseline and category-specific requirements into a unified list
    const docMap = new Map<
      number,
      {
        documentTypeId: number;
        code: string;
        displayName: string;
        isMandatory: boolean;
        source: string;
      }
    >();

    for (const b of baselineReqs) {
      docMap.set(b.DocumentTypeID, {
        documentTypeId: b.DocumentTypeID,
        code: b.Code,
        displayName: b.DisplayName,
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
    const primaryDocs: any[] = primaryApplication?.DocumentsJson ? JSON.parse(primaryApplication.DocumentsJson) : [];
    for (const doc of primaryDocs) {
      documentMap.set(doc.Code, {
        documentId: Number(doc.SellerApplicationDocumentID),
        code: doc.Code,
        displayName: doc.DisplayName,
        certificateNumber: doc.CertificateNumber,
        documentUrl: doc.DocumentURL,
        verificationStatus: doc.VerificationStatus,
        rejectionReason: doc.RejectionReason,
        isMandatory: doc.IsMandatory,
      });
    }

    for (const app of allApplications) {
      const appDocs: any[] = app.DocumentsJson ? JSON.parse(app.DocumentsJson) : [];
      for (const doc of appDocs) {
        if (!documentMap.has(doc.Code)) {
          documentMap.set(doc.Code, {
            documentId: Number(doc.SellerApplicationDocumentID),
            code: doc.Code,
            displayName: doc.DisplayName,
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
    const applications = allApplications.map((app) => {
      const appDocs: any[] = app.DocumentsJson ? JSON.parse(app.DocumentsJson) : [];
      return {
        applicationId: Number(app.SellerApplicationID),
        categoryId: Number(app.CategoryID),
        categoryName: app.CategoryName,
        categoryCode: app.CategoryCode,
        status: app.Status,
        submittedAt: app.SubmittedAt,
        reviewedAt: app.ReviewedAt,
        rejectionReason: app.RejectionReason,
        documents: appDocs.map((doc: any) => ({
          documentId: Number(doc.SellerApplicationDocumentID),
          code: doc.Code,
          displayName: doc.DisplayName,
          certificateNumber: doc.CertificateNumber,
          documentUrl: doc.DocumentURL,
          verificationStatus: doc.VerificationStatus,
          rejectionReason: doc.RejectionReason,
          isMandatory: doc.IsMandatory,
        })),
      };
    });

    const activeCategories = allApplications
      .filter((a) => a.Status === 'APPROVED')
      .map((a) => ({
        categoryId: Number(a.CategoryID),
        categoryName: a.CategoryName,
        categoryCode: a.CategoryCode,
        approvedAt: a.ReviewedAt,
      }));

    const pendingCategories = allApplications
      .filter((a) => a.Status === 'SUBMITTED' || a.Status === 'PENDING')
      .map((a) => ({
        categoryId: Number(a.CategoryID),
        categoryName: a.CategoryName,
        categoryCode: a.CategoryCode,
        submittedAt: a.SubmittedAt,
      }));

    const isMerchantActive = seller.Status === 'ACTIVE';

    // Derive: was the primary application sent back for correction by admin?
    const isSentBack =
      !isMerchantActive &&
      primaryApplication?.Status === 'DRAFT' &&
      primaryApplication.RejectionReason != null &&
      primaryApplication.RejectionReason.trim().length > 0;

    // Calculate effective onboarding status
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
            categoryName: primaryApplication.CategoryName,
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
        changedBy: h.FirstName ? `${h.FirstName} ${h.LastName || ''}`.trim() : 'System / Merchant',
      })),
    };
  }

  /**
   * Save or update master D2C company profile and link primary category.
   */
  async saveMasterProfile(userId: bigint, input: MasterProfileInput) {
    let seller = await this.getSellerForUser(userId);

    if (!seller) {
      // Create new Seller entity (first-time registration)
      const uniqueCode = await generateSellerCode();

      seller = await withTransaction(async (tx) => {
        return sellerOnboardingRepository.createSellerWithUser(
          {
            sellerCode: uniqueCode,
            sellerName: input.sellerName,
            businessName: input.businessName,
            email: input.email,
            phoneNumber: input.phoneNumber,
            instagramUrl: input.instagramUrl || null,
            facebookUrl: input.facebookUrl || null,
            youtubeUrl: input.youtubeUrl || null,
            linkedinUrl: input.linkedinUrl || null,
            userId,
          },
          tx
        );
      });
    } else {
      // Update existing seller profile fields
      seller = await sellerOnboardingRepository.updateSellerProfile(BigInt(seller.SellerID), userId, {
        sellerName: input.sellerName,
        businessName: input.businessName,
        email: input.email,
        phoneNumber: input.phoneNumber,
        instagramUrl: input.instagramUrl || null,
        facebookUrl: input.facebookUrl || null,
        youtubeUrl: input.youtubeUrl || null,
        linkedinUrl: input.linkedinUrl || null,
      });
    }

    const sellerId = BigInt(seller.SellerID);
    const categoryId = BigInt(input.primaryCategoryId);

    // Verify category exists
    const category = await sellerOnboardingRepository.findCategoryById(categoryId);
    if (!category) {
      throw new BadRequestError('Selected primary category does not exist');
    }

    // Step 1: Look for an existing application with the exact same category
    let application = await sellerOnboardingRepository.findApplicationBySellerAndCategory(sellerId, categoryId);

    if (!application) {
      // Step 2: Look for any mutable (DRAFT or REJECTED) application to reuse.
      const mutableApplication = await sellerOnboardingRepository.findMutableApplication(sellerId);

      if (mutableApplication) {
        const rejectionReason = mutableApplication.Status === 'DRAFT'
          ? mutableApplication.RejectionReason
          : null;

        application = await sellerOnboardingRepository.updateApplicationCategory(
          BigInt(mutableApplication.SellerApplicationID),
          categoryId,
          rejectionReason
        );
      } else {
        // Step 3: No mutable application exists — create a fresh one
        application = await sellerOnboardingRepository.createApplication(sellerId, categoryId, 'DRAFT');
      }
    }

    // Record digital marketplace consent (idempotent)
    const existingConsent = await sellerOnboardingRepository.findConsent(sellerId, 'MARKETPLACE_SELLER_AGREEMENT');
    if (!existingConsent) {
      await sellerOnboardingRepository.createConsent({
        sellerId,
        consentType: 'MARKETPLACE_SELLER_AGREEMENT',
        consentVersion: 'v1.0',
        source: 'WEB_ONBOARDING',
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

    const sellerId = BigInt(seller.SellerID);

    // Resolve primary application (most recent mutable one)
    const application = await sellerOnboardingRepository.getLatestApplication(sellerId);
    if (!application) {
      throw new BadRequestError('Active onboarding application not found. Please complete profile step.');
    }

    const applicationId = BigInt(application.SellerApplicationID);

    // Lookup DocumentType
    const docType = await sellerOnboardingRepository.findDocumentTypeByCode(documentTypeCode);
    if (!docType) {
      throw new BadRequestError(`Document type ${documentTypeCode} is not recognized`);
    }

    const { relativeUrl } = await storageService.saveFile(file);

    // Check if mandatory in either SellerDocumentRequirements or CategoryDocuments
    const baselineDocReq = await sellerOnboardingRepository.findBaselineDocRequirement(docType.DocumentTypeID);

    const effectiveCatDocs = await categoryInheritanceService.resolveEffectiveCategoryDocuments(BigInt(application.CategoryID));
    const catDocReq = effectiveCatDocs.find((d) => d.documentTypeId === docType.DocumentTypeID);

    const isMandatory = (baselineDocReq?.IsRequired === true) || (catDocReq?.isMandatory === true);

    // Upsert into SellerApplicationDocuments
    const existingDoc = await sellerOnboardingRepository.findApplicationDocument(applicationId, docType.DocumentTypeID);

    if (existingDoc) {
      await sellerOnboardingRepository.updateApplicationDocument(BigInt(existingDoc.SellerApplicationDocumentID), {
        certificateNumber: certificateNumber?.trim() || existingDoc.CertificateNumber,
        documentUrl: relativeUrl,
        isMandatory,
      });
    } else {
      await sellerOnboardingRepository.createApplicationDocument({
        applicationId,
        documentTypeId: docType.DocumentTypeID,
        isMandatory,
        certificateNumber: certificateNumber?.trim() || null,
        documentUrl: relativeUrl,
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

    const sellerId = BigInt(seller.SellerID);
    const application = await sellerOnboardingRepository.getLatestApplication(sellerId);
    if (!application) {
      throw new BadRequestError('Active onboarding application not found. Please complete profile step.');
    }

    const applicationId = BigInt(application.SellerApplicationID);

    const docType = await sellerOnboardingRepository.findDocumentTypeByCode(documentTypeCode);
    if (!docType) {
      throw new BadRequestError(`Document type ${documentTypeCode} is not recognized`);
    }

    const existingDoc = await sellerOnboardingRepository.findApplicationDocument(applicationId, docType.DocumentTypeID);

    if (existingDoc) {
      await sellerOnboardingRepository.updateApplicationDocument(BigInt(existingDoc.SellerApplicationDocumentID), {
        certificateNumber: certificateNumber.trim() || null,
      });
    } else {
      const baselineDocReq = await sellerOnboardingRepository.findBaselineDocRequirement(docType.DocumentTypeID);
      const effectiveCatDocs = await categoryInheritanceService.resolveEffectiveCategoryDocuments(BigInt(application.CategoryID));
      const catDocReq = effectiveCatDocs.find((d) => d.documentTypeId === docType.DocumentTypeID);
      const isMandatory = (baselineDocReq?.IsRequired === true) || (catDocReq?.isMandatory === true);

      await sellerOnboardingRepository.createApplicationDocument({
        applicationId,
        documentTypeId: docType.DocumentTypeID,
        isMandatory,
        certificateNumber: certificateNumber.trim() || null,
        documentUrl: '',
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

    const sellerId = BigInt(seller.SellerID);
    const application = await sellerOnboardingRepository.getLatestApplication(sellerId);
    if (!application) {
      throw new BadRequestError('No application found to submit');
    }

    const applicationId = BigInt(application.SellerApplicationID);

    // Dynamically check mandatory documents configured in SellerDocumentRequirements and CategoryDocuments
    const baselineMandatory = (await sellerOnboardingRepository.getBaselineRequirements()).filter((b) => b.IsRequired);
    const effectiveCategoryDocs = await categoryInheritanceService.resolveEffectiveCategoryDocuments(BigInt(application.CategoryID));

    const mandatoryDocTypeMap = new Map<number, string>();
    for (const b of baselineMandatory) {
      mandatoryDocTypeMap.set(b.DocumentTypeID, b.DisplayName);
    }
    for (const c of effectiveCategoryDocs.filter((d) => d.isMandatory)) {
      mandatoryDocTypeMap.set(c.documentTypeId, c.displayName);
    }

    const uploadedDocs = await sellerOnboardingRepository.getUploadedDocumentsForApplication(applicationId);
    const uploadedDocTypeIds = new Set(
      uploadedDocs.filter((d) => d.DocumentURL && d.DocumentURL.trim().length > 0).map((d) => d.DocumentTypeID)
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
    await withTransaction(async (tx) => {
      await sellerOnboardingRepository.submitApplicationTransaction(sellerId, applicationId, userId, tx);
    });

    return this.getOnboardingStatus(userId);
  }
}

export const sellerOnboardingService = new SellerOnboardingService();
