import React, { useState, useEffect, useCallback, useMemo } from "react";
import { GoogleMap, useLoadScript, Marker, InfoWindow, Circle } from "@react-google-maps/api";
import { useAuth } from "../AuthContext";
import ErrorBoundary from "./ErrorBoundary";
import { getDisasterNews } from "../services/NewsService";

// Replace with your Google Maps API key
const GOOGLE_MAPS_API_KEY = "AIzaSyBAiCDlrLRdS1WsK8Utj9kVLFbjiun7PkU";

const mapContainerStyle = {
  width: "100%",
  height: "400px",
  borderRadius: "5px",
  marginBottom: "20px",
};

// URL for the current location marker
const CURRENT_LOCATION_MARKER = "https://maps.google.com/mapfiles/ms/icons/blue-dot.png";

// This helps prevent unnecessary re-renders of the Map component
const Map = React.memo(function Map() {
  // Map state
  const [center, setCenter] = useState({
    lat: 40.7128, // Default to New York
    lng: -74.0060,
  });
  const [location, setLocation] = useState(null);
  const [mapRef, setMapRef] = useState(null);
  
  // Data state
  const [alerts, setAlerts] = useState([]);
  const [userReports, setUserReports] = useState([]);
  const [newsItems, setNewsItems] = useState([]);
  
  // UI state
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedDisaster, setSelectedDisaster] = useState(null);
  const [showUserReports, setShowUserReports] = useState(true);
  const [showNewsItems, setShowNewsItems] = useState(true);
  // New state for tab control
  const [activeTab, setActiveTab] = useState("community");

  // Get location and radius update function from auth context
  const { userLocation, updateUserRadius } = useAuth();

  // Load the Google Maps Script
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

  // Format the disaster data for display
  const formatDisasterData = useCallback((disaster, isUserReport = false, isNewsItem = false) => {
    // Handle different data structures between user reports and news items
    if (isNewsItem) {
      // News item format
      if (!disaster.latitude || !disaster.longitude || 
          isNaN(parseFloat(disaster.latitude)) || 
          isNaN(parseFloat(disaster.longitude))) {
        return null;
      }
      
      return {
        id: disaster.id,
        title: disaster.title,
        description: disaster.description,
        latitude: disaster.latitude,
        longitude: disaster.longitude,
        category: disaster.category,
        publicationDate: disaster.publishedAt,
        link: disaster.url || null,
        author: disaster.source || "News Source",
        isUserReport: false,
        isNewsItem: true,
        displayName: null,
        imageUrl: disaster.imageUrl
      };
    } else {
      // User report (MongoDB GeoJSON format)
      const coordinates = disaster.location?.coordinates || [];
      // Ensure coordinates exist and have valid length
      if (!coordinates || coordinates.length < 2) {
        return null;
      }
      
      const longitude = coordinates[0]; // GeoJSON format is [longitude, latitude]
      const latitude = coordinates[1];
      
      // Check that coordinates are valid numbers
      if (isNaN(parseFloat(longitude)) || isNaN(parseFloat(latitude))) {
        return null;
      }
      
      return {
        id: disaster._id || disaster.id,
        title: disaster.title,
        description: disaster.description,
        latitude: latitude,
        longitude: longitude,
        category: disaster.type,
        publicationDate: disaster.createdAt,
        link: null,
        author: disaster.author,
        isUserReport: true,
        isNewsItem: false,
        displayName: disaster.location?.displayName || null
      };
    }
  }, []);

  // Combine and format all disaster data with better filtering for invalid data
  const allDisasters = useMemo(() => [
    ...(showUserReports ? userReports.map(report => formatDisasterData(report, true, false)).filter(Boolean) : []),
    ...(showNewsItems ? newsItems.map(news => formatDisasterData(news, false, true)).filter(Boolean) : [])
  ], [showUserReports, userReports, showNewsItems, newsItems, formatDisasterData]);

  // Get filtered posts based on current view settings - MOVED UP before any conditional returns
  const filteredPosts = useMemo(() => {
    if (activeTab === "community") {
      if (!showUserReports) return [];
      
      // Filter community reports by user's radius
      if (userLocation && userLocation.latitude && userLocation.longitude) {
        const radiusMiles = userLocation.radiusMiles || 50;
        
        return userReports.filter(post => {
          // Skip posts without valid coordinates
          if (!post.location || !post.location.coordinates || post.location.coordinates.length < 2) {
            return false;
          }
          
          const postLng = post.location.coordinates[0];
          const postLat = post.location.coordinates[1];
          
          // Earth's radius in km
          const R = 6371;
          
          // Convert coordinates to radians
          const lat1 = userLocation.latitude * Math.PI / 180;
          const lon1 = userLocation.longitude * Math.PI / 180;
          const lat2 = postLat * Math.PI / 180;
          const lon2 = postLng * Math.PI / 180;
          
          // Haversine formula
          const dLat = lat2 - lat1;
          const dLon = lon2 - lon1;
          const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1) * Math.cos(lat2) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          const distanceKm = R * c;
          const distanceMiles = distanceKm * 0.621371;
          
          return distanceMiles <= radiusMiles;
        });
      }
      
      return userReports;
    } else {
      return showNewsItems ? newsItems : [];
    }
  }, [activeTab, showUserReports, userReports, showNewsItems, newsItems, userLocation]);

  // Get marker icon based on disaster type
  const getMarkerIcon = useCallback((category, isUserReport = false, isNewsItem = false) => {
    // For user reports, use red-pushpin
    if (isUserReport) {
      return "https://maps.google.com/mapfiles/ms/icons/red-pushpin.png";
    }
    
    // For news items, use green-dot since it's more reliable
    return "https://maps.google.com/mapfiles/ms/icons/green-dot.png";
  }, []);

  // Handle map load
  const onMapLoad = useCallback((map) => {
    console.log("Map loaded");
    setMapRef(map);
    
    // If we have a user location, center the map and zoom correctly
    if (userLocation && userLocation.latitude && userLocation.longitude) {
      map.setCenter({
        lat: parseFloat(userLocation.latitude),
        lng: parseFloat(userLocation.longitude)
      });
      
      // Set a slightly zoomed out view to show the radius around user location
      const radiusMiles = userLocation.radiusMiles || 50;
      let zoom = 10; // default zoom
      
      // Calculate a better zoom level based on radius
      if (radiusMiles <= 5) zoom = 13;
      else if (radiusMiles <= 10) zoom = 12;
      else if (radiusMiles <= 25) zoom = 11;
      else if (radiusMiles <= 50) zoom = 10;
      else if (radiusMiles <= 100) zoom = 9;
      else zoom = 8;
      
      map.setZoom(zoom);
    }
  }, [userLocation]);

  // Safely render markers to prevent errors
  const renderSafeMarkers = useCallback(() => {
    try {
      return (
        <>
          {/* Current Location Marker */}
          {userLocation && userLocation.latitude && userLocation.longitude && (
            <>
              <Marker
                key="current-location"
                position={{
                  lat: parseFloat(userLocation.latitude),
                  lng: parseFloat(userLocation.longitude)
                }}
                icon={{
                  url: CURRENT_LOCATION_MARKER,
                  scaledSize: window.google && window.google.maps ? 
                    new window.google.maps.Size(40, 40) : null // Make it slightly larger, with safety check
                }}
                animation={window.google && window.google.maps ? 
                  window.google.maps.Animation.DROP : null}
                title="Your Location"
                zIndex={1000} // Place it above other markers
                onClick={() => setSelectedDisaster({
                  id: 'current-location',
                  title: 'Your Location',
                  description: userLocation.displayName || `${userLocation.latitude}, ${userLocation.longitude}`,
                  latitude: userLocation.latitude,
                  longitude: userLocation.longitude,
                  isCurrentLocation: true
                })}
              />
              <Circle
                center={{
                  lat: parseFloat(userLocation.latitude),
                  lng: parseFloat(userLocation.longitude)
                }}
                radius={userLocation.radiusMiles * 1609.34} // Convert miles to meters
                options={{
                  strokeColor: '#0066cc',
                  strokeOpacity: 0.8,
                  strokeWeight: 2,
                  fillColor: '#0066cc',
                  fillOpacity: 0.1,
                  zIndex: 1
                }}
              />
            </>
          )}

          {/* Regular Disaster Markers */}
          {allDisasters.map(disaster => {
            if (!disaster || !disaster.latitude || !disaster.longitude) {
              console.warn("Skipping marker due to missing coordinates", disaster);
              return null;
            }
            
            const lat = parseFloat(disaster.latitude);
            const lng = parseFloat(disaster.longitude);
            
            if (isNaN(lat) || isNaN(lng)) {
              console.warn("Skipping marker due to invalid coordinates", disaster);
              return null;
            }
            
            return (
              <Marker
                key={`${disaster.isNewsItem ? 'news' : (disaster.isUserReport ? 'report' : 'alert')}-${disaster.id}`}
                position={{ lat, lng }}
                icon={getMarkerIcon(disaster.category, disaster.isUserReport, disaster.isNewsItem)}
                onClick={() => setSelectedDisaster(disaster)}
                title={disaster.title}
              />
            );
          })}
        </>
      );
    } catch (error) {
      console.error("Error rendering markers:", error);
      return null;
    }
  }, [allDisasters, userLocation, getMarkerIcon, setSelectedDisaster]);

  // Fetch disaster data with proper memoization
  const fetchDisasterData = useCallback(async () => {
    setDataLoading(true);
    try {
      const radiusValue = userLocation?.radiusMiles || 50;
      console.log("Fetching disaster data with radius:", radiusValue);
      const token = localStorage.getItem('token');
      
      // Fetch news items with radius filter
      const newsData = await getDisasterNews(radiusValue, token);
      setNewsItems(newsData);
      
      // Fetch user-submitted reports with radius filter
      try {
        // Apply radius filter through query parameter
        const response = await fetch(`http://localhost:5000/api/posts?radius=${radiusValue}`, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        
        if (!response.ok) {
          throw new Error("Failed to fetch user reports");
        }
        
        const reportsData = await response.json();
        
        // Filter only reports with location data
        const reportsWithLocation = reportsData.filter(
          report => report.location && 
          report.location.coordinates && 
          report.location.coordinates.length === 2
        );
        
        console.log("Reports with location:", reportsWithLocation.length);
        setUserReports(reportsWithLocation);
      } catch (reportError) {
        console.error("Error fetching user reports:", reportError);
        // Still continue even if user reports fail
      }
    } catch (error) {
      console.error("Error fetching disaster data:", error);
      setError("Failed to load disaster data. Please try again later.");
    } finally {
      setDataLoading(false);
      setLoading(false);
    }
  }, [userLocation?.radiusMiles]);

  // Update state when userLocation changes
  useEffect(() => {
    console.log("Map component mounting, userLocation:", userLocation);
    
    if (userLocation) {
      console.log("Setting map center to:", userLocation);
      setLocation(userLocation);
      setCenter({
        lat: userLocation.latitude,
        lng: userLocation.longitude
      });
      
      // Fetch data with current radius
      fetchDisasterData();
    } else {
      console.warn("No user location available for map initialization");
      setLoading(false);
    }
  }, [userLocation, fetchDisasterData]);

  // Handle radius change from dropdown
  const handleRadiusChange = async (e) => {
    const newRadius = parseInt(e.target.value, 10);
    console.log("Radius changed to:", newRadius);
    
    try {
      // Update radius through the central context method
      await updateUserRadius(newRadius);
      // No need to re-fetch, the useEffect will handle that when userLocation changes
    } catch (error) {
      setError("Failed to update radius. Please try again.");
    }
  };

  // Handle tab changes
  const handleTabChange = (tabName) => {
    setActiveTab(tabName);
  };

  // If map loading failed, show error
  if (loadError) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h2>Error loading map</h2>
        <p>There was an error loading the map. Please try again later.</p>
        <p>Error details: {loadError.message}</p>
      </div>
    );
  }

  // If map is not loaded yet, show loading state
  if (!isLoaded) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h2>Loading Map</h2>
        <p>Please wait while we load the map...</p>
      </div>
    );
  }

  // Define styles for posts section
  const reportCardStyle = {
    backgroundColor: '#fff',
    padding: '15px',
    borderRadius: '5px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)',
    marginBottom: '15px',
    transition: 'all 0.3s',
    cursor: 'pointer',
  };

  const tabStyle = {
    display: 'flex',
    borderBottom: '1px solid #ddd',
    marginBottom: '20px',
  };

  const tabItemStyle = (isActive) => ({
    padding: '10px 20px',
    cursor: 'pointer',
    fontWeight: isActive ? 'bold' : 'normal',
    borderBottom: isActive ? '2px solid #0066cc' : 'none',
    color: isActive ? '#0066cc' : '#333',
  });

  const emptyStateStyle = {
    textAlign: 'center',
    padding: '30px',
    backgroundColor: '#f8f9fa',
    borderRadius: '5px',
    marginBottom: '20px',
  };

  return (
    <ErrorBoundary>
      <div style={{ padding: '15px' }}>
        <h1 style={{ fontSize: '24px', marginBottom: '15px' }}>Disaster Map</h1>
        
        {error && (
          <div style={{ 
            backgroundColor: '#f8d7da', 
            color: '#721c24', 
            padding: '10px', 
            borderRadius: '5px',
            marginBottom: '15px'
          }}>
            {error}
            <button 
              onClick={() => { setError(null); fetchDisasterData(); }} 
              style={{
                marginLeft: '10px',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                padding: '5px 10px',
                borderRadius: '3px',
                cursor: 'pointer'
              }}
            >
              Retry
            </button>
          </div>
        )}
        
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '15px',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <div>
            <h2 style={{ fontSize: '18px', margin: '0 0 5px 0' }}>Disaster Alerts & Reports</h2>
            {userLocation && (
              <p style={{ margin: '0', fontSize: '14px' }}>
                Showing data within <strong>{userLocation.radiusMiles || 50} miles</strong> of your location
              </p>
            )}
          </div>
          
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {userLocation && (
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <label htmlFor="radius-select" style={{ marginRight: '10px', fontSize: '14px' }}>
                  Radius:
                </label>
                <select 
                  id="radius-select"
                  value={userLocation.radiusMiles || 50}
                  onChange={handleRadiusChange}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '4px',
                    border: '1px solid #ccc'
                  }}
                >
                  <option value="5">5 miles</option>
                  <option value="10">10 miles</option>
                  <option value="25">25 miles</option>
                  <option value="50">50 miles</option>
                  <option value="100">100 miles</option>
                  <option value="200">200 miles</option>
                </select>
              </div>
            )}
            
            <button 
              onClick={() => setShowUserReports(!showUserReports)}
              style={{
                backgroundColor: showUserReports ? '#dc3545' : '#6c757d',
                color: 'white',
                border: 'none',
                padding: '5px 10px',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              {showUserReports ? 'Hide Community Reports' : 'Show Community Reports'}
            </button>
            
            <button 
              onClick={() => setShowNewsItems(!showNewsItems)}
              style={{
                backgroundColor: showNewsItems ? '#28a745' : '#6c757d',
                color: 'white',
                border: 'none',
                padding: '5px 10px',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              {showNewsItems ? 'Hide News Reports' : 'Show News Reports'}
            </button>
          </div>
        </div>
        
        {loading || dataLoading ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <p>Loading map data...</p>
          </div>
        ) : (
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={center}
            zoom={10}
            onLoad={onMapLoad}
            options={{
              fullscreenControl: true,
              streetViewControl: false,
              mapTypeControl: true,
              zoomControl: true,
            }}
          >
            {/* Render markers safely */}
            {renderSafeMarkers()}
            
            {/* Info window for selected disaster */}
            {selectedDisaster && (
              <InfoWindow
                position={{
                  lat: parseFloat(selectedDisaster.latitude),
                  lng: parseFloat(selectedDisaster.longitude),
                }}
                onCloseClick={() => setSelectedDisaster(null)}
              >
                <div style={{ maxWidth: '300px' }}>
                  <h3 style={{ margin: '0 0 5px 0', fontSize: '16px' }}>{selectedDisaster.title}</h3>
                  
                  {selectedDisaster.isCurrentLocation ? (
                    <div style={{
                      backgroundColor: '#e6f2ff', 
                      color: '#0066cc',
                      padding: '5px 10px',
                      borderRadius: '3px',
                      display: 'inline-block',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      marginBottom: '10px'
                    }}>
                      YOUR LOCATION
                    </div>
                  ) : selectedDisaster.category && (
                    <div style={getCategoryStyle(selectedDisaster.category)}>
                      {selectedDisaster.category.toUpperCase()}
                    </div>
                  )}
                  
                  <p style={{ margin: '10px 0', fontSize: '14px' }}>{selectedDisaster.description}</p>
                  
                  {!selectedDisaster.isCurrentLocation && (
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      borderTop: '1px solid #eee',
                      paddingTop: '8px',
                      marginTop: '8px',
                      fontSize: '12px'
                    }}>
                      <span>
                        {selectedDisaster.publicationDate && formatDate(selectedDisaster.publicationDate)}
                      </span>
                      <span>
                        {selectedDisaster.isUserReport ? 'Community Report' : 'News Report'}
                      </span>
                    </div>
                  )}
                  
                  {selectedDisaster.isCurrentLocation && userLocation && (
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      borderTop: '1px solid #eee',
                      paddingTop: '8px',
                      marginTop: '8px',
                      fontSize: '12px'
                    }}>
                      <span>
                        Radius: <strong>{userLocation.radiusMiles} miles</strong>
                      </span>
                    </div>
                  )}
                  
                  {selectedDisaster.link && (
                    <div style={{ marginTop: '10px' }}>
                      <a 
                        href={selectedDisaster.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-block',
                          backgroundColor: '#0066cc',
                          color: 'white',
                          padding: '5px 10px',
                          borderRadius: '3px',
                          textDecoration: 'none',
                          fontSize: '12px'
                        }}
                      >
                        Read Full Article
                      </a>
                    </div>
                  )}
                </div>
              </InfoWindow>
            )}
          </GoogleMap>
        )}
        
        <div style={{ marginTop: '20px' }}>
          <h3 style={{ fontSize: '16px', margin: '0 0 10px 0' }}>Map Legend</h3>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <img src={CURRENT_LOCATION_MARKER} alt="Your Location" style={{ height: '20px' }} />
              <span>Your Location</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <img src="https://maps.google.com/mapfiles/ms/icons/red-pushpin.png" alt="Community Report" style={{ height: '20px' }} />
              <span>Community Reports</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <img src="https://maps.google.com/mapfiles/ms/icons/green-dot.png" alt="News Report" style={{ height: '20px' }} />
              <span>News Reports</span>
            </div>
          </div>
        </div>

        {/* New Posts Section Below Map */}
        <div style={{ marginTop: '30px' }}>
          <h2 style={{ fontSize: '20px', marginBottom: '15px' }}>Disaster Reports</h2>
          
          {/* Tabs Navigation */}
          <div style={tabStyle}>
            <div 
              style={tabItemStyle(activeTab === "community")}
              onClick={() => handleTabChange("community")}
            >
              Community Reports {showUserReports ? '' : '(Hidden)'}
            </div>
            <div 
              style={tabItemStyle(activeTab === "news")}
              onClick={() => handleTabChange("news")}
            >
              News Reports {showNewsItems ? '' : '(Hidden)'}
            </div>
          </div>
          
          {/* Posts List */}
          {loading || dataLoading ? (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <p>Loading disaster reports...</p>
            </div>
          ) : (
            <div>
              {filteredPosts.length === 0 ? (
                <div style={emptyStateStyle}>
                  {activeTab === "community" && !showUserReports && (
                    <p>Community reports are currently hidden. Click "Show Community Reports" to view them.</p>
                  )}
                  {activeTab === "news" && !showNewsItems && (
                    <p>News reports are currently hidden. Click "Show News Reports" to view them.</p>
                  )}
                  {((activeTab === "community" && showUserReports) || (activeTab === "news" && showNewsItems)) && (
                    <p>No {activeTab === "community" ? 'community' : 'news'} reports found within {userLocation?.radiusMiles || 50} miles of your location.</p>
                  )}
                </div>
              ) : (
                filteredPosts.map(post => {
                  // Format post data for display
                  const formattedPost = activeTab === "community" 
                    ? formatDisasterData(post, true, false) 
                    : formatDisasterData(post, false, true);
                  
                  if (!formattedPost) return null;
                  
                  // Calculate distance for community reports
                  let distance = null;
                  if (activeTab === "community" && userLocation && post.location?.coordinates) {
                    const postLng = post.location.coordinates[0];
                    const postLat = post.location.coordinates[1];
                    
                    // Earth's radius in km
                    const R = 6371;
                    
                    // Convert coordinates to radians
                    const lat1 = userLocation.latitude * Math.PI / 180;
                    const lon1 = userLocation.longitude * Math.PI / 180;
                    const lat2 = postLat * Math.PI / 180;
                    const lon2 = postLng * Math.PI / 180;
                    
                    // Haversine formula
                    const dLat = lat2 - lat1;
                    const dLon = lon2 - lon1;
                    const a = 
                      Math.sin(dLat/2) * Math.sin(dLat/2) +
                      Math.cos(lat1) * Math.cos(lat2) * 
                      Math.sin(dLon/2) * Math.sin(dLon/2);
                    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                    const distanceKm = R * c;
                    distance = (distanceKm * 0.621371).toFixed(1); // Convert to miles and round to 1 decimal
                  }
                  
                  return (
                    <div key={formattedPost.id} style={reportCardStyle} onClick={() => setSelectedDisaster(formattedPost)}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          {formattedPost.category && (
                            <div style={getCategoryStyle(formattedPost.category)}>
                              {formattedPost.category.toUpperCase()}
                            </div>
                          )}
                          <h3 style={{ margin: '5px 0 10px', fontSize: '18px' }}>{formattedPost.title}</h3>
                        </div>
                        <div style={{ color: '#666', fontSize: '0.8rem' }}>
                          {formattedPost.publicationDate && formatDate(formattedPost.publicationDate)}
                        </div>
                      </div>
                      
                      <p style={{ margin: '10px 0' }}>{formattedPost.description}</p>
                      
                      <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '5px' }}>
                        {formattedPost.displayName && (
                          <p style={{ margin: '0 0 5px 0' }}>
                            <strong>Location:</strong> {formattedPost.displayName}
                            {distance && ` (${distance} miles away)`}
                          </p>
                        )}
                        {!formattedPost.displayName && distance && (
                          <p style={{ margin: '0 0 5px 0' }}>
                            <strong>Distance:</strong> {distance} miles away
                          </p>
                        )}
                      </div>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '15px', fontSize: '0.9rem' }}>
                        {formattedPost.isNewsItem && formattedPost.link && (
                          <a 
                            href={formattedPost.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              display: 'inline-block',
                              backgroundColor: '#0066cc',
                              color: 'white',
                              padding: '5px 10px',
                              borderRadius: '3px',
                              textDecoration: 'none',
                              fontSize: '12px'
                            }}
                          >
                            Read Full Article
                          </a>
                        )}
                        <div style={{ marginLeft: 'auto' }}>
                          By: {formattedPost.author || 'Anonymous'}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
});

