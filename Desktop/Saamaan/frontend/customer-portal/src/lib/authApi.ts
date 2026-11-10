import { fetchWithAuth, clearCustomerSession } from './fetchWithAuth';

const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:7000/api/v1';

export interface CustomerData {
  customerId: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  status?: string;
}

export interface AuthResponse {
  accessToken: string;
  customer?: CustomerData;
  user?: CustomerData;
}

export const customerAuthApi = {
  async register(data: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    phoneNumber?: string;
  }): Promise<AuthResponse> {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Portal-Type': 'customer',
      },
      credentials: 'include',
      body: JSON.stringify(data),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.message || 'Registration failed. Please check your details.');
    }
    return json.data;
  },

  async login(data: { email: string; password: string }): Promise<AuthResponse> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Portal-Type': 'customer',
      },
      credentials: 'include',
      body: JSON.stringify(data),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.message || 'Invalid email or password.');
    }
    return json.data;
  },

  /**
   * Fetches the current authenticated customer profile using cookie authentication.
   * If the access token is expired, fetchWithAuth transparently performs a silent refresh.
   * If both tokens are expired/invalid, it returns null and triggers clean session eviction.
   */
  async getMe(): Promise<CustomerData | null> {
    try {
      const res = await fetchWithAuth(`${API_BASE}/auth/me`);
      if (!res.ok) {
        return null;
      }
      const json = await res.json().catch(() => ({}));
      return json.data || null;
    } catch {
      return null;
    }
  },

  async logout(): Promise<void> {
    clearCustomerSession();
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Portal-Type': 'customer',
      },
      credentials: 'include',
    }).catch(() => {});
  },

  async refreshSession(): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Portal-Type': 'customer',
        },
        credentials: 'include',
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  async forgotPassword(email: string): Promise<{ message: string }> {
    const res = await fetch(`${API_BASE}/auth/forgot-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Portal-Type': 'customer',
      },
      body: JSON.stringify({ email }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.message || 'Failed to send password reset request.');
    }
    return json.data;
  },

  async resetPassword(data: {
    email: string;
    otp: string;
    newPassword: string;
  }): Promise<{ message: string }> {
    const res = await fetch(`${API_BASE}/auth/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Portal-Type': 'customer',
      },
      body: JSON.stringify(data),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.message || 'Failed to reset password. Please check your verification code.');
    }
    return json.data;
  },
};
