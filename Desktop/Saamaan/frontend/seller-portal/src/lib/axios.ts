import axios from 'axios';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:7000/api/v1',
  withCredentials: true, // Automatically sends and receives httpOnly cookies (seller_token)
  headers: {
    'Content-Type': 'application/json',
    'X-Portal-Type': 'seller',
  },
  timeout: 15000,
});

// Response interceptor to handle common errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
