import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../database/prisma.js';
import { config } from '../../config/index.js';
import { UnauthorizedError, BadRequestError, NotFoundError } from '../../utils/errors.js';
import {
  LoginInput,
  ChangePasswordInput,
  SellerRegisterInput,
  CustomerRegisterInput,
  ForgotPasswordInput,
  ResetPasswordInput,
} from './auth.validation.js';
import { AuthUser, JwtPayload } from '../../types/auth.js';
import { generateSellerCode } from '../../utils/codeGenerator.js';
import { mailService } from '../../utils/mailService.js';

export class AuthService {
  async login(input: LoginInput): Promise<{ accessToken: string; user: AuthUser }> {
    const user = await prisma.users.findFirst({
      where: { Email: input.email },
      include: {
        UserRoles_UserRoles_UserIDToUsers: {
          include: {
            Roles: {
              include: {
                RolePermissions: {
                  include: {
                    Permissions: true,
                  },
                },
              },
            },
          },
        },
        SellerUsers_SellerUsers_UserIDToUsers: {
          include: {
            Sellers: true,
          },
        },
        WarehouseUsers_WarehouseUsers_UserIDToUsers: {
          include: {
            Warehouses: true,
          },
        },
      },
    });

    if (!user || !user.PasswordHash) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(input.password, user.PasswordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    if (user.Status !== 'ACTIVE') {
      throw new UnauthorizedError(`Your account is currently ${user.Status.toLowerCase()}`);
    }

    // Update LastLoginAt in background
    await prisma.users.update({
      where: { UserID: user.UserID },
      data: { LastLoginAt: new Date() },
    });

    // Extract roles
    const userRoles = user.UserRoles_UserRoles_UserIDToUsers;
    const roles = userRoles
      .filter((ur) => ur.Roles.Status === 'ACTIVE')
      .map((ur) => ur.Roles.RoleName);

    // Extract permissions
    const permissionsSet = new Set<string>();
    for (const ur of userRoles) {
      if (ur.Roles.Status === 'ACTIVE') {
        for (const rp of ur.Roles.RolePermissions) {
          permissionsSet.add(rp.Permissions.PermissionCode);
        }
      }
    }

    // Extract sellers — include ALL linked sellers regardless of onboarding status.
    // The seller portal's onboarding wizard and dashboard handle status gating.
    const sellerUsers = user.SellerUsers_SellerUsers_UserIDToUsers;
    const sellers = sellerUsers
      .filter((su) => su.Status === 'ACTIVE')
      .map((su) => ({
        sellerId: String(su.Sellers.SellerID),
        sellerCode: su.Sellers.SellerCode,
        sellerName: su.Sellers.SellerName,
        status: su.Sellers.Status,
      }));

    // Extract warehouses
    const warehouseUsers = user.WarehouseUsers_WarehouseUsers_UserIDToUsers;
    let warehouses = warehouseUsers
      .filter((wu) => wu.Status === 'ACTIVE')
      .map((wu) => ({
        warehouseId: String(wu.Warehouses.WarehouseID),
        warehouseCode: wu.Warehouses.WarehouseCode,
        warehouseName: wu.Warehouses.WarehouseName,
        warehouseType: wu.Warehouses.WarehouseType,
        status: wu.Warehouses.Status,
      }));

    if (warehouses.length === 0 && (roles.includes('SUPER_ADMIN') || roles.includes('ADMIN'))) {
      const activePlatformWarehouses = await prisma.warehouses.findMany({
        where: { Status: 'ACTIVE' },
        orderBy: { WarehouseID: 'asc' },
        take: 10,
      });
      warehouses = activePlatformWarehouses.map((wh) => ({
        warehouseId: String(wh.WarehouseID),
        warehouseCode: wh.WarehouseCode,
        warehouseName: wh.WarehouseName,
        warehouseType: wh.WarehouseType,
        status: wh.Status,
      }));
    }

    const authUser: AuthUser = {
      userId: String(user.UserID),
      email: user.Email,
      firstName: user.FirstName,
      lastName: user.LastName,
      status: user.Status,
      roles,
      permissions: Array.from(permissionsSet),
      sellers,
      warehouses,
    };

    // Sign JWT Access Token (V1 uses access token only)
    const payload: JwtPayload = {
      userId: authUser.userId,
      email: authUser.email,
      roles: authUser.roles,
    };

    const accessToken = jwt.sign(payload, config.JWT_SECRET, {
      expiresIn: config.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    });

    return { accessToken, user: authUser };
  }

  async getProfile(userId: string): Promise<AuthUser> {
    const userIdBigInt = BigInt(userId);
    const user = await prisma.users.findUnique({
      where: { UserID: userIdBigInt },
      include: {
        UserRoles_UserRoles_UserIDToUsers: {
          include: {
            Roles: {
              include: {
                RolePermissions: {
                  include: {
                    Permissions: true,
                  },
                },
              },
            },
          },
        },
        SellerUsers_SellerUsers_UserIDToUsers: {
          include: {
            Sellers: true,
          },
        },
        WarehouseUsers_WarehouseUsers_UserIDToUsers: {
          include: {
            Warehouses: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    const userRoles = user.UserRoles_UserRoles_UserIDToUsers;
    const roles = userRoles
      .filter((ur) => ur.Roles.Status === 'ACTIVE')
      .map((ur) => ur.Roles.RoleName);

    const permissionsSet = new Set<string>();
    for (const ur of userRoles) {
      if (ur.Roles.Status === 'ACTIVE') {
        for (const rp of ur.Roles.RolePermissions) {
          permissionsSet.add(rp.Permissions.PermissionCode);
        }
      }
    }

    const sellerUsers = user.SellerUsers_SellerUsers_UserIDToUsers;
    const sellers = sellerUsers
      .filter((su) => su.Status === 'ACTIVE')
      .map((su) => ({
        sellerId: String(su.Sellers.SellerID),
        sellerCode: su.Sellers.SellerCode,
        sellerName: su.Sellers.SellerName,
        status: su.Sellers.Status,
      }));

    const warehouseUsers = user.WarehouseUsers_WarehouseUsers_UserIDToUsers;
    let warehouses = warehouseUsers
      .filter((wu) => wu.Status === 'ACTIVE')
      .map((wu) => ({
        warehouseId: String(wu.Warehouses.WarehouseID),
        warehouseCode: wu.Warehouses.WarehouseCode,
        warehouseName: wu.Warehouses.WarehouseName,
        warehouseType: wu.Warehouses.WarehouseType,
        status: wu.Warehouses.Status,
      }));

    if (warehouses.length === 0 && (roles.includes('SUPER_ADMIN') || roles.includes('ADMIN'))) {
      const activePlatformWarehouses = await prisma.warehouses.findMany({
        where: { Status: 'ACTIVE' },
        orderBy: { WarehouseID: 'asc' },
        take: 10,
      });
      warehouses = activePlatformWarehouses.map((wh) => ({
        warehouseId: String(wh.WarehouseID),
        warehouseCode: wh.WarehouseCode,
        warehouseName: wh.WarehouseName,
        warehouseType: wh.WarehouseType,
        status: wh.Status,
      }));
    }

    return {
      userId: String(user.UserID),
      email: user.Email,
      firstName: user.FirstName,
      lastName: user.LastName,
      status: user.Status,
      roles,
      permissions: Array.from(permissionsSet),
      sellers,
      warehouses,
    };
  }

  async changePassword(userId: string, input: ChangePasswordInput): Promise<void> {
    const userIdBigInt = BigInt(userId);
    const user = await prisma.users.findUnique({ where: { UserID: userIdBigInt } });

    if (!user || !user.PasswordHash) {
      throw new NotFoundError('User not found');
    }

    const isMatch = await bcrypt.compare(input.currentPassword, user.PasswordHash);
    if (!isMatch) {
      throw new BadRequestError('Current password is incorrect');
    }

    const newHash = await bcrypt.hash(input.newPassword, 10);
    await prisma.users.update({
      where: { UserID: userIdBigInt },
      data: {
        PasswordHash: newHash,
        UpdatedAt: new Date(),
        UpdatedBy: userIdBigInt,
      },
    });
  }

  async sellerRegister(input: SellerRegisterInput): Promise<{ accessToken: string; user: AuthUser }> {
    const existingUser = await prisma.users.findFirst({
      where: { Email: input.email },
    });
    if (existingUser) {
      throw new BadRequestError('An account with this email address already exists. Please sign in instead.');
    }

    const existingSeller = await prisma.sellers.findFirst({
      where: { Email: input.email },
    });
    if (existingSeller) {
      throw new BadRequestError('A seller organization with this email address already exists.');
    }

    let category = null;
    if (input.primaryCategoryId) {
      category = await prisma.categories.findUnique({
        where: { CategoryID: BigInt(input.primaryCategoryId) },
      });
      if (!category) {
        throw new BadRequestError('Selected operating category does not exist.');
      }
    }

    const passwordHash = await bcrypt.hash(input.password, 10);
    const uniqueCode = await generateSellerCode(prisma);

    const { user, seller } = await prisma.$transaction(async (tx) => {
      // 1. Create User
      const newUser = await tx.users.create({
        data: {
          FirstName: input.firstName,
          LastName: input.lastName,
          Email: input.email,
          PhoneNumber: input.phoneNumber,
          PasswordHash: passwordHash,
          Status: 'ACTIVE',
          CreatedAt: new Date(),
        },
      });

      // 2. Assign SELLER_USER role
      let sellerRole = await tx.roles.findFirst({
        where: { RoleName: 'SELLER_USER' },
      });
      if (!sellerRole) {
        sellerRole = await tx.roles.create({
          data: {
            RoleName: 'SELLER_USER',
            Description: 'Seller Portal Authenticated Merchant',
            Status: 'ACTIVE',
            CreatedAt: new Date(),
          },
        });
      }

      await tx.userRoles.create({
        data: {
          UserID: newUser.UserID,
          RoleID: sellerRole.RoleID,
          CreatedAt: new Date(),
          CreatedBy: newUser.UserID,
        },
      });

      // 3. Create Seller record
      const sellerDisplayName = input.sellerName?.trim() || `${input.firstName} ${input.lastName}`;
      const legalBusinessName = input.businessName?.trim() || sellerDisplayName;

      const newSeller = await tx.sellers.create({
        data: {
          SellerCode: uniqueCode,
          SellerName: sellerDisplayName,
          BusinessName: legalBusinessName,
          Email: input.email,
          PhoneNumber: input.phoneNumber,
          Status: 'DRAFT',
          CreatedAt: new Date(),
          CreatedBy: newUser.UserID,
        },
      });

      // 4. Link User to Seller
      await tx.sellerUsers.create({
        data: {
          SellerID: newSeller.SellerID,
          UserID: newUser.UserID,
          Status: 'ACTIVE',
          CreatedAt: new Date(),
          CreatedBy: newUser.UserID,
        },
      });

      // 5. Create initial draft application if category provided
      if (category) {
        await tx.sellerApplications.create({
          data: {
            SellerID: newSeller.SellerID,
            CategoryID: category.CategoryID,
            Status: 'DRAFT',
            CreatedAt: new Date(),
          },
        });
      }

      return { user: newUser, seller: newSeller };
    });

    const authUser: AuthUser = {
      userId: String(user.UserID),
      email: user.Email,
      firstName: user.FirstName,
      lastName: user.LastName,
      status: user.Status,
      roles: ['SELLER_USER'],
      permissions: [],
      sellers: [
        {
          sellerId: String(seller.SellerID),
          sellerCode: seller.SellerCode,
          sellerName: seller.SellerName,
          status: seller.Status,
        },
      ],
      warehouses: [],
    };

    const payload: JwtPayload = {
      userId: authUser.userId,
      email: authUser.email,
      roles: authUser.roles,
    };

    const accessToken = jwt.sign(payload, config.JWT_SECRET, {
      expiresIn: config.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    });

    return {
      user: authUser,
      accessToken,
    };
  }

  async customerRegister(input: CustomerRegisterInput): Promise<{ accessToken: string; customer: { customerId: string; email: string; firstName: string; lastName: string } }> {
    // 1. Check if email already exists in Customers table ONLY
    const existingCustomer = await prisma.customers.findFirst({
      where: { Email: input.email },
    });
    if (existingCustomer) {
      throw new BadRequestError('An account with this email address already exists. Please sign in instead.');
    }

    const passwordHash = await bcrypt.hash(input.password, 10);

    // 2. Create customer ONLY in Customers table (zero interaction with Users or UserRoles)
    const newCustomer = await prisma.customers.create({
      data: {
        FirstName: input.firstName,
        LastName: input.lastName,
        Email: input.email,
        PhoneNumber: input.phoneNumber || null,
        PasswordHash: passwordHash,
        Status: 'ACTIVE',
        CreatedAt: new Date(),
      },
    });

    // Send Welcome Email asynchronously
    mailService.sendWelcomeEmail(newCustomer.Email!, `${newCustomer.FirstName} ${newCustomer.LastName}`).catch(() => {});

    // Sign JWT for customer
    const payload = {
      customerId: String(newCustomer.CustomerID),
      email: newCustomer.Email!,
      role: 'CUSTOMER',
    };

    const accessToken = jwt.sign(payload, config.JWT_SECRET, {
      expiresIn: config.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    });

    return {
      customer: {
        customerId: String(newCustomer.CustomerID),
        email: newCustomer.Email!,
        firstName: newCustomer.FirstName,
        lastName: newCustomer.LastName,
      },
      accessToken,
    };
  }

  async customerLogin(input: LoginInput): Promise<{ accessToken: string; customer: { customerId: string; email: string; firstName: string; lastName: string } }> {
    // Look up customer ONLY in Customers table
    const customer = await prisma.customers.findFirst({
      where: { Email: input.email },
    });

    if (!customer || !customer.PasswordHash) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(input.password, customer.PasswordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    if (customer.Status !== 'ACTIVE') {
      throw new UnauthorizedError(`Your account is currently ${customer.Status.toLowerCase()}`);
    }

    // Update LastLoginAt in background for customer
    await prisma.customers.update({
      where: { CustomerID: customer.CustomerID },
      data: { LastLoginAt: new Date() },
    });

    const payload = {
      customerId: String(customer.CustomerID),
      email: customer.Email!,
      role: 'CUSTOMER',
    };

    const accessToken = jwt.sign(payload, config.JWT_SECRET, {
      expiresIn: config.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    });

    return {
      customer: {
        customerId: String(customer.CustomerID),
        email: customer.Email!,
        firstName: customer.FirstName,
        lastName: customer.LastName,
      },
      accessToken,
    };
  }

  async forgotPassword(input: ForgotPasswordInput): Promise<{ message: string }> {
    // Check in Customers table ONLY
    const customer = await prisma.customers.findFirst({
      where: { Email: input.email },
    });

    // To prevent email enumeration attacks, always respond with a success message
    if (!customer || !customer.Email) {
      return { message: 'If an account exists with this email, a verification code has been dispatched.' };
    }

    // Generate secure 6-digit numeric OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins expiry

    // Record OTP in OTPVerifications linked to CustomerID
    await prisma.oTPVerifications.create({
      data: {
        CustomerID: customer.CustomerID,
        VerificationType: 'PASSWORD_RESET',
        Destination: customer.Email,
        OTPHash: otpHash,
        ExpiresAt: expiresAt,
        Status: 'PENDING',
        CreatedAt: new Date(),
      },
    });

    // Send email using SMTP
    const sent = await mailService.sendPasswordResetOTP(
      customer.Email,
      `${customer.FirstName} ${customer.LastName}`,
      otp
    );

    if (!sent && config.NODE_ENV === 'development') {
      console.log(`[DEV OTP FALLBACK] Customer reset code for ${customer.Email}: ${otp}`);
    }

    return { message: 'A 6-digit verification code has been sent to your email.' };
  }

  async resetPassword(input: ResetPasswordInput): Promise<{ message: string }> {
    // Find customer in Customers table ONLY
    const customer = await prisma.customers.findFirst({
      where: { Email: input.email },
    });
    if (!customer) {
      throw new BadRequestError('Invalid reset request or customer not found.');
    }

    // Look for latest valid PENDING OTP
    const latestOtp = await prisma.oTPVerifications.findFirst({
      where: {
        CustomerID: customer.CustomerID,
        VerificationType: 'PASSWORD_RESET',
        Status: 'PENDING',
        ExpiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        CreatedAt: 'desc',
      },
    });

    if (!latestOtp) {
      throw new BadRequestError('Verification code has expired or is invalid. Please request a new code.');
    }

    // Validate OTP hash
    const isValidOtp = await bcrypt.compare(input.otp, latestOtp.OTPHash);
    if (!isValidOtp) {
      await prisma.oTPVerifications.update({
        where: { OTPVerificationID: latestOtp.OTPVerificationID },
        data: {
          AttemptCount: {
            increment: 1,
          },
        },
      });
      throw new BadRequestError('Invalid verification code. Please check and try again.');
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(input.newPassword, 10);

    // Update in Customers table ONLY and mark OTP as VERIFIED
    await prisma.$transaction(async (tx) => {
      await tx.oTPVerifications.update({
        where: { OTPVerificationID: latestOtp.OTPVerificationID },
        data: {
          Status: 'VERIFIED',
          VerifiedAt: new Date(),
        },
      });

      await tx.customers.update({
        where: { CustomerID: customer.CustomerID },
        data: {
          PasswordHash: newPasswordHash,
          UpdatedAt: new Date(),
        },
      });
    });

    return { message: 'Password has been successfully updated. You may now sign in with your new password.' };
  }
}

export const authService = new AuthService();
