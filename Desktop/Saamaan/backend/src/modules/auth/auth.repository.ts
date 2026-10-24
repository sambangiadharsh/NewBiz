import { getPool, sql, withTransaction } from '../../database/db.js';
import { AuthUser } from '../../types/auth.js';
import { generateSellerCode } from '../../utils/codeGenerator.js';

export interface UserRecord {
  UserID: bigint | number;
  FirstName: string;
  LastName: string;
  Email: string;
  PhoneNumber: string | null;
  PasswordHash: string | null;
  Status: string;
  LastLoginAt: Date | null;
  CreatedAt: Date;
  UpdatedAt: Date | null;
  PasswordLastChangedAt?: Date | null;
}

export interface CustomerRecord {
  CustomerID: bigint | number;
  FirstName: string;
  LastName: string;
  Email: string | null;
  PhoneNumber: string | null;
  PasswordHash: string | null;
  Status: string;
  LastLoginAt: Date | null;
  CreatedAt: Date;
  UpdatedAt: Date | null;
}

export interface OTPRecord {
  OTPVerificationID: bigint | number;
  CustomerID: bigint | number | null;
  VerificationType: string;
  Destination: string;
  OTPHash: string;
  ExpiresAt: Date;
  VerifiedAt: Date | null;
  AttemptCount: number;
  Status: string;
  CreatedAt: Date;
}

export class AuthRepository {
  async findUserByEmail(email: string): Promise<UserRecord | null> {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('email', sql.NVarChar(255), email.trim().toLowerCase())
      .query<UserRecord>('SELECT * FROM Users WHERE LOWER(Email) = @email');

    return result.recordset[0] ?? null;
  }

  async findUserById(userId: bigint): Promise<UserRecord | null> {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('userId', sql.BigInt, userId)
      .query<UserRecord>('SELECT * FROM Users WHERE UserID = @userId');

    return result.recordset[0] ?? null;
  }

