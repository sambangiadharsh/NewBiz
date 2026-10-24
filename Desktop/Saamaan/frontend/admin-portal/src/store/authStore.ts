import { create } from 'zustand';
import { apiClient } from '../lib/axios.js';
import { AuthUser, ApiResponse } from '../types/auth.js';

const ADMIN_STORAGE_KEY = 'saaman_admin_auth_user';

const isPermittedAdminUser = (user: AuthUser | null): boolean => {
  if (!user || !Array.isArray(user.roles)) return false;
  if (user.roles.includes('SUPER_ADMIN') || user.roles.includes('ADMIN')) return true;
  // Any internal user with active permissions or non-customer administrative role
  if (Array.isArray(user.permissions) && user.permissions.length > 0) return true;
  return false;
};

const getCachedUser = (): AuthUser | null => {
  try {
    const raw = localStorage.getItem(ADMIN_STORAGE_KEY);
    if (!raw) return null;
    const parsed: AuthUser = JSON.parse(raw);
    return isPermittedAdminUser(parsed) ? parsed : null;
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
  // If we already have a verified cached session in localStorage, zero wait!
  isLoading: !initialCachedUser,
  error: null,

  checkAuth: async () => {
    const currentCached = get().user;
    // Only block with loader on cold start if there is no cached user
    if (!currentCached) {
      set({ isLoading: true, error: null });
    }

    const attempt = async (): Promise<boolean> => {
      try {
        const res = await apiClient.get<ApiResponse<AuthUser>>('/auth/me');
        if (res.data.success && res.data.data) {
          const user = res.data.data;
          if (!isPermittedAdminUser(user)) {
            localStorage.removeItem(ADMIN_STORAGE_KEY);
            set({ user: null, isAuthenticated: false, isLoading: false });
            return false;
          }
          localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(user));
          set({ user, isAuthenticated: true, isLoading: false });
          return true;
        }
        localStorage.removeItem(ADMIN_STORAGE_KEY);
        set({ user: null, isAuthenticated: false, isLoading: false });
        return false;
      } catch (err: any) {
        const status = err?.response?.status;
        if (status === 401 || status === 403) {
          localStorage.removeItem(ADMIN_STORAGE_KEY);
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
      localStorage.removeItem(ADMIN_STORAGE_KEY);
      await apiClient.post('/auth/logout');
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      localStorage.removeItem(ADMIN_STORAGE_KEY);
      set({ user: null, isAuthenticated: false, isLoading: false });
      window.location.href = '/login';
    }
  },

  setUser: (user: AuthUser) => {
    localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(user));
    set({ user, isAuthenticated: true, isLoading: false, error: null });
  },
}));
