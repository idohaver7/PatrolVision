// src/services/api.js
import axios from 'axios';

// ⚠️ IMPORTANT: Ensure this IP matches your computer's IP via 'ipconfig'
const BASE_URL = 'http://192.168.1.36:5000/api'; 
const FLASK_URL = 'http://192.168.1.36:6000/analyze';

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
// --- Traffic Enforcement Services ---
export const analyzeTrafficFrame = async (imageUri) => {
  try {
    const formData = new FormData();
    formData.append('frame', {
      uri: imageUri,
      type: 'image/jpeg',
      name: 'frame.jpg',
    });

    //Sending to Flask server for analysis
    const response = await axios.post(FLASK_URL, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 3000, // Timeout 
    });

    return { success: true, data: response.data };
  } catch (error) {
    console.log("Flask Error:", error.message);
    return { success: false, error: error.message };
  }
};

export const reportViolation = async (token, violationData) => {
  try {
    const formData = new FormData();
    formData.append('violationType', violationData.violationType);
    formData.append('licensePlate', violationData.licensePlate);
    formData.append('latitude', violationData.latitude);
    formData.append('longitude', violationData.longitude);
    
    // Append the original image as evidence
    formData.append('image', {
      uri: violationData.imageUri,
      type: 'image/jpeg',
      name: 'evidence.jpg',
    });

    const response = await api.post('/violations', formData, {
      headers: { 
        'Content-Type': 'multipart/form-data',
        'Authorization': `Bearer ${token}` 
      },
    });

    return { success: true, data: response.data };
  } catch (error) {
    return handleApiError(error);
  }
};


export default api;