  async getUserAuthContext(userId: bigint): Promise<AuthUser | null> {
    const pool = await getPool();

    // 1. User base info
    const userRes = await pool
      .request()
      .input('userId', sql.BigInt, userId)
      .query<UserRecord>('SELECT * FROM Users WHERE UserID = @userId');

    const user = userRes.recordset[0];
    if (!user) return null;

    // 2. Active Roles
    const rolesRes = await pool
      .request()
      .input('userId', sql.BigInt, userId)
      .query<{ RoleName: string }>(`
        SELECT r.RoleName
        FROM UserRoles ur
        JOIN Roles r ON ur.RoleID = r.RoleID
        WHERE ur.UserID = @userId AND r.Status = 'ACTIVE'
      `);
    const roles = rolesRes.recordset.map((r) => r.RoleName);

    // 3. Permissions
    const permRes = await pool
      .request()
      .input('userId', sql.BigInt, userId)
      .query<{ PermissionCode: string }>(`
        SELECT DISTINCT p.PermissionCode
        FROM UserRoles ur
        JOIN Roles r ON ur.RoleID = r.RoleID
        JOIN RolePermissions rp ON r.RoleID = rp.RoleID
        JOIN Permissions p ON rp.PermissionID = p.PermissionID
        WHERE ur.UserID = @userId AND r.Status = 'ACTIVE'
      `);
    const permissions = permRes.recordset.map((p) => p.PermissionCode);

    // 4. Sellers
    const sellerRes = await pool
      .request()
      .input('userId', sql.BigInt, userId)
      .query<{
        SellerID: bigint | number;
        SellerCode: string;
        SellerName: string;
        Status: string;
      }>(`
        SELECT s.SellerID, s.SellerCode, s.SellerName, s.Status
        FROM SellerUsers su
        JOIN Sellers s ON su.SellerID = s.SellerID
        WHERE su.UserID = @userId AND su.Status = 'ACTIVE' AND s.Status = 'ACTIVE'
      `);

    const sellers = sellerRes.recordset.map((s) => ({
      sellerId: String(s.SellerID),
      sellerCode: s.SellerCode,
      sellerName: s.SellerName,
      status: s.Status,
    }));

    // 5. Warehouses
    const whRes = await pool
      .request()
      .input('userId', sql.BigInt, userId)
      .query<{
        WarehouseID: bigint | number;
        WarehouseCode: string;
        WarehouseName: string;
        WarehouseType: string;
        Status: string;
      }>(`
        SELECT w.WarehouseID, w.WarehouseCode, w.WarehouseName, w.WarehouseType, w.Status
        FROM WarehouseUsers wu
        JOIN Warehouses w ON wu.WarehouseID = w.WarehouseID
        WHERE wu.UserID = @userId AND wu.Status = 'ACTIVE'
      `);

    let warehouses = whRes.recordset.map((w) => ({
      warehouseId: String(w.WarehouseID),
      warehouseCode: w.WarehouseCode,
      warehouseName: w.WarehouseName,
      warehouseType: w.WarehouseType,
      status: w.Status,
    }));

    // Platform warehouse fallback for admin
    if (warehouses.length === 0 && (roles.includes('SUPER_ADMIN') || roles.includes('ADMIN'))) {
      const activePlatformWarehouses = await pool.request().query<{
        WarehouseID: bigint | number;
        WarehouseCode: string;
        WarehouseName: string;
        WarehouseType: string;
        Status: string;
      }>(`
        SELECT TOP 10 WarehouseID, WarehouseCode, WarehouseName, WarehouseType, Status
        FROM Warehouses
        WHERE Status = 'ACTIVE'
        ORDER BY WarehouseID ASC
      `);

      warehouses = activePlatformWarehouses.recordset.map((wh) => ({
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
      permissions,
      sellers,
      warehouses,
      passwordLastChangedAt: user.PasswordLastChangedAt,
    };
  }

  async updateUserLastLogin(userId: bigint): Promise<void> {
    const pool = await getPool();
    await pool
      .request()
      .input('userId', sql.BigInt, userId)
      .input('now', sql.DateTime2, new Date())
      .query('UPDATE Users SET LastLoginAt = @now WHERE UserID = @userId');
  }

  async updateUserPassword(userId: bigint, passwordHash: string): Promise<void> {
    const pool = await getPool();
    await pool
      .request()
      .input('userId', sql.BigInt, userId)
      .input('hash', sql.NVarChar(500), passwordHash)
      .input('now', sql.DateTime2, new Date())
      .query('UPDATE Users SET PasswordHash = @hash, PasswordLastChangedAt = @now, UpdatedAt = @now WHERE UserID = @userId');
  }

  async verifyOTPAndUpdateUserPassword(
    otpId: bigint,
    userId: bigint,
    newPasswordHash: string
  ): Promise<void> {
    await withTransaction(async (tx) => {
      await tx
        .request()
        .input('otpId', sql.BigInt, otpId)
        .input('now', sql.DateTime2, new Date())
        .query(`
          UPDATE OTPVerifications 
          SET Status = 'VERIFIED', VerifiedAt = @now 
          WHERE OTPVerificationID = @otpId
        `);

      await tx
        .request()
        .input('userId', sql.BigInt, userId)
        .input('hash', sql.NVarChar(500), newPasswordHash)
        .input('now', sql.DateTime2, new Date())
        .query(`
          UPDATE Users 
          SET PasswordHash = @hash, PasswordLastChangedAt = @now, UpdatedAt = @now 
          WHERE UserID = @userId
        `);
    });
  }

  async listUsersForAdmin(): Promise<any[]> {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT 
        u.UserID,
        u.FirstName,
        u.LastName,
        u.Email,
        u.PhoneNumber,
        u.Status,
        u.LastLoginAt,
        u.PasswordLastChangedAt,
        u.CreatedAt,
        (
          SELECT STRING_AGG(r.RoleName, ', ')
          FROM UserRoles ur
          JOIN Roles r ON ur.RoleID = r.RoleID
          WHERE ur.UserID = u.UserID AND r.Status = 'ACTIVE'
        ) AS Roles
      FROM Users u
      ORDER BY u.CreatedAt DESC
    `);
    return result.recordset;
  }

  async findSellerByEmail(email: string): Promise<any | null> {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('email', sql.NVarChar(255), email.trim().toLowerCase())
      .query('SELECT TOP 1 * FROM Sellers WHERE LOWER(Email) = @email');

    return result.recordset[0] ?? null;
  }

  async findCategoryById(categoryId: bigint): Promise<any | null> {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('id', sql.BigInt, categoryId)
      .query('SELECT * FROM Categories WHERE CategoryID = @id');

    return result.recordset[0] ?? null;
  }

  async registerSellerWithTransaction(params: {
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber?: string;
    passwordHash: string;
    sellerName?: string;
    businessName?: string;
    categoryId?: bigint | null;
  }): Promise<{ user: UserRecord; seller: any }> {
    return withTransaction(async (tx) => {
      // 1. Create User
      const userRes = await tx
        .request()
        .input('firstName', sql.NVarChar(100), params.firstName)
        .input('lastName', sql.NVarChar(100), params.lastName)
        .input('email', sql.NVarChar(255), params.email.trim().toLowerCase())
        .input('phoneNumber', sql.NVarChar(20), params.phoneNumber ?? null)
        .input('passwordHash', sql.NVarChar(500), params.passwordHash)
        .input('status', sql.VarChar(20), 'ACTIVE')
        .input('createdAt', sql.DateTime2, new Date())
        .query<UserRecord>(`
          INSERT INTO Users (FirstName, LastName, Email, PhoneNumber, PasswordHash, Status, CreatedAt)
          OUTPUT Inserted.*
          VALUES (@firstName, @lastName, @email, @phoneNumber, @passwordHash, @status, @createdAt)
        `);
      const newUser = userRes.recordset[0];

      // 2. Ensure SELLER_ADMIN role exists and link
      const ensureAndAssignRole = async (rName: string, rDesc: string) => {
        let rRes = await tx
          .request()
          .input('roleName', sql.VarChar(50), rName)
          .query<{ RoleID: bigint | number }>('SELECT RoleID FROM Roles WHERE RoleName = @roleName');
        let rId: bigint | number;
        if (rRes.recordset.length === 0) {
          const createRoleRes = await tx
            .request()
            .input('roleName', sql.VarChar(50), rName)
            .input('desc', sql.NVarChar(255), rDesc)
            .input('status', sql.VarChar(20), 'ACTIVE')
            .input('createdAt', sql.DateTime2, new Date())
            .query<{ RoleID: bigint | number }>(`
              INSERT INTO Roles (RoleName, Description, Status, CreatedAt)
              OUTPUT Inserted.RoleID
              VALUES (@roleName, @desc, @status, @createdAt)
            `);
          rId = createRoleRes.recordset[0].RoleID;
        } else {
          rId = rRes.recordset[0].RoleID;
        }

        await tx
          .request()
          .input('userId', sql.BigInt, newUser.UserID)
          .input('roleId', sql.BigInt, rId)
          .input('createdAt', sql.DateTime2, new Date())
          .input('createdBy', sql.BigInt, newUser.UserID)
          .query(`
            IF NOT EXISTS (SELECT 1 FROM UserRoles WHERE UserID = @userId AND RoleID = @roleId)
            BEGIN
              INSERT INTO UserRoles (UserID, RoleID, CreatedAt, CreatedBy)
              VALUES (@userId, @roleId, @createdAt, @createdBy)
            END
          `);
      };

      await ensureAndAssignRole('SELLER_ADMIN', 'Seller Administrator with full store access');

      // 3. Create Seller
      const uniqueCode = await generateSellerCode(tx);
      const sellerDisplayName = params.sellerName?.trim() || `${params.firstName} ${params.lastName}`;
      const legalBusinessName = params.businessName?.trim() || sellerDisplayName;

      const sellerRes = await tx
        .request()
        .input('sellerCode', sql.VarChar(50), uniqueCode)
        .input('sellerName', sql.NVarChar(150), sellerDisplayName)
        .input('businessName', sql.NVarChar(150), legalBusinessName)
        .input('email', sql.NVarChar(255), params.email.trim().toLowerCase())
        .input('phoneNumber', sql.NVarChar(20), params.phoneNumber ?? null)
        .input('status', sql.VarChar(20), 'DRAFT')
        .input('createdAt', sql.DateTime2, new Date())
        .input('createdBy', sql.BigInt, newUser.UserID)
        .query(`
          INSERT INTO Sellers (SellerCode, SellerName, BusinessName, Email, PhoneNumber, Status, CreatedAt, CreatedBy)
          OUTPUT Inserted.*
          VALUES (@sellerCode, @sellerName, @businessName, @email, @phoneNumber, @status, @createdAt, @createdBy)
        `);
      const newSeller = sellerRes.recordset[0];

      // 4. Link User to Seller
      await tx
        .request()
        .input('sellerId', sql.BigInt, newSeller.SellerID)
        .input('userId', sql.BigInt, newUser.UserID)
        .input('status', sql.VarChar(20), 'ACTIVE')
        .input('createdAt', sql.DateTime2, new Date())
        .input('createdBy', sql.BigInt, newUser.UserID)
        .query(`
          INSERT INTO SellerUsers (SellerID, UserID, Status, CreatedAt, CreatedBy)
          VALUES (@sellerId, @userId, @status, @createdAt, @createdBy)
        `);

      // 5. Create initial application if categoryId is provided
      if (params.categoryId) {
        await tx
          .request()
          .input('sellerId', sql.BigInt, newSeller.SellerID)
          .input('categoryId', sql.BigInt, params.categoryId)
          .input('status', sql.VarChar(20), 'DRAFT')
          .input('createdAt', sql.DateTime2, new Date())
          .query(`
            INSERT INTO SellerApplications (SellerID, CategoryID, Status, CreatedAt)
            VALUES (@sellerId, @categoryId, @status, @createdAt)
          `);
      }

      return { user: newUser, seller: newSeller };
    });
  }

  // ==========================================
  // CUSTOMERS
  // ==========================================

  async findCustomerByEmail(email: string): Promise<CustomerRecord | null> {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('email', sql.NVarChar(255), email.trim().toLowerCase())
      .query<CustomerRecord>('SELECT * FROM Customers WHERE LOWER(Email) = @email');

    return result.recordset[0] ?? null;
  }

  async findCustomerByPhone(phone: string): Promise<CustomerRecord | null> {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('phone', sql.NVarChar(20), phone.trim())
      .query<CustomerRecord>('SELECT * FROM Customers WHERE PhoneNumber = @phone');

    return result.recordset[0] ?? null;
  }

  async findCustomerById(id: bigint): Promise<CustomerRecord | null> {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('id', sql.BigInt, id)
      .query<CustomerRecord>('SELECT * FROM Customers WHERE CustomerID = @id');

    return result.recordset[0] ?? null;
  }

  async createCustomer(data: {
    firstName: string;
    lastName: string;
    email?: string | null;
    phoneNumber?: string | null;
    passwordHash?: string | null;
    status: string;
    createdAt: Date;
  }): Promise<CustomerRecord> {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('firstName', sql.NVarChar(100), data.firstName)
      .input('lastName', sql.NVarChar(100), data.lastName)
      .input('email', sql.NVarChar(255), data.email?.trim().toLowerCase() ?? null)
      .input('phoneNumber', sql.NVarChar(20), data.phoneNumber?.trim() ?? null)
      .input('passwordHash', sql.NVarChar(500), data.passwordHash ?? null)
      .input('status', sql.VarChar(20), data.status)
      .input('createdAt', sql.DateTime2, data.createdAt)
      .query<CustomerRecord>(`
        INSERT INTO Customers (FirstName, LastName, Email, PhoneNumber, PasswordHash, Status, CreatedAt)
        OUTPUT Inserted.*
        VALUES (@firstName, @lastName, @email, @phoneNumber, @passwordHash, @status, @createdAt)
      `);

    return result.recordset[0];
  }

  async updateCustomerLastLogin(customerId: bigint): Promise<void> {
    const pool = await getPool();
    await pool
      .request()
      .input('id', sql.BigInt, customerId)
      .input('now', sql.DateTime2, new Date())
      .query('UPDATE Customers SET LastLoginAt = @now WHERE CustomerID = @id');
  }

  // ==========================================
  // OTP VERIFICATIONS
  // ==========================================

  async createOTP(data: {
    customerId?: bigint | null;
    verificationType: string;
    destination: string;
    otpHash: string;
    expiresAt: Date;
    status: string;
    createdAt: Date;
  }): Promise<OTPRecord> {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('customerId', sql.BigInt, data.customerId ?? null)
      .input('verificationType', sql.VarChar(20), data.verificationType)
      .input('destination', sql.NVarChar(255), data.destination)
      .input('otpHash', sql.NVarChar(500), data.otpHash)
      .input('expiresAt', sql.DateTime2, data.expiresAt)
      .input('status', sql.VarChar(20), data.status)
      .input('createdAt', sql.DateTime2, data.createdAt)
      .query<OTPRecord>(`
        INSERT INTO OTPVerifications (CustomerID, VerificationType, Destination, OTPHash, ExpiresAt, Status, CreatedAt)
        OUTPUT Inserted.*
        VALUES (@customerId, @verificationType, @destination, @otpHash, @expiresAt, @status, @createdAt)
      `);

    return result.recordset[0];
  }

  async getLatestOTP(destination: string, verificationType: string): Promise<OTPRecord | null> {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('destination', sql.NVarChar(255), destination)
      .input('verificationType', sql.VarChar(20), verificationType)
      .query<OTPRecord>(`
        SELECT TOP 1 * 
        FROM OTPVerifications 
        WHERE Destination = @destination AND VerificationType = @verificationType
        ORDER BY CreatedAt DESC
      `);

    return result.recordset[0] ?? null;
  }

  async incrementOTPAttempt(otpId: bigint): Promise<void> {
    const pool = await getPool();
    await pool
      .request()
      .input('id', sql.BigInt, otpId)
      .query('UPDATE OTPVerifications SET AttemptCount = AttemptCount + 1 WHERE OTPVerificationID = @id');
  }

  async verifyOTPAndUpdateCustomerPassword(
    otpId: bigint,
    customerId: bigint,
    newPasswordHash: string
  ): Promise<void> {
    await withTransaction(async (tx) => {
      await tx
        .request()
        .input('otpId', sql.BigInt, otpId)
        .input('now', sql.DateTime2, new Date())
        .query(`
          UPDATE OTPVerifications 
          SET Status = 'VERIFIED', VerifiedAt = @now 
          WHERE OTPVerificationID = @otpId
        `);

      await tx
        .request()
        .input('customerId', sql.BigInt, customerId)
        .input('hash', sql.NVarChar(500), newPasswordHash)
        .input('now', sql.DateTime2, new Date())
        .query(`
          UPDATE Customers 
          SET PasswordHash = @hash, UpdatedAt = @now 
          WHERE CustomerID = @customerId
        `);
    });
  }

  async listRolesForAdmin(): Promise<any[]> {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT 
        r.RoleID,
        r.RoleName,
        r.Description,
        r.Status,
        (SELECT COUNT(DISTINCT ur.UserID) FROM dbo.UserRoles ur WHERE ur.RoleID = r.RoleID) as UserCount
      FROM dbo.Roles r
      WHERE r.Status = 'ACTIVE'
      ORDER BY r.RoleID ASC
    `);
    return result.recordset;
  }

  async updateRoleDescription(roleId: bigint, description: string): Promise<void> {
    const pool = await getPool();
    await pool
      .request()
      .input('roleId', sql.BigInt, roleId)
      .input('desc', sql.NVarChar(255), description.trim())
      .query('UPDATE dbo.Roles SET Description = @desc WHERE RoleID = @roleId');
  }

  async updateUserStatus(userId: bigint, status: 'ACTIVE' | 'INACTIVE'): Promise<void> {
    const pool = await getPool();
    await pool
      .request()
      .input('userId', sql.BigInt, userId)
      .input('status', sql.VarChar(20), status)
      .query('UPDATE dbo.Users SET Status = @status WHERE UserID = @userId');
  }

  async updateUserRoles(userId: bigint, roleNames: string[], adminUserId?: bigint): Promise<void> {
    const pool = await getPool();
    for (const roleName of roleNames) {
      let roleRes = await pool
        .request()
        .input('roleName', sql.VarChar(50), roleName)
        .query<{ RoleID: bigint | number }>('SELECT RoleID FROM dbo.Roles WHERE RoleName = @roleName');

      let roleId = roleRes.recordset[0]?.RoleID;
      if (roleId) {
        await pool
          .request()
          .input('userId', sql.BigInt, userId)
          .input('roleId', sql.BigInt, roleId)
          .input('createdBy', sql.BigInt, adminUserId ?? userId)
          .query(`
            IF NOT EXISTS (SELECT 1 FROM dbo.UserRoles WHERE UserID = @userId AND RoleID = @roleId)
            BEGIN
              INSERT INTO dbo.UserRoles (UserID, RoleID, CreatedAt, CreatedBy)
              VALUES (@userId, @roleId, GETDATE(), @createdBy)
            END
          `);
      }
    }
  }

  async createInternalUser(params: {
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber?: string;
    passwordHash: string;
    roleName: string;
    createdByAdminId?: bigint;
  }): Promise<UserRecord> {
    return await withTransaction(async (tx) => {
      const userRes = await tx
        .request()
        .input('firstName', sql.NVarChar(50), params.firstName)
        .input('lastName', sql.NVarChar(50), params.lastName)
        .input('email', sql.NVarChar(255), params.email.trim().toLowerCase())
        .input('phoneNumber', sql.NVarChar(20), params.phoneNumber || null)
        .input('passwordHash', sql.NVarChar(255), params.passwordHash)
        .input('status', sql.VarChar(20), 'ACTIVE')
        .query<UserRecord>(`
          INSERT INTO dbo.Users (FirstName, LastName, Email, PhoneNumber, PasswordHash, Status, CreatedAt, PasswordLastChangedAt)
          OUTPUT Inserted.*
          VALUES (@firstName, @lastName, @email, @phoneNumber, @passwordHash, @status, GETDATE(), GETDATE())
        `);

      const newUser = userRes.recordset[0];

      // Resolve role
      let roleRes = await tx
        .request()
        .input('roleName', sql.VarChar(50), params.roleName)
        .query<{ RoleID: bigint | number }>('SELECT RoleID FROM dbo.Roles WHERE RoleName = @roleName');

      let roleId = roleRes.recordset[0]?.RoleID;
      if (!roleId) {
        const createRoleRes = await tx
          .request()
          .input('roleName', sql.VarChar(50), params.roleName)
          .input('desc', sql.NVarChar(255), `${params.roleName} Platform Role`)
          .input('status', sql.VarChar(20), 'ACTIVE')
          .query<{ RoleID: bigint | number }>(`
            INSERT INTO dbo.Roles (RoleName, Description, Status, CreatedAt)
            OUTPUT Inserted.RoleID
            VALUES (@roleName, @desc, @status, GETDATE())
          `);
        roleId = createRoleRes.recordset[0].RoleID;
      }

      await tx
        .request()
        .input('userId', sql.BigInt, newUser.UserID)
        .input('roleId', sql.BigInt, roleId)
        .input('createdBy', sql.BigInt, params.createdByAdminId ?? newUser.UserID)
        .query(`
          INSERT INTO dbo.UserRoles (UserID, RoleID, CreatedAt, CreatedBy)
          VALUES (@userId, @roleId, GETDATE(), @createdBy)
        `);

      return newUser;
    });
  }
}

export const authRepository = new AuthRepository();
