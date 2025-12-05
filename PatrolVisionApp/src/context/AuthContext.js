import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {loginUser, registerUser} from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

 // Check if user is logged in
  const isLoggedIn = !!token;

  useEffect(() => {
    const loadStorageData = async () => {
      try {
        const storedToken = await AsyncStorage.getItem('usertoken');
        const storedUser = await AsyncStorage.getItem('userInfo');
        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
          console.log('✅ Loaded user from storage:', JSON.parse(storedUser).firstName);
        }
      } catch (e) {
        console.log('❌ Failed to load user from storage', e);
      } finally {
        setIsLoading(false);
      }
    };

    loadStorageData();
  }, []);

  const saveAuthState = async (token, user) => {
    try {
      await AsyncStorage.setItem('usertoken', token);
      await AsyncStorage.setItem('userInfo', JSON.stringify(user));
      console.log('✅ Saved user to storage:', user.firstName);
    } catch (e) {
      console.log('❌ Failed to save user to storage', e);
    }
  };
  const clearAuthState = async () => {
    try {
      await AsyncStorage.removeItem('usertoken');
      await AsyncStorage.removeItem('userInfo');
      console.log('✅ Cleared user from storage');
    } catch (e) {
      console.log('❌ Failed to clear user from storage', e);
    }
  };

  // --- Login Function ---
  const login = async (email, password) => {
    setIsLoading(true);
    
    // Call the loginUser function from api.js
    const result = await loginUser(email, password);
    
    // Check the result
    if (result.success) {
      setToken(result.data.token);
      setUser(result.data.user);
      console.log('Login Successful:', result.data.user.firstName);
      await saveAuthState(result.data.token, result.data.user);
      setIsLoading(false);
      return { success: true };
    } else {
      //Return the error message
      console.log('Login Failed:', result.error);
      setIsLoading(false);
      return { success: false, error: result.error };
    }
  };
// --- Registration Function ---
  const register = async (userData) => {
    setIsLoading(true);
    const result = await registerUser(userData);
    
    // Check the result
    if (result.success) {
      console.log('✅ Register Context: Success!', result.data.user.firstName);
      
      setToken(result.data.token);
      setUser(result.data.user);
      await saveAuthState(result.data.token, result.data.user);
      
      setIsLoading(false);
      return { success: true };
    } else {
      console.log('❌ Register Context: Failed', result.error);
      setIsLoading(false);
      return { success: false, error: result.error };
    }
  };
// --- Logout Function ---
  const logout = () => {
    setToken(null);
    setUser(null);
    clearAuthState();
    console.log('👋 User logged out');
  };

  return (
    <AuthContext.Provider value={{ 
      isLoggedIn, 
      user, 
      token, 
      isLoading,
      login, 
      register, 
      logout 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};