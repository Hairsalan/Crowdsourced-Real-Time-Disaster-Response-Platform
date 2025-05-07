"use client"

import { useState, useEffect } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useAuth } from "../AuthContext"

function Login() {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  })
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  // Clear any existing auth data when the login page loads
  useEffect(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('userLocation'); // Clear saved location
    console.log("Auth data cleared on login page load");
  }, []);

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

      // Check if user is banned before allowing login
      if (data.user.banned) {
        const banMessage = data.user.banExpires
          ? `Your account has been banned until ${new Date(data.user.banExpires).toLocaleString()}.`
          : 'Your account has been permanently banned.';
        throw new Error(banMessage);
      }

      // Use AuthContext login function instead of manually setting localStorage
      // Wait for the async login to complete so context is fully ready
      await login(data.user, data.token);
      
      setSuccess("Login successful! Redirecting...");
      console.log("Login successful - token stored:", data.token.substring(0, 20) + "...");
      
      // Conditionally route based on whether the user has a saved location
      if (data.user.location) {
        // User has a location, send them to dashboard
        navigate("/dashboard", { replace: true });
      } else {
        // User needs to set location, send them to settings
        navigate("/settings", { replace: true });
      }

    } catch (error) {
      console.error("Login error:", error)
      setError(error.message || "An error occurred during login")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h2 className="text-center mb-4">Sign in to your account</h2>
      
      {error && (
        <div className="alert alert-danger">
          {error}
        </div>
      )}
      
      {success && (
        <div className="alert alert-success">
          {success}
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label htmlFor="email">Email</label>
          <input 
            type="email" 
            id="email" 
            name="email" 
            value={formData.email}
            onChange={handleChange}
            required 
            autoComplete="email"
            className="mb-3"
          />
        </div>
        <div className="mb-4">
          <label htmlFor="password">Password</label>
          <input 
            type="password" 
            id="password" 
            name="password" 
            value={formData.password}
            onChange={handleChange}
            required 
            autoComplete="current-password"
            className="mb-1"
          />
        </div>
        <button 
          type="submit" 
          disabled={loading}
          className="btn w-full"
          style={{ 
            backgroundColor: 'var(--primary)',
            color: 'var(--white)',
            padding: 'var(--spacing-md)',
            fontSize: '1rem'
          }}
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
      
      <p className="text-center mt-4">
        Don't have an account? <Link to="/signup">Sign up</Link>
      </p>
    </div>
  )
}

export default Login