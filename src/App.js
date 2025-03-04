import { BrowserRouter as Router, Route, Link, Routes, Navigate } from "react-router-dom"
import { useState, useEffect } from "react"
import Login from "./components/Login"
import SignUp from "./components/SignUp"
import Dashboard from "./components/Dashboard"
import ReportSubmission from "./components/ReportSubmission"
import Posts from "./components/Posts"
import Map from "./components/Map"
import Settings from "./components/Settings"
import { AuthProvider } from "./AuthContext"

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)
  
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
          // Optional: For better security, validate the token with the backend
          // This is a simple client-side check for now
          const user = JSON.parse(localStorage.getItem('user'))
          if (!user || !user.id) {
            throw new Error("Invalid user data")
          }
          
          console.log("Token validation successful")
          setIsAuthenticated(true)
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
              <Link to="/map" style={linkStyle}>
                Map
              </Link>
            </li>
            <li>
              <Link to="/report" style={linkStyle}>
                Report
              </Link>
            </li>
            
            <li style={{ marginLeft: "auto" }}>
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
            <Route path="/map" element={<Map />} />
            <Route path="/settings" element={<Settings />} />
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