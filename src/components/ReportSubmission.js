"use client"

import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { getStoredLocation, geocodeAddress } from "../services/LocationService"
import { useAuth } from "../AuthContext"

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
  const [reportImage, setReportImage] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const navigate = useNavigate()
  const { isAuthenticated, token, userLocation, hasLocation } = useAuth()

  // Check if user is authenticated on component mount
  useEffect(() => {
    if (!isAuthenticated || !token) {
      navigate('/login')
      return
    }
    
    // Load user's stored location from AuthContext
    if (userLocation && hasLocation) {
      setCurrentLocation(userLocation)
      if (userLocation.displayName) {
        setLocationDetail(userLocation.displayName)
      } else if (typeof userLocation.latitude === 'number' && typeof userLocation.longitude === 'number') {
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
  }, [navigate, isAuthenticated, token, userLocation, hasLocation])

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

  // Handle image selection
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Check file size (limit to 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError("Image file is too large. Maximum size is 5MB.");
        return;
      }
      
      // Check file type
      if (!file.type.startsWith('image/')) {
        setError("Only image files are allowed.");
        return;
      }
      
      setReportImage(file);
      
      // Create a preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
      
      setError("");
    }
  };

  // Remove selected image
  const removeImage = () => {
    setReportImage(null);
    setImagePreview(null);
  };

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
      
      // Check if user is authenticated
      if (!isAuthenticated || !token) {
        throw new Error("You must be logged in to submit a report")
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
          // Provide a more user-friendly error message
          console.error("Geocoding error details:", geocodeError);
          if (geocodeError.message.includes("Could not find coordinates")) {
            throw new Error(`Could not find this location. Please try entering a more specific address with city, state and country.`);
          } else {
            throw new Error(`Location error: ${geocodeError.message}. Please try again or use a different address format.`);
          }
        }
      } else {
        // No location provided
        locationData = null
      }

      // Use FormData for submitting with images
      const formDataToSend = new FormData();
      formDataToSend.append('title', formData.title);
      formDataToSend.append('description', formData.description);
      formDataToSend.append('type', formData.type);
      
      if (locationData) {
        formDataToSend.append('location', JSON.stringify(locationData));
      }
      
      if (reportImage) {
        formDataToSend.append('image', reportImage);
      }

      const response = await fetch('http://localhost:5000/api/posts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
          // Don't set Content-Type when using FormData, browser will set it automatically with boundary
        },
        body: formDataToSend
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
      setReportImage(null);
      setImagePreview(null);
      
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

  const previewContainerStyle = {
    border: "1px solid #ddd",
    borderRadius: "4px",
    padding: "10px",
    backgroundColor: "#f9f9f9",
    marginBottom: "10px"
  };

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
        
        <div style={{ marginBottom: "15px" }}>
          <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Image (Optional):</label>
          
          {imagePreview ? (
            <div style={previewContainerStyle}>
              <img 
                src={imagePreview} 
                alt="Report preview" 
                style={{
                  maxWidth: "100%",
                  maxHeight: "200px",
                  display: "block",
                  marginBottom: "10px",
                  borderRadius: "4px"
                }} 
              />
              <button
                type="button"
                onClick={removeImage}
                style={{
                  padding: "8px 12px",
                  backgroundColor: "#dc3545",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  marginTop: "5px"
                }}
              >
                Remove Image
              </button>
            </div>
          ) : (
            <div>
              <label 
                htmlFor="report-image" 
                style={{
                  display: "inline-block",
                  padding: "10px 15px",
                  backgroundColor: "#f0f0f0",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  cursor: "pointer"
                }}
              >
                <span style={{ marginRight: "8px" }}>📷</span> 
                Select Image
              </label>
              <input
                id="report-image"
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                style={{ display: "none" }}
              />
              <p style={{ color: "#666", fontSize: "0.9em", marginTop: "5px" }}>
                Add an image of the disaster or event (max 5MB)
              </p>
            </div>
          )}
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