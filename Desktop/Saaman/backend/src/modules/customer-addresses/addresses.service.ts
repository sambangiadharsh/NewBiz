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
  isDefaultShipping?: boolean;
  isDefaultBilling?: boolean;
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
      isDefaultShipping: input.isDefaultShipping,
      isDefaultBilling: input.isDefaultBilling,
    });
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
}

export const customerAddressesService = new CustomerAddressesService();
