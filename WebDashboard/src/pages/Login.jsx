// src/pages/Login.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../services/api';
import { Lock, Mail, Car } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(email, password);

    if (result.success) {
      if (result.user.role === 'admin') {
        navigate('/'); // Success! Go to dashboard
      } else {
        setError('Access Denied: Admin privileges required.');
        localStorage.clear();
      }
    } else {
      setError(result.error || 'Login failed');
    }
    setLoading(false);
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '20px' }}>
          <Car size={48} color="#081e39ff" />
          <h1 style={{ margin: '10px 0', color: '#081e39ff' }}>PatrolVision</h1>
          <p style={{ color: '#6b7280' }}>Admin Dashboard</p>
        </div>

        <form onSubmit={handleLogin}>
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

          {error && <div className="error-msg">{error}</div>}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Verifying...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;