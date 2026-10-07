import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { withTransaction } from '../../database/db.js';
import { BadRequestError, ConflictError, NotFoundError, ForbiddenError } from '../../utils/errors.js';
import { storageService } from '../../services/storage/StorageService.js';
import { config } from '../../config/index.js';
import { mailService } from '../../utils/mailService.js';
import { authRepository } from '../auth/auth.repository.js';
import { JwtPayload } from '../../types/auth.js';
import {
  CreateWarehouseInput,
  CreateSellerWarehouseInput,
  UpdateWarehouseInput,
  UploadWarehouseDocumentInput,
  AssignWarehouseUserInput,
  CreateWarehouseInviteInput,
  RegisterAndAcceptInviteInput,
} from './warehouses.validation.js';
import { generateWarehouseCode, generatePlatformWarehouseCode } from '../../utils/codeGenerator.js';
import { warehousesRepository } from './warehouses.repository.js';

export class WarehousesService {
  /**
   * Helper: Resolve and validate active seller entity for a user
   */
  private async getActiveSellerForUser(userId: bigint) {
    const seller = await warehousesRepository.getActiveSellerForUser(userId);

    if (!seller || seller.Status !== 'ACTIVE') {
      throw new ForbiddenError(
        'Active seller profile required. Please complete seller registration and wait for admin approval.'
      );
    }

    return seller;
  }

  /**
   * List all warehouses with filters, search, and counts
   */
  async listWarehouses(params: {
    type?: string;
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));

    const { total, items } = await warehousesRepository.listWarehouses({
      type: params.type,
      status: params.status,
      search: params.search,
      page,
      limit,
    });

    const formatted = items.map((wh) => {
      const associatedSellers: any[] = wh.AssociatedSellersJson ? JSON.parse(wh.AssociatedSellersJson) : [];

      return {
        warehouseId: Number(wh.WarehouseID),
        warehouseName: wh.WarehouseName,
        warehouseCode: wh.WarehouseCode,
        warehouseType: wh.WarehouseType,
        contactPersonName: wh.ContactPersonName,
        contactEmail: wh.ContactEmail,
        contactPhoneNumber: wh.ContactPhoneNumber,
        addressLine1: wh.AddressLine1,
        addressLine2: wh.AddressLine2,
        city: wh.City,
        state: wh.State,
        postalCode: wh.PostalCode,
        country: wh.Country,
        latitude: wh.Latitude ? Number(wh.Latitude) : null,
        longitude: wh.Longitude ? Number(wh.Longitude) : null,
        status: wh.Status,
        createdAt: wh.CreatedAt,
        activeStaffCount: Number(wh.ActiveStaffCount),
        connectedSellersCount: Number(wh.ConnectedSellersCount),
        totalProductsCount: Number(wh.TotalProductsCount),
        associatedSellers: associatedSellers.map((sw: any) => ({
          sellerWarehouseId: Number(sw.SellerWarehouseID),
          sellerId: Number(sw.SellerID),
          sellerCode: sw.SellerCode,
          sellerName: sw.SellerName,
          businessName: sw.BusinessName,
          email: sw.Email,
          phoneNumber: sw.PhoneNumber,
          relationshipStatus: sw.RelationshipStatus,
          isPrimary: sw.IsPrimary,
        })),
      };
    });

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
   * Get single warehouse with full details, staff members, and associated sellers
   */
  async getWarehouseById(warehouseId: bigint) {
    const wh = await warehousesRepository.getWarehouseById(warehouseId);
    if (!wh) {
      throw new NotFoundError('Warehouse facility not found');
    }

    // Extract latest rejection reason if REJECTED
    let rejectionReason: string | null = null;
    let latestStatusComment: string | null = null;
    const statusHistory = await this.getWarehouseStatusHistory(warehouseId);
    if (statusHistory.length > 0) {
      latestStatusComment = statusHistory[0].comments;
      if (wh.Status === 'REJECTED' && !rejectionReason) {
        rejectionReason = statusHistory[0].comments;
      }
    }
    if (wh.Status === 'REJECTED' && !rejectionReason) {
      const log = await warehousesRepository.findLatestAuditLogRejectionReason(warehouseId);
      if (log?.NewData) {
        try {
          const parsed = JSON.parse(log.NewData);
          rejectionReason = parsed.rejectionReason || null;
        } catch {}
      }
    }

    const staffMembersRaw: any[] = wh.StaffMembersJson ? JSON.parse(wh.StaffMembersJson) : [];
    const staffMembers = staffMembersRaw.map((wu: any) => ({
      warehouseUserId: Number(wu.WarehouseUserID),
      userId: Number(wu.UserID),
      firstName: wu.FirstName,
      lastName: wu.LastName,
      email: wu.Email,
      phoneNumber: wu.PhoneNumber,
      status: wu.Status,
      assignedAt: wu.AssignedAt,
    }));

    const reqDocs = await warehousesRepository.getWarehouseDocumentRequirements(wh.WarehouseType);
    const requiredDocuments = reqDocs.map((r) => ({
      documentTypeId: r.DocumentTypeID,
      code: r.Code,
      displayName: r.DisplayName,
      warehouseType: r.WarehouseType,
      isRequired: r.IsRequired,
    }));

    const sellerWarehousesRaw: any[] = wh.SellerWarehousesJson ? JSON.parse(wh.SellerWarehousesJson) : [];
    const associatedSellers = sellerWarehousesRaw.map((sw: any) => {
      let docs: any[] = [];
      if (Array.isArray(sw.DocumentsJson)) {
        docs = sw.DocumentsJson;
      } else if (typeof sw.DocumentsJson === 'string') {
        try {
          docs = JSON.parse(sw.DocumentsJson);
        } catch {
          docs = [];
        }
      }
      return {
        sellerWarehouseId: Number(sw.SellerWarehouseID),
        sellerId: Number(sw.SellerID),
        sellerCode: sw.SellerCode,
        sellerName: sw.SellerName,
        businessName: sw.BusinessName,
        email: sw.Email,
        phoneNumber: sw.PhoneNumber,
        relationshipStatus: sw.Status,
        isPrimary: sw.IsPrimary,
        documents: docs.map((doc: any) => ({
          sellerWarehouseDocumentId: Number(doc.SellerWarehouseDocumentID),
          documentTypeId: doc.DocumentTypeID,
          code: doc.Code,
          displayName: doc.DisplayName,
          documentNumber: doc.DocumentNumber,
          documentUrl: doc.DocumentURL,
          verificationStatus: doc.VerificationStatus,
          rejectionReason: doc.RejectionReason,
          isMandatory: doc.IsMandatory,
          verifiedAt: doc.VerifiedAt,
        })),
      };
    });

    const warehouseDocsRaw: any[] = wh.WarehouseDocumentsJson ? JSON.parse(wh.WarehouseDocumentsJson) : [];
    const complianceDocuments = warehouseDocsRaw.map((doc: any) => ({
      sellerWarehouseDocumentId: Number(doc.SellerWarehouseDocumentID),
      sellerWarehouseId: Number(doc.SellerWarehouseID),
      documentTypeId: doc.DocumentTypeID,
      code: doc.Code,
      displayName: doc.DisplayName,
      documentNumber: doc.DocumentNumber,
      documentUrl: doc.DocumentURL,
      verificationStatus: doc.VerificationStatus,
      rejectionReason: doc.RejectionReason,
      isMandatory: doc.IsMandatory,
      verifiedAt: doc.VerifiedAt,
      sellerName: doc.SellerName,
      sellerCode: doc.SellerCode,
    }));

    const consentsRaw: any[] = wh.ConsentsJson ? JSON.parse(wh.ConsentsJson) : [];
    const consents = consentsRaw.map((c: any) => ({
      warehouseConsentId: Number(c.WarehouseConsentID),
      consentId: Number(c.WarehouseConsentID),
      consentType: c.ConsentType,
      type: c.ConsentType,
      consentVersion: c.ConsentVersion,
      version: c.ConsentVersion,
      isGranted: Boolean(c.IsGranted),
      grantedAt: c.GrantedAt,
      createdAt: c.CreatedAt || c.GrantedAt,
    }));

    return {
      warehouseId: Number(wh.WarehouseID),
      warehouseName: wh.WarehouseName,
      warehouseCode: wh.WarehouseCode,
      warehouseType: wh.WarehouseType,
      contactPersonName: wh.ContactPersonName,
      contactEmail: wh.ContactEmail,
      contactPhoneNumber: wh.ContactPhoneNumber,
      addressLine1: wh.AddressLine1,
      addressLine2: wh.AddressLine2,
      city: wh.City,
      state: wh.State,
      postalCode: wh.PostalCode,
      country: wh.Country,
      latitude: wh.Latitude ? Number(wh.Latitude) : null,
      longitude: wh.Longitude ? Number(wh.Longitude) : null,
      status: wh.Status,
      rejectionReason,
      latestStatusComment,
      createdAt: wh.CreatedAt,
      updatedAt: wh.UpdatedAt,
      connectedSellersCount: Number(wh.ConnectedSellersCount),
      totalProductsCount: Number(wh.TotalProductsCount),
      activeStaffCount: staffMembers.filter((s) => s.status === 'ACTIVE').length,
      staffMembers,
      associatedSellers,
      complianceDocuments,
      requiredDocuments,
      consents,
      statusHistory,
    };
  }

