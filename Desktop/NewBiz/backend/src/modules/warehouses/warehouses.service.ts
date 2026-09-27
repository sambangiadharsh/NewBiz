import { prisma } from '../../database/prisma.js';
import { BadRequestError, ConflictError, NotFoundError, ForbiddenError } from '../../utils/errors.js';
import { storageService } from '../../services/storage/StorageService.js';
import bcrypt from 'bcryptjs';
import {
  CreateWarehouseInput,
  CreateSellerWarehouseInput,
  UpdateWarehouseInput,
  UploadWarehouseDocumentInput,
  AssignWarehouseUserInput,
} from './warehouses.validation.js';
import { generateWarehouseCode, generatePlatformWarehouseCode } from '../../utils/codeGenerator.js';

export class WarehousesService {
  /**
   * Helper: Resolve and validate active seller entity for a user
   */
  private async getActiveSellerForUser(userId: bigint) {
    const sellerUser = await prisma.sellerUsers.findFirst({
      where: {
        UserID: userId,
        Status: 'ACTIVE',
      },
      include: {
        Sellers: true,
      },
    });

    if (!sellerUser || sellerUser.Sellers.Status !== 'ACTIVE') {
      throw new ForbiddenError(
        'Active seller profile required. Please complete seller registration and wait for admin approval.'
      );
    }

    return sellerUser.Sellers;
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
    const skip = (page - 1) * limit;

    const where: any = {};

    if (params.type && params.type !== 'ALL') {
      where.WarehouseType = params.type;
    }

    if (params.status && params.status !== 'ALL') {
      where.Status = params.status;
    }

    if (params.search && params.search.trim()) {
      const search = params.search.trim();
      where.OR = [
        { WarehouseName: { contains: search } },
        { WarehouseCode: { contains: search } },
        { City: { contains: search } },
        { State: { contains: search } },
      ];
    }

    const [total, warehouses] = await Promise.all([
      prisma.warehouses.count({ where }),
      prisma.warehouses.findMany({
        where,
        skip,
        take: limit,
        orderBy: { CreatedAt: 'desc' },
        include: {
          SellerWarehouses: {
            include: {
              Sellers: true,
            },
          },
          _count: {
            select: {
              WarehouseUsers: {
                where: { Status: 'ACTIVE' },
              },
              SellerWarehouses: {
                where: { Status: 'ACTIVE' },
              },
              WarehouseProducts: true,
            },
          },
        },
      }),
    ]);

    const items = warehouses.map((wh) => ({
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
      activeStaffCount: wh._count.WarehouseUsers,
      connectedSellersCount: wh._count.SellerWarehouses,
      totalProductsCount: wh._count.WarehouseProducts,
      associatedSellers: wh.SellerWarehouses.map((sw) => ({
        sellerWarehouseId: Number(sw.SellerWarehouseID),
        sellerId: Number(sw.SellerID),
        sellerCode: sw.Sellers.SellerCode,
        sellerName: sw.Sellers.SellerName,
        businessName: sw.Sellers.BusinessName,
        email: sw.Sellers.Email,
        phoneNumber: sw.Sellers.PhoneNumber,
        relationshipStatus: sw.Status,
        isPrimary: sw.IsPrimary,
      })),
    }));

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
   * Get single warehouse with full details, staff members, and associated sellers
   */
  async getWarehouseById(warehouseId: bigint) {
    const wh = await prisma.warehouses.findUnique({
      where: { WarehouseID: warehouseId },
      include: {
        SellerWarehouses: {
          include: {
            Sellers: true,
            SellerWarehouseDocuments: {
              include: {
                DocumentTypes: true,
              },
            },
          },
        },
        WarehouseUsers: {
          include: {
            Users_WarehouseUsers_UserIDToUsers: {
              select: {
                UserID: true,
                FirstName: true,
                LastName: true,
                Email: true,
                PhoneNumber: true,
                Status: true,
              },
            },
          },
        },
        WarehouseConsents: {
          orderBy: { CreatedAt: 'desc' },
        },
        _count: {
          select: {
            SellerWarehouses: {
              where: { Status: 'ACTIVE' },
            },
            WarehouseProducts: true,
          },
        },
      },
    });

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
      const log = await prisma.dataAuditLogs.findFirst({
        where: {
          TableName: 'Warehouses',
          PrimaryKeyID: warehouseId,
          ActionType: 'UPDATE',
        },
        orderBy: { CreatedAt: 'desc' },
      });
      if (log?.NewData) {
        try {
          const parsed = JSON.parse(log.NewData);
          rejectionReason = parsed.rejectionReason || null;
        } catch {}
      }
    }

    const staffMembers = wh.WarehouseUsers.map((wu) => ({
      warehouseUserId: Number(wu.WarehouseUserID),
      userId: Number(wu.Users_WarehouseUsers_UserIDToUsers.UserID),
      firstName: wu.Users_WarehouseUsers_UserIDToUsers.FirstName,
      lastName: wu.Users_WarehouseUsers_UserIDToUsers.LastName,
      email: wu.Users_WarehouseUsers_UserIDToUsers.Email,
      phoneNumber: wu.Users_WarehouseUsers_UserIDToUsers.PhoneNumber,
      status: wu.Status,
      assignedAt: wu.CreatedAt,
    }));

    const requiredDocuments = (await prisma.warehouseDocumentRequirements.findMany({
      where: {
        WarehouseType: wh.WarehouseType,
        IsActive: true,
      },
      include: { DocumentTypes: true },
    })).map((r) => ({
      documentTypeId: r.DocumentTypeID,
      code: r.DocumentTypes.Code,
      displayName: r.DocumentTypes.DisplayName,
      warehouseType: r.WarehouseType,
      isRequired: r.IsRequired,
    }));

    const associatedSellers = wh.SellerWarehouses.map((sw) => ({
      sellerWarehouseId: Number(sw.SellerWarehouseID),
      sellerId: Number(sw.SellerID),
      sellerCode: sw.Sellers.SellerCode,
      sellerName: sw.Sellers.SellerName,
      businessName: sw.Sellers.BusinessName,
      email: sw.Sellers.Email,
      phoneNumber: sw.Sellers.PhoneNumber,
      relationshipStatus: sw.Status,
      isPrimary: sw.IsPrimary,
      createdAt: sw.CreatedAt,
      documents: (sw.SellerWarehouseDocuments || []).map((doc) => ({
        sellerWarehouseDocumentId: Number(doc.SellerWarehouseDocumentID),
        documentTypeId: doc.DocumentTypeID,
        code: doc.DocumentTypes.Code,
        displayName: doc.DocumentTypes.DisplayName,
        documentNumber: doc.DocumentNumber,
        documentUrl: doc.DocumentURL,
        verificationStatus: doc.VerificationStatus,
        rejectionReason: doc.RejectionReason,
        isMandatory: doc.IsMandatory,
        createdAt: doc.CreatedAt,
      })),
    }));

    const consents = wh.WarehouseConsents.map((c) => ({
      warehouseConsentId: Number(c.WarehouseConsentID),
      consentType: c.ConsentType,
      consentVersion: c.ConsentVersion,
      isGranted: c.IsGranted,
      grantedAt: c.GrantedAt,
      revokedAt: c.RevokedAt,
      source: c.Source,
      createdAt: c.CreatedAt,
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
      createdAt: wh.CreatedAt,
      rejectionReason,
      latestStatusComment,
      statusHistory,
      staffMembers,
      associatedSellers,
      consents,
      requiredDocuments,
      connectedSellersCount: wh._count.SellerWarehouses,
      totalProductsCount: wh._count.WarehouseProducts,
    };
  }

  /**
   * Create a new warehouse facility
   */
  async createWarehouse(adminUserId: bigint, input: CreateWarehouseInput) {
    let assignedCode = input.warehouseCode ? input.warehouseCode.toUpperCase().trim() : '';
    if (!assignedCode) {
      assignedCode = await generatePlatformWarehouseCode(prisma);
    }

    const existing = await prisma.warehouses.findFirst({
      where: { WarehouseCode: assignedCode },
    });

    if (existing) {
      throw new ConflictError(`Warehouse code '${assignedCode}' is already registered`);
    }

    const created = await prisma.warehouses.create({
      data: {
        WarehouseName: input.warehouseName,
        WarehouseCode: assignedCode,
        WarehouseType: input.warehouseType,
        ContactPersonName: input.contactPersonName || null,
        ContactEmail: input.contactEmail || null,
        ContactPhoneNumber: input.contactPhoneNumber || null,
        AddressLine1: input.addressLine1,
        AddressLine2: input.addressLine2 || null,
        City: input.city,
        State: input.state,
        PostalCode: input.postalCode,
        Country: input.country || 'India',
        Latitude: input.latitude !== undefined ? input.latitude : null,
        Longitude: input.longitude !== undefined ? input.longitude : null,
        Status: 'ACTIVE',
        CreatedAt: new Date(),
        CreatedBy: adminUserId,
      },
    });

    // Record warehouse consent declaration
    await prisma.warehouseConsents.create({
      data: {
        WarehouseID: created.WarehouseID,
        ConsentType: 'PLATFORM_OPERATIONAL_COMPLIANCE',
        ConsentVersion: 'v1.0',
        IsGranted: true,
        GrantedAt: new Date(),
        Source: 'ADMIN_PORTAL',
        CreatedAt: new Date(),
      },
    });

    // Record audit log
    await prisma.dataAuditLogs.create({
      data: {
        TableName: 'Warehouses',
        PrimaryKeyID: created.WarehouseID,
        ActionType: 'INSERT',
        NewData: JSON.stringify({
          code: created.WarehouseCode,
          name: created.WarehouseName,
          type: created.WarehouseType,
        }),
        ContextUserID: adminUserId,
        CreatedAt: new Date(),
      },
    });

    return this.getWarehouseById(created.WarehouseID);
  }

  /**
   * Update an existing warehouse facility
   */
  async updateWarehouse(adminUserId: bigint, warehouseId: bigint, input: UpdateWarehouseInput) {
    const existing = await prisma.warehouses.findUnique({
      where: { WarehouseID: warehouseId },
    });

    if (!existing) {
      throw new NotFoundError('Warehouse not found');
    }

    if (input.warehouseCode && input.warehouseCode.toUpperCase() !== existing.WarehouseCode) {
      const duplicateCode = await prisma.warehouses.findFirst({
        where: {
          WarehouseCode: input.warehouseCode.toUpperCase(),
          WarehouseID: { not: warehouseId },
        },
      });
      if (duplicateCode) {
        throw new ConflictError(`Warehouse code '${input.warehouseCode}' is already used by another facility`);
      }
    }

    const updated = await prisma.warehouses.update({
      where: { WarehouseID: warehouseId },
      data: {
        ...(input.warehouseName && { WarehouseName: input.warehouseName }),
        ...(input.warehouseCode && { WarehouseCode: input.warehouseCode.toUpperCase() }),
        ...(input.warehouseType && { WarehouseType: input.warehouseType }),
        ...(input.contactPersonName !== undefined && { ContactPersonName: input.contactPersonName }),
        ...(input.contactEmail !== undefined && { ContactEmail: input.contactEmail }),
        ...(input.contactPhoneNumber !== undefined && { ContactPhoneNumber: input.contactPhoneNumber }),
        ...(input.addressLine1 && { AddressLine1: input.addressLine1 }),
        ...(input.addressLine2 !== undefined && { AddressLine2: input.addressLine2 }),
        ...(input.city && { City: input.city }),
        ...(input.state && { State: input.state }),
        ...(input.postalCode && { PostalCode: input.postalCode }),
        ...(input.country && { Country: input.country }),
        ...(input.latitude !== undefined && { Latitude: input.latitude }),
        ...(input.longitude !== undefined && { Longitude: input.longitude }),
        ...(input.status && { Status: input.status }),
        UpdatedAt: new Date(),
        UpdatedBy: adminUserId,
      },
    });

    await prisma.dataAuditLogs.create({
      data: {
        TableName: 'Warehouses',
        PrimaryKeyID: warehouseId,
        ActionType: 'UPDATE',
        OldData: JSON.stringify({ status: existing.Status, name: existing.WarehouseName }),
        NewData: JSON.stringify({ status: updated.Status, name: updated.WarehouseName }),
        ContextUserID: adminUserId,
        CreatedAt: new Date(),
      },
    });

    return this.getWarehouseById(warehouseId);
  }

  /**
   * Assign a user to a warehouse as warehouse staff (auto-provisions user account if not existing)
   */
  async assignUser(adminUserId: bigint, warehouseId: bigint, input: string | AssignWarehouseUserInput) {
    const warehouse = await prisma.warehouses.findUnique({
      where: { WarehouseID: warehouseId },
    });
    if (!warehouse) {
      throw new NotFoundError('Warehouse not found');
    }

    const email = typeof input === 'string' ? input : input.email;
    const normalizedEmail = email.trim().toLowerCase();

    let targetUser = await prisma.users.findFirst({
      where: { Email: normalizedEmail },
    });

    let isNewUser = false;
    let temporaryPassword: string | null = null;

    if (!targetUser) {
      // Auto-provision user account with WAREHOUSE_USER role
      isNewUser = true;
      const firstName =
        typeof input !== 'string' && input.firstName?.trim()
          ? input.firstName.trim()
          : normalizedEmail.split('@')[0];
      const lastName =
        typeof input !== 'string' && input.lastName?.trim()
          ? input.lastName.trim()
          : 'Staff';
      const phoneNumber = typeof input !== 'string' ? input.phoneNumber?.trim() || null : null;
      temporaryPassword =
        typeof input !== 'string' && input.temporaryPassword?.trim()
          ? input.temporaryPassword.trim()
          : 'Warehouse@123';

      const passwordHash = await bcrypt.hash(temporaryPassword, 10);

      targetUser = await prisma.users.create({
        data: {
          FirstName: firstName,
          LastName: lastName,
          Email: normalizedEmail,
          PhoneNumber: phoneNumber,
          PasswordHash: passwordHash,
          Status: 'ACTIVE',
          CreatedAt: new Date(),
          CreatedBy: adminUserId,
        },
      });
    }

    // Ensure user has WAREHOUSE_USER role
    const whRole = await prisma.roles.findFirst({
      where: { RoleName: 'WAREHOUSE_USER' },
    });
    if (whRole) {
      const existingUserRole = await prisma.userRoles.findFirst({
        where: { UserID: targetUser.UserID, RoleID: whRole.RoleID },
      });
      if (!existingUserRole) {
        await prisma.userRoles.create({
          data: {
            UserID: targetUser.UserID,
            RoleID: whRole.RoleID,
            CreatedAt: new Date(),
            CreatedBy: adminUserId,
          },
        });
      }
    }

    // Upsert WarehouseUsers junction
    const existingWU = await prisma.warehouseUsers.findFirst({
      where: {
        WarehouseID: warehouseId,
        UserID: targetUser.UserID,
      },
    });

    if (existingWU) {
      if (existingWU.Status === 'ACTIVE') {
        throw new BadRequestError(`User ${email} is already active staff in this warehouse`);
      }
      await prisma.warehouseUsers.update({
        where: { WarehouseUserID: existingWU.WarehouseUserID },
        data: {
          Status: 'ACTIVE',
          UpdatedAt: new Date(),
          UpdatedBy: adminUserId,
        },
      });
    } else {
      await prisma.warehouseUsers.create({
        data: {
          WarehouseID: warehouseId,
          UserID: targetUser.UserID,
          Status: 'ACTIVE',
          CreatedAt: new Date(),
          CreatedBy: adminUserId,
        },
      });
    }

    const details = await this.getWarehouseById(warehouseId);
    return {
      ...details,
      assignedUser: {
        userId: Number(targetUser.UserID),
        email: targetUser.Email,
        firstName: targetUser.FirstName,
        lastName: targetUser.LastName,
        isNewUser,
        temporaryPassword,
      },
    };
  }

  /**
   * Remove a user from warehouse staff roster
   */
  async removeUser(adminUserId: bigint, warehouseId: bigint, targetUserId: bigint) {
    const wu = await prisma.warehouseUsers.findFirst({
      where: {
        WarehouseID: warehouseId,
        UserID: targetUserId,
      },
    });

    if (!wu) {
      throw new NotFoundError('User is not assigned to this warehouse');
    }

    await prisma.warehouseUsers.update({
      where: { WarehouseUserID: wu.WarehouseUserID },
      data: {
        Status: 'INACTIVE',
        UpdatedAt: new Date(),
        UpdatedBy: adminUserId,
      },
    });

    return this.getWarehouseById(warehouseId);
  }

  /**
   * Resolve warehouse profile for the authenticated warehouse operator
   */
  async getMyWarehouse(userId: bigint) {
    const wu = await prisma.warehouseUsers.findFirst({
      where: {
        UserID: userId,
        Status: 'ACTIVE',
      },
      include: {
        Warehouses: true,
      },
    });

    if (!wu) {
      // Check if user has administrative privileges
      const adminRole = await prisma.userRoles.findFirst({
        where: {
          UserID: userId,
          Roles: { RoleName: { in: ['SUPER_ADMIN', 'ADMIN'] } },
        },
      });

      if (adminRole) {
        const firstWh = await prisma.warehouses.findFirst({
          where: { Status: 'ACTIVE' },
          orderBy: { WarehouseID: 'asc' },
        });
        if (firstWh) {
          return this.getWarehouseById(firstWh.WarehouseID);
        }
      }

      throw new NotFoundError('No active warehouse facility assigned to your user account');
    }

    return this.getWarehouseById(wu.WarehouseID);
  }

  /**
   * Resolve live dynamic statistics, inventory metrics, and activity for the authenticated warehouse staff or admin
   */
  async getMyWarehouseStats(userId: bigint, warehouseIdOverride?: bigint) {
    let targetWarehouseId = warehouseIdOverride;

    if (!targetWarehouseId) {
      const wu = await prisma.warehouseUsers.findFirst({
        where: {
          UserID: userId,
          Status: 'ACTIVE',
        },
      });

      if (wu) {
        targetWarehouseId = wu.WarehouseID;
      } else {
        const adminRole = await prisma.userRoles.findFirst({
          where: {
            UserID: userId,
            Roles: { RoleName: { in: ['SUPER_ADMIN', 'ADMIN'] } },
          },
        });

        if (adminRole) {
          const firstWh = await prisma.warehouses.findFirst({
            where: { Status: 'ACTIVE' },
            orderBy: { WarehouseID: 'asc' },
          });
          if (firstWh) {
            targetWarehouseId = firstWh.WarehouseID;
          }
        }
      }
    }

    if (!targetWarehouseId) {
      throw new NotFoundError('No active warehouse facility assigned to your user account');
    }

    return this.getWarehouseStats(targetWarehouseId);
  }

  /**
   * Resolve live dynamic statistics, inventory metrics, and activity for a specific warehouse facility
   */
  async getWarehouseStats(warehouseId: bigint) {
    const wh = await prisma.warehouses.findUnique({
      where: { WarehouseID: warehouseId },
      include: {
        _count: {
          select: {
            WarehouseProducts: true,
            SellerWarehouses: { where: { Status: 'ACTIVE' } },
            WarehouseUsers: { where: { Status: 'ACTIVE' } },
          },
        },
      },
    });

    if (!wh) {
      throw new NotFoundError('Warehouse facility not found');
    }

    // 1. Live Inventory Aggregations
    const inventoryItems = await prisma.inventory.findMany({
      where: {
        WarehouseProducts: {
          WarehouseID: warehouseId,
        },
      },
      select: {
        InventoryID: true,
        PhysicalQuantity: true,
        ReservedQuantity: true,
        DamagedQuantity: true,
        SafetyStockQuantity: true,
        UpdatedAt: true,
      },
    });

    const physicalStock = inventoryItems.reduce((acc, i) => acc + (i.PhysicalQuantity || 0), 0);
    const reservedStock = inventoryItems.reduce((acc, i) => acc + (i.ReservedQuantity || 0), 0);
    const damagedStock = inventoryItems.reduce((acc, i) => acc + (i.DamagedQuantity || 0), 0);
    const safetyStock = inventoryItems.reduce((acc, i) => acc + (i.SafetyStockQuantity || 0), 0);
    const availableToPromise = Math.max(0, physicalStock - reservedStock - damagedStock);

    // 2. Active Order Reservations count
    const activeReservationsCount = await prisma.inventoryReservations.count({
      where: {
        Inventory: {
          WarehouseProducts: {
            WarehouseID: warehouseId,
          },
        },
        Status: { in: ['ACTIVE', 'PENDING', 'CONFIRMED'] },
      },
    });

    // 3. Transactions / Inbound activity
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const transactions = await prisma.inventoryTransactions.findMany({
      where: {
        Inventory: {
          WarehouseProducts: {
            WarehouseID: warehouseId,
          },
        },
      },
      select: {
        InventoryTransactionID: true,
        Quantity: true,
        TransactionType: true,
        CreatedAt: true,
      },
      orderBy: { CreatedAt: 'desc' },
      take: 200,
    });

    const inboundThisWeek = transactions
      .filter(
        (tx) =>
          (tx.TransactionType === 'RECEIPT' || tx.TransactionType === 'INBOUND') &&
          new Date(tx.CreatedAt) >= sevenDaysAgo
      )
      .reduce((sum, tx) => sum + tx.Quantity, 0);

    const totalInboundAllTime = transactions
      .filter((tx) => tx.TransactionType === 'RECEIPT' || tx.TransactionType === 'INBOUND')
      .reduce((sum, tx) => sum + tx.Quantity, 0);

    // Dynamic trend texts
    const physicalStockTrend =
      inboundThisWeek > 0
        ? `↑ +${inboundThisWeek.toLocaleString()} received this week`
        : totalInboundAllTime > 0
        ? `↑ +${totalInboundAllTime.toLocaleString()} total intake processed`
        : `Across ${wh._count.WarehouseProducts} active SKUs`;

    const reservedStockTrend =
      activeReservationsCount > 0
        ? `${activeReservationsCount} active order reservation${activeReservationsCount === 1 ? '' : 's'}`
        : reservedStock > 0
        ? 'Allocated for picking'
        : '0 active allocations pending';

    const damagedStockTrend =
      damagedStock > 0
        ? `${damagedStock} unit${damagedStock === 1 ? '' : 's'} flagged for QC review`
        : 'Excluded from ATP';

    // 4. Daily intake timeline for 7-day wave chart
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const past7DaysData: Array<{ day: string; date: string; units: number; isPeak?: boolean }> = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateKey = `${year}-${month}-${day}`;
      const dayOfWeek = dayNames[d.getDay()];
      const dateLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      // Sum receipts on this date
      const units = transactions
        .filter((tx) => {
          const txDate = new Date(tx.CreatedAt).toISOString().split('T')[0];
          return (
            txDate === dateKey &&
            (tx.TransactionType === 'RECEIPT' || tx.TransactionType === 'INBOUND')
          );
        })
        .reduce((sum, tx) => sum + tx.Quantity, 0);

      past7DaysData.push({
        day: dayOfWeek,
        date: dateLabel,
        units,
      });
    }

    // Find peak day
    let peakUnits = 0;
    let peakIndex = -1;
    past7DaysData.forEach((item, idx) => {
      if (item.units > peakUnits) {
        peakUnits = item.units;
        peakIndex = idx;
      }
    });

    const maxUnits = Math.max(peakUnits, 10);
    // Y-axis steps: 5 labels from max down to 20% of max
    const step = Math.ceil(maxUnits / 5);
    const roundStep =
      step >= 500
        ? Math.ceil(step / 100) * 100
        : step >= 50
        ? Math.ceil(step / 10) * 10
        : Math.max(1, step);
    const topAxis = roundStep * 5;
    const axisLabels = [topAxis, roundStep * 4, roundStep * 3, roundStep * 2, roundStep];

    // Compute SVG coordinates (viewBox 0 0 500 140, y ranges from 25 to 120)
    const pointsWithCoords = past7DaysData.map((d, idx) => {
      const x = Math.round((idx / (past7DaysData.length - 1)) * 500);
      const y = Math.round(120 - (d.units / topAxis) * 95);
      return {
        ...d,
        x,
        y,
        isPeak: idx === peakIndex && peakUnits > 0,
      };
    });

    // Generate smooth SVG curve path
    let pathD = `M ${pointsWithCoords[0].x} ${pointsWithCoords[0].y}`;
    for (let i = 0; i < pointsWithCoords.length - 1; i++) {
      const p0 = pointsWithCoords[i];
      const p1 = pointsWithCoords[i + 1];
      const cx1 = Math.round(p0.x + (p1.x - p0.x) / 2);
      const cy1 = p0.y;
      const cx2 = Math.round(p0.x + (p1.x - p0.x) / 2);
      const cy2 = p1.y;
      pathD += ` C ${cx1} ${cy1}, ${cx2} ${cy2}, ${p1.x} ${p1.y}`;
    }
    const areaD = `${pathD} L 500 140 L 0 140 Z`;

    // Highlight points (peak point and latest point)
    const highlightPoints: Array<{ x: number; y: number; units: number; label: string }> = [];
    if (peakIndex >= 0 && peakUnits > 0) {
      highlightPoints.push({
        x: pointsWithCoords[peakIndex].x,
        y: pointsWithCoords[peakIndex].y,
        units: pointsWithCoords[peakIndex].units,
        label: `${pointsWithCoords[peakIndex].day} (Peak)`,
      });
    }
    const latestPoint = pointsWithCoords[pointsWithCoords.length - 1];
    if (latestPoint && (peakIndex !== pointsWithCoords.length - 1 || peakUnits === 0)) {
      highlightPoints.push({
        x: latestPoint.x,
        y: latestPoint.y,
        units: latestPoint.units,
        label: `${latestPoint.day} (Today)`,
      });
    }

    // 4 Key summary items for below the chart
    const summaryCards = [
      {
        dayLabel: past7DaysData[0].day,
        units: past7DaysData[0].units,
        unitsFormatted: `${past7DaysData[0].units.toLocaleString()} units`,
        isPeak: past7DaysData[0].isPeak,
      },
      {
        dayLabel: past7DaysData[2].day,
        units: past7DaysData[2].units,
        unitsFormatted: `${past7DaysData[2].units.toLocaleString()} units`,
        isPeak: past7DaysData[2].isPeak,
      },
      {
        dayLabel: past7DaysData[4].day,
        units: past7DaysData[4].units,
        unitsFormatted: `${past7DaysData[4].units.toLocaleString()} units`,
        isPeak: past7DaysData[4].isPeak,
      },
      {
        dayLabel: peakUnits > 0 ? `${past7DaysData[peakIndex].day} (Peak)` : past7DaysData[6].day,
        units: peakUnits > 0 ? peakUnits : past7DaysData[6].units,
        unitsFormatted: `${(peakUnits > 0 ? peakUnits : past7DaysData[6].units).toLocaleString()} units`,
        isPeak: peakUnits > 0,
      },
    ];

    const fullAddress = [
      wh.AddressLine1,
      wh.AddressLine2,
      wh.City,
      wh.State,
      wh.PostalCode ? `(${wh.PostalCode})` : '',
    ]
      .filter(Boolean)
      .join(', ');

    return {
      warehouse: {
        warehouseId: Number(wh.WarehouseID),
        warehouseName: wh.WarehouseName,
        warehouseCode: wh.WarehouseCode,
        warehouseType: wh.WarehouseType,
        status: wh.Status,
        address: fullAddress || `${wh.City}, ${wh.State}`,
        addressLine1: wh.AddressLine1,
        addressLine2: wh.AddressLine2,
        city: wh.City,
        state: wh.State,
        postalCode: wh.PostalCode,
        country: wh.Country,
        contactPersonName: wh.ContactPersonName,
        contactEmail: wh.ContactEmail,
        contactPhoneNumber: wh.ContactPhoneNumber,
      },
      metrics: {
        physicalStock,
        physicalStockFormatted: `${physicalStock.toLocaleString()} Units`,
        physicalStockTrend,
        physicalStockTrendColor: 'text-emerald-700',

        reservedStock,
        reservedStockFormatted: `${reservedStock.toLocaleString()} Units`,
        reservedStockTrend,
        reservedStockTrendColor: 'text-[#0C6E7E]',

        damagedStock,
        damagedStockFormatted: `${damagedStock.toLocaleString()} Units`,
        damagedStockTrend,
        damagedStockTrendColor: 'text-amber-700',

        availableToPromise,
        availableToPromiseFormatted: `${availableToPromise.toLocaleString()} Units`,
        availableToPromiseTrend: 'Physical - Reserved - Damaged',
        availableToPromiseTrendColor: 'text-emerald-700',

        totalSKUs: wh._count.WarehouseProducts,
        connectedSellersCount: wh._count.SellerWarehouses,
        safetyStockTotal: safetyStock,
        activeReservationsCount,
        staffCount: wh._count.WarehouseUsers,
      },
      activityChart: {
        currentDateBadge: now.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
        maxAxisValue: topAxis,
        axisLabels,
        points: pointsWithCoords,
        svgPath: pathD,
        svgArea: areaD,
        highlightPoints,
        summaryCards,
        summary: {
          peakDayLabel: peakUnits > 0 ? `${past7DaysData[peakIndex].day} (Peak)` : 'N/A',
          peakDayUnits: peakUnits,
          totalWeekUnits: past7DaysData.reduce((sum, d) => sum + d.units, 0),
          recentInboundCount: transactions.length,
        },
      },
    };
  }

  /**
   * Seller: List staff assigned to one of their OWN warehouses
   */
  async listSellerWarehouseStaff(userId: bigint, warehouseId: bigint) {
    const seller = await this.getActiveSellerForUser(userId);

    // Verify the warehouse belongs to this seller and is OWN type
    const sw = await prisma.sellerWarehouses.findFirst({
      where: { SellerID: seller.SellerID, WarehouseID: warehouseId },
      include: { Warehouses: true },
    });
    if (!sw) throw new NotFoundError('Warehouse not found or does not belong to your seller account');
    if (sw.Warehouses.WarehouseType !== 'OWN') {
      throw new BadRequestError('Staff management is only available for seller-owned (OWN) warehouses');
    }

    const staffRows = await prisma.warehouseUsers.findMany({
      where: { WarehouseID: warehouseId, Status: 'ACTIVE' },
      include: { Users_WarehouseUsers_UserIDToUsers: true },
      orderBy: { CreatedAt: 'asc' },
    });

    return staffRows.map((wu) => ({
      warehouseUserId: Number(wu.WarehouseUserID),
      userId: Number(wu.Users_WarehouseUsers_UserIDToUsers.UserID),
      firstName: wu.Users_WarehouseUsers_UserIDToUsers.FirstName,
      lastName: wu.Users_WarehouseUsers_UserIDToUsers.LastName,
      email: wu.Users_WarehouseUsers_UserIDToUsers.Email,
      phoneNumber: wu.Users_WarehouseUsers_UserIDToUsers.PhoneNumber,
      status: wu.Status,
      assignedAt: wu.CreatedAt,
    }));
  }

  /**
   * Seller: Assign a user as staff to one of their OWN warehouses (supports auto-provisioning)
   */
  async assignSellerWarehouseStaff(userId: bigint, warehouseId: bigint, input: string | AssignWarehouseUserInput) {
    const seller = await this.getActiveSellerForUser(userId);

    const sw = await prisma.sellerWarehouses.findFirst({
      where: { SellerID: seller.SellerID, WarehouseID: warehouseId },
      include: { Warehouses: true },
    });
    if (!sw) throw new NotFoundError('Warehouse not found or does not belong to your seller account');
    if (sw.Warehouses.WarehouseType !== 'OWN') {
      throw new BadRequestError('Staff management is only available for seller-owned (OWN) warehouses');
    }

    // Delegate to the shared assignUser logic (same as admin)
    return this.assignUser(userId, warehouseId, input);
  }

  /**
   * Seller: Remove a staff member from one of their OWN warehouses
   */
  async removeSellerWarehouseStaff(userId: bigint, warehouseId: bigint, targetUserId: bigint) {
    const seller = await this.getActiveSellerForUser(userId);

    const sw = await prisma.sellerWarehouses.findFirst({
      where: { SellerID: seller.SellerID, WarehouseID: warehouseId },
      include: { Warehouses: true },
    });
    if (!sw) throw new NotFoundError('Warehouse not found or does not belong to your seller account');
    if (sw.Warehouses.WarehouseType !== 'OWN') {
      throw new BadRequestError('Staff management is only available for seller-owned (OWN) warehouses');
    }

    return this.removeUser(userId, warehouseId, targetUserId);
  }


  async listSellerWarehouses(userId: bigint) {
    const seller = await this.getActiveSellerForUser(userId);

    const sellerWarehouses = await prisma.sellerWarehouses.findMany({
      where: {
        SellerID: seller.SellerID,
      },
      orderBy: {
        CreatedAt: 'desc',
      },
      include: {
        Warehouses: true,
      },
    });

    const rejectedWarehouseIds = sellerWarehouses
      .filter((sw) => sw.Warehouses.Status === 'REJECTED')
      .map((sw) => sw.Warehouses.WarehouseID);

    const rejectionReasonsMap = new Map<string, string>();
    if (rejectedWarehouseIds.length > 0) {
      const logs = await prisma.dataAuditLogs.findMany({
        where: {
          TableName: 'Warehouses',
          PrimaryKeyID: { in: rejectedWarehouseIds },
          ActionType: 'UPDATE',
        },
        orderBy: { CreatedAt: 'desc' },
      });
      for (const log of logs) {
        if (log.NewData && !rejectionReasonsMap.has(log.PrimaryKeyID.toString())) {
          try {
            const parsed = JSON.parse(log.NewData);
            if (parsed.rejectionReason) {
              rejectionReasonsMap.set(log.PrimaryKeyID.toString(), parsed.rejectionReason);
            }
          } catch {}
        }
      }
    }

    return sellerWarehouses.map((sw) => ({
      sellerWarehouseId: Number(sw.SellerWarehouseID),
      warehouseId: Number(sw.Warehouses.WarehouseID),
      warehouseName: sw.Warehouses.WarehouseName,
      warehouseCode: sw.Warehouses.WarehouseCode,
      warehouseType: sw.Warehouses.WarehouseType,
      contactPersonName: sw.Warehouses.ContactPersonName,
      contactEmail: sw.Warehouses.ContactEmail,
      contactPhoneNumber: sw.Warehouses.ContactPhoneNumber,
      addressLine1: sw.Warehouses.AddressLine1,
      addressLine2: sw.Warehouses.AddressLine2,
      city: sw.Warehouses.City,
      state: sw.Warehouses.State,
      postalCode: sw.Warehouses.PostalCode,
      country: sw.Warehouses.Country,
      status: sw.Warehouses.Status,
      relationshipStatus: sw.Status,
      isPrimary: sw.IsPrimary,
      createdAt: sw.Warehouses.CreatedAt,
      rejectionReason: rejectionReasonsMap.get(sw.Warehouses.WarehouseID.toString()) || null,
    }));
  }

  /**
   * Get single warehouse details for the authenticated seller
   */
  async getSellerWarehouseById(userId: bigint, warehouseId: bigint) {
    const seller = await this.getActiveSellerForUser(userId);

    const sw = await prisma.sellerWarehouses.findFirst({
      where: {
        SellerID: seller.SellerID,
        WarehouseID: warehouseId,
      },
      include: {
        Warehouses: {
          include: {
            WarehouseConsents: {
              orderBy: { CreatedAt: 'desc' },
            },
          },
        },
        SellerWarehouseDocuments: {
          include: {
            DocumentTypes: true,
          },
        },
      },
    });

    if (!sw) {
      throw new NotFoundError('Warehouse not found or not associated with your seller account');
    }

    let rejectionReason: string | null = null;
    let latestStatusComment: string | null = null;
    const statusHistory = await this.getWarehouseStatusHistory(warehouseId);
    if (statusHistory.length > 0) {
      latestStatusComment = statusHistory[0].comments;
      if (sw.Warehouses.Status === 'REJECTED' && !rejectionReason) {
        rejectionReason = statusHistory[0].comments;
      }
    }
    if (sw.Warehouses.Status === 'REJECTED' && !rejectionReason) {
      const log = await prisma.dataAuditLogs.findFirst({
        where: {
          TableName: 'Warehouses',
          PrimaryKeyID: warehouseId,
          ActionType: 'UPDATE',
        },
        orderBy: { CreatedAt: 'desc' },
      });
      if (log?.NewData) {
        try {
          const parsed = JSON.parse(log.NewData);
          rejectionReason = parsed.rejectionReason || null;
        } catch {}
      }
    }

    const consents = sw.Warehouses.WarehouseConsents.map((c) => ({
      warehouseConsentId: Number(c.WarehouseConsentID),
      consentType: c.ConsentType,
      consentVersion: c.ConsentVersion,
      isGranted: c.IsGranted,
      grantedAt: c.GrantedAt,
      revokedAt: c.RevokedAt,
      source: c.Source,
      createdAt: c.CreatedAt,
    }));

    const requiredDocuments = (await prisma.warehouseDocumentRequirements.findMany({
      where: {
        WarehouseType: sw.Warehouses.WarehouseType,
        IsActive: true,
      },
      include: { DocumentTypes: true },
    })).map((r) => ({
      documentTypeId: r.DocumentTypeID,
      code: r.DocumentTypes.Code,
      displayName: r.DocumentTypes.DisplayName,
      warehouseType: r.WarehouseType,
      isRequired: r.IsRequired,
    }));

    const documents = (sw.SellerWarehouseDocuments || []).map((doc) => ({
      sellerWarehouseDocumentId: Number(doc.SellerWarehouseDocumentID),
      documentTypeId: doc.DocumentTypeID,
      code: doc.DocumentTypes.Code,
      displayName: doc.DocumentTypes.DisplayName,
      documentNumber: doc.DocumentNumber,
      documentUrl: doc.DocumentURL,
      verificationStatus: doc.VerificationStatus,
      rejectionReason: doc.RejectionReason,
      isMandatory: doc.IsMandatory,
      createdAt: doc.CreatedAt,
    }));

    const staffRows = await prisma.warehouseUsers.findMany({
      where: { WarehouseID: warehouseId, Status: 'ACTIVE' },
      include: { Users_WarehouseUsers_UserIDToUsers: true },
      orderBy: { CreatedAt: 'asc' },
    });

    const staffMembers = staffRows.map((wu) => ({
      warehouseUserId: Number(wu.WarehouseUserID),
      userId: Number(wu.Users_WarehouseUsers_UserIDToUsers.UserID),
      firstName: wu.Users_WarehouseUsers_UserIDToUsers.FirstName,
      lastName: wu.Users_WarehouseUsers_UserIDToUsers.LastName,
      email: wu.Users_WarehouseUsers_UserIDToUsers.Email,
      phoneNumber: wu.Users_WarehouseUsers_UserIDToUsers.PhoneNumber,
      status: wu.Status,
      assignedAt: wu.CreatedAt,
    }));

    return {
      sellerWarehouseId: Number(sw.SellerWarehouseID),
      warehouseId: Number(sw.Warehouses.WarehouseID),
      warehouseName: sw.Warehouses.WarehouseName,
      warehouseCode: sw.Warehouses.WarehouseCode,
      warehouseType: sw.Warehouses.WarehouseType,
      contactPersonName: sw.Warehouses.ContactPersonName,
      contactEmail: sw.Warehouses.ContactEmail,
      contactPhoneNumber: sw.Warehouses.ContactPhoneNumber,
      addressLine1: sw.Warehouses.AddressLine1,
      addressLine2: sw.Warehouses.AddressLine2,
      city: sw.Warehouses.City,
      state: sw.Warehouses.State,
      postalCode: sw.Warehouses.PostalCode,
      country: sw.Warehouses.Country,
      latitude: sw.Warehouses.Latitude ? Number(sw.Warehouses.Latitude) : null,
      longitude: sw.Warehouses.Longitude ? Number(sw.Warehouses.Longitude) : null,
      status: sw.Status,
      facilityStatus: sw.Warehouses.Status,
      isPrimary: sw.IsPrimary,
      createdAt: sw.CreatedAt,
      rejectionReason,
      latestStatusComment,
      statusHistory,
      consents,
      requiredDocuments,
      documents,
      staffMembers,
    };
  }

  /**
   * Seller: Create an OWN or 3PL warehouse and submit for admin approval
   */
  async createSellerWarehouse(userId: bigint, input: CreateSellerWarehouseInput) {
    const seller = await this.getActiveSellerForUser(userId);

    let assignedCode = input.warehouseCode ? input.warehouseCode.toUpperCase().trim() : '';
    if (!assignedCode) {
      assignedCode = await generateWarehouseCode(seller.SellerCode, prisma);
    }

    const existingCode = await prisma.warehouses.findFirst({
      where: { WarehouseCode: assignedCode },
    });

    if (existingCode) {
      throw new ConflictError(`Warehouse code '${assignedCode}' is already registered`);
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Warehouse with status PENDING_APPROVAL
      const createdWh = await tx.warehouses.create({
        data: {
          WarehouseName: input.warehouseName.trim(),
          WarehouseCode: assignedCode,
          WarehouseType: input.warehouseType,
          ContactPersonName: input.contactPersonName?.trim() || null,
          ContactEmail: input.contactEmail?.trim() || null,
          ContactPhoneNumber: input.contactPhoneNumber?.trim() || null,
          AddressLine1: input.addressLine1.trim(),
          AddressLine2: input.addressLine2?.trim() || null,
          City: input.city.trim(),
          State: input.state.trim(),
          PostalCode: input.postalCode.trim(),
          Country: input.country?.trim() || 'India',
          Latitude: input.latitude !== undefined ? input.latitude : null,
          Longitude: input.longitude !== undefined ? input.longitude : null,
          Status: 'PENDING_APPROVAL',
          CreatedAt: new Date(),
          CreatedBy: userId,
        },
      });

      // 2. If isPrimary is requested, clear existing primary flags for this seller
      if (input.isPrimary) {
        await tx.sellerWarehouses.updateMany({
          where: { SellerID: seller.SellerID, IsPrimary: true },
          data: { IsPrimary: false },
        });
      }

      // 3. Create SellerWarehouse relationship in PENDING status
      const createdSW = await tx.sellerWarehouses.create({
        data: {
          SellerID: seller.SellerID,
          WarehouseID: createdWh.WarehouseID,
          Status: 'PENDING',
          IsPrimary: input.isPrimary || false,
          CreatedAt: new Date(),
          CreatedBy: userId,
        },
      });

      // 4. Record digital warehouse compliance declaration
      await tx.warehouseConsents.create({
        data: {
          WarehouseID: createdWh.WarehouseID,
          ConsentType: 'FACILITY_SAFETY_AND_DISPATCH_DECLARATION',
          ConsentVersion: 'v1.0',
          IsGranted: true,
          GrantedAt: new Date(),
          Source: 'SELLER_PORTAL_WEB',
          CreatedAt: new Date(),
        },
      });

      // 5. Record audit log
      await tx.dataAuditLogs.create({
        data: {
          TableName: 'Warehouses',
          PrimaryKeyID: createdWh.WarehouseID,
          ActionType: 'INSERT',
          NewData: JSON.stringify({
            warehouseId: createdWh.WarehouseID.toString(),
            code: createdWh.WarehouseCode,
            name: createdWh.WarehouseName,
            type: input.warehouseType,
            status: 'PENDING_APPROVAL',
            sellerId: seller.SellerID.toString(),
            sellerCode: seller.SellerCode,
          }),
          ContextUserID: userId,
          CreatedAt: new Date(),
        },
      });

      // 6. Record status history
      await tx.warehouseStatusHistory.create({
        data: {
          WarehouseID: createdWh.WarehouseID,
          Status: 'PENDING_APPROVAL',
          Comments: 'Warehouse application submitted for verification',
          ChangedBy: userId,
          ChangedAt: new Date(),
          CreatedAt: new Date(),
        },
      });

      return {
        warehouse: createdWh,
        sellerWarehouse: createdSW,
      };
    });

    return this.getSellerWarehouseById(userId, result.warehouse.WarehouseID);
  }

