import { Request, Response, NextFunction } from 'express';
import { customerAddressesService } from './addresses.service.js';
import { sendSuccess } from '../../utils/response.js';
import { UnauthorizedError } from '../../utils/errors.js';

export class CustomerAddressesController {
  private getCustomerId(req: Request): bigint {
    const customerId = req.user?.userId;
    if (!customerId) {
      throw new UnauthorizedError('Authentication required');
    }
    return BigInt(customerId);
  }

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const customerId = this.getCustomerId(req);
      const addresses = await customerAddressesService.listAddresses(customerId);
      sendSuccess(res, addresses, 'Customer addresses retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const customerId = this.getCustomerId(req);
      const {
        addressLabel,
        recipientName,
        phoneNumber,
        addressLine1,
        addressLine2,
        city,
        state,
        postalCode,
        country,
        isDefaultShipping,
        isDefaultBilling,
      } = req.body;

      const newAddress = await customerAddressesService.createAddress(customerId, {
        addressLabel,
        recipientName,
        phoneNumber,
        addressLine1,
        addressLine2,
        city,
        state,
        postalCode,
        country,
        isDefaultShipping,
        isDefaultBilling,
      });

      sendSuccess(res, newAddress, 'Address added successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async setDefault(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const customerId = this.getCustomerId(req);
      const addressId = BigInt(req.params.id);
      await customerAddressesService.setDefaultAddress(addressId, customerId);
      sendSuccess(res, null, 'Default address updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const customerId = this.getCustomerId(req);
      const addressId = BigInt(req.params.id);
      await customerAddressesService.deleteAddress(addressId, customerId);
      sendSuccess(res, null, 'Address deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  async lookupPincode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { pincode } = req.params;
      const data = await customerAddressesService.lookupPincode(pincode);
      sendSuccess(res, data, data ? 'Pincode details retrieved successfully' : 'Pincode not found');
    } catch (error) {
      next(error);
    }
  }
}

export const customerAddressesController = new CustomerAddressesController();
