import { getPool, sql } from '../../database/db.js';

export interface CustomerAddressRecord {
  CustomerAddressID: bigint | number;
  CustomerID: bigint | number;
  AddressLabel: string;
  RecipientName: string;
  PhoneNumber: string | null;
  AddressLine1: string;
  AddressLine2: string | null;
  City: string;
  State: string;
  PostalCode: string;
  Country: string;
  GSTIN: string | null;
  Latitude: number | null;
  Longitude: number | null;
  IsDefaultShipping: boolean;
  IsDefaultBilling: boolean;
  CreatedAt: Date;
  UpdatedAt: Date | null;
}

export interface CreateAddressData {
  customerId: bigint | number;
  addressLabel?: string;
  recipientName: string;
  phoneNumber?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country?: string;
  gstin?: string;
  isDefaultShipping?: boolean;
  isDefaultBilling?: boolean;
}

export interface UpdateAddressData {
  addressLabel?: string;
  recipientName?: string;
  phoneNumber?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  gstin?: string;
  isDefaultShipping?: boolean;
  isDefaultBilling?: boolean;
}

export class CustomerAddressesRepository {
  async listByCustomerId(customerId: bigint | number): Promise<CustomerAddressRecord[]> {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('customerId', sql.BigInt, customerId)
      .query<CustomerAddressRecord>(`
        SELECT 
          CustomerAddressID,
          CustomerID,
          AddressLabel,
          RecipientName,
          PhoneNumber,
          AddressLine1,
          AddressLine2,
          City,
          State,
          PostalCode,
          Country,
          GSTIN,
          Latitude,
          Longitude,
          IsDefaultShipping,
          IsDefaultBilling,
          CreatedAt,
          UpdatedAt
        FROM dbo.CustomerAddresses
        WHERE CustomerID = @customerId
        ORDER BY IsDefaultShipping DESC, CreatedAt DESC
      `);

    return result.recordset;
  }

  async findById(addressId: bigint | number, customerId: bigint | number): Promise<CustomerAddressRecord | null> {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('addressId', sql.BigInt, addressId)
      .input('customerId', sql.BigInt, customerId)
      .query<CustomerAddressRecord>(`
        SELECT *
        FROM dbo.CustomerAddresses
        WHERE CustomerAddressID = @addressId AND CustomerID = @customerId
      `);

    return result.recordset[0] || null;
  }

  async create(data: CreateAddressData): Promise<CustomerAddressRecord> {
    const pool = await getPool();

    // Check if customer already has addresses. If not, this first address is automatically default.
    const countRes = await pool
      .request()
      .input('customerId', sql.BigInt, data.customerId)
      .query<{ Count: number }>('SELECT COUNT(1) AS Count FROM dbo.CustomerAddresses WHERE CustomerID = @customerId');
    
    const isFirst = (countRes.recordset[0]?.Count || 0) === 0;
    const isDefault = isFirst || Boolean(data.isDefaultShipping);

    if (isDefault) {
      // Unset previous defaults
      await pool
        .request()
        .input('customerId', sql.BigInt, data.customerId)
        .query('UPDATE dbo.CustomerAddresses SET IsDefaultShipping = 0, IsDefaultBilling = 0 WHERE CustomerID = @customerId');
    }

    const cleanGst = data.gstin ? data.gstin.trim().toUpperCase() : null;

    const result = await pool
      .request()
      .input('customerId', sql.BigInt, data.customerId)
      .input('addressLabel', sql.NVarChar(50), data.addressLabel || 'Home')
      .input('recipientName', sql.NVarChar(200), data.recipientName)
      .input('phoneNumber', sql.NVarChar(20), data.phoneNumber || null)
      .input('addressLine1', sql.NVarChar(255), data.addressLine1)
      .input('addressLine2', sql.NVarChar(255), data.addressLine2 || null)
      .input('city', sql.NVarChar(100), data.city)
      .input('state', sql.NVarChar(100), data.state)
      .input('postalCode', sql.NVarChar(20), data.postalCode)
      .input('country', sql.NVarChar(100), data.country || 'India')
      .input('gstin', sql.NVarChar(15), cleanGst)
      .input('isDefaultShipping', sql.Bit, isDefault ? 1 : 0)
      .input('isDefaultBilling', sql.Bit, isDefault ? 1 : 0)
      .query<CustomerAddressRecord>(`
        INSERT INTO dbo.CustomerAddresses (
          CustomerID, AddressLabel, RecipientName, PhoneNumber,
          AddressLine1, AddressLine2, City, State, PostalCode, Country, GSTIN,
          IsDefaultShipping, IsDefaultBilling, CreatedAt
        )
        OUTPUT 
          INSERTED.CustomerAddressID,
          INSERTED.CustomerID,
          INSERTED.AddressLabel,
          INSERTED.RecipientName,
          INSERTED.PhoneNumber,
          INSERTED.AddressLine1,
          INSERTED.AddressLine2,
          INSERTED.City,
          INSERTED.State,
          INSERTED.PostalCode,
          INSERTED.Country,
          INSERTED.GSTIN,
          INSERTED.Latitude,
          INSERTED.Longitude,
          INSERTED.IsDefaultShipping,
          INSERTED.IsDefaultBilling,
          INSERTED.CreatedAt,
          INSERTED.UpdatedAt
        VALUES (
          @customerId, @addressLabel, @recipientName, @phoneNumber,
          @addressLine1, @addressLine2, @city, @state, @postalCode, @country, @gstin,
          @isDefaultShipping, @isDefaultBilling, SYSUTCDATETIME()
        )
      `);

    return result.recordset[0];
  }