  /**
   * Admin creates a platform or 3PL warehouse facility
   */
  async createWarehouse(adminUserId: bigint, input: CreateWarehouseInput) {
    const existing = await warehousesRepository.findWarehouseByNameOrCode(input.warehouseName);
    if (existing) {
      throw new ConflictError(`Warehouse facility "${input.warehouseName}" already exists`);
    }

    const warehouseCode =
      input.warehouseType === '3PL' || (input.warehouseType as string) === 'HUB'
        ? await generatePlatformWarehouseCode()
        : await generateWarehouseCode('PLT');

    const warehouse = await warehousesRepository.insertWarehouse({
      warehouseName: input.warehouseName,
      warehouseCode,
      warehouseType: input.warehouseType,
      contactPersonName: input.contactPersonName,
      contactEmail: input.contactEmail,
      contactPhoneNumber: input.contactPhoneNumber,
      addressLine1: input.addressLine1,
      addressLine2: input.addressLine2,
      city: input.city,
      state: input.state,
      postalCode: input.postalCode,
      country: input.country || 'India',
      latitude: input.latitude,
      longitude: input.longitude,
      status: 'ACTIVE',
      adminUserId,
    });

    const warehouseId = BigInt(warehouse.WarehouseID);

    const inputAny = input as any;
    if (inputAny.consents && Array.isArray(inputAny.consents) && inputAny.consents.length > 0) {
      await withTransaction(async (tx) => {
        for (const c of inputAny.consents) {
          await warehousesRepository.insertWarehouseConsent(warehouseId, c.type, tx);
        }
      });
    }

    return this.getWarehouseById(warehouseId);
  }

  /**
   * Update warehouse properties
   */
  async updateWarehouse(adminUserId: bigint, warehouseId: bigint, input: UpdateWarehouseInput) {
    const existing = await warehousesRepository.getWarehouseById(warehouseId);
    if (!existing) {
      throw new NotFoundError('Warehouse facility not found');
    }

    if (input.warehouseName && input.warehouseName !== existing.WarehouseName) {
      const duplicate = await warehousesRepository.findWarehouseByNameOrCode(input.warehouseName, undefined, warehouseId);
      if (duplicate) {
        throw new ConflictError(`Warehouse facility "${input.warehouseName}" already exists`);
      }
    }

    await warehousesRepository.updateWarehouse(warehouseId, adminUserId, {
      warehouseName: input.warehouseName,
      contactPersonName: input.contactPersonName,
      contactEmail: input.contactEmail,
      contactPhoneNumber: input.contactPhoneNumber,
      addressLine1: input.addressLine1,
      addressLine2: input.addressLine2,
      city: input.city,
      state: input.state,
      postalCode: input.postalCode,
      country: input.country,
      latitude: input.latitude,
      longitude: input.longitude,
      status: input.status,
    });

    return this.getWarehouseById(warehouseId);
  }

  /**
   * Assign staff member to a warehouse
   */
  async assignUser(adminUserId: bigint, warehouseId: bigint, input: string | AssignWarehouseUserInput) {
    const warehouse = await warehousesRepository.getWarehouseById(warehouseId);
    if (!warehouse) {
      throw new NotFoundError('Warehouse facility not found');
    }

    let targetUser: any = null;
    let initialPassword: string | undefined;

    if (typeof input === 'string') {
      targetUser = await warehousesRepository.findUserByEmailOrPhone(input);
      if (!targetUser) {
        throw new NotFoundError(`User with identifier "${input}" not found. Please provide full staff details to provision a new account.`);
      }
    } else {
      if (input.email) {
        targetUser = await warehousesRepository.findUserByEmailOrPhone(input.email);
      } else if (input.phoneNumber) {
        targetUser = await warehousesRepository.findUserByEmailOrPhone(input.phoneNumber);
      }

      if (!targetUser) {
        if (!input.firstName || !input.email) {
          throw new BadRequestError('First name and email are required to create a new staff account');
        }

        initialPassword = input.temporaryPassword || 'Warehouse@123';
        const passwordHash = await bcrypt.hash(initialPassword, 10);

        targetUser = await warehousesRepository.createUser({
          firstName: input.firstName,
          lastName: input.lastName || 'Staff',
          email: input.email,
          phoneNumber: input.phoneNumber,
          passwordHash,
          adminUserId,
        });
      }
    }

    const userId = BigInt(targetUser.UserID);

    // Assign role
    const roleName = 'WAREHOUSE_MANAGER';
    await warehousesRepository.ensureWarehouseRole(userId, roleName);

    // Upsert link
    await warehousesRepository.upsertWarehouseUser(warehouseId, userId, 'ACTIVE', adminUserId);

    return {
      warehouseId: Number(warehouseId),
      userId: Number(targetUser.UserID),
      firstName: targetUser.FirstName,
      lastName: targetUser.LastName,
      email: targetUser.Email,
      phoneNumber: targetUser.PhoneNumber,
      status: 'ACTIVE',
      temporaryPassword: initialPassword,
      message: initialPassword ? 'New staff account created and assigned to warehouse.' : 'Existing user assigned to warehouse staff.',
    };
  }

  /**
   * Remove user from warehouse staff
   */
  async removeUser(adminUserId: bigint, warehouseId: bigint, targetUserId: bigint) {
    const warehouse = await warehousesRepository.getWarehouseById(warehouseId);
    if (!warehouse) {
      throw new NotFoundError('Warehouse facility not found');
    }

    await warehousesRepository.removeWarehouseUser(warehouseId, targetUserId, adminUserId);

    return { success: true, message: 'User removed from warehouse facility' };
  }