  /**
   * Admin: Approve a pending warehouse application
   */
  async approveWarehouse(adminUserId: bigint, warehouseId: bigint) {
    const warehouse = await prisma.warehouses.findUnique({
      where: { WarehouseID: warehouseId },
    });

    if (!warehouse) {
      throw new NotFoundError('Warehouse facility not found');
    }

    if (warehouse.Status !== 'PENDING_APPROVAL') {
      throw new BadRequestError(
        `Warehouse cannot be approved from status '${warehouse.Status}'. Only PENDING_APPROVAL warehouses can be approved.`
      );
    }

    await prisma.$transaction(async (tx) => {
      // 1. Update Warehouse to ACTIVE
      await tx.warehouses.update({
        where: { WarehouseID: warehouseId },
        data: {
          Status: 'ACTIVE',
          UpdatedAt: new Date(),
          UpdatedBy: adminUserId,
        },
      });

      // 2. Update associated SellerWarehouses to ACTIVE
      await tx.sellerWarehouses.updateMany({
        where: {
          WarehouseID: warehouseId,
          Status: 'PENDING',
        },
        data: {
          Status: 'ACTIVE',
          UpdatedAt: new Date(),
          UpdatedBy: adminUserId,
        },
      });

      // 3. Record audit log
      await tx.dataAuditLogs.create({
        data: {
          TableName: 'Warehouses',
          PrimaryKeyID: warehouseId,
          ActionType: 'UPDATE',
          OldData: JSON.stringify({ status: warehouse.Status }),
          NewData: JSON.stringify({ status: 'ACTIVE', decision: 'APPROVE' }),
          ContextUserID: adminUserId,
          CreatedAt: new Date(),
        },
      });

      // 4. Record status history
      await tx.warehouseStatusHistory.create({
        data: {
          WarehouseID: warehouseId,
          Status: 'ACTIVE',
          Comments: 'Warehouse application verified and activated by administrator',
          ChangedBy: adminUserId,
          ChangedAt: new Date(),
          CreatedAt: new Date(),
        },
      });
    });

    return this.getWarehouseById(warehouseId);
  }