  async update(addressId: bigint | number, customerId: bigint | number, data: UpdateAddressData): Promise<CustomerAddressRecord | null> {
    const pool = await getPool();

    const existing = await this.findById(addressId, customerId);
    if (!existing) {
      return null;
    }

    if (data.isDefaultShipping || data.isDefaultBilling) {
      await pool
        .request()
        .input('customerId', sql.BigInt, customerId)
        .query('UPDATE dbo.CustomerAddresses SET IsDefaultShipping = 0, IsDefaultBilling = 0 WHERE CustomerID = @customerId');
    }

    const cleanGst = data.gstin !== undefined 
      ? (data.gstin ? data.gstin.trim().toUpperCase() : null)
      : existing.GSTIN;

    const result = await pool
      .request()
      .input('addressId', sql.BigInt, addressId)
      .input('customerId', sql.BigInt, customerId)
      .input('addressLabel', sql.NVarChar(50), data.addressLabel !== undefined ? data.addressLabel : existing.AddressLabel)
      .input('recipientName', sql.NVarChar(200), data.recipientName !== undefined ? data.recipientName : existing.RecipientName)
      .input('phoneNumber', sql.NVarChar(20), data.phoneNumber !== undefined ? (data.phoneNumber || null) : existing.PhoneNumber)
      .input('addressLine1', sql.NVarChar(255), data.addressLine1 !== undefined ? data.addressLine1 : existing.AddressLine1)
      .input('addressLine2', sql.NVarChar(255), data.addressLine2 !== undefined ? (data.addressLine2 || null) : existing.AddressLine2)
      .input('city', sql.NVarChar(100), data.city !== undefined ? data.city : existing.City)
      .input('state', sql.NVarChar(100), data.state !== undefined ? data.state : existing.State)
      .input('postalCode', sql.NVarChar(20), data.postalCode !== undefined ? data.postalCode : existing.PostalCode)
      .input('country', sql.NVarChar(100), data.country !== undefined ? data.country : existing.Country)
      .input('gstin', sql.NVarChar(15), cleanGst)
      .input('isDefaultShipping', sql.Bit, data.isDefaultShipping !== undefined ? (data.isDefaultShipping ? 1 : 0) : (existing.IsDefaultShipping ? 1 : 0))
      .input('isDefaultBilling', sql.Bit, data.isDefaultBilling !== undefined ? (data.isDefaultBilling ? 1 : 0) : (existing.IsDefaultBilling ? 1 : 0))
      .query<CustomerAddressRecord>(`
        UPDATE dbo.CustomerAddresses
        SET
          AddressLabel = @addressLabel,
          RecipientName = @recipientName,
          PhoneNumber = @phoneNumber,
          AddressLine1 = @addressLine1,
          AddressLine2 = @addressLine2,
          City = @city,
          State = @state,
          PostalCode = @postalCode,
          Country = @country,
          GSTIN = @gstin,
          IsDefaultShipping = @isDefaultShipping,
          IsDefaultBilling = @isDefaultBilling,
          UpdatedAt = SYSUTCDATETIME()
        OUTPUT 
          INSERTED.CustomerAddressID,
          INSERTED.CustomerID,
          INSERTED.AddressLabel,
          INSERTED.RecipientName,
          INSERTED.PhoneNumber,
          INSERTED.AddressLine1,
          INSERTED.AddressLine2,
          INSERTED.City,
          INSERTED.State,
          INSERTED.PostalCode,
          INSERTED.Country,
          INSERTED.GSTIN,
          INSERTED.Latitude,
          INSERTED.Longitude,
          INSERTED.IsDefaultShipping,
          INSERTED.IsDefaultBilling,
          INSERTED.CreatedAt,
          INSERTED.UpdatedAt
        WHERE CustomerAddressID = @addressId AND CustomerID = @customerId
      `);

    return result.recordset[0] || null;
  }