  /**
   * Get warehouse details assigned to the current user
   */
  async getMyWarehouse(userId: bigint) {
    const staffLink = await warehousesRepository.findWarehouseForStaff(userId);

    if (staffLink) {
      return this.getWarehouseById(BigInt(staffLink.WarehouseID));
    }

    const seller = await this.getActiveSellerForUser(userId);
    const sellerWarehouses = await warehousesRepository.listSellerWarehouses(BigInt(seller.SellerID));

    if (sellerWarehouses.length === 0) {
      throw new NotFoundError('No warehouse facility linked to your account');
    }

    const primary = sellerWarehouses.find((sw) => sw.IsPrimary) || sellerWarehouses[0];
    return this.getSellerWarehouseById(BigInt(seller.SellerID), BigInt(primary.WarehouseID));
  }

  /**
   * Get operational statistics for staff's warehouse
   */
  async getMyWarehouseStats(userId: bigint, warehouseIdOverride?: bigint) {
    let warehouseId: bigint | undefined;

    if (warehouseIdOverride) {
      warehouseId = warehouseIdOverride;
    } else {
      const staffLink = await warehousesRepository.findWarehouseForStaff(userId);
      if (staffLink) {
        warehouseId = BigInt(staffLink.WarehouseID);
      } else {
        const seller = await this.getActiveSellerForUser(userId).catch(() => null);
        if (seller) {
          const sellerWarehouses = await warehousesRepository.listSellerWarehouses(BigInt(seller.SellerID));
          if (sellerWarehouses.length > 0) {
            warehouseId = BigInt(sellerWarehouses[0].WarehouseID);
          }
        }
      }
    }

    if (!warehouseId) {
      const firstActive = await warehousesRepository.getFirstActiveWarehouse();
      if (!firstActive) {
        throw new NotFoundError('No warehouse facility found on the platform');
      }
      warehouseId = BigInt(firstActive.WarehouseID);
    }

    return warehousesRepository.getWarehouseStats(warehouseId);
  }

  /**
   * Get warehouse operational stats by warehouse ID
   */
  async getWarehouseStats(warehouseId: bigint) {
    return warehousesRepository.getWarehouseStats(warehouseId);
  }

  /**
   * List staff assigned to a seller warehouse
   */
  async listSellerWarehouseStaff(userId: bigint, warehouseId: bigint) {
    const seller = await this.getActiveSellerForUser(userId);
    const sellerId = BigInt(seller.SellerID);

    const link = await warehousesRepository.findSellerWarehouseLink(sellerId, warehouseId);
    if (!link) {
      throw new ForbiddenError('You do not have access to manage staff for this facility');
    }

    const staff = await warehousesRepository.listWarehouseStaff(warehouseId);
    return staff.map((s) => ({
      warehouseUserId: Number(s.WarehouseUserID),
      userId: Number(s.UserID),
      firstName: s.FirstName,
      lastName: s.LastName,
      email: s.Email,
      phoneNumber: s.PhoneNumber,
      status: s.Status,
      assignedAt: s.CreatedAt,
    }));
  }

  /**
   * Assign staff to a seller warehouse
   */
  async assignSellerWarehouseStaff(userId: bigint, warehouseId: bigint, input: string | AssignWarehouseUserInput) {
    const seller = await this.getActiveSellerForUser(userId);
    const sellerId = BigInt(seller.SellerID);

    const link = await warehousesRepository.findSellerWarehouseLink(sellerId, warehouseId);
    if (!link) {
      throw new ForbiddenError('You do not have access to manage staff for this facility');
    }

    return this.assignUser(userId, warehouseId, input);
  }

  /**
   * Remove staff from a seller warehouse
   */
  async removeSellerWarehouseStaff(userId: bigint, warehouseId: bigint, targetUserId: bigint) {
    const seller = await this.getActiveSellerForUser(userId);
    const sellerId = BigInt(seller.SellerID);

    const link = await warehousesRepository.findSellerWarehouseLink(sellerId, warehouseId);
    if (!link) {
      throw new ForbiddenError('You do not have access to manage staff for this facility');
    }

    return this.removeUser(userId, warehouseId, targetUserId);
  }

  /**
   * Send a warehouse personnel invitation via email and return invite link.
   */
  async sendSellerWarehouseInvite(userId: bigint, warehouseId: bigint, input: CreateWarehouseInviteInput) {
    const seller = await this.getActiveSellerForUser(userId);
    const sellerId = BigInt(seller.SellerID);

    const link = await warehousesRepository.findSellerWarehouseLink(sellerId, warehouseId);
    if (!link) {
      throw new ForbiddenError('You do not have access to manage personnel for this facility');
    }

    const warehouse = await warehousesRepository.getWarehouseById(warehouseId);
    if (!warehouse) {
      throw new NotFoundError('Warehouse facility not found');
    }

    const normalizedEmail = input.email.toLowerCase().trim();

    // Check if user is already an active operator for this facility
    const existingStaff = await warehousesRepository.listWarehouseStaff(warehouseId);
    if (existingStaff.some((s: any) => s.Email?.toLowerCase() === normalizedEmail && s.Status === 'ACTIVE')) {
      throw new ConflictError('A user with this email address is already an active operator for this facility.');
    }

    // Check if an existing platform account exists
    const existingUser = await warehousesRepository.findUserByEmailOrPhone(normalizedEmail);
    const userExists = !!existingUser;

    // Generate secure 32-byte token and hash
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresInHours = 48;
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

    const invite = await warehousesRepository.createWarehouseInvitation({
      warehouseId,
      sellerId,
      email: normalizedEmail,
      roleName: input.roleName || 'WAREHOUSE_MANAGER',
      tokenHash,
      expiresAt,
      createdBy: userId,
    });

    const portalBaseUrl = process.env.WAREHOUSE_PORTAL_URL || 'http://localhost:7003';
    const inviteUrl = `${portalBaseUrl}/accept-invite?token=${rawToken}`;

    // Send email invitation asynchronously
    const sellerName = seller.BusinessName || seller.SellerName || 'Seller Organization';
    await mailService.sendWarehouseInvitation({
      toEmail: normalizedEmail,
      warehouseName: warehouse.WarehouseName,
      warehouseCode: warehouse.WarehouseCode,
      sellerName,
      inviteUrl,
      expiresInHours,
      userExists,
    });

    return {
      invitationId: Number(invite.InvitationID),
      warehouseId: Number(warehouseId),
      email: invite.Email,
      roleName: invite.RoleName,
      status: invite.Status,
      expiresAt: invite.ExpiresAt,
      inviteUrl,
      userExists,
      message: userExists
        ? 'Invitation sent to existing user. They can sign in to accept.'
        : 'Invitation sent to new operator. They will set up their password upon accepting.',
    };
  }

  /**
   * List all pending and historical invitations for a seller warehouse.
   */
  async listSellerWarehouseInvites(userId: bigint, warehouseId: bigint) {
    const seller = await this.getActiveSellerForUser(userId);
    const sellerId = BigInt(seller.SellerID);

    const link = await warehousesRepository.findSellerWarehouseLink(sellerId, warehouseId);
    if (!link) {
      throw new ForbiddenError('You do not have access to view invitations for this facility');
    }

    const invites = await warehousesRepository.listInvitationsByWarehouse(warehouseId);
    return invites.map((inv) => ({
      invitationId: Number(inv.InvitationID),
      warehouseId: Number(inv.WarehouseID),
      email: inv.Email,
      roleName: inv.RoleName,
      status: inv.Status,
      expiresAt: inv.ExpiresAt,
      acceptedAt: inv.AcceptedAt,
      createdAt: inv.CreatedAt,
      isExpired: new Date(inv.ExpiresAt) < new Date(),
      createdBy: inv.CreatedByFirstName ? `${inv.CreatedByFirstName} ${inv.CreatedByLastName || ''}`.trim() : null,
    }));
  }