  /**
   * Admin: Reject a pending warehouse application
   */
  async rejectWarehouse(adminUserId: bigint, warehouseId: bigint, reason?: string) {
    const warehouse = await prisma.warehouses.findUnique({
      where: { WarehouseID: warehouseId },
    });

    if (!warehouse) {
      throw new NotFoundError('Warehouse facility not found');
    }

    if (warehouse.Status !== 'PENDING_APPROVAL') {
      throw new BadRequestError(
        `Warehouse cannot be rejected from status '${warehouse.Status}'. Only PENDING_APPROVAL warehouses can be rejected.`
      );
    }

    const rejectionReason = reason?.trim() || 'Application rejected by platform administrator';

    await prisma.$transaction(async (tx) => {
      // 1. Update Warehouse to REJECTED
      await tx.warehouses.update({
        where: { WarehouseID: warehouseId },
        data: {
          Status: 'REJECTED',
          UpdatedAt: new Date(),
          UpdatedBy: adminUserId,
        },
      });

      // 2. Update SellerWarehouses to REJECTED
      await tx.sellerWarehouses.updateMany({
        where: {
          WarehouseID: warehouseId,
        },
        data: {
          Status: 'REJECTED',
          UpdatedAt: new Date(),
          UpdatedBy: adminUserId,
        },
      });

      // 3. Record audit log with rejection reason
      await tx.dataAuditLogs.create({
        data: {
          TableName: 'Warehouses',
          PrimaryKeyID: warehouseId,
          ActionType: 'UPDATE',
          OldData: JSON.stringify({ status: warehouse.Status }),
          NewData: JSON.stringify({ status: 'REJECTED', decision: 'REJECT', rejectionReason }),
          ContextUserID: adminUserId,
          CreatedAt: new Date(),
        },
      });

      // 4. Record status history
      await tx.warehouseStatusHistory.create({
        data: {
          WarehouseID: warehouseId,
          Status: 'REJECTED',
          Comments: rejectionReason,
          ChangedBy: adminUserId,
          ChangedAt: new Date(),
          CreatedAt: new Date(),
        },
      });
    });

    return this.getWarehouseById(warehouseId);
  }

