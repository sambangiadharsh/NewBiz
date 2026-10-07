import { create } from 'zustand';
import { apiClient } from '../lib/axios.js';
import { AuthUser, ApiResponse } from '../types/auth.js';

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  checkAuth: () => Promise<boolean>;
  logout: () => Promise<void>;
  setUser: (user: AuthUser) => void;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  checkAuth: async () => {
    set({ isLoading: true, error: null });

    // Attempt the auth check, with one retry on network failure (e.g. backend restarting).
    const attempt = async (): Promise<boolean> => {
      try {
        const res = await apiClient.get<ApiResponse<AuthUser>>('/auth/me');
        if (res.data.success && res.data.data) {
          const user = res.data.data;
          const hasSellerRole = user.roles.includes('SELLER_ADMIN');
          if (!hasSellerRole) {
            set({ user: null, isAuthenticated: false, isLoading: false });
            return false;
          }
          set({ user, isAuthenticated: true, isLoading: false });
          return true;
        }
        set({ user: null, isAuthenticated: false, isLoading: false });
        return false;
      } catch (err: any) {
        const status = err?.response?.status;
        if (status === 401 || status === 403) {
          set({ user: null, isAuthenticated: false, isLoading: false });
          return false;
        }
        throw err;
      }
    };

    try {
      return await attempt();
    } catch {
      await sleep(1500);
      try {
        return await attempt();
      } catch {
        set({ isLoading: false });
        return false;
      }
    }
  },

  logout: async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      set({ user: null, isAuthenticated: false, isLoading: false });
      window.location.href = '/login';
    }
  },

  setUser: (user: AuthUser) => {
    set({ user, isAuthenticated: true, isLoading: false, error: null });
  },
}));

