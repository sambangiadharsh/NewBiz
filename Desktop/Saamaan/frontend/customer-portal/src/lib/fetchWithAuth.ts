const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:7000/api/v1';

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (err: any) => void;
}> = [];

/**
 * Immediately clears customer session data from localStorage and dispatches
 * an event so all mounted components transition to the unauthenticated state.
 */
export function clearCustomerSession(): void {
  try {
    localStorage.removeItem('saamaan_customer_user');
  } catch {}
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('saamaan:auth-expired'));
  }
}

const processQueue = (error: any) => {
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
 * Perform a silent refresh for customer session via httpOnly cookies
 */
export async function refreshCustomerToken(): Promise<boolean> {
  if (isRefreshing) {
    return new Promise((resolve, reject) => {
      failedQueue.push({ resolve, reject });
    })
      .then(() => true)
      .catch(() => false);
  }

  isRefreshing = true;

  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Portal-Type': 'customer',
      },
      credentials: 'include', // Automatically sends customer_refresh_token cookie
    });

    if (!res.ok) {
      clearCustomerSession();
      processQueue(new Error('Failed to refresh session'));
      return false;
    }

    processQueue(null);
    return true;
  } catch (err) {
    clearCustomerSession();
    processQueue(err);
    return false;
  } finally {
    isRefreshing = false;
  }
}

/**
 * Enhanced fetch wrapper with automatic cookie credentials (customer_token) and silent auto-refresh on 401
 */
export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers || {});

  headers.set('X-Portal-Type', 'customer');
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const finalOptions: RequestInit = {
    ...options,
    headers,
    credentials: 'include', // Automatically sends and receives httpOnly customer cookies (customer_token)
  };

  let response = await fetch(url, finalOptions);

  // If 401 unauthorized, attempt silent refresh once via cookies
  if (response.status === 401 && !url.includes('/auth/refresh') && !url.includes('/auth/login') && !url.includes('/auth/logout')) {
    const refreshed = await refreshCustomerToken();
    if (refreshed) {
      response = await fetch(url, finalOptions);
    } else {
      clearCustomerSession();
    }
  }

  return response;
}
