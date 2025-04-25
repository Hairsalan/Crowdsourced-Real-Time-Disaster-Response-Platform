import { useState, useEffect } from "react"
import { 
  getCurrentLocation, 
  getStoredLocation, 
  storeManualLocation, 
  reverseGeocode,
  updateLocationRadius
} from "../services/LocationService"
import { useAuth } from "../AuthContext"

function LocationSettings() {
  const [location, setLocation] = useState(null)
  const [address, setAddress] = useState("")
  const [manualLocation, setManualLocation] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [radiusMiles, setRadiusMiles] = useState(50)
  const { user, updateUserLocation, updateMyLocation, token } = useAuth()

  // Load stored location on component mount
  useEffect(() => {
    const storedLocation = getStoredLocation()
    if (storedLocation) {
      setLocation(storedLocation)
      
      // Set radius from stored location
      if (storedLocation.radiusMiles) {
        setRadiusMiles(storedLocation.radiusMiles)
      }
      
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

    // Also set radius from user data if available (as a fallback)
    if (user && user.radiusMiles && !storedLocation?.radiusMiles) {
      setRadiusMiles(user.radiusMiles)
    }
  }, [user])

  // Handle automatic location detection
  const handleDetectLocation = async () => {
    console.log("🔑 token in storage:", localStorage.getItem('token'));
    console.log("🔑 token in context:", token);
    
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
      
      // Update on backend using the context method
      await updateMyLocation(position.latitude, position.longitude, radiusMiles)
      
      setSuccess("Location detected and saved successfully")
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
      
      // Update on backend using the context method
      await updateMyLocation(
        geocodedLocation.latitude, 
        geocodedLocation.longitude, 
        radiusMiles
      )
      
      setSuccess("Location set successfully")
    } catch (error) {
      setError(error.message || "Failed to set location")
      console.error("Manual location error:", error)
    } finally {
      setLoading(false)
    }
  }
  
  // Handle radius change
  const handleRadiusChange = async (e) => {
    const newRadius = parseInt(e.target.value, 10)
    setRadiusMiles(newRadius)
    
    // If location is already set, update backend with new radius
    if (location) {
      try {
        setLoading(true)
        
        // Update location in localStorage
        const updatedLocation = updateLocationRadius(newRadius)
        
        // Update location in context
        updateUserLocation(updatedLocation)
        
        // Update on backend using the context method
        await updateMyLocation(
          location.latitude,
          location.longitude,
          newRadius
        )
        
        setSuccess("Alert radius updated successfully")
        setLoading(false)
      } catch (error) {
        setError("Failed to update alert radius")
        console.error("Radius update error:", error)
        setLoading(false)
      }
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
        <h3 style={subheaderStyle}>Alert Radius</h3>
        <p>Set the radius within which you want to receive disaster alerts and reports.</p>
        <div style={rangeContainerStyle}>
          <input
            type="range"
            id="radiusMiles"
            name="radiusMiles"
            min="1"
            max="200"
            value={radiusMiles}
            onChange={handleRadiusChange}
            style={rangeStyle}
          />
          <div style={valueDisplayStyle}>
            <span style={radiusValueStyle}>{radiusMiles}</span>
            <span style={radiusUnitStyle}>miles</span>
          </div>
        </div>
        <p style={helperTextStyle}>
          You will only see disaster alerts and community reports within {radiusMiles} miles of your location.
        </p>
        
        <div style={radiusPresetStyle}>
          <button onClick={() => handleRadiusChange({ target: { value: 5 } })} style={{...radiusButtonStyle, backgroundColor: radiusMiles === 5 ? '#007bff' : '#e9e9e9', color: radiusMiles === 5 ? 'white' : '#333'}}>5</button>
          <button onClick={() => handleRadiusChange({ target: { value: 10 } })} style={{...radiusButtonStyle, backgroundColor: radiusMiles === 10 ? '#007bff' : '#e9e9e9', color: radiusMiles === 10 ? 'white' : '#333'}}>10</button>
          <button onClick={() => handleRadiusChange({ target: { value: 25 } })} style={{...radiusButtonStyle, backgroundColor: radiusMiles === 25 ? '#007bff' : '#e9e9e9', color: radiusMiles === 25 ? 'white' : '#333'}}>25</button>
          <button onClick={() => handleRadiusChange({ target: { value: 50 } })} style={{...radiusButtonStyle, backgroundColor: radiusMiles === 50 ? '#007bff' : '#e9e9e9', color: radiusMiles === 50 ? 'white' : '#333'}}>50</button>
          <button onClick={() => handleRadiusChange({ target: { value: 100 } })} style={{...radiusButtonStyle, backgroundColor: radiusMiles === 100 ? '#007bff' : '#e9e9e9', color: radiusMiles === 100 ? 'white' : '#333'}}>100</button>
        </div>
      </div>
      
      <div style={sectionStyle}>
        <h3 style={subheaderStyle}>Update Location</h3>
        <div style={actionButtonsStyle}>
          <button 
            onClick={handleDetectLocation} 
            disabled={loading}
            style={primaryButtonStyle}
          >
            {loading ? "Detecting..." : "Detect My Location"}
          </button>
          <p style={orTextStyle}>or</p>
        </div>
        
        <form onSubmit={handleManualLocationSubmit} style={formStyle}>
          <div style={inputGroupStyle}>
            <label htmlFor="manualLocation" style={inputLabelStyle}>
              Enter Address or City:
            </label>
            <div style={formInputContainerStyle}>
              <input
                type="text"
                id="manualLocation"
                value={manualLocation}
                onChange={(e) => setManualLocation(e.target.value)}
                placeholder="e.g. New York, NY or 123 Main St"
                disabled={loading}
                style={inputStyle}
              />
              <button 
                type="submit" 
                disabled={loading || !manualLocation}
                style={submitButtonStyle}
              >
                {loading ? "Setting..." : "Set Location"}
              </button>
            </div>
          </div>
        </form>
      </div>
      
      <div style={noteStyle}>
        <p>
          <strong>Note:</strong> For the most accurate alerts, please provide a specific address or city. Your location data is only used to show relevant disaster information.
        </p>
      </div>
    </div>
  );
}

// Improved styles
const containerStyle = {
  maxWidth: '800px',
  margin: '0 auto',
  backgroundColor: 'white',
  borderRadius: '8px',
  boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
  padding: '30px'
};

const headerStyle = {
  color: '#333',
  marginTop: 0,
  marginBottom: '20px',
  borderBottom: '2px solid #007bff',
  paddingBottom: '10px'
};

const descriptionStyle = {
  fontSize: '16px',
  lineHeight: '1.5',
  marginBottom: '25px',
  color: '#555'
};

const sectionStyle = {
  marginBottom: '30px',
  padding: '20px',
  backgroundColor: '#f9f9f9',
  borderRadius: '8px'
};

const subheaderStyle = {
  color: '#333',
  marginTop: 0,
  marginBottom: '15px',
  fontSize: '18px'
};

const locationInfoStyle = {
  backgroundColor: 'white',
  padding: '15px',
  borderRadius: '5px',
  border: '1px solid #e0e0e0'
};

const rangeContainerStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '20px',
  marginTop: '15px',
  marginBottom: '10px'
};

