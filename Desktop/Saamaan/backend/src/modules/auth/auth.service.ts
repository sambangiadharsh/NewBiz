import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authRepository } from './auth.repository.js';
import { config } from '../../config/index.js';
import { UnauthorizedError, BadRequestError, NotFoundError, ConflictError } from '../../utils/errors.js';
import {
  LoginInput,
  ChangePasswordInput,
  SellerRegisterInput,
  CustomerRegisterInput,
  ForgotPasswordInput,
  ResetPasswordInput,
} from './auth.validation.js';
import { AuthUser, JwtPayload } from '../../types/auth.js';
import { mailService } from '../../utils/mailService.js';
import { refreshTokenRepository } from './refreshToken.repository.js';
import { generateRefreshTokenString, hashRefreshToken } from '../../utils/token.js';

export class AuthService {
  async login(
    input: LoginInput,
    meta?: { ip?: string; userAgent?: string }
  ): Promise<{ accessToken: string; refreshToken: string; user: AuthUser }> {
    const user = await authRepository.findUserByEmail(input.email);

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
    await authRepository.updateUserLastLogin(BigInt(user.UserID));

    // Retrieve structured AuthUser context
    const authUser = await authRepository.getUserAuthContext(BigInt(user.UserID));
    if (!authUser) {
      throw new UnauthorizedError('Failed to load user permissions');
    }

    // Sign JWT Access Token (15 minutes for staff)
    const payload: JwtPayload = {
      userId: authUser.userId,
      email: authUser.email,
      roles: authUser.roles,
    };

    const accessToken = jwt.sign(payload, config.JWT_SECRET, {
      expiresIn: config.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    });

    // Generate & Store Refresh Token (7 days for staff in dbo.UserRefreshTokens)
    const rawRefreshToken = generateRefreshTokenString();
    const tokenHash = hashRefreshToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + config.STAFF_REFRESH_TOKEN_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000);

    await refreshTokenRepository.createUserRefreshToken({
      userId: BigInt(user.UserID),
      tokenHash,
      expiresAt,
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });

