"use client"

import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"

function ReportSubmission() {
  const [formData, setFormData] = useState({
    title: "",
    location: "",
    description: "",
    type: "fire"
  })
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  // Check if user is authenticated on component mount
  useEffect(() => {
    if (!localStorage.getItem('token')) {
      navigate('/login')
    }
  }, [navigate])

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
    setError("")
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    setSuccess("")

    try {
      const token = localStorage.getItem('token')
      
      if (!token) {
        throw new Error("You must be logged in to submit a report")
      }

      const response = await fetch('http://localhost:5000/api/posts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to submit report')
      }

      setSuccess("Report submitted successfully!")
      
      // Clear form after successful submission
      setFormData({
        title: "",
        location: "",
        description: "",
        type: "fire"
      })
      
      // Redirect to posts page after 2 seconds
      setTimeout(() => {
        navigate('/posts')
      }, 2000)
    } catch (error) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto" }}>
      <h1 style={{ color: "#333", marginBottom: "20px" }}>Submit a Report</h1>
      
      {error && <div style={{ padding: "10px", backgroundColor: "#f8d7da", color: "#721c24", borderRadius: "5px", marginBottom: "15px" }}>{error}</div>}
      {success && <div style={{ padding: "10px", backgroundColor: "#d4edda", color: "#155724", borderRadius: "5px", marginBottom: "15px" }}>{success}</div>}
      
      <form onSubmit={handleSubmit} style={{ backgroundColor: "#f9f9f9", padding: "20px", borderRadius: "5px" }}>
        <div style={{ marginBottom: "15px" }}>
          <label htmlFor="title" style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Title:</label>
          <input 
            type="text" 
            id="title" 
            name="title" 
            value={formData.title}
            onChange={handleChange}
            style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ddd" }}
            required 
          />
        </div>
        <div style={{ marginBottom: "15px" }}>
          <label htmlFor="location" style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Location:</label>
          <input 
            type="text" 
            id="location" 
            name="location" 
            value={formData.location}
            onChange={handleChange}
            style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ddd" }}
            required 
          />
        </div>
        <div style={{ marginBottom: "15px" }}>
          <label htmlFor="description" style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Description:</label>
          <textarea 
            id="description" 
            name="description" 
            value={formData.description}
            onChange={handleChange}
            style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ddd", minHeight: "100px" }}
            required
          ></textarea>
        </div>
        <div style={{ marginBottom: "20px" }}>
          <label htmlFor="type" style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Type of Disaster:</label>
          <select 
            id="type" 
            name="type"
            value={formData.type}
            onChange={handleChange}
            style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ddd" }}
          >
            <option value="fire">Fire</option>
            <option value="flood">Flood</option>
            <option value="earthquake">Earthquake</option>
            <option value="other">Other</option>
          </select>
        </div>
        <button 
          type="submit" 
          disabled={loading}
          style={{ 
            width: "100%", 
            padding: "10px", 
            backgroundColor: "#007bff", 
            color: "white", 
            border: "none", 
            borderRadius: "4px", 
            cursor: loading ? "not-allowed" : "pointer",
            fontWeight: "bold",
            fontSize: "16px",
            opacity: loading ? 0.7 : 1
          }}
        >
          {loading ? "Submitting..." : "Submit Report"}
        </button>
      </form>
    </div>
  )
}

export default ReportSubmission