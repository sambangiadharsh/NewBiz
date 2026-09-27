import bcrypt from 'bcryptjs';
import { prisma } from '../../database/prisma.js';
import { NotFoundError, BadRequestError } from '../../utils/errors.js';
import { generateSellerCode } from '../../utils/codeGenerator.js';

export class AdminSellersService {
  /**
   * List all seller onboarding applications with optional status filter
   */
  async listApplications(params: { status?: string; page?: number; limit?: number }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(50, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    // Admins NEVER see DRAFT applications — those are incomplete seller work-in-progress
    // Only show applications that have been submitted or acted upon
    const where: any = {
      Status: { not: 'DRAFT' },
    };
    if (params.status && params.status !== 'ALL') {
      where.Status = params.status; // override with specific status (already excludes DRAFT since admin won't filter by it)
    }

    const [total, applications] = await Promise.all([
      prisma.sellerApplications.count({ where }),
      prisma.sellerApplications.findMany({
        where,
        skip,
        take: limit,
        orderBy: { CreatedAt: 'desc' },
        include: {
          Sellers: true,
          Categories: true,
          SellerApplicationDocuments: {
            include: { DocumentTypes: true },
          },
        },
      }),
    ]);

    const data = applications.map((app) => ({
      applicationId: Number(app.SellerApplicationID),
      sellerId: Number(app.SellerID),
      sellerCode: app.Sellers.SellerCode,
      sellerName: app.Sellers.SellerName,
      businessName: app.Sellers.BusinessName,
      email: app.Sellers.Email,
      phoneNumber: app.Sellers.PhoneNumber,
      categoryName: app.Categories.CategoryName,
      status: app.Status,
      sellerStatus: app.Sellers.Status,
      submittedAt: app.SubmittedAt,
      reviewedAt: app.ReviewedAt,
      rejectionReason: app.RejectionReason,
      documentCount: app.SellerApplicationDocuments.length,
      verifiedDocumentCount: app.SellerApplicationDocuments.filter((d) => d.VerificationStatus === 'APPROVED').length,
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
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.status && params.status !== 'ALL') {
      where.Status = params.status;
    } else {
      where.Status = 'ACTIVE';
    }

    const [total, sellers] = await Promise.all([
      prisma.sellers.count({ where }),
      prisma.sellers.findMany({
        where,
        skip,
        take: limit,
        orderBy: { CreatedAt: 'desc' },
        include: {
          SellerApplications: {
            take: 1,
            orderBy: { CreatedAt: 'desc' },
            include: {
              Categories: true,
              SellerApplicationDocuments: true,
            },
          },
        },
      }),
    ]);

    const items = sellers.map((seller) => {
      const latestApp = seller.SellerApplications[0];
      const docs = latestApp?.SellerApplicationDocuments || [];
      return {
        applicationId: latestApp ? Number(latestApp.SellerApplicationID) : null,
        sellerId: Number(seller.SellerID),
        sellerCode: seller.SellerCode,
        sellerName: seller.SellerName,
        businessName: seller.BusinessName,
        email: seller.Email,
        phoneNumber: seller.PhoneNumber,
        categoryName: latestApp?.Categories?.CategoryName || 'General Marketplace',
        status: latestApp?.Status || 'APPROVED',
        sellerStatus: seller.Status,
        reviewedAt: latestApp?.ReviewedAt || seller.CreatedAt,
        documentCount: docs.length,
        verifiedDocumentCount: docs.filter((d) => d.VerificationStatus === 'APPROVED').length,
      };
    });

    return {
      items,
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
    const app = await prisma.sellerApplications.findUnique({
      where: { SellerApplicationID: applicationId },
      include: {
        Sellers: {
          include: {
            SellerConsents: true,
            SellerStatusHistory: {
              where: { SellerApplicationID: applicationId }, // ✅ filter to this application only
              orderBy: { ChangedAt: 'desc' },
              include: { Users: true },
            },
          },
        },
        Categories: true,
        SellerApplicationDocuments: {
          include: { DocumentTypes: true, Users: true },
        },
        Users: true, // ReviewedBy
      },
    });

    if (!app) {
      throw new NotFoundError('Seller application not found');
    }

    return {
      applicationId: Number(app.SellerApplicationID),
      status: app.Status,
      submittedAt: app.SubmittedAt,
      reviewedAt: app.ReviewedAt,
      rejectionReason: app.RejectionReason,
      reviewedBy: app.Users ? `${app.Users.FirstName} ${app.Users.LastName}` : null,
      seller: {
        sellerId: Number(app.Sellers.SellerID),
        sellerCode: app.Sellers.SellerCode,
        sellerName: app.Sellers.SellerName,
        businessName: app.Sellers.BusinessName,
        email: app.Sellers.Email,
        phoneNumber: app.Sellers.PhoneNumber,
        instagramUrl: app.Sellers.InstagramURL,
        facebookUrl: app.Sellers.FacebookURL,
        status: app.Sellers.Status,
        createdAt: app.Sellers.CreatedAt,
      },
      category: {
        categoryId: Number(app.Categories.CategoryID),
        categoryName: app.Categories.CategoryName,
      },
      documents: app.SellerApplicationDocuments.map((doc) => ({
        documentId: Number(doc.SellerApplicationDocumentID),
        code: doc.DocumentTypes.Code,
        displayName: doc.DocumentTypes.DisplayName,
        certificateNumber: doc.CertificateNumber,
        documentUrl: doc.DocumentURL,
        verificationStatus: doc.VerificationStatus,
        rejectionReason: doc.RejectionReason,
        verifiedAt: doc.VerifiedAt,
        verifiedBy: doc.Users ? `${doc.Users.FirstName} ${doc.Users.LastName}` : null,
        isMandatory: doc.IsMandatory,
      })),
      consents: app.Sellers.SellerConsents.map((c) => ({
        consentId: Number(c.SellerConsentID),
        type: c.ConsentType,
        isGranted: c.IsGranted,
        grantedAt: c.GrantedAt,
      })),
      statusHistory: app.Sellers.SellerStatusHistory.map((h) => ({
        historyId: Number(h.SellerStatusHistoryID),
        status: h.Status,
        comments: h.Comments,
        changedAt: h.ChangedAt,
        changedBy: `${h.Users.FirstName} ${h.Users.LastName}`,
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
    const doc = await prisma.sellerApplicationDocuments.findUnique({
      where: { SellerApplicationDocumentID: docId },
    });

    if (!doc) {
      throw new NotFoundError('Document record not found');
    }

    const updated = await prisma.sellerApplicationDocuments.update({
      where: { SellerApplicationDocumentID: docId },
      data: {
        VerificationStatus: status,
        RejectionReason: status === 'REJECTED' ? rejectionReason || 'Document rejected by reviewer' : null,
        VerifiedBy: adminUserId,
        VerifiedAt: new Date(),
        UpdatedAt: new Date(),
      },
      include: { DocumentTypes: true },
    });

    return {
      documentId: Number(updated.SellerApplicationDocumentID),
      code: updated.DocumentTypes.Code,
      displayName: updated.DocumentTypes.DisplayName,
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
    const app = await prisma.sellerApplications.findUnique({
      where: { SellerApplicationID: applicationId },
      include: { Sellers: true },
    });

    if (!app) {
      throw new NotFoundError('Application record not found');
    }

    if (decision === 'APPROVE') {
      await prisma.$transaction(async (tx) => {
        // Update application
        await tx.sellerApplications.update({
          where: { SellerApplicationID: applicationId },
          data: {
            Status: 'APPROVED',
            ReviewedAt: new Date(),
            ReviewedBy: adminUserId,
            RejectionReason: null,
            UpdatedAt: new Date(),
          },
        });

        // Update seller status to ACTIVE
        await tx.sellers.update({
          where: { SellerID: app.SellerID },
          data: {
            Status: 'ACTIVE',
            UpdatedAt: new Date(),
            UpdatedBy: adminUserId,
          },
        });

        // Add to history
        await tx.sellerStatusHistory.create({
          data: {
            SellerID: app.SellerID,
            SellerApplicationID: applicationId,
            Status: 'ACTIVE',
            Comments: 'Application and legal KYC approved by platform administrator',
            ChangedBy: adminUserId,
            ChangedAt: new Date(),
            CreatedAt: new Date(),
          },
        });
      });
    } else {
      await prisma.$transaction(async (tx) => {
        await tx.sellerApplications.update({
          where: { SellerApplicationID: applicationId },
          data: {
            Status: 'REJECTED',
            ReviewedAt: new Date(),
            ReviewedBy: adminUserId,
            RejectionReason: rejectionReason || 'Application rejected by platform administrator',
            UpdatedAt: new Date(),
          },
        });

        await tx.sellers.update({
          where: { SellerID: app.SellerID },
          data: {
            Status: 'REJECTED',
            UpdatedAt: new Date(),
            UpdatedBy: adminUserId,
          },
        });

        await tx.sellerStatusHistory.create({
          data: {
            SellerID: app.SellerID,
            SellerApplicationID: applicationId,
            Status: 'REJECTED',
            Comments: rejectionReason || 'Application rejected by administrator',
            ChangedBy: adminUserId,
            ChangedAt: new Date(),
            CreatedAt: new Date(),
          },
        });
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
    const app = await prisma.sellerApplications.findUnique({
      where: { SellerApplicationID: applicationId },
      include: {
        Sellers: true,
        SellerApplicationDocuments: true,
      },
    });

    if (!app) {
      throw new NotFoundError('Application record not found');
    }

    if (app.Status === 'APPROVED') {
      throw new Error('Approved applications cannot be sent back for correction');
    }

    await prisma.$transaction(async (tx) => {
      // Reset application to DRAFT with correction note stored as RejectionReason so seller sees it
      await tx.sellerApplications.update({
        where: { SellerApplicationID: applicationId },
        data: {
          Status: 'DRAFT',
          RejectionReason: correctionNote || 'Please review and re-upload the flagged documents.',
          UpdatedAt: new Date(),
        },
      });

      // Reset seller status to DRAFT
      await tx.sellers.update({
        where: { SellerID: app.SellerID },
        data: {
          Status: 'DRAFT',
          UpdatedAt: new Date(),
          UpdatedBy: adminUserId,
        },
      });

      // Reset ONLY REJECTED documents back to PENDING — APPROVED docs stay APPROVED
      const rejectedDocIds = app.SellerApplicationDocuments
        .filter((d) => d.VerificationStatus === 'REJECTED')
        .map((d) => d.SellerApplicationDocumentID);

      if (rejectedDocIds.length > 0) {
        await tx.sellerApplicationDocuments.updateMany({
          where: {
            SellerApplicationDocumentID: { in: rejectedDocIds },
          },
          data: {
            VerificationStatus: 'PENDING',
            UpdatedAt: new Date(),
          },
        });
      }

      // Audit log entry
      await tx.sellerStatusHistory.create({
        data: {
          SellerID: app.SellerID,
          SellerApplicationID: applicationId,
          Status: 'DRAFT',
          Comments: `Sent back for correction by administrator. ${rejectedDocIds.length} document(s) reset. Note: "${correctionNote || 'Please fix flagged documents and resubmit.'}"`,
          ChangedBy: adminUserId,
          ChangedAt: new Date(),
          CreatedAt: new Date(),
        },
      });
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
    const existingSeller = await prisma.sellers.findFirst({
      where: { Email: input.email },
    });
    if (existingSeller) {
      throw new BadRequestError(`A merchant with email "${input.email}" is already registered (${existingSeller.SellerCode})`);
    }

    const categoryId = BigInt(input.primaryCategoryId);
    const category = await prisma.categories.findUnique({
      where: { CategoryID: categoryId },
    });
    if (!category) {
      throw new BadRequestError('Selected category does not exist');
    }

    const tempPassword = input.temporaryPassword?.trim() || 'Seller@123';
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    const uniqueCode = await generateSellerCode(prisma);
    const isApproved = input.initialStatus === 'APPROVED';

    const result = await prisma.$transaction(async (tx) => {
      // 1. Resolve or create the User account for the seller
      let user = await tx.users.findFirst({
        where: { Email: input.email },
      });

      if (!user) {
        user = await tx.users.create({
          data: {
            FirstName: input.sellerName,
            LastName: 'Merchant',
            Email: input.email,
            PhoneNumber: input.phoneNumber,
            PasswordHash: passwordHash,
            Status: 'ACTIVE',
            CreatedAt: new Date(),
            CreatedBy: adminUserId,
          },
        });
      }

      // Assign SELLER_USER role if not already assigned
      const sellerRole = await tx.roles.findFirst({
        where: { RoleName: 'SELLER_USER' },
      });
      if (sellerRole) {
        const hasRole = await tx.userRoles.findFirst({
          where: { UserID: user.UserID, RoleID: sellerRole.RoleID },
        });
        if (!hasRole) {
          await tx.userRoles.create({
            data: {
              UserID: user.UserID,
              RoleID: sellerRole.RoleID,
              CreatedAt: new Date(),
            },
          });
        }
      }

      // 2. Create the Seller record
      const seller = await tx.sellers.create({
        data: {
          SellerCode: uniqueCode,
          SellerName: input.sellerName,
          BusinessName: input.businessName,
          Email: input.email,
          PhoneNumber: input.phoneNumber,
          InstagramURL: input.instagramUrl || null,
          FacebookURL: input.facebookUrl || null,
          Status: isApproved ? 'ACTIVE' : 'DRAFT',
          CreatedAt: new Date(),
          CreatedBy: adminUserId,
        },
      });

      // 3. Link User to Seller
      await tx.sellerUsers.create({
        data: {
          SellerID: seller.SellerID,
          UserID: user.UserID,
          Status: 'ACTIVE',
          CreatedAt: new Date(),
          CreatedBy: adminUserId,
        },
      });

      // 4. Create SellerApplication
      const application = await tx.sellerApplications.create({
        data: {
          SellerID: seller.SellerID,
          CategoryID: categoryId,
          Status: isApproved ? 'APPROVED' : 'SUBMITTED',
          SubmittedAt: new Date(),
          ReviewedAt: isApproved ? new Date() : null,
          ReviewedBy: isApproved ? adminUserId : null,
          CreatedAt: new Date(),
        },
      });

      // 5. Grant Marketplace Seller Agreement consent
      await tx.sellerConsents.create({
        data: {
          SellerID: seller.SellerID,
          ConsentType: 'MARKETPLACE_SELLER_AGREEMENT',
          ConsentVersion: 'v1.0',
          IsGranted: true,
          GrantedAt: new Date(),
          Source: 'ADMIN_ASSISTED',
          CreatedAt: new Date(),
        },
      });

      // 6. Initialize category compliance documents
      const catDocs = await tx.categoryDocuments.findMany({
        where: { CategoryID: categoryId, Status: 'ACTIVE' },
        include: { DocumentTypes: true },
      });

      for (const cd of catDocs) {
        let certNumber = '';
        if (cd.DocumentTypes.Code === 'GST' && input.gstNumber) {
          certNumber = input.gstNumber;
        } else if (cd.DocumentTypes.Code === 'PAN' && input.panNumber) {
          certNumber = input.panNumber;
        } else if (isApproved) {
          certNumber = 'VERIFIED-BY-ADMIN';
        }

        await tx.sellerApplicationDocuments.create({
          data: {
            SellerApplicationID: application.SellerApplicationID,
            DocumentTypeID: cd.DocumentTypeID,
            CertificateNumber: certNumber || null,
            DocumentURL: isApproved ? '/uploads/seller-documents/admin-verified.pdf' : null,
            VerificationStatus: isApproved ? 'APPROVED' : 'PENDING',
            IsMandatory: cd.IsMandatory,
            VerifiedBy: isApproved ? adminUserId : null,
            VerifiedAt: isApproved ? new Date() : null,
            CreatedAt: new Date(),
          },
        });
      }

      // 7. Record in audit history
      await tx.sellerStatusHistory.create({
        data: {
          SellerID: seller.SellerID,
          SellerApplicationID: application.SellerApplicationID,
          Status: isApproved ? 'ACTIVE' : 'PENDING_VERIFICATION',
          Comments: `Merchant onboarded via Admin Assisted Onboarding by platform administrator (Initial status: ${input.initialStatus})`,
          ChangedBy: adminUserId,
          ChangedAt: new Date(),
          CreatedAt: new Date(),
        },
      });

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