  async setDefault(addressId: bigint | number, customerId: bigint | number): Promise<void> {
    const pool = await getPool();

    await pool
      .request()
      .input('customerId', sql.BigInt, customerId)
      .query('UPDATE dbo.CustomerAddresses SET IsDefaultShipping = 0, IsDefaultBilling = 0 WHERE CustomerID = @customerId');

    await pool
      .request()
      .input('addressId', sql.BigInt, addressId)
      .input('customerId', sql.BigInt, customerId)
      .query(`
        UPDATE dbo.CustomerAddresses 
        SET IsDefaultShipping = 1, IsDefaultBilling = 1, UpdatedAt = SYSUTCDATETIME()
        WHERE CustomerAddressID = @addressId AND CustomerID = @customerId
      `);
  }

  async delete(addressId: bigint | number, customerId: bigint | number): Promise<boolean> {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('addressId', sql.BigInt, addressId)
      .input('customerId', sql.BigInt, customerId)
      .query('DELETE FROM dbo.CustomerAddresses WHERE CustomerAddressID = @addressId AND CustomerID = @customerId');

    return (result.rowsAffected[0] || 0) > 0;
  }

  async lookupPincode(pincode: string): Promise<{ Pincode: string; City: string; State: string; Latitude: number | null; Longitude: number | null; gstStateCode?: string; stateCode?: string } | null> {
    const pool = await getPool();

    const result = await pool
      .request()
      .input('pincode', sql.VarChar(10), pincode.trim())
      .query<{ Pincode: string; City: string; State: string; Latitude: number | null; Longitude: number | null; gstStateCode?: string; stateCode?: string }>(`
        SELECT TOP 1
          p.Pincode,
          p.City,
          p.State,
          p.Latitude,
          p.Longitude,
          sm.gst_state_code AS gstStateCode,
          sm.state_code AS stateCode
        FROM dbo.PincodeLookups p
        LEFT JOIN dbo.state_master sm ON (
          LOWER(p.State) = LOWER(sm.state_name) 
          OR UPPER(p.State) = sm.state_code
        )
        WHERE p.Pincode = @pincode
      `);

    if (result.recordset[0]) {
      return result.recordset[0];
    }

    const fb = await pool
      .request()
      .input('pincode', sql.VarChar(10), pincode.trim())
      .query<{ Pincode: string; City: string; State: string; Latitude: number | null; Longitude: number | null; gstStateCode?: string; stateCode?: string }>(`
        SELECT TOP 1
          p.pincode AS Pincode,
          p.city_name AS City,
          p.state_name AS State,
          NULL AS Latitude,
          NULL AS Longitude,
          sm.gst_state_code AS gstStateCode,
          sm.state_code AS stateCode
        FROM dbo.pincode_lookup p
        LEFT JOIN dbo.state_master sm ON p.state_id = sm.state_id
        WHERE p.pincode = @pincode
      `);

    return fb.recordset[0] || null;
  }
}

export const customerAddressesRepository = new CustomerAddressesRepository();