const rangeStyle = {
  flexGrow: 1,
  height: '8px',
  appearance: 'none',
  backgroundColor: '#e0e0e0',
  borderRadius: '4px',
  outline: 'none'
};

const valueDisplayStyle = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  minWidth: '60px'
};

const radiusValueStyle = {
  fontSize: '24px',
  fontWeight: 'bold',
  color: '#007bff'
};

const radiusUnitStyle = {
  fontSize: '14px',
  color: '#666'
};

const radiusPresetStyle = {
  display: 'flex',
  gap: '10px',
  marginTop: '15px',
  justifyContent: 'center'
};

const radiusButtonStyle = {
  padding: '8px 16px',
  borderRadius: '20px',
  border: 'none',
  cursor: 'pointer',
  fontWeight: 'bold',
  transition: 'all 0.2s'
};

const helperTextStyle = {
  fontSize: '14px',
  color: '#666',
  marginTop: '10px'
};

const actionButtonsStyle = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '15px',
  marginBottom: '20px'
};

const formStyle = {
  width: '100%'
};

const inputGroupStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '10px'
};

const inputLabelStyle = {
  fontWeight: 'bold',
  fontSize: '15px'
};

const formInputContainerStyle = {
  display: 'flex',
  gap: '10px'
};

const inputStyle = {
  flexGrow: 1,
  padding: '12px 15px',
  borderRadius: '4px',
  border: '1px solid #ccc',
  fontSize: '16px'
};

const primaryButtonStyle = {
  padding: '12px 24px',
  backgroundColor: '#007bff',
  color: 'white',
  border: 'none',
  borderRadius: '4px',
  fontSize: '16px',
  fontWeight: 'bold',
  cursor: 'pointer',
  width: '100%',
  maxWidth: '300px'
};

const submitButtonStyle = {
  padding: '0 20px',
  backgroundColor: '#007bff',
  color: 'white',
  border: 'none',
  borderRadius: '4px',
  fontSize: '16px',
  cursor: 'pointer'
};

const orTextStyle = {
  fontWeight: 'bold',
  color: '#666'
};

const errorStyle = {
  backgroundColor: '#f8d7da',
  color: '#721c24',
  padding: '15px',
  borderRadius: '5px',
  marginBottom: '20px'
};

const successStyle = {
  backgroundColor: '#d4edda',
  color: '#155724',
  padding: '15px',
  borderRadius: '5px',
  marginBottom: '20px'
};

const noteStyle = {
  backgroundColor: '#fff3cd',
  color: '#856404',
  padding: '15px',
  borderRadius: '5px',
  marginTop: '20px'
};

export default LocationSettings;