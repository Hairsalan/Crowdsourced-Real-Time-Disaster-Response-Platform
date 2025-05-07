import { BrowserRouter as Router, Route, Link, Routes, Navigate, useLocation } from "react-router-dom"
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
    const { user, hasLocation } = useAuth();
    const location = useLocation();
    
    // Initialize state on component mount only
    useEffect(() => {
      // Check if redirected with locationTabRequired flag
      if (location.state?.locationTabRequired || !hasLocation) {
        setActiveSettingsTab('location');
      }
    }, [hasLocation, location.state]);
    
    // Check if user is admin or moderator
    const isAdminOrModerator = user && (user.role === 'admin' || user.role === 'moderator');
    
    // Tab click handler
    const handleTabChange = (tabName) => {
      // Only allow changing tabs if user has location set
      // Otherwise, force them to stay on the location tab
      if (!hasLocation && tabName !== 'location') {
        console.log("User must set location before accessing other tabs");
        return;
      }
      
      console.log("Changing tab to:", tabName);
      setActiveSettingsTab(tabName);
    };
    
    // Create warning message for users without location
    const LocationRequiredMessage = () => {
      if (!hasLocation && activeSettingsTab === 'location') {
        return (
          <div className="alert alert-warning">
            <strong>Please set your location.</strong> This is required to use the application.
          </div>
        );
      }
      return null;
    };
    
    return (
      <div className="card">
        <h1 className="mb-4">Settings</h1>
        
        <LocationRequiredMessage />
        
        <div className="tab-navigation mb-4">
          <button 
            onClick={() => handleTabChange('profile')}
            className={`tab-button ${activeSettingsTab === 'profile' ? 'active' : ''}`}
          >
            <i className="bi bi-person me-2"></i>
            Profile
          </button>
          
          <button 
            onClick={() => handleTabChange('location')}
            className={`tab-button ${activeSettingsTab === 'location' ? 'active' : ''}`}
          >
            <i className="bi bi-geo-alt me-2"></i>
            Location
          </button>
          
          {/* Remove notifications tab completely */}
          
          {/* Only show UserManagement tab for admins and moderators */}
          {isAdminOrModerator && (
            <button
              onClick={() => handleTabChange('userManagement')}
              className={`tab-button ${activeSettingsTab === 'userManagement' ? 'active' : ''}`}
            >
              <i className="bi bi-people me-2"></i>
              User Management
            </button>
          )}
        </div>
        
        {activeSettingsTab === 'profile' && <Settings />}
        {activeSettingsTab === 'location' && <LocationSettings />}
        {activeSettingsTab === 'userManagement' && isAdminOrModerator && <UserManagementTab userRole={user.role} />}
      </div>
    );
  }

  return (
    <Router>
      <AppContent 
        SettingsWithTabs={SettingsWithTabs} 
        activeSettingsTab={activeSettingsTab}
        setActiveSettingsTab={setActiveSettingsTab}
      />
    </Router>
  )
}

function AppContent({ SettingsWithTabs, activeSettingsTab, setActiveSettingsTab }) {
  const { isAuthenticated, loading, user, logout } = useAuth();
  
  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
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
    switch (role) {
      case 'admin':
        return 'badge badge-admin'; // Red
      case 'moderator':
        return 'badge badge-moderator'; // Purple
      case 'ngo':
        return 'badge badge-ngo'; // Green
      default:
        return 'badge badge-user'; // Teal
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
      <div className="auth-layout">
        <div className="auth-container">
          <div className="auth-header">
            <h1 className="auth-logo">
              <i className="bi bi-shield-fill-check me-2"></i>
              DisastAlert
            </h1>
            <p className="auth-tagline">Real-time disaster response platform</p>
          </div>
          <div className="auth-card">
            <Routes>
              <Route path="/" element={<Login />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<SignUp />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </div>
      </div>
    );
  }

  // If authenticated, show the full app with navbar
  return (
    <div className="app-container">
      <nav className="navbar">
        <div className="navbar-brand">
          <Link to="/dashboard" className="navbar-logo">
            <i className="bi bi-shield-fill-check me-2"></i>
            DisastAlert
          </Link>
        </div>
        <ul className="navbar-nav">
          <li className="nav-item">
            <Link to="/dashboard" className="nav-link">
              <i className="bi bi-speedometer2 me-1"></i>
              Dashboard
            </Link>
          </li>
          <li className="nav-item">
            <Link to="/posts" className="nav-link">
              <i className="bi bi-chat-square-text me-1"></i>
              Posts
            </Link>
          </li>
          <li className="nav-item">
            <Link to="/map" className="nav-link">
              <i className="bi bi-geo-alt me-1"></i>
              Map
            </Link>
          </li>
          <li className="nav-item">
            <Link to="/report" className="nav-link">
              <i className="bi bi-exclamation-triangle me-1"></i>
              Report
            </Link>
          </li>
        </ul>
        <div className="navbar-right">
          {user && user.role && (
            <span className={getRoleBadgeStyle(user.role)}>
              {getRoleDisplayName(user.role)}
            </span>
          )}
          <div className="dropdown">
            <button className="dropdown-toggle">
              <span className="user-greeting">Hi, {user?.name?.split(' ')[0] || 'User'}</span>
              <i className="bi bi-chevron-down ms-2"></i>
            </button>
            <div className="dropdown-menu">
              <Link to="/settings" className="dropdown-item">
                <i className="bi bi-gear me-2"></i>
                Settings
              </Link>
              <button onClick={handleLogout} className="dropdown-item">
                <i className="bi bi-box-arrow-right me-2"></i>
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="main-content">
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
      </main>
      
      <footer className="app-footer">
        <div className="footer-content">
          <p>&copy; {new Date().getFullYear()} DisastAlert. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}

export default App