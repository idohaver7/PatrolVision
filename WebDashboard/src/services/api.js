// src/services/api.js
import axios from 'axios';

// The URL of your Node.js server
const API_URL = 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add Token to every request automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// --- API Functions ---

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

export const logout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/login';
};

export const getAnalytics = async () => {
  try {
    const response = await api.get('/violations/analytics');
    return response.data; // Server returns { success: true, data: {...} }
  } catch (error) {
    console.error(error);
    return { success: false, data: null };
  }
};

export const getAllViolations = async (filters = {}) => {
  try {
    const params = new URLSearchParams(filters).toString();
    const response = await api.get(`/violations?${params}`);
    return response.data; // Server returns { success: true, data: [...] }
  } catch (error) {
    console.error(error);
    return { success: false, data: [] };
  }
};

export const updateViolationStatus = async (id, status) => {
  try {
    const response = await api.put(`/violations/${id}`, { status });
    return response.data;
  } catch (error) {
    console.error(error);
    return { success: false };
  }
};

export default api;