  /**
   * Admin: Request rework on a pending warehouse application
   */
  async requestWarehouseRework(adminUserId: bigint, warehouseId: bigint, comments: string) {
    const warehouse = await prisma.warehouses.findUnique({
      where: { WarehouseID: warehouseId },
    });

    if (!warehouse) {
      throw new NotFoundError('Warehouse facility not found');
    }

    if (warehouse.Status !== 'PENDING_APPROVAL') {
      throw new BadRequestError(
        `Warehouse rework can only be requested from status 'PENDING_APPROVAL'. Current status is '${warehouse.Status}'.`
      );
    }

    if (!comments || !comments.trim()) {
      throw new BadRequestError('Feedback comments are required when requesting rework');
    }

    const reworkReason = comments.trim();

    await prisma.$transaction(async (tx) => {
      // 1. Update Warehouse to REWORK_REQUIRED
      await tx.warehouses.update({
        where: { WarehouseID: warehouseId },
        data: {
          Status: 'REWORK_REQUIRED',
          UpdatedAt: new Date(),
          UpdatedBy: adminUserId,
        },
      });

      // 2. Update SellerWarehouses to REWORK_REQUIRED
      await tx.sellerWarehouses.updateMany({
        where: { WarehouseID: warehouseId },
        data: {
          Status: 'REWORK_REQUIRED',
          UpdatedAt: new Date(),
          UpdatedBy: adminUserId,
        },
      });

      // 3. Record in WarehouseStatusHistory
      await tx.warehouseStatusHistory.create({
        data: {
          WarehouseID: warehouseId,
          Status: 'REWORK_REQUIRED',
          Comments: reworkReason,
          ChangedBy: adminUserId,
          ChangedAt: new Date(),
          CreatedAt: new Date(),
        },
      });

      // 4. Record audit log
      await tx.dataAuditLogs.create({
        data: {
          TableName: 'Warehouses',
          PrimaryKeyID: warehouseId,
          ActionType: 'UPDATE',
          OldData: JSON.stringify({ status: warehouse.Status }),
          NewData: JSON.stringify({ status: 'REWORK_REQUIRED', decision: 'REWORK_REQUIRED', reworkReason }),
          ContextUserID: adminUserId,
          CreatedAt: new Date(),
        },
      });
    });

    return this.getWarehouseById(warehouseId);
  }

