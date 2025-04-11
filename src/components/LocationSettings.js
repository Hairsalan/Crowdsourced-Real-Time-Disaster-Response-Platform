"use client"

import { useState, useEffect } from "react"
import { 
  getCurrentLocation, 
  getStoredLocation, 
  storeManualLocation, 
  reverseGeocode 
} from "../services/LocationService"

function LocationSettings() {
  const [location, setLocation] = useState(null)
  const [address, setAddress] = useState("")
  const [manualLocation, setManualLocation] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  // Load stored location on component mount
  useEffect(() => {
    const storedLocation = getStoredLocation()
    if (storedLocation) {
      setLocation(storedLocation)
      
      // Reverse geocode to get readable address
      const fetchAddress = async () => {
        try {
          const addressData = await reverseGeocode(
            storedLocation.latitude,
            storedLocation.longitude
          )
          setAddress(addressData.displayName)
        } catch (error) {
          console.error("Error reverse geocoding:", error)
        }
      }
      
      fetchAddress()
    }
  }, [])

  // Handle automatic location detection
  const handleDetectLocation = async () => {
    setLoading(true)
    setError("")
    setSuccess("")
    
    try {
      const position = await getCurrentLocation()
      setLocation(position)
      
      // Reverse geocode to get readable address
      const addressData = await reverseGeocode(
        position.latitude,
        position.longitude
      )
      setAddress(addressData.displayName)
      
      setSuccess("Location detected successfully")
    } catch (error) {
      setError(error.message || "Failed to detect location")
      console.error("Geolocation error:", error)
    } finally {
      setLoading(false)
    }
  }

  // Handle manual location entry
  const handleManualLocationSubmit = async (e) => {
    e.preventDefault()
    
    if (!manualLocation) {
      setError("Please enter a location")
      return
    }
    
    setLoading(true)
    setError("")
    setSuccess("")
    
    try {
      const geocodedLocation = await storeManualLocation(manualLocation)
      setLocation(geocodedLocation)
      setAddress(geocodedLocation.displayName || manualLocation)
      setSuccess("Location set successfully")
    } catch (error) {
      setError(error.message || "Failed to set location")
      console.error("Manual location error:", error)
    } finally {
      setLoading(false)
    }
  }

  // Format date from timestamp
  const formatDate = (timestamp) => {
    if (!timestamp) return "Unknown"
    
    const date = new Date(timestamp)
    return date.toLocaleString()
  }

  return (
    <div style={containerStyle}>
      <h2 style={headerStyle}>Location Settings</h2>
      <p style={descriptionStyle}>
        Set your location to receive relevant disaster news and alerts.
        We can automatically detect your location or you can enter it manually.
      </p>
      
      {error && (
        <div style={errorStyle}>
          {error}
        </div>
      )}
      
      {success && (
        <div style={successStyle}>
          {success}
        </div>
      )}
      
      <div style={sectionStyle}>
        <h3 style={subheaderStyle}>Current Location</h3>
        {location ? (
          <div style={locationInfoStyle}>
            <p><strong>Address:</strong> {address || "Unknown address"}</p>
            <p><strong>Coordinates:</strong> {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}</p>
            <p><strong>Last Updated:</strong> {formatDate(location.timestamp)}</p>
          </div>
        ) : (
          <p>No location set</p>
        )}
      </div>
      
      <div style={sectionStyle}>
        <h3 style={subheaderStyle}>Automatic Location</h3>
        <p>We can detect your location automatically using your browser's geolocation service.</p>
        <button 
          onClick={handleDetectLocation}
          disabled={loading}
          style={buttonStyle}
        >
          {loading ? "Detecting..." : "Detect My Location"}
        </button>
      </div>
      
      <div style={sectionStyle}>
        <h3 style={subheaderStyle}>Manual Location</h3>
        <p>Enter your city, address, or coordinates manually.</p>
        <form onSubmit={handleManualLocationSubmit} style={formStyle}>
          <input
            type="text"
            value={manualLocation}
            onChange={(e) => setManualLocation(e.target.value)}
            placeholder="City, address, or coordinates"
            style={inputStyle}
          />
          <button 
            type="submit"
            disabled={loading}
            style={buttonStyle}
          >
            {loading ? "Setting..." : "Set Location"}
          </button>
        </form>
      </div>
      
      <div style={sectionStyle}>
        <h3 style={subheaderStyle}>Privacy Note</h3>
        <p style={noteStyle}>
          Your location is stored locally on your device only and is used solely to provide
          relevant disaster information. We never track or share your location data.
        </p>
      </div>
    </div>
  )
}

// Styles
const containerStyle = {
  maxWidth: "700px",
  margin: "0 auto",
  padding: "20px",
}

const headerStyle = {
  borderBottom: "2px solid #007bff",
  paddingBottom: "10px",
  marginBottom: "20px",
  color: "#333",
}

const descriptionStyle = {
  fontSize: "16px",
  marginBottom: "20px",
  lineHeight: "1.5",
}

const sectionStyle = {
  marginBottom: "30px",
  padding: "20px",
  backgroundColor: "#f9f9f9",
  borderRadius: "5px",
  boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
}

const subheaderStyle = {
  color: "#007bff",
  marginTop: "0",
  marginBottom: "15px",
}

const locationInfoStyle = {
  backgroundColor: "#e9f7fe",
  padding: "15px",
  borderRadius: "5px",
  marginBottom: "15px",
}

const formStyle = {
  display: "flex",
  gap: "10px",
  marginTop: "15px",
}

const inputStyle = {
  flex: "1",
  padding: "10px",
  borderRadius: "4px",
  border: "1px solid #ddd",
  fontSize: "16px",
}

const buttonStyle = {
  padding: "10px 15px",
  backgroundColor: "#007bff",
  color: "white",
  border: "none",
  borderRadius: "4px",
  cursor: "pointer",
  fontWeight: "bold",
  fontSize: "16px",
}

const errorStyle = {
  backgroundColor: "#f8d7da",
  color: "#721c24",
  padding: "10px 15px",
  borderRadius: "4px",
  marginBottom: "20px",
}

const successStyle = {
  backgroundColor: "#d4edda",
  color: "#155724",
  padding: "10px 15px",
  borderRadius: "4px",
  marginBottom: "20px",
}

const noteStyle = {
  fontSize: "14px",
  fontStyle: "italic",
  color: "#666",
}

export default LocationSettings