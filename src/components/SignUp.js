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
    role: "user"
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
    setFormData({ ...formData, [e.target.name]: e.target.value })
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
          role: formData.role
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

      // Redirect directly to settings instead of dashboard
      navigate("/settings", { replace: true });
    } catch (error) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={containerStyle}>
      <h1 style={headerStyle}>Sign Up</h1>
      {error && <div style={{ color: "red", marginBottom: "15px", textAlign: "center" }}>{error}</div>}
      <form onSubmit={handleSubmit} style={formStyle}>
        <div style={inputGroupStyle}>
          <label htmlFor="username" style={labelStyle}>
            Username:
          </label>
          <input
            type="text"
            id="username"
            name="username"
            value={formData.username}
            onChange={handleChange}
            required
            style={inputStyle}
          />
        </div>
        <div style={inputGroupStyle}>
          <label htmlFor="email" style={labelStyle}>
            Email:
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            style={inputStyle}
          />
        </div>
        <div style={inputGroupStyle}>
          <label htmlFor="password" style={labelStyle}>
            Password:
          </label>
          <input
            type="password"
            id="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            required
            style={inputStyle}
          />
        </div>
        <div style={inputGroupStyle}>
          <label htmlFor="confirmPassword" style={labelStyle}>
            Confirm Password:
          </label>
          <input
            type="password"
            id="confirmPassword"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleChange}
            required
            style={inputStyle}
          />
        </div>
        <div style={inputGroupStyle}>
          <label htmlFor="role" style={labelStyle}>
            Account Type:
          </label>
          <select
            id="role"
            name="role"
            value={formData.role}
            onChange={handleChange}
            style={inputStyle}
          >
            <option value="user">Regular User</option>
            <option value="ngo">NGO/Organization</option>
            <option value="moderator">Moderator (Requires Approval)</option>
            <option value="admin">Admin (Requires Approval)</option>
          </select>
        </div>
        <button 
          type="submit" 
          style={{
            ...buttonStyle,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1
          }}
          disabled={loading}
        >
          {loading ? "Creating Account..." : "Sign Up"}
        </button>
      </form>
      <p style={paragraphStyle}>
        Already have an account?{" "}
        <Link to="/" style={linkStyle}>
          Log in
        </Link>
      </p>
    </div>
  )
}

const containerStyle = {
  maxWidth: "400px",
  margin: "0 auto",
  padding: "20px",
  backgroundColor: "#f9f9f9",
  borderRadius: "5px",
  boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
}

const headerStyle = {
  textAlign: "center",
  color: "#333",
  marginBottom: "20px",
}

const formStyle = {
  display: "flex",
  flexDirection: "column",
}

const inputGroupStyle = {
  marginBottom: "15px",
}

const labelStyle = {
  marginBottom: "5px",
  color: "#555",
  display: "block",
}

const inputStyle = {
  width: "100%",
  padding: "8px",
  border: "1px solid #ddd",
  borderRadius: "4px",
  fontSize: "16px",
}

const buttonStyle = {
  padding: "10px",
  backgroundColor: "#007bff",
  color: "white",
  border: "none",
  borderRadius: "4px",
  fontSize: "16px",
  cursor: "pointer",
}

const paragraphStyle = {
  textAlign: "center",
  marginTop: "15px",
}

const linkStyle = {
  color: "#007bff",
  textDecoration: "none",
}

export default SignUp