  /**
   * Seller: Resubmit warehouse after updating documents / info for rework
   */
  async resubmitSellerWarehouse(userId: bigint, warehouseId: bigint, remarks?: string) {
    const seller = await this.getActiveSellerForUser(userId);

    const sw = await prisma.sellerWarehouses.findFirst({
      where: {
        SellerID: seller.SellerID,
        WarehouseID: warehouseId,
      },
      include: {
        Warehouses: true,
      },
    });

    if (!sw) {
      throw new NotFoundError('Warehouse not found or not associated with your seller account');
    }

    if (sw.Warehouses.Status !== 'REWORK_REQUIRED' && sw.Status !== 'REWORK_REQUIRED') {
      throw new BadRequestError(
        `Warehouse is not in 'REWORK_REQUIRED' status (current warehouse status: '${sw.Warehouses.Status}')`
      );
    }

    const resubmitNotes = remarks?.trim() || 'Warehouse documents updated and resubmitted by merchant';

    await prisma.$transaction(async (tx) => {
      // 1. Update Warehouse to PENDING_APPROVAL
      await tx.warehouses.update({
        where: { WarehouseID: warehouseId },
        data: {
          Status: 'PENDING_APPROVAL',
          UpdatedAt: new Date(),
          UpdatedBy: userId,
        },
      });

      // 2. Update SellerWarehouse to PENDING
      await tx.sellerWarehouses.updateMany({
        where: {
          SellerID: seller.SellerID,
          WarehouseID: warehouseId,
        },
        data: {
          Status: 'PENDING',
          UpdatedAt: new Date(),
          UpdatedBy: userId,
        },
      });

      // 3. Record in WarehouseStatusHistory
      await tx.warehouseStatusHistory.create({
        data: {
          WarehouseID: warehouseId,
          Status: 'PENDING_APPROVAL',
          Comments: `Resubmitted by seller: ${resubmitNotes}`,
          ChangedBy: userId,
          ChangedAt: new Date(),
          CreatedAt: new Date(),
        },
      });

      // 4. Record audit log
      await tx.dataAuditLogs.create({
        data: {
          TableName: 'Warehouses',
          PrimaryKeyID: warehouseId,
          ActionType: 'UPDATE',
          OldData: JSON.stringify({ status: sw.Warehouses.Status }),
          NewData: JSON.stringify({ status: 'PENDING_APPROVAL', action: 'RESUBMIT', resubmitNotes }),
          ContextUserID: userId,
          CreatedAt: new Date(),
        },
      });
    });

    return this.getSellerWarehouseById(userId, warehouseId);
  }

