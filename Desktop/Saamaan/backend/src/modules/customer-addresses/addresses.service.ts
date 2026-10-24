import { customerAddressesRepository, CustomerAddressRecord } from './addresses.repository.js';
import { BadRequestError, NotFoundError } from '../../utils/errors.js';

export interface CreateAddressInput {
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

export interface UpdateAddressInput {
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

export function validateGSTINFormat(gstin?: string | null): void {
  if (!gstin || !gstin.trim()) return;
  const trimmed = gstin.trim().toUpperCase();
  // Standard: 2 state digits (01-38/97/99), 10 PAN chars, 1 entity digit, 1 char (Z/D/C/alphanumeric), 1 checksum char
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[A-Z0-9]{1}[0-9A-Z]{1}$/;
  if (!gstinRegex.test(trimmed)) {
    throw new BadRequestError('Invalid GSTIN format. Must be 15 alphanumeric characters (e.g., 37AAAAA0000A1Z5).');
  }
}

export class CustomerAddressesService {
  async listAddresses(customerId: bigint | number): Promise<CustomerAddressRecord[]> {
    return await customerAddressesRepository.listByCustomerId(customerId);
  }

  async createAddress(customerId: bigint | number, input: CreateAddressInput): Promise<CustomerAddressRecord> {
    if (!input.recipientName || !input.recipientName.trim()) {
      throw new BadRequestError('Recipient name is required');
    }
    if (!input.addressLine1 || !input.addressLine1.trim()) {
      throw new BadRequestError('Address line 1 is required');
    }
    if (!input.city || !input.city.trim()) {
      throw new BadRequestError('City is required');
    }
    if (!input.state || !input.state.trim()) {
      throw new BadRequestError('State is required');
    }
    if (!input.postalCode || !input.postalCode.trim()) {
      throw new BadRequestError('Postal code (PIN code) is required');
    }

    if (input.gstin) {
      validateGSTINFormat(input.gstin);
    }

    return await customerAddressesRepository.create({
      customerId,
      addressLabel: input.addressLabel?.trim() || 'Home',
      recipientName: input.recipientName.trim(),
      phoneNumber: input.phoneNumber?.trim() || undefined,
      addressLine1: input.addressLine1.trim(),
      addressLine2: input.addressLine2?.trim() || undefined,
      city: input.city.trim(),
      state: input.state.trim(),
      postalCode: input.postalCode.trim(),
      country: input.country?.trim() || 'India',
      gstin: input.gstin?.trim().toUpperCase(),
      isDefaultShipping: input.isDefaultShipping,
      isDefaultBilling: input.isDefaultBilling,
    });
  }

  async updateAddress(addressId: bigint | number, customerId: bigint | number, input: UpdateAddressInput): Promise<CustomerAddressRecord> {
    const existing = await customerAddressesRepository.findById(addressId, customerId);
    if (!existing) {
      throw new NotFoundError('Address not found');
    }

    if (input.recipientName !== undefined && !input.recipientName.trim()) {
      throw new BadRequestError('Recipient name cannot be empty');
    }
    if (input.addressLine1 !== undefined && !input.addressLine1.trim()) {
      throw new BadRequestError('Address line 1 cannot be empty');
    }
    if (input.city !== undefined && !input.city.trim()) {
      throw new BadRequestError('City cannot be empty');
    }
    if (input.state !== undefined && !input.state.trim()) {
      throw new BadRequestError('State cannot be empty');
    }
    if (input.postalCode !== undefined && !input.postalCode.trim()) {
      throw new BadRequestError('Postal code (PIN code) cannot be empty');
    }

    if (input.gstin) {
      validateGSTINFormat(input.gstin);
    }

    const updated = await customerAddressesRepository.update(addressId, customerId, {
      addressLabel: input.addressLabel?.trim(),
      recipientName: input.recipientName?.trim(),
      phoneNumber: input.phoneNumber?.trim(),
      addressLine1: input.addressLine1?.trim(),
      addressLine2: input.addressLine2?.trim(),
      city: input.city?.trim(),
      state: input.state?.trim(),
      postalCode: input.postalCode?.trim(),
      country: input.country?.trim(),
      gstin: input.gstin !== undefined ? (input.gstin.trim() ? input.gstin.trim().toUpperCase() : '') : undefined,
      isDefaultShipping: input.isDefaultShipping,
      isDefaultBilling: input.isDefaultBilling,
    });

    if (!updated) {
      throw new NotFoundError('Address not found or update failed');
    }

    return updated;
  }

  async setDefaultAddress(addressId: bigint | number, customerId: bigint | number): Promise<void> {
    const existing = await customerAddressesRepository.findById(addressId, customerId);
    if (!existing) {
      throw new NotFoundError('Address not found');
    }
    await customerAddressesRepository.setDefault(addressId, customerId);
  }

  async deleteAddress(addressId: bigint | number, customerId: bigint | number): Promise<void> {
    const deleted = await customerAddressesRepository.delete(addressId, customerId);
    if (!deleted) {
      throw new NotFoundError('Address not found');
    }
  }

  async lookupPincode(pincode: string): Promise<{ pincode: string; city: string; state: string; latitude: number | null; longitude: number | null; gstStateCode?: string; stateCode?: string } | null> {
    const clean = pincode?.trim() || '';
    if (!clean || !/^\d{6}$/.test(clean)) {
      throw new BadRequestError('Invalid PIN code. Must be a 6-digit number.');
    }

    const record = await customerAddressesRepository.lookupPincode(clean);
    if (!record) {
      return null;
    }

    return {
      pincode: record.Pincode,
      city: record.City,
      state: record.State,
      latitude: record.Latitude,
      longitude: record.Longitude,
      gstStateCode: record.gstStateCode,
      stateCode: record.stateCode,
    };
  }
}

export const customerAddressesService = new CustomerAddressesService();
