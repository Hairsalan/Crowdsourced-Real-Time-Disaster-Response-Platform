"use client"

import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { getStoredLocation, geocodeAddress } from "../services/LocationService"

function ReportSubmission() {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    type: "fire",
    locationOption: "current", // 'current', 'custom', or 'none'
    address: "",
    city: "",
    state: "",
    country: "",
    useCurrentLocation: true
  })
  const [currentLocation, setCurrentLocation] = useState(null)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [loading, setLoading] = useState(false)
  const [geocoding, setGeocoding] = useState(false)
  const [locationDetail, setLocationDetail] = useState("")
  const navigate = useNavigate()

  // Check if user is authenticated on component mount
  useEffect(() => {
    if (!localStorage.getItem('token')) {
      navigate('/login')
    }
    
    // Load user's stored location
    const userLocation = getStoredLocation()
    if (userLocation) {
      setCurrentLocation(userLocation)
      if (userLocation.displayName) {
        setLocationDetail(userLocation.displayName)
      } else {
        setLocationDetail(`Latitude: ${userLocation.latitude.toFixed(6)}, Longitude: ${userLocation.longitude.toFixed(6)}`)
      }
    } else {
      // If no location is stored, default to custom location
      setFormData({
        ...formData,
        locationOption: "custom",
        useCurrentLocation: false
      })
    }
  }, [navigate])

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData({ 
      ...formData, 
      [name]: type === 'checkbox' ? checked : value 
    })
    
    setError("")
  }

  const handleLocationOptionChange = (option) => {
    setFormData({
      ...formData,
      locationOption: option,
      useCurrentLocation: option === "current"
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    setSuccess("")

    try {
      // Validate form
      if (!formData.title.trim()) {
        throw new Error("Title is required")
      }
      if (!formData.description.trim()) {
        throw new Error("Description is required")
      }
      
      // Determine location data to send
      let locationData = null
      
      if (formData.locationOption === "current") {
        if (!currentLocation) {
          throw new Error("No current location available. Please set your location in Settings or choose custom location.")
        }
        locationData = {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          displayName: currentLocation.displayName
        }
      } else if (formData.locationOption === "custom") {
        setGeocoding(true)
        // Construct address string
        const addressParts = []
        if (formData.address) addressParts.push(formData.address)
        if (formData.city) addressParts.push(formData.city)
        if (formData.state) addressParts.push(formData.state)
        if (formData.country) addressParts.push(formData.country)
        
        const addressString = addressParts.join(", ")
        
        if (addressParts.length < 2) {
          throw new Error("Please provide at least city and state/country for location")
        }
        
        // Geocode the address
        try {
          const geocoded = await geocodeAddress(addressString)
          locationData = {
            latitude: geocoded.latitude,
            longitude: geocoded.longitude,
            displayName: geocoded.displayName || addressString
          }
          setGeocoding(false)
        } catch (geocodeError) {
          setGeocoding(false)
          throw new Error(`Could not geocode address: ${geocodeError.message}`)
        }
      } else {
        // No location provided
        locationData = null
      }

      const token = localStorage.getItem('token')
      
      if (!token) {
        throw new Error("You must be logged in to submit a report")
      }

      const reportData = {
        title: formData.title,
        description: formData.description,
        type: formData.type,
        location: locationData
      }

      const response = await fetch('http://localhost:5000/api/posts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(reportData)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to submit report')
      }

      setSuccess("Report submitted successfully!")
      
      // Clear form after successful submission
      setFormData({
        title: "",
        description: "",
        type: "fire",
        locationOption: currentLocation ? "current" : "custom",
        address: "",
        city: "",
        state: "",
        country: "",
        useCurrentLocation: !!currentLocation
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
            <option value="hurricane">Hurricane</option>
            <option value="tornado">Tornado</option>
            <option value="other">Other</option>
          </select>
        </div>
        
        <div style={{ marginBottom: "25px" }}>
          <label style={{ display: "block", marginBottom: "10px", fontWeight: "bold" }}>Location:</label>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", backgroundColor: "#f0f0f0", padding: "15px", borderRadius: "5px" }}>
            <div style={{ display: "flex", gap: "15px" }}>
              <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
                <input
                  type="radio"
                  name="locationOption"
                  checked={formData.locationOption === "current"}
                  onChange={() => handleLocationOptionChange("current")}
                  style={{ marginRight: "8px" }}
                  disabled={!currentLocation}
                />
                Use My Current Location
              </label>
              
              <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
                <input
                  type="radio"
                  name="locationOption"
                  checked={formData.locationOption === "custom"}
                  onChange={() => handleLocationOptionChange("custom")}
                  style={{ marginRight: "8px" }}
                />
                Enter Custom Location
              </label>
              
              <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
                <input
                  type="radio"
                  name="locationOption"
                  checked={formData.locationOption === "none"}
                  onChange={() => handleLocationOptionChange("none")}
                  style={{ marginRight: "8px" }}
                />
                No Location
              </label>
            </div>
            
            {formData.locationOption === "current" && (
              <div style={{ backgroundColor: "#e9f7fe", padding: "10px", borderRadius: "4px" }}>
                {currentLocation ? (
                  <p style={{ margin: 0 }}>
                    <strong>Using location:</strong> {locationDetail}
                  </p>
                ) : (
                  <p style={{ margin: 0, color: "#721c24" }}>
                    No location set. Please go to Settings to set your location or choose custom location.
                  </p>
                )}
              </div>
            )}
            
            {formData.locationOption === "custom" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div>
                  <label htmlFor="address" style={{ display: "block", marginBottom: "3px", fontSize: "0.9em" }}>Street Address (Optional):</label>
                  <input
                    type="text"
                    id="address"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    placeholder="123 Main St"
                    style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ddd" }}
                  />
                </div>
                
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div>
                    <label htmlFor="city" style={{ display: "block", marginBottom: "3px", fontSize: "0.9em" }}>City:</label>
                    <input
                      type="text"
                      id="city"
                      name="city"
                      value={formData.city}
                      onChange={handleChange}
                      placeholder="City"
                      style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ddd" }}
                      required={formData.locationOption === "custom"}
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="state" style={{ display: "block", marginBottom: "3px", fontSize: "0.9em" }}>State/Province:</label>
                    <input
                      type="text"
                      id="state"
                      name="state"
                      value={formData.state}
                      onChange={handleChange}
                      placeholder="State"
                      style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ddd" }}
                      required={formData.locationOption === "custom"}
                    />
                  </div>
                </div>
                
                <div>
                  <label htmlFor="country" style={{ display: "block", marginBottom: "3px", fontSize: "0.9em" }}>Country:</label>
                  <input
                    type="text"
                    id="country"
                    name="country"
                    value={formData.country}
                    onChange={handleChange}
                    placeholder="Country"
                    style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ddd" }}
                    required={formData.locationOption === "custom"}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
        
        <button 
          type="submit" 
          disabled={loading || geocoding}
          style={{ 
            width: "100%", 
            padding: "12px", 
            backgroundColor: "#007bff", 
            color: "white", 
            border: "none", 
            borderRadius: "4px", 
            cursor: (loading || geocoding) ? "not-allowed" : "pointer",
            fontWeight: "bold",
            fontSize: "16px",
            opacity: (loading || geocoding) ? 0.7 : 1
          }}
        >
          {loading ? "Submitting..." : geocoding ? "Geocoding Address..." : "Submit Report"}
        </button>
      </form>
    </div>
  )
}

export default ReportSubmission