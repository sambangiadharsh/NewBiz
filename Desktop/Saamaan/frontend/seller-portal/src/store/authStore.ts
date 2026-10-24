import { create } from 'zustand';
import { apiClient } from '../lib/axios.js';
import { AuthUser, ApiResponse } from '../types/auth.js';

const SELLER_STORAGE_KEY = 'saaman_seller_auth_user';

const getCachedUser = (): AuthUser | null => {
  try {
    const raw = localStorage.getItem(SELLER_STORAGE_KEY);
    if (!raw) return null;
    const parsed: AuthUser = JSON.parse(raw);
    const hasSellerRole =
      Array.isArray(parsed?.roles) && parsed.roles.includes('SELLER_ADMIN');
    return hasSellerRole ? parsed : null;
  } catch {
    return null;
  }
};

const initialCachedUser = getCachedUser();

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

export const useAuthStore = create<AuthState>((set, get) => ({
  user: initialCachedUser,
  isAuthenticated: !!initialCachedUser,
  // If user is already cached from previous login, load immediately with zero wait!
  isLoading: !initialCachedUser,
  error: null,

  checkAuth: async () => {
    const currentCached = get().user;
    if (!currentCached) {
      set({ isLoading: true, error: null });
    }

    const attempt = async (): Promise<boolean> => {
      try {
        const res = await apiClient.get<ApiResponse<AuthUser>>('/auth/me');
        if (res.data.success && res.data.data) {
          const user = res.data.data;
          const hasSellerRole = user.roles.includes('SELLER_ADMIN');
          if (!hasSellerRole) {
            localStorage.removeItem(SELLER_STORAGE_KEY);
            set({ user: null, isAuthenticated: false, isLoading: false });
            return false;
          }
          localStorage.setItem(SELLER_STORAGE_KEY, JSON.stringify(user));
          set({ user, isAuthenticated: true, isLoading: false });
          return true;
        }
        localStorage.removeItem(SELLER_STORAGE_KEY);
        set({ user: null, isAuthenticated: false, isLoading: false });
        return false;
      } catch (err: any) {
        const status = err?.response?.status;
        if (status === 401 || status === 403) {
          localStorage.removeItem(SELLER_STORAGE_KEY);
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
      localStorage.removeItem(SELLER_STORAGE_KEY);
      await apiClient.post('/auth/logout');
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      localStorage.removeItem(SELLER_STORAGE_KEY);
      set({ user: null, isAuthenticated: false, isLoading: false });
      window.location.href = '/login';
    }
  },

  setUser: (user: AuthUser) => {
    localStorage.setItem(SELLER_STORAGE_KEY, JSON.stringify(user));
    set({ user, isAuthenticated: true, isLoading: false, error: null });
  },
}));