  /**
   * Revoke a pending warehouse invitation.
   */
  async revokeSellerWarehouseInvite(userId: bigint, warehouseId: bigint, invitationId: bigint) {
    const seller = await this.getActiveSellerForUser(userId);
    const sellerId = BigInt(seller.SellerID);

    const link = await warehousesRepository.findSellerWarehouseLink(sellerId, warehouseId);
    if (!link) {
      throw new ForbiddenError('You do not have access to manage invitations for this facility');
    }

    const invite = await warehousesRepository.findInvitationById(invitationId);
    if (!invite || BigInt(invite.WarehouseID) !== warehouseId) {
      throw new NotFoundError('Invitation not found');
    }

    if (invite.Status === 'ACCEPTED') {
      throw new BadRequestError('Cannot revoke an invitation that has already been accepted. Remove staff member directly.');
    }

    await warehousesRepository.revokeInvitation(invitationId);
    return { success: true, message: 'Invitation revoked successfully' };
  }

  /**
   * Resend an invitation with a fresh token and 48-hour expiration.
   */
  async resendSellerWarehouseInvite(userId: bigint, warehouseId: bigint, invitationId: bigint) {
    const seller = await this.getActiveSellerForUser(userId);
    const sellerId = BigInt(seller.SellerID);

    const link = await warehousesRepository.findSellerWarehouseLink(sellerId, warehouseId);
    if (!link) {
      throw new ForbiddenError('You do not have access to manage invitations for this facility');
    }

    const invite = await warehousesRepository.findInvitationById(invitationId);
    if (!invite || BigInt(invite.WarehouseID) !== warehouseId) {
      throw new NotFoundError('Invitation not found');
    }

    if (invite.Status === 'ACCEPTED') {
      throw new BadRequestError('This invitation has already been accepted.');
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresInHours = 48;
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

    await warehousesRepository.updateInvitationToken(invitationId, tokenHash, expiresAt);

    const portalBaseUrl = process.env.WAREHOUSE_PORTAL_URL || 'http://localhost:7003';
    const inviteUrl = `${portalBaseUrl}/accept-invite?token=${rawToken}`;

    const existingUser = await warehousesRepository.findUserByEmailOrPhone(invite.Email);
    const userExists = !!existingUser;

    await mailService.sendWarehouseInvitation({
      toEmail: invite.Email,
      warehouseName: invite.WarehouseName,
      warehouseCode: invite.WarehouseCode,
      sellerName: invite.SellerName,
      inviteUrl,
      expiresInHours,
      userExists,
    });

    return {
      invitationId: Number(invitationId),
      email: invite.Email,
      inviteUrl,
      expiresAt,
      message: 'Invitation resent successfully',
    };
  }

  /**
   * Validate an invitation token and return metadata for display on accept page.
   */
  async validateInvitationToken(rawToken: string) {
    const tokenHash = crypto.createHash('sha256').update(rawToken.trim()).digest('hex');
    const invite = await warehousesRepository.findInvitationByTokenHash(tokenHash);

    if (!invite) {
      throw new NotFoundError('Invalid or nonexistent invitation link');
    }

    if (invite.Status === 'ACCEPTED') {
      throw new BadRequestError('This invitation has already been accepted.');
    }

    if (invite.Status === 'REVOKED') {
      throw new BadRequestError('This invitation has been revoked by the facility owner.');
    }

    if (new Date(invite.ExpiresAt) < new Date()) {
      throw new BadRequestError('This invitation link has expired. Please ask the seller to resend it.');
    }

    const existingUser = await warehousesRepository.findUserByEmailOrPhone(invite.Email);

    return {
      valid: true,
      invitationId: Number(invite.InvitationID),
      warehouseId: Number(invite.WarehouseID),
      warehouseName: invite.WarehouseName,
      warehouseCode: invite.WarehouseCode,
      city: invite.City,
      state: invite.State,
      sellerName: invite.BusinessName || invite.SellerName,
      email: invite.Email,
      roleName: invite.RoleName,
      userExists: !!existingUser,
      expiresAt: invite.ExpiresAt,
    };
  }

  /**
   * Accept invitation for an existing user (either authenticated or validating password).
   */
  async acceptInvitationExistingUser(rawToken: string, currentUserId?: bigint, password?: string) {
    const tokenHash = crypto.createHash('sha256').update(rawToken.trim()).digest('hex');
    const invite = await warehousesRepository.findInvitationByTokenHash(tokenHash);

    if (!invite) {
      throw new NotFoundError('Invalid invitation link');
    }

    if (invite.Status !== 'PENDING') {
      throw new BadRequestError(`This invitation is no longer pending (status: ${invite.Status}).`);
    }

    if (new Date(invite.ExpiresAt) < new Date()) {
      throw new BadRequestError('This invitation has expired.');
    }

    const targetUser = await warehousesRepository.findUserByEmailOrPhone(invite.Email);
    if (!targetUser) {
      throw new NotFoundError('User account not found. Please register a new account instead.');
    }

    const targetUserId = BigInt(targetUser.UserID);

    // If not authenticated as this user, require password verification
    if (!currentUserId || currentUserId !== targetUserId) {
      if (!password) {
        throw new BadRequestError('Password is required to confirm identity and accept invitation');
      }

      if (!targetUser.PasswordHash) {
        throw new BadRequestError('Account requires password setup');
      }

      const isValid = await bcrypt.compare(password, targetUser.PasswordHash);
      if (!isValid) {
        throw new BadRequestError('Incorrect password');
      }
    }

    // Assign role
    const roleName = invite.RoleName || 'WAREHOUSE_MANAGER';
    await warehousesRepository.ensureWarehouseRole(targetUserId, roleName);

    // Link user to warehouse
    const warehouseId = BigInt(invite.WarehouseID);
    await warehousesRepository.upsertWarehouseUser(warehouseId, targetUserId, 'ACTIVE', BigInt(invite.CreatedBy));

    // Mark invitation accepted
    await warehousesRepository.markInvitationAccepted(BigInt(invite.InvitationID), targetUserId);

    // Generate fresh auth context & access token
    const authUser = await authRepository.getUserAuthContext(targetUserId);
    if (!authUser) {
      throw new NotFoundError('Failed to load user auth context');
    }

    const payload: JwtPayload = {
      userId: authUser.userId,
      email: authUser.email,
      roles: authUser.roles,
    };

    const accessToken = jwt.sign(payload, config.JWT_SECRET, {
      expiresIn: config.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    });

    return {
      accessToken,
      user: authUser,
      warehouseId: Number(warehouseId),
      message: 'Invitation accepted successfully! Redirecting to warehouse dashboard...',
    };
  }

  /**
   * Register new account and accept invitation in a single seamless flow.
   */
  async registerAndAcceptInvitation(rawToken: string, input: RegisterAndAcceptInviteInput) {
    const tokenHash = crypto.createHash('sha256').update(rawToken.trim()).digest('hex');
    const invite = await warehousesRepository.findInvitationByTokenHash(tokenHash);

    if (!invite) {
      throw new NotFoundError('Invalid invitation link');
    }

    if (invite.Status !== 'PENDING') {
      throw new BadRequestError(`This invitation is no longer pending (status: ${invite.Status}).`);
    }

    if (new Date(invite.ExpiresAt) < new Date()) {
      throw new BadRequestError('This invitation has expired.');
    }

    // Check if user already exists
    const existingUser = await warehousesRepository.findUserByEmailOrPhone(invite.Email);
    if (existingUser) {
      throw new ConflictError('An account with this email already exists. Please log in to accept the invitation.');
    }

    const passwordHash = await bcrypt.hash(input.password, 10);
    const newUser = await warehousesRepository.createUser({
      firstName: input.firstName,
      lastName: input.lastName || 'Staff',
      email: invite.Email,
      phoneNumber: input.phoneNumber || null,
      passwordHash,
      adminUserId: BigInt(invite.CreatedBy),
    });

    const newUserId = BigInt(newUser.UserID);

    // Assign role
    const roleName = invite.RoleName || 'WAREHOUSE_MANAGER';
    await warehousesRepository.ensureWarehouseRole(newUserId, roleName);

    // Link user to warehouse
    const warehouseId = BigInt(invite.WarehouseID);
    await warehousesRepository.upsertWarehouseUser(warehouseId, newUserId, 'ACTIVE', BigInt(invite.CreatedBy));

    // Mark invitation accepted
    await warehousesRepository.markInvitationAccepted(BigInt(invite.InvitationID), newUserId);

    // Generate fresh auth context & access token
    const authUser = await authRepository.getUserAuthContext(newUserId);
    if (!authUser) {
      throw new NotFoundError('Failed to load user auth context');
    }

    const payload: JwtPayload = {
      userId: authUser.userId,
      email: authUser.email,
      roles: authUser.roles,
    };

    const accessToken = jwt.sign(payload, config.JWT_SECRET, {
      expiresIn: config.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    });

    return {
      accessToken,
      user: authUser,
      warehouseId: Number(warehouseId),
      message: 'Account created and invitation accepted successfully! Welcome to warehouse operations.',
    };
  }

  /**
   * List warehouses owned by or connected to the logged-in seller
   */
  async listSellerWarehouses(userId: bigint) {
    const seller = await this.getActiveSellerForUser(userId);
    const sellerId = BigInt(seller.SellerID);

    const records = await warehousesRepository.listSellerWarehouses(sellerId);

    return records.map((r) => {
      const docs: any[] = r.DocumentsJson ? JSON.parse(r.DocumentsJson) : [];

      const warehouseDetails = {
        warehouseId: Number(r.WarehouseID),
        warehouseName: r.WarehouseName,
        warehouseCode: r.WarehouseCode,
        warehouseType: r.WarehouseType,
        addressLine1: r.AddressLine1,
        addressLine2: r.AddressLine2,
        city: r.City,
        state: r.State,
        postalCode: r.PostalCode,
        country: r.Country,
        contactPersonName: r.ContactPersonName,
        contactEmail: r.ContactEmail,
        contactPhoneNumber: r.ContactPhoneNumber,
        status: r.WarehouseStatus,
        createdAt: r.CreatedAt,
        documentsCount: docs.length,
        verifiedDocumentsCount: docs.filter((d: any) => d.VerificationStatus === 'APPROVED' || d.VerificationStatus === 'VERIFIED').length,
        totalProductsCount: Number(r.TotalProducts),
        activeStaffCount: Number(r.StaffCount),
      };

      return {
        sellerWarehouseId: Number(r.SellerWarehouseID),
        warehouseId: Number(r.WarehouseID),
        warehouseName: r.WarehouseName,
        warehouseCode: r.WarehouseCode,
        warehouseType: r.WarehouseType,
        addressLine1: r.AddressLine1,
        addressLine2: r.AddressLine2,
        city: r.City,
        state: r.State,
        postalCode: r.PostalCode,
        country: r.Country,
        contactPersonName: r.ContactPersonName,
        contactEmail: r.ContactEmail,
        contactPhoneNumber: r.ContactPhoneNumber,
        status: r.WarehouseStatus,
        relationshipStatus: r.Status,
        isPrimary: r.IsPrimary,
        createdAt: r.CreatedAt,
        documentsCount: docs.length,
        verifiedDocumentsCount: docs.filter((d: any) => d.VerificationStatus === 'APPROVED' || d.VerificationStatus === 'VERIFIED').length,
        totalProductsCount: Number(r.TotalProducts),
        activeStaffCount: Number(r.StaffCount),
        warehouse: warehouseDetails,
      };
    });
  }

  /**
   * Set a warehouse as the primary fulfillment dispatch origin for the seller
   */
  async setPrimarySellerWarehouse(userId: bigint, warehouseId: bigint) {
    const seller = await this.getActiveSellerForUser(userId);
    const sellerId = BigInt(seller.SellerID);

    const link = await warehousesRepository.findSellerWarehouseLink(sellerId, warehouseId);
    if (!link) {
      throw new NotFoundError('Warehouse not linked to your seller account');
    }

    if (link.Status !== 'ACTIVE') {
      throw new BadRequestError('Only an ACTIVE warehouse facility can be designated as your Primary dispatch hub');
    }

    const targetWarehouseId = BigInt(link.WarehouseID || warehouseId);
    await warehousesRepository.setSellerWarehousePrimary(sellerId, targetWarehouseId);
    return { warehouseId: Number(targetWarehouseId), isPrimary: true };
  }

  /**
   * Get single seller warehouse by ID
   */
  async getSellerWarehouseById(userId: bigint, warehouseId: bigint) {
    const seller = await this.getActiveSellerForUser(userId);
    const sellerId = BigInt(seller.SellerID);

    const record = await warehousesRepository.getSellerWarehouseById(sellerId, warehouseId);
    if (!record) {
      throw new NotFoundError('Warehouse not found or not connected to your seller account');
    }

    let rejectionReason: string | null = null;
    let latestStatusComment: string | null = null;
    const statusHistory = await this.getWarehouseStatusHistory(warehouseId);
    if (statusHistory.length > 0) {
      latestStatusComment = statusHistory[0].comments;
      if (record.WarehouseStatus === 'REJECTED' && !rejectionReason) {
        rejectionReason = statusHistory[0].comments;
      }
    }
    if (record.WarehouseStatus === 'REJECTED' && !rejectionReason) {
      const log = await warehousesRepository.findLatestAuditLogRejectionReason(warehouseId);
      if (log?.NewData) {
        try {
          const parsed = JSON.parse(log.NewData);
          rejectionReason = parsed.rejectionReason || null;
        } catch {}
      }
    }

    const docsRaw: any[] = record.DocumentsJson ? JSON.parse(record.DocumentsJson) : [];
    const documents = docsRaw.map((doc: any) => ({
      sellerWarehouseDocumentId: Number(doc.SellerWarehouseDocumentID),
      documentTypeId: doc.DocumentTypeID,
      code: doc.Code,
      displayName: doc.DisplayName,
      documentNumber: doc.DocumentNumber,
      documentUrl: doc.DocumentURL,
      verificationStatus: doc.VerificationStatus,
      rejectionReason: doc.RejectionReason,
      isMandatory: doc.IsMandatory,
      verifiedAt: doc.VerifiedAt,
    }));

    const staffRaw: any[] = record.StaffMembersJson ? JSON.parse(record.StaffMembersJson) : [];
    const staffMembers = staffRaw.map((wu: any) => ({
      warehouseUserId: Number(wu.WarehouseUserID),
      userId: Number(wu.UserID),
      firstName: wu.FirstName,
      lastName: wu.LastName,
      email: wu.Email,
      phoneNumber: wu.PhoneNumber,
      status: wu.Status,
      assignedAt: wu.AssignedAt,
    }));

    const consentsRaw: any[] = record.ConsentsJson ? JSON.parse(record.ConsentsJson) : [];
    const consents = consentsRaw.map((c: any) => ({
      consentId: Number(c.WarehouseConsentID),
      type: c.ConsentType,
      version: c.ConsentVersion,
      isGranted: c.IsGranted,
      grantedAt: c.GrantedAt,
    }));

    const reqDocs = await warehousesRepository.getWarehouseDocumentRequirements(record.WarehouseType);
    const requiredDocuments = reqDocs.map((r) => ({
      documentTypeId: r.DocumentTypeID,
      code: r.Code,
      displayName: r.DisplayName,
      warehouseType: r.WarehouseType,
      isRequired: r.IsRequired,
    }));

    return {
      sellerWarehouseId: Number(record.SellerWarehouseID),
      isPrimary: record.IsPrimary,
      relationshipStatus: record.Status,
      warehouseId: Number(record.WarehouseID),
      warehouseName: record.WarehouseName,
      warehouseCode: record.WarehouseCode,
      warehouseType: record.WarehouseType,
      contactPersonName: record.ContactPersonName,
      contactEmail: record.ContactEmail,
      contactPhoneNumber: record.ContactPhoneNumber,
      addressLine1: record.AddressLine1,
      addressLine2: record.AddressLine2,
      city: record.City,
      state: record.State,
      postalCode: record.PostalCode,
      country: record.Country,
      status: record.WarehouseStatus,
      rejectionReason,
      latestStatusComment,
      createdAt: record.CreatedAt,
      totalProductsCount: Number(record.TotalProducts),
      activeStaffCount: staffMembers.filter((s) => s.status === 'ACTIVE').length,
      documents,
      staffMembers,
      requiredDocuments,
      consents,
    };
  }

  /**
   * Seller creates a self-managed or dedicated warehouse facility
   */
  async createSellerWarehouse(userId: bigint, input: CreateSellerWarehouseInput) {
    const seller = await this.getActiveSellerForUser(userId);
    const sellerId = BigInt(seller.SellerID);

    const existing = await warehousesRepository.findWarehouseByNameOrCode(input.warehouseName);
    if (existing) {
      throw new ConflictError(`Warehouse facility with name "${input.warehouseName}" already exists`);
    }

    const warehouseCode = await generateWarehouseCode(seller.SellerCode);

    const result = await withTransaction(async (tx) => {
      // If primary requested, demote previous primaries
      if (input.isPrimary) {
        await warehousesRepository.demotePrimarySellerWarehouses(sellerId, tx);
      } else {
        const existingPrimary = await warehousesRepository.findPrimarySellerWarehouse(sellerId);
        if (!existingPrimary) {
          input.isPrimary = true;
        }
      }

      // 1. Create warehouse facility
      const warehouse = await warehousesRepository.insertWarehouse(
        {
          warehouseName: input.warehouseName,
          warehouseCode,
          warehouseType: input.warehouseType,
          contactPersonName: input.contactPersonName,
          contactEmail: input.contactEmail,
          contactPhoneNumber: input.contactPhoneNumber,
          addressLine1: input.addressLine1,
          addressLine2: input.addressLine2,
          city: input.city,
          state: input.state,
          postalCode: input.postalCode,
          country: input.country || 'India',
          latitude: input.latitude,
          longitude: input.longitude,
          status: 'PENDING_APPROVAL',
        },
        tx
      );

      const warehouseId = BigInt(warehouse.WarehouseID);

      // 2. Link Seller to Warehouse
      const sellerWarehouse = await warehousesRepository.insertSellerWarehouse(
        {
          sellerId,
          warehouseId,
          isPrimary: input.isPrimary ?? false,
          status: 'PENDING_APPROVAL',
          userId,
        },
        tx
      );

      const sellerWarehouseId = BigInt(sellerWarehouse.SellerWarehouseID);

      // 3. Grant Marketplace consent
      await warehousesRepository.insertWarehouseConsent(warehouseId, 'WAREHOUSE_OPERATIONS_AGREEMENT', tx);

      // 4. Populate required document slots
      const inputAny = input as any;
      const reqDocs = await warehousesRepository.getWarehouseDocumentRequirements(input.warehouseType);
      for (const r of reqDocs) {
        let certNumber = '';
        if (r.Code === 'GST' && inputAny.gstNumber) certNumber = inputAny.gstNumber;
        if (r.Code === 'PAN' && inputAny.panNumber) certNumber = inputAny.panNumber;

        await warehousesRepository.insertSellerWarehouseDocument(
          {
            sellerWarehouseId,
            documentTypeId: r.DocumentTypeID,
            documentNumber: certNumber || null,
            documentUrl: '',
            isMandatory: r.IsRequired,
          },
          tx
        );
      }

      // 5. Audit log
      await warehousesRepository.createWarehouseStatusHistory(
        warehouseId,
        'PENDING_APPROVAL',
        `Seller ${seller.SellerCode} submitted new warehouse for compliance verification`,
        userId,
        tx
      );

      return warehouse;
    });

    return this.getSellerWarehouseById(sellerId, BigInt(result.WarehouseID));
  }

  /**
   * Admin approves a seller warehouse facility
   */
  async approveWarehouse(adminUserId: bigint, warehouseId: bigint) {
    const warehouse = await warehousesRepository.getWarehouseById(warehouseId);
    if (!warehouse) {
      throw new NotFoundError('Warehouse facility not found');
    }

    await withTransaction(async (tx) => {
      await warehousesRepository.updateWarehouseStatus(warehouseId, 'ACTIVE', adminUserId, tx);
      await warehousesRepository.updateSellerWarehousesStatusForFacility(warehouseId, 'ACTIVE', adminUserId, tx);
      await warehousesRepository.createWarehouseStatusHistory(
        warehouseId,
        'ACTIVE',
        'Facility and compliance verified and approved by marketplace administrator',
        adminUserId,
        tx
      );
    });

    return this.getWarehouseById(warehouseId);
  }

  /**
   * Admin rejects a seller warehouse facility
   */
  async rejectWarehouse(adminUserId: bigint, warehouseId: bigint, reason?: string) {
    const warehouse = await warehousesRepository.getWarehouseById(warehouseId);
    if (!warehouse) {
      throw new NotFoundError('Warehouse facility not found');
    }

    const rejectionComment = reason || 'Warehouse application rejected due to non-compliance';

    await withTransaction(async (tx) => {
      await warehousesRepository.updateWarehouseStatus(warehouseId, 'REJECTED', adminUserId, tx);
      await warehousesRepository.updateSellerWarehousesStatusForFacility(warehouseId, 'REJECTED', adminUserId, tx);
      await warehousesRepository.createWarehouseStatusHistory(
        warehouseId,
        'REJECTED',
        rejectionComment,
        adminUserId,
        tx
      );
    });

    return this.getWarehouseById(warehouseId);
  }

  /**
   * Admin requests rework on a seller warehouse facility
   */
  async requestWarehouseRework(adminUserId: bigint, warehouseId: bigint, comments: string) {
    const warehouse = await warehousesRepository.getWarehouseById(warehouseId);
    if (!warehouse) {
      throw new NotFoundError('Warehouse facility not found');
    }

    await withTransaction(async (tx) => {
      await warehousesRepository.updateWarehouseStatus(warehouseId, 'REWORK_REQUIRED', adminUserId, tx);
      await warehousesRepository.updateSellerWarehousesStatusForFacility(warehouseId, 'REWORK_REQUIRED', adminUserId, tx);
      await warehousesRepository.createWarehouseStatusHistory(
        warehouseId,
        'REWORK_REQUIRED',
        comments || 'Re-upload missing or corrected compliance documentation',
        adminUserId,
        tx
      );
    });

    return this.getWarehouseById(warehouseId);
  }

  /**
   * Seller resubmits a warehouse facility after correcting rework items
   */
  async resubmitSellerWarehouse(userId: bigint, warehouseId: bigint, remarks?: string) {
    const seller = await this.getActiveSellerForUser(userId);
    const sellerId = BigInt(seller.SellerID);

    const link = await warehousesRepository.findSellerWarehouseLink(sellerId, warehouseId);
    if (!link) {
      throw new ForbiddenError('You do not have access to resubmit this warehouse');
    }

    const targetWarehouseId = BigInt(link.WarehouseID || warehouseId);
    const submissionComments = remarks || `Resubmitted by merchant ${seller.SellerCode} for re-verification`;

    await withTransaction(async (tx) => {
      await warehousesRepository.updateWarehouseStatus(targetWarehouseId, 'PENDING_APPROVAL', userId, tx);
      await warehousesRepository.updateSellerWarehouseStatus(BigInt(link.SellerWarehouseID), 'PENDING_APPROVAL', undefined, userId, tx);
      await warehousesRepository.createWarehouseStatusHistory(
        targetWarehouseId,
        'PENDING_APPROVAL',
        submissionComments,
        userId,
        tx
      );
    });

    return this.getSellerWarehouseById(sellerId, targetWarehouseId);
  }

  /**
   * Get audit status history for a warehouse
   */
  async getWarehouseStatusHistory(warehouseId: bigint) {
    const history = await warehousesRepository.getWarehouseStatusHistory(warehouseId);
    return history.map((h) => {
      const name = h.FirstName ? `${h.FirstName} ${h.LastName || ''}`.trim() : 'System';
      return {
        historyId: Number(h.WarehouseStatusHistoryID),
        status: h.Status,
        comments: h.Comments,
        changedAt: h.ChangedAt,
        changedBy: {
          userId: 0,
          name,
          email: '',
        },
      };
    });
  }

  /**
   * List all platform 3PL facilities available for seller integration
   */
  async listAvailable3PLWarehouses(userId: bigint) {
    const seller = await this.getActiveSellerForUser(userId);
    const sellerId = BigInt(seller.SellerID);

    const records = await warehousesRepository.listAvailable3PLWarehouses(sellerId);

    return records.map((w) => ({
      warehouseId: Number(w.WarehouseID),
      warehouseName: w.WarehouseName,
      warehouseCode: w.WarehouseCode,
      warehouseType: w.WarehouseType,
      addressLine1: w.AddressLine1,
      addressLine2: w.AddressLine2,
      city: w.City,
      state: w.State,
      postalCode: w.PostalCode,
      country: w.Country,
      contactPersonName: w.ContactPersonName,
      contactEmail: w.ContactEmail,
      contactPhoneNumber: w.ContactPhoneNumber,
      latitude: w.Latitude ? Number(w.Latitude) : null,
      longitude: w.Longitude ? Number(w.Longitude) : null,
      status: w.Status,
      connectionStatus: w.ConnectionStatus || 'NOT_CONNECTED',
      sellerWarehouseId: w.SellerWarehouseID ? Number(w.SellerWarehouseID) : null,
      isPrimary: w.IsPrimary || false,
    }));
  }

  /**
   * Request commercial connection to a 3PL / fulfillment hub facility
   */
  async request3PLConnection(
    userId: bigint,
    warehouseId: bigint,
    inputOrPrimary?: { isPrimary?: boolean; notes?: string } | boolean,
    maybeNotes?: string
  ) {
    const input: { isPrimary?: boolean; notes?: string } =
      typeof inputOrPrimary === 'boolean'
        ? { isPrimary: inputOrPrimary, notes: maybeNotes }
        : inputOrPrimary || {};

    const seller = await this.getActiveSellerForUser(userId);
    const sellerId = BigInt(seller.SellerID);

    const warehouse = await warehousesRepository.getWarehouseById(warehouseId);
    if (!warehouse || warehouse.WarehouseType !== '3PL' || warehouse.Status !== 'ACTIVE') {
      throw new BadRequestError('Requested facility is not an active 3PL warehouse');
    }

    const existing = await warehousesRepository.findSellerWarehouseLink(sellerId, warehouseId);

    if (existing) {
      if (existing.Status === 'ACTIVE') {
        return {
          sellerWarehouseId: Number(existing.SellerWarehouseID),
          status: 'ACTIVE',
          message: 'Your seller account is already connected to this 3PL warehouse facility.',
        };
      }
      if (existing.Status === 'PENDING') {
        return {
          sellerWarehouseId: Number(existing.SellerWarehouseID),
          status: 'PENDING',
          message: 'A connection request for this facility is already pending review.',
        };
      }

      const updated = await withTransaction(async (tx) => {
        if (input.isPrimary) {
          await warehousesRepository.demotePrimarySellerWarehouses(sellerId, tx);
        }

        const link = await warehousesRepository.updateSellerWarehouseStatus(
          BigInt(existing.SellerWarehouseID),
          'PENDING',
          input.isPrimary,
          userId,
          tx
        );

        await warehousesRepository.createWarehouseStatusHistory(
          warehouseId,
          'PENDING',
          `Seller ${seller.SellerCode} requested reconnection: ${input.notes || 'No notes provided'}`,
          userId,
          tx
        );

        return link;
      });

      return {
        sellerWarehouseId: Number(updated.SellerWarehouseID),
        status: updated.Status,
        message: 'Reconnection request submitted successfully.',
      };
    }

    const created = await withTransaction(async (tx) => {
      if (input.isPrimary) {
        await warehousesRepository.demotePrimarySellerWarehouses(sellerId, tx);
      }

      const link = await warehousesRepository.createSellerWarehouseLink(
        sellerId,
        warehouseId,
        input.isPrimary ?? false,
        'PENDING',
        userId,
        tx
      );

      await warehousesRepository.createWarehouseStatusHistory(
        warehouseId,
        'PENDING',
        `Seller ${seller.SellerCode} requested 3PL linkage: ${input.notes || 'No notes provided'}`,
        userId,
        tx
      );

      return link;
    });

    return {
      sellerWarehouseId: Number(created.SellerWarehouseID),
      status: created.Status,
      message: 'Connection request submitted to 3PL operations team.',
    };
  }

  /**
   * Disconnect seller from a 3PL warehouse facility
   */
  async disconnect3PLWarehouse(userId: bigint, warehouseId: bigint) {
    const seller = await this.getActiveSellerForUser(userId);
    const sellerId = BigInt(seller.SellerID);

    const link = await warehousesRepository.findSellerWarehouseLink(sellerId, warehouseId);
    if (!link) {
      throw new NotFoundError('No active relationship found with this facility');
    }

    await warehousesRepository.updateSellerWarehouseStatus(BigInt(link.SellerWarehouseID), 'INACTIVE', false, userId);

    return { success: true, message: 'Disconnected from 3PL facility' };
  }

  /**
   * Admin links a seller directly to a 3PL warehouse
   */
  async linkSellerTo3PLWarehouse(
    adminUserId: bigint,
    warehouseId: bigint,
    sellerId: bigint,
    isPrimary?: boolean
  ) {
    const warehouse = await warehousesRepository.getWarehouseById(warehouseId);
    if (!warehouse) {
      throw new NotFoundError('Warehouse facility not found');
    }

    const existing = await warehousesRepository.findSellerWarehouseLink(sellerId, warehouseId);

    await withTransaction(async (tx) => {
      if (isPrimary) {
        await warehousesRepository.demotePrimarySellerWarehouses(sellerId, tx);
      }

      if (existing) {
        await warehousesRepository.updateSellerWarehouseStatus(
          BigInt(existing.SellerWarehouseID),
          'ACTIVE',
          isPrimary,
          adminUserId,
          tx
        );
      } else {
        await warehousesRepository.createSellerWarehouseLink(
          sellerId,
          warehouseId,
          isPrimary ?? false,
          'ACTIVE',
          adminUserId,
          tx
        );
      }

      await warehousesRepository.createWarehouseStatusHistory(
        warehouseId,
        'ACTIVE',
        `Seller ${sellerId} directly linked to 3PL facility by administrator`,
        adminUserId,
        tx
      );
    });

    return this.getWarehouseById(warehouseId);
  }

  /**
   * Admin reviews seller 3PL connection request
   */
  async reviewSellerLinkage(
    adminUserId: bigint,
    sellerWarehouseId: bigint,
    decision: 'APPROVE' | 'REJECT',
    rejectionReason?: string
  ) {
    const link = await warehousesRepository.findSellerWarehouseById(sellerWarehouseId);
    if (!link) {
      throw new NotFoundError('Seller warehouse linkage not found');
    }

    const targetStatus = decision === 'APPROVE' ? 'ACTIVE' : 'REJECTED';

    await withTransaction(async (tx) => {
      await warehousesRepository.updateSellerWarehouseStatus(
        sellerWarehouseId,
        targetStatus,
        undefined,
        adminUserId,
        tx
      );

      const comment = decision === 'APPROVE'
        ? `3PL linkage approved by administrator`
        : `3PL linkage rejected: ${rejectionReason || 'No reason provided'}`;

      await warehousesRepository.createWarehouseStatusHistory(
        BigInt(link.WarehouseID),
        targetStatus,
        comment,
        adminUserId,
        tx
      );
    });

    return {
      success: true,
      sellerWarehouseId: Number(sellerWarehouseId),
      status: targetStatus,
      message: `Seller linkage ${decision.toLowerCase()}d successfully`,
    };
  }

  /**
   * Admin unlinks seller from a warehouse
   */
  async unlinkSellerFromWarehouse(adminUserId: bigint, sellerWarehouseId: bigint) {
    const link = await warehousesRepository.findSellerWarehouseById(sellerWarehouseId);
    if (!link) {
      throw new NotFoundError('Seller warehouse linkage not found');
    }

    await withTransaction(async (tx) => {
      await warehousesRepository.updateSellerWarehouseStatus(sellerWarehouseId, 'INACTIVE', false, adminUserId, tx);
      await warehousesRepository.createWarehouseStatusHistory(
        BigInt(link.WarehouseID),
        'INACTIVE',
        `Seller ${link.SellerID} unlinked from warehouse by administrator`,
        adminUserId,
        tx
      );
    });

    return { success: true, message: 'Seller unlinked from warehouse facility' };
  }

  /**
   * Get compliance document requirements for a warehouse type
   */
  async getWarehouseDocumentRequirements(warehouseType: string) {
    const reqs = await warehousesRepository.getWarehouseDocumentRequirements(warehouseType);
    return reqs.map((r) => ({
      documentTypeId: r.DocumentTypeID,
      code: r.Code,
      displayName: r.DisplayName,
      warehouseType: r.WarehouseType,
      isRequired: r.IsRequired,
    }));
  }

  /**
   * Upload a compliance document for a seller-managed warehouse facility
   */
  async uploadSellerWarehouseDocument(
    userId: bigint,
    warehouseId: bigint,
    docTypeOrInput: string | UploadWarehouseDocumentInput,
    docNumberOrFile?: string | Express.Multer.File,
    maybeFile?: Express.Multer.File
  ) {
    let documentTypeCode: string;
    let documentNumber: string | undefined;
    let file: Express.Multer.File;

    if (typeof docTypeOrInput === 'object') {
      documentTypeCode = docTypeOrInput.documentTypeCode;
      documentNumber = docTypeOrInput.documentNumber;
      file = docNumberOrFile as Express.Multer.File;
    } else {
      documentTypeCode = docTypeOrInput;
      documentNumber = docNumberOrFile as string | undefined;
      file = maybeFile as Express.Multer.File;
    }

    const seller = await this.getActiveSellerForUser(userId);
    const sellerId = BigInt(seller.SellerID);

    const link = await warehousesRepository.findSellerWarehouseLink(sellerId, warehouseId);
    if (!link) {
      throw new ForbiddenError('You do not have access to upload documents for this warehouse');
    }

    const sellerWarehouseId = BigInt(link.SellerWarehouseID);
    const targetWarehouseId = BigInt(link.WarehouseID || warehouseId);

    const warehouse = await warehousesRepository.getWarehouseById(targetWarehouseId);
    if (!warehouse) {
      throw new NotFoundError('Warehouse not found');
    }

    const docType = await warehousesRepository.findDocumentTypeByCode(documentTypeCode);
    if (!docType) {
      throw new BadRequestError(`Document type code "${documentTypeCode}" is not recognized`);
    }

    const { relativeUrl } = await storageService.saveFile(file);

    const requirement = await warehousesRepository.findDocumentRequirement(warehouse.WarehouseType, docType.DocumentTypeID);
    const isMandatory = requirement?.IsRequired === true;

    const existingDoc = await warehousesRepository.findSellerWarehouseDocument(sellerWarehouseId, docType.DocumentTypeID);

    let doc: any;
    if (existingDoc) {
      doc = await warehousesRepository.updateSellerWarehouseDocument(
        BigInt(existingDoc.SellerWarehouseDocumentID),
        {
          documentNumber: documentNumber?.trim() || existingDoc.DocumentNumber,
          documentUrl: relativeUrl,
          isMandatory,
        }
      );
    } else {
      doc = await warehousesRepository.insertSellerWarehouseDocument({
        sellerWarehouseId,
        documentTypeId: docType.DocumentTypeID,
        documentNumber: documentNumber?.trim() || null,
        documentUrl: relativeUrl,
        isMandatory,
      });
    }

    return {
      sellerWarehouseDocumentId: Number(doc.SellerWarehouseDocumentID),
      documentTypeId: doc.DocumentTypeID,
      code: doc.Code,
      displayName: doc.DisplayName,
      documentNumber: doc.DocumentNumber,
      documentUrl: doc.DocumentURL,
      verificationStatus: doc.VerificationStatus,
      isMandatory: doc.IsMandatory,
      createdAt: doc.CreatedAt,
    };
  }

  /**
   * Admin review of a warehouse document (approve/reject verification)
   */
  async reviewWarehouseDocument(
    adminUserId: bigint,
    sellerWarehouseDocumentId: bigint,
    decision: 'VERIFY' | 'REJECT',
    rejectionReason?: string
  ) {
    const doc = await warehousesRepository.findSellerWarehouseDocumentById(sellerWarehouseDocumentId);
    if (!doc) {
      throw new NotFoundError('Warehouse document record not found');
    }

    const updated = await warehousesRepository.reviewWarehouseDocument(
      sellerWarehouseDocumentId,
      adminUserId,
      decision,
      rejectionReason
    );

    return {
      sellerWarehouseDocumentId: Number(updated.SellerWarehouseDocumentID),
      documentTypeId: updated.DocumentTypeID,
      code: updated.Code,
      displayName: updated.DisplayName,
      documentNumber: updated.DocumentNumber,
      documentUrl: updated.DocumentURL,
      verificationStatus: updated.VerificationStatus,
      rejectionReason: updated.RejectionReason,
      isMandatory: updated.IsMandatory,
      verifiedAt: updated.VerifiedAt,
    };
  }
}

export const warehousesService = new WarehousesService();
