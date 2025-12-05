// src/services/api.js
import axios from 'axios';

// ⚠️ IMPORTANT: Ensure this IP matches your computer's IP via 'ipconfig'
const BASE_URL = 'http://192.168.1.36:5000/api'; 

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// --- Helper Function to handle Axios errors safely ---
const handleApiError = (error) => {
  let errorMessage = 'An unexpected error occurred';

  if (error.response) {
    // The request was made and the server responded with a status code
    // that falls out of the range of 2xx
    
    // Use the custom error message sent from the server (e.g., "User already exists")
    errorMessage = error.response.data?.error || 'Server Error';
    
  } else if (error.request) {
    // The request was made but no response was received
    errorMessage = 'No communication with the server. Check your internet connection.';
  } else {
    // Something happened in setting up the request that triggered an Error
    errorMessage = error.message;
  }

  return { success: false, error: errorMessage };
};

// --- Auth Services ---

export const loginUser = async (email, password) => {
  try {
    const response = await api.post('/auth/login', { email, password });
    // Return success object with the server data (token, user info)
    return { success: true, data: response.data };
  } catch (error) {
    return handleApiError(error);
  }
};

export const registerUser = async (userData) => {
  try {
    const response = await api.post('/auth/register', userData);
    // Return success object
    return { success: true, data: response.data };
  } catch (error) {
    return handleApiError(error);
  }
};

// --- Violation Services ---

export const fetchViolations = async (token, params = {}) => {
  try {
    const response = await api.get('/violations', {
      headers: { Authorization: `Bearer ${token}` },
      params: params, 
    });
    return { success: true, data: response.data };
  } catch (error) {
    return handleApiError(error);
  }
};

// We can add reportViolation here later when we connect the camera

export default api;