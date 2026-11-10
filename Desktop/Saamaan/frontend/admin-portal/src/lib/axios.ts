import axios from 'axios';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:7000/api/v1',
  withCredentials: true, // Automatically sends and receives httpOnly cookies (admin_token, admin_refresh_token)
  headers: {
    'Content-Type': 'application/json',
    'X-Portal-Type': 'admin',
  },
  timeout: 15000,
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: unknown) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve();
    }
  });
  failedQueue = [];
};

/**
 * Set to true during checkAuth() startup so the interceptor does NOT
 * hard-redirect to /login — instead it rejects the promise and lets
 * the authStore handle navigation gracefully.
 */
export let suppressAuthRedirect = false;
export const setSuppressAuthRedirect = (val: boolean) => {
  suppressAuthRedirect = val;
};

// Response interceptor with Silent Auto-Refresh & Request Queueing
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 occurs and is NOT the refresh request itself and hasn't been retried yet
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/refresh') &&
      !originalRequest.url?.includes('/auth/login') &&
      !originalRequest.url?.includes('/auth/logout')
    ) {
      if (isRefreshing) {
        // If a refresh is already in progress, queue this request until refresh completes
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => {
            originalRequest._retry = true;
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Attempt silent refresh via backend /auth/refresh (sends admin_refresh_token cookie)
        await apiClient.post('/auth/refresh');
        processQueue(null);
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError);
        // Only hard-redirect if not in startup checkAuth and not already on login
        if (!suppressAuthRedirect && window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Direct 401 on login or failed refresh — only redirect if not in startup checkAuth
    if (
      error.response?.status === 401 &&
      !suppressAuthRedirect &&
      window.location.pathname !== '/login' &&
      originalRequest.url?.includes('/auth/refresh')
    ) {
      window.location.href = '/login';
    }

    return Promise.reject(error);
  }
);