// Format date helper
const formatDate = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  
  const diffTime = Math.abs(now - date);
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffTime / (1000 * 60));
  
  if (diffDays > 0) {
    return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
  } else if (diffHours > 0) {
    return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
  } else {
    return `${diffMinutes} ${diffMinutes === 1 ? 'minute' : 'minutes'} ago`;
  }
};

// Get category style for info window
const getCategoryStyle = (category) => {
  const baseStyle = {
    display: 'inline-block',
    padding: '2px 6px',
    borderRadius: '3px',
    fontSize: '12px',
    color: 'white',
    fontWeight: 'bold',
    marginBottom: '5px'
  };
  
  switch (category?.toLowerCase()) {
    case 'earthquake':
      return { ...baseStyle, backgroundColor: '#dc3545' };
    case 'flood':
      return { ...baseStyle, backgroundColor: '#17a2b8' };
    case 'hurricane':
    case 'cyclone':
    case 'typhoon':
      return { ...baseStyle, backgroundColor: '#6f42c1' };
    case 'wildfire':
      return { ...baseStyle, backgroundColor: '#fd7e14' };
    case 'tornado':
      return { ...baseStyle, backgroundColor: '#20c997' };
    default:
      return { ...baseStyle, backgroundColor: '#6c757d' };
  }
};

export default Map;