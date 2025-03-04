"use client"

import { useState, useEffect } from "react"
import { useNavigate, Link } from "react-router-dom"

function Login() {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  })
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [loading, setLoading] = useState(false)
  const [loginAttempted, setLoginAttempted] = useState(false)
  const navigate = useNavigate()

  // Clear any existing auth data when the login page loads
  useEffect(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    console.log("Auth data cleared on login page load");
  }, []);

  // This effect runs after a successful login
  useEffect(() => {
    // Check if we just logged in successfully
    if (loginAttempted && localStorage.getItem('token')) {
      console.log("Login detected, redirecting to dashboard...");
      // Force a page reload to ensure the app picks up the auth state change
      window.location.href = '/dashboard';
    }
  }, [loginAttempted]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
    setError("") // Clear error when user types
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    setSuccess("")
    console.log("Login attempt with:", formData.email);

    try {
      const response = await fetch('http://localhost:5000/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()
      console.log("Login response status:", response.status);
      console.log("Login response data:", data);

      if (!response.ok) {
        throw new Error(data.message || 'Login failed')
      }

      // Store token and user info in localStorage
      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
      
      setSuccess("Login successful! Redirecting...");
      console.log("Login successful - token stored:", data.token.substring(0, 20) + "...");
      
      // Set login attempted to trigger the redirect effect
      setLoginAttempted(true);

    } catch (error) {
      console.error("Login error:", error)
      setError(error.message || "An error occurred during login")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: "400px", margin: "0 auto" }}>
      <h1 style={{ textAlign: "center", color: "#333", marginBottom: "25px" }}>Login</h1>
      
      {error && (
        <div style={{ 
          color: "white", 
          backgroundColor: "#d9534f", 
          padding: "10px", 
          borderRadius: "5px", 
          marginBottom: "15px",
          textAlign: "center"
        }}>
          {error}
        </div>
      )}
      
      {success && (
        <div style={{ 
          color: "white", 
          backgroundColor: "#5cb85c", 
          padding: "10px", 
          borderRadius: "5px", 
          marginBottom: "15px",
          textAlign: "center"
        }}>
          {success}
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "15px" }}>
          <label htmlFor="email" style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>Email:</label>
          <input 
            type="email" 
            id="email" 
            name="email" 
            value={formData.email}
            onChange={handleChange}
            style={{ 
              width: "100%", 
              padding: "10px", 
              borderRadius: "4px", 
              border: "1px solid #ddd",
              fontSize: "16px"
            }}
            required 
            autoComplete="email"
          />
        </div>
        <div style={{ marginBottom: "20px" }}>
          <label htmlFor="password" style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>Password:</label>
          <input 
            type="password" 
            id="password" 
            name="password" 
            value={formData.password}
            onChange={handleChange}
            style={{ 
              width: "100%", 
              padding: "10px", 
              borderRadius: "4px", 
              border: "1px solid #ddd",
              fontSize: "16px"
            }} 
            required 
            autoComplete="current-password"
          />
        </div>
        <button 
          type="submit" 
          disabled={loading}
          style={{ 
            width: "100%", 
            padding: "12px", 
            backgroundColor: "#007bff", 
            color: "white", 
            border: "none", 
            borderRadius: "4px", 
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1,
            fontSize: "16px",
            fontWeight: "bold"
          }}
        >
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>
      
      <p style={{ textAlign: "center", marginTop: "20px" }}>
        Don't have an account? <Link to="/signup" style={{ color: "#007bff", textDecoration: "none", fontWeight: "bold" }}>Sign up</Link>
      </p>
      
      <div style={{ marginTop: "20px", fontSize: "12px", color: "#777" }}>
        <p style={{ textAlign: "center" }}>Auth Status: {localStorage.getItem('token') ? 'Logged In' : 'Not Logged In'}</p>
      </div>
    </div>
  )
}

export default Login