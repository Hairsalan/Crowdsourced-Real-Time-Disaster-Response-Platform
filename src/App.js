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
import News from "./components/News"
import { AuthProvider } from "./AuthContext"

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [userData, setUserData] = useState(null)
  const [activeSettingsTab, setActiveSettingsTab] = useState('profile')
  
  // Validate token on component mount
  useEffect(() => {
    const validateToken = async () => {
      try {
        const token = localStorage.getItem('token')
        
        // If no token exists, user is not authenticated
        if (!token) {
          console.log("No token found, user is not authenticated")
          setIsAuthenticated(false)
          setLoading(false)
          return
        }
        
        // Clear token if it's invalid or expired
        try {
          // Get user data from localStorage
          const user = JSON.parse(localStorage.getItem('user'))
          if (!user || !user.id) {
            throw new Error("Invalid user data")
          }
          
          console.log("Token validation successful")
          setIsAuthenticated(true)
          setUserData(user)
        } catch (error) {
          console.log("Token validation failed, clearing auth data:", error)
          // Clear invalid authentication data
          localStorage.removeItem('token')
          localStorage.removeItem('user')
          setIsAuthenticated(false)
        }
      } catch (error) {
        console.error("Auth validation error:", error)
        setIsAuthenticated(false)
      } finally {
        setLoading(false)
      }
    }
    
    validateToken()
  }, [])
  
  // Function to handle logout
  const handleLogout = () => {
    console.log("Logging out...")
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setIsAuthenticated(false)
    // Use window.location for a full page refresh on logout
    window.location.href = '/'
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

  // If not authenticated, show only login/signup
  if (!isAuthenticated) {
    return (
      <Router>
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
      </Router>
    );
  }

  // Map role to display name
  const getRoleDisplayName = (role) => {
    switch (role) {
      case 'admin': return 'Administrator';
      case 'moderator': return 'Moderator';
      case 'ngo': return 'NGO/Organization';
      default: return 'User';
    }
  };

  // Custom Settings component with tabs
  const SettingsWithTabs = () => (
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
      </div>
      
      {activeSettingsTab === 'profile' ? <Settings /> : <LocationSettings />}
    </div>
  );

  // If authenticated, show the full app with navbar
  return (
    <Router>
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
              <Link to="/news" style={linkStyle}>
                News
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
              {userData && userData.role && (
                <span style={getRoleBadgeStyle(userData.role)}>
                  {getRoleDisplayName(userData.role)}
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
            <Route path="/" element={<Dashboard />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/report" element={<ReportSubmission />} />
            <Route path="/posts" element={<Posts />} />
            <Route path="/news" element={<News />} />
            <Route path="/map" element={<Map />} />
            <Route path="/settings" element={<SettingsWithTabs />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </div>
      </div>
    </Router>
  )
}

const linkStyle = {
  color: "white",
  textDecoration: "none",
  fontWeight: "bold",
}

export default App