// src/services/api.js
import axios from 'axios';

// --- Global Configuration ---
// The base URL of the Node.js backend server
const API_URL = 'http://localhost:5000/api';

/**
 * Axios Instance Setup
 * Pre-configures the base URL and default headers for all HTTP requests.
 */
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Request Interceptor
 * Automatically injects the JWT (JSON Web Token) into the Authorization header
 * of every outgoing request if a user is logged in.
 */
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ==========================================
// --- API Core Functions ---
// ==========================================

/**
 * Authenticates a user against the backend.
 * Upon success, stores the JWT and user details in local storage.
 * * @param {string} email - The user's email address
 * @param {string} password - The user's password
 * @returns {Promise<Object>} The API response containing user data or an error message
 */
export const login = async (email, password) => {
  try {
    const response = await api.post('/auth/login', { email, password });
    if (response.data.success) {
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }
    return response.data;
  } catch (error) {
    const errorMsg = error.response?.data?.error || 'Login failed';
    return { success: false, error: errorMsg };
  }
};

/**
 * Terminates the user session by clearing local storage 
 * and redirecting the application to the login page.
 */
export const logout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/login';
};

/**
 * Retrieves statistical data for the dashboard (e.g., total violations, status breakdown).
 * * @returns {Promise<Object>} An object containing analytics data
 */
export const getAnalytics = async () => {
  try {
    const response = await api.get('/violations/analytics');
    return response.data; // Server returns { success: true, data: {...} }
  } catch (error) {
    console.error("Failed to fetch analytics:", error);
    return { success: false, data: null };
  }
};

/**
 * Fetches all violations from the database.
 * Supports dynamic filtering, sorting, and pagination via query parameters.
 * * @param {Object} filters - Optional query parameters (e.g., status, type, page, limit)
 * @returns {Promise<Object>} An object containing an array of violations
 */
export const getAllViolations = async (filters = {}) => {
  try {
    const params = new URLSearchParams(filters).toString();
    const response = await api.get(`/violations?${params}`);
    return response.data; // Server returns { success: true, data: [...] }
  } catch (error) {
    console.error("Failed to fetch violations:", error);
    return { success: false, data: [] };
  }
};

/**
 * Updates the administrative status of a specific violation.
 * * @param {string} id - The unique identifier of the violation
 * @param {string} status - The new status ('Pending Review', 'Verified', or 'Rejected')
 * @returns {Promise<Object>} The updated violation document
 */
export const updateViolationStatus = async (id, status) => {
  try {
    const response = await api.put(`/violations/${id}`, { status });
    return response.data;
  } catch (error) {
    console.error(`Failed to update status for violation ${id}:`, error);
    return { success: false };
  }
};

/**
 * Performs a manual override of the ALPR system by updating the license plate.
 * * @param {string} id - The unique identifier of the violation
 * @param {string} licensePlate - The manually verified license plate number
 * @returns {Promise<Object>} The updated violation document
 */
export const updateViolationPlate = async (id, licensePlate) => {
  try {
    const response = await api.put(`/violations/${id}`, { licensePlate });
    return response.data;
  } catch (error) {
    console.error(`Failed to update plate for violation ${id}:`, error);
    return { success: false };
  }
};

export default api;