    return { accessToken, refreshToken: rawRefreshToken, user: authUser };
  }

  async getProfile(userId: string): Promise<AuthUser> {
    const userIdBigInt = BigInt(userId);
    const authUser = await authRepository.getUserAuthContext(userIdBigInt);

    if (!authUser) {
      throw new NotFoundError('User profile not found');
    }

    return authUser;
  }

  async changePassword(userId: string, input: ChangePasswordInput): Promise<{ message: string }> {
    const userIdBigInt = BigInt(userId);
    const user = await authRepository.findUserById(userIdBigInt);

    if (!user || !user.PasswordHash) {
      throw new NotFoundError('User not found');
    }

    const isCurrentValid = await bcrypt.compare(input.currentPassword, user.PasswordHash);
    if (!isCurrentValid) {
      throw new BadRequestError('Current password is incorrect');
    }

    const newHash = await bcrypt.hash(input.newPassword, 10);
    await authRepository.updateUserPassword(userIdBigInt, newHash);

    // Immediate Revocation: Revoke all refresh tokens for this user on password change
    await refreshTokenRepository.revokeAllUserTokens(userIdBigInt);

    try {
      await mailService.sendPasswordChangedNotification(user.Email, user.FirstName || 'User');
    } catch (err) {
      console.error('[AuthService.changePassword] Failed to send notification email:', err);
    }

    return { message: 'Password changed successfully' };
  }

  async sellerRegister(
    input: SellerRegisterInput,
    meta?: { ip?: string; userAgent?: string }
  ): Promise<{ accessToken: string; refreshToken: string; user: AuthUser }> {
    const existingUser = await authRepository.findUserByEmail(input.email);
    if (existingUser) {
      throw new BadRequestError('An account with this email address already exists. Please sign in instead.');
    }

    const existingSeller = await authRepository.findSellerByEmail(input.email);
    if (existingSeller) {
      throw new BadRequestError('A seller organization with this email address already exists.');
    }

    let categoryId: bigint | null = null;
    if (input.primaryCategoryId) {
      const category = await authRepository.findCategoryById(BigInt(input.primaryCategoryId));
      if (!category) {
        throw new BadRequestError('Selected operating category does not exist.');
      }
      categoryId = BigInt(input.primaryCategoryId);
    }

    const passwordHash = await bcrypt.hash(input.password, 10);

    const { user, seller } = await authRepository.registerSellerWithTransaction({
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phoneNumber: input.phoneNumber,
      passwordHash,
      sellerName: input.sellerName,
      businessName: input.businessName,
      categoryId,
    });

    const authUser: AuthUser = {
      userId: String(user.UserID),
      email: user.Email,
      firstName: user.FirstName,
      lastName: user.LastName,
      status: user.Status,
      roles: ['SELLER_ADMIN'],
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

    // Generate & Store Refresh Token (7 days for staff)
    const rawRefreshToken = generateRefreshTokenString();
    const tokenHash = hashRefreshToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + config.STAFF_REFRESH_TOKEN_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000);

    await refreshTokenRepository.createUserRefreshToken({
      userId: BigInt(authUser.userId),
      tokenHash,
      expiresAt,
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });

    return {
      user: authUser,
      accessToken,
      refreshToken: rawRefreshToken,
    };
  }

  async customerRegister(
    input: CustomerRegisterInput,
    meta?: { ip?: string; userAgent?: string }
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    customer: { customerId: string; email: string; firstName: string; lastName: string };
  }> {
    const cleanEmail = input.email.trim().toLowerCase();
    const existing = await authRepository.findCustomerByEmail(cleanEmail);
    if (existing) {
      throw new BadRequestError('An account with this email address already exists. Please sign in instead.');
    }

    if (input.phoneNumber) {
      const existingPhone = await authRepository.findCustomerByPhone(input.phoneNumber.trim());
      if (existingPhone) {
        throw new BadRequestError('An account with this phone number already exists.');
      }
    }

    const passwordHash = await bcrypt.hash(input.password, 10);
    const newCustomer = await authRepository.createCustomer({
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      email: cleanEmail,
      phoneNumber: input.phoneNumber?.trim() || null,
      passwordHash: passwordHash,
      status: 'ACTIVE',
      createdAt: new Date(),
    });

    const payload = {
      userId: String(newCustomer.CustomerID),
      email: newCustomer.Email || cleanEmail,
      roles: ['CUSTOMER'],
    };

    // Customer Access Token: 1 hour
    const accessToken = jwt.sign(payload, config.JWT_SECRET, {
      expiresIn: config.CUSTOMER_JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    });

    // Customer Refresh Token: 30 days in dbo.CustomerRefreshTokens
    const rawRefreshToken = generateRefreshTokenString();
    const tokenHash = hashRefreshToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + config.CUSTOMER_REFRESH_TOKEN_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000);

    await refreshTokenRepository.createCustomerRefreshToken({
      customerId: BigInt(newCustomer.CustomerID),
      tokenHash,
      expiresAt,
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      customer: {
        customerId: String(newCustomer.CustomerID),
        email: newCustomer.Email || cleanEmail,
        firstName: newCustomer.FirstName,
        lastName: newCustomer.LastName,
      },
    };
  }

  async customerLogin(
    input: {
      identifier: string;
      password?: string;
      otp?: string;
    },
    meta?: { ip?: string; userAgent?: string }
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    customer: { customerId: string; email: string; firstName: string; lastName: string };
  }> {
    const cleanIdentifier = input.identifier.trim().toLowerCase();
    let customer = await authRepository.findCustomerByEmail(cleanIdentifier);
    if (!customer) {
      customer = await authRepository.findCustomerByPhone(input.identifier.trim());
    }

    if (!customer) {
      throw new UnauthorizedError('No account found associated with this email or phone number.');
    }

    if (!input.password) {
      throw new BadRequestError('Password is required for authentication.');
    }

    if (!customer.PasswordHash) {
      throw new UnauthorizedError('Account does not have a password configured. Please authenticate via OTP.');
    }

    const isMatch = await bcrypt.compare(input.password, customer.PasswordHash);
    if (!isMatch) {
      throw new UnauthorizedError('Invalid credentials. Please verify and try again.');
    }

    await authRepository.updateCustomerLastLogin(BigInt(customer.CustomerID));

    const payload = {
      userId: String(customer.CustomerID),
      email: customer.Email || cleanIdentifier,
      roles: ['CUSTOMER'],
    };

    // Customer Access Token: 1 hour
    const accessToken = jwt.sign(payload, config.JWT_SECRET, {
      expiresIn: config.CUSTOMER_JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    });

    // Customer Refresh Token: 30 days in dbo.CustomerRefreshTokens
    const rawRefreshToken = generateRefreshTokenString();
    const tokenHash = hashRefreshToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + config.CUSTOMER_REFRESH_TOKEN_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000);

    await refreshTokenRepository.createCustomerRefreshToken({
      customerId: BigInt(customer.CustomerID),
      tokenHash,
      expiresAt,
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      customer: {
        customerId: String(customer.CustomerID),
        email: customer.Email || cleanIdentifier,
        firstName: customer.FirstName,
        lastName: customer.LastName,
      },
    };
  }

  async forgotPassword(input: ForgotPasswordInput, isCustomer: boolean = false): Promise<{ message: string }> {
    const cleanEmail = input.email.trim().toLowerCase();
    
    if (isCustomer) {
      const customer = await authRepository.findCustomerByEmail(cleanEmail);
      if (!customer) {
        return { message: 'If an account exists with this email address, a password reset code has been sent.' };
      }

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const otpHash = await bcrypt.hash(otp, 10);
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

      await authRepository.createOTP({
        customerId: BigInt(customer.CustomerID),
        verificationType: 'PASSWORD_RESET',
        destination: cleanEmail,
        otpHash,
        expiresAt,
        status: 'PENDING',
        createdAt: new Date(),
      });

      try {
        await mailService.sendPasswordResetOTP(cleanEmail, customer.FirstName || 'Customer', otp);
      } catch (err) {
        console.error('[AuthService.forgotPassword] Failed to dispatch OTP email:', err);
      }
    } else {
      const user = await authRepository.findUserByEmail(cleanEmail);
      if (!user) {
        return { message: 'If an account exists with this email address, a password reset code has been sent.' };
      }
      
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const otpHash = await bcrypt.hash(otp, 10);
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins
      
      await authRepository.createOTP({
        customerId: null,
        verificationType: 'USER_PASSWORD_RESET',
        destination: cleanEmail,
        otpHash,
        expiresAt,
        status: 'PENDING',
        createdAt: new Date(),
      });
      
      try {
        await mailService.sendPasswordResetOTP(cleanEmail, user.FirstName || 'User', otp);
      } catch (err) {
        console.error('[AuthService.forgotPassword] Failed to dispatch OTP email:', err);
      }
    }

    return { message: 'If an account exists with this email address, a password reset code has been sent.' };
  }

  async resetPassword(input: ResetPasswordInput, isCustomer: boolean = false): Promise<{ message: string }> {
    const cleanEmail = input.email.trim().toLowerCase();
    
    if (isCustomer) {
      const customer = await authRepository.findCustomerByEmail(cleanEmail);
      if (!customer) {
        throw new BadRequestError('Invalid reset attempt. Customer profile not found.');
      }

      const latestOtp = await authRepository.getLatestOTP(cleanEmail, 'PASSWORD_RESET');
      if (!latestOtp) {
        throw new BadRequestError('No reset request found. Please request a new verification code.');
      }
      if (latestOtp.Status !== 'PENDING') {
        throw new BadRequestError('This verification code has already been used or expired.');
      }
      if (new Date() > new Date(latestOtp.ExpiresAt)) {
        throw new BadRequestError('Verification code has expired. Please request a new one.');
      }
      if (latestOtp.AttemptCount >= 5) {
        throw new BadRequestError('Maximum verification attempts exceeded. Please request a new code.');
      }

      const isValidOtp = await bcrypt.compare(input.otp, latestOtp.OTPHash);
      if (!isValidOtp) {
        await authRepository.incrementOTPAttempt(BigInt(latestOtp.OTPVerificationID));
        throw new BadRequestError('Invalid verification code. Please check and try again.');
      }

      const newPasswordHash = await bcrypt.hash(input.newPassword, 10);
      await authRepository.verifyOTPAndUpdateCustomerPassword(
        BigInt(latestOtp.OTPVerificationID),
        BigInt(customer.CustomerID),
        newPasswordHash
      );

      // Immediate Revocation: Invalidate all existing customer sessions on password reset
      await refreshTokenRepository.revokeAllCustomerTokens(BigInt(customer.CustomerID));
    } else {
      const user = await authRepository.findUserByEmail(cleanEmail);
      if (!user) {
        throw new BadRequestError('Invalid reset attempt. User profile not found.');
      }

      const latestOtp = await authRepository.getLatestOTP(cleanEmail, 'USER_PASSWORD_RESET');
      if (!latestOtp) {
        throw new BadRequestError('No reset request found. Please request a new verification code.');
      }
      if (latestOtp.Status !== 'PENDING') {
        throw new BadRequestError('This verification code has already been used or expired.');
      }
      if (new Date() > new Date(latestOtp.ExpiresAt)) {
        throw new BadRequestError('Verification code has expired. Please request a new one.');
      }
      if (latestOtp.AttemptCount >= 5) {
        throw new BadRequestError('Maximum verification attempts exceeded. Please request a new code.');
      }

      const isValidOtp = await bcrypt.compare(input.otp, latestOtp.OTPHash);
      if (!isValidOtp) {
        await authRepository.incrementOTPAttempt(BigInt(latestOtp.OTPVerificationID));
        throw new BadRequestError('Invalid verification code. Please check and try again.');
      }

      const newPasswordHash = await bcrypt.hash(input.newPassword, 10);
      await authRepository.verifyOTPAndUpdateUserPassword(
        BigInt(latestOtp.OTPVerificationID),
        BigInt(user.UserID),
        newPasswordHash
      );

      // Immediate Revocation: Invalidate all existing staff sessions on password reset
      await refreshTokenRepository.revokeAllUserTokens(BigInt(user.UserID));
    }

    return { message: 'Password has been successfully updated. You may now sign in with your new password.' };
  }

  async adminForceReset(targetUserId: string): Promise<void> {
    const userIdBigInt = BigInt(targetUserId);
    const user = await authRepository.findUserById(userIdBigInt);
    
    if (!user) {
      throw new NotFoundError('Target user not found');
    }

    // Force invalidation of existing sessions by updating password hash and changed timestamp
    const randomTempPassword = Math.random().toString(36).slice(-10);
    const tempHash = await bcrypt.hash(randomTempPassword, 10);
    
    await authRepository.updateUserPassword(userIdBigInt, tempHash);

    // Immediate Revocation: Invalidate all refresh tokens for this user
    await refreshTokenRepository.revokeAllUserTokens(userIdBigInt);
    
    // Auto-trigger a forgot password email for them
    await this.forgotPassword({ email: user.Email }, false);
  }

  // =========================================================================
  // REFRESH TOKEN LIFECYCLE & SLIDING EXPIRATION
  // =========================================================================

  async refreshStaffSession(
    rawRefreshToken: string,
    meta?: { ip?: string; userAgent?: string }
  ): Promise<{ accessToken: string; refreshToken: string; user: AuthUser }> {
    const tokenHash = hashRefreshToken(rawRefreshToken);
    const existing = await refreshTokenRepository.findUserTokenByHash(tokenHash);

    if (!existing) {
      throw new UnauthorizedError('Invalid or expired refresh token. Please sign in again.');
    }

    // Token reuse detection: If an already-revoked token is used, suspect compromise and revoke all tokens
    if (existing.RevokedAt) {
      await refreshTokenRepository.revokeAllUserTokens(BigInt(existing.UserID));
      throw new UnauthorizedError('Session has been revoked. Please sign in again.');
    }

    if (new Date(existing.ExpiresAt) < new Date()) {
      throw new UnauthorizedError('Session has expired. Please sign in again.');
    }

    const authUser = await authRepository.getUserAuthContext(BigInt(existing.UserID));
    if (!authUser || authUser.status !== 'ACTIVE') {
      throw new UnauthorizedError('Account is inactive or disabled.');
    }

    // Sign fresh 15-minute access token
    const payload: JwtPayload = {
      userId: authUser.userId,
      email: authUser.email,
      roles: authUser.roles,
    };

    const accessToken = jwt.sign(payload, config.JWT_SECRET, {
      expiresIn: config.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    });

    // Token Rotation (7 days)
    const newRawRefreshToken = generateRefreshTokenString();
    const newTokenHash = hashRefreshToken(newRawRefreshToken);
    const newExpiresAt = new Date(Date.now() + config.STAFF_REFRESH_TOKEN_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000);

    const newTokenId = await refreshTokenRepository.createUserRefreshToken({
      userId: BigInt(authUser.userId),
      tokenHash: newTokenHash,
      expiresAt: newExpiresAt,
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });

    await refreshTokenRepository.revokeUserToken(BigInt(existing.TokenID), newTokenId);

    return {
      accessToken,
      refreshToken: newRawRefreshToken,
      user: authUser,
    };
  }

  async refreshCustomerSession(
    rawRefreshToken: string,
    meta?: { ip?: string; userAgent?: string }
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    customer: { customerId: string; email: string; firstName: string; lastName: string };
  }> {
    const tokenHash = hashRefreshToken(rawRefreshToken);
    const existing = await refreshTokenRepository.findCustomerTokenByHash(tokenHash);

    if (!existing) {
      throw new UnauthorizedError('Invalid or expired refresh token. Please sign in again.');
    }

    // Token reuse detection: If an already-revoked token is used, suspect compromise and revoke all tokens
    if (existing.RevokedAt) {
      await refreshTokenRepository.revokeAllCustomerTokens(BigInt(existing.CustomerID));
      throw new UnauthorizedError('Session has been revoked. Please sign in again.');
    }

    if (new Date(existing.ExpiresAt) < new Date()) {
      throw new UnauthorizedError('Session has expired due to inactivity. Please sign in again.');
    }

    const customer = await authRepository.findCustomerById(BigInt(existing.CustomerID));
    if (!customer || customer.Status !== 'ACTIVE') {
      throw new UnauthorizedError('Customer account is inactive or disabled.');
    }

    // Sign fresh 1-hour access token
    const payload = {
      userId: String(customer.CustomerID),
      email: customer.Email || '',
      roles: ['CUSTOMER'],
    };

    const accessToken = jwt.sign(payload, config.JWT_SECRET, {
      expiresIn: config.CUSTOMER_JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    });

    // Sliding Expiration + Token Rotation (Extend by 30 days from now)
    const newRawRefreshToken = generateRefreshTokenString();
    const newTokenHash = hashRefreshToken(newRawRefreshToken);
    const newExpiresAt = new Date(Date.now() + config.CUSTOMER_REFRESH_TOKEN_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000);

    const newTokenId = await refreshTokenRepository.createCustomerRefreshToken({
      customerId: BigInt(customer.CustomerID),
      tokenHash: newTokenHash,
      expiresAt: newExpiresAt,
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });

    await refreshTokenRepository.revokeCustomerToken(BigInt(existing.TokenID), newTokenId);

    return {
      accessToken,
      refreshToken: newRawRefreshToken,
      customer: {
        customerId: String(customer.CustomerID),
        email: customer.Email || '',
        firstName: customer.FirstName,
        lastName: customer.LastName,
      },
    };
  }

  async logout(rawRefreshToken?: string, isCustomer: boolean = false): Promise<void> {
    if (rawRefreshToken) {
      const tokenHash = hashRefreshToken(rawRefreshToken);
      if (isCustomer) {
        const token = await refreshTokenRepository.findCustomerTokenByHash(tokenHash);
        if (token && !token.RevokedAt) {
          await refreshTokenRepository.revokeCustomerToken(BigInt(token.TokenID));
        }
      } else {
        const token = await refreshTokenRepository.findUserTokenByHash(tokenHash);
        if (token && !token.RevokedAt) {
          await refreshTokenRepository.revokeUserToken(BigInt(token.TokenID));
        }
      }
    }
  }

  async listUsersForAdmin(): Promise<any[]> {
    return authRepository.listUsersForAdmin();
  }

  async listRolesForAdmin(): Promise<any[]> {
    return authRepository.listRolesForAdmin();
  }

  async listAllPermissions(): Promise<any[]> {
    return authRepository.listAllPermissions();
  }

  async createRole(
    input: { roleName: string; description: string; permissionCodes: string[] },
    adminUserId?: bigint
  ): Promise<any> {
    if (!input.roleName || !input.roleName.trim()) {
      throw new BadRequestError('Role Name is required.');
    }
    return authRepository.createRole({
      roleName: input.roleName,
      description: input.description || '',
      permissionCodes: input.permissionCodes || [],
      createdBy: adminUserId,
    });
  }

  async getRoleById(roleId: string): Promise<any> {
    const role = await authRepository.getRoleById(BigInt(roleId));
    if (!role) {
      throw new NotFoundError('Role not found.');
    }
    const permissions = await authRepository.getRolePermissions(BigInt(roleId));
    return {
      ...role,
      permissions,
    };
  }

  async getRolePermissions(roleId: string): Promise<any[]> {
    return authRepository.getRolePermissions(BigInt(roleId));
  }

  async updateRole(
    roleId: string,
    input: { description?: string; permissionCodes?: string[]; status?: 'ACTIVE' | 'INACTIVE' }
  ): Promise<void> {
    return authRepository.updateRole({
      roleId: BigInt(roleId),
      description: input.description,
      permissionCodes: input.permissionCodes,
      status: input.status,
    });
  }

  async updateRoleDescription(roleId: string, description: string): Promise<void> {
    if (!description || !description.trim()) {
      throw new BadRequestError('Description cannot be empty.');
    }
    await authRepository.updateRoleDescription(BigInt(roleId), description);
  }

  async updateUserStatus(targetUserId: string, status: 'ACTIVE' | 'INACTIVE', callerUserId: string): Promise<void> {
    if (String(targetUserId) === String(callerUserId)) {
      throw new BadRequestError('You cannot deactivate your own account.');
    }
    const targetIdBigInt = BigInt(targetUserId);
    const user = await authRepository.findUserById(targetIdBigInt);
    if (!user) {
      throw new NotFoundError('Target user not found.');
    }
    await authRepository.updateUserStatus(targetIdBigInt, status);
  }

  async updateUserRoles(targetUserId: string, roleNames: string[], callerUserId: string): Promise<void> {
    if (!Array.isArray(roleNames) || roleNames.length === 0) {
      throw new BadRequestError('At least one role must be specified.');
    }

    const validRoles = ['SUPER_ADMIN', 'ADMIN', 'SELLER_ADMIN', 'WAREHOUSE_MANAGER'];
    for (const r of roleNames) {
      if (!validRoles.includes(r)) {
        throw new BadRequestError(`Invalid role specified: ${r}`);
      }
    }

    const targetIdBigInt = BigInt(targetUserId);
    const user = await authRepository.findUserById(targetIdBigInt);
    if (!user) {
      throw new NotFoundError('Target user not found.');
    }

    // Protect against self-demotion from SUPER_ADMIN
    if (String(targetUserId) === String(callerUserId)) {
      const callerContext = await authRepository.getUserAuthContext(BigInt(callerUserId));
      if (callerContext?.roles.includes('SUPER_ADMIN') && !roleNames.includes('SUPER_ADMIN')) {
        throw new BadRequestError('Super Admins cannot revoke their own Super Admin privileges.');
      }
    }

    await authRepository.updateUserRoles(targetIdBigInt, roleNames, BigInt(callerUserId));
  }

  async createInternalUser(
    input: {
      firstName: string;
      lastName: string;
      email: string;
      phoneNumber?: string;
      password?: string;
      roleName: string;
    },
    callerUserId: string
  ): Promise<{ message: string; user: any; temporaryPassword?: string }> {
    const cleanEmail = input.email.trim().toLowerCase();
    const existing = await authRepository.findUserByEmail(cleanEmail);
    if (existing) {
      throw new ConflictError('A user account with this email address already exists.');
    }

    const validRoles = ['SUPER_ADMIN', 'ADMIN', 'SELLER_ADMIN', 'WAREHOUSE_MANAGER'];
    if (!validRoles.includes(input.roleName)) {
      throw new BadRequestError(`Invalid role: ${input.roleName}. Allowed: ${validRoles.join(', ')}`);
    }

    const tempPassword = input.password || Math.random().toString(36).slice(-8) + 'Aa1!';
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const newUser = await authRepository.createInternalUser({
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      email: cleanEmail,
      phoneNumber: input.phoneNumber?.trim(),
      passwordHash,
      roleName: input.roleName,
      createdByAdminId: BigInt(callerUserId),
    });

    return {
      message: 'Internal user provisioned successfully.',
      user: {
        userId: String(newUser.UserID),
        email: newUser.Email,
        firstName: newUser.FirstName,
        lastName: newUser.LastName,
        role: input.roleName,
      },
      temporaryPassword: input.password ? undefined : tempPassword,
    };
  }
}

export const authService = new AuthService();
