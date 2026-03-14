// src/services/api.js
import axios from 'axios';

// ⚠️ IMPORTANT: Ensure this IP matches your computer's IP via 'ipconfig'
export const SERVER_URL = 'http://192.168.1.64:5000'; 
const BASE_URL = 'http://192.168.1.64:5000/api'; 
const FASTAPI_URL = 'https://idohaver7-patrolvision.hf.space/analyze_batch';

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
export const analyzeTrafficFrame = async (imageUris) => {
  try {
    console.log(`\n📤 [API] Preparing to send batch of ${imageUris.length} frames...`);
    console.log(`🔗 [API] Target URL: ${FASTAPI_URL}`);
    const formData = new FormData();
    imageUris.forEach((uri, index) => {
      formData.append('files', {
        uri: uri,
        type: 'image/jpeg',
        name: 'frame_${index}.jpg',
      });
    });

    console.log("🚀 [API] Sending POST request to server NOW...");
    //Sending to FastAPI server for analysis
    const response = await axios.post(FASTAPI_URL, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 10000, // Timeout 
    });
    console.log("✅ [API] Server responded with status:", response.status);
    console.log("📦 [API] Server data:", response.data);
    return { success: true, data: response.data };
  } catch (error) {
    console.error("❌ [API] Request FAILED:", error.message);
    console.log("FastAPI Error:", error.message);
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