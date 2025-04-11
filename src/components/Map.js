import { useState, useEffect } from "react";
import { GoogleMap, LoadScript, Marker, InfoWindow } from "@react-google-maps/api";
import { getStoredLocation } from "../services/LocationService";
import { getDisasterAlerts } from "../services/NewsService";

// Replace with your Google Maps API key
const GOOGLE_MAPS_API_KEY = "AIzaSyBAiCDlrLRdS1WsK8Utj9kVLFbjiun7PkU";



function Map() {
  const [center, setCenter] = useState({
    lat: 40.7128, // Default to New York
    lng: -74.0060,
  });
  const [location, setLocation] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [userReports, setUserReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDisaster, setSelectedDisaster] = useState(null);
  const [showUserReports, setShowUserReports] = useState(true);
  const [showOfficialAlerts, setShowOfficialAlerts] = useState(true);

  useEffect(() => {
    // Load user location
    const userLocation = getStoredLocation();
    if (userLocation) {
      setLocation(userLocation);
      setCenter({
        lat: userLocation.latitude,
        lng: userLocation.longitude
      });
    }

    // Fetch disaster alerts and user reports
    fetchDisasterData();
  }, []);

  const fetchDisasterData = async () => {
    setLoading(true);
    try {
      // Fetch official alerts
      const alertsData = await getDisasterAlerts();
      setAlerts(alertsData);
      
      // Fetch user-submitted reports
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/posts', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      
      if (!response.ok) {
        throw new Error("Failed to fetch user reports");
      }
      
      const reportsData = await response.json();
      // Filter only reports with location data
      const reportsWithLocation = reportsData.filter(
        report => report.location && report.location.latitude && report.location.longitude
      );
      setUserReports(reportsWithLocation);
    } catch (error) {
      console.error("Error fetching disaster data:", error);
      setError("Failed to load disaster data. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  // Get marker icon based on disaster type
  const getMarkerIcon = (category, isUserReport = false) => {
    const userReportPrefix = isUserReport ? "pushpin" : "dot";
  
    if (!category || typeof category !== "string") {
      return `http://maps.google.com/mapfiles/ms/icons/yellow-${userReportPrefix}.png`;
    }
  
    const lowerCategory = category.toLowerCase().trim();
  
    const iconMap = {
      earthquake: 'red',
      flood: 'blue',
      fire: 'orange',
      hurricane: 'purple',
      tornado: 'ltblue'
    };
  
    const matched = Object.keys(iconMap).find(key => lowerCategory.includes(key));
    const color = iconMap[matched] || 'yellow';
  
    return `http://maps.google.com/mapfiles/ms/icons/${color}-${userReportPrefix}.png`;
  };
  

  // Format the disaster data for display
  const formatDisasterData = (disaster, isUserReport = false) => {
    return {
      id: disaster.id || disaster._id,
      title: disaster.title,
      description: disaster.description,
      latitude: isUserReport ? disaster.location.latitude : disaster.latitude,
      longitude: isUserReport ? disaster.location.longitude : disaster.longitude,
      category: isUserReport ? disaster.type : disaster.category,
      publicationDate: isUserReport ? disaster.createdAt : disaster.publicationDate,
      link: disaster.link || null,
      author: isUserReport ? disaster.author : "Official Source",
      isUserReport
    };
  };

  // Combine and format all disaster data
  const allDisasters = [
    ...(showOfficialAlerts ? alerts.map(alert => formatDisasterData(alert, false)) : []),
    ...(showUserReports ? userReports.map(report => formatDisasterData(report, true)) : [])
  ];

  // Group disasters by type for the legend
  const disastersByType = {
    earthquake: allDisasters.filter(disaster => disaster.category?.toLowerCase().includes('earthquake')),
    flood: allDisasters.filter(disaster => disaster.category?.toLowerCase().includes('flood')),
    fire: allDisasters.filter(disaster => disaster.category?.toLowerCase().includes('fire')),
    hurricane: allDisasters.filter(disaster => disaster.category?.toLowerCase().includes('hurricane')),
    tornado: allDisasters.filter(disaster => disaster.category?.toLowerCase().includes('tornado')),
    other: allDisasters.filter(disaster => {
      const category = disaster.category?.toLowerCase() || '';
      return !category.includes('earthquake') && 
             !category.includes('flood') && 
             !category.includes('fire') &&
             !category.includes('hurricane') &&
             !category.includes('tornado');
    })
  };

  return (
    <div>
      <h1>Disaster Map</h1>
      
      {!location && (
        <div style={alertStyle}>
          <p>No location data available. Please set your location in Settings to see relevant disasters.</p>
          <a href="/settings" style={buttonStyle}>Go to Settings</a>
        </div>
      )}
      
      {error && (
        <div style={errorStyle}>
          <p>{error}</p>
          <button onClick={fetchDisasterData} style={buttonStyle}>Retry</button>
        </div>
      )}
      
      <div style={filterContainerStyle}>
        <div style={filterGroupStyle}>
          <label style={checkboxLabelStyle}>
            <input
              type="checkbox"
              checked={showUserReports}
              onChange={() => setShowUserReports(!showUserReports)}
            />
            Show Community Reports
          </label>
          <label style={checkboxLabelStyle}>
            <input
              type="checkbox"
              checked={showOfficialAlerts}
              onChange={() => setShowOfficialAlerts(!showOfficialAlerts)}
            />
            Show Official Alerts
          </label>
        </div>
        <button onClick={fetchDisasterData} style={refreshButtonStyle}>
          Refresh Map
        </button>
      </div>
      
      <div style={mapContainerStyle}>
        {loading ? (
          <div style={loadingStyle}>Loading disaster data...</div>
        ) : (
          <LoadScript googleMapsApiKey={GOOGLE_MAPS_API_KEY}>
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={center}
              zoom={10}
            >
              {/* User location marker */}
              {location && (
                <Marker
                  position={{ lat: location.latitude, lng: location.longitude }}
                  icon={{
                    url: "http://maps.google.com/mapfiles/ms/icons/green-dot.png",
                    scaledSize: { width: 40, height: 40 }
                  }}
                  title="Your Location"
                />
              )}
              
              {/* Disaster markers */}
              {allDisasters.map(disaster => {
                if (!disaster.latitude || !disaster.longitude) return null;
                
                return (
                  <Marker
                    key={`${disaster.isUserReport ? 'report' : 'alert'}-${disaster.id}`}
                    position={{ lat: disaster.latitude, lng: disaster.longitude }}
                    icon={{
                      url: getMarkerIcon(disaster.category, disaster.isUserReport),
                      scaledSize: { width: 32, height: 32 }
                    }}
                    onClick={() => setSelectedDisaster(disaster)}
                    title={disaster.title}
                  />
                );
              })}
              
              {/* Info window for selected disaster */}
              {selectedDisaster && (
                <InfoWindow
                  position={{ 
                    lat: selectedDisaster.latitude, 
                    lng: selectedDisaster.longitude 
                  }}
                  onCloseClick={() => setSelectedDisaster(null)}
                >
                  <div style={{ padding: '5px', maxWidth: '300px' }}>
                    <h3 style={{ margin: '0 0 8px 0' }}>{selectedDisaster.title}</h3>
                    <p style={{ margin: '0 0 5px 0', fontSize: '14px' }}>{selectedDisaster.description}</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                      <span style={getCategoryStyle(selectedDisaster.category)}>
                        {(selectedDisaster.category || 'Unknown').toUpperCase()}
                      </span>
                      <span style={{ fontSize: '12px', color: '#666' }}>
                        {formatDate(selectedDisaster.publicationDate)}
                      </span>
                    </div>
                    <p style={{ margin: '5px 0', fontSize: '12px', fontStyle: 'italic' }}>
                      Source: {selectedDisaster.isUserReport ? `Community report by ${selectedDisaster.author}` : 'Official alert'}
                    </p>
                    {selectedDisaster.link && (
                      <a 
                        href={selectedDisaster.link} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        style={{ fontSize: '13px', display: 'inline-block', marginTop: '8px' }}
                      >
                        More Information
                      </a>
                    )}
                  </div>
                </InfoWindow>
              )}
            </GoogleMap>
          </LoadScript>
        )}
      </div>
      
      <div style={legendContainerStyle}>
        <h2>Legend</h2>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div>
            <div style={legendItemStyle}>
              <span style={{ ...legendCircleStyle, backgroundColor: '#FF0000' }}></span>
              <span>Earthquake ({disastersByType.earthquake.length})</span>
            </div>
            <div style={legendItemStyle}>
              <span style={{ ...legendCircleStyle, backgroundColor: '#2196F3' }}></span>
              <span>Flood ({disastersByType.flood.length})</span>
            </div>
            <div style={legendItemStyle}>
              <span style={{ ...legendCircleStyle, backgroundColor: '#FF9800' }}></span>
              <span>Fire ({disastersByType.fire.length})</span>
            </div>
          </div>
          <div>
            <div style={legendItemStyle}>
              <span style={{ ...legendCircleStyle, backgroundColor: '#9C27B0' }}></span>
              <span>Hurricane ({disastersByType.hurricane.length})</span>
            </div>
            <div style={legendItemStyle}>
              <span style={{ ...legendCircleStyle, backgroundColor: '#00BCD4' }}></span>
              <span>Tornado ({disastersByType.tornado.length})</span>
            </div>
            <div style={legendItemStyle}>
              <span style={{ ...legendCircleStyle, backgroundColor: '#757575' }}></span>
              <span>Other ({disastersByType.other.length})</span>
            </div>
          </div>
        </div>
        <div style={{ borderTop: '1px solid #ddd', paddingTop: '10px' }}>
          <div style={legendItemStyle}>
            <img src="http://maps.google.com/mapfiles/ms/icons/red-dot.png" alt="Official" width="20" />
            <span>Official Alerts</span>
          </div>
          <div style={legendItemStyle}>
            <img src="http://maps.google.com/mapfiles/ms/icons/red-pushpin.png" alt="Community" width="20" />
            <span>Community Reports</span>
          </div>
          <div style={legendItemStyle}>
            <img src="http://maps.google.com/mapfiles/ms/icons/green-dot.png" alt="You" width="20" />
            <span>Your Location</span>
          </div>
        </div>
      </div>
      
      <div style={{ marginTop: '30px' }}>
        <h2>Recent Disasters</h2>
        {loading ? (
          <p>Loading...</p>
        ) : allDisasters.length > 0 ? (
          <div style={disasterListStyle}>
            {allDisasters
              .sort((a, b) => new Date(b.publicationDate) - new Date(a.publicationDate))
              .slice(0, 5)
              .map(disaster => (
                <div 
                  key={`list-${disaster.isUserReport ? 'report' : 'alert'}-${disaster.id}`} 
                  style={disasterItemStyle}
                  onClick={() => {
                    setSelectedDisaster(disaster);
                    setCenter({ lat: disaster.latitude, lng: disaster.longitude });
                  }}
                >
                  <div style={disasterHeaderStyle}>
                    <h3 style={disasterTitleStyle}>{disaster.title}</h3>
                    <span style={getCategoryStyle(disaster.category)}>
                      {(disaster.category || 'Unknown').toUpperCase()}
                    </span>
                  </div>
                  <p style={disasterDescriptionStyle}>
                    {disaster.description.length > 150 
                      ? `${disaster.description.substring(0, 150)}...` 
                      : disaster.description}
                  </p>
                  <div style={disasterMetaStyle}>
                    <span>
                      {disaster.isUserReport 
                        ? `Reported by ${disaster.author}` 
                        : 'Official alert'}
                    </span>
                    <span>{formatDate(disaster.publicationDate)}</span>
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <p>No disasters or reports found in your area.</p>
        )}
      </div>
    </div>
  );
}

// Helper function to format date
const formatDate = (dateString) => {
  if (!dateString) return 'Unknown';
  const date = new Date(dateString);
  
  // Check if date is today
  const today = new Date();
  const isToday = date.getDate() === today.getDate() &&
                  date.getMonth() === today.getMonth() &&
                  date.getFullYear() === today.getFullYear();
  
  if (isToday) {
    // Format as "Today at HH:MM AM/PM"
    return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  
  // Check if date is yesterday
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.getDate() === yesterday.getDate() &&
                       date.getMonth() === yesterday.getMonth() &&
                       date.getFullYear() === yesterday.getFullYear();
  
  if (isYesterday) {
    // Format as "Yesterday at HH:MM AM/PM"
    return `Yesterday at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  
  // Format as "Month Day, Year at HH:MM AM/PM"
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Helper function to get category badge style
const getCategoryStyle = (category) => {
  const baseStyle = {
    display: 'inline-block',
    padding: '2px 6px',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: 'bold',
    color: 'white',
  };
  
  if (!category) return { ...baseStyle, backgroundColor: '#757575' };
  
  const lowerCategory = category.toLowerCase();
  
  if (lowerCategory.includes('earthquake')) {
    return { ...baseStyle, backgroundColor: '#FF0000' }; // Red
  } else if (lowerCategory.includes('flood')) {
    return { ...baseStyle, backgroundColor: '#2196F3' }; // Blue
  } else if (lowerCategory.includes('fire')) {
    return { ...baseStyle, backgroundColor: '#FF9800' }; // Orange
  } else if (lowerCategory.includes('hurricane')) {
    return { ...baseStyle, backgroundColor: '#9C27B0' }; // Purple
  } else if (lowerCategory.includes('tornado')) {
    return { ...baseStyle, backgroundColor: '#00BCD4' }; // Light Blue
  } else {
    return { ...baseStyle, backgroundColor: '#757575' }; // Gray
  }
};

// Styles
const mapContainerStyle = {
  width: "100%",
  height: "400px",
  borderRadius: "5px",
  marginBottom: "20px",
};

const loadingStyle = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  height: '400px',
  backgroundColor: '#f5f5f5',
};

const alertStyle = {
  backgroundColor: '#fff3cd',
  color: '#856404',
  padding: '15px',
  borderRadius: '5px',
  marginBottom: '20px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: '10px',
};

const errorStyle = {
  backgroundColor: '#f8d7da',
  color: '#721c24',
  padding: '15px',
  borderRadius: '5px',
  marginBottom: '20px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: '10px',
};

const buttonStyle = {
  display: 'inline-block',
  padding: '8px 16px',
  backgroundColor: '#007bff',
  color: 'white',
  textDecoration: 'none',
  borderRadius: '4px',
  border: 'none',
  cursor: 'pointer',
  fontSize: '14px',
};

const filterContainerStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '15px',
  padding: '10px',
  backgroundColor: '#f9f9f9',
  borderRadius: '5px',
};

const filterGroupStyle = {
  display: 'flex',
  gap: '15px',
};

const checkboxLabelStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '5px',
  fontSize: '14px',
  cursor: 'pointer',
};

const refreshButtonStyle = {
  padding: '6px 12px',
  backgroundColor: '#f8f9fa',
  color: '#212529',
  border: '1px solid #ddd',
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '14px',
};

const legendContainerStyle = {
  backgroundColor: '#f9f9f9',
  padding: '15px',
  borderRadius: '5px',
};

const legendItemStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  margin: '5px 0',
  fontSize: '14px',
};

const legendCircleStyle = {
  width: '12px',
  height: '12px',
  borderRadius: '50%',
  display: 'inline-block',
};

const disasterListStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '15px',
};

const disasterItemStyle = {
  border: '1px solid #ddd',
  borderRadius: '5px',
  padding: '15px',
  backgroundColor: 'white',
  cursor: 'pointer',
  transition: 'box-shadow 0.2s ease-in-out',
  boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
};

const disasterHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '10px',
};

const disasterTitleStyle = {
  margin: 0,
  fontSize: '16px',
  fontWeight: 'bold',
  color: '#333',
};

const disasterDescriptionStyle = {
  margin: '0 0 10px 0',
  fontSize: '14px',
  color: '#555',
  lineHeight: '1.4',
};

const disasterMetaStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: '12px',
  color: '#777',
};

export default Map;