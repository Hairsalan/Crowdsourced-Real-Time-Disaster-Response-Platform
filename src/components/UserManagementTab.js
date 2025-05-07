import { useState, useEffect } from "react";
import { useAuth } from "../AuthContext";

function UserManagementTab({ userRole }) {
  const isAdmin = userRole === 'admin';
  const isModerator = userRole === 'moderator';
  const [users, setUsers] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [banDuration, setBanDuration] = useState('1d');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showBanPrompt, setShowBanPrompt] = useState(false);
  const [showRolePrompt, setShowRolePrompt] = useState(false);
  const [selectedRole, setSelectedRole] = useState('');
  const usersPerPage = 10;
  const { logout, refreshToken } = useAuth();

  useEffect(() => {
    fetchUsers();
  }, [currentPage]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Try to refresh token first
      const isTokenValid = await refreshToken();
      if (!isTokenValid) {
        setError("Your session has expired. Please log in again.");
        return;
      }
      
      const token = localStorage.getItem('token');
      
      if (!token) {
        setError("No authentication token found. Please log in again.");
        logout();
        return;
      }
      
      const response = await fetch(`http://localhost:5000/api/users?page=${currentPage}&limit=${usersPerPage}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (response.status === 403 || response.status === 401) {
        setError("Your session has expired. Please log in again.");
        logout();
        return;
      }
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch users');
      }
      
      setUsers(data.users);
      setTotalPages(Math.ceil(data.total / usersPerPage));
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const openBanPrompt = (user) => {
    setSelectedUser(user);
    setShowBanPrompt(true);
  };

  const closeBanPrompt = () => {
    setShowBanPrompt(false);
    setSelectedUser(null);
  };

  const openRolePrompt = (user) => {
    console.log('Opening role prompt for user:', user.username);
    console.log('Current user role:', user.role);
    console.log('Current operator role (you):', userRole);
    
    setSelectedUser(user);
    setSelectedRole(user.role);
    setShowRolePrompt(true);
  };

  const closeRolePrompt = () => {
    setShowRolePrompt(false);
    setSelectedUser(null);
  };

  const handleBanUser = async () => {
    try {
      if (!banDuration) {
        alert('Please specify a ban duration');
        return;
      }
      
      // Try to refresh token first
      const isTokenValid = await refreshToken();
      if (!isTokenValid) {
        setError("Your session has expired. Please log in again.");
        return;
      }
      
      const token = localStorage.getItem('token');
      
      if (!token) {
        setError("No authentication token found. Please log in again.");
        logout();
        return;
      }
      
      const response = await fetch(`http://localhost:5000/api/users/${selectedUser._id}/ban`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ duration: banDuration })
      });
      
      if (response.status === 403 || response.status === 401) {
        setError("Your session has expired. Please log in again.");
        logout();
        return;
      }
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to ban user');
      }
      // Update the user in the list
      setUsers(users.map(user => 
        user._id === selectedUser._id ? { ...user, banned: true, banExpires: data.banExpires } : user
      ));
      closeBanPrompt();
      alert('User has been banned successfully');
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  };

  const handleUnbanUser = async (userId) => {
    try {
      // Try to refresh token first
      const isTokenValid = await refreshToken();
      if (!isTokenValid) {
        setError("Your session has expired. Please log in again.");
        return;
      }
      
      const token = localStorage.getItem('token');
      
      if (!token) {
        setError("No authentication token found. Please log in again.");
        logout();
        return;
      }
      
      const response = await fetch(`http://localhost:5000/api/users/${userId}/unban`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.status === 403 || response.status === 401) {
        setError("Your session has expired. Please log in again.");
        logout();
        return;
      }
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to unban user');
      }
      // Update the user in the list
      setUsers(users.map(user => 
        user._id === userId ? { ...user, banned: false, banExpires: null } : user
      ));
      alert('User has been unbanned successfully');
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to permanently delete this user?')) {
      return;
    }
    try {
      // Try to refresh token first
      const isTokenValid = await refreshToken();
      if (!isTokenValid) {
        setError("Your session has expired. Please log in again.");
        return;
      }
      
      const token = localStorage.getItem('token');
      
      if (!token) {
        setError("No authentication token found. Please log in again.");
        logout();
        return;
      }
      
      const response = await fetch(`http://localhost:5000/api/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.status === 403 || response.status === 401) {
        setError("Your session has expired. Please log in again.");
        logout();
        return;
      }
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to delete user');
      }
      // Remove the user from the list
      setUsers(users.filter(user => user._id !== userId));
      alert('User has been deleted successfully');
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  };

  const handleChangeUserRole = async () => {
    try {
      if (selectedRole === selectedUser.role) {
        alert('Please select a different role');
        return;
      }
      
      // Add role change validation for moderators
      if (isModerator) {
        // Moderators can now: 1) change users to NGO, or 2) change NGOs back to users
        const isValidModeratorChange = 
          (selectedUser.role === 'user' && selectedRole === 'ngo') || // user -> NGO
          (selectedUser.role === 'ngo' && selectedRole === 'user');   // NGO -> user
          
        if (!isValidModeratorChange) {
          alert('As a moderator, you can only promote users to NGO status or demote NGOs to regular users');
          return;
        }
      }
      
      // Try to refresh token first
      const isTokenValid = await refreshToken();
      if (!isTokenValid) {
        setError("Your session has expired. Please log in again.");
        return;
      }
      
      const token = localStorage.getItem('token');
      
      if (!token) {
        setError("No authentication token found. Please log in again.");
        logout();
        return;
      }
      
      console.log('Making role change request for user:', selectedUser._id);
      console.log('New role:', selectedRole);
      console.log('Current user role:', userRole);
      
      const response = await fetch(`http://localhost:5000/api/users/${selectedUser._id}/role`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ newRole: selectedRole })
      });
      
      // Get response data even if response is not ok
      const data = await response.json();
      
      if (response.status === 403 || response.status === 401) {
        console.error('Auth error during role change:', data);
        setError(data.message || "Your session has expired. Please log in again.");
        // Don't perform automatic logout here, just show the error
        closeRolePrompt();
        return;
      }
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to change user role');
      }
      
      // Update the user in the list
      setUsers(users.map(user => 
        user._id === selectedUser._id ? { ...user, role: selectedRole } : user
      ));
      closeRolePrompt();
      alert(`User role has been changed to ${selectedRole} successfully`);
    } catch (error) {
      console.error('Role change error:', error);
      alert(`Error: ${error.message}`);
    }
  };

  if (loading) {
    return <div style={loadingStyle}>Loading users...</div>;
  }

  if (error) {
    return (
      <div style={errorContainerStyle}>
        <div style={errorStyle}>Error: {error}</div>
        <button 
          onClick={() => fetchUsers()} 
          style={refreshButtonStyle}
        >
          Retry
        </button>
        {error.includes("session has expired") && (
          <button 
            onClick={() => window.location.href = '/login'} 
            style={loginButtonStyle}
          >
            Login Again
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <h1 style={headerStyle}>User Management</h1>
      
      {users.length === 0 ? (
        <p>No users found.</p>
      ) : (
        <>
          <div style={tableContainerStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={tableHeaderStyle}>Username</th>
                  <th style={tableHeaderStyle}>Email</th>
                  <th style={tableHeaderStyle}>Role</th>
                  <th style={tableHeaderStyle}>Status</th>
                  <th style={tableHeaderStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user._id} style={user.banned ? {...tableRowStyle, ...bannedUserStyle} : tableRowStyle}>
                    <td style={tableCellStyle}>{user.username}</td>
                    <td style={tableCellStyle}>{user.email}</td>
                    <td style={tableCellStyle}>{user.role}</td>
                    <td style={tableCellStyle}>{user.banned ? 'Banned' : 'Active'}</td>
                    <td style={tableCellStyle}>
                      <div style={actionButtonsStyle}>
                        {!user.banned ? (
                          <>
                            {(isAdmin || (isModerator && (user.role === 'user' || user.role === 'ngo'))) && (
                              <button 
                                onClick={() => openRolePrompt(user)} 
                                style={roleButtonStyle}
                              >
                                Change Role
                              </button>
                            )}
                            
                            {(user.role !== 'admin' && (isAdmin || (isModerator && user.role !== 'moderator'))) && (
                              <button 
                                onClick={() => openBanPrompt(user)} 
                                style={banButtonStyle}
                              >
                                Ban
                              </button>
                            )}
                            
                            {isAdmin && user.role !== 'admin' && (
                              <button 
                                onClick={() => handleDeleteUser(user._id)} 
                                style={deleteButtonStyle}
                              >
                                Delete
                              </button>
                            )}
                          </>
                        ) : (
                          <button 
                            onClick={() => handleUnbanUser(user._id)} 
                            style={unbanButtonStyle}
                          >
                            Unban
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={paginationStyle}>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(number => (
                <button 
                  key={number} 
                  onClick={() => handlePageChange(number)}
                  style={currentPage === number ? activePageButtonStyle : pageButtonStyle}
                >
                  {number}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* Ban User Modal */}
      {showBanPrompt && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <h3 style={modalHeaderStyle}>Ban User: {selectedUser.username}</h3>
            <div style={formGroupStyle}>
              <label style={labelStyle}>Ban Duration:</label>
              <select 
                value={banDuration} 
                onChange={(e) => setBanDuration(e.target.value)}
                style={selectStyle}
              >
                <option value="1d">1 Day</option>
                <option value="3d">3 Days</option>
                <option value="7d">1 Week</option>
                <option value="14d">2 Weeks</option>
                <option value="30d">1 Month</option>
                <option value="permanent">Permanent</option>
              </select>
            </div>
            <div style={modalButtonsStyle}>
              <button onClick={closeBanPrompt} style={cancelButtonStyle}>Cancel</button>
              <button onClick={handleBanUser} style={confirmBanButtonStyle}>Ban User</button>
            </div>
          </div>
        </div>
      )}

      {/* Change User Role Modal */}
      {showRolePrompt && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <h3 style={modalHeaderStyle}>Change Role: {selectedUser.username}</h3>
            <div style={formGroupStyle}>
              <label style={labelStyle}>Select New Role:</label>
              <select 
                value={selectedRole} 
                onChange={(e) => setSelectedRole(e.target.value)}
                style={selectStyle}
              >
                <option value="user">Regular User</option>
                <option value="ngo">NGO/Organization</option>
                {/* Only admins can promote to moderator or admin */}
                {isAdmin && (
                  <>
                    <option value="moderator">Moderator</option>
                    <option value="admin">Administrator</option>
                  </>
                )}
              </select>
            </div>
            <div style={modalButtonsStyle}>
              <button onClick={closeRolePrompt} style={cancelButtonStyle}>Cancel</button>
              <button onClick={handleChangeUserRole} style={confirmRoleButtonStyle}>Change Role</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Styles
const containerStyle = {
  padding: "20px",
  maxWidth: "100%",
  margin: "0 auto",
};

const headerStyle = {
  color: "#333",
  borderBottom: "2px solid #333",
  paddingBottom: "10px",
  marginBottom: "20px",
};

const tableContainerStyle = {
  overflowX: "auto",
  marginBottom: "20px",
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  backgroundColor: "white",
  boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
  borderRadius: "5px",
};

const tableHeaderStyle = {
  textAlign: "left",
  padding: "12px 15px",
  backgroundColor: "#f2f2f2",
  fontWeight: "bold",
  borderBottom: "1px solid #ddd",
};

const tableRowStyle = {
  borderBottom: "1px solid #ddd",
};

const bannedUserStyle = {
  backgroundColor: "rgba(255, 0, 0, 0.1)",
};

const tableCellStyle = {
  padding: "12px 15px",
  textAlign: "left",
};

const actionButtonsStyle = {
  display: "flex",
  gap: "10px",
};

const buttonBaseStyle = {
  padding: "6px 12px",
  border: "none",
  borderRadius: "4px",
  cursor: "pointer",
  fontSize: "14px",
};

const banButtonStyle = {
  ...buttonBaseStyle,
  backgroundColor: "#f8d7da",
  color: "#721c24",
};

const deleteButtonStyle = {
  ...buttonBaseStyle,
  backgroundColor: "#dc3545",
  color: "white",
};

const unbanButtonStyle = {
  ...buttonBaseStyle,
  backgroundColor: "#28a745",
  color: "white",
};

const paginationStyle = {
  display: "flex",
  justifyContent: "center",
  marginTop: "20px",
  gap: "5px",
};

const pageButtonStyle = {
  padding: "8px 16px",
  backgroundColor: "white",
  border: "1px solid #ddd",
  borderRadius: "4px",
  cursor: "pointer",
};

const activePageButtonStyle = {
  ...pageButtonStyle,
  backgroundColor: "#007bff",
  color: "white",
  borderColor: "#007bff",
};

const modalOverlayStyle = {
  position: "fixed",
  top: "0",
  left: "0",
  right: "0",
  bottom: "0",
  backgroundColor: "rgba(0, 0, 0, 0.5)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: "1000",
};

const modalContentStyle = {
  backgroundColor: "white",
  padding: "25px",
  borderRadius: "8px",
  boxShadow: "0 4px 8px rgba(0, 0, 0, 0.2)",
  width: "400px",
  maxWidth: "90%",
};

const modalHeaderStyle = {
  borderBottom: "1px solid #eee",
  paddingBottom: "15px",
  marginBottom: "20px",
  color: "#333",
};

const formGroupStyle = {
  marginBottom: "20px",
};

const labelStyle = {
  display: "block",
  marginBottom: "8px",
  fontWeight: "bold",
};

const selectStyle = {
  width: "100%",
  padding: "8px 12px",
  border: "1px solid #ddd",
  borderRadius: "4px",
  backgroundColor: "white",
  fontSize: "14px",
};

const modalButtonsStyle = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "10px",
};

const cancelButtonStyle = {
  ...buttonBaseStyle,
  backgroundColor: "#f0f0f0",
  color: "#333",
};

const confirmBanButtonStyle = {
  ...buttonBaseStyle,
  backgroundColor: "#dc3545",
  color: "white",
};

const loadingStyle = {
  padding: "20px",
  fontSize: "18px",
  color: "#666",
};

const errorStyle = {
  padding: "20px",
  fontSize: "18px",
  color: "#dc3545",
};

const errorContainerStyle = {
  padding: "20px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "15px"
};

const refreshButtonStyle = {
  ...buttonBaseStyle,
  backgroundColor: "#007bff",
  color: "white",
  padding: "8px 16px",
};

const loginButtonStyle = {
  ...buttonBaseStyle,
  backgroundColor: "#28a745",
  color: "white",
  padding: "8px 16px",
};

const roleButtonStyle = {
  ...buttonBaseStyle,
  backgroundColor: "#17a2b8",
  color: "white",
};

const confirmRoleButtonStyle = {
  ...buttonBaseStyle,
  backgroundColor: "#17a2b8",
  color: "white",
};

export default UserManagementTab; 