  /**
   * Get status history timeline for a warehouse
   */
  async getWarehouseStatusHistory(warehouseId: bigint) {
    const history = await prisma.warehouseStatusHistory.findMany({
      where: { WarehouseID: warehouseId },
      orderBy: { ChangedAt: 'desc' },
      include: {
        Users: {
          select: {
            UserID: true,
            FirstName: true,
            LastName: true,
            Email: true,
          },
        },
      },
    });

    return history.map((item) => ({
      historyId: Number(item.WarehouseStatusHistoryID),
      warehouseId: Number(item.WarehouseID),
      status: item.Status,
      comments: item.Comments,
      changedAt: item.ChangedAt,
      changedBy: {
        userId: Number(item.Users.UserID),
        name: `${item.Users.FirstName} ${item.Users.LastName}`.trim(),
        email: item.Users.Email,
      },
    }));
  }

  /**
   * Seller: List all active 3PL warehouses available for connection with seller's connection status
   */
  async listAvailable3PLWarehouses(userId: bigint) {
    const seller = await this.getActiveSellerForUser(userId);

    const [warehouses, sellerLinks] = await Promise.all([
      prisma.warehouses.findMany({
        where: {
          WarehouseType: { in: ['3PL', 'THIRD_PARTY'] },
          Status: 'ACTIVE',
        },
        orderBy: { WarehouseName: 'asc' },
        include: {
          _count: {
            select: {
              SellerWarehouses: { where: { Status: 'ACTIVE' } },
              WarehouseProducts: true,
            },
          },
        },
      }),
      prisma.sellerWarehouses.findMany({
        where: { SellerID: seller.SellerID },
      }),
    ]);

    const linksMap = new Map<string, (typeof sellerLinks)[0]>();
    for (const link of sellerLinks) {
      linksMap.set(link.WarehouseID.toString(), link);
    }

    return warehouses.map((wh) => {
      const link = linksMap.get(wh.WarehouseID.toString());
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
        status: wh.Status,
        connectedSellersCount: wh._count.SellerWarehouses,
        totalProductsCount: wh._count.WarehouseProducts,
        connectionStatus: link ? link.Status : 'NOT_CONNECTED',
        sellerWarehouseId: link ? Number(link.SellerWarehouseID) : null,
        isPrimary: link ? link.IsPrimary : false,
      };
    });
  }

  /**
   * Seller: Request connection to an active 3PL warehouse
   */
  async request3PLConnection(
    userId: bigint,
    warehouseId: bigint,
    isPrimary?: boolean,
    notes?: string
  ) {
    const seller = await this.getActiveSellerForUser(userId);

    const warehouse = await prisma.warehouses.findUnique({
      where: { WarehouseID: warehouseId },
    });

    if (!warehouse) {
      throw new NotFoundError('Target 3PL warehouse not found');
    }

    if (
      warehouse.Status !== 'ACTIVE' ||
      !['3PL', 'THIRD_PARTY'].includes(warehouse.WarehouseType)
    ) {
      throw new BadRequestError('Target facility is not an active 3PL partner warehouse');
    }

    const existingLink = await prisma.sellerWarehouses.findFirst({
      where: {
        SellerID: seller.SellerID,
        WarehouseID: warehouseId,
      },
    });

    if (existingLink) {
      if (existingLink.Status === 'ACTIVE') {
        throw new ConflictError('Your seller account is already actively linked to this 3PL warehouse');
      }
      if (existingLink.Status === 'PENDING') {
        throw new BadRequestError('A connection request to this 3PL warehouse is already pending review');
      }

      // If REJECTED or TERMINATED, reactivate request to PENDING
      const updated = await prisma.$transaction(async (tx) => {
        if (isPrimary) {
          await tx.sellerWarehouses.updateMany({
            where: { SellerID: seller.SellerID, IsPrimary: true },
            data: { IsPrimary: false },
          });
        }

        const sw = await tx.sellerWarehouses.update({
          where: { SellerWarehouseID: existingLink.SellerWarehouseID },
          data: {
            Status: 'PENDING',
            IsPrimary: isPrimary || false,
            UpdatedAt: new Date(),
            UpdatedBy: userId,
          },
          include: { Warehouses: true },
        });

        await tx.dataAuditLogs.create({
          data: {
            TableName: 'SellerWarehouses',
            PrimaryKeyID: sw.SellerWarehouseID,
            ActionType: 'UPDATE',
            NewData: JSON.stringify({
              sellerId: seller.SellerID.toString(),
              warehouseId: warehouseId.toString(),
              status: 'PENDING',
              notes,
              action: '3PL_RECONNECT_REQUEST',
            }),
            ContextUserID: userId,
            CreatedAt: new Date(),
          },
        });

        // Record digital warehouse consent
        await tx.warehouseConsents.create({
          data: {
            WarehouseID: warehouseId,
            ConsentType: '3PL_FULFILLMENT_SLA_AGREEMENT',
            ConsentVersion: 'v1.0',
            IsGranted: true,
            GrantedAt: new Date(),
            Source: 'SELLER_PORTAL_WEB',
            CreatedAt: new Date(),
          },
        });

        return sw;
      });

      return {
        sellerWarehouseId: Number(updated.SellerWarehouseID),
        warehouseId: Number(updated.WarehouseID),
        warehouseName: updated.Warehouses.WarehouseName,
        warehouseCode: updated.Warehouses.WarehouseCode,
        relationshipStatus: updated.Status,
        isPrimary: updated.IsPrimary,
      };
    }

    // New connection request
    const created = await prisma.$transaction(async (tx) => {
      if (isPrimary) {
        await tx.sellerWarehouses.updateMany({
          where: { SellerID: seller.SellerID, IsPrimary: true },
          data: { IsPrimary: false },
        });
      }

      const sw = await tx.sellerWarehouses.create({
        data: {
          SellerID: seller.SellerID,
          WarehouseID: warehouseId,
          Status: 'PENDING',
          IsPrimary: isPrimary || false,
          CreatedAt: new Date(),
          CreatedBy: userId,
        },
        include: { Warehouses: true },
      });

      await tx.dataAuditLogs.create({
        data: {
          TableName: 'SellerWarehouses',
          PrimaryKeyID: sw.SellerWarehouseID,
          ActionType: 'INSERT',
          NewData: JSON.stringify({
            sellerId: seller.SellerID.toString(),
            warehouseId: warehouseId.toString(),
            status: 'PENDING',
            notes,
            action: '3PL_CONNECT_REQUEST',
          }),
          ContextUserID: userId,
          CreatedAt: new Date(),
        },
      });

      // Record digital warehouse consent
      await tx.warehouseConsents.create({
        data: {
          WarehouseID: warehouseId,
          ConsentType: '3PL_FULFILLMENT_SLA_AGREEMENT',
          ConsentVersion: 'v1.0',
          IsGranted: true,
          GrantedAt: new Date(),
          Source: 'SELLER_PORTAL_WEB',
          CreatedAt: new Date(),
        },
      });

      return sw;
    });

    return {
      sellerWarehouseId: Number(created.SellerWarehouseID),
      warehouseId: Number(created.WarehouseID),
      warehouseName: created.Warehouses.WarehouseName,
      warehouseCode: created.Warehouses.WarehouseCode,
      relationshipStatus: created.Status,
      isPrimary: created.IsPrimary,
    };
  }

  /**
   * Seller: Disconnect / terminate linkage from a 3PL warehouse
   */
  async disconnect3PLWarehouse(userId: bigint, warehouseId: bigint) {
    const seller = await this.getActiveSellerForUser(userId);

    const link = await prisma.sellerWarehouses.findFirst({
      where: {
        SellerID: seller.SellerID,
        WarehouseID: warehouseId,
      },
    });

    if (!link) {
      throw new NotFoundError('No connection found between your seller account and this warehouse');
    }

    await prisma.sellerWarehouses.update({
      where: { SellerWarehouseID: link.SellerWarehouseID },
      data: {
        Status: 'TERMINATED',
        IsPrimary: false,
        UpdatedAt: new Date(),
        UpdatedBy: userId,
      },
    });

    // Record consent revocation
    await prisma.warehouseConsents.create({
      data: {
        WarehouseID: warehouseId,
        ConsentType: '3PL_FULFILLMENT_SLA_AGREEMENT',
        ConsentVersion: 'v1.0',
        IsGranted: false,
        RevokedAt: new Date(),
        Source: 'SELLER_PORTAL_WEB',
        CreatedAt: new Date(),
      },
    });

    await prisma.dataAuditLogs.create({
      data: {
        TableName: 'SellerWarehouses',
        PrimaryKeyID: link.SellerWarehouseID,
        ActionType: 'UPDATE',
        NewData: JSON.stringify({
          sellerId: seller.SellerID.toString(),
          warehouseId: warehouseId.toString(),
          status: 'TERMINATED',
          action: '3PL_DISCONNECT',
        }),
        ContextUserID: userId,
        CreatedAt: new Date(),
      },
    });

    return { success: true, message: 'Successfully disconnected from 3PL facility' };
  }

  /**
   * Admin: Directly link an active seller to an active 3PL warehouse
   */
  async linkSellerTo3PLWarehouse(
    adminUserId: bigint,
    sellerId: bigint,
    warehouseId: bigint,
    isPrimary?: boolean
  ) {
    const [seller, warehouse] = await Promise.all([
      prisma.sellers.findUnique({ where: { SellerID: sellerId } }),
      prisma.warehouses.findUnique({ where: { WarehouseID: warehouseId } }),
    ]);

    if (!seller || seller.Status !== 'ACTIVE') {
      throw new BadRequestError('Target merchant entity must be active');
    }

    if (
      !warehouse ||
      warehouse.Status !== 'ACTIVE' ||
      !['3PL', 'THIRD_PARTY'].includes(warehouse.WarehouseType)
    ) {
      throw new BadRequestError('Target facility must be an active 3PL partner warehouse');
    }

    await prisma.$transaction(async (tx) => {
      if (isPrimary) {
        await tx.sellerWarehouses.updateMany({
          where: { SellerID: sellerId, IsPrimary: true },
          data: { IsPrimary: false },
        });
      }

      const existing = await tx.sellerWarehouses.findFirst({
        where: { SellerID: sellerId, WarehouseID: warehouseId },
      });

      let sw;
      if (existing) {
        sw = await tx.sellerWarehouses.update({
          where: { SellerWarehouseID: existing.SellerWarehouseID },
          data: {
            Status: 'ACTIVE',
            IsPrimary: isPrimary || false,
            UpdatedAt: new Date(),
            UpdatedBy: adminUserId,
          },
        });
      } else {
        sw = await tx.sellerWarehouses.create({
          data: {
            SellerID: sellerId,
            WarehouseID: warehouseId,
            Status: 'ACTIVE',
            IsPrimary: isPrimary || false,
            CreatedAt: new Date(),
            CreatedBy: adminUserId,
          },
        });
      }

      // Record 3PL warehouse consent
      await tx.warehouseConsents.create({
        data: {
          WarehouseID: warehouseId,
          ConsentType: '3PL_FULFILLMENT_SLA_AGREEMENT',
          ConsentVersion: 'v1.0',
          IsGranted: true,
          GrantedAt: new Date(),
          Source: 'ADMIN_PORTAL',
          CreatedAt: new Date(),
        },
      });

      await tx.dataAuditLogs.create({
        data: {
          TableName: 'SellerWarehouses',
          PrimaryKeyID: sw.SellerWarehouseID,
          ActionType: existing ? 'UPDATE' : 'INSERT',
          NewData: JSON.stringify({
            sellerId: sellerId.toString(),
            warehouseId: warehouseId.toString(),
            status: 'ACTIVE',
            action: 'ADMIN_DIRECT_LINK',
          }),
          ContextUserID: adminUserId,
          CreatedAt: new Date(),
        },
      });

      return sw;
    });

    return this.getWarehouseById(warehouseId);
  }

  /**
   * Admin: Review (Approve or Reject) a pending seller-3PL linkage request
   */
  async reviewSellerLinkage(
    adminUserId: bigint,
    sellerWarehouseId: bigint,
    decision: 'APPROVE' | 'REJECT',
    comments?: string
  ) {
    const sw = await prisma.sellerWarehouses.findUnique({
      where: { SellerWarehouseID: sellerWarehouseId },
      include: { Sellers: true, Warehouses: true },
    });

    if (!sw) {
      throw new NotFoundError('Seller warehouse linkage record not found');
    }

    const newStatus = decision === 'APPROVE' ? 'ACTIVE' : 'REJECTED';

    await prisma.$transaction(async (tx) => {
      await tx.sellerWarehouses.update({
        where: { SellerWarehouseID: sellerWarehouseId },
        data: {
          Status: newStatus,
          UpdatedAt: new Date(),
          UpdatedBy: adminUserId,
        },
      });

      await tx.dataAuditLogs.create({
        data: {
          TableName: 'SellerWarehouses',
          PrimaryKeyID: sellerWarehouseId,
          ActionType: 'UPDATE',
          OldData: JSON.stringify({ status: sw.Status }),
          NewData: JSON.stringify({ status: newStatus, decision, comments }),
          ContextUserID: adminUserId,
          CreatedAt: new Date(),
        },
      });
    });

    return this.getWarehouseById(sw.WarehouseID);
  }

  /**
   * Admin: Unlink / terminate a seller from a warehouse
   */
  async unlinkSellerFromWarehouse(adminUserId: bigint, sellerWarehouseId: bigint) {
    const sw = await prisma.sellerWarehouses.findUnique({
      where: { SellerWarehouseID: sellerWarehouseId },
    });

    if (!sw) {
      throw new NotFoundError('Seller warehouse linkage record not found');
    }

    await prisma.$transaction(async (tx) => {
      await tx.sellerWarehouses.update({
        where: { SellerWarehouseID: sellerWarehouseId },
        data: {
          Status: 'TERMINATED',
          IsPrimary: false,
          UpdatedAt: new Date(),
          UpdatedBy: adminUserId,
        },
      });

      await tx.warehouseConsents.create({
        data: {
          WarehouseID: sw.WarehouseID,
          ConsentType: '3PL_FULFILLMENT_SLA_AGREEMENT',
          ConsentVersion: 'v1.0',
          IsGranted: false,
          RevokedAt: new Date(),
          Source: 'ADMIN_PORTAL',
          CreatedAt: new Date(),
        },
      });

      await tx.dataAuditLogs.create({
        data: {
          TableName: 'SellerWarehouses',
          PrimaryKeyID: sellerWarehouseId,
          ActionType: 'UPDATE',
          NewData: JSON.stringify({ status: 'TERMINATED', action: 'ADMIN_UNLINK' }),
          ContextUserID: adminUserId,
          CreatedAt: new Date(),
        },
      });
    });

    return this.getWarehouseById(sw.WarehouseID);
  }

  /**
   * Get dynamic document requirements for a warehouse type (OWN, 3PL)
   */
  async getWarehouseDocumentRequirements(warehouseType: string) {
    const normalizedType =
      warehouseType.toUpperCase() === '3PL' || warehouseType.toUpperCase() === 'THIRD_PARTY'
        ? '3PL'
        : 'OWN';

    const reqs = await prisma.warehouseDocumentRequirements.findMany({
      where: {
        WarehouseType: normalizedType,
        IsActive: true,
      },
      include: {
        DocumentTypes: true,
      },
    });

    return reqs.map((r) => ({
      documentTypeId: r.DocumentTypeID,
      code: r.DocumentTypes.Code,
      displayName: r.DocumentTypes.DisplayName,
      warehouseType: r.WarehouseType,
      isRequired: r.IsRequired,
    }));
  }

  /**
   * Upload a compliance document for a seller warehouse linkage
   */
  async uploadSellerWarehouseDocument(
    userId: bigint,
    sellerWarehouseId: bigint,
    input: UploadWarehouseDocumentInput,
    file: Express.Multer.File
  ) {
    const seller = await this.getActiveSellerForUser(userId);

    const sw = await prisma.sellerWarehouses.findFirst({
      where: {
        SellerID: seller.SellerID,
        OR: [
          { SellerWarehouseID: sellerWarehouseId },
          { WarehouseID: sellerWarehouseId },
        ],
      },
      include: {
        Warehouses: true,
      },
    });

    if (!sw) {
      throw new NotFoundError('Warehouse linkage not found or does not belong to your seller account');
    }

    const docType = await prisma.documentTypes.findFirst({
      where: { Code: input.documentTypeCode },
    });

    if (!docType) {
      throw new BadRequestError(`Document type '${input.documentTypeCode}' not found`);
    }

    // Check if required in WarehouseDocumentRequirements
    const requirement = await prisma.warehouseDocumentRequirements.findFirst({
      where: {
        WarehouseType: sw.Warehouses.WarehouseType,
        DocumentTypeID: docType.DocumentTypeID,
        IsActive: true,
      },
    });

    const isMandatory = requirement ? requirement.IsRequired : false;
    const { relativeUrl } = await storageService.saveFile(file, 'warehouse-documents');

    const existing = await prisma.sellerWarehouseDocuments.findFirst({
      where: {
        SellerWarehouseID: sw.SellerWarehouseID,
        DocumentTypeID: docType.DocumentTypeID,
      },
    });

    let doc;
    if (existing) {
      doc = await prisma.sellerWarehouseDocuments.update({
        where: { SellerWarehouseDocumentID: existing.SellerWarehouseDocumentID },
        data: {
          DocumentNumber: input.documentNumber?.trim() || existing.DocumentNumber,
          DocumentURL: relativeUrl,
          VerificationStatus: 'PENDING',
          RejectionReason: null,
          IsMandatory: isMandatory,
          UpdatedAt: new Date(),
        },
        include: { DocumentTypes: true },
      });
    } else {
      doc = await prisma.sellerWarehouseDocuments.create({
        data: {
          SellerWarehouseID: sw.SellerWarehouseID,
          DocumentTypeID: docType.DocumentTypeID,
          DocumentNumber: input.documentNumber?.trim() || null,
          DocumentURL: relativeUrl,
          VerificationStatus: 'PENDING',
          IsMandatory: isMandatory,
          CreatedAt: new Date(),
        },
        include: { DocumentTypes: true },
      });
    }

    return {
      sellerWarehouseDocumentId: Number(doc.SellerWarehouseDocumentID),
      documentTypeId: doc.DocumentTypeID,
      code: doc.DocumentTypes.Code,
      displayName: doc.DocumentTypes.DisplayName,
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
    const doc = await prisma.sellerWarehouseDocuments.findUnique({
      where: { SellerWarehouseDocumentID: sellerWarehouseDocumentId },
    });

    if (!doc) {
      throw new NotFoundError('Warehouse document record not found');
    }

    const updated = await prisma.sellerWarehouseDocuments.update({
      where: { SellerWarehouseDocumentID: sellerWarehouseDocumentId },
      data: {
        VerificationStatus: decision === 'VERIFY' ? 'VERIFIED' : 'REJECTED',
        RejectionReason: decision === 'REJECT' ? rejectionReason || 'Document rejected by administrator' : null,
        VerifiedBy: adminUserId,
        VerifiedAt: new Date(),
        UpdatedAt: new Date(),
      },
      include: { DocumentTypes: true },
    });

    return {
      sellerWarehouseDocumentId: Number(updated.SellerWarehouseDocumentID),
      documentTypeId: updated.DocumentTypeID,
      code: updated.DocumentTypes.Code,
      displayName: updated.DocumentTypes.DisplayName,
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
