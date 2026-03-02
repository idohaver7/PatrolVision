// src/pages/Dashboard.jsx
import React, { useEffect, useState, useMemo } from 'react';
import { getAnalytics, getAllViolations, updateViolationStatus, logout } from '../services/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { CheckCircle, XCircle, LogOut, CheckSquare, Ban, Search, Map as MapIcon, List as ListIcon, LayoutDashboard, AlertTriangle, Inbox, User } from 'lucide-react'; // הוספתי אייקון User
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';

// --- Colors ---
const VIOLATION_COLORS = {
  'Red Light Violation': '#ef4444',
  'Illegal Overtaking': '#f59e0b',
  'Wrong Way Driving': '#b91c1c',
  'Illegal Parking': '#3b82f6',
  'Illegal Turn': '#8b5cf6',
  'Other': '#6b7280'
};

const VIOLATION_TYPES = ['All Types', 'Red Light Violation', 'Illegal Overtaking', 'Wrong Way Driving', 'Illegal Parking', 'Illegal Turn'];

const Dashboard = () => {
  const [allViolations, setAllViolations] = useState([]); 
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // --- משתנה לשם האדמין ---
  const [adminName, setAdminName] = useState('Admin');

  const [currentTab, setCurrentTab] = useState('Pending Review');
  const [viewMode, setViewMode] = useState('list');
  const [searchText, setSearchText] = useState('');
  const [filterType, setFilterType] = useState('All Types');

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. שליפת שם המשתמש מהזכרון המקומי
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        setAdminName(user.firstName || 'Admin');
      }

      // 2. טעינת נתונים מהשרת
      const [statsData, violationsData] = await Promise.all([
        getAnalytics(),
        getAllViolations({ limit: 1000 })
      ]);
      setStats(statsData.data);
      setAllViolations(violationsData.data);
    } catch (error) {
      console.error("Error loading data", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // --- מנגנון סינון וחיפוש ---
  const filteredViolations = useMemo(() => {
    return allViolations.filter(v => {
      const matchesTab = v.status === currentTab;
      
      const query = searchText.toLowerCase();
      const plate = v.licensePlate?.toLowerCase() || '';
      const address = v.address?.toLowerCase() || '';
      const type = v.violationType?.toLowerCase() || '';
      const userName = v.user ? `${v.user.firstName || ''} ${v.user.lastName || ''}`.toLowerCase() : '';
      
      const matchesSearch = 
        plate.includes(query) || 
        address.includes(query) || 
        userName.includes(query) ||
        type.includes(query);

      const matchesType = filterType === 'All Types' || v.violationType === filterType;

      return matchesTab && matchesSearch && matchesType;
    });
  }, [allViolations, currentTab, searchText, filterType]);

  const handleStatusChange = async (id, newStatus) => {
    if (!window.confirm(`Mark as ${newStatus}?`)) return;
    setAllViolations(prev => prev.map(v => v._id === id ? { ...v, status: newStatus } : v));
    try {
      await updateViolationStatus(id, newStatus);
      const newStats = await getAnalytics();
      setStats(newStats.data);
    } catch (error) {
      console.error("Failed", error);
      loadData();
    }
  };

  if (loading) return <div className="p-10 text-center text-gray-500">Loading PatrolVision Dashboard...</div>;

  return (
    <div className="dashboard-container">
      
      {/* --- Header --- */}
      <div className="header-bar">
        {/* צד שמאל: לוגו */}
        <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
            <LayoutDashboard size={36} className="text-blue-600" style={{color: '#11101d'}} />
            <div>
              <h1 className="header-title" style={{margin: 0, lineHeight: 1}}>PatrolVision</h1>
              <span style={{fontSize: '0.9rem', color: '#6b7280'}}>Command & Control Center</span>
            </div>
        </div>

        {/* צד ימין: ברכה וכפתור יציאה */}
        <div style={{display: 'flex', alignItems: 'center', gap: '20px'}}>
            <div style={{display: 'flex', alignItems: 'center', gap: '8px', background: 'white', padding: '8px 16px', borderRadius: '30px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)'}}>
                <div style={{background: '#e0e7ff', padding: '6px', borderRadius: '50%', color: '#3730a3'}}>
                    <User size={18} />
                </div>
                <span style={{fontWeight: '600', color: '#374151', fontSize: '0.95rem'}}>
                    Hello, {adminName} 👋
                </span>
            </div>

            <button onClick={logout} className="btn btn-danger">
              <LogOut size={18} /> Logout
            </button>
        </div>
      </div>

      {/* --- Stats Row --- */}
      <div className="stats-grid">
        <StatCard 
          title="Total Reports" 
          value={stats?.totalViolations || 0} 
          icon={<ListIcon size={40} opacity={0.15} />} 
          color="#3b82f6" 
        />
        <StatCard 
          title="Pending Action" 
          value={stats?.statusStats.find(s => s._id === 'Pending Review')?.count || 0} 
          icon={<AlertTriangle size={40} opacity={0.15} />} 
          color="#eab308" 
        />
        <StatCard 
          title="Verified Closed" 
          value={stats?.statusStats.find(s => s._id === 'Verified')?.count || 0} 
          icon={<CheckCircle size={40} opacity={0.15} />} 
          color="#22c55e" 
        />
      </div>

      {/* --- Toolbar --- */}
      <div className="toolbar">
        <div className="filter-group">
            <TabButton label="Inbox" count={stats?.statusStats.find(s => s._id === 'Pending Review')?.count} isActive={currentTab === 'Pending Review'} onClick={() => setCurrentTab('Pending Review')} icon={<Inbox size={16}/>} />
            <TabButton label="Approved" isActive={currentTab === 'Verified'} onClick={() => setCurrentTab('Verified')} icon={<CheckSquare size={16}/>} />
            <TabButton label="Rejected" isActive={currentTab === 'Rejected'} onClick={() => setCurrentTab('Rejected')} icon={<Ban size={16}/>} />
        </div>

        <div className="filter-group">
            <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', top: '50%', left: '10px', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                <input 
                  type="text" 
                  placeholder="Search plate, user, location..." 
                  className="modern-input" 
                  style={{width: '220px'}}
                  value={searchText} 
                  onChange={(e) => setSearchText(e.target.value)} 
                />
            </div>
            <select className="modern-select" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                {VIOLATION_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
            </select>
            <button onClick={() => setViewMode(viewMode === 'list' ? 'map' : 'list')} className="btn btn-primary">
                {viewMode === 'list' ? <><MapIcon size={18} /> Map View</> : <><ListIcon size={18} /> List View</>}
            </button>
        </div>
      </div>

      {/* --- Main Content --- */}
      <div style={{ display: 'grid', gridTemplateColumns: viewMode === 'map' ? '1fr' : '3fr 1fr', gap: '2rem' }}>
        
        {/* Left Column: Data */}
        <div className="content-card" style={{ minHeight: '600px' }}>
            
            {/* MAP VIEW */}
            {viewMode === 'map' && (
                <div style={{ height: '700px', width: '100%' }}>
                    <MapContainer center={[32.0853, 34.7818]} zoom={9} style={{ height: '100%', width: '100%' }}>
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' />
                        {filteredViolations.map((v) => (
                            v.location && (
                            <Marker key={v._id} position={[v.location.coordinates[1], v.location.coordinates[0]]}>
                                <Popup>
                                    <div style={{ textAlign: 'center' }}>
                                        <img src={v.mediaUrl} alt="Evidence" style={{width: '100%', borderRadius: '4px', marginBottom: '5px'}} />
                                        <strong>{v.violationType}</strong><br/>
                                        <div style={{fontSize: '0.9rem', color: '#666', margin: '5px 0'}}>{v.address || 'GPS Location'}</div>
                                        {v.licensePlate}
                                    </div>
                                </Popup>
                            </Marker>
                            )
                        ))}
                    </MapContainer>
                </div>
            )}

            {/* LIST VIEW */}
            {viewMode === 'list' && (
                <>
                 <div className="content-header">
                    <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold', margin: 0 }}>
                        {currentTab === 'Pending Review' ? 'Inbox: Pending Review' : `${currentTab} History`}
                    </h2>
                    <span style={{ background: '#e5e7eb', padding: '4px 10px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold' }}>{filteredViolations.length} Items</span>
                 </div>
                 
                 {filteredViolations.length === 0 ? (
                    <div style={{ padding: '60px', textAlign: 'center', color: '#9ca3af' }}>No violations found.</div>
                 ) : (
                    <table className="modern-table">
                        <thead>
                            <tr>
                                <th style={{width: '100px'}}>Evidence</th>
                                <th>Date</th>
                                <th>Type</th>
                                <th>Location</th>
                                <th>Plate</th>
                                <th>User</th>
                                {currentTab === 'Pending Review' && <th>Actions</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredViolations.map((v) => (
                                <tr key={v._id}>
                                    <td>
                                      <a href={v.mediaUrl} target="_blank" rel="noopener noreferrer">
                                        <img 
                                          src={v.mediaUrl} 
                                          alt="Evidence" 
                                          className="violation-thumb" 
                                          onError={(e) => e.target.src = 'https://via.placeholder.com/80?text=Error'} 
                                        />
                                      </a>
                                    </td>
                                    
                                    <td style={{whiteSpace: 'nowrap'}}>{new Date(v.timestamp).toLocaleDateString()}</td>
                                    
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: VIOLATION_COLORS[v.violationType] || '#ccc', flexShrink: 0 }}></div>
                                            {v.violationType}
                                        </div>
                                    </td>

                                    <td style={{maxWidth: '180px'}} title={v.address}>
                                        <div style={{whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#4b5563'}}>
                                          {v.address || `${v.location?.coordinates[1].toFixed(3)}, ${v.location?.coordinates[0].toFixed(3)}`}
                                        </div>
                                    </td>

                                    <td><span style={{ fontFamily: 'monospace', background: '#f3f4f6', padding: '4px 8px', borderRadius: '6px', fontWeight: 'bold' }}>{v.licensePlate}</span></td>
                                    
                                    <td>
                                        <div style={{ fontWeight: '500' }}>{v.user?.firstName} {v.user?.lastName}</div>
                                        <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>{v.user?.phoneNumber}</div>
                                    </td>
                                    
                                    {currentTab === 'Pending Review' && (
                                        <td>
                                            <div style={{ display: 'flex', gap: '10px' }}>
                                                <button onClick={() => handleStatusChange(v._id, 'Verified')} className="btn" style={{ padding: '8px', background: '#dcfce7', color: '#166534' }} title="Approve">
                                                    <CheckCircle size={20} />
                                                </button>
                                                <button onClick={() => handleStatusChange(v._id, 'Rejected')} className="btn" style={{ padding: '8px', background: '#fee2e2', color: '#991b1b' }} title="Reject">
                                                    <XCircle size={20} />
                                                </button>
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                 )}
                </>
            )}
        </div>

        {/* Right Column: Chart */}
        {viewMode === 'list' && (
            <div className="content-card">
                <div className="content-header">
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 'bold' }}>Analytics</h3>
                </div>
                <div style={{ height: '350px', padding: '1rem' }}>
                    <ResponsiveContainer>
                        <BarChart data={stats?.typeStats}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                            <XAxis dataKey="_id" hide />
                            <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                            <Tooltip cursor={{ fill: '#f3f4f6' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                            <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                                {stats?.typeStats?.map((entry, index) => <Cell key={`cell-${index}`} fill={VIOLATION_COLORS[entry._id] || '#ccc'} />)}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '10px', fontSize: '0.8rem' }}>
                        {stats?.typeStats?.map((entry) => (
                            <div key={entry._id} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: VIOLATION_COLORS[entry._id] || '#ccc' }}></div>
                                <span style={{ color: '#6b7280' }}>{entry._id}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}

      </div>
    </div>
  );
};

// --- Components ---
const StatCard = ({ title, value, icon, color }) => (
    <div className="stat-card" style={{ borderLeft: `5px solid ${color}` }}>
      <div>
        <div className="stat-title">{title}</div>
        <div className="stat-value">{value}</div>
      </div>
      <div style={{ color: color, alignSelf: 'flex-end' }}>{icon}</div>
    </div>
);

const TabButton = ({ label, count, isActive, onClick, icon }) => (
    <button onClick={onClick} style={{ padding: '8px 16px', border: 'none', background: isActive ? '#11101d' : 'transparent', color: isActive ? 'white' : '#6b7280', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '8px' }}>
        {icon} {label}
        {count !== undefined && <span style={{ background: isActive ? 'rgba(255,255,255,0.2)' : '#e5e7eb', color: isActive ? 'white' : '#374151', padding: '2px 8px', borderRadius: '10px', fontSize: '0.75rem' }}>{count}</span>}
    </button>
);

export default Dashboard;