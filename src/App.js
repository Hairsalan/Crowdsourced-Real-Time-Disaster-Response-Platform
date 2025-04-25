import { BrowserRouter as Router, Route, Link, Routes, Navigate } from "react-router-dom"
import { useState, useEffect } from "react"
import Login from "./components/Login"
import SignUp from "./components/SignUp"
import Dashboard from "./components/Dashboard"
import ReportSubmission from "./components/ReportSubmission"
import Posts from "./components/Posts"
import Map from "./components/Map"
import Settings from "./components/Settings"
import LocationSettings from "./components/LocationSettings"
import UserManagementTab from "./components/UserManagementTab"
import ProtectedRoute from "./components/ProtectedRoute"
import { AuthProvider, useAuth } from "./AuthContext"

function App() {
  const [activeSettingsTab, setActiveSettingsTab] = useState('profile')
  
  // AuthProvider moved to index.js for global auth state access
  // We'll use the useAuth hook from AuthContext directly in App component
  
  // Custom Settings component with tabs
  const SettingsWithTabs = () => {
    const { user } = useAuth();
    // Check if user is admin or moderator
    const isAdminOrModerator = user && (user.role === 'admin' || user.role === 'moderator');

    return (
      <div>
        <h1 style={{ borderBottom: "2px solid #007bff", paddingBottom: "10px" }}>Settings</h1>
        
        <div style={{ display: "flex", marginBottom: "20px", borderBottom: "1px solid #dee2e6" }}>
          <button 
            onClick={() => setActiveSettingsTab('profile')}
            style={{
              padding: "10px 20px",
              backgroundColor: activeSettingsTab === 'profile' ? "#007bff" : "transparent",
              color: activeSettingsTab === 'profile' ? "white" : "#333",
              border: "none",
              borderBottom: activeSettingsTab === 'profile' ? "2px solid #007bff" : "none",
              cursor: "pointer",
              fontWeight: "bold"
            }}
          >
            Profile
          </button>
          <button 
            onClick={() => setActiveSettingsTab('location')}
            style={{
              padding: "10px 20px",
              backgroundColor: activeSettingsTab === 'location' ? "#007bff" : "transparent",
              color: activeSettingsTab === 'location' ? "white" : "#333",
              border: "none",
              borderBottom: activeSettingsTab === 'location' ? "2px solid #007bff" : "none",
              cursor: "pointer",
              fontWeight: "bold"
            }}
          >
            Location
          </button>
          
          {/* Only show UserManagement tab for admins and moderators */}
          {isAdminOrModerator && (
            <button
              onClick={() => setActiveSettingsTab('userManagement')}
              style={{
                padding: "10px 20px",
                backgroundColor: activeSettingsTab === 'userManagement' ? "#007bff" : "transparent",
                color: activeSettingsTab === 'userManagement' ? "white" : "#333",
                border: "none",
                borderBottom: activeSettingsTab === 'userManagement' ? "2px solid #007bff" : "none",
                cursor: "pointer",
                fontWeight: "bold"
              }}
            >
              User Management
            </button>
          )}
        </div>
        
        {activeSettingsTab === 'profile' ? (
          <Settings />
        ) : activeSettingsTab === 'location' ? (
          <LocationSettings />
        ) : activeSettingsTab === 'userManagement' && isAdminOrModerator ? (
          <UserManagementTab userRole={user.role} />
        ) : null}
      </div>
    );
  }

  return (
    <Router>
      <AppContent 
        SettingsWithTabs={SettingsWithTabs} 
        activeSettingsTab={activeSettingsTab}
      />
    </Router>
  )
}

