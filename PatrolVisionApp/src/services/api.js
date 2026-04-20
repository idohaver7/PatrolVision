// src/services/api.js
import axios from 'axios';
import RNFS from 'react-native-fs';

// ⚠️ IMPORTANT: Ensure this IP matches your computer's IP via 'ipconfig'
export const SERVER_URL = 'http://192.168.1.35:5000'; 
const BASE_URL = 'http://192.168.1.35:5000/api'; 
const FASTAPI_URL = 'https://idohaver7-patrolvision.hf.space/analyze_batch';

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// --- Helper Function to handle Axios errors safely ---

// --- Helper Function to handle Axios errors safely ---
const handleApiError = (error) => {
  let errorMessage = 'An unexpected error occurred';

  if (error.response) {
    errorMessage = error.response.data?.error || 'Server Error';
    console.log('❌ [API] Server responded with error:', error.response.status, error.response.data);
  } else if (error.request) {
    errorMessage = 'No communication with the server. Check your internet connection.';
    console.log('❌ [API] No response received. Code:', error.code, 'Message:', error.message);
  } else {
    errorMessage = error.message;
    console.log('❌ [API] Request setup error:', error.message);
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
export const warmupAnalysisServer = async () => {
  try {
    await axios.post(FASTAPI_URL, new FormData(), {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 90000,
    });
  } catch (e) {
    // server might return an error (e.g. empty batch), but as long as it responded it's warm
  }
};

export const analyzeTrafficFrame = async (imageUris,signal) => {
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
      signal: signal, // Pass the AbortSignal for cancellation
    });
    console.log("✅ [API] Server responded with status:", response.status);
    console.log("📦 [API] Server data:", response.data);
    return { success: true, data: response.data };
  } catch (error) {
      if(axios.isCancel(error)) {
        console.log("⚠️ [API] Request was cancelled by the client.");
        return { success: false, error: "Request cancelled" };
      }
      else if (error.response) {
        console.log("❌ Server Error Data:", error.response.data);
        console.log("❌ Server Error Status:", error.response.status);
      } else if (error.request) {
        console.log("❌ Network/Timeout Error - No response received. Code: ${error.code}, Message: ${error.message}");
      } else {
        console.log("❌ Error:", error.message);
      }
      return { success: false, error: error.message };
    }
};

export const reportViolation = async (token, violationData) => {
  const reportUrl = `${BASE_URL}/violations`;
  const startedAt = Date.now();
  console.log('\n📮 [reportViolation] Starting report...');
  console.log('   → URL:', reportUrl);
  console.log('   → imageUri:', violationData.imageUri);
  console.log('   → type:', violationData.violationType, '| plate:', violationData.licensePlate);
  console.log('   → lat/lng:', violationData.latitude, violationData.longitude);
  console.log('   → token length:', token ? token.length : 'NO_TOKEN');

  // File existence / size pre-flight
  try {
    const cleanPath = (violationData.imageUri || '').replace('file://', '');
    const exists = await RNFS.exists(cleanPath);
    console.log('   → file exists:', exists, 'at', cleanPath);
    if (exists) {
      const stat = await RNFS.stat(cleanPath);
      console.log('   → file size:', stat.size, 'bytes, mtime:', stat.mtime);
    }
  } catch (statErr) {
    console.log('   ⚠️ File preflight failed:', statErr.message);
  }

  const buildFormData = () => {
    const fd = new FormData();
    fd.append('violationType', violationData.violationType);
    fd.append('licensePlate', violationData.licensePlate);
    fd.append('latitude', violationData.latitude);
    fd.append('longitude', violationData.longitude);
    fd.append('image', {
      uri: violationData.imageUri,
      type: 'image/jpeg',
      name: 'evidence.jpg',
    });
    return fd;
  };

  const doPost = async (attempt) => {
    const t0 = Date.now();
    console.log(`   🚀 Posting multipart (attempt ${attempt})...`);
    const response = await api.post('/violations', buildFormData(), {
      headers: {
        'Content-Type': 'multipart/form-data',
        'Authorization': `Bearer ${token}`,
        'Connection': 'close',
      },
      timeout: 15000,
    });
    console.log(`   ✅ Reported in ${Date.now() - t0}ms, status:`, response.status);
    return response;
  };

  try {
    let response;
    try {
      response = await doPost(1);
    } catch (err) {
      if (err.code === 'ERR_NETWORK' && !err.response) {
        console.log('   ♻️ ERR_NETWORK on attempt 1 — likely stale socket, retrying...');
        await new Promise(r => setTimeout(r, 300));
        response = await doPost(2);
      } else {
        throw err;
      }
    }
    console.log("api.js: Violation reported successfully:", response.data);
    return { success: true, data: response.data };
  } catch (error) {
    console.log(`   ❌ reportViolation failed after ${Date.now() - startedAt}ms`);
    console.log('      code:', error.code, '| message:', error.message);
    if (error.response) {
      console.log('      response.status:', error.response.status);
      console.log('      response.data:', error.response.data);
    } else if (error.request) {
      console.log('      request sent but no response — likely LAN/DNS/connectivity to', reportUrl);
    }
    return handleApiError(error);
  }
};


export const fetchViolationById = async (token, id) => {
  try {
    const response = await api.get(`/violations/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return { success: true, data: response.data.data };
  } catch (error) {
    return handleApiError(error);
  }
};

export default api;