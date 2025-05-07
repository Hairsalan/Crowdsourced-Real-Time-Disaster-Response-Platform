import { useState, useEffect } from "react"
import { useNavigate, useLocation } from "react-router-dom"
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
  const [redirecting, setRedirecting] = useState(false)
  const [radiusMiles, setRadiusMiles] = useState(50)
  const { user, updateUserLocation, updateMyLocation, token } = useAuth()
  const navigate = useNavigate()
  const locationState = useLocation().state

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
  }, [])

  // Handler for location success - common for both detect and manual
  const handleLocationSuccess = async (successMessage) => {
    setSuccess(successMessage)
    
    // If we came from the Report page via redirect, go back there after setting location
    if (locationState && locationState.returnPath === '/report') {
      setRedirecting(true)
      setSuccess(successMessage + " Redirecting to report page...")
      
      // Wait a moment to show the success message before redirecting
      setTimeout(() => {
        navigate('/report')
      }, 1500)
    }
  }

  // Handle automatic location detection
  const handleDetectLocation = async () => {
    console.log("🔑 token in storage:", localStorage.getItem('token'));
    console.log("🔑 token in context:", token);
    
    setLoading(true)
    setError("")
    setSuccess("")
    
    try {
      // First get the user's geolocation coordinates
      const position = await getCurrentLocation()
      
      // First set location to show coordinates while we wait for geocoding
      setLocation(position)
      setAddress(`${position.latitude.toFixed(6)}, ${position.longitude.toFixed(6)}`)
      
      // Then try to get a better address
      try {
        // Geocode with improved function
        const addressData = await reverseGeocode(position.latitude, position.longitude)
        
        // Add detailed address to the position data
        if (addressData && addressData.displayName) {
          console.log("Successfully geocoded address:", addressData.displayName);
          
          // Update the UI with the proper address format
          setAddress(addressData.displayName);
          
          // Update position with detailed address info
          position.displayName = addressData.displayName;
          
          // Add components if available
          if (addressData.city) position.city = addressData.city;
          if (addressData.state) position.state = addressData.state;
          if (addressData.country) position.country = addressData.country;
          if (addressData.postcode) position.postcode = addressData.postcode;
          
          // Save all the combined data
          localStorage.setItem('userLocation', JSON.stringify(position));
          setLocation(position);
        }
        
        // Even if geocoding didn't give a proper address, we still have coordinates
        setSuccess("Location detected and saved successfully");
      } catch (geocodeError) {
        // Reverse geocoding failed, but location was still saved with coordinates
        console.warn("Reverse geocoding failed, using coordinates instead:", geocodeError);
        setSuccess("Location saved with coordinates only (geocoding failed)");
      }
      
      // Try to update location on the server
      try {
        await updateMyLocation(position.latitude, position.longitude, radiusMiles)
      } catch (backendError) {
        console.warn("Backend location update failed, but location was saved locally:", backendError);
        // Don't set an error - we still have the location saved locally
      }
      
      handleLocationSuccess("Location detected and saved successfully")
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
      console.log("Attempting to geocode manual location:", manualLocation);
      // Try to geocode the user input
      const geocodedLocation = await storeManualLocation(manualLocation)
      
      // Update the UI immediately
      setLocation(geocodedLocation)
      setAddress(geocodedLocation.displayName || manualLocation)
      
      // Try to update on the server
      try {
        await updateMyLocation(
          geocodedLocation.latitude, 
          geocodedLocation.longitude, 
          radiusMiles
        )
      } catch (backendError) {
        console.warn("Backend location update failed, but location was saved locally:", backendError);
        // Don't set error - we still have the location saved locally
      }
      
      handleLocationSuccess("Location set successfully")
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
    
    // Debounce the radius updates to reduce API calls and state changes
    // Only update the backend if we have a location and are not already loading
    if (location && !loading) {
      // Add a small delay to avoid multiple rapid updates
      clearTimeout(window.radiusUpdateTimeout);
      
      window.radiusUpdateTimeout = setTimeout(async () => {
        try {
          setLoading(true)
          
          // Update location in localStorage first
          const updatedLocation = updateLocationRadius(newRadius)
          
          // Use the updateMyLocation which already handles both context updates
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
      }, 500); // 500ms debounce
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