function AppContent({ SettingsWithTabs }) {
  const { isAuthenticated, loading, user, logout } = useAuth();
  
  // Show loading state while checking authentication
  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '18px',
        color: '#666'
      }}>
        Loading...
      </div>
    )
  }

  // Function to handle logout
  const handleLogout = () => {
    logout();
    // Use window.location for a full page refresh on logout
    window.location.href = '/';
  }

  // Function to get role badge style based on role
  const getRoleBadgeStyle = (role) => {
    const baseStyle = {
      padding: "4px 8px",
      borderRadius: "4px",
      fontSize: "12px",
      fontWeight: "bold",
      color: "white",
      marginRight: "15px"
    };
    
    switch (role) {
      case 'admin':
        return { ...baseStyle, backgroundColor: "#dc3545" }; // Red
      case 'moderator':
        return { ...baseStyle, backgroundColor: "#6f42c1" }; // Purple
      case 'ngo':
        return { ...baseStyle, backgroundColor: "#28a745" }; // Green
      default:
        return { ...baseStyle, backgroundColor: "#17a2b8" }; // Teal
    }
  };

  // Map role to display name
  const getRoleDisplayName = (role) => {
    switch (role) {
      case 'admin': return 'Administrator';
      case 'moderator': return 'Moderator';
      case 'ngo': return 'NGO/Organization';
      default: return 'User';
    }
  };

  // If not authenticated, show only login/signup
  if (!isAuthenticated) {
    return (
      <div
        style={{
          fontFamily: "Arial, sans-serif",
          margin: "0 auto",
          maxWidth: "1200px",
          padding: "20px",
          backgroundColor: "#f0f0f0",
          minHeight: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center"
        }}
      >
        <div
          style={{
            backgroundColor: "white",
            padding: "30px",
            borderRadius: "8px",
            boxShadow: "0 0 20px rgba(0,0,0,0.1)",
            width: "100%",
            maxWidth: "500px",
          }}
        >
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    );
  }

  // If authenticated, show the full app with navbar
  return (
    <div
      style={{
        fontFamily: "Arial, sans-serif",
        margin: "0 auto",
        maxWidth: "1200px",
        padding: "20px",
        backgroundColor: "#f0f0f0",
        minHeight: "100vh",
      }}
    >
      <nav
        style={{
          marginBottom: "20px",
          backgroundColor: "#333",
          padding: "10px",
          borderRadius: "5px",
        }}
      >
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            display: "flex",
            gap: "20px",
            alignItems: "center",
            margin: 0,
          }}
        >
          <li>
            <Link to="/dashboard" style={linkStyle}>
              Dashboard
            </Link>
          </li>
          <li>
            <Link to="/posts" style={linkStyle}>
              Posts
            </Link>
          </li>
          <li>
            <Link to="/map" style={linkStyle}>
              Map
            </Link>
          </li>
          <li>
            <Link to="/report" style={linkStyle}>
              Report
            </Link>
          </li>
          
          <li style={{ marginLeft: "auto", display: "flex", alignItems: "center" }}>
            {user && user.role && (
              <span style={getRoleBadgeStyle(user.role)}>
                {getRoleDisplayName(user.role)}
              </span>
            )}
          </li>
          <li>
            <Link to="/settings" style={linkStyle}>
              Settings
            </Link>
          </li>
          <li>
            <button 
              onClick={handleLogout} 
              style={{
                background: "transparent",
                border: "none",
                color: "white",
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              Logout
            </button>
          </li>
        </ul>
      </nav>

      <div
        style={{
          backgroundColor: "white",
          padding: "20px",
          borderRadius: "5px",
          boxShadow: "0 0 10px rgba(0,0,0,0.1)",
        }}
      >
        <Routes>
          <Route 
            path="/" 
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/report" 
            element={
              <ProtectedRoute>
                <ReportSubmission />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/posts" 
            element={
              <ProtectedRoute>
                <Posts />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/map" 
            element={
              <ProtectedRoute>
                <Map />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/settings" 
            element={
              <ProtectedRoute>
                <SettingsWithTabs />
              </ProtectedRoute>
            } 
          />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </div>
    </div>
  )
}

const linkStyle = {
  color: "white",
  textDecoration: "none",
  fontWeight: "bold",
}

export default App