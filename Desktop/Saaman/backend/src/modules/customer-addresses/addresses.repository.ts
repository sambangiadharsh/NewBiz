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
      .input('isDefaultShipping', sql.Bit, isDefault ? 1 : 0)
      .input('isDefaultBilling', sql.Bit, isDefault ? 1 : 0)
      .query<CustomerAddressRecord>(`
        INSERT INTO dbo.CustomerAddresses (
          CustomerID, AddressLabel, RecipientName, PhoneNumber,
          AddressLine1, AddressLine2, City, State, PostalCode, Country,
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
          INSERTED.Latitude,
          INSERTED.Longitude,
          INSERTED.IsDefaultShipping,
          INSERTED.IsDefaultBilling,
          INSERTED.CreatedAt,
          INSERTED.UpdatedAt
        VALUES (
          @customerId, @addressLabel, @recipientName, @phoneNumber,
          @addressLine1, @addressLine2, @city, @state, @postalCode, @country,
          @isDefaultShipping, @isDefaultBilling, SYSUTCDATETIME()
        )
      `);

    return result.recordset[0];
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
}

export const customerAddressesRepository = new CustomerAddressesRepository();
