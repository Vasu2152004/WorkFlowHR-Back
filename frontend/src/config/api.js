import axios from 'axios';

// Create axios instance with default configuration
const api = axios.create({
  timeout: 10000, // 10 seconds timeout
  headers: {
    'Content-Type': 'application/json',
  },
});

// Get API base URL based on environment
const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  
  // In production (Vercel), use relative path
  if (import.meta.env.PROD) {
    return '/api';
  }
  
  // In development, use localhost
  return 'http://localhost:3000/api';
};

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Handle 401 Unauthorized - redirect to login
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    
    // Handle 403 Forbidden
    if (error.response?.status === 403) {
      console.error('Access forbidden:', error.response.data);
    }
    
    // Handle 500 Server Error
    if (error.response?.status >= 500) {
      console.error('Server error:', error.response.data);
    }
    
    return Promise.reject(error);
  }
);

// API endpoints
export const API_ENDPOINTS = {
  // Auth endpoints
  LOGIN: '/auth/login',
  SIGNUP: '/auth/signup',
  LOGOUT: '/auth/logout',
  PROFILE: '/auth/profile',
  
  // User endpoints
  USERS: '/users',
  USER_BY_ID: (id) => `/users/${id}`,
  
  // Document endpoints
  DOCUMENTS: '/documents',
  DOCUMENT_BY_ID: (id) => `/documents/${id}`,
  
  // Leave endpoints
  LEAVES: '/leaves',
  LEAVE_BY_ID: (id) => `/leaves/${id}`,
  
  // Salary endpoints
  SALARY: '/salary',
  SALARY_BY_ID: (id) => `/salary/${id}`,
  
  // Working days endpoints
  WORKING_DAYS: '/working-days',
  
  // Company calendar endpoints
  COMPANY_CALENDAR: '/company-calendar',
};

// API methods
export const apiService = {
  // Generic GET request
  get: (endpoint, config = {}) => {
    return api.get(`${getApiBaseUrl()}${endpoint}`, config);
  },
  
  // Generic POST request
  post: (endpoint, data = {}, config = {}) => {
    return api.post(`${getApiBaseUrl()}${endpoint}`, data, config);
  },
  
  // Generic PUT request
  put: (endpoint, data = {}, config = {}) => {
    return api.put(`${getApiBaseUrl()}${endpoint}`, data, config);
  },
  
  // Generic DELETE request
  delete: (endpoint, config = {}) => {
    return api.delete(`${getApiBaseUrl()}${endpoint}`, config);
  },
  
  // File upload
  upload: (endpoint, formData, config = {}) => {
    return api.post(`${getApiBaseUrl()}${endpoint}`, formData, {
      ...config,
      headers: {
        ...config.headers,
        'Content-Type': 'multipart/form-data',
      },
    });
  },
};

// Health check
export const healthCheck = async () => {
  try {
    const baseUrl = getApiBaseUrl().replace('/api', '');
    const response = await axios.get(`${baseUrl}/health`);
    return response.data;
  } catch (error) {
    console.error('Health check failed:', error);
    throw error;
  }
};

export default api;
export { getApiBaseUrl };
