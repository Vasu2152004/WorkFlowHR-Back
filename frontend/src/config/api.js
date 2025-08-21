import axios from 'axios';

// Create axios instance with default configuration
const api = axios.create({
  timeout: 30000, // 30 seconds timeout for heavy operations like PDF generation
  headers: {
    'Content-Type': 'application/json',
  },
  // Remove baseURL to ensure dynamic URL generation
});

// Flag to track if we're in a login flow to prevent automatic redirects
let isLoginFlow = false;

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token'); // Fixed: use access_token instead of token
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Check if this is a login request to set the flag
    if (config.url && config.url.includes('/auth/login')) {
      isLoginFlow = true;
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
    // Reset login flow flag on successful response
    if (response.config.url && response.config.url.includes('/auth/login')) {
      isLoginFlow = false;
    }
    return response;
  },
  (error) => {
    // Handle 401 Unauthorized - but don't redirect during login attempts
    if (error.response?.status === 401) {
      // Only auto-redirect if we're not in a login flow
      if (!isLoginFlow) {
        localStorage.removeItem('access_token'); // Fixed: use access_token instead of token
        localStorage.removeItem('refresh_token'); // Fixed: use refresh_token instead of user
        localStorage.removeItem('user'); // Keep user removal for consistency
        window.location.href = '/login';
      } else {
        // Reset login flow flag for failed login attempts
        isLoginFlow = false;
      }
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
  UPDATE_PROFILE: '/auth/profile',
  CHANGE_PASSWORD: '/auth/change-password',
  ADD_HR_MANAGER: '/auth/add-hr-manager',
  ADD_HR_STAFF: '/auth/add-hr-staff',
  
  // User endpoints
  USERS: '/users',
  USER_BY_ID: (id) => `/users/${id}`,
  EMPLOYEES: '/users/employees',
  EMPLOYEE_BY_ID: (id) => `/users/employees/${id}`,
  
  // Document endpoints
  DOCUMENTS: '/documents',
  GET_TEMPLATE: (id) => `/documents/templates/${id}`,
  UPDATE_TEMPLATE: (id) => `/documents/templates/${id}`,
  GENERATE_DOCUMENT: '/documents/generate-document',
  TEMPLATES: '/documents/templates',
  CREATE_TEMPLATE: '/documents/templates',
  
  // Leave endpoints
  LEAVES: '/leaves',
  LEAVE_BY_ID: (id) => `/leaves/${id}`,
  LEAVE_REQUESTS: '/leaves/requests',
  LEAVE_TYPES: '/leaves/types',
  LEAVE_BALANCE: '/leaves/balance',
  LEAVE_BALANCE_RESET: (year) => `/leaves/reset-balances/${year}`,
  LEAVE_CLEANUP_DUPLICATES: (employeeId) => `/leaves/cleanup-duplicates/${employeeId}`,
  LEAVE_BULK_CLEANUP: '/leaves/bulk-cleanup-duplicates',
  EMPLOYEE_LEAVE_REQUESTS: '/leaves/employee-requests',
  
  // Salary endpoints
  SALARY: '/salary',
  SALARY_BY_ID: (id) => `/salary/${id}`,
  SALARY_SLIPS: '/salary/my-slips',
  SALARY_REGENERATE: '/salary/regenerate',
  
  // Working days endpoints
  WORKING_DAYS: '/working-days',
  WORKING_DAYS_CONFIG: '/working-days/config',
  WORKING_DAYS_CALCULATE: '/working-days/calculate',
  
  // Company calendar endpoints
  COMPANY_CALENDAR: '/company-calendar',
  COMPANY_CALENDAR_EVENTS: '/company-calendar/events',
  COMPANY_CALENDAR_EVENTS_RANGE: '/company-calendar/events/range',
  
  // Team management endpoints
  TEAM_LEAD: '/team-lead',
  HR_MANAGER: '/hr-manager',
};

// Helper function to get API base URL
const getApiBaseUrl = () => {
  // Always check current environment dynamically
  const currentHostname = window.location.hostname;
  const isVercel = currentHostname.includes('vercel.app');
  const isLocalhost = currentHostname === 'localhost' || currentHostname === '127.0.0.1';
  
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  
  // If on Vercel or any non-localhost domain, use relative path
  if (isVercel || !isLocalhost) {
    return '/api';
  }
  
  // Only use localhost for actual localhost
  return 'http://localhost:3000/api';
};

// Enhanced API service with better error handling and logging
export const apiService = {
  // Generic GET request
  get: (endpoint, config = {}) => {
    const baseUrl = getApiBaseUrl();
    const url = `${baseUrl}${endpoint}`;
    return api.get(url, config);
  },
  
  // Generic POST request
  post: (endpoint, data = {}, config = {}) => {
    const baseUrl = getApiBaseUrl();
    const url = `${baseUrl}${endpoint}`;
    return api.post(url, data, config);
  },
  
  // Generic PUT request
  put: (endpoint, data = {}, config = {}) => {
    const baseUrl = getApiBaseUrl();
    const url = `${baseUrl}${endpoint}`;
    return api.put(url, data, config);
  },
  
  // Generic DELETE request
  delete: (endpoint, config = {}) => {
    const baseUrl = getApiBaseUrl();
    const url = `${baseUrl}${endpoint}`;
    return api.delete(url, config);
  },
  
  // File upload
  upload: (endpoint, formData, config = {}) => {
    const baseUrl = getApiBaseUrl();
    const url = `${baseUrl}${endpoint}`;
    return api.post(url, formData, {
      ...config,
      headers: {
        ...config.headers,
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  
  // Helper method to get full URL
  getUrl: (endpoint) => {
    const baseUrl = getApiBaseUrl();
    const url = `${baseUrl}${endpoint}`;
    return url;
  },
};

// Health check function
export const healthCheck = async () => {
  try {
    const baseUrl = getApiBaseUrl().replace('/api', '');
    const response = await axios.get(`${baseUrl}/health`);
    return response.data;
  } catch (error) {
    console.error('Health check failed:', error);
    return { status: 'error', message: error.message };
  }
};

// Simple API test function
export const testApi = async () => {
  try {
    // Test a simple GET request
    const testUrl = `${getApiBaseUrl()}/health`;
    
    const response = await axios.get(testUrl);
    return { success: true, data: response.data };
  } catch (error) {
    console.error('❌ API test failed:', error);
    console.error('❌ Error details:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      url: error.config?.url
    });
    return { success: false, error: error.message };
  }
};

export default api;
export { getApiBaseUrl };