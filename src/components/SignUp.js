"use client"

import { useState, useEffect } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useAuth } from "../AuthContext"

function SignUp() {
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "user" // Default role, no longer selectable by user
  })
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  // Clear any existing auth data when the signup page loads
  useEffect(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('userLocation'); // So the form starts blank
    console.log("Auth data cleared on signup page load");
  }, []);

  const handleChange = (e) => {
    // Skip updating role as it's no longer a field in the form
    if (e.target.name !== 'role') {
      setFormData({ ...formData, [e.target.name]: e.target.value })
    }
    setError("") // Clear error when user types
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match")
      return
    }
    
    setLoading(true)
    setError("")

    try {
      const response = await fetch('http://localhost:5000/api/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: formData.username,
          email: formData.email,
          password: formData.password,
          role: "user" // Hard-coded to "user", role selection removed
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Registration failed')
      }

      console.log("Signup successful, got token:", !!data.token);
      
      // Use AuthContext login function instead of manually setting localStorage
      // Wait for login to complete since it's now an async function
      await login(data.user, data.token);
      
      console.log("Login completed, token in storage:", !!localStorage.getItem('token'));

      // Redirect directly to settings with locationTabRequired flag
      navigate("/settings", { 
        replace: true,
        state: { locationTabRequired: true }
      });
    } catch (error) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h2 className="text-center mb-4">Create your account</h2>
      
      {error && (
        <div className="alert alert-danger">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label htmlFor="username">Username</label>
          <input
            type="text"
            id="username"
            name="username"
            value={formData.username}
            onChange={handleChange}
            required
            className="mb-3"
          />
        </div>
        
        <div className="mb-3">
          <label htmlFor="email">Email</label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            className="mb-3"
          />
        </div>
        
        <div className="mb-3">
          <label htmlFor="password">Password</label>
          <input
            type="password"
            id="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            required
            className="mb-3"
          />
        </div>
        
        <div className="mb-4">
          <label htmlFor="confirmPassword">Confirm Password</label>
          <input
            type="password"
            id="confirmPassword"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleChange}
            required
            className="mb-1"
          />
        </div>
        
        <button 
          type="submit" 
          className="btn w-full"
          style={{ 
            backgroundColor: 'var(--primary)',
            color: 'var(--white)',
            padding: 'var(--spacing-md)',
            fontSize: '1rem'
          }}
          disabled={loading}
        >
          {loading ? "Creating Account..." : "Sign Up"}
        </button>
      </form>
      
      <p className="text-center mt-4">
        Already have an account? <Link to="/">Log in</Link>
      </p>
    </div>
  )
}

export default SignUp