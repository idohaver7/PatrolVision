// src/pages/Dashboard.jsx
import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import { getAnalytics, getAllViolations, updateViolationStatus, updateViolationPlate, logout } from '../services/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { CheckCircle, XCircle, LogOut, CheckSquare, Ban, Search, Map as MapIcon, List as ListIcon, LayoutDashboard, AlertTriangle, Inbox, User, ChevronLeft, ChevronRight, X, Bell } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';

const SOCKET_URL = 'http://localhost:5000';

// --- Global Constants & Configurations ---
const VIOLATION_COLORS = {
  'Red Light Violation': '#ef4444',
  'Illegal Overtaking': '#f59e0b',
  'Public Lane Violation': '#8b5cf6'
};

const VIOLATION_TYPES = ['All Types', 'Public Lane Violation', 'Red Light Violation', 'Illegal Overtaking'];

const Dashboard = () => {
  // --- Data & Loading States ---
  const [allViolations, setAllViolations] = useState([]); 
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // --- User Session State ---
  const [adminName, setAdminName] = useState('Admin');

  // --- UI & Filtering States ---
  const [currentTab, setCurrentTab] = useState('Pending Review');
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'map'
  const [searchText, setSearchText] = useState('');
  const [filterType, setFilterType] = useState('All Types');

  // --- Pagination States ---
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // --- Modal States: Master-Detail View & ALPR Manual Override ---
  const [editingViolation, setEditingViolation] = useState(null);
  const [newPlate, setNewPlate] = useState('');

  // --- Modal States: Custom Confirmation ---
  const [confirmAction, setConfirmAction] = useState({ isOpen: false, id: null, newStatus: '' });

  // --- Real-time Notification State ---
  const [toasts, setToasts] = useState([]);
  const toastTimeoutRef = useRef({});

  const addToast = useCallback((violation) => {
    const id = violation._id;
    setToasts(prev => [...prev, { id, violation, timestamp: Date.now() }]);
    // Auto-dismiss after 8 seconds
    toastTimeoutRef.current[id] = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
      delete toastTimeoutRef.current[id];
    }, 8000);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    if (toastTimeoutRef.current[id]) {
      clearTimeout(toastTimeoutRef.current[id]);
      delete toastTimeoutRef.current[id];
    }
  }, []);

  // --- Socket.IO Connection ---
  useEffect(() => {
    const socket = io(SOCKET_URL);

    socket.on('newViolation', (violation) => {
      // Add the new violation to the list
      setAllViolations(prev => [violation, ...prev]);
      // Refresh analytics
      getAnalytics().then(res => setStats(res.data)).catch(console.error);
      // Show toast notification
      addToast(violation);
      // Play notification sound
      try {
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbsGczHjqIxN/LdEQiOYfE3slyQiE5h8Tey3JCITmHxN7LckIhOYfE3styQiE5h8Tey3JCITmHxN7LckIhOYfE3st');
        audio.volume = 0.3;
        audio.play().catch(() => {});
      } catch {}
    });

    return () => socket.disconnect();
  }, [addToast]);

  /**
   * Initializes dashboard data by fetching user details, analytics, and violation records.
   */
  const loadData = async () => {
    setLoading(true);
    try {
      // Retrieve locally stored user session
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        setAdminName(user.firstName || 'Admin');
      }

      // Fetch analytics and violations concurrently for performance
      const [statsData, violationsData] = await Promise.all([
        getAnalytics(),
        getAllViolations({ limit: 1000 })
      ]);
      setStats(statsData.data);
      setAllViolations(violationsData.data);
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch data on component mount
  useEffect(() => { 
    loadData(); 
  }, []);

  /**
   * Memoized filtering logic.
   * Re-evaluates only when violations data, current tab, or filter parameters change.
   */
  const filteredViolations = useMemo(() => {
    return allViolations.filter(v => {
      //  Filter by Status Tab
      const matchesTab = v.status === currentTab;
      
      // Filter by Search Query (Plate, Address, User Name, Type)
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

      //  Filter by Violation Type Dropdown
      const matchesType = filterType === 'All Types' || v.violationType === filterType;

      return matchesTab && matchesSearch && matchesType;
    });
  }, [allViolations, currentTab, searchText, filterType]);

  // Reset pagination to the first page whenever filters or tabs change
  useEffect(() => {
    setCurrentPage(1);
  }, [currentTab, searchText, filterType]);

  // --- Pagination Logic ---
  const totalPages = Math.ceil(filteredViolations.length / ITEMS_PER_PAGE);
  const paginatedViolations = filteredViolations.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  /**
   * Triggers the custom confirmation modal before executing a status change.
   */
  const handleStatusChange = (id, newStatus) => {
    setConfirmAction({ isOpen: true, id, newStatus });
  };

  /**
   * Executes the API call to update the violation status after user confirmation.
   */
  const executeStatusChange = async () => {
    const { id, newStatus } = confirmAction;
    
    // Close the confirmation modal
    setConfirmAction({ isOpen: false, id: null, newStatus: '' });

    // Close the Master-Detail review modal if it is currently open for this item
    if (editingViolation && editingViolation._id === id) {
        setEditingViolation(null);
    }

    // Optimistic UI update for immediate feedback
    setAllViolations(prev => prev.map(v => v._id === id ? { ...v, status: newStatus } : v));
    
    try {
      await updateViolationStatus(id, newStatus);
      // Refresh analytics to reflect the new status
      const newStats = await getAnalytics();
      setStats(newStats.data);
    } catch (error) {
      console.error("Failed to update status:", error);
      loadData(); // Revert UI on failure
    }
  };

  /**
   * Submits the manual ALPR (Automatic License Plate Recognition) override to the server.
   */
  const handleSavePlate = async () => {
    if (!editingViolation) return;
    
    // Optimistic UI update
    setAllViolations(prev => prev.map(v => 
      v._id === editingViolation._id ? { ...v, licensePlate: newPlate } : v
    ));
    setEditingViolation(prev => ({...prev, licensePlate: newPlate}));

    try {
      await updateViolationPlate(editingViolation._id, newPlate);
      // Close the modal silently upon success for a seamless user experience
      setEditingViolation(null);
    } catch (error) {
      console.error("Failed to update license plate:", error);
    }
  };

  /**
   * Opens the Master-Detail modal and populates it with the selected violation's data.
   */
  const openViolationDetails = (violation) => {
      setEditingViolation(violation);
      setNewPlate(violation.licensePlate !== 'null' && violation.licensePlate ? violation.licensePlate : '');
  };

  /**
   * Formats the media URL securely, ensuring proper local server routing if needed.
   */
  const getImageUrl = (url) => {
    if (!url) return 'https://via.placeholder.com/80?text=No+Image';
    if (url.startsWith('http')) return url;
    return `http://localhost:5000${url.startsWith('/') ? '' : '/'}${url}`; 
  };

  if (loading) return <div className="p-10 text-center text-gray-500">Loading PatrolVision Dashboard...</div>;

  return (
    <div className="dashboard-container">
      
      {/* --- Top Navigation Header --- */}
      <div className="header-bar">
        <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
            <LayoutDashboard size={36} className="text-blue-600" style={{color: '#11101d'}} />
            <div>
              <h1 className="header-title" style={{margin: 0, lineHeight: 1}}>PatrolVision</h1>
              <span style={{fontSize: '0.9rem', color: '#6b7280'}}>Command & Control Center</span>
            </div>
        </div>

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

      {/* --- KPI Statistics Row --- */}
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

      {/* --- Main Toolbar: Filters, Search, and View Toggles --- */}
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

      {/* --- Main Content Area --- */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* Data View: Map or List */}
        <div className="content-card">
            
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
                                        <img src={getImageUrl(v.mediaUrl)} alt="Evidence" style={{width: '100%', borderRadius: '4px', marginBottom: '5px', cursor: 'pointer'}} onClick={() => openViolationDetails(v)} onError={(e) => e.target.src = 'https://via.placeholder.com/80?text=Error'} />
                                        <strong>{v.violationType}</strong><br/>
                                        <div style={{fontSize: '0.9rem', color: '#666', margin: '5px 0'}}>{v.address || 'GPS Location'}</div>
                                        {v.licensePlate && v.licensePlate !== 'null' ? v.licensePlate : 'N/A'}
                                        <button className="btn btn-primary" style={{marginTop: '10px', width: '100%', padding: '5px'}} onClick={() => openViolationDetails(v)}>Review Violation</button>
                                    </div>
                                </Popup>
                            </Marker>
                            )
                        ))}
                    </MapContainer>
                </div>
            )}

            {/* LIST VIEW (Data Table) */}
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
                    <>
                        <div style={{ overflowX: 'auto' }}>
                            <table className="modern-table">
                                <thead>
                                    <tr>
                                        <th>Evidence</th>
                                        <th>Date</th>
                                        <th>Type</th>
                                        <th>Location</th>
                                        <th>Plate</th>
                                        <th>User</th>
                                        {currentTab === 'Pending Review' && <th>Actions</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedViolations.map((v) => (
                                        <tr key={v._id} className="clickable-row" onClick={() => openViolationDetails(v)} title="Click to view details">
                                            <td>
                                              <img 
                                                src={getImageUrl(v.mediaUrl)} 
                                                alt="Evidence" 
                                                className="violation-thumb" 
                                                onError={(e) => e.target.src = 'https://via.placeholder.com/80?text=Error'} 
                                              />
                                            </td>
                                            
                                            <td style={{whiteSpace: 'nowrap'}}>{new Date(v.timestamp).toLocaleDateString()}</td>
                                            
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: VIOLATION_COLORS[v.violationType] || '#ccc', flexShrink: 0 }}></div>
                                                    {v.violationType}
                                                </div>
                                            </td>

                                            <td title={v.address}>
                                                <div style={{color: '#4b5563'}}>
                                                  {v.address || `${v.location?.coordinates[1].toFixed(3)}, ${v.location?.coordinates[0].toFixed(3)}`}
                                                </div>
                                            </td>

                                            <td>
                                                <span style={{ fontFamily: 'monospace', background: '#f3f4f6', padding: '4px 8px', borderRadius: '6px', fontWeight: 'bold' }}>
                                                    {v.licensePlate && String(v.licensePlate).trim() !== 'null' ? v.licensePlate : 'N/A'}
                                                </span>
                                            </td>
                                            
                                            <td>
                                                <div style={{ fontWeight: '500' }}>{v.user?.firstName} {v.user?.lastName}</div>
                                                <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>{v.user?.phoneNumber}</div>
                                            </td>
                                            
                                            {currentTab === 'Pending Review' && (
                                                <td onClick={(e) => e.stopPropagation()}> 
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
                        </div>

                        {/* Pagination Controls */}
                        {totalPages > 1 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 20px', borderTop: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                                <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                                    Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredViolations.length)} of {filteredViolations.length} entries
                                </span>
                                
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <button 
                                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                        disabled={currentPage === 1}
                                        style={{ display: 'flex', alignItems: 'center', padding: '6px 12px', borderRadius: '6px', border: '1px solid #d1d5db', background: currentPage === 1 ? '#f3f4f6' : 'white', color: currentPage === 1 ? '#9ca3af' : '#374151', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', fontWeight: '500', transition: 'all 0.2s' }}
                                    >
                                        <ChevronLeft size={16} style={{marginRight: '4px'}} /> Previous
                                    </button>
                                    
                                    <span style={{ fontSize: '0.9rem', fontWeight: '600', padding: '0 10px', color: '#11101d' }}>
                                        Page {currentPage} of {totalPages}
                                    </span>
                                    
                                    <button 
                                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                        disabled={currentPage === totalPages}
                                        style={{ display: 'flex', alignItems: 'center', padding: '6px 12px', borderRadius: '6px', border: '1px solid #d1d5db', background: currentPage === totalPages ? '#f3f4f6' : 'white', color: currentPage === totalPages ? '#9ca3af' : '#374151', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', fontWeight: '500', transition: 'all 0.2s' }}
                                    >
                                        Next <ChevronRight size={16} style={{marginLeft: '4px'}} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                 )}
                </>
            )}
        </div>

        {/* Analytics Chart Section (Displayed below the list view) */}
        {viewMode === 'list' && stats && (
            <div className="content-card" style={{ marginBottom: '40px' }}>
                <div className="content-header">
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 'bold', color: '#11101d' }}>
                        Analytics Overview: Violations by Type
                    </h3>
                </div>
                
                <div style={{ padding: '2rem' }}>
                    <div style={{ height: '400px', width: '100%' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart 
                                data={stats?.typeStats} 
                                margin={{ top: 20, right: 30, left: 0, bottom: 20 }}
                                barSize={60}
                            >
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                <XAxis 
                                    dataKey="_id" 
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#6b7280', fontSize: 12 }}
                                    dy={10}
                                />
                                <YAxis 
                                    stroke="#9ca3af" 
                                    fontSize={12} 
                                    tickLine={false} 
                                    axisLine={false} 
                                    tickFormatter={(value) => Math.floor(value) === value ? value : ''}
                                />
                                <Tooltip 
                                    cursor={{ fill: '#f8fafc' }} 
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} 
                                />
                                <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                                    {stats?.typeStats?.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={VIOLATION_COLORS[entry._id] || '#ccc'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Chart Legend */}
                    <div style={{ 
                        display: 'flex', 
                        flexWrap: 'wrap', 
                        justifyContent: 'center', 
                        gap: '25px', 
                        marginTop: '30px', 
                        padding: '15px',
                        backgroundColor: '#f9fafb',
                        borderRadius: '12px'
                    }}>
                        {stats?.typeStats?.map((entry) => (
                            <div key={entry._id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ 
                                    width: '12px', 
                                    height: '12px', 
                                    borderRadius: '3px', 
                                    backgroundColor: VIOLATION_COLORS[entry._id] || '#ccc' 
                                }}></div>
                                <span style={{ color: '#374151', fontWeight: '600', fontSize: '0.9rem' }}>
                                    {entry._id}: <span style={{ color: '#6b7280', fontWeight: '400' }}>{entry.count}</span>
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}

      </div>

      {/* =========================================
          MODALS SECTION
          ========================================= */}

      {/* 1. Master-Detail Review Modal */}
      {editingViolation && (
        <div className="modal-overlay" onClick={() => setEditingViolation(null)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e5e7eb', paddingBottom: '15px', marginBottom: '20px' }}>
                    <h2 style={{margin: 0, color: '#11101d', fontSize: '1.4rem'}}>Violation Review File: {editingViolation._id.substring(0,8).toUpperCase()}</h2>
                    <button onClick={() => setEditingViolation(null)} style={{background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280'}}>
                        <X size={24} />
                    </button>
                </div>
                
                <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap' }}>
                    
                    {/* Left Column: Evidence Media */}
                    <div style={{ flex: '1 1 400px' }}>
                        <a href={getImageUrl(editingViolation.mediaUrl)} target="_blank" rel="noopener noreferrer" title="Click to open full size in new tab">
                            <img 
                                src={getImageUrl(editingViolation.mediaUrl)} 
                                className="modal-image" 
                                alt="Violation Evidence" 
                                onError={(e) => e.target.src = 'https://via.placeholder.com/400x250?text=Image+Not+Found'}
                            />
                        </a>
                        <p style={{textAlign: 'center', fontSize: '0.8rem', color: '#9ca3af', marginTop: '5px'}}>Click image to open in full resolution</p>
                    </div>

                    {/* Right Column: Violation Details & Actions */}
                    <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column' }}>
                        
                        <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', marginBottom: '20px' }}>
                            <h3 style={{margin: '0 0 15px 0', fontSize: '1.1rem', color: '#333'}}>Violation Details</h3>
                            
                            <div style={{ display: 'grid', gap: '10px', fontSize: '0.95rem' }}>
                                <div style={{display: 'flex', justifyContent: 'space-between'}}>
                                    <span style={{color: '#6b7280'}}>Type:</span>
                                    <strong style={{color: VIOLATION_COLORS[editingViolation.violationType] || '#333'}}>{editingViolation.violationType}</strong>
                                </div>
                                <div style={{display: 'flex', justifyContent: 'space-between'}}>
                                    <span style={{color: '#6b7280'}}>Date & Time:</span>
                                    <strong>{new Date(editingViolation.timestamp).toLocaleString()}</strong>
                                </div>
                                <div style={{display: 'flex', justifyContent: 'space-between'}}>
                                    <span style={{color: '#6b7280'}}>Location:</span>
                                    <strong style={{textAlign: 'right', maxWidth: '180px'}}>{editingViolation.address}</strong>
                                </div>
                                <div style={{display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e5e7eb', paddingTop: '10px', marginTop: '5px'}}>
                                    <span style={{color: '#6b7280'}}>Reported By:</span>
                                    <strong>{editingViolation.user?.firstName} {editingViolation.user?.lastName}</strong>
                                </div>
                            </div>
                        </div>

                        {/* ALPR Manual Override Input */}
                        <div className="input-group" style={{ marginBottom: '20px' }}>
                            <label style={{fontWeight: 'bold', display: 'block', marginBottom: '8px', color: '#11101d'}}>Manual ALPR Override (Plate Number):</label>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <input
                                    type="text"
                                    className="modern-input"
                                    value={newPlate}
                                    onChange={(e) => setNewPlate(e.target.value)}
                                    placeholder="Enter correct plate..."
                                    style={{ flex: 1, fontSize: '1.1rem', letterSpacing: '1px', textAlign: 'center', fontWeight: 'bold', border: '2px solid #e0e7ff' }}
                                />
                                <button className="btn btn-primary" onClick={handleSavePlate} style={{background: '#4f46e5', margin: 0, padding: '0 20px'}}>Save</button>
                            </div>
                        </div>

                        {/* Action Buttons (Only visible for Pending items) */}
                        {editingViolation.status === 'Pending Review' && (
                            <div style={{ display: 'flex', gap: '15px', marginTop: 'auto', paddingTop: '15px' }}>
                                <button 
                                    onClick={() => handleStatusChange(editingViolation._id, 'Verified')} 
                                    className="btn" 
                                    style={{ flex: 1, padding: '12px', background: '#22c55e', color: 'white', justifyContent: 'center', fontSize: '1rem', boxShadow: '0 4px 6px -1px rgba(34, 197, 94, 0.3)', border: 'none' }}
                                >
                                    <CheckCircle size={20} /> Approve
                                </button>
                                <button 
                                    onClick={() => handleStatusChange(editingViolation._id, 'Rejected')} 
                                    className="btn" 
                                    style={{ flex: 1, padding: '12px', background: '#ef4444', color: 'white', justifyContent: 'center', fontSize: '1rem', boxShadow: '0 4px 6px -1px rgba(239, 68, 68, 0.3)', border: 'none' }}
                                >
                                    <XCircle size={20} /> Reject
                                </button>
                            </div>
                        )}
                        
                        {/* Status Label (For non-pending items) */}
                        {editingViolation.status !== 'Pending Review' && (
                             <div style={{ marginTop: 'auto', textAlign: 'center', padding: '15px', background: editingViolation.status === 'Verified' ? '#dcfce7' : '#fee2e2', borderRadius: '8px', color: editingViolation.status === 'Verified' ? '#166534' : '#991b1b', fontWeight: 'bold' }}>
                                 This report was {editingViolation.status}
                             </div>
                        )}

                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Real-time Toast Notifications */}
      <div style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 3000,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        maxWidth: '400px'
      }}>
        {toasts.map((toast) => (
          <div
            key={toast.id}
            style={{
              background: 'white',
              borderRadius: '12px',
              boxShadow: '0 10px 40px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)',
              padding: '16px',
              display: 'flex',
              gap: '12px',
              alignItems: 'flex-start',
              animation: 'slideIn 0.3s ease-out',
              borderLeft: `4px solid ${VIOLATION_COLORS[toast.violation.violationType] || '#3b82f6'}`
            }}
          >
            <div style={{
              background: '#fef3c7',
              borderRadius: '50%',
              padding: '8px',
              flexShrink: 0
            }}>
              <Bell size={20} color="#d97706" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: '700', color: '#11101d', fontSize: '0.95rem', marginBottom: '4px' }}>
                New Violation Reported
              </div>
              <div style={{ fontSize: '0.85rem', color: '#4b5563', lineHeight: '1.4' }}>
                <strong style={{ color: VIOLATION_COLORS[toast.violation.violationType] }}>{toast.violation.violationType}</strong>
                {toast.violation.licensePlate && toast.violation.licensePlate !== 'null' && (
                  <span> — Plate: <strong style={{ fontFamily: 'monospace' }}>{toast.violation.licensePlate}</strong></span>
                )}
              </div>
              {toast.violation.address && (
                <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {toast.violation.address}
                </div>
              )}
            </div>
            <button
              onClick={() => dismissToast(toast.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: '2px', flexShrink: 0 }}
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>

      {/* 2. Custom Confirmation Modal */}
      {confirmAction.isOpen && (
        <div className="modal-overlay" style={{ zIndex: 2000 }}>
          <div className="modal-content" style={{ maxWidth: '400px', textAlign: 'center', padding: '30px' }}>
            <AlertTriangle 
              size={48} 
              color={confirmAction.newStatus === 'Verified' ? '#22c55e' : '#ef4444'} 
              style={{ margin: '0 auto 15px' }} 
            />
            <h2 style={{ marginTop: 0, color: '#11101d', fontSize: '1.4rem' }}>
              {confirmAction.newStatus === 'Verified' ? 'Approve Violation?' : 'Reject Violation?'}
            </h2>
            <p style={{ color: '#6b7280', marginBottom: '25px', lineHeight: '1.5' }}>
              Are you sure you want to mark this report as <strong>{confirmAction.newStatus}</strong>? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
              <button 
                className="btn" 
                style={{ padding: '10px 20px', background: '#f3f4f6', color: '#4b5563', fontWeight: 'bold', border: '1px solid #e5e7eb' }} 
                onClick={() => setConfirmAction({ isOpen: false, id: null, newStatus: '' })}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary" 
                style={{ padding: '10px 20px', background: confirmAction.newStatus === 'Verified' ? '#22c55e' : '#ef4444', color: 'white', fontWeight: 'bold', border: 'none' }} 
                onClick={executeStatusChange}
              >
                Yes, {confirmAction.newStatus === 'Verified' ? 'Approve' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

// --- Sub-Components ---

/**
 * Renders a statistic card for the KPI banner.
 */
const StatCard = ({ title, value, icon, color }) => (
    <div className="stat-card" style={{ borderLeft: `5px solid ${color}` }}>
      <div>
        <div className="stat-title">{title}</div>
        <div className="stat-value">{value}</div>
      </div>
      <div style={{ color: color, alignSelf: 'flex-end' }}>{icon}</div>
    </div>
);

/**
 * Renders a functional tab button with an optional notification badge.
 */
const TabButton = ({ label, count, isActive, onClick, icon }) => (
    <button onClick={onClick} style={{ padding: '8px 16px', border: 'none', background: isActive ? '#11101d' : 'transparent', color: isActive ? 'white' : '#6b7280', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '8px' }}>
        {icon} {label}
        {count !== undefined && <span style={{ background: isActive ? 'rgba(255,255,255,0.2)' : '#e5e7eb', color: isActive ? 'white' : '#374151', padding: '2px 8px', borderRadius: '10px', fontSize: '0.75rem' }}>{count}</span>}
    </button>
);

export default Dashboard;