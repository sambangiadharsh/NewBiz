const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:7000/api/v1';

export interface CustomerAddress {
  CustomerAddressID: string;
  CustomerID: string;
  AddressLabel: string;
  RecipientName: string;
  PhoneNumber: string | null;
  AddressLine1: string;
  AddressLine2: string | null;
  City: string;
  State: string;
  PostalCode: string;
  Country: string;
  GSTIN?: string | null;
  IsDefaultShipping: boolean;
  IsDefaultBilling: boolean;
  CreatedAt: string;
}

export interface CreateAddressPayload {
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

export interface UpdateAddressPayload {
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

export interface PincodeLookupData {
  pincode: string;
  city: string;
  state: string;
  latitude?: number | null;
  longitude?: number | null;
  gstStateCode?: string;
  stateCode?: string;
}

const getAuthHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('saamaan_customer_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Portal-Type': 'customer',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

export const addressesApi = {
  async getAddresses(): Promise<CustomerAddress[]> {
    const token = localStorage.getItem('saamaan_customer_token');
    if (!token) return [];

    const res = await fetch(`${API_BASE}/customer/addresses`, {
      headers: getAuthHeaders(),
      credentials: 'include',
    });

    if (!res.ok) {
      if (res.status === 401) return [];
      throw new Error('Failed to load saved addresses');
    }

    const json = await res.json().catch(() => ({}));
    return json.data || [];
  },

  async createAddress(data: CreateAddressPayload): Promise<CustomerAddress> {
    const res = await fetch(`${API_BASE}/customer/addresses`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(data),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.error?.message || json.message || 'Failed to save address');
    }

    return json.data;
  },

  async updateAddress(addressId: string, data: UpdateAddressPayload): Promise<CustomerAddress> {
    const res = await fetch(`${API_BASE}/customer/addresses/${addressId}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(data),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.error?.message || json.message || 'Failed to update address');
    }

    return json.data;
  },

  async setDefaultAddress(addressId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/customer/addresses/${addressId}/default`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      credentials: 'include',
    });

    if (!res.ok) {
      throw new Error('Failed to set default address');
    }
  },

  async deleteAddress(addressId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/customer/addresses/${addressId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
      credentials: 'include',
    });

    if (!res.ok) {
      throw new Error('Failed to delete address');
    }
  },

  async lookupPincode(pincode: string): Promise<PincodeLookupData | null> {
    const clean = pincode.trim();
    if (!clean || clean.length !== 6) return null;

    try {
      const res = await fetch(`${API_BASE}/customer/addresses/pincode/${clean}`, {
        headers: getAuthHeaders(),
        credentials: 'include',
      });

      if (!res.ok) return null;
      const json = await res.json().catch(() => ({}));
      return json.data || null;
    } catch (err) {
      console.warn('Pincode lookup error:', err);
      return null;
    }
  },
};
