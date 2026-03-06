// src/pages/Login.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../services/api';
import { Lock, Mail, Car } from 'lucide-react';

/**
 * Login Component
 * Handles user authentication for the Admin Dashboard.
 * Includes Role-Based Access Control (RBAC) to ensure only administrators can log in.
 */
const Login = () => {
  // --- Local State Management ---
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Navigation hook for redirecting after successful login
  const navigate = useNavigate();

  /**
   * Handles the form submission for authentication.
   * Validates credentials against the API and checks for admin privileges.
   * * @param {Event} e - The form submission event
   */
  const handleLogin = async (e) => {
    e.preventDefault(); // Prevent default form submission behavior
    
    // Reset previous errors and set loading state
    setError('');
    setLoading(true);

    // Attempt to authenticate the user via the API
    const result = await login(email, password);

    if (result.success) {
      // Role-Based Access Control (RBAC) Check
      // Ensure the authenticated user possesses administrative privileges
      if (result.user.role === 'admin') {
        navigate('/'); // Authentication successful, redirect to dashboard
      } else {
        // User is authenticated but lacks admin rights
        setError('Access Denied: Admin privileges required.');
        localStorage.clear(); // Clear any partial session data
      }
    } else {
      // Authentication failed (e.g., wrong password, user not found)
      setError(result.error || 'Login failed. Please check your credentials.');
    }
    
    setLoading(false);
  };

  return (
    <div className="login-container">
      <div className="login-card">
        
        {/* --- Header & Logo Section --- */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '20px' }}>
          <Car size={48} color="#081e39ff" />
          <h1 style={{ margin: '10px 0', color: '#081e39ff' }}>PatrolVision</h1>
          <p style={{ color: '#6b7280' }}>Admin Dashboard</p>
        </div>

        {/* --- Authentication Form --- */}
        <form onSubmit={handleLogin}>
          
          {/* Email Input Field */}
          <div className="input-group">
            <label style={{ fontWeight: 'bold', fontSize: '14px' }}>Email</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Mail size={18} style={{ position: 'absolute', left: '10px', color: '#9ca3af' }} />
              <input
                type="email"
                className="input-field"
                style={{ paddingLeft: '35px' }}
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Password Input Field */}
          <div className="input-group">
            <label style={{ fontWeight: 'bold', fontSize: '14px' }}>Password</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Lock size={18} style={{ position: 'absolute', left: '10px', color: '#9ca3af' }} />
              <input
                type="password"
                className="input-field"
                style={{ paddingLeft: '35px' }}
                placeholder="••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Error Message Display */}
          {error && <div className="error-msg">{error}</div>}

          {/* Submit Button */}
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Verifying...' : 'Login'}
          </button>
          
        </form>
      </div>
    </div>
  );
};